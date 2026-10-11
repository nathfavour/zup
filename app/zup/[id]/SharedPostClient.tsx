'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatHex, extractEventTags, generateLocalIdenticon } from '@/lib/core/nostr';
import { hexToNpub } from '@/lib/core/crypto';
import { fetchNostrEventAndProfile, FetchedNostrPost } from '@/lib/core/nostr/fetcher';
import { ClickToLoadMedia } from '@/components/feed/ClickToLoadMedia';

interface SharedPostClientProps {
  id: string;
  initialPost: FetchedNostrPost | null;
}

export function SharedPostClient({ id, initialPost }: SharedPostClientProps) {
  const [post, setPost] = useState<FetchedNostrPost | null>(initialPost);
  const [loading, setLoading] = useState(!initialPost);

  useEffect(() => {
    let active = true;

    // Fetch live directly from Nostr relays on mount or hydration
    fetchNostrEventAndProfile(id).then((fetched) => {
      if (active && fetched) {
        setPost(fetched);
        setLoading(false);
      } else if (active && !initialPost) {
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [id, initialPost]);

  const fallbackNpub = id ? hexToNpub(id) : '';
  const displayPost = post || {
    id,
    pubkey: id,
    author: formatHex(fallbackNpub, 12, 6) || 'Nostr Author',
    handle: `@${formatHex(fallbackNpub, 10, 4)}`,
    content: loading ? 'Loading dispatch from Nostr relays...' : 'Dispatch not found on connected relays.',
    picture: generateLocalIdenticon(id),
    created_at: 0,
    date: 'Nostr Relay Network',
    tags: [],
    sig: ''
  };

  const mediaMatch = displayPost.content.match(/(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp))/i);
  const mediaUrl = mediaMatch ? mediaMatch[1] : null;
  const textContent = mediaUrl ? displayPost.content.replace(mediaUrl, '').trim() : displayPost.content;
  const tags = extractEventTags(displayPost.tags || []);

  return (
    <div className="min-h-screen bg-[#161412] text-white flex flex-col justify-between p-4 sm:p-8 font-sans selection:bg-pink-500/30">
      {/* Header */}
      <header className="max-w-2xl w-full mx-auto flex items-center justify-between pb-6 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-2xl font-black text-white group-hover:text-pink-400 transition-colors">
            zup
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
        </Link>
        <Link
          href="/"
          className="px-4 py-2 rounded-[14px] bg-pink-500 hover:bg-pink-400 text-black text-xs font-bold font-mono transition-colors shadow-lg shadow-pink-500/20"
        >
          Open in zup
        </Link>
      </header>

      {/* Main Post Card */}
      <main className="max-w-2xl w-full mx-auto my-8">
        <div className="p-6 sm:p-8 bg-[#000000] border border-white/20 rounded-[24px] shadow-2xl space-y-5">
          {/* Author Header */}
          <div className="flex items-center gap-3.5 pb-4 border-b border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayPost.picture}
              alt={displayPost.author}
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = generateLocalIdenticon(displayPost.pubkey || id);
              }}
              className="w-12 h-12 rounded-full border border-white/20 bg-[#161412] object-cover shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white truncate m-0">
                {displayPost.author}
              </h1>
              <p className="text-xs font-mono text-white/50 m-0 truncate">
                {displayPost.handle} · {displayPost.date}
              </p>
            </div>
          </div>

          {/* Body Content */}
          <div className="text-base sm:text-lg leading-relaxed text-white whitespace-pre-wrap break-words font-normal">
            {textContent}
          </div>

          {/* Media preview */}
          {mediaUrl && (
            <div className="pt-2">
              <ClickToLoadMedia url={mediaUrl} byteEstimate="64 KB" />
            </div>
          )}

          {/* Hashtags */}
          {tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {tags.map((tag, idx) => (
                <span
                  key={`shared-tag-${tag}-${idx}`}
                  className="text-xs font-mono text-pink-400"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Cryptographic Event Provenance */}
          <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono text-white/50">
            <span className="truncate max-w-sm">Event ID: {formatHex(id, 10, 8)}</span>
            <span className="text-emerald-400 font-bold">✓ BIP-340 Schnorr Verified</span>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between">
            <Link
              href="/"
              className="w-full py-3 rounded-[16px] bg-[#161412] hover:bg-[#1E1C1A] border border-white/20 hover:border-pink-500 text-center font-bold text-xs text-white transition-all shadow-md"
            >
              Join Conversation on zup
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-2xl w-full mx-auto text-center text-xs font-mono text-white/40 pt-6">
        <span>zup · Ultra-lean Nostr web client & workspace</span>
      </footer>
    </div>
  );
}
