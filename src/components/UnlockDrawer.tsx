import { useState, useEffect, FormEvent } from 'react';
import { 
  Fingerprint, 
  Lock, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  KeyRound
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
  onSetupEncryption?: () => void;
}

export function UnlockDrawer({
  isOpen,
  onClose,
  securityState,
  onUnlocked,
  onSetupEncryption,
}: UnlockDrawerProps) {
  const hasPasskeys = (securityState?.passkeys?.length || 0) > 0;
  const [selectedPasskeyId, setSelectedPasskeyId] = useState<string>(
    hasPasskeys ? securityState!.passkeys[0].id : ''
  );

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferPassword, setPreferPassword] = useState(false);

  // Seamless Sudo/Unlock: Auto-trigger biometric prompt on open
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setPassword('');
      if (hasPasskeys && !preferPassword && !isAuthenticating) {
        const timer = setTimeout(() => {
          handlePasskeyUnlock();
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, hasPasskeys, preferPassword]);

  if (!isOpen) return null;

  // If vault encryption hasn't been configured yet, render prompt to initialize master password
  if (!securityState) {
    return (
      <TactileDrawer
        id="unlock-vault-drawer"
        isOpen={isOpen}
        onClose={onClose}
        title="Sovereign Vault Gate"
        subtitle="Zero-knowledge Argon2id master key security"
      >
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-[18px] bg-[#000000] border border-white/20 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[14px] bg-[#F59E0B]/15 text-[#F59E0B] flex items-center justify-center border border-[#F59E0B]/40">
                <Lock size={18} />
              </div>
              <div>
                <h4 className="text-white font-black text-xs uppercase tracking-wider m-0">
                  Vault Not Encrypted
                </h4>
                <p className="text-white/60 text-[11px] font-mono mt-0.5 m-0 font-medium">
                  Initialize master password to seal keys
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 text-[9px] font-mono font-black">
              UNINITIALIZED
            </span>
          </div>

          <p className="text-white/70 text-xs leading-relaxed m-0 font-medium">
            Your cryptographic keys are currently unencrypted in memory. Set up a master password and optional biometric passkeys to seal your credentials with Argon2id + AES-256-GCM encryption.
          </p>

          <button
            type="button"
            onClick={() => {
              onClose();
              if (onSetupEncryption) onSetupEncryption();
            }}
            className="w-full py-3.5 rounded-[16px] bg-[#EC4899] hover:bg-[#db2777] text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_14px_#EC489944]"
          >
            <KeyRound size={15} strokeWidth={2.5} />
            <span>Setup Master Password & Passkeys</span>
          </button>
        </div>
      </TactileDrawer>
    );
  }

  const handlePasskeyUnlock = async (passkeyToUse?: PasskeyRecord) => {
    setError(null);
    setIsAuthenticating(true);

    try {
      const targetPasskey =
        passkeyToUse ||
        securityState.passkeys.find((p) => p.id === selectedPasskeyId) ||
        securityState.passkeys[0];

      if (!targetPasskey) {
        throw new Error('No passkey registered.');
      }

      const mek = await unlockMEKWithPasskey(targetPasskey);
      markSudoActive();
      setIsAuthenticating(false);
      onUnlocked(mek);
      onClose();
    } catch (err: unknown) {
      console.warn('Passkey verification dismissed or failed:', err);
      setError('Biometric prompt dismissed. Enter master password below.');
      setIsAuthenticating(false);
      setPreferPassword(true);
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
      setError('Incorrect master password. Could not decrypt vault MEK.');
      setIsAuthenticating(false);
    }
  };

  return (
    <TactileDrawer
      id="unlock-vault-drawer"
      isOpen={isOpen}
      onClose={onClose}
      title="Sovereign Vault Sudo Gate"
      subtitle="Client-side Argon2id zero-knowledge authorization"
    >
      <div className="flex flex-col gap-4">
        {/* Minimal High-Contrast Status Card */}
        <div className="p-4 rounded-[18px] bg-[#000000] border border-white/20 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-[#10B981]/15 text-[#10B981] flex items-center justify-center border border-[#10B981]/40">
              <Lock size={18} />
            </div>
            <div>
              <h4 className="text-white font-black text-xs uppercase tracking-wider m-0">
                Encrypted Session Gate
              </h4>
              <p className="text-white/60 text-[11px] font-mono mt-0.5 m-0 font-medium">
                {securityState.passkeys.length > 0 
                  ? `${securityState.passkeys.length} Passkey${securityState.passkeys.length === 1 ? '' : 's'} registered`
                  : 'Master password protection'}
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[9px] font-mono font-black">
            LOCKED
          </span>
        </div>

        {error && (
          <div className="p-3 rounded-[14px] bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Biometric Trigger (if available) */}
        {hasPasskeys && !preferPassword && (
          <div className="flex flex-col items-center gap-4 py-4 p-4 rounded-[18px] bg-[#000000] border border-white/20 shadow-sm">
            <button
              type="button"
              onClick={() => handlePasskeyUnlock()}
              disabled={isAuthenticating}
              className="w-20 h-20 rounded-2xl bg-[#A855F7]/15 border-2 border-[#A855F7] flex items-center justify-center text-[#A855F7] hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-[0_0_24px_#A855F744] disabled:opacity-50"
            >
              <Fingerprint size={36} className={isAuthenticating ? 'animate-pulse' : ''} />
            </button>

            <div className="text-center">
              <span className="text-white text-xs font-black uppercase tracking-wider block">
                {isAuthenticating ? 'Confirming Biometrics...' : 'Touch ID / Passkey Unlock'}
              </span>
              <span className="text-white/50 text-[10px] font-medium block mt-0.5">
                Tap the fingerprint icon or verify with your device security key
              </span>
            </div>

            <button
              type="button"
              onClick={() => setPreferPassword(true)}
              className="text-xs text-white/60 hover:text-white font-bold underline cursor-pointer mt-1"
            >
              Use master password instead
            </button>
          </div>
        )}

        {/* Master Password Input Form */}
        {(!hasPasskeys || preferPassword) && (
          <form onSubmit={handlePasswordUnlock} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-white text-xs font-extrabold uppercase tracking-wider">
                  Master Password
                </label>
                {hasPasskeys && (
                  <button
                    type="button"
                    onClick={() => setPreferPassword(false)}
                    className="text-[11px] text-[#A855F7] hover:underline font-bold cursor-pointer"
                  >
                    Switch to Biometrics
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your master password..."
                  required
                  autoFocus
                  className="w-full bg-[#000000] border border-white/20 focus:border-[#10B981] focus:outline-none rounded-[16px] pl-4 pr-11 py-3 text-white text-xs placeholder:text-white/40 font-mono"
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
                <span>Decrypting Vault...</span>
              ) : (
                <>
                  <KeyRound size={15} strokeWidth={2.5} />
                  <span>Unlock Sovereign Session</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </TactileDrawer>
  );
}
