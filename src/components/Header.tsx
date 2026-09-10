import { Bell, Wallet } from 'lucide-react';
import { NostrKeypair } from '../types';
import { ZupLogo } from './ZupLogo';

interface HeaderProps {
  keypair: NostrKeypair;
  unreadNotificationsCount?: number;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onOpenWallet?: () => void;
  onGoToFeed?: () => void;
}

export function Header({
  keypair,
  unreadNotificationsCount = 0,
  onOpenNotifications,
  onOpenProfile,
  onOpenWallet,
  onGoToFeed,
}: HeaderProps) {
  return (
    <header
      id="app-header"
      aria-label="Application Header"
      className="sticky top-0 left-0 right-0 z-30 w-full bg-[#121110]/95 backdrop-blur-md border-b border-[#282522] rounded-b-[20px] sm:rounded-b-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.85)] transition-all"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between">
        {/* Left: Logo (and app name on desktop) */}
        <button
          type="button"
          onClick={onGoToFeed}
          className="flex items-center gap-2.5 cursor-pointer group focus:outline-none"
          title="Zup — Feed"
          aria-label="Zup Home"
        >
          <div className="w-9 h-9 rounded-[13px] bg-[#1A1816] border border-[#35322E] group-hover:border-[#EC4899]/50 flex items-center justify-center shadow-sm shrink-0 p-1 transition-colors">
            <ZupLogo size={26} />
          </div>
          <span className="hidden sm:inline text-white font-black text-lg tracking-wider uppercase leading-none">
            Zup
          </span>
        </button>

        {/* Center: Central Notification Icon with live unread badge */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            id="topbar-notifications-btn"
            onClick={onOpenNotifications}
            className="relative p-2.5 rounded-full bg-[#1A1816] border border-[#2E2B27] hover:border-[#EC4899] text-white/80 hover:text-white transition-all cursor-pointer shadow-inner flex items-center justify-center group"
            title={
              unreadNotificationsCount > 0
                ? `${unreadNotificationsCount} unread notification${unreadNotificationsCount === 1 ? '' : 's'}`
                : 'Notifications'
            }
            aria-label="Notifications"
          >
            <Bell
              size={18}
              className={`transition-transform group-hover:scale-110 ${
                unreadNotificationsCount > 0 ? 'text-[#EC4899]' : 'text-white/70'
              }`}
            />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EC4899] text-white text-[10px] font-black font-mono flex items-center justify-center shadow-md animate-pulse">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </button>
        </div>

        {/* Right: Wallet Icon and Profile Circle Icon */}
        <div className="flex items-center justify-end gap-2.5">
          {/* Topbar Lightning Wallet Icon Button */}
          <button
            type="button"
            id="topbar-wallet-btn"
            onClick={onOpenWallet}
            className="p-2 rounded-[14px] bg-[#161412] hover:bg-[#25221f] border border-white/20 hover:border-[#F59E0B]/80 text-[#F59E0B] transition-all cursor-pointer shadow-sm flex items-center justify-center group active:scale-95"
            title="Lightning Wallet & Zaps"
            aria-label="Lightning Wallet"
          >
            <Wallet size={18} className="transition-transform group-hover:scale-105" />
          </button>

          {/* Profile Circle Icon */}
          <button
            type="button"
            id="topbar-profile-btn"
            onClick={onOpenProfile}
            className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/20 hover:border-[#EC4899] transition-all cursor-pointer p-0.5 bg-[#161412] shrink-0 active:scale-95 focus:outline-none"
            title={keypair.name ? `Profile (${keypair.name})` : 'Profile'}
            aria-label="Sovereign Profile"
          >
            <img
              src={keypair.avatar}
              alt={keypair.name || 'Profile'}
              className="w-full h-full rounded-full object-cover bg-black"
            />
          </button>
        </div>
      </div>
    </header>
  );
}
