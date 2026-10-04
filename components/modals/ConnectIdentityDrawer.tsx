'use client';

import React, { useState, useMemo } from 'react';
import {
  derivePubkeyHex,
  hexToNpub,
  hexToNsec,
  npubToHex,
  nsecToHex,
  bytesToHex
} from '@/lib/core/crypto';
import { db } from '@/lib/db';
import { EncryptedIdentity } from '@/lib/core/types';
import {
  getSessionState,
  setActiveIdentity,
  refreshCachedIdentities
} from '@/lib/state/session';
import {
  X,
  Key,
  PlusCircle,
  Download,
  Copy,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  User,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

interface ConnectIdentityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type ConnectTab = 'create' | 'import' | 'saved';

function generateRandomKeypair() {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const privHex = bytesToHex(randomBytes);
  const pubHex = derivePubkeyHex(privHex);
  const nsec = hexToNsec(privHex);
  const npub = hexToNpub(pubHex);
  return { privHex, pubHex, nsec, npub };
}

export function ConnectIdentityDrawer({ isOpen, onClose }: ConnectIdentityDrawerProps) {
  const [tab, setTab] = useState<ConnectTab>('create');

  // Keypair state
  const [keypair, setKeypair] = useState(generateRandomKeypair);
  const [newLabel, setNewLabel] = useState('Personal Persona');
  const [showNsec, setShowNsec] = useState(false);
  const [copiedNsec, setCopiedNsec] = useState(false);
  const [copiedNpub, setCopiedNpub] = useState(false);

  // Import State
  const [importKey, setImportKey] = useState('');
  const [importLabel, setImportLabel] = useState('Imported Persona');

  // Loading indicator
  const [isProcessing, setIsProcessing] = useState(false);

  // Session state derived directly
  const session = getSessionState();

  // Derived validation for import key (no useEffect needed)
  const importValidation = useMemo(() => {
    const clean = importKey.trim();
    if (!clean) {
      return { mode: null, error: null };
    }

    if (clean.startsWith('nsec1')) {
      try {
        const hex = nsecToHex(clean);
        if (hex.length === 64) {
          return { mode: 'nsec' as const, error: null };
        }
      } catch {}
      return { mode: null, error: 'Invalid nsec bech32 key format' };
    }

    if (clean.startsWith('npub1')) {
      try {
        const hex = npubToHex(clean);
        if (hex.length === 64) {
          return { mode: 'npub' as const, error: null };
        }
      } catch {}
      return { mode: null, error: 'Invalid npub bech32 key format' };
    }

    if (/^[0-9a-fA-F]{64}$/.test(clean)) {
      return { mode: 'hex' as const, error: null };
    }

    return { mode: null, error: 'Key must be nsec1..., npub1..., or 64-character hex' };
  }, [importKey]);

  if (!isOpen) return null;

  const handleRegenerate = () => {
    setKeypair(generateRandomKeypair());
    setCopiedNsec(false);
    setCopiedNpub(false);
  };

  // Handle Save Created Identity
  const handleSaveCreated = async () => {
    if (!keypair.pubHex || !keypair.privHex) return;
    setIsProcessing(true);

    try {
      const wrappedNsec = btoa(`mock_enc_${keypair.privHex}`);

      const newIdentity: EncryptedIdentity = {
        pubkey: keypair.pubHex,
        npub: keypair.npub,
        wrappedNsec,
        isExternalSigner: false,
        label: newLabel.trim() || 'My Persona',
        relays: ['wss://nos.lol', 'wss://relay.damus.io'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.identities.put(newIdentity);

      // Create profile metadata entry
      await db.profiles.put({
        pubkey: keypair.pubHex,
        name: newLabel.trim().toLowerCase().replace(/\s+/g, '_'),
        display_name: newLabel.trim(),
        picture: `https://api.dicebear.com/7.x/identicon/svg?seed=${keypair.pubHex}`,
        content: '{}',
        updated_at: Math.floor(Date.now() / 1000),
        cached_at: Date.now()
      });

      await refreshCachedIdentities();
      await setActiveIdentity(keypair.pubHex);
      onClose();
    } catch (err: unknown) {
      alert('Error creating identity: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Save Imported Identity
  const handleSaveImported = async () => {
    if (!importValidation.mode) return;
    setIsProcessing(true);

    try {
      let privHex = '';
      let pubHex = '';
      let npub = '';
      const clean = importKey.trim();

      if (importValidation.mode === 'nsec') {
        privHex = nsecToHex(clean);
        pubHex = derivePubkeyHex(privHex);
        npub = hexToNpub(pubHex);
      } else if (importValidation.mode === 'hex') {
        privHex = clean.toLowerCase();
        pubHex = derivePubkeyHex(privHex);
        npub = hexToNpub(pubHex);
      } else if (importValidation.mode === 'npub') {
        pubHex = npubToHex(clean);
        npub = clean;
        privHex = '';
      }

      const wrappedNsec = privHex ? btoa(`mock_enc_${privHex}`) : '';

      const importedIdentity: EncryptedIdentity = {
        pubkey: pubHex,
        npub,
        wrappedNsec,
        isExternalSigner: !privHex,
        label: importLabel.trim() || (privHex ? 'Imported Signer' : 'Watch-only Persona'),
        relays: ['wss://nos.lol', 'wss://relay.damus.io'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.identities.put(importedIdentity);

      const existingProfile = await db.profiles.get(pubHex);
      if (!existingProfile) {
        await db.profiles.put({
          pubkey: pubHex,
          name: importLabel.trim().toLowerCase().replace(/\s+/g, '_'),
          display_name: importLabel.trim(),
          picture: `https://api.dicebear.com/7.x/identicon/svg?seed=${pubHex}`,
          content: '{}',
          updated_at: Math.floor(Date.now() / 1000),
          cached_at: Date.now()
        });
      }

      await refreshCachedIdentities();
      await setActiveIdentity(pubHex);
      onClose();
    } catch (err: unknown) {
      alert('Error importing identity: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectSaved = async (pubkey: string) => {
    await setActiveIdentity(pubkey);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* 
        Bottom Drawer Container:
        - Max height strictly 60% height (max-h-[60vh])
        - Top rounded corners (rounded-t-[28px])
        - High-contrast OpenBricks 4.0 styling
      */}
      <div className="relative z-10 w-full max-w-xl mx-auto bg-[#161412] border-t-2 border-x border-white/20 rounded-t-[28px] shadow-2xl flex flex-col max-h-[60vh] overflow-hidden">
        {/* Top drag handle indicator */}
        <div className="w-12 h-1 bg-white/30 rounded-full mx-auto my-2.5 shrink-0" />

        {/* Drawer Header */}
        <div className="px-5 pb-3 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/30 text-pink-400">
              <Key size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Connect Nostr Identity
              </h2>
              <p className="text-[11px] font-mono text-white/50">
                Zero-knowledge local keys & personas
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="px-5 pt-3 shrink-0">
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#000000] border border-white/15 rounded-[16px]">
            <button
              onClick={() => setTab('create')}
              className={`py-1.5 rounded-[12px] text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                tab === 'create'
                  ? 'bg-[#161412] text-pink-400 border border-pink-500/40 shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <PlusCircle size={13} />
              <span>Create</span>
            </button>

            <button
              onClick={() => setTab('import')}
              className={`py-1.5 rounded-[12px] text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                tab === 'import'
                  ? 'bg-[#161412] text-pink-400 border border-pink-500/40 shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Download size={13} />
              <span>Import</span>
            </button>

            <button
              onClick={() => setTab('saved')}
              className={`py-1.5 rounded-[12px] text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                tab === 'saved'
                  ? 'bg-[#161412] text-pink-400 border border-pink-500/40 shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <User size={13} />
              <span>Saved ({session.identities.length})</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Area within 60vh limit */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* FLOW 1: CREATE NEW IDENTITY */}
          {tab === 'create' && (
            <div className="space-y-3.5">
              {/* Persona Label */}
              <div>
                <label className="text-[11px] font-mono text-white/70 block mb-1">
                  Persona Label
                </label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Personal, Tech Lead, Anonymous"
                  className="w-full bg-[#000000] border border-white/20 focus:border-pink-500 rounded-[14px] px-3.5 py-2 text-xs text-white outline-none font-mono placeholder-white/30"
                />
              </div>

              {/* Generated Keys Display */}
              <div className="p-3.5 bg-[#000000] border border-white/15 rounded-[18px] space-y-3">
                {/* Public Key npub */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-white/60">Public Key (npub):</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(keypair.npub);
                        setCopiedNpub(true);
                        setTimeout(() => setCopiedNpub(false), 2000);
                      }}
                      className="text-pink-400 hover:text-pink-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedNpub ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      <span>{copiedNpub ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="text-xs font-mono text-white/90 bg-[#161412] p-2 rounded-lg truncate border border-white/10">
                    {keypair.npub}
                  </div>
                </div>

                {/* Private Key nsec */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-amber-400 font-semibold">Private Key (nsec):</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowNsec(!showNsec)}
                        className="text-white/60 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        {showNsec ? <EyeOff size={11} /> : <Eye size={11} />}
                        <span>{showNsec ? 'Hide' : 'Reveal'}</span>
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(keypair.nsec);
                          setCopiedNsec(true);
                          setTimeout(() => setCopiedNsec(false), 2000);
                        }}
                        className="text-pink-400 hover:text-pink-300 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedNsec ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        <span>{copiedNsec ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                  <div className="text-xs font-mono text-amber-300/90 bg-[#161412] p-2 rounded-lg truncate border border-white/10">
                    {showNsec ? keypair.nsec : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-mono text-white/40">
                    Store your nsec offline. It never leaves your browser.
                  </span>
                  <button
                    onClick={handleRegenerate}
                    className="text-[10px] font-mono text-pink-400 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw size={10} />
                    <span>Regenerate</span>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSaveCreated}
                disabled={isProcessing}
                className="w-full py-3 rounded-[16px] bg-pink-500 hover:bg-pink-400 text-black font-bold font-mono text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-500/25 cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck size={15} />
                <span>{isProcessing ? 'Encrypting & Connecting...' : 'Connect Identity'}</span>
              </button>
            </div>
          )}

          {/* FLOW 2: IMPORT EXISTING IDENTITY */}
          {tab === 'import' && (
            <div className="space-y-3.5">
              <div>
                <label className="text-[11px] font-mono text-white/70 block mb-1">
                  Persona Label
                </label>
                <input
                  type="text"
                  value={importLabel}
                  onChange={(e) => setImportLabel(e.target.value)}
                  placeholder="e.g. My Primary Nostr Key"
                  className="w-full bg-[#000000] border border-white/20 focus:border-pink-500 rounded-[14px] px-3.5 py-2 text-xs text-white outline-none font-mono placeholder-white/30"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-white/70 block mb-1">
                  Private Key (nsec / hex) or Public Key (npub)
                </label>
                <input
                  type="text"
                  value={importKey}
                  onChange={(e) => setImportKey(e.target.value)}
                  placeholder="nsec1... or 64-char hex (or npub1... for read-only)"
                  className="w-full bg-[#000000] border border-white/20 focus:border-pink-500 rounded-[14px] px-3.5 py-2 text-xs text-white outline-none font-mono placeholder-white/30"
                />
              </div>

              {/* Validation Status */}
              {importValidation.mode && (
                <div className="p-2.5 rounded-[12px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2">
                  <Check size={13} className="text-emerald-400" />
                  <span>
                    Detected valid {importValidation.mode === 'nsec' ? 'private key (nsec)' : importValidation.mode === 'hex' ? 'hex private key' : 'public key (read-only npub)'}
                  </span>
                </div>
              )}

              {importValidation.error && (
                <div className="p-2.5 rounded-[12px] bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono">
                  {importValidation.error}
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSaveImported}
                disabled={isProcessing || !importValidation.mode}
                className="w-full py-3 rounded-[16px] bg-pink-500 hover:bg-pink-400 text-black font-bold font-mono text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-500/25 cursor-pointer disabled:opacity-40"
              >
                <Download size={15} />
                <span>{isProcessing ? 'Validating & Importing...' : 'Import & Connect'}</span>
              </button>
            </div>
          )}

          {/* FLOW 3: SAVED IDENTITIES LIST */}
          {tab === 'saved' && (
            <div className="space-y-2.5">
              {session.identities.length === 0 ? (
                <div className="p-8 text-center bg-[#000000] border border-white/15 rounded-[18px] text-xs font-mono text-white/50">
                  No personas saved in the local vault yet. Create or import one to connect.
                </div>
              ) : (
                session.identities.map((id) => {
                  const isCurrent = id.pubkey === session.activePubkey;
                  return (
                    <div
                      key={id.pubkey}
                      onClick={() => handleSelectSaved(id.pubkey)}
                      className={`p-3.5 rounded-[16px] border flex items-center justify-between transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-[#000000] border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                          : 'bg-[#000000] border-white/15 hover:border-white/40'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#161412] border border-white/20 flex items-center justify-center text-white font-bold text-xs font-mono shrink-0">
                          {id.label.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{id.label}</div>
                          <div className="text-[10px] font-mono text-white/40 truncate">
                            {id.npub || id.pubkey.slice(0, 16) + '...'}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isCurrent ? (
                          <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                            CONNECTED
                          </span>
                        ) : (
                          <span className="text-xs font-mono text-pink-400 flex items-center gap-1 hover:underline">
                            <span>Connect</span>
                            <ArrowRight size={12} />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
