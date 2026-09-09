import { useState, type FormEvent } from 'react';
import { 
  X, 
  Settings, 
  Key, 
  Radio, 
  Shield, 
  Lock, 
  Unlock, 
  Fingerprint, 
  Flame, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  RefreshCw, 
  AlertCircle,
  Eye,
  EyeOff,
  ExternalLink,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { NostrKeypair, RelayInfo, VaultSecurityState, StoredIdentity } from '../types';
import { formatTruncatedKey } from '../lib/nostr';

interface ProfileSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  keypair: NostrKeypair;
  onUpdateKeypair: (kp: NostrKeypair) => void;
  relays: RelayInfo[];
  onAddRelay: (url: string, read: boolean, write: boolean) => void;
  onToggleRelayPermission: (url: string, type: 'read' | 'write') => void;
  onRemoveRelay: (url: string) => void;
  onTestPing: (url: string) => void;
  onResetDefaultRelays: () => void;
  vaultSecurity: VaultSecurityState | null;
  isLocked: boolean;
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

type SettingsSection = 'vault' | 'relays' | 'privacy';

export function ProfileSettingsDrawer({
  isOpen,
  onClose,
  keypair,
  onUpdateKeypair,
  relays,
  onAddRelay,
  onToggleRelayPermission,
  onRemoveRelay,
  onTestPing,
  onResetDefaultRelays,
  vaultSecurity,
  isLocked,
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
}: ProfileSettingsDrawerProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('relays');
  const [copiedKey, setCopiedKey] = useState<'npub' | 'nsec' | null>(null);
  const [showNsec, setShowNsec] = useState(false);
  const [newRelayUrl, setNewRelayUrl] = useState('');
  const [isAddingRelay, setIsAddingRelay] = useState(false);
  const [relayRead, setRelayRead] = useState(true);
  const [relayWrite, setRelayWrite] = useState(true);
  const [wipeNotice, setWipeNotice] = useState(false);

  if (!isOpen) return null;

  const handleCopy = (text: string, type: 'npub' | 'nsec') => {
    navigator.clipboard.writeText(text);
    setCopiedKey(type);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAddCustomRelay = (e: FormEvent) => {
    e.preventDefault();
    const clean = newRelayUrl.trim();
    if (!clean.startsWith('wss://') && !clean.startsWith('ws://')) {
      alert('Relay URL must begin with wss:// or ws://');
      return;
    }
    onAddRelay(clean, relayRead, relayWrite);
    setNewRelayUrl('');
    setIsAddingRelay(false);
  };

  const handleWipe = () => {
    if (confirm('Clear local RxDB database, cached notes, and session state?')) {
      onClearCache();
      setWipeNotice(true);
      setTimeout(() => setWipeNotice(false), 2000);
    }
  };

  const connectedCount = relays.filter((r) => r.status === 'connected').length;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-3xl max-h-[90vh] bg-[#000000] border border-white/20 rounded-[28px] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#0d0c0b]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-[#EC4899]/15 border border-[#EC4899]/30 text-[#EC4899] flex items-center justify-center shadow-inner">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="text-white font-black text-base uppercase tracking-wider m-0 flex items-center gap-2">
                Settings & Node Controls
              </h3>
              <p className="text-white/60 text-xs font-medium m-0">
                Manage Relays, Sovereign Key Vault, Passkeys and Security
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#161412] border border-white/20 hover:border-white/40 text-white/80 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-white/10 bg-[#0a0a0a] overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSection('relays')}
            className={`px-4 py-2 rounded-[14px] text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeSection === 'relays'
                ? 'bg-[#A855F7] text-white shadow-[0_0_12px_#A855F744]'
                : 'bg-[#161412] text-white/70 hover:text-white border border-white/10'
            }`}
          >
            <Radio size={14} />
            <span>Relays Mesh</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/40 text-white">
              {connectedCount}/{relays.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('vault')}
            className={`px-4 py-2 rounded-[14px] text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeSection === 'vault'
                ? 'bg-[#10B981] text-white shadow-[0_0_12px_#10B98144]'
                : 'bg-[#161412] text-white/70 hover:text-white border border-white/10'
            }`}
          >
            <Key size={14} />
            <span>Key Vault</span>
            {isLocked ? (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#EF4444]/30 text-[#EF4444] border border-[#EF4444]/40">
                Locked
              </span>
            ) : (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#10B981]/30 text-[#10B981] border border-[#10B981]/40">
                Active
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('privacy')}
            className={`px-4 py-2 rounded-[14px] text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeSection === 'privacy'
                ? 'bg-[#F59E0B] text-black shadow-[0_0_12px_#F59E0B44]'
                : 'bg-[#161412] text-white/70 hover:text-white border border-white/10'
            }`}
          >
            <Shield size={14} />
            <span>Privacy & Storage</span>
          </button>
        </div>

        {/* Scrollable Content Stage */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* SECTION 1: RELAYS MESH */}
          {activeSection === 'relays' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-white font-black text-sm uppercase tracking-wider m-0">
                    Connected Nostr Relays
                  </h4>
                  <p className="text-white/60 text-xs font-medium m-0">
                    Decentralized WebSocket nodes streaming notes and broadcasting your Zups
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onResetDefaultRelays}
                    className="px-3 py-1.5 rounded-[12px] bg-[#161412] border border-white/20 hover:border-white/40 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RefreshCw size={13} />
                    <span>Reset Defaults</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingRelay(!isAddingRelay)}
                    className="px-3.5 py-1.5 rounded-[12px] bg-[#A855F7] hover:opacity-90 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_10px_#A855F744]"
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
                  className="p-4 rounded-[18px] bg-[#161412] border border-[#A855F7]/40 space-y-3"
                >
                  <span className="text-white font-bold text-xs uppercase tracking-wider block">
                    Add WebSocket Relay Endpoint
                  </span>
                  <input
                    type="text"
                    value={newRelayUrl}
                    onChange={(e) => setNewRelayUrl(e.target.value)}
                    placeholder="wss://relay.example.com"
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-black border border-white/20 text-white text-xs font-mono placeholder:text-white/30 focus:outline-none focus:border-[#A855F7]"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs font-semibold text-white/80">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={relayRead}
                          onChange={(e) => setRelayRead(e.target.checked)}
                          className="rounded border-white/20 text-[#A855F7] focus:ring-0"
                        />
                        <span>Read</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={relayWrite}
                          onChange={(e) => setRelayWrite(e.target.checked)}
                          className="rounded border-white/20 text-[#A855F7] focus:ring-0"
                        />
                        <span>Write</span>
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingRelay(false)}
                        className="px-3 py-1 rounded-[10px] text-xs text-white/60 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-[10px] bg-[#A855F7] text-white text-xs font-bold cursor-pointer"
                      >
                        Connect Node
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Relay Cards List */}
              <div className="space-y-2.5">
                {relays.map((relay) => {
                  const isConnected = relay.status === 'connected';

                  return (
                    <div
                      key={relay.url}
                      className="p-3.5 rounded-[18px] bg-[#161412] border border-white/10 flex items-center justify-between gap-3 hover:border-white/25 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-3 h-3 rounded-full shrink-0 ${
                          isConnected ? 'bg-[#10B981] shadow-[0_0_8px_#10B981]' : 'bg-[#EF4444]'
                        }`} />
                        <div className="min-w-0">
                          <span className="text-white font-mono font-bold text-xs truncate block">
                            {relay.url}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] font-medium text-white/50">
                            <span>Status: {relay.status}</span>
                            {relay.latencyMs && (
                              <span className="text-[#A855F7] font-mono">
                                • {relay.latencyMs}ms
                              </span>
                            )}
                            {relay.isDefault && (
                              <span className="text-[10px] px-1 rounded bg-white/10 text-white/80">
                                Default
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onTestPing(relay.url)}
                          className="px-2.5 py-1 rounded-[10px] bg-black border border-white/15 text-white/70 hover:text-white text-[11px] font-mono transition-all"
                          title="Ping node"
                        >
                          Ping
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleRelayPermission(relay.url, 'read')}
                          className={`px-2 py-1 rounded-[10px] text-[10px] font-mono font-bold border transition-all ${
                            relay.read
                              ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                              : 'bg-black border-white/20 text-white/40'
                          }`}
                        >
                          R
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleRelayPermission(relay.url, 'write')}
                          className={`px-2 py-1 rounded-[10px] text-[10px] font-mono font-bold border transition-all ${
                            relay.write
                              ? 'bg-[#EC4899]/20 border-[#EC4899] text-[#EC4899]'
                              : 'bg-black border-white/20 text-white/40'
                          }`}
                        >
                          W
                        </button>
                        {!relay.isDefault && (
                          <button
                            type="button"
                            onClick={() => onRemoveRelay(relay.url)}
                            className="p-1.5 rounded-[10px] text-white/40 hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-all"
                            title="Remove Relay"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 2: KEY VAULT */}
          {activeSection === 'vault' && (
            <div className="space-y-5">
              {/* Vault Encryption & Lock Status Banner */}
              <div className="p-4 rounded-[20px] bg-[#161412] border border-white/15 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 border ${
                    isLocked 
                      ? 'bg-[#EF4444]/20 border-[#EF4444] text-[#EF4444]' 
                      : 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                  }`}>
                    {isLocked ? <Lock size={20} /> : <Unlock size={20} />}
                  </div>
                  <div>
                    <span className="text-white font-extrabold text-sm block">
                      {isLocked ? 'Sovereign Vault Locked' : 'Sovereign Vault Unlocked'}
                    </span>
                    <span className="text-white/60 text-xs font-medium block">
                      {isLocked 
                        ? 'Private keys are encrypted in memory. Unlock with password or passkey to sign.'
                        : 'Argon2id Master Encryption Key (MEK) active for Secp256k1 signing.'}
                    </span>
                  </div>
                </div>

                <div className="shrink-0">
                  {isLocked ? (
                    <button
                      type="button"
                      onClick={onOpenUnlock}
                      className="px-4 py-2 rounded-[14px] bg-[#10B981] hover:opacity-90 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_12px_#10B98155]"
                    >
                      Unlock Vault
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onLockVault}
                      className="px-4 py-2 rounded-[14px] bg-[#EF4444]/20 border border-[#EF4444] text-[#EF4444] hover:bg-[#EF4444]/30 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Lock Vault
                    </button>
                  )}
                </div>
              </div>

              {/* Public Key (npub) & Private Key (nsec) */}
              <div className="p-4 rounded-[20px] bg-[#161412] border border-white/15 space-y-4">
                <h5 className="text-white font-black text-xs uppercase tracking-wider m-0">
                  Cryptographic Keypair
                </h5>

                {/* npub */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60 font-semibold">Public Key (npub):</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(keypair.npub, 'npub')}
                      className="text-[#EC4899] hover:underline flex items-center gap-1 font-mono text-[11px] cursor-pointer"
                    >
                      {copiedKey === 'npub' ? (
                        <>
                          <Check size={12} />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy npub</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-2.5 rounded-[12px] bg-black border border-white/10 font-mono text-xs text-white/90 break-all select-all">
                    {keypair.npub}
                  </div>
                </div>

                {/* nsec */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60 font-semibold">Private Key (nsec):</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowNsec(!showNsec)}
                        className="text-white/60 hover:text-white flex items-center gap-1 font-mono text-[11px] cursor-pointer"
                      >
                        {showNsec ? <EyeOff size={12} /> : <Eye size={12} />}
                        <span>{showNsec ? 'Hide' : 'Reveal'}</span>
                      </button>
                      {keypair.nsec && (
                        <button
                          type="button"
                          onClick={() => handleCopy(keypair.nsec!, 'nsec')}
                          className="text-[#EC4899] hover:underline flex items-center gap-1 font-mono text-[11px] cursor-pointer"
                        >
                          {copiedKey === 'nsec' ? (
                            <>
                              <Check size={12} />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copy nsec</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-[12px] bg-black border border-white/10 font-mono text-xs text-white/90 break-all select-all">
                    {keypair.nsec ? (
                      showNsec ? keypair.nsec : '•'.repeat(48)
                    ) : (
                      <span className="text-white/40 italic">Private key is locked in MEK wrap</span>
                    )}
                  </div>
                </div>

                {/* Ephemeral Burner Mode */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Flame size={16} className={keypair.isEphemeral ? 'text-[#F59E0B]' : 'text-white/40'} />
                    <div>
                      <span className="text-white font-bold text-xs block">Burner Ephemeral Mode</span>
                      <span className="text-white/50 text-[11px] block">Keys destroyed on tab close</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleEphemeral}
                    className={`px-3 py-1 rounded-[10px] text-xs font-bold uppercase tracking-wider border cursor-pointer ${
                      keypair.isEphemeral
                        ? 'bg-[#F59E0B]/20 border-[#F59E0B] text-[#F59E0B]'
                        : 'bg-black border-white/20 text-white/60'
                    }`}
                  >
                    {keypair.isEphemeral ? 'Active' : 'Disabled'}
                  </button>
                </div>
              </div>

              {/* Multi-Identity Switcher & Import */}
              <div className="p-4 rounded-[20px] bg-[#161412] border border-white/15 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-white font-black text-xs uppercase tracking-wider m-0">
                    Stored Sovereign Identities
                  </h5>
                  <button
                    type="button"
                    onClick={onOpenImportDrawer}
                    className="px-3 py-1 rounded-[10px] bg-[#EC4899]/20 border border-[#EC4899] text-[#EC4899] text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-[#EC4899]/30"
                  >
                    <Plus size={12} />
                    <span>Import Key</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {identities.map((id) => {
                    const isCurrent = id.id === activeIdentityId || id.pubkeyHex === keypair.pubkeyHex;

                    return (
                      <div
                        key={id.id}
                        onClick={() => onSelectIdentity(id)}
                        className={`p-3 rounded-[14px] border flex items-center justify-between cursor-pointer transition-all ${
                          isCurrent
                            ? 'bg-black border-[#10B981] shadow-[0_0_10px_#10B98133]'
                            : 'bg-black/50 border-white/10 hover:border-white/30'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-2.5 h-2.5 rounded-full ${isCurrent ? 'bg-[#10B981]' : 'bg-white/30'}`} />
                          <div className="min-w-0">
                            <span className="text-white font-bold text-xs truncate block">
                              {id.displayName || id.name || 'Anonymous Peer'}
                            </span>
                            <span className="text-white/40 font-mono text-[10px] truncate block">
                              {formatTruncatedKey(id.npub)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isCurrent && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981] font-bold">
                              Active
                            </span>
                          )}
                          {identities.length > 1 && !isCurrent && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteIdentity(id.id);
                              }}
                              className="p-1 text-white/40 hover:text-[#EF4444]"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: PRIVACY & STORAGE */}
          {activeSection === 'privacy' && (
            <div className="space-y-4">
              <div className="p-4 rounded-[20px] bg-[#161412] border border-white/15 space-y-3">
                <h5 className="text-white font-black text-xs uppercase tracking-wider m-0">
                  Zero-Metadata & Leak Protection
                </h5>
                <p className="text-white/60 text-xs font-medium m-0">
                  Strict client-side isolation ensuring no telemetry, IP headers, or analytics are leaked.
                </p>
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between p-2.5 rounded-[12px] bg-black border border-white/10 text-xs">
                    <span className="text-white font-semibold">WebRTC IP Leak Guard</span>
                    <span className="text-[#10B981] font-mono font-bold">Enforced</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-[12px] bg-black border border-white/10 text-xs">
                    <span className="text-white font-semibold">Tor / Onion Multi-Hop Ready</span>
                    <span className="text-[#A855F7] font-mono font-bold">Supported</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-[12px] bg-black border border-white/10 text-xs">
                    <span className="text-white font-semibold">Decentralized Cryptography</span>
                    <span className="text-[#10B981] font-mono font-bold">BIP-340 Schnorr</span>
                  </div>
                </div>
              </div>

              {/* RxDB Local Storage & Wipe Cache */}
              <div className="p-4 rounded-[20px] bg-[#161412] border border-white/15 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-white font-black text-xs uppercase tracking-wider m-0">
                      Local RxDB Storage
                    </h5>
                    <p className="text-white/60 text-xs font-medium m-0">
                      Notes and direct messages are stored locally in your browser IndexedDB
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleWipe}
                    className="px-4 py-2.5 rounded-[14px] bg-[#EF4444]/15 border border-[#EF4444]/50 hover:bg-[#EF4444]/25 text-[#EF4444] font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>Clear Local Database & Cache</span>
                  </button>
                  {wipeNotice && (
                    <span className="text-[#10B981] font-mono text-xs mt-2 block">
                      ✓ Local cache wiped successfully
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
