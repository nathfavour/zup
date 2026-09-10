import { describe, expect, test } from 'bun:test';
import {
  isUriPacked,
  isSpaceSpam,
  isTagSpam,
  isGibberish,
  evaluateZupQuality,
  sanitizeZupContent,
} from '../nostrFilters';

describe('Nostr Anti-Spam & Waterfall Quality Filters', () => {
  describe('isUriPacked (Link Spam)', () => {
    test('passes clean posts with legitimate URLs', () => {
      const content =
        'Check out our new paper on quantum key distribution: https://arxiv.org/abs/2301.00000 and the open source repo at https://github.com/zup-mesh/qkd';
      expect(isUriPacked(content)).toBe(false);
    });

    test('flags URL shorteners in short posts', () => {
      const content = 'Free crypto giveaway click here bit.ly/3xXyZ99';
      expect(isUriPacked(content)).toBe(true);
    });

    test('flags spam TLDs in short posts', () => {
      const content = 'Get free USDT tokens right now http://claim-tokens-now.xyz';
      expect(isUriPacked(content)).toBe(true);
    });

    test('flags messaging invite floods', () => {
      const content = 'Join group 1 t.me/pump_signal and group 2 t.me/crypto_vip_100x';
      expect(isUriPacked(content)).toBe(true);
    });

    test('flags excessive URL counts in short posts', () => {
      const content =
        'Links: https://site1.com https://site2.com https://site3.com buy now!';
      expect(isUriPacked(content)).toBe(true);
    });

    test('flags posts where URLs dominate non-URL text', () => {
      const content = 'a https://example1.com https://example2.com';
      expect(isUriPacked(content)).toBe(true);
    });
  });

  describe('isSpaceSpam (Formatting & Space Padding Spam)', () => {
    test('passes normal paragraphs with standard linebreaks', () => {
      const content = 'First paragraph.\n\nSecond paragraph with normal spacing.';
      expect(isSpaceSpam(content)).toBe(false);
    });

    test('flags excessive vertical linebreaks', () => {
      const content = 'Top line\n\n\n\n\n\nBottom line after huge gap';
      expect(isSpaceSpam(content)).toBe(true);
    });

    test('flags horizontal whitespace padding', () => {
      const content = 'Word                        Hidden Word';
      expect(isSpaceSpam(content)).toBe(true);
    });

    test('flags zero-width and invisible character floods', () => {
      const content = 'Invisible\u200B\u200B\u200B\u200B\u200Bpadding';
      expect(isSpaceSpam(content)).toBe(true);
    });

    test('flags continuous character repetition', () => {
      const content = 'Soooooooo coolaaaaaaaaaaaa!';
      expect(isSpaceSpam(content)).toBe(true);
    });

    test('flags continuous emoji floods', () => {
      const content = '🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀 Buy now!';
      expect(isSpaceSpam(content)).toBe(true);
    });
  });

  describe('isTagSpam (Mention & Hashtag Bombing)', () => {
    test('passes posts with reasonable p-tags and hashtags', () => {
      const tags = [
        ['t', 'tech'],
        ['t', 'nostr'],
        ['p', '3bf0c63fcb934634...'],
      ];
      const content = 'Great discussion #tech #nostr with @npub1chenai80cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkws';
      expect(isTagSpam(tags, content)).toBe(false);
    });

    test('flags excessive p-tag mention bombing', () => {
      const tags = Array.from({ length: 10 }, (_, i) => ['p', `pubkey_${i}`]);
      expect(isTagSpam(tags)).toBe(true);
    });

    test('flags total tag bombing (>18 tags)', () => {
      const tags = Array.from({ length: 20 }, (_, i) => ['t', `tag_${i}`]);
      expect(isTagSpam(tags)).toBe(true);
    });

    test('flags in-content hashtag floods', () => {
      const content = '#a #b #c #d #e #f #g #h #i #j #k #l buy tokens';
      expect(isTagSpam([], content)).toBe(true);
    });
  });

  describe('isGibberish (Slop, Scam Signatures, & Keyboard Mash)', () => {
    test('passes valid technical / conversational notes', () => {
      const content =
        'Benchmarked our SIMD JSON parser today. Deserialization throughput jumped to 2.4 GB/sec on modern x86_64.';
      expect(isGibberish(content)).toBe(false);
    });

    test('flags empty or single character spam', () => {
      expect(isGibberish(' ')).toBe(true);
      expect(isGibberish('a')).toBe(true);
    });

    test('flags crypto scam and airdrop phishing signatures', () => {
      expect(isGibberish('Claim free 10,000 USDT airdrop immediately! Connect wallet at link.')).toBe(true);
      expect(isGibberish('URGENT: enter your private key or seed phrase to verify account')).toBe(true);
      expect(isGibberish('Contact our recovery agent on whatsapp +123456789')).toBe(true);
      expect(isGibberish('Join our VIP channel on t.me/joinchat/12345678901 for 100x signals')).toBe(true);
    });

    test('flags repeated string pattern slop', () => {
      expect(isGibberish('asdfghjasdfghjasdfghjasdfghjasdfghj')).toBe(true);
    });

    test('flags long non-vowel gibberish words', () => {
      expect(isGibberish('Look at this bcdfghjklmnpqrstvwxzbcdfghj post')).toBe(true);
    });
  });

  describe('evaluateZupQuality (End-to-End Validator)', () => {
    test('allows high-quality technical posts', () => {
      const event = {
        content:
          'Replaced our ingress proxy with an eBPF XDP filter written in Rust. Kernel context switches dropped by 92%.',
        tags: [
          ['t', 'rust'],
          ['t', 'systems'],
        ],
        pubkey: '82341f882b6eabcd2d62ef022249ec371142166391a11c5183dd2b8361e67182',
      };
      const result = evaluateZupQuality(event);
      expect(result.passes).toBe(true);
    });

    test('rejects simulated seed spam events', () => {
      const spamEvent1 = {
        content:
          '🚨 URGENT FREE 10,000 TOKEN AIRDROP! Connect your seed phrase now at free-tokens-claim.xyz to verify your wallet!! 💸🚀',
        tags: [['t', 'airdrop']],
      };
      expect(evaluateZupQuality(spamEvent1).passes).toBe(false);

      const spamEvent2 = {
        content:
          'Join our VIP signal group on t.me/pump100x_signals for guaranteed 500% daily returns on leverage trading!! Click fast!',
        tags: [['t', 'crypto']],
      };
      expect(evaluateZupQuality(spamEvent2).passes).toBe(false);
    });
  });

  describe('sanitizeZupContent', () => {
    test('collapses excessive vertical newlines to max 2', () => {
      const raw = 'Header\n\n\n\n\nParagraph text here.\n\n\nFooter';
      const clean = sanitizeZupContent(raw);
      expect(clean).toBe('Header\n\nParagraph text here.\n\nFooter');
    });
  });
});
