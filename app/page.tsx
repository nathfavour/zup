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
import { LocalEvent, RelayStatus } from '@/lib/core/types';
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
  Plus,
  Lock,
  Unlock,
  Command,
  ShieldCheck,
  UserCheck,
  Wifi,
  MoreHorizontal,
  X
} from 'lucide-react';

type TabType = 'feed' | 'vault' | 'relays' | 'telemetry' | 'sync' | 'cli';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [session, setSession] = useState<SessionState>(getSessionState());
  const [inspectEvent, setInspectEvent] = useState<LocalEvent | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [relaysList, setRelaysList] = useState<RelayStatus[]>(relayManager.getStatusList());

  // Initialize DB and background relay manager
  useEffect(() => {
    async function initApp() {
      await seedDatabaseIfEmpty();
      relayManager.init();
    }
    initApp();

    const unsubSession = subscribeSession(setSession);
    const unsubRelays = relayManager.subscribeStatus(setRelaysList);
    return () => {
      unsubSession();
      unsubRelays();
    };
  }, []);

  // Global Keyboard Navigation (1-6, n, l, Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  const connectedRelaysCount = relaysList.filter((r) => r.status === 'connected').length;

  const sidebarItems: { id: TabType; label: string; shortcut: string; icon: React.ReactNode; color: string }[] = [
    { id: 'feed', label: 'Feeds', shortcut: '1', icon: <Layers size={16} />, color: '#EC4899' },
    { id: 'vault', label: 'Vault & Keys', shortcut: '2', icon: <Key size={16} />, color: '#10B981' },
    { id: 'relays', label: 'Relays Pool', shortcut: '3', icon: <Radio size={16} />, color: '#F59E0B' },
    { id: 'telemetry', label: 'Telemetry', shortcut: '4', icon: <Activity size={16} />, color: '#6366F1' },
    { id: 'sync', label: 'Cloud Sync', shortcut: '5', icon: <Cloud size={16} />, color: '#6366F1' },
    { id: 'cli', label: 'CLI Terminal', shortcut: '6', icon: <Terminal size={16} />, color: '#6366F1' }
  ];

  const getActiveTabTitle = () => {
    switch (activeTab) {
      case 'feed':
        return 'Technical Dispatches';
      case 'vault':
        return 'Singular Vault & Personas';
      case 'relays':
        return 'Relay Connection Pool';
      case 'telemetry':
        return 'Interaction Telemetry & Affinities';
      case 'sync':
        return 'Turso Edge Replication';
      case 'cli':
        return '@zup/cli Terminal';
    }
  };

  return (
    <div className="min-h-screen bg-[#161412] text-white flex flex-col font-sans selection:bg-pink-500/30 selection:text-white">
      {/* 
        Standard Topbar (OpenBricks 4.0 Standard: Single Clean Row, No redundant sub-rows)
        borderBottom: 1px solid rgba(255, 255, 255, 0.18) with pitch black #000000 surface
      */}
      <header className="sticky top-0 z-40 bg-[#000000] border-b border-white/20 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Left: Brand & Context Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-white">
              zup
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
          </div>
          <span className="text-white/30 hidden sm:inline">/</span>
          <span className="text-xs font-mono font-bold text-white/80 hidden sm:inline">
            {getActiveTabTitle()}
          </span>
        </div>

        {/* Right: Live Connection Indicator + Vault Badge + Cmd+K */}
        <div className="flex items-center gap-2.5">
          {/* Live Relays Count */}
          <button
            onClick={() => setActiveTab('relays')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[12px] bg-[#161412] border border-white/15 text-[11px] font-mono text-white/80 hover:border-amber-400 hover:text-white transition-colors"
            title="Click to view relay connection pool"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="tabular-nums font-semibold">{connectedRelaysCount}/{relaysList.length} Relays</span>
          </button>

          {/* Vault Lock / Unlock Badge */}
          <button
            onClick={() => {
              if (session.isUnlocked) {
                lockVault();
              } else {
                setActiveTab('vault');
              }
            }}
            title={session.isUnlocked ? 'Vault Unlocked: Click to Lock RAM' : 'Vault Locked: Click to Unlock'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[12px] text-[11px] font-mono font-bold border transition-colors ${
              session.isUnlocked
                ? 'bg-[#161412] border-emerald-500/40 text-emerald-400 hover:border-red-400 hover:text-red-300'
                : 'bg-[#161412] border-amber-500/40 text-amber-300 hover:border-emerald-400'
            }`}
          >
            {session.isUnlocked ? <Unlock size={12} /> : <Lock size={12} />}
            <span className="truncate max-w-[100px] sm:max-w-[130px]">
              {session.isUnlocked ? session.activeIdentity?.label || 'Unlocked' : 'Vault Locked'}
            </span>
          </button>

          {/* Command Palette Button */}
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            title="Command Palette (Cmd+K)"
            className="p-1.5 rounded-[12px] bg-[#161412] border border-white/20 hover:border-white/50 text-white transition-colors"
          >
            <Command size={14} />
          </button>
        </div>
      </header>

      {/* Main Layout Area: Desktop Left Sidebar + Central Viewport */}
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto">
        {/* 
          Desktop Left Sidebar (OpenBricks 4.0 Standard:
          borderRight: 1px solid rgba(255, 255, 255, 0.18), width ~240px-260px, opaque #161412)
        */}
        <aside className="hidden md:flex flex-col w-60 lg:w-64 shrink-0 bg-[#161412] border-r border-white/20 p-4 space-y-4">
          {/* Prominent Create Action in Sidebar */}
          <button
            onClick={() => setIsComposeOpen(true)}
            className="w-full py-2.5 px-4 rounded-[16px] bg-pink-500 hover:bg-pink-400 text-black font-bold font-mono text-xs transition-all flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(236,72,153,0.3)] cursor-pointer"
          >
            <Plus size={16} className="stroke-[2.5]" />
            <span>New Dispatch</span>
            <span className="text-[10px] opacity-75 font-mono ml-auto">[N]</span>
          </button>

          {/* Navigation Items */}
          <nav className="space-y-1.5 flex-1">
            {sidebarItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[14px] text-xs font-bold transition-all cursor-pointer text-left ${
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
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0" style={{ color: isActive ? item.color : 'inherit' }}>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-white/40">[{item.shortcut}]</span>
                </button>
              );
            })}
          </nav>

          {/* Bottom Card in Sidebar: Active Persona / Memory Status */}
          <div className="p-3 bg-[#000000] border border-white/20 rounded-[16px] space-y-1 text-xs font-mono">
            <div className="flex items-center justify-between text-[11px] text-white/50">
              <span>Persona</span>
              <span className={session.isUnlocked ? 'text-emerald-400' : 'text-amber-400'}>
                {session.isUnlocked ? 'RAM Live' : 'Evicted'}
              </span>
            </div>
            <div className="font-bold text-white truncate">
              {session.activeIdentity?.label || 'Personal'}
            </div>
            <div className="text-[10px] text-white/40 truncate">
              {session.activeIdentity ? formatHex(session.activeIdentity.pubkey, 8, 4) : '—'}
            </div>
          </div>
        </aside>

        {/* Central Scrollable Workspace Content */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-5 pb-28 md:pb-8">
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
      </div>

      {/* 
        Mobile Fixed Bottom Navigation Bar (OpenBricks 4.0 Standard:
        border-t-2 border-white/20, pitch-black #000000 surface, centralized plus button for create)
      */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#000000] border-t-2 border-white/20 px-3 py-1.5 flex items-center justify-around shadow-2xl">
        {/* Slot 1: Feeds */}
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-[12px] transition-colors ${
            activeTab === 'feed' ? 'text-pink-400' : 'text-white/60 hover:text-white'
          }`}
        >
          <Layers size={18} />
          <span className="text-[10px] font-mono font-bold">Feed</span>
        </button>

        {/* Slot 2: Vault */}
        <button
          onClick={() => setActiveTab('vault')}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-[12px] transition-colors ${
            activeTab === 'vault' ? 'text-emerald-400' : 'text-white/60 hover:text-white'
          }`}
        >
          <Key size={18} />
          <span className="text-[10px] font-mono font-bold">Vault</span>
        </button>

        {/* Slot 3: Centralized Floating Plus Button for Create */}
        <button
          onClick={() => setIsComposeOpen(true)}
          title="Create New Dispatch"
          className="w-12 h-12 -mt-5 rounded-full bg-pink-500 hover:bg-pink-400 text-black flex items-center justify-center font-bold shadow-[0_0_18px_rgba(236,72,153,0.6)] border-2 border-[#161412] active:scale-95 transition-transform shrink-0"
        >
          <Plus size={22} className="stroke-[3]" />
        </button>

        {/* Slot 4: Relays */}
        <button
          onClick={() => setActiveTab('relays')}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-[12px] transition-colors ${
            activeTab === 'relays' ? 'text-amber-400' : 'text-white/60 hover:text-white'
          }`}
        >
          <Radio size={18} />
          <span className="text-[10px] font-mono font-bold">Relays</span>
        </button>

        {/* Slot 5: Terminal / More Drawer */}
        <button
          onClick={() => setIsMobileMoreOpen(true)}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-[12px] transition-colors ${
            activeTab === 'cli' || activeTab === 'sync' || activeTab === 'telemetry'
              ? 'text-indigo-400'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <MoreHorizontal size={18} />
          <span className="text-[10px] font-mono font-bold">More</span>
        </button>
      </div>

      {/* Mobile "More" Drawer for CLI, Telemetry, and Cloud Sync */}
      {isMobileMoreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-xs">
          <div className="absolute inset-0" onClick={() => setIsMobileMoreOpen(false)} />
          <div className="relative z-10 bg-[#161412] border-t-2 border-white/20 rounded-t-[24px] p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Workspaces & Tools
              </span>
              <button
                onClick={() => setIsMobileMoreOpen(false)}
                className="p-1 rounded-lg bg-white/10 text-white/70"
              >
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <button
                onClick={() => {
                  setActiveTab('cli');
                  setIsMobileMoreOpen(false);
                }}
                className={`p-3 bg-[#000000] border rounded-[16px] flex flex-col items-center gap-1 text-center transition-colors ${
                  activeTab === 'cli' ? 'border-indigo-400 text-indigo-400' : 'border-white/15 text-white'
                }`}
              >
                <Terminal size={18} />
                <span className="text-[11px] font-mono font-bold">CLI Shell</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('telemetry');
                  setIsMobileMoreOpen(false);
                }}
                className={`p-3 bg-[#000000] border rounded-[16px] flex flex-col items-center gap-1 text-center transition-colors ${
                  activeTab === 'telemetry' ? 'border-indigo-400 text-indigo-400' : 'border-white/15 text-white'
                }`}
              >
                <Activity size={18} />
                <span className="text-[11px] font-mono font-bold">Telemetry</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('sync');
                  setIsMobileMoreOpen(false);
                }}
                className={`p-3 bg-[#000000] border rounded-[16px] flex flex-col items-center gap-1 text-center transition-colors ${
                  activeTab === 'sync' ? 'border-indigo-400 text-indigo-400' : 'border-white/15 text-white'
                }`}
              >
                <Cloud size={18} />
                <span className="text-[11px] font-mono font-bold">Cloud Sync</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
