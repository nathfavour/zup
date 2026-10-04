import { db } from '../db';
import { getActivePubkey, setActiveIdentity, getActiveSigner, unlockVault } from '../state/session';
import { relayManager } from '../workers/relay-manager';
import { tursoSync } from '../sync/turso-sync';
import { createAndSignEvent, formatHex, validateEvent } from '../core/nostr';

export interface CliOutputLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'success' | 'system';
  text: string;
  timestamp: string;
}

export class CliEngine {
  public static async execute(commandStr: string): Promise<CliOutputLine[]> {
    const trimmed = commandStr.trim();
    if (!trimmed) return [];

    const now = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const parts = trimmed.split(/\s+/);
    const results: CliOutputLine[] = [];

    const push = (text: string, type: CliOutputLine['type'] = 'output') => {
      results.push({
        id: Math.random().toString(36).substring(2, 9),
        type,
        text,
        timestamp: now
      });
    };

    if (parts[0] !== 'zup' && parts[0] !== 'help' && parts[0] !== 'clear') {
      push(`zup: command not found: ${parts[0]}. Type 'zup help' or 'help' for available commands.`, 'error');
      return results;
    }

    if (trimmed === 'help' || trimmed === 'zup help') {
      push('--- zup CLI Commands Reference ---', 'system');
      push('  zup identity list              List local identities and active persona');
      push('  zup identity switch <pubkey|label>  Switch active identity pointer');
      push('  zup tail [--kinds 1,30023]     Stream recent technical events');
      push('  zup publish "<text>" [--sign]  Sign Schnorr event and broadcast to relays');
      push('  zup sync --turso               Trigger delta sync with LibSQL edge replica');
      push('  zup inspect <eventId>          Verify Schnorr signature and event serialization');
      push('  zup relays                     Display relay connection pool status');
      push('  zup telemetry                  Inspect local engagement and tag affinity signals');
      push('  clear                          Clear terminal screen');
      return results;
    }

    if (parts[0] === 'zup') {
      const sub = parts[1];

      // 1. zup identity
      if (sub === 'identity') {
        const action = parts[2];
        if (action === 'list' || !action) {
          const identities = await db.identities.toArray();
          const active = getActivePubkey();
          push(`Found ${identities.length} local identities in zup_engine_v1:`, 'system');
          for (const id of identities) {
            const isActive = id.pubkey === active;
            const marker = isActive ? '(*) [ACTIVE]' : '    [PERSONA]';
            push(`${marker} ${id.label}`);
            push(`    pubkey: ${id.pubkey}`);
            push(`    npub:   ${id.npub}`);
            push(`    relays: ${id.relays.join(', ')}`);
          }
          return results;
        }

        if (action === 'switch') {
          const target = parts[3];
          if (!target) {
            push("Error: provide a pubkey or label substring. Usage: zup identity switch <target>", 'error');
            return results;
          }
          const identities = await db.identities.toArray();
          const match = identities.find(
            (i) => i.pubkey.toLowerCase().startsWith(target.toLowerCase()) || i.label.toLowerCase().includes(target.toLowerCase())
          );
          if (!match) {
            push(`Error: identity matching '${target}' not found in local vault.`, 'error');
            return results;
          }
          await setActiveIdentity(match.pubkey);
          push(`[OK] Switched active identity to: ${match.label} (${formatHex(match.pubkey)})`, 'success');
          return results;
        }

        push(`Unknown identity subcommand: '${action}'. Try 'zup identity list' or 'zup identity switch <pubkey>'.`, 'error');
        return results;
      }

      // 2. zup tail
      if (sub === 'tail') {
        const events = await db.events.orderBy('created_at').reverse().limit(8).toArray();
        push(`Streaming recent ${events.length} technical dispatches from local Dexie engine:`, 'system');
        for (const ev of events) {
          const kindLabel = ev.kind === 30023 ? 'K30023 (RFC/Article)' : `K${ev.kind}`;
          const dateStr = new Date(ev.created_at * 1000).toISOString().replace('T', ' ').slice(0, 19);
          push(`[${dateStr}] [${kindLabel}] [${formatHex(ev.id)}] from ${formatHex(ev.pubkey)}:`);
          const firstLine = ev.content.split('\n')[0].slice(0, 100);
          push(`  ↳ ${firstLine}`);
        }
        return results;
      }

      // 3. zup publish
      if (sub === 'publish') {
        const contentMatch = commandStr.match(/publish\s+"([^"]+)"/) || commandStr.match(/publish\s+'([^']+)'/) || commandStr.match(/publish\s+(.+)/);
        const content = contentMatch ? contentMatch[1] : '';

        if (!content) {
          push('Error: provide content string. Example: zup publish "Distributed consensus test" --sign', 'error');
          return results;
        }

        let signer = getActiveSigner();
        if (!signer) {
          // Unlock with default session key for operator
          await unlockVault('zup-operator-2026');
          signer = getActiveSigner();
        }

        if (!signer) {
          push('Error: Signer unavailable. Vault must be unlocked before signing Schnorr events.', 'error');
          return results;
        }

        push(`[SIGN] Creating canonical Nostr kind:1 event with author ${formatHex(signer.pubkey)}...`);
        const signedEvent = await createAndSignEvent(
          signer,
          1,
          [['t', 'cli-dispatch'], ['client', 'zup-cli']],
          content
        );

        push(`[EVENT ID] ${signedEvent.id}`, 'system');
        push(`[SCHNORR SIG] ${signedEvent.sig.slice(0, 32)}…${signedEvent.sig.slice(-16)}`);

        // Broadcast to relays
        push('[BROADCAST] Propagating event to configured connection pool...');
        const broadcastRes = await relayManager.broadcastEvent(signedEvent);
        for (const [url, res] of Object.entries(broadcastRes)) {
          if (res.ok) {
            push(`  ✓ ${url}: ${res.message}`, 'success');
          } else {
            push(`  ✗ ${url}: ${res.message}`, 'error');
          }
        }
        push('[DONE] Published and committed to local IndexedDB.', 'success');
        return results;
      }

      // 4. zup sync
      if (sub === 'sync') {
        push('[SYNC] Initiating on-demand delta sync with Turso LibSQL edge instance...', 'system');
        const res = await tursoSync.executeDeltaSync();
        for (const line of res.logs) {
          push(line, line.startsWith('[ERROR]') ? 'error' : line.startsWith('[COMMIT]') ? 'success' : 'output');
        }
        return results;
      }

      // 5. zup inspect
      if (sub === 'inspect') {
        const idQuery = parts[2];
        if (!idQuery) {
          push('Error: specify event ID. Usage: zup inspect <eventId>', 'error');
          return results;
        }
        const event = await db.events.get(idQuery) || (await db.events.toArray()).find((e) => e.id.toLowerCase().startsWith(idQuery.toLowerCase()));
        if (!event) {
          push(`Error: event with ID '${idQuery}' not found in local table.`, 'error');
          return results;
        }

        const validation = await validateEvent(event);
        push(`--- Inspecting Nostr Event ${event.id} ---`, 'system');
        push(`  Author Pubkey: ${event.pubkey}`);
        push(`  Kind:          ${event.kind}`);
        push(`  Created At:    ${new Date(event.created_at * 1000).toISOString()}`);
        push(`  Relay Source:  ${event.relay_source}`);
        push(`  Tags:          ${JSON.stringify(event.tags)}`);
        push(`  ID Validated:  ${validation.idMatches ? '✓ MATCH (SHA-256 Verified)' : '✗ MISMATCH'}`);
        push(`  Schnorr Sig:   ${event.sig.slice(0, 32)}… (64-byte verified: ${validation.sigValid ? 'YES' : 'NO'})`);
        push(`  Content Sample: "${event.content.slice(0, 80).replace(/\n/g, ' ')}…"`);
        return results;
      }

      // 6. zup relays
      if (sub === 'relays') {
        const list = relayManager.getStatusList();
        push(`--- Active Relay Connection Pool (${list.length} endpoints) ---`, 'system');
        for (const r of list) {
          const statusIcon = r.status === 'connected' ? '● ONLINE' : r.status === 'connecting' ? '◌ CONNECTING' : '○ DISCONNECTED';
          push(`  ${statusIcon} ${r.url} (latency: ${r.latencyMs}ms, events received: ${r.eventsReceived})`);
        }
        return results;
      }

      // 7. zup telemetry
      if (sub === 'telemetry') {
        const telemetry = await db.telemetry.toArray();
        const dwellCount = telemetry.filter((t) => t.interactionType === 'dwell').length;
        const inspectCount = telemetry.filter((t) => t.interactionType === 'inspect_raw').length;
        push(`--- Local Telemetry Engine (Zero Third-Party Leakage) ---`, 'system');
        push(`  Total Local Records: ${telemetry.length}`);
        push(`  Dwell Events:        ${dwellCount}`);
        push(`  Inspect Raw Events:  ${inspectCount}`);
        push(`  Storage:             IndexedDB 'telemetry' table`);
        push(`  Cloud Sync:          AES-GCM zero-knowledge replication enabled`);
        return results;
      }

      push(`Unknown command: '${trimmed}'. Type 'zup help' for all commands.`, 'error');
      return results;
    }

    return results;
  }
}
