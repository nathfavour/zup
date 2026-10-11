// WebCrypto and Nostr Cryptographic Primitives for zup
import { schnorr } from '@noble/curves/secp256k1.js';

// --- Hex and Byte Utilities ---
export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/^0x/, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return bytes;
}

// --- Bech32 Encoding/Decoding (NIP-19 npub / nsec) ---
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values: number[]): number {
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) {
        chk ^= GENERATOR[i];
      }
    }
  }
  return chk;
}

function hrpExpand(hrp: string): number[] {
  const ret: number[] = [];
  for (let p = 0; p < hrp.length; ++p) {
    ret.push(hrp.charCodeAt(p) >> 5);
  }
  ret.push(0);
  for (let p = 0; p < hrp.length; ++p) {
    ret.push(hrp.charCodeAt(p) & 31);
  }
  return ret;
}

function convertBits(data: number[] | Uint8Array, fromBits: number, toBits: number, pad: boolean): number[] {
  let acc = 0;
  let bits = 0;
  const ret: number[] = [];
  const maxv = (1 << toBits) - 1;
  for (let p = 0; p < data.length; ++p) {
    const value = data[p];
    if (value < 0 || value >> fromBits !== 0) {
      throw new Error('Invalid bit conversion value');
    }
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) {
      ret.push((acc << (toBits - bits)) & maxv);
    }
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) {
    throw new Error('Invalid padding');
  }
  return ret;
}

export function encodeBech32(hrp: string, dataBytes: Uint8Array): string {
  const words = convertBits(dataBytes, 8, 5, true);
  const values = hrpExpand(hrp).concat(words).concat([0, 0, 0, 0, 0, 0]);
  const mod = polymod(values) ^ 1;
  const checksum: number[] = [];
  for (let p = 0; p < 6; ++p) {
    checksum.push((mod >> (5 * (5 - p))) & 31);
  }
  let ret = hrp + '1';
  for (let p = 0; p < words.length; ++p) {
    ret += CHARSET.charAt(words[p]);
  }
  for (let p = 0; p < checksum.length; ++p) {
    ret += CHARSET.charAt(checksum[p]);
  }
  return ret;
}

export function decodeBech32(bechString: string): { hrp: string; hex: string } {
  const str = bechString.toLowerCase();
  const pos = str.lastIndexOf('1');
  if (pos < 1 || pos + 7 > str.length) throw new Error('Invalid bech32 string');
  const hrp = str.substring(0, pos);
  const words: number[] = [];
  for (let p = pos + 1; p < str.length; ++p) {
    const d = CHARSET.indexOf(str.charAt(p));
    if (d === -1) throw new Error('Invalid character in bech32 string');
    words.push(d);
  }
  const dataWords = words.slice(0, words.length - 6);
  const dataBytes = convertBits(dataWords, 5, 8, false);
  return { hrp, hex: bytesToHex(new Uint8Array(dataBytes)) };
}

export function hexToNpub(hex: string): string {
  return encodeBech32('npub', hexToBytes(hex));
}

export function hexToNsec(hex: string): string {
  return encodeBech32('nsec', hexToBytes(hex));
}

export function npubToHex(npub: string): string {
  const { hex } = decodeBech32(npub);
  return hex;
}

export function nsecToHex(nsec: string): string {
  const { hex } = decodeBech32(nsec);
  return hex;
}

/**
 * Safely parses and validates any Nostr key format (nsec, npub, or 64-char hex)
 * without throwing unhandled exceptions.
 */
export function safeDecodeKey(rawInput: string): {
  type: 'nsec' | 'npub' | 'hex' | null;
  hex: string;
  error?: string;
} {
  const clean = rawInput.trim();
  if (!clean) return { type: null, hex: '' };

  // Hex format check (64 hex characters)
  if (/^[0-9a-fA-F]{64}$/.test(clean)) {
    return { type: 'hex', hex: clean.toLowerCase() };
  }

  // nsec format
  if (clean.toLowerCase().startsWith('nsec1')) {
    try {
      const { hrp, hex } = decodeBech32(clean);
      if (hrp === 'nsec') {
        if (hex.length === 64) {
          return { type: 'nsec', hex };
        }
        return { type: null, hex: '', error: 'Decoded nsec key must be 32 bytes (64 hex characters)' };
      }
      return { type: null, hex: '', error: `Expected nsec prefix but found ${hrp}` };
    } catch (err: unknown) {
      return { type: null, hex: '', error: err instanceof Error ? err.message : 'Invalid nsec format' };
    }
  }

  // npub format
  if (clean.toLowerCase().startsWith('npub1')) {
    try {
      const { hrp, hex } = decodeBech32(clean);
      if (hrp === 'npub') {
        if (hex.length === 64) {
          return { type: 'npub', hex };
        }
        return { type: null, hex: '', error: 'Decoded npub key must be 32 bytes (64 hex characters)' };
      }
      return { type: null, hex: '', error: `Expected npub prefix but found ${hrp}` };
    } catch (err: unknown) {
      return { type: null, hex: '', error: err instanceof Error ? err.message : 'Invalid npub format' };
    }
  }

  return { type: null, hex: '', error: 'Key must start with nsec1, npub1, or be a 64-character hex string' };
}

// --- SHA-256 Hashing ---
export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return bytesToHex(new Uint8Array(hashBuffer));
}

// --- AES-GCM (256-bit) Key Derivation & Wrapping ---
export async function generateMasterKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

export async function exportRawKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(raw);
}

export async function importRawKey(bytes: Uint8Array): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'raw',
    bytes as unknown as BufferSource,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

// Derive KEK from Password using PBKDF2 (SHA-256, 100k iterations)
export async function deriveKeyFromPassword(password: string, saltBytes: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password) as unknown as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

// Encrypt plaintext string or bytes into Base64 (12-byte IV + Ciphertext + Tag)
export async function encryptAesGcm(key: CryptoKey, plaintext: string | Uint8Array): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = typeof plaintext === 'string' ? new TextEncoder().encode(plaintext) : plaintext;
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    data as unknown as BufferSource
  );

  const cipherBytes = new Uint8Array(cipherBuffer);
  const combined = new Uint8Array(iv.length + cipherBytes.length);
  combined.set(iv, 0);
  combined.set(cipherBytes, iv.length);

  return btoa(String.fromCharCode(...combined));
}

// Decrypt Base64 (12-byte IV + Ciphertext + Tag) into string
export async function decryptAesGcm(key: CryptoKey, wrappedBase64: string): Promise<string> {
  const raw = atob(wrappedBase64);
  const combined = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    combined[i] = raw.charCodeAt(i);
  }

  const iv = combined.slice(0, 12);
  const cipherBytes = combined.slice(12);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    cipherBytes as unknown as BufferSource
  );

  return new TextDecoder().decode(plainBuffer);
}

// --- Nostr KeyPair & Schnorr Signature Engine ---
// Generates a valid 32-byte private key and deterministic public key
export function generateNostrKeyPair(): { privkeyHex: string; pubkeyHex: string; nsec: string; npub: string } {
  const privBytes = crypto.getRandomValues(new Uint8Array(32));
  const privkeyHex = bytesToHex(privBytes);
  const pubkeyHex = derivePubkeyHex(privkeyHex);
  return {
    privkeyHex,
    pubkeyHex,
    nsec: hexToNsec(privkeyHex),
    npub: hexToNpub(pubkeyHex)
  };
}

// Deterministic 32-byte x-only public key derivation from private key via secp256k1
export function derivePubkeyHex(privkeyHex: string): string {
  const privBytes = hexToBytes(privkeyHex);
  const pubBytes = schnorr.getPublicKey(privBytes);
  return bytesToHex(pubBytes);
}

// Schnorr 64-byte signature generator (Nostr BIP-340 compatible)
export async function schnorrSign(eventHashHex: string, privkeyHex: string): Promise<string> {
  const hashBytes = hexToBytes(eventHashHex);
  const privBytes = hexToBytes(privkeyHex);
  const sigBytes = schnorr.sign(hashBytes, privBytes);
  return bytesToHex(sigBytes);
}

// Schnorr signature verifier (Nostr BIP-340 compatible)
export async function schnorrVerify(eventHashHex: string, sigHex: string, pubkeyHex: string): Promise<boolean> {
  if (!eventHashHex || !sigHex || !pubkeyHex) return false;
  if (eventHashHex.length !== 64 || sigHex.length !== 128 || pubkeyHex.length !== 64) return false;

  try {
    const hashBytes = hexToBytes(eventHashHex);
    const sigBytes = hexToBytes(sigHex);
    const pubBytes = hexToBytes(pubkeyHex);
    return schnorr.verify(sigBytes, hashBytes, pubBytes);
  } catch {
    return false;
  }
}
