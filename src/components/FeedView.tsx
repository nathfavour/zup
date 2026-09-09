import { useState, useMemo } from 'react';
import { 
  Heart, 
  Repeat2, 
  Zap, 
  MessageSquare, 
  Copy, 
  Check, 
  ShieldCheck, 
  Search,
  Bookmark
} from 'lucide-react';
import { FeedFilter, NostrEvent, NostrKeypair } from '../types';
import { formatTimeAgo, formatTruncatedKey } from '../lib/nostr';

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
}

export function FeedView({
  events,
  onOpenZap,
  onLikeEvent,
  onRepostEvent,
  onReplyEvent,
}: FeedViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [quickZappedId, setQuickZappedId] = useState<string | null>(null);

  const filteredEvents = useMemo(() => {
    let pool = [...events].sort((a, b) => b.created_at - a.created_at);

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
  }, [events, searchQuery]);

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

  return (
    <div className="flex flex-col gap-3 pb-20 md:pb-6">
      {/* Clean, Single Search Bar directly above the Feed */}
      <div className="relative w-full">
        <Search
          size={15}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
        />
        <input
          id="feed-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search notes, #tags, builders..."
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

      {/* The Pure Feed Notes List */}
      <div className="flex flex-col gap-3">
        {filteredEvents.length === 0 ? (
          <div className="p-8 rounded-[22px] bg-[#000000] border border-white/20 text-center flex flex-col items-center justify-center gap-2.5 shadow-xl">
            <h4 className="text-white font-black text-sm uppercase tracking-wider m-0">
              No Notes Found
            </h4>
            <p className="text-white/70 text-xs font-medium max-w-sm m-0">
              {searchQuery ? `No notes matching "${searchQuery}"` : 'Your feed is empty.'}
            </p>
          </div>
        ) : (
          filteredEvents.map((event) => {
            const isLiked = event.isLiked;
            const isZapped = event.isZapped;
            const isReposted = event.isReposted;
            const isBookmarked = bookmarkedIds.has(event.id);
            const isJustZapped = quickZappedId === event.id;

            return (
              <article
                key={event.id}
                id={`note-card-${event.id}`}
                className="p-4 sm:p-5 rounded-[22px] bg-[#000000] border border-white/20 hover:border-white/45 transition-all flex flex-col gap-3 group shadow-xl relative overflow-hidden"
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
                            title={`NIP-05 Verified Builder: ${event.author.nip05}`}
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

                  {/* Quick Bookmark / ID Copy */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {event.relayUrl && (
                      <span className="hidden sm:inline-flex text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#161412] text-white/70 border border-white/15 truncate max-w-[130px]">
                        {event.relayUrl.replace('wss://', '')}
                      </span>
                    )}

                    <button
                      onClick={() => handleToggleBookmark(event.id)}
                      className={`p-1.5 rounded-[10px] border transition-colors cursor-pointer ${
                        isBookmarked
                          ? 'bg-[#A855F7]/20 border-[#A855F7] text-[#A855F7]'
                          : 'bg-[#161412] border-white/20 text-white/60 hover:text-white'
                      }`}
                      title={isBookmarked ? 'Saved in Bookmarks' : 'Bookmark Note'}
                      aria-label="Bookmark Note"
                    >
                      <Bookmark size={12} className={isBookmarked ? 'fill-[#A855F7]' : ''} />
                    </button>

                    <button
                      id={`copy-note-id-${event.id}`}
                      onClick={() => handleCopyEventId(event.id)}
                      className="p-1.5 rounded-[10px] bg-[#161412] border border-white/20 hover:border-white/50 text-white/80 hover:text-white transition-colors cursor-pointer"
                      title="Copy Note ID"
                      aria-label="Copy Note ID"
                    >
                      {copiedId === event.id ? (
                        <Check size={12} className="text-emerald-400" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Note Content Text */}
                <div className="text-white text-[13.5px] sm:text-sm leading-relaxed font-medium whitespace-pre-wrap break-words">
                  {event.content}
                </div>

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

                {/* Action Bar */}
                <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-white text-xs font-bold">
                  {/* Left: Engagement Controls */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    {/* Reply */}
                    <button
                      onClick={() => onReplyEvent(event)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-[12px] bg-[#161412] border border-white/15 hover:border-white/40 text-white/80 hover:text-white transition-all cursor-pointer"
                      title="Reply to Note"
                    >
                      <MessageSquare size={13} />
                      <span className="font-mono text-[11px] font-bold">
                        {event.repliesCount || 0}
                      </span>
                    </button>

                    {/* Repost */}
                    <button
                      onClick={() => onRepostEvent(event.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[12px] transition-all cursor-pointer ${
                        isReposted
                          ? 'bg-[#10B981]/20 border border-[#10B981] text-emerald-300 shadow-[0_0_10px_#10B98133]'
                          : 'bg-[#161412] border border-white/15 hover:border-white/40 text-white/80 hover:text-white'
                      }`}
                      title="Repost Note"
                    >
                      <Repeat2 size={13} className={isReposted ? 'text-emerald-400' : 'text-white/80'} />
                      <span className="font-mono text-[11px] font-bold">
                        {event.repostsCount || 0}
                      </span>
                    </button>

                    {/* Like */}
                    <button
                      onClick={() => onLikeEvent(event.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[12px] transition-all cursor-pointer ${
                        isLiked
                          ? 'bg-[#EC4899]/20 border border-[#EC4899] text-[#EC4899] shadow-[0_0_10px_#EC489933]'
                          : 'bg-[#161412] border border-white/15 hover:border-white/40 text-white/80 hover:text-white'
                      }`}
                      title="Like note"
                    >
                      <Heart
                        size={13}
                        className={isLiked ? 'fill-[#EC4899] text-[#EC4899]' : 'text-white/80'}
                      />
                      <span className="font-mono text-[11px] font-bold">
                        {event.likesCount || 0}
                      </span>
                    </button>
                  </div>

                  {/* Right: Quick Lightning Zaps */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => handleQuickZap(event, 21)}
                      className="px-2 py-1 rounded-[10px] bg-[#161412] hover:bg-[#F59E0B]/20 border border-white/15 hover:border-[#F59E0B] text-white/90 text-[10px] font-mono font-black transition-all cursor-pointer flex items-center gap-1"
                      title="Quick Zap 21 satoshis"
                    >
                      <Zap size={10} className="text-[#F59E0B]" />
                      <span>+21</span>
                    </button>

                    <button
                      onClick={() => handleQuickZap(event, 100)}
                      className="px-2 py-1 rounded-[10px] bg-[#161412] hover:bg-[#F59E0B]/20 border border-white/15 hover:border-[#F59E0B] text-white/90 text-[10px] font-mono font-black transition-all cursor-pointer flex items-center gap-1"
                      title="Quick Zap 100 satoshis"
                    >
                      <Zap size={10} className="text-[#F59E0B]" />
                      <span>+100</span>
                    </button>

                    <button
                      onClick={() => onOpenZap(event)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-[12px] transition-all cursor-pointer ${
                        isZapped
                          ? 'bg-[#F59E0B]/25 border border-[#F59E0B] text-amber-300 shadow-[0_0_12px_#F59E0B44]'
                          : 'bg-[#161412] border border-white/15 hover:border-[#F59E0B] text-white'
                      }`}
                      title="Custom Lightning Zap"
                    >
                      <Zap
                        size={13}
                        className={isZapped ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#F59E0B]'}
                      />
                      <span className="font-mono text-[11px] font-extrabold text-[#F59E0B]">
                        {event.zapsCount ? `${event.zapsCount.toLocaleString()} sats` : 'Zap'}
                      </span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
