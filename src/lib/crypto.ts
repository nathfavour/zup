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
  memorySize: 64 * 1024, // 64 MB
  hashLength: 32, // 256-bit AES key
  parallelism: 1,
};

/**
 * Derives a 256-bit Key Encryption Key (KEK) from password and salt using Argon2id
 */
export async function deriveKEKFromPassword(
  password: string,
  salt: Uint8Array
): Promise<Uint8Array> {
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
 */
export async function encryptMEKWithPassword(
  mek: Uint8Array,
  password: string
): Promise<EncryptedPayload> {
  const salt = generateRandomBytes(16);
  const kek = await deriveKEKFromPassword(password, salt);
  const { cipherText, iv } = await encryptData(mek, kek);

  return {
    cipherText,
    iv,
    salt: bytesToHex(salt),
  };
}

/**
 * Decrypts the MEK using user's password
 */
export async function decryptMEKWithPassword(
  payload: EncryptedPayload,
  password: string
): Promise<Uint8Array> {
  if (!payload.salt) {
    throw new Error('Missing salt in encrypted MEK payload');
  }
  const salt = hexToBytes(payload.salt);
  const kek = await deriveKEKFromPassword(password, salt);
  return await decryptData(payload.cipherText, payload.iv, kek);
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
  const salt = generateRandomBytes(16);
  const passkeyKEK = await derivePasskeyKEK(credentialId, salt);
  const { cipherText, iv } = await encryptData(mek, passkeyKEK);

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
