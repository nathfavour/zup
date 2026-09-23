---
name: zup-quality
description: Zup Quality Shield and Tier 1 Ingress Pipeline: anti-spam, wire-drop, Web of Trust graph, SimHash near-duplicate detection, and Shannon entropy heuristics.
---

# Zup Quality Shield & Tier 1 Ingress Funnel

## Multi-Layer Waterfall Ingress Funnel

### 1. Layer 1: Wire-Drop (Zero-Allocation / O(1))
- Drops events far in the future (> 60s clock skew) or older than 14 days.
- Drops Kind 1 notes with empty payloads and no media/nip tags.
- Drops tag bomb floods (> 20 tags) and mention bomb floods (> 8 p-tags).

### 2. Layer 2: Web of Trust (WoT) Graph
- **Hop 0**: Current user keypair (priority 1.0).
- **Hop 1**: Direct follows from Kind 3 contact list (priority 0.9).
- **Virtual Hop 1**: Curated high-signal developer seed accounts for cold-start exploration.
- **Hop 2**: Follows of direct follows (priority 0.6).
- **Hop 3**: Unconnected network strangers (buffered and strictly scored).

### 3. Layer 3: Heuristics, SimHash & Entropy
- **Shannon Entropy**: Flags abnormally low entropy notes (< 3.0 bits/char) indicating repetitive slop or bot flooding.
- **64-bit SimHash**: Detects near-duplicate spam variants across different relay pubkeys via a lightweight ring buffer.
- **Slop Filters**: Rejects URI dumps, URL shorteners, excessive vertical newlines, and raw protocol payload noise.

### 4. Layer 4: Quality Scoring & Admission
- Admits high-signal notes immediately to feed.
- Buffers root notes from unknown strangers until verified by NIP-05 or economic staking (zaps >= 1000 sats).
- Instant purge on scam, airdrop phishing, and dictionary dumps.
