'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  getSessionState,
  setActiveIdentity,
  SessionState,
  subscribeSession,
  deleteIdentity
} from '@/lib/state/session';
import { db } from '@/lib/db';
import { LocalEvent, ProfileMetadata } from '@/lib/core/types';
import { formatHex, generateLocalIdenticon } from '@/lib/core/nostr';
import { hexToNpub } from '@/lib/core/crypto';
import { relayManager } from '@/lib/workers/relay-manager';
import {
  Settings,
  Copy,
  Check,
  Key,
  Layers,
  Heart,
  MessageCircle,
  Repeat2,
  Zap,
  ArrowLeft,
  PlusCircle,
  Trash2,
  Code2,
  Globe,
  ExternalLink
} from 'lucide-react';

interface ProfileViewProps {
  targetPubkey?: string | null;
  onBackToOwnProfile?: () => void;
  onOpenSettings: () => void;
  onInspectEvent: (event: LocalEvent) => void;
  onConnect: () => void;
  onViewProfile?: (pubkey: string) => void;
}

type ActivityTab = 'posts' | 'likes' | 'comments' | 'reposts' | 'zaps';

export function ProfileView({
  targetPubkey,
  onBackToOwnProfile,
  onOpenSettings,
  onInspectEvent,
  onConnect,
  onViewProfile
}: ProfileViewProps) {
  const [session, setSession] = useState<SessionState>(getSessionState());
  const [activeTab, setActiveTab] = useState<ActivityTab>('posts');

  // Profile metadata
  const [profile, setProfile] = useState<ProfileMetadata | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Profile activity events
  const [userEvents, setUserEvents] = useState<LocalEvent[]>([]);
  const [referencedEventsMap, setReferencedEventsMap] = useState<Map<string, LocalEvent>>(new Map());
  const [loading, setLoading] = useState(true);

  // Subscribe to session state
  useEffect(() => {
    const unsub = subscribeSession(setSession);
    return unsub;
  }, []);

  const effectivePubkey = targetPubkey || session.activePubkey;
  const isOwnProfile = !targetPubkey || targetPubkey === session.activePubkey;

  // Load profile metadata and activity events for effectivePubkey
  const loadProfileData = useCallback(async () => {
    if (!effectivePubkey) {
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch profile metadata from Dexie DB
      const prof = await db.profiles.get(effectivePubkey);
      if (prof) {
        setProfile(prof);
      } else {
        // Fallback profile if uncached
        const npub = hexToNpub(effectivePubkey);
        setProfile({
          pubkey: effectivePubkey,
          content: '{}',
          name: formatHex(npub, 12, 6),
          display_name: formatHex(npub, 12, 6),
          picture: generateLocalIdenticon(effectivePubkey),
          updated_at: Math.floor(Date.now() / 1000),
          cached_at: Date.now()
        });
      }

      // 2. Fetch all events from Dexie DB related to this author/pubkey
      const allEvents = await db.events.toArray();
      const evMap = new Map<string, LocalEvent>();
      allEvents.forEach((e) => evMap.set(e.id, e));
      setReferencedEventsMap(evMap);

      // Filter events authored by or tagging effectivePubkey
      const profileActivityEvents = allEvents.filter(
        (e) =>
          e.pubkey === effectivePubkey ||
          e.tags.some((t) => t[0] === 'p' && t[1] === effectivePubkey)
      );

      setUserEvents(profileActivityEvents.sort((a, b) => b.created_at - a.created_at));
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [effectivePubkey]);

  // Request live events from connected Nostr relays for this author
  useEffect(() => {
    if (!effectivePubkey) return;

    let active = true;

    async function init() {
      await loadProfileData();
    }
    init();

    // Send REQ subscription to connected Nostr relays for author activity & profile
    relayManager.queryAuthorProfileAndActivity(effectivePubkey);

    // Listen to real-time events streamed from relays
    const unsubRelay = relayManager.onNewEvent(() => {
      if (active) loadProfileData();
    });

    const pollInterval = setInterval(() => {
      if (active) loadProfileData();
    }, 2000);

    return () => {
      active = false;
      unsubRelay();
      clearInterval(pollInterval);
    };
  }, [effectivePubkey, loadProfileData]);

  if (!effectivePubkey && !session.activeIdentity) {
    return (
      <div className="space-y-6 max-w-xl mx-auto py-8">
        <div className="p-8 bg-[#000000] border border-white/20 rounded-[28px] text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-pink-500/10 border-2 border-pink-500/30 flex items-center justify-center mx-auto text-pink-400">
            <Key size={28} />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">
              No Nostr Identity Connected
            </h2>
            <p className="text-xs text-white/60 max-w-sm mx-auto leading-relaxed">
              Connect or generate a local Nostr persona to sign dispatches and view activity.
            </p>
          </div>

          <button
            onClick={onConnect}
            className="px-6 py-3 rounded-[16px] bg-pink-500 hover:bg-pink-400 text-black font-bold font-mono text-xs transition-all shadow-[0_0_16px_rgba(236,72,153,0.3)] cursor-pointer inline-flex items-center gap-2 active:scale-95"
          >
            <PlusCircle size={15} />
            <span>Connect or Create Identity</span>
          </button>
        </div>
      </div>
    );
  }

  const activePubkey = effectivePubkey || session.activePubkey || '';
  const npub = hexToNpub(activePubkey);
  const formattedNpub = formatHex(npub, 12, 6);
  const fallbackIdenticon = generateLocalIdenticon(activePubkey);

  const displayName = profile?.display_name || profile?.name || formattedNpub;
  const handleStr = profile?.nip05
    ? `@${profile.nip05}`
    : profile?.name
    ? `@${profile.name}`
    : `@${formatHex(npub, 10, 4)}`;
  const avatarUrl = profile?.picture || fallbackIdenticon;
  const bannerUrl = profile?.banner;

  const handleCopyNpub = () => {
    if (!npub) return;
    navigator.clipboard.writeText(npub);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleDeleteIdentity = async (e: React.MouseEvent, pubkey: string, label: string) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete persona "${label}"?`)) {
      await deleteIdentity(pubkey);
    }
  };

  // Organize user events into activity tabs
  const posts = userEvents.filter(
    (e) => (e.kind === 1 || e.kind === 30023) && e.pubkey === activePubkey && !e.tags.some((t) => t[0] === 'e')
  );

  const comments = userEvents.filter(
    (e) => (e.kind === 1 || e.kind === 30023) && e.pubkey === activePubkey && e.tags.some((t) => t[0] === 'e')
  );

  const likes = userEvents.filter((e) => e.kind === 7 && e.pubkey === activePubkey);

  const reposts = userEvents.filter((e) => e.kind === 6 && e.pubkey === activePubkey);

  const zaps = userEvents.filter(
    (e) => e.kind === 9735 && (e.pubkey === activePubkey || e.tags.some((t) => t[0] === 'p' && t[1] === activePubkey))
  );

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Top Navigation Banner if viewing another user's profile */}
      {!isOwnProfile && (
        <div className="flex items-center justify-between pb-1">
          <button
            onClick={onBackToOwnProfile}
            className="flex items-center gap-2 px-3.5 py-2 rounded-[14px] bg-[#000000] hover:bg-white/10 border border-white/20 text-xs font-mono font-bold text-white transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Back to My Profile</span>
          </button>
          <span className="text-xs font-mono text-pink-400 font-bold">Viewing Profile</span>
        </div>
      )}

      {/* Profile Header Card */}
      <div className="bg-[#000000] border border-white/20 rounded-[24px] overflow-hidden shadow-xl">
        {/* Banner Area */}
        <div className="h-32 sm:h-40 relative bg-[#161412] border-b border-white/10 overflow-hidden">
          {bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bannerUrl}
              alt="Profile banner"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-pink-900/30 via-purple-900/20 to-indigo-900/30 flex items-center justify-center">
              <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
                zup nostr identity
              </div>
            </div>
          )}
        </div>

        <div className="p-6 space-y-5 -mt-12 sm:-mt-14 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
            <div className="flex items-end gap-4 min-w-0">
              {/* Avatar Circle */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt={displayName}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = fallbackIdenticon;
                }}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-[#000000] bg-[#161412] object-cover shrink-0 shadow-2xl"
              />

              <div className="min-w-0 pb-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white tracking-tight truncate">
                    {displayName}
                  </h2>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                </div>
                <p className="text-xs font-mono text-white/60 truncate">
                  {handleStr}
                </p>
              </div>
            </div>

            {/* Actions: Settings if own profile */}
            {isOwnProfile && (
              <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                <button
                  onClick={onOpenSettings}
                  className="flex items-center gap-2 px-4 py-2 bg-[#161412] hover:bg-[#1E1C1A] border border-white/20 hover:border-pink-500 rounded-[14px] text-xs font-bold font-mono text-white transition-all shadow-md cursor-pointer"
                >
                  <Settings size={14} className="text-pink-400" />
                  <span>Settings</span>
                </button>
              </div>
            )}
          </div>

          {/* Metadata Badges: NIP-05, Website, Lightning lud16 */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono">
            {profile?.nip05 && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-bold text-emerald-400">
                <Check size={12} className="stroke-[3]" />
                <span>NIP-05: {profile.nip05}</span>
              </div>
            )}

            {profile?.lud16 && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-[11px] font-bold text-amber-400">
                <Zap size={12} className="fill-amber-400" />
                <span>{profile.lud16}</span>
              </div>
            )}

            {profile?.website && (
              <a
                href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 hover:border-sky-400 text-[11px] font-bold text-sky-400 transition-colors"
              >
                <Globe size={12} />
                <span>{profile.website.replace(/^https?:\/\//, '')}</span>
                <ExternalLink size={10} />
              </a>
            )}
          </div>

          {/* Bio / About if present */}
          {profile?.about ? (
            <p className="text-xs sm:text-sm text-white/90 leading-relaxed font-sans pt-1 whitespace-pre-line">
              {profile.about}
            </p>
          ) : (
            <p className="text-xs text-white/40 italic font-sans pt-1">
              No profile bio provided on connected relays.
            </p>
          )}

          {/* Public Key (npub) Display Bar */}
          <div className="p-3 bg-[#161412] border border-white/10 rounded-[16px] flex items-center justify-between gap-3 text-xs font-mono">
            <div className="min-w-0 flex items-center gap-2">
              <span className="text-pink-400 font-bold shrink-0">npub:</span>
              <span className="text-white/90 truncate select-all">{npub}</span>
            </div>
            <button
              onClick={handleCopyNpub}
              title="Copy Public Key (npub)"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white shrink-0 transition-colors cursor-pointer"
            >
              {copiedKey ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>

          {/* Persona Switcher (If own profile) */}
          {isOwnProfile && session.identities.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between text-xs font-mono text-white/50">
                <span>Switch Active Persona:</span>
                <button
                  onClick={onConnect}
                  className="text-pink-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle size={12} />
                  <span>Add / Import</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {session.identities.map((id) => {
                  const isSelected = id.pubkey === session.activePubkey;
                  const idNpub = id.npub || hexToNpub(id.pubkey);
                  return (
                    <button
                      key={id.pubkey}
                      onClick={() => setActiveIdentity(id.pubkey)}
                      className={`p-3 rounded-[16px] text-left transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-[#161412] border-2 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                          : 'bg-[#000000] border border-white/15 hover:border-white/30 text-white/70'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{id.label}</div>
                        <div className="text-[10px] font-mono text-white/40 truncate">
                          {formatHex(idNpub, 10, 4)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                            ACTIVE
                          </span>
                        )}
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => handleDeleteIdentity(e, id.pubkey, id.label)}
                          title="Delete Identity"
                          className="p-1 rounded bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 text-red-400 opacity-80 hover:opacity-100 transition-all cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Activity Tabs Bar: Posts, Likes, Comments, Reposts, Zaps */}
      <div className="space-y-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
          <button
            onClick={() => setActiveTab('posts')}
            className={`px-3.5 py-2 rounded-[14px] font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'posts'
                ? 'bg-pink-500 text-black shadow-md'
                : 'bg-[#000000] text-white/70 hover:text-white border border-white/15'
            }`}
          >
            <Layers size={14} />
            <span>Posts ({posts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('likes')}
            className={`px-3.5 py-2 rounded-[14px] font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'likes'
                ? 'bg-pink-500 text-black shadow-md'
                : 'bg-[#000000] text-white/70 hover:text-white border border-white/15'
            }`}
          >
            <Heart size={14} />
            <span>Likes ({likes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('comments')}
            className={`px-3.5 py-2 rounded-[14px] font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'comments'
                ? 'bg-pink-500 text-black shadow-md'
                : 'bg-[#000000] text-white/70 hover:text-white border border-white/15'
            }`}
          >
            <MessageCircle size={14} />
            <span>Comments ({comments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('reposts')}
            className={`px-3.5 py-2 rounded-[14px] font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'reposts'
                ? 'bg-pink-500 text-black shadow-md'
                : 'bg-[#000000] text-white/70 hover:text-white border border-white/15'
            }`}
          >
            <Repeat2 size={14} />
            <span>Reposts ({reposts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('zaps')}
            className={`px-3.5 py-2 rounded-[14px] font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'zaps'
                ? 'bg-pink-500 text-black shadow-md'
                : 'bg-[#000000] text-white/70 hover:text-white border border-white/15'
            }`}
          >
            <Zap size={14} />
            <span>Zaps ({zaps.length})</span>
          </button>
        </div>

        {/* Tab Content Display */}
        {loading ? (
          <div className="p-8 text-center bg-[#000000] border border-white/20 rounded-[22px] text-xs font-mono text-white/50">
            Fetching activities from connected relays...
          </div>
        ) : (
          <div className="space-y-3">
            {/* POSTS TAB */}
            {activeTab === 'posts' && (
              posts.length === 0 ? (
                <div className="p-8 text-center bg-[#000000] border border-white/20 rounded-[22px] text-xs font-mono text-white/50">
                  No root dispatches published by this profile yet.
                </div>
              ) : (
                posts.map((ev) => (
                  <article
                    key={ev.id}
                    onClick={() => onInspectEvent(ev)}
                    className="p-4 bg-[#000000] border border-white/20 hover:border-white/40 rounded-[20px] transition-colors space-y-2 cursor-pointer shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs font-mono text-white/50">
                      <span>{new Date(ev.created_at * 1000).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <div className="flex items-center gap-2">
                        <span>{formatHex(ev.id, 8, 4)}</span>
                        <Code2 size={13} className="text-white/40 hover:text-pink-400" />
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-white leading-relaxed line-clamp-3">
                      {ev.content}
                    </p>
                  </article>
                ))
              )
            )}

            {/* LIKES TAB */}
            {activeTab === 'likes' && (
              likes.length === 0 ? (
                <div className="p-8 text-center bg-[#000000] border border-white/20 rounded-[22px] text-xs font-mono text-white/50">
                  No liked dispatches found for this profile yet.
                </div>
              ) : (
                likes.map((ev) => {
                  const targetEventId = ev.tags.find((t) => t[0] === 'e')?.[1] || '';
                  const targetPost = targetEventId ? referencedEventsMap.get(targetEventId) : null;
                  return (
                    <article
                      key={ev.id}
                      onClick={() => onInspectEvent(ev)}
                      className="p-4 bg-[#000000] border border-white/20 hover:border-white/40 rounded-[20px] transition-colors space-y-2 cursor-pointer shadow-sm"
                    >
                      <div className="flex items-center justify-between text-xs font-mono text-pink-400">
                        <div className="flex items-center gap-1.5 font-bold">
                          <Heart size={14} className="fill-pink-500 text-pink-500" />
                          <span>Liked dispatch</span>
                        </div>
                        <span className="text-white/40">{new Date(ev.created_at * 1000).toLocaleDateString()}</span>
                      </div>
                      {targetPost ? (
                        <div className="p-3 bg-[#161412] border border-white/10 rounded-[14px] text-xs text-white/90 space-y-1">
                          <div className="text-[11px] font-mono text-white/50">
                            Post by @{formatHex(hexToNpub(targetPost.pubkey), 10, 4)}
                          </div>
                          <p className="line-clamp-2">{targetPost.content}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-white/70 font-mono">
                          Referenced event ID: {formatHex(targetEventId, 10, 6)}
                        </p>
                      )}
                    </article>
                  );
                })
              )
            )}

            {/* COMMENTS TAB */}
            {activeTab === 'comments' && (
              comments.length === 0 ? (
                <div className="p-8 text-center bg-[#000000] border border-white/20 rounded-[22px] text-xs font-mono text-white/50">
                  No replies or comments published by this profile yet.
                </div>
              ) : (
                comments.map((ev) => (
                  <article
                    key={ev.id}
                    onClick={() => onInspectEvent(ev)}
                    className="p-4 bg-[#000000] border border-white/20 hover:border-white/40 rounded-[20px] transition-colors space-y-2 cursor-pointer shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs font-mono text-sky-400">
                      <div className="flex items-center gap-1.5 font-bold">
                        <MessageCircle size={14} />
                        <span>Reply / Comment</span>
                      </div>
                      <span className="text-white/40">{new Date(ev.created_at * 1000).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-white leading-relaxed line-clamp-3">
                      {ev.content}
                    </p>
                  </article>
                ))
              )
            )}

            {/* REPOSTS TAB */}
            {activeTab === 'reposts' && (
              reposts.length === 0 ? (
                <div className="p-8 text-center bg-[#000000] border border-white/20 rounded-[22px] text-xs font-mono text-white/50">
                  No reposted dispatches found for this profile yet.
                </div>
              ) : (
                reposts.map((ev) => {
                  const targetEventId = ev.tags.find((t) => t[0] === 'e')?.[1] || '';
                  const targetPost = targetEventId ? referencedEventsMap.get(targetEventId) : null;
                  return (
                    <article
                      key={ev.id}
                      onClick={() => onInspectEvent(ev)}
                      className="p-4 bg-[#000000] border border-white/20 hover:border-white/40 rounded-[20px] transition-colors space-y-2 cursor-pointer shadow-sm"
                    >
                      <div className="flex items-center justify-between text-xs font-mono text-emerald-400">
                        <div className="flex items-center gap-1.5 font-bold">
                          <Repeat2 size={14} />
                          <span>Reposted dispatch</span>
                        </div>
                        <span className="text-white/40">{new Date(ev.created_at * 1000).toLocaleDateString()}</span>
                      </div>
                      {targetPost ? (
                        <div className="p-3 bg-[#161412] border border-white/10 rounded-[14px] text-xs text-white/90 space-y-1">
                          <div className="text-[11px] font-mono text-white/50">
                            Post by @{formatHex(hexToNpub(targetPost.pubkey), 10, 4)}
                          </div>
                          <p className="line-clamp-2">{targetPost.content}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-white/70 font-mono">
                          Referenced event ID: {formatHex(targetEventId, 10, 6)}
                        </p>
                      )}
                    </article>
                  );
                })
              )
            )}

            {/* ZAPS TAB */}
            {activeTab === 'zaps' && (
              zaps.length === 0 ? (
                <div className="p-8 text-center bg-[#000000] border border-white/20 rounded-[22px] text-xs font-mono text-white/50">
                  No Lightning Zap receipts found for this profile yet.
                </div>
              ) : (
                zaps.map((ev) => (
                  <article
                    key={ev.id}
                    onClick={() => onInspectEvent(ev)}
                    className="p-4 bg-[#000000] border border-white/20 hover:border-white/40 rounded-[20px] transition-colors space-y-2 cursor-pointer shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs font-mono text-amber-400">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Zap size={14} />
                        <span>⚡ Lightning Zap Receipt (Kind 9735)</span>
                      </div>
                      <span className="text-white/40">{new Date(ev.created_at * 1000).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-white/80 font-mono">
                      Zap Event: {formatHex(ev.id, 10, 6)}
                    </p>
                  </article>
                ))
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
