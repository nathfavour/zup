import { useState, useEffect, FormEvent } from 'react';
import { 
  Fingerprint, 
  KeyRound, 
  Lock, 
  ShieldCheck, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Sparkles 
} from 'lucide-react';
import { TactileDrawer } from './TactileDrawer';
import { 
  decryptMEKWithPassword, 
  unlockMEKWithPasskey 
} from '../lib/crypto';
import { markSudoActive } from '../lib/sudo';
import { VaultSecurityState, PasskeyRecord } from '../types';

interface UnlockDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  securityState: VaultSecurityState | null;
  onUnlocked: (mek: Uint8Array) => void;
}

export function UnlockDrawer({
  isOpen,
  onClose,
  securityState,
  onUnlocked,
}: UnlockDrawerProps) {
  const hasPasskeys = (securityState?.passkeys?.length || 0) > 0;
  const [selectedPasskeyId, setSelectedPasskeyId] = useState<string>(
    hasPasskeys ? securityState!.passkeys[0].id : ''
  );

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seamless Sudo/Unlock: Automatically prompt for biometric passkey when drawer opens if passkey exists
  useEffect(() => {
    if (isOpen && hasPasskeys && !isAuthenticating && !password) {
      const timer = setTimeout(() => {
        handlePasskeyUnlock();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!securityState) return null;

  const handlePasskeyUnlock = async (passkeyToUse?: PasskeyRecord) => {
    setError(null);
    setIsAuthenticating(true);

    try {
      const targetPasskey =
        passkeyToUse ||
        securityState.passkeys.find((p) => p.id === selectedPasskeyId) ||
        securityState.passkeys[0];

      if (!targetPasskey) {
        throw new Error('No passkey registered. Enter your master password below.');
      }

      const mek = await unlockMEKWithPasskey(targetPasskey);
      markSudoActive();
      setIsAuthenticating(false);
      onUnlocked(mek);
      onClose();
    } catch (err: unknown) {
      console.warn('Passkey auto-prompt dismissed or failed:', err);
      setError('Biometric authentication cancelled or failed. Enter master password below.');
      setIsAuthenticating(false);
    }
  };

  const handlePasswordUnlock = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setError(null);
    setIsAuthenticating(true);

    try {
      const result = await decryptMEKWithPassword(
        securityState.passwordWrappedMEK,
        password
      );
      markSudoActive();
      setIsAuthenticating(false);
      setPassword('');
      onUnlocked(result.mek);
      onClose();
    } catch (err: unknown) {
      console.error('Password unlock failed:', err);
      setError('Incorrect master password. Argon2id could not decrypt MEK.');
      setIsAuthenticating(false);
    }
  };

  return (
    <TactileDrawer
      id="unlock-vault-drawer"
      isOpen={isOpen}
      onClose={onClose}
      title="Unlock Sovereign Vault"
      subtitle="Client-side Zero-Knowledge MEK Decryption"
    >
      <div className="flex flex-col gap-4">
        {/* Security Info Card */}
        <div className="p-4 rounded-[18px] bg-[#000000] border border-white/20 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-[#10B981]/15 text-[#10B981] flex items-center justify-center border border-[#10B981]/40 shadow-[0_0_10px_#10B98122]">
              <Lock size={18} />
            </div>
            <div>
              <h4 className="text-white font-black text-xs uppercase tracking-wider m-0">
                Encrypted with Argon2id + AES-256
              </h4>
              <p className="text-white text-[11px] font-bold mt-0.5 m-0">
                {securityState.passkeys.length} Registered Passkey{securityState.passkeys.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <span className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-mono font-black">
            LOCKED
          </span>
        </div>

        {error && (
          <div className="p-3 rounded-[14px] bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Passkey Quick Trigger (when passkeys are enrolled) */}
        {hasPasskeys && (
          <div className="p-4 rounded-[18px] bg-[#000000] border border-white/20 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#A855F7]">
                <Fingerprint size={18} />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Passkey / Biometric Unlock
                </span>
              </div>
              {securityState.passkeys.length > 1 && (
                <select
                  value={selectedPasskeyId}
                  onChange={(e) => setSelectedPasskeyId(e.target.value)}
                  className="bg-[#161412] border border-white/20 rounded-[10px] px-2 py-1 text-white text-[11px]"
                >
                  {securityState.passkeys.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              type="button"
              onClick={() => handlePasskeyUnlock()}
              disabled={isAuthenticating}
              className="w-full py-3 rounded-[14px] bg-[#A855F7] hover:bg-[#9333ea] disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_14px_#A855F744]"
            >
              <Fingerprint size={16} />
              <span>{isAuthenticating ? 'Waiting for Biometrics...' : 'Unlock with Passkey / Touch ID'}</span>
            </button>
          </div>
        )}

        {/* Password Unlock View (Always visible) */}
        <form onSubmit={handlePasswordUnlock} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-white text-xs font-extrabold uppercase tracking-wider flex items-center justify-between">
              <span>Master Password</span>
              {hasPasskeys && (
                <span className="text-[10px] font-normal text-white/50 normal-case">
                  Or enter password directly
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your master password..."
                required
                autoFocus={!hasPasskeys}
                className="w-full bg-[#000000] border border-white/20 focus:border-[#10B981] focus:outline-none rounded-[16px] pl-4 pr-11 py-3 text-white text-xs placeholder:text-white/40"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/60 hover:text-white cursor-pointer"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isAuthenticating || !password}
            className="w-full py-3.5 rounded-[16px] bg-[#10B981] hover:bg-[#059669] disabled:opacity-40 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_14px_#10B98144]"
          >
            {isAuthenticating ? (
              <span>Decrypting MEK with Argon2id...</span>
            ) : (
              <>
                <span>Unlock Sovereign Vault</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>
      </div>
    </TactileDrawer>
  );
}
