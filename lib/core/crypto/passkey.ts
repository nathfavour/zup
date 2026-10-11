import { KeychainSlot } from '../types';
import { db } from '../../db';
import {
  encryptAesGcm,
  decryptAesGcm,
  exportRawKey,
  importRawKey,
  generateMasterKey,
  sha256Hex
} from './index';
import { unlockVaultWithMEK } from '../../state/session';

// Helper to convert ArrayBuffer to Base64URL string
function bufferToBase64URL(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Helper to convert Base64URL string to Uint8Array
function base64URLToBuffer(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derives a CryptoKey (KEK) from WebAuthn PRF extension output or SHA-256 fallback digest.
 */
async function deriveWebAuthnKEK(rawPrfBytes: Uint8Array): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest('SHA-256', rawPrfBytes as unknown as BufferSource);
  return await crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Registers a new WebAuthn Passkey credential and wraps the active MEK into a passkey slot.
 */
export async function registerPasskey(userLabel = 'Operator Passkey'): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return { success: false, error: 'WebAuthn passkeys are not supported in this browser environment.' };
  }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const salt = new TextEncoder().encode('zup-unified-salt-v1');

    const createOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'zup Vault',
        id: window.location.hostname
      },
      user: {
        id: userId,
        name: userLabel,
        displayName: userLabel
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256
        { alg: -257, type: 'public-key' } // RS256
      ],
      authenticatorSelection: {
        userVerification: 'preferred',
        residentKey: 'preferred'
      },
      timeout: 60000,
      extensions: {
        prf: {
          eval: {
            first: salt
          }
        }
      } as unknown as AuthenticationExtensionsClientInputs
    };

    const credential = (await navigator.credentials.create({
      publicKey: createOptions
    })) as PublicKeyCredential;

    if (!credential) {
      return { success: false, error: 'Passkey creation failed or was cancelled.' };
    }

    const credentialIdStr = bufferToBase64URL(credential.rawId);

    // Extract PRF evaluation output if supported, or derive deterministic fallback KEK
    let prfBytes: Uint8Array;
    const clientExtensionResults = credential.getClientExtensionResults?.() as { prf?: { results?: { first?: ArrayBuffer } } };
    if (clientExtensionResults?.prf?.results?.first) {
      prfBytes = new Uint8Array(clientExtensionResults.prf.results.first);
    } else {
      // Deterministic fallback KEK from credential ID + userId
      const combined = new Uint8Array(credential.rawId.byteLength + userId.byteLength);
      combined.set(new Uint8Array(credential.rawId), 0);
      combined.set(userId, credential.rawId.byteLength);
      const fallbackHash = await sha256Hex(combined);
      prfBytes = new TextEncoder().encode(fallbackHash);
    }

    const kek = await deriveWebAuthnKEK(prfBytes);

    // Get active MEK or generate new one
    const newMek = await generateMasterKey();
    const rawMek = await exportRawKey(newMek);
    const wrappedMek = await encryptAesGcm(kek, rawMek);

    const slot: KeychainSlot = {
      id: 'kc_passkey_' + Math.random().toString(36).substring(2, 9),
      type: 'passkey',
      credentialId: credentialIdStr,
      wrappedMek,
      salt: bufferToBase64URL(salt.buffer as ArrayBuffer),
      params: {
        algo: clientExtensionResults?.prf?.results?.first ? 'WebAuthn-PRF' : 'WebAuthn-Fallback',
        memory: 0,
        iterations: 1,
        parallelism: 1
      },
      createdAt: Date.now()
    };

    await db.keychain.add(slot);
    await unlockVaultWithMEK(newMek);

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Passkey registration error';
    return { success: false, error: msg };
  }
}

/**
 * Authenticates with an existing WebAuthn Passkey credential to unseal the MEK.
 */
export async function authenticatePasskey(): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return { success: false, error: 'WebAuthn passkeys are not supported in this browser environment.' };
  }

  try {
    const slots = await db.keychain.toArray();
    const passkeySlots = slots.filter((s) => s.type === 'passkey');

    if (passkeySlots.length === 0) {
      return { success: false, error: 'No passkey credentials registered in local keychain.' };
    }

    const allowCredentials: PublicKeyCredentialDescriptor[] = passkeySlots
      .filter((s) => s.credentialId)
      .map((s) => ({
        id: base64URLToBuffer(s.credentialId!).buffer as ArrayBuffer,
        type: 'public-key'
      }));

    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const salt = new TextEncoder().encode('zup-unified-salt-v1');

    const getOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      allowCredentials,
      userVerification: 'preferred',
      timeout: 60000,
      extensions: {
        prf: {
          eval: {
            first: salt
          }
        }
      } as unknown as AuthenticationExtensionsClientInputs
    };

    const assertion = (await navigator.credentials.get({
      publicKey: getOptions
    })) as PublicKeyCredential;

    if (!assertion) {
      return { success: false, error: 'Passkey assertion failed or was cancelled.' };
    }

    const credentialIdStr = bufferToBase64URL(assertion.rawId);
    const targetSlot = passkeySlots.find((s) => s.credentialId === credentialIdStr) || passkeySlots[0];

    let prfBytes: Uint8Array;
    const clientExtensionResults = assertion.getClientExtensionResults?.() as { prf?: { results?: { first?: ArrayBuffer } } };
    if (clientExtensionResults?.prf?.results?.first) {
      prfBytes = new Uint8Array(clientExtensionResults.prf.results.first);
    } else {
      // KEK fallback digest
      const fallbackHash = await sha256Hex(new Uint8Array(assertion.rawId));
      prfBytes = new TextEncoder().encode(fallbackHash);
    }

    const kek = await deriveWebAuthnKEK(prfBytes);
    const unwrappedRawStr = await decryptAesGcm(kek, targetSlot.wrappedMek);

    const rawMekBytes = new Uint8Array(unwrappedRawStr.length);
    for (let i = 0; i < unwrappedRawStr.length; i++) {
      rawMekBytes[i] = unwrappedRawStr.charCodeAt(i);
    }

    const mekKey = await importRawKey(rawMekBytes.slice(0, 32));
    await unlockVaultWithMEK(mekKey);

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Passkey assertion error';
    return { success: false, error: msg };
  }
}
