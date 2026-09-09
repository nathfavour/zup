import { Flame, Shield, Sparkles, Plus } from 'lucide-react';
import { ActiveTab, NostrKeypair } from '../../types';
import { getNavTabs } from './navItems';

interface DesktopSidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
  keypair: NostrKeypair;
  onOpenCompose: () => void;
  onOpenPro: () => void;
}

export function DesktopSidebar({
  activeTab,
  onSelectTab,
  unreadMessagesCount,
  unreadNotificationsCount,
  keypair,
  onOpenCompose,
  onOpenPro,
}: DesktopSidebarProps) {
  const tabs = getNavTabs(unreadMessagesCount, unreadNotificationsCount, keypair);

  return (
    <aside
      id="desktop-sidebar"
      aria-label="Desktop Navigation Sidebar"
      className="hidden md:flex flex-col w-64 lg:w-72 shrink-0 h-[calc(100vh-96px)] sticky top-[80px] bg-[#000000] border border-white/20 rounded-[24px] p-4 justify-between overflow-y-auto shadow-2xl transition-all"
    >
      <div className="flex flex-col gap-3">
        <div className="px-3 py-1 flex items-center justify-between">
          <span className="text-white text-[11px] font-black uppercase tracking-widest">
            Sovereign Mesh
          </span>
          <span className="text-[10px] font-mono text-[#EC4899] font-bold">
            Zup P2P
          </span>
        </div>

        {/* Primary Desktop Nav Tabs: Icons and Text */}
        <nav className="flex flex-col gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                id={`desktop-nav-tab-${tab.id}`}
                onClick={() => onSelectTab(tab.id)}
                style={{
                  borderColor: isActive ? tab.accent : undefined,
                }}
                className={`w-full text-left p-3 rounded-[18px] transition-all flex items-center gap-3.5 group cursor-pointer ${
                  isActive
                    ? `bg-[#161412] border-2 text-white ${tab.glow}`
                    : 'bg-[#161412]/50 border border-white/10 hover:border-white/40 text-white'
                }`}
              >
                <div
                  style={{
                    backgroundColor: isActive ? `${tab.accent}25` : '#000000',
                    borderColor: isActive ? tab.accent : 'rgba(255, 255, 255, 0.15)',
                    color: isActive ? tab.accent : '#ffffff',
                  }}
                  className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 border transition-all"
                >
                  <Icon size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-white font-extrabold text-sm tracking-wide truncate">
                      {tab.label}
                    </span>
                    {tab.badge && (
                      <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded-full bg-[#EC4899] text-white shadow-sm">
                        {tab.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-white/60 text-[11px] font-medium tracking-tight truncate block mt-0.5">
                    {tab.sublabel}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Prominent Desktop "Create" / "New Zup" Button */}
        <button
          id="desktop-create-zup-btn"
          type="button"
          onClick={onOpenCompose}
          className="w-full mt-2 py-3.5 px-4 rounded-[18px] bg-gradient-to-r from-[#EC4899] to-[#A855F7] hover:opacity-95 text-white font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-[0_0_20px_#EC489955] active:scale-[0.98]"
        >
          <Plus size={18} strokeWidth={3} />
          <span>Create Zup</span>
        </button>
      </div>

      {/* Sidebar Bottom Security Status & Pro Trigger */}
      <div className="flex flex-col gap-2.5 pt-3 border-t border-white/10 mt-auto">
        {keypair.isEphemeral ? (
          <div className="p-3 rounded-[16px] bg-[#161412] border border-[#F59E0B]/50 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[10px] bg-[#F59E0B]/15 text-[#F59E0B] flex items-center justify-center shrink-0 border border-[#F59E0B]/30">
              <Flame size={14} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-white font-bold text-xs block truncate">
                Burner Mode Active
              </span>
              <span className="text-white/60 text-[10px] font-medium block truncate">
                Zero key persistence
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-[16px] bg-[#161412] border border-white/10 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[10px] bg-[#10B981]/15 text-[#10B981] flex items-center justify-center shrink-0 border border-[#10B981]/30">
              <Shield size={14} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-white font-bold text-xs block truncate">
                Local Cryptography
              </span>
              <span className="text-white/60 text-[10px] font-medium block truncate">
                Secp256k1 client-signed
              </span>
            </div>
          </div>
        )}

        <button
          id="sidebar-pro-banner"
          onClick={onOpenPro}
          className="w-full p-2.5 rounded-[16px] bg-[#161412] border border-[#A855F7]/40 hover:border-[#A855F7] transition-all flex items-center justify-between text-left group cursor-pointer shadow-[0_0_12px_#A855F71a]"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={15} className="text-[#A855F7] shrink-0" />
            <div className="min-w-0">
              <span className="text-white font-black text-xs uppercase tracking-wider block truncate">
                Pro Mesh Relay
              </span>
              <span className="text-white/60 text-[10px] font-medium block truncate">
                Tor & NIP-05 Verified
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-[#A855F7] px-2 py-0.5 rounded bg-[#A855F7]/15 border border-[#A855F7]/30">
            UNLOCK
          </span>
        </button>
      </div>
    </aside>
  );
}
