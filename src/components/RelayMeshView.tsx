import { useState, type FormEvent } from 'react';
import { 
  Radio, 
  Plus, 
  ChevronRight, 
  Activity, 
  ShieldCheck, 
  ArrowUpRight, 
  RefreshCw, 
  Trash2, 
  Check, 
  Sparkles,
  Wifi
} from 'lucide-react';
import { RelayInfo } from '../types';

interface RelayMeshViewProps {
  relays: RelayInfo[];
  onAddRelay: (url: string, read: boolean, write: boolean) => void;
  onToggleRelayPermission: (url: string, field: 'read' | 'write') => void;
  onRemoveRelay: (url: string) => void;
  onTestPing: (url: string) => void;
  onOpenPro: () => void;
}

export function RelayMeshView({
  relays,
  onAddRelay,
  onToggleRelayPermission,
  onRemoveRelay,
  onTestPing,
  onOpenPro,
}: RelayMeshViewProps) {
  const [newUrl, setNewUrl] = useState('');
  const [allowRead, setAllowRead] = useState(true);
  const [allowWrite, setAllowWrite] = useState(true);
  const [pingingUrl, setPingingUrl] = useState<string | null>(null);

  const handleAddSubmit = (e: FormEvent) => {
    e.preventDefault();
    let url = newUrl.trim();
    if (!url) return;
    if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      url = `wss://${url}`;
    }
    onAddRelay(url, allowRead, allowWrite);
    setNewUrl('');
  };

  const handlePing = (url: string) => {
    setPingingUrl(url);
    onTestPing(url);
    setTimeout(() => setPingingUrl(null), 800);
  };

  return (
    <div className="flex flex-col gap-5 pb-16 md:pb-6">
      {/* Overview Stats Bar */}
      <div className="p-5 rounded-[22px] bg-[#000000] border border-white/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[16px] bg-[#A855F7]/15 border border-[#A855F7]/40 flex items-center justify-center text-[#A855F7] shadow-[0_0_12px_#A855F733]">
            <Radio size={22} />
          </div>
          <div>
            <h3 className="text-white font-black text-base uppercase tracking-wider m-0">
              Decentralized Relay Mesh
            </h3>
            <p className="text-white text-xs font-bold mt-0.5 m-0">
              Censorship-resistant distributed WebSocket event broadcast
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="px-3 py-1.5 rounded-[14px] bg-[#161412] border border-white/20 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white font-mono text-xs font-extrabold">
              {relays.filter((r) => r.status === 'connected').length} Active
            </span>
          </div>

          <button
            onClick={onOpenPro}
            className="px-3 py-1.5 rounded-[14px] bg-[#161412] border border-[#A855F7]/40 hover:border-[#A855F7] text-[#A855F7] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Sparkles size={12} />
            <span>Onion Relays</span>
          </button>
        </div>
      </div>

      {/* Add Custom Relay Inline Surface */}
      <form
        onSubmit={handleAddSubmit}
        className="p-4 rounded-[22px] bg-[#000000] border border-white/20 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shadow-lg"
      >
        <div className="relative flex-1">
          <Wifi size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white" />
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="wss://relay.example.com"
            className="w-full bg-[#161412] border border-white/20 focus:border-[#A855F7] focus:outline-none rounded-[16px] pl-9 pr-3 py-2.5 text-white font-mono text-xs placeholder:text-white/40 transition-colors"
          />
        </div>

        <div className="flex items-center justify-between sm:justify-start gap-3">
          <label className="flex items-center gap-1.5 text-white text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={allowRead}
              onChange={(e) => setAllowRead(e.target.checked)}
              className="accent-[#A855F7] rounded"
            />
            <span>Read</span>
          </label>

          <label className="flex items-center gap-1.5 text-white text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={allowWrite}
              onChange={(e) => setAllowWrite(e.target.checked)}
              className="accent-[#A855F7] rounded"
            />
            <span>Write</span>
          </label>

          <button
            type="submit"
            disabled={!newUrl.trim()}
            className="px-4 py-2.5 min-h-[40px] rounded-[16px] bg-[#A855F7] hover:bg-[#9333ea] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_10px_#A855F733]"
          >
            <Plus size={14} />
            <span>Add Node</span>
          </button>
        </div>
      </form>

      {/* Multi-Item Catalog: Canonical OpenBricks 4.0 Standard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {relays.map((relay) => {
          const isPinging = pingingUrl === relay.url;
          const isConnected = relay.status === 'connected';

          return (
            <div
              key={relay.url}
              id={`relay-card-${relay.url.replace(/[^a-zA-Z0-9]/g, '-')}`}
              className="p-4 bg-[#000000] border border-white/20 hover:border-[#A855F7]/50 hover:bg-[#1C1A18] rounded-[22px] shadow-xl flex flex-col justify-between gap-3 transition-all group"
            >
              {/* Top: Inset Icon Well + Title + Subtitle + Status Badge */}
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-[14px] bg-[#A855F7]/10 text-[#A855F7] flex items-center justify-center shrink-0 border border-[#A855F7]/30 group-hover:scale-105 transition-transform">
                  <Radio size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-white font-black text-xs font-mono m-0 truncate group-hover:text-[#A855F7] transition-colors">
                      {relay.url.replace('wss://', '')}
                    </h4>
                    <span
                      className={`text-[8px] font-mono px-1.5 py-0.5 rounded font-black border ${
                        isConnected
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-red-500/20 text-red-300 border-red-500/40'
                      }`}
                    >
                      {isConnected ? 'ONLINE' : 'DISCONNECTED'}
                    </span>
                  </div>
                  <p className="text-white text-[11px] font-medium m-0 mt-1 truncate">
                    {relay.description || 'Public Nostr Relay Node'}
                  </p>
                </div>
              </div>

              {/* Stats & Toggles Row */}
              <div className="flex items-center justify-between gap-2 px-1 py-1 rounded-[12px] bg-[#161412] border border-white/10 text-[11px] font-mono font-bold text-white">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">⚡{relay.latencyMs || 84}ms</span>
                  <span>↓{relay.eventsReceived}</span>
                  <span>↑{relay.eventsSent}</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onToggleRelayPermission(relay.url, 'read')}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-black cursor-pointer border ${
                      relay.read
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-white/10 text-white/50 border-white/20'
                    }`}
                    title="Toggle Read Permission"
                  >
                    R
                  </button>
                  <button
                    onClick={() => onToggleRelayPermission(relay.url, 'write')}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-black cursor-pointer border ${
                      relay.write
                        ? 'bg-[#A855F7]/20 text-purple-300 border-[#A855F7]/40'
                        : 'bg-white/10 text-white/50 border-white/20'
                    }`}
                    title="Toggle Write Permission"
                  >
                    W
                  </button>
                  {!relay.isDefault && (
                    <button
                      onClick={() => onRemoveRelay(relay.url)}
                      className="p-1 rounded text-white hover:text-red-400 transition-colors cursor-pointer"
                      title="Remove Relay"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>

              {/* Bottom: Crisp Hairline Divider + Action CTA + Chevron */}
              <div
                onClick={() => handlePing(relay.url)}
                className="flex items-center justify-between text-[11px] font-mono text-[#A855F7] border-t border-white/10 pt-2 cursor-pointer group-hover:text-purple-300"
              >
                <span className="font-extrabold flex items-center gap-1">
                  {isPinging ? (
                    <>
                      <RefreshCw size={11} className="animate-spin" />
                      Testing Ping...
                    </>
                  ) : (
                    'Ping & Synchronize'
                  )}
                </span>
                <ChevronRight size={13} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
