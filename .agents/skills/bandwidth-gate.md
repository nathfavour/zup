# Skill: Bandwidth Zero-Waste Gate (`bandwidth-gate`)

This skill governs the network and media rules for maintaining **zup** as an ultra-lean, low-bandwidth Nostr web client for engineers.

---

## 1. Zero-Waste Media Mandate
- **No Unsolicited Media Fetching**: Never automatically render external images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`), videos (`.mp4`, `.webm`), or external embedded media.
- **Tactile Placeholders**: Intercept media URLs in content and render unhydrated tactile placeholders showing:
  - Domain metadata (e.g., `cdn.damus.io`)
  - Estimated payload size / byte indicator
  - Tactile action button requiring an explicit user click to load media.

---

## 2. Profile Metadata Caching Strategy
- **7-Day Local Cache**: User profile metadata (`kind: 0`) must be queried against Dexie IndexedDB `db.profiles`.
- If `db.profiles.get(pubkey)` exists and `cached_at` is younger than 7 days, skip network queries entirely.
- Uncached profiles should be batched together in single relay requests (`limit: 100`) on a single backbone connection.

---

## 3. Incremental Relay Query Anchoring
- **`since` Filtering**: Every relay subscription filter for feeds or events must include `"since": latest_cached_timestamp` based on local Dexie records to prevent re-downloading existing events.
- **Limit Caps**: Scope initial feed catches with strict limits (e.g., `limit: 50`).

---

## 4. Single-Socket Connection Pooling
- All browser tabs must route WebSocket connections through `public/relay-worker.js` (SharedWorker).
- Sockets to relays are opened once per origin. Duplicate sockets per origin across tabs are strictly forbidden.
