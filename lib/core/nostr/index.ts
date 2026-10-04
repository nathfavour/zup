import { sha256Hex, schnorrSign, schnorrVerify } from '../crypto';
import { LocalEvent } from '../types';

/**
 * Serializes a Nostr event canonically as per NIP-01:
 * [0, <pubkey: lowercase hex>, <created_at: number>, <kind: number>, <tags: array of arrays>, <content: string>]
 */
export function serializeEvent(event: {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}): string {
  return JSON.stringify([
    0,
    event.pubkey.toLowerCase(),
    event.created_at,
    event.kind,
    event.tags,
    event.content
  ]);
}

/**
 * Calculates SHA-256 event ID for canonical event serialization
 */
export async function calculateEventId(event: {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}): Promise<string> {
  const serialized = serializeEvent(event);
  return await sha256Hex(serialized);
}

/**
 * Creates and signs a real Nostr event
 */
export async function createAndSignEvent(
  signer: { pubkey: string; privkey: string },
  kind: number,
  tags: string[][],
  content: string,
  relaySource = 'local'
): Promise<LocalEvent> {
  const created_at = Math.floor(Date.now() / 1000);
  const pubkey = signer.pubkey.toLowerCase();

  const id = await calculateEventId({
    pubkey,
    created_at,
    kind,
    tags,
    content
  });

  const sig = await schnorrSign(id, signer.privkey);

  return {
    id,
    pubkey,
    kind,
    created_at,
    tags,
    content,
    sig,
    first_seen_at: Date.now(),
    relay_source: relaySource
  };
}

/**
 * Validates canonical event integrity and Schnorr signature
 */
export async function validateEvent(event: LocalEvent): Promise<{
  isValid: boolean;
  computedId: string;
  idMatches: boolean;
  sigValid: boolean;
  reason?: string;
}> {
  try {
    const computedId = await calculateEventId({
      pubkey: event.pubkey,
      created_at: event.created_at,
      kind: event.kind,
      tags: event.tags,
      content: event.content
    });

    const idMatches = computedId === event.id;
    const sigValid = await schnorrVerify(computedId, event.sig, event.pubkey);

    return {
      isValid: idMatches && sigValid,
      computedId,
      idMatches,
      sigValid,
      reason: !idMatches
        ? 'Event hash mismatch'
        : !sigValid
        ? 'Schnorr signature validation failed'
        : undefined
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown validation error';
    return {
      isValid: false,
      computedId: '',
      idMatches: false,
      sigValid: false,
      reason: message
    };
  }
}

/**
 * Extracts hashtags (#tags) from event tags
 */
export function extractEventTags(tags: string[][]): string[] {
  return tags
    .filter(([t]) => t === 't')
    .map(([, val]) => val)
    .filter(Boolean);
}

/**
 * Truncate pubkey or hash with ellipsis
 */
export function formatHex(hex: string, front = 8, back = 6): string {
  if (!hex || hex.length <= front + back) return hex;
  return `${hex.slice(0, front)}…${hex.slice(-back)}`;
}
