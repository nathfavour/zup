'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';

interface ActionTileProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  actionLabel: string;
  accentColor?: string; // e.g. '#10B981', '#EC4899', '#6366F1'
  onClick: () => void;
  active?: boolean;
}

export function ActionTile({
  icon,
  title,
  description,
  badge,
  actionLabel,
  accentColor = '#6366F1',
  onClick,
  active = false
}: ActionTileProps) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`p-4 bg-[#161412] rounded-[22px] shadow-xl flex flex-col justify-between gap-3 transition-all cursor-pointer group text-left ${
        active
          ? 'border-2 shadow-[0_0_16px_rgba(16,185,129,0.25)]'
          : 'border border-white/20 hover:border-white/50 hover:bg-[#1C1A18]'
      }`}
      style={active ? { borderColor: accentColor } : {}}
    >
      {/* Top: Inset Icon Well + Title + Subtitle + Optional Badge */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
          style={{
            backgroundColor: `${accentColor}18`,
            borderColor: `${accentColor}40`,
            color: accentColor
          }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="text-white font-bold text-sm tracking-tight truncate m-0 group-hover:text-white">
              {title}
            </h4>
            {badge && (
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold border"
                style={{
                  backgroundColor: `${accentColor}22`,
                  borderColor: `${accentColor}44`,
                  color: accentColor
                }}
              >
                {badge}
              </span>
            )}
          </div>
          <p className="text-white font-medium text-xs m-0 mt-0.5 truncate opacity-80">
            {description}
          </p>
        </div>
      </div>

      {/* Bottom: Crisp Hairline Divider + Action CTA + Chevron */}
      <div
        className="flex items-center justify-between text-xs font-mono border-t border-white/10 pt-2 transition-colors"
        style={{ color: accentColor }}
      >
        <span className="font-semibold">{actionLabel}</span>
        <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );
}
