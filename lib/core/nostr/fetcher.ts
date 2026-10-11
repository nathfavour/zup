import WebSocket from 'ws';
import { generateLocalIdenticon } from './index';

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
  'wss://relay.damus.io'
];

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
  const author = profile?.display_name || profile?.name || `user_${event.pubkey.slice(0, 6)}`;
  const handle = profile?.nip05 ? `@${profile.nip05}` : `@${event.pubkey.slice(0, 6)}…${event.pubkey.slice(-4)}`;
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
