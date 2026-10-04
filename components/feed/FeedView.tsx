'use client';

import React, { useState, useEffect, useRef } from 'react';
import { LocalEvent, ProfileMetadata } from '@/lib/core/types';
import { db } from '@/lib/db';
import { formatHex, extractEventTags } from '@/lib/core/nostr';
import { ClickToLoadMedia } from './ClickToLoadMedia';
import { Search, Code2, Zap, Copy, Check, Sparkles, MessageSquare } from 'lucide-react';

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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Dwell timer tracker map: eventId -> startTime
  const dwellTracker = useRef<Map<string, number>>(new Map());

  // Load events, profiles, and compute active user interests from telemetry
  useEffect(() => {
    let active = true;
    const fetchFeed = async () => {
      try {
        const allEvents = await db.events.orderBy('created_at').reverse().toArray();
        const allProfiles = await db.profiles.toArray();
        const telemetry = await db.telemetry.toArray();

        if (!active) return;

        const pMap = new Map<string, ProfileMetadata>();
        allProfiles.forEach((p) => pMap.set(p.pubkey, p));

        // Derive user interests from local dwell & interaction telemetry
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

        setEvents(allEvents);
        setProfiles(pMap);
        setUserInterests(topInterests);
        setLoading(false);
      } catch {}
    };

    fetchFeed();
    const interval = setInterval(fetchFeed, 2500);
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

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleZapIntent = async (event: LocalEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    await db.logTelemetry({
      pubkey: localStorage.getItem('zup:active_pubkey') || 'anonymous',
      eventId: event.id,
      targetPubkey: event.pubkey,
      interactionType: 'zap_intent',
      metadata: { targetKind: event.kind }
    });
    alert(`Zap recorded locally. Lightning intent logged for ${formatHex(event.id)}.`);
  };

  // Filter logic
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
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Search Bar (Replaces all cluttered toggle rows) */}
      <div className="space-y-2.5">
        <div className="relative w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dispatches, authors, or topics..."
            className="w-full bg-[#000000] border border-white/20 focus:border-pink-500 rounded-[18px] pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/40 outline-none transition-colors"
          />
        </div>

        {/* Interests Row (Shows "All", plus actual interest tags if user activity exists) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedTag('all')}
            className={`px-3 py-1 rounded-[12px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
              selectedTag === 'all'
                ? 'bg-pink-500 text-black shadow-md font-bold'
                : 'bg-[#000000] text-white/70 hover:text-white border border-white/15'
            }`}
          >
            All Dispatches
          </button>

          {userInterests.map((interest) => (
            <button
              key={interest}
              onClick={() => setSelectedTag(interest)}
              className={`px-3 py-1 rounded-[12px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
                selectedTag === interest
                  ? 'bg-pink-500 text-black shadow-md font-bold'
                  : 'bg-[#000000] text-white/70 hover:text-white border border-white/15'
              }`}
            >
              #{interest}
            </button>
          ))}
        </div>
      </div>

      {/* Events Stream */}
      {loading ? (
        <div className="p-10 text-center bg-[#000000] border border-white/20 rounded-[22px]">
          <p className="text-xs font-mono text-white/60">Loading local cache...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="p-12 text-center bg-[#000000] border border-white/20 rounded-[22px] space-y-3">
          <MessageSquare size={28} className="mx-auto text-white/30" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Dispatches Found</h3>
          <p className="text-xs text-white opacity-70 max-w-sm mx-auto">
            {searchQuery
              ? `No dispatches match "${searchQuery}". Try a different keyword.`
              : 'Your feed is ready. Tap the + icon below to post your first dispatch.'}
          </p>
          <button
            onClick={onOpenComposer}
            className="mt-2 px-4 py-2 bg-pink-500 hover:bg-pink-400 text-black rounded-[14px] text-xs font-bold transition-all"
          >
            Write a Dispatch
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((event) => {
            const profile = profiles.get(event.pubkey);
            const authorName = profile?.display_name || profile?.name || formatHex(event.pubkey, 8, 6);
            const nip05 = profile?.nip05;
            const dateStr = new Date(event.created_at * 1000).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            const isLongForm = event.kind === 30023;
            const tags = extractEventTags(event.tags);

            // Check for media links in content
            const mediaMatch = event.content.match(/(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp))/i);
            const mediaUrl = mediaMatch ? mediaMatch[1] : null;
            const textContent = mediaUrl ? event.content.replace(mediaUrl, '').trim() : event.content;

            return (
              <article
                key={event.id}
                data-event-id={event.id}
                onClick={() => onInspectEvent(event)}
                className="p-4 sm:p-5 bg-[#000000] border border-white/20 hover:border-white/50 rounded-[22px] transition-all cursor-pointer group relative overflow-hidden text-left"
              >
                {/* Header: Author + Clean Unboxed Metadata */}
                <div className="flex items-center justify-between gap-3 mb-2 pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#161412] border border-white/20 flex items-center justify-center font-mono font-bold text-xs text-white shrink-0">
                      {authorName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white truncate group-hover:text-pink-300 transition-colors">
                          {authorName}
                        </span>
                        {nip05 && (
                          <span className="text-[11px] font-mono text-white/50 hidden sm:inline truncate">
                            {nip05}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/60">
                        <span>{dateStr}</span>
                        {isLongForm && (
                          <>
                            <span>·</span>
                            <span className="text-pink-400 font-bold">Article</span>
                          </>
                        )}
                        <span>·</span>
                        <span className="truncate max-w-[120px]">{event.relay_source}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions: Copy ID & Inspect */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => handleCopyId(event.id, e)}
                      title="Copy Event ID"
                      className="p-1.5 rounded-lg bg-[#161412] border border-white/15 hover:border-white/40 text-white transition-colors"
                    >
                      {copiedId === event.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectEvent(event);
                      }}
                      title="Inspect Raw Event"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#161412] border border-white/20 hover:border-pink-500 text-white text-xs font-mono font-bold transition-all"
                    >
                      <Code2 size={13} />
                      <span className="hidden sm:inline">Inspect</span>
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="text-sm font-normal leading-relaxed text-white whitespace-pre-wrap break-words">
                  {textContent}
                </div>

                {/* Media Interception: Click-to-load Bandwidth Gate */}
                {mediaUrl && (
                  <div className="mt-2.5">
                    <ClickToLoadMedia url={mediaUrl} byteEstimate="64 KB" />
                  </div>
                )}

                {/* Footer: Tags & Zap Intent */}
                <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-3 text-xs font-mono">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    {tags.map((t) => (
                      <span key={t} className="text-pink-400 font-semibold hover:underline">
                        #{t}
                      </span>
                    ))}
                    <span className="text-[11px] text-white/40 truncate">
                      {formatHex(event.id, 8, 4)}
                    </span>
                  </div>

                  <button
                    onClick={(e) => handleZapIntent(event, e)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 text-amber-300 font-bold text-[11px] transition-colors"
                  >
                    <Zap size={12} />
                    <span>Zap</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
