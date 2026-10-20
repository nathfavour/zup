# AGENTS.md: Development & Architectural Directives for `zup`

This document outlines core agentic principles, invariant validations, domain skills, and code standards for developing within the **zup** ecosystem (`getzup.vercel.app`). Any autonomous agent, LLM engineer, or contributor working on this codebase must adhere strictly to these rules.

---

## 1. Modular Agent Skills Directory (`.agents/skills/`)

Autonomous agents working on specific subsystems MUST read and apply the domain skill specifications located in `.agents/skills/`:

| Subsystem / Domain | Skill File | Core Directive |
|:---|:---|:---|
| **Cryptography & Vault** | `.agents/skills/nostr-crypto.md` | Zero-knowledge root, Argon2id/AES-GCM key wrapping, BIP-340 Schnorr signatures, RAM zeroing |
| **Bandwidth & Media** | `.agents/skills/bandwidth-gate.md` | Click-to-load placeholders, 7-day profile cache, incremental `since` filter pagination |
| **UI Design System** | `.agents/skills/tactile-ui.md` | OpenBricks 4.0 dark tactile theme, `#161412` shell, `#000000` cards, pure white typography |
| **Local Telemetry** | `.agents/skills/telemetry-engine.md` | Local-first Dexie telemetry, dwell tracking (>75% visibility >800ms), zero third-party leak |
| **Cloud Sync** | `.agents/skills/turso-sync.md` | LibSQL/Turso edge replication, encrypted blob sync, Last-Write-Wins (LWW) conflict resolution |
| **Companion CLI** | `.agents/skills/cli-shell.md` | `@zup/cli` terminal emulator, IPC execution against local IndexedDB, command reference |

---

## 2. Core Architectural Directives & Invariants

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
   - WebSockets to Nostr relays (`nos.lol`, `relay.damus.io`, `relay.primal.net`, `nostr.wine`) must be pooled and multiplexed via `public/relay-worker.js`. Redundant sockets per origin are strictly prohibited.
5. **OpenBricks 4.0 Design Integrity**:
   - Dark-only: Outer shell `#161412` (deep ash), component cards & input wells strictly `#000000` (pitch black).
   - High-contrast solid outlines (`border border-white/20`, active section highlight colors like `#10B981` Emerald for Vault, `#EC4899` Pink for Feed, `#6366F1` Indigo for Sync/CLI).
   - Crisp white typography (`#FFFFFF`), hierarchy expressed via size and weight, zero unboxed pill badges or low-contrast gray text.
   - Navigation: Desktop left sidebar, mobile bottom navbar, right sidebar drawers (`InspectRawSidebar`).

---

## 3. Directory Architecture

```
.
├── ARCHITECTURE.md            # Technical specification & system invariants
├── AGENTS.md                  # Autonomous agent development directives & skill mapping
├── ROADMAP.md                 # Project vision, invariant status, & execution phases
├── .agents/
│   └── skills/                # Domain-specific skill files
│       ├── nostr-crypto.md    # Cryptography & key lifecycle
│       ├── bandwidth-gate.md  # Low-bandwidth media & caching policies
│       ├── tactile-ui.md      # OpenBricks 4.0 design system
│       ├── telemetry-engine.md# Local-first behavioral analytics
│       ├── turso-sync.md      # Zero-knowledge cloud delta replication
│       └── cli-shell.md       # @zup/cli terminal emulator & IPC commands
├── app/                       # Next.js App Router
│   ├── globals.css            # Tailwind CSS v4 dark theme styling
│   ├── layout.tsx             # Root layout shell
│   └── page.tsx               # Main workspace entry point (Left Sidebar + Viewport + Drawer)
├── components/
│   ├── cli/                   # Companion @zup/cli terminal emulator (CliView.tsx)
│   ├── feed/                  # Technical feeds, kind 1 & 30023 dispatches, click-to-load media
│   ├── vault/                 # Vault manager, Argon2id KEK derivation, identity switcher
│   ├── relays/                # Relay pool status, latency monitor, manual connector
│   ├── telemetry/             # Local behavior visualizer, affinity graphs, dwell inspector
│   ├── sync/                  # Turso/LibSQL delta replication engine & sync diff viewer
│   ├── modals/                # Tactile drawer / right sidebar inspector (Inspect Raw, Connect)
│   └── ui/                    # Reusable OpenBricks 4.0 tactile primitives
├── lib/
│   ├── cli/                   # @zup/cli IPC execution engine (engine.ts)
│   ├── core/                  # Cryptography, Nostr NIP serialization, BIP-340 Schnorr
│   ├── db/                    # Dexie instance `zup_engine_v1`, seeds, helpers
│   ├── state/                 # Active identity pointer, volatile vault unlock state
│   ├── sync/                  # Turso/LibSQL delta sync engine & zero-knowledge audit
│   └── workers/               # Relay multiplexer, connection pooling
└── public/
    └── relay-worker.js        # SharedWorker background WebSocket multiplexer
```

---

## 4. Cryptographic Pipeline Directives

- **Key Wrapping**:
  `wrapped = Base64( IV [12 bytes] || Ciphertext || AuthTag [16 bytes] )`
- **Canonical Nostr Serialization**:
  `JSON.stringify([0, pubkey, created_at, kind, tags, content])`
  Serialized in UTF-8 without whitespace before hashing via SHA-256 to produce the canonical 32-byte event ID.
- **Roundtrip Self-Verification**:
  Before writing any encrypted identity to IndexedDB, an agent must execute a test decryption in memory to guarantee zero data loss.

---

## 5. Interaction Telemetry Protocol

All client actions must be tracked into `db.telemetry` using local-first queries:
- `dwell`: Filter out fast flits (<800ms). Track deep technical reading when viewport visibility is >75%.
- `inspect_raw`: Logged whenever an engineer opens the cryptographic inspector.
- `expand_thread`: Logged when following discussion roots.
- All telemetry records are stored in Dexie and can be inspected or cleared by the user at any time.

---

## 6. Verification Commands

Before completing any task, an autonomous agent MUST execute:

```bash
# 1. Run unit test suite
bun test

# 2. Run ESLint code quality check
npm run lint

# 3. Verify Next.js production build succeeds
npm run build
```
