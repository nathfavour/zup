'use client';

import React, { useState, useEffect, useRef } from 'react';
import { LocalEvent, ProfileMetadata } from '@/lib/core/types';
import { db } from '@/lib/db';
import { formatHex, extractEventTags } from '@/lib/core/nostr';
import { ClickToLoadMedia } from './ClickToLoadMedia';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Search, Code2, Zap, Copy, Check, FileText, Terminal, Layers } from 'lucide-react';

interface FeedViewProps {
  onInspectEvent: (event: LocalEvent) => void;
  onOpenComposer: () => void;
}

export function FeedView({ onInspectEvent, onOpenComposer }: FeedViewProps) {
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileMetadata>>(new Map());
  const [filterKind, setFilterKind] = useState<'all' | '1' | '30023'>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Dwell timer tracker map: eventId -> startTime
  const dwellTracker = useRef<Map<string, number>>(new Map());

  // Load events and profiles from Dexie
  useEffect(() => {
    let active = true;
    const fetchFeed = async () => {
      try {
        const allEvents = await db.events.orderBy('created_at').reverse().toArray();
        const allProfiles = await db.profiles.toArray();
        if (!active) return;
        const pMap = new Map<string, ProfileMetadata>();
        allProfiles.forEach((p) => pMap.set(p.pubkey, p));

        setEvents(allEvents);
        setProfiles(pMap);
        setLoading(false);
      } catch {}
    };

    fetchFeed();
    const interval = setInterval(fetchFeed, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // IntersectionObserver for Section 7: Interaction Telemetry (Dwell Time >= 800ms with >75% visibility)
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(async (entry) => {
          const eventId = entry.target.getAttribute('data-event-id');
          if (!eventId) return;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.75) {
            // Started dwelling
            if (!dwellTracker.current.has(eventId)) {
              dwellTracker.current.set(eventId, Date.now());
            }
          } else {
            // Exited dwell
            const startTime = dwellTracker.current.get(eventId);
            if (startTime) {
              const dwellDuration = Date.now() - startTime;
              dwellTracker.current.delete(eventId);
              // Invariant: debounces scroll passes (< 800ms ignored)
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
    alert(`Zap Intent logged locally to Dexie (telemetry store). Lightning invoice request recorded for event ${formatHex(event.id)}.`);
  };

  // Filter logic
  const filteredEvents = events.filter((ev) => {
    if (filterKind !== 'all' && ev.kind.toString() !== filterKind) return false;
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

  // Extract all unique tags
  const allTags = Array.from(
    new Set(events.flatMap((e) => extractEventTags(e.tags)))
  ).slice(0, 6);

  return (
    <div className="space-y-4">
      {/* Top Controls: Filter Pills & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between pb-2 border-b border-white/10">
        <div className="flex items-center gap-2 flex-wrap">
          <SegmentedControl
            options={[
              { value: 'all', label: 'All Dispatches', badge: events.length },
              { value: '1', label: 'K1 (Micro)', icon: <Terminal size={13} /> },
              { value: '30023', label: 'K30023 (RFCs)', icon: <FileText size={13} /> }
            ]}
            value={filterKind}
            onChange={(val) => setFilterKind(val as any)}
            accentColor="#EC4899"
          />

          {allTags.length > 0 && (
            <div className="hidden lg:flex items-center gap-1.5 ml-2">
              <span className="text-[11px] font-mono text-white/50">Topics:</span>
              <button
                onClick={() => setSelectedTag('all')}
                className={`text-[11px] font-mono px-2 py-0.5 rounded-lg border transition-colors ${
                  selectedTag === 'all'
                    ? 'border-[#EC4899] bg-[#EC4899]/15 text-white font-bold'
                    : 'border-white/15 text-white/70 hover:text-white'
                }`}
              >
                #all
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`text-[11px] font-mono px-2 py-0.5 rounded-lg border transition-colors ${
                    selectedTag === tag
                      ? 'border-[#EC4899] bg-[#EC4899]/15 text-white font-bold'
                      : 'border-white/15 text-white/70 hover:text-white'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Inset Search Field */}
        <div className="relative min-w-[220px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search content, pubkeys, or #tags..."
            className="w-full bg-[#000000] border border-white/20 focus:border-[#EC4899] rounded-[14px] pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/40 outline-none transition-colors"
          />
        </div>
      </div>

      {/* Events List (Flat rows with OpenBricks 4.0 styling) */}
      {loading ? (
        <div className="p-8 text-center bg-[#000000] border border-white/20 rounded-[20px]">
          <p className="text-xs font-mono text-white">Loading local IndexedDB cache...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="p-12 text-center bg-[#000000] border border-white/20 rounded-[22px] space-y-3">
          <Layers size={28} className="mx-auto text-white/30" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Dispatches Found</h3>
          <p className="text-xs text-white font-medium max-w-md mx-auto opacity-75">
            No events match your current filter parameters. Broadcast a new dispatch or connect to relays to ingest.
          </p>
          <button
            onClick={onOpenComposer}
            className="mt-2 px-4 py-2 bg-[#161412] hover:bg-[#1E1C1A] border border-white/25 hover:border-[#EC4899] rounded-[14px] text-xs font-bold text-white transition-all"
          >
            Publish New Dispatch
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
                className="p-4 sm:p-5 bg-[#000000] border border-white/20 hover:border-white/50 rounded-[20px] transition-all cursor-pointer group relative overflow-hidden"
              >
                {/* Author & Header Metadata (Zero-Pill Discipline: unboxed clean text) */}
                <div className="flex items-center justify-between gap-3 mb-2.5 pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Compact Geometric Avatar */}
                    <div className="w-8 h-8 rounded-xl bg-[#161412] border border-white/25 flex items-center justify-center font-mono font-bold text-xs text-white shrink-0">
                      {authorName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white truncate group-hover:text-pink-300 transition-colors">
                          {authorName}
                        </span>
                        {nip05 && (
                          <span className="text-[11px] font-mono text-white opacity-80 hidden sm:inline truncate">
                            {nip05}
                          </span>
                        )}
                      </div>
                      {/* Unboxed Metadata Line with typographic separators */}
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-white opacity-70">
                        <span>{dateStr}</span>
                        <span>·</span>
                        <span>{isLongForm ? 'Kind 30023 (RFC)' : 'Kind 1'}</span>
                        <span>·</span>
                        <span className="truncate max-w-[120px] sm:max-w-[180px]">{event.relay_source}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions: Copy ID & Inspect */}
                  <div className="flex items-center gap-1 shrink-0">
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
                      title="Inspect Canonical Event & Schnorr Sig"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#161412] border border-white/20 hover:border-[#EC4899] text-white hover:text-pink-300 text-xs font-mono font-bold transition-all"
                    >
                      <Code2 size={13} />
                      <span className="hidden sm:inline">Inspect Raw</span>
                    </button>
                  </div>
                </div>

                {/* Content Area */}
                <div className="text-sm font-normal leading-relaxed text-white whitespace-pre-wrap break-words">
                  {textContent}
                </div>

                {/* Media Interception: Bandwidth Zero-Waste Mandate */}
                {mediaUrl && (
                  <div className="mt-2">
                    <ClickToLoadMedia url={mediaUrl} byteEstimate="64 KB" />
                  </div>
                )}

                {/* Footer: Tags & Interactivity Signals */}
                <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-3 text-xs font-mono">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    {tags.map((t) => (
                      <span key={t} className="text-pink-400 font-semibold hover:underline">
                        #{t}
                      </span>
                    ))}
                    <span className="text-[11px] text-white/50 truncate">
                      id:{formatHex(event.id, 8, 4)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => handleZapIntent(event, e)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 text-amber-300 font-bold text-[11px] transition-colors"
                    >
                      <Zap size={11} />
                      <span>Zap Intent</span>
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
