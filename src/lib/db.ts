import { createRxDatabase, RxDatabase, RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { 
  StoredIdentity, 
  NostrEvent, 
  RelayInfo, 
  DirectMessageThread, 
  VaultSecurityState 
} from '../types';
import { DEFAULT_RELAYS } from './nostr';
import { INITIAL_EVENTS, INITIAL_DIRECT_MESSAGES } from '../data/seedEvents';

// Database Schema Definitions
const identitySchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    pubkeyHex: { type: 'string' },
    npub: { type: 'string' },
    name: { type: 'string' },
    displayName: { type: 'string' },
    about: { type: 'string' },
    avatar: { type: 'string' },
    nip05: { type: 'string' },
    lud16: { type: 'string' },
    isEphemeral: { type: 'boolean' },
    isWatchOnly: { type: 'boolean' },
    encryptedPrivkeyHex: { type: 'string' },
    encryptedNsec: { type: 'string' },
    createdAt: { type: 'number' },
    lastActiveAt: { type: 'number' },
  },
  required: ['id', 'pubkeyHex', 'npub', 'createdAt'],
};

const noteSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    pubkey: { type: 'string' },
    created_at: { type: 'number' },
    kind: { type: 'number' },
    tags: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
    content: { type: 'string' },
    sig: { type: 'string' },
    relayUrl: { type: 'string' },
    likesCount: { type: 'number' },
    repostsCount: { type: 'number' },
    zapsCount: { type: 'number' },
    repliesCount: { type: 'number' },
    isLiked: { type: 'boolean' },
    isReposted: { type: 'boolean' },
    isZapped: { type: 'boolean' },
    author: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        displayName: { type: 'string' },
        npub: { type: 'string' },
        avatar: { type: 'string' },
        nip05: { type: 'string' },
      },
    },
  },
  required: ['id', 'pubkey', 'created_at', 'kind', 'content'],
};

const relaySchema = {
  version: 0,
  primaryKey: 'url',
  type: 'object',
  properties: {
    url: { type: 'string', maxLength: 200 },
    status: { type: 'string' },
    latencyMs: { type: 'number' },
    read: { type: 'boolean' },
    write: { type: 'boolean' },
    eventsReceived: { type: 'number' },
    eventsSent: { type: 'number' },
    description: { type: 'string' },
    isDefault: { type: 'boolean' },
  },
  required: ['url', 'status', 'read', 'write'],
};

const messageSchema = {
  version: 0,
  primaryKey: 'peerPubkey',
  type: 'object',
  properties: {
    peerPubkey: { type: 'string', maxLength: 100 },
    peerNpub: { type: 'string' },
    peerName: { type: 'string' },
    peerAvatar: { type: 'string' },
    lastMessage: { type: 'string' },
    timestamp: { type: 'number' },
    unreadCount: { type: 'number' },
    messages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          senderPubkey: { type: 'string' },
          content: { type: 'string' },
          timestamp: { type: 'number' },
          isEncrypted: { type: 'boolean' },
        },
      },
    },
  },
  required: ['peerPubkey', 'peerName', 'timestamp'],
};

const vaultSecuritySchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 50 },
    isInitialized: { type: 'boolean' },
    salt: { type: 'string' },
    passwordWrappedMEK: {
      type: 'object',
      properties: {
        cipherText: { type: 'string' },
        iv: { type: 'string' },
        salt: { type: 'string' },
      },
      required: ['cipherText', 'iv'],
    },
    passkeys: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          credentialId: { type: 'string' },
          createdAt: { type: 'number' },
          lastUsed: { type: 'number' },
          encryptedMEK: {
            type: 'object',
            properties: {
              cipherText: { type: 'string' },
              iv: { type: 'string' },
              salt: { type: 'string' },
            },
            required: ['cipherText', 'iv'],
          },
        },
      },
    },
    argonConfig: {
      type: 'object',
      properties: {
        iterations: { type: 'number' },
        memorySize: { type: 'number' },
        hashLength: { type: 'number' },
      },
    },
    createdAt: { type: 'number' },
    updatedAt: { type: 'number' },
  },
  required: ['id', 'isInitialized'],
};

export type ZupDatabaseCollections = {
  identities: RxCollection<StoredIdentity>;
  notes: RxCollection<NostrEvent>;
  relays: RxCollection<RelayInfo>;
  messages: RxCollection<DirectMessageThread>;
  vault_security: RxCollection<VaultSecurityState>;
};

export type ZupDatabase = RxDatabase<ZupDatabaseCollections>;

let dbPromise: Promise<ZupDatabase> | null = null;

export async function getDatabase(): Promise<ZupDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    const db = await createRxDatabase<ZupDatabaseCollections>({
      name: 'zup_cypher_db_v1',
      storage: getRxStorageDexie(),
      multiInstance: false,
      ignoreDuplicate: true,
    });

    await db.addCollections({
      identities: { schema: identitySchema },
      notes: { schema: noteSchema },
      relays: { schema: relaySchema },
      messages: { schema: messageSchema },
      vault_security: { schema: vaultSecuritySchema },
    });

    // Seed initial relays if empty
    const existingRelays = await db.relays.find().exec();
    if (existingRelays.length === 0) {
      for (const r of DEFAULT_RELAYS) {
        await db.relays.upsert(r);
      }
    }

    // Seed initial notes if empty
    const existingNotes = await db.notes.find().exec();
    if (existingNotes.length === 0) {
      for (const ev of INITIAL_EVENTS) {
        await db.notes.upsert(ev);
      }
    }

    // Seed initial messages if empty
    const existingMessages = await db.messages.find().exec();
    if (existingMessages.length === 0) {
      for (const msg of INITIAL_DIRECT_MESSAGES) {
        await db.messages.upsert(msg);
      }
    }

    return db;
  })();

  return dbPromise;
}
