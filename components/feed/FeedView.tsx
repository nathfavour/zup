'use client';

import React, { useState, useEffect, useRef } from 'react';
import { LocalEvent, ProfileMetadata } from '@/lib/core/types';
import { db } from '@/lib/db';
import { formatHex, extractEventTags, isSpamOrReply } from '@/lib/core/nostr';
import { getSessionState } from '@/lib/state/session';
import { ClickToLoadMedia } from './ClickToLoadMedia';
import { PostDetailView } from './PostDetailView';
import { AccountRequiredDrawer } from '@/components/modals/AccountRequiredDrawer';
import { AddCommentDrawer } from '@/components/modals/AddCommentDrawer';
import {
  Search,
  MessageCircle,
  Repeat2,
  Heart,
  Zap,
  Share2,
  Check,
  Code2
} from 'lucide-react';

interface FeedViewProps {
  onInspectEvent: (event: LocalEvent) => void;
  onOpenComposer: () => void;
  onOpenConnectDrawer: () => void;
}

export function FeedView({
  onInspectEvent,
  onOpenComposer,
  onOpenConnectDrawer
}: FeedViewProps) {
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileMetadata>>(new Map());
  const [userInterests, setUserInterests] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [repostedPosts, setRepostedPosts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Selected post for Detail view
  const [selectedPost, setSelectedPost] = useState<LocalEvent | null>(null);

  // Gating & Comment drawers
  const [isAccountRequiredOpen, setIsAccountRequiredOpen] = useState(false);
  const [accountRequiredAction, setAccountRequiredAction] = useState('engage with dispatches');
  const [isAddCommentOpen, setIsAddCommentOpen] = useState(false);
  const [commentTargetPost, setCommentTargetPost] = useState<LocalEvent | null>(null);
  const [addedCommentsMap, setAddedCommentsMap] = useState<Map<string, LocalEvent[]>>(new Map());
  const [replyDeltas, setReplyDeltas] = useState<Map<string, number>>(new Map());

  const dwellTracker = useRef<Map<string, number>>(new Map());

  // Show a temporary toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Helper for gating unauthenticated users
  const requireAccount = (actionName: string, actionFn: () => void) => {
    const session = getSessionState();
    if (!session.activeIdentity) {
      setAccountRequiredAction(actionName);
      setIsAccountRequiredOpen(true);
      return;
    }
    actionFn();
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

        // Apply strict spam, reply, and low-effort filter: only genuine root posts
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
    if (typeof window === 'undefined' || !('IntersectionObserver' in window) || selectedPost) return;

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
  }, [events, selectedPost]);

  // Handle Share link copy (public, no account required)
  const handleShare = (eventId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://getzup.vercel.app';
    const shareUrl = `${origin}/zup/${eventId}`;
    navigator.clipboard.writeText(shareUrl);
    showToast('Copied share link to clipboard!');
  };

  // Handle Like toggle (gated)
  const handleLike = (eventId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    requireAccount('like dispatches', async () => {
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
    });
  };

  // Handle Repost toggle (gated)
  const handleRepost = (eventId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    requireAccount('repost dispatches', async () => {
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
    });
  };

  // Handle Zap intent (gated)
  const handleZap = (event: LocalEvent, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    requireAccount('send lightning zaps', async () => {
      await db.logTelemetry({
        pubkey: localStorage.getItem('zup:active_pubkey') || 'anonymous',
        eventId: event.id,
        targetPubkey: event.pubkey,
        interactionType: 'zap_intent',
        metadata: { targetKind: event.kind }
      });
      showToast(`⚡ Zap intent logged for @${formatHex(event.pubkey, 6, 0)}!`);
    });
  };

  // Handle Comment intent (gated)
  const handleOpenComment = (event: LocalEvent, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    requireAccount('reply to dispatches', () => {
      setCommentTargetPost(event);
      setIsAddCommentOpen(true);
    });
  };

  // When a comment is successfully added
  const handleCommentAdded = (newComment: LocalEvent) => {
    if (!commentTargetPost) return;
    const parentId = commentTargetPost.id;

    setAddedCommentsMap((prev) => {
      const next = new Map(prev);
      const list = next.get(parentId) || [];
      next.set(parentId, [...list, newComment]);
      return next;
    });

    setReplyDeltas((prev) => {
      const next = new Map(prev);
      const cur = next.get(parentId) || 0;
      next.set(parentId, cur + 1);
      return next;
    });

    showToast('Reply published to thread!');
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

  // IF A POST IS SELECTED, RENDER DETAIL VIEW
  if (selectedPost) {
    const profile = profiles.get(selectedPost.pubkey);
    const isLiked = likedPosts.has(selectedPost.id);
    const isReposted = repostedPosts.has(selectedPost.id);

    const seedNum = parseInt(selectedPost.id.slice(0, 2), 16) || 1;
    const delta = replyDeltas.get(selectedPost.id) || 0;
    const replyCount = (seedNum % 8) + 1 + delta;
    const repostCount = (seedNum % 14) + (isReposted ? 1 : 0);
    const likeCount = (seedNum % 32) + (isLiked ? 1 : 0);

    const newlyAdded = addedCommentsMap.get(selectedPost.id) || [];

    return (
      <>
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-pink-500 text-black text-xs font-bold rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <Check size={14} className="stroke-[3]" />
            <span>{toastMessage}</span>
          </div>
        )}

        <PostDetailView
          post={selectedPost}
          profile={profile}
          isLiked={isLiked}
          isReposted={isReposted}
          likeCount={likeCount}
          repostCount={repostCount}
          replyCount={replyCount}
          onBack={() => setSelectedPost(null)}
          onLike={() => handleLike(selectedPost.id)}
          onRepost={() => handleRepost(selectedPost.id)}
          onZap={() => handleZap(selectedPost)}
          onShare={() => handleShare(selectedPost.id)}
          onInspect={() => onInspectEvent(selectedPost)}
          onOpenCommentDrawer={() => handleOpenComment(selectedPost)}
          newlyAddedComments={newlyAdded}
        />

        {/* Account Required Gating Drawer */}
        <AccountRequiredDrawer
          isOpen={isAccountRequiredOpen}
          onClose={() => setIsAccountRequiredOpen(false)}
          onConnect={onOpenConnectDrawer}
          actionName={accountRequiredAction}
        />

        {/* Add Comment Bottom Drawer (max-h-[60vh]) */}
        <AddCommentDrawer
          isOpen={isAddCommentOpen}
          onClose={() => setIsAddCommentOpen(false)}
          parentEvent={commentTargetPost || selectedPost}
          parentAuthorName={profile?.display_name || profile?.name || 'Author'}
          onCommentAdded={handleCommentAdded}
        />
      </>
    );
  }

  // STANDARD FEED VIEW
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

        {/* Interests Bar */}
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

          {userInterests.map((interest, idx) => (
            <button
              key={`interest-${interest}-${idx}`}
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

            const seedNum = parseInt(event.id.slice(0, 2), 16) || 1;
            const delta = replyDeltas.get(event.id) || 0;
            const replyCount = (seedNum % 8) + 1 + delta;
            const repostCount = (seedNum % 14) + (isReposted ? 1 : 0);
            const likeCount = (seedNum % 32) + (isLiked ? 1 : 0);

            const mediaMatch = event.content.match(/(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp))/i);
            const mediaUrl = mediaMatch ? mediaMatch[1] : null;
            const textContent = mediaUrl ? event.content.replace(mediaUrl, '').trim() : event.content;
            const tags = extractEventTags(event.tags);

            return (
              <article
                key={event.id}
                data-event-id={event.id}
                onClick={() => setSelectedPost(event)}
                className="p-4 sm:p-5 hover:bg-white/[0.02] transition-colors flex items-start gap-3.5 cursor-pointer group"
              >
                {/* Left: User Profile Picture */}
                <div
                  className="shrink-0 pt-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPost(event);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarUrl}
                    alt={authorName}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/identicon/svg?seed=${event.pubkey}`;
                    }}
                    className="w-10 h-10 rounded-full border border-white/20 bg-[#161412] object-cover hover:opacity-90 transition-opacity"
                  />
                </div>

                {/* Right: Author line, content, media, Twitter-style actions */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* User line */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-sm text-white truncate group-hover:text-pink-300 transition-colors">
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
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectEvent(event);
                      }}
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
                      {tags.map((tag, idx) => (
                        <span
                          key={`${event.id}-tag-${tag}-${idx}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTag(tag);
                          }}
                          className="text-xs font-mono text-pink-400 hover:underline cursor-pointer"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Click-to-load media */}
                  {mediaUrl && (
                    <div className="pt-1.5" onClick={(e) => e.stopPropagation()}>
                      <ClickToLoadMedia url={mediaUrl} byteEstimate="64 KB" />
                    </div>
                  )}

                  {/* Twitter / X Style Action Row (Comment, Repost, Like, Zap, Share) */}
                  <div className="pt-2 flex items-center justify-between text-white/50 max-w-md text-xs select-none">
                    {/* Reply / Comment */}
                    <button
                      onClick={(e) => handleOpenComment(event, e)}
                      className="flex items-center gap-1.5 hover:text-sky-400 transition-colors cursor-pointer group/btn"
                      title="Reply"
                    >
                      <div className="p-1.5 rounded-full group-hover/btn:bg-sky-500/10">
                        <MessageCircle size={15} />
                      </div>
                      <span className="tabular-nums font-mono text-[11px]">{replyCount}</span>
                    </button>

                    {/* Repost */}
                    <button
                      onClick={(e) => handleRepost(event.id, e)}
                      className={`flex items-center gap-1.5 transition-colors cursor-pointer group/btn ${
                        isReposted ? 'text-emerald-400' : 'hover:text-emerald-400'
                      }`}
                      title="Repost"
                    >
                      <div className="p-1.5 rounded-full group-hover/btn:bg-emerald-500/10">
                        <Repeat2 size={15} />
                      </div>
                      <span className="tabular-nums font-mono text-[11px]">{repostCount}</span>
                    </button>

                    {/* Like */}
                    <button
                      onClick={(e) => handleLike(event.id, e)}
                      className={`flex items-center gap-1.5 transition-colors cursor-pointer group/btn ${
                        isLiked ? 'text-pink-500' : 'hover:text-pink-400'
                      }`}
                      title="Like"
                    >
                      <div className="p-1.5 rounded-full group-hover/btn:bg-pink-500/10">
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
                      className="flex items-center gap-1.5 hover:text-amber-400 transition-colors cursor-pointer group/btn"
                      title="Send Lightning Zap"
                    >
                      <div className="p-1.5 rounded-full group-hover/btn:bg-amber-500/10">
                        <Zap size={15} />
                      </div>
                    </button>

                    {/* Share Button (Instant Copy of [base uri]/zup/[id]) */}
                    <button
                      onClick={(e) => handleShare(event.id, e)}
                      className="flex items-center gap-1.5 hover:text-pink-400 transition-colors cursor-pointer group/btn"
                      title="Share link"
                    >
                      <div className="p-1.5 rounded-full group-hover/btn:bg-pink-500/10">
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

      {/* Account Required Gating Drawer */}
      <AccountRequiredDrawer
        isOpen={isAccountRequiredOpen}
        onClose={() => setIsAccountRequiredOpen(false)}
        onConnect={onOpenConnectDrawer}
        actionName={accountRequiredAction}
      />

      {/* Add Comment Bottom Drawer (max-h-[60vh]) */}
      <AddCommentDrawer
        isOpen={isAddCommentOpen}
        onClose={() => setIsAddCommentOpen(false)}
        parentEvent={commentTargetPost}
        parentAuthorName={
          commentTargetPost
            ? profiles.get(commentTargetPost.pubkey)?.display_name ||
              profiles.get(commentTargetPost.pubkey)?.name ||
              'Author'
            : 'Author'
        }
        onCommentAdded={handleCommentAdded}
      />
    </div>
  );
}
