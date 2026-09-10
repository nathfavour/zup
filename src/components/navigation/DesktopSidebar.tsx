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
      className="hidden md:flex flex-col w-64 lg:w-72 shrink-0 h-[calc(100vh-96px)] sticky top-[80px] bg-[#161412] border border-white/20 rounded-[24px] p-4 justify-between overflow-y-auto shadow-2xl transition-all"
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

        {/* Primary Desktop Nav Tabs: Standalone Clean Icons and Text */}
        <nav className="flex flex-col gap-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                id={`desktop-nav-tab-${tab.id}`}
                onClick={() => onSelectTab(tab.id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-[16px] transition-all flex items-center gap-3.5 group cursor-pointer ${
                  isActive
                    ? 'bg-[#000000] border-2 border-white/40 text-white shadow-md'
                    : 'bg-transparent border border-transparent hover:bg-[#000000] hover:border-white/20 text-white'
                }`}
              >
                {/* Standalone clean single icon */}
                <Icon
                  size={18}
                  style={{
                    color: isActive ? tab.accent : '#FFFFFF',
                  }}
                  className="shrink-0 transition-colors"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-extrabold text-xs tracking-wide truncate text-white">
                      {tab.label}
                    </span>
                    {tab.badge && (
                      <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded-full bg-[#EC4899] text-white shadow-sm">
                        {tab.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-white text-[10px] font-medium tracking-tight truncate block mt-0.5">
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

      {/* Sidebar Bottom: Compact Identity Status */}
      <div className="flex flex-col gap-2 pt-3 border-t border-white/10 mt-auto">
        <div className="px-3 py-2 rounded-[14px] bg-[#000000] border border-white/20 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Shield size={14} className={keypair.isEphemeral ? 'text-[#F59E0B]' : 'text-white'} />
            <span className="text-white text-[11px] font-bold truncate">
              {keypair.isEphemeral ? 'Burner Identity' : 'Sovereign Node'}
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold text-white px-1.5 py-0.5 rounded bg-white/10">
            P2P
          </span>
        </div>
      </div>
    </aside>
  );
}
