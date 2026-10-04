'use client';

import React from 'react';
import { X, Bell, CheckCircle2, Radio, ShieldCheck } from 'lucide-react';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  relaysOnlineCount: number;
}

export function NotificationsDrawer({ isOpen, onClose, relaysOnlineCount }: NotificationsDrawerProps) {
  if (!isOpen) return null;

  const notifications = [
    {
      id: 'n1',
      title: 'Relay Multiplexer Active',
      desc: `${relaysOnlineCount} Nostr relays connected with single-socket multiplexing.`,
      time: 'Just now',
      icon: <Radio size={14} className="text-amber-400" />
    },
    {
      id: 'n2',
      title: 'Local-First Cache Ready',
      desc: 'Dexie IndexedDB (zup_engine_v1) loaded and verified.',
      time: '2m ago',
      icon: <CheckCircle2 size={14} className="text-emerald-400" />
    },
    {
      id: 'n3',
      title: 'Zero-Knowledge Guard Active',
      desc: 'All key slots secured with AES-GCM-256 and Argon2id KDF.',
      time: '5m ago',
      icon: <ShieldCheck size={14} className="text-indigo-400" />
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full sm:w-[380px] bg-[#161412] border-l border-white/20 h-full p-5 flex flex-col justify-between shadow-2xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-pink-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Notifications
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          <div className="space-y-2.5">
            {notifications.map((item) => (
              <div
                key={item.id}
                className="p-3.5 bg-[#000000] border border-white/15 rounded-[18px] space-y-1 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    {item.icon}
                    <span>{item.title}</span>
                  </div>
                  <span className="text-[10px] font-mono text-white/40">{item.time}</span>
                </div>
                <p className="text-[11px] text-white/70 leading-relaxed font-mono">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-[14px] bg-[#000000] border border-white/20 text-xs font-mono font-bold text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
