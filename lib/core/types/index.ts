// Core types for zup isomorphic engine

export interface KeychainSlot {
  id: string; // UUID v4
  type: "password" | "passkey";
  credentialId?: string; // Base64URL string for WebAuthn
  wrappedMek: string; // Base64(12-byte IV + Ciphertext + Tag)
  salt?: string; // Base64 salt (Argon2id/PBKDF2)
  params: {
    algo: "Argon2id" | "WebAuthn-PRF" | "WebAuthn-Fallback";
    memory?: number;
    iterations?: number;
    parallelism?: number;
    prfEnabled?: boolean;
    rpId?: string;
  };
  createdAt: number;
  syncedAt?: number; // Cloud sync anchor
}

export interface EncryptedIdentity {
  pubkey: string; // Hex string (Primary Key)
  npub: string;
  wrappedNsec?: string; // Base64(12-byte IV + Ciphertext + Tag) via MEK
  isExternalSigner: boolean; // True if using NIP-07 (window.nostr)
  label: string; // Human-readable persona handle
  relays: string[]; // Specific write/read bootstrap overrides
  createdAt: number;
  updatedAt: number;
  syncedAt?: number;
}

export interface LocalEvent {
  id: string; // Event Hash (Hex)
  pubkey: string; // Author Hex
  kind: number; // 1 (text), 30023 (long-form), 0 (metadata), 7 (reaction)
  created_at: number;
  tags: string[][];
  content: string;
  sig: string; // Schnorr 64-byte hex signature
  first_seen_at: number;
  relay_source: string;
}

export interface UserTelemetry {
  id: string; // UUID
  pubkey: string; // Identity context
  eventId?: string; // Related event
  targetPubkey?: string; // Related author
  interactionType: "dwell" | "click" | "expand_thread" | "share" | "zap_intent" | "inspect_raw";
  dwellTimeMs?: number;
  metadata?: Record<string, unknown>; // Additional signals (tags clicked, scroll depth)
  timestamp: number;
  syncedAt?: number;
}

export interface ProfileMetadata {
  pubkey: string;
  content: string; // Raw kind 0 JSON payload
  name?: string;
  display_name?: string;
  picture?: string;
  nip05?: string;
  about?: string;
  updated_at: number;
  cached_at: number;
}

export interface RelayStatus {
  url: string;
  status: "connected" | "connecting" | "disconnected" | "error";
  latencyMs: number;
  eventsReceived: number;
  lastPing: number;
}

export interface UnlockedSession {
  isUnlocked: boolean;
  masterKey: CryptoKey | null;
  activePubkey: string | null;
  activePrivkeyHex: string | null;
  activeIdentity: EncryptedIdentity | null;
}
