---
name: zup-nostr
description: Core Nostr protocols, relay pool multiplexing, Kind 0 profile metadata, Kind 1 notes, Kind 7 reactions, and Kind 3 follow lists in Zup.
---

# Zup Nostr Core Skill

## Relays & Discovery
Always maintain directory relays for fast NIP-01 Kind 0 author lookups:
- `wss://purplepag.es`
- `wss://user.kindpag.es`
- `wss://relay.damus.io`
- `wss://nos.lol`
- `wss://relay.primal.net`
- `wss://relay.nostr.band`

## Real Data Over Templates
- Never show placeholder or fake activity counts.
- Profile views must query Kind 0 for metadata, Kind 1 for user notes and replies, Kind 7 for reactions, and Kind 3 for follow contacts.
- Editing a profile must sign a real Kind 0 event (`{"name": "...", "about": "...", "picture": "...", "nip05": "...", "lud16": "..."}`) with the active private key and publish to write relays.
