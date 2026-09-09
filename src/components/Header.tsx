import { 
  Flame, 
  Plus
} from 'lucide-react';
import { NostrKeypair, RelayInfo } from '../types';
import { formatTruncatedKey } from '../lib/nostr';

interface HeaderProps {
  keypair: NostrKeypair;
  relays: RelayInfo[];
  onOpenCompose: () => void;
  onOpenVault: () => void;
  onOpenPro: () => void;
  onToggleEphemeral: () => void;
}

export function Header({
  keypair,
  relays,
  onOpenCompose,
  onOpenVault,
  onOpenPro,
  onToggleEphemeral,
}: HeaderProps) {
  const connectedRelays = relays.filter((r) => r.status === 'connected').length;

  return (
    <header
      id="app-header"
      aria-label="Application Header"
      className="sticky top-0 left-0 right-0 z-30 w-full bg-[#000000]/95 backdrop-blur-xl border-b border-white/20 rounded-b-[20px] sm:rounded-b-[24px] rounded-t-none shadow-[0_8px_30px_rgba(0,0,0,0.85)] transition-all"
    >
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
        {/* Brand: Zup & Connected Relays */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[11px] bg-[#EC4899]/15 border border-[#EC4899]/40 flex items-center justify-center text-[#EC4899] font-black text-sm shadow-[0_0_12px_#EC489933] shrink-0">
              ⚡
            </div>
            <div className="flex flex-col">
              <span className="text-white font-black text-base sm:text-lg tracking-wider uppercase leading-none">
                Zup
              </span>
              <span className="text-[9px] font-mono text-white/50 font-bold uppercase tracking-widest leading-tight hidden xs:inline">
                Mesh Protocol
              </span>
            </div>
          </div>

          {/* Minimalist Live Node Status Pill */}
          <div
            id="header-relay-indicator"
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#161412] border border-white/15 text-[11px] font-mono font-bold text-white/90"
            title={`${connectedRelays} of ${relays.length} Decentralized Relays Connected`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] sm:text-[11px] tracking-wider">
              {connectedRelays}/{relays.length} <span className="hidden sm:inline">NODES</span>
            </span>
          </div>
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

          {/* Active Identity Avatar Pill (Click opens Key Vault) */}
          <button
            id="identity-pill"
            onClick={onOpenVault}
            className="flex items-center gap-2 px-2 sm:px-2.5 py-1 rounded-[14px] bg-[#161412] border border-white/20 hover:border-[#10B981] cursor-pointer transition-all group"
            title="Open Sovereign Key Vault"
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
