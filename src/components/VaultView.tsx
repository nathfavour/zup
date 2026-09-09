import { useState, type FormEvent } from 'react';
import { 
  Key, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  RefreshCw, 
  Download, 
  Upload, 
  Flame, 
  Sparkles, 
  User, 
  Zap, 
  AlertTriangle,
  Lock,
  Unlock,
  Plus,
  Trash2,
  ExternalLink,
  Shield,
  Fingerprint
} from 'lucide-react';
import { NostrKeypair, StoredIdentity, VaultSecurityState } from '../types';
import { createNewKeypair, formatTruncatedKey } from '../lib/nostr';
import { VaultCredentialsManager } from './VaultCredentialsManager';

interface VaultViewProps {
  keypair: NostrKeypair;
  onUpdateKeypair: (kp: NostrKeypair) => void;
  onOpenPro: () => void;
  onToggleEphemeral: () => void;
  identities: StoredIdentity[];
  activeIdentityId?: string;
  onSelectIdentity: (identity: StoredIdentity) => void;
  onOpenImportDrawer: () => void;
  onDeleteIdentity: (id: string) => void;
  vaultSecurity: VaultSecurityState | null;
  mek?: Uint8Array | null;
  isLocked: boolean;
  onLockVault: () => void;
  onOpenUnlock: () => void;
  onOpenSetupEncryption: () => void;
  onUpdateVaultSecurity?: (updated: VaultSecurityState) => void;
  onUnlocked?: (mek: Uint8Array) => void;
}

export function VaultView({
  keypair,
  onUpdateKeypair,
  onOpenPro,
  onToggleEphemeral,
  identities,
  activeIdentityId,
  onSelectIdentity,
  onOpenImportDrawer,
  onDeleteIdentity,
  vaultSecurity,
  mek,
  isLocked,
  onLockVault,
  onOpenUnlock,
  onOpenSetupEncryption,
  onUpdateVaultSecurity,
  onUnlocked,
}: VaultViewProps) {
  const [showPrivKey, setShowPrivKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Profile Edit State
  const [name, setName] = useState(keypair.name || '');
  const [displayName, setDisplayName] = useState(keypair.displayName || '');
  const [about, setAbout] = useState(keypair.about || '');
  const [lud16, setLud16] = useState(keypair.lud16 || '');
  const [nip05, setNip05] = useState(keypair.nip05 || '');
  const [isSaved, setIsSaved] = useState(false);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleGenerateFresh = () => {
    if (confirm('Generate a brand new cryptographic keypair? Make sure you backup your current nsec first!')) {
      const newKp = createNewKeypair(false);
      onUpdateKeypair(newKp);
      setName(newKp.name || '');
      setDisplayName(newKp.displayName || '');
      setAbout(newKp.about || '');
    }
  };

  const handleSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    const updated: NostrKeypair = {
      ...keypair,
      name: name.trim(),
      displayName: displayName.trim(),
      about: about.trim(),
      lud16: lud16.trim(),
      nip05: nip05.trim(),
    };
    onUpdateKeypair(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleExportJson = () => {
    const backupData = {
      client: 'Zup Cypher',
      pubkey: keypair.pubkeyHex,
      npub: keypair.npub,
      privkey: keypair.privkeyHex,
      nsec: keypair.nsec,
      displayName: keypair.displayName,
      name: keypair.name,
      lud16: keypair.lud16,
      exportedAt: new Date().toISOString(),
      encryption: vaultSecurity?.isInitialized ? 'Argon2id + AES-256-GCM Double Wrap' : 'Plaintext',
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zup-keypair-${keypair.pubkeyHex.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-5 pb-16 md:pb-6">
      {/* Vault Overview Card */}
      <div className="p-5 rounded-[22px] bg-[#000000] border border-white/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-[16px] bg-[#10B981]/15 border border-[#10B981]/40 flex items-center justify-center text-[#10B981] shadow-[0_0_12px_#10B98133]">
            <Key size={24} />
          </div>
          <div>
            <h3 className="text-white font-black text-base uppercase tracking-wider m-0">
              Sovereign Cryptographic Vault
            </h3>
            <p className="text-white text-xs font-bold mt-0.5 m-0">
              RxDB local database with client-level Argon2id Master Key encryption.
            </p>
          </div>
        </div>

        {/* Vault Lock State Action Pill */}
        <div className="flex items-center gap-2">
          {vaultSecurity?.isInitialized ? (
            isLocked ? (
              <button
                onClick={onOpenUnlock}
                className="px-3.5 py-2 rounded-[16px] text-xs font-black uppercase tracking-wider flex items-center gap-2 bg-[#A855F7] hover:bg-[#9333ea] text-white cursor-pointer shadow-[0_0_12px_#A855F744] transition-all"
              >
                <Unlock size={14} />
                <span>Unlock Vault</span>
              </button>
            ) : (
              <button
                onClick={onLockVault}
                className="px-3.5 py-2 rounded-[16px] text-xs font-black uppercase tracking-wider flex items-center gap-2 bg-[#161412] hover:bg-black border border-white/20 hover:border-white/50 text-white cursor-pointer transition-all"
              >
                <Lock size={14} className="text-emerald-400" />
                <span>Lock Vault</span>
              </button>
            )
          ) : (
            <button
              onClick={onOpenSetupEncryption}
              className="px-3.5 py-2 rounded-[16px] text-xs font-black uppercase tracking-wider flex items-center gap-2 bg-[#10B981] hover:bg-[#059669] text-black cursor-pointer shadow-[0_0_12px_#10B98144] transition-all"
            >
              <Shield size={14} />
              <span>Setup Vault Encryption</span>
            </button>
          )}

          {/* Burner Switch Pill */}
          <button
            onClick={onToggleEphemeral}
            className={`px-3.5 py-2 rounded-[16px] text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border ${
              keypair.isEphemeral
                ? 'bg-[#F59E0B]/20 border-[#F59E0B] text-white shadow-[0_0_12px_#F59E0B33]'
                : 'bg-[#161412] border-white/20 text-white hover:border-white/50'
            }`}
          >
            <Flame size={15} className={keypair.isEphemeral ? 'text-[#F59E0B]' : 'text-white'} />
            <span>{keypair.isEphemeral ? 'Burner Mode' : 'Switch to Burner'}</span>
          </button>
        </div>
      </div>

      {/* Ephemeral Warning Banner if active */}
      {keypair.isEphemeral && (
        <div className="p-4 rounded-[22px] bg-[#000000] border border-[#F59E0B] flex items-center gap-3 shadow-[0_0_14px_#F59E0B22]">
          <AlertTriangle size={20} className="text-[#F59E0B] shrink-0" />
          <div className="min-w-0">
            <span className="text-white font-black text-xs uppercase tracking-wider block">
              Ephemeral Session Warning
            </span>
            <p className="text-white text-xs font-medium m-0 leading-relaxed">
              This disposable burner keypair is held strictly in temporary RAM. Your permanent sovereign keys remain untouched in RxDB.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* IDENTITIES LIST - STACKED IN SUPERB CHAT-CARD DESIGN MOOD */}
      {/* ========================================================= */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User size={18} className="text-[#10B981]" />
            <h4 className="text-white font-black text-sm uppercase tracking-wider m-0">
              Sovereign Identities ({identities.length})
            </h4>
          </div>
          <button
            onClick={onOpenImportDrawer}
            className="px-3 py-1.5 rounded-[14px] bg-[#10B981] hover:bg-[#059669] text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_10px_#10B98133]"
          >
            <Plus size={14} />
            <span>Import nsec / Identity</span>
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {identities.map((identity) => {
            const isActive =
              identity.pubkeyHex === keypair.pubkeyHex ||
              (activeIdentityId && identity.id === activeIdentityId);

            return (
              <div
                key={identity.id}
                onClick={() => onSelectIdentity(identity)}
                className={`p-3.5 rounded-[18px] transition-all cursor-pointer flex items-center gap-3 group ${
                  isActive
                    ? 'bg-[#000000] border-2 border-[#10B981] shadow-[0_0_14px_#10B98133]'
                    : 'bg-[#000000] border border-white/20 hover:border-white/50'
                }`}
              >
                {/* Avatar with crisp border */}
                <img
                  src={
                    identity.avatar ||
                    `https://api.dicebear.com/7.x/identicon/svg?seed=${identity.pubkeyHex}`
                  }
                  alt={identity.displayName}
                  className="w-11 h-11 rounded-full border border-white/20 bg-black shrink-0 object-cover"
                />

                {/* Identity Metadata */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <h4 className="text-white font-black text-xs m-0 truncate group-hover:text-[#10B981] transition-colors">
                        {identity.displayName || identity.name}
                      </h4>
                      {identity.name && (
                        <span className="text-white/60 text-[11px] font-mono font-medium truncate">
                          @{identity.name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isActive && (
                        <span className="px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 text-[9px] font-mono font-black">
                          ACTIVE
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-black uppercase ${
                          identity.isWatchOnly
                            ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}
                      >
                        {identity.isWatchOnly ? 'Watch Only' : 'Full Signer'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-white font-mono text-[11px] font-bold m-0 truncate">
                      {formatTruncatedKey(identity.npub, 14, 8)}
                    </p>

                    <div className="flex items-center gap-2 shrink-0">
                      {identity.lud16 && (
                        <span className="text-[10px] text-amber-400 font-mono font-medium flex items-center gap-0.5">
                          <Zap size={11} />
                          {identity.lud16}
                        </span>
                      )}

                      {!isActive && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Remove identity "${identity.displayName}" from local RxDB?`)) {
                              onDeleteIdentity(identity.id);
                            }
                          }}
                          className="text-white/40 hover:text-red-400 p-1 cursor-pointer transition-colors"
                          title="Delete Identity"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Identity Keys Display Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Public Key (npub) Card */}
        <div className="p-4 rounded-[22px] bg-[#000000] border border-white/20 flex flex-col justify-between gap-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              Active Public Key (npub)
            </span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-white">
              SAFE TO SHARE
            </span>
          </div>

          <div className="p-3 rounded-[14px] bg-[#161412] border border-white/10 font-mono text-xs text-white break-all leading-relaxed select-all">
            {keypair.npub}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/10 text-xs">
            <span className="text-white text-[11px] font-mono font-bold">
              Hex: {formatTruncatedKey(keypair.pubkeyHex, 10, 6)}
            </span>
            <button
              onClick={() => handleCopy(keypair.npub, 'npub')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] bg-[#161412] border border-white/20 hover:border-white/50 text-white font-bold cursor-pointer"
            >
              {copiedKey === 'npub' ? (
                <Check size={13} className="text-emerald-400" />
              ) : (
                <Copy size={13} />
              )}
              <span>{copiedKey === 'npub' ? 'Copied' : 'Copy npub'}</span>
            </button>
          </div>
        </div>

        {/* Private Key (nsec) Card */}
        <div className="p-4 rounded-[22px] bg-[#000000] border border-white/20 flex flex-col justify-between gap-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
              <Key size={14} className="text-rose-400" />
              Active Private Key (nsec)
            </span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
              NEVER SHARE
            </span>
          </div>

          <div className="p-3 rounded-[14px] bg-[#161412] border border-white/10 font-mono text-xs text-white break-all leading-relaxed select-all">
            {keypair.nsec ? (
              showPrivKey ? (
                keypair.nsec
              ) : (
                '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'
              )
            ) : (
              'Watch-only mode (No private key loaded)'
            )}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/10 text-xs">
            <button
              onClick={() => setShowPrivKey(!showPrivKey)}
              className="flex items-center gap-1.5 text-white hover:text-white/80 font-bold cursor-pointer"
            >
              {showPrivKey ? <EyeOff size={13} /> : <Eye size={13} />}
              <span>{showPrivKey ? 'Mask Key' : 'Reveal Key'}</span>
            </button>

            {keypair.nsec && (
              <button
                onClick={() => handleCopy(keypair.nsec!, 'nsec')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] bg-[#161412] border border-white/20 hover:border-white/50 text-white font-bold cursor-pointer"
              >
                {copiedKey === 'nsec' ? (
                  <Check size={13} className="text-emerald-400" />
                ) : (
                  <Copy size={13} />
                )}
                <span>{copiedKey === 'nsec' ? 'Copied' : 'Copy nsec'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Key Actions Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={handleGenerateFresh}
          className="p-3.5 rounded-[18px] bg-[#000000] border border-white/20 hover:border-white/50 transition-all flex items-center justify-center gap-2 text-white font-bold text-xs cursor-pointer shadow-md"
        >
          <RefreshCw size={14} />
          <span>Generate Fresh Keypair</span>
        </button>

        <button
          onClick={onOpenImportDrawer}
          className="p-3.5 rounded-[18px] bg-[#000000] border border-white/20 hover:border-white/50 transition-all flex items-center justify-center gap-2 text-white font-bold text-xs cursor-pointer shadow-md"
        >
          <Upload size={14} />
          <span>Import nsec / npub</span>
        </button>

        <button
          onClick={handleExportJson}
          className="p-3.5 rounded-[18px] bg-[#000000] border border-white/20 hover:border-white/50 transition-all flex items-center justify-center gap-2 text-white font-bold text-xs cursor-pointer shadow-md"
        >
          <Download size={14} />
          <span>Export Backup JSON</span>
        </button>
      </div>

      {/* Sovereign Vault Credentials & Passkeys Manager */}
      {onUpdateVaultSecurity && (
        <VaultCredentialsManager
          vaultSecurity={vaultSecurity}
          mek={mek ?? null}
          isLocked={isLocked}
          onLockVault={onLockVault}
          onOpenUnlock={onOpenUnlock}
          onOpenSetupEncryption={onOpenSetupEncryption}
          onUpdateVaultSecurity={onUpdateVaultSecurity}
          onUnlocked={onUnlocked}
        />
      )}

      {/* Profile Metadata & NIP Settings Card */}
      <form
        onSubmit={handleSaveProfile}
        className="p-5 rounded-[22px] bg-[#000000] border border-white/20 flex flex-col gap-4 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User size={18} className="text-[#EC4899]" />
            <h4 className="text-white font-black text-sm uppercase tracking-wider m-0">
              Identity Profile Metadata (Kind 0)
            </h4>
          </div>
          <span className="text-white text-[10px] font-mono font-bold">
            DECENTRALIZED PROFILE
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-white text-xs font-extrabold uppercase tracking-wider">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Satoshi Nakamoto"
              className="bg-[#161412] border border-white/20 focus:border-[#10B981] focus:outline-none rounded-[16px] px-4 py-2.5 text-white text-xs placeholder:text-white/40"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-white text-xs font-extrabold uppercase tracking-wider">
              Username Handle (@name)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="satoshi"
              className="bg-[#161412] border border-white/20 focus:border-[#10B981] focus:outline-none rounded-[16px] px-4 py-2.5 text-white text-xs placeholder:text-white/40"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-white text-xs font-extrabold uppercase tracking-wider">
            About / Bio
          </label>
          <textarea
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            rows={2}
            placeholder="Sovereign peer on Zup cypherpunk mesh."
            className="bg-[#161412] border border-white/20 focus:border-[#10B981] focus:outline-none rounded-[16px] px-4 py-2.5 text-white text-xs placeholder:text-white/40 resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-white text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5">
              <Zap size={14} className="text-[#F59E0B]" />
              <span>Lightning Address (LUD-16)</span>
            </label>
            <input
              type="text"
              value={lud16}
              onChange={(e) => setLud16(e.target.value)}
              placeholder="satoshi@getalby.com"
              className="bg-[#161412] border border-white/20 focus:border-[#10B981] focus:outline-none rounded-[16px] px-4 py-2.5 text-white font-mono text-xs placeholder:text-white/40"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-white text-xs font-extrabold uppercase tracking-wider flex items-center justify-between">
              <span>NIP-05 Identifier</span>
              <button
                type="button"
                onClick={onOpenPro}
                className="text-[10px] text-[#A855F7] hover:underline cursor-pointer"
              >
                Verify DNS Alias
              </button>
            </label>
            <input
              type="text"
              value={nip05}
              onChange={(e) => setNip05(e.target.value)}
              placeholder="user@example.com"
              className="bg-[#161412] border border-white/20 focus:border-[#10B981] focus:outline-none rounded-[16px] px-4 py-2.5 text-white font-mono text-xs placeholder:text-white/40"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <span className="text-white text-[11px] font-bold">
            {isSaved && '✓ Metadata updated & saved to RxDB'}
          </span>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-[16px] bg-[#10B981] hover:bg-[#059669] text-black font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_12px_#10B98133]"
          >
            Save Identity Metadata
          </button>
        </div>
      </form>
    </div>
  );
}
