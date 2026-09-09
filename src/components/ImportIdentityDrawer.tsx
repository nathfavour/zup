import { useState, FormEvent, useId } from 'react';
import { 
  KeyRound, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Check, 
  AlertCircle, 
  UserPlus, 
  Sparkles, 
  Lock, 
  QrCode,
  Zap
} from 'lucide-react';
import { TactileDrawer } from './TactileDrawer';
import { importKey, formatTruncatedKey } from '../lib/nostr';
import { encryptSecret } from '../lib/crypto';
import { StoredIdentity, NostrKeypair } from '../types';

interface ImportIdentityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mek: Uint8Array | null;
  onIdentityImported: (identity: StoredIdentity, keypair: NostrKeypair) => void;
}

export function ImportIdentityDrawer({
  isOpen,
  onClose,
  mek,
  onIdentityImported,
}: ImportIdentityDrawerProps) {
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDisplayName, setCustomDisplayName] = useState('');
  const [lud16, setLud16] = useState('');
  const [setAsActive, setSetAsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real-time validation
  const parsedKeypair = keyInput.trim() ? importKey(keyInput.trim()) : null;
  const isPrivate = Boolean(parsedKeypair?.privkeyHex);
  const isWatchOnly = Boolean(parsedKeypair && !parsedKeypair.privkeyHex);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!parsedKeypair) {
      setError('Please provide a valid nsec, hex private key, or npub.');
      return;
    }

    if (isPrivate && !mek) {
      setError('Vault is locked. Please unlock vault first to encrypt your private key.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      let encryptedPrivHex: string | undefined;
      let encryptedNsec: string | undefined;

      if (parsedKeypair.privkeyHex && mek) {
        encryptedPrivHex = await encryptSecret(parsedKeypair.privkeyHex, mek);
        if (parsedKeypair.nsec) {
          encryptedNsec = await encryptSecret(parsedKeypair.nsec, mek);
        }
      }

      const finalName = customName.trim() || parsedKeypair.name || `User_${parsedKeypair.pubkeyHex.slice(0, 6)}`;
      const finalDisplayName = customDisplayName.trim() || parsedKeypair.displayName || 'Decentralized Sovereign';

      const stored: StoredIdentity = {
        id: `id_${parsedKeypair.pubkeyHex.slice(0, 12)}_${Date.now()}`,
        pubkeyHex: parsedKeypair.pubkeyHex,
        npub: parsedKeypair.npub,
        name: finalName,
        displayName: finalDisplayName,
        avatar: parsedKeypair.avatar,
        lud16: lud16.trim() || undefined,
        isEphemeral: false,
        isWatchOnly: !isPrivate,
        encryptedPrivkeyHex: encryptedPrivHex,
        encryptedNsec: encryptedNsec,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      };

      const resolvedKeypair: NostrKeypair = {
        id: stored.id,
        pubkeyHex: parsedKeypair.pubkeyHex,
        npub: parsedKeypair.npub,
        privkeyHex: parsedKeypair.privkeyHex,
        nsec: parsedKeypair.nsec,
        isEphemeral: false,
        isWatchOnly: !isPrivate,
        name: finalName,
        displayName: finalDisplayName,
        avatar: parsedKeypair.avatar,
        lud16: lud16.trim() || undefined,
      };

      onIdentityImported(stored, resolvedKeypair);
      setIsSaving(false);
      setKeyInput('');
      setCustomName('');
      setCustomDisplayName('');
      setLud16('');
      onClose();
    } catch (err: unknown) {
      console.error('Failed to import identity:', err);
      setError('Failed to encrypt and store identity in RxDB.');
      setIsSaving(false);
    }
  };

  return (
    <TactileDrawer
      id="import-identity-drawer"
      isOpen={isOpen}
      onClose={onClose}
      title="Import Sovereign Identity"
      subtitle="Import Bech32 nsec, 64-char Hex Key, or Watch-Only npub"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Security badge */}
        <div className="p-3.5 rounded-[18px] bg-[#000000] border border-white/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#10B981]/15 text-[#10B981] flex items-center justify-center border border-[#10B981]/40">
              <ShieldCheck size={16} />
            </div>
            <div>
              <h5 className="text-white font-black text-xs m-0">Zero-Knowledge Storage</h5>
              <p className="text-white text-[11px] font-bold m-0 mt-0.5">
                Private keys are AES-256 encrypted using your Master Key.
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30 text-[9px] font-mono font-bold">
            RxDB E2EE
          </span>
        </div>

        {error && (
          <div className="p-3 rounded-[14px] bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Input key field */}
        <div className="flex flex-col gap-2">
          <label className="text-white text-xs font-extrabold uppercase tracking-wider flex items-center justify-between">
            <span>Identity Key (nsec1..., hex, or npub1...)</span>
            <span className="text-[10px] text-white/50 lowercase font-mono">bech32 / hex</span>
          </label>
          <div className="relative">
            <textarea
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Paste nsec1..., 64-hex private key, or npub1..."
              rows={3}
              required
              className="w-full bg-[#000000] border border-white/20 focus:border-[#10B981] focus:outline-none rounded-[16px] p-3 text-white font-mono text-xs placeholder:text-white/40 resize-none"
            />
          </div>
        </div>

        {/* Live validation card styled exactly like the chat list card */}
        {parsedKeypair && (
          <div className="p-3.5 rounded-[18px] bg-[#000000] border-2 border-[#10B981] shadow-[0_0_12px_#10B98133] flex items-center gap-3">
            <img
              src={parsedKeypair.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${parsedKeypair.pubkeyHex}`}
              alt="Preview"
              className="w-10 h-10 rounded-full border border-white/20 bg-black shrink-0 object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <h4 className="text-white font-black text-xs m-0 truncate">
                  {customDisplayName || parsedKeypair.displayName || 'Decentralized Sovereign'}
                </h4>
                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-black uppercase ${
                    isPrivate
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
                  }`}
                >
                  {isPrivate ? 'Full Signer' : 'Watch Only'}
                </span>
              </div>
              <p className="text-white text-[11px] font-mono font-medium m-0 mt-0.5 truncate">
                {formatTruncatedKey(parsedKeypair.npub, 12, 6)}
              </p>
            </div>
          </div>
        )}

        {/* Custom Identity Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-white text-[11px] font-extrabold uppercase tracking-wider">
              Display Name
            </label>
            <input
              type="text"
              value={customDisplayName}
              onChange={(e) => setCustomDisplayName(e.target.value)}
              placeholder="e.g. Satoshi"
              className="bg-[#000000] border border-white/20 focus:border-[#10B981] focus:outline-none rounded-[14px] px-3 py-2 text-white text-xs placeholder:text-white/40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-white text-[11px] font-extrabold uppercase tracking-wider">
              Handle (@name)
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. satoshi"
              className="bg-[#000000] border border-white/20 focus:border-[#10B981] focus:outline-none rounded-[14px] px-3 py-2 text-white text-xs placeholder:text-white/40"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-white text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
            <Zap size={13} className="text-amber-400" />
            <span>Lightning Address (LUD-16 for Zaps)</span>
          </label>
          <input
            type="text"
            value={lud16}
            onChange={(e) => setLud16(e.target.value)}
            placeholder="satoshi@getalby.com"
            className="bg-[#000000] border border-white/20 focus:border-[#10B981] focus:outline-none rounded-[14px] px-3 py-2 text-white text-xs placeholder:text-white/40 font-mono"
          />
        </div>

        {/* Option to set as active */}
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={setAsActive}
            onChange={(e) => setSetAsActive(e.target.checked)}
            className="rounded border-white/20 bg-black text-[#10B981] focus:ring-0 cursor-pointer"
          />
          <span className="text-white text-xs font-bold">
            Set as active sovereign identity immediately
          </span>
        </label>

        {/* Submit action */}
        <button
          type="submit"
          disabled={!parsedKeypair || isSaving}
          className="w-full py-3.5 rounded-[16px] bg-[#10B981] hover:bg-[#059669] disabled:opacity-40 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_14px_#10B98144]"
        >
          <UserPlus size={16} />
          <span>{isSaving ? 'Encrypting & Storing in RxDB...' : 'Import Sovereign Identity'}</span>
        </button>
      </form>
    </TactileDrawer>
  );
}
