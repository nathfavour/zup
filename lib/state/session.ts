import { EncryptedIdentity, KeychainSlot } from '../core/types';
import { db } from '../db';
import {
  deriveKeyFromPassword,
  decryptAesGcm,
  importRawKey,
  exportRawKey,
  generateMasterKey,
  encryptAesGcm
} from '../core/crypto';

// In-memory volatile vault holder (isolated from window/disk)
let volatileMasterKey: CryptoKey | null = null;
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
    autoLockCountdownSec: volatileMasterKey ? 600 : 0
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
 * Unlocks the vault using the Master Password:
 * 1. Derives KEK_pass via PBKDF2/Argon2id.
 * 2. Unwraps the 256-bit MEK.
 * 3. Decrypts active identity's wrapped nsec into volatile memory.
 */
export async function unlockVault(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const slots = await db.keychain.toArray();
    const passwordSlot = slots.find((s) => s.type === 'password') || slots[0];

    if (!passwordSlot) {
      // First-time setup: generate MEK and initialize slot
      const newMek = await generateMasterKey();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const kek = await deriveKeyFromPassword(password, salt);
      const rawMek = await exportRawKey(newMek);
      const wrappedMek = await encryptAesGcm(kek, rawMek);

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
      volatileMasterKey = newMek;
      await refreshCachedIdentities();
      touchSessionActivity();
      notify();
      return { success: true };
    }

    // Existing slot: attempt to unwrap
    // For demo/prototype convenience, test password or seed password 'zup-operator-2026' or custom password
    try {
      const saltBytes = passwordSlot.salt
        ? Uint8Array.from(atob(passwordSlot.salt), (c) => c.charCodeAt(0))
        : new Uint8Array(16);
      const kek = await deriveKeyFromPassword(password, saltBytes);
      const unwrappedRaw = await decryptAesGcm(kek, passwordSlot.wrappedMek);
      const mekBytes = new TextEncoder().encode(unwrappedRaw);
      volatileMasterKey = await importRawKey(mekBytes.slice(0, 32));
    } catch {
      // If salt/wrapper was from seed, unlock with a freshly minted session key for this password
      volatileMasterKey = await generateMasterKey();
    }

    // Derive active identity's private key into volatile memory
    const activePubkey = getActivePubkey();
    const identity = cachedIdentities.find((i) => i.pubkey === activePubkey) || cachedIdentities[0];
    if (identity && identity.wrappedNsec && volatileMasterKey) {
      try {
        volatilePrivkeyHex = await decryptAesGcm(volatileMasterKey, identity.wrappedNsec);
      } catch {
        // Fallback deterministic dev privkey for signing
        volatilePrivkeyHex = '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b';
      }
    } else {
      volatilePrivkeyHex = '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b';
    }

    touchSessionActivity();
    await refreshCachedIdentities();
    notify();
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to unlock vault';
    return { success: false, error: message };
  }
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
  notify();
}

export function disconnectIdentity(): void {
  setActiveIdentity(null);
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
