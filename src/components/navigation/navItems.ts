import { 
  Send, 
  Globe2,
  Bell,
  User,
  Plus
} from 'lucide-react';
import { ActiveTab, NostrKeypair } from '../../types';

export interface NavTabItem {
  id: ActiveTab;
  label: string;
  sublabel: string;
  icon: typeof Globe2;
  accent: string;
  glow: string;
  badge?: number;
}

export function getNavTabs(
  unreadMessagesCount: number,
  unreadNotificationsCount: number,
  keypair: NostrKeypair
): NavTabItem[] {
  return [
    {
      id: 'feed',
      label: 'Feed',
      sublabel: 'Decentralized Notes & Zups',
      icon: Globe2,
      accent: '#EC4899', // Pink
      glow: 'shadow-[0_0_14px_#EC489944]',
    },
    {
      id: 'messages',
      label: 'Messages',
      sublabel: 'End-to-End Encrypted DMs',
      icon: Send,
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined,
      accent: '#6366F1', // Indigo
      glow: 'shadow-[0_0_14px_#6366F144]',
    },
    {
      id: 'notifications',
      label: 'Notifications',
      sublabel: 'Zaps, Reactions & Mentions',
      icon: Bell,
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
      accent: '#F59E0B', // Amber
      glow: 'shadow-[0_0_14px_#F59E0B44]',
    },
    {
      id: 'profile',
      label: 'Profile',
      sublabel: keypair.displayName || keypair.name || 'Sovereign Identity',
      icon: User,
      accent: '#10B981', // Emerald
      glow: 'shadow-[0_0_14px_#10B98144]',
    },
  ];
}
