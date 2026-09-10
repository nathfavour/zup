import { Globe2, Send, Plus, Bell, Settings } from 'lucide-react';
import { ActiveTab, NostrKeypair } from '../../types';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
  keypair: NostrKeypair;
  onOpenCompose: () => void;
}

export function MobileBottomNav({
  activeTab,
  onSelectTab,
  unreadMessagesCount,
  unreadNotificationsCount,
  keypair,
  onOpenCompose,
}: MobileBottomNavProps) {
  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Mobile Bottom Navigation"
      className="flex md:hidden fixed bottom-0 left-0 right-0 w-full z-40 bg-[#161412] border-t border-white/20 rounded-t-[24px] sm:rounded-t-[28px] rounded-b-none px-3 py-2 items-center justify-around shadow-[0_-8px_30px_rgba(0,0,0,0.85)] safe-area-inset-bottom transition-all"
    >
      {/* 1. Feed Icon */}
      <button
        type="button"
        id="mobile-nav-feed"
        onClick={() => onSelectTab('feed')}
        className="flex flex-col items-center justify-center py-1.5 px-2 relative group cursor-pointer transition-transform active:scale-95"
        aria-label="Feed"
        title="Feed"
      >
        <Globe2
          size={22}
          style={{
            color: activeTab === 'feed' ? '#EC4899' : '#FFFFFF',
          }}
          className="transition-colors"
        />
        <div
          style={{
            backgroundColor: activeTab === 'feed' ? '#EC4899' : 'transparent',
          }}
          className="w-1.5 h-1.5 rounded-full mt-1 transition-all"
        />
      </button>

      {/* 2. Messages Icon */}
      <button
        type="button"
        id="mobile-nav-messages"
        onClick={() => onSelectTab('messages')}
        className="flex flex-col items-center justify-center py-1.5 px-2 relative group cursor-pointer transition-transform active:scale-95"
        aria-label="Messages"
        title="Messages"
      >
        <div className="relative flex items-center justify-center">
          <Send
            size={20}
            style={{
              color: activeTab === 'messages' ? '#EC4899' : '#FFFFFF',
            }}
            className="transition-colors"
          />
          {unreadMessagesCount > 0 && (
            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#EC4899] text-white text-[9px] font-black flex items-center justify-center font-mono border border-black shadow-sm">
              {unreadMessagesCount}
            </span>
          )}
        </div>
        <div
          style={{
            backgroundColor: activeTab === 'messages' ? '#EC4899' : 'transparent',
          }}
          className="w-1.5 h-1.5 rounded-full mt-1 transition-all"
        />
      </button>

      {/* 3. Create Button (Center prominent icon) */}
      <button
        type="button"
        id="mobile-nav-create"
        onClick={onOpenCompose}
        className="flex items-center justify-center w-10 h-10 rounded-[14px] bg-[#EC4899] hover:bg-[#db2777] text-white shadow-md cursor-pointer transition-transform active:scale-90"
        aria-label="Create Zup"
        title="Create Zup"
      >
        <Plus size={20} strokeWidth={2.8} />
      </button>

      {/* 4. Notifications Icon */}
      <button
        type="button"
        id="mobile-nav-notifications"
        onClick={() => onSelectTab('notifications')}
        className="flex flex-col items-center justify-center py-1.5 px-2 relative group cursor-pointer transition-transform active:scale-95"
        aria-label="Notifications"
        title="Notifications"
      >
        <div className="relative flex items-center justify-center">
          <Bell
            size={20}
            style={{
              color: activeTab === 'notifications' ? '#F59E0B' : '#FFFFFF',
            }}
            className="transition-colors"
          />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#F59E0B] text-black text-[9px] font-black flex items-center justify-center font-mono border border-black shadow-sm">
              {unreadNotificationsCount}
            </span>
          )}
        </div>
        <div
          style={{
            backgroundColor: activeTab === 'notifications' ? '#F59E0B' : 'transparent',
          }}
          className="w-1.5 h-1.5 rounded-full mt-1 transition-all"
        />
      </button>

      {/* 5. Settings Icon */}
      <button
        type="button"
        id="mobile-nav-settings"
        onClick={() => onSelectTab('settings')}
        className="flex flex-col items-center justify-center py-1.5 px-2 relative group cursor-pointer transition-transform active:scale-95"
        aria-label="Settings"
        title="Settings"
      >
        <Settings
          size={20}
          style={{
            color: activeTab === 'settings' ? '#EC4899' : '#FFFFFF',
          }}
          className="transition-colors"
        />
        <div
          style={{
            backgroundColor: activeTab === 'settings' ? '#EC4899' : 'transparent',
          }}
          className="w-1.5 h-1.5 rounded-full mt-1 transition-all"
        />
      </button>
    </nav>
  );
}
