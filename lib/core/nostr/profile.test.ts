import { expect, test, describe } from 'bun:test';
import {
  isRawAlphanumericIdentity,
  getProfileDisplayName,
  getProfileHandle,
  generateLocalIdenticon
} from './index';
import { ProfileMetadata } from '../types';

describe('Nostr Profile Helpers & Metadata Formatting', () => {
  const mockPubkey = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';

  test('isRawAlphanumericIdentity detects hex pubkeys, npubs, and stubs', () => {
    expect(isRawAlphanumericIdentity('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798')).toBe(true);
    expect(isRawAlphanumericIdentity('npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d')).toBe(true);
    expect(isRawAlphanumericIdentity('79be667e')).toBe(true);
    expect(isRawAlphanumericIdentity('Satoshi Nakamoto')).toBe(false);
    expect(isRawAlphanumericIdentity('alice')).toBe(false);
  });

  test('getProfileDisplayName extracts display_name or name when valid', () => {
    const profWithDisplayName: ProfileMetadata = {
      pubkey: mockPubkey,
      content: '{"display_name":"Alice Wonderland"}',
      display_name: 'Alice Wonderland',
      name: 'alice',
      cached_at: Date.now(),
      updated_at: 1000
    };
    expect(getProfileDisplayName(profWithDisplayName, mockPubkey)).toBe('Alice Wonderland');

    const profWithNameOnly: ProfileMetadata = {
      pubkey: mockPubkey,
      content: '{"name":"bob"}',
      name: 'bob',
      cached_at: Date.now(),
      updated_at: 1000
    };
    expect(getProfileDisplayName(profWithNameOnly, mockPubkey)).toBe('bob');
  });

  test('getProfileDisplayName falls back to fallback label or clean Nostr User', () => {
    const emptyProf: ProfileMetadata = {
      pubkey: mockPubkey,
      content: '{}',
      cached_at: Date.now(),
      updated_at: 1000
    };
    expect(getProfileDisplayName(emptyProf, mockPubkey, 'My Vault Persona')).toBe('My Vault Persona');
    expect(getProfileDisplayName(null, mockPubkey)).toContain('Nostr User');
  });

  test('getProfileHandle formats nip05 or name', () => {
    const profWithNip05: ProfileMetadata = {
      pubkey: mockPubkey,
      content: '{"nip05":"alice@example.com"}',
      nip05: 'alice@example.com',
      cached_at: Date.now(),
      updated_at: 1000
    };
    expect(getProfileHandle(profWithNip05, mockPubkey)).toBe('@alice@example.com');

    const profWithName: ProfileMetadata = {
      pubkey: mockPubkey,
      content: '{"name":"alice"}',
      name: 'alice',
      cached_at: Date.now(),
      updated_at: 1000
    };
    expect(getProfileHandle(profWithName, mockPubkey)).toBe('@alice');

    expect(getProfileHandle(null, mockPubkey)).toContain('@npub1');
  });

  test('generateLocalIdenticon returns valid SVG data URI', () => {
    const identicon = generateLocalIdenticon(mockPubkey);
    expect(identicon.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    expect(decodeURIComponent(identicon)).toContain('<svg');
  });
});
