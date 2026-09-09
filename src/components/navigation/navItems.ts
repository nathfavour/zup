import { 
  Radio, 
  Key, 
  Send, 
  Settings, 
  Globe2 
} from 'lucide-react';
import { ActiveTab, RelayInfo, NostrKeypair } from '../../types';

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
  relays: RelayInfo[],
  unreadCount: number,
  keypair: NostrKeypair
): NavTabItem[] {
  const connectedCount = relays.filter((r) => r.status === 'connected').length;

  return [
    {
      id: 'feed',
      label: 'Feed',
      sublabel: 'Global & Following Notes',
      icon: Globe2,
      accent: '#EC4899', // Pink
      glow: 'shadow-[0_0_14px_#EC489944]',
    },
    {
      id: 'relays',
      label: 'Relays',
      sublabel: `${connectedCount} Connected Nodes`,
      icon: Radio,
      accent: '#A855F7', // Amethyst
      glow: 'shadow-[0_0_14px_#A855F744]',
    },
    {
      id: 'messages',
      label: 'Messages',
      sublabel: 'End-to-End Encrypted DMs',
      icon: Send,
      badge: unreadCount > 0 ? unreadCount : undefined,
      accent: '#6366F1', // Indigo
      glow: 'shadow-[0_0_14px_#6366F144]',
    },
    {
      id: 'vault',
      label: 'Key Vault',
      sublabel: keypair.isEphemeral ? 'Ephemeral Burner Active' : 'Sovereign Secp256k1 Keys',
      icon: Key,
      accent: '#10B981', // Emerald
      glow: 'shadow-[0_0_14px_#10B98144]',
    },
    {
      id: 'settings',
      label: 'Privacy',
      sublabel: 'Zero-Logs & Tor Guard',
      icon: Settings,
      accent: '#F59E0B', // Amber
      glow: 'shadow-[0_0_14px_#F59E0B44]',
    },
  ];
}
