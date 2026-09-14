import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools';
import * as nip19 from 'nostr-tools/nip19';
import { NostrEvent, NostrKeypair, RelayInfo } from '../types';

/**
 * Generate a local, offline SVG identicon data URI from any pubkey/seed
 * Eliminates external network fetches (e.g. Dicebear) to save data & battery.
 */
export function generateLocalIdenticon(seed: string): string {
  if (!seed) seed = 'anonymous';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }

  const hue1 = Math.abs(hash) % 360;
  const hue2 = (hue1 + 140) % 360;
  const c1 = `hsl(${hue1}, 75%, 60%)`;
  const c2 = `hsl(${hue2}, 85%, 45%)`;
  const bg = `hsl(${(hue1 + 220) % 360}, 25%, 12%)`;

  let rects = '';
  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 5; y++) {
      const charIndex = (x * 5 + y) % seed.length;
      const val = seed.charCodeAt(charIndex) + hash;
      if (val % 2 === 0) {
        const fill = (x + y) % 2 === 0 ? c1 : c2;
        rects += `<rect x="${x * 20}" y="${y * 20}" width="20" height="20" fill="${fill}"/>`;
        if (x < 2) {
          rects += `<rect x="${(4 - x) * 20}" y="${y * 20}" width="20" height="20" fill="${fill}"/>`;
        }
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="${bg}"/>${rects}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

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
    url: 'wss://relay.primal.net',
    status: 'connected',
    read: true,
    write: true,
    eventsReceived: 0,
    eventsSent: 0,
    latencyMs: 42,
    description: 'Primal High-Speed Caching & Search Relay',
    isDefault: true,
  },
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
    avatar: generateLocalIdenticon(pubHex),
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
          avatar: generateLocalIdenticon(pubHex),
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
          avatar: generateLocalIdenticon(pubHex),
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
          avatar: generateLocalIdenticon(pubHex),
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
          avatar: generateLocalIdenticon(trimmed),
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
 * Fetch account profile stats (followers, following, metadata) from Primal Cache REST API
 */
export async function fetchPrimalAccountStats(pubkeyHex: string): Promise<{
  followersCount?: number;
  followingCount?: number;
  profile?: {
    name?: string;
    displayName?: string;
    about?: string;
    avatar?: string;
    nip05?: string;
    lud16?: string;
  };
} | null> {
  if (!pubkeyHex) return null;
  try {
    const response = await fetch('https://cache2.primal.net/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['user_profile', { pubkey: pubkeyHex }]),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!Array.isArray(data)) return null;

    let followersCount: number | undefined;
    let followingCount: number | undefined;
    let profile: { name?: string; displayName?: string; about?: string; avatar?: string; nip05?: string; lud16?: string } | undefined;

    for (const item of data) {
      if (item.kind === 10000105 && item.content) {
        try {
          const stats = JSON.parse(item.content);
          if (typeof stats.followers_count === 'number') followersCount = stats.followers_count;
          if (typeof stats.follows_count === 'number') followingCount = stats.follows_count;
        } catch {
          // ignore
        }
      } else if (item.kind === 0 && item.content) {
        try {
          const meta = JSON.parse(item.content);
          const resolvedAvatar = meta.picture || meta.image || meta.avatar || undefined;
          const resolvedName = meta.name || meta.username || undefined;
          const resolvedDisplay = meta.display_name || meta.displayName || resolvedName;
          profile = {
            name: resolvedName,
            displayName: resolvedDisplay,
            about: meta.about || meta.bio || undefined,
            avatar: resolvedAvatar,
            nip05: meta.nip05 || undefined,
            lud16: meta.lud16 || meta.lud06 || undefined,
          };
        } catch {
          // ignore
        }
      }
    }

    if (followersCount !== undefined || followingCount !== undefined || profile) {
      return { followersCount, followingCount, profile };
    }
  } catch (err) {
    console.warn('Primal API account lookup fallback failed:', err);
  }
  return null;
}

/**
 * Fetch Kind 0 profile metadata for a pubkey from directory relays and default relays with Primal fallback
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
    ...(extraRelays.length > 0 ? extraRelays : ['wss://purplepag.es', 'wss://user.kindpag.es', 'wss://relay.damus.io']),
  ])).slice(0, 3);

  const events = await queryRelays(directoryRelays, [{ kinds: [0], authors: [pubkeyHex], limit: 1 }], 2500);
  if (events.length) {
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
  }

  // Fall back to Primal API if relay query returned nothing or missing metadata
  const primalData = await fetchPrimalAccountStats(pubkeyHex);
  if (primalData?.profile) {
    return primalData.profile;
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
  followersCount: number;
}> {
  const eventsPromise = queryRelays(relays, [{ kinds: [3], authors: [pubkeyHex], limit: 1 }], 4000);
  const followerEventsPromise = queryRelays(relays, [{ kinds: [3], '#p': [pubkeyHex], limit: 200 }], 4000);
  const primalPromise = fetchPrimalAccountStats(pubkeyHex);

  const [events, followerEvents, primalData] = await Promise.all([
    eventsPromise,
    followerEventsPromise,
    primalPromise,
  ]);

  let followingPubkeys: string[] = [];
  let followingCount = 0;
  let followersCount = followerEvents.length;

  if (events.length) {
    events.sort((a, b) => b.created_at - a.created_at);
    const latest = events[0];
    const pTags = (latest.tags || []).filter((t: string[]) => t[0] === 'p' && t[1]);
    followingPubkeys = pTags.map((t: string[]) => t[1]);
    followingCount = followingPubkeys.length;
  }

  // Fall back to or augment with Primal account stats if Primal returned higher accurate numbers
  if (primalData) {
    if (typeof primalData.followersCount === 'number' && primalData.followersCount > followersCount) {
      followersCount = primalData.followersCount;
    }
    if (typeof primalData.followingCount === 'number' && !events.length) {
      followingCount = primalData.followingCount;
    }
  }

  return {
    followingPubkeys,
    followingCount,
    followersCount,
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

