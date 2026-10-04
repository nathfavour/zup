'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Terminal,
  Key,
  Radio,
  Activity,
  Cloud,
  Layers,
  Send,
  Lock,
  ArrowRight,
  Command
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: 'feed' | 'vault' | 'relays' | 'telemetry' | 'sync' | 'cli') => void;
  onCompose: () => void;
  onLockVault: () => void;
  onSync: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
  onCompose,
  onLockVault,
  onSync
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const items = [
    {
      id: 'feed',
      title: 'Feeds & Technical Dispatches',
      shortcut: '1',
      icon: <Layers size={15} />,
      action: () => {
        onNavigate('feed');
        onClose();
      }
    },
    {
      id: 'vault',
      title: 'Cryptographic Vault & Identities',
      shortcut: '2',
      icon: <Key size={15} />,
      action: () => {
        onNavigate('vault');
        onClose();
      }
    },
    {
      id: 'relays',
      title: 'Relay Multiplexing & Connection Pool',
      shortcut: '3',
      icon: <Radio size={15} />,
      action: () => {
        onNavigate('relays');
        onClose();
      }
    },
    {
      id: 'telemetry',
      title: 'Local Interaction Telemetry & Affinities',
      shortcut: '4',
      icon: <Activity size={15} />,
      action: () => {
        onNavigate('telemetry');
        onClose();
      }
    },
    {
      id: 'sync',
      title: 'Turso / LibSQL Cloud Delta Replication',
      shortcut: '5',
      icon: <Cloud size={15} />,
      action: () => {
        onNavigate('sync');
        onClose();
      }
    },
    {
      id: 'cli',
      title: '@zup/cli Interactive Shell',
      shortcut: '6',
      icon: <Terminal size={15} />,
      action: () => {
        onNavigate('cli');
        onClose();
      }
    },
    {
      id: 'compose',
      title: 'Compose New Technical Dispatch',
      shortcut: 'N',
      icon: <Send size={15} className="text-pink-400" />,
      action: () => {
        onClose();
        onCompose();
      }
    },
    {
      id: 'sync_trigger',
      title: 'Trigger Edge LibSQL Delta Sync',
      shortcut: 'S',
      icon: <Cloud size={15} className="text-indigo-400" />,
      action: () => {
        onClose();
        onSync();
      }
    },
    {
      id: 'lock',
      title: 'Lock Vault (Hard Eviction / Zero RAM)',
      shortcut: 'L',
      icon: <Lock size={15} className="text-red-400" />,
      action: () => {
        onClose();
        onLockVault();
      }
    }
  ];

  const filtered = items.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/70 backdrop-blur-xs">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl bg-[#161412] border-2 border-white/20 rounded-[22px] shadow-2xl overflow-hidden font-mono">
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-white/10 flex items-center gap-3 bg-[#000000]">
          <Search size={16} className="text-white/40 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or jump to workspace..."
            className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder-white/40 font-mono"
            autoFocus
          />
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">ESC</span>
        </div>

        {/* Results List */}
        <div className="p-2 max-h-[340px] overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-white/40">No matching commands.</div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                onClick={item.action}
                className="w-full p-2.5 rounded-[12px] bg-[#000000] hover:bg-[#1E1C1A] border border-white/10 hover:border-white/30 flex items-center justify-between text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-xs text-white">
                  <span className="text-white/60 group-hover:text-white transition-colors">
                    {item.icon}
                  </span>
                  <span className="font-semibold">{item.title}</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white/70 group-hover:bg-white/20">
                  {item.shortcut}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-white/10 bg-[#000000] text-[10px] text-white/40 flex items-center justify-between">
          <span>Navigate with arrows or shortcuts</span>
          <span>zup workspace v1.0.0</span>
        </div>
      </div>
    </div>
  );
}
