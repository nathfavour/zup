import { decodeBech32 } from '../crypto';

export interface PostIntentData {
  content: string;
  kind: number;
  title?: string;
  e: string[];
  p: string[];
  t: string[];
  r: string[];
  media: string[];
  client?: string;
}

/**
 * Safely decodes a Bech32 string (npub1... or note1...) to hex,
 * or returns the trimmed string as-is if it's already hex or unparseable.
 */
export function normalizeBech32OrHex(input: string): string {
  const clean = input.trim();
  if (!clean) return '';

  const lower = clean.toLowerCase();
  if (lower.startsWith('npub1') || lower.startsWith('note1') || lower.startsWith('nsec1')) {
    try {
      const { hex } = decodeBech32(clean);
      if (hex) return hex;
    } catch {
      // Fallback to raw clean string if bech32 parsing fails
    }
  }

  return clean;
}

/**
 * Extracts multiple values from search parameters or input dictionary,
 * supporting both repeated keys (&t=a&t=b) and comma-separated lists (&t=a,b).
 */
function extractMultiValues(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  keys: string[]
): string[] {
  const values: string[] = [];

  for (const key of keys) {
    if (params instanceof URLSearchParams) {
      const rawAll = params.getAll(key);
      for (const item of rawAll) {
        if (!item) continue;
        const parts = item.split(',');
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed) values.push(trimmed);
        }
      }
    } else {
      const raw = params[key];
      if (Array.isArray(raw)) {
        for (const item of raw) {
          if (!item) continue;
          const parts = item.split(',');
          for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed) values.push(trimmed);
          }
        }
      } else if (typeof raw === 'string' && raw.trim()) {
        const parts = raw.split(',');
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed) values.push(trimmed);
        }
      }
    }
  }

  // Deduplicate while preserving order
  return Array.from(new Set(values));
}

/**
 * Parses query parameters into a structured PostIntentData object according to zup compatibility spec.
 */
export function parsePostIntent(
  params: URLSearchParams | Record<string, string | string[] | undefined>
): PostIntentData {
  const getSingle = (keys: string[]): string | undefined => {
    for (const key of keys) {
      if (params instanceof URLSearchParams) {
        const val = params.get(key);
        if (val && val.trim()) return val.trim();
      } else {
        const val = params[key];
        if (typeof val === 'string' && val.trim()) return val.trim();
        if (Array.isArray(val) && val.length > 0 && val[0].trim()) return val[0].trim();
      }
    }
    return undefined;
  };

  const content = getSingle(['content']) || '';

  const rawKind = getSingle(['kind']);
  let kind = 1;
  if (rawKind) {
    const parsed = parseInt(rawKind, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      kind = parsed;
    }
  }

  const title = getSingle(['title', 'subject']);
  const client = getSingle(['client']);

  const rawE = extractMultiValues(params, ['e', 'reply']);
  const e = rawE.map(normalizeBech32OrHex).filter(Boolean);

  const rawP = extractMultiValues(params, ['p', 'mention']);
  const p = rawP.map(normalizeBech32OrHex).filter(Boolean);

  const rawT = extractMultiValues(params, ['t', 'hashtag']);
  const t = rawT.map((tag) => tag.replace(/^#/, '').trim()).filter(Boolean);

  const r = extractMultiValues(params, ['r', 'url']);
  const media = extractMultiValues(params, ['media', 'image', 'video']);

  return {
    content,
    kind,
    title,
    e,
    p,
    t,
    r,
    media,
    client
  };
}

/**
 * Builds standard NIP Nostr tags array from a PostIntentData object.
 */
export function buildIntentTags(intent: PostIntentData): string[][] {
  const tags: string[][] = [];

  // Title / Subject
  if (intent.title) {
    tags.push(['title', intent.title]);
    if (intent.kind === 30023) {
      const slug = intent.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      tags.push(['d', slug || 'article']);
    }
  }

  // Event references / replies ('e')
  for (const eventId of intent.e) {
    tags.push(['e', eventId]);
  }

  // Pubkey mentions / tags ('p')
  for (const pubkey of intent.p) {
    tags.push(['p', pubkey]);
  }

  // Hashtags ('t')
  for (const tag of intent.t) {
    tags.push(['t', tag]);
  }

  // External URLs ('r')
  for (const url of intent.r) {
    tags.push(['r', url]);
  }

  // Media attachments ('r' and 'image')
  for (const mediaUrl of intent.media) {
    // Avoid duplicate 'r' tag if already present in r array
    if (!intent.r.includes(mediaUrl)) {
      tags.push(['r', mediaUrl]);
    }
    tags.push(['image', mediaUrl]);
  }

  // Client attribution ('client')
  if (intent.client) {
    tags.push(['client', intent.client]);
  }

  return tags;
}
