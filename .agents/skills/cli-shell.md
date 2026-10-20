# Skill: Companion Terminal Shell (`cli-shell`)

This skill defines the in-browser `@zup/cli` terminal emulator and command specification for developer operators.

---

## 1. Terminal Interface Directives
- Rendered using tactile font-mono OpenBricks 4.0 styling (`#000000` pitch black surface, emerald `#10B981` prompt `operator@zup:~$`).
- Directly invokes `CliEngine.execute(command)` executing headless protocol primitives against local IndexedDB tables.
- Terminal line history navigation via Up/Down arrow keys.

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
