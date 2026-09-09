import { useState, type FormEvent } from 'react';
import { 
  ShieldCheck, 
  Fingerprint, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  KeyRound, 
  AlertCircle,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { TactileDrawer } from './TactileDrawer';
import { 
  generateMEK, 
  encryptMEKWithPassword, 
  createPasskeyRecord, 
  ARGON2_CONFIG 
} from '../lib/crypto';
import { VaultSecurityState } from '../types';
import { ZupLogo } from './ZupLogo';

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
  // Single flow steps: 'password' -> 'prompt_biometric'
  const [step, setStep] = useState<'password' | 'prompt_biometric'>('password');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricNotice, setBiometricNotice] = useState<string | null>(null);

  // Intermediate state holding the generated MEK and password wrap
  const [generatedMEK, setGeneratedMEK] = useState<Uint8Array | null>(null);
  const [passwordWrapped, setPasswordWrapped] = useState<{
    cipherText: string;
    iv: string;
    salt: string;
  } | null>(null);

  // 1. Step 1: Create Password -> Set up MEK and wrap with Argon2id + AES-256-GCM
  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Master password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsProcessing(true);
    try {
      // Setup the Master Encryption Key (256-bit random AES key)
      const mek = generateMEK();
      // Encrypt the MEK with Argon2id-derived KEK from user's password
      const wrapped = await encryptMEKWithPassword(mek, password);

      setGeneratedMEK(mek);
      setPasswordWrapped(wrapped);
      setIsProcessing(false);
      // Advance to the optional biometric prompt
      setStep('prompt_biometric');
    } catch (err: unknown) {
      console.error('Failed to setup MEK with password:', err);
      setError('Argon2id derivation failed. Please choose another password.');
      setIsProcessing(false);
    }
  };

  // 2. Step 2 (Option A): User confirms biometric prompt -> trigger device biometric
  const handleConfirmBiometric = async () => {
    if (!generatedMEK || !passwordWrapped) return;

    setIsProcessing(true);
    setError(null);
    setBiometricNotice(null);

    try {
      // Triggers the real device biometric prompt (Touch ID, Face ID, Windows Hello)
      const passkey = await createPasskeyRecord(
        generatedMEK,
        'Device Biometric'
      );

      // Biometric confirmed: used as a second optional MEK wrap so either can unlock the vault
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
    } catch (err: unknown) {
      console.info('Biometric prompt was cancelled or failed:', err);
      setIsProcessing(false);
      // If passkey / biometric fails, we simply use the password to wrap, so user uses password unlock as before
      setBiometricNotice(
        'Biometric authentication was cancelled or not supported on this device. Securing your vault with your master password.'
      );

      setTimeout(() => {
        handleSkipBiometric();
      }, 1200);
    }
  };

  // 2. Step 2 (Option B): User skips biometric -> wrap with password only
  const handleSkipBiometric = () => {
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
      title={step === 'password' ? 'Account Setup' : 'Enable Biometrics'}
      subtitle="Say what’s up. Get zapped."
    >
      <div className="flex flex-col gap-4">
        {/* Brand Header */}
        <div className="p-4 rounded-[20px] bg-[#000000] border border-white/20 flex items-center gap-3 shadow-xl">
          <div className="w-11 h-11 rounded-[14px] bg-[#161412] border border-white/20 flex items-center justify-center shrink-0 p-1 shadow-[0_0_15px_#EC489922]">
            <ZupLogo size={34} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-wide text-white uppercase leading-tight">
              Zup Sovereign Vault
            </span>
            <span className="text-[11px] font-bold text-[#EC4899]">
              Zero-knowledge client-side encryption
            </span>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold uppercase tracking-wider">
          <div
            className={`py-2 px-3 rounded-[12px] border transition-all ${
              step === 'password'
                ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/40 shadow-[0_0_10px_#10B98122]'
                : 'bg-[#161412] text-white/50 border-white/10'
            }`}
          >
            1. Master Password
          </div>
          <div
            className={`py-2 px-3 rounded-[12px] border transition-all ${
              step === 'prompt_biometric'
                ? 'bg-[#A855F7]/15 text-[#A855F7] border-[#A855F7]/40 shadow-[0_0_10px_#A855F722]'
                : 'bg-[#161412] text-white/50 border-white/10'
            }`}
          >
            2. Optional Biometric
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-[14px] bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {biometricNotice && (
          <div className="p-3 rounded-[14px] bg-[#F59E0B]/10 border border-[#F59E0B]/40 text-[#F59E0B] text-xs font-bold flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{biometricNotice}</span>
          </div>
        )}

        {/* STEP 1: CREATE PASSWORD & SETUP MEK */}
        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <div className="p-4 rounded-[18px] bg-[#000000] border border-white/20 flex flex-col gap-2 shadow-md">
              <div className="flex items-center gap-2 text-[#10B981]">
                <ShieldCheck size={18} />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Master Encryption Key (MEK) Setup
                </span>
              </div>
              <p className="text-white/80 text-xs font-medium leading-relaxed m-0">
                Choose a strong master password. We will generate your 256-bit MEK to encrypt your Nostr keys, private messages, and relay settings using Argon2id + AES-256-GCM.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-white text-xs font-extrabold uppercase tracking-wider">
                Create Master Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter master password (min 8 chars)..."
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

            <button
              id="submit-password-btn"
              type="submit"
              disabled={isProcessing || !password || !confirmPassword}
              className="w-full py-3.5 rounded-[16px] bg-[#10B981] hover:bg-[#059669] disabled:opacity-40 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_14px_#10B98144]"
            >
              {isProcessing ? (
                <span>Generating MEK & Encrypting...</span>
              ) : (
                <>
                  <span>Setup MEK & Continue</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: OPTIONAL BIOMETRIC PROMPT */}
        {step === 'prompt_biometric' && (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-[18px] bg-[#000000] border border-white/20 flex flex-col gap-3 shadow-md">
              <div className="flex items-center gap-2.5 text-[#A855F7]">
                <div className="w-9 h-9 rounded-[12px] bg-[#A855F7]/15 border border-[#A855F7]/30 flex items-center justify-center">
                  <Fingerprint size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-white m-0">
                    Enable Biometric Unlock?
                  </h4>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">
                    MEK setup complete with password
                  </span>
                </div>
              </div>
              <p className="text-white/80 text-xs font-medium leading-relaxed m-0">
                You can optionally register on-device biometrics (Touch ID, Face ID, or Windows Hello). If enabled, your MEK will be wrapped with your device biometric credential as well, so either your biometric or your password can unlock the vault.
              </p>
            </div>

            {/* Primary Option: Trigger real device biometric */}
            <button
              id="confirm-biometric-btn"
              type="button"
              onClick={handleConfirmBiometric}
              disabled={isProcessing}
              className="w-full py-4 px-4 rounded-[18px] bg-gradient-to-r from-[#EC4899] to-[#A855F7] hover:opacity-95 text-white font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-3 cursor-pointer shadow-[0_0_20px_#EC489955] active:scale-[0.98]"
            >
              <Fingerprint size={20} />
              <span>{isProcessing ? 'Waiting for Device Biometrics...' : 'Enable Biometric Unlock'}</span>
            </button>

            {/* Secondary Option: Skip, use password only */}
            <button
              id="skip-biometric-btn"
              type="button"
              onClick={handleSkipBiometric}
              disabled={isProcessing}
              className="w-full py-3 rounded-[16px] bg-[#161412] border border-white/20 hover:border-white/50 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock size={14} className="text-white/60" />
              <span>Skip (Password Only)</span>
            </button>
          </div>
        )}
      </div>
    </TactileDrawer>
  );
}
