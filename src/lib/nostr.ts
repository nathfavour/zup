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
    url: 'wss://relay.damus.io',
    status: 'connected',
    read: true,
    write: true,
    eventsReceived: 142,
    eventsSent: 12,
    latencyMs: 78,
    description: 'Damus Global Relay (US East)',
    isDefault: true,
  },
  {
    url: 'wss://nos.lol',
    status: 'connected',
    read: true,
    write: true,
    eventsReceived: 98,
    eventsSent: 8,
    latencyMs: 95,
    description: 'Community Censorship-Resistant Node',
    isDefault: true,
  },
  {
    url: 'wss://relay.nostr.band',
    status: 'connected',
    read: true,
    write: true,
    eventsReceived: 210,
    eventsSent: 15,
    latencyMs: 110,
    description: 'High Performance Discovery & Search Relay',
    isDefault: true,
  },
  {
    url: 'wss://relay.snort.social',
    status: 'connected',
    read: true,
    write: false,
    eventsReceived: 84,
    eventsSent: 0,
    latencyMs: 124,
    description: 'Snort Global Read Relay',
    isDefault: true,
  },
  {
    url: 'wss://relay.primal.net',
    status: 'connected',
    read: true,
    write: true,
    eventsReceived: 165,
    eventsSent: 14,
    latencyMs: 64,
    description: 'Primal High-Speed Media & Event Cache',
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
          name: `Nostr_${pubHex.slice(0, 6)}`,
          displayName: 'Decentralized Peer',
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
          name: `Watch_${pubHex.slice(0, 6)}`,
          displayName: 'Watch-Only Peer',
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
