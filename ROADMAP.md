# 🗺️ zup Comprehensive Engineering Roadmap (`ROADMAP.md`)

> **Ultra-lean, low-bandwidth Nostr web client and workspace ecosystem tailored for engineers, systems thinkers, and technical operators.**

This document details the architectural vision, current development status, and upcoming execution milestones for **zup** (`getzup.vercel.app`) and its companion ecosystem packages.

---

## ⚡ Core Invariants & Architectural Boundaries

`zup` is engineered from first principles for performance-conscious developers who demand cryptographic privacy, minimal bandwidth consumption, and high-density technical interfaces.

1. **Absolute Local Zero-Knowledge Root**: Raw `nsec` and the 256-bit Master Encryption Key (MEK) never persist unencrypted across disk, network, or server storage.
2. **Singular Vault, Multi-Persona Encapsulation**: One Master Password or WebAuthn PRF passkey unseals one persistent vault MEK that decrypts all identity records in-memory.
3. **Single-Socket Multiplexing via SharedWorker**: Tab connections are pooled through a single background `SharedWorker` (`public/relay-worker.js`). Redundant WebSocket sockets per origin are strictly prohibited.
4. **Bandwidth Zero-Waste Mandate**: Media is click-to-load with byte & domain estimation; `kind: 0` profiles are cached locally for 7 days; queries pass incremental `since` timestamps.
5. **Strict Web Client / CLI Boundary**: The Next.js web application (`getzup.vercel.app`) provides a high-density web workspace. The CLI is packaged separately in `packages/cli` to be published to **npm** as `@zup/cli`. No terminal emulator UI or CLI pages exist within the web application.

---

## 📅 Roadmap Execution Phases

### Phase 1: Zero-Knowledge Cryptographic Vault & Persona Manager
- [x] **Argon2id KDF & PBKDF2 Key Encryption Key (KEK) derivation** (`lib/core/crypto`)
- [x] **WebAuthn Passkey (PRF extension & deterministic fallback)** integration
- [x] **In-memory Master Encryption Key (MEK) unsealing & roundtrip self-verification**
- [x] **Multi-Persona identity ring pointer switching** (`zup:active_pubkey`)
- [x] **Ephemeral volatile RAM key zeroing** on idle timeout (10 mins) or explicit manual lock
- [ ] **Hardware-backed key import & WebAuthn PRF Level 3 biometrics enrollment UI enhancements**
- [ ] **Volatile memory bridge automated zeroing benchmark suite**

### Phase 2: High-Density Technical Feeds & Rich RFC Reader
- [x] **Technical note (`kind: 1`) and long-form RFC (`kind: 30023`) dispatches**
- [x] **OpenBricks 4.0 dark tactile UI design system** (`#161412` deep ash & `#000000` pitch black)
- [x] **Bandwidth Gate**: Click-to-load external media placeholders with byte & domain estimation
- [x] **Local profile metadata caching** (7-day cache TTL before relay fetch)
- [x] **Real-time cryptographic inspector drawer** (`InspectRawSidebar`) with canonical NIP-01 JSON & BIP-340 signature decomposition
- [x] **Formatted Markdown rendering & dark tactile code syntax block formatting** for RFC dispatches (`kind: 30023`) and technical notes (`kind: 1`)
- [x] **NIP-05 DNS-based identity verification badge** on user profile header and feeds
- [ ] **Code block copy-to-clipboard button & syntax line numbering** for code snippets
- [ ] **Custom LaTeX / Math rendering support** for technical RFC formulas

### Phase 3: Multiplexed Relay Engine & Off-Main-Thread Ingestion
- [x] **Single-socket background WebSocket multiplexer** (`public/relay-worker.js`)
- [x] **Relay pool status monitoring** (`nos.lol`, `relay.damus.io`, `relay.primal.net`, `nostr.wine`)
- [x] **Latency tracking, ping response timing, and exponential reconnect backoff**
- [x] **Micro-batch Dexie ingestion pipeline** (100ms processing window)
- [ ] **Adaptive subscription filter optimizer** based on viewport scroll velocity
- [ ] **Relay health scorecard & automated fallback routing**

### Phase 4: Standalone `@zup/cli` NPM Package (`packages/cli`)
- [x] **Command-line package architecture** under `packages/cli`
- [x] **Core CLI subcommands**: `zup identity list`, `zup identity switch`, `zup tail`, `zup publish`, `zup sync`, `zup inspect`, `zup relays`, `zup telemetry`, `zup stats`, `zup export-telemetry`
- [x] **Global web keyboard shortcuts** (`Cmd+K`, `1` Feed, `2` New Dispatch, `3` Profile, `4` Settings, `L` Lock)
- [ ] **Out-of-browser standalone CLI binary compilation** via Bun / Node (`packages/cli/bin/zup.js`)
- [ ] **Background daemon process (`packages/cli/src/daemon`) IPC socket handler** for headless local execution
- [ ] **Publishing pipeline to npm registry** (`npm publish --workspace=packages/cli`)

### Phase 5: Local Interaction Telemetry & Topic Affinity Engine
- [x] **Local-first, client-side behavioral logging** in Dexie `telemetry` table
- [x] **Viewport `IntersectionObserver` dwell time profiling** (>75% visibility for >800ms)
- [x] **Inspection and copy signal logging** (`inspect_raw`, `expand_thread`)
- [x] **Dynamic topic affinity score synthesis** (`#distributed-systems`, `#linux`, `#nostr`, `#crypto`)
- [x] **User-controlled local telemetry purging and JSON data export**
- [ ] **Client-side heuristic feed ranking algorithm** utilizing local topic affinity scores

### Phase 6: Cloud Delta Replication & Zero-Knowledge Sync
- [x] **Bidirectional delta-sync between Dexie `zup_engine_v1` and LibSQL/Turso edge nodes**
- [x] **Conflict-free Last-Write-Wins (LWW) state resolution engine**
- [x] **Zero-Knowledge boundary verification**: 100% guarantee that zero unencrypted secrets leave device
- [ ] **Automated background cloud sync trigger** on network status change or reconnect

### Phase 7: Protocol NIP Extensions
- [x] **NIP-01**: Canonical protocol, event hashing, Schnorr verification
- [x] **NIP-10**: Thread references & reply tags
- [x] **NIP-19**: Bech32 key encoding (`npub`, `nsec`, `note`)
- [x] **NIP-05**: DNS-based identity verification ticker displays
- [ ] **NIP-07**: Browser extension signer bridge fallback support
- [ ] **NIP-42**: Relay authentication flow handler
- [ ] **NIP-57**: Lightning Zap invoice generation & WebLN wallet bridge integration

---

## 🛠️ Verification & Quality Assurance Commands

All contributions and roadmap milestones must pass strict static verification, linting, and automated unit testing:

```bash
# 1. Run unit test suite
bun test

# 2. Run ESLint code quality check
npm run lint

# 3. Verify Next.js production build succeeds
npm run build
```
