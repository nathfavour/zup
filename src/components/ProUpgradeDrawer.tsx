import { useState } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  Check, 
  Zap, 
  Lock, 
  Radio, 
  Cpu, 
  CheckCircle2 
} from 'lucide-react';
import { TactileDrawer } from './TactileDrawer';

interface ProUpgradeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  requestedFeature?: string;
}

export function ProUpgradeDrawer({
  isOpen,
  onClose,
  requestedFeature = 'Pro Mesh Relay Network',
}: ProUpgradeDrawerProps) {
  const [isActivated, setIsActivated] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const perks = [
    {
      title: 'Dedicated Onion & Tor Relays',
      desc: 'Connect through dedicated .onion and SOCKS5 zero-leak relay endpoints.',
      icon: Radio,
    },
    {
      title: 'Custom Sovereign NIP-05 Checkmark',
      desc: 'Verify your vanity identity like you@nostr.me or custom domain across all relays.',
      icon: ShieldCheck,
    },
    {
      title: 'Hardware Signer & Remote Amber NIP-46',
      desc: 'Air-gapped Coldcard, Keystone, and Android Amber remote signing.',
      icon: Cpu,
    },
    {
      title: 'Decentralized Encrypted Media Vault',
      desc: 'Blossom server integration with client-side encrypted media streaming.',
      icon: Lock,
    },
  ];

  const handleActivatePro = () => {
    setIsUpgrading(true);
    setTimeout(() => {
      setIsUpgrading(false);
      setIsActivated(true);
    }, 700);
  };

  return (
    <TactileDrawer
      id="pro-upgrade-drawer"
      isOpen={isOpen}
      onClose={onClose}
      title="Zup Pro"
      subtitle="Cypherpunk Decentralized Power Suite"
      footerActions={
        isActivated ? (
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-[16px] bg-[#10B981] hover:bg-[#059669] text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_12px_#10B98144]"
          >
            Done
          </button>
        ) : (
          <div className="w-full flex items-center justify-between gap-3">
            <div>
              <span className="text-white text-sm font-mono font-black block">
                2,100 Sats / mo
              </span>
              <span className="text-white text-[10px] font-bold block">
                Open Lightning Subscription
              </span>
            </div>
            <button
              id="activate-pro-btn"
              disabled={isUpgrading}
              onClick={handleActivatePro}
              className="px-6 py-2.5 min-h-[44px] rounded-[16px] bg-[#A855F7] hover:bg-[#9333ea] text-white text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_14px_#A855F755]"
            >
              <Zap size={14} className="fill-white" />
              <span>{isUpgrading ? 'Verifying LN...' : 'Unlock Sovereign Pro'}</span>
            </button>
          </div>
        )
      }
    >
      {isActivated ? (
        <div className="flex flex-col items-center justify-center text-center p-4 gap-4">
          <div className="w-16 h-16 rounded-full bg-[#10B981]/20 border-2 border-[#10B981] flex items-center justify-center text-[#10B981] shadow-[0_0_20px_#10B98144]">
            <CheckCircle2 size={32} />
          </div>
          <div>
            <h4 className="text-white font-black text-base uppercase tracking-wider m-0">
              Sovereign Pro Activated!
            </h4>
            <p className="text-white text-xs font-bold mt-1">
              All high-throughput relays, NIP-05 routing, and Tor tunnels are now active.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Notice for feature attempted */}
          <div className="p-3.5 rounded-[18px] bg-[#000000] border border-[#A855F7]/40 flex items-center gap-3 shadow-[0_0_12px_#A855F71a]">
            <div className="w-9 h-9 rounded-[12px] bg-[#A855F7]/15 text-[#A855F7] flex items-center justify-center shrink-0 border border-[#A855F7]/30">
              <Sparkles size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-white font-black text-xs uppercase tracking-wider block truncate">
                Feature Requested: {requestedFeature}
              </span>
              <span className="text-white text-[11px] font-bold block truncate">
                Available with decentralized Pro Lightning upgrade.
              </span>
            </div>
          </div>

          {/* Perks list */}
          <div className="flex flex-col gap-2.5">
            <span className="text-white text-xs font-black uppercase tracking-wider">
              Unlocked Capabilities
            </span>

            {perks.map((p, idx) => {
              const Icon = p.icon;
              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-[18px] bg-[#000000] border border-white/20 flex items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-[12px] bg-white/10 text-white flex items-center justify-center shrink-0 border border-white/20 mt-0.5">
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-white font-black text-xs block truncate">
                      {p.title}
                    </span>
                    <p className="text-white text-[11px] font-medium leading-relaxed m-0 mt-0.5">
                      {p.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </TactileDrawer>
  );
}
