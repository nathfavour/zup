'use client';

import React from 'react';

interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string | number> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accentColor?: string; // hex or tailwind class
  size?: 'sm' | 'md';
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  accentColor = '#6366F1',
  size = 'md'
}: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex p-1 bg-[#000000] border border-white/20 rounded-[16px] gap-1 items-center max-w-full overflow-x-auto">
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex items-center gap-2 whitespace-nowrap transition-all rounded-[12px] font-semibold text-white ${
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-xs'
            } ${
              isActive
                ? 'bg-[#161412] border-2 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
                : 'bg-transparent border border-transparent hover:border-white/25 hover:bg-white/[0.04]'
            }`}
            style={
              isActive
                ? {
                    borderColor: accentColor,
                    boxShadow: `0 0 12px ${accentColor}33`
                  }
                : {}
            }
          >
            {option.icon && <span className="shrink-0">{option.icon}</span>}
            <span>{option.label}</span>
            {option.badge !== undefined && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-white font-bold">
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
