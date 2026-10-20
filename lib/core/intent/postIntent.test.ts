import { describe, test, expect } from 'bun:test';
import {
  parsePostIntent,
  buildIntentTags,
  normalizeBech32OrHex
} from './postIntent';
import { hexToNpub } from '../crypto';

describe('zup Post Intent Compatibility Engine', () => {
  test('normalizeBech32OrHex decodes npub1 and note1 strings to hex', () => {
    const testHex = '8234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const npub = hexToNpub(testHex);

    expect(normalizeBech32OrHex(npub)).toBe(testHex);
    expect(normalizeBech32OrHex(testHex)).toBe(testHex);
    expect(normalizeBech32OrHex('  invalid-bech-string  ')).toBe('invalid-bech-string');
  });

  test('parsePostIntent extracts core and alias parameters from URLSearchParams', () => {
    const search = new URLSearchParams(
      'content=Great%20update!&kind=1&e=4b8a111111111111111111111111111111111111111111111111111111111111&p=8234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef&t=nostr&t=zup&client=my-cli-tool'
    );

    const parsed = parsePostIntent(search);

    expect(parsed.content).toBe('Great update!');
    expect(parsed.kind).toBe(1);
    expect(parsed.e).toEqual(['4b8a111111111111111111111111111111111111111111111111111111111111']);
    expect(parsed.p).toEqual(['8234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef']);
    expect(parsed.t).toEqual(['nostr', 'zup']);
    expect(parsed.client).toBe('my-cli-tool');
  });

  test('parsePostIntent supports parameter aliases (subject, reply, mention, hashtag, url, image)', () => {
    const search = new URLSearchParams();
    search.set('content', 'Article draft');
    search.set('kind', '30023');
    search.set('subject', 'Release Notes v2');
    search.set('reply', 'note1-event-id');
    search.set('mention', 'npub1-pubkey');
    search.set('hashtag', '#engineering, #tech');
    search.set('url', 'https://github.com');
    search.set('image', 'https://example.com/screenshot.png');

    const parsed = parsePostIntent(search);

    expect(parsed.content).toBe('Article draft');
    expect(parsed.kind).toBe(30023);
    expect(parsed.title).toBe('Release Notes v2');
    expect(parsed.e).toEqual(['note1-event-id']);
    expect(parsed.p).toEqual(['npub1-pubkey']);
    expect(parsed.t).toEqual(['engineering', 'tech']);
    expect(parsed.r).toEqual(['https://github.com']);
    expect(parsed.media).toEqual(['https://example.com/screenshot.png']);
  });

  test('parsePostIntent handles comma-separated lists and deduplication', () => {
    const search = new URLSearchParams('t=nostr,zup&t=zup,crypto&r=https://a.com,https://b.com');

    const parsed = parsePostIntent(search);

    expect(parsed.t).toEqual(['nostr', 'zup', 'crypto']);
    expect(parsed.r).toEqual(['https://a.com', 'https://b.com']);
  });

  test('buildIntentTags constructs canonical Nostr NIP tags', () => {
    const intent = {
      content: 'Hello Nostr',
      kind: 30023,
      title: 'Zup Spec v1',
      e: ['4b8a111111111111111111111111111111111111111111111111111111111111'],
      p: ['8234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'],
      t: ['nostr', 'zup'],
      r: ['https://getzup.vercel.app'],
      media: ['https://example.com/media.jpg'],
      client: 'my-cli-tool'
    };

    const tags = buildIntentTags(intent);

    expect(tags).toContainEqual(['title', 'Zup Spec v1']);
    expect(tags).toContainEqual(['d', 'zup-spec-v1']);
    expect(tags).toContainEqual(['e', '4b8a111111111111111111111111111111111111111111111111111111111111']);
    expect(tags).toContainEqual(['p', '8234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef']);
    expect(tags).toContainEqual(['t', 'nostr']);
    expect(tags).toContainEqual(['t', 'zup']);
    expect(tags).toContainEqual(['r', 'https://getzup.vercel.app']);
    expect(tags).toContainEqual(['r', 'https://example.com/media.jpg']);
    expect(tags).toContainEqual(['image', 'https://example.com/media.jpg']);
    expect(tags).toContainEqual(['client', 'my-cli-tool']);
  });
});
