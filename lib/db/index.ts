import Dexie, { Table } from 'dexie';
import {
  KeychainSlot,
  EncryptedIdentity,
  LocalEvent,
  UserTelemetry,
  ProfileMetadata
} from '../core/types';
import { hexToNpub, schnorrSign } from '../core/crypto';
import { calculateEventId } from '../core/nostr';

export class ZupDatabase extends Dexie {
  keychain!: Table<KeychainSlot, string>;
  identities!: Table<EncryptedIdentity, string>;
  events!: Table<LocalEvent, string>;
  telemetry!: Table<UserTelemetry, string>;
  profiles!: Table<ProfileMetadata, string>;

  constructor() {
    super('zup_engine_v1');

    this.version(1).stores({
      keychain: 'id, type, credentialId, syncedAt',
      identities: 'pubkey, isExternalSigner, updatedAt, syncedAt',
      events: 'id, pubkey, kind, created_at, [kind+created_at]',
      telemetry: 'id, pubkey, eventId, interactionType, timestamp, syncedAt',
      profiles: 'pubkey, cached_at'
    });
  }

  // Telemetry helper with debouncing and dwell tracking
  async logTelemetry(entry: Omit<UserTelemetry, 'id' | 'timestamp'>): Promise<string> {
    const id = 'tel_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    const telemetryRecord: UserTelemetry = {
      ...entry,
      id,
      timestamp: Date.now()
    };
    await this.telemetry.add(telemetryRecord);
    return id;
  }
}

export const db = new ZupDatabase();

// Pre-seeded technical author pubkeys
export const SEED_PUBKEYS = {
  activeEngineer: '4f8a913bc5d7120fe81029c7301fa3829140283bc9e1029471ab82049102c91a',
  anonAgent: 'b301827401928472910482019482019482019482019482019482019482019482',
  torvaldsKernel: 'e81029c7301fa3829140283bc9e1029471ab82049102c91a4f8a913bc5d7120f',
  distributedSystemsLab: '9140283bc9e1029471ab82049102c91a4f8a913bc5d7120fe81029c7301fa382'
};

// Seed database on first initialization
export async function seedDatabaseIfEmpty(): Promise<void> {
  const existingIdentities = await db.identities.count();
  if (existingIdentities > 0) return;

  const now = Date.now();
  const created_at = Math.floor(now / 1000);

  // 1. Seed Keychain Slot
  const seedKeychain: KeychainSlot = {
    id: 'kc_root_default_slot',
    type: 'password',
    wrappedMek: '4u8w+qWb0h5a3V/0+oK8H19e2+70zWfK4e8l9oP810qR9tL3w8==',
    salt: 'Y2hhaW5fc2FsdF9hdXRoX3psX3YzXzAx',
    params: {
      algo: 'Argon2id',
      memory: 65536,
      iterations: 3,
      parallelism: 4
    },
    createdAt: now - 86400000 * 3,
    syncedAt: now - 86400000 * 2
  };
  await db.keychain.add(seedKeychain);

  // 2. Seed Personas / Encrypted Identities
  const personalIdentity: EncryptedIdentity = {
    pubkey: SEED_PUBKEYS.activeEngineer,
    npub: hexToNpub(SEED_PUBKEYS.activeEngineer),
    wrappedNsec: '7k9w+M3kP819zWfL4u8w+qWb0h5a3V/0+oK8H19e2+70zWfK4e8l9oP810qR9tL3w8==',
    isExternalSigner: false,
    label: 'Systems Operator (Personal)',
    relays: ['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.primal.net'],
    createdAt: now - 86400000 * 3,
    updatedAt: now - 86400000 * 2,
    syncedAt: now - 86400000 * 2
  };

  const agentIdentity: EncryptedIdentity = {
    pubkey: SEED_PUBKEYS.anonAgent,
    npub: hexToNpub(SEED_PUBKEYS.anonAgent),
    wrappedNsec: '3j2w+A88P819zWfL4u8w+qWb0h5a3V/0+oK8H19e2+70zWfK4e8l9oP810qR9tL3w8==',
    isExternalSigner: false,
    label: 'Agent Alpha (Anonymous Daemon)',
    relays: ['wss://nos.lol', 'wss://nostr.wine'],
    createdAt: now - 86400000,
    updatedAt: now - 3600000,
    syncedAt: now - 3600000
  };

  await db.identities.bulkAdd([personalIdentity, agentIdentity]);

  // Set default active identity in localStorage if not set
  if (typeof window !== 'undefined' && !localStorage.getItem('zup:active_pubkey')) {
    localStorage.setItem('zup:active_pubkey', personalIdentity.pubkey);
  }

  // 3. Seed Profiles (Kind 0)
  const seedProfiles: ProfileMetadata[] = [
    {
      pubkey: SEED_PUBKEYS.activeEngineer,
      name: 'operator',
      display_name: 'Operator // Sys64',
      about: 'Systems engineer & protocol architect. Low-overhead computing and local-first cryptographic state.',
      nip05: 'operator@getzup.app',
      content: JSON.stringify({
        name: 'operator',
        display_name: 'Operator // Sys64',
        about: 'Systems engineer & protocol architect. Low-overhead computing and local-first cryptographic state.',
        nip05: 'operator@getzup.app'
      }),
      updated_at: created_at - 10000,
      cached_at: now
    },
    {
      pubkey: SEED_PUBKEYS.distributedSystemsLab,
      name: 'dist_systems',
      display_name: 'Distributed Systems WG',
      about: 'Research group focused on zero-knowledge consensus, Byzantine fault tolerance, and gossip protocols.',
      nip05: 'research@dslab.org',
      content: JSON.stringify({
        name: 'dist_systems',
        display_name: 'Distributed Systems WG',
        about: 'Research group focused on zero-knowledge consensus, Byzantine fault tolerance, and gossip protocols.'
      }),
      updated_at: created_at - 20000,
      cached_at: now
    },
    {
      pubkey: SEED_PUBKEYS.torvaldsKernel,
      name: 'kernel_core',
      display_name: 'Linux Kernel Telemetry',
      about: 'Automated dispatches on eBPF runtime performance, socket multiplexing, and memory barrier benchmarks.',
      content: JSON.stringify({
        name: 'kernel_core',
        display_name: 'Linux Kernel Telemetry'
      }),
      updated_at: created_at - 30000,
      cached_at: now
    }
  ];
  await db.profiles.bulkAdd(seedProfiles);

  // 4. Seed Canonical Technical Events (Kind 1 and Kind 30023)
  const mockPriv = '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b';

  const rawEventsToCreate = [
    {
      pubkey: SEED_PUBKEYS.distributedSystemsLab,
      kind: 30023,
      created_at: created_at - 1800,
      tags: [
        ['d', 'rfc-8891-relay-multiplexing'],
        ['title', 'RFC-8891: Deterministic Multi-Relay Ingestion Loops and Memory Bounds in Zero-Knowledge Clients'],
        ['summary', 'Architectural breakdown of SharedWorker connection pools, deduplication ring buffers, and sub-100ms Dexie batch commits.'],
        ['t', 'distributed-systems'],
        ['t', 'nostr'],
        ['t', 'architecture']
      ],
      content: `# RFC-8891: Deterministic Multi-Relay Ingestion Loops

## Abstract
Modern decentralized social protocols suffer from bandwidth bloat when multiple browser tabs or clients concurrently poll high-traffic relays. **zup** enforces Invariant 3 (Single Socket Multiplexing via SharedWorker) alongside an air-gapped signature pipeline.

\`\`\`
Tab 1 (Feed) ────────┐
Tab 2 (Thread) ──────┼──► SharedWorker (relay-worker.js)
Tab 3 (Profile) ─────┘           │
                                 ├── Connection Pool Manager
                                 │   ├── wss://nos.lol
                                 │   ├── wss://relay.damus.io
                                 └── Batch Pipeline (Dexie Bulk Ingestion)
\`\`\`

## Invariant Guarantees
1. **LRU Dedup Buffer:** Every incoming subscription payload passes through a 65,536-slot circular Bloom filter.
2. **Deterministic Teardown:** Once active port references drop to zero, an explicit CLOSE verb unmounts upstream relay socket overhead.
3. **Zero External Media Auto-Hydration:** Media bytes are withheld until user explicit selection.`,
      relay_source: 'wss://nos.lol'
    },
    {
      pubkey: SEED_PUBKEYS.torvaldsKernel,
      kind: 1,
      created_at: created_at - 3600,
      tags: [
        ['t', 'linux'],
        ['t', 'ebpf'],
        ['t', 'performance']
      ],
      content: `Benchmarked eBPF socket multiplexing against classic epoll in Linux 6.12. Achieved a 12.4% reduction in L2 cache misses under 40,000 burst Nostr events/second. 

Deduplication ring buffers committed to disk via io_uring zero-copy. Full benchmark harness available in @zup/cli tail package.`,
      relay_source: 'wss://relay.damus.io'
    },
    {
      pubkey: SEED_PUBKEYS.activeEngineer,
      kind: 1,
      created_at: created_at - 7200,
      tags: [
        ['t', 'crypto'],
        ['t', 'zero-knowledge'],
        ['t', 'webauthn']
      ],
      content: `Implemented Argon2id KDF parameters (64MB memory, 3 iterations, 4 parallelism lanes) coupled with WebAuthn PRF (Level 3) extension.

Raw nsec never touches disk. If the browser tab remains idle for > 10 minutes, volatile RAM zeroing purges the Master Encryption Key (MEK) across all worker contexts.`,
      relay_source: 'wss://relay.primal.net'
    },
    {
      pubkey: SEED_PUBKEYS.anonAgent,
      kind: 1,
      created_at: created_at - 14400,
      tags: [
        ['t', 'turso'],
        ['t', 'database'],
        ['t', 'sync']
      ],
      content: `Turso edge replica delta sync verified. Encrypted keychain rows and encrypted profiles replicated over LibSQL edge endpoints with conflict-free Last-Write-Wins timestamps.

Remote sync nodes cannot decrypt MEK or nsec blobs without the local Master Password. Absolute zero-knowledge maintained.`,
      relay_source: 'wss://nostr.wine'
    },
    {
      pubkey: SEED_PUBKEYS.distributedSystemsLab,
      kind: 1,
      created_at: created_at - 28800,
      tags: [
        ['t', 'protocols'],
        ['t', 'nostr']
      ],
      content: `NIP-50 full-text search filters tested across wss://nostr.wine backbone. Batching kind:0 lookups with strict 7-day TTL cut initial sync bandwidth by 84% on cold boot.`,
      relay_source: 'wss://nostr.wine'
    }
  ];

  const seedEvents: LocalEvent[] = [];
  for (const item of rawEventsToCreate) {
    const id = await calculateEventId({
      pubkey: item.pubkey,
      created_at: item.created_at,
      kind: item.kind,
      tags: item.tags,
      content: item.content
    });
    const sig = await schnorrSign(id, mockPriv);
    seedEvents.push({
      id,
      pubkey: item.pubkey,
      kind: item.kind,
      created_at: item.created_at,
      tags: item.tags,
      content: item.content,
      sig,
      first_seen_at: now - (created_at - item.created_at) * 1000,
      relay_source: item.relay_source
    });
  }

  await db.events.bulkAdd(seedEvents);

  // 5. Seed Initial Telemetry for Inspection
  const seedTelemetry: UserTelemetry[] = [
    {
      id: 'tel_init_01',
      pubkey: SEED_PUBKEYS.activeEngineer,
      eventId: seedEvents[0].id,
      interactionType: 'dwell',
      dwellTimeMs: 4200,
      metadata: { scrollDepth: 0.85, tags: ['distributed-systems', 'nostr'] },
      timestamp: now - 3600000,
      syncedAt: now - 1800000
    },
    {
      id: 'tel_init_02',
      pubkey: SEED_PUBKEYS.activeEngineer,
      eventId: seedEvents[0].id,
      interactionType: 'inspect_raw',
      metadata: { schnorrVerified: true },
      timestamp: now - 3500000,
      syncedAt: now - 1800000
    },
    {
      id: 'tel_init_03',
      pubkey: SEED_PUBKEYS.activeEngineer,
      eventId: seedEvents[1].id,
      interactionType: 'dwell',
      dwellTimeMs: 2900,
      metadata: { tags: ['linux', 'ebpf'] },
      timestamp: now - 1800000
    }
  ];
  await db.telemetry.bulkAdd(seedTelemetry);
}
