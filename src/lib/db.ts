import { createRxDatabase, RxDatabase, RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { 
  StoredIdentity, 
  NostrEvent, 
  RelayInfo, 
  DirectMessageThread, 
  VaultSecurityState,
  KeychainEntry,
  UserSettingsRecord,
  UserPrefsRecord
} from '../types';
import { DEFAULT_RELAYS } from './nostr';

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

const fNostrIdentitySchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    userId: { type: 'string' },
    pubkey: { type: 'string' },
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
    label: { type: 'string' },
    isPrimary: { type: 'boolean' },
    sync_origin: { type: 'string' },
    encryptedPrivkeyHex: { type: 'string' },
    encryptedNsec: { type: 'string' },
    createdAt: { type: 'number' },
    lastActiveAt: { type: 'number' },
  },
  required: ['id', 'pubkeyHex', 'npub', 'createdAt'],
};

const keychainSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    userId: { type: 'string' },
    type: { type: 'string' },
    credentialId: { type: 'string' },
    wrappedKey: { type: 'string' },
    salt: { type: 'string' },
    isArgon: { type: 'boolean' },
    params: { type: 'string' },
    authPass: { type: 'boolean' },
  },
  required: ['id', 'userId', 'type', 'wrappedKey'],
};

const userSettingsSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    userId: { type: 'string' },
    theme: { type: 'string' },
    defaultRelays: { type: 'array', items: { type: 'string' } },
    feedSettings: {
      type: 'object',
      properties: {
        filter: { type: 'string' },
        mediaOnly: { type: 'boolean' },
        autoDecrypt: { type: 'boolean' },
      },
    },
    activeNostrPubkey: { type: 'string' },
    sync_origin: { type: 'string' },
    updatedAt: { type: 'number' },
  },
  required: ['id', 'userId'],
};

const userPrefsSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    userId: { type: 'string' },
    masterpass_setup: { type: 'boolean' },
    masterpass_for_login_enabled: { type: 'boolean' },
    updatedAt: { type: 'number' },
  },
  required: ['id', 'userId'],
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
          type: { type: 'string' },
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
  f_nostr_identities: RxCollection<StoredIdentity>;
  f_keychain: RxCollection<KeychainEntry>;
  f_user_settings: RxCollection<UserSettingsRecord>;
  f_user_prefs: RxCollection<UserPrefsRecord>;
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
    try {
      let db: ZupDatabase;
      try {
        db = await createRxDatabase<ZupDatabaseCollections>({
          name: 'zup_cypher_db_v1',
          storage: getRxStorageDexie(),
          multiInstance: false,
          closeDuplicates: true,
        });
      } catch (storageErr) {
        console.warn('Dexie storage failed or unavailable, falling back to memory storage:', storageErr);
        db = await createRxDatabase<ZupDatabaseCollections>({
          name: `zup_cypher_db_fallback_${Date.now()}`,
          storage: getRxStorageMemory(),
          multiInstance: false,
          closeDuplicates: true,
        });
      }

      const collectionsConfig = {
        identities: { schema: identitySchema },
        f_nostr_identities: { schema: fNostrIdentitySchema },
        f_keychain: { schema: keychainSchema },
        f_user_settings: { schema: userSettingsSchema },
        f_user_prefs: { schema: userPrefsSchema },
        notes: { schema: noteSchema },
        relays: { schema: relaySchema },
        messages: { schema: messageSchema },
        vault_security: { schema: vaultSecuritySchema },
      };

      try {
        await db.addCollections(collectionsConfig);
      } catch (collErr) {
        console.warn('addCollections encountered schema mismatch or error on database instance. Initiating self-healing recovery:', collErr);
        try {
          await db.remove();
        } catch {
          // Ignore remove failure
        }
        
        try {
          db = await createRxDatabase<ZupDatabaseCollections>({
            name: `zup_cypher_db_v2`,
            storage: getRxStorageDexie(),
            multiInstance: false,
            closeDuplicates: true,
          });
          await db.addCollections(collectionsConfig);
        } catch (v2Err) {
          console.warn('Dexie v2 fallback failed, booting ephemeral memory storage:', v2Err);
          db = await createRxDatabase<ZupDatabaseCollections>({
            name: `zup_cypher_db_mem_${Date.now()}`,
            storage: getRxStorageMemory(),
            multiInstance: false,
            closeDuplicates: true,
          });
          await db.addCollections(collectionsConfig);
        }
      }

      // Seed initial relays if empty
      const existingRelays = await db.relays.find().exec();
      if (existingRelays.length === 0) {
        for (const r of DEFAULT_RELAYS) {
          await db.relays.upsert(r);
        }
      }

      // Clean up any legacy demo mock events from prior runs so feed is 100% real Nostr events
      const allNotes = await db.notes.find().exec();
      for (const doc of allNotes) {
        if (doc.id && doc.id.startsWith('e10')) {
          await doc.remove();
        }
      }

      return db;
    } catch (err) {
      dbPromise = null;
      throw err;
    }
  })();

  return dbPromise;
}
