# AGENTS.md: Development & Architectural Directives for `zup`

This document outlines core agentic principles, invariant validations, and code standards for developing within the **zup** ecosystem (`getzup.vercel.app`). Any autonomous agent, LLM engineer, or contributor working on this codebase must adhere strictly to these rules.

---

## 1. Prime Directives & Invariants

1. **Zero-Knowledge Root Boundary**:
   - `nsec` (private key) and the Master Encryption Key (MEK) **MUST NEVER** be logged, sent over any network socket, stored in `localStorage`, or dumped to disk in unencrypted format.
   - All persistence into Dexie `identities` or external sync channels must be wrapped using AES-GCM (256-bit) with a cryptographically randomized 12-byte initialization vector (IV).
2. **Ephemeral Volatile Signer**:
   - In-memory keys are held strictly in memory closures or volatile memory bridges.
   - A lock event or 10-minute idle threshold must trigger an explicit zeroing operation of cryptographic buffers.
3. **Bandwidth Zero-Waste Mandate**:
   - Never automatically load external media (images, videos, audio) or trigger prefetching requests.
   - External media must render as an unhydrated tactile placeholder displaying domain metadata, byte estimates, and requiring an explicit user click to load.
   - Cache `kind: 0` user profiles locally for 7 days before issuing relay requests.
4. **Single-Socket Multiplexing**:
   - WebSockets to Nostr relays (`nos.lol`, `relay.damus.io`, `relay.primal.net`, `nostr.wine`) must be pooled and multiplexed. Redundant sockets per origin are strictly prohibited.
5. **OpenBricks 4.0 Design Integrity**:
   - Dark-only: Outer shell `#161412` (deep ash), component cards & input wells strictly `#000000` (pitch black).
   - High-contrast solid outlines (`border border-white/20`, active section highlight colors like `#10B981` Emerald for Vault, `#EC4899` Pink for Feed, `#6366F1` Indigo for Sync/CLI).
   - Crisp white typography (`#FFFFFF`), hierarchy expressed via size and weight, zero unboxed pill badges or low-contrast gray text.
   - Inline segmented controls over nested modals; desktop right sidebar (`420px–520px`) and mobile 60vh drawer.

---

## 2. Directory Architecture

```
/
├── ARCHITECTURE.md            # Technical specification & system invariants
├── AGENTS.md                  # This file: Agentic instructions & code directives
├── app/                       # Next.js App Router (RSC exclusively for shell/metadata)
│   ├── globals.css            # Tailwind CSS v4 styling & dark theme variables
│   ├── layout.tsx             # Root layout with dark HTML class and metadata
│   └── page.tsx               # Main workspace entry point assembling tactile UI
├── components/
│   ├── feed/                  # Technical feeds, kind 1 / 30023 dispatches, click-to-load media
│   ├── vault/                 # Vault manager, passkey/password unlocking, identity switcher
│   ├── relays/                # Relay pool status, latency monitor, manual relay connector
│   ├── telemetry/             # Local behavior visualizer, affinity graphs, dwell inspector
│   ├── sync/                  # Turso/LibSQL delta replication engine & sync diff viewer
│   ├── cli/                   # Interactive @zup/cli terminal emulator for keyboard operators
│   ├── modals/                # Tactile drawer / right sidebar inspector (Inspect Raw, Event Signer)
│   └── ui/                    # Reusable OpenBricks 4.0 tactile primitives (SegmentedControl, Button, Card)
├── lib/
│   ├── core/
│   │   ├── crypto/            # AES-GCM, PBKDF2/Argon2id, Schnorr signature and event ID verification
│   │   ├── nostr/             # Canonical event serialization, Bech32 npub/nsec converters, filter matchers
│   │   └── types/             # KeychainSlot, EncryptedIdentity, LocalEvent, UserTelemetry
│   ├── db/                    # Dexie instance `zup_engine_v1`, seeds, live hooks
│   ├── state/                 # Active identity pointer, vault unlock status, UI view states
│   └── workers/               # Relay multiplexer, connection pooling, batch ingestion pipeline
└── public/
    └── relay-worker.js        # SharedWorker background multiplexer
```

---

## 3. Cryptographic Pipeline Directives

- **Key Wrapping**:
  `wrapped = Base64( IV [12 bytes] || Ciphertext || AuthTag [16 bytes] )`
- **Canonical Nostr Serialization**:
  `JSON.stringify([0, pubkey, created_at, kind, tags, content])`
  Serialized in UTF-8 without whitespace before hashing via SHA-256 to produce the canonical 32-byte event ID.
- **Roundtrip Self-Verification**:
  Before writing any encrypted identity to IndexedDB, an agent must execute a test decryption in memory to guarantee zero data loss.

---

## 4. Interaction Telemetry Protocol

All client actions must be tracked into `db.telemetry` using local-first queries:
- `dwell`: Filter out fast flits (<800ms). Track deep technical reading when viewport visibility is >75%.
- `inspect_raw`: Logged whenever an engineer opens the cryptographic inspector.
- `expand_thread`: Logged when following discussion roots.
- All telemetry records are stored in Dexie and can be inspected or cleared by the user at any time.

---

## 5. Verification Commands

- Verification: Run `npm run build` or `compile_applet`.
- Syntax & types: `npm run lint`.
- No mock stubs or dead clicks: Every button, command, or interactive control must have functional logic.
