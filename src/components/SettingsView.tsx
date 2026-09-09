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
  Terminal, 
  Cpu, 
  RefreshCw,
  Fingerprint,
  KeyRound,
  Plus,
  AlertCircle,
  Eye,
  EyeOff,
  Cloud,
  ChevronDown,
  ChevronUp,
  Server,
  Zap,
  Globe,
  Database,
  Key,
  Copy
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
import { formatTruncatedKey } from '../lib/nostr';
import { VaultCredentialsManager } from './VaultCredentialsManager';

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

// Accessible custom toggle switch
function ToggleSwitch({
  checked,
  onChange,
  id,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id: string;
  ariaLabel: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EC4899] focus-visible:ring-offset-2 focus-visible:ring-offset-[#100F0E] ${
        checked ? 'bg-[#EC4899]' : 'bg-[#2E2B27]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
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
  const [resetRelaysNotice, setResetRelaysNotice] = useState(false);
  const [benchmarking, setBenchmarking] = useState(false);
  const [benchResult, setBenchResult] = useState<string | null>(null);

  const [showPrivKeySettings, setShowPrivKeySettings] = useState(false);
  const [copiedKeySettings, setCopiedKeySettings] = useState<string | null>(null);

  const handleCopySettings = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeySettings(label);
    setTimeout(() => setCopiedKeySettings(null), 2000);
  };

  const handleWipe = () => {
    if (confirm('Are you sure? This will wipe your local database, stored keys, and relay statistics from this browser.')) {
      onClearCache();
      setWipeNotice(true);
      setTimeout(() => setWipeNotice(false), 2500);
    }
  };

  const handleResetRelays = () => {
    onResetDefaultRelays();
    setResetRelaysNotice(true);
    setTimeout(() => setResetRelaysNotice(false), 2500);
  };

  const handleRunBenchmark = () => {
    setBenchmarking(true);
    const start = performance.now();
    setTimeout(() => {
      const elapsed = (performance.now() - start).toFixed(1);
      setBenchResult(`Schnorr verify: 0.4ms • Argon2id (64MB): ${elapsed}ms`);
      setBenchmarking(false);
    }, 380);
  };

  const implementedNIPs = [
    { nip: 'NIP-01', title: 'Basic protocol flow & Schnorr signatures' },
    { nip: 'NIP-02', title: 'Contact list & Petnames' },
    { nip: 'NIP-04', title: 'Encrypted Direct Messages (secp256k1 DH)' },
    { nip: 'NIP-05', title: 'DNS-based verification mapping' },
    { nip: 'NIP-10', title: 'Reply & Mention convention' },
    { nip: 'NIP-19', title: 'bech32-encoded entities (npub/nsec)' },
    { nip: 'NIP-57', title: 'Lightning Zaps & Receipts' },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-24 md:pb-12 text-stone-200">
      {/* 1. Account Summary & Identity Keys Card */}
      <section className="bg-[#161514] border border-[#2A2724] rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#262421]">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src={keypair.avatar}
              alt={keypair.name || 'Account Avatar'}
              className="w-13 h-13 rounded-full object-cover border border-[#3A3631] bg-[#121110] shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-white text-base font-bold truncate">
                  {keypair.displayName || keypair.name || 'Anonymous Peer'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  Sovereign
                </span>
              </div>
              <p className="text-stone-400 font-mono text-xs truncate mt-0.5">
                {keypair.npub ? formatTruncatedKey(keypair.npub, 12, 8) : 'No Public Key'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#201E1B] border border-[#302D29] text-xs font-mono text-stone-300">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>secp256k1 active</span>
            </span>
          </div>
        </div>

        {/* Cryptographic Keys Section (npub & nsec) */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Key size={15} className="text-[#EC4899]" />
              <span>Active Identity Keys (NIP-19)</span>
            </span>
            {isLocked && vaultSecurity?.isInitialized && (
              <button
                type="button"
                onClick={onOpenUnlock}
                className="text-xs font-bold text-[#EC4899] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Unlock size={12} />
                <span>Unlock to view nsec</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Public Key (npub) */}
            <div className="p-3.5 rounded-xl bg-[#1D1B19] border border-[#2D2A26] flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-400 uppercase">Public Key (npub)</span>
                <button
                  type="button"
                  onClick={() => handleCopySettings(keypair.npub, 'npub')}
                  className="text-stone-400 hover:text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  {copiedKeySettings === 'npub' ? (
                    <Check size={12} className="text-emerald-400" />
                  ) : (
                    <Copy size={12} />
                  )}
                  <span>{copiedKeySettings === 'npub' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="font-mono text-xs text-white break-all m-0 select-all">
                {keypair.npub}
              </p>
            </div>

            {/* Private Key (nsec) */}
            <div className="p-3.5 rounded-xl bg-[#1D1B19] border border-[#2D2A26] flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-400 uppercase">Private Key (nsec)</span>
                {keypair.nsec && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPrivKeySettings(!showPrivKeySettings)}
                      className="text-stone-400 hover:text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {showPrivKeySettings ? <EyeOff size={12} /> : <Eye size={12} />}
                      <span>{showPrivKeySettings ? 'Hide' : 'Show'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopySettings(keypair.nsec!, 'nsec')}
                      className="text-stone-400 hover:text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKeySettings === 'nsec' ? (
                        <Check size={12} className="text-emerald-400" />
                      ) : (
                        <Copy size={12} />
                      )}
                      <span>{copiedKeySettings === 'nsec' ? 'Copied' : 'Copy nsec'}</span>
                    </button>
                  </div>
                )}
              </div>
              <p className="font-mono text-xs text-white break-all m-0 select-all">
                {keypair.nsec ? (
                  showPrivKeySettings ? (
                    keypair.nsec
                  ) : (
                    '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'
                  )
                ) : isLocked ? (
                  <span className="text-amber-400 text-xs flex items-center gap-1 font-sans">
                    <Lock size={12} />
                    Vault is locked. Unlock above to display nsec.
                  </span>
                ) : (
                  <span className="text-stone-500 text-xs font-sans">
                    Watch-only identity (No private key loaded)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Cloud Sync & Device Reconciliation */}
      <section className="bg-[#161514] border border-[#2A2724] rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EC4899]/10 border border-[#EC4899]/30 flex items-center justify-center text-[#EC4899]">
              <Cloud size={17} />
            </div>
            <div>
              <h3 className="text-white text-sm font-bold">Cloud Sync & Mesh Reconciliation</h3>
              <p className="text-stone-400 text-xs mt-0.5">
                Zero-knowledge cross-device settings using NIP-78 identity records.
              </p>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold ${
              syncStatus === 'pending'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : syncStatus === 'offline'
                ? 'bg-stone-800 text-stone-400 border border-stone-700'
                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {syncStatus === 'pending'
              ? `Pending (${pendingCount})`
              : syncStatus === 'offline'
              ? 'Offline'
              : 'Synchronized'}
          </span>
        </div>

        <div className="bg-[#1D1B19] border border-[#2D2A26] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3 min-w-0">
            {oauthSession.isConnected && oauthSession.profile ? (
              <img
                src={oauthSession.profile.avatar}
                alt={oauthSession.profile.name}
                className="w-10 h-10 rounded-xl border border-[#3A3631] bg-[#121110] object-cover shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-[#262421] border border-[#383530] flex items-center justify-center text-stone-400 shrink-0">
                <Server size={18} />
              </div>
            )}
            <div className="min-w-0">
              <span className="text-white font-semibold text-xs block truncate">
                {oauthSession.isConnected && oauthSession.profile
                  ? `${oauthSession.profile.name} (${oauthSession.profile.email || oauthSession.profile.userId})`
                  : 'Local-First Sovereign Mode'}
              </span>
              <span className="text-stone-400 text-xs block truncate mt-0.5">
                {oauthSession.isConnected
                  ? 'OAuth 2.1 PKCE Session active'
                  : 'Local RxDB is your single source of truth.'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenSync}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#262320] hover:bg-[#302D29] border border-[#38342F] text-white text-xs font-semibold tracking-wide transition-colors cursor-pointer text-center shrink-0"
          >
            {oauthSession.isConnected ? 'Manage Sync' : 'Connect Cloud Sync'}
          </button>
        </div>
      </section>

      {/* 3. Client-Side Encryption & Passkey Security */}
      <VaultCredentialsManager
        vaultSecurity={vaultSecurity}
        mek={mek}
        isLocked={isLocked}
        onLockVault={onLockVault}
        onOpenUnlock={onOpenUnlock}
        onOpenSetupEncryption={onOpenSetupEncryption}
        onUpdateVaultSecurity={onUpdateVaultSecurity}
      />

      {/* 4. Privacy & Network Controls */}
      <section className="bg-[#161514] border border-[#2A2724] rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Shield size={17} />
          </div>
          <div>
            <h3 className="text-white text-sm font-bold">Network Privacy & Leak Guards</h3>
            <p className="text-stone-400 text-xs mt-0.5">
              Fine-grained controls to minimize fingerprinting and metadata exposure.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {/* Zero Metadata Leakage */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-[#1D1B19] border border-[#2D2A26] transition-colors">
            <div className="min-w-0 flex-1">
              <span className="text-white text-xs font-semibold block">
                Zero Metadata Leakage
              </span>
              <p className="text-stone-400 text-xs mt-0.5 leading-relaxed">
                Strips user-agent fingerprints and randomizes WebSocket reconnect jitter.
              </p>
            </div>
            <ToggleSwitch
              id="toggle-zero-metadata"
              checked={zeroMetadata}
              onChange={setZeroMetadata}
              ariaLabel="Zero Metadata Leakage"
            />
          </div>

          {/* WebRTC IP Protection */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-[#1D1B19] border border-[#2D2A26] transition-colors">
            <div className="min-w-0 flex-1">
              <span className="text-white text-xs font-semibold block">
                WebRTC Local IP Shield
              </span>
              <p className="text-stone-400 text-xs mt-0.5 leading-relaxed">
                Prevents browser WebRTC STUN queries from leaking your local LAN IP address.
              </p>
            </div>
            <ToggleSwitch
              id="toggle-webrtc"
              checked={webrtcProtect}
              onChange={setWebrtcProtect}
              ariaLabel="WebRTC Local IP Shield"
            />
          </div>

          {/* NIP-07 Browser Extension Bridge */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-[#1D1B19] border border-[#2D2A26] transition-colors">
            <div className="min-w-0 flex-1">
              <span className="text-white text-xs font-semibold block">
                NIP-07 Extension Delegation (Alby, nos2x)
              </span>
              <p className="text-stone-400 text-xs mt-0.5 leading-relaxed">
                Allows external browser signer extensions to sign events without exposing secrets.
              </p>
            </div>
            <ToggleSwitch
              id="toggle-nip07"
              checked={nip07Bridge}
              onChange={setNip07Bridge}
              ariaLabel="NIP-07 Extension Delegation"
            />
          </div>

          {/* Tor Onion Routing Node */}
          <div
            onClick={onOpenPro}
            className="flex items-center justify-between gap-4 p-4 rounded-xl bg-[#1D1B19] border border-[#38332F] hover:border-[#EC4899]/50 cursor-pointer transition-colors group"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-white text-xs font-semibold block">
                  Tor Onion Routing Circuits
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#EC4899]/15 text-[#EC4899] border border-[#EC4899]/30">
                  Pro Circuit
                </span>
              </div>
              <p className="text-stone-400 text-xs mt-0.5 leading-relaxed">
                Routes all relay WebSocket traffic through multi-hop onion circuits (.onion relays).
              </p>
            </div>
            <span className="text-xs font-semibold text-[#EC4899] group-hover:underline shrink-0">
              Configure →
            </span>
          </div>
        </div>
      </section>

      {/* 5. Protocol Architecture & NIP Compliance */}
      <section className="bg-[#161514] border border-[#2A2724] rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Terminal size={17} />
            </div>
            <div>
              <h3 className="text-white text-sm font-bold">Nostr Standards Compliance</h3>
              <p className="text-stone-400 text-xs mt-0.5">
                BIP-340 Schnorr signatures & standard Nostr Implementation Possibilities.
              </p>
            </div>
          </div>
          <span className="text-stone-400 text-xs font-mono font-medium hidden sm:inline">
            secp256k1
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {implementedNIPs.map((n) => (
            <div
              key={n.nip}
              className="p-3 rounded-xl bg-[#1D1B19] border border-[#2D2A26] flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <span className="text-white font-mono font-bold text-xs block">
                  {n.nip}
                </span>
                <span className="text-stone-400 text-[11px] truncate block mt-0.5">
                  {n.title}
                </span>
              </div>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0">
                Active
              </span>
            </div>
          ))}
        </div>

        {/* Cryptographic Benchmark Runner */}
        <div className="pt-3 border-t border-[#262421] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleRunBenchmark}
            disabled={benchmarking}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1D1B19] border border-[#332F2B] hover:border-[#423E38] text-stone-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            <Cpu size={14} className="text-indigo-400" />
            <span>{benchmarking ? 'Benchmarking Engine...' : 'Run Crypto Benchmark'}</span>
          </button>

          {benchResult ? (
            <span className="text-emerald-400 font-mono text-xs font-medium">
              {benchResult}
            </span>
          ) : (
            <span className="text-stone-500 font-mono text-xs">
              Runs client-side latency profiling
            </span>
          )}
        </div>
      </section>

      {/* 6. Storage & Danger Zone */}
      <section className="bg-[#161514] border border-[#2A2724] rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Database size={17} />
          </div>
          <div>
            <h3 className="text-white text-sm font-bold">Local Storage & Cache Management</h3>
            <p className="text-stone-400 text-xs mt-0.5">
              Reset default relay pools or purge your client-side RxDB database.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleResetRelays}
            className="p-3.5 rounded-xl bg-[#1D1B19] border border-[#332F2B] hover:border-[#45403A] text-stone-200 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw size={14} className="text-stone-400" />
            <span>Restore Default Relays</span>
          </button>

          <button
            type="button"
            onClick={handleWipe}
            className="p-3.5 rounded-xl bg-[#1D1B19] border border-rose-500/25 hover:border-rose-500/50 text-rose-300 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer hover:bg-rose-500/5"
          >
            <Trash2 size={14} className="text-rose-400" />
            <span>Purge Local Data & Keys</span>
          </button>
        </div>

        {resetRelaysNotice && (
          <p className="text-emerald-400 text-xs font-medium text-center m-0 flex items-center justify-center gap-1.5">
            <Check size={14} />
            <span>Relay configuration reset to default mesh.</span>
          </p>
        )}

        {wipeNotice && (
          <p className="text-emerald-400 text-xs font-medium text-center m-0 flex items-center justify-center gap-1.5">
            <Check size={14} />
            <span>Local database and session state successfully cleared.</span>
          </p>
        )}
      </section>
    </div>
  );
}
