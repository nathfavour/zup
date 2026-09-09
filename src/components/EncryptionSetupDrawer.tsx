import { useState, FormEvent } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  Fingerprint, 
  Check, 
  ArrowRight, 
  Sparkles, 
  Eye, 
  EyeOff, 
  Shield, 
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
  const [step, setStep] = useState<1 | 2>(1);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passkeyName, setPasskeyName] = useState('Primary Device Passkey');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Intermediate state across steps
  const [generatedMEK, setGeneratedMEK] = useState<Uint8Array | null>(null);
  const [passwordWrapped, setPasswordWrapped] = useState<{
    cipherText: string;
    iv: string;
    salt: string;
  } | null>(null);
  const [registeredPasskeys, setRegisteredPasskeys] = useState<PasskeyRecord[]>([]);

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
      // 1. Generate 256-bit MEK
      const mek = generateMEK();
      setGeneratedMEK(mek);

      // 2. Encrypt MEK with Argon2id derived KEK
      const wrapped = await encryptMEKWithPassword(mek, password);
      setPasswordWrapped(wrapped);

      setIsProcessing(false);
      setStep(2);
    } catch (err: unknown) {
      console.error('Failed to initialize encryption:', err);
      setError('Argon2id derivation failed. Please try a different password.');
      setIsProcessing(false);
    }
  };

  const handleRegisterPasskey = async () => {
    if (!generatedMEK || !passwordWrapped) return;
    setError(null);
    setIsProcessing(true);

    try {
      const passkey = await createPasskeyRecord(
        generatedMEK,
        passkeyName.trim() || 'On-Device Biometric'
      );
      const updatedPasskeys = [...registeredPasskeys, passkey];
      setRegisteredPasskeys(updatedPasskeys);

      const securityState: VaultSecurityState = {
        id: 'primary_vault_security',
        isInitialized: true,
        salt: passwordWrapped.salt,
        passwordWrappedMEK: passwordWrapped,
        passkeys: updatedPasskeys,
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
      console.error('Failed to create passkey:', err);
      setError('Could not complete biometric authentication. You can skip and use password.');
      setIsProcessing(false);
    }
  };

  const handleSkipPasskey = () => {
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
      title={step === 1 ? 'Setup Client Encryption' : 'Add On-Device Passkey'}
      subtitle={
        step === 1
          ? 'Argon2id Memory-Hard Key Derivation (Zero-Knowledge MEK)'
          : 'Dual-Layer Unlock via Touch ID, Face ID, or Windows Hello'
      }
    >
      <div className="flex flex-col gap-4">
        {/* Step Indicator */}
        <div className="flex items-center justify-between p-3 rounded-[16px] bg-[#000000] border border-white/20">
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                step === 1
                  ? 'bg-[#10B981] text-black shadow-[0_0_8px_#10B981]'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}
            >
              1
            </span>
            <span className="text-white text-xs font-bold">Master Password</span>
          </div>

          <div className="h-0.5 w-8 bg-white/20" />

          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                step === 2
                  ? 'bg-[#10B981] text-black shadow-[0_0_8px_#10B981]'
                  : 'bg-white/10 text-white/50'
              }`}
            >
              2
            </span>
            <span className="text-white text-xs font-bold">On-Device Passkey</span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-[14px] bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs font-bold">
            {error}
          </div>
        )}

        {step === 1 ? (
          /* Step 1: Master Password Form */
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <div className="p-4 rounded-[18px] bg-[#000000] border border-white/20 flex flex-col gap-2 shadow-md">
              <div className="flex items-center gap-2 text-emerald-400">
                <ShieldCheck size={18} />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Client-Side Master Encryption Key (MEK)
                </span>
              </div>
              <p className="text-white text-xs font-medium leading-relaxed m-0">
                Your keys never leave your machine unencrypted. We derive a 256-bit MEK using Argon2id (64MB memory cost) to protect all identities, messages, and relays.
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
                  placeholder="Enter strong master password..."
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

            {/* Parameter spec badge */}
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
                  <span>Continue to Passkey Setup</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        ) : (
          /* Step 2: Passkey / Biometric Setup */
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-[18px] bg-[#000000] border border-white/20 flex flex-col gap-2 shadow-md">
              <div className="flex items-center gap-2 text-[#A855F7]">
                <Fingerprint size={18} />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  On-Device Biometric Unlock
                </span>
              </div>
              <p className="text-white text-xs font-medium leading-relaxed m-0">
                Your MEK can also be encrypted with your device authenticator (Touch ID, Face ID, Windows Hello, or Security Key). When launching the app, you will be prompted for passkey first.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-white text-xs font-extrabold uppercase tracking-wider">
                Passkey Label
              </label>
              <input
                type="text"
                value={passkeyName}
                onChange={(e) => setPasskeyName(e.target.value)}
                placeholder="e.g. MacBook Touch ID, iPhone Face ID"
                className="w-full bg-[#000000] border border-white/20 focus:border-[#A855F7] focus:outline-none rounded-[16px] px-4 py-3 text-white text-xs placeholder:text-white/40"
              />
            </div>

            {registeredPasskeys.length > 0 && (
              <div className="p-3 rounded-[16px] bg-[#000000] border border-emerald-500/40 flex items-center gap-2 text-emerald-300 text-xs font-bold">
                <Check size={16} />
                <span>Passkey "{registeredPasskeys[0].name}" successfully configured!</span>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleRegisterPasskey}
                disabled={isProcessing}
                className="w-full py-3.5 rounded-[16px] bg-[#A855F7] hover:bg-[#9333ea] disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_14px_#A855F744]"
              >
                <Fingerprint size={16} />
                <span>{isProcessing ? 'Authenticating with Device...' : 'Register On-Device Passkey'}</span>
              </button>

              <button
                type="button"
                onClick={handleSkipPasskey}
                disabled={isProcessing}
                className="w-full py-2.5 rounded-[16px] bg-[#000000] border border-white/20 hover:border-white/50 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Skip for Now (Password Only)
              </button>
            </div>
          </div>
        )}
      </div>
    </TactileDrawer>
  );
}
