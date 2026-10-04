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
 * Extracts hashtags (#tags) from event tags
 */
export function extractEventTags(tags: string[][]): string[] {
  return tags
    .filter(([t]) => t === 't')
    .map(([, val]) => val)
    .filter(Boolean);
}

/**
 * Truncate pubkey or hash with ellipsis
 */
export function formatHex(hex: string, front = 8, back = 6): string {
  if (!hex || hex.length <= front + back) return hex;
  return `${hex.slice(0, front)}…${hex.slice(-back)}`;
}

/**
 * Robust spam and reply filter:
 * 1. Excludes replies (events with 'e' tags or reply markers) - only root posts are allowed.
 * 2. Excludes empty or near-empty posts (fewer than 4 characters or meaningless single characters).
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

  // 2. Minimum length check: posts with almost nothing (fewer than 4 characters or whitespace)
  if (content.length < 4) {
    return { isSpamOrReply: true, reason: 'Content too short or empty' };
  }

  // Discard single repeated character or punctuation like "...", "???", "aaaa"
  const uniqueChars = new Set(content.replace(/\s+/g, '')).size;
  if (uniqueChars <= 2 && content.length < 15) {
    return { isSpamOrReply: true, reason: 'Repetitive single characters' };
  }

  // 3. Link density and link spam check
  const urlMatches = content.match(/https?:\/\/[^\s]+/gi) || [];
  if (urlMatches.length > 2) {
    return { isSpamOrReply: true, reason: 'Link overload (>2 URLs)' };
  }

  // If the post is almost 100% just a raw link with zero commentary
  if (urlMatches.length === 1 && content.length < urlMatches[0].length + 6) {
    // Only raw URL without any context or text
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
