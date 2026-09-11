import { useState, useEffect, type FormEvent } from 'react';
import { 
  Settings, 
  ArrowLeft, 
  Copy, 
  Check, 
  Zap, 
  Heart, 
  Repeat, 
  MessageSquare, 
  Edit3, 
  Calendar, 
  Radio, 
  ExternalLink,
  Plus,
  Flame,
  Shield,
  User,
  Share2
} from 'lucide-react';
import { 
  NostrKeypair, 
  NostrEvent, 
  ProfileSubTab, 
  RelayInfo, 
  VaultSecurityState, 
  StoredIdentity 
} from '../types';
import { 
  formatTruncatedKey, 
  pubkeyToNpub, 
  fetchNostrProfile,
  fetchUserNotesFromRelays,
  fetchUserRepliesFromRelays,
  fetchUserReactionsFromRelays,
  fetchUserContactsFromRelays,
  broadcastEventToRelays,
  signProfileMetadata
} from '../lib/nostr';
import { extractPostMedia } from '../lib/momentMedia';
import { ProfileSettingsDrawer } from './ProfileSettingsDrawer';

interface ProfileViewProps {
  keypair: NostrKeypair;
  onUpdateKeypair: (kp: NostrKeypair) => void;
  events: NostrEvent[];
  onOpenCompose: () => void;
  onOpenZap: (event: NostrEvent) => void;
  onLikeEvent: (eventId: string) => void;
  onRepostEvent: (eventId: string) => void;
  onReplyEvent: (event: NostrEvent) => void;
  onSelectPost?: (event: NostrEvent) => void;
  onBackToFeed: () => void;
  // Relays and Key Vault management for top Settings button
  relays: RelayInfo[];
  onAddRelay: (url: string, read: boolean, write: boolean) => void;
  onToggleRelayPermission: (url: string, type: 'read' | 'write') => void;
  onRemoveRelay: (url: string) => void;
  onTestPing: (url: string) => void;
  onResetDefaultRelays: () => void;
  vaultSecurity: VaultSecurityState | null;
  isVaultLocked: boolean;
  onLockVault: () => void;
  onOpenUnlock: () => void;
  onOpenSetupEncryption: () => void;
  onToggleEphemeral: () => void;
  identities: StoredIdentity[];
  activeIdentityId: string | null;
  onSelectIdentity: (id: StoredIdentity) => void;
  onOpenImportDrawer: () => void;
  onDeleteIdentity: (id: string) => void;
  onClearCache: () => void;
  onOpenPro: () => void;
}

export function ProfileView({
  keypair,
  onUpdateKeypair,
  events,
  onOpenCompose,
  onOpenZap,
  onLikeEvent,
  onRepostEvent,
  onReplyEvent,
  onSelectPost,
  onBackToFeed,
  relays,
  onAddRelay,
  onToggleRelayPermission,
  onRemoveRelay,
  onTestPing,
  onResetDefaultRelays,
  vaultSecurity,
  isVaultLocked,
  onLockVault,
  onOpenUnlock,
  onOpenSetupEncryption,
  onToggleEphemeral,
  identities,
  activeIdentityId,
  onSelectIdentity,
  onOpenImportDrawer,
  onDeleteIdentity,
  onClearCache,
  onOpenPro,
}: ProfileViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<ProfileSubTab>('zups');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isLoadingRelayData, setIsLoadingRelayData] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Relay data caches
  const [relayZups, setRelayZups] = useState<NostrEvent[]>([]);
  const [relayReplies, setRelayReplies] = useState<NostrEvent[]>([]);
  const [relayReactions, setRelayReactions] = useState<NostrEvent[]>([]);
  const [followingCount, setFollowingCount] = useState<number>(keypair.followingCount || 0);
  const [followersCount, setFollowersCount] = useState<number>(keypair.followersCount || 0);

  // Sync followingCount from keypair if it updates
  useEffect(() => {
    if (keypair.followingCount !== undefined) {
      setFollowingCount(keypair.followingCount);
    }
    if (keypair.followersCount !== undefined) {
      setFollowersCount(keypair.followersCount);
    }
  }, [keypair.followingCount, keypair.followersCount]);

  // Edit Profile Form State
  const [editDisplayName, setEditDisplayName] = useState(keypair.displayName || '');
  const [editName, setEditName] = useState(keypair.name || '');
  const [editAbout, setEditAbout] = useState(keypair.about || '');
  const [editAvatar, setEditAvatar] = useState(keypair.avatar || '');
  const [editNip05, setEditNip05] = useState(keypair.nip05 || '');
  const [editLud16, setEditLud16] = useState(keypair.lud16 || '');

  // Fetch real Kind 0 metadata on mount / pubkey change
  useEffect(() => {
    let isMounted = true;
    async function loadOnChainProfile() {
      if (!keypair.pubkeyHex) return;
      const relayUrls = relays.map((r) => r.url);
      try {
        const onChain = await fetchNostrProfile(keypair.pubkeyHex, relayUrls);
        if (onChain && isMounted) {
          const updated: NostrKeypair = {
            ...keypair,
            displayName: onChain.displayName || keypair.displayName,
            name: onChain.name || keypair.name,
            about: onChain.about || keypair.about,
            avatar: onChain.avatar || keypair.avatar,
            nip05: onChain.nip05 || keypair.nip05,
            lud16: onChain.lud16 || keypair.lud16,
          };
          onUpdateKeypair(updated);
          setEditDisplayName(updated.displayName || '');
          setEditName(updated.name || '');
          setEditAbout(updated.about || '');
          setEditAvatar(updated.avatar || '');
          setEditNip05(updated.nip05 || '');
          setEditLud16(updated.lud16 || '');
        }
      } catch (err) {
        console.warn('Could not fetch on-chain profile metadata:', err);
      }
    }

    loadOnChainProfile();
    return () => { isMounted = false; };
  }, [keypair.pubkeyHex, relays]);

  // Fetch user notes, replies, reactions, and contacts (Kind 3) directly from relays
  useEffect(() => {
    let isMounted = true;
    async function loadRelayActivity() {
      if (!keypair.pubkeyHex) return;
      setIsLoadingRelayData(true);
      const writeRelays = relays.filter((r) => r.write).map((r) => r.url);
      const queryRelayUrls = writeRelays.length > 0 ? writeRelays : relays.map((r) => r.url);

      try {
        const [notes, replies, reactions, contacts] = await Promise.all([
          fetchUserNotesFromRelays(keypair.pubkeyHex, queryRelayUrls),
          fetchUserRepliesFromRelays(keypair.pubkeyHex, queryRelayUrls),
          fetchUserReactionsFromRelays(keypair.pubkeyHex, queryRelayUrls),
          fetchUserContactsFromRelays(keypair.pubkeyHex, queryRelayUrls),
        ]);

        if (isMounted) {
          const formatToEvent = (raw: any): NostrEvent => ({
            id: raw.id,
            pubkey: raw.pubkey,
            created_at: raw.created_at,
            kind: raw.kind,
            tags: raw.tags || [],
            content: raw.content || '',
            sig: raw.sig || '',
            author: {
              name: keypair.name,
              displayName: keypair.displayName,
              avatar: keypair.avatar,
              npub: keypair.npub,
              nip05: keypair.nip05,
            },
            likesCount: 0,
            repostsCount: 0,
            zapsCount: 0,
            repliesCount: 0,
          });

          const formattedNotes = notes.map(formatToEvent);
          const formattedReplies = replies.map(formatToEvent);
          const formattedReactions = reactions.map(formatToEvent);

          setRelayZups(formattedNotes);
          setRelayReplies(formattedReplies);
          setRelayReactions(formattedReactions);
          setFollowingCount(contacts.followingCount);

          // Calculate total broadcasts and reactions to persist into local engine
          const totalBroadcasts = formattedNotes.length;
          const totalReactions = formattedReactions.length;

          // Immediately persist fresh counts back to RxDB via onUpdateKeypair so next load is instant
          onUpdateKeypair({
            ...keypair,
            followingCount: contacts.followingCount,
            broadcastsCount: totalBroadcasts,
            reactionsCount: totalReactions,
          });
        }
      } catch (err) {
        console.warn('Could not load user activity from relays:', err);
      } finally {
        if (isMounted) setIsLoadingRelayData(false);
      }
    }

    loadRelayActivity();
    return () => { isMounted = false; };
  }, [keypair.pubkeyHex, relays]);

  const handleCopyNpub = () => {
    navigator.clipboard.writeText(keypair.npub);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);

    const profileData = {
      displayName: editDisplayName.trim() || undefined,
      name: editName.trim() || undefined,
      about: editAbout.trim() || undefined,
      avatar: editAvatar.trim() || undefined,
      nip05: editNip05.trim() || undefined,
      lud16: editLud16.trim() || undefined,
    };

    const updated: NostrKeypair = {
      ...keypair,
      ...profileData,
    };

    // If private key is available, sign and broadcast real Kind 0 event to relays
    if (keypair.privkeyHex) {
      try {
        const signedKind0 = signProfileMetadata(profileData, keypair);
        if (signedKind0) {
          const writeUrls = relays.filter((r) => r.write).map((r) => r.url);
          const targets = writeUrls.length > 0 ? writeUrls : relays.map((r) => r.url);
          await broadcastEventToRelays(signedKind0, targets);
        }
      } catch (err) {
        console.error('Failed to sign and publish Kind 0 metadata:', err);
      }
    }

    onUpdateKeypair(updated);
    setIsSavingProfile(false);
    setIsEditProfileOpen(false);
  };

  // Merge local state with relay data, deduplicating by event id
  const mergeEvents = (localList: NostrEvent[], relayList: NostrEvent[]): NostrEvent[] => {
    const map = new Map<string, NostrEvent>();
    localList.forEach((e) => map.set(e.id, e));
    relayList.forEach((e) => {
      if (!map.has(e.id)) map.set(e.id, e);
    });
    return Array.from(map.values()).sort((a, b) => b.created_at - a.created_at);
  };

  const userZups = mergeEvents(
    events.filter((e) => e.pubkey === keypair.pubkeyHex && !e.tags.some((t) => t[0] === 'e')),
    relayZups
  );
  const userReplies = mergeEvents(
    events.filter((e) => e.pubkey === keypair.pubkeyHex && e.tags.some((t) => t[0] === 'e')),
    relayReplies
  );
  const userLikes = mergeEvents(
    events.filter((e) => e.isLiked),
    relayReactions.map((r) => {
      const targetId = r.tags.find((t) => t[0] === 'e')?.[1];
      const matching = events.find((ev) => ev.id === targetId);
      return matching ? { ...matching, isLiked: true } : r;
    })
  );
  const userZaps = events.filter((e) => e.isZapped);

  const [avatarLoadError, setAvatarLoadError] = useState(false);

  // Reset avatar error when keypair avatar changes
  useEffect(() => {
    setAvatarLoadError(false);
  }, [keypair.avatar]);

  const connectedRelaysCount = relays.filter((r) => r.status === 'connected').length;

  return (
    <div id="profile-view-container" className="flex flex-col gap-4 max-w-3xl mx-auto pb-12 animate-fadeIn">
      {/* 1. Profile Top Bar Navigation */}
      <div className="sticky top-[72px] sm:top-[80px] z-20 bg-[#000000]/95 backdrop-blur-xl border border-white/20 rounded-[20px] px-4 py-2.5 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToFeed}
            className="w-8 h-8 rounded-full bg-[#161412] hover:bg-[#25221f] border border-white/20 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer"
            aria-label="Back to feed"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-white font-black text-sm uppercase tracking-wider m-0 leading-tight">
              {keypair.displayName || keypair.name || 'Sovereign User'}
            </h2>
            <span className="text-white/50 text-[11px] font-mono font-medium block leading-none mt-0.5">
              {userZups.length} {userZups.length === 1 ? 'Zup' : 'Zups'}
            </span>
          </div>
        </div>

        {/* Top Profile Settings Button: Relegates Relays & Key Vault to top Settings icon */}
        <button
          id="profile-top-settings-btn"
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-[14px] bg-[#161412] hover:bg-[#25221f] border border-white/20 hover:border-[#EC4899]/60 text-white transition-all cursor-pointer shadow-sm group"
          title="Relays, Key Vault & Security Settings"
          aria-label="Settings"
        >
          <Settings size={16} className="text-[#EC4899] group-hover:rotate-45 transition-transform duration-300" />
          <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">
            Settings & Relays
          </span>
        </button>
      </div>

      {/* 2. Main Profile Card with Banner & Header */}
      <div className="rounded-[24px] bg-[#000000] border border-white/20 overflow-hidden shadow-2xl">
        {/* Ambient Cover Banner */}
        <div className="h-32 sm:h-44 w-full bg-[#161412] relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#EC4899_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-[10px] font-mono text-[#F59E0B] font-bold">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-ping" />
            <span>P2P Sovereign Mesh</span>
          </div>
        </div>

        {/* Avatar & Header Controls Row */}
        <div className="px-5 sm:px-6 pb-5 pt-0 relative">
          <div className="flex items-end justify-between -mt-12 sm:-mt-16 mb-4">
            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[24px] sm:rounded-[28px] bg-black border-4 border-[#000000] overflow-hidden shadow-2xl flex items-center justify-center shrink-0">
                {keypair.avatar && !avatarLoadError ? (
                  <img
                    src={keypair.avatar}
                    alt={keypair.displayName || 'Profile Avatar'}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarLoadError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#161412] border border-white/10 flex items-center justify-center text-white font-black text-2xl">
                    {(keypair.displayName || keypair.name || 'Z')[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div 
                className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-[#F59E0B] border-2 border-black" 
                title="Active Sovereign Signer"
              />
            </div>

            {/* Profile Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyNpub}
                className="px-3 py-1.5 rounded-[14px] bg-[#161412] hover:bg-[#25221f] border border-white/20 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                title="Share npub"
              >
                {copiedKey ? <Check size={14} className="text-[#F59E0B]" /> : <Share2 size={14} />}
                <span className="hidden xs:inline">{copiedKey ? 'Copied' : 'Share'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsEditProfileOpen(true)}
                className="px-4 py-1.5 rounded-[14px] bg-white text-black hover:bg-white/90 font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <Edit3 size={14} />
                <span>Edit Profile</span>
              </button>
            </div>
          </div>

          {/* Identity Info: Name, Username, NIP-05 */}
          <div className="space-y-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-white font-black text-xl sm:text-2xl tracking-tight m-0">
                  {keypair.displayName || keypair.name || 'Sovereign Broadcaster'}
                </h1>
                {keypair.nip05 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#EC4899]/20 border border-[#EC4899]/40 text-[#EC4899] text-[10px] font-mono font-bold">
                    ✓ {keypair.nip05}
                  </span>
                )}
              </div>
              <span className="text-white/50 text-xs font-mono font-semibold block mt-0.5">
                @{keypair.name || formatTruncatedKey(keypair.npub)}
              </span>
            </div>

            {/* Bio / About */}
            {keypair.about ? (
              <p className="text-white/90 text-sm font-medium leading-relaxed max-w-xl m-0">
                {keypair.about}
              </p>
            ) : (
              <p className="text-white/40 text-xs italic max-w-xl m-0">
                No bio set yet. Tap &ldquo;Edit Profile&rdquo; to customize your identity, avatar, and Lightning address.
              </p>
            )}

            {/* Metadata Pills */}
            <div className="flex items-center gap-3 flex-wrap pt-1 text-xs text-white/60">
              {/* Truncated npub with quick copy */}
              <button
                type="button"
                onClick={handleCopyNpub}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] bg-[#161412] border border-white/10 hover:border-white/30 text-white/80 font-mono text-[11px] cursor-pointer transition-all"
                title="Copy full npub"
              >
                <span>{formatTruncatedKey(keypair.npub)}</span>
                {copiedKey ? <Check size={12} className="text-[#F59E0B]" /> : <Copy size={12} />}
              </button>

              {/* Lightning Address (lud16) */}
              {keypair.lud16 && (
                <div className="flex items-center gap-1 text-[#F59E0B] font-mono text-[11px]">
                  <Zap size={13} />
                  <span>{keypair.lud16}</span>
                </div>
              )}

              {/* Connected Relays Status */}
              <button 
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-1 text-[#EC4899] font-mono text-[11px] hover:underline cursor-pointer bg-transparent border-0 p-0"
              >
                <Radio size={13} />
                <span>{connectedRelaysCount} Relays Connected</span>
              </button>

              {/* Signer Key State */}
              <div className="flex items-center gap-1 text-[#F59E0B] font-mono text-[11px]">
                <Shield size={12} />
                <span>{keypair.isEphemeral ? 'Ephemeral RAM Key' : 'Local Sovereign Key'}</span>
              </div>
            </div>

            {/* Real Network Counts (Local Engine cached + Relay refreshed) */}
            <div className="flex items-center gap-4 sm:gap-5 pt-2 text-xs flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-white font-black font-mono">{followingCount}</span>
                <span className="text-white/60 font-medium">Following</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-white font-black font-mono">{followersCount}</span>
                <span className="text-white/60 font-medium">Followers</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-white font-black font-mono">
                  {userZups.length || keypair.broadcastsCount || 0}
                </span>
                <span className="text-white/60 font-medium">Broadcasts</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-white font-black font-mono">
                  {userLikes.length || keypair.reactionsCount || 0}
                </span>
                <span className="text-white/60 font-medium">Reactions</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-white font-black font-mono">
                  {userZaps.length || keypair.zapsCount || 0}
                </span>
                <span className="text-white/60 font-medium">Zaps Sent</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Bottom Sub-Tabs (Zups, Replies, Likes, Zaps) */}
        <div className="flex items-center border-t border-white/15 bg-[#0a0a0a]">
          {[
            { id: 'zups', label: 'Zups', count: userZups.length, icon: MessageSquare },
            { id: 'replies', label: 'Replies', count: userReplies.length, icon: Repeat },
            { id: 'likes', label: 'Likes', count: userLikes.length, icon: Heart },
            { id: 'zaps', label: 'Zaps', count: userZaps.length, icon: Zap },
          ].map((tab) => {
            const isActive = activeSubTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                id={`profile-subtab-${tab.id}`}
                onClick={() => setActiveSubTab(tab.id as ProfileSubTab)}
                className={`flex-1 py-3 px-2 text-center flex items-center justify-center gap-1.5 relative group cursor-pointer transition-all ${
                  isActive ? 'text-white font-black' : 'text-white/60 hover:text-white font-bold'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-[#EC4899]' : 'text-white/50'} />
                <span className="text-xs uppercase tracking-wider">{tab.label}</span>
                {tab.count > 0 && (
                  <span className="text-[10px] font-mono px-1.5 rounded-full bg-white/10 text-white/80">
                    {tab.count}
                  </span>
                )}
                {/* Active Underline Indicator */}
                {isActive && (
                  <div className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-[#EC4899] shadow-[0_0_8px_#EC4899]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Sub-Tab Content Stream */}
      <div className="flex flex-col gap-3">
        {/* TAB 1: ZUPS */}
        {activeSubTab === 'zups' && (
          userZups.length === 0 ? (
            <div className="p-8 rounded-[22px] bg-[#000000] border border-white/20 text-center flex flex-col items-center justify-center gap-3 shadow-xl">
              <div className="w-12 h-12 rounded-[16px] bg-[#EC4899]/15 border border-[#EC4899]/30 text-[#EC4899] flex items-center justify-center">
                <MessageSquare size={24} />
              </div>
              <h4 className="text-white font-black text-sm uppercase tracking-wider m-0">
                No Zups Yet
              </h4>
              <p className="text-white/70 text-xs font-medium max-w-sm m-0">
                Say what’s up to the decentralized mesh. Your notes are client-signed and broadcast to connected relays.
              </p>
              <button
                type="button"
                onClick={onOpenCompose}
                className="mt-2 px-5 py-2.5 rounded-[14px] bg-[#EC4899] hover:bg-[#db2777] text-white font-black text-xs uppercase tracking-wider cursor-pointer shadow-[0_0_15px_#EC489933] active:scale-95 transition-all"
              >
                Create First Zup
              </button>
            </div>
          ) : (
            userZups.map((event) => (
              <ProfileNoteCard
                key={event.id}
                event={event}
                currentPubkey={keypair.pubkeyHex}
                onOpenZap={onOpenZap}
                onLikeEvent={onLikeEvent}
                onRepostEvent={onRepostEvent}
                onReplyEvent={onReplyEvent}
                onSelectPost={onSelectPost}
              />
            ))
          )
        )}

        {/* TAB 2: REPLIES */}
        {activeSubTab === 'replies' && (
          userReplies.length === 0 ? (
            <div className="p-8 rounded-[22px] bg-[#000000] border border-white/20 text-center flex flex-col items-center justify-center gap-2 shadow-xl">
              <Repeat size={24} className="text-white/40" />
              <h4 className="text-white font-black text-sm uppercase tracking-wider m-0">
                No Replies Yet
              </h4>
              <p className="text-white/60 text-xs font-medium max-w-sm m-0">
                Replies you make to notes on the decentralized feed will appear here.
              </p>
            </div>
          ) : (
            userReplies.map((event) => (
              <ProfileNoteCard
                key={event.id}
                event={event}
                currentPubkey={keypair.pubkeyHex}
                onOpenZap={onOpenZap}
                onLikeEvent={onLikeEvent}
                onRepostEvent={onRepostEvent}
                onReplyEvent={onReplyEvent}
              />
            ))
          )
        )}

        {/* TAB 3: LIKES */}
        {activeSubTab === 'likes' && (
          userLikes.length === 0 ? (
            <div className="p-8 rounded-[22px] bg-[#000000] border border-white/20 text-center flex flex-col items-center justify-center gap-2 shadow-xl">
              <Heart size={24} className="text-[#EC4899]/60" />
              <h4 className="text-white font-black text-sm uppercase tracking-wider m-0">
                No Liked Zups
              </h4>
              <p className="text-white/60 text-xs font-medium max-w-sm m-0">
                Tap the heart on notes in the feed to like them. Your signed Kind 7 reactions will show up here.
              </p>
            </div>
          ) : (
            userLikes.map((event) => (
              <ProfileNoteCard
                key={event.id}
                event={event}
                currentPubkey={keypair.pubkeyHex}
                onOpenZap={onOpenZap}
                onLikeEvent={onLikeEvent}
                onRepostEvent={onRepostEvent}
                onReplyEvent={onReplyEvent}
              />
            ))
          )
        )}

        {/* TAB 4: ZAPS */}
        {activeSubTab === 'zaps' && (
          userZaps.length === 0 ? (
            <div className="p-8 rounded-[22px] bg-[#000000] border border-white/20 text-center flex flex-col items-center justify-center gap-2 shadow-xl">
              <Zap size={24} className="text-[#F59E0B]" />
              <h4 className="text-white font-black text-sm uppercase tracking-wider m-0">
                No Zaps Yet
              </h4>
              <p className="text-white/60 text-xs font-medium max-w-sm m-0">
                Lightning zaps you send to creators across the Nostr relay mesh will be recorded here.
              </p>
            </div>
          ) : (
            userZaps.map((event) => (
              <ProfileNoteCard
                key={event.id}
                event={event}
                currentPubkey={keypair.pubkeyHex}
                onOpenZap={onOpenZap}
                onLikeEvent={onLikeEvent}
                onRepostEvent={onRepostEvent}
                onReplyEvent={onReplyEvent}
              />
            ))
          )
        )}
      </div>

      {/* 5. Relays & Key Vault Settings Drawer (Triggered by top Settings button) */}
      <ProfileSettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        keypair={keypair}
        onUpdateKeypair={onUpdateKeypair}
        relays={relays}
        onAddRelay={onAddRelay}
        onToggleRelayPermission={onToggleRelayPermission}
        onRemoveRelay={onRemoveRelay}
        onTestPing={onTestPing}
        onResetDefaultRelays={onResetDefaultRelays}
        vaultSecurity={vaultSecurity}
        isLocked={isVaultLocked}
        onLockVault={onLockVault}
        onOpenUnlock={onOpenUnlock}
        onOpenSetupEncryption={onOpenSetupEncryption}
        onToggleEphemeral={onToggleEphemeral}
        identities={identities}
        activeIdentityId={activeIdentityId}
        onSelectIdentity={onSelectIdentity}
        onOpenImportDrawer={onOpenImportDrawer}
        onDeleteIdentity={onDeleteIdentity}
        onClearCache={onClearCache}
        onOpenPro={onOpenPro}
      />

      {/* 6. Edit Profile Modal */}
      {isEditProfileOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fadeIn"
          onClick={() => setIsEditProfileOpen(false)}
        >
          <div 
            className="w-full max-w-lg bg-[#000000] border border-white/20 rounded-[28px] p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-white font-black text-base uppercase tracking-wider m-0">
                Edit Sovereign Profile
              </h3>
              <button
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                className="text-white/60 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              <div>
                <label className="text-white/70 text-xs font-bold uppercase tracking-wider block mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="e.g. Satoshi"
                  className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#161412] border border-white/20 text-white text-xs focus:outline-none focus:border-[#EC4899]"
                />
              </div>

              <div>
                <label className="text-white/70 text-xs font-bold uppercase tracking-wider block mb-1">
                  Handle (@username)
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. satoshi"
                  className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#161412] border border-white/20 text-white text-xs focus:outline-none focus:border-[#EC4899]"
                />
              </div>

              <div>
                <label className="text-white/70 text-xs font-bold uppercase tracking-wider block mb-1">
                  Bio / About
                </label>
                <textarea
                  value={editAbout}
                  onChange={(e) => setEditAbout(e.target.value)}
                  placeholder="Tell the mesh about yourself..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#161412] border border-white/20 text-white text-xs focus:outline-none focus:border-[#EC4899] resize-none"
                />
              </div>

              <div>
                <label className="text-white/70 text-xs font-bold uppercase tracking-wider block mb-1">
                  Avatar Image URL
                </label>
                <input
                  type="url"
                  value={editAvatar}
                  onChange={(e) => setEditAvatar(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#161412] border border-white/20 text-white text-xs font-mono focus:outline-none focus:border-[#EC4899]"
                />
              </div>

              <div>
                <label className="text-white/70 text-xs font-bold uppercase tracking-wider block mb-1">
                  Lightning Address (lud16)
                </label>
                <input
                  type="text"
                  value={editLud16}
                  onChange={(e) => setEditLud16(e.target.value)}
                  placeholder="user@wallet.com"
                  className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#161412] border border-white/20 text-white text-xs font-mono focus:outline-none focus:border-[#EC4899]"
                />
              </div>

              <div>
                <label className="text-white/70 text-xs font-bold uppercase tracking-wider block mb-1">
                  NIP-05 Verified Identifier
                </label>
                <input
                  type="text"
                  value={editNip05}
                  onChange={(e) => setEditNip05(e.target.value)}
                  placeholder="name@domain.com"
                  className="w-full px-3.5 py-2.5 rounded-[14px] bg-[#161412] border border-white/20 text-white text-xs font-mono focus:outline-none focus:border-[#EC4899]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="px-4 py-2 rounded-[12px] text-xs font-bold text-white/60 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2 rounded-[12px] bg-[#EC4899] hover:bg-[#db2777] text-white text-xs font-black uppercase tracking-wider cursor-pointer disabled:opacity-50 transition-all"
                >
                  {isSavingProfile ? 'Publishing...' : 'Save & Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface ProfileNoteCardProps {
  key?: string;
  event: NostrEvent;
  currentPubkey: string;
  onOpenZap: (event: NostrEvent) => void;
  onLikeEvent: (eventId: string) => void;
  onRepostEvent: (eventId: string) => void;
  onReplyEvent: (event: NostrEvent) => void;
  onSelectPost?: (event: NostrEvent) => void;
}

/**
 * Clean, tactile Note Card for Profile Sub-tabs
 */
function ProfileNoteCard({
  event,
  currentPubkey,
  onOpenZap,
  onLikeEvent,
  onRepostEvent,
  onReplyEvent,
  onSelectPost,
}: ProfileNoteCardProps) {
  const author = event.author;
  const displayName = author?.displayName || author?.name || formatTruncatedKey(event.pubkey);
  const avatar = author?.avatar;

  const dateStr = new Date(event.created_at * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      onClick={() => onSelectPost?.(event)}
      className="p-4 rounded-[20px] bg-[#000000] border border-white/20 hover:border-white/35 transition-all shadow-md cursor-pointer"
    >
      <div className="flex items-start gap-3">
        {/* Author Avatar */}
        <div className="w-10 h-10 rounded-[12px] bg-[#161412] border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
          {avatar ? (
            <img src={avatar} alt={displayName} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[#161412] border border-white/10 flex items-center justify-center text-white font-black text-sm">
              {displayName[0].toUpperCase()}
            </div>
          )}
        </div>

        {/* Note Body */}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <span className="text-white font-extrabold text-xs tracking-tight truncate">
                {displayName}
              </span>
              <span className="text-white/40 text-[11px] font-mono">
                · {dateStr}
              </span>
            </div>
            {event.isZapped && (
              <span className="px-2 py-0.5 rounded-full bg-[#F59E0B]/20 border border-[#F59E0B]/40 text-[#F59E0B] text-[10px] font-mono font-bold flex items-center gap-1">
                <Zap size={10} />
                <span>Zapped</span>
              </span>
            )}
          </div>

          {(() => {
            const media = extractPostMedia(event.content, event.tags);
            const cleanText = media.cleanText;

            return (
              <>
                {cleanText && (
                  <p className="text-white/90 text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap break-words m-0">
                    {cleanText}
                  </p>
                )}

                {media.images.length > 0 && (
                  <div
                    className={`grid gap-1.5 rounded-[14px] overflow-hidden border border-white/15 bg-black/40 my-2 ${
                      media.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {media.images.map((imgUrl, imgIdx) => (
                      <a
                        key={imgIdx}
                        href={imgUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative group overflow-hidden bg-[#161412] flex items-center justify-center max-h-[260px]"
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
                        <div className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/70 border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity text-white">
                          <ExternalLink size={10} />
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </>
            );
          })()}

          {/* Action Bar (Reply, Repost, Like, Zap) */}
          <div
            className="flex items-center justify-between pt-2 text-white/60 max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Reply */}
            <button
              type="button"
              onClick={() => onReplyEvent(event)}
              className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-xs"
            >
              <MessageSquare size={14} />
              <span className="text-[11px]">{event.repliesCount || 0}</span>
            </button>

            {/* Repost */}
            <button
              type="button"
              onClick={() => onRepostEvent(event.id)}
              className={`flex items-center gap-1 transition-colors cursor-pointer text-xs ${
                event.isReposted ? 'text-[#F59E0B]' : 'hover:text-white'
              }`}
            >
              <Repeat size={14} />
              <span className="text-[11px]">{event.repostsCount || 0}</span>
            </button>

            {/* Like */}
            <button
              type="button"
              onClick={() => onLikeEvent(event.id)}
              className={`flex items-center gap-1 transition-colors cursor-pointer text-xs ${
                event.isLiked ? 'text-[#EC4899]' : 'hover:text-[#EC4899]'
              }`}
            >
              <Heart size={14} fill={event.isLiked ? '#EC4899' : 'none'} />
              <span className="text-[11px]">{event.likesCount || 0}</span>
            </button>

            {/* Zap */}
            <button
              type="button"
              onClick={() => onOpenZap(event)}
              className={`flex items-center gap-1 transition-colors cursor-pointer text-xs ${
                event.isZapped ? 'text-[#F59E0B]' : 'hover:text-[#F59E0B]'
              }`}
            >
              <Zap size={14} fill={event.isZapped ? '#F59E0B' : 'none'} />
              <span className="text-[11px] font-mono">
                {event.zapsCount ? `${event.zapsCount}` : 'Zap'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
