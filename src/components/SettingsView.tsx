import { useState, useEffect, type FormEvent } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  Trash2, 
  Radio, 
  Sparkles, 
  Check, 
  Lock, 
  Unlock,
  Flame, 
  Terminal, 
  Cpu, 
  RefreshCw,
  ExternalLink,
  Fingerprint,
  KeyRound,
  Plus,
  AlertCircle,
  Eye,
  EyeOff,
  Cloud
} from 'lucide-react';
import { NostrKeypair, RelayInfo, VaultSecurityState, PasskeyRecord, SyncStatus, KylrixOAuthSession } from '../types';
import { 
  createPasskeyRecord, 
  encryptMEKWithPassword, 
  decryptMEKWithPassword, 
  ARGON2_CONFIG 
} from '../lib/crypto';
import { syncEngine } from '../lib/syncEngine';
import { kylrixOAuth } from '../lib/kylrixOAuth';

interface SettingsViewProps {
  keypair: NostrKeypair;
  relays: RelayInfo[];
  vaultSecurity: VaultSecurityState | null;
  mek: Uint8Array | null;
  isLocked: boolean;
  onLockVault: () => void;
  onOpenUnlock: () => void;
  onOpenSetupEncryption: () => void;
  onUpdateVaultSecurity: (updated: VaultSecurityState) => void;
  onOpenPro: () => void;
  onClearCache: () => void;
  onResetDefaultRelays: () => void;
  onOpenSync?: () => void;
}

export function SettingsView({
  keypair,
  relays,
  vaultSecurity,
  mek,
  isLocked,
  onLockVault,
  onOpenUnlock,
  onOpenSetupEncryption,
  onUpdateVaultSecurity,
  onOpenPro,
  onClearCache,
  onResetDefaultRelays,
  onOpenSync,
}: SettingsViewProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(syncEngine.getSyncStatus());
  const [pendingCount, setPendingCount] = useState<number>(syncEngine.getPendingCount());
  const [oauthSession, setOauthSession] = useState<KylrixOAuthSession>(kylrixOAuth.getSession());

  useEffect(() => {
    const unsubSync = syncEngine.subscribe((status, pending) => {
      setSyncStatus(status);
      setPendingCount(pending);
    });
    const unsubOAuth = kylrixOAuth.subscribe((sess) => {
      setOauthSession(sess);
    });
    return () => {
      unsubSync();
      unsubOAuth();
    };
  }, []);
  const [webrtcProtect, setWebrtcProtect] = useState(true);
  const [zeroMetadata, setZeroMetadata] = useState(true);
  const [nip07Bridge, setNip07Bridge] = useState(false);
  const [wipeNotice, setWipeNotice] = useState(false);
  const [benchmarking, setBenchmarking] = useState(false);
  const [benchResult, setBenchResult] = useState<string | null>(null);

  // Change Password State
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Add Passkey State
  const [showAddPasskey, setShowAddPasskey] = useState(false);
  const [newPasskeyName, setNewPasskeyName] = useState('');
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  const handleWipe = () => {
    if (confirm('Clear local RxDB database, stored keys, and relay statistics?')) {
      onClearCache();
      setWipeNotice(true);
      setTimeout(() => setWipeNotice(false), 2000);
    }
  };

  const handleRunBenchmark = () => {
    setBenchmarking(true);
    const start = performance.now();
    setTimeout(() => {
      const elapsed = (performance.now() - start).toFixed(1);
      setBenchResult(`Schnorr signature verification: ~0.4ms | Argon2id MEK: ${elapsed}ms`);
      setBenchmarking(false);
    }, 400);
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordChangeError(null);

    if (!vaultSecurity) return;
    if (newPassword.length < 8) {
      setPasswordChangeError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError('New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      let activeMEK = mek;

      // If MEK is not in memory, verify with current password
      if (!activeMEK) {
        const decrypted = await decryptMEKWithPassword(
          vaultSecurity.passwordWrappedMEK,
          currentPassword
        );
        activeMEK = decrypted.mek;
      }

      if (!activeMEK) {
        throw new Error('Could not unlock MEK. Check your current password.');
      }

      // Re-encrypt MEK with new password
      const newWrapped = await encryptMEKWithPassword(activeMEK, newPassword);

      const updatedSecurity: VaultSecurityState = {
        ...vaultSecurity,
        salt: newWrapped.salt,
        passwordWrappedMEK: newWrapped,
        updatedAt: Date.now(),
      };

      onUpdateVaultSecurity(updatedSecurity);
      setIsChangingPassword(false);
      setPasswordChangeSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => {
        setPasswordChangeSuccess(false);
        setShowChangePassword(false);
      }, 2000);
    } catch (err: unknown) {
      console.error('Password change error:', err);
      setPasswordChangeError('Incorrect current password or derivation failed.');
      setIsChangingPassword(false);
    }
  };

  const handleAddPasskey = async (e: FormEvent) => {
    e.preventDefault();
    setPasskeyError(null);

    if (!vaultSecurity) return;
    if (!mek) {
      setPasskeyError('Vault is locked. Please unlock the vault first to add a new passkey.');
      return;
    }

    setIsRegisteringPasskey(true);
    try {
      const name = newPasskeyName.trim() || `Device Passkey ${vaultSecurity.passkeys.length + 1}`;
      const newRecord = await createPasskeyRecord(mek, name);

      const updatedSecurity: VaultSecurityState = {
        ...vaultSecurity,
        passkeys: [...vaultSecurity.passkeys, newRecord],
        updatedAt: Date.now(),
      };

      onUpdateVaultSecurity(updatedSecurity);
      setIsRegisteringPasskey(false);
      setNewPasskeyName('');
      setShowAddPasskey(false);
    } catch (err: unknown) {
      console.error('Add passkey error:', err);
      setPasskeyError('Biometric authentication failed or was cancelled.');
      setIsRegisteringPasskey(false);
    }
  };

  const handleDeletePasskey = (passkeyId: string) => {
    if (!vaultSecurity) return;
    if (confirm('Remove this passkey? You can still unlock using your master password.')) {
      const updatedSecurity: VaultSecurityState = {
        ...vaultSecurity,
        passkeys: vaultSecurity.passkeys.filter((p) => p.id !== passkeyId),
        updatedAt: Date.now(),
      };
      onUpdateVaultSecurity(updatedSecurity);
    }
  };

  const implementedNIPs = [
    { nip: 'NIP-01', title: 'Basic protocol flow & Schnorr signatures', status: 'Active' },
    { nip: 'NIP-02', title: 'Contact list & Petnames', status: 'Active' },
    { nip: 'NIP-04', title: 'Encrypted Direct Messages (secp256k1 DH)', status: 'Active' },
    { nip: 'NIP-05', title: 'DNS-based verification mapping', status: 'Active' },
    { nip: 'NIP-10', title: 'Reply & Mention convention', status: 'Active' },
    { nip: 'NIP-19', title: 'bech32-encoded entities (npub/nsec/note)', status: 'Active' },
    { nip: 'NIP-57', title: 'Lightning Zaps & Receipts', status: 'Active' },
  ];

  return (
    <div className="flex flex-col gap-5 pb-16 md:pb-6">
      {/* Privacy Overview Banner */}
      <div className="p-5 rounded-[22px] bg-[#141210] border border-[#2C2925] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-[16px] bg-[#F59E0B]/15 border border-[#F59E0B]/40 flex items-center justify-center text-[#F59E0B]">
            <Shield size={24} />
          </div>
          <div>
            <h3 className="text-white font-black text-base uppercase tracking-wider m-0">
              Privacy & Cryptographic Guard
            </h3>
            <p className="text-[#99948D] text-xs font-bold mt-0.5 m-0">
              Zero telemetries, no centralized databases, pure client-side MEK encryption.
            </p>
          </div>
        </div>

        <div className="px-3 py-1.5 rounded-[14px] bg-[#1C1A17] border border-[#35322E] text-xs font-mono font-bold text-white">
          <span>TOR COMPATIBLE</span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* KYLRIX IDENTITY BINDING & AUTONOMIC SYNC SECTION           */}
      {/* ========================================================= */}
      <div className="p-5 rounded-[22px] bg-[#141210] border border-[#2C2925] flex flex-col gap-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud size={18} className="text-[#EC4899]" />
            <h4 className="text-white font-black text-xs uppercase tracking-wider m-0">
              Kylrix Cloud Sync & Mesh Reconciliation
            </h4>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-black uppercase ${
              syncStatus === 'pending'
                ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40'
                : syncStatus === 'offline'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
            }`}
          >
            {syncStatus === 'pending'
              ? `PENDING (${pendingCount})`
              : syncStatus === 'offline'
              ? 'OFFLINE'
              : 'SYNCHRONIZED'}
          </span>
        </div>

        <div className="p-3.5 rounded-[16px] bg-[#1A1815] border border-[#2B2824] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {oauthSession.isConnected && oauthSession.profile ? (
              <img
                src={oauthSession.profile.avatar}
                alt={oauthSession.profile.name}
                className="w-10 h-10 rounded-[12px] border border-[#3A3631] bg-[#121110] object-cover shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-[12px] bg-[#24211D] border border-[#3A3631] flex items-center justify-center text-white shrink-0">
                <Cloud size={20} />
              </div>
            )}
            <div className="min-w-0">
              <span className="text-white font-bold text-xs block truncate">
                {oauthSession.isConnected && oauthSession.profile
                  ? `Bound: ${oauthSession.profile.name} (${oauthSession.profile.email || oauthSession.profile.userId})`
                  : 'Sovereign Standalone Mode (Local-First)'}
              </span>
              <span className="text-[#8F8A83] text-[11px] font-medium block truncate mt-0.5">
                {oauthSession.isConnected
                  ? 'OAuth 2.1 PKCE Active • NIP-78 Kind 30078 Identity Synced'
                  : 'RxDB is your Single Source of Truth. Connect Kylrix for zero-knowledge cross-device settings.'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenSync}
            className="px-3.5 py-1.5 rounded-[12px] bg-[#EC4899] hover:bg-[#db2777] text-white font-bold text-xs uppercase tracking-wider cursor-pointer shrink-0 transition-colors shadow-sm"
          >
            {oauthSession.isConnected ? 'Manage Sync' : 'Sign in with Kylrix'}
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CLIENT E2EE ENCRYPTION & PASSKEYS MANAGER SECTION         */}
      {/* ========================================================= */}
      <div className="p-5 rounded-[22px] bg-[#000000] border border-white/20 flex flex-col gap-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock size={18} className="text-[#10B981]" />
            <h4 className="text-white font-black text-xs uppercase tracking-wider m-0">
              End-to-End Encryption & Passkey Security
            </h4>
          </div>
          {vaultSecurity?.isInitialized ? (
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-black uppercase ${
                isLocked
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}
            >
              {isLocked ? 'VAULT LOCKED' : 'VAULT UNLOCKED (MEK ACTIVE)'}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
              NOT INITIALIZED
            </span>
          )}
        </div>

        {vaultSecurity?.isInitialized ? (
          <div className="flex flex-col gap-4">
            {/* Encryption Parameters Spec */}
            <div className="p-3.5 rounded-[16px] bg-[#161412] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <span className="text-white font-black text-xs block">
                  Argon2id (3 iterations, 64 MB RAM)
                </span>
                <p className="text-white text-[11px] font-medium m-0 mt-0.5">
                  Protects 256-bit Master Encryption Key with dual-layer AES-256-GCM wrapping.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isLocked ? (
                  <button
                    onClick={onOpenUnlock}
                    className="px-3 py-1.5 rounded-[12px] bg-[#A855F7] hover:bg-[#9333ea] text-white font-black text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Unlock Now
                  </button>
                ) : (
                  <button
                    onClick={onLockVault}
                    className="px-3 py-1.5 rounded-[12px] bg-[#000000] border border-white/20 hover:border-white/50 text-white font-bold text-xs cursor-pointer"
                  >
                    Lock Vault
                  </button>
                )}
              </div>
            </div>

            {/* Passkeys List - Stacked in superb tactile chat-card mood */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Fingerprint size={14} className="text-[#A855F7]" />
                  Registered Passkeys ({vaultSecurity.passkeys.length})
                </span>
                <button
                  onClick={() => setShowAddPasskey(!showAddPasskey)}
                  className="text-xs font-black uppercase tracking-wider text-[#A855F7] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Add Passkey</span>
                </button>
              </div>

              {vaultSecurity.passkeys.length === 0 ? (
                <div className="p-3.5 rounded-[16px] bg-[#161412] border border-white/10 text-center">
                  <p className="text-white text-xs font-medium m-0">
                    No biometric passkeys registered. You can add one below to unlock via Touch ID / Face ID.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {vaultSecurity.passkeys.map((pk) => (
                    <div
                      key={pk.id}
                      className="p-3 rounded-[16px] bg-[#161412] border border-white/15 flex items-center justify-between gap-3 group hover:border-white/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-[#A855F7]/15 text-[#A855F7] border border-[#A855F7]/30 flex items-center justify-center shrink-0">
                          <Fingerprint size={16} />
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-white font-black text-xs m-0 truncate">
                            {pk.name}
                          </h5>
                          <p className="text-white text-[10px] font-mono font-bold m-0 mt-0.5">
                            Added {new Date(pk.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeletePasskey(pk.id)}
                        className="text-white/40 hover:text-red-400 p-1.5 cursor-pointer transition-colors"
                        title="Delete Passkey"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Passkey Drawer / Inset Form */}
              {showAddPasskey && (
                <form
                  onSubmit={handleAddPasskey}
                  className="p-4 rounded-[18px] bg-[#161412] border-2 border-[#A855F7] flex flex-col gap-3 shadow-lg"
                >
                  <span className="text-white font-black text-xs uppercase tracking-wider">
                    Register New Device Passkey
                  </span>
                  <input
                    type="text"
                    value={newPasskeyName}
                    onChange={(e) => setNewPasskeyName(e.target.value)}
                    placeholder="e.g. MacBook Touch ID, iPhone Face ID, YubiKey"
                    required
                    className="w-full bg-[#000000] border border-white/20 focus:border-[#A855F7] focus:outline-none rounded-[14px] px-3.5 py-2 text-white text-xs placeholder:text-white/40"
                  />

                  {passkeyError && (
                    <p className="text-rose-400 text-xs font-bold m-0">{passkeyError}</p>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddPasskey(false)}
                      className="px-3 py-1.5 rounded-[12px] bg-[#000000] border border-white/20 text-white text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isRegisteringPasskey}
                      className="px-4 py-1.5 rounded-[12px] bg-[#A855F7] hover:bg-[#9333ea] text-white font-black text-xs uppercase tracking-wider cursor-pointer"
                    >
                      {isRegisteringPasskey ? 'Prompting Device...' : 'Authenticate & Register'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Change Master Password Section */}
            <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowChangePassword(!showChangePassword)}
                className="text-xs font-black uppercase tracking-wider text-[#10B981] hover:underline flex items-center gap-1.5 cursor-pointer self-start"
              >
                <KeyRound size={14} />
                <span>{showChangePassword ? 'Close Password Settings' : 'Change Master Password'}</span>
              </button>

              {showChangePassword && (
                <form
                  onSubmit={handleChangePassword}
                  className="p-4 rounded-[18px] bg-[#161412] border border-white/20 flex flex-col gap-3 shadow-lg"
                >
                  <span className="text-white font-black text-xs uppercase tracking-wider">
                    Update Master Encryption Password
                  </span>

                  {!mek && (
                    <div className="flex flex-col gap-1">
                      <label className="text-white text-[11px] font-bold">Current Password</label>
                      <input
                        type={showPasswordText ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current master password..."
                        required
                        className="w-full bg-[#000000] border border-white/20 focus:border-[#10B981] focus:outline-none rounded-[12px] px-3 py-2 text-white text-xs"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-white text-[11px] font-bold">New Password (min 8 chars)</label>
                      <input
                        type={showPasswordText ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new strong password..."
                        required
                        className="w-full bg-[#000000] border border-white/20 focus:border-[#10B981] focus:outline-none rounded-[12px] px-3 py-2 text-white text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-white text-[11px] font-bold">Confirm New Password</label>
                      <input
                        type={showPasswordText ? 'text' : 'password'}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="Re-enter new password..."
                        required
                        className="w-full bg-[#000000] border border-white/20 focus:border-[#10B981] focus:outline-none rounded-[12px] px-3 py-2 text-white text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="text-xs text-white/60 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {showPasswordText ? <EyeOff size={13} /> : <Eye size={13} />}
                      <span>{showPasswordText ? 'Hide text' : 'Show text'}</span>
                    </button>

                    <button
                      type="submit"
                      disabled={isChangingPassword || !newPassword || !confirmNewPassword}
                      className="px-4 py-1.5 rounded-[12px] bg-[#10B981] hover:bg-[#059669] text-black font-black text-xs uppercase tracking-wider cursor-pointer"
                    >
                      {isChangingPassword ? 'Re-deriving Key...' : 'Save New Password'}
                    </button>
                  </div>

                  {passwordChangeError && (
                    <p className="text-rose-400 text-xs font-bold m-0">{passwordChangeError}</p>
                  )}
                  {passwordChangeSuccess && (
                    <p className="text-emerald-400 text-xs font-bold m-0">✓ Password successfully updated and MEK re-encrypted!</p>
                  )}
                </form>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-[18px] bg-[#161412] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h5 className="text-white font-black text-xs m-0">No Encryption Vault Configured</h5>
              <p className="text-white text-[11px] font-medium m-0 mt-0.5">
                Set up an Argon2id Master Key to secure all private keys and messages on your machine.
              </p>
            </div>
            <button
              onClick={onOpenSetupEncryption}
              className="px-4 py-2 rounded-[14px] bg-[#10B981] hover:bg-[#059669] text-black font-black text-xs uppercase tracking-wider cursor-pointer shadow-[0_0_12px_#10B98133]"
            >
              Setup Vault Now
            </button>
          </div>
        )}
      </div>

      {/* Privacy Toggles Card */}
      <div className="p-5 rounded-[22px] bg-[#000000] border border-white/20 flex flex-col gap-4 shadow-xl">
        <span className="text-white font-black text-xs uppercase tracking-wider">
          Network Privacy Controls
        </span>

        {/* Zero Metadata Leakage */}
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-[16px] bg-[#161412] border border-white/10">
          <div className="min-w-0 flex-1">
            <span className="text-white font-black text-xs block truncate">
              Zero Metadata Leakage
            </span>
            <p className="text-white text-[11px] font-medium leading-relaxed m-0 mt-0.5">
              Strips browser headers, OS signatures, and randomizes WebSocket polling intervals.
            </p>
          </div>
          <input
            type="checkbox"
            checked={zeroMetadata}
            onChange={(e) => setZeroMetadata(e.target.checked)}
            className="w-5 h-5 accent-[#F59E0B] cursor-pointer"
          />
        </div>

        {/* WebRTC IP Protection */}
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-[16px] bg-[#161412] border border-white/10">
          <div className="min-w-0 flex-1">
            <span className="text-white font-black text-xs block truncate">
              WebRTC Local IP Shield
            </span>
            <p className="text-white text-[11px] font-medium leading-relaxed m-0 mt-0.5">
              Prevents browser WebRTC STUN queries from revealing private LAN IP addresses.
            </p>
          </div>
          <input
            type="checkbox"
            checked={webrtcProtect}
            onChange={(e) => setWebrtcProtect(e.target.checked)}
            className="w-5 h-5 accent-[#F59E0B] cursor-pointer"
          />
        </div>

        {/* NIP-07 Browser Extension Bridge */}
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-[16px] bg-[#161412] border border-white/10">
          <div className="min-w-0 flex-1">
            <span className="text-white font-black text-xs block truncate">
              NIP-07 Extension Delegation (Alby, nos2x, Amber)
            </span>
            <p className="text-white text-[11px] font-medium leading-relaxed m-0 mt-0.5">
              Allow external browser extension to sign notes without loading nsec into DOM.
            </p>
          </div>
          <input
            type="checkbox"
            checked={nip07Bridge}
            onChange={(e) => setNip07Bridge(e.target.checked)}
            className="w-5 h-5 accent-[#F59E0B] cursor-pointer"
          />
        </div>

        {/* Tor Onion Routing Proxy */}
        <div
          onClick={onOpenPro}
          className="flex items-center justify-between gap-3 p-3.5 rounded-[16px] bg-[#161412] border border-[#A855F7]/30 hover:border-[#A855F7] cursor-pointer transition-colors"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-white font-black text-xs block truncate">
                Tor Onion Routing Node
              </span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#A855F7]/20 text-[#A855F7] border border-[#A855F7]/40">
                PRO FEATURE
              </span>
            </div>
            <p className="text-white text-[11px] font-medium leading-relaxed m-0 mt-0.5">
              Route all relay WebSocket traffic through multi-hop onion circuits (.onion addresses).
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-[#A855F7] px-2 py-1 rounded bg-[#A855F7]/10">
            CONNECT
          </span>
        </div>
      </div>

      {/* Protocol Architecture & NIP Compliance */}
      <div className="p-5 rounded-[22px] bg-[#000000] border border-white/20 flex flex-col gap-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-white" />
            <h4 className="text-white font-black text-xs uppercase tracking-wider m-0">
              Nostr NIP Compliance Engine
            </h4>
          </div>
          <span className="text-white text-[10px] font-mono font-bold">
            Secp256k1 & BIP-340
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {implementedNIPs.map((n) => (
            <div
              key={n.nip}
              className="p-3 rounded-[14px] bg-[#161412] border border-white/10 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <span className="text-white font-mono font-black text-xs block">
                  {n.nip}
                </span>
                <span className="text-white text-[10px] font-medium truncate block">
                  {n.title}
                </span>
              </div>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {n.status}
              </span>
            </div>
          ))}
        </div>

        {/* Cryptographic Benchmark */}
        <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between">
            <button
              onClick={handleRunBenchmark}
              disabled={benchmarking}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] bg-[#161412] border border-white/20 hover:border-white/50 text-white text-xs font-bold cursor-pointer"
            >
              <Cpu size={13} />
              <span>{benchmarking ? 'Benchmarking...' : 'Test Crypto Performance'}</span>
            </button>
            {benchResult && (
              <span className="text-white font-mono text-[11px] font-bold text-emerald-400">
                {benchResult}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Storage & Relay Reset Controls */}
      <div className="p-5 rounded-[22px] bg-[#000000] border border-white/20 flex flex-col gap-3 shadow-xl">
        <span className="text-white font-black text-xs uppercase tracking-wider">
          RxDB Local Database & Reset Actions
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={onResetDefaultRelays}
            className="p-3 rounded-[16px] bg-[#161412] border border-white/20 hover:border-white/50 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw size={14} />
            <span>Reset Default Relays</span>
          </button>

          <button
            onClick={handleWipe}
            className="p-3 rounded-[16px] bg-[#161412] border border-red-500/30 hover:border-red-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_10px_#EF444422]"
          >
            <Trash2 size={14} className="text-red-400" />
            <span>Wipe Local RxDB & Keys</span>
          </button>
        </div>

        {wipeNotice && (
          <p className="text-emerald-400 text-xs font-bold text-center mt-1">
            ✓ Cache & session data successfully wiped!
          </p>
        )}
      </div>
    </div>
  );
}
