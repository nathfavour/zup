'use client';

import React, { useState } from 'react';
import { VaultView } from '@/components/vault/VaultView';
import { RelaysView } from '@/components/relays/RelaysView';
import { SyncView } from '@/components/sync/SyncView';
import { TelemetryView } from '@/components/telemetry/TelemetryView';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ArrowLeft, Key, Radio, Cloud, ShieldCheck, Settings } from 'lucide-react';

interface SettingsViewProps {
  onBack: () => void;
  defaultSection?: 'vault' | 'relays' | 'sync' | 'privacy';
}

export function SettingsView({ onBack, defaultSection = 'vault' }: SettingsViewProps) {
  const [section, setSection] = useState<'vault' | 'relays' | 'sync' | 'privacy'>(defaultSection);

  const sections = [
    { value: 'vault', label: 'Vault & Keys', icon: <Key size={13} /> },
    { value: 'relays', label: 'Relays Pool', icon: <Radio size={13} /> },
    { value: 'sync', label: 'Cloud Sync', icon: <Cloud size={13} /> },
    { value: 'privacy', label: 'Privacy & Telemetry', icon: <ShieldCheck size={13} /> }
  ];

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Settings Top Navigation Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-[12px] bg-[#000000] border border-white/20 hover:border-white/40 text-white transition-colors cursor-pointer"
            title="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Settings size={16} className="text-pink-400" />
              Settings & Cryptographic Config
            </h2>
            <p className="text-xs font-mono text-white/50">
              Configure your local-first zero-knowledge parameters
            </p>
          </div>
        </div>

        {/* Section Switcher */}
        <SegmentedControl
          options={sections}
          value={section}
          onChange={(val) => setSection(val as any)}
          accentColor="#EC4899"
          size="sm"
        />
      </div>

      {/* Render Active Settings Sub-view */}
      <div>
        {section === 'vault' && <VaultView />}
        {section === 'relays' && <RelaysView />}
        {section === 'sync' && <SyncView />}
        {section === 'privacy' && <TelemetryView />}
      </div>
    </div>
  );
}
