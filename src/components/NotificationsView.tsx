import { useState } from 'react';
import { 
  Bell, 
  Zap, 
  Heart, 
  Repeat, 
  MessageSquare, 
  CheckCheck, 
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { NostrNotification, NostrKeypair, NostrEvent } from '../types';
import { formatTruncatedKey } from '../lib/nostr';

interface NotificationsViewProps {
  notifications: NostrNotification[];
  keypair: NostrKeypair;
  onMarkAllAsRead: () => void;
  onOpenZapTarget?: (eventId: string) => void;
  onReplyTarget?: (eventId: string) => void;
}

type NotificationFilter = 'all' | 'zaps' | 'likes' | 'mentions' | 'reposts';

export function NotificationsView({
  notifications,
  keypair,
  onMarkAllAsRead,
  onOpenZapTarget,
  onReplyTarget,
}: NotificationsViewProps) {
  const [filter, setFilter] = useState<NotificationFilter>('all');

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'zaps') return n.type === 'zap';
    if (filter === 'likes') return n.type === 'like';
    if (filter === 'reposts') return n.type === 'repost';
    if (filter === 'mentions') return n.type === 'mention' || n.type === 'reply';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div id="notifications-view" className="flex flex-col gap-4 max-w-3xl mx-auto pb-12 animate-fadeIn">
      {/* Top Notifications Bar */}
      <div className="sticky top-[72px] sm:top-[80px] z-20 bg-[#000000]/95 backdrop-blur-xl border border-white/20 rounded-[20px] px-4 py-3 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[12px] bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] flex items-center justify-center">
            <Bell size={16} />
          </div>
          <div>
            <h2 className="text-white font-black text-sm uppercase tracking-wider m-0 leading-tight">
              Notifications
            </h2>
            <span className="text-white/50 text-[11px] font-medium">
              {unreadCount > 0 ? `${unreadCount} unread activity` : 'All caught up'}
            </span>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllAsRead}
            className="px-3 py-1.5 rounded-[12px] bg-[#161412] hover:bg-[#25221f] border border-white/20 text-white/80 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCheck size={14} className="text-[#F59E0B]" />
            <span>Mark read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-[#000000] border border-white/15 rounded-[18px]">
        {[
          { id: 'all', label: 'All', icon: Bell },
          { id: 'zaps', label: 'Zaps ⚡', icon: Zap, color: 'text-[#F59E0B]' },
          { id: 'likes', label: 'Reactions ❤️', icon: Heart, color: 'text-[#EC4899]' },
          { id: 'mentions', label: 'Mentions 💬', icon: MessageSquare, color: 'text-[#EC4899]' },
          { id: 'reposts', label: 'Reposts 🔁', icon: Repeat, color: 'text-[#F59E0B]' },
        ].map((tab) => {
          const isActive = filter === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as NotificationFilter)}
              className={`px-3.5 py-1.5 rounded-[12px] text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-white text-black shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Notifications List */}
      <div className="flex flex-col gap-2.5">
        {filteredNotifications.length === 0 ? (
          <div className="p-8 rounded-[24px] bg-[#000000] border border-white/20 text-center flex flex-col items-center justify-center gap-2 shadow-xl">
            <div className="w-12 h-12 rounded-[16px] bg-[#161412] border border-white/20 flex items-center justify-center text-white">
              <Bell size={24} />
            </div>
            <h4 className="text-white font-black text-sm uppercase tracking-wider m-0">
              No Notifications Yet
            </h4>
            <p className="text-white text-xs font-medium max-w-sm m-0">
              When peers on the relay mesh zap, like, reply to, or repost your Zups, alerts will stream in real-time here.
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const dateStr = new Date(notif.timestamp * 1000).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={notif.id}
                className={`p-4 rounded-[22px] bg-[#000000] border transition-all flex items-start gap-3.5 shadow-md ${
                  notif.read ? 'border-white/20' : 'border-[#EC4899] shadow-[0_0_12px_#EC489922]'
                }`}
              >
                {/* Icon Badge */}
                <div className="shrink-0 mt-0.5">
                  {notif.type === 'zap' && (
                    <div className="w-8 h-8 rounded-[10px] bg-[#F59E0B]/20 border border-[#F59E0B] text-[#F59E0B] flex items-center justify-center shadow-[0_0_8px_#F59E0B44]">
                      <Zap size={16} />
                    </div>
                  )}
                  {notif.type === 'like' && (
                    <div className="w-8 h-8 rounded-[10px] bg-[#EC4899]/20 border border-[#EC4899] text-[#EC4899] flex items-center justify-center shadow-[0_0_8px_#EC489944]">
                      <Heart size={16} fill="#EC4899" />
                    </div>
                  )}
                  {notif.type === 'repost' && (
                    <div className="w-8 h-8 rounded-[10px] bg-[#F59E0B]/20 border border-[#F59E0B] text-[#F59E0B] flex items-center justify-center shadow-[0_0_8px_#F59E0B44]">
                      <Repeat size={16} />
                    </div>
                  )}
                  {(notif.type === 'reply' || notif.type === 'mention') && (
                    <div className="w-8 h-8 rounded-[10px] bg-[#EC4899]/20 border border-[#EC4899] text-[#EC4899] flex items-center justify-center shadow-[0_0_8px_#EC489944]">
                      <MessageSquare size={16} />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <img
                        src={notif.sourceAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${notif.sourcePubkey}`}
                        alt={notif.sourceName}
                        className="w-5 h-5 rounded-full border border-white/20 bg-black shrink-0 object-cover"
                      />
                      <span className="text-white font-black text-xs truncate max-w-[140px] sm:max-w-none">
                        {notif.sourceName}
                      </span>
                      <span className="text-white text-xs font-semibold">
                        {notif.type === 'zap' && `zapped you ${notif.amountSats || 21} sats ⚡`}
                        {notif.type === 'like' && 'liked your Zup'}
                        {notif.type === 'repost' && 'reposted your Zup'}
                        {notif.type === 'reply' && 'replied to your note'}
                        {notif.type === 'mention' && 'mentioned you in a note'}
                      </span>
                    </div>
                    <span className="text-white text-[10px] font-mono shrink-0 font-medium">
                      {dateStr}
                    </span>
                  </div>

                  {notif.comment && (
                    <p className="text-[#F59E0B] font-mono text-xs font-bold m-0">
                      &ldquo;{notif.comment}&rdquo;
                    </p>
                  )}

                  {notif.targetEventContent && (
                    <div className="p-2.5 rounded-[14px] bg-[#161412] border border-white/20 text-white text-xs font-medium line-clamp-2">
                      {notif.targetEventContent}
                    </div>
                  )}

                  {/* Notification actions */}
                  <div className="flex items-center gap-2 pt-0.5">
                    {notif.targetEventId && onReplyTarget && (
                      <button
                        type="button"
                        onClick={() => onReplyTarget(notif.targetEventId!)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[10px] bg-[#161412] hover:bg-[#25221f] border border-white/20 text-white text-[11px] font-bold cursor-pointer transition-colors"
                      >
                        <MessageSquare size={12} />
                        <span>Reply</span>
                      </button>
                    )}
                    {notif.targetEventId && onOpenZapTarget && (
                      <button
                        type="button"
                        onClick={() => onOpenZapTarget(notif.targetEventId!)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[10px] bg-[#F59E0B]/15 hover:bg-[#F59E0B]/25 border border-[#F59E0B]/30 text-[#F59E0B] text-[11px] font-bold cursor-pointer transition-colors"
                      >
                        <Zap size={12} />
                        <span>Zap Back</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
