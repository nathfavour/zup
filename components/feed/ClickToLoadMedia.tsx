'use client';

import React, { useState } from 'react';
import { Eye, ShieldAlert, Image as ImageIcon, Check } from 'lucide-react';

interface ClickToLoadMediaProps {
  url: string;
  alt?: string;
  byteEstimate?: string;
}

export function ClickToLoadMedia({ url, alt = 'External Nostr Media', byteEstimate = '48 KB' }: ClickToLoadMediaProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Extract hostname safely
  let host = 'external-cdn';
  try {
    host = new URL(url).hostname;
  } catch {}

  if (isLoaded) {
    if (loadError) {
      return (
        <div className="p-3 my-2 bg-[#000000] border border-red-500/40 rounded-[16px] text-xs font-mono text-white flex items-center gap-2">
          <ShieldAlert size={14} className="text-red-400 shrink-0" />
          <span>Blocked / Failed to load media from {host}. Invariant 5 respected.</span>
        </div>
      );
    }

    return (
      <div className="my-2.5 rounded-[16px] overflow-hidden border border-white/20 bg-[#000000] p-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setLoadError(true)}
          className="w-full max-h-[460px] object-contain rounded-[12px] bg-black"
          loading="lazy"
        />
        <div className="px-2 py-1 text-[10px] font-mono text-white/60 flex items-center justify-between border-t border-white/10 mt-1">
          <span>Source: {host}</span>
          <span className="flex items-center gap-1 text-emerald-400 font-semibold">
            <Check size={10} /> Hydrated on-demand
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setIsLoaded(true);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation();
          setIsLoaded(true);
        }
      }}
      className="my-2.5 p-3.5 bg-[#000000] border border-white/20 hover:border-amber-400/50 hover:bg-[#0A0908] rounded-[16px] cursor-pointer transition-all flex items-center justify-between gap-3 group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center shrink-0">
          <ImageIcon size={15} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white font-mono truncate">
              [External Media Blocked · {host}]
            </span>
          </div>
          <p className="text-[11px] text-white/70 font-mono m-0 truncate">
            Bandwidth Gate: Click to hydrate (~{byteEstimate})
          </p>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs font-mono font-semibold text-white group-hover:bg-amber-400/20 group-hover:border-amber-400/40 group-hover:text-amber-300 transition-colors">
        <Eye size={12} />
        <span>Load Media</span>
      </div>
    </div>
  );
}
