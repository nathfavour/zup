import { useState } from 'react';
import { 
  Heart, 
  Repeat2, 
  Zap, 
  MessageSquare, 
  Share2, 
  Radio, 
  Flame, 
  Sparkles, 
  Copy, 
  Check, 
  ShieldCheck, 
  ExternalLink,
  Search,
  Filter
} from 'lucide-react';
import { FeedFilter, NostrEvent, NostrKeypair } from '../types';
import { formatTimeAgo, formatTruncatedKey } from '../lib/nostr';

interface FeedViewProps {
  events: NostrEvent[];
  keypair: NostrKeypair;
  activeFilter: FeedFilter;
  onSelectFilter: (filter: FeedFilter) => void;
  onOpenCompose: () => void;
  onOpenZap: (event: NostrEvent) => void;
  onLikeEvent: (eventId: string) => void;
  onRepostEvent: (eventId: string) => void;
  onReplyEvent: (event: NostrEvent) => void;
}

export function FeedView({
  events,
  keypair,
  activeFilter,
  onSelectFilter,
  onOpenCompose,
  onOpenZap,
  onLikeEvent,
  onRepostEvent,
  onReplyEvent,
}: FeedViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filterOptions: { id: FeedFilter; label: string }[] = [
    { id: 'global', label: 'Global Relay Feed' },
    { id: 'following', label: 'Following' },
    { id: 'privacy', label: 'Privacy & Cypher' },
    { id: 'media', label: 'Media' },
  ];

  const filteredEvents = events.filter((e) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesContent = e.content.toLowerCase().includes(q);
      const matchesAuthor =
        (e.author?.name && e.author.name.toLowerCase().includes(q)) ||
        (e.author?.displayName && e.author.displayName.toLowerCase().includes(q));
      if (!matchesContent && !matchesAuthor) return false;
    }

    if (activeFilter === 'privacy') {
      return (
        e.tags.some((t) => t[1] === 'privacy' || t[1] === 'cypherpunk' || t[1] === 'encryption') ||
        e.content.toLowerCase().includes('privacy') ||
        e.content.toLowerCase().includes('ephemeral')
      );
    }
    if (activeFilter === 'following') {
      // In Nostr, following includes notes by people in our contact list
      return e.author?.name === 'jack' || e.author?.name === 'fiatjaf';
    }
    return true;
  });

  const handleCopyEventId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col gap-4 pb-16 md:pb-6">
      {/* Quick Inset Compose Trigger Well (Pitch Black #000000) */}
      <div
        id="feed-quick-compose"
        onClick={onOpenCompose}
        className="p-4 rounded-[22px] bg-[#000000] border border-white/20 hover:border-white/50 transition-all cursor-pointer flex flex-col gap-3 group shadow-xl"
      >
        <div className="flex items-center gap-3">
          <img
            src={keypair.avatar}
            alt={keypair.name}
            className="w-10 h-10 rounded-full border border-white/30 bg-black shrink-0"
          />
          <div className="flex-1 py-2.5 px-4 rounded-[16px] bg-[#161412] border border-white/10 group-hover:border-[#EC4899]/50 transition-colors flex items-center justify-between">
            <span className="text-white text-xs font-bold truncate">
              Broadcast note to Nostr relay mesh...
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white/10 text-white border border-white/20">
              ⚡ PUBLISH
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/10 text-xs font-bold text-white">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider">
              <Radio size={13} className="text-[#EC4899]" />
              Multi-Relay
            </span>
            <span className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider">
              <Flame size={13} className="text-[#F59E0B]" />
              Burner Mode
            </span>
          </div>
          <span className="text-[11px] font-mono text-[#EC4899] font-black">
            + Note (NIP-01)
          </span>
        </div>
      </div>

      {/* Filter Row & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Filter Segmented Pills (Conforming to OpenBricks 4.0 standard: Container border border-white/20 on #000000) */}
        <div
          id="feed-filter-bar"
          className="p-1 rounded-[16px] bg-[#000000] border border-white/20 flex items-center gap-1 overflow-x-auto"
        >
          {filterOptions.map((opt) => {
            const isActive = activeFilter === opt.id;
            return (
              <button
                key={opt.id}
                id={`filter-btn-${opt.id}`}
                onClick={() => onSelectFilter(opt.id)}
                className={`px-3 py-1.5 rounded-[12px] text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#161412] text-white border-2 border-[#EC4899] shadow-[0_0_10px_#EC489933]'
                    : 'text-white border border-transparent hover:border-white/20'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Search Inset Input */}
        <div className="relative min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes or authors..."
            className="w-full bg-[#000000] border border-white/20 focus:border-[#EC4899] focus:outline-none rounded-[16px] pl-9 pr-3 py-1.5 text-white text-xs placeholder:text-white/40 transition-colors"
          />
        </div>
      </div>

      {/* Note Cards List */}
      <div className="flex flex-col gap-3.5">
        {filteredEvents.length === 0 ? (
          <div className="p-8 rounded-[22px] bg-[#000000] border border-white/20 text-center flex flex-col items-center justify-center gap-3">
            <Radio size={28} className="text-white opacity-40" />
            <h4 className="text-white font-black text-sm uppercase tracking-wider m-0">
              No Notes Found
            </h4>
            <p className="text-white text-xs font-bold max-w-sm m-0">
              Try switching filters, broadcasting a new note, or adding fresh relays to discover more decentralized speech.
            </p>
          </div>
        ) : (
          filteredEvents.map((event) => {
            const isLiked = event.isLiked;
            const isZapped = event.isZapped;
            const isReposted = event.isReposted;

            return (
              <article
                key={event.id}
                id={`note-card-${event.id}`}
                className="p-5 rounded-[22px] bg-[#000000] border border-white/20 hover:border-white/50 transition-all flex flex-col gap-3.5 group shadow-xl"
              >
                {/* Author Header */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={
                        event.author?.avatar ||
                        `https://api.dicebear.com/7.x/identicon/svg?seed=${event.pubkey}`
                      }
                      alt={event.author?.name || 'Peer'}
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
                            <span>{event.author.nip05.split('@')[1] || 'verified'}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-white text-[11px] font-mono font-bold tracking-tight">
                          {formatTruncatedKey(event.author?.npub || event.pubkey, 8, 4)}
                        </span>
                        <span className="text-white text-[10px] font-black">•</span>
                        <span className="text-white text-[11px] font-bold">
                          {formatTimeAgo(event.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Relay Pill & Event ID Copy */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {event.relayUrl && (
                      <span className="hidden sm:inline-flex text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#161412] text-white border border-white/20 truncate max-w-[130px]">
                        {event.relayUrl.replace('wss://', '')}
                      </span>
                    )}

                    <button
                      id={`copy-note-id-${event.id}`}
                      onClick={() => handleCopyEventId(event.id)}
                      className="p-1.5 rounded-[10px] bg-[#161412] border border-white/20 hover:border-white/50 text-white transition-colors cursor-pointer"
                      title="Copy Event ID"
                      aria-label="Copy Event ID"
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
                <div className="text-white text-sm leading-relaxed font-medium whitespace-pre-wrap break-words">
                  {event.content}
                </div>

                {/* Tags row */}
                {event.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {event.tags
                      .filter((t) => t[0] === 't')
                      .map((t, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-[8px] bg-[#161412] text-white border border-white/20"
                        >
                          #{t[1]}
                        </span>
                      ))}
                  </div>
                )}

                {/* Tactile Interaction Bar */}
                <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-white text-xs font-bold">
                  {/* Reply */}
                  <button
                    onClick={() => onReplyEvent(event)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[12px] bg-[#161412] border border-white/10 hover:border-white/40 transition-all cursor-pointer"
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
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[12px] transition-all cursor-pointer ${
                      isReposted
                        ? 'bg-[#10B981]/20 border-2 border-[#10B981] text-emerald-300 shadow-[0_0_10px_#10B98133]'
                        : 'bg-[#161412] border border-white/10 hover:border-white/40 text-white'
                    }`}
                    title="Repost Note across relays"
                  >
                    <Repeat2 size={13} className={isReposted ? 'text-emerald-400' : 'text-white'} />
                    <span className="font-mono text-[11px] font-bold">
                      {event.repostsCount || 0}
                    </span>
                  </button>

                  {/* Like */}
                  <button
                    onClick={() => onLikeEvent(event.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[12px] transition-all cursor-pointer ${
                      isLiked
                        ? 'bg-[#EC4899]/20 border-2 border-[#EC4899] text-[#EC4899] shadow-[0_0_10px_#EC489933]'
                        : 'bg-[#161412] border border-white/10 hover:border-white/40 text-white'
                    }`}
                    title="Like note"
                  >
                    <Heart
                      size={13}
                      className={isLiked ? 'fill-[#EC4899] text-[#EC4899]' : 'text-white'}
                    />
                    <span className="font-mono text-[11px] font-bold">
                      {event.likesCount || 0}
                    </span>
                  </button>

                  {/* Lightning Zap */}
                  <button
                    onClick={() => onOpenZap(event)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] transition-all cursor-pointer ${
                      isZapped
                        ? 'bg-[#F59E0B]/25 border-2 border-[#F59E0B] text-amber-300 shadow-[0_0_12px_#F59E0B44]'
                        : 'bg-[#161412] border border-white/10 hover:border-[#F59E0B] text-white'
                    }`}
                    title="Send Satoshis via Lightning Zap"
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
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
