export interface NostrKeypair {
  id?: string;
  pubkeyHex: string;
  npub: string;
  privkeyHex?: string;
  nsec?: string;
  isEphemeral: boolean;
  isWatchOnly?: boolean;
  name?: string;
  displayName?: string;
  about?: string;
  avatar?: string;
  nip05?: string;
  lud16?: string;
}

export interface EncryptedPayload {
  cipherText: string;
  iv: string;
  salt?: string;
}

export interface PasskeyRecord {
  id: string;
  name: string;
  credentialId: string;
  createdAt: number;
  lastUsed?: number;
  encryptedMEK: EncryptedPayload;
}

export interface VaultSecurityState {
  id: string;
  isInitialized: boolean;
  salt: string;
  passwordWrappedMEK: EncryptedPayload;
  passkeys: PasskeyRecord[];
  argonConfig: {
    iterations: number;
    memorySize: number;
    hashLength: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface StoredIdentity {
  id: string;
  pubkeyHex: string;
  npub: string;
  name: string;
  displayName: string;
  about?: string;
  avatar?: string;
  nip05?: string;
  lud16?: string;
  isEphemeral: boolean;
  isWatchOnly: boolean;
  encryptedPrivkeyHex?: string;
  encryptedNsec?: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
  // Computed client metadata
  author?: {
    name?: string;
    displayName?: string;
    npub?: string;
    avatar?: string;
    nip05?: string;
  };
  relayUrl?: string;
  likesCount?: number;
  repostsCount?: number;
  zapsCount?: number;
  repliesCount?: number;
  isLiked?: boolean;
  isReposted?: boolean;
  isZapped?: boolean;
  isBookmarked?: boolean;
  isSpam?: boolean;
  signalTier?: 'tier1' | 'tier2' | 'spam';
  category?: 'tech' | 'stem' | 'ai' | 'systems';
}

export interface RelayInfo {
  url: string;
  status: 'connected' | 'connecting' | 'offline' | 'error';
  latencyMs?: number;
  read: boolean;
  write: boolean;
  eventsReceived: number;
  eventsSent: number;
  description?: string;
  isDefault?: boolean;
}

export interface DirectMessageThread {
  peerPubkey: string;
  peerNpub: string;
  peerName: string;
  peerAvatar?: string;
  lastMessage: string;
  timestamp: number;
  unreadCount: number;
  messages: Array<{
    id: string;
    senderPubkey: string;
    content: string;
    timestamp: number;
    isEncrypted?: boolean;
  }>;
}

export type ActiveTab = 
  | 'feed' 
  | 'messages' 
  | 'notifications' 
  | 'profile' 
  | 'relays' 
  | 'vault' 
  | 'settings';

export interface NostrNotification {
  id: string;
  type: 'zap' | 'like' | 'repost' | 'reply' | 'mention';
  sourcePubkey: string;
  sourceName: string;
  sourceAvatar?: string;
  sourceNpub?: string;
  targetEventId?: string;
  targetEventContent?: string;
  amountSats?: number;
  comment?: string;
  timestamp: number;
  read: boolean;
}

export type ProfileSubTab = 'zups' | 'replies' | 'likes' | 'zaps';

export type FeedFilter = 
  | 'foryou'
  | 'tech' 
  | 'stem' 
  | 'ai' 
  | 'systems' 
  | 'zapped'
  | 'following' 
  | 'all'
  | 'global'
  | 'privacy'
  | 'media';
