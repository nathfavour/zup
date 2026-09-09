import { useState, FormEvent } from 'react';
import { 
  ShieldCheck, 
  Fingerprint, 
  ArrowRight, 
  Sparkles, 
  Eye, 
  EyeOff, 
  Flame,
  KeyRound,
  Radio,
  Zap,
  Check,
  Cpu
} from 'lucide-react';
import { TactileDrawer } from './TactileDrawer';
import { 
  generateMEK, 
  encryptMEKWithPassword, 
  createPasskeyRecord, 
  ARGON2_CONFIG 
} from '../lib/crypto';
import { VaultSecurityState, PasskeyRecord } from '../types';

interface EncryptionSetupDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleteSetup: (securityState: VaultSecurityState, mek: Uint8Array) => void;
}

export function EncryptionSetupDrawer({
  isOpen,
  onClose,
  onCompleteSetup,
}: EncryptionSetupDrawerProps) {
  const [viewMode, setViewMode] = useState<'consumer' | 'password' | 'passkey_finish'>('consumer');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passkeyName, setPasskeyName] = useState('My Device Passkey');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Intermediate state
  const [generatedMEK, setGeneratedMEK] = useState<Uint8Array | null>(null);
  const [passwordWrapped, setPasswordWrapped] = useState<{
    cipherText: string;
    iv: string;
    salt: string;
  } | null>(null);

  // 1. One-Tap Web2 Consumer Onboarding via Passkey (Face ID, Touch ID, Windows Hello)
  const handleOneTapPasskey = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const mek = generateMEK();
      const passkey = await createPasskeyRecord(
        mek,
        passkeyName.trim() || 'Biometric Passkey'
      );

      // Derive secure auto-wrapped entropy so vault is encrypted locally
      const internalEntropy = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const wrapped = await encryptMEKWithPassword(mek, internalEntropy);

      const securityState: VaultSecurityState = {
        id: 'primary_vault_security',
        isInitialized: true,
        salt: wrapped.salt,
        passwordWrappedMEK: wrapped,
        passkeys: [passkey],
        argonConfig: {
          iterations: ARGON2_CONFIG.iterations,
          memorySize: ARGON2_CONFIG.memorySize,
          hashLength: ARGON2_CONFIG.hashLength,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setIsProcessing(false);
      onCompleteSetup(securityState, mek);
    } catch (err: unknown) {
      console.error('Fast passkey failed:', err);
      setIsProcessing(false);
      setError('Could not complete biometric authentication. You can continue as Guest or use a Password.');
    }
  };

  // 2. Instant Guest / Burner Onboarding
  const handleContinueAsGuest = async () => {
    setIsProcessing(true);
    try {
      const mek = generateMEK();
      const ephemeralEntropy = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const wrapped = await encryptMEKWithPassword(mek, ephemeralEntropy);

      const securityState: VaultSecurityState = {
        id: 'primary_vault_security',
        isInitialized: true,
        salt: wrapped.salt,
        passwordWrappedMEK: wrapped,
        passkeys: [],
        argonConfig: {
          iterations: ARGON2_CONFIG.iterations,
          memorySize: ARGON2_CONFIG.memorySize,
          hashLength: ARGON2_CONFIG.hashLength,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setIsProcessing(false);
      onCompleteSetup(securityState, mek);
    } catch (err: unknown) {
      console.error('Guest setup error:', err);
      setIsProcessing(false);
    }
  };

  // 3. Custom Argon2id Password Setup
  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Master password must be at least 8 characters for security.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsProcessing(true);
    try {
      const mek = generateMEK();
      setGeneratedMEK(mek);
      const wrapped = await encryptMEKWithPassword(mek, password);
      setPasswordWrapped(wrapped);

      setIsProcessing(false);
      setViewMode('passkey_finish');
    } catch (err: unknown) {
      console.error('Failed to derive Argon2id:', err);
      setError('Argon2id derivation failed. Please try a different password.');
      setIsProcessing(false);
    }
  };

  const handleFinishCustomPasskey = async () => {
    if (!generatedMEK || !passwordWrapped) return;
    setIsProcessing(true);
    try {
      const passkey = await createPasskeyRecord(
        generatedMEK,
        passkeyName.trim() || 'On-Device Biometric'
      );

      const securityState: VaultSecurityState = {
        id: 'primary_vault_security',
        isInitialized: true,
        salt: passwordWrapped.salt,
        passwordWrappedMEK: passwordWrapped,
        passkeys: [passkey],
        argonConfig: {
          iterations: ARGON2_CONFIG.iterations,
          memorySize: ARGON2_CONFIG.memorySize,
          hashLength: ARGON2_CONFIG.hashLength,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      setIsProcessing(false);
      onCompleteSetup(securityState, generatedMEK);
    } catch {
      handleSkipCustomPasskey();
    }
  };

  const handleSkipCustomPasskey = () => {
    if (!generatedMEK || !passwordWrapped) return;
    const securityState: VaultSecurityState = {
      id: 'primary_vault_security',
      isInitialized: true,
      salt: passwordWrapped.salt,
      passwordWrappedMEK: passwordWrapped,
      passkeys: [],
      argonConfig: {
        iterations: ARGON2_CONFIG.iterations,
        memorySize: ARGON2_CONFIG.memorySize,
        hashLength: ARGON2_CONFIG.hashLength,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onCompleteSetup(securityState, generatedMEK);
  };

  return (
    <TactileDrawer
      id="encryption-setup-drawer"
      isOpen={isOpen}
      onClose={onClose}
      title={viewMode === 'consumer' ? 'Welcome to Zup' : 'Vault Security'}
      subtitle="Say what’s up. Get zapped."
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div className="p-3 rounded-[14px] bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs font-bold">
            {error}
          </div>
        )}

        {viewMode === 'consumer' && (
          <div className="flex flex-col gap-4">
            {/* Consumer Value Banner */}
            <div className="p-4 rounded-[20px] bg-[#000000] border border-white/20 flex flex-col gap-2.5 shadow-xl">
              <div className="flex items-center gap-2 text-[#EC4899]">
                <Zap size={20} className="fill-[#EC4899]" />
                <span className="text-sm font-black tracking-wide text-white uppercase">
                  Say what’s up. Get zapped.
                </span>
              </div>
              <p className="text-white/80 text-xs font-medium leading-relaxed m-0">
                Experience Nostr with zero friction. No raw hex keys, no seed phrases, and no manual relay configuration. Connect in 1 second with on-device biometrics.
              </p>
              
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="flex items-center gap-2 p-2 rounded-[12px] bg-[#161412] border border-white/10 text-[11px] font-semibold text-white/90">
                  <Fingerprint size={14} className="text-[#EC4899] shrink-0" />
                  <span>Passkey Protected</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-[12px] bg-[#161412] border border-white/10 text-[11px] font-semibold text-white/90">
                  <Radio size={14} className="text-emerald-400 shrink-0" />
                  <span>Auto-Relay Routing</span>
                </div>
              </div>
            </div>

            {/* Primary Action: 1-Tap Passkey Onboarding */}
            <button
              id="onboard-passkey-btn"
              onClick={handleOneTapPasskey}
              disabled={isProcessing}
              className="w-full py-4 px-4 rounded-[18px] bg-gradient-to-r from-[#EC4899] to-[#db2777] hover:opacity-95 text-white font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-3 cursor-pointer shadow-[0_0_20px_#EC489955] active:scale-[0.98]"
            >
              <Fingerprint size={20} />
              <span>{isProcessing ? 'Creating Passkey...' : 'Continue with Passkey / Face ID'}</span>
            </button>

            {/* Secondary Action: Instant Burner / Guest */}
            <button
              id="onboard-guest-btn"
              onClick={handleContinueAsGuest}
              disabled={isProcessing}
              className="w-full py-3 px-4 rounded-[16px] bg-[#161412] border border-white/20 hover:border-white/50 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Flame size={15} className="text-[#F59E0B]" />
              <span>Start as Guest (Instant Burner Session)</span>
            </button>

            {/* Divider */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-white/15"></div>
              <span className="flex-shrink mx-3 text-[10px] font-mono text-white/40 uppercase tracking-widest">
                Advanced / Purists
              </span>
              <div className="flex-grow border-t border-white/15"></div>
            </div>

            {/* Switch to custom Argon2id password */}
            <button
              onClick={() => setViewMode('password')}
              className="w-full py-2.5 rounded-[14px] bg-[#000000] border border-white/15 hover:border-white/40 text-white/70 hover:text-white text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <KeyRound size={14} />
              <span>Set Custom Master Password (Argon2id)</span>
            </button>
          </div>
        )}

        {viewMode === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <div className="p-4 rounded-[18px] bg-[#000000] border border-white/20 flex flex-col gap-2 shadow-md">
              <div className="flex items-center gap-2 text-emerald-400">
                <ShieldCheck size={18} />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Client-Side Master Encryption Key (MEK)
                </span>
              </div>
              <p className="text-white text-xs font-medium leading-relaxed m-0">
                Derive a 256-bit MEK using Argon2id (64MB memory cost) to protect all identities, messages, and relays.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-white text-xs font-extrabold uppercase tracking-wider">
                Master Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter master password (min 8 chars)..."
                  required
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

            <div className="flex flex-col gap-2">
              <label className="text-white text-xs font-extrabold uppercase tracking-wider">
                Confirm Master Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password to verify..."
                required
                className="w-full bg-[#000000] border border-white/20 focus:border-[#10B981] focus:outline-none rounded-[16px] px-4 py-3 text-white text-xs placeholder:text-white/40"
              />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-[12px] bg-[#000000] border border-white/10 text-[10px] font-mono font-bold text-white">
              <span className="flex items-center gap-1">
                <Cpu size={12} className="text-emerald-400" />
                Argon2id (3 iters, 64MB RAM)
              </span>
              <span>AES-256-GCM Double Wrap</span>
            </div>

            <button
              type="submit"
              disabled={isProcessing || !password || !confirmPassword}
              className="w-full py-3 rounded-[16px] bg-[#10B981] hover:bg-[#059669] disabled:opacity-40 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_14px_#10B98144]"
            >
              {isProcessing ? (
                <span>Deriving Key & Encrypting MEK...</span>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setViewMode('consumer')}
              className="text-xs text-white/60 hover:text-white underline text-center cursor-pointer"
            >
              Back to Simple Onboarding
            </button>
          </form>
        )}

        {viewMode === 'passkey_finish' && (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-[18px] bg-[#000000] border border-white/20 flex flex-col gap-2 shadow-md">
              <div className="flex items-center gap-2 text-[#A855F7]">
                <Fingerprint size={18} />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Add Optional Biometric Unlock
                </span>
              </div>
              <p className="text-white text-xs font-medium leading-relaxed m-0">
                You can unlock seamlessly next time with Touch ID, Face ID, or Windows Hello.
              </p>
            </div>

            <button
              type="button"
              onClick={handleFinishCustomPasskey}
              disabled={isProcessing}
              className="w-full py-3.5 rounded-[16px] bg-[#A855F7] hover:bg-[#9333ea] disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_14px_#A855F744]"
            >
              <Fingerprint size={16} />
              <span>{isProcessing ? 'Authenticating with Device...' : 'Register On-Device Passkey'}</span>
            </button>

            <button
              type="button"
              onClick={handleSkipCustomPasskey}
              className="w-full py-2.5 rounded-[16px] bg-[#000000] border border-white/20 hover:border-white/50 text-white text-xs font-bold transition-all cursor-pointer"
            >
              Skip (Password Only)
            </button>
          </div>
        )}
      </div>
    </TactileDrawer>
  );
}
