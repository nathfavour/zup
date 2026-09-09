import { useState, FormEvent } from 'react';
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
  // Prompt for passkey first by default if passkeys exist
  const [usePasskey, setUsePasskey] = useState(hasPasskeys);
  const [selectedPasskeyId, setSelectedPasskeyId] = useState<string>(
    hasPasskeys ? securityState!.passkeys[0].id : ''
  );

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        throw new Error('No passkey registered. Use your master password instead.');
      }

      const mek = await unlockMEKWithPasskey(targetPasskey);
      setIsAuthenticating(false);
      onUnlocked(mek);
      onClose();
    } catch (err: unknown) {
      console.error('Passkey unlock failed:', err);
      setError('Biometric authentication failed or was cancelled. Please unlock with your master password below.');
      setIsAuthenticating(false);
      // Seamless fallback to password unlock
      setUsePasskey(false);
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

        {/* Tab Selector: Passkey (default) vs Password */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-[16px] bg-[#000000] border border-white/20">
          <button
            type="button"
            onClick={() => setUsePasskey(true)}
            className={`py-2 px-3 rounded-[12px] text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              usePasskey
                ? 'bg-[#A855F7] text-white shadow-[0_0_10px_#A855F744]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Fingerprint size={14} />
            <span>Passkey (Default)</span>
          </button>

          <button
            type="button"
            onClick={() => setUsePasskey(false)}
            className={`py-2 px-3 rounded-[12px] text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              !usePasskey
                ? 'bg-[#10B981] text-black shadow-[0_0_10px_#10B98144]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <KeyRound size={14} />
            <span>Password</span>
          </button>
        </div>

        {/* Passkey Unlock View */}
        {usePasskey && hasPasskeys && (
          <div className="flex flex-col gap-4">
            <div className="p-5 rounded-[20px] bg-[#000000] border border-white/20 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-16 h-16 rounded-[22px] bg-[#A855F7]/15 border border-[#A855F7]/40 flex items-center justify-center text-[#A855F7] animate-pulse shadow-[0_0_20px_#A855F733]">
                <Fingerprint size={32} />
              </div>
              <div>
                <h4 className="text-white font-black text-sm uppercase tracking-wider m-0">
                  Touch ID / Biometric Passkey
                </h4>
                <p className="text-white text-xs font-medium mt-1 m-0">
                  Authenticate with your device to unwrap the Master Encryption Key.
                </p>
              </div>

              {securityState.passkeys.length > 1 && (
                <div className="w-full mt-2 flex flex-col gap-1.5 text-left">
                  <label className="text-white text-[10px] font-mono font-bold uppercase tracking-wider">
                    Select Authenticator:
                  </label>
                  <select
                    value={selectedPasskeyId}
                    onChange={(e) => setSelectedPasskeyId(e.target.value)}
                    className="w-full bg-[#161412] border border-white/20 rounded-[12px] px-3 py-2 text-white text-xs"
                  >
                    {securityState.passkeys.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Added {new Date(p.createdAt).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handlePasskeyUnlock()}
              disabled={isAuthenticating}
              className="w-full py-3.5 rounded-[16px] bg-[#A855F7] hover:bg-[#9333ea] disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_14px_#A855F744]"
            >
              <Fingerprint size={16} />
              <span>{isAuthenticating ? 'Waiting for Biometrics...' : 'Authenticate with Device'}</span>
            </button>

            <button
              type="button"
              onClick={() => setUsePasskey(false)}
              className="text-xs text-white/60 hover:text-white text-center cursor-pointer"
            >
              Or unlock with Master Password instead
            </button>
          </div>
        )}

        {/* Passkey empty fallback notice */}
        {usePasskey && !hasPasskeys && (
          <div className="flex flex-col gap-3 p-4 rounded-[18px] bg-[#000000] border border-white/20 text-center">
            <p className="text-white text-xs font-medium m-0">
              No passkeys configured on this device yet. Please unlock with your Master Password, then add a passkey in Settings.
            </p>
            <button
              type="button"
              onClick={() => setUsePasskey(false)}
              className="py-2.5 rounded-[14px] bg-[#10B981] text-black font-black text-xs uppercase tracking-wider cursor-pointer"
            >
              Use Master Password
            </button>
          </div>
        )}

        {/* Password Unlock View */}
        {!usePasskey && (
          <form onSubmit={handlePasswordUnlock} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-white text-xs font-extrabold uppercase tracking-wider">
                Master Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your master password..."
                  required
                  autoFocus
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
                <span>Computing Argon2id & Decrypting MEK...</span>
              ) : (
                <>
                  <span>Unlock Sovereign Vault</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>

            {hasPasskeys && (
              <button
                type="button"
                onClick={() => setUsePasskey(true)}
                className="text-xs text-white/60 hover:text-white text-center cursor-pointer"
              >
                Switch back to On-Device Passkey (Default)
              </button>
            )}
          </form>
        )}
      </div>
    </TactileDrawer>
  );
}
