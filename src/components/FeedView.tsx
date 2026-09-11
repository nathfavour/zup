import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Heart, 
  Repeat2, 
  Zap, 
  MessageSquare, 
  Copy, 
  Check, 
  Search,
  Bookmark,
  ArrowUp,
  Loader2,
  Sparkles,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import { FeedFilter, NostrEvent, NostrKeypair } from '../types';
import { formatTimeAgo, formatTruncatedKey } from '../lib/nostr';
import { evaluateZupQuality, sanitizeZupContent, isTechRelated } from '../lib/nostrFilters';
import { extractPostMedia } from '../lib/momentMedia';

interface FeedViewProps {
  events: NostrEvent[];
  keypair: NostrKeypair;
  activeFilter?: FeedFilter;
  onSelectFilter?: (filter: FeedFilter) => void;
  onOpenCompose: () => void;
  onOpenZap: (event: NostrEvent) => void;
  onLikeEvent: (eventId: string) => void;
  onRepostEvent: (eventId: string) => void;
  onReplyEvent: (event: NostrEvent) => void;
  onSelectPost?: (event: NostrEvent) => void;
  // Live Feed & Infinite Scroll Props
  newEventsCount?: number;
  onLoadNewEvents?: () => void;
  onLoadOlderEvents?: () => void;
  isOlderLoading?: boolean;
  blockedSpamCount?: number;
}

const PAGE_SIZE = 15;

export function FeedView({
  events,
  onOpenCompose,
  onOpenZap,
  onLikeEvent,
  onRepostEvent,
  onReplyEvent,
  onSelectPost,
  newEventsCount = 0,
  onLoadNewEvents,
  onLoadOlderEvents,
  isOlderLoading = false,
  activeFilter = 'tech',
  onSelectFilter,
  blockedSpamCount = 0,
}: FeedViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [quickZappedId, setQuickZappedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const topAnchorRef = useRef<HTMLDivElement | null>(null);

  // 1. Filter events cleanly (Quality Shield always protects in background)
  const filteredEvents = useMemo(() => {
    let pool = events.filter((e) => evaluateZupQuality(e).passes);

    // Apply active category / feed filter
    if (activeFilter === 'tech') {
      pool = pool.filter((e) => isTechRelated(e.content, e.tags));
    } else if (activeFilter === 'media') {
      pool = pool.filter((e) => {
        const media = extractPostMedia(e.content);
        return media.images.length > 0 || media.videos.length > 0;
      });
    } else if (activeFilter === 'zapped') {
      pool = pool.filter((e) => (e.zapsCount || 0) > 0 || e.isZapped);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      pool = pool.filter((e) => {
        const matchesContent = e.content.toLowerCase().includes(q);
        const matchesAuthor =
          (e.author?.name && e.author.name.toLowerCase().includes(q)) ||
          (e.author?.displayName && e.author.displayName.toLowerCase().includes(q)) ||
          (e.author?.nip05 && e.author.nip05.toLowerCase().includes(q)) ||
          (e.author?.npub && e.author.npub.toLowerCase().includes(q)) ||
          e.pubkey.toLowerCase().includes(q);
        const matchesTags = e.tags.some((t) => t[1] && t[1].toLowerCase().includes(q));
        return matchesContent || matchesAuthor || matchesTags;
      });
    }

    return pool;
  }, [events, activeFilter, searchQuery]);

  // 2. Slice for infinite scrolling
  const visibleEvents = useMemo(() => {
    return filteredEvents.slice(0, visibleCount);
  }, [filteredEvents, visibleCount]);

  // 3. Infinite scroll IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          if (visibleCount < filteredEvents.length) {
            setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredEvents.length));
          } else if (onLoadOlderEvents && !isOlderLoading) {
            onLoadOlderEvents();
          }
        }
      },
      { rootMargin: '400px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, filteredEvents.length, onLoadOlderEvents, isOlderLoading]);

  const handleCopyEventId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleBookmark = (id: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleQuickZap = (event: NostrEvent, amount: number) => {
    setQuickZappedId(event.id);
    event.zapsCount = (event.zapsCount || 0) + amount;
    event.isZapped = true;
    setTimeout(() => setQuickZappedId(null), 1500);
  };

  const handleTapNewContent = () => {
    if (onLoadNewEvents) {
      onLoadNewEvents();
      setVisibleCount((prev) => prev + (newEventsCount || PAGE_SIZE));
    }
    topAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col gap-3 pb-20 md:pb-6 relative">
      <div ref={topAnchorRef} className="h-0 w-0" />

      {/* Clean Search Bar ONLY */}
      <div className="relative w-full">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
        />
        <input
          id="feed-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search clean notes, #tags, authors..."
          className="w-full bg-[#000000] border border-white/20 focus:border-[#EC4899] focus:outline-none rounded-[16px] pl-10 pr-9 py-2.5 text-white text-xs sm:text-sm placeholder:text-white/40 transition-colors shadow-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded cursor-pointer"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter Tabs (OpenBricks Tactile Pills) */}
      {onSelectFilter && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {(
            [
              { id: 'tech', label: 'Tech & Code' },
              { id: 'all', label: 'All Clean' },
              { id: 'media', label: 'Media' },
              { id: 'zapped', label: '⚡ Zapped' },
            ] as const
          ).map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectFilter(tab.id)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                  isActive
                    ? 'bg-[#161412] text-white border-white/40 shadow-sm'
                    : 'bg-transparent text-white/60 hover:text-white border-white/10 hover:border-white/20'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Ephemeral Floating Refresh Bubble (Only shows when there are newer posts user hasn't seen) */}
      {newEventsCount > 0 && (
        <div className="sticky top-20 z-30 flex justify-center py-1.5 pointer-events-none">
          <button
            type="button"
            id="feed-ephemeral-refresh-bubble"
            onClick={handleTapNewContent}
            className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#EC4899] to-[#8B5CF6] text-white text-xs font-black shadow-[0_4px_24px_rgba(236,72,153,0.55)] hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/20 animate-fadeIn"
          >
            <ArrowUp size={14} className="animate-bounce" />
            <span>
              {newEventsCount} new {newEventsCount === 1 ? 'post' : 'posts'} • Tap to refresh
            </span>
          </button>
        </div>
      )}

      {/* The Pure Feed Notes List */}
      <div className="flex flex-col gap-3">
        {filteredEvents.length === 0 ? (
          <div className="p-8 rounded-[22px] bg-[#000000] border border-white/20 text-center flex flex-col items-center justify-center gap-3 shadow-xl">
            {searchQuery ? (
              <>
                <h4 className="text-white font-black text-sm uppercase tracking-wider m-0">
                  No Notes Found
                </h4>
                <p className="text-white/70 text-xs font-medium max-w-sm m-0">
                  No clean notes matching &ldquo;{searchQuery}&rdquo;
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] text-xs font-mono font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-ping" />
                  <span>Connecting to Relays</span>
                </div>
                <h4 className="text-white font-black text-sm uppercase tracking-wider m-0">
                  Streaming Live Decentralized Feed
                </h4>
                <p className="text-white/70 text-xs font-medium max-w-md m-0">
                  Connected to Nostr relays. Real Kind 1 notes pass through Zup Quality Filters before entering your feed.
                </p>
                <button
                  type="button"
                  onClick={onOpenCompose}
                  className="mt-2 px-5 py-2 rounded-[14px] bg-[#EC4899] hover:bg-[#db2777] text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_15px_#EC489933]"
                >
                  Publish First Note
                </button>
              </>
            )}
          </div>
        ) : (
          visibleEvents.map((event) => {
            const isLiked = event.isLiked;
            const isZapped = event.isZapped;
            const isReposted = event.isReposted;
            const isBookmarked = bookmarkedIds.has(event.id);
            const isJustZapped = quickZappedId === event.id;
            const media = extractPostMedia(event.content, event.tags);
            const cleanContent = sanitizeZupContent(media.cleanText);

            return (
              <article
                key={event.id}
                id={`note-card-${event.id}`}
                onClick={() => onSelectPost?.(event)}
                className="p-4 sm:p-5 rounded-[22px] bg-[#000000] border border-white/20 hover:border-white/45 transition-all flex flex-col gap-3 group shadow-xl relative overflow-hidden cursor-pointer"
              >
                {/* Instant Zap Particle Flash */}
                {isJustZapped && (
                  <div className="absolute inset-0 bg-[#F59E0B]/10 border-2 border-[#F59E0B] rounded-[22px] pointer-events-none flex items-center justify-center animate-pulse z-10">
                    <div className="px-3 py-1.5 rounded-full bg-black/90 border border-[#F59E0B] text-[#F59E0B] font-mono font-black text-xs flex items-center gap-1.5 shadow-[0_0_20px_#F59E0B]">
                      <Zap size={14} className="fill-[#F59E0B]" />
                      <span>ZAPPED SATS! ⚡</span>
                    </div>
                  </div>
                )}

                {/* Author Header */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={
                        event.author?.avatar ||
                        `https://api.dicebear.com/7.x/identicon/svg?seed=${event.pubkey}`
                      }
                      alt={event.author?.name || 'Builder'}
                      className="w-10 h-10 rounded-full border border-white/20 bg-black shrink-0 object-cover"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-white font-black text-sm truncate">
                          {event.author?.displayName || event.author?.name || 'Anonymous Peer'}
                        </span>
                        {event.author?.nip05 && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30"
                            title={`NIP-05 Verified: ${event.author.nip05}`}
                          >
                            <ShieldCheck size={10} />
                            <span>{event.author.nip05.split('@')[1] || event.author.nip05}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-white/60 text-[11px] font-mono font-bold tracking-tight">
                          {formatTruncatedKey(event.author?.npub || event.pubkey, 8, 4)}
                        </span>
                        <span className="text-white/40 text-[10px] font-black">•</span>
                        <span className="text-white/60 text-[11px] font-bold">
                          {formatTimeAgo(event.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Header Actions (Bookmark & Copy ID) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {event.relayUrl && (
                      <span className="hidden sm:inline-flex text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#161412] text-white/70 border border-white/15 truncate max-w-[130px]">
                        {event.relayUrl.replace('wss://', '')}
                      </span>
                    )}

                    <button
                      id={`bookmark-note-${event.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleBookmark(event.id);
                      }}
                      className={`p-1.5 rounded-[10px] border transition-colors cursor-pointer ${
                        isBookmarked
                          ? 'bg-[#EC4899]/20 border-[#EC4899] text-[#EC4899]'
                          : 'bg-[#161412] border-white/20 text-white/60 hover:text-white'
                      }`}
                      title={isBookmarked ? 'Saved in Bookmarks' : 'Bookmark Note'}
                      aria-label="Bookmark Note"
                    >
                      <Bookmark size={12} className={isBookmarked ? 'fill-[#EC4899]' : ''} />
                    </button>

                    <button
                      id={`copy-note-id-${event.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyEventId(event.id);
                      }}
                      className="p-1.5 rounded-[10px] bg-[#161412] border border-white/20 hover:border-white/50 text-white/80 hover:text-white transition-colors cursor-pointer"
                      title="Copy Note ID"
                      aria-label="Copy Note ID"
                    >
                      {copiedId === event.id ? (
                        <Check size={12} className="text-[#F59E0B]" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Note Content Text (Cleaned from raw image URLs) */}
                {cleanContent && (
                  <div className="text-white text-[13.5px] sm:text-sm leading-relaxed font-medium whitespace-pre-wrap break-words">
                    {cleanContent}
                  </div>
                )}

                {/* Extracted Images Gallery Grid (Matching Kylrix Moments) */}
                {media.images.length > 0 && (
                  <div
                    className={`grid gap-2 rounded-[16px] overflow-hidden border border-white/15 bg-black/40 ${
                      media.images.length === 1
                        ? 'grid-cols-1'
                        : media.images.length === 2
                        ? 'grid-cols-2'
                        : 'grid-cols-2'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {media.images.map((imgUrl, imgIdx) => (
                      <a
                        key={imgIdx}
                        href={imgUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative group overflow-hidden bg-[#161412] flex items-center justify-center max-h-[320px]"
                      >
                        <img
                          src={imgUrl}
                          alt="Post Media"
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity text-white">
                          <ExternalLink size={12} />
                        </div>
                      </a>
                    ))}
                  </div>
                )}

                {/* Tags Row */}
                {event.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {event.tags
                      .filter((t) => t[0] === 't')
                      .map((t, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-[8px] bg-[#161412] text-white/80 border border-white/15 hover:border-[#EC4899]/50 transition-colors"
                        >
                          #{t[1]}
                        </span>
                      ))}
                  </div>
                )}

                {/* Standard Action Bar (Clean Borderless Microblogging Style) */}
                <div
                  className="pt-2.5 border-t border-white/10 flex items-center justify-between max-w-sm gap-2 text-white text-xs font-semibold"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Reply */}
                  <button
                    onClick={() => onReplyEvent(event)}
                    className="flex items-center gap-1.5 py-1 px-1.5 text-white/70 hover:text-[#EC4899] transition-colors cursor-pointer group"
                    title="Reply to Note"
                  >
                    <div className="p-1.5 rounded-full group-hover:bg-[#EC4899]/15 transition-colors">
                      <MessageSquare size={15} />
                    </div>
                    <span className="font-mono text-[11px] font-bold">
                      {event.repliesCount || 0}
                    </span>
                  </button>

                  {/* Repost */}
                  <button
                    onClick={() => onRepostEvent(event.id)}
                    className={`flex items-center gap-1.5 py-1 px-1.5 transition-colors cursor-pointer group ${
                      isReposted ? 'text-[#F59E0B]' : 'text-white/70 hover:text-[#F59E0B]'
                    }`}
                    title="Repost Note"
                  >
                    <div className={`p-1.5 rounded-full transition-colors ${isReposted ? 'bg-[#F59E0B]/20' : 'group-hover:bg-[#F59E0B]/15'}`}>
                      <Repeat2 size={16} className={isReposted ? 'text-[#F59E0B]' : ''} />
                    </div>
                    <span className="font-mono text-[11px] font-bold">
                      {event.repostsCount || 0}
                    </span>
                  </button>

                  {/* Like */}
                  <button
                    onClick={() => onLikeEvent(event.id)}
                    className={`flex items-center gap-1.5 py-1 px-1.5 transition-colors cursor-pointer group ${
                      isLiked ? 'text-[#EC4899]' : 'text-white/70 hover:text-[#EC4899]'
                    }`}
                    title="Like note"
                  >
                    <div className={`p-1.5 rounded-full transition-colors ${isLiked ? 'bg-[#EC4899]/20' : 'group-hover:bg-[#EC4899]/15'}`}>
                      <Heart
                        size={15}
                        className={isLiked ? 'fill-[#EC4899] text-[#EC4899]' : ''}
                      />
                    </div>
                    <span className="font-mono text-[11px] font-bold">
                      {event.likesCount || 0}
                    </span>
                  </button>

                  {/* Zap */}
                  <button
                    onClick={() => onOpenZap(event)}
                    className={`flex items-center gap-1.5 py-1 px-1.5 transition-colors cursor-pointer group ${
                      isZapped ? 'text-amber-400' : 'text-white/70 hover:text-amber-400'
                    }`}
                    title="Lightning Zap"
                  >
                    <div className={`p-1.5 rounded-full transition-colors ${isZapped ? 'bg-amber-500/20' : 'group-hover:bg-amber-500/15'}`}>
                      <Zap
                        size={15}
                        className={isZapped ? 'fill-amber-400 text-amber-400' : 'text-amber-400/90'}
                      />
                    </div>
                    <span className="font-mono text-[11px] font-extrabold text-amber-400">
                      {event.zapsCount ? `${event.zapsCount.toLocaleString()}` : 0}
                    </span>
                  </button>
                </div>
              </article>
            );
          })
        )}

        {/* Infinite Scroll Sentinel & Loader */}
        <div ref={sentinelRef} className="py-6 flex flex-col items-center justify-center gap-2">
          {isOlderLoading ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#161412] border border-white/20 text-white/70 text-xs font-mono">
              <Loader2 size={14} className="animate-spin text-[#EC4899]" />
              <span>Paging older Zups from relay mesh...</span>
            </div>
          ) : visibleEvents.length > 0 && visibleEvents.length < filteredEvents.length ? (
            <div className="text-white/40 text-xs font-mono">
              Scroll down to reveal more Zups...
            </div>
          ) : visibleEvents.length > 0 ? (
            <div className="text-white/40 text-xs font-mono flex items-center gap-1.5">
              <span>All caught up with latest relay stream</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
