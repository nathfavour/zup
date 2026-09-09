import { KylrixOAuthSession, KylrixProfile, SyncOrigin } from '../types';
import { bytesToHex, generateRandomBytes } from './crypto';

const KYLRIX_OAUTH_CONFIG = {
  clientId: 'zup-nostr-client',
  authEndpoint: 'https://www.kylrix.space/oauth/consent',
  tokenEndpoint: 'https://www.kylrix.space/api/v1/oauth/token',
  userInfoEndpoint: 'https://www.kylrix.space/api/v1/me',
  scope: 'openid profile email notes:read profile:read',
};

const STORAGE_KEYS = {
  SESSION: 'zup_kylrix_oauth_session_v1',
  PKCE_VERIFIER: 'zup_pkce_verifier',
  CSRF_STATE: 'zup_oauth_csrf_state',
};

// Base64URL helper
function base64UrlEncode(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generates an RFC 7636 compliant PKCE code_verifier and code_challenge
 */
export async function generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string; state: string }> {
  const randomBytes = generateRandomBytes(32);
  const codeVerifier = base64UrlEncode(randomBytes.buffer as ArrayBuffer);

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const codeChallenge = base64UrlEncode(digest);

  const state = bytesToHex(generateRandomBytes(16));

  // Store transient verifier & state
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(STORAGE_KEYS.PKCE_VERIFIER, codeVerifier);
    sessionStorage.setItem(STORAGE_KEYS.CSRF_STATE, state);
  }

  return { codeVerifier, codeChallenge, state };
}

/**
 * Constructs the official OAuth 2.1 PKCE authorization consent URL
 */
export async function buildKylrixAuthUrl(redirectUri?: string): Promise<string> {
  const { codeChallenge, state } = await generatePKCE();
  const callbackUri = redirectUri || (typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000');

  const params = new URLSearchParams({
    client_id: KYLRIX_OAUTH_CONFIG.clientId,
    redirect_uri: callbackUri,
    response_type: 'code',
    scope: KYLRIX_OAUTH_CONFIG.scope,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });

  return `${KYLRIX_OAUTH_CONFIG.authEndpoint}?${params.toString()}`;
}

/**
 * Manages the persistent Kylrix OAuth 2.1 session
 */
class KylrixOAuthManager {
  private session: KylrixOAuthSession = {
    isConnected: false,
    syncOrigin: 'local_only',
  };
  private listeners = new Set<(session: KylrixOAuthSession) => void>();

  constructor() {
    this.loadSession();
  }

  private loadSession(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (stored) {
        this.session = JSON.parse(stored);
      }
    } catch {
      this.session = { isConnected: false, syncOrigin: 'local_only' };
    }
  }

  private saveSession(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(this.session));
    } catch {
      // Ignore
    }
    this.notify();
  }

  public subscribe(listener: (session: KylrixOAuthSession) => void): () => void {
    this.listeners.add(listener);
    listener(this.session);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.session));
  }

  public getSession(): KylrixOAuthSession {
    return this.session;
  }

  public isConnected(): boolean {
    return this.session.isConnected;
  }

  /**
   * Completes OAuth exchange with code and sets session
   */
  public async completeExchange(params: {
    accessToken: string;
    refreshToken: string;
    idToken?: string;
    expiresIn?: number;
    profile: KylrixProfile;
    linkedPubkey?: string;
    syncOrigin?: SyncOrigin;
  }): Promise<void> {
    this.session = {
      isConnected: true,
      accessToken: params.accessToken,
      refreshToken: params.refreshToken,
      idToken: params.idToken,
      expiresAt: Date.now() + (params.expiresIn || 3600) * 1000,
      profile: params.profile,
      linkedPubkey: params.linkedPubkey,
      linkedAt: Date.now(),
      nip78Published: true,
      syncOrigin: params.syncOrigin || 'kylrix',
    };
    this.saveSession();
  }

  /**
   * Simulates OAuth 2.1 PKCE exchange for testing/preview environments
   * Allows instant verification of "Sign in with Kylrix", profile linking, and bidirectional sync
   */
  public async simulateSignIn(customEmail?: string, customName?: string, activePubkey?: string): Promise<KylrixProfile> {
    const userId = `kylrix_usr_${bytesToHex(generateRandomBytes(6))}`;
    const name = customName?.trim() || 'Kylrix Sovereign';
    const email = customEmail?.trim() || 'sovereign@kylrix.space';
    const avatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${userId}`;

    const profile: KylrixProfile = {
      userId,
      name,
      email,
      avatar,
      nostr_pubkey: activePubkey,
      active_identity: activePubkey,
    };

    await this.completeExchange({
      accessToken: `jwt_kylrix_acc_${bytesToHex(generateRandomBytes(16))}`,
      refreshToken: `jwt_kylrix_ref_${bytesToHex(generateRandomBytes(16))}`,
      idToken: `jwt_kylrix_id_${bytesToHex(generateRandomBytes(16))}`,
      expiresIn: 7200,
      profile,
      linkedPubkey: activePubkey,
      syncOrigin: 'kylrix',
    });

    return profile;
  }

  /**
   * Safe Disconnect:
   * Clears OAuth tokens and ends remote session.
   * CRITICAL GUARANTEE: Never touches or deletes local Nostr keys or local RxDB notes!
   * Simply resets syncOrigin to 'local_only'.
   */
  public disconnect(): void {
    this.session = {
      isConnected: false,
      syncOrigin: 'local_only',
    };
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
    }
    this.notify();
  }

  /**
   * Builds the NIP-78 (Kind 30078) Application-Specific Data payload
   * for binding the Kylrix identity on Nostr relays
   */
  public buildNIP78BindingEventPayload(pubkeyHex: string): {
    kind: number;
    tags: string[][];
    content: string;
  } {
    return {
      kind: 30078,
      tags: [
        ['d', 'kylrix:identity_binding'],
        ['p', pubkeyHex],
        ['app', 'zup'],
      ],
      content: JSON.stringify({
        kylrix_user_id: this.session.profile?.userId || 'anonymous',
        linked_at: Date.now(),
        zup_version: '1.0.0',
        sync_origin: this.session.syncOrigin,
      }),
    };
  }
}

export const kylrixOAuth = new KylrixOAuthManager();
