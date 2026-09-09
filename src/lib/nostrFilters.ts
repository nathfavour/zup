/**
 * Nostr Waterfall Quality & Anti-Spam Filters
 *
 * "Nostr is an open waterfall; we decide what even makes it into the Zup ecosystem."
 * Filters out:
 * - URI-packed posts (excessive link dumps, affiliate link floods, URL-only spam)
 * - Space spams (vertical whitespace padding, excessive consecutive newlines, zero-width characters)
 * - Tag spam (mention bombing with dozens of p-tags)
 * - Repetitive bot gibberish and flood attacks
 */

// Regex for extracting web and nostr URIs
const URI_REGEX = /(?:https?:\/\/|nostr:)[^\s<>"{}|\\^`[\]]+/gi;

// Known bot spam phrases or crypto/phishing spam keywords
const SPAM_SIGNATURES = [
  /airdrop.*claim/i,
  /free.*usdt/i,
  /private.*key.*seed/i,
  /whatsapp.*crypto/i,
  /telegram.*join.*now/i,
  /t\.me\/(?:joinchat|\+[a-zA-Z0-9_-]{10,})/i,
];

export interface FilterResult {
  passes: boolean;
  reason?: 'uri_packed' | 'space_spam' | 'tag_spam' | 'gibberish' | 'keyword_spam';
  details?: string;
}

/**
 * Checks if a post is packed with excessive URIs / link dumps.
 */
export function isUriPacked(content: string): boolean {
  if (!content) return false;
  const matches = content.match(URI_REGEX);
  if (!matches || matches.length === 0) return false;

  const urlCount = matches.length;
  const totalUrlLength = matches.reduce((acc, url) => acc + url.length, 0);
  const textLength = content.trim().length;

  // 1. More than 3 URLs in a short post is almost always spam
  if (urlCount >= 3 && textLength < 320) return true;

  // 2. More than 4 URLs regardless of length (link farm)
  if (urlCount >= 5) return true;

  // 3. URLs consume more than 50% of the entire post body and there are multiple URLs
  if (urlCount >= 2 && totalUrlLength / textLength > 0.5) return true;

  // 4. Post is purely URLs with less than 10 non-URL characters
  const nonUrlLength = textLength - totalUrlLength;
  if (urlCount >= 2 && nonUrlLength < 10) return true;

  return false;
}

/**
 * Checks if a post abuses whitespace (vertical line padding, character repetition, zero-width spaces).
 */
export function isSpaceSpam(content: string): boolean {
  if (!content) return false;

  // 1. Massive vertical padding spam (4 or more blank lines in a row)
  if (/\n\s*\n\s*\n\s*\n/.test(content)) return true;

  // 2. Wide horizontal space padding (12 or more continuous spaces/tabs)
  if (/[ \t]{12,}/.test(content)) return true;

  // 3. Zero-width character flood
  const zeroWidthCount = (content.match(/[\u200B-\u200D\uFEFF]/g) || []).length;
  if (zeroWidthCount > 5) return true;

  // 4. Excessive character repetitions (same character repeated >= 15 times like "aaaaaaaaaaa" or "..........")
  if (/(.)\1{14,}/.test(content)) return true;

  return false;
}

/**
 * Checks if a post abuses tags (e.g. tagging 10+ pubkeys for mention spam).
 */
export function isTagSpam(tags: string[][]): boolean {
  if (!tags || !Array.isArray(tags)) return false;

  // Count mention 'p' tags
  const pTags = tags.filter((t) => t[0] === 'p');
  if (pTags.length > 8) return true;

  // Total tags count excessive (tag bombing)
  if (tags.length > 20) return true;

  return false;
}

/**
 * Checks for gibberish or empty spam.
 */
export function isGibberish(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length < 2) return true;

  // Check for signature spam patterns
  for (const sig of SPAM_SIGNATURES) {
    if (sig.test(trimmed)) return true;
  }

  return false;
}

/**
 * Comprehensive Zup Quality Validator.
 */
export function evaluateZupQuality(event: {
  content: string;
  tags?: string[][];
  pubkey?: string;
}): FilterResult {
  const content = event.content || '';
  const tags = event.tags || [];

  if (isUriPacked(content)) {
    return {
      passes: false,
      reason: 'uri_packed',
      details: 'Filtered out: Excessive URI / link dump spam detected.',
    };
  }

  if (isSpaceSpam(content)) {
    return {
      passes: false,
      reason: 'space_spam',
      details: 'Filtered out: Excessive whitespace or character padding detected.',
    };
  }

  if (isTagSpam(tags)) {
    return {
      passes: false,
      reason: 'tag_spam',
      details: 'Filtered out: Excessive pubkey mention tag bombing detected.',
    };
  }

  if (isGibberish(content)) {
    return {
      passes: false,
      reason: 'gibberish',
      details: 'Filtered out: Low-entropy or signature spam detected.',
    };
  }

  return { passes: true };
}

/**
 * Sanitizes clean content for display:
 * Replaces excess consecutive newlines with a max of 2, trims whitespace.
 */
export function sanitizeZupContent(content: string): string {
  if (!content) return '';
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
