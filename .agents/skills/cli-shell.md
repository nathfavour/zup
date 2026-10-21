# Skill: Standalone Command-Line Package (`cli-shell`)

This skill defines the command specification for the standalone `@zup/cli` package located under `packages/cli` which will be published on npm.

> ⚠️ **IMPORTANT**: `@zup/cli` is a standalone CLI package (`packages/cli`). It is NOT an in-app web UI component, route, or terminal emulator page on the web app. DO NOT add a CLI UI or CLI tab button to the web application.

---

## 1. Package Architecture
- Published as `@zup/cli` on npm.
- Built using Node/Bun executable binaries under `packages/cli/src`.
- Communicates via local IPC sockets and daemon processes.

---

## 2. Command Specification
- `zup identity list`: List local personas, pubkeys, npubs, and active status marker.
- `zup identity switch <pubkey|label>`: Switch active persona pointer in-memory and update `localStorage["zup:active_pubkey"]`.
- `zup tail [--kinds 1,30023]`: Stream recent technical notes and RFCs from local storage.
- `zup publish "<text>" [--sign]`: Sign canonical NIP-01 event with active vault signer and broadcast over SharedWorker relay pool.
- `zup sync --turso`: Trigger on-demand delta replication with LibSQL edge instance.
- `zup inspect <eventId>`: Perform canonical SHA-256 ID recalculation and BIP-340 Schnorr signature validation on event.
- `zup relays`: Query connection pool status, latencies, and event counts for configured relays.
- `zup telemetry`: Summarize local dwell, inspect, and topic affinity metrics.
- `zup stats`: Display system status, database record counts, and active vault unlock state.
- `zup export-telemetry`: Export local privacy-first telemetry history as a downloadable JSON blob.
- `clear`: Clear terminal viewport history.
