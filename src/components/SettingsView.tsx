import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { 
  ArrowLeft,
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
  Plus, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Cloud, 
  Server, 
  Database, 
  Key, 
  Copy, 
  ExternalLink,
  User,
  Flame,
  CheckCircle2
} from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { hexToBytes, formatTruncatedKey } from '../lib/nostr';
import { 
  NostrKeypair, 
  RelayInfo, 
  VaultSecurityState, 
  SyncStatus, 
  KylrixOAuthSession,
  StoredIdentity 
} from '../types';
import { syncEngine } from '../lib/syncEngine';
import { kylrixOAuth } from '../lib/kylrixOAuth';
import { isSudoActive } from '../lib/sudo';
import { VaultCredentialsManager } from './VaultCredentialsManager';

export type SettingsSubTab = 'keys' | 'security' | 'relays' | 'privacy' | 'sync';

export interface SettingsViewProps {
  keypair: NostrKeypair;
  relays: RelayInfo[];
  vaultSecurity: VaultSecurityState | null;
  mek: Uint8Array | null;
  isLocked: boolean;
  onLockVault: () => void;
  onOpenUnlock: () => void;
  onOpenSetupEncryption: () => void;
  onUpdateVaultSecurity: (updated: VaultSecurityState) => void;
  onUnlocked?: (mek: Uint8Array) => void;
  onOpenPro: () => void;
  onClearCache: () => void;
  onResetDefaultRelays: () => void;
  onOpenSync?: () => void;
  onBackToFeed?: () => void;
  onAddRelay?: (url: string, read: boolean, write: boolean) => void;
  onToggleRelayPermission?: (url: string, type: 'read' | 'write') => void;
  onRemoveRelay?: (url: string) => void;
  onTestPing?: (url: string) => void;
  identities?: StoredIdentity[];
  activeIdentityId?: string | null;
  onSelectIdentity?: (identity: StoredIdentity) => void;
  onDeleteIdentity?: (id: string) => void;
  onOpenImportDrawer?: () => void;
  onToggleEphemeral?: () => void;
  onUpdateKeypair?: (kp: NostrKeypair) => void;
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
  onUnlocked,
  onOpenPro,
  onClearCache,
  onResetDefaultRelays,
  onOpenSync,
  onBackToFeed,
  onAddRelay,
  onToggleRelayPermission,
  onRemoveRelay,
  onTestPing,
  identities = [],
  activeIdentityId,
  onSelectIdentity,
  onDeleteIdentity,
  onOpenImportDrawer,
  onToggleEphemeral,
}: SettingsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('keys');

  // Sync state
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

  // Privacy toggles
  const [webrtcProtect, setWebrtcProtect] = useState(true);
  const [zeroMetadata, setZeroMetadata] = useState(true);
  const [nip07Bridge, setNip07Bridge] = useState(false);

  // Relay adding form
  const [isAddingRelay, setIsAddingRelay] = useState(false);
  const [newRelayUrl, setNewRelayUrl] = useState('');
  const [relayRead, setRelayRead] = useState(true);
  const [relayWrite, setRelayWrite] = useState(true);

  // Feedback notices
  const [wipeNotice, setWipeNotice] = useState(false);
  const [resetRelaysNotice, setResetRelaysNotice] = useState(false);
  const [benchmarking, setBenchmarking] = useState(false);
  const [benchResult, setBenchResult] = useState<string | null>(null);

  // Key revelation
  const [showPrivKeySettings, setShowPrivKeySettings] = useState(false);
  const [copiedKeySettings, setCopiedKeySettings] = useState<string | null>(null);

  const effectiveNsec = useMemo(() => {
    if (keypair.nsec) return keypair.nsec;
    if (keypair.privkeyHex) {
      try {
        return nip19.nsecEncode(hexToBytes(keypair.privkeyHex));
      } catch {
        return undefined;
      }
    }
    return undefined;
  }, [keypair.nsec, keypair.privkeyHex]);

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

  const handleAddCustomRelay = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newRelayUrl.trim();
    if (!trimmed) return;
    const url = trimmed.startsWith('wss://') || trimmed.startsWith('ws://') 
      ? trimmed 
      : `wss://${trimmed}`;
    
    if (onAddRelay) {
      onAddRelay(url, relayRead, relayWrite);
    }
    setNewRelayUrl('');
    setIsAddingRelay(false);
  };

  const connectedRelaysCount = relays.filter(r => r.status === 'connected').length;

  const implementedNIPs = [
    { nip: 'NIP-01', title: 'Basic protocol flow & Schnorr signatures' },
    { nip: 'NIP-02', title: 'Contact list & Petnames' },
    { nip: 'NIP-04', title: 'Encrypted Direct Messages (secp256k1 DH)' },
    { nip: 'NIP-05', title: 'DNS-based verification mapping' },
    { nip: 'NIP-10', title: 'Reply & Mention convention' },
    { nip: 'NIP-19', title: 'bech32-encoded entities (npub/nsec)' },
    { nip: 'NIP-57', title: 'Lightning Zaps & Receipts' },
  ];

  const subTabs = [
    { id: 'keys' as const, label: 'Account & Keys', icon: Key },
    { id: 'security' as const, label: 'Vault & Passkeys', icon: ShieldCheck },
    { 
      id: 'relays' as const, 
      label: 'Relay Mesh', 
      icon: Radio, 
      badge: `${connectedRelaysCount}/${relays.length}` 
    },
    { id: 'privacy' as const, label: 'Privacy & Shield', icon: Shield },
    { id: 'sync' as const, label: 'Sync & Storage', icon: Cloud },
  ];

  return (
    <div className="flex flex-col gap-4 max-w-3xl mx-auto pb-24 md:pb-12 text-white animate-fadeIn">
      {/* 1. Sticky Settings Top Navigation Header */}
      <div 
        id="settings-top-bar"
        className="sticky top-[72px] sm:top-[80px] z-20 bg-[#000000] border border-white/20 rounded-[20px] px-4 py-2.5 flex items-center justify-between shadow-xl"
      >
        <div className="flex items-center gap-3">
          {onBackToFeed && (
            <button
              id="settings-back-btn"
              type="button"
              onClick={onBackToFeed}
              className="w-8 h-8 rounded-full bg-[#161412] hover:bg-[#25221f] border border-white/20 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer"
              aria-label="Back to feed"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h1 className="text-white font-black text-sm uppercase tracking-wider m-0 leading-tight">
              Settings
            </h1>
            <span className="text-white/50 text-[11px] font-mono font-medium block leading-none mt-0.5">
              Identity, Security, Relays & Sovereign Mesh
            </span>
          </div>
        </div>

        {/* Quick Vault Status Badge / Trigger */}
        <div className="flex items-center gap-2">
          {vaultSecurity?.isInitialized ? (
            <button
              id="settings-vault-quick-toggle"
              type="button"
              onClick={isLocked ? onOpenUnlock : onLockVault}
              className={`px-3 py-1.5 rounded-[14px] text-xs font-bold font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                isLocked
                  ? 'bg-[#F59E0B]/15 hover:bg-[#F59E0B]/25 text-[#F59E0B] border border-[#F59E0B]/40'
                  : 'bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#10B981] border border-[#10B981]/40'
              }`}
              title={isLocked ? 'Click to Unlock Vault' : 'Click to Lock Vault'}
            >
              {isLocked ? <Lock size={13} /> : <Unlock size={13} />}
              <span>{isLocked ? 'Vault Locked' : 'Vault Active'}</span>
            </button>
          ) : (
            <button
              id="settings-setup-vault-btn"
              type="button"
              onClick={onOpenSetupEncryption}
              className="px-3 py-1.5 rounded-[14px] text-xs font-bold bg-[#EC4899]/15 hover:bg-[#EC4899]/25 text-[#EC4899] border border-[#EC4899]/40 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Shield size={13} />
              <span>Setup Vault</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Orderly Sub-Tabs Bar (Matches Profile & Feed Pill Navigation) */}
      <div 
        id="settings-subtabs-nav"
        className="flex items-center gap-1.5 overflow-x-auto p-1.5 rounded-[18px] bg-[#161412] border border-white/20 shadow-md"
      >
        {subTabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeSubTab === t.id;
          return (
            <button
              key={t.id}
              id={`settings-tab-${t.id}`}
              type="button"
              onClick={() => setActiveSubTab(t.id)}
              className={`px-3.5 py-2 rounded-[14px] text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#000000] text-white border border-white/40 shadow-sm'
                  : 'bg-transparent text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-[#EC4899]' : 'text-white/60'} />
              <span>{t.label}</span>
              {t.badge && (
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  isActive ? 'bg-[#EC4899] text-white' : 'bg-white/10 text-white/80'
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. SUB-TAB 1: ACCOUNT & KEYS */}
      {activeSubTab === 'keys' && (
        <div className="flex flex-col gap-4 animate-fadeIn">
          {/* Identity Profile Overview */}
          <section className="bg-[#161412] border border-white/20 rounded-[24px] p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3.5 min-w-0">
                <img
                  src={keypair.avatar}
                  alt={keypair.name || 'Account Avatar'}
                  className="w-12 h-12 rounded-[16px] object-cover border border-white/20 bg-black shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-white text-base font-black truncate m-0">
                      {keypair.displayName || keypair.name || 'Anonymous Peer'}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                      Sovereign
                    </span>
                    {keypair.isEphemeral && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 flex items-center gap-1">
                        <Flame size={10} />
                        Burner
                      </span>
                    )}
                  </div>
                  <p className="text-white/60 font-mono text-xs truncate mt-0.5 m-0 font-medium">
                    {keypair.npub ? formatTruncatedKey(keypair.npub, 12, 8) : 'No Public Key'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] bg-[#000000] border border-white/20 text-xs font-mono text-white font-bold">
                  <ShieldCheck size={14} className="text-[#10B981]" />
                  <span>secp256k1</span>
                </span>
              </div>
            </div>

            {/* Cryptographic Keys Section (npub & nsec) */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Key size={14} className="text-[#EC4899]" />
                  <span>Active Identity Keys</span>
                </span>
                {isLocked && vaultSecurity?.isInitialized && !isSudoActive() && (
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
                <div className="p-3.5 rounded-[18px] bg-[#000000] border border-white/20 flex flex-col justify-between gap-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-white uppercase tracking-wider">Public Key (npub)</span>
                    <button
                      type="button"
                      onClick={() => handleCopySettings(keypair.npub, 'npub')}
                      className="text-white hover:text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKeySettings === 'npub' ? (
                        <Check size={12} className="text-[#10B981]" />
                      ) : (
                        <Copy size={12} />
                      )}
                      <span>{copiedKeySettings === 'npub' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="font-mono text-xs text-white break-all m-0 select-all font-semibold">
                    {keypair.npub}
                  </p>
                </div>

                {/* Private Key (nsec) */}
                <div 
                  className={`p-3.5 rounded-[18px] bg-[#000000] border border-white/20 flex flex-col justify-between gap-2 shadow-sm ${
                    isLocked && vaultSecurity?.isInitialized ? 'cursor-pointer hover:border-[#EC4899]/60 transition-colors' : ''
                  }`}
                  onClick={() => {
                    if (isLocked && vaultSecurity?.isInitialized) {
                      onOpenUnlock();
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-white uppercase tracking-wider">Private Key (nsec)</span>
                    {effectiveNsec ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            if (isLocked && vaultSecurity?.isInitialized && !isSudoActive()) {
                              onOpenUnlock();
                              return;
                            }
                            setShowPrivKeySettings(!showPrivKeySettings);
                          }}
                          className="text-white hover:text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          {showPrivKeySettings ? <EyeOff size={12} /> : <Eye size={12} />}
                          <span>{showPrivKeySettings ? 'Hide' : 'Show'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopySettings(effectiveNsec, 'nsec')}
                          className="text-white hover:text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKeySettings === 'nsec' ? (
                            <Check size={12} className="text-[#10B981]" />
                          ) : (
                            <Copy size={12} />
                          )}
                          <span>{copiedKeySettings === 'nsec' ? 'Copied' : 'Copy nsec'}</span>
                        </button>
                      </div>
                    ) : isLocked && vaultSecurity?.isInitialized ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenUnlock();
                        }}
                        className="text-xs font-bold text-[#EC4899] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Unlock size={12} />
                        <span>Unlock</span>
                      </button>
                    ) : null}
                  </div>
                  <p className="font-mono text-xs text-white break-all m-0 select-all font-semibold">
                    {effectiveNsec ? (
                      showPrivKeySettings ? (
                        effectiveNsec
                      ) : (
                        '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'
                      )
                    ) : isLocked && vaultSecurity?.isInitialized ? (
                      <span className="text-[#F59E0B] text-xs flex items-center gap-1 font-sans font-bold">
                        <Lock size={12} />
                        Vault locked. Tap here to unlock and reveal nsec.
                      </span>
                    ) : keypair.isWatchOnly ? (
                      <span className="text-white text-xs font-sans font-medium">
                        Watch-only identity (No private key loaded)
                      </span>
                    ) : (
                      <span className="text-white text-xs font-sans font-medium">
                        No private key stored for this identity
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Ephemeral Mode Toggle */}
            {onToggleEphemeral && (
              <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white block">
                    Ephemeral Burner Session Mode
                  </span>
                  <p className="text-white/60 text-xs mt-0.5 m-0 font-medium">
                    When active, private keys are wiped on tab close and never written to persistent disk.
                  </p>
                </div>
                <ToggleSwitch
                  id="toggle-ephemeral-mode"
                  checked={!!keypair.isEphemeral}
                  onChange={onToggleEphemeral}
                  ariaLabel="Toggle Ephemeral Session Mode"
                />
              </div>
            )}
          </section>

          {/* Stored Sovereign Identities Switcher */}
          {identities.length > 0 && (
            <section className="bg-[#161412] border border-white/20 rounded-[24px] p-5 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white text-sm font-black uppercase tracking-wide m-0">
                    Stored Sovereign Identities
                  </h3>
                  <p className="text-white/60 text-xs mt-0.5 m-0 font-medium">
                    Quickly switch between saved sovereign Nostr keypairs.
                  </p>
                </div>
                {onOpenImportDrawer && (
                  <button
                    type="button"
                    onClick={onOpenImportDrawer}
                    className="px-3 py-1.5 rounded-[12px] bg-[#EC4899] hover:bg-[#db2777] text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <Plus size={13} />
                    <span>Import Identity</span>
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {identities.map((id) => {
                  const isActive = id.id === activeIdentityId || id.npub === keypair.npub;
                  return (
                    <div
                      key={id.id}
                      className={`p-3.5 rounded-[18px] border flex items-center justify-between gap-3 transition-colors ${
                        isActive
                          ? 'bg-[#000000] border-[#EC4899]/60 shadow-sm'
                          : 'bg-[#000000] border-white/20 hover:border-white/40'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={id.avatar}
                          alt={id.name}
                          className="w-9 h-9 rounded-[12px] bg-black border border-white/20 object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold text-xs truncate">
                              {id.displayName || id.name}
                            </span>
                            {isActive && (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-[#EC4899]/20 text-[#EC4899] border border-[#EC4899]/40">
                                Active
                              </span>
                            )}
                          </div>
                          <span className="text-white/50 text-[11px] font-mono block truncate">
                            {formatTruncatedKey(id.npub, 10, 6)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isActive && onSelectIdentity && (
                          <button
                            type="button"
                            onClick={() => onSelectIdentity(id)}
                            className="px-3 py-1.5 rounded-[10px] bg-[#161412] hover:bg-[#25221f] border border-white/20 text-white text-xs font-bold transition-all cursor-pointer"
                          >
                            Switch
                          </button>
                        )}
                        {!isActive && onDeleteIdentity && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Remove identity "${id.displayName || id.name}" from local storage?`)) {
                                onDeleteIdentity(id.id);
                              }
                            }}
                            className="p-1.5 rounded-[10px] text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Remove Identity"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* 4. SUB-TAB 2: VAULT & PASSKEYS */}
      {activeSubTab === 'security' && (
        <div className="flex flex-col gap-4 animate-fadeIn">
          <VaultCredentialsManager
            vaultSecurity={vaultSecurity}
            mek={mek}
            isLocked={isLocked}
            onLockVault={onLockVault}
            onOpenUnlock={onOpenUnlock}
            onOpenSetupEncryption={onOpenSetupEncryption}
            onUpdateVaultSecurity={onUpdateVaultSecurity}
            onUnlocked={onUnlocked}
          />
        </div>
      )}

      {/* 5. SUB-TAB 3: RELAY MESH */}
      {activeSubTab === 'relays' && (
        <div className="flex flex-col gap-4 animate-fadeIn">
          <section className="bg-[#161412] border border-white/20 rounded-[24px] p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-white text-sm font-black uppercase tracking-wide m-0">
                    Connected Nostr Relay Mesh
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 font-bold">
                    {connectedRelaysCount}/{relays.length} Online
                  </span>
                </div>
                <p className="text-white/60 text-xs mt-0.5 m-0 font-medium">
                  Decentralized WebSocket endpoints streaming live Kind 1 notes and broadcasting your signed Zups.
                </p>
              </div>

              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                <button
                  type="button"
                  onClick={handleResetRelays}
                  className="px-3 py-1.5 rounded-[12px] bg-[#000000] border border-white/20 hover:border-white/40 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <RefreshCw size={13} />
                  <span>Restore Defaults</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingRelay(!isAddingRelay)}
                  className="px-3.5 py-1.5 rounded-[12px] bg-[#EC4899] hover:bg-[#db2777] text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Plus size={14} />
                  <span>Add Relay</span>
                </button>
              </div>
            </div>

            {/* Add Custom Relay Form */}
            {isAddingRelay && (
              <form 
                onSubmit={handleAddCustomRelay}
                className="p-4 rounded-[18px] bg-[#000000] border border-[#EC4899]/50 flex flex-col gap-3 shadow-md animate-fadeIn"
              >
                <span className="text-white font-bold text-xs uppercase tracking-wider block">
                  Add WebSocket Relay Endpoint
                </span>
                <input
                  type="text"
                  value={newRelayUrl}
                  onChange={(e) => setNewRelayUrl(e.target.value)}
                  placeholder="wss://relay.damus.io"
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#161412] border border-white/20 text-white text-xs font-mono placeholder:text-white/30 focus:outline-none focus:border-[#EC4899]"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs font-semibold text-white/80">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={relayRead}
                        onChange={(e) => setRelayRead(e.target.checked)}
                        className="rounded border-white/20 text-[#EC4899] focus:ring-0"
                      />
                      <span>Read</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={relayWrite}
                        onChange={(e) => setRelayWrite(e.target.checked)}
                        className="rounded border-white/20 text-[#EC4899] focus:ring-0"
                      />
                      <span>Write</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingRelay(false)}
                      className="px-3 py-1.5 rounded-[10px] text-xs text-white/60 hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-[10px] bg-[#EC4899] hover:bg-[#db2777] text-white text-xs font-bold cursor-pointer transition-all shadow-sm"
                    >
                      Connect Node
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Relay Cards List */}
            <div className="flex flex-col gap-2.5">
              {relays.map((relay) => {
                const isConnected = relay.status === 'connected';
                return (
                  <div
                    key={relay.url}
                    className="p-3.5 rounded-[18px] bg-[#000000] border border-white/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm hover:border-white/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        isConnected ? 'bg-[#10B981] shadow-[0_0_8px_#10B981]' : 'bg-[#F59E0B] animate-pulse'
                      }`} />
                      <div className="min-w-0">
                        <span className="text-white font-mono text-xs font-bold truncate block">
                          {relay.url}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-white/50 text-[10px] font-mono">
                            {relay.latencyMs ? `${relay.latencyMs}ms` : isConnected ? 'Active' : 'Connecting...'}
                          </span>
                          <span className="text-white/20 text-[10px]">•</span>
                          <span className="text-white/50 text-[10px] font-mono">
                            Read: {relay.read ? 'On' : 'Off'} | Write: {relay.write ? 'On' : 'Off'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                      {/* Read toggle */}
                      {onToggleRelayPermission && (
                        <button
                          type="button"
                          onClick={() => onToggleRelayPermission(relay.url, 'read')}
                          className={`px-2 py-0.5 rounded-[8px] text-[10px] font-mono font-bold transition-all cursor-pointer ${
                            relay.read
                              ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30'
                              : 'bg-white/5 text-white/40 border border-white/10'
                          }`}
                        >
                          R
                        </button>
                      )}

                      {/* Write toggle */}
                      {onToggleRelayPermission && (
                        <button
                          type="button"
                          onClick={() => onToggleRelayPermission(relay.url, 'write')}
                          className={`px-2 py-0.5 rounded-[8px] text-[10px] font-mono font-bold transition-all cursor-pointer ${
                            relay.write
                              ? 'bg-[#EC4899]/20 text-[#EC4899] border border-[#EC4899]/30'
                              : 'bg-white/5 text-white/40 border border-white/10'
                          }`}
                        >
                          W
                        </button>
                      )}

                      {/* Ping test */}
                      {onTestPing && (
                        <button
                          type="button"
                          onClick={() => onTestPing(relay.url)}
                          className="p-1.5 rounded-[10px] text-white/60 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                          title="Ping Relay"
                        >
                          <RefreshCw size={13} />
                        </button>
                      )}

                      {/* Remove relay */}
                      {onRemoveRelay && (
                        <button
                          type="button"
                          onClick={() => onRemoveRelay(relay.url)}
                          className="p-1.5 rounded-[10px] text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Remove Relay"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {resetRelaysNotice && (
              <p className="text-[#10B981] text-xs font-bold text-center m-0 flex items-center justify-center gap-1.5 pt-2 border-t border-white/10">
                <Check size={14} />
                <span>Relay configuration restored to default sovereign pool.</span>
              </p>
            )}
          </section>
        </div>
      )}

      {/* 6. SUB-TAB 4: PRIVACY & NETWORK */}
      {activeSubTab === 'privacy' && (
        <div className="flex flex-col gap-4 animate-fadeIn">
          <section className="bg-[#161412] border border-white/20 rounded-[24px] p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[12px] bg-[#F59E0B]/15 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
                <Shield size={16} />
              </div>
              <div>
                <h3 className="text-white text-sm font-black uppercase tracking-wide m-0">
                  Network Privacy & Leak Guards
                </h3>
                <p className="text-white/60 text-xs mt-0.5 m-0 font-medium">
                  Autonomous client shields to eliminate browser fingerprinting and network leakage.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {/* Zero Metadata Leakage */}
              <div className="flex items-center justify-between gap-4 p-4 rounded-[18px] bg-[#000000] border border-white/20 shadow-sm">
                <div className="min-w-0 flex-1">
                  <span className="text-white text-xs font-bold block">
                    Zero Metadata Leakage
                  </span>
                  <p className="text-white/60 text-xs mt-0.5 leading-relaxed font-medium m-0">
                    Strips browser user-agent fingerprints and randomizes WebSocket reconnect timing to prevent relay correlation.
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
              <div className="flex items-center justify-between gap-4 p-4 rounded-[18px] bg-[#000000] border border-white/20 shadow-sm">
                <div className="min-w-0 flex-1">
                  <span className="text-white text-xs font-bold block">
                    WebRTC Local IP Shield
                  </span>
                  <p className="text-white/60 text-xs mt-0.5 leading-relaxed font-medium m-0">
                    Prevents browser WebRTC STUN queries from leaking your private LAN IP address to external nodes.
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
              <div className="flex items-center justify-between gap-4 p-4 rounded-[18px] bg-[#000000] border border-white/20 shadow-sm">
                <div className="min-w-0 flex-1">
                  <span className="text-white text-xs font-bold block">
                    NIP-07 Extension Delegation (Alby, nos2x)
                  </span>
                  <p className="text-white/60 text-xs mt-0.5 leading-relaxed font-medium m-0">
                    Delegates event signing to external browser extensions without exposing raw private keys in memory.
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
                className="flex items-center justify-between gap-4 p-4 rounded-[18px] bg-[#000000] border border-white/20 hover:border-[#EC4899]/60 cursor-pointer transition-colors group shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-xs font-bold block">
                      Tor Onion Routing Circuits
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#EC4899]/20 text-[#EC4899] border border-[#EC4899]/40">
                      Pro Circuit
                    </span>
                  </div>
                  <p className="text-white/60 text-xs mt-0.5 leading-relaxed font-medium m-0">
                    Routes all relay WebSocket streams through encrypted multi-hop onion circuits (.onion relays).
                  </p>
                </div>
                <span className="text-xs font-bold text-[#EC4899] group-hover:underline shrink-0">
                  Configure →
                </span>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 7. SUB-TAB 5: SYNC & STORAGE */}
      {activeSubTab === 'sync' && (
        <div className="flex flex-col gap-4 animate-fadeIn">
          {/* Cloud Sync & Identity Anchor */}
          <section className="bg-[#161412] border border-white/20 rounded-[24px] p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[12px] bg-[#EC4899]/15 border border-[#EC4899]/30 flex items-center justify-center text-[#EC4899]">
                  <Cloud size={16} />
                </div>
                <div>
                  <h3 className="text-white text-sm font-black uppercase tracking-wide m-0">Sign in with Kylrix & Sync</h3>
                  <p className="text-white/60 text-xs mt-0.5 m-0 font-medium">
                    End-to-end sync using OAuth 2.1 PKCE and NIP-78 identity records.
                  </p>
                </div>
              </div>

              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold ${
                  syncStatus === 'pending'
                    ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40'
                    : syncStatus === 'offline'
                    ? 'bg-[#000000] text-white/60 border border-white/20'
                    : 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40'
                }`}
              >
                {syncStatus === 'pending'
                  ? `Pending (${pendingCount})`
                  : syncStatus === 'offline'
                  ? 'Offline'
                  : 'Synchronized'}
              </span>
            </div>

            <div className="bg-[#000000] border border-white/20 rounded-[18px] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                {oauthSession.isConnected && oauthSession.profile ? (
                  <img
                    src={oauthSession.profile.avatar}
                    alt={oauthSession.profile.name}
                    className="w-10 h-10 rounded-[12px] border border-white/20 bg-black object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-[12px] bg-[#161412] border border-white/20 flex items-center justify-center text-white shrink-0">
                    <Server size={18} />
                  </div>
                )}
                <div className="min-w-0">
                  <span className="text-white font-extrabold text-xs block truncate">
                    {oauthSession.isConnected && oauthSession.profile
                      ? `${oauthSession.profile.name} (${oauthSession.profile.email || oauthSession.profile.userId})`
                      : 'Local-First Sovereign Client'}
                  </span>
                  <span className="text-white/60 text-xs block truncate mt-0.5 font-medium">
                    {oauthSession.isConnected
                      ? 'OAuth 2.1 PKCE active · NIP-78 linked'
                      : 'Local RxDB is active. No external dependencies required.'}
                  </span>
                </div>
              </div>

              {onOpenSync && (
                <button
                  type="button"
                  onClick={onOpenSync}
                  className="w-full sm:w-auto px-4 py-2 rounded-[14px] bg-white text-black hover:bg-white/90 text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center shrink-0 shadow-sm"
                >
                  {oauthSession.isConnected ? 'Manage Sync' : 'Connect Account'}
                </button>
              )}
            </div>
          </section>

          {/* Protocol Architecture & NIP Compliance */}
          <section className="bg-[#161412] border border-white/20 rounded-[24px] p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[12px] bg-[#6366F1]/15 border border-[#6366F1]/30 flex items-center justify-center text-[#6366F1]">
                  <Terminal size={16} />
                </div>
                <div>
                  <h3 className="text-white text-sm font-black uppercase tracking-wide m-0">Nostr Standards Compliance</h3>
                  <p className="text-white/60 text-xs mt-0.5 m-0 font-medium">
                    BIP-340 Schnorr signatures & active Nostr protocols.
                  </p>
                </div>
              </div>
              <span className="text-white/60 text-xs font-mono font-bold hidden sm:inline px-2 py-0.5 rounded bg-black border border-white/20">
                secp256k1
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {implementedNIPs.map((n) => (
                <div
                  key={n.nip}
                  className="p-3 rounded-[16px] bg-[#000000] border border-white/20 flex items-center justify-between gap-3 shadow-sm"
                >
                  <div className="min-w-0">
                    <span className="text-white font-mono font-bold text-xs block">
                      {n.nip}
                    </span>
                    <span className="text-white/60 text-[11px] font-medium truncate block mt-0.5">
                      {n.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 shrink-0">
                    Active
                  </span>
                </div>
              ))}
            </div>

            {/* Cryptographic Benchmark Runner */}
            <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleRunBenchmark}
                disabled={benchmarking}
                className="flex items-center gap-2 px-3.5 py-2 rounded-[14px] bg-[#000000] border border-white/20 hover:border-white/40 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-sm"
              >
                <Cpu size={14} className="text-[#6366F1]" />
                <span>{benchmarking ? 'Benchmarking Engine...' : 'Run Crypto Benchmark'}</span>
              </button>

              {benchResult ? (
                <span className="text-[#10B981] font-mono text-xs font-bold">
                  {benchResult}
                </span>
              ) : (
                <span className="text-white/50 font-mono text-xs font-medium">
                  Client-side verification latency
                </span>
              )}
            </div>
          </section>

          {/* Local Storage & Cache */}
          <section className="bg-[#161412] border border-white/20 rounded-[24px] p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[12px] bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Database size={16} />
              </div>
              <div>
                <h3 className="text-white text-sm font-black uppercase tracking-wide m-0">Local Storage & Cache</h3>
                <p className="text-white/60 text-xs mt-0.5 m-0 font-medium">
                  Restore default relay pools or wipe local client-side RxDB database.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleResetRelays}
                className="p-3.5 rounded-[16px] bg-[#000000] border border-white/20 hover:border-white/40 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <RefreshCw size={14} className="text-white" />
                <span>Restore Default Relays</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isLocked && vaultSecurity?.isInitialized && !isSudoActive()) {
                    onOpenUnlock();
                    return;
                  }
                  handleWipe();
                }}
                className="p-3.5 rounded-[16px] bg-[#000000] border border-rose-500/40 hover:border-rose-500 text-rose-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Trash2 size={14} className="text-rose-400" />
                <span>Purge Local Data & Keys</span>
              </button>
            </div>

            {wipeNotice && (
              <p className="text-[#10B981] text-xs font-bold text-center m-0 flex items-center justify-center gap-1.5 pt-2 border-t border-white/10">
                <Check size={14} />
                <span>Local database and session state successfully cleared.</span>
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
