import { describe, expect, test } from 'bun:test';
import {
  isUriPacked,
  isSpaceSpam,
  isTagSpam,
  isGibberish,
  evaluateZupQuality,
  sanitizeZupContent,
  isTechRelated,
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

    test('flags raw JSON presence protocol payload dumps', () => {
      const jsonSpam = '{"type":"presence","payload":"online"}\n#stickerpals_broadcast';
      expect(isGibberish(jsonSpam)).toBe(true);
      expect(evaluateZupQuality({ content: jsonSpam }).passes).toBe(false);
    });

    test('flags npub line dumps in content', () => {
      const npubSpam = 'npub16xq2p3x...2p3x\nPeer d18058\nnpub16xq2p3x...2p3x';
      // If full npubs exist
      const fullNpubSpam = 'npub16xq5gvgj2p3x0cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkws\nnpub10yxypf30cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkws';
      expect(isGibberish(fullNpubSpam)).toBe(true);
    });

    test('flags dangling digit fragments and bot broadcast hashtags', () => {
      const digitFragment = 'Check out this post https://example.com/posts/202\n\n609101/\n';
      expect(isGibberish(digitFragment)).toBe(true);
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

    test('rejects non-English / CJK posts (English-only client policy)', () => {
      const cjkSpam1 = {
        content: 'わりと可愛くて笑う',
        tags: [],
      };
      expect(evaluateZupQuality(cjkSpam1).passes).toBe(false);

      const cjkSpam2 = {
        content: '高市早苗のバックにいる「神道政治連盟」のクソ老害ども。明治時代の価値観を2026年の日本人に押し付けて、女性の権利や多様性を徹底的に弾圧しようとするカルト右翼。高市はその最高の人形。',
        tags: [],
      };
      expect(evaluateZupQuality(cjkSpam2).passes).toBe(false);

      const cjkSpam3 = {
        content: '靖国神社――それは殺人狂たちの隔離病棟だ。そこへ行く連中は、狂人たちの集まりに過ぎない。',
        tags: [],
      };
      expect(evaluateZupQuality(cjkSpam3).passes).toBe(false);

      // Short CJK (<= 3 chars)
      expect(evaluateZupQuality({ content: '絶望的' }).passes).toBe(false);
      expect(evaluateZupQuality({ content: 'おかし' }).passes).toBe(false);
      expect(evaluateZupQuality({ content: '冬こい' }).passes).toBe(false);
    });

    test('rejects low-effort greetings and conversational noise', () => {
      expect(evaluateZupQuality({ content: 'Morning lemon 🥰🥰' }).passes).toBe(false);
      expect(evaluateZupQuality({ content: 'GM 🍋🌄' }).passes).toBe(false);
      expect(evaluateZupQuality({ content: 'Gm' }).passes).toBe(false);
      expect(evaluateZupQuality({ content: 'Gmorning' }).passes).toBe(false);
      expect(evaluateZupQuality({ content: 'PV 🤙🏼🍀☕' }).passes).toBe(false);
      expect(evaluateZupQuality({ content: 'Horny hmu' }).passes).toBe(false);
      expect(evaluateZupQuality({ content: 'Bom dia #nostr\n#nostr' }).passes).toBe(false);
      expect(evaluateZupQuality({ content: 'Yes' }).passes).toBe(false);
      expect(evaluateZupQuality({ content: 'True' }).passes).toBe(false);
      expect(evaluateZupQuality({ content: 'Great advice' }).passes).toBe(false);
      expect(evaluateZupQuality({ content: 'thebaby still here. 👋' }).passes).toBe(false);
    });

    test('rejects Moscow Time bot telemetry and block height tickers', () => {
      expect(evaluateZupQuality({ content: '12:83 @ 966,330\n#bitcoin\n#moscowtime\n#nostr' }).passes).toBe(false);
      expect(evaluateZupQuality({ content: '12:81 @ 966,329\n#bitcoin\n#moscowtime\n#nostr' }).passes).toBe(false);
      expect(evaluateZupQuality({ content: '12:75 @ 966,256\n#bitcoin\n#moscowtime\n#nostr' }).passes).toBe(false);
    });

    test('rejects low-signal BIP39 seed word lists and dictionary dumps', () => {
      expect(evaluateZupQuality({ content: 'stomach\n#bitcoin\n#seed\n#bip39' }).passes).toBe(false);
      expect(evaluateZupQuality({ content: 'observe\n#bitcoin\n#seed\n#bip39' }).passes).toBe(false);
    });
  });

  describe('isTechRelated', () => {
    test('identifies technical content by keywords, code blocks, or tags', () => {
      expect(
        isTechRelated(
          'Replaced our ingress proxy with an eBPF XDP filter written in Rust. Kernel context switches dropped by 92%.'
        )
      ).toBe(true);

      expect(isTechRelated('Check out this commit: ```const a = 1;```')).toBe(true);

      expect(isTechRelated('Great perspective on monetary economics', [['t', 'bitcoin']])).toBe(true);
      expect(isTechRelated('Building on open-source relays', [['t', 'nostr']])).toBe(true);
    });

    test('rejects generic non-tech noise', () => {
      expect(isTechRelated('I love eating apples and bananas')).toBe(false);
      expect(isTechRelated('Going to the beach today with my dog')).toBe(false);
      expect(isTechRelated('What is everyone having for lunch?')).toBe(false);
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
