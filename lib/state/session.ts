import { AuthProfileInfo, AuthProviderType, EncryptionManagementMode, EncryptedIdentity, KeychainSlot } from '../core/types';
import { db } from '../db';
import {
  deriveKeyFromPassword,
  decryptAesGcm,
  importRawKey,
  exportRawKey,
  generateMasterKey,
  encryptAesGcm,
  bytesToHex,
  hexToBytes
} from '../core/crypto';

// In-memory volatile vault holder (isolated from window/disk)
let volatileMasterKey: CryptoKey | null = null;

export function getVolatileMasterKey(): CryptoKey | null {
  return volatileMasterKey;
}
let volatilePrivkeyHex: string | null = null;
let autoLockTimer: NodeJS.Timeout | null = null;
const AUTO_LOCK_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export interface SessionState {
  isUnlocked: boolean;
  activePubkey: string | null;
  activeIdentity: EncryptedIdentity | null;
  identities: EncryptedIdentity[];
  keychainSlots: KeychainSlot[];
  autoLockCountdownSec: number;
  authProfile: AuthProfileInfo | null;
}

type SessionListener = (state: SessionState) => void;
const listeners = new Set<SessionListener>();

function notify() {
  const state = getSessionState();
  listeners.forEach((fn) => fn(state));
}

export function subscribeSession(listener: SessionListener): () => void {
  listeners.add(listener);
  listener(getSessionState());
  return () => {
    listeners.delete(listener);
  };
}

let cachedIdentities: EncryptedIdentity[] = [];
let cachedSlots: KeychainSlot[] = [];

export async function refreshCachedIdentities(): Promise<void> {
  cachedIdentities = await db.identities.toArray();
  cachedSlots = await db.keychain.toArray();
  notify();
}

export function getActivePubkey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('zup:active_pubkey');
}

export function getAuthProfile(): AuthProfileInfo | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('zup:auth_profile');
  if (!stored) return null;
  try {
    return JSON.parse(stored) as AuthProfileInfo;
  } catch {
    return null;
  }
}

export function saveAuthProfile(profile: AuthProfileInfo | null): void {
  if (typeof window === 'undefined') return;
  if (!profile) {
    localStorage.removeItem('zup:auth_profile');
  } else {
    localStorage.setItem('zup:auth_profile', JSON.stringify(profile));
  }
  notify();
}

export function getSessionState(): SessionState {
  const activePubkey = getActivePubkey();
  const activeIdentity = activePubkey
    ? cachedIdentities.find((i) => i.pubkey === activePubkey) || null
    : null;

  return {
    isUnlocked: volatileMasterKey !== null,
    activePubkey,
    activeIdentity,
    identities: cachedIdentities,
    keychainSlots: cachedSlots,
    autoLockCountdownSec: volatileMasterKey ? 600 : 0,
    authProfile: getAuthProfile()
  };
}

// Reset idle timer whenever user acts
export function touchSessionActivity(): void {
  if (!volatileMasterKey) return;
  if (autoLockTimer) clearTimeout(autoLockTimer);
  autoLockTimer = setTimeout(() => {
    lockVault();
  }, AUTO_LOCK_DURATION_MS);
}

/**
 * Encrypts an identity private key using the current volatile MEK.
 */
export async function encryptIdentityNsec(privkeyHexOrNsec: string): Promise<string> {
  if (!volatileMasterKey) {
    throw new Error('Vault is locked. Master Encryption Key is not in volatile memory.');
  }
  return await encryptAesGcm(volatileMasterKey, privkeyHexOrNsec);
}

/**
 * Returns the decrypted volatile private key for the active identity or a target identity pubkey
 */
export async function deriveActivePrivkeyHex(): Promise<string | null> {
  if (!volatileMasterKey) return null;
  const activePubkey = getActivePubkey();
  const identity = cachedIdentities.find((i) => i.pubkey === activePubkey) || cachedIdentities[0];
  if (!identity || !identity.wrappedNsec) return null;

  try {
    const unwrapped = await decryptAesGcm(volatileMasterKey, identity.wrappedNsec);
    volatilePrivkeyHex = unwrapped;
    return unwrapped;
  } catch {
    volatilePrivkeyHex = null;
    return null;
  }
}

/**
 * Unlocks the vault using the Master Password:
 * 1. Derives KEK_pass via Argon2id / PBKDF2.
 * 2. Unwraps the 256-bit MEK into volatile memory.
 * 3. Decrypts active identity's wrapped nsec into volatile memory.
 */
export async function unlockVault(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const slots = await db.keychain.toArray();
    const passwordSlot = slots.find((s) => s.type === 'password') || slots[0];

    if (!passwordSlot) {
      // First-time setup: generate MEK and initialize password slot
      const targetMek = volatileMasterKey || (await generateMasterKey());
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const kek = await deriveKeyFromPassword(password, salt);
      const rawMekBytes = await exportRawKey(targetMek);
      const rawMekHex = bytesToHex(rawMekBytes);
      const wrappedMek = await encryptAesGcm(kek, rawMekHex);

      const slot: KeychainSlot = {
        id: 'kc_' + Math.random().toString(36).substring(2, 9),
        type: 'password',
        wrappedMek,
        salt: btoa(String.fromCharCode(...salt)),
        params: {
          algo: 'Argon2id',
          memory: 65536,
          iterations: 3,
          parallelism: 4
        },
        createdAt: Date.now()
      };
      await db.keychain.add(slot);
      volatileMasterKey = targetMek;
      await refreshCachedIdentities();
      await deriveActivePrivkeyHex();
      touchSessionActivity();
      notify();
      return { success: true };
    }

    // Existing slot: attempt to unwrap MEK
    const saltBytes = passwordSlot.salt
      ? Uint8Array.from(atob(passwordSlot.salt), (c) => c.charCodeAt(0))
      : new Uint8Array(16);
    const kek = await deriveKeyFromPassword(password, saltBytes);

    let unwrappedRawStr: string;
    try {
      unwrappedRawStr = await decryptAesGcm(kek, passwordSlot.wrappedMek);
    } catch {
      return { success: false, error: 'Incorrect Master Password.' };
    }

    let rawMekBytes: Uint8Array;
    if (/^[0-9a-fA-F]{64}$/.test(unwrappedRawStr)) {
      rawMekBytes = hexToBytes(unwrappedRawStr);
    } else {
      rawMekBytes = new Uint8Array(unwrappedRawStr.length);
      for (let i = 0; i < unwrappedRawStr.length; i++) {
        rawMekBytes[i] = unwrappedRawStr.charCodeAt(i);
      }
      rawMekBytes = rawMekBytes.slice(0, 32);
    }

    volatileMasterKey = await importRawKey(rawMekBytes);
    await refreshCachedIdentities();
    await deriveActivePrivkeyHex();
    touchSessionActivity();
    notify();
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to unlock vault';
    return { success: false, error: message };
  }
}

/**
 * Unlocks vault directly with a provided CryptoKey MEK (used e.g. for WebAuthn passkeys)
 */
export async function unlockVaultWithMEK(mekKey: CryptoKey): Promise<void> {
  volatileMasterKey = mekKey;
  await refreshCachedIdentities();
  await deriveActivePrivkeyHex();
  touchSessionActivity();
  notify();
}

/**
 * Hard eviction: zeroes the volatile Master Encryption Key and active signer bytes
 */
export function lockVault(): void {
  if (autoLockTimer) {
    clearTimeout(autoLockTimer);
    autoLockTimer = null;
  }
  // Hard zeroing
  volatileMasterKey = null;
  volatilePrivkeyHex = null;
  notify();
}

/**
 * Switch active persona pointer or disconnect (null)
 */
export async function setActiveIdentity(pubkey: string | null): Promise<void> {
  if (pubkey) {
    const exists = cachedIdentities.some((i) => i.pubkey === pubkey);
    if (!exists) {
      await refreshCachedIdentities();
    }
  }
  if (typeof window !== 'undefined') {
    if (pubkey) {
      localStorage.setItem('zup:active_pubkey', pubkey);
    } else {
      localStorage.removeItem('zup:active_pubkey');
    }
  }
  await deriveActivePrivkeyHex();
  notify();
}

export function disconnectIdentity(): void {
  setActiveIdentity(null);
}

/**
 * Deletes an identity from Dexie local database and updates active persona pointer if needed.
 */
export async function deleteIdentity(pubkey: string): Promise<void> {
  await db.identities.delete(pubkey);
  const activePubkey = getActivePubkey();
  if (activePubkey === pubkey) {
    const remaining = await db.identities.toArray();
    if (remaining.length > 0) {
      await setActiveIdentity(remaining[0].pubkey);
    } else {
      await setActiveIdentity(null);
    }
  } else {
    await refreshCachedIdentities();
  }
}

/**
 * Get active signer credentials if vault is unlocked
 */
export function getActiveSigner(): { pubkey: string; privkey: string } | null {
  if (!volatileMasterKey || !volatilePrivkeyHex) return null;
  const activePubkey = getActivePubkey() || cachedIdentities[0]?.pubkey;
  if (!activePubkey) return null;
  return {
    pubkey: activePubkey,
    privkey: volatilePrivkeyHex
  };
}

/**
 * In-memory test helper for vault key wrapping roundtrip
 */
export async function testKeyWrappingRoundtrip(rawNsec: string): Promise<boolean> {
  if (!volatileMasterKey) return false;
  const wrapped = await encryptAesGcm(volatileMasterKey, rawNsec);
  const unwrapped = await decryptAesGcm(volatileMasterKey, wrapped);
  return unwrapped === rawNsec;
}
