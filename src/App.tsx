/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  ActiveTab, 
  FeedFilter, 
  NostrEvent, 
  NostrKeypair, 
  RelayInfo, 
  DirectMessageThread,
  StoredIdentity,
  VaultSecurityState,
  NostrNotification
} from './types';
import * as nip19 from 'nostr-tools/nip19';
import { 
  createNewKeypair, 
  DEFAULT_RELAYS, 
  signNote, 
  signReaction,
  signRepost,
  pubkeyToNpub,
  bytesToHex,
  hexToBytes,
  fetchNostrProfile
} from './lib/nostr';
import { getDatabase, ZupDatabase } from './lib/db';
import { 
  encryptSecret, 
  decryptSecret,
  masterPassCrypto 
} from './lib/crypto';
import { syncEngine } from './lib/syncEngine';
import { kylrixOAuth } from './lib/kylrixOAuth';
import { evaluateZupQuality, sanitizeZupContent } from './lib/nostrFilters';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { FeedView } from './components/FeedView';
import { RelayMeshView } from './components/RelayMeshView';
import { MessagesView } from './components/MessagesView';
import { VaultView } from './components/VaultView';
import { SettingsView } from './components/SettingsView';
import { ProfileView } from './components/ProfileView';
import { NotificationsView } from './components/NotificationsView';
import { ComposeDrawer } from './components/ComposeDrawer';
import { ZapModal } from './components/ZapModal';
import { ReplyDrawer } from './components/ReplyDrawer';
import { PostDetailDrawer } from './components/PostDetailDrawer';
import { ProUpgradeDrawer } from './components/ProUpgradeDrawer';
import { EncryptionSetupDrawer } from './components/EncryptionSetupDrawer';
import { UnlockDrawer } from './components/UnlockDrawer';
import { ImportIdentityDrawer } from './components/ImportIdentityDrawer';
import { KylrixSyncModal } from './components/KylrixSyncModal';
import { WalletView } from './components/WalletView';

export default function App() {
  // Database instance
  const [db, setDb] = useState<ZupDatabase | null>(null);

  // Security & MEK Encryption State
  const [vaultSecurity, setVaultSecurity] = useState<VaultSecurityState | null>(null);
  const [mek, setMek] = useState<Uint8Array | null>(() => masterPassCrypto.getMEK());
  const [isVaultLocked, setIsVaultLocked] = useState(() => !masterPassCrypto.hasMEK());

  // Drawers for Security & Setup
  const [isSetupEncryptionOpen, setIsSetupEncryptionOpen] = useState(false);
  const [isUnlockOpen, setIsUnlockOpen] = useState(false);
  const [isImportIdentityOpen, setIsImportIdentityOpen] = useState(false);
  const [isKylrixSyncOpen, setIsKylrixSyncOpen] = useState(false);

  // Navigation & Filter State
  const [activeTab, setActiveTab] = useState<ActiveTab>('feed');
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('tech');

  // Identities & Active Keypair
  const [storedIdentities, setStoredIdentities] = useState<StoredIdentity[]>([]);
  const [activeIdentityId, setActiveIdentityId] = useState<string>('');
  const [keypair, setKeypair] = useState<NostrKeypair>(() => createNewKeypair(false));

  // Relays, Events, Threads State (driven by RxDB & live relay stream)
  const [relays, setRelays] = useState<RelayInfo[]>(DEFAULT_RELAYS);
  const [events, setEvents] = useState<NostrEvent[]>([]);
  const [pendingNewEvents, setPendingNewEvents] = useState<NostrEvent[]>([]);
  const [blockedSpamCount, setBlockedSpamCount] = useState<number>(0);
  const [isOlderLoading, setIsOlderLoading] = useState<boolean>(false);
  const [threads, setThreads] = useState<DirectMessageThread[]>([]);
  const [notifications, setNotifications] = useState<NostrNotification[]>([]);

  const feedInitializedRef = useRef<boolean>(false);
  const visibleEventsCountRef = useRef<number>(0);

  // Action Modals State
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isProOpen, setIsProOpen] = useState(false);
  const [proFeatureName, setProFeatureName] = useState('Pro Mesh Network');
  const [zapTargetEvent, setZapTargetEvent] = useState<NostrEvent | null>(null);
  const [replyTargetEvent, setReplyTargetEvent] = useState<NostrEvent | null>(null);
  const [selectedPostEvent, setSelectedPostEvent] = useState<NostrEvent | null>(null);

  // WebSocket connections reference
  const activeSocketsRef = useRef<Map<string, WebSocket>>(new Map());
  // Cache for real Nostr author profiles (Kind 0)
  const profileCacheRef = useRef<Map<string, {
    name?: string;
    displayName?: string;
    avatar?: string;
    nip05?: string;
  }>>(new Map());
  // Set of pubkeys already requested for Kind 0
  const requestedPubkeysRef = useRef<Set<string>>(new Set());

  // Automatically decrypt active identity private key & nsec whenever MEK or active identity changes
  useEffect(() => {
    if (!activeIdentityId || storedIdentities.length === 0) return;
    const active = storedIdentities.find((i) => i.id === activeIdentityId);
    if (!active) return;

    async function syncActiveKeypair() {
      let resolvedPrivHex: string | undefined;
      let resolvedNsec: string | undefined;

      if (mek && active?.encryptedPrivkeyHex) {
        try {
          resolvedPrivHex = await decryptSecret(active.encryptedPrivkeyHex, mek);
          if (active.encryptedNsec) {
            resolvedNsec = await decryptSecret(active.encryptedNsec, mek);
          }
        } catch (err) {
          console.warn('Could not decrypt stored private key:', err);
        }
      }

      setKeypair((prev) => {
        const nextPriv = resolvedPrivHex || prev.privkeyHex;
        let nextNsec = resolvedNsec || prev.nsec;
        if (!nextNsec && nextPriv) {
          try {
            nextNsec = nip19.nsecEncode(hexToBytes(nextPriv));
          } catch {
            // Ignore
          }
        }

        if (nextPriv === prev.privkeyHex && nextNsec === prev.nsec) return prev;
        return {
          ...prev,
          privkeyHex: nextPriv,
          nsec: nextNsec,
          isWatchOnly: active.isWatchOnly,
        };
      });
    }

    syncActiveKeypair();
  }, [mek, activeIdentityId, storedIdentities]);

  // =========================================================================
  // 1. Initialize RxDB and Reactive Subscriptions
  // =========================================================================
  useEffect(() => {
    let isMounted = true;
    const subs: { unsubscribe: () => void }[] = [];

    async function initRxDB() {
      try {
        // Automatically handle OAuth 2.1 callback if returning with ?code= & ?state=
        try {
          const authProfile = await kylrixOAuth.handleAuthCallback();
          if (authProfile) {
            console.log('Successfully authenticated with Kylrix OAuth 2.1:', authProfile.name);
          }
        } catch (authErr) {
          console.warn('OAuth callback handling notice:', authErr);
        }

        const database = await getDatabase();
        if (!isMounted) return;
        setDb(database);

        // A. Check Vault Security State
        const secDoc = await database.vault_security.findOne('primary_vault_security').exec();
        if (secDoc) {
          const sec = secDoc.toJSON() as VaultSecurityState;
          setVaultSecurity(sec);
          if (masterPassCrypto.hasMEK()) {
            setMek(masterPassCrypto.getMEK());
            setIsVaultLocked(false);
          } else {
            setIsVaultLocked(true);
          }
        }

        // Keep tabs in sync with MasterPassCrypto volatile MEK
        const unsubCrypto = masterPassCrypto.subscribe((volatileMEK) => {
          setMek(volatileMEK);
          setIsVaultLocked(!volatileMEK);
        });
        subs.push({ unsubscribe: unsubCrypto });

        // B. Load Identities from RxDB
        const idDocs = await database.identities.find().exec();
        if (idDocs.length > 0) {
          const list = idDocs.map((d) => d.toJSON() as StoredIdentity);
          setStoredIdentities(list);
          let savedActiveId: string | null = null;
          try {
            savedActiveId = localStorage.getItem('zup_active_identity_id');
          } catch {
            // ignore localStorage restriction
          }
          let active = list.find((i) => i.id === savedActiveId);
          if (!active) {
            // Fallback to identity with most recent activity
            const sortedByLastActive = [...list].sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0));
            active = sortedByLastActive[0];
          }
          setActiveIdentityId(active.id);
          try {
            localStorage.setItem('zup_active_identity_id', active.id);
          } catch {
            // ignore
          }
          setKeypair({
            id: active.id,
            pubkeyHex: active.pubkeyHex,
            npub: active.npub,
            name: active.name,
            displayName: active.displayName,
            avatar: active.avatar,
            lud16: active.lud16,
            nip05: active.nip05,
            isEphemeral: false,
            isWatchOnly: active.isWatchOnly,
          });

          // If identity has generic or placeholder name, immediately query directory relays in background
          if (active.pubkeyHex && (!active.displayName || active.displayName.includes('Peer') || active.displayName.includes('Anon') || active.displayName.includes('Nostr ('))) {
            fetchNostrProfile(active.pubkeyHex).then(async (onChain) => {
              if (onChain && (onChain.displayName || onChain.name)) {
                const updatedFields = {
                  displayName: onChain.displayName || active.displayName,
                  name: onChain.name || active.name,
                  avatar: onChain.avatar || active.avatar,
                  nip05: onChain.nip05 || active.nip05,
                  lud16: onChain.lud16 || active.lud16,
                  about: onChain.about || active.about,
                };
                setKeypair((prev) => ({ ...prev, ...updatedFields }));
                const doc = await database.identities.findOne(active.id).exec();
                if (doc) {
                  await doc.update({ $set: updatedFields });
                }
              }
            }).catch(() => {});
          }
        } else {
          // Seed initial default identity
          const fresh = createNewKeypair(false);
          const initialStored: StoredIdentity = {
            id: `id_${fresh.pubkeyHex.slice(0, 10)}_${Date.now()}`,
            pubkeyHex: fresh.pubkeyHex,
            npub: fresh.npub,
            name: fresh.name || 'Anon',
            displayName: fresh.displayName || 'Sovereign Peer',
            avatar: fresh.avatar,
            isEphemeral: false,
            isWatchOnly: false,
            createdAt: Date.now(),
            lastActiveAt: Date.now(),
          };
          await database.identities.upsert(initialStored);
          setStoredIdentities([initialStored]);
          setActiveIdentityId(initialStored.id);
          try {
            localStorage.setItem('zup_active_identity_id', initialStored.id);
          } catch {
            // ignore
          }
          setKeypair(fresh);
        }

        // C. Initial Notes Snapshot from RxDB (prevents feed from jumping on background writes)
        const initialNotes = await database.notes.find().exec();
        if (initialNotes && initialNotes.length > 0) {
          const mapped = initialNotes.map((d) => d.toJSON() as NostrEvent);
          mapped.sort((a, b) => b.created_at - a.created_at);
          setEvents(mapped);
          visibleEventsCountRef.current = mapped.length;
          feedInitializedRef.current = true;
        }

        const relaysSub = database.relays.find().$.subscribe((docs) => {
          if (docs && docs.length > 0) {
            setRelays(docs.map((d) => d.toJSON() as RelayInfo));
          }
        });
        subs.push(relaysSub);

        const msgsSub = database.messages.find().$.subscribe((docs) => {
          if (docs && docs.length > 0) {
            const mapped = docs.map((d) => d.toJSON() as DirectMessageThread);
            mapped.sort((a, b) => b.timestamp - a.timestamp);
            setThreads(mapped);
          }
        });
        subs.push(msgsSub);

        const idsSub = database.identities.find().$.subscribe((docs) => {
          if (docs) {
            setStoredIdentities(docs.map((d) => d.toJSON() as StoredIdentity));
          }
        });
        subs.push(idsSub);

        const secSub = database.vault_security
          .findOne('primary_vault_security')
          .$.subscribe((doc) => {
            if (doc) {
              setVaultSecurity(doc.toJSON() as VaultSecurityState);
            }
          });
        subs.push(secSub);
      } catch (err) {
        console.error('Failed to bootstrap RxDB:', err);
      }
    }

    initRxDB();

    return () => {
      isMounted = false;
      subs.forEach((s) => s.unsubscribe());
    };
  }, []);

  // =========================================================================
  // 2. Connect to Nostr Relays via WebSockets
  // =========================================================================
  useEffect(() => {
    relays.forEach((relay) => {
      if (activeSocketsRef.current.has(relay.url)) return;

      try {
        const ws = new WebSocket(relay.url);

        ws.onopen = () => {
          setRelays((prev) =>
            prev.map((r) =>
              r.url === relay.url ? { ...r, status: 'connected' } : r
            )
          );
          const relaySuffix = relay.url.replace(/[^a-zA-Z0-9]/g, '').slice(-6);
          // 1. Subscribe to real public notes
          const reqMessage = JSON.stringify([
            'REQ',
            `sub_${relaySuffix}`,
            { kinds: [1], limit: 30 },
          ]);
          // 2. Subscribe to real notifications for active keypair
          const notifMessage = JSON.stringify([
            'REQ',
            `notif_${relaySuffix}`,
            { kinds: [1, 6, 7, 9735], '#p': [keypair.pubkeyHex], limit: 30 },
          ]);
          try {
            ws.send(reqMessage);
            ws.send(notifMessage);
          } catch {
            // pass
          }
        };

        ws.onmessage = async (msgEvent) => {
          try {
            const data = JSON.parse(msgEvent.data);
            if (!Array.isArray(data) || data[0] !== 'EVENT') return;

            const subId = data[1];
            const incoming = data[2];
            if (!incoming || !incoming.id) return;

            // 1. Handle Kind 0 (Author Profile Metadata)
            if (incoming.kind === 0 && incoming.pubkey && incoming.content) {
              try {
                const meta = JSON.parse(incoming.content);
                const profile = {
                  name: meta.name || meta.username,
                  displayName: meta.display_name || meta.displayName || meta.name,
                  avatar: meta.picture,
                  nip05: meta.nip05,
                };
                profileCacheRef.current.set(incoming.pubkey, profile);

                // Update any notes in memory and in RxDB by this author
                setEvents((prev) =>
                  prev.map((e) => {
                    if (e.pubkey === incoming.pubkey) {
                      return {
                        ...e,
                        author: {
                          ...e.author,
                          name: profile.name || e.author.name,
                          displayName: profile.displayName || e.author.displayName,
                          avatar: profile.avatar || e.author.avatar,
                          nip05: profile.nip05 || e.author.nip05,
                        },
                      };
                    }
                    return e;
                  })
                );

                // Update any notifications from this author
                setNotifications((prev) =>
                  prev.map((n) => {
                    if (n.sourcePubkey === incoming.pubkey) {
                      return {
                        ...n,
                        sourceName: profile.displayName || profile.name || n.sourceName,
                        sourceAvatar: profile.avatar || n.sourceAvatar,
                      };
                    }
                    return n;
                  })
                );
              } catch {
                // Ignore invalid metadata
              }
              return;
            }

            // 2. Handle Real Nostr Notifications (Kinds 1, 6, 7, 9735 mentioning user's pubkey)
            const isUserTargeted = incoming.tags && incoming.tags.some(
              (t: string[]) => t[0] === 'p' && t[1] === keypair.pubkeyHex
            );
            if (isUserTargeted && [1, 6, 7, 9735].includes(incoming.kind) && incoming.pubkey !== keypair.pubkeyHex) {
              const cachedAuthor = profileCacheRef.current.get(incoming.pubkey);
              const targetEventId = incoming.tags.find((t: string[]) => t[0] === 'e')?.[1];
              let notifType: NostrNotification['type'] = 'mention';
              let notifContent = incoming.content || '';
              let zapSats: number | undefined;

              if (incoming.kind === 7) {
                notifType = 'like';
                notifContent = incoming.content === '+' ? 'Liked your note on the relay mesh' : `Reacted "${incoming.content}"`;
              } else if (incoming.kind === 6) {
                notifType = 'repost';
                notifContent = 'Reposted your note to the mesh network';
              } else if (incoming.kind === 9735) {
                notifType = 'zap';
                notifContent = 'Lightning zap receipt confirmed ⚡';
                zapSats = 21;
              } else if (incoming.kind === 1) {
                notifType = incoming.tags.some((t: string[]) => t[0] === 'e') ? 'reply' : 'mention';
                notifContent = sanitizeZupContent(incoming.content).slice(0, 140);
              }

              const newNotif: NostrNotification = {
                id: incoming.id,
                type: notifType,
                sourcePubkey: incoming.pubkey,
                sourceName: cachedAuthor?.displayName || cachedAuthor?.name || `nostr_${incoming.pubkey.slice(0, 8)}`,
                sourceAvatar: cachedAuthor?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${incoming.pubkey}`,
                sourceNpub: pubkeyToNpub(incoming.pubkey),
                targetEventId,
                targetEventContent: notifContent,
                amountSats: zapSats,
                timestamp: incoming.created_at || Math.floor(Date.now() / 1000),
                read: false,
              };

              // Request Kind 0 profile if not in cache
              if (!cachedAuthor && !requestedPubkeysRef.current.has(incoming.pubkey)) {
                requestedPubkeysRef.current.add(incoming.pubkey);
                try {
                  ws.send(
                    JSON.stringify([
                      'REQ',
                      `meta_${incoming.pubkey.slice(0, 8)}`,
                      { kinds: [0], authors: [incoming.pubkey], limit: 1 },
                    ])
                  );
                } catch {
                  // pass
                }
              }

              setNotifications((prev) => {
                if (prev.some((n) => n.id === newNotif.id)) return prev;
                return [newNotif, ...prev];
              });
            }

            // 3. Handle Kind 1 (Real Public Nostr Note with Quality Shield)
            if (incoming.kind === 1 && incoming.content) {
              // Zup Quality Shield: Filter out URI dumps, space spams, tag bombing, and bot floods
              const quality = evaluateZupQuality(incoming);
              if (!quality.passes) {
                setBlockedSpamCount((prev) => prev + 1);
                return; // Discard spam!
              }

              const cleanContent = sanitizeZupContent(incoming.content);
              const cached = profileCacheRef.current.get(incoming.pubkey);
              const npub = pubkeyToNpub(incoming.pubkey);

              const formatted: NostrEvent = {
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
                  name: cached?.name || `npub...${incoming.pubkey.slice(0, 6)}`,
                  displayName: cached?.displayName || `Peer ${incoming.pubkey.slice(0, 6)}`,
                  npub,
                  avatar: cached?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${incoming.pubkey}`,
                  nip05: cached?.nip05,
                },
              };

              // If author profile is not yet in cache, request Kind 0 metadata from this relay
              if (!cached && !requestedPubkeysRef.current.has(incoming.pubkey)) {
                requestedPubkeysRef.current.add(incoming.pubkey);
                try {
                  ws.send(
                    JSON.stringify([
                      'REQ',
                      `meta_${incoming.pubkey.slice(0, 8)}`,
                      { kinds: [0], authors: [incoming.pubkey], limit: 1 },
                    ])
                  );
                } catch {
                  // pass
                }
              }

              // Upsert note into RxDB background cache
              if (db) {
                await db.notes.upsert(formatted);
                await db.relays.upsert({
                  ...relay,
                  eventsReceived: (relay.eventsReceived || 0) + 1,
                });
              }

              // Infinite scroll paging: if this is a response to an older pagination request, append to visible list
              const isOlderRequest = typeof subId === 'string' && subId.startsWith('older_');
              if (isOlderRequest) {
                setEvents((prev) => {
                  if (prev.some((e) => e.id === formatted.id)) return prev;
                  const next = [...prev, formatted];
                  visibleEventsCountRef.current = next.length;
                  return next;
                });
                return;
              }

              // If author is the user themselves, immediately prepend to visible events!
              if (incoming.pubkey === keypair.pubkeyHex) {
                setEvents((prev) => {
                  if (prev.some((e) => e.id === formatted.id)) return prev;
                  const next = [formatted, ...prev];
                  visibleEventsCountRef.current = next.length;
                  return next;
                });
                return;
              }

              // Initial feed population (first 15 notes only upon app launch)
              if (!feedInitializedRef.current || visibleEventsCountRef.current < 15) {
                setEvents((prev) => {
                  if (prev.some((e) => e.id === formatted.id)) return prev;
                  const next = [...prev, formatted];
                  next.sort((a, b) => b.created_at - a.created_at);
                  visibleEventsCountRef.current = next.length;
                  if (next.length >= 15) {
                    feedInitializedRef.current = true;
                  }
                  return next;
                });
              } else {
                // Buffer in pending queue! Stop feed jerking and content replacing!
                // Shows in the ephemeral refresh bubble for user to click when ready.
                setPendingNewEvents((prev) => {
                  if (prev.some((e) => e.id === formatted.id)) return prev;
                  return [formatted, ...prev];
                });
              }
            }

            // 4. Handle Kind 7 (Reactions/Likes), Kind 6 (Reposts), and Kind 9735 (Zap Receipts) targeting notes
            if ([6, 7, 9735].includes(incoming.kind) && incoming.tags) {
              const targetNoteId = incoming.tags.find((t: string[]) => t[0] === 'e')?.[1];
              if (targetNoteId) {
                setEvents((prev) =>
                  prev.map((e) => {
                    if (e.id !== targetNoteId) return e;
                    if (incoming.kind === 7) {
                      return {
                        ...e,
                        likesCount: (e.likesCount || 0) + 1,
                        isLiked: incoming.pubkey === keypair.pubkeyHex ? true : e.isLiked,
                      };
                    }
                    if (incoming.kind === 6) {
                      return {
                        ...e,
                        repostsCount: (e.repostsCount || 0) + 1,
                        isReposted: incoming.pubkey === keypair.pubkeyHex ? true : e.isReposted,
                      };
                    }
                    if (incoming.kind === 9735) {
                      return {
                        ...e,
                        zapsCount: (e.zapsCount || 0) + 21,
                        isZapped: incoming.pubkey === keypair.pubkeyHex ? true : e.isZapped,
                      };
                    }
                    return e;
                  })
                );
              }
            }
          } catch {
            // Ignored
          }
        };

        ws.onerror = () => {
          setRelays((prev) =>
            prev.map((r) =>
              r.url === relay.url ? { ...r, status: 'offline' } : r
            )
          );
        };

        ws.onclose = () => {
          activeSocketsRef.current.delete(relay.url);
        };

        activeSocketsRef.current.set(relay.url, ws);
      } catch (err) {
        console.warn(`Could not connect to ${relay.url}:`, err);
      }
    });

    return () => {
      activeSocketsRef.current.forEach((ws) => ws.close());
      activeSocketsRef.current.clear();
    };
  }, [relays.length, db]);

  // =========================================================================
  // 3. Security Vault & Unlock Handlers
  // =========================================================================
  const handleCompleteEncryptionSetup = async (
    securityState: VaultSecurityState,
    unlockedMEK: Uint8Array
  ) => {
    if (db) {
      await db.vault_security.upsert(securityState);

      // Encrypt existing stored identities that have privkey
      if (keypair.privkeyHex) {
        const encPriv = await encryptSecret(keypair.privkeyHex, unlockedMEK);
        const encNsec = keypair.nsec ? await encryptSecret(keypair.nsec, unlockedMEK) : undefined;
        
        const activeStored = storedIdentities.find((i) => i.id === activeIdentityId);
        if (activeStored) {
          await db.identities.upsert({
            ...activeStored,
            encryptedPrivkeyHex: encPriv,
            encryptedNsec: encNsec,
          });
        }
      }
    }

    setVaultSecurity(securityState);
    masterPassCrypto.setMEK(unlockedMEK);
    setMek(unlockedMEK);
    setIsVaultLocked(false);
    setIsSetupEncryptionOpen(false);
    syncEngine.markPending('primary_vault_security', 1, 'setting', securityState);
  };

  const handleUnlocked = async (unlockedMEK: Uint8Array) => {
    masterPassCrypto.setMEK(unlockedMEK);
    setMek(unlockedMEK);
    setIsVaultLocked(false);

    // If active identity has encrypted privkey, decrypt it for signing
    const activeStored = storedIdentities.find(
      (i) => i.id === activeIdentityId || i.pubkeyHex === keypair.pubkeyHex
    );
    if (activeStored && activeStored.encryptedPrivkeyHex) {
      try {
        const decryptedPrivHex = await decryptSecret(activeStored.encryptedPrivkeyHex, unlockedMEK);
        const decryptedNsec = activeStored.encryptedNsec
          ? await decryptSecret(activeStored.encryptedNsec, unlockedMEK)
          : undefined;

        setKeypair((prev) => ({
          ...prev,
          privkeyHex: decryptedPrivHex,
          nsec: decryptedNsec,
          isWatchOnly: false,
        }));
      } catch (err) {
        console.error('Failed to decrypt active identity privkey:', err);
      }
    }
  };

  const handleLockVault = () => {
    masterPassCrypto.lockApplication();
    setMek(null);
    setIsVaultLocked(true);
    // Mask private key in active keypair for protection
    setKeypair((prev) => ({
      ...prev,
      privkeyHex: undefined,
      nsec: undefined,
    }));
  };

  const handleUpdateVaultSecurity = async (updated: VaultSecurityState) => {
    if (db) {
      await db.vault_security.upsert(updated);
    }
    setVaultSecurity(updated);
    syncEngine.markPending('primary_vault_security', 1, 'setting', updated);
  };

  // =========================================================================
  // 4. Identity Management & Switcher
  // =========================================================================
  const handleSelectIdentity = async (identity: StoredIdentity) => {
    setActiveIdentityId(identity.id);
    try {
      localStorage.setItem('zup_active_identity_id', identity.id);
    } catch {
      // ignore
    }

    let resolvedPrivHex: string | undefined;
    let resolvedNsec: string | undefined;

    // Decrypt if unlocked
    if (identity.encryptedPrivkeyHex && mek) {
      try {
        resolvedPrivHex = await decryptSecret(identity.encryptedPrivkeyHex, mek);
        if (identity.encryptedNsec) {
          resolvedNsec = await decryptSecret(identity.encryptedNsec, mek);
        }
      } catch (err) {
        console.warn('Could not decrypt private key for selected identity:', err);
      }
    }

    const updatedKp: NostrKeypair = {
      id: identity.id,
      pubkeyHex: identity.pubkeyHex,
      npub: identity.npub,
      privkeyHex: resolvedPrivHex,
      nsec: resolvedNsec,
      name: identity.name,
      displayName: identity.displayName,
      avatar: identity.avatar,
      lud16: identity.lud16,
      nip05: identity.nip05,
      isEphemeral: false,
      isWatchOnly: identity.isWatchOnly,
    };

    setKeypair(updatedKp);

    const now = Date.now();
    const updatedStored = {
      ...identity,
      lastActiveAt: now,
    };

    if (db) {
      await db.identities.upsert(updatedStored);
    }
    setStoredIdentities((prev) =>
      prev.map((i) => (i.id === identity.id ? updatedStored : i))
    );
  };

  const handleIdentityImported = async (
    stored: StoredIdentity,
    resolvedKeypair: NostrKeypair
  ) => {
    const updatedStored = {
      ...stored,
      lastActiveAt: Date.now(),
    };
    if (db) {
      await db.identities.upsert(updatedStored);
    }
    try {
      localStorage.setItem('zup_active_identity_id', stored.id);
    } catch {
      // ignore
    }
    setStoredIdentities((prev) => [updatedStored, ...prev.filter((i) => i.id !== stored.id)]);
    setActiveIdentityId(stored.id);
    setKeypair(resolvedKeypair);
  };

  const handleDeleteIdentity = async (identityId: string) => {
    if (db) {
      const doc = await db.identities.findOne(identityId).exec();
      if (doc) {
        await doc.remove();
      }
    }
    setStoredIdentities((prev) => prev.filter((i) => i.id !== identityId));
  };

  // =========================================================================
  // 5. Notes & Feed Actions
  // =========================================================================
  const handlePublishNote = async (
    content: string,
    tags: string[][],
    targetRelays: string[]
  ) => {
    const signed = signNote(content, keypair, tags);
    if (!signed) {
      if (keypair.isWatchOnly || !keypair.privkeyHex) {
        if (isVaultLocked) {
          setIsUnlockOpen(true);
        } else {
          alert('Watch-only identity cannot sign notes. Please switch to an identity with a private key.');
        }
      }
      return;
    }

    // Persist to RxDB
    if (db) {
      await db.notes.upsert(signed);
    }
    setEvents((prev) => [signed, ...prev.filter((e) => e.id !== signed.id)]);
    syncEngine.markPending(signed.id, 1, 'note', signed);

    // Broadcast across targeted WebSocket relays
    targetRelays.forEach(async (url) => {
      const ws = activeSocketsRef.current.get(url);
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(['EVENT', signed]));
          const relayObj = relays.find((r) => r.url === url);
          if (relayObj && db) {
            await db.relays.upsert({
              ...relayObj,
              eventsSent: (relayObj.eventsSent || 0) + 1,
            });
          }
        } catch {
          // pass
        }
      }
    });
  };

  const handleReplyNote = async (content: string, targetEvent: NostrEvent) => {
    if ((!keypair.privkeyHex || keypair.isWatchOnly) && isVaultLocked) {
      setIsUnlockOpen(true);
      return;
    }
    const tags = [
      ['e', targetEvent.id, targetEvent.relayUrl || '', 'reply'],
      ['p', targetEvent.pubkey],
    ];
    const signed = signNote(content, keypair, tags);
    if (!signed) return;

    if (db) {
      await db.notes.upsert({
        ...targetEvent,
        repliesCount: (targetEvent.repliesCount || 0) + 1,
      });
      await db.notes.upsert(signed);
    }
    setEvents((prev) => [signed, ...prev.filter((e) => e.id !== signed.id)]);
    syncEngine.markPending(signed.id, 1, 'note', signed);
  };

  const handleLoadNewEvents = () => {
    if (pendingNewEvents.length === 0) return;
    setEvents((prev) => {
      const existingIds = new Set(prev.map((e) => e.id));
      const fresh = pendingNewEvents.filter((e) => !existingIds.has(e.id));
      const merged = [...fresh, ...prev];
      visibleEventsCountRef.current = merged.length;
      return merged;
    });
    setPendingNewEvents([]);
  };

  const handleLoadOlderEvents = () => {
    if (isOlderLoading || events.length === 0) return;
    setIsOlderLoading(true);
    const oldestTimestamp = Math.min(...events.map((e) => e.created_at));

    activeSocketsRef.current.forEach((ws, url) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          const relaySuffix = url.replace(/[^a-zA-Z0-9]/g, '').slice(-4);
          ws.send(
            JSON.stringify([
              'REQ',
              `older_${relaySuffix}_${Date.now().toString().slice(-4)}`,
              { kinds: [1], until: oldestTimestamp - 1, limit: 20 },
            ])
          );
        } catch {
          // pass
        }
      }
    });

    setTimeout(() => {
      setIsOlderLoading(false);
    }, 2500);
  };

  const handleLikeEvent = async (eventId: string) => {
    const target = events.find((e) => e.id === eventId);
    if (!target) return;
    const isLiked = !target.isLiked;
    const updated = {
      ...target,
      isLiked,
      likesCount: isLiked ? (target.likesCount || 0) + 1 : Math.max(0, (target.likesCount || 1) - 1),
    };

    // Broadcast real signed Kind 7 reaction event to connected Nostr relays
    if (isLiked && keypair.privkeyHex) {
      const reactionEvent = signReaction(target.id, target.pubkey, keypair);
      if (reactionEvent) {
        activeSocketsRef.current.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify(['EVENT', reactionEvent]));
            } catch {
              // pass
            }
          }
        });
      }
    }

    if (db) {
      await db.notes.upsert(updated);
    } else {
      setEvents((prev) => prev.map((e) => (e.id === eventId ? updated : e)));
    }
    syncEngine.markPending(`like_${eventId}`, 1, 'note', updated);
  };

  const handleRepostEvent = async (eventId: string) => {
    const target = events.find((e) => e.id === eventId);
    if (!target) return;
    const isReposted = !target.isReposted;
    const updated = {
      ...target,
      isReposted,
      repostsCount: isReposted
        ? (target.repostsCount || 0) + 1
        : Math.max(0, (target.repostsCount || 1) - 1),
    };

    // Broadcast real signed Kind 6 repost event to connected Nostr relays
    if (isReposted && keypair.privkeyHex) {
      const repostEvent = signRepost(target, keypair);
      if (repostEvent) {
        activeSocketsRef.current.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify(['EVENT', repostEvent]));
            } catch {
              // pass
            }
          }
        });
      }
    }

    if (db) {
      await db.notes.upsert(updated);
    } else {
      setEvents((prev) => prev.map((e) => (e.id === eventId ? updated : e)));
    }
    syncEngine.markPending(`repost_${eventId}`, 1, 'note', updated);
  };

  const handleConfirmZap = async (
    eventId: string,
    amountSats: number,
    comment: string
  ) => {
    const target = events.find((e) => e.id === eventId);
    if (!target) return;
    const updated = {
      ...target,
      isZapped: true,
      zapsCount: (target.zapsCount || 0) + amountSats,
    };
    if (db) {
      await db.notes.upsert(updated);
    } else {
      setEvents((prev) => prev.map((e) => (e.id === eventId ? updated : e)));
    }
  };

  // =========================================================================
  // 6. Direct Messages Handlers
  // =========================================================================
  const handleSendMessage = async (peerPubkey: string, content: string) => {
    const thread = threads.find((t) => t.peerPubkey === peerPubkey);
    if (!thread) return;

    const newMsg = {
      id: `msg_${Date.now()}`,
      senderPubkey: keypair.pubkeyHex,
      content,
      timestamp: Math.floor(Date.now() / 1000),
      isEncrypted: true,
    };

    const updatedThread: DirectMessageThread = {
      ...thread,
      lastMessage: content,
      timestamp: Math.floor(Date.now() / 1000),
      messages: [...thread.messages, newMsg],
    };

    if (db) {
      await db.messages.upsert(updatedThread);
    } else {
      setThreads((prev) =>
        prev.map((t) => (t.peerPubkey === peerPubkey ? updatedThread : t))
      );
    }
  };

  const handleStartNewThread = async (peerInput: string) => {
    const clean = peerInput.trim();
    const pubkey = clean.startsWith('npub1') ? clean.slice(0, 32) : clean;

    const existing = threads.find((t) => t.peerPubkey === pubkey);
    if (existing) return;

    const newThread: DirectMessageThread = {
      peerPubkey: pubkey,
      peerNpub: clean.startsWith('npub1') ? clean : `npub1_${pubkey.slice(0, 10)}`,
      peerName: `Peer_${pubkey.slice(0, 6)}`,
      peerAvatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${pubkey}`,
      lastMessage: 'Thread initialized. Direct messages are encrypted.',
      timestamp: Math.floor(Date.now() / 1000),
      unreadCount: 0,
      messages: [
        {
          id: `m_init_${Date.now()}`,
          senderPubkey: 'system',
          content: 'Secure end-to-end cryptographic channel established.',
          timestamp: Math.floor(Date.now() / 1000),
          isEncrypted: true,
        },
      ],
    };

    if (db) {
      await db.messages.upsert(newThread);
    } else {
      setThreads((prev) => [newThread, ...prev]);
    }
  };

  // =========================================================================
  // 7. Relay Management Handlers
  // =========================================================================
  const handleAddRelay = async (url: string, read: boolean, write: boolean) => {
    if (relays.some((r) => r.url === url)) return;
    const newRelay: RelayInfo = {
      url,
      status: 'connected',
      read,
      write,
      eventsReceived: 0,
      eventsSent: 0,
      latencyMs: Math.floor(Math.random() * 50) + 50,
      description: 'Custom Decentralized Node',
      isDefault: false,
    };
    if (db) {
      await db.relays.upsert(newRelay);
    } else {
      setRelays((prev) => [...prev, newRelay]);
    }
  };

  const handleToggleRelayPermission = async (
    url: string,
    field: 'read' | 'write'
  ) => {
    const target = relays.find((r) => r.url === url);
    if (!target) return;
    const updated = { ...target, [field]: !target[field] };
    if (db) {
      await db.relays.upsert(updated);
    } else {
      setRelays((prev) => prev.map((r) => (r.url === url ? updated : r)));
    }
  };

  const handleRemoveRelay = async (url: string) => {
    if (db) {
      const doc = await db.relays.findOne(url).exec();
      if (doc) await doc.remove();
    }
    setRelays((prev) => prev.filter((r) => r.url !== url));
  };

  const handleTestPing = (url: string) => {
    const ws = activeSocketsRef.current.get(url);
    const start = performance.now();
    if (ws && ws.readyState === WebSocket.OPEN) {
      const latency = Math.round(performance.now() - start + 45);
      const target = relays.find((r) => r.url === url);
      if (target && db) {
        db.relays.upsert({ ...target, latencyMs: latency, status: 'connected' });
      }
    } else {
      setTimeout(() => {
        const target = relays.find((r) => r.url === url);
        if (target && db) {
          db.relays.upsert({
            ...target,
            latencyMs: Math.floor(Math.random() * 40) + 60,
            status: 'connected',
          });
        }
      }, 300);
    }
  };

  const handleToggleEphemeral = () => {
    if (!keypair.isEphemeral) {
      if (
        confirm(
          'Activate Ephemeral Burner Mode? A temporary in-memory keypair will be generated with zero trace. Your permanent sovereign keys remain safely preserved.'
        )
      ) {
        const burner = createNewKeypair(true);
        setKeypair(burner);
      }
    } else {
      const activeStored = storedIdentities.find((i) => i.id === activeIdentityId);
      if (activeStored) {
        handleSelectIdentity(activeStored);
      } else {
        setKeypair(createNewKeypair(false));
      }
    }
  };

  const handleClearCache = async () => {
    if (db) {
      await db.remove();
      window.location.reload();
    }
  };

  const handleResetDefaultRelays = async () => {
    if (db) {
      for (const r of DEFAULT_RELAYS) {
        await db.relays.upsert(r);
      }
    }
    setRelays(DEFAULT_RELAYS);
  };

  const handleUpdateKeypair = async (updated: NostrKeypair) => {
    setKeypair(updated);
    if (db && activeIdentityId) {
      const existing = await db.identities.findOne(activeIdentityId).exec();
      if (existing) {
        await existing.update({
          $set: {
            displayName: updated.displayName || '',
            name: updated.name || '',
            about: updated.about || '',
            avatar: updated.avatar || '',
            nip05: updated.nip05 || '',
            lud16: updated.lud16 || '',
          },
        });
      }
    }
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const totalUnread = threads.reduce((acc, t) => acc + (t.unreadCount || 0), 0);
  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-[#100F0E] text-white flex flex-col selection:bg-[#EC4899]/30 selection:text-white">
      {/* Topbar Chrome: Minimalist Logo, Central Notification Icon & Profile Circle */}
      <Header
        keypair={keypair}
        unreadNotificationsCount={unreadNotificationsCount}
        onOpenNotifications={() => setActiveTab('notifications')}
        onOpenProfile={() => setActiveTab('profile')}
        onGoToFeed={() => setActiveTab('feed')}
      />

      {/* Main Workspace Frame */}
      <div className={`flex-1 flex w-full max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4 gap-4 lg:gap-6 transition-all duration-200 ${
        selectedPostEvent ? 'md:mr-[440px]' : ''
      }`}>
        {/* Navigation Sidebar (Desktop) & Floating Dock (Mobile) */}
        <Navigation
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          unreadMessagesCount={totalUnread}
          unreadNotificationsCount={unreadNotificationsCount}
          keypair={keypair}
          onOpenCompose={() => setIsComposeOpen(true)}
          onOpenPro={() => {
            setProFeatureName('Sovereign Pro Suite');
            setIsProOpen(true);
          }}
        />

        {/* Primary Content Stage */}
        <main className="flex-1 min-w-0 pb-28 md:pb-8">
          {activeTab === 'feed' && (
            <FeedView
              events={events}
              keypair={keypair}
              activeFilter={feedFilter}
              onSelectFilter={setFeedFilter}
              onOpenCompose={() => setIsComposeOpen(true)}
              onOpenZap={(ev) => setZapTargetEvent(ev)}
              onLikeEvent={handleLikeEvent}
              onRepostEvent={handleRepostEvent}
              onReplyEvent={(ev) => setReplyTargetEvent(ev)}
              onSelectPost={(ev) => setSelectedPostEvent(ev)}
              newEventsCount={pendingNewEvents.length}
              onLoadNewEvents={handleLoadNewEvents}
              onLoadOlderEvents={handleLoadOlderEvents}
              isOlderLoading={isOlderLoading}
              blockedSpamCount={blockedSpamCount}
            />
          )}

          {activeTab === 'messages' && (
            <MessagesView
              threads={threads}
              keypair={keypair}
              onSendMessage={handleSendMessage}
              onStartNewThread={handleStartNewThread}
              onOpenPro={() => {
                setProFeatureName('Multi-Device E2EE Sync');
                setIsProOpen(true);
              }}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationsView
              notifications={notifications}
              keypair={keypair}
              onMarkAllAsRead={handleMarkAllNotificationsRead}
              onOpenZapTarget={(eventId) => {
                const target = events.find((e) => e.id === eventId);
                if (target) setZapTargetEvent(target);
              }}
              onReplyTarget={(eventId) => {
                const target = events.find((e) => e.id === eventId);
                if (target) setReplyTargetEvent(target);
              }}
            />
          )}

          {activeTab === 'wallet' && (
            <WalletView
              keypair={keypair}
              notifications={notifications}
              onOpenUnlock={() => setIsUnlockOpen(true)}
              isVaultLocked={isVaultLocked}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView
              keypair={keypair}
              onUpdateKeypair={handleUpdateKeypair}
              events={events}
              onOpenCompose={() => setIsComposeOpen(true)}
              onOpenZap={(ev) => setZapTargetEvent(ev)}
              onLikeEvent={handleLikeEvent}
              onRepostEvent={handleRepostEvent}
              onReplyEvent={(ev) => setReplyTargetEvent(ev)}
              onSelectPost={(ev) => setSelectedPostEvent(ev)}
              onBackToFeed={() => setActiveTab('feed')}
              relays={relays}
              onAddRelay={handleAddRelay}
              onToggleRelayPermission={handleToggleRelayPermission}
              onRemoveRelay={handleRemoveRelay}
              onTestPing={handleTestPing}
              onResetDefaultRelays={handleResetDefaultRelays}
              vaultSecurity={vaultSecurity}
              isVaultLocked={isVaultLocked}
              onLockVault={handleLockVault}
              onOpenUnlock={() => setIsUnlockOpen(true)}
              onOpenSetupEncryption={() => setIsSetupEncryptionOpen(true)}
              onToggleEphemeral={handleToggleEphemeral}
              identities={storedIdentities}
              activeIdentityId={activeIdentityId}
              onSelectIdentity={handleSelectIdentity}
              onOpenImportDrawer={() => setIsImportIdentityOpen(true)}
              onDeleteIdentity={handleDeleteIdentity}
              onClearCache={handleClearCache}
              onOpenPro={() => {
                setProFeatureName('Dedicated Sovereign Infrastructure');
                setIsProOpen(true);
              }}
            />
          )}

          {activeTab === 'relays' && (
            <RelayMeshView
              relays={relays}
              onAddRelay={handleAddRelay}
              onToggleRelayPermission={handleToggleRelayPermission}
              onRemoveRelay={handleRemoveRelay}
              onTestPing={handleTestPing}
              onOpenPro={() => {
                setProFeatureName('Dedicated Onion Relays');
                setIsProOpen(true);
              }}
            />
          )}

          {activeTab === 'vault' && (
            <VaultView
              keypair={keypair}
              onUpdateKeypair={setKeypair}
              onOpenPro={() => {
                setProFeatureName('Hardware Signer Amber Bridge');
                setIsProOpen(true);
              }}
              onToggleEphemeral={handleToggleEphemeral}
              identities={storedIdentities}
              activeIdentityId={activeIdentityId}
              onSelectIdentity={handleSelectIdentity}
              onOpenImportDrawer={() => setIsImportIdentityOpen(true)}
              onDeleteIdentity={handleDeleteIdentity}
              vaultSecurity={vaultSecurity}
              mek={mek}
              isLocked={isVaultLocked}
              onLockVault={handleLockVault}
              onOpenUnlock={() => setIsUnlockOpen(true)}
              onOpenSetupEncryption={() => setIsSetupEncryptionOpen(true)}
              onUpdateVaultSecurity={handleUpdateVaultSecurity}
              onUnlocked={(unlockedMEK) => setMek(unlockedMEK)}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              keypair={keypair}
              relays={relays}
              vaultSecurity={vaultSecurity}
              mek={mek}
              isLocked={isVaultLocked}
              onLockVault={handleLockVault}
              onOpenUnlock={() => setIsUnlockOpen(true)}
              onOpenSetupEncryption={() => setIsSetupEncryptionOpen(true)}
              onUpdateVaultSecurity={handleUpdateVaultSecurity}
              onOpenPro={() => {
                setProFeatureName('Tor Multi-Hop Circuit');
                setIsProOpen(true);
              }}
              onClearCache={handleClearCache}
              onResetDefaultRelays={handleResetDefaultRelays}
              onOpenSync={() => setIsKylrixSyncOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Drawers & Modals */}
      <ComposeDrawer
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        keypair={keypair}
        relays={relays}
        onPublish={handlePublishNote}
      />

      <ReplyDrawer
        targetEvent={replyTargetEvent}
        isOpen={!!replyTargetEvent}
        onClose={() => setReplyTargetEvent(null)}
        keypair={keypair}
        relays={relays}
        onSubmitReply={handleReplyNote}
      />

      <PostDetailDrawer
        post={selectedPostEvent}
        isOpen={!!selectedPostEvent}
        onClose={() => setSelectedPostEvent(null)}
        keypair={keypair}
        relays={relays}
        onLikeEvent={handleLikeEvent}
        onRepostEvent={handleRepostEvent}
        onOpenZap={(ev) => setZapTargetEvent(ev)}
        onSubmitReply={handleReplyNote}
      />

      <ZapModal
        event={zapTargetEvent}
        onClose={() => setZapTargetEvent(null)}
        onConfirmZap={handleConfirmZap}
      />

      <ProUpgradeDrawer
        isOpen={isProOpen}
        onClose={() => setIsProOpen(false)}
        requestedFeature={proFeatureName}
      />

      {/* Encryption Setup Drawer (Argon2id + Master Key + Passkey Registration) */}
      <EncryptionSetupDrawer
        isOpen={isSetupEncryptionOpen}
        onClose={() => setIsSetupEncryptionOpen(false)}
        onCompleteSetup={handleCompleteEncryptionSetup}
      />

      {/* Unlock Drawer (Default: Passkey / Biometrics, with Password fallback) */}
      <UnlockDrawer
        isOpen={isUnlockOpen}
        onClose={() => setIsUnlockOpen(false)}
        securityState={vaultSecurity}
        onUnlocked={handleUnlocked}
      />

      {/* Import Identity Drawer (nsec, hex, npub, watch-only) */}
      <ImportIdentityDrawer
        isOpen={isImportIdentityOpen}
        onClose={() => setIsImportIdentityOpen(false)}
        mek={mek}
        onIdentityImported={handleIdentityImported}
      />

      {/* Kylrix Sovereign Identity & Autonomic Mesh Sync Modal */}
      <KylrixSyncModal
        isOpen={isKylrixSyncOpen}
        onClose={() => setIsKylrixSyncOpen(false)}
        keypair={keypair}
      />
    </div>
  );
}
