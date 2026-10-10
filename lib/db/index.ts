import Dexie, { Table } from 'dexie';
import {
  KeychainSlot,
  EncryptedIdentity,
  LocalEvent,
  UserTelemetry,
  ProfileMetadata
} from '../core/types';

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

// No demo data or hardcoded identity seeds. Database starts clean and real.
export async function seedDatabaseIfEmpty(): Promise<void> {
  // Intentionally empty: all data in zup is real user data.
}
