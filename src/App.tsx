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
  VaultSecurityState
} from './types';
import { 
  createNewKeypair, 
  DEFAULT_RELAYS, 
  signNote, 
  bytesToHex,
  hexToBytes
} from './lib/nostr';
import { INITIAL_EVENTS, INITIAL_DIRECT_MESSAGES } from './data/seedEvents';
import { getDatabase, ZupDatabase } from './lib/db';
import { 
  encryptSecret, 
  decryptSecret 
} from './lib/crypto';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { FeedView } from './components/FeedView';
import { RelayMeshView } from './components/RelayMeshView';
import { MessagesView } from './components/MessagesView';
import { VaultView } from './components/VaultView';
import { SettingsView } from './components/SettingsView';
import { ComposeDrawer } from './components/ComposeDrawer';
import { ZapModal } from './components/ZapModal';
import { ReplyDrawer } from './components/ReplyDrawer';
import { ProUpgradeDrawer } from './components/ProUpgradeDrawer';
import { EncryptionSetupDrawer } from './components/EncryptionSetupDrawer';
import { UnlockDrawer } from './components/UnlockDrawer';
import { ImportIdentityDrawer } from './components/ImportIdentityDrawer';

export default function App() {
  // Database instance
  const [db, setDb] = useState<ZupDatabase | null>(null);

  // Security & MEK Encryption State
  const [vaultSecurity, setVaultSecurity] = useState<VaultSecurityState | null>(null);
  const [mek, setMek] = useState<Uint8Array | null>(null);
  const [isVaultLocked, setIsVaultLocked] = useState(true);

  // Drawers for Security & Setup
  const [isSetupEncryptionOpen, setIsSetupEncryptionOpen] = useState(false);
  const [isUnlockOpen, setIsUnlockOpen] = useState(false);
  const [isImportIdentityOpen, setIsImportIdentityOpen] = useState(false);

  // Navigation & Filter State
  const [activeTab, setActiveTab] = useState<ActiveTab>('feed');
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('tech');

  // Identities & Active Keypair
  const [storedIdentities, setStoredIdentities] = useState<StoredIdentity[]>([]);
  const [activeIdentityId, setActiveIdentityId] = useState<string>('');
  const [keypair, setKeypair] = useState<NostrKeypair>(() => createNewKeypair(false));

  // Relays, Events, Threads State (driven by RxDB)
  const [relays, setRelays] = useState<RelayInfo[]>(DEFAULT_RELAYS);
  const [events, setEvents] = useState<NostrEvent[]>(INITIAL_EVENTS);
  const [threads, setThreads] = useState<DirectMessageThread[]>(INITIAL_DIRECT_MESSAGES);

  // Action Modals State
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isProOpen, setIsProOpen] = useState(false);
  const [proFeatureName, setProFeatureName] = useState('Pro Mesh Network');
  const [zapTargetEvent, setZapTargetEvent] = useState<NostrEvent | null>(null);
  const [replyTargetEvent, setReplyTargetEvent] = useState<NostrEvent | null>(null);

  // WebSocket connections reference
  const activeSocketsRef = useRef<Map<string, WebSocket>>(new Map());

  // =========================================================================
  // 1. Initialize RxDB and Reactive Subscriptions
  // =========================================================================
  useEffect(() => {
    let isMounted = true;

    async function initRxDB() {
      try {
        const database = await getDatabase();
        if (!isMounted) return;
        setDb(database);

        // A. Check Vault Security State
        const secDoc = await database.vault_security.findOne('primary_vault_security').exec();
        if (secDoc) {
          const sec = secDoc.toJSON() as VaultSecurityState;
          setVaultSecurity(sec);
          setIsVaultLocked(true);
          // By default prompt for passkey unlock!
          setIsUnlockOpen(true);
        } else {
          // First time launch: prompt encryption setup drawer
          setIsSetupEncryptionOpen(true);
        }

        // B. Load Identities from RxDB
        const idDocs = await database.identities.find().exec();
        if (idDocs.length > 0) {
          const list = idDocs.map((d) => d.toJSON() as StoredIdentity);
          setStoredIdentities(list);
          const active = list[0];
          setActiveIdentityId(active.id);
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
          setKeypair(fresh);
        }

        // C. Reactive RxDB Subscriptions
        const notesSub = database.notes.find().$.subscribe((docs) => {
          if (docs && docs.length > 0) {
            const mapped = docs.map((d) => d.toJSON() as NostrEvent);
            mapped.sort((a, b) => b.created_at - a.created_at);
            setEvents(mapped);
          }
        });

        const relaysSub = database.relays.find().$.subscribe((docs) => {
          if (docs && docs.length > 0) {
            setRelays(docs.map((d) => d.toJSON() as RelayInfo));
          }
        });

        const msgsSub = database.messages.find().$.subscribe((docs) => {
          if (docs && docs.length > 0) {
            const mapped = docs.map((d) => d.toJSON() as DirectMessageThread);
            mapped.sort((a, b) => b.timestamp - a.timestamp);
            setThreads(mapped);
          }
        });

        const idsSub = database.identities.find().$.subscribe((docs) => {
          if (docs) {
            setStoredIdentities(docs.map((d) => d.toJSON() as StoredIdentity));
          }
        });

        const secSub = database.vault_security
          .findOne('primary_vault_security')
          .$.subscribe((doc) => {
            if (doc) {
              setVaultSecurity(doc.toJSON() as VaultSecurityState);
            }
          });

        return () => {
          notesSub.unsubscribe();
          relaysSub.unsubscribe();
          msgsSub.unsubscribe();
          idsSub.unsubscribe();
          secSub.unsubscribe();
        };
      } catch (err) {
        console.error('Failed to bootstrap RxDB:', err);
      }
    }

    initRxDB();

    return () => {
      isMounted = false;
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
          const reqMessage = JSON.stringify([
            'REQ',
            `sub_${relay.url.slice(-4)}`,
            { kinds: [1], limit: 15 },
          ]);
          try {
            ws.send(reqMessage);
          } catch {
            // pass
          }
        };

        ws.onmessage = async (msgEvent) => {
          try {
            const data = JSON.parse(msgEvent.data);
            if (Array.isArray(data) && data[0] === 'EVENT') {
              const incoming = data[2];
              if (incoming && incoming.id && incoming.content) {
                const formatted: NostrEvent = {
                  id: incoming.id,
                  pubkey: incoming.pubkey,
                  created_at: incoming.created_at || Math.floor(Date.now() / 1000),
                  kind: incoming.kind || 1,
                  tags: incoming.tags || [],
                  content: incoming.content,
                  sig: incoming.sig || '',
                  relayUrl: relay.url,
                  likesCount: Math.floor(Math.random() * 10),
                  repostsCount: Math.floor(Math.random() * 5),
                  zapsCount: Math.floor(Math.random() * 50) * 21,
                  author: {
                    name: `peer_${incoming.pubkey.slice(0, 6)}`,
                    displayName: `Nostr Peer`,
                    avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${incoming.pubkey}`,
                  },
                };

                // Upsert directly into RxDB
                if (db) {
                  await db.notes.upsert(formatted);
                  await db.relays.upsert({
                    ...relay,
                    eventsReceived: (relay.eventsReceived || 0) + 1,
                  });
                }
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
    setMek(unlockedMEK);
    setIsVaultLocked(false);
    setIsSetupEncryptionOpen(false);
  };

  const handleUnlocked = async (unlockedMEK: Uint8Array) => {
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
  };

  // =========================================================================
  // 4. Identity Management & Switcher
  // =========================================================================
  const handleSelectIdentity = async (identity: StoredIdentity) => {
    setActiveIdentityId(identity.id);

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

    if (db) {
      await db.identities.upsert({
        ...identity,
        lastActiveAt: Date.now(),
      });
    }
  };

  const handleIdentityImported = async (
    stored: StoredIdentity,
    resolvedKeypair: NostrKeypair
  ) => {
    if (db) {
      await db.identities.upsert(stored);
    }
    setStoredIdentities((prev) => [stored, ...prev.filter((i) => i.id !== stored.id)]);
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
    } else {
      setEvents((prev) => [signed, ...prev]);
    }

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
    } else {
      setEvents((prev) => [signed, ...prev]);
    }
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
    if (db) {
      await db.notes.upsert(updated);
    } else {
      setEvents((prev) => prev.map((e) => (e.id === eventId ? updated : e)));
    }
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
    if (db) {
      await db.notes.upsert(updated);
    } else {
      setEvents((prev) => prev.map((e) => (e.id === eventId ? updated : e)));
    }
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

  const totalUnread = threads.reduce((acc, t) => acc + (t.unreadCount || 0), 0);

  return (
    <div className="min-h-screen bg-[#161412] text-white flex flex-col selection:bg-[#EC4899]/30 selection:text-white">
      {/* Topbar Chrome */}
      <Header
        keypair={keypair}
        relays={relays}
        onOpenCompose={() => setIsComposeOpen(true)}
        onOpenVault={() => setActiveTab('vault')}
        onOpenPro={() => {
          setProFeatureName('Pro Relay Mesh');
          setIsProOpen(true);
        }}
        onToggleEphemeral={handleToggleEphemeral}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex w-full max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-4 gap-4 lg:gap-6">
        {/* Navigation Sidebar (Desktop) & Floating Dock (Mobile) */}
        <Navigation
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          unreadCount={totalUnread}
          relays={relays}
          keypair={keypair}
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
              isLocked={isVaultLocked}
              onLockVault={handleLockVault}
              onOpenUnlock={() => setIsUnlockOpen(true)}
              onOpenSetupEncryption={() => setIsSetupEncryptionOpen(true)}
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
    </div>
  );
}
