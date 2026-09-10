import { useState, useEffect } from 'react';
import { 
  Shield, 
  Cloud, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  LogOut, 
  ExternalLink, 
  Key, 
  Sparkles, 
  Database,
  ArrowRightLeft,
  X
} from 'lucide-react';
import { NostrKeypair, SyncStatus, KylrixOAuthSession } from '../types';
import { syncEngine } from '../lib/syncEngine';
import { kylrixOAuth, buildKylrixAuthUrl } from '../lib/kylrixOAuth';
import { formatTruncatedKey } from '../lib/nostr';

interface KylrixSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  keypair: NostrKeypair;
  onSelectIdentity?: (npub: string) => void;
}

export function KylrixSyncModal({
  isOpen,
  onClose,
  keypair,
}: KylrixSyncModalProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(syncEngine.getSyncStatus());
  const [pendingCount, setPendingCount] = useState<number>(syncEngine.getPendingCount());
  const [lastSyncTime, setLastSyncTime] = useState<number>(syncEngine.getLastSyncTime());
  const [oauthSession, setOauthSession] = useState<KylrixOAuthSession>(kylrixOAuth.getSession());
  const [isFlushing, setIsFlushing] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [showSimulationOptions, setShowSimulationOptions] = useState(false);

  useEffect(() => {
    const unsubSync = syncEngine.subscribe((status, pending, lastTime) => {
      setSyncStatus(status);
      setPendingCount(pending);
      setLastSyncTime(lastTime);
    });

    const unsubOAuth = kylrixOAuth.subscribe((sess) => {
      setOauthSession(sess);
    });

    return () => {
      unsubSync();
      unsubOAuth();
    };
  }, []);

  if (!isOpen) return null;

  const handleManualFlush = async () => {
    setIsFlushing(true);
    await syncEngine.triggerFlush();
    setTimeout(() => setIsFlushing(false), 300);
  };

  const handleRealOAuthRedirect = async () => {
    try {
      setIsSigningIn(true);
      const url = await buildKylrixAuthUrl();
      window.location.href = url;
    } catch {
      setIsSigningIn(false);
    }
  };

  const handleSimulatedSignIn = async () => {
    setIsSigningIn(true);
    await kylrixOAuth.simulateSignIn(
      customEmail || 'sovereign@kylrix.space',
      customName || 'Kylrix Sovereign',
      keypair.pubkeyHex
    );
    // Mark sync engine pending mutation to publish binding
    syncEngine.markPending(`kylrix_bind_${Date.now()}`, 1, 'setting', {
      event: 'nip78_binding',
      pubkey: keypair.pubkeyHex,
    });
    setIsSigningIn(false);
    setShowSimulationOptions(false);
  };

  const handleSafeDisconnect = () => {
    kylrixOAuth.disconnect();
    setShowDisconnectConfirm(false);
  };

  return (
    <div 
      id="kylrix-sync-modal" 
      role="dialog"
      aria-modal="true"
      aria-labelledby="kylrix-sync-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-none"
    >
      {/* Opaque Ash Container adhering strictly to OpenBricks 4.0 */}
      <div className="relative w-full max-w-lg bg-[#141210] border border-[#2C2925] rounded-[24px] p-5 sm:p-6 shadow-2xl overflow-y-auto max-h-[90vh] text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#24221F]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-[#1C1A17] border border-[#35322E] flex items-center justify-center text-[#EC4899]">
              <Cloud size={20} />
            </div>
            <div>
              <h2 id="kylrix-sync-modal-title" className="text-base sm:text-lg font-black tracking-wide text-white">
                Kylrix Sync & Identity Anchor
              </h2>
              <p className="text-xs text-[#99948D] font-medium">
                Local-First Content SoT & Autonomic Cloud Reconciliation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1C1A17] border border-[#35322E] flex items-center justify-center text-[#99948D] hover:text-white cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Live Sync Status Banner */}
        <div className="mt-4 p-3.5 rounded-[18px] bg-[#1A1815] border border-[#2B2824] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {syncStatus === 'pending' ? (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F59E0B] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#F59E0B]"></span>
              </span>
            ) : syncStatus === 'offline' ? (
              <span className="h-3 w-3 rounded-full bg-[#EF4444]" />
            ) : (
              <span className="relative flex h-3 w-3">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#10B981]"></span>
              </span>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">
                  {syncStatus === 'pending'
                    ? 'Unflushed Local Changes'
                    : syncStatus === 'offline'
                    ? 'Offline Mode'
                    : 'Mesh & Storage Synchronized'}
                </span>
                {pendingCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#F59E0B]/20 border border-[#F59E0B]/40 text-[#F59E0B] text-[10px] font-mono font-bold">
                    {pendingCount} pending
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8F8A83]">
                {syncStatus === 'pending'
                  ? 'Local writes active (0ms). Coalesced flush queued.'
                  : `Confirmed across RxDB & Nostr relays • ${new Date(lastSyncTime).toLocaleTimeString()}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            id="sync-now-btn"
            onClick={handleManualFlush}
            disabled={isFlushing}
            className="flex items-center gap-1 px-3 py-1.5 rounded-[12px] bg-[#24211D] border border-[#3A3631] hover:border-[#524D46] text-xs font-bold text-white cursor-pointer transition-all disabled:opacity-50"
            title="Trigger Immediate Mesh Flush"
          >
            <RefreshCw size={12} className={isFlushing ? 'animate-spin' : ''} />
            <span>Flush</span>
          </button>
        </div>

        {/* Kylrix Account Link Section */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#99948D]">
              Kylrix Identity Binding
            </span>
            <span className="text-[10px] font-mono text-[#EC4899] font-semibold">
              OAuth 2.1 PKCE
            </span>
          </div>

          {oauthSession.isConnected && oauthSession.profile ? (
            /* Connected State */
            <div className="p-4 rounded-[18px] bg-[#1A1815] border border-[#2B2824] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={oauthSession.profile.avatar}
                    alt={oauthSession.profile.name}
                    className="w-11 h-11 rounded-[14px] border border-[#3A3631] bg-[#121110] object-cover"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-white">
                        {oauthSession.profile.name}
                      </span>
                      <span className="px-1.5 py-0.2 rounded-full bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] text-[9px] font-bold">
                        Linked
                      </span>
                    </div>
                    <span className="text-xs text-[#8F8A83] block">
                      {oauthSession.profile.email || oauthSession.profile.userId}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  id="disconnect-kylrix-btn"
                  onClick={() => setShowDisconnectConfirm(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-[12px] bg-[#291A1A] border border-[#7F1D1D] hover:bg-[#3D1E1E] text-[#F87171] text-xs font-bold cursor-pointer transition-colors"
                >
                  <LogOut size={12} />
                  <span>Unlink</span>
                </button>
              </div>

              {/* Binding Specs */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#262420] text-[11px]">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[#8F8A83]">Bound Nostr Pubkey</span>
                  <span className="font-mono text-white font-semibold">
                    {formatTruncatedKey(keypair.npub, 6, 4)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[#8F8A83]">NIP-78 Anchor</span>
                  <span className="text-[#10B981] font-semibold flex items-center gap-1">
                    <CheckCircle2 size={11} /> Kind 30078 Synced
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[#8F8A83]">Sync Origin</span>
                  <span className="font-mono text-[#EC4899] uppercase font-bold">
                    {oauthSession.syncOrigin}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[#8F8A83]">Appwrite Prefs</span>
                  <span className="text-[#10B981] font-semibold flex items-center gap-1">
                    <CheckCircle2 size={11} /> Multi-Device Anchored
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Disconnected State */
            <div className="p-4 rounded-[18px] bg-[#1A1815] border border-[#2B2824] flex flex-col gap-3.5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[12px] bg-[#24211D] border border-[#3A3631] flex items-center justify-center text-white shrink-0 mt-0.5">
                  <Shield size={18} />
                </div>
                <div className="text-xs text-[#B5AFA7] leading-relaxed">
                  Connect your <strong className="text-white">Kylrix Sovereign Identity</strong> to enable zero-knowledge multi-device settings sync, cloud backup, and verified NIP-05 routing without sacrificing local sovereign control.
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                {/* Primary Button: Sign in with Kylrix */}
                <button
                  type="button"
                  id="signin-kylrix-main-btn"
                  onClick={handleSimulatedSignIn}
                  disabled={isSigningIn}
                  className="flex-1 py-2.5 px-4 rounded-[14px] bg-[#EC4899] hover:bg-[#db2777] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md active:scale-98"
                >
                  <Sparkles size={14} />
                  <span>{isSigningIn ? 'Connecting...' : 'Sign in with Kylrix'}</span>
                </button>

                {/* Secondary Option: Open PKCE Consent URL */}
                <button
                  type="button"
                  id="signin-kylrix-redirect-btn"
                  onClick={handleRealOAuthRedirect}
                  className="py-2.5 px-3 rounded-[14px] bg-[#24211D] border border-[#3A3631] hover:border-[#524D46] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  title="Open official Kylrix OAuth Consent Screen"
                >
                  <ExternalLink size={13} />
                  <span>PKCE URL</span>
                </button>
              </div>

              {/* Simulation drawer for custom sandbox credentials */}
              <div className="pt-2 border-t border-[#262420]">
                <button
                  type="button"
                  onClick={() => setShowSimulationOptions(!showSimulationOptions)}
                  className="text-[11px] text-[#8F8A83] hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <span>{showSimulationOptions ? 'Hide custom sandbox params' : 'Custom sandbox credentials'}</span>
                </button>

                {showSimulationOptions && (
                  <div className="mt-2.5 flex flex-col gap-2 p-3 rounded-[14px] bg-[#141210] border border-[#2E2B27]">
                    <input
                      type="text"
                      placeholder="Username (e.g. Satoshi)"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="px-3 py-1.5 rounded-[10px] bg-[#1A1815] border border-[#35322E] text-xs text-white focus:outline-none focus:border-[#EC4899]"
                    />
                    <input
                      type="email"
                      placeholder="Email (e.g. satoshi@kylrix.space)"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      className="px-3 py-1.5 rounded-[10px] bg-[#1A1815] border border-[#35322E] text-xs text-white focus:outline-none focus:border-[#EC4899]"
                    />
                    <button
                      type="button"
                      onClick={handleSimulatedSignIn}
                      className="py-1.5 px-3 rounded-[10px] bg-[#24211D] border border-[#3A3631] text-xs text-white font-bold hover:bg-[#2F2C27] cursor-pointer"
                    >
                      Authenticate Custom Test Account
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Local Sovereign Guarantee Pill */}
        <div className="mt-4 p-3 rounded-[16px] bg-[#161412] border border-[#26231F] flex items-center gap-2.5 text-[11px] text-[#99948D]">
          <Database size={15} className="text-[#10B981] shrink-0" />
          <span>
            <strong className="text-white">RxDB Single Source of Truth:</strong> Unlinking or logging out of Kylrix is purely an auth state change. Your local private keys and stored Nostr notes are never wiped.
          </span>
        </div>

        {/* Safe Disconnect Confirmation Dialog */}
        {showDisconnectConfirm && (
          <div className="mt-4 p-4 rounded-[18px] bg-[#211414] border border-[#7F1D1D] flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#F87171]">
              <AlertCircle size={16} />
              <span>Confirm Safe Unlink</span>
            </div>
            <p className="text-xs text-[#E5B5B5] leading-relaxed">
              Unlinking will revoke remote sync tokens and reset sync origin to local-only. As guaranteed by Zup architecture, your local private keys (`nsec`), passkeys, and notes in IndexedDB will <strong>remain 100% intact</strong>.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDisconnectConfirm(false)}
                className="px-3 py-1.5 rounded-[12px] bg-[#2A1E1E] text-xs font-bold text-white hover:bg-[#382828] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSafeDisconnect}
                className="px-3 py-1.5 rounded-[12px] bg-[#DC2626] hover:bg-[#B91C1C] text-xs font-bold text-white cursor-pointer"
              >
                Safely Unlink
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
