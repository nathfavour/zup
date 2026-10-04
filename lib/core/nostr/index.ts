import { sha256Hex, schnorrSign, schnorrVerify } from '../crypto';
import { LocalEvent } from '../types';

/**
 * Serializes a Nostr event canonically as per NIP-01:
 * [0, <pubkey: lowercase hex>, <created_at: number>, <kind: number>, <tags: array of arrays>, <content: string>]
 */
export function serializeEvent(event: {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}): string {
  return JSON.stringify([
    0,
    event.pubkey.toLowerCase(),
    event.created_at,
    event.kind,
    event.tags,
    event.content
  ]);
}

/**
 * Calculates SHA-256 event ID for canonical event serialization
 */
export async function calculateEventId(event: {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}): Promise<string> {
  const serialized = serializeEvent(event);
  return await sha256Hex(serialized);
}

/**
 * Creates and signs a real Nostr event
 */
export async function createAndSignEvent(
  signer: { pubkey: string; privkey: string },
  kind: number,
  tags: string[][],
  content: string,
  relaySource = 'local'
): Promise<LocalEvent> {
  const created_at = Math.floor(Date.now() / 1000);
  const pubkey = signer.pubkey.toLowerCase();

  const id = await calculateEventId({
    pubkey,
    created_at,
    kind,
    tags,
    content
  });

  const sig = await schnorrSign(id, signer.privkey);

  return {
    id,
    pubkey,
    kind,
    created_at,
    tags,
    content,
    sig,
    first_seen_at: Date.now(),
    relay_source: relaySource
  };
}

/**
 * Validates canonical event integrity and Schnorr signature
 */
export async function validateEvent(event: LocalEvent): Promise<{
  isValid: boolean;
  computedId: string;
  idMatches: boolean;
  sigValid: boolean;
  reason?: string;
}> {
  try {
    const computedId = await calculateEventId({
      pubkey: event.pubkey,
      created_at: event.created_at,
      kind: event.kind,
      tags: event.tags,
      content: event.content
    });

    const idMatches = computedId === event.id;
    const sigValid = await schnorrVerify(computedId, event.sig, event.pubkey);

    return {
      isValid: idMatches && sigValid,
      computedId,
      idMatches,
      sigValid,
      reason: !idMatches
        ? 'Event hash mismatch'
        : !sigValid
        ? 'Schnorr signature validation failed'
        : undefined
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown validation error';
    return {
      isValid: false,
      computedId: '',
      idMatches: false,
      sigValid: false,
      reason: message
    };
  }
}

/**
 * Extracts unique hashtags (#tags) from event tags, preserving original casing while preventing duplicates
 */
export function extractEventTags(tags: string[][]): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const uniqueTags: string[] = [];
  for (const tagArr of tags) {
    if (Array.isArray(tagArr) && tagArr[0] === 't' && tagArr[1]) {
      const cleaned = tagArr[1].trim();
      const lower = cleaned.toLowerCase();
      if (cleaned && !seen.has(lower)) {
        seen.add(lower);
        uniqueTags.push(cleaned);
      }
    }
  }
  return uniqueTags;
}

/**
 * Truncate pubkey or hash with ellipsis
 */
export function formatHex(hex: string, front = 8, back = 6): string {
  if (!hex || hex.length <= front + back) return hex;
  return `${hex.slice(0, front)}…${hex.slice(-back)}`;
}

/**
 * Detects low-effort posts, gibberish alphanumericals, disproportionate numbers,
 * keyboard smashes, and raw hash dumps.
 */
export function isLowEffortOrGibberish(text: string): { isLowEffort: boolean; reason?: string } {
  const content = text.trim();

  // 1. Minimum content length: posts must have at least 6 meaningful characters
  if (content.length < 6) {
    return { isLowEffort: true, reason: 'Content too short (<6 characters)' };
  }

  // Strip URLs and hashtags to analyze the actual human text payload
  const textWithoutUrls = content
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/#\w+/g, '')
    .trim();

  // If there's barely any text outside URLs or tags
  if (textWithoutUrls.length < 5) {
    return { isLowEffort: true, reason: 'Insufficient text body' };
  }

  // 2. Disproportionate digits/numbers check (>30% numbers)
  const digitMatches = textWithoutUrls.match(/[0-9]/g) || [];
  const digitRatio = digitMatches.length / textWithoutUrls.length;
  if (digitRatio > 0.30 && textWithoutUrls.length > 8) {
    return { isLowEffort: true, reason: 'Disproportionate numbers/digits (>30%)' };
  }

  // Contiguous sequence of 12+ digits (e.g. raw timestamps, phone lists, card/wallet dumps)
  if (/\b\d{12,}\b/.test(textWithoutUrls)) {
    return { isLowEffort: true, reason: 'Contiguous long number sequence' };
  }

  // 3. Gibberish alphanumerical strings & raw hash dumps
  const words = textWithoutUrls.split(/\s+/).filter(Boolean);
  for (const word of words) {
    // Single unspaced token > 28 chars (hash, token, raw hex, base64)
    if (word.length > 28) {
      return { isLowEffort: true, reason: 'Unbroken alphanumeric token (>28 chars)' };
    }

    // Keyboard smash detection: words with length >= 6 having 0 vowels
    if (word.length >= 6 && !/[aeiouyAEIOUY]/.test(word) && !/^\d+$/.test(word)) {
      return { isLowEffort: true, reason: 'Vowelless keyboard smash' };
    }

    // Repetitive character smash (e.g. "aaaaaa", "zzzzzz", "fffffff")
    if (/(.)\1{4,}/.test(word)) {
      return { isLowEffort: true, reason: 'Repetitive character smash' };
    }
  }

  // 4. Low vocabulary entropy (single word repeated)
  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
  if (words.length >= 4 && uniqueWords.size === 1) {
    return { isLowEffort: true, reason: 'Single repeated word spam' };
  }

  // 5. Pure symbol/punctuation/emoji spam
  const alphanumericCount = (textWithoutUrls.match(/[a-zA-Z0-9]/g) || []).length;
  if (alphanumericCount < 4) {
    return { isLowEffort: true, reason: 'Almost zero alphanumeric characters' };
  }

  return { isLowEffort: false };
}

/**
 * Robust spam, reply, and low-quality filter:
 * 1. Excludes replies (events with 'e' tags or reply markers) - only root posts are allowed.
 * 2. Excludes low-effort, gibberish alphanumerical, or number-stuffed posts.
 * 3. Excludes link-stuffed spam (posts with > 2 URLs or overwhelming link-to-text ratio).
 * 4. Excludes typical spam keyword bots.
 */
export function isSpamOrReply(event: {
  tags?: string[][];
  content?: string;
  kind?: number;
}): { isSpamOrReply: boolean; reason?: string } {
  const content = (event.content || '').trim();
  const tags = event.tags || [];

  // 1. Reply check: In Nostr NIP-10, an 'e' tag marks a referenced or parent event
  const isReply = tags.some((t) => {
    if (t[0] === 'e') return true;
    if (t[0] === 'p' && t[3] === 'reply') return true;
    return false;
  });

  if (isReply) {
    return { isSpamOrReply: true, reason: 'Reply to another post' };
  }

  // 2. Comprehensive low-effort, number-dump, and gibberish filter
  const lowEffortCheck = isLowEffortOrGibberish(content);
  if (lowEffortCheck.isLowEffort) {
    return { isSpamOrReply: true, reason: lowEffortCheck.reason };
  }

  // 3. Link density and link spam check
  const urlMatches = content.match(/https?:\/\/[^\s]+/gi) || [];
  if (urlMatches.length > 2) {
    return { isSpamOrReply: true, reason: 'Link overload (>2 URLs)' };
  }

  // If the post is almost 100% just a raw link with zero commentary
  if (urlMatches.length === 1 && content.length < urlMatches[0].length + 6) {
    return { isSpamOrReply: true, reason: 'Unadorned raw link spam' };
  }

  // 4. Common automated bot crypto/casino/spam keywords
  const lower = content.toLowerCase();
  const spamKeywords = [
    'airdrop claim',
    'free crypto',
    'whatsapp me',
    'telegram dm',
    't.me/',
    'bonus 100%',
    'casino bonus',
    'private key leak',
    'seed phrase'
  ];
  if (spamKeywords.some((kw) => lower.includes(kw))) {
    return { isSpamOrReply: true, reason: 'Known spam keyword detected' };
  }

  return { isSpamOrReply: false };
}

export function isRootPost(event: { tags?: string[][]; content?: string; kind?: number }): boolean {
  return !isSpamOrReply(event).isSpamOrReply;
}
