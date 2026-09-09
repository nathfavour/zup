import { Globe2, Send, Plus, Bell, User } from 'lucide-react';
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
      className="flex md:hidden fixed bottom-0 left-0 right-0 w-full z-40 bg-[#121110] border-t border-[#282522] rounded-t-[24px] sm:rounded-t-[28px] rounded-b-none px-4 py-2.5 items-center justify-around shadow-[0_-8px_30px_rgba(0,0,0,0.85)] safe-area-inset-bottom transition-all"
    >
      {/* 1. Feed Icon */}
      <button
        type="button"
        id="mobile-nav-feed"
        onClick={() => onSelectTab('feed')}
        className="flex flex-col items-center justify-center py-1.5 px-3 relative group cursor-pointer transition-transform active:scale-95"
        aria-label="Feed"
        title="Feed"
      >
        <Globe2
          size={24}
          style={{
            color: activeTab === 'feed' ? '#EC4899' : '#8F8A83',
          }}
          className="transition-colors"
        />
        {/* Active Indicator Dot */}
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
        className="flex flex-col items-center justify-center py-1.5 px-3 relative group cursor-pointer transition-transform active:scale-95"
        aria-label="Messages"
        title="Messages"
      >
        <div className="relative flex items-center justify-center">
          <Send
            size={22}
            style={{
              color: activeTab === 'messages' ? '#6366F1' : '#8F8A83',
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
            backgroundColor: activeTab === 'messages' ? '#6366F1' : 'transparent',
          }}
          className="w-1.5 h-1.5 rounded-full mt-1 transition-all"
        />
      </button>

      {/* 3. Create Button (Center prominent icon) */}
      <button
        type="button"
        id="mobile-nav-create"
        onClick={onOpenCompose}
        className="flex items-center justify-center w-11 h-11 rounded-[16px] bg-[#EC4899] hover:bg-[#db2777] text-white shadow-md cursor-pointer transition-transform active:scale-90"
        aria-label="Create Zup"
        title="Create Zup"
      >
        <Plus size={22} strokeWidth={2.8} />
      </button>

      {/* 4. Notifications Icon */}
      <button
        type="button"
        id="mobile-nav-notifications"
        onClick={() => onSelectTab('notifications')}
        className="flex flex-col items-center justify-center py-1.5 px-3 relative group cursor-pointer transition-transform active:scale-95"
        aria-label="Notifications"
        title="Notifications"
      >
        <div className="relative flex items-center justify-center">
          <Bell
            size={23}
            style={{
              color: activeTab === 'notifications' ? '#F59E0B' : 'rgba(255, 255, 255, 0.65)',
              filter: activeTab === 'notifications' ? 'drop-shadow(0 0 8px #F59E0B88)' : undefined,
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
            boxShadow: activeTab === 'notifications' ? '0 0 6px #F59E0B' : undefined,
          }}
          className="w-1.5 h-1.5 rounded-full mt-1 transition-all"
        />
      </button>

      {/* 5. Profile Icon */}
      <button
        type="button"
        id="mobile-nav-profile"
        onClick={() => onSelectTab('profile')}
        className="flex flex-col items-center justify-center py-1.5 px-3 relative group cursor-pointer transition-transform active:scale-95"
        aria-label="Profile"
        title="Profile"
      >
        <div className="relative flex items-center justify-center">
          {keypair.avatar ? (
            <img
              src={keypair.avatar}
              alt="Profile"
              referrerPolicy="no-referrer"
              className={`w-6 h-6 rounded-[10px] object-cover border ${
                activeTab === 'profile'
                  ? 'border-[#10B981] shadow-[0_0_8px_#10B98188]'
                  : 'border-white/30'
              }`}
            />
          ) : (
            <User
              size={23}
              style={{
                color: activeTab === 'profile' ? '#10B981' : 'rgba(255, 255, 255, 0.65)',
                filter: activeTab === 'profile' ? 'drop-shadow(0 0 8px #10B98188)' : undefined,
              }}
              className="transition-colors"
            />
          )}
        </div>
        <div
          style={{
            backgroundColor: activeTab === 'profile' ? '#10B981' : 'transparent',
            boxShadow: activeTab === 'profile' ? '0 0 6px #10B981' : undefined,
          }}
          className="w-1.5 h-1.5 rounded-full mt-1 transition-all"
        />
      </button>
    </nav>
  );
}
