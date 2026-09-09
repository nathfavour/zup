import { useState, useEffect, type FormEvent } from 'react';
import {
  Heart,
  Repeat2,
  Zap,
  MessageSquare,
  Copy,
  Check,
  Send,
  ShieldCheck,
  Radio,
  Bookmark,
  Share2
} from 'lucide-react';
import { NostrEvent, NostrKeypair, RelayInfo } from '../types';
import { TactileDrawer } from './TactileDrawer';
import { formatTimeAgo, formatTruncatedKey, pubkeyToNpub } from '../lib/nostr';
import { sanitizeZupContent } from '../lib/nostrFilters';

interface PostDetailDrawerProps {
  post: NostrEvent | null;
  isOpen: boolean;
  onClose: () => void;
  keypair: NostrKeypair;
  relays: RelayInfo[];
  onLikeEvent: (eventId: string) => void;
  onRepostEvent: (eventId: string) => void;
  onOpenZap: (event: NostrEvent) => void;
  onSubmitReply: (content: string, targetEvent: NostrEvent) => void;
}

export function PostDetailDrawer({
  post,
  isOpen,
  onClose,
  keypair,
  relays,
  onLikeEvent,
  onRepostEvent,
  onOpenZap,
  onSubmitReply,
}: PostDetailDrawerProps) {
  const [replyContent, setReplyContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [replies, setReplies] = useState<NostrEvent[]>([]);
  const [isFetchingReplies, setIsFetchingReplies] = useState(false);
  const [likesCount, setLikesCount] = useState<number>(0);
  const [repostsCount, setRepostsCount] = useState<number>(0);
  const [zapsCount, setZapsCount] = useState<number>(0);

  // Sync initial counts from post prop
  useEffect(() => {
    if (post) {
      setLikesCount(post.likesCount || 0);
      setRepostsCount(post.repostsCount || 0);
      setZapsCount(post.zapsCount || 0);
    }
  }, [post]);

  // Instantly fetch live replies & reactions from connected Nostr WebSocket relays when drawer opens
  useEffect(() => {
    if (!post || !isOpen) {
      setReplies([]);
      return;
    }

    setIsFetchingReplies(true);
    const foundReplies = new Map<string, NostrEvent>();
    const seenEventIds = new Set<string>();
    let likes = post.likesCount || 0;
    let reposts = post.repostsCount || 0;
    let zaps = post.zapsCount || 0;

    const activeSockets: WebSocket[] = [];

    relays.forEach((relay) => {
      if (relay.status !== 'connected' && relay.status !== 'connecting') return;
      try {
        const ws = new WebSocket(relay.url);
        activeSockets.push(ws);

        ws.onopen = () => {
          // Subscribe to replies (Kind 1 referencing post.id) and reactions (Kind 7, 6, 9735)
          const subMessage = JSON.stringify([
            'REQ',
            `post_detail_${post.id.slice(0, 8)}`,
            { kinds: [1, 6, 7, 9735], '#e': [post.id], limit: 50 },
          ]);
          ws.send(subMessage);
        };

        ws.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data);
            if (!Array.isArray(data) || data[0] !== 'EVENT') return;
            const incoming = data[2];
            if (!incoming || !incoming.id) return;

            // Prevent double-counting across multiple relay WebSockets
            if (seenEventIds.has(incoming.id)) return;
            seenEventIds.add(incoming.id);

            if (incoming.kind === 1) {
              // Check if it's a direct reply
              const cleanContent = sanitizeZupContent(incoming.content);
              const replyEvent: NostrEvent = {
                id: incoming.id,
                pubkey: incoming.pubkey,
                created_at: incoming.created_at || Math.floor(Date.now() / 1000),
                kind: 1,
                tags: incoming.tags || [],
                content: cleanContent,
                sig: incoming.sig || '',
                relayUrl: relay.url,
                likesCount: 0,
                repostsCount: 0,
                zapsCount: 0,
                repliesCount: 0,
                author: {
                  name: `npub...${incoming.pubkey.slice(0, 6)}`,
                  displayName: `Peer ${incoming.pubkey.slice(0, 6)}`,
                  npub: pubkeyToNpub(incoming.pubkey),
                  avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${incoming.pubkey}`,
                },
              };
              foundReplies.set(incoming.id, replyEvent);
              setReplies(Array.from(foundReplies.values()).sort((a, b) => a.created_at - b.created_at));
            } else if (incoming.kind === 7) {
              likes++;
              setLikesCount(likes);
            } else if (incoming.kind === 6) {
              reposts++;
              setRepostsCount(reposts);
            } else if (incoming.kind === 9735) {
              zaps += 21; // base zap increment
              setZapsCount(zaps);
            }
          } catch {
            // Ignore parse errors
          }
        };
      } catch {
        // Ignore socket errors
      }
    });

    const timeout = setTimeout(() => {
      setIsFetchingReplies(false);
    }, 1500);

    return () => {
      clearTimeout(timeout);
      activeSockets.forEach((ws) => ws.close());
    };
  }, [post, isOpen, relays]);

  if (!post) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(post.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendReply = (e: FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim()) return;

    setIsSending(true);
    onSubmitReply(replyContent.trim(), post);

    // Optimistically prepend reply
    const newReply: NostrEvent = {
      id: `local_reply_${Date.now()}`,
      pubkey: keypair.pubkeyHex,
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [['e', post.id, '', 'reply']],
      content: replyContent.trim(),
      sig: '',
      author: {
        name: keypair.name || 'You',
        displayName: keypair.displayName || 'Sovereign Peer',
        npub: keypair.npub,
        avatar: keypair.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${keypair.pubkeyHex}`,
      },
    };

    setReplies((prev) => [...prev, newReply]);
    setReplyContent('');
    setIsSending(false);
  };

  return (
    <TactileDrawer
      id="post-detail-drawer"
      isOpen={isOpen}
      onClose={onClose}
      title="Zup Post Detail"
      subtitle={`Thread by @${post.author?.displayName || post.author?.name || 'peer'}`}
      isFullScreenMobile={true}
    >
      <div className="flex flex-col gap-4 pb-4">
        {/* Author Header */}
        <div className="flex items-start justify-between gap-3 p-4 rounded-[20px] bg-[#000000] border border-white/20 shadow-lg">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={
                post.author?.avatar ||
                `https://api.dicebear.com/7.x/identicon/svg?seed=${post.pubkey}`
              }
              alt={post.author?.name || 'Author'}
              className="w-12 h-12 rounded-full border border-white/20 bg-black shrink-0 object-cover"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-white font-black text-base truncate">
                  {post.author?.displayName || post.author?.name || 'Anonymous Peer'}
                </span>
                {post.author?.nip05 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
                    <ShieldCheck size={10} />
                    <span>{post.author.nip05.split('@')[1] || post.author.nip05}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-white/60 text-xs font-mono font-bold">
                  {formatTruncatedKey(post.author?.npub || post.pubkey, 8, 4)}
                </span>
                <span className="text-white/40 text-[10px] font-black">•</span>
                <span className="text-white/60 text-xs font-bold">
                  {formatTimeAgo(post.created_at)}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleCopyId}
            className="p-2 rounded-[12px] bg-[#161412] border border-white/20 hover:border-white/50 text-white/80 hover:text-white transition-all cursor-pointer shrink-0"
            title="Copy Note ID"
            aria-label="Copy Note ID"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
        </div>

        {/* Main Post Content */}
        <div className="p-5 rounded-[22px] bg-[#000000] border border-white/20 shadow-xl flex flex-col gap-4">
          <div className="text-white text-base sm:text-lg leading-relaxed font-medium whitespace-pre-wrap break-words">
            {sanitizeZupContent(post.content)}
          </div>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/10">
              {post.tags
                .filter((t) => t[0] === 't')
                .map((t, idx) => (
                  <span
                    key={idx}
                    className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-[8px] bg-[#161412] text-white/80 border border-white/15"
                  >
                    #{t[1]}
                  </span>
                ))}
            </div>
          )}

          {/* Interactive Engagement Bar */}
          <div className="pt-3 border-t border-white/15 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Like */}
              <button
                onClick={() => onLikeEvent(post.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] transition-all cursor-pointer ${
                  post.isLiked
                    ? 'bg-[#EC4899]/20 border border-[#EC4899] text-[#EC4899] shadow-[0_0_10px_#EC489933]'
                    : 'bg-[#161412] border border-white/15 hover:border-white/40 text-white/80 hover:text-white'
                }`}
                title="Like Zup"
              >
                <Heart
                  size={15}
                  className={post.isLiked ? 'fill-[#EC4899] text-[#EC4899]' : 'text-white/80'}
                />
                <span className="font-mono text-xs font-bold">{likesCount}</span>
              </button>

              {/* Repost */}
              <button
                onClick={() => onRepostEvent(post.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] transition-all cursor-pointer ${
                  post.isReposted
                    ? 'bg-[#10B981]/20 border border-[#10B981] text-emerald-300 shadow-[0_0_10px_#10B98133]'
                    : 'bg-[#161412] border border-white/15 hover:border-white/40 text-white/80 hover:text-white'
                }`}
                title="Repost Zup"
              >
                <Repeat2 size={15} className={post.isReposted ? 'text-emerald-400' : 'text-white/80'} />
                <span className="font-mono text-xs font-bold">{repostsCount}</span>
              </button>

              {/* Zap */}
              <button
                onClick={() => onOpenZap(post)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] transition-all cursor-pointer ${
                  post.isZapped
                    ? 'bg-[#F59E0B]/25 border border-[#F59E0B] text-amber-300 shadow-[0_0_12px_#F59E0B44]'
                    : 'bg-[#161412] border border-white/15 hover:border-[#F59E0B] text-white'
                }`}
                title="Zap Satoshis"
              >
                <Zap
                  size={15}
                  className={post.isZapped ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#F59E0B]'}
                />
                <span className="font-mono text-xs font-black text-[#F59E0B]">
                  {zapsCount ? `${zapsCount.toLocaleString()} sats` : 'Zap'}
                </span>
              </button>
            </div>

            <span className="text-white/50 text-xs font-mono font-bold">
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
            </span>
          </div>
        </div>

        {/* Reply Box Input */}
        <form onSubmit={handleSendReply} className="flex flex-col gap-2 p-4 rounded-[20px] bg-[#000000] border border-white/20 shadow-md">
          <label className="text-white text-xs font-extrabold uppercase tracking-wider flex items-center justify-between">
            <span>Post a Reply</span>
            <span className="text-white/40 font-mono text-[10px]">NIP-10 Thread</span>
          </label>
          <div className="flex gap-2">
            <textarea
              rows={2}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write your response to this Zup..."
              className="flex-1 bg-[#161412] border border-white/20 focus:border-[#EC4899] focus:outline-none rounded-[14px] px-3.5 py-2.5 text-white text-xs placeholder:text-white/40 resize-none leading-relaxed transition-colors"
            />
            <button
              type="submit"
              disabled={!replyContent.trim() || isSending}
              className="px-4 rounded-[14px] bg-[#EC4899] hover:bg-[#db2777] disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-[0_0_12px_#EC489944]"
            >
              <Send size={15} />
            </button>
          </div>
        </form>

        {/* Replies List */}
        <div className="flex flex-col gap-3 mt-1">
          <h4 className="text-white font-black text-xs uppercase tracking-wider m-0 px-1">
            Thread Replies {isFetchingReplies && '(Streaming live relays...)'}
          </h4>

          {replies.length === 0 ? (
            <div className="p-6 rounded-[18px] bg-[#000000] border border-white/15 text-center text-white/50 text-xs font-medium">
              No replies yet. Be the first to join this conversation!
            </div>
          ) : (
            replies.map((reply) => (
              <div
                key={reply.id}
                className="p-4 rounded-[18px] bg-[#000000] border border-white/15 flex flex-col gap-2 shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={
                      reply.author?.avatar ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${reply.pubkey}`
                    }
                    alt=""
                    className="w-7 h-7 rounded-full border border-white/20 bg-black shrink-0 object-cover"
                  />
                  <span className="text-white font-black text-xs">
                    {reply.author?.displayName || reply.author?.name || 'Peer'}
                  </span>
                  <span className="text-white/40 text-[10px] font-mono">•</span>
                  <span className="text-white/60 text-[11px] font-mono">
                    {formatTimeAgo(reply.created_at)}
                  </span>
                </div>
                <p className="text-white text-xs font-medium leading-relaxed m-0 whitespace-pre-wrap break-words">
                  {reply.content}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </TactileDrawer>
  );
}
