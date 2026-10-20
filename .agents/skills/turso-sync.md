# Skill: Zero-Knowledge Cloud Delta Replication (`turso-sync`)

This skill defines the bidirectional sync architecture between local Dexie IndexedDB (`zup_engine_v1`) and remote LibSQL/Turso edge databases.

---

## 1. Zero-Knowledge Boundary Guarantee
- Remote sync MUST strictly operate on encrypted payloads: `wrappedMek`, `wrappedNsec`, encrypted profiles, and local telemetry records.
- Unencrypted private keys or raw MEKs MUST NEVER enter sync payloads.

---

## 2. Isomorphic Schema & Conflict Resolution
- Dexie tables (`keychain`, `identities`, `telemetry`) map 1:1 to LibSQL/SQLite table schemas with `updatedAt` / `syncedAt` tracking columns.
- State conflicts are resolved via deterministic **Last-Write-Wins (LWW)** based on timestamp comparison.

---

## 3. On-Demand & Delta Sync Protocol
- Delta sync compares local `updatedAt` timestamps against remote `syncedAt` markers.
- Only altered records are transmitted over the wire.
