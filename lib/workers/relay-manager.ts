import { RelayStatus, LocalEvent } from '../core/types';
import { db } from '../db';
import { validateEvent } from '../core/nostr';

export const DEFAULT_RELAYS = [
  'wss://nos.lol',
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nostr.wine'
];

interface RelaySocketState {
  url: string;
  ws: WebSocket | null;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  latencyMs: number;
  eventsReceived: number;
  lastPing: number;
  reconnectAttempts: number;
}

class RelayManager {
  private relays: Map<string, RelaySocketState> = new Map();
  private seenEventIds: Set<string> = new Set();
  private batchBuffer: LocalEvent[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private listeners: Set<(statuses: RelayStatus[]) => void> = new Set();
  private eventListeners: Set<(event: LocalEvent) => void> = new Set();
  private isInitialized = false;

  constructor() {
    DEFAULT_RELAYS.forEach((url) => {
      this.relays.set(url, {
        url,
        ws: null,
        status: 'disconnected',
        latencyMs: 0,
        eventsReceived: 0,
        lastPing: Date.now(),
        reconnectAttempts: 0
      });
    });
  }

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // Connect to each default relay
    this.relays.forEach((state) => {
      this.connectRelay(state.url);
    });

    // Start 100ms batch ingestion loop
    this.startBatchLoop();
  }

  public subscribeStatus(listener: (statuses: RelayStatus[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatusList());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onNewEvent(listener: (event: LocalEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  public getStatusList(): RelayStatus[] {
    return Array.from(this.relays.values()).map((r) => ({
      url: r.url,
      status: r.status,
      latencyMs: r.latencyMs,
      eventsReceived: r.eventsReceived,
      lastPing: r.lastPing
    }));
  }

  public addRelay(url: string) {
    if (this.relays.has(url)) return;
    this.relays.set(url, {
      url,
      ws: null,
      status: 'disconnected',
      latencyMs: 0,
      eventsReceived: 0,
      lastPing: Date.now(),
      reconnectAttempts: 0
    });
    this.connectRelay(url);
    this.notify();
  }

  public removeRelay(url: string) {
    const state = this.relays.get(url);
    if (state?.ws) {
      try {
        state.ws.close();
      } catch {}
    }
    this.relays.delete(url);
    this.notify();
  }

  private notify() {
    const list = this.getStatusList();
    this.listeners.forEach((fn) => fn(list));
  }

  public connectRelay(url: string) {
    const state = this.relays.get(url);
    if (!state) return;

    if (state.ws && (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    state.status = 'connecting';
    this.notify();

    const connectStartTime = performance.now();

    try {
      const ws = new WebSocket(url);
      state.ws = ws;

      ws.onopen = () => {
        state.status = 'connected';
        state.latencyMs = Math.round(performance.now() - connectStartTime);
        state.lastPing = Date.now();
        state.reconnectAttempts = 0;
        this.notify();

        // Subscribe to technical kinds (Kind 1 & Kind 30023) with strict limit for bandwidth zero-waste
        const subId = 'zup_sub_' + Math.random().toString(36).substring(2, 8);
        const reqMsg = JSON.stringify([
          'REQ',
          subId,
          {
            kinds: [1, 30023],
            limit: 25
          }
        ]);
        try {
          ws.send(reqMsg);
        } catch {}
      };

      ws.onmessage = async (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (Array.isArray(msg) && msg[0] === 'EVENT' && msg[2]) {
            const rawEvent = msg[2];
            state.eventsReceived += 1;
            this.handleIncomingRawEvent(rawEvent, url);
          }
        } catch {}
      };

      ws.onerror = () => {
        state.status = 'error';
        this.notify();
      };

      ws.onclose = () => {
        state.status = 'disconnected';
        state.ws = null;
        this.notify();

        // Soft backoff reconnection
        if (state.reconnectAttempts < 5) {
          state.reconnectAttempts++;
          setTimeout(() => {
            this.connectRelay(url);
          }, 3000 * state.reconnectAttempts);
        }
      };
    } catch {
      state.status = 'error';
      this.notify();
    }
  }

  private async handleIncomingRawEvent(raw: any, relayUrl: string) {
    if (!raw.id || this.seenEventIds.has(raw.id)) return;
    this.seenEventIds.add(raw.id);

    // Keep Bloom filter / LRU bounded to 10,000 items
    if (this.seenEventIds.size > 10000) {
      const firstItems = Array.from(this.seenEventIds).slice(0, 2000);
      firstItems.forEach((id) => this.seenEventIds.delete(id));
    }

    const localEv: LocalEvent = {
      id: raw.id,
      pubkey: raw.pubkey,
      kind: raw.kind,
      created_at: raw.created_at,
      tags: raw.tags || [],
      content: raw.content || '',
      sig: raw.sig || '',
      first_seen_at: Date.now(),
      relay_source: relayUrl
    };

    // Buffer for batch ingestion
    this.batchBuffer.push(localEv);
    this.eventListeners.forEach((fn) => fn(localEv));
  }

  private startBatchLoop() {
    this.batchTimer = setInterval(async () => {
      if (this.batchBuffer.length === 0) return;
      const batch = this.batchBuffer.splice(0, this.batchBuffer.length);
      try {
        await db.events.bulkPut(batch);
      } catch {}
    }, 100);
  }

  /**
   * Broadcast an event to all connected relays and return delivery statuses
   */
  public async broadcastEvent(event: LocalEvent): Promise<Record<string, { ok: boolean; message?: string }>> {
    const results: Record<string, { ok: boolean; message?: string }> = {};
    const eventMsg = JSON.stringify(['EVENT', event]);

    // Save locally to Dexie first (Local-first principle)
    await db.events.put(event);

    const promises = Array.from(this.relays.entries()).map(async ([url, state]) => {
      if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        try {
          state.ws.send(eventMsg);
          results[url] = { ok: true, message: 'Broadcast dispatched' };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Send failed';
          results[url] = { ok: false, message };
        }
      } else {
        results[url] = { ok: false, message: 'Relay disconnected' };
      }
    });

    await Promise.all(promises);
    return results;
  }
}

export const relayManager = new RelayManager();
