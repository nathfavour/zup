import { useState, type FormEvent } from 'react';
import {
  Lock,
  Unlock,
  KeyRound,
  Fingerprint,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  ShieldCheck,
  Cpu,
  RefreshCw,
  Edit2,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { VaultSecurityState, PasskeyRecord } from '../types';
import {
  decryptMEKWithPassword,
  encryptMEKWithPassword,
  createPasskeyRecord,
  testPasskeyAssertion,
} from '../lib/crypto';

interface VaultCredentialsManagerProps {
  vaultSecurity: VaultSecurityState | null;
  mek: Uint8Array | null;
  isLocked: boolean;
  onLockVault: () => void;
  onOpenUnlock: () => void;
  onOpenSetupEncryption: () => void;
  onUpdateVaultSecurity: (updated: VaultSecurityState) => void;
  onUnlocked?: (mek: Uint8Array) => void;
}

type AuthenticatorTypeOption = 'any' | 'platform' | 'cross-platform' | 'virtual';

export function VaultCredentialsManager({
  vaultSecurity,
  mek,
  isLocked,
  onLockVault,
  onOpenUnlock,
  onOpenSetupEncryption,
  onUpdateVaultSecurity,
  onUnlocked,
}: VaultCredentialsManagerProps) {
  // Password change state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Passkey enrollment state
  const [showAddPasskey, setShowAddPasskey] = useState(false);
  const [passkeyName, setPasskeyName] = useState('');
  const [authenticatorType, setAuthenticatorType] = useState<AuthenticatorTypeOption>('any');
  const [passkeyUnlockPassword, setPasskeyUnlockPassword] = useState('');
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeySuccess, setPasskeySuccess] = useState<string | null>(null);

  // Passkey testing state: { [passkeyId]: { status: 'testing' | 'success' | 'error', message?: string } }
  const [testStatusMap, setTestStatusMap] = useState<
    Record<string, { status: 'testing' | 'success' | 'error'; message?: string }>
  >({});

  // Passkey rename state
  const [editingPasskeyId, setEditingPasskeyId] = useState<string | null>(null);
  const [editingPasskeyName, setEditingPasskeyName] = useState('');

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: 'Empty', color: 'bg-stone-700' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (pass.length >= 12) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;

    if (score <= 1) return { score: 1, label: 'Too Weak', color: 'bg-rose-500' };
    if (score === 2) return { score: 2, label: 'Fair', color: 'bg-amber-500' };
    if (score === 3) return { score: 3, label: 'Good', color: 'bg-blue-500' };
    if (score === 4) return { score: 4, label: 'Strong', color: 'bg-emerald-500' };
    return { score: 5, label: 'Military-Grade (Argon2id)', color: 'bg-emerald-400' };
  };

  const strength = getPasswordStrength(newPassword);

  // Quick preset buttons for passkey names
  const passkeyPresets = [
    { label: 'Touch ID / Face ID', type: 'platform' as const },
    { label: 'YubiKey 5C', type: 'cross-platform' as const },
    { label: 'Windows Hello', type: 'platform' as const },
    { label: 'Google Titan', type: 'cross-platform' as const },
    { label: 'Virtual Hardware Key', type: 'virtual' as const },
  ];

  // 1. Password Update Handler
  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!vaultSecurity) return;
    if (newPassword.length < 8) {
      setPasswordError('New master password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New master passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      let activeMEK = mek;

      // If MEK is not in memory (vault is locked), decrypt first using current password
      if (!activeMEK) {
        if (!currentPassword) {
          throw new Error('Current master password is required to authorize change.');
        }
        const decrypted = await decryptMEKWithPassword(
          vaultSecurity.passwordWrappedMEK,
          currentPassword
        );
        activeMEK = decrypted.mek;
        if (onUnlocked) {
          onUnlocked(activeMEK);
        }
      }

      if (!activeMEK) {
        throw new Error('Could not unlock MEK. Please verify your current password.');
      }

      // Re-wrap Master Key with new password using Argon2id
      const newWrapped = await encryptMEKWithPassword(activeMEK, newPassword);

      const updatedSecurity: VaultSecurityState = {
        ...vaultSecurity,
        salt: newWrapped.salt,
        passwordWrappedMEK: newWrapped,
        updatedAt: Date.now(),
      };

      onUpdateVaultSecurity(updatedSecurity);
      setIsChangingPassword(false);
      setPasswordSuccess('Master Password updated successfully with Argon2id 64MB re-derivation.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');

      setTimeout(() => {
        setPasswordSuccess(null);
        setShowPasswordSection(false);
      }, 2500);
    } catch (err: unknown) {
      console.error('Password change failed:', err);
      setPasswordError(
        err instanceof Error
          ? err.message
          : 'Incorrect current password or key derivation failed.'
      );
      setIsChangingPassword(false);
    }
  };

  // 2. Passkey Enrollment Handler
  const handleAddPasskey = async (e: FormEvent) => {
    e.preventDefault();
    setPasskeyError(null);
    setPasskeySuccess(null);

    if (!vaultSecurity) return;

    let activeMEK = mek;

    // If vault is locked, check if the user provided password in the inline unlock field
    if (!activeMEK) {
      if (!passkeyUnlockPassword) {
        setPasskeyError(
          'Vault is locked. Enter your master password below to authorize enrolling a new passkey.'
        );
        return;
      }

      try {
        const decrypted = await decryptMEKWithPassword(
          vaultSecurity.passwordWrappedMEK,
          passkeyUnlockPassword
        );
        activeMEK = decrypted.mek;
        if (onUnlocked) {
          onUnlocked(activeMEK);
        }
      } catch {
        setPasskeyError('Incorrect master password. Could not authorize passkey enrollment.');
        return;
      }
    }

    if (!activeMEK) {
      setPasskeyError('Vault is locked. Please unlock the vault first.');
      return;
    }

    setIsRegisteringPasskey(true);
    try {
      const name =
        passkeyName.trim() || `Passkey ${vaultSecurity.passkeys.length + 1}`;
      const newRecord = await createPasskeyRecord(activeMEK, name, authenticatorType);

      const updatedSecurity: VaultSecurityState = {
        ...vaultSecurity,
        passkeys: [...vaultSecurity.passkeys, newRecord],
        updatedAt: Date.now(),
      };

      onUpdateVaultSecurity(updatedSecurity);
      setIsRegisteringPasskey(false);
      setPasskeySuccess(`Passkey "${name}" enrolled successfully!`);
      setPasskeyName('');
      setPasskeyUnlockPassword('');

      setTimeout(() => {
        setPasskeySuccess(null);
        setShowAddPasskey(false);
      }, 2500);
    } catch (err: unknown) {
      console.error('Passkey enrollment failed:', err);
      setPasskeyError(
        err instanceof Error
          ? err.message
          : 'Biometric or security key assertion failed or was cancelled.'
      );
      setIsRegisteringPasskey(false);
    }
  };

  // 3. Test Passkey Assertion
  const handleTestPasskey = async (pk: PasskeyRecord) => {
    setTestStatusMap((prev) => ({
      ...prev,
      [pk.id]: { status: 'testing' },
    }));

    try {
      const result = await testPasskeyAssertion(pk, mek);
      setTestStatusMap((prev) => ({
        ...prev,
        [pk.id]: {
          status: 'success',
          message: `Verified in ${result.latencyMs}ms`,
        },
      }));

      // Update lastUsed timestamp in RxDB
      if (vaultSecurity) {
        const updatedPasskeys = vaultSecurity.passkeys.map((p) =>
          p.id === pk.id ? { ...p, lastUsed: Date.now() } : p
        );
        onUpdateVaultSecurity({
          ...vaultSecurity,
          passkeys: updatedPasskeys,
          updatedAt: Date.now(),
        });
      }

      setTimeout(() => {
        setTestStatusMap((prev) => {
          const next = { ...prev };
          delete next[pk.id];
          return next;
        });
      }, 3500);
    } catch (err: unknown) {
      console.error('Passkey test assertion error:', err);
      setTestStatusMap((prev) => ({
        ...prev,
        [pk.id]: {
          status: 'error',
          message: err instanceof Error ? err.message : 'Assertion failed',
        },
      }));

      setTimeout(() => {
        setTestStatusMap((prev) => {
          const next = { ...prev };
          delete next[pk.id];
          return next;
        });
      }, 4000);
    }
  };

  // 4. Rename Passkey Handler
  const handleSavePasskeyRename = (passkeyId: string) => {
    if (!vaultSecurity || !editingPasskeyName.trim()) return;

    const updatedPasskeys = vaultSecurity.passkeys.map((p) =>
      p.id === passkeyId ? { ...p, name: editingPasskeyName.trim() } : p
    );

    onUpdateVaultSecurity({
      ...vaultSecurity,
      passkeys: updatedPasskeys,
      updatedAt: Date.now(),
    });

    setEditingPasskeyId(null);
    setEditingPasskeyName('');
  };

  // 5. Delete Passkey Handler
  const handleDeletePasskey = (passkeyId: string, name: string) => {
    if (!vaultSecurity) return;
    if (confirm(`Remove passkey "${name}"? You will still be able to unlock using your master password or other keys.`)) {
      const updatedPasskeys = vaultSecurity.passkeys.filter((p) => p.id !== passkeyId);
      onUpdateVaultSecurity({
        ...vaultSecurity,
        passkeys: updatedPasskeys,
        updatedAt: Date.now(),
      });
    }
  };

  // Unconfigured Vault State
  if (!vaultSecurity?.isInitialized) {
    return (
      <div className="bg-[#161514] border border-[#2A2724] rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
            <Lock size={19} />
          </div>
          <div>
            <h4 className="text-white text-sm font-bold m-0">No Encryption Vault Configured</h4>
            <p className="text-stone-400 text-xs m-0 mt-0.5">
              Set up a master password and register one or more passkeys to encrypt your sovereign keys.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenSetupEncryption}
          className="px-4 py-2 rounded-xl bg-[#10B981] hover:bg-[#059669] text-black text-xs font-bold transition-all cursor-pointer shadow-[0_0_10px_#10B98133] shrink-0"
        >
          Setup Vault Now
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Overview Card: Lock Status, Master Password & Passkey Count */}
      <div className="bg-[#161514] border border-[#2A2724] rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white text-sm font-bold m-0">
                  Vault Security Credentials
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Argon2id (64MB)
                </span>
              </div>
              <p className="text-stone-400 text-xs m-0 mt-0.5">
                Master password + {vaultSecurity.passkeys.length} registered passkey{vaultSecurity.passkeys.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            {isLocked ? (
              <button
                type="button"
                onClick={onOpenUnlock}
                className="px-3.5 py-1.5 rounded-xl bg-[#EC4899] hover:bg-[#db2777] text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <Unlock size={14} />
                <span>Unlock Vault</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onLockVault}
                className="px-3.5 py-1.5 rounded-xl bg-[#221F1C] hover:bg-[#2C2925] border border-[#35322D] text-stone-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Lock size={14} className="text-emerald-400" />
                <span>Lock Vault</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons Row: Change Master Password & Add Passkey */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#262421]">
          <button
            type="button"
            onClick={() => {
              setShowPasswordSection(!showPasswordSection);
              setPasswordError(null);
              setPasswordSuccess(null);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
              showPasswordSection
                ? 'bg-[#2A2724] border-[#EC4899] text-white'
                : 'bg-[#1D1B19] border-[#2E2B27] text-stone-300 hover:text-white hover:border-[#3D3A35]'
            }`}
          >
            <KeyRound size={14} className="text-[#EC4899]" />
            <span>Update Master Password</span>
            {showPasswordSection ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowAddPasskey(!showAddPasskey);
              setPasskeyError(null);
              setPasskeySuccess(null);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
              showAddPasskey
                ? 'bg-[#2A2724] border-emerald-400 text-white'
                : 'bg-[#1D1B19] border-[#2E2B27] text-stone-300 hover:text-white hover:border-[#3D3A35]'
            }`}
          >
            <Plus size={14} className="text-emerald-400" />
            <span>Add Passkey ({vaultSecurity.passkeys.length})</span>
            {showAddPasskey ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* Inset Form 1: Update Master Password */}
        {showPasswordSection && (
          <form
            onSubmit={handleChangePassword}
            className="p-4 rounded-xl bg-[#1A1816] border border-[#2F2C28] flex flex-col gap-3.5 animate-fadeIn"
          >
            <div className="flex items-center justify-between">
              <span className="text-white text-xs font-bold flex items-center gap-1.5">
                <KeyRound size={15} className="text-[#EC4899]" />
                Update Master Password
              </span>
              <span className="text-stone-400 text-[11px] font-mono">
                Argon2id KEK Re-derivation
              </span>
            </div>

            {/* If Vault is locked, prompt for current password */}
            {!mek && (
              <div className="flex flex-col gap-1">
                <label className="text-stone-300 text-xs font-medium">
                  Current Master Password <span className="text-rose-400">*</span>
                </label>
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current master password..."
                  required
                  className="w-full bg-[#121110] border border-[#35322D] focus:border-[#EC4899] focus:outline-none rounded-xl px-3.5 py-2 text-white text-xs"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-stone-300 text-xs font-medium">
                  New Master Password <span className="text-rose-400">*</span>
                </label>
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters..."
                  required
                  className="w-full bg-[#121110] border border-[#35322D] focus:border-[#EC4899] focus:outline-none rounded-xl px-3.5 py-2 text-white text-xs"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-stone-300 text-xs font-medium">
                  Confirm New Password <span className="text-rose-400">*</span>
                </label>
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new password..."
                  required
                  className="w-full bg-[#121110] border border-[#35322D] focus:border-[#EC4899] focus:outline-none rounded-xl px-3.5 py-2 text-white text-xs"
                />
              </div>
            </div>

            {/* Password Strength Indicator */}
            {newPassword && (
              <div className="flex flex-col gap-1.5 pt-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-stone-400">Security Strength:</span>
                  <span className="font-semibold text-white">{strength.label}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#262421] overflow-hidden flex gap-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`h-full flex-1 transition-all rounded-full ${
                        strength.score >= level ? strength.color : 'bg-transparent'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setShowPasswordText(!showPasswordText)}
                className="text-xs text-stone-400 hover:text-stone-200 flex items-center gap-1.5 cursor-pointer"
              >
                {showPasswordText ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>{showPasswordText ? 'Hide password' : 'Show password'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordSection(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#24221F] border border-[#35322D] text-stone-300 text-xs font-semibold cursor-pointer hover:bg-[#2F2C28]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword || !newPassword || !confirmNewPassword}
                  className="px-4 py-1.5 rounded-xl bg-[#EC4899] hover:bg-[#db2777] text-white text-xs font-bold cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isChangingPassword ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Re-deriving Argon2id...</span>
                    </>
                  ) : (
                    <span>Save New Password</span>
                  )}
                </button>
              </div>
            </div>

            {passwordError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 size={15} className="shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}
          </form>
        )}

        {/* Inset Form 2: Add Device Passkey */}
        {showAddPasskey && (
          <form
            onSubmit={handleAddPasskey}
            className="p-4 rounded-xl bg-[#1A1816] border border-[#2F2C28] flex flex-col gap-3.5 animate-fadeIn"
          >
            <div className="flex items-center justify-between">
              <span className="text-white text-xs font-bold flex items-center gap-1.5">
                <Fingerprint size={15} className="text-emerald-400" />
                Enroll New Hardware Passkey / Biometric
              </span>
              <span className="text-stone-400 text-[11px] font-mono">
                FIDO2 / WebAuthn / Enclave
              </span>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-col gap-1.5">
              <label className="text-stone-400 text-[11px] font-medium">
                Quick Device Presets:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {passkeyPresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setPasskeyName(preset.label);
                      setAuthenticatorType(preset.type);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#24221F] hover:bg-[#302D29] border border-[#35322D] text-[11px] text-stone-300 hover:text-white cursor-pointer transition-colors"
                  >
                    + {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Passkey Label Input */}
            <div className="flex flex-col gap-1">
              <label className="text-stone-300 text-xs font-medium">
                Device / Passkey Name
              </label>
              <input
                type="text"
                value={passkeyName}
                onChange={(e) => setPasskeyName(e.target.value)}
                placeholder="e.g. MacBook Touch ID, YubiKey 5C, iPhone Face ID"
                required
                className="w-full bg-[#121110] border border-[#35322D] focus:border-emerald-400 focus:outline-none rounded-xl px-3.5 py-2 text-white text-xs"
              />
            </div>

            {/* Authenticator Attachment Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-stone-300 text-xs font-medium">
                Authenticator Attachment:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setAuthenticatorType('any')}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    authenticatorType === 'any'
                      ? 'bg-emerald-500/10 border-emerald-500 text-white'
                      : 'bg-[#121110] border-[#302D29] text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                    <Sparkles size={13} className="text-emerald-400" />
                    <span>Auto Picker</span>
                  </div>
                  <p className="text-[10px] text-stone-400 m-0 mt-0.5">
                    Browser detects platform or USB key
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAuthenticatorType('platform')}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    authenticatorType === 'platform'
                      ? 'bg-emerald-500/10 border-emerald-500 text-white'
                      : 'bg-[#121110] border-[#302D29] text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                    <Fingerprint size={13} className="text-emerald-400" />
                    <span>Biometric Only</span>
                  </div>
                  <p className="text-[10px] text-stone-400 m-0 mt-0.5">
                    Touch ID, Face ID, Hello PIN
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAuthenticatorType('cross-platform')}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    authenticatorType === 'cross-platform'
                      ? 'bg-emerald-500/10 border-emerald-500 text-white'
                      : 'bg-[#121110] border-[#302D29] text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                    <Shield size={13} className="text-emerald-400" />
                    <span>Hardware FIDO2</span>
                  </div>
                  <p className="text-[10px] text-stone-400 m-0 mt-0.5">
                    YubiKey, USB dongle, Phone QR
                  </p>
                </button>
              </div>
            </div>

            {/* If Vault is locked, inline authorization field */}
            {!mek && (
              <div className="p-3 rounded-xl bg-[#221F1C] border border-[#35322D] flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
                  <Lock size={13} />
                  <span>Vault is Locked: Authorization Required</span>
                </div>
                <p className="text-stone-400 text-[11px] m-0">
                  Enter master password to authorize registering this new passkey:
                </p>
                <input
                  type="password"
                  value={passkeyUnlockPassword}
                  onChange={(e) => setPasskeyUnlockPassword(e.target.value)}
                  placeholder="Master password..."
                  className="w-full bg-[#121110] border border-[#35322D] focus:border-emerald-400 focus:outline-none rounded-lg px-3 py-1.5 text-white text-xs"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddPasskey(false)}
                className="px-3.5 py-1.5 rounded-xl bg-[#24221F] border border-[#35322D] text-stone-300 text-xs font-semibold cursor-pointer hover:bg-[#2F2C28]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isRegisteringPasskey || !passkeyName.trim()}
                className="px-4 py-1.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-black text-xs font-bold cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isRegisteringPasskey ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Prompting Authenticator...</span>
                  </>
                ) : (
                  <>
                    <Fingerprint size={13} />
                    <span>Authorize & Enroll</span>
                  </>
                )}
              </button>
            </div>

            {passkeyError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{passkeyError}</span>
              </div>
            )}

            {passkeySuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 size={15} className="shrink-0" />
                <span>{passkeySuccess}</span>
              </div>
            )}
          </form>
        )}

        {/* Passkeys List Section */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
              <Fingerprint size={15} className="text-[#EC4899]" />
              <span>Registered Passkeys & Authenticators</span>
            </span>
            <span className="text-[11px] font-mono text-stone-400">
              {vaultSecurity.passkeys.length} active credential{vaultSecurity.passkeys.length === 1 ? '' : 's'}
            </span>
          </div>

          {vaultSecurity.passkeys.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#1D1B19] border border-[#2D2A26] text-center">
              <p className="text-stone-400 text-xs m-0">
                No passkeys enrolled yet. Add Touch ID, Face ID, or a FIDO2 hardware key to unlock your vault in 1 click without typing your password.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {vaultSecurity.passkeys.map((pk) => {
                const testState = testStatusMap[pk.id];

                return (
                  <div
                    key={pk.id}
                    className="p-3.5 rounded-xl bg-[#1D1B19] border border-[#2D2A26] hover:border-[#3D3A35] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#EC4899]/10 text-[#EC4899] border border-[#EC4899]/25 flex items-center justify-center shrink-0">
                        {pk.type === 'cross-platform' ? (
                          <Shield size={16} />
                        ) : pk.type === 'virtual' ? (
                          <Cpu size={16} />
                        ) : (
                          <Fingerprint size={16} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        {editingPasskeyId === pk.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingPasskeyName}
                              onChange={(e) => setEditingPasskeyName(e.target.value)}
                              className="bg-[#121110] border border-[#35322D] focus:border-emerald-400 text-white text-xs px-2 py-1 rounded-lg"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSavePasskeyRename(pk.id)}
                              className="text-emerald-400 hover:text-emerald-300 p-1 cursor-pointer"
                              title="Save"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPasskeyId(null)}
                              className="text-stone-400 hover:text-stone-200 p-1 cursor-pointer"
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h4 className="text-white font-semibold text-xs m-0 truncate">
                              {pk.name}
                            </h4>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPasskeyId(pk.id);
                                setEditingPasskeyName(pk.name);
                              }}
                              className="text-stone-500 hover:text-stone-300 p-0.5 cursor-pointer"
                              title="Rename passkey"
                            >
                              <Edit2 size={12} />
                            </button>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-[11px] font-mono text-stone-400 mt-0.5">
                          <span className="capitalize">
                            {pk.type === 'cross-platform'
                              ? 'Hardware Key (FIDO2)'
                              : pk.type === 'virtual'
                              ? 'Virtual Enclave'
                              : 'Biometric Platform'}
                          </span>
                          <span>•</span>
                          <span>Enrolled {new Date(pk.createdAt).toLocaleDateString()}</span>
                          {pk.lastUsed && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-400/80">
                                Verified {new Date(pk.lastUsed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Test Key & Delete Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {testState?.status === 'testing' && (
                        <span className="text-xs text-amber-400 flex items-center gap-1 font-medium">
                          <RefreshCw size={13} className="animate-spin" />
                          Testing...
                        </span>
                      )}

                      {testState?.status === 'success' && (
                        <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                          <Check size={13} />
                          {testState.message}
                        </span>
                      )}

                      {testState?.status === 'error' && (
                        <span className="text-xs text-rose-400 flex items-center gap-1 font-medium">
                          <AlertCircle size={13} />
                          Failed
                        </span>
                      )}

                      {!testState && (
                        <button
                          type="button"
                          onClick={() => handleTestPasskey(pk)}
                          className="px-2.5 py-1 rounded-lg bg-[#25221F] hover:bg-[#302C28] border border-[#35322D] text-stone-300 hover:text-white text-[11px] font-medium cursor-pointer transition-colors"
                          title="Test cryptographic assertion"
                        >
                          Test Key
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeletePasskey(pk.id, pk.name)}
                        className="text-stone-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 cursor-pointer transition-colors"
                        title="Remove Passkey"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
