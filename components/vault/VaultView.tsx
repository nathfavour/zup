'use client';

import React, { useState, useEffect } from 'react';
import {
  getSessionState,
  subscribeSession,
  unlockVault,
  lockVault,
  setActiveIdentity,
  SessionState,
  refreshCachedIdentities,
  testKeyWrappingRoundtrip,
  encryptIdentityNsec
} from '@/lib/state/session';
import { db } from '@/lib/db';
import { EncryptedIdentity } from '@/lib/core/types';
import { generateNostrKeyPair } from '@/lib/core/crypto';
import { authenticatePasskey, registerPasskey } from '@/lib/core/crypto/passkey';
import { formatHex } from '@/lib/core/nostr';
import { ActionTile } from '../ui/ActionTile';
import {
  Lock,
  Unlock,
  Key,
  ShieldCheck,
  Fingerprint,
  UserCheck,
  Plus,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

export function VaultView() {
  const [session, setSession] = useState<SessionState>(getSessionState());
  const [passwordInput, setPasswordInput] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isPasskeyAuthenticating, setIsPasskeyAuthenticating] = useState(false);
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false);
  const [roundtripStatus, setRoundtripStatus] = useState<string | null>(null);

  // New Identity Generator Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [generatedKey, setGeneratedKey] = useState<{ privkeyHex: string; pubkeyHex: string; npub: string; nsec: string } | null>(null);

  useEffect(() => {
    const unsub = subscribeSession(setSession);
    refreshCachedIdentities();
    return unsub;
  }, []);

  const hasPasskeySlot = session.keychainSlots.some((s) => s.type === 'passkey');

  const handleUnlockPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;
    setUnlockError(null);
    setIsUnlocking(true);
    try {
      const res = await unlockVault(passwordInput.trim());
      if (!res.success) {
        setUnlockError(res.error || 'Password derivation failed');
      } else {
        setPasswordInput('');
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  const handlePasskeyAuth = async () => {
    setPasskeyError(null);
    setIsPasskeyAuthenticating(true);
    try {
      const res = await authenticatePasskey();
      if (!res.success) {
        setPasskeyError(res.error || 'Passkey authentication failed');
      }
    } finally {
      setIsPasskeyAuthenticating(false);
    }
  };

  const handleRegisterPasskey = async () => {
    if (!session.isUnlocked) {
      alert('Unlock the Master Encryption Key (MEK) before registering a passkey.');
      return;
    }
    setPasskeyError(null);
    setIsRegisteringPasskey(true);
    try {
      const res = await registerPasskey('Operator Passkey');
      if (!res.success) {
        setPasskeyError(res.error || 'Passkey registration failed');
      } else {
        await refreshCachedIdentities();
      }
    } finally {
      setIsRegisteringPasskey(false);
    }
  };

  const handleCreateNewIdentity = async () => {
    if (!session.isUnlocked) {
      alert('Unlock the Master Encryption Key (MEK) before creating identities.');
      return;
    }
    const key = generatedKey || generateNostrKeyPair();
    const label = newLabel.trim() || `Persona #${session.identities.length + 1}`;

    const wrappedNsec = await encryptIdentityNsec(key.privkeyHex);

    const newIdentity: EncryptedIdentity = {
      pubkey: key.pubkeyHex,
      npub: key.npub,
      wrappedNsec,
      isExternalSigner: false,
      label,
      relays: ['wss://nos.lol', 'wss://relay.damus.io', 'wss://relay.primal.net'],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await db.identities.add(newIdentity);
    await setActiveIdentity(newIdentity.pubkey);
    await refreshCachedIdentities();
    setShowAddForm(false);
    setNewLabel('');
    setGeneratedKey(null);
  };

  const handleRunRoundtripTest = async () => {
    const testSecret = 'nsec1' + Math.random().toString(36).substring(2, 15);
    const valid = await testKeyWrappingRoundtrip(testSecret);
    setRoundtripStatus(valid ? 'Roundtrip Invariant Passed: AES-GCM-256 Verified' : 'Roundtrip Failed');
    setTimeout(() => setRoundtripStatus(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 bg-[#000000] border border-white/20 rounded-[22px] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={14} /> Zero-Knowledge Root
            </span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Singular Cryptographic Vault & Identity Ring
          </h2>
          <p className="text-xs text-white opacity-80 max-w-xl">
            Unwrap the Master Encryption Key (MEK) using your Master Password or WebAuthn Passkey directly.
          </p>
        </div>

        {/* Lock / Unlock Toggle Button */}
        <div className="shrink-0 flex items-center gap-2">
          {session.isUnlocked ? (
            <button
              onClick={() => lockVault()}
              className="flex items-center gap-2 px-4 py-2 rounded-[14px] bg-[#161412] hover:bg-red-950/40 border border-red-500/40 hover:border-red-500 text-white font-mono text-xs font-bold transition-all"
            >
              <Lock size={14} className="text-red-400" />
              <span>Lock Vault (Zero RAM)</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-[12px] bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold">
              <Lock size={13} />
              <span>Vault Locked</span>
            </div>
          )}
        </div>
      </div>

      {/* Vault Unlock Section if locked - Simultaneous Passkey & Master Password */}
      {!session.isUnlocked && (
        <div className="p-6 bg-[#000000] border-2 border-emerald-500/40 rounded-[22px] shadow-[0_0_24px_rgba(16,185,129,0.15)] space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Key size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Unseal Vault Key</h3>
              <p className="text-xs text-white opacity-70">
                Authenticate with Passkey or Master Password simultaneously on the same screen
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Option A: Passkey Authentication */}
            <div className="p-4 bg-[#161412] border border-white/15 rounded-[18px] space-y-3 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 font-mono">
                  <Fingerprint size={16} />
                  <span>WebAuthn Passkey</span>
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed">
                  Fast hardware authentication using TouchID, FaceID, or security keys.
                </p>
              </div>

              {passkeyError && (
                <p className="text-[11px] font-mono text-red-400 flex items-center gap-1">
                  <AlertTriangle size={12} /> {passkeyError}
                </p>
              )}

              <button
                type="button"
                onClick={handlePasskeyAuth}
                disabled={isPasskeyAuthenticating}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold font-mono text-xs rounded-[14px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              >
                {isPasskeyAuthenticating ? <RefreshCw size={14} className="animate-spin" /> : <Fingerprint size={14} />}
                <span>{hasPasskeySlot ? 'Unlock with Passkey' : 'Use Registered Passkey'}</span>
              </button>
            </div>

            {/* Option B: Master Password Input */}
            <div className="p-4 bg-[#161412] border border-white/15 rounded-[18px] space-y-3 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 font-mono">
                  <Key size={16} />
                  <span>Master Password</span>
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed">
                  Unwrap MEK via Argon2id PBKDF2 parameters.
                </p>
              </div>

              <form onSubmit={handleUnlockPassword} className="space-y-2">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter Master Password..."
                  className="w-full bg-[#000000] border border-white/20 focus:border-emerald-400 rounded-[12px] px-3.5 py-2 text-xs text-white outline-none font-mono"
                />

                {unlockError && (
                  <p className="text-[11px] font-mono text-red-400 flex items-center gap-1">
                    <AlertTriangle size={12} /> {unlockError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isUnlocking || !passwordInput.trim()}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold font-mono text-xs rounded-[14px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  {isUnlocking ? <RefreshCw size={14} className="animate-spin" /> : <Unlock size={14} />}
                  <span>Unwrap MEK</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Unlocked Vault Controls: Register Passkey Button */}
      {session.isUnlocked && (
        <div className="p-4 bg-[#000000] border border-white/15 rounded-[20px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Fingerprint size={18} className="text-emerald-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-white">Hardware Passkey Security</div>
              <div className="text-[11px] font-mono text-white/50">
                Register biometric or FIDO2 hardware passkeys to unseal this vault.
              </div>
            </div>
          </div>

          <button
            onClick={handleRegisterPasskey}
            disabled={isRegisteringPasskey}
            className="px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold rounded-[14px] transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
          >
            {isRegisteringPasskey ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
            <span>Register Passkey</span>
          </button>
        </div>
      )}

      {/* Active Persona & Identities List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight uppercase">
              Configured Identity Personas ({session.identities.length})
            </h3>
            <p className="text-xs text-white opacity-60">
              Click any identity tile to switch the active signing pointer.
            </p>
          </div>

          {session.isUnlocked && (
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                if (!showAddForm) setGeneratedKey(generateNostrKeyPair());
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#000000] border border-white/20 hover:border-emerald-400 rounded-[14px] text-xs font-bold text-white font-mono transition-all"
            >
              <Plus size={13} className="text-emerald-400" />
              <span>Add Identity</span>
            </button>
          )}
        </div>

        {/* New Identity Form */}
        {showAddForm && (
          <div className="p-5 bg-[#000000] border-2 border-emerald-400/50 rounded-[22px] space-y-4">
            <h4 className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wider">
              Generate or Import Nostr Persona
            </h4>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-white/70 block mb-1">Persona Label</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Personal Persona"
                  className="w-full bg-[#161412] border border-white/20 focus:border-emerald-400 rounded-[14px] px-3.5 py-2 text-xs text-white outline-none font-mono"
                />
              </div>

              {generatedKey && (
                <div className="p-3 bg-[#161412] border border-white/10 rounded-[14px] text-[11px] font-mono space-y-1">
                  <div className="text-white/60">Generated 32-Byte Nostr Keypair:</div>
                  <div className="truncate"><span className="text-emerald-400">npub:</span> {generatedKey.npub}</div>
                  <div className="truncate"><span className="text-amber-400">nsec:</span> {generatedKey.nsec}</div>
                  <div className="text-white/40 text-[10px]">Will be encrypted via MEK (AES-GCM-256) before Dexie persistence.</div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-[12px] bg-white/5 hover:bg-white/10 text-xs font-mono text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewIdentity}
                  className="px-4 py-1.5 rounded-[12px] bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-mono font-bold transition-colors"
                >
                  Encrypt & Save Persona
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Tiles Grid */}
        {session.identities.length === 0 ? (
          <div className="p-8 text-center bg-[#000000] border border-white/15 rounded-[22px] text-xs font-mono text-white/50">
            No identities stored in this vault yet. Click &quot;Add Identity&quot; or use Connect.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {session.identities.map((identity) => {
              const isActive = identity.pubkey === session.activePubkey;
              return (
                <ActionTile
                  key={identity.pubkey}
                  icon={<UserCheck size={18} />}
                  title={identity.label}
                  description={`npub: ${formatHex(identity.npub, 12, 6)}`}
                  badge={isActive ? 'ACTIVE SIGNER' : 'PERSONA'}
                  actionLabel={isActive ? 'Active Pointer' : 'Switch Persona'}
                  accentColor="#10B981"
                  active={isActive}
                  onClick={async () => {
                    await setActiveIdentity(identity.pubkey);
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Keychain Slots Table */}
      <div className="p-5 bg-[#000000] border border-white/20 rounded-[22px] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key size={15} className="text-emerald-400" />
            <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
              Persistent Keychain Slots (Dexie `keychain` table)
            </h3>
          </div>

          {session.isUnlocked && (
            <button
              onClick={handleRunRoundtripTest}
              className="text-[11px] font-mono text-emerald-400 hover:underline flex items-center gap-1"
            >
              <RefreshCw size={11} /> Test Roundtrip Encryption
            </button>
          )}
        </div>

        {roundtripStatus && (
          <div className="p-2.5 rounded-[12px] bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-300">
            {roundtripStatus}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-white/10 text-white/50 text-[11px]">
                <th className="pb-2">Slot ID</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">KDF Algorithm</th>
                <th className="pb-2">Wrapped MEK Ciphertext</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white">
              {session.keychainSlots.map((slot) => (
                <tr key={slot.id} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 font-bold">{slot.id}</td>
                  <td className="py-2.5">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                      {slot.type}
                    </span>
                  </td>
                  <td className="py-2.5 text-white/80">{slot.params.algo}</td>
                  <td className="py-2.5 text-white/50 truncate max-w-[200px]">{slot.wrappedMek}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
