import { describe, expect, test, beforeEach } from 'bun:test';
import {
  generateRandomBytes,
  bytesToHex,
  hexToBytes,
  deriveKEKFromPassword,
  deriveKEKFromPasswordPBKDF2,
  encryptData,
  decryptData,
  generateMEK,
  encryptMEKWithPassword,
  decryptMEKWithPassword,
  encryptSecret,
  decryptSecret,
  verifyMEKRoundtrip,
  createPasskeyRecord,
  unlockMEKWithPasskey,
  testPasskeyAssertion,
  masterPassCrypto,
  ARGON2_CONFIG,
} from '../crypto';

describe('Local Zero-Knowledge Encryption System (Argon2id + AES-256-GCM)', () => {
  beforeEach(() => {
    masterPassCrypto.purgeMemory();
  });

  test('generateRandomBytes generates cryptographically non-empty unique buffers', () => {
    const b1 = generateRandomBytes(32);
    const b2 = generateRandomBytes(32);
    expect(b1.byteLength).toBe(32);
    expect(b2.byteLength).toBe(32);
    expect(bytesToHex(b1)).not.toBe(bytesToHex(b2));
  });

  test('hexToBytes and bytesToHex perform lossless conversion', () => {
    const original = generateRandomBytes(64);
    const hex = bytesToHex(original);
    const roundtrip = hexToBytes(hex);
    expect(bytesToHex(roundtrip)).toBe(hex);
  });

  test('deriveKEKFromPassword derives deterministic 256-bit key with Argon2id', async () => {
    const password = 'CorrectHorseBatteryStaple#2026';
    const salt = generateRandomBytes(32);

    const key1 = await deriveKEKFromPassword(password, salt);
    const key2 = await deriveKEKFromPassword(password, salt);

    expect(key1.byteLength).toBe(32); // 256-bit key
    expect(bytesToHex(key1)).toBe(bytesToHex(key2));

    // Different password produces different key
    const keyDiff = await deriveKEKFromPassword('DifferentPassword#2026', salt);
    expect(bytesToHex(key1)).not.toBe(bytesToHex(keyDiff));
  });

  test('deriveKEKFromPasswordPBKDF2 provides reliable fallback derivation', async () => {
    const password = 'LegacyFallbackPassword#2026';
    const salt = generateRandomBytes(32);

    const key = await deriveKEKFromPasswordPBKDF2(password, salt);
    expect(key.byteLength).toBe(32);

    const key2 = await deriveKEKFromPasswordPBKDF2(password, salt);
    expect(bytesToHex(key)).toBe(bytesToHex(key2));
  });

  test('encryptData and decryptData perform authenticated AES-256-GCM roundtrip', async () => {
    const key = generateRandomBytes(32);
    const plaintext = new TextEncoder().encode('Sovereign Nostr Private Key: nsec1testsecret');

    const encrypted = await encryptData(plaintext, key);
    expect(encrypted.cipherText).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.iv.length).toBe(24); // 12 bytes = 24 hex chars (96-bit nonce)

    const decrypted = await decryptData(encrypted.cipherText, encrypted.iv, key);
    const decoded = new TextDecoder().decode(decrypted);
    expect(decoded).toBe('Sovereign Nostr Private Key: nsec1testsecret');
  });

  test('decryptData fails with incorrect key or tampered ciphertext (authenticated AEAD)', async () => {
    const correctKey = generateRandomBytes(32);
    const wrongKey = generateRandomBytes(32);
    const data = new TextEncoder().encode('Sensitive Payload');

    const encrypted = await encryptData(data, correctKey);

    // Decryption with wrong key must fail
    expect(decryptData(encrypted.cipherText, encrypted.iv, wrongKey)).rejects.toThrow();

    // Tampered ciphertext must fail authentication tag check
    const tamperedHex = encrypted.cipherText.slice(0, -2) + (encrypted.cipherText.endsWith('00') ? 'ff' : '00');
    expect(decryptData(tamperedHex, encrypted.iv, correctKey)).rejects.toThrow();
  });

  test('encryptMEKWithPassword and decryptMEKWithPassword full lifecycle', async () => {
    const mek = generateMEK();
    expect(mek.byteLength).toBe(32);

    const password = 'StrongMasterPassword!99#';
    const wrapped = await encryptMEKWithPassword(mek, password);

    expect(wrapped.cipherText).toBeDefined();
    expect(wrapped.iv).toBeDefined();
    expect(wrapped.salt).toBeDefined();

    // Decrypt with correct password
    const result = await decryptMEKWithPassword(wrapped, password);
    expect(bytesToHex(result.mek)).toBe(bytesToHex(mek));
    expect(result.wasUpgradedFromLegacy).toBe(false);

    // Decrypt with wrong password fails
    expect(decryptMEKWithPassword(wrapped, 'WrongPassword#123')).rejects.toThrow();
  });

  test('verifyMEKRoundtrip verifies key integrity', async () => {
    const mek = generateMEK();
    const kek = generateRandomBytes(32);
    const { cipherText, iv } = await encryptData(mek, kek);

    // Valid roundtrip succeeds without throwing
    await expect(verifyMEKRoundtrip(mek, cipherText, iv, kek)).resolves.toBeUndefined();

    // Mismatched raw MEK fails
    const badMek = generateMEK();
    await expect(verifyMEKRoundtrip(badMek, cipherText, iv, kek)).rejects.toThrow();
  });

  test('encryptSecret and decryptSecret handle string secrets (nsec, JSON, messages)', async () => {
    const mek = generateMEK();
    const secretNsec = 'nsec1vl029x9hmuf00g89rsduus7mmqqwvyxjlfemslne4t5qv0vd63vs3wan5vg';

    const encryptedJson = await encryptSecret(secretNsec, mek);
    expect(typeof encryptedJson).toBe('string');
    const parsed = JSON.parse(encryptedJson);
    expect(parsed.cipherText).toBeDefined();
    expect(parsed.iv).toBeDefined();

    const decrypted = await decryptSecret(encryptedJson, mek);
    expect(decrypted).toBe(secretNsec);
  });

  test('Passkey enrollment, assertion test, and unlock roundtrip', async () => {
    const mek = generateMEK();
    const passkey = await createPasskeyRecord(mek, 'YubiKey 5C', 'virtual');

    expect(passkey.id).toBeDefined();
    expect(passkey.name).toBe('YubiKey 5C');
    expect(passkey.credentialId).toBeDefined();
    expect(passkey.encryptedMEK.cipherText).toBeDefined();

    // Test assertion with active MEK
    const testResult = await testPasskeyAssertion(passkey, mek);
    expect(testResult.success).toBe(true);
    expect(typeof testResult.latencyMs).toBe('number');

    // Unlock MEK with passkey
    const unlockedMek = await unlockMEKWithPasskey(passkey);
    expect(bytesToHex(unlockedMek)).toBe(bytesToHex(mek));
  });

  test('MasterPassCryptoManager manages volatile in-memory MEK and wipes on lock', () => {
    expect(masterPassCrypto.isUnlocked()).toBe(false);
    expect(masterPassCrypto.getMEK()).toBeNull();

    const mek = generateMEK();
    let notifiedMek: Uint8Array | null = null;
    const unsub = masterPassCrypto.subscribe((m) => {
      notifiedMek = m;
    });

    masterPassCrypto.setMEK(mek);
    expect(masterPassCrypto.isUnlocked()).toBe(true);
    expect(masterPassCrypto.hasMEK()).toBe(true);
    expect(bytesToHex(masterPassCrypto.getMEK()!)).toBe(bytesToHex(mek));
    expect(notifiedMek).not.toBeNull();
    expect(bytesToHex(notifiedMek!)).toBe(bytesToHex(mek));

    // Lock application & purge memory
    masterPassCrypto.lockApplication();
    expect(masterPassCrypto.isUnlocked()).toBe(false);
    expect(masterPassCrypto.hasMEK()).toBe(false);
    expect(masterPassCrypto.getMEK()).toBeNull();
    expect(notifiedMek).toBeNull();

    unsub();
  });
});
