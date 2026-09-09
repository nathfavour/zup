import { ActiveTab, NostrKeypair, RelayInfo } from '../types';
import { DesktopSidebar } from './navigation/DesktopSidebar';
import { MobileBottomNav } from './navigation/MobileBottomNav';

export { DesktopSidebar } from './navigation/DesktopSidebar';
export { MobileBottomNav } from './navigation/MobileBottomNav';

interface NavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  unreadCount: number;
  relays: RelayInfo[];
  keypair: NostrKeypair;
  onOpenPro: () => void;
}

/**
 * Modular Navigation component.
 * Uses pure CSS media query breakpoints ('hidden md:flex' and 'flex md:hidden')
 * to guarantee instant desktop/mobile adaptiveness with zero JS layout flash or jitter.
 */
export function Navigation({
  activeTab,
  onSelectTab,
  unreadCount,
  relays,
  keypair,
  onOpenPro,
}: NavigationProps) {
  return (
    <>
      {/* Desktop Left Sidebar: Pure CSS 'hidden md:flex' guarantees instant render on desktop only */}
      <DesktopSidebar
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        unreadCount={unreadCount}
        relays={relays}
        keypair={keypair}
        onOpenPro={onOpenPro}
      />

      {/* Mobile Floating Bottom Navbar: Pure CSS 'flex md:hidden' with rounded edges */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        unreadCount={unreadCount}
        relays={relays}
        keypair={keypair}
      />
    </>
  );
}
