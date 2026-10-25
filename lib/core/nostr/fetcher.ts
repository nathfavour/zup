import WebSocket from 'ws';
import { generateLocalIdenticon, formatHex, getProfileDisplayName, getProfileHandle } from './index';
import { hexToNpub } from '../crypto';
import { ProfileMetadata } from '../types';
import { db } from '../../db';

export interface FetchedNostrPost {
  id: string;
  pubkey: string;
  author: string;
  handle: string;
  content: string;
  picture: string;
  created_at: number;
  date: string;
  tags: string[][];
  sig: string;
}

const DEFAULT_RELAYS = [
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.damus.io',
  'wss://nostr.wine'
];

/**
 * Fetches Kind 0 profile metadata directly from Nostr relays for a given pubkey
 */
export async function fetchNostrProfile(pubkey: string): Promise<ProfileMetadata | null> {
  if (!pubkey) return null;

  const WS = typeof window !== 'undefined' && (window as any).WebSocket ? (window as any).WebSocket : WebSocket;

  return new Promise((resolve) => {
    let resolved = false;
    let fetchedProfile: ProfileMetadata | null = null;
    let activeSockets = DEFAULT_RELAYS.length;
    const sockets: any[] = [];

    const cleanupAndResolve = (result: ProfileMetadata | null) => {
      if (resolved) return;
      resolved = true;
      sockets.forEach((ws) => {
        try {
          ws.close();
        } catch {}
      });

      resolve(result);
    };

    const globalTimeout = setTimeout(() => {
      if (!resolved) {
        cleanupAndResolve(fetchedProfile);
      }
    }, 3000);

    DEFAULT_RELAYS.forEach((url) => {
      const handleCloseOrError = () => {
        activeSockets--;
        if (activeSockets <= 0 && !resolved) {
          clearTimeout(globalTimeout);
          cleanupAndResolve(fetchedProfile);
        }
      };

      try {
        const ws = new (WS as any)(url);
        sockets.push(ws);

        const subId = 'prof_fetch_' + Math.random().toString(36).substring(2, 7);

        ws.onopen = () => {
          try {
            ws.send(JSON.stringify(['REQ', subId, { kinds: [0], authors: [pubkey], limit: 1 }]));
          } catch {}
        };

        ws.onmessage = async (msgEvent: any) => {
          try {
            const dataStr = typeof msgEvent.data === 'string' ? msgEvent.data : msgEvent.data.toString();
            const msg = JSON.parse(dataStr);

            if (Array.isArray(msg) && msg[0] === 'EVENT' && msg[2] && msg[2].kind === 0) {
              const ev = msg[2];
              if (ev.pubkey === pubkey && ev.content) {
                let metadata: any = {};
                try {
                  metadata = JSON.parse(ev.content);
                } catch {}

                const profileObj: ProfileMetadata = {
                  pubkey: ev.pubkey,
                  content: ev.content,
                  name: metadata.name,
                  display_name: metadata.display_name || metadata.name,
                  picture: metadata.picture || generateLocalIdenticon(ev.pubkey),
                  nip05: metadata.nip05,
                  about: metadata.about,
                  website: metadata.website,
                  banner: metadata.banner,
                  lud16: metadata.lud16 || metadata.lud06,
                  updated_at: ev.created_at || Math.floor(Date.now() / 1000),
                  cached_at: Date.now()
                };

                fetchedProfile = profileObj;

                if (typeof window !== 'undefined') {
                  try {
                    await db.profiles.put(profileObj);
                  } catch {}
                }

                clearTimeout(globalTimeout);
                cleanupAndResolve(profileObj);
              }
            } else if (Array.isArray(msg) && msg[0] === 'EOSE' && msg[1] === subId) {
              if (fetchedProfile) {
                clearTimeout(globalTimeout);
                cleanupAndResolve(fetchedProfile);
              }
            }
          } catch {}
        };

        ws.onerror = handleCloseOrError;
        ws.onclose = handleCloseOrError;
      } catch {
        handleCloseOrError();
      }
    });
  });
}

/**
 * Fetches a Nostr event and its author profile directly from Nostr relays (Server or Client side)
 */
export async function fetchNostrEventAndProfile(eventId: string): Promise<FetchedNostrPost | null> {
  if (!eventId) return null;

  // Use native WebSocket in browser or 'ws' module in Node.js server environment
  const WS = typeof window !== 'undefined' && (window as any).WebSocket ? (window as any).WebSocket : WebSocket;

  return new Promise((resolve) => {
    let resolved = false;
    let rawEvent: any = null;
    let rawProfile: any = null;
    let activeSockets = DEFAULT_RELAYS.length;
    const sockets: any[] = [];

    const cleanupAndResolve = (result: FetchedNostrPost | null) => {
      if (resolved) return;
      resolved = true;
      sockets.forEach((ws) => {
        try {
          ws.close();
        } catch {}
      });

      resolve(result);
    };

    // Global timeout to prevent hanging server or client rendering
    const globalTimeout = setTimeout(() => {
      if (!resolved) {
        if (rawEvent) {
          cleanupAndResolve(buildFetchedPost(rawEvent, rawProfile));
        } else {
          cleanupAndResolve(null);
        }
      }
    }, 3000);

    DEFAULT_RELAYS.forEach((url) => {
      const handleCloseOrError = () => {
        activeSockets--;
        if (activeSockets <= 0 && !resolved) {
          clearTimeout(globalTimeout);
          if (rawEvent) {
            cleanupAndResolve(buildFetchedPost(rawEvent, rawProfile));
          } else {
            cleanupAndResolve(null);
          }
        }
      };

      try {
        const ws = new (WS as any)(url);
        sockets.push(ws);

        const subIdEv = 'fetch_ev_' + Math.random().toString(36).substring(2, 7);
        let subIdProf = '';

        ws.onopen = () => {
          try {
            ws.send(JSON.stringify(['REQ', subIdEv, { ids: [eventId] }]));
          } catch {}
        };

        ws.onmessage = (msgEvent: any) => {
          try {
            const dataStr = typeof msgEvent.data === 'string' ? msgEvent.data : msgEvent.data.toString();
            const msg = JSON.parse(dataStr);

            if (Array.isArray(msg) && msg[0] === 'EVENT' && msg[2]) {
              const ev = msg[2];

              // Matching target Event
              if (ev.id === eventId && !rawEvent) {
                rawEvent = ev;
                subIdProf = 'fetch_prof_' + Math.random().toString(36).substring(2, 7);
                try {
                  ws.send(JSON.stringify(['REQ', subIdProf, { kinds: [0], authors: [ev.pubkey], limit: 1 }]));
                } catch {}
              }

              // Matching Author Profile (Kind 0)
              if (ev.kind === 0 && rawEvent && ev.pubkey === rawEvent.pubkey) {
                try {
                  rawProfile = JSON.parse(ev.content);
                } catch {}

                clearTimeout(globalTimeout);
                cleanupAndResolve(buildFetchedPost(rawEvent, rawProfile));
              }
            } else if (Array.isArray(msg) && msg[0] === 'EOSE') {
              if (msg[1] === subIdProf && rawEvent) {
                clearTimeout(globalTimeout);
                cleanupAndResolve(buildFetchedPost(rawEvent, rawProfile));
              }
            }
          } catch {}
        };

        ws.onerror = handleCloseOrError;
        ws.onclose = handleCloseOrError;
      } catch {
        handleCloseOrError();
      }
    });
  });
}

function buildFetchedPost(event: any, profile: any): FetchedNostrPost {
  const author = profile
    ? getProfileDisplayName(
        {
          pubkey: event.pubkey,
          content: '',
          name: profile.name,
          display_name: profile.display_name,
          cached_at: Date.now(),
          updated_at: event.created_at
        },
        event.pubkey
      )
    : getProfileDisplayName(null, event.pubkey);

  const handle = profile
    ? getProfileHandle(
        {
          pubkey: event.pubkey,
          content: '',
          name: profile.name,
          nip05: profile.nip05,
          cached_at: Date.now(),
          updated_at: event.created_at
        },
        event.pubkey
      )
    : getProfileHandle(null, event.pubkey);

  const picture = profile?.picture || generateLocalIdenticon(event.pubkey);
  const created_at = event.created_at || Math.floor(Date.now() / 1000);
  const date = new Date(created_at * 1000).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return {
    id: event.id,
    pubkey: event.pubkey,
    author,
    handle,
    content: event.content || '',
    picture,
    created_at,
    date,
    tags: event.tags || [],
    sig: event.sig || ''
  };
}
