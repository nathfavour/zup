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
      className="hidden md:flex flex-col w-64 lg:w-72 shrink-0 h-[calc(100vh-96px)] sticky top-[80px] bg-[#121110] border border-[#282522] rounded-[24px] p-4 justify-between overflow-y-auto shadow-2xl transition-all"
    >
      <div className="flex flex-col gap-3">
        <div className="px-3 py-1 flex items-center justify-between">
          <span className="text-[#99948D] text-[11px] font-black uppercase tracking-widest">
            Sovereign Mesh
          </span>
          <span className="text-[10px] font-mono text-[#EC4899] font-bold">
            Zup P2P
          </span>
        </div>

        {/* Primary Desktop Nav Tabs: Standalone Clean Icons and Text (No Box Enclosures) */}
        <nav className="flex flex-col gap-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                id={`desktop-nav-tab-${tab.id}`}
                onClick={() => onSelectTab(tab.id)}
                className={`w-full text-left px-3.5 py-3 rounded-[16px] transition-all flex items-center gap-3.5 group cursor-pointer ${
                  isActive
                    ? 'bg-[#1D1B18] border border-[#3E3A34] text-white'
                    : 'bg-transparent border border-transparent hover:bg-[#1A1816] hover:border-[#2C2925] text-[#99948D] hover:text-white'
                }`}
              >
                {/* Standalone clean single icon without individual box enclosure */}
                <Icon
                  size={20}
                  style={{
                    color: isActive ? tab.accent : '#8A857E',
                  }}
                  className="shrink-0 transition-colors"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`font-extrabold text-sm tracking-wide truncate ${isActive ? 'text-white' : 'text-[#D6D2CC] group-hover:text-white'}`}>
                      {tab.label}
                    </span>
                    {tab.badge && (
                      <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded-full bg-[#EC4899] text-white shadow-sm">
                        {tab.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[#807B74] text-[11px] font-medium tracking-tight truncate block mt-0.5">
                    {tab.sublabel}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Prominent Desktop "Create" / "New Zup" Button (Solid OpenBricks style, no gradients) */}
        <button
          id="desktop-create-zup-btn"
          type="button"
          onClick={onOpenCompose}
          className="w-full mt-2 py-3 px-4 rounded-[16px] bg-[#EC4899] hover:bg-[#db2777] text-white font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-md active:scale-[0.98]"
        >
          <Plus size={18} strokeWidth={3} />
          <span>Create Zup</span>
        </button>
      </div>

      {/* Sidebar Bottom Security Status & Pro Trigger */}
      <div className="flex flex-col gap-2.5 pt-3 border-t border-[#262320] mt-auto">
        {keypair.isEphemeral ? (
          <div className="p-3 rounded-[16px] bg-[#1A1815] border border-[#F59E0B]/50 flex items-center gap-2.5">
            <Flame size={18} className="text-[#F59E0B] shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-white font-bold text-xs block truncate">
                Burner Mode Active
              </span>
              <span className="text-[#8F8A83] text-[10px] font-medium block truncate">
                Zero key persistence
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-[16px] bg-[#1A1815] border border-[#2B2824] flex items-center gap-2.5">
            <Shield size={18} className="text-[#10B981] shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-white font-bold text-xs block truncate">
                Local Cryptography
              </span>
              <span className="text-[#8F8A83] text-[10px] font-medium block truncate">
                Secp256k1 client-signed
              </span>
            </div>
          </div>
        )}

        <button
          id="sidebar-pro-banner"
          onClick={onOpenPro}
          className="w-full p-2.5 rounded-[16px] bg-[#1A1815] border border-[#35322E] hover:border-[#A855F7] transition-all flex items-center justify-between text-left group cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Sparkles size={16} className="text-[#A855F7] shrink-0" />
            <div className="min-w-0">
              <span className="text-white font-black text-xs uppercase tracking-wider block truncate">
                Pro Mesh Relay
              </span>
              <span className="text-[#8F8A83] text-[10px] font-medium block truncate">
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
