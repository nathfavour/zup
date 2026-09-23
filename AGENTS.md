# Zup - Autonomous Agent Guide

# AGENTS.md - System Orchestration for Zup

## Core Operational Directives
1. You are an autonomous software engineering agent tasked with maintaining **Zup**, a standalone, ultra-lean, sovereign Nostr client.
2. Zup is intentionally standalone. It is **never** merged into the main Kylrix monolithic repository.
3. Keep Zup ultra-fast, offline-first, client-only, and zero-trace.

## Runtime & Package Management Directives (STRICT)
- **Bun Only**: Always use `bun` (`bun install`, `bun run lint`, `bun run build`, `bun add`, `bun test`). NEVER use `pnpm`, `npm`, or `yarn`. Zup tracks `bun.lock`.
- **No Node.js Backend**: Zup is a pure client-side application built with Vite + React 19 + RxDB (Dexie/IndexedDB) + nostr-tools. It must run standalone in any modern browser without requiring local Appwrite, Docker containers, or Node servers.

## 🏗️ Architectural Mandates

### 🚀 SOURCE CONTROL & PUSH DIRECTIVE (STRICT)
- **Push After Every Update**: The agent is permitted and expected to perform Git operations. After implementing any fix or feature, the agent must consolidate the modifications, perform a commit with a descriptive message, and push the changes immediately (`GITHUB_TOKEN="" git push origin main` or standard git push). **Do not wait for the user to ask** — commit + push is mandatory on finishing every update.
- **Pure Commit Messages (STRICT)**: When committing, NEVER add any co-author metadata (e.g., `Co-authored-by:` headers, names, or emails). Commit messages must contain only the pure commit message description. Leave author identification entirely to the automatic system git configuration.

### ⚡ Execution & Scope Directives
- **Surgical Execution**: Prioritize direct, high-precision code modifications. Skip unnecessary overhead and resolve the target issues cleanly.
- **Zero Speculation**: When the user identifies a specific error, fix exactly that error and stop. Resolve the reported problem surgically and get out of the way immediately.
- **Strict Scope Enforcement**: Do not touch or refactor files that were not requested or directly affected by the task. Keep modifications tightly focused.

### ⚡ Client-First & Nostr Standards
- **Real On-Chain Data**: Never display mock or static placeholder profiles when interacting with the Nostr network. Always fetch real Kind 0 metadata, Kind 1 notes, Kind 7 reactions, Kind 6 reposts, Kind 9735 zaps, and Kind 3 follow lists across connected relays.
- **Direct Relay Publishing**: When a user creates notes, reacts, reposts, or edits their profile, sign events locally with their private key / nsec and broadcast to all active write relays.
- **Relay Directory & Indexing**: Use high-speed directory relays (`wss://purplepag.es`, `wss://user.kindpag.es`, `wss://relay.damus.io`, `wss://nos.lol`, `wss://relay.primal.net`, `wss://relay.nostr.band`) for fast Kind 0 author metadata lookups.
- **Zup Quality Shield**: Filter incoming relay streams using the multi-layer wire-drop, Web of Trust scoring, SimHash near-duplicate detection, and Shannon entropy slop filters (`src/lib/ingressPipeline.ts` & `src/lib/nostrFilters.ts`).
- **Zero-Knowledge MEK (Master Encryption Key)**: Sensitive keys (nsec, private keys, direct message secrets) must be encrypted with AES-256-GCM via MEK derived via Argon2id (64MB RAM, 3 iterations) or WebAuthn Passkeys. MEK is stored strictly in memory (RAM) and wiped with `.fill(0)` on lock. Never persist raw MEK to unencrypted disk/storage.

### 🌐 Sign in with Kylrix & Interoperability
- **RFC 7636 OAuth 2.1 PKCE**: Implement standard PKCE authorization code exchange (`/oauth/consent` -> `/api/v1/oauth/token` -> `/api/v1/me`).
- **NIP-78 Identity Binding**: When linked to a Kylrix account, publish a Kind 30078 event to bind the Nostr pubkey without giving away private keys or compromising decentralization.
- **Safe Disconnect**: Logging out or disconnecting Kylrix must **never** wipe or delete local Nostr keys or local RxDB data. It only resets `syncOrigin` to `local_only`.

### 🎨 Design & Interaction (OpenBricks 4.0)
- **OpenBricks Design Language**: Dark mode, opaque surfaces (`#000000`, `#161412`), subtle borders (`border-white/10` to `border-white/20`), tactile action triggers, and zero translucent blurs on product chrome.
- **Layman-First UI Copy**: Clear, direct, human-friendly wording. Avoid unnecessarily alienating jargon where simple terms communicate better.
- **No Overlays / No Modals**: We never use overlays, popups, backdrop blurs, or modal dialogs here. All views, configuration panels, settings, and workflows (including Settings, Relays, Profile, and Vault) must be orderly, neat first-class pages or inline embedded panels matching Feed and Profile. Clicking Settings anywhere in the app must navigate cleanly to the native inline Settings page, never an overlay.

### 🤖 Agent Verification Policy
- **Fast Testing**: Verify changes using `bun test` and `bun run lint`.
- **No Playwright Unless Asked**: Do not run headless browser verification or screenshot checks unless explicitly requested.
- **No Agent Dev Servers**: Do not leave background dev servers running competing for ports.
