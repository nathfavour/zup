# ARCHITECTURE.md: zup

Technical specification and architectural invariants for **zup** (`getzup.vercel.app`), an ultra-lean, low-bandwidth Nostr web client and workspace ecosystem tailored for engineers, systems thinkers, and technical operators.

---

## 1. Monorepo Topology (`pnpm-workspace.yaml`)

```
.
├── packages/
│   ├── cli/                   # Companion CLI (@zup/cli)
│   │   ├── src/
│   │   │   ├── commands/      # tail, publish, sync, identity, inspect
│   │   │   ├── daemon/        # Local background relay aggregator & IPC
│   │   │   └── index.ts
│   │   └── package.json
│   ├── core/                  # Headless protocol & crypto primitives
│   │   ├── src/
│   │   │   ├── crypto/        # MEK, Argon2id, AES-GCM, Schnorr WASM
│   │   │   ├── nostr/         # NIP parsers, event validation, filters
│   │   │   └── types/         # Universal event, user, and telemetry models
│   │   └── package.json
│   └── db-sync/               # Local-first DB schema & cloud synchronization
│       ├── src/
│       │   ├── schema/        # Dexie & SQLite/Turso isomorphic definitions
│       │   ├── sync-engine/   # Delta replication, conflict-free state resolution
│       │   └── index.ts
│       └── package.json
├── apps/
│   └── web/                   # Next.js Application (getzup.vercel.app)
│       ├── app/               # Next.js App Router (RSC exclusively for metadata/OG)
│       ├── components/        # Keyboard-dense UI primitives (shadcn, cmdk, virtualized feeds)
│       ├── hooks/             # Reactive query hooks via Dexie useLiveQuery
│       ├── lib/
│       │   ├── state/         # Zustand session states & active account switcher
│       │   └── workers/       # SharedWorker relay manager & session memory bridge
│       ├── public/
│       │   ├── relay-worker.js    # SharedWorker: Multiplexed WebSockets + De-duplication
│       │   └── session-worker.js  # Service Worker: Ephemeral in-memory MEK bridge
│       └── package.json
├── pnpm-workspace.yaml
└── package.json
```

---

## 2. Core Architectural Invariants

* **Invariant 1: Absolute Local Zero-Knowledge Root.** Raw `nsec` and the 256-bit Master Encryption Key (MEK) never persist in unencrypted state across disk, network, or server storage.
* **Invariant 2: Singular Vault, Multi-Identity Encapsulation.** One Master Password/Passkey pair unlocks one persistent vault MEK. That single MEK decrypts all identities (`identities` table). Switching active personas is an in-memory pointer change that leaves the root MEK intact.
* **Invariant 3: Single Socket Multiplexing via SharedWorker.** All browser tabs communicate with a single `SharedWorker`. WebSockets to relays are opened once per origin, preventing multi-tab connection floods, duplicate downloads, and rate limits.
* **Invariant 4: Asynchronous, Air-Gapped Signature Ingestion.** Relay ingestion, Schnorr signature verification, and deduplication run off the main thread. React views are purely passive, reactive consumers of Dexie IndexedDB tables.
* **Invariant 5: Bandwidth Zero-Waste Mandate.** Default to click-to-load for all external media. Batch `kind: 0` profile lookups through local storage lookups before querying relays, and scope queries with strict incremental `since` timestamps.
* **Invariant 6: Upstream Cloud & Turso Sync Readiness.** Every local table schema must support a dual-engine architecture: local-first execution via Dexie, with bidirectional, delta-tracked replication to remote databases (e.g., Turso via LibSQL) without restructuring primary models.

---

## 3. Cryptographic Pipeline & Key Topology

```
                   ┌──────────────────────────────────────────────┐
                   │           Master Password (User)             │
                   └──────────────────────┬───────────────────────┘
                                          │ Argon2id (64MB, 3 it, 4 p)
                                          ▼
┌───────────────────────────┐      ┌──────────────────────────────────┐
│ WebAuthn Passkey (PRF)    │      │  Password Key Encryption Key     │
│ Hardware-derived Seed     │      │            (KEK_pass)            │
└─────────────┬─────────────┘      └──────────────────┬───────────────┘
              │                                       │
              ▼                                       ▼
┌───────────────────┐                   ┌───────────────────┐
│  Keychain Slot:   │                   │  Keychain Slot:   │
│   Type: passkey   │                   │   Type: password  │
│   Wraps MEK       │                   │   Wraps MEK       │
└─────────┬─────────┘                   └─────────┬─────────┘
          │                                       │
          └───────────────────┬───────────────────┘
                              ▼ Unwraps
┌───────────────────────────────────────┐
│      Master Encryption Key (MEK)      │
│       256-bit AES-GCM (In-Memory)     │
└───────────────────┬───────────────────┘
                    │
┌───────────────────┴─────────────────────────────┐
│ Decrypts (AES-GCM-256)                          │ Decrypts (AES-GCM-256)
▼                                                 ▼
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│ Identity 1: Personal (Active)   │       │ Identity 2: Anonymous / Agent   │
│ - Wrapped nsec                  │       │ - Wrapped nsec                  │
│ - Decrypted nsec -> Signer RAM  │       │ - Decrypted nsec on demand      │
└─────────────────────────────────┘       └─────────────────────────────────┘
```

### 3.1 Key Derivation & Wrapping Specs
* **Argon2id KDF**: 65,536 KB Memory, 3 Iterations, 4 Parallelism lanes, 32-byte binary salt, 32-byte output. Zero legacy fallback algorithm paths.
* **WebAuthn PRF**: Level 3 PRF extension evaluating `zup-unified-salt-v1`. Non-PRF platforms fallback to deterministic client-side digest `SHA-256(credentialId + userId)`.
* **In-Memory Roundtrip Validation**: Any key wrapping operation must successfully decrypt and match the raw key in memory before the ciphertext is committed to Dexie.

### 3.2 Ephemeral Session Preservation
* **Volatile RAM Hand-off**: On page reload, an in-memory `MessageChannel` transfers the unsealed MEK bytes to the active Service Worker heap (`session-worker.js`).
* **Hard Eviction**: An idle inactivity timer (10 minutes) or explicit lock event issues a memory purge, zeroing the MEK across all script contexts.

---

## 4. Local-First Database Architecture (Dexie.js)

Database Name: `zup_engine_v1`

### 4.1 Schema Definition
```typescript
interface KeychainSlot {
  id: string;                         // UUID v4
  type: "password" | "passkey";
  credentialId?: string;              // Base64URL string for WebAuthn
  wrappedMek: string;                 // Base64(12-byte IV + Ciphertext + Tag)
  salt?: string;                      // Base64 salt (Argon2id)
  params: {
    algo: "Argon2id" | "WebAuthn-PRF" | "WebAuthn-Fallback";
    memory?: number;
    iterations?: number;
    parallelism?: number;
    prfEnabled?: boolean;
    rpId?: string;
  };
  createdAt: number;
  syncedAt?: number;                  // Cloud sync anchor
}

interface EncryptedIdentity {
  pubkey: string;                     // Hex string (Primary Key)
  npub: string;
  wrappedNsec?: string;               // Base64(12-byte IV + Ciphertext + Tag) via MEK
  isExternalSigner: boolean;          // True if using NIP-07 (window.nostr)
  label: string;                      // Human-readable persona handle
  relays: string[];                   // Specific write/read bootstrap overrides
  createdAt: number;
  updatedAt: number;
  syncedAt?: number;
}

interface LocalEvent {
  id: string;                         // Event Hash (Hex)
  pubkey: string;                     // Author Hex
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
  sig: string;
  first_seen_at: number;
  relay_source: string;
}

interface UserTelemetry {
  id: string;                         // Auto-increment / UUID
  pubkey: string;                     // Identity context
  eventId?: string;                   // Related event
  targetPubkey?: string;              // Related author
  interactionType: "dwell" | "click" | "expand_thread" | "share" | "zap_intent" | "inspect_raw";
  dwellTimeMs?: number;
  metadata?: Record<string, unknown>; // Additional signals (tags clicked, scroll depth)
  timestamp: number;
  syncedAt?: number;
}

interface ProfileMetadata {
  pubkey: string;
  content: string;                    // Raw kind 0 JSON payload
  name?: string;
  display_name?: string;
  picture?: string;
  nip05?: string;
  updated_at: number;
  cached_at: number;
}
```

### 4.2 Dexie Stores Config

```typescript
db.version(1).stores({
  keychain: "id, type, credentialId, syncedAt",
  identities: "pubkey, isExternalSigner, updatedAt, syncedAt",
  events: "id, pubkey, kind, created_at, [kind+created_at]",
  telemetry: "id, pubkey, eventId, interactionType, timestamp, syncedAt",
  profiles: "pubkey, cached_at"
});
```

---

## 5. Active Account & Session State Routing

Account persistence does not depend on the encryption state. Active state pointers are isolated to avoid accidental vault re-locking.

```
LocalStorage:
  └── "zup:active_pubkey" -> "4f8a...3b21" (Plaintext string pointer)

Zustand Store (`lib/state/session.ts`):
  ├── activePubkey: string | null
  ├── isUnlocked: boolean (True only when MEK is held in volatile memory)
  ├── availableIdentities: EncryptedIdentity[]
  └── setActiveIdentity(pubkey: string):
        1. Validate target pubkey exists in `db.identities`.
        2. Set "zup:active_pubkey" in LocalStorage.
        3. Switch in-memory Signer pointer to target identity's decrypted secret key.
        4. Invalidate global event feed subscriptions for the new author scope.
```

---

## 6. Realtime Network & SharedWorker Engine

```
Tab 1 (Feed) ────────┐
Tab 2 (Thread) ──────┼──► SharedWorker (relay-worker.js)
Tab 3 (Profile) ─────┘           │
                                 ├── Connection Pool Manager
                                 │   ├── wss://nos.lol
                                 │   ├── wss://relay.damus.io
                                 │   ├── wss://relay.primal.net
                                 │   └── wss://nostr.wine (NIP-50 Search)
                                 │
                                 ├── Subscription Multiplexer & Deduplicator
                                 │   └── Bloom Filter / In-Memory LRU (Seen Event IDs)
                                 │
                                 └── Batch Pipeline (Dispatches to IndexedDB every 100ms)
                                     └── Dexie.js (Bulk Ingestion)
```

1. **Multiplexed Pipelines:** Tabs emit `SUBSCRIBE({ subId, filters, relayUrl })` over MessagePort. The SharedWorker tracks subscriber reference counts. If multiple tabs request the same filters, only one REQ is issued over the shared socket.
2. **Deterministic Teardown:** When a tab unmounts or navigates away, it fires `UNSUBSCRIBE({ subId })`. When active port references hit zero, the worker pushes `CLOSE` upstream to the relay.
3. **Data Throttling (The Bandwidth Gate):**
* **Profile Queries:** If `db.profiles.get(pubkey)` exists and is younger than 7 days, skip network queries entirely. Uncached profiles are grouped and fetched in single batch subscriptions (`limit: 100`) on a single backbone relay.
* **Feed Catch-Up:** Every subscription passes `"since": latest_cached_timestamp` to prevent downloading existing events.
* **Media Interception:** Media URLs (`.png`, `.jpg`, `.mp4`) are stripped from automatic browser fetching; the UI displays text tokens and dimension metadata until a user clicks to hydrate.

---

## 7. Interaction Telemetry & Behavior Engine

`zup` continuously logs operational telemetry directly to the local `telemetry` Dexie store to profile engagement without exposing user data to third-party analytics trackers.

```
                  ┌──────────────────────────────────────────────┐
                  │               DOM Interceptors               │
                  │   - IntersectionObserver (Dwell Time)        │
                  │   - Click Listeners (Inspect, Copy, Links)   │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │           Telemetry Buffer Engine            │
                  │   - Debounces scroll passes (< 800ms ignored)│
                  │   - Records focus duration on technical posts│
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │         Dexie Local Table: `telemetry`       │
                  │   - Fully inspectable by user in UI          │
                  │   - Basis for local ML/heuristic feed ranking│
                  └──────────────────────────────────────────────┘
```

* **Signal Set:**
* `dwell`: Duration viewport contains >75% of an event box (tracks deep technical reading vs. fast scrolling).
* `expand_thread`: Tracking depth traversed through thread hierarchies.
* `inspect_raw`: User clicked to view raw JSON/Schnorr signature parameters (strong affinity signal for technical events).
* `tag_affinity`: Dynamic weighting of topics (`#linux`, `#go`, `#distributed-systems`) based on dwell and copy actions.

---

## 8. Cloud Integration & Turso Sync Architecture

The system is architected for zero-downtime integration of remote database sync (Turso / LibSQL edge instances) and social authentication (Google / GitHub OAuth).

```
┌─────────────────────────────────┐            ┌──────────────────────────────────┐
│      Dexie.js (Client Edge)     │            │    Remote Database (Turso Edge)  │
│  - Tracks `syncedAt` vs local   │ ◄────────► │  - Master Replica via LibSQL     │
│    `updatedAt` / `timestamp`    │ Sync Loop  │  - Holds Encrypted Keychain Rows │
│  - Conflict: Last-Write-Wins    │            │  - Holds Sync Telemetry Tables   │
└─────────────────────────────────┘            └──────────────────────────────────┘
```

* **Sync Mechanics:**
* Only encrypted blobs are synced: `wrappedMek`, `wrappedNsec`, encrypted profiles, and aggregated telemetry.
* Social Login (Google/GitHub) acts strictly as an **identity verification and remote bucket coordinator**. A Google/GitHub authentication event retrieves an encrypted remote vault record from Turso, but cannot decrypt the MEK without the user's Master Password or Passkey.
* **Isomorphic Schema Guarantees:** Every table defined in Section 4 maps 1:1 to standard SQL DDL compatible with LibSQL/SQLite for zero-friction schema migrations.

---

## 9. Monorepo Package Integration: `@zup/cli`

The companion CLI package (`packages/cli`) shares `@zup/core` and `@zup/db-sync` dependencies to maintain absolute runtime compatibility:

* **Command Scope:**
* `zup identity list`: Lists local pubkeys and reports active identity state.
* `zup identity switch <pubkey|label>`: Swaps the active identity pointer.
* `zup tail --kinds 1,30023`: Connects to configured relays and streams real-time technical posts directly to stdout.
* `zup publish "content" --sign`: Reads wrapped identity, unseals via master password input or local keyring, signs Schnorr event, and broadcasts to configured relays.
* `zup sync --turso`: Triggers an on-demand delta sync between local state and the configured Turso instance.
