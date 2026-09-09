import { useState, useEffect } from 'react';
import { 
  Flame, 
  Plus,
  Cloud
} from 'lucide-react';
import { NostrKeypair, RelayInfo, SyncStatus, KylrixOAuthSession } from '../types';
import { formatTruncatedKey } from '../lib/nostr';
import { ZupLogo } from './ZupLogo';
import { syncEngine } from '../lib/syncEngine';
import { kylrixOAuth } from '../lib/kylrixOAuth';

interface HeaderProps {
  keypair: NostrKeypair;
  relays: RelayInfo[];
  onOpenCompose: () => void;
  onOpenProfile: () => void;
  onOpenPro: () => void;
  onToggleEphemeral: () => void;
  onOpenSync?: () => void;
}

export function Header({
  keypair,
  relays,
  onOpenCompose,
  onOpenProfile,
  onOpenPro,
  onToggleEphemeral,
  onOpenSync,
}: HeaderProps) {
  const connectedRelays = relays.filter((r) => r.status === 'connected').length;
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(syncEngine.getSyncStatus());
  const [pendingCount, setPendingCount] = useState<number>(syncEngine.getPendingCount());
  const [oauthSession, setOauthSession] = useState<KylrixOAuthSession>(kylrixOAuth.getSession());

  useEffect(() => {
    const unsubSync = syncEngine.subscribe((status, pending) => {
      setSyncStatus(status);
      setPendingCount(pending);
    });
    const unsubOAuth = kylrixOAuth.subscribe((sess) => {
      setOauthSession(sess);
    });
    return () => {
      unsubSync();
      unsubOAuth();
    };
  }, []);

  return (
    <header
      id="app-header"
      aria-label="Application Header"
      className="sticky top-0 left-0 right-0 z-30 w-full bg-[#121110] border-b border-[#282522] rounded-b-[20px] sm:rounded-b-[24px] rounded-t-none shadow-[0_8px_30px_rgba(0,0,0,0.85)] transition-all"
    >
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
        {/* Brand: Zup & Connected Relays */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[13px] bg-[#1A1816] border border-[#35322E] flex items-center justify-center shadow-sm shrink-0 p-1">
              <ZupLogo size={28} />
            </div>
            <div className="flex flex-col">
              <span className="text-white font-black text-base sm:text-lg tracking-wider uppercase leading-none">
                Zup
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#EC4899] tracking-normal leading-tight hidden xs:inline">
                Say what’s up. Get zapped.
              </span>
            </div>
          </div>

          {/* Minimalist Live Node Status Pill */}
          <div
            id="header-relay-indicator"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1A1816] border border-[#2E2B27] text-[11px] font-mono font-bold text-white/90 shadow-inner"
            title={`Smart Auto-Routing: Connected across ${connectedRelays} decentralized relays`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] sm:text-[11px] tracking-tight">
              <span className="hidden sm:inline text-white/70">Mesh: </span>
              {connectedRelays}/{relays.length} <span className="hidden xs:inline">Nodes</span>
            </span>
          </div>

          {/* Autonomic Sync & Kylrix Cloud Anchor Status Pill */}
          <button
            type="button"
            id="header-sync-status-btn"
            onClick={onOpenSync}
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full bg-[#1A1816] border border-[#2E2B27] hover:border-[#4A453F] cursor-pointer transition-all group"
            title={
              syncStatus === 'pending'
                ? 'Unflushed local changes pending network confirmation'
                : 'All local revisions confirmed by mesh & cloud anchor'
            }
          >
            {syncStatus === 'pending' ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F59E0B] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F59E0B]"></span>
              </span>
            ) : syncStatus === 'offline' ? (
              <span className="h-2 w-2 rounded-full bg-[#EF4444]" />
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]"></span>
            )}
            <span className="text-[10px] sm:text-[11px] font-mono font-bold text-white/80 group-hover:text-white flex items-center gap-1">
              <Cloud size={11} className={oauthSession.isConnected ? 'text-[#EC4899]' : 'text-white/60'} />
              <span className="hidden md:inline">
                {oauthSession.isConnected ? 'Kylrix Synced' : 'Local-First'}
              </span>
              {pendingCount > 0 && (
                <span className="text-[#F59E0B] font-extrabold">({pendingCount})</span>
              )}
            </span>
          </button>
        </div>

        {/* Right Action Tools: Focused, Uncluttered & Tactile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Ephemeral Burner Mode Pill */}
          {keypair.isEphemeral ? (
            <button
              id="toggle-ephemeral-btn"
              onClick={onToggleEphemeral}
              className="flex items-center gap-1 px-2.5 py-1 rounded-[12px] text-xs font-bold transition-all bg-[#F59E0B]/20 border border-[#F59E0B] text-white shadow-[0_0_10px_#F59E0B44] cursor-pointer"
              title="Ephemeral Burner Mode Active"
            >
              <Flame size={13} className="text-[#F59E0B]" />
              <span className="text-[10px] font-black uppercase tracking-wider">Burner</span>
            </button>
          ) : (
            <button
              id="toggle-ephemeral-btn"
              onClick={onToggleEphemeral}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-[12px] text-xs font-bold transition-all bg-[#161412] border border-white/15 hover:border-white/40 text-white/80 hover:text-white cursor-pointer"
              title="Switch to Disposable Burner Session"
            >
              <Flame size={13} className="text-white/60" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Burner</span>
            </button>
          )}

          {/* Active Identity Avatar Pill (Click opens Profile) */}
          <button
            id="identity-pill"
            onClick={onOpenProfile}
            className="flex items-center gap-2 px-2 sm:px-2.5 py-1 rounded-[14px] bg-[#161412] border border-white/20 hover:border-[#10B981] cursor-pointer transition-all group"
            title="Open Sovereign Profile"
          >
            <img
              src={keypair.avatar}
              alt={keypair.name}
              className="w-5 h-5 rounded-full border border-white/30 bg-black object-cover shrink-0"
            />
            <span className="text-white font-bold text-xs truncate max-w-[80px] sm:max-w-[120px]">
              {keypair.name || formatTruncatedKey(keypair.npub, 6, 4)}
            </span>
          </button>

          {/* Quick Compose Note Button */}
          <button
            id="header-compose-btn"
            onClick={onOpenCompose}
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-[14px] bg-[#EC4899] hover:bg-[#db2777] text-white text-xs font-black uppercase tracking-wider transition-all shadow-[0_0_12px_#EC489955] active:scale-95 cursor-pointer"
            title="Publish Note to Relays"
          >
            <Plus size={14} strokeWidth={3} />
            <span>POST</span>
          </button>
        </div>
      </div>
    </header>
  );
}
