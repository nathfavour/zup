import { ActiveTab, NostrKeypair } from '../types';
import { DesktopSidebar } from './navigation/DesktopSidebar';
import { MobileBottomNav } from './navigation/MobileBottomNav';

export { DesktopSidebar } from './navigation/DesktopSidebar';
export { MobileBottomNav } from './navigation/MobileBottomNav';

interface NavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
  keypair: NostrKeypair;
  onOpenCompose: () => void;
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
  unreadMessagesCount,
  unreadNotificationsCount,
  keypair,
  onOpenCompose,
  onOpenPro,
}: NavigationProps) {
  return (
    <>
      {/* Desktop Left Sidebar: Pure CSS 'hidden md:flex' with icons and text */}
      <DesktopSidebar
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        unreadMessagesCount={unreadMessagesCount}
        unreadNotificationsCount={unreadNotificationsCount}
        keypair={keypair}
        onOpenCompose={onOpenCompose}
        onOpenPro={onOpenPro}
      />

      {/* Mobile Floating Bottom Navbar: Pure CSS 'flex md:hidden' with icons only (no text) */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        unreadMessagesCount={unreadMessagesCount}
        unreadNotificationsCount={unreadNotificationsCount}
        keypair={keypair}
        onOpenCompose={onOpenCompose}
      />
    </>
  );
}
