'use client';

import React from 'react';
import { Key, ShieldAlert, X, ArrowRight, PlusCircle } from 'lucide-react';

interface AccountRequiredDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: () => void;
  actionName?: string;
}

export function AccountRequiredDrawer({
  isOpen,
  onClose,
  onConnect,
  actionName = 'engage with dispatches'
}: AccountRequiredDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center items-center bg-black/80 backdrop-blur-xs animate-in fade-in duration-200 p-0 md:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer on Mobile, Centered Modal on Desktop */}
      <div className="relative z-10 w-full max-w-md bg-[#161412] border-t-2 md:border-2 border-white/20 rounded-t-[28px] md:rounded-[28px] p-6 shadow-2xl space-y-5 max-h-[60vh] overflow-y-auto">
        {/* Drag handle for mobile */}
        <div className="md:hidden w-12 h-1 bg-white/30 rounded-full mx-auto -mt-2 mb-3" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
            <Key size={24} />
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h3 className="text-base font-bold text-white tracking-tight">
            Nostr Account Required
          </h3>
          <p className="text-xs text-white/70 leading-relaxed">
            A cryptographic Nostr identity is required to {actionName}. Your reactions and dispatches are signed locally in your browser with zero-knowledge cryptography.
          </p>
        </div>

        {/* Benefit highlights */}
        <div className="p-3 bg-[#000000] border border-white/10 rounded-[18px] space-y-2 text-xs font-mono text-white/80">
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Generate keys locally in ~5 seconds</span>
          </div>
          <div className="flex items-center gap-2 text-pink-400">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
            <span>Zero email, phone, or passwords required</span>
          </div>
          <div className="flex items-center gap-2 text-indigo-400">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            <span>Censorship-resistant decentralized network</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-1">
          <button
            onClick={() => {
              onClose();
              onConnect();
            }}
            className="w-full py-3 rounded-[16px] bg-pink-500 hover:bg-pink-400 text-black font-bold font-mono text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-500/25 cursor-pointer active:scale-95"
          >
            <PlusCircle size={15} />
            <span>Connect or Create Identity</span>
            <ArrowRight size={14} />
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-[14px] bg-[#000000] hover:bg-white/5 border border-white/15 text-white/60 hover:text-white font-mono text-xs transition-colors cursor-pointer"
          >
            Continue Browsing (Read-only)
          </button>
        </div>
      </div>
    </div>
  );
}
