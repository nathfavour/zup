/**
 * Zup Tier 1 Architecture: 4-Layer Ingress Funnel
 * 
 * Executes raw signal-to-noise hygiene at wire ingress before any event touches state or UI.
 * 
 * Pipeline Execution Order:
 * 1. Wire-Drop (Zero-allocation / O(1) checks on raw wire format)
 * 2. Identity (Web of Trust hop distance & economic anchors / NIP-57 / NIP-05)
 * 3. Heuristic (64-bit SimHash near-duplicate, Shannon entropy, link-to-text density)
 * 4. Dynamic Scoring & Action Gate (Admit Tier 1, Low-priority buffer, or Instant Purge)
 */

import { NostrEvent } from '../types';

// ============================================================================
// Layer 1: Zero-Allocation Wire Filters (O(1) Checks)
// ============================================================================

export interface WireCheckResult {
  drop: boolean;
  reason?: string;
}

/**
 * Validates raw event timestamp, payload density, and tag bounds.
 * Can be executed directly on raw parsed message data before any heavier allocations.
 */
export function evaluateWireLayer(event: {
  kind: number;
  created_at: number;
  content?: string;
  tags?: string[][];
}, nowSec = Math.floor(Date.now() / 1000)): WireCheckResult {
  const { kind, created_at, content = '', tags = [] } = event;

  // 1. Clock Drift Bounds:
  // Drop immediately if created_at > (now + 60s) or created_at < (now - 14d)
  if (created_at > nowSec + 60) {
    return { drop: true, reason: 'clock_drift_future' };
  }
  if (created_at < nowSec - 14 * 86400) {
    return { drop: true, reason: 'clock_drift_too_old' };
  }

  // 2. Kind 1 Payload Density & Script Constraints:
  if (kind === 1) {
    const trimmedLen = content.trim().length;
    const hasMediaTag = tags.some((t) => t[0] === 'imeta' || t[0] === 'url');
    if (trimmedLen === 0 && !hasMediaTag) {
      return { drop: true, reason: 'empty_payload_no_media' };
    }

    // Drop non-Latin / CJK script blasts at wire level (English-only client policy)
    const cjkMatches = content.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af\u0400-\u04ff]/g);
    if (cjkMatches && cjkMatches.length >= 1) {
      return { drop: true, reason: 'non_english_script' };
    }
  }

  // 3. Tag Bomb Rejection:
  // If an event has > 20 tags (especially empty or mass mention p-tags), drop on wire.
  if (tags.length > 20) {
    return { drop: true, reason: 'tag_bomb_exceeded_20' };
  }

  const pTagCount = tags.filter((t) => t[0] === 'p').length;
  if (pTagCount > 8) {
    return { drop: true, reason: 'mention_tag_bomb' };
  }

  return { drop: false };
}

// ============================================================================
// Layer 2: Web of Trust (WoT) & Economic Anchors
// ============================================================================

export interface WoTGraphState {
  userPubkey: string;
  hop1Pubkeys: Set<string>; // Followed by user
  hop2Pubkeys: Set<string>; // Followed by followings
  seedPubkeys: Set<string>; // Curated high-signal builder seed list for cold-start
}

/**
 * Curated seed accounts representing high-signal builders and relays for cold-start users
 */
export const CURATED_SEED_ACCOUNTS = new Set<string>([
  '3bf0c63fcb93463407af97b5e5ee64fa883d107ef9e558472c4eb9aaaefa459d', // Alex Chen
  '82341f882b6eabcd2d62ef022249ec371142166391a11c5183dd2b8361e67182', // Vlad Kozlov
  '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245', // JB55
  '82341f882b6eabcd2d62ef022249ec371142166391a11c5183dd2b8361e67185', // Fiatjaf
  'fa984bd7dbb282f07e16e7ae87b26a2a7b9b90b7246a44771f0cf5ae58018f52', // Jack
  '91c9a5e1a9744114c300d338444a1787417e0878025ff252d28567233c1145fe', // NVK
]);

export function getHopDistance(pubkey: string, wot: WoTGraphState): number {
  if (pubkey === wot.userPubkey) return 0;
  if (wot.hop1Pubkeys.has(pubkey)) return 1;
  if (wot.hop2Pubkeys.has(pubkey)) return 2;
  if (wot.seedPubkeys.has(pubkey)) return 1; // Seed cluster acts as virtual Hop 1 for cold-start
  return 3; // Hop 3+ or disconnected
}

// ============================================================================
// Layer 3: Heuristics & Anti-Sybil Analysis (SimHash & Shannon Entropy)
// ============================================================================

/**
 * 64-bit SimHash implementation for near-duplicate text detection
 */
export function compute64BitSimHash(text: string): bigint {
  // Normalize text: lowercase, strip URLs, emojis, and non-alphanumeric chars
  const clean = text
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();

  const words = clean.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return 0n;

  // 64-dimensional accumulator vector
  const v = new Int32Array(64);

  for (const word of words) {
    // 64-bit FNV-1a hash of each token
    let h = 0xcbf29ce484222325n;
    const prime = 0x100000001b3n;
    for (let i = 0; i < word.length; i++) {
      h ^= BigInt(word.charCodeAt(i));
      h = (h * prime) & 0xffffffffffffffffn;
    }

    for (let bit = 0; bit < 64; bit++) {
      if ((h & (1n << BigInt(bit))) !== 0n) {
        v[bit] += 1;
      } else {
        v[bit] -= 1;
      }
    }
  }

  let simhash = 0n;
  for (let bit = 0; bit < 64; bit++) {
    if (v[bit] > 0) {
      simhash |= 1n << BigInt(bit);
    }
  }
  return simhash;
}

/**
 * Computes Hamming distance (count of differing bits) between two 64-bit hashes
 */
export function hammingDistance64(a: bigint, b: bigint): number {
  let x = a ^ b;
  let count = 0;
  while (x > 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

/**
 * Computes Shannon Entropy H(X) = -sum(P(x) * log2(P(x))) over characters
 */
export function computeShannonEntropy(text: string): number {
  if (!text || text.length === 0) return 0;
  const frequencies = new Map<string, number>();
  for (const ch of text) {
    frequencies.set(ch, (frequencies.get(ch) || 0) + 1);
  }
  let entropy = 0;
  const len = text.length;
  for (const count of frequencies.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// In-memory LRU ring buffer for recent SimHash fingerprints (10,000 capacity)
interface FingerprintRecord {
  hash: bigint;
  pubkey: string;
  timestamp: number;
}

export class SimHashRingBuffer {
  private buffer: FingerprintRecord[] = [];
  private readonly capacity: number;

  constructor(capacity = 10000) {
    this.capacity = capacity;
  }

  public checkDuplicate(hash: bigint, pubkey: string, now = Date.now()): boolean {
    if (hash === 0n) return false;
    const windowMs = 15 * 60 * 1000; // 15-minute sliding window

    // Check against recent entries
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      const item = this.buffer[i];
      if (now - item.timestamp > windowMs) break; // Entries are chronological
      if (item.pubkey !== pubkey) {
        const dist = hammingDistance64(hash, item.hash);
        if (dist <= 3) {
          return true; // Near-duplicate spam blast from different pubkey!
        }
      }
    }

    // Add to buffer
    if (this.buffer.length >= this.capacity) {
      this.buffer.shift();
    }
    this.buffer.push({ hash, pubkey, timestamp: now });
    return false;
  }

  public clear(): void {
    this.buffer = [];
  }
}

export const globalSimHashBuffer = new SimHashRingBuffer();

// ============================================================================
// Layer 4: Client-Side Scoring Formula & Ingress Gate
// ============================================================================

export interface IngressScoringMetadata {
  wotDistance: number;
  hasNip05: boolean;
  lifetimeZapsSats: number;
  unfollowedMentionsCount: number;
  nip56ReportsCount?: number;
  isSimHashDuplicate?: boolean;
}

export interface IngressDecision {
  score: number;
  action: 'admit' | 'buffer' | 'purge';
  reasons: string[];
}

/**
 * Calculates deterministic client-side score:
 * Score = w_wot*WoT + w_zap*Z - w_spam*S - w_age*A
 */
export function calculateIngressScore(meta: IngressScoringMetadata): IngressDecision {
  let score = 0;
  const reasons: string[] = [];

  // 1. Social Distance
  if (meta.wotDistance === 0 || meta.wotDistance === 1) {
    score += 100;
    reasons.push('+100: Direct Follow (Hop 1)');
  } else if (meta.wotDistance === 2) {
    score += 40;
    reasons.push('+40: Followed by Follows (Hop 2)');
  } else {
    // Neutral distance penalty for Hop 3+ strangers on public relays
    score -= 10;
    reasons.push('-10: Public Relay Peer / Hop 3+');
  }

  // 2. DNS Verification (NIP-05)
  if (meta.hasNip05) {
    score += 25;
    reasons.push('+25: Valid NIP-05 DNS Handle');
  }

  // 3. Economic Anchors (Zaps / Sats transacted)
  if (meta.lifetimeZapsSats >= 1000) {
    score += 20;
    reasons.push('+20: Economic Anchor >= 1,000 sats');
  }

  // 4. Negative Signals
  if (meta.isSimHashDuplicate) {
    score -= 100;
    reasons.push('-100: SimHash Near-Duplicate Spam Blast');
  }

  if (meta.unfollowedMentionsCount > 5) {
    score -= 40;
    reasons.push('-40: Mentions > 5 Unfollowed Pubkeys');
  }

  if (meta.nip56ReportsCount && meta.nip56ReportsCount > 0) {
    const penalty = meta.nip56ReportsCount * 50;
    score -= penalty;
    reasons.push(`-${penalty}: NIP-56 Moderation Reports`);
  }

  // Action Gate:
  // Score >= 0: Admit to Tier 1 pipeline
  // Score -40 to -1: Low-priority buffer
  // Score < -40: Instant purge
  let action: 'admit' | 'buffer' | 'purge' = 'purge';
  if (score >= 0) {
    action = 'admit';
  } else if (score >= -40) {
    action = 'buffer';
  } else {
    action = 'purge';
  }

  return { score, action, reasons };
}

/**
 * End-to-end 4-Layer Ingress Gate Runner
 */
export function processIngressFunnel(
  rawEvent: {
    id: string;
    pubkey: string;
    kind: number;
    created_at: number;
    tags: string[][];
    content: string;
  },
  wotState: WoTGraphState,
  meta: {
    hasNip05?: boolean;
    lifetimeZapsSats?: number;
    nip56ReportsCount?: number;
  }
): IngressDecision {
  // Layer 1: Zero-alloc wire check
  const wire = evaluateWireLayer(rawEvent);
  if (wire.drop) {
    return { score: -100, action: 'purge', reasons: [`Wire-Drop: ${wire.reason}`] };
  }

  // Layer 2: WoT Distance
  const distance = getHopDistance(rawEvent.pubkey, wotState);

  // Layer 3: Heuristics & SimHash
  const simhash = compute64BitSimHash(rawEvent.content);
  const isDuplicate = globalSimHashBuffer.checkDuplicate(simhash, rawEvent.pubkey);
  if (isDuplicate) {
    return {
      score: -100,
      action: 'purge',
      reasons: ['Layer 3: SimHash near-duplicate detected from different pubkey'],
    };
  }

  // Shannon Entropy check
  const entropy = computeShannonEntropy(rawEvent.content);
  if (rawEvent.content.length > 40 && entropy < 2.1) {
    return {
      score: -80,
      action: 'purge',
      reasons: [`Layer 3: Abnormally low Shannon entropy (${entropy.toFixed(2)})`],
    };
  }

  // Link-to-text density check
  const urls = rawEvent.content.match(/https?:\/\/[^\s]+/g) || [];
  const words = rawEvent.content.trim().split(/\s+/).filter((w) => w.length > 0);
  if (distance > 1 && words.length > 0 && urls.length / words.length > 0.5) {
    return {
      score: -60,
      action: 'purge',
      reasons: ['Layer 3: High link-to-words ratio on Hop > 1 author'],
    };
  }

  // Count unfollowed mentions
  const pTags = rawEvent.tags.filter((t) => t[0] === 'p').map((t) => t[1]);
  const unfollowedMentions = pTags.filter((pk) => !wotState.hop1Pubkeys.has(pk) && pk !== wotState.userPubkey).length;

  // Layer 4: Score combination
  return calculateIngressScore({
    wotDistance: distance,
    hasNip05: Boolean(meta.hasNip05),
    lifetimeZapsSats: meta.lifetimeZapsSats || 0,
    unfollowedMentionsCount: unfollowedMentions,
    nip56ReportsCount: meta.nip56ReportsCount || 0,
    isSimHashDuplicate: isDuplicate,
  });
}
