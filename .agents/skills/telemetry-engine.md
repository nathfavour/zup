# Skill: Local-First Behavioral Telemetry Engine (`telemetry-engine`)

This skill governs the private client-side interaction tracking and topic affinity calculations in **zup**.

---

## 1. Absolute Local Privacy Directive
- Telemetry events MUST be stored strictly in local IndexedDB table `db.telemetry`.
- Telemetry data MUST NEVER be sent to third-party analytics services (Segment, Google Analytics, Mixpanel, etc.).
- Users must have full visibility and control to view, export, or clear their local telemetry history at any time.

---

## 2. Interaction Signals
- `dwell`: Captured via `IntersectionObserver` when an event card is >75% visible in viewport for >800ms. Flits (<800ms) are discarded.
- `inspect_raw`: Logged whenever an engineer opens the cryptographic inspector drawer to inspect raw JSON or Schnorr parameters.
- `expand_thread`: Logged when an operator follows discussion root threads.
- `share` / `copy`: Logged on event content or ID copies.

---

## 3. Dynamic Topic Affinity Scoring
- Synthesize topic weights based on hashtag engagement (`#distributed-systems`, `#linux`, `#nostr`, `#crypto`):
  `Score(tag) = ∑ (dwellTimeMs / 1000 * 1.0) + (inspect_raw * 5.0) + (expand_thread * 3.0)`
- Affinity scores guide local feed ranking without exposing user reading habits.
