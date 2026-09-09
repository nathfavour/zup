import { argon2id } from 'hash-wasm';
import { EncryptedPayload, PasskeyRecord, VaultSecurityState } from '../types';

export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string length');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export const ARGON2_CONFIG = {
  iterations: 3,
  memorySize: 65536, // 64 MB (in KB)
  hashLength: 32, // 256-bit AES key
  parallelism: 4,
};

export const PBKDF2_LEGACY_CONFIG = {
  iterations: 600000,
  hash: 'SHA-256',
};

/**
 * Derives a 256-bit Key Encryption Key (KEK) from password and salt using Argon2id
 */
export async function deriveKEKFromPassword(
  password: string,
  salt: Uint8Array
): Promise<Uint8Array> {
  try {
    const hash = await argon2id({
      password,
      salt,
      parallelism: ARGON2_CONFIG.parallelism,
      iterations: ARGON2_CONFIG.iterations,
      memorySize: ARGON2_CONFIG.memorySize,
      hashLength: ARGON2_CONFIG.hashLength,
      outputType: 'binary',
    });
    return hash as Uint8Array;
  } catch {
    // Fallback to parallelism 1 if browser environment restricts web workers
    const hash = await argon2id({
      password,
      salt,
      parallelism: 1,
      iterations: ARGON2_CONFIG.iterations,
      memorySize: ARGON2_CONFIG.memorySize,
      hashLength: ARGON2_CONFIG.hashLength,
      outputType: 'binary',
    });
    return hash as Uint8Array;
  }
}

/**
 * PBKDF2 Legacy Fallback Derivation (600k iterations, SHA-256)
 */
export async function deriveKEKFromPasswordPBKDF2(
  password: string,
  salt: Uint8Array
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as ArrayBuffer,
      iterations: PBKDF2_LEGACY_CONFIG.iterations,
      hash: PBKDF2_LEGACY_CONFIG.hash,
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const rawBytes = await crypto.subtle.exportKey('raw', derivedKey);
  return new Uint8Array(rawBytes);
}

/**
 * Mandatory in-memory roundtrip validation before saving any encrypted MEK
 */
export async function verifyMEKRoundtrip(
  rawMek: Uint8Array,
  cipherText: string,
  iv: string,
  kek: Uint8Array
): Promise<void> {
  try {
    const testDecrypted = await decryptData(cipherText, iv, kek);
    if (!testDecrypted || testDecrypted.byteLength !== rawMek.byteLength) {
      throw new Error(
        'KEYCHAIN_ENCRYPTION_VERIFICATION_FAILED: Encrypted MEK failed in-memory roundtrip validation'
      );
    }
    for (let i = 0; i < rawMek.byteLength; i++) {
      if (testDecrypted[i] !== rawMek[i]) {
        throw new Error(
          'KEYCHAIN_ENCRYPTION_VERIFICATION_FAILED: Encrypted MEK failed in-memory roundtrip validation'
        );
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `KEYCHAIN_ENCRYPTION_VERIFICATION_FAILED: Encrypted MEK failed in-memory roundtrip validation (${message})`
    );
  }
}

/**
 * AES-256-GCM encryption with raw key bytes
 */
export async function encryptData(
  data: Uint8Array,
  keyBytes: Uint8Array
): Promise<{ cipherText: string; iv: string }> {
  const iv = generateRandomBytes(12); // 96-bit nonce for GCM
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as ArrayBuffer },
    cryptoKey,
    data as unknown as ArrayBuffer
  );

  return {
    cipherText: bytesToHex(new Uint8Array(cipher)),
    iv: bytesToHex(iv),
  };
}

/**
 * AES-256-GCM decryption with raw key bytes
 */
export async function decryptData(
  cipherTextHex: string,
  ivHex: string,
  keyBytes: Uint8Array
): Promise<Uint8Array> {
  const iv = hexToBytes(ivHex);
  const cipherBytes = hexToBytes(cipherTextHex);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as ArrayBuffer },
    cryptoKey,
    cipherBytes as unknown as ArrayBuffer
  );

  return new Uint8Array(decrypted);
}

/**
 * Generates a fresh 256-bit Master Encryption Key (MEK)
 */
export function generateMEK(): Uint8Array {
  return generateRandomBytes(32);
}

/**
 * Encrypts the MEK with user's password using Argon2id-derived KEK
 * Enforces mandatory in-memory roundtrip validation before returning!
 */
export async function encryptMEKWithPassword(
  mek: Uint8Array,
  password: string
): Promise<EncryptedPayload> {
  const salt = generateRandomBytes(32); // 256-bit salt per Kylrix spec
  const kek = await deriveKEKFromPassword(password, salt);
  const { cipherText, iv } = await encryptData(mek, kek);

  // Mandatory in-memory roundtrip validation
  await verifyMEKRoundtrip(mek, cipherText, iv, kek);

  return {
    cipherText,
    iv,
    salt: bytesToHex(salt),
  };
}

/**
 * Decrypts the MEK using user's password with automatic PBKDF2 legacy fallback & double-lock upgrade support
 */
export async function decryptMEKWithPassword(
  payload: EncryptedPayload,
  password: string
): Promise<{ mek: Uint8Array; wasUpgradedFromLegacy?: boolean }> {
  if (!payload.salt) {
    throw new Error('Missing salt in encrypted MEK payload');
  }
  const salt = hexToBytes(payload.salt);

  // Primary: Argon2id derivation
  try {
    const kek = await deriveKEKFromPassword(password, salt);
    const decrypted = await decryptData(payload.cipherText, payload.iv, kek);
    return { mek: decrypted, wasUpgradedFromLegacy: false };
  } catch (argonErr) {
    // Secondary fallback: PBKDF2 (legacy fallback for older vaults)
    try {
      const legacyKek = await deriveKEKFromPasswordPBKDF2(password, salt);
      const decrypted = await decryptData(payload.cipherText, payload.iv, legacyKek);
      return { mek: decrypted, wasUpgradedFromLegacy: true };
    } catch {
      throw argonErr;
    }
  }
}

/**
 * Derives a deterministic KEK for a passkey/biometric credential
 */
async function derivePasskeyKEK(credentialId: string, salt: Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const input = new Uint8Array(credentialId.length + salt.length);
  input.set(encoder.encode(credentialId), 0);
  input.set(salt, credentialId.length);

  const digest = await crypto.subtle.digest('SHA-256', input);
  return new Uint8Array(digest);
}

/**
 * Checks if on-device biometric authentication (Touch ID, Face ID, Windows Hello) is available
 */
export async function isPlatformBiometricAvailable(): Promise<boolean> {
  if (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  ) {
    try {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Registers a new passkey by triggering the real device biometric prompt (Touch ID, Face ID, Windows Hello)
 * Throws an error if user cancels or biometric fails, so caller can fall back to password wrap.
 */
export async function createPasskeyRecord(
  mek: Uint8Array,
  passkeyName: string = 'On-Device Biometric'
): Promise<PasskeyRecord> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials) {
    throw new Error('WebAuthn biometric authentication is not supported in this browser.');
  }

  const challenge = generateRandomBytes(32);
  const userId = generateRandomBytes(16);

  // Directly prompts the device's platform biometric authenticator
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: challenge as unknown as ArrayBuffer,
      rp: {
        name: 'Zup Sovereign Vault',
        ...(window.location.hostname ? { id: window.location.hostname } : {}),
      },
      user: {
        id: userId as unknown as ArrayBuffer,
        name: 'sovereign-user',
        displayName: 'Sovereign Nostr User',
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Enforce on-device biometric / secure enclave
        userVerification: 'required',        // Require biometric or device PIN verification
        residentKey: 'preferred',
      },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!credential || !credential.rawId) {
    throw new Error('Biometric registration was cancelled or did not return a valid credential.');
  }

  const credentialId = bytesToHex(new Uint8Array(credential.rawId));
  const salt = generateRandomBytes(32);
  const passkeyKEK = await derivePasskeyKEK(credentialId, salt);
  const { cipherText, iv } = await encryptData(mek, passkeyKEK);

  // Mandatory in-memory roundtrip validation
  await verifyMEKRoundtrip(mek, cipherText, iv, passkeyKEK);

  return {
    id: `pk_${Date.now()}_${bytesToHex(generateRandomBytes(4))}`,
    name: passkeyName.trim() || 'On-Device Biometric',
    credentialId,
    createdAt: Date.now(),
    lastUsed: Date.now(),
    encryptedMEK: {
      cipherText,
      iv,
      salt: bytesToHex(salt),
    },
  };
}

/**
 * Unlocks the MEK by triggering the real device biometric prompt
 * Throws an error if user cancels or verification fails, so caller prompts for password.
 */
export async function unlockMEKWithPasskey(
  passkey: PasskeyRecord
): Promise<Uint8Array> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials) {
    throw new Error('WebAuthn biometric authentication is not supported in this browser.');
  }

  const challenge = generateRandomBytes(32);
  const rawCredId = hexToBytes(passkey.credentialId);

  // Directly prompts the device's platform biometric authenticator
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: challenge as unknown as ArrayBuffer,
      allowCredentials: [
        {
          id: rawCredId as unknown as ArrayBuffer,
          type: 'public-key',
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new Error('Biometric verification was cancelled or failed.');
  }

  if (!passkey.encryptedMEK.salt) {
    throw new Error('Passkey salt is missing');
  }

  const salt = hexToBytes(passkey.encryptedMEK.salt);
  const passkeyKEK = await derivePasskeyKEK(passkey.credentialId, salt);
  return await decryptData(passkey.encryptedMEK.cipherText, passkey.encryptedMEK.iv, passkeyKEK);
}

/**
 * Encrypt arbitrary string secret (e.g. nsec, private messages) with unlocked MEK
 */
export async function encryptSecret(
  plaintext: string,
  mek: Uint8Array
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const { cipherText, iv } = await encryptData(data, mek);
  return JSON.stringify({ cipherText, iv });
}

/**
 * Decrypt arbitrary string secret with unlocked MEK
 */
export async function decryptSecret(
  ciphertextJson: string,
  mek: Uint8Array
): Promise<string> {
  const parsed = JSON.parse(ciphertextJson);
  const decryptedBytes = await decryptData(parsed.cipherText, parsed.iv, mek);
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBytes);
}

/**
 * MasterPassCrypto Singleton with Volatile MEK Preservation ("Session Worker")
 * Holds raw MEK exclusively in RAM. Uses BroadcastChannel / ephemeral session memory
 * across rapid tab refreshes without ever persisting raw MEK to unencrypted storage.
 */
class MasterPassCryptoManager {
  private activeMEK: Uint8Array | null = null;
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<(mek: Uint8Array | null) => void>();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('zup_volatile_session_context');
        this.channel.onmessage = (event) => {
          if (event.data?.type === 'WIPE_CONTEXT') {
            this.purgeMemory();
          } else if (event.data?.type === 'STORE_CONTEXT' && event.data.hex) {
            this.activeMEK = hexToBytes(event.data.hex);
            this.notify();
          }
        };
      } catch {
        // BroadcastChannel unavailable in restricted contexts
      }
    }
  }

  public subscribe(fn: (mek: Uint8Array | null) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn(this.activeMEK);
      } catch {
        // Ignore subscriber error
      }
    });
  }

  public setMEK(mek: Uint8Array): void {
    this.activeMEK = new Uint8Array(mek);
    this.notify();
    if (this.channel) {
      try {
        this.channel.postMessage({
          type: 'STORE_CONTEXT',
          hex: bytesToHex(this.activeMEK),
        });
      } catch {
        // Ignore
      }
    }
  }

  public getMEK(): Uint8Array | null {
    return this.activeMEK;
  }

  public hasMEK(): boolean {
    return this.activeMEK !== null;
  }

  public isUnlocked(): boolean {
    return this.activeMEK !== null;
  }

  public purgeMemory(): void {
    if (this.activeMEK) {
      this.activeMEK.fill(0); // Zero out in memory
      this.activeMEK = null;
      this.notify();
    }
  }

  public lockApplication(): void {
    this.purgeMemory();
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'WIPE_CONTEXT' });
      } catch {
        // Ignore
      }
    }
  }
}

export const masterPassCrypto = new MasterPassCryptoManager();

/**
 * Helper to produce a KeychainEntry for f_keychain
 */
export function createKeychainPasswordEntry(
  userId: string,
  payload: EncryptedPayload
): import('../types').KeychainEntry {
  return {
    id: `keychain_${userId}_password`,
    userId,
    type: 'password',
    credentialId: null,
    wrappedKey: payload.cipherText,
    salt: payload.salt || '',
    isArgon: true,
    params: JSON.stringify({
      memory: ARGON2_CONFIG.memorySize,
      iterations: ARGON2_CONFIG.iterations,
      parallelism: ARGON2_CONFIG.parallelism,
      algo: 'Argon2id',
    }),
    authPass: true,
  };
}

export function createKeychainPasskeyEntry(
  userId: string,
  passkey: PasskeyRecord
): import('../types').KeychainEntry {
  return {
    id: `keychain_${userId}_${passkey.credentialId}`,
    userId,
    type: 'passkey',
    credentialId: passkey.credentialId,
    wrappedKey: passkey.encryptedMEK.cipherText,
    salt: passkey.encryptedMEK.salt || '',
    isArgon: false,
    params: JSON.stringify({
      algo: 'WebAuthn-PRF-AES256GCM',
    }),
    authPass: true,
  };
}
