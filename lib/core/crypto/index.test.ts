import { expect, test, describe } from 'bun:test';
import {
  generateNostrKeyPair,
  derivePubkeyHex,
  hexToNpub,
  hexToNsec,
  nsecToHex,
  npubToHex,
  safeDecodeKey,
  schnorrSign,
  schnorrVerify
} from './index';

describe('Nostr Cryptographic Primitives & Secp256k1 Verification', () => {
  test('Known nsec test vector derives exact standard Nostr npub and hex pubkey', () => {
    // Private key 0x00...01
    const privHex = '0000000000000000000000000000000000000000000000000000000000000001';
    const nsec = hexToNsec(privHex);
    expect(nsec).toBe('nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsmhltgl');

    const derivedPrivHex = nsecToHex(nsec);
    expect(derivedPrivHex).toBe(privHex);

    const pubHex = derivePubkeyHex(privHex);
    expect(pubHex).toBe('79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798');

    const npub = hexToNpub(pubHex);
    expect(npub).toBe('npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d');
    expect(npubToHex(npub)).toBe(pubHex);
  });

  test('safeDecodeKey correctly identifies nsec, npub, and hex keys', () => {
    const privHex = '0000000000000000000000000000000000000000000000000000000000000001';
    const nsec = hexToNsec(privHex);
    const pubHex = derivePubkeyHex(privHex);
    const npub = hexToNpub(pubHex);

    const decodedNsec = safeDecodeKey(nsec);
    expect(decodedNsec.type).toBe('nsec');
    expect(decodedNsec.hex).toBe(privHex);

    const decodedNpub = safeDecodeKey(npub);
    expect(decodedNpub.type).toBe('npub');
    expect(decodedNpub.hex).toBe(pubHex);

    const decodedHex = safeDecodeKey(privHex);
    expect(decodedHex.type).toBe('hex');
    expect(decodedHex.hex).toBe(privHex);
  });

  test('generateNostrKeyPair returns valid keypair with matching npub', () => {
    const kp = generateNostrKeyPair();
    expect(kp.privkeyHex.length).toBe(64);
    expect(kp.pubkeyHex.length).toBe(64);
    expect(kp.nsec.startsWith('nsec1')).toBe(true);
    expect(kp.npub.startsWith('npub1')).toBe(true);

    const expectedPubHex = derivePubkeyHex(kp.privkeyHex);
    expect(kp.pubkeyHex).toBe(expectedPubHex);
    expect(kp.npub).toBe(hexToNpub(expectedPubHex));
  });

  test('Schnorr signing and verification produces valid signature', async () => {
    const kp = generateNostrKeyPair();
    const eventHashHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const sig = await schnorrSign(eventHashHex, kp.privkeyHex);
    expect(sig.length).toBe(128);

    const isValid = await schnorrVerify(eventHashHex, sig, kp.pubkeyHex);
    expect(isValid).toBe(true);

    const isInvalid = await schnorrVerify(eventHashHex, sig, '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798');
    expect(isInvalid).toBe(false);
  });
});
