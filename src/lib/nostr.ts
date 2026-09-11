import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';
import { NostrEvent, NostrKeypair, RelayInfo } from '../types';

export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string length');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export const DEFAULT_RELAYS: RelayInfo[] = [
  {
    url: 'wss://purplepag.es',
    status: 'connected',
    read: true,
    write: true,
    eventsReceived: 0,
    eventsSent: 0,
    latencyMs: 50,
    description: 'NIP-01 Directory & Profile Relay',
    isDefault: true,
  },
  {
    url: 'wss://user.kindpag.es',
    status: 'connected',
    read: true,
    write: true,
    eventsReceived: 0,
    eventsSent: 0,
    latencyMs: 55,
    description: 'Profile & Metadata Directory Relay',
    isDefault: true,
  },
  {
    url: 'wss://relay.damus.io',
    status: 'connected',
    read: true,
    write: true,
    eventsReceived: 0,
    eventsSent: 0,
    latencyMs: 78,
    description: 'Damus Global Relay (US East)',
    isDefault: true,
  },
  {
    url: 'wss://nos.lol',
    status: 'connected',
    read: true,
    write: true,
    eventsReceived: 0,
    eventsSent: 0,
    latencyMs: 95,
    description: 'Community Censorship-Resistant Node',
    isDefault: true,
  },
  {
    url: 'wss://relay.primal.net',
    status: 'connected',
    read: true,
    write: true,
    eventsReceived: 0,
    eventsSent: 0,
    latencyMs: 64,
    description: 'Primal High-Speed Media & Event Cache',
    isDefault: true,
  },
  {
    url: 'wss://relay.nostr.band',
    status: 'connected',
    read: true,
    write: true,
    eventsReceived: 0,
    eventsSent: 0,
    latencyMs: 110,
    description: 'High Performance Discovery & Search Relay',
    isDefault: true,
  },
];

// Helper to generate a new keypair
export function createNewKeypair(isEphemeral: boolean = false): NostrKeypair {
  const sk = generateSecretKey();
  const privHex = bytesToHex(sk);
  const pubHex = getPublicKey(sk);
  const nsec = nip19.nsecEncode(sk);
  const npub = nip19.npubEncode(pubHex);

  return {
    privkeyHex: privHex,
    pubkeyHex: pubHex,
    nsec,
    npub,
    isEphemeral,
    name: isEphemeral ? `Ghost_${pubHex.slice(0, 5)}` : `Anon_${pubHex.slice(0, 5)}`,
    displayName: isEphemeral ? 'Burner Identity' : 'Sovereign Peer',
    about: isEphemeral ? 'Ephemeral zero-trace burner identity on Zup.' : 'Decentralized Nostr entity on Zup.',
    avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${pubHex}`,
  };
}

// Helper to import an nsec, npub, or hex
export function importKey(input: string): NostrKeypair | null {
  const trimmed = input.trim();
  try {
    if (trimmed.startsWith('nsec1')) {
      const decoded = nip19.decode(trimmed);
      if (decoded.type === 'nsec') {
        const sk = decoded.data as Uint8Array;
        const privHex = bytesToHex(sk);
        const pubHex = getPublicKey(sk);
        const npub = nip19.npubEncode(pubHex);
        return {
          privkeyHex: privHex,
          pubkeyHex: pubHex,
          nsec: trimmed,
          npub,
          isEphemeral: false,
          name: `nostr_${pubHex.slice(0, 8)}`,
          displayName: `Nostr (${pubHex.slice(0, 6)}...${pubHex.slice(-4)})`,
          avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${pubHex}`,
        };
      }
    } else if (trimmed.startsWith('npub1')) {
      const decoded = nip19.decode(trimmed);
      if (decoded.type === 'npub') {
        const pubHex = decoded.data as string;
        return {
          pubkeyHex: pubHex,
          npub: trimmed,
          isEphemeral: false,
          name: `watch_${pubHex.slice(0, 8)}`,
          displayName: `Watch (${pubHex.slice(0, 6)}...${pubHex.slice(-4)})`,
          avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${pubHex}`,
        };
      }
    } else if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      // Hex private key or public key
      try {
        const bytes = hexToBytes(trimmed);
        const pubHex = getPublicKey(bytes);
        const npub = nip19.npubEncode(pubHex);
        const nsec = nip19.nsecEncode(bytes);
        return {
          privkeyHex: trimmed.toLowerCase(),
          pubkeyHex: pubHex,
          nsec,
          npub,
          isEphemeral: false,
          name: `Hex_${pubHex.slice(0, 6)}`,
          displayName: 'Key Import',
          avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${pubHex}`,
        };
      } catch {
        // Assume hex is public key
        const npub = nip19.npubEncode(trimmed.toLowerCase());
        return {
          pubkeyHex: trimmed.toLowerCase(),
          npub,
          isEphemeral: false,
          name: `Pub_${trimmed.slice(0, 6)}`,
          displayName: 'Public Peer',
          avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${trimmed}`,
        };
      }
    }
  } catch (err) {
    console.error('Failed to import key:', err);
  }
  return null;
}

// Sign and finalize a note (Kind 1)
export function signNote(
  content: string,
  keypair: NostrKeypair,
  tags: string[][] = []
): NostrEvent | null {
  if (!keypair.privkeyHex) {
    return null;
  }
  try {
    const sk = hexToBytes(keypair.privkeyHex);
    const eventTemplate = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content,
    };
    const finalized = finalizeEvent(eventTemplate, sk);
    return {
      ...finalized,
      author: {
        name: keypair.name,
        displayName: keypair.displayName,
        npub: keypair.npub,
        avatar: keypair.avatar,
        nip05: keypair.nip05,
      },
      likesCount: 0,
      repostsCount: 0,
      zapsCount: 0,
      repliesCount: 0,
    };
  } catch (err) {
    console.error('Error signing note:', err);
    return null;
  }
}

export function pubkeyToNpub(pubkeyHex: string): string {
  try {
    return nip19.npubEncode(pubkeyHex);
  } catch {
    return `npub1${pubkeyHex.slice(0, 10)}`;
  }
}

// Sign and finalize a Reaction (Kind 7)
export function signReaction(
  targetEventId: string,
  targetEventPubkey: string,
  keypair: NostrKeypair,
  reactionChar: string = '+'
): any | null {
  if (!keypair.privkeyHex) return null;
  try {
    const sk = hexToBytes(keypair.privkeyHex);
    const template = {
      kind: 7,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', targetEventId],
        ['p', targetEventPubkey],
      ],
      content: reactionChar,
    };
    return finalizeEvent(template, sk);
  } catch (err) {
    console.error('Error signing reaction:', err);
    return null;
  }
}

// Sign and finalize a Repost (Kind 6)
export function signRepost(
  targetEvent: NostrEvent,
  keypair: NostrKeypair
): any | null {
  if (!keypair.privkeyHex) return null;
  try {
    const sk = hexToBytes(keypair.privkeyHex);
    const template = {
      kind: 6,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', targetEvent.id, targetEvent.relayUrl || ''],
        ['p', targetEvent.pubkey],
      ],
      content: targetEvent.content,
    };
    return finalizeEvent(template, sk);
  } catch (err) {
    console.error('Error signing repost:', err);
    return null;
  }
}

export function formatTruncatedKey(key: string, head: number = 8, tail: number = 4): string {
  if (!key) return '';
  if (key.length <= head + tail) return key;
  return `${key.slice(0, head)}...${key.slice(-tail)}`;
}

export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp * 1000) / 1000);
  if (seconds < 60) return `${Math.max(1, seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// Sign and finalize a Profile Metadata event (Kind 0)
export function signProfileMetadata(
  profile: {
    name?: string;
    displayName?: string;
    about?: string;
    avatar?: string;
    nip05?: string;
    lud16?: string;
  },
  keypair: NostrKeypair
): any | null {
  if (!keypair.privkeyHex) return null;
  try {
    const sk = hexToBytes(keypair.privkeyHex);
    const content = JSON.stringify({
      name: profile.name,
      display_name: profile.displayName || profile.name,
      about: profile.about,
      picture: profile.avatar,
      nip05: profile.nip05,
      lud16: profile.lud16,
    });
    const template = {
      kind: 0,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content,
    };
    return finalizeEvent(template, sk);
  } catch (err) {
    console.error('Error signing profile metadata:', err);
    return null;
  }
}

/**
 * Query connected relays for events matching the given filter
 */
export async function queryRelays(
  relays: string[],
  filters: Record<string, unknown>[],
  timeoutMs = 5000
): Promise<any[]> {
  if (typeof WebSocket === 'undefined' || relays.length === 0) return [];

  const byId = new Map<string, any>();
  const sockets: WebSocket[] = [];

  const queryPromise = new Promise<any[]>((resolve) => {
    let respondedRelays = 0;
    let isDone = false;

    const finish = () => {
      if (isDone) return;
      isDone = true;
      sockets.forEach((ws) => {
        try { ws.close(); } catch { /* ignore */ }
      });
      resolve(Array.from(byId.values()));
    };

    const timer = setTimeout(finish, timeoutMs);

    relays.forEach((url) => {
      try {
        const ws = new WebSocket(url);
        sockets.push(ws);

        ws.onopen = () => {
          try {
            ws.send(JSON.stringify(['REQ', `query_${Math.random().toString(36).slice(2, 8)}`, ...filters]));
          } catch {
            // ignore
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data[0] === 'EVENT' && data[2]?.id) {
              byId.set(data[2].id, data[2]);
            } else if (data[0] === 'EOSE') {
              respondedRelays++;
              if (respondedRelays >= relays.length) {
                clearTimeout(timer);
                finish();
              }
            }
          } catch {
            // ignore
          }
        };

        ws.onerror = () => {
          respondedRelays++;
          if (respondedRelays >= relays.length) {
            clearTimeout(timer);
            finish();
          }
        };

        ws.onclose = () => {
          respondedRelays++;
          if (respondedRelays >= relays.length) {
            clearTimeout(timer);
            finish();
          }
        };
      } catch {
        respondedRelays++;
        if (respondedRelays >= relays.length) {
          clearTimeout(timer);
          finish();
        }
      }
    });
  });

  return queryPromise;
}

/**
 * Fetch Kind 0 profile metadata for a pubkey from directory relays and default relays
 */
export async function fetchNostrProfile(pubkeyHex: string, extraRelays: string[] = []): Promise<{
  name?: string;
  displayName?: string;
  about?: string;
  avatar?: string;
  nip05?: string;
  lud16?: string;
} | null> {
  if (!pubkeyHex) return null;

  const directoryRelays = Array.from(new Set([
    'wss://purplepag.es',
    'wss://user.kindpag.es',
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.primal.net',
    'wss://relay.nostr.band',
    'wss://relay.snort.social',
    ...extraRelays,
  ]));

  const events = await queryRelays(directoryRelays, [{ kinds: [0], authors: [pubkeyHex], limit: 1 }], 4000);
  if (!events.length) return null;

  // Pick the newest event
  events.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  for (const ev of events) {
    try {
      const meta = JSON.parse(ev.content);
      const resolvedAvatar = meta.picture || meta.image || meta.avatar || undefined;
      const resolvedName = meta.name || meta.username || undefined;
      const resolvedDisplay = meta.display_name || meta.displayName || resolvedName;
      if (resolvedName || resolvedDisplay || resolvedAvatar || meta.about) {
        return {
          name: resolvedName,
          displayName: resolvedDisplay,
          about: meta.about || meta.bio || undefined,
          avatar: resolvedAvatar,
          nip05: meta.nip05 || undefined,
          lud16: meta.lud16 || meta.lud06 || undefined,
        };
      }
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Fetch authored notes (Kind 1 without reply e tags) for a pubkey
 */
export async function fetchUserNotesFromRelays(pubkeyHex: string, relays: string[]): Promise<any[]> {
  const events = await queryRelays(relays, [{ kinds: [1], authors: [pubkeyHex], limit: 60 }], 4000);
  return events
    .filter((e) => !e.tags?.some((t: string[]) => t[0] === 'e'))
    .sort((a, b) => b.created_at - a.created_at);
}

/**
 * Fetch user replies (Kind 1 with e tags) for a pubkey
 */
export async function fetchUserRepliesFromRelays(pubkeyHex: string, relays: string[]): Promise<any[]> {
  const events = await queryRelays(relays, [{ kinds: [1], authors: [pubkeyHex], limit: 60 }], 4000);
  return events
    .filter((e) => e.tags?.some((t: string[]) => t[0] === 'e'))
    .sort((a, b) => b.created_at - a.created_at);
}

/**
 * Fetch user reactions (Kind 7) for a pubkey
 */
export async function fetchUserReactionsFromRelays(pubkeyHex: string, relays: string[]): Promise<any[]> {
  const events = await queryRelays(relays, [{ kinds: [7], authors: [pubkeyHex], limit: 60 }], 4000);
  return events.sort((a, b) => b.created_at - a.created_at);
}

/**
 * Fetch user contact list (Kind 3) for a pubkey to determine follows/following
 */
export async function fetchUserContactsFromRelays(pubkeyHex: string, relays: string[]): Promise<{
  followingPubkeys: string[];
  followingCount: number;
}> {
  const events = await queryRelays(relays, [{ kinds: [3], authors: [pubkeyHex], limit: 1 }], 4000);
  if (!events.length) {
    return { followingPubkeys: [], followingCount: 0 };
  }
  events.sort((a, b) => b.created_at - a.created_at);
  const latest = events[0];
  const pTags = (latest.tags || []).filter((t: string[]) => t[0] === 'p' && t[1]);
  const followingPubkeys = pTags.map((t: string[]) => t[1]);
  return {
    followingPubkeys,
    followingCount: followingPubkeys.length,
  };
}

/**
 * Publish signed event to an array of relay WebSocket URLs
 */
export async function broadcastEventToRelays(event: any, relayUrls: string[]): Promise<number> {
  let successCount = 0;
  const promises = relayUrls.map((url) => {
    return new Promise<void>((resolve) => {
      try {
        const ws = new WebSocket(url);
        const timer = setTimeout(() => {
          try { ws.close(); } catch { /* ignore */ }
          resolve();
        }, 3500);

        ws.onopen = () => {
          try {
            ws.send(JSON.stringify(['EVENT', event]));
            successCount++;
          } catch {
            // ignore
          }
        };

        ws.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data);
            if (data[0] === 'OK') {
              clearTimeout(timer);
              try { ws.close(); } catch { /* ignore */ }
              resolve();
            }
          } catch {
            // ignore
          }
        };

        ws.onerror = () => {
          clearTimeout(timer);
          resolve();
        };

        ws.onclose = () => {
          clearTimeout(timer);
          resolve();
        };
      } catch {
        resolve();
      }
    });
  });

  await Promise.all(promises);
  return successCount;
}

