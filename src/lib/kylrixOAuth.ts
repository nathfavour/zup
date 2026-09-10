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
   * Exchanges an authorization code with the PKCE code_verifier for access and refresh tokens
   */
  public async exchangeCode(code: string, redirectUri: string): Promise<KylrixProfile | null> {
    if (typeof window === 'undefined') return null;

    const codeVerifier = sessionStorage.getItem(STORAGE_KEYS.PKCE_VERIFIER);
    if (!codeVerifier) {
      console.warn('No PKCE code_verifier found in sessionStorage');
      return null;
    }

    try {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: KYLRIX_OAUTH_CONFIG.clientId,
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      });

      const tokenRes = await fetch(KYLRIX_OAUTH_CONFIG.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.warn('OAuth token exchange failed:', tokenRes.status, errText);
        return null;
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;
      const expiresIn = tokenData.expires_in || 3600;
      const idToken = tokenData.id_token;

      // Fetch user profile from /api/v1/me
      let profile: KylrixProfile = {
        userId: 'kylrix_user',
        name: 'Kylrix Peer',
      };

      try {
        const userRes = await fetch(KYLRIX_OAUTH_CONFIG.userInfoEndpoint, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          profile = {
            userId: userData.$id || userData.id || userData.userId || 'kylrix_user',
            name: userData.name || userData.displayName || 'Kylrix Sovereign',
            email: userData.email,
            avatar: userData.avatarUrl || userData.avatar,
            nostr_pubkey: userData.nostr_pubkey || userData.active_identity,
            active_identity: userData.active_identity || userData.nostr_pubkey,
          };
        }
      } catch (err) {
        console.warn('Could not fetch user profile from /api/v1/me:', err);
      }

      // Clean up PKCE transient state
      sessionStorage.removeItem(STORAGE_KEYS.PKCE_VERIFIER);
      sessionStorage.removeItem(STORAGE_KEYS.CSRF_STATE);

      await this.completeExchange({
        accessToken,
        refreshToken,
        idToken,
        expiresIn,
        profile,
        syncOrigin: 'kylrix',
      });

      return profile;
    } catch (err) {
      console.error('Error during OAuth code exchange:', err);
      return null;
    }
  }

  /**
   * Automatically checks URL for OAuth callback parameters (?code=&state=)
   * Exchanges code and cleans up the browser query string
   */
  public async handleAuthCallback(): Promise<KylrixProfile | null> {
    if (typeof window === 'undefined') return null;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (!code) return null;

    const storedState = sessionStorage.getItem(STORAGE_KEYS.CSRF_STATE);
    if (storedState && state && storedState !== state) {
      console.warn('OAuth state mismatch: possible CSRF');
      return null;
    }

    const redirectUri = window.location.origin + window.location.pathname;
    const profile = await this.exchangeCode(code, redirectUri);

    // Clean URL without triggering page reload
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);

    return profile;
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
