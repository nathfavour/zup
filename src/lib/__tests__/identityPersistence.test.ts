import { describe, expect, test } from 'bun:test';
import { createNewKeypair, importKey, pubkeyToNpub, bytesToHex, hexToBytes } from '../nostr';
import { generateMEK, encryptSecret, decryptSecret } from '../crypto';
import { getPublicKey } from 'nostr-tools';

describe('Sovereign Identity Key Management & Persistence', () => {
  test('createNewKeypair generates matching pubkey and privkey', () => {
    const kp = createNewKeypair(false);
    expect(kp.privkeyHex).toBeDefined();
    expect(kp.pubkeyHex).toBeDefined();
    expect(kp.nsec).toBeDefined();
    expect(kp.npub).toBeDefined();

    // Verify cryptographic derivation
    const DerivedPubHex = getPublicKey(hexToBytes(kp.privkeyHex!));
    expect(DerivedPubHex).toBe(kp.pubkeyHex);
  });

  test('importKey imports nsec and hex keys correctly without key mismatch', () => {
    const fresh = createNewKeypair(false);

    // Import via nsec
    const importedNsec = importKey(fresh.nsec!);
    expect(importedNsec).not.toBeNull();
    expect(importedNsec!.pubkeyHex).toBe(fresh.pubkeyHex);
    expect(importedNsec!.privkeyHex).toBe(fresh.privkeyHex);

    // Import via hex
    const importedHex = importKey(fresh.privkeyHex!);
    expect(importedHex).not.toBeNull();
    expect(importedHex!.pubkeyHex).toBe(fresh.pubkeyHex);
  });

  test('encryptSecret and decryptSecret roundtrip with MEK preserves private keys', async () => {
    const mek = generateMEK();
    const kp = createNewKeypair(false);

    const encryptedPriv = await encryptSecret(kp.privkeyHex!, mek);
    const encryptedNsec = await encryptSecret(kp.nsec!, mek);

    const decryptedPriv = await decryptSecret(encryptedPriv, mek);
    const decryptedNsec = await decryptSecret(encryptedNsec, mek);

    expect(decryptedPriv).toBe(kp.privkeyHex);
    expect(decryptedNsec).toBe(kp.nsec);

    // Cryptographic verification after decryption
    const derivedPub = getPublicKey(hexToBytes(decryptedPriv));
    expect(derivedPub).toBe(kp.pubkeyHex);
  });

  test('re-encrypting stored secret with same active MEK maintains decryption consistency', async () => {
    const activeMek = generateMEK();
    const kp = createNewKeypair(false);

    // Initial encryption with active MEK
    const initialEncrypted = await encryptSecret(kp.privkeyHex!, activeMek);

    // Verify decryption with active MEK
    const decryptedFirst = await decryptSecret(initialEncrypted, activeMek);
    expect(decryptedFirst).toBe(kp.privkeyHex);

    // Re-encrypting with active MEK (e.g. on vault security update)
    const reencrypted = await encryptSecret(decryptedFirst, activeMek);
    const decryptedSecond = await decryptSecret(reencrypted, activeMek);
    expect(decryptedSecond).toBe(kp.privkeyHex);
  });
});
