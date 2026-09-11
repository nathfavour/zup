import { describe, it, expect } from 'bun:test';
import {
  evaluateWireLayer,
  getHopDistance,
  compute64BitSimHash,
  hammingDistance64,
  computeShannonEntropy,
  SimHashRingBuffer,
  calculateIngressScore,
  processIngressFunnel,
  CURATED_SEED_ACCOUNTS,
  type WoTGraphState
} from '../ingressPipeline';

describe('Tier 1 Ingress Pipeline', () => {
  const mockWot: WoTGraphState = {
    userPubkey: 'user1111111111111111111111111111111111111111111111111111111111111111',
    hop1Pubkeys: new Set(['follow11111111111111111111111111111111111111111111111111111111111111']),
    hop2Pubkeys: new Set(['fof1111111111111111111111111111111111111111111111111111111111111111']),
    seedPubkeys: CURATED_SEED_ACCOUNTS,
  };

  describe('Layer 1: Wire-Drop', () => {
    it('drops events far in the future (> 60s)', () => {
      const nowSec = 1700000000;
      const res = evaluateWireLayer(
        { kind: 1, created_at: nowSec + 120, content: 'future post', tags: [] },
        nowSec
      );
      expect(res.drop).toBe(true);
      expect(res.reason).toBe('clock_drift_future');
    });

    it('drops events older than 14 days', () => {
      const nowSec = 1700000000;
      const res = evaluateWireLayer(
        { kind: 1, created_at: nowSec - 15 * 86400, content: 'stale post', tags: [] },
        nowSec
      );
      expect(res.drop).toBe(true);
      expect(res.reason).toBe('clock_drift_too_old');
    });

    it('allows events within normal clock bounds', () => {
      const nowSec = 1700000000;
      const res = evaluateWireLayer(
        { kind: 1, created_at: nowSec - 300, content: 'valid fresh post', tags: [] },
        nowSec
      );
      expect(res.drop).toBe(false);
    });

    it('drops kind 1 with empty payload and no media tags', () => {
      const res = evaluateWireLayer({ kind: 1, created_at: Math.floor(Date.now() / 1000), content: '   ', tags: [] });
      expect(res.drop).toBe(true);
      expect(res.reason).toBe('empty_payload_no_media');
    });

    it('allows kind 1 with empty content if media tag is present', () => {
      const res = evaluateWireLayer({
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        content: '',
        tags: [['imeta', 'url https://image.nostr.build/test.png']],
      });
      expect(res.drop).toBe(false);
    });

    it('drops events with > 20 tags (tag bomb)', () => {
      const tags = Array.from({ length: 21 }, (_, i) => ['t', `tag${i}`]);
      const res = evaluateWireLayer({ kind: 1, created_at: Math.floor(Date.now() / 1000), content: 'test', tags });
      expect(res.drop).toBe(true);
      expect(res.reason).toBe('tag_bomb_exceeded_20');
    });

    it('drops events with > 8 p-tags (mention bomb)', () => {
      const tags = Array.from({ length: 9 }, (_, i) => ['p', `pubkey${i}`]);
      const res = evaluateWireLayer({ kind: 1, created_at: Math.floor(Date.now() / 1000), content: 'test', tags });
      expect(res.drop).toBe(true);
      expect(res.reason).toBe('mention_tag_bomb');
    });
  });

  describe('Layer 2: Web of Trust Graph', () => {
    it('resolves user as Hop 0', () => {
      expect(getHopDistance(mockWot.userPubkey, mockWot)).toBe(0);
    });

    it('resolves direct follows as Hop 1', () => {
      expect(getHopDistance('follow11111111111111111111111111111111111111111111111111111111111111', mockWot)).toBe(1);
    });

    it('resolves curated seed accounts as virtual Hop 1 for cold-start', () => {
      const seedAccount = Array.from(CURATED_SEED_ACCOUNTS)[0];
      expect(getHopDistance(seedAccount, mockWot)).toBe(1);
    });

    it('resolves follow of follow as Hop 2', () => {
      expect(getHopDistance('fof1111111111111111111111111111111111111111111111111111111111111111', mockWot)).toBe(2);
    });

    it('resolves strangers as Hop 3', () => {
      expect(getHopDistance('stranger999999999999999999999999999999999999999999999999999999999999', mockWot)).toBe(3);
    });
  });

  describe('Layer 3: Heuristics & SimHash', () => {
    it('computes consistent 64-bit SimHash and detects near-duplicates', () => {
      const text1 = 'The quick brown fox jumps over the lazy dog in Bitcoin Nostr decentralization';
      const text2 = 'The quick brown fox jumps over the lazy dog in Bitcoin Nostr decentralization!';
      const hash1 = compute64BitSimHash(text1);
      const hash2 = compute64BitSimHash(text2);
      const dist = hammingDistance64(hash1, hash2);
      expect(dist).toBeLessThanOrEqual(3);
    });

    it('detects duplicate across different pubkeys in SimHashRingBuffer', () => {
      const buffer = new SimHashRingBuffer(100);
      const text = 'Unique high quality note broadcasting on Nostr mesh relay network';
      const hash = compute64BitSimHash(text);

      expect(buffer.checkDuplicate(hash, 'pubkeyA')).toBe(false);
      expect(buffer.checkDuplicate(hash, 'pubkeyA')).toBe(false); // Same author is not sybil
      expect(buffer.checkDuplicate(hash, 'pubkeyB')).toBe(true); // Sybil duplicate!
    });

    it('computes Shannon entropy accurately', () => {
      const lowEntropy = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const normalText = 'Nostr is an open protocol for censorship-resistant global social networks.';
      const eLow = computeShannonEntropy(lowEntropy);
      const eNorm = computeShannonEntropy(normalText);
      expect(eLow).toBeLessThan(1.0);
      expect(eNorm).toBeGreaterThan(3.5);
    });
  });

  describe('Layer 4: Scoring Formula & End-to-End Ingress Funnel', () => {
    it('admits direct follow immediately with positive score', () => {
      const event = {
        id: 'ev1',
        pubkey: 'follow11111111111111111111111111111111111111111111111111111111111111',
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'Hello world from direct follow on Nostr!',
      };
      const decision = processIngressFunnel(event, mockWot, {});
      expect(decision.action).toBe('admit');
      expect(decision.score).toBeGreaterThanOrEqual(80);
    });

    it('buffers root note from hop 3 stranger with zero economic staking and no NIP-05 for quality evaluation', () => {
      const event = {
        id: 'ev2',
        pubkey: 'stranger999999999999999999999999999999999999999999999999999999999999',
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'I am a completely unknown root poster with zero zaps and no verification.',
      };
      const decision = processIngressFunnel(event, mockWot, { lifetimeZapsSats: 0, hasNip05: false });
      expect(decision.action).toBe('buffer');
    });

    it('admits root note from hop 3 stranger if verified by NIP-05 or >= 1000 sats zaps', () => {
      const event = {
        id: 'ev3',
        pubkey: 'stranger999999999999999999999999999999999999999999999999999999999999',
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'I am an unknown author but I have proven identity and economic stake.',
      };
      const decision = processIngressFunnel(event, mockWot, { lifetimeZapsSats: 2100, hasNip05: true });
      expect(decision.action).toBe('admit');
      expect(decision.score).toBeGreaterThanOrEqual(0);
    });

    it('purges spam with abnormally low Shannon entropy', () => {
      const event = {
        id: 'ev4',
        pubkey: 'follow11111111111111111111111111111111111111111111111111111111111111',
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!',
      };
      const decision = processIngressFunnel(event, mockWot, {});
      expect(decision.action).toBe('purge');
    });
  });
});
