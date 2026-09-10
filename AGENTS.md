# Zup - Autonomous Agent Guide

# AGENTS.md - System Orchestration for Zup

## Core Operational Directives
1. You are an autonomous software engineering agent tasked with maintaining **Zup**, a standalone, ultra-lean, sovereign Nostr client.
2. Zup is intentionally standalone. It is **never** merged into the main Kylrix monolithic repository.
3. Keep Zup ultra-fast, offline-first, client-only, and zero-trace.

## Runtime & Package Management Directives (STRICT)
- **Bun Only**: Always use `bun` (`bun install`, `bun run lint`, `bun run build`, `bun add`). NEVER use `pnpm`, `npm`, or `yarn`. Zup tracks `bun.lock`.
- **No Node.js Backend**: Zup is a pure client-side application built with Vite + React 19 + RxDB (Dexie/IndexedDB) + nostr-tools. It must run standalone in any modern browser without requiring local Appwrite, Docker containers, or Node servers.

## 🏗️ Architectural Mandates

### ⚡ Client-First & Nostr Standards
- **Real On-Chain Data**: Never display mock or static placeholder profiles when interacting with the Nostr network. Always fetch real Kind 0 metadata, Kind 1 notes, Kind 7 reactions, and Kind 3 follow lists across connected relays.
- **Direct Relay Publishing**: When a user creates notes, reacts, reposts, or edits their profile, sign events locally with their private key / nsec and broadcast to all active write relays.
- **Relay Directory & Indexing**: Use high-speed directory relays (`wss://purplepag.es`, `wss://user.kindpag.es`, `wss://relay.damus.io`, `wss://nos.lol`, `wss://relay.primal.net`, `wss://relay.nostr.band`) for fast Kind 0 author metadata lookups.
- **Zup Quality Shield**: Filter incoming relay streams using anti-spam, URI dump detection, tag bombing prevention, and low-entropy slop filters (`evaluateZupQuality`).
- **Zero-Knowledge MEK (Master Encryption Key)**: Sensitive keys (nsec, private keys, direct message secrets) must be encrypted with AES-GCM-256 via MEK derived via Argon2id or WebAuthn Passkeys. MEK is stored strictly in memory (RAM) and wiped on lock.

### 🌐 Sign in with Kylrix & Interoperability
- **RFC 7636 OAuth 2.1 PKCE**: Implement standard PKCE authorization code exchange (`/oauth/consent` -> `/api/v1/oauth/token` -> `/api/v1/me`).
- **NIP-78 Identity Binding**: When linked to a Kylrix account, publish a Kind 30078 event to bind the Nostr pubkey without giving away private keys or compromising decentralization.
- **Safe Disconnect**: Logging out or disconnecting Kylrix must **never** wipe or delete local Nostr keys or local RxDB data. It only resets `syncOrigin` to `local_only`.

### 🎨 Design & Interaction (OpenBricks)
- **OpenBricks Design Language**: Dark mode, opaque surfaces (`#000000`, `#141210`, `#161412`), subtle borders (`border-white/10` to `border-white/20`), tactile action triggers, and zero translucent blurs on product chrome.
- **Layman-First UI Copy**: Clear, direct, human-friendly wording. Avoid unnecessarily alienating jargon where simple terms communicate better.
