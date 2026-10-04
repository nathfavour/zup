# zup (`getzup.vercel.app`)

> **Ultra-lean, low-bandwidth Nostr web client and workspace ecosystem tailored for engineers, systems thinkers, and technical operators.**

`zup` is built from first principles for performance-conscious engineers who demand absolute cryptographic privacy, zero bandwidth waste, and high-density technical interfaces. It combines a local-first reactive database (**Dexie IndexedDB**) with single-socket multiplexed relay connections, hardware-backed/Argon2id vault encapsulation, and an in-browser companion CLI (`@zup/cli`).

---

## ⚡ Core Invariants

1. **Absolute Local Zero-Knowledge Root (Invariant 1)**
   Raw `nsec` (private key) and the 256-bit Master Encryption Key (MEK) **never** persist unencrypted across disk, network, or server storage. All IndexedDB records are wrapped via AES-GCM (256-bit) with randomized 12-byte IVs.
2. **Singular Vault, Multi-Identity Encapsulation (Invariant 2)**
   One Master Password or WebAuthn PRF passkey unseals one persistent vault MEK. That single key decrypts all personas. Switching active personas is an in-memory pointer swap (`localStorage["zup:active_pubkey"]`) that leaves the root MEK intact.
3. **Single-Socket Multiplexing via SharedWorker (Invariant 3)**
   All browser tabs route through a single connection pool (`public/relay-worker.js`). WebSockets to relays (`nos.lol`, `relay.damus.io`, `relay.primal.net`, `nostr.wine`) open once per origin, eliminating multi-tab connection floods, duplicate downloads, and rate limits.
4. **Asynchronous Signature Ingestion (Invariant 4)**
   Relay ingestion, Schnorr signature verification, and deduplication occur off the main thread. React views are purely passive, reactive consumers of Dexie IndexedDB tables.
5. **Bandwidth Zero-Waste Mandate (Invariant 5)**
   - External media (`.png`, `.jpg`, `.mp4`) never auto-load; unhydrated tactile placeholders display domain metadata and byte estimates until clicked.
   - User profiles (`kind: 0`) cache locally for 7 days before issuing network queries.
   - All relay queries pass incremental `since: latest_cached_timestamp` anchors.
6. **Upstream Cloud & Turso Sync Readiness (Invariant 6)**
   Every local table schema supports bidirectional, conflict-free Last-Write-Wins delta replication to remote LibSQL/Turso edge databases without exposing unencrypted keys.

---

## 🎨 OpenBricks 4.0 Tactile Design

- **Inverted Surfaces Architecture**:
  - Outer Shell & Panels: `#161412` (deep ash).
  - Component Cards, Input Wells, & List Tiles: Strictly `#000000` (pitch black).
- **Pure White Typography**:
  - Labels and copy use crisp `#FFFFFF` exclusively. Hierarchy is established through font weight (800/900 bold vs 500/600 medium), uppercase tracking (`tracking-wider`), and scale—never dimmed or washed-out grays.
- **High-Contrast Solid Boundaries**:
  - Formal 1px outlines (`border border-white/20`, hover `border-white/50`).
  - Active navigation highlights use semantic section colors:
    - **Vault / Signer**: Emerald `#10B981` (with subtle drop-glow)
    - **Feeds / Notes**: Pink `#EC4899`
    - **Relays / Network**: Amber `#F59E0B`
    - **Sync / Telemetry / CLI**: Indigo `#6366F1`
- **Navigation Architecture**:
  - **Desktop**: Persistent Left Sidebar (`w-60` to `w-64`) with direct access to Feeds, Vault, Relays, Telemetry, Cloud Sync, CLI Terminal, and a quick `+ Dispatch` button.
  - **Mobile**: Minimalist topbar and fixed tactile **Bottom Navigation Bar** with 5 key slots and a centralized highlighted `+` dispatch action button.
  - **Desktop Right Sidebar Drawer (`460px–560px`)**: Opens when inspecting raw cryptographic events or composing dispatches, keeping primary navigation unobstructed.

---

## 📁 Repository Structure

```
.
├── ARCHITECTURE.md            # Technical specification & system invariants
├── AGENTS.md                  # Autonomous agent development directives & code invariants
├── README.md                  # Project overview & architectural guide
├── app/
│   ├── globals.css            # Tailwind CSS v4 styling & dark theme variables
│   ├── layout.tsx             # Root layout with dark HTML class and metadata
│   └── page.tsx               # Main workspace entry point (Left Sidebar + Bottom Navbar)
├── components/
│   ├── feed/                  # Technical feeds, kind 1 & 30023 dispatches, click-to-load media
│   ├── vault/                 # Vault manager, Argon2id KEK derivation, identity switcher
│   ├── relays/                # Relay pool status, latency monitor, manual relay connector
│   ├── telemetry/             # Local behavior visualizer, affinity graphs, dwell inspector
│   ├── sync/                  # Turso/LibSQL delta replication engine & sync diff viewer
│   ├── cli/                   # Interactive @zup/cli terminal emulator for keyboard operators
│   ├── modals/                # Tactile drawer / right sidebar inspector (Inspect Raw, Event Signer)
│   └── ui/                    # Reusable OpenBricks 4.0 tactile primitives (SegmentedControl, ActionTile)
├── lib/
│   ├── core/
│   │   ├── crypto/            # AES-GCM-256, PBKDF2/Argon2id, BIP-340 Schnorr signing & Bech32
│   │   ├── nostr/             # Canonical event serialization, SHA-256 event ID, validation
│   │   └── types/             # KeychainSlot, EncryptedIdentity, LocalEvent, UserTelemetry
│   ├── db/                    # Dexie instance `zup_engine_v1`, seeds, live helpers
│   ├── state/                 # Active identity pointer, volatile vault unlock status, RAM zeroing
│   ├── sync/                  # Turso/LibSQL delta sync engine & zero-knowledge audit
│   └── workers/               # Relay multiplexer, connection pooling, batch ingestion
└── public/
    └── relay-worker.js        # SharedWorker background multiplexer
```

---

## 🛠️ Feature Modules

### 1. Technical Dispatches Feed (`Kind 1` & `Kind 30023`)
- Dense engineering stream with unboxed metadata (`·` typographic separators).
- Support for short technical notes and long-form markdown specifications (RFCs).
- Click-to-load bandwidth gate intercepting external CDN images.
- Real-time `IntersectionObserver` dwell time profiling (>75% visibility for >800ms).

### 2. Singular Cryptographic Vault & Personas
- **Argon2id / PBKDF2 KDF**: Derives Key Encryption Key (KEK) from Master Password.
- **Volatile In-Memory MEK**: Unwrapped key lives strictly in RAM closures.
- **Idle Memory Zeroing**: Purges keys from memory after 10 minutes of inactivity or explicit manual lock.
- **Roundtrip Validation**: In-memory test decryption before committing ciphertexts to IndexedDB.
- **Multi-Identity Persona Ring**: Instant pointer switching between personas without re-entering root passwords.

### 3. Multiplexed Relay Pool
- Live WebSocket pooling across `wss://nos.lol`, `wss://relay.damus.io`, `wss://relay.primal.net`, and `wss://nostr.wine`.
- Real-time latency tracking, ping monitors, reconnect backoff, and 100ms micro-batch Dexie ingestion.
- Custom relay addition and persistent connection status.

### 4. Cryptographic Inspector (`Inspect Raw`)
- Right sidebar drawer displaying exact canonical NIP-01 JSON serialization `[0, pubkey, created_at, kind, tags, content]`.
- Live SHA-256 event ID recalculation and verification.
- 64-byte BIP-340 Schnorr signature breakdown into 32-byte $r$ commitment and 32-byte $s$ scalar coordinates.
- Automatic logging of `inspect_raw` interactions to local telemetry.

### 5. Local Interaction Telemetry & Topic Affinity (Section 7)
- 100% private, client-side behavioral logging in Dexie `telemetry`.
- Synthesizes dynamic topic affinity rankings (`#distributed-systems`, `#linux`, `#nostr`, `#crypto`).
- JSON export for external local ML ranking models and instant database purge control.

### 6. Turso / LibSQL Cloud Delta Replication (Section 8)
- Bidirectional delta-sync between local Dexie tables and remote LibSQL edge nodes.
- Conflict-free Last-Write-Wins (LWW) state resolution.
- Real-time Zero-Knowledge boundary verification guaranteeing zero plaintext private keys ever leave the device.

### 7. Companion CLI Terminal (`@zup/cli`)
- Interactive in-app terminal shell supporting:
  ```bash
  zup identity list              # List personas and active pointer
  zup identity switch <target>   # Switch active signing identity
  zup tail --kinds 1,30023       # Stream recent technical events
  zup publish "<text>" --sign    # Sign and broadcast Schnorr event
  zup sync --turso               # Trigger LibSQL delta replication
  zup inspect <eventId>          # Verify canonical hash & Schnorr signature
  zup relays                     # Check connection pool latencies
  zup telemetry                  # Inspect local dwell & affinity metrics
  ```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|:---|:---|
| `Cmd+K` / `Ctrl+K` | Open global Command Palette |
| `1` | Switch to **Feeds** |
| `2` | Switch to **Vault & Identities** |
| `3` | Switch to **Relays** |
| `4` | Switch to **Telemetry** |
| `5` | Switch to **Cloud Sync** |
| `6` | Switch to **@zup/cli Shell** |
| `N` | Open **Compose Dispatch** drawer |
| `L` | **Lock Vault** (Immediate RAM zeroing) |
| `Esc` | Close active drawer or modal |

---

## 🚀 Development & Verification

```bash
# Install dependencies
npm install

# Start local Next.js dev server on port 3000
npm run dev

# Run ESLint validation
npm run lint

# Build production bundle
npm run build
```

---

## 📜 License & Compliance

Licensed under the MIT License. Designed and validated according to `ARCHITECTURE.md` and `AGENTS.md`.
