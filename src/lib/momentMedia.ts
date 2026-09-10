/**
 * Nostr Media & Preview Substrate for Zup
 * Extracts image URLs from NIP-92 (imeta tag), NIP-94, and inline media URLs in content.
 * Compatible with Blossom, nostr.build, Imgur, void.cat, and standard image extensions.
 */

export const EXT_IMAGE_REGEX =
  /https?:\/\/[^\s<>"']+\.(?:png|jpe?g|gif|webp|avif|bmp|svg)(?:\?[^\s<>"']*)?/gi;

export const CDN_IMAGE_REGEX =
  /https?:\/\/(?:i\.imgur\.com|imgur\.com\/[a-zA-Z0-9]+|void\.cat\/d\/|image\.nostr\.build\/|nostr\.build\/i\/|media\.tenor\.com|pbs\.twimg\.com|cdn\.discordapp\.com\/attachments|nostr\.download\/[a-zA-Z0-9.]+)[^\s<>"']*/gi;

/**
 * Checks if a given URL string points to an image
 */
export function isImageUrl(url: string): boolean {
  if (!url) return false;
  return (
    /\.(?:png|jpe?g|gif|webp|avif|bmp|svg)(?:\?.*)?$/i.test(url) ||
    /(?:image\.nostr\.build|nostr\.build\/i|i\.imgur\.com|media\.tenor\.com|pbs\.twimg\.com|nostr\.download)/i.test(url)
  );
}

/**
 * Extract image attachments from tags (NIP-92 imeta) and inline content body.
 * Returns sanitized body text with extracted image URLs removed to prevent duplicate raw link display.
 */
export function extractPostMedia(
  content: string,
  tags?: string[][]
): {
  cleanText: string;
  images: string[];
} {
  const attachments: string[] = [];
  const seenUrls = new Set<string>();

  // 1. Process NIP-92 / NIP-94 `imeta` tags
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      if (tag[0] === 'imeta') {
        for (let i = 1; i < tag.length; i++) {
          const entry = tag[i] || '';
          const spaceIdx = entry.indexOf(' ');
          if (spaceIdx > 0) {
            const key = entry.slice(0, spaceIdx).trim();
            const val = entry.slice(spaceIdx + 1).trim();
            if (key === 'url' && val && !seenUrls.has(val)) {
              seenUrls.add(val);
              attachments.push(val);
            }
          }
        }
      }
    }
  }

  // 2. Extract inlined image URLs from content
  const collect = (re: RegExp) => {
    const matches = (content || '').match(re) || [];
    for (const raw of matches) {
      const url = raw.replace(/[),.;!?]+$/, '');
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        attachments.push(url);
      }
    }
  };

  collect(EXT_IMAGE_REGEX);
  collect(CDN_IMAGE_REGEX);

  // 3. Strip image URLs from display text
  let cleanText = content || '';
  for (const imgUrl of attachments) {
    cleanText = cleanText.split(imgUrl).join(' ');
  }
  cleanText = cleanText.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n').trim();

  return {
    cleanText,
    images: attachments.slice(0, 4), // Cap at 4 images for clean grid presentation
  };
}
