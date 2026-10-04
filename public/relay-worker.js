// relay-worker.js: SharedWorker for multiplexed relay WebSockets and deduplication

const ports = new Set();
const sockets = new Map();
const seenEvents = new Set();
const DEFAULT_RELAYS = [
  'wss://nos.lol',
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nostr.wine'
];

self.onconnect = function(e) {
  const port = e.ports[0];
  ports.add(port);

  port.onmessage = function(event) {
    const data = event.data;
    if (!data) return;

    if (data.type === 'SUBSCRIBE') {
      ensureRelayConnected(data.relayUrl || 'wss://nos.lol', data.filters);
    } else if (data.type === 'BROADCAST') {
      broadcastToSockets(data.payload);
    }
  };

  port.start();
  port.postMessage({ type: 'STATUS', message: 'SharedWorker active' });
};

function ensureRelayConnected(url, filters) {
  if (sockets.has(url)) return;
  try {
    const ws = new WebSocket(url);
    sockets.set(url, ws);

    ws.onopen = () => {
      const subId = 'sw_' + Math.random().toString(36).substring(2, 7);
      ws.send(JSON.stringify(['REQ', subId, filters || { kinds: [1, 30023], limit: 20 }]));
    };

    ws.onmessage = (msgEv) => {
      try {
        const payload = JSON.parse(msgEv.data);
        if (Array.isArray(payload) && payload[0] === 'EVENT') {
          const ev = payload[2];
          if (!seenEvents.has(ev.id)) {
            seenEvents.add(ev.id);
            ports.forEach(p => p.postMessage({ type: 'EVENT', event: ev, relayUrl: url }));
          }
        }
      } catch {}
    };
  } catch {}
}

function broadcastToSockets(payload) {
  const msg = JSON.stringify(['EVENT', payload]);
  sockets.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  });
}
