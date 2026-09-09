import { ActiveTab, NostrKeypair, RelayInfo } from '../../types';
import { getNavTabs } from './navItems';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  unreadCount: number;
  relays: RelayInfo[];
  keypair: NostrKeypair;
}

export function MobileBottomNav({
  activeTab,
  onSelectTab,
  unreadCount,
  relays,
  keypair,
}: MobileBottomNavProps) {
  const tabs = getNavTabs(relays, unreadCount, keypair);

  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Mobile Bottom Navigation"
      className="flex md:hidden fixed bottom-0 left-0 right-0 w-full z-40 bg-[#000000]/95 backdrop-blur-xl border-t border-white/20 rounded-t-[24px] sm:rounded-t-[28px] rounded-b-none px-3 py-2 items-center justify-around shadow-[0_-8px_30px_rgba(0,0,0,0.85)] safe-area-inset-bottom transition-all"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            id={`mobile-nav-${tab.id}`}
            onClick={() => onSelectTab(tab.id)}
            className="flex flex-col items-center justify-center gap-1 py-1 px-2.5 min-w-[54px] relative group cursor-pointer transition-transform active:scale-95"
            aria-label={tab.label}
            title={tab.label}
          >
            <div className="relative flex items-center justify-center">
              <Icon
                size={22}
                style={{
                  color: isActive ? tab.accent : 'rgba(255, 255, 255, 0.65)',
                  filter: isActive ? `drop-shadow(0 0 8px ${tab.accent}88)` : undefined,
                }}
                className="transition-colors"
              />

              {tab.badge && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#6366F1] text-white text-[9px] font-black flex items-center justify-center font-mono border border-black shadow-sm">
                  {tab.badge}
                </span>
              )}
            </div>

            <span
              style={{
                color: isActive ? tab.accent : 'rgba(255, 255, 255, 0.65)',
              }}
              className={`text-[10px] tracking-tight transition-colors ${
                isActive ? 'font-black' : 'font-semibold'
              }`}
            >
              {tab.label}
            </span>

            {/* Active indicator dot */}
            <div
              style={{
                backgroundColor: isActive ? tab.accent : 'transparent',
                boxShadow: isActive ? `0 0 6px ${tab.accent}` : undefined,
              }}
              className="w-1 h-1 rounded-full transition-all"
            />
          </button>
        );
      })}
    </nav>
  );
}
