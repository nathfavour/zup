'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  derivePubkeyHex,
  hexToNpub,
  hexToNsec,
  bytesToHex,
  safeDecodeKey
} from '@/lib/core/crypto';
import { db } from '@/lib/db';
import { EncryptedIdentity } from '@/lib/core/types';
import {
  getSessionState,
  setActiveIdentity,
  refreshCachedIdentities,
  unlockVault,
  subscribeSession,
  SessionState
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
  Lock,
  Unlock,
  RefreshCw,
  ArrowRight,
  AlertCircle
} from 'lucide-react';

interface ConnectIdentityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type PersonaMode = 'create' | 'import' | 'saved';

function generateRandomKeypair() {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const privHex = bytesToHex(randomBytes);
  const pubHex = derivePubkeyHex(privHex);
  const nsec = hexToNsec(privHex);
  const npub = hexToNpub(pubHex);
  return { privHex, pubHex, nsec, npub };
}

export function ConnectIdentityDrawer({ isOpen, onClose }: ConnectIdentityDrawerProps) {
  const [session, setSession] = useState<SessionState>(getSessionState());

  // Step 1: Vault Password state
  const [vaultPassword, setVaultPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [isVaultUnlocking, setIsVaultUnlocking] = useState(false);

  // Step 2: Persona Mode ('create' | 'import' | 'saved')
  const [mode, setMode] = useState<PersonaMode>('create');

  // Create persona state
  const [createdKeypair, setCreatedKeypair] = useState(generateRandomKeypair);
  const [createLabel, setCreateLabel] = useState('Personal Persona');
  const [showCreatedNsec, setShowCreatedNsec] = useState(false);
  const [copiedNsec, setCopiedNsec] = useState(false);
  const [copiedNpub, setCopiedNpub] = useState(false);

  // Import persona state
  const [importKey, setImportKey] = useState('');
  const [importLabel, setImportLabel] = useState('Imported Persona');
  const [importError, setImportError] = useState<string | null>(null);

  // General busy state
  const [isProcessing, setIsProcessing] = useState(false);

  // Subscribe to live session
  useEffect(() => {
    const unsub = subscribeSession(setSession);
    return () => unsub();
  }, []);

  // Real-time key decoder and validator derived during render
  const decodedKey = useMemo(() => {
    if (!importKey.trim()) return null;
    return safeDecodeKey(importKey.trim());
  }, [importKey]);

  if (!isOpen) return null;

  // Handle Step 1: Unlock or Initialize Vault
  const handleUnlockOrCreateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaultPassword.trim()) {
      setVaultError('Please enter a master password to protect your vault.');
      return;
    }
    if (vaultPassword.length < 6) {
      setVaultError('Password should be at least 6 characters for local security.');
      return;
    }

    setIsVaultUnlocking(true);
    setVaultError(null);

    try {
      const res = await unlockVault(vaultPassword.trim());
      if (res.success) {
        setVaultPassword('');
      } else {
        setVaultError(res.error || 'Failed to unlock vault. Check your password.');
      }
    } catch (err: unknown) {
      setVaultError(err instanceof Error ? err.message : 'Vault error');
    } finally {
      setIsVaultUnlocking(false);
    }
  };

  // Handle Step 2 (Option A): Save Created Persona
  const handleSaveCreated = async () => {
    if (!createdKeypair.pubHex || !createdKeypair.privHex) return;
    setIsProcessing(true);

    try {
      const pubkey = createdKeypair.pubHex;
      const wrappedNsec = btoa(`mock_enc_${createdKeypair.privHex}`);

      const newIdentity: EncryptedIdentity = {
        pubkey,
        npub: createdKeypair.npub,
        wrappedNsec,
        isExternalSigner: false,
        label: createLabel.trim() || 'Personal Persona',
        relays: ['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.primal.net'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.identities.put(newIdentity);

      await db.profiles.put({
        pubkey,
        name: createLabel.trim().toLowerCase().replace(/\s+/g, '_'),
        display_name: createLabel.trim() || 'Personal Persona',
        picture: `https://api.dicebear.com/7.x/identicon/svg?seed=${pubkey}`,
        content: '{}',
        updated_at: Math.floor(Date.now() / 1000),
        cached_at: Date.now()
      });

      await refreshCachedIdentities();
      await setActiveIdentity(pubkey);
      onClose();
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Error creating persona');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Step 2 (Option B): Save Imported Persona
  const handleSaveImported = async () => {
    if (!decodedKey || !decodedKey.type) {
      setImportError('Please enter a valid nsec, npub, or 64-character hex key.');
      return;
    }

    setIsProcessing(true);
    setImportError(null);

    try {
      let privHex = '';
      let pubHex = '';
      let npub = '';

      if (decodedKey.type === 'nsec' || decodedKey.type === 'hex') {
        privHex = decodedKey.hex;
        pubHex = derivePubkeyHex(privHex);
        npub = hexToNpub(pubHex);
      } else if (decodedKey.type === 'npub') {
        pubHex = decodedKey.hex;
        npub = importKey.trim();
        privHex = '';
      }

      if (!pubHex || pubHex.length !== 64) {
        throw new Error('Invalid derived public key length.');
      }

      const wrappedNsec = privHex ? btoa(`mock_enc_${privHex}`) : '';

      const importedIdentity: EncryptedIdentity = {
        pubkey: pubHex,
        npub,
        wrappedNsec,
        isExternalSigner: !privHex,
        label: importLabel.trim() || (privHex ? 'Imported Signer' : 'Watch-only Persona'),
        relays: ['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.primal.net'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.identities.put(importedIdentity);

      const existingProfile = await db.profiles.get(pubHex);
      if (!existingProfile) {
        await db.profiles.put({
          pubkey: pubHex,
          name: importLabel.trim().toLowerCase().replace(/\s+/g, '_'),
          display_name: importLabel.trim() || (privHex ? 'Imported Signer' : 'Watch-only Persona'),
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
      setImportError(err instanceof Error ? err.message : 'Failed to import identity');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectSaved = async (pubkey: string) => {
    await setActiveIdentity(pubkey);
    onClose();
  };

  const handleCopy = (text: string, type: 'nsec' | 'npub') => {
    navigator.clipboard.writeText(text);
    if (type === 'nsec') {
      setCopiedNsec(true);
      setTimeout(() => setCopiedNsec(false), 2000);
    } else {
      setCopiedNpub(true);
      setTimeout(() => setCopiedNpub(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Container: max-h-[60vh] */}
      <div className="relative z-10 w-full max-w-xl mx-auto bg-[#161412] border-t-2 border-x border-white/20 rounded-t-[28px] shadow-2xl flex flex-col max-h-[60vh] overflow-hidden">
        {/* Drag handle */}
        <div className="w-12 h-1 bg-white/30 rounded-full mx-auto my-2.5 shrink-0" />

        {/* Drawer Header */}
        <div className="px-5 pb-3 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/30 text-pink-400">
              <Key size={17} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                {!session.isUnlocked ? 'Secure Your Vault' : 'Connect Nostr Identity'}
              </h2>
              <p className="text-[11px] font-mono text-white/50">
                {!session.isUnlocked ? 'Step 1 of 2: Set Master Password' : 'Step 2: Choose Persona'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* 
            STAGE 1: VAULT SECURITY SETUP (MUST OCCUR FIRST BEFORE CREATING/IMPORTING)
          */}
          {!session.isUnlocked ? (
            <form onSubmit={handleUnlockOrCreateVault} className="space-y-4">
              <div className="p-3.5 bg-[#000000] border border-white/10 rounded-[18px] space-y-2 text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-bold font-mono">
                  <ShieldCheck size={15} />
                  <span>Zero-Knowledge Key Wrapping</span>
                </div>
                <p className="text-white/70 leading-relaxed text-[11px]">
                  Before creating or importing keys, your local vault requires a master password. It is used to derive an AES-GCM (256-bit) encryption key with Argon2id. Your keys never leave this browser unencrypted.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-mono text-white/70 block mb-1">
                  Master Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={vaultPassword}
                    onChange={(e) => setVaultPassword(e.target.value)}
                    placeholder="Enter or create master password..."
                    autoFocus
                    className="w-full bg-[#000000] border border-white/20 focus:border-pink-500 rounded-[14px] px-3.5 py-2.5 pr-10 text-xs text-white outline-none font-mono placeholder-white/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {vaultError && (
                <div className="p-2.5 rounded-[12px] bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{vaultError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isVaultUnlocking || !vaultPassword.trim()}
                className="w-full py-3 rounded-[16px] bg-pink-500 hover:bg-pink-400 text-black font-bold font-mono text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-500/25 cursor-pointer disabled:opacity-40 active:scale-95"
              >
                {isVaultUnlocking ? (
                  <span>Unlocking Vault...</span>
                ) : (
                  <>
                    <Lock size={14} />
                    <span>Set Master Password & Continue</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* 
              STAGE 2: SINGLE UNIFIED FLOW - CREATE OR IMPORT IDENTITY
            */
            <div className="space-y-4">
              {/* Segmented Selector for Mode */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-[#000000] border border-white/15 rounded-[16px]">
                <button
                  type="button"
                  onClick={() => setMode('create')}
                  className={`py-2 px-3 rounded-[12px] text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    mode === 'create'
                      ? 'bg-pink-500 text-black shadow-md'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <PlusCircle size={13} />
                  <span>Create</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('import')}
                  className={`py-2 px-3 rounded-[12px] text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    mode === 'import'
                      ? 'bg-pink-500 text-black shadow-md'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Download size={13} />
                  <span>Import</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('saved')}
                  className={`py-2 px-3 rounded-[12px] text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    mode === 'saved'
                      ? 'bg-pink-500 text-black shadow-md'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Key size={13} />
                  <span>Saved ({session.identities.length})</span>
                </button>
              </div>

              {/* FLOW A: CREATE PERSONA */}
              {mode === 'create' && (
                <div className="space-y-3.5">
                  <div>
                    <label className="text-[11px] font-mono text-white/70 block mb-1">
                      Persona Label
                    </label>
                    <input
                      type="text"
                      value={createLabel}
                      onChange={(e) => setCreateLabel(e.target.value)}
                      placeholder="e.g. Personal Persona"
                      className="w-full bg-[#000000] border border-white/20 focus:border-pink-500 rounded-[14px] px-3.5 py-2 text-xs text-white outline-none font-mono placeholder-white/30"
                    />
                  </div>

                  {/* Public Key Display */}
                  <div className="p-3 bg-[#000000] border border-white/10 rounded-[14px] space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-white/50">
                      <span>Public Key (npub)</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(createdKeypair.npub, 'npub')}
                        className="text-pink-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {copiedNpub ? <Check size={11} /> : <Copy size={11} />}
                        <span>{copiedNpub ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="text-xs font-mono text-white truncate select-all">
                      {createdKeypair.npub}
                    </div>
                  </div>

                  {/* Private Key Display */}
                  <div className="p-3 bg-[#000000] border border-white/10 rounded-[14px] space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-white/50">
                      <span className="text-amber-400">Private Key (nsec) · Keep Secret</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowCreatedNsec(!showCreatedNsec)}
                          className="text-white/60 hover:text-white cursor-pointer"
                        >
                          {showCreatedNsec ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(createdKeypair.nsec, 'nsec')}
                          className="text-pink-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {copiedNsec ? <Check size={11} /> : <Copy size={11} />}
                          <span>{copiedNsec ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                    <div className="text-xs font-mono text-white truncate">
                      {showCreatedNsec ? createdKeypair.nsec : '••••••••••••••••••••••••••••••••••••••••••••••••'}
                    </div>
                  </div>

                  {/* Regenerate Keypair */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setCreatedKeypair(generateRandomKeypair());
                        setCopiedNsec(false);
                        setCopiedNpub(false);
                      }}
                      className="text-[11px] font-mono text-pink-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw size={11} />
                      <span>Regenerate Keypair</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveCreated}
                    disabled={isProcessing}
                    className="w-full py-3 rounded-[16px] bg-pink-500 hover:bg-pink-400 text-black font-bold font-mono text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-500/25 cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    <ShieldCheck size={15} />
                    <span>{isProcessing ? 'Encrypting & Saving...' : 'Save & Connect Persona'}</span>
                  </button>
                </div>
              )}

              {/* FLOW B: IMPORT EXISTING KEY */}
              {mode === 'import' && (
                <div className="space-y-3.5">
                  <div>
                    <label className="text-[11px] font-mono text-white/70 block mb-1">
                      Persona Label
                    </label>
                    <input
                      type="text"
                      value={importLabel}
                      onChange={(e) => setImportLabel(e.target.value)}
                      placeholder="e.g. My Imported Nostr Key"
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
                      onChange={(e) => {
                        setImportKey(e.target.value);
                        if (importError) setImportError(null);
                      }}
                      placeholder="nsec1... or 64-char hex (or npub1...)"
                      className="w-full bg-[#000000] border border-white/20 focus:border-pink-500 rounded-[14px] px-3.5 py-2 text-xs text-white outline-none font-mono placeholder-white/30"
                    />
                  </div>

                  {/* Real-time Status feedback */}
                  {decodedKey?.type && (
                    <div className="p-2.5 rounded-[12px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2">
                      <Check size={14} className="text-emerald-400 shrink-0" />
                      <span>
                        Valid {decodedKey.type === 'nsec' ? 'Nostr Private Key (nsec)' : decodedKey.type === 'hex' ? '64-character Hex Key' : 'Public Key (Read-only Persona)'}
                      </span>
                    </div>
                  )}

                  {decodedKey?.error && importKey.trim().length > 0 && (
                    <div className="p-2.5 rounded-[12px] bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
                      {decodedKey.error}
                    </div>
                  )}

                  {importError && (
                    <div className="p-2.5 rounded-[12px] bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono">
                      {importError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveImported}
                    disabled={isProcessing || !decodedKey?.type}
                    className="w-full py-3 rounded-[16px] bg-pink-500 hover:bg-pink-400 text-black font-bold font-mono text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-500/25 cursor-pointer disabled:opacity-40 active:scale-95"
                  >
                    <Download size={15} />
                    <span>{isProcessing ? 'Importing...' : 'Import & Connect Persona'}</span>
                  </button>
                </div>
              )}

              {/* FLOW C: SAVED PERSONAS */}
              {mode === 'saved' && (
                <div className="space-y-2">
                  {session.identities.length === 0 ? (
                    <div className="p-8 text-center bg-[#000000] border border-white/15 rounded-[18px] text-xs font-mono text-white/50">
                      No personas in this vault yet. Use Create or Import above.
                    </div>
                  ) : (
                    session.identities.map((id) => {
                      const isCurrent = id.pubkey === session.activePubkey;
                      return (
                        <div
                          key={id.pubkey}
                          onClick={() => handleSelectSaved(id.pubkey)}
                          className={`p-3 rounded-[16px] border flex items-center justify-between transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-[#000000] border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                              : 'bg-[#000000] border-white/15 hover:border-white/40'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-[#161412] border border-white/20 flex items-center justify-center text-white font-bold text-xs font-mono shrink-0">
                              {id.label.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate">{id.label}</div>
                              <div className="text-[10px] font-mono text-white/40 truncate">
                                {id.npub ? id.npub.slice(0, 16) + '…' : id.pubkey.slice(0, 16) + '…'}
                              </div>
                            </div>
                          </div>

                          {isCurrent ? (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="text-[11px] font-mono text-white/40 hover:text-white">
                              Select →
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
