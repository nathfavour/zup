'use client';

import React, { useState, useEffect, useRef } from 'react';
import { LocalEvent, ProfileMetadata } from '@/lib/core/types';
import { db } from '@/lib/db';
import { formatHex, extractEventTags, isSpamOrReply } from '@/lib/core/nostr';
import { ClickToLoadMedia } from './ClickToLoadMedia';
import {
  Search,
  MessageCircle,
  Repeat2,
  Heart,
  Zap,
  Share2,
  Check,
  Code2,
  Sparkles
} from 'lucide-react';

interface FeedViewProps {
  onInspectEvent: (event: LocalEvent) => void;
  onOpenComposer: () => void;
}

export function FeedView({ onInspectEvent, onOpenComposer }: FeedViewProps) {
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileMetadata>>(new Map());
  const [userInterests, setUserInterests] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [repostedPosts, setRepostedPosts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const dwellTracker = useRef<Map<string, number>>(new Map());

  // Show a temporary toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Load events, profiles, and compute active user interests from telemetry
  useEffect(() => {
    let active = true;
    const fetchFeed = async () => {
      try {
        const allEvents = await db.events.orderBy('created_at').reverse().toArray();
        const allProfiles = await db.profiles.toArray();
        const telemetry = await db.telemetry.toArray();

        if (!active) return;

        // Apply strict spam & reply filter: only genuine root posts
        const cleanEvents = allEvents.filter((ev) => !isSpamOrReply(ev).isSpamOrReply);

        const pMap = new Map<string, ProfileMetadata>();
        allProfiles.forEach((p) => pMap.set(p.pubkey, p));

        // Derive user interests from dwell & interaction telemetry
        const interestFrequency = new Map<string, number>();
        telemetry.forEach((t) => {
          const tags = (t.metadata?.tags as string[]) || [];
          tags.forEach((tag) => {
            const count = interestFrequency.get(tag) || 0;
            interestFrequency.set(tag, count + (t.dwellTimeMs ? Math.round(t.dwellTimeMs / 1000) : 1));
          });
        });

        // Only show interests if user has actual activity
        const topInterests = Array.from(interestFrequency.entries())
          .filter(([, score]) => score >= 2)
          .sort((a, b) => b[1] - a[1])
          .map(([tag]) => tag)
          .slice(0, 5);

        setEvents(cleanEvents);
        setProfiles(pMap);
        setUserInterests(topInterests);
        setLoading(false);
      } catch {}
    };

    fetchFeed();
    const interval = setInterval(fetchFeed, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // IntersectionObserver for Interaction Telemetry (Dwell Time >= 800ms with >75% visibility)
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(async (entry) => {
          const eventId = entry.target.getAttribute('data-event-id');
          if (!eventId) return;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.75) {
            if (!dwellTracker.current.has(eventId)) {
              dwellTracker.current.set(eventId, Date.now());
            }
          } else {
            const startTime = dwellTracker.current.get(eventId);
            if (startTime) {
              const dwellDuration = Date.now() - startTime;
              dwellTracker.current.delete(eventId);
              if (dwellDuration >= 800) {
                const targetEvent = events.find((e) => e.id === eventId);
                await db.logTelemetry({
                  pubkey: localStorage.getItem('zup:active_pubkey') || 'anonymous',
                  eventId,
                  targetPubkey: targetEvent?.pubkey,
                  interactionType: 'dwell',
                  dwellTimeMs: dwellDuration,
                  metadata: {
                    tags: targetEvent ? extractEventTags(targetEvent.tags) : []
                  }
                });
              }
            }
          }
        });
      },
      { threshold: [0.75] }
    );

    const elements = document.querySelectorAll('[data-event-id]');
    elements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [events]);

  // Handle Share link copy
  const handleShare = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://getzup.vercel.app';
    const shareUrl = `${origin}/zup/${eventId}`;
    navigator.clipboard.writeText(shareUrl);
    showToast('Copied share link to clipboard!');
  };

  // Handle Like toggle
  const handleLike = async (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });

    const targetEvent = events.find((ev) => ev.id === eventId);
    await db.logTelemetry({
      pubkey: localStorage.getItem('zup:active_pubkey') || 'anonymous',
      eventId,
      targetPubkey: targetEvent?.pubkey,
      interactionType: 'click',
      metadata: { action: 'like' }
    });
  };

  // Handle Repost toggle
  const handleRepost = async (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRepostedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
        showToast('Reposted dispatch to your network!');
      }
      return next;
    });

    const targetEvent = events.find((ev) => ev.id === eventId);
    await db.logTelemetry({
      pubkey: localStorage.getItem('zup:active_pubkey') || 'anonymous',
      eventId,
      targetPubkey: targetEvent?.pubkey,
      interactionType: 'share',
      metadata: { action: 'repost' }
    });
  };

  // Handle Zap intent
  const handleZap = async (event: LocalEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    await db.logTelemetry({
      pubkey: localStorage.getItem('zup:active_pubkey') || 'anonymous',
      eventId: event.id,
      targetPubkey: event.pubkey,
      interactionType: 'zap_intent',
      metadata: { targetKind: event.kind }
    });
    showToast(`⚡ Zap intent logged for @${formatHex(event.pubkey, 6, 0)}!`);
  };

  // Filter events
  const filteredEvents = events.filter((ev) => {
    if (selectedTag !== 'all') {
      const tags = extractEventTags(ev.tags);
      if (!tags.includes(selectedTag)) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesContent = ev.content.toLowerCase().includes(q);
      const matchesAuthor = ev.pubkey.toLowerCase().includes(q);
      const matchesId = ev.id.toLowerCase().includes(q);
      return matchesContent || matchesAuthor || matchesId;
    }
    return true;
  });

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-pink-500 text-black text-xs font-bold rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Check size={14} className="stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Clean Edge-to-Edge Search Bar */}
      <div className="space-y-2.5">
        <div className="relative w-full">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dispatches, people, or topics..."
            className="w-full bg-[#000000] border border-white/20 focus:border-pink-500 rounded-[20px] pl-11 pr-4 py-2.5 text-xs text-white placeholder-white/40 outline-none transition-colors"
          />
        </div>

        {/* Interests Bar (Shows "All" by default; displays topics if user has activity) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedTag('all')}
            className={`px-3 py-1 rounded-[12px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
              selectedTag === 'all'
                ? 'bg-pink-500 text-black font-bold'
                : 'bg-[#000000] text-white/70 hover:text-white border border-white/15'
            }`}
          >
            All
          </button>

          {userInterests.map((interest) => (
            <button
              key={interest}
              onClick={() => setSelectedTag(interest)}
              className={`px-3 py-1 rounded-[12px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
                selectedTag === interest
                  ? 'bg-pink-500 text-black font-bold'
                  : 'bg-[#000000] text-white/70 hover:text-white border border-white/15'
              }`}
            >
              #{interest}
            </button>
          ))}
        </div>
      </div>

      {/* Stream of Posts (Twitter / X Simple Style) */}
      {loading ? (
        <div className="p-10 text-center bg-[#000000] border border-white/20 rounded-[22px]">
          <p className="text-xs font-mono text-white/50">Loading dispatches...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="p-12 text-center bg-[#000000] border border-white/20 rounded-[22px] space-y-3">
          <p className="text-sm font-bold text-white">No Dispatches Found</p>
          <p className="text-xs text-white/60 max-w-sm mx-auto">
            {searchQuery ? `No posts matched "${searchQuery}".` : 'No posts in feed yet.'}
          </p>
          <button
            onClick={onOpenComposer}
            className="px-4 py-2 bg-pink-500 hover:bg-pink-400 text-black font-bold text-xs rounded-[14px] transition-colors cursor-pointer"
          >
            Post a Dispatch
          </button>
        </div>
      ) : (
        <div className="divide-y divide-white/10 bg-[#000000] border border-white/20 rounded-[24px] overflow-hidden">
          {filteredEvents.map((event) => {
            const profile = profiles.get(event.pubkey);
            const authorName = profile?.display_name || profile?.name || `user_${event.pubkey.slice(0, 6)}`;
            const handle = profile?.nip05 || `@${formatHex(event.pubkey, 6, 0)}`;
            const avatarUrl = profile?.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${event.pubkey}`;
            const dateStr = new Date(event.created_at * 1000).toLocaleDateString([], {
              month: 'short',
              day: 'numeric'
            });

            const isLiked = likedPosts.has(event.id);
            const isReposted = repostedPosts.has(event.id);

            // Deterministic mock seed counts based on event id
            const seedNum = parseInt(event.id.slice(0, 2), 16) || 1;
            const replyCount = (seedNum % 8) + 1;
            const repostCount = (seedNum % 14) + (isReposted ? 1 : 0);
            const likeCount = (seedNum % 32) + (isLiked ? 1 : 0);

            // Media link detection
            const mediaMatch = event.content.match(/(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp))/i);
            const mediaUrl = mediaMatch ? mediaMatch[1] : null;
            const textContent = mediaUrl ? event.content.replace(mediaUrl, '').trim() : event.content;
            const tags = extractEventTags(event.tags);

            return (
              <article
                key={event.id}
                data-event-id={event.id}
                className="p-4 sm:p-5 hover:bg-white/[0.02] transition-colors flex items-start gap-3.5"
              >
                {/* Left: User Profile Picture (from Nostr kind 0 with cache fallback) */}
                <div className="shrink-0 pt-0.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarUrl}
                    alt={authorName}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      // Fallback to deterministic Dicebear if remote avatar fails to load
                      (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/identicon/svg?seed=${event.pubkey}`;
                    }}
                    className="w-10 h-10 rounded-full border border-white/20 bg-[#161412] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  />
                </div>

                {/* Right: Author line, content, media, Twitter-style actions */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* User line */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-sm text-white truncate hover:underline cursor-pointer">
                        {authorName}
                      </span>
                      <span className="text-xs font-mono text-white/50 truncate">
                        {handle}
                      </span>
                      <span className="text-white/30 text-xs">·</span>
                      <span className="text-xs font-mono text-white/40 shrink-0">
                        {dateStr}
                      </span>
                    </div>

                    {/* Subtle Inspect Button */}
                    <button
                      onClick={() => onInspectEvent(event)}
                      title="Inspect Raw Event Hash & Schnorr Sig"
                      className="text-[11px] font-mono text-white/40 hover:text-pink-400 p-1 rounded-md transition-colors"
                    >
                      <Code2 size={13} />
                    </button>
                  </div>

                  {/* Post Content */}
                  <div className="text-sm text-white leading-relaxed whitespace-pre-wrap break-words font-normal">
                    {textContent}
                  </div>

                  {/* Hashtags */}
                  {tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      {tags.map((tag) => (
                        <span key={tag} className="text-xs font-mono text-pink-400 hover:underline cursor-pointer">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Click-to-load media */}
                  {mediaUrl && (
                    <div className="pt-1.5">
                      <ClickToLoadMedia url={mediaUrl} byteEstimate="64 KB" />
                    </div>
                  )}

                  {/* Twitter / X Style Action Row (Comment, Repost, Like, Zap, Share) */}
                  <div className="pt-2 flex items-center justify-between text-white/50 max-w-md text-xs select-none">
                    {/* Reply / Comment */}
                    <button
                      onClick={() => showToast('Replies are currently hidden by spam protection.')}
                      className="flex items-center gap-1.5 hover:text-sky-400 transition-colors cursor-pointer group"
                      title="Reply"
                    >
                      <div className="p-1.5 rounded-full group-hover:bg-sky-500/10">
                        <MessageCircle size={15} />
                      </div>
                      <span className="tabular-nums font-mono text-[11px]">{replyCount}</span>
                    </button>

                    {/* Repost */}
                    <button
                      onClick={(e) => handleRepost(event.id, e)}
                      className={`flex items-center gap-1.5 transition-colors cursor-pointer group ${
                        isReposted ? 'text-emerald-400' : 'hover:text-emerald-400'
                      }`}
                      title="Repost"
                    >
                      <div className="p-1.5 rounded-full group-hover:bg-emerald-500/10">
                        <Repeat2 size={15} />
                      </div>
                      <span className="tabular-nums font-mono text-[11px]">{repostCount}</span>
                    </button>

                    {/* Like */}
                    <button
                      onClick={(e) => handleLike(event.id, e)}
                      className={`flex items-center gap-1.5 transition-colors cursor-pointer group ${
                        isLiked ? 'text-pink-500' : 'hover:text-pink-400'
                      }`}
                      title="Like"
                    >
                      <div className="p-1.5 rounded-full group-hover:bg-pink-500/10">
                        <Heart
                          size={15}
                          className={isLiked ? 'fill-pink-500 text-pink-500' : ''}
                        />
                      </div>
                      <span className="tabular-nums font-mono text-[11px]">{likeCount}</span>
                    </button>

                    {/* Lightning Zap */}
                    <button
                      onClick={(e) => handleZap(event, e)}
                      className="flex items-center gap-1.5 hover:text-amber-400 transition-colors cursor-pointer group"
                      title="Send Lightning Zap"
                    >
                      <div className="p-1.5 rounded-full group-hover:bg-amber-500/10">
                        <Zap size={15} />
                      </div>
                    </button>

                    {/* Share Button (Instant Copy of [base uri]/zup/[id]) */}
                    <button
                      onClick={(e) => handleShare(event.id, e)}
                      className="flex items-center gap-1.5 hover:text-pink-400 transition-colors cursor-pointer group"
                      title="Share link"
                    >
                      <div className="p-1.5 rounded-full group-hover:bg-pink-500/10">
                        <Share2 size={15} />
                      </div>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
