# 🗺️ zup Roadmap (`ROADMAP.md`)

> **Ultra-lean, low-bandwidth Nostr web client and workspace ecosystem tailored for engineers, systems thinkers, and technical operators.**

This document details the architectural vision, current development status, and upcoming execution phases for **zup** (`getzup.vercel.app`).

---

## ⚡ Project Scope & Core Invariants

`zup` is engineered from first principles for performance-conscious developers who demand cryptographic privacy, minimal bandwidth consumption, and high-density technical interfaces.

1. **Absolute Local Zero-Knowledge Root**: Raw `nsec` and the 256-bit Master Encryption Key (MEK) never persist unencrypted across disk, network, or server storage.
2. **Singular Vault, Multi-Identity Encapsulation**: One Master Password or WebAuthn PRF passkey unseals one persistent vault MEK that decrypts all identity records in-memory.
3. **Single-Socket Multiplexing via SharedWorker**: Tab connections are pooled through a single background `SharedWorker` (`public/relay-worker.js`).
4. **Asynchronous Signature Ingestion**: Schnorr signature verification and deduplication occur off the main thread.
5. **Bandwidth Zero-Waste Mandate**: Media is click-to-load with byte estimation; `kind: 0` profiles are cached locally for 7 days; queries pass incremental `since` timestamps.
6. **Upstream Cloud & Turso Sync Readiness**: Isomorphic schema supporting bidirectional, Last-Write-Wins (LWW) delta replication to remote LibSQL/Turso edge databases.

---

## 📅 Roadmap Execution Phases

### Phase 1: Zero-Knowledge Cryptographic Vault & Persona Ring
- [x] Argon2id KDF & PBKDF2 Key Encryption Key (KEK) derivation (`lib/core/crypto`)
- [x] WebAuthn Passkey (PRF extension & deterministic fallback) integration
- [x] In-memory Master Encryption Key (MEK) unsealing & roundtrip validation
- [x] Multi-Persona identity ring pointer switching (`zup:active_pubkey`)
- [x] Ephemeral volatile RAM key zeroing on idle timeout (10 mins) or manual lock
- [ ] Hardware-backed key import / WebAuthn PRF Level 3 biometrics enrollment UI enhancements

### Phase 2: High-Density Technical Feeds & Bandwidth Gate
- [x] Technical note (`kind: 1`) and long-form RFC (`kind: 30023`) dispatches
- [x] OpenBricks 4.0 dark tactile UI design system (`#161412` deep ash & `#000000` pitch black)
- [x] Bandwidth Gate: Click-to-load external media placeholders with byte & domain estimation
- [x] Local profile metadata caching (7-day cache TTL before relay fetch)
- [x] Real-time thread inspector drawer with canonical NIP-01 JSON & BIP-340 signature decomposition
- [ ] Markdown preview & code block syntax highlighting for RFC dispatches (`kind: 30023`)

### Phase 3: Multiplexed Relay Engine & Off-Main-Thread Ingestion
- [x] Single-socket background WebSocket multiplexer (`public/relay-worker.js`)
- [x] Relay pool status monitoring (`nos.lol`, `relay.damus.io`, `relay.primal.net`, `nostr.wine`)
- [x] Latency tracking, ping response timing, and exponential reconnect backoff
- [x] Micro-batch Dexie ingestion pipeline (100ms window)
- [ ] Adaptive subscription filter optimizer based on viewport scroll velocity

### Phase 4: Companion CLI Shell (`@zup/cli`) & Keyboard Acceleration
- [x] Interactive in-app terminal shell with direct IPC executing headless protocol primitives
- [x] Core commands: `zup identity list`, `zup identity switch`, `zup tail`, `zup publish`, `zup sync`, `zup inspect`, `zup relays`, `zup telemetry`
- [x] Global command palette (`Cmd+K` / `Ctrl+K`) & single-key navigation (`1` Feed, `2` Vault, `3` Relays, `4` Telemetry, `5` Sync, `6` CLI)
- [x] Main UI Left Sidebar shortcut integration for direct CLI access
- [x] System stats (`zup stats`) and local telemetry data export (`zup export-telemetry`)
- [ ] Out-of-browser standalone CLI binary execution via Node/Bun CLI package (`packages/cli`)

### Phase 5: Local Telemetry & Topic Affinity Engine
- [x] Local-first, client-side behavioral logging in Dexie `telemetry` table
- [x] Viewport `IntersectionObserver` dwell time profiling (>75% visibility for >800ms)
- [x] Inspection and copy signal logging (`inspect_raw`, `expand_thread`)
- [x] Dynamic topic affinity score synthesis (`#distributed-systems`, `#linux`, `#nostr`, `#crypto`)
- [x] User-controlled local telemetry purging and JSON data export for local ML models
- [ ] Heuristic feed ranking algorithm utilizing client-side topic affinity scores

### Phase 6: Cloud Delta Replication & Turso Sync Architecture
- [x] Bidirectional delta-sync between Dexie `zup_engine_v1` and LibSQL/Turso edge nodes
- [x] Conflict-free Last-Write-Wins (LWW) state resolution engine
- [x] Zero-Knowledge boundary verification: 100% guarantee that zero unencrypted secrets leave device
- [ ] Automated background cloud sync trigger on network status change / reconnect

### Phase 7: NIP Expansion & Protocol Extensions
- [x] NIP-01: Basic protocol, event hashing, Schnorr verification
- [x] NIP-19: Bech32 encoding (`npub`, `nsec`, `note`)
- [ ] NIP-05: DNS-based identity verification ticker displays
- [ ] NIP-07: Browser extension signer bridge fallback support
- [ ] NIP-42: Relay authentication flow handler
- [ ] NIP-57: Lightning Zap invoice generation & WebLN wallet bridge integration

---

## 🛠️ Verification & Quality Assurance

All features must pass strict static verification, linting, and automated unit testing:

```bash
# Run unit tests
bun test

# Run ESLint check
npm run lint

# Build production distribution
npm run build
```
