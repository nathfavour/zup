import { useState, useMemo } from 'react';
import { 
  Heart, 
  Repeat2, 
  Zap, 
  MessageSquare, 
  Radio, 
  Copy, 
  Check, 
  ShieldCheck, 
  Search,
  Cpu,
  Atom,
  Terminal,
  ShieldAlert,
  Sparkles,
  Users,
  Flame,
  Bookmark,
  Share2,
  Filter,
  CheckCircle2
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

// Regex to detect common bot spam patterns coming from untrusted relays
const SPAM_PATTERNS = [
  /airdrop/i,
  /claim\s+free/i,
  /connect\s+wallet/i,
  /telegram\s+group/i,
  /100x\s+signals/i,
  /pump\s+and\s+dump/i,
  /guaranteed\s+\d+%/i,
  /seed\s+phrase/i,
  /t\.me\//i,
];

type DvmAlgorithm = 'tech_signal' | 'top_zapped' | 'stem_deep' | 'pure_chrono';

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
  const [isTier1Active, setIsTier1Active] = useState(true);
  const [showQuarantinedModal, setShowQuarantinedModal] = useState(false);
  const [activeDvm, setActiveDvm] = useState<DvmAlgorithm>('tech_signal');
  const [showDvmMenu, setShowDvmMenu] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [quickZappedId, setQuickZappedId] = useState<string | null>(null);

  const filterOptions: { id: FeedFilter; label: string; icon: typeof Cpu }[] = [
    { id: 'foryou', label: 'For You (DVM)', icon: Sparkles },
    { id: 'tech', label: 'Builders & Tech', icon: Cpu },
    { id: 'stem', label: 'STEM & Science', icon: Atom },
    { id: 'zapped', label: 'Top Zapped', icon: Zap },
    { id: 'systems', label: 'Systems & Infra', icon: Terminal },
    { id: 'following', label: 'Following', icon: Users },
    { id: 'all', label: 'All Relays', icon: Radio },
  ];

  // Evaluate Spam & Tier-1 Curation
  const isSpamEvent = (e: NostrEvent): boolean => {
    if (e.isSpam || e.signalTier === 'spam') return true;
    const content = e.content.toLowerCase();
    return SPAM_PATTERNS.some((pattern) => pattern.test(content));
  };

  const quarantinedCount = useMemo(() => {
    return events.filter(isSpamEvent).length;
  }, [events]);

  const filteredEvents = useMemo(() => {
    // 1. Initial filter pool
    let pool = events.filter((e) => {
      if (isTier1Active && isSpamEvent(e)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesContent = e.content.toLowerCase().includes(q);
        const matchesAuthor =
          (e.author?.name && e.author.name.toLowerCase().includes(q)) ||
          (e.author?.displayName && e.author.displayName.toLowerCase().includes(q)) ||
          (e.author?.nip05 && e.author.nip05.toLowerCase().includes(q));
        const matchesTags = e.tags.some((t) => t[1] && t[1].toLowerCase().includes(q));
        if (!matchesContent && !matchesAuthor && !matchesTags) return false;
      }

      if (activeFilter === 'foryou') return true; // Ranked by DVM algorithm below

      if (activeFilter === 'tech') {
        return (
          e.category === 'tech' ||
          e.category === 'ai' ||
          e.category === 'systems' ||
          e.tags.some((t) => ['tech', 'builders', 'engineering', 'startups', 'rust', 'ai'].includes(t[1])) ||
          !e.category
        );
      }

      if (activeFilter === 'stem') {
        return (
          e.category === 'stem' ||
          e.tags.some((t) => ['stem', 'physics', 'math', 'cryptography', 'robotics', 'science'].includes(t[1])) ||
          e.content.toLowerCase().includes('quantum') ||
          e.content.toLowerCase().includes('spectroscopy') ||
          e.content.toLowerCase().includes('cryptography')
        );
      }

      if (activeFilter === 'zapped') {
        return (e.zapsCount || 0) > 0;
      }

      if (activeFilter === 'systems') {
        return (
          e.category === 'systems' ||
          e.tags.some((t) => ['systems', 'rust', 'ebpf', 'kernel', 'linux', 'crypto', 'consensus'].includes(t[1])) ||
          e.content.toLowerCase().includes('ebpf') ||
          e.content.toLowerCase().includes('latency') ||
          e.content.toLowerCase().includes('memory')
        );
      }

      if (activeFilter === 'following') {
        return (
          e.author?.name === 'jack' ||
          e.author?.name === 'karpathy_fan' ||
          e.author?.name === 'vlad_rust' ||
          e.author?.name === 'dr_elena'
        );
      }

      return true;
    });

    // 2. Opt-in NIP-90 DVM Algorithm & Ranking Logic
    if (activeFilter === 'foryou' || activeDvm !== 'pure_chrono') {
      pool = [...pool].sort((a, b) => {
        if (activeDvm === 'top_zapped' || activeFilter === 'zapped') {
          return (b.zapsCount || 0) - (a.zapsCount || 0);
        }

        if (activeDvm === 'stem_deep') {
          const isAStem = a.category === 'stem' ? 100 : 0;
          const isBStem = b.category === 'stem' ? 100 : 0;
          return (isBStem + (b.likesCount || 0)) - (isAStem + (a.likesCount || 0));
        }

        if (activeDvm === 'tech_signal' || activeFilter === 'foryou') {
          // NIP-90 Relevance Ranker: engagement velocity + builder tier + zap volume
          const scoreA =
            (a.likesCount || 0) * 3 +
            (a.repostsCount || 0) * 5 +
            (a.zapsCount || 0) / 50 +
            (a.signalTier === 'tier1' ? 80 : 0);
          const scoreB =
            (b.likesCount || 0) * 3 +
            (b.repostsCount || 0) * 5 +
            (b.zapsCount || 0) / 50 +
            (b.signalTier === 'tier1' ? 80 : 0);
          return scoreB - scoreA;
        }

        // Default chronological
        return b.created_at - a.created_at;
      });
    }

    return pool;
  }, [events, activeFilter, searchQuery, isTier1Active, activeDvm]);

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
    // Optimistic zap simulation
    event.zapsCount = (event.zapsCount || 0) + amount;
    event.isZapped = true;
    setTimeout(() => setQuickZappedId(null), 1500);
  };

  const dvmDescriptions: Record<DvmAlgorithm, { name: string; tag: string; desc: string }> = {
    tech_signal: {
      name: 'Builder Signal DVM',
      tag: 'NIP-90 AI',
      desc: 'Prioritizes high-signal tech releases, systems engineering, and verified builders.',
    },
    top_zapped: {
      name: 'Lightning Velocity DVM',
      tag: 'Zaps Rank',
      desc: 'Ranks notes receiving the highest Satoshi volume in real-time across relays.',
    },
    stem_deep: {
      name: 'STEM Scientific DVM',
      tag: 'Research',
      desc: 'Prioritizes physics, robotics, machine learning kernels, and cryptography.',
    },
    pure_chrono: {
      name: 'Chronological Pure',
      tag: 'Unfiltered',
      desc: 'Raw timestamp order directly from relays without algorithmic weighting.',
    },
  };

  return (
    <div className="flex flex-col gap-3.5 pb-20 md:pb-6">
      {/* 1. Consumer Speed & Cache Status Pill */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-[14px] bg-[#000000] border border-white/10 text-xs shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EC4899] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#EC4899]"></span>
          </span>
          <span className="text-white/90 font-mono text-[11px] font-bold tracking-tight">
            ⚡ Instant Local Cache <span className="text-white/40">•</span> 0.2ms latency <span className="text-white/40">•</span> 100% Synced
          </span>
        </div>

        {/* DVM Algorithm Picker Trigger */}
        <div className="relative">
          <button
            id="dvm-algorithm-menu-btn"
            onClick={() => setShowDvmMenu(!showDvmMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] bg-[#161412] hover:bg-[#201d1a] border border-white/20 text-white text-[11px] font-bold cursor-pointer transition-colors"
            title="Configure Recommendation Algorithm (NIP-90 DVM)"
          >
            <Filter size={11} className="text-[#EC4899]" />
            <span className="truncate max-w-[120px] sm:max-w-none">
              {dvmDescriptions[activeDvm].name}
            </span>
          </button>

          {/* DVM Dropdown Popover */}
          {showDvmMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-72 sm:w-80 bg-[#000000] border border-white/25 rounded-[18px] p-2 z-40 shadow-[0_10px_30px_rgba(0,0,0,0.95)] flex flex-col gap-1">
              <div className="px-2 py-1 border-b border-white/10 flex items-center justify-between">
                <span className="text-white font-extrabold text-[11px] uppercase tracking-wider">
                  NIP-90 Algorithm DVM
                </span>
                <span className="text-[9px] font-mono text-[#EC4899] font-black">
                  OPT-IN
                </span>
              </div>

              {(Object.keys(dvmDescriptions) as DvmAlgorithm[]).map((key) => {
                const info = dvmDescriptions[key];
                const isSelected = activeDvm === key;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setActiveDvm(key);
                      setShowDvmMenu(false);
                    }}
                    className={`p-2 rounded-[12px] text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                      isSelected
                        ? 'bg-[#161412] border border-[#EC4899]/60'
                        : 'hover:bg-[#161412]/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white font-bold text-xs">
                        {info.name}
                      </span>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-white/10 text-white/80">
                        {info.tag}
                      </span>
                    </div>
                    <span className="text-white/60 text-[10px] leading-tight">
                      {info.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. Curated Field Selector & Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
        {/* Filter Segmented Pills */}
        <div
          id="feed-filter-bar"
          aria-label="Feed category selector"
          className="p-1 rounded-[18px] bg-[#000000] border border-white/20 flex items-center gap-1 overflow-x-auto scrollbar-none"
        >
          {filterOptions.map((opt) => {
            const Icon = opt.icon;
            const isActive = activeFilter === opt.id;
            return (
              <button
                key={opt.id}
                id={`filter-btn-${opt.id}`}
                onClick={() => onSelectFilter(opt.id)}
                className={`px-3 py-1.5 rounded-[13px] text-xs font-black tracking-tight whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-[#161412] text-white border-2 border-[#EC4899] shadow-[0_0_12px_#EC489933]'
                    : 'text-white/70 hover:text-white border border-transparent hover:border-white/20'
                }`}
              >
                <Icon size={13} className={isActive ? 'text-[#EC4899]' : 'text-white/60'} />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Inset Search Input */}
        <div className="relative min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search feed, #tags, builders..."
            className="w-full bg-[#000000] border border-white/20 focus:border-[#EC4899] focus:outline-none rounded-[16px] pl-9 pr-3 py-1.5 text-white text-xs placeholder:text-white/40 transition-colors"
          />
        </div>
      </div>

      {/* 3. Tier-1 Builder Curation Banner (Anti-Spam Shield) */}
      <div
        id="tier1-curation-banner"
        className="px-3.5 py-2 rounded-[16px] bg-[#000000] border border-[#10B981]/40 flex flex-wrap items-center justify-between gap-2 shadow-sm transition-all"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-5 h-5 rounded-[7px] bg-[#10B981]/20 border border-[#10B981]/50 flex items-center justify-center text-[#10B981] shrink-0">
            <ShieldCheck size={13} />
          </div>
          <div className="min-w-0 flex items-center gap-2">
            <span className="text-white font-extrabold text-xs tracking-wide truncate">
              Tier-1 Builder Shield
            </span>
            <span className="text-white/50 text-[11px] font-medium hidden sm:inline truncate">
              Scam bots & crypto airdrops automatically filtered.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {quarantinedCount > 0 && (
            <button
              onClick={() => setShowQuarantinedModal(!showQuarantinedModal)}
              className="text-[10px] font-mono font-bold text-[#F59E0B] px-2 py-0.5 rounded-[8px] bg-[#F59E0B]/10 border border-[#F59E0B]/30 hover:bg-[#F59E0B]/20 transition-all cursor-pointer flex items-center gap-1"
              title="View quarantined spam count"
            >
              <ShieldAlert size={11} />
              <span>{quarantinedCount} Quarantined</span>
            </button>
          )}

          <button
            id="toggle-tier1-curation"
            onClick={() => setIsTier1Active(!isTier1Active)}
            className={`px-2 py-0.5 rounded-[8px] text-[10px] font-mono font-black uppercase tracking-wider transition-all cursor-pointer border ${
              isTier1Active
                ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                : 'bg-[#161412] border-white/20 text-white/50 hover:text-white'
            }`}
          >
            {isTier1Active ? 'Shield: Active' : 'Shield: Off'}
          </button>
        </div>
      </div>

      {/* 4. Mainstream Twitter-Style Pure Note Cards List */}
      <div className="flex flex-col gap-3">
        {filteredEvents.length === 0 ? (
          <div className="p-8 rounded-[22px] bg-[#000000] border border-white/20 text-center flex flex-col items-center justify-center gap-3 shadow-xl">
            <Cpu size={32} className="text-white/40" />
            <h4 className="text-white font-black text-sm uppercase tracking-wider m-0">
              No Notes Matching This Filter
            </h4>
            <p className="text-white/70 text-xs font-medium max-w-sm m-0">
              Try switching to Builders & Tech, STEM, or Top Zapped to explore real-time notes.
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
                className="p-4 sm:p-5 rounded-[22px] bg-[#000000] border border-white/20 hover:border-white/50 transition-all flex flex-col gap-3 group shadow-xl relative overflow-hidden"
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
                        {event.signalTier === 'tier1' && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#A855F7]/15 text-[#A855F7] border border-[#A855F7]/30">
                            TIER-1
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

                  {/* Relay Pill & Quick Bookmark / ID Copy */}
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

                {/* Note Content Text with Technical Formatting */}
                <div className="text-white text-[13.5px] sm:text-sm leading-relaxed font-medium whitespace-pre-wrap break-words">
                  {event.content}
                </div>

                {/* Tech & STEM Tags Row */}
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

                {/* Consumer Action Bar: Micro-Zap Shortcuts + Standard Twitter Actions */}
                <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-white text-xs font-bold">
                  {/* Left: Engagement Controls */}
                  <div className="flex items-center gap-3">
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
                      title="Repost Note across relays"
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

                  {/* Right: Quick Lightning Zaps ("Say what's up. Get zapped.") */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Quick 21 sats pill */}
                    <button
                      onClick={() => handleQuickZap(event, 21)}
                      className="px-2 py-1 rounded-[10px] bg-[#161412] hover:bg-[#F59E0B]/20 border border-white/15 hover:border-[#F59E0B] text-white/90 text-[10px] font-mono font-black transition-all cursor-pointer flex items-center gap-1"
                      title="Quick Zap 21 satoshis"
                    >
                      <Zap size={10} className="text-[#F59E0B]" />
                      <span>+21</span>
                    </button>

                    {/* Quick 100 sats pill */}
                    <button
                      onClick={() => handleQuickZap(event, 100)}
                      className="px-2 py-1 rounded-[10px] bg-[#161412] hover:bg-[#F59E0B]/20 border border-white/15 hover:border-[#F59E0B] text-white/90 text-[10px] font-mono font-black transition-all cursor-pointer flex items-center gap-1"
                      title="Quick Zap 100 satoshis"
                    >
                      <Zap size={10} className="text-[#F59E0B]" />
                      <span>+100</span>
                    </button>

                    {/* Full Custom Lightning Zap */}
                    <button
                      onClick={() => onOpenZap(event)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-[12px] transition-all cursor-pointer ${
                        isZapped
                          ? 'bg-[#F59E0B]/25 border border-[#F59E0B] text-amber-300 shadow-[0_0_12px_#F59E0B44]'
                          : 'bg-[#161412] border border-white/15 hover:border-[#F59E0B] text-white'
                      }`}
                      title="Send custom amount Satoshis via Lightning Zap"
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
