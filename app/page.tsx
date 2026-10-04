'use client';

import React, { useState, useEffect } from 'react';
import { seedDatabaseIfEmpty } from '@/lib/db';
import { relayManager } from '@/lib/workers/relay-manager';
import {
  getSessionState,
  subscribeSession,
  lockVault,
  unlockVault,
  SessionState
} from '@/lib/state/session';
import { tursoSync } from '@/lib/sync/turso-sync';
import { LocalEvent } from '@/lib/core/types';
import { formatHex } from '@/lib/core/nostr';

// View Components
import { FeedView } from '@/components/feed/FeedView';
import { VaultView } from '@/components/vault/VaultView';
import { RelaysView } from '@/components/relays/RelaysView';
import { TelemetryView } from '@/components/telemetry/TelemetryView';
import { SyncView } from '@/components/sync/SyncView';
import { CliView } from '@/components/cli/CliView';

// Modals / Drawers
import { InspectRawSidebar } from '@/components/modals/InspectRawSidebar';
import { ComposeDispatchModal } from '@/components/modals/ComposeDispatchModal';
import { CommandPalette } from '@/components/modals/CommandPalette';

// Icons
import {
  Layers,
  Key,
  Radio,
  Activity,
  Cloud,
  Terminal,
  Send,
  Lock,
  Unlock,
  Command,
  ShieldCheck,
  UserCheck,
  Wifi
} from 'lucide-react';

type TabType = 'feed' | 'vault' | 'relays' | 'telemetry' | 'sync' | 'cli';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [session, setSession] = useState<SessionState>(getSessionState());
  const [inspectEvent, setInspectEvent] = useState<LocalEvent | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize DB and background relay manager
  useEffect(() => {
    async function initApp() {
      await seedDatabaseIfEmpty();
      relayManager.init();
      setIsInitialized(true);
    }
    initApp();

    const unsubSession = subscribeSession(setSession);
    return unsubSession;
  }, []);

  // Global Keyboard Navigation (1-6, n, l, Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently inside an input, textarea, or contentEditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (e.key === '1') setActiveTab('feed');
      if (e.key === '2') setActiveTab('vault');
      if (e.key === '3') setActiveTab('relays');
      if (e.key === '4') setActiveTab('telemetry');
      if (e.key === '5') setActiveTab('sync');
      if (e.key === '6') setActiveTab('cli');

      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsComposeOpen(true);
      }
      if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        lockVault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navItems: { id: TabType; label: string; shortcut: string; icon: React.ReactNode; color: string }[] = [
    { id: 'feed', label: 'Feeds', shortcut: '1', icon: <Layers size={14} />, color: '#EC4899' },
    { id: 'vault', label: 'Vault', shortcut: '2', icon: <Key size={14} />, color: '#10B981' },
    { id: 'relays', label: 'Relays', shortcut: '3', icon: <Radio size={14} />, color: '#F59E0B' },
    { id: 'telemetry', label: 'Telemetry', shortcut: '4', icon: <Activity size={14} />, color: '#6366F1' },
    { id: 'sync', label: 'Cloud Sync', shortcut: '5', icon: <Cloud size={14} />, color: '#6366F1' },
    { id: 'cli', label: 'CLI Shell', shortcut: '6', icon: <Terminal size={14} />, color: '#6366F1' }
  ];

  return (
    <div className="min-h-screen bg-[#161412] text-white flex flex-col font-sans selection:bg-pink-500/30 selection:text-white">
      {/* 
        Top Bar Contract (Section 2 & OpenBricks 4.0 Standard):
        [Brand wordmark] — [4-6 single-line nav tabs] — [1-2 primary actions]
        borderBottom: 1px solid rgba(255, 255, 255, 0.18) to 0.22 with pitch black surface #000000
      */}
      <header className="sticky top-0 z-40 bg-[#000000] border-b border-white/20 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Zone 1: Single element brand wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setActiveTab('feed')}
            className="flex items-center gap-2 text-left group"
          >
            <span className="text-xl font-black tracking-tight text-white group-hover:text-pink-400 transition-colors">
              zup
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
          </button>
        </div>

        {/* Zone 2: Navigation Links (Single-Line segmented buttons with feature highlight borders) */}
        <nav className="hidden md:flex items-center gap-1.5 p-1 bg-[#161412] border border-white/15 rounded-[16px]">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#000000] text-white shadow-md'
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04]'
                }`}
                style={
                  isActive
                    ? {
                        border: `2px solid ${item.color}`,
                        boxShadow: `0 0 12px ${item.color}33`
                      }
                    : { border: '1px solid transparent' }
                }
              >
                <span className="shrink-0">{item.icon}</span>
                <span>{item.label}</span>
                <span className="text-[9px] font-mono text-white/40 hidden lg:inline">[{item.shortcut}]</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Actions (Lock Status + Compose + Cmd+K) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Active Identity Badge / Vault Lock */}
          <button
            onClick={() => {
              if (session.isUnlocked) {
                lockVault();
              } else {
                setActiveTab('vault');
              }
            }}
            title={session.isUnlocked ? 'Vault Unlocked: Click to Lock RAM' : 'Vault Locked: Click to Unlock'}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-[12px] text-xs font-mono font-bold border transition-colors ${
              session.isUnlocked
                ? 'bg-[#161412] border-emerald-500/40 text-emerald-400 hover:border-red-400 hover:text-red-300'
                : 'bg-[#161412] border-amber-500/40 text-amber-300 hover:border-emerald-400'
            }`}
          >
            {session.isUnlocked ? <Unlock size={13} /> : <Lock size={13} />}
            <span className="truncate max-w-[120px]">
              {session.activeIdentity?.label || 'Vault'}
            </span>
          </button>

          {/* Quick Command Palette Button */}
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            title="Command Palette (Cmd+K)"
            className="p-1.5 rounded-[12px] bg-[#161412] border border-white/20 hover:border-white/50 text-white transition-colors"
          >
            <Command size={14} />
          </button>

          {/* Compose Dispatch CTA */}
          <button
            onClick={() => setIsComposeOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[12px] bg-pink-500 hover:bg-pink-400 text-black font-bold font-mono text-xs transition-colors shadow-lg shadow-pink-500/20 whitespace-nowrap cursor-pointer"
          >
            <Send size={13} />
            <span className="hidden sm:inline">Dispatch</span>
            <span className="text-[10px] opacity-75 hidden sm:inline">[N]</span>
          </button>
        </div>
      </header>

      {/* Mobile Secondary Tab Navigation Strip */}
      <div className="md:hidden flex items-center gap-1 p-2 bg-[#000000] border-b border-white/10 overflow-x-auto text-xs font-bold shrink-0">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1 px-3 py-1 rounded-[10px] whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? 'bg-[#161412] text-white border'
                  : 'text-white/60 hover:text-white'
              }`}
              style={isActive ? { borderColor: item.color } : {}}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Workspace Canvas Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 min-w-0">
        {activeTab === 'feed' && (
          <FeedView
            onInspectEvent={(event) => setInspectEvent(event)}
            onOpenComposer={() => setIsComposeOpen(true)}
          />
        )}
        {activeTab === 'vault' && <VaultView />}
        {activeTab === 'relays' && <RelaysView />}
        {activeTab === 'telemetry' && <TelemetryView />}
        {activeTab === 'sync' && <SyncView />}
        {activeTab === 'cli' && <CliView />}
      </main>

      {/* Tactical Right Sidebar: Cryptographic Inspector */}
      {inspectEvent && (
        <InspectRawSidebar
          event={inspectEvent}
          onClose={() => setInspectEvent(null)}
        />
      )}

      {/* Compose Dispatch Modal / Drawer */}
      <ComposeDispatchModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onPublished={() => {}}
      />

      {/* Cmd+K Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(tab) => setActiveTab(tab)}
        onCompose={() => setIsComposeOpen(true)}
        onLockVault={() => lockVault()}
        onSync={async () => {
          await tursoSync.executeDeltaSync();
          setActiveTab('sync');
        }}
      />
    </div>
  );
}
