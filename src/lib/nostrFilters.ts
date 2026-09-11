/**
 * Nostr Waterfall Quality & Anti-Spam Filters
 *
 * "Nostr is an open waterfall; we decide what even makes it into the Zup ecosystem."
 * Filters out before user algorithm takes effect:
 * - URI-packed posts (excessive link dumps, URL shorteners, spam TLDs, messaging invite floods, affiliate dumps)
 * - Space & formatting spams (vertical whitespace padding, excessive consecutive newlines, zero-width / invisible characters, emoji floods, character repetitions)
 * - Tag spam (mention bombing with p-tags, excessive hashtags, or npub floods in content)
 * - Repetitive bot gibberish, slop, keyboard mash, and scam/phishing signatures
 */

// Regex for extracting web and nostr URIs
const URI_REGEX = /(?:https?:\/\/|nostr:)[^\s<>"{}|\\^`[\]]+/gi;

// Suspicious URL shorteners and redirect services
const SHORTENER_REGEX = /(?:https?:\/\/)?(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|buff\.ly|ow\.ly|adf\.ly|bit\.do|tiny\.cc|cutt\.ly|shorturl\.at|rb\.gy)\/[a-zA-Z0-9_-]+/i;

// Low-reputation / spam top-level domains commonly used in phishing & slop
const SPAM_TLD_REGEX = /https?:\/\/[a-zA-Z0-9.-]+\.(?:xyz|top|click|link|club|work|monster|fit|online|site|icu|buzz|vip|fun|rest|cam|gdn|loan|win)\b/i;

// Messaging group invite flood signatures (Telegram, WhatsApp, Discord)
const INVITE_FLOOD_REGEX = /(?:t\.me|wa\.me|chat\.whatsapp\.com|discord\.gg|discord\.com\/invite)\/[a-zA-Z0-9_+-]+/i;

// Known bot spam phrases, crypto scams, phishing, and slop signatures
const SPAM_SIGNATURES = [
  /airdrop.*claim/i,
  /claim.*airdrop/i,
  /free.*(?:usdt|btc|eth|crypto|tokens|sol)/i,
  /private.*key/i,
  /seed.*phrase/i,
  /secret.*recovery/i,
  /connect.*wallet/i,
  /wallet.*connect/i,
  /whatsapp.*(?:crypto|invest|group|number|help)/i,
  /telegram.*(?:join|channel|group|signal)/i,
  /t\.me\/(?:joinchat|\+[a-zA-Z0-9_-]{10,})/i,
  /guaranteed.*(?:return|profit|100x|1000x)/i,
  /doubler.*(?:btc|eth|usdt)/i,
  /deposit.*bonus/i,
  /presale.*live/i,
  /dm.*(?:for.*info|me.*fast|on.*whatsapp|to.*buy)/i,
  /inbox.*me.*for/i,
  /contact.*on.*whatsapp/i,
  /passcode.*unlock/i,
  /recovery.*agent/i,
  /#stickerpals_broadcast/i,
  /#bot_broadcast/i,
  // Game server telemetry & presence logs (e.g. GTA RP, FiveM bots, automated aimd logs)
  /\[AIMD\]/i,
  /Player Revived/i,
  /Hospital Respawn/i,
  /Pillbox Hill Medical Center/i,
  /nlogpost:\d+:/i,
  /#swarmmesh/i,
  // Automated Bitcoin block height & Moscow Time bot telemetry (e.g. "12:83 @ 966,330 #bitcoin #moscowtime")
  /\b\d{1,2}:\d{2}\s*@\s*\d{3,}(?:,\d{3})*\b/i,
  /#moscowtime\b/i,
  // Low-signal BIP39 seed dumps / solitary dictionary word lists (e.g. "stomach #bitcoin #seed #bip39")
  /^(?:[a-z]{3,12}\s*)+(?:#(?:bitcoin|seed|bip39)\s*){2,}$/i,
  // Low-reputation broadcast duplicate templates
  /Sveiki no E-me prototipa!/i,
  /Stay vigilant with crypto security/i,
];

// Content hash cache for deduplication (drops identical broadcast spam blasts)
const SEEN_CONTENT_HASHES = new Set<string>();
function getContentFingerprint(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 100);
}

// Regex for detecting hashtag and mention floods in text
const HASHTAG_REGEX = /(?:^|\s)#([a-zA-Z0-9_\u4e00-\u9fa5]+)/g;
const MENTION_REGEX = /(?:@npub1[a-z0-9]{58}|nostr:npub1[a-z0-9]{58}|nostr:nprofile1[a-z0-9]+)/gi;

// Regex for invisible Unicode characters and zero-width spaces
const INVISIBLE_CHARS_REGEX = /[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u00A0\u180E\u2000-\u200A\u202F\u205F\u3000]/g;

// Regex for unicode emoji ranges to detect emoji floods
const EMOJI_REGEX = /(?:[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])/gu;

export interface FilterResult {
  passes: boolean;
  reason?: 'uri_packed' | 'space_spam' | 'tag_spam' | 'gibberish' | 'keyword_spam';
  details?: string;
}

/**
 * Checks if a post is packed with excessive URIs, link dumps, suspicious shorteners, or invite floods.
 */
export function isUriPacked(content: string): boolean {
  if (!content) return false;
  const matches = content.match(URI_REGEX);
  const textLength = content.trim().length;

  // 1. Check for URL shorteners or spam TLDs in suspicious contexts
  if (SHORTENER_REGEX.test(content) && textLength < 250) return true;
  if (SPAM_TLD_REGEX.test(content) && textLength < 200) return true;

  // 2. Messaging invite link flood
  const inviteMatches = content.match(new RegExp(INVITE_FLOOD_REGEX.source, 'gi'));
  if (inviteMatches && inviteMatches.length >= 2) return true;

  if (!matches || matches.length === 0) return false;

  // Distinguish non-image links from legitimate media attachments
  const nonImageLinks = matches.filter(
    (url) => !/\.(?:png|jpe?g|gif|webp|avif|bmp|svg)(?:\?.*)?$/i.test(url) &&
             !/(?:image\.nostr\.build|nostr\.build\/i|i\.imgur\.com|media\.tenor\.com|pbs\.twimg\.com|nostr\.download)/i.test(url)
  );

  const urlCount = nonImageLinks.length;
  const totalUrlLength = nonImageLinks.reduce((acc, url) => acc + url.length, 0);

  // 3. More than 3 URLs in a short post (<320 chars) is almost always spam
  if (urlCount >= 3 && textLength < 320) return true;

  // 4. More than 4 URLs regardless of length (link farm)
  if (urlCount >= 5) return true;

  // 5. Non-image URLs consume more than 50% of the entire post body when multiple URLs exist
  if (urlCount >= 2 && totalUrlLength / textLength > 0.5) return true;

  // 6. Post is purely non-image URLs with less than 10 non-URL characters
  const nonUrlLength = textLength - totalUrlLength;
  if (urlCount >= 2 && nonUrlLength < 10) return true;

  // 7. Multiple affiliate/ref parameter link floods
  const refLinks = matches.filter((url) => /(?:\?|&)(?:ref|aff|affiliate|utm_source)=/i.test(url));
  if (refLinks.length >= 2) return true;

  return false;
}

/**
 * Checks if a post abuses whitespace, character repetition, zero-width characters, or emoji floods.
 */
export function isSpaceSpam(content: string): boolean {
  if (!content) return false;

  // 1. Massive vertical padding spam (4 or more blank lines in a row)
  if (/\n\s*\n\s*\n\s*\n/.test(content)) return true;

  // 2. Wide horizontal space padding (12 or more continuous spaces/tabs)
  if (/[ \t]{12,}/.test(content)) return true;

  // 3. Zero-width character and invisible Unicode character flood
  const invisibleCount = (content.match(INVISIBLE_CHARS_REGEX) || []).length;
  if (invisibleCount > 4) return true;

  // 4. Excessive character repetitions (same character repeated >= 12 times like "aaaaaaaaaaaa" or "............")
  if (/(.)\1{11,}/.test(content)) return true;

  // 5. Emoji flood (12+ emojis in a short post or continuous streak of 8+ emojis)
  const emojis = content.match(EMOJI_REGEX) || [];
  if (emojis.length >= 12 && content.length < 200) return true;

  const continuousEmojiRegex = new RegExp(`(?:${EMOJI_REGEX.source}){8,}`, 'u');
  if (continuousEmojiRegex.test(content)) return true;

  return false;
}

/**
 * Checks if a post abuses tags or in-content mentions/hashtags.
 */
export function isTagSpam(tags: string[][], content: string = ''): boolean {
  if (tags && Array.isArray(tags)) {
    // Count mention 'p' tags
    const pTags = tags.filter((t) => t[0] === 'p');
    if (pTags.length > 8) return true;

    // Total tags count excessive (tag bombing)
    if (tags.length > 18) return true;
  }

  // In-content hashtag bombing (e.g. 8+ hashtags in body text)
  if (content) {
    const hashtags = content.match(HASHTAG_REGEX) || [];
    if (hashtags.length >= 8) return true;

    const mentions = content.match(MENTION_REGEX) || [];
    if (mentions.length >= 6) return true;
  }

  return false;
}

/**
 * Checks for gibberish, slop, keyboard mash, or scam signatures.
 */
export function isGibberish(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length < 2) return true;

  // 1. Check for signature spam & scam patterns
  for (const sig of SPAM_SIGNATURES) {
    if (sig.test(trimmed)) return true;
  }

  // 2. Detect raw JSON protocol / app presence payloads (e.g. {"type":"presence", ...})
  if (/^\s*\{.*"type"\s*:\s*".*"\s*.*\}\s*$/s.test(trimmed) || /^\s*\{.*"payload"\s*:\s*.*\}\s*$/s.test(trimmed)) {
    return true;
  }

  // 3. Detect raw npub / key dumps or author header copy-paste slop in content
  const npubCount = (trimmed.match(/npub1[a-z0-9]{58}/gi) || []).length;
  if (npubCount >= 2 && trimmed.length < 300) return true;

  // 4. Keyboard mash / string repetition slop (e.g. "asdfghjasdfghjasdfghjasdfghjasdfghj" or "123123123123123")
  if (/(.{2,8})\1{4,}/i.test(trimmed)) return true;

  // 5. Unending digits / dangling broken URL path fragments (e.g., isolated standalone "609101/" or long digit gibberish)
  if (/(?:^|\s)\d{5,}\/(?:\s|$)/.test(trimmed)) return true;

  // 6. Long continuous word without vowels or spaces (excluding URLs/hashes)
  // Clean out URLs and nostr identifiers first
  const cleanText = trimmed.replace(URI_REGEX, '').trim();
  const words = cleanText.split(/\s+/);
  for (const word of words) {
    // Detect raw base64 data blobs (e.g. eyJ0eXBlIjoi...)
    if (word.length >= 40 && /^[A-Za-z0-9+/=]{40,}$/.test(word)) {
      return true;
    }
    // Ignore code/hex/hashes/base64-like strings if they are formatted or isolated
    if (word.length >= 16 && !/[aeiouAEIOU]/.test(word) && /^[a-zA-Z0-9]+$/.test(word)) {
      return true;
    }
  }

  // 7. Duplicate broadcast spam detection across relays
  const fingerprint = getContentFingerprint(trimmed);
  if (fingerprint.length > 20) {
    if (SEEN_CONTENT_HASHES.has(fingerprint)) {
      return true; // Already processed this duplicate broadcast post
    }
    if (SEEN_CONTENT_HASHES.size > 2000) {
      SEEN_CONTENT_HASHES.clear();
    }
    SEEN_CONTENT_HASHES.add(fingerprint);
  }

  return false;
}

// CJK Unified Ideographs, Hiragana, Katakana, Hangul, Cyrillic, Arabic, Hebrew, Thai
const NON_LATIN_SCRIPT_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\uac00-\ud7af\u0400-\u04ff\u0600-\u06ff\u0590-\u05ff\u0e00-\u0e7f]/g;

/**
 * Validates that content is predominantly English / Latin-script text.
 * Drops posts containing CJK (Chinese, Japanese, Korean), Cyrillic, Arabic, or non-English scripts.
 */
export function isNonEnglish(content: string): boolean {
  if (!content) return false;
  // Strip URLs and nostr links before evaluating characters
  const clean = content.replace(URI_REGEX, '').trim();
  if (clean.length === 0) return false;

  // STRICT: Any CJK / Japanese (Hiragana/Katakana) / Korean (Hangul) character drops the post immediately
  const cjkMatches = clean.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\uac00-\ud7af]/g);
  if (cjkMatches && cjkMatches.length > 0) {
    return true;
  }

  // Check general non-Latin scripts (Cyrillic, Arabic, Hebrew, Thai, etc.)
  const nonLatinMatches = clean.match(NON_LATIN_SCRIPT_REGEX) || [];
  const nonLatinCount = nonLatinMatches.length;
  if (nonLatinCount > 0) {
    const nonSpaceLength = clean.replace(/\s+/g, '').length;
    if (nonSpaceLength > 0 && (nonLatinCount >= 3 || nonLatinCount / nonSpaceLength > 0.15)) {
      return true;
    }
  }

  return false;
}

/**
 * Regex for low-effort greetings, signoffs, and trivial single-word/short conversational noise.
 */
const LOW_EFFORT_GREETING_REGEX = /^(?:gm|gmorning|good\s*morning|good\s*afternoon|good\s*evening|good\s*night|gn|bom\s*dia|buenos\s*dias|welcome\s*back|hello\s*(?:world|nostr)?|hi\s*all|hey\s*all|pv)[\s\p{Emoji}\p{Punctuation}]*$/iu;

const LOW_EFFORT_AFFIRMATION_REGEX = /^(?:yes|no|yep|nope|true|agreed|interesting|well\s*said|100%|💯|fuck\s*yea[h!]*(?:\s*boii+)?|horny\s*hmu|tnx[\s\w]*|thanks|great\s*advice|nice|cool|morning\s*lemon|thebaby\s*still\s*here|wainscot|lifting\s*of\s*the\s*veil|gm\s*lemon[\s\p{Emoji}]*)[\s\p{Punctuation}\p{Emoji}]*$/iu;

/**
 * Checks if a note is a low-effort greeting, zero-context one-liner, or trivial noise.
 */
export function isLowEffortGreetingOrNoise(content: string): boolean {
  if (!content) return false;
  const clean = content.replace(URI_REGEX, '').trim();
  if (clean.length === 0) return false;

  // Exact match on low-effort greetings
  if (LOW_EFFORT_GREETING_REGEX.test(clean)) {
    return true;
  }

  // Exact match on low-effort affirmations or noise
  if (LOW_EFFORT_AFFIRMATION_REGEX.test(clean)) {
    return true;
  }

  // Specific user-reported spam phrases
  if (/^morning\s+lemon/i.test(clean) || /^horny\s+hmu/i.test(clean) || /^bom\s+dia\s+#nostr/i.test(clean)) {
    return true;
  }

  return false;
}

/**
 * High-signal technical keywords dictionary.
 */
const TECH_KEYWORDS = [
  'code', 'coding', 'developer', 'dev', 'devs', 'software', 'engineer', 'engineering',
  'ai', 'llm', 'gpt', 'anthropic', 'claude', 'deepseek', 'gemini', 'transformer',
  'machine learning', 'neural', 'weights', 'inference', 'rag', 'agent', 'agents',
  'nostr', 'relay', 'relays', 'nip-', 'nip05', 'nip19', 'npub', 'nsec', 'kind',
  'btc', 'bitcoin', 'sats', 'satoshis', 'lightning', 'ln', 'ecash', 'cashu', 'fedimint',
  'crypto', 'cryptography', 'e2ee', 'encryption', 'hash', 'sha256', 'argon2', 'aes',
  'rust', 'typescript', 'javascript', 'python', 'golang', 'c++', 'zig', 'wasm',
  'linux', 'kernel', 'ebpf', 'xdp', 'posix', 'systemd', 'docker', 'kubernetes',
  'database', 'rxdb', 'sqlite', 'postgres', 'redis', 'appwrite', 'duckdb',
  'api', 'http', 'rest', 'websocket', 'grpc', 'graphql', 'oauth', 'passkey', 'webauthn',
  'hardware', 'cpu', 'gpu', 'asic', 'fpga', 'riscv', 'arm', 'firmware',
  'openbricks', 'tailwind', 'frontend', 'backend', 'fullstack', 'compiler', 'git', 'github',
  'commit', 'deploy', 'production', 'architecture', 'distributed', 'p2p', 'webrtc',
  'stem', 'physics', 'math', 'quantum', 'algorithm', 'data structure', 'latency', 'benchmark',
  'web', 'web3', 'app', 'apps', 'build', 'building', 'builder', 'builders', 'stack',
  'ui', 'ux', 'data', 'server', 'servers', 'cloud', 'npm', 'bun', 'vite', 'react',
  'node', 'nodejs', 'model', 'prompt', 'privacy', 'open-source', 'opensource', 'foss',
  'framework', 'library', 'terminal', 'bash', 'ssh', 'network', 'dns', 'ip', 'vpn',
  'tor', 'onion', 'security', 'cyber', 'protocol', 'cyberpunk', 'cypherpunk', 'key',
  'keys', 'nodes', 'sat', 'pay', 'zaps', 'zap', 'sql', 'db', 'tech', 'technology',
  'computer', 'computers', 'computing', 'sysadmin', 'devops', 'ci', 'cd', 'pipeline',
];

const TECH_KEYWORD_REGEX = new RegExp(
  `\\b(?:${TECH_KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')).join('|')})\\b`,
  'i'
);

/**
 * Validates if an event belongs to the Tech / STEM ecosystem.
 */
export function isTechRelated(content: string, tags: string[][] = []): boolean {
  if (!content) return false;

  // 1. Check technical tags
  const techTags = new Set([
    'tech', 'technology', 'bitcoin', 'btc', 'lightning', 'nostr', 'dev', 'coding',
    'programming', 'software', 'engineering', 'rust', 'typescript', 'python', 'ai',
    'ml', 'llm', 'crypto', 'cryptography', 'security', 'hardware', 'linux', 'kernel',
    'openbricks', 'stem', 'math', 'physics', 'web3', 'p2p', 'open-source', 'foss',
    'build', 'builder', 'cyberpunk', 'cypherpunk', 'privacy', 'zup', 'zap', 'zaps',
  ]);

  const hasTechTag = tags.some((tag) => tag[0] === 't' && tag[1] && techTags.has(tag[1].toLowerCase()));
  if (hasTechTag) {
    return true;
  }

  // 2. Code blocks (e.g. ```typescript or inline `code`)
  if (content.includes('```') || /`[^`]{3,}`/.test(content)) {
    return true;
  }

  // 3. GitHub / GitLab / ArXiv / Tech domain URLs
  if (/(?:github\.com|gitlab\.com|arxiv\.org|crates\.io|npmjs\.com|pypi\.org|huggingface\.co|replit\.com|stackoverflow\.com)/i.test(content)) {
    return true;
  }

  // 4. Check content for technical keywords
  if (TECH_KEYWORD_REGEX.test(content)) {
    return true;
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

  if (isNonEnglish(content)) {
    return {
      passes: false,
      reason: 'gibberish',
      details: 'Filtered out: Non-English script detected (English-only client policy).',
    };
  }

  if (isLowEffortGreetingOrNoise(content)) {
    return {
      passes: false,
      reason: 'gibberish',
      details: 'Filtered out: Low-effort greeting or trivial conversational noise.',
    };
  }

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

  if (isTagSpam(tags, content)) {
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
      details: 'Filtered out: Low-entropy, slop, or signature spam detected.',
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
