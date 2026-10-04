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
import { LocalEvent, RelayStatus } from '@/lib/core/types';
import { formatHex } from '@/lib/core/nostr';

// View Components
import { FeedView } from '@/components/feed/FeedView';
import { NewDispatchView } from '@/components/feed/NewDispatchView';
import { ProfileView } from '@/components/profile/ProfileView';
import { SettingsView } from '@/components/settings/SettingsView';

// Modals / Drawers
import { InspectRawSidebar } from '@/components/modals/InspectRawSidebar';
import { NotificationsDrawer } from '@/components/notifications/NotificationsDrawer';
import { CommandPalette } from '@/components/modals/CommandPalette';

// Icons
import {
  Layers,
  Plus,
  User,
  Settings,
  Bell,
  Lock,
  Unlock,
  Radio,
  Command
} from 'lucide-react';

type TabType = 'feed' | 'new' | 'profile' | 'settings';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [session, setSession] = useState<SessionState>(getSessionState());
  const [inspectEvent, setInspectEvent] = useState<LocalEvent | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [relaysList, setRelaysList] = useState<RelayStatus[]>(relayManager.getStatusList());

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

  // Keyboard shortcut listener (Cmd+K, 1-3, etc.)
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
      if (e.key === '2' || e.key.toLowerCase() === 'n') setActiveTab('new');
      if (e.key === '3') setActiveTab('profile');
      if (e.key === '4') setActiveTab('settings');
      if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        lockVault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const connectedRelaysCount = relaysList.filter((r) => r.status === 'connected').length;

  return (
    <div className="min-h-screen bg-[#161412] text-white flex flex-col font-sans selection:bg-pink-500/30 selection:text-white">
      {/* 
        Topbar: Anchored to the top, but with two bottom rounded corners (rounded-b-[20px])
        Edge-anchored, clean, human-first: 'zup' on left, notification icon + profile circle on top right
      */}
      <header className="sticky top-0 z-40 bg-[#000000] border-b border-white/20 rounded-b-[20px] px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-xl">
        {/* Left: Brand mark */}
        <button
          onClick={() => setActiveTab('feed')}
          className="flex items-center gap-2 group cursor-pointer"
        >
          <span className="text-xl font-black tracking-tight text-white group-hover:text-pink-400 transition-colors">
            zup
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
        </button>

        {/* Right: Notifications + Profile circle */}
        <div className="flex items-center gap-3">
          {/* Relay status pill */}
          <button
            onClick={() => setActiveTab('settings')}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-[12px] bg-[#161412] border border-white/15 text-[11px] font-mono text-white/70 hover:border-amber-400 hover:text-white transition-colors cursor-pointer"
            title="Relay Connection Pool"
          >
            <Radio size={12} className="text-amber-400" />
            <span className="tabular-nums font-semibold">{connectedRelaysCount}/{relaysList.length} Relays</span>
          </button>

          {/* Notifications Bell */}
          <button
            onClick={() => setIsNotificationsOpen(true)}
            title="Notifications"
            className="p-2 rounded-full bg-[#161412] border border-white/20 hover:border-pink-500 text-white transition-colors relative cursor-pointer"
          >
            <Bell size={15} />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.8)]" />
          </button>

          {/* Profile Avatar Circle */}
          <button
            onClick={() => setActiveTab('profile')}
            title="Go to Profile"
            className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-indigo-600 p-0.5 shadow-md cursor-pointer hover:scale-105 transition-transform"
          >
            <div className="w-full h-full rounded-full bg-[#161412] flex items-center justify-center text-white font-bold text-xs font-mono">
              {session.activeIdentity?.label.slice(0, 2).toUpperCase() || 'OP'}
            </div>
          </button>
        </div>
      </header>

      {/* Main Container: Desktop Left Sidebar + Central Viewport */}
      <div className="flex-1 flex max-w-[1500px] w-full mx-auto">
        {/* 
          Desktop Left Sidebar (Desktop Only: hidden md:flex)
          Anchored to the left edge, with two right rounded corners (rounded-r-[24px])
        */}
        <aside className="hidden md:flex flex-col justify-between w-60 lg:w-64 shrink-0 bg-[#161412] border-r border-white/20 rounded-r-[24px] p-5 my-3 shadow-xl">
          <div className="space-y-4">
            {/* New Dispatch Primary Button */}
            <button
              onClick={() => setActiveTab('new')}
              className="w-full py-2.5 px-4 rounded-[16px] bg-pink-500 hover:bg-pink-400 text-black font-bold font-mono text-xs transition-all flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(236,72,153,0.3)] cursor-pointer"
            >
              <Plus size={16} className="stroke-[2.5]" />
              <span>New Dispatch</span>
            </button>

            {/* Navigation Links: Feed, New, Profile, Settings */}
            <nav className="space-y-1.5 pt-2">
              <button
                onClick={() => setActiveTab('feed')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[16px] text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'feed'
                    ? 'bg-[#000000] text-pink-400 border border-pink-500 shadow-md'
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <Layers size={17} />
                <span>Feed</span>
              </button>

              <button
                onClick={() => setActiveTab('new')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[16px] text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'new'
                    ? 'bg-[#000000] text-pink-400 border border-pink-500 shadow-md'
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <Plus size={17} />
                <span>New</span>
              </button>

              <button
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[16px] text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'profile'
                    ? 'bg-[#000000] text-pink-400 border border-pink-500 shadow-md'
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <User size={17} />
                <span>Profile</span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[16px] text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-[#000000] text-pink-400 border border-pink-500 shadow-md'
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <Settings size={17} />
                <span>Settings</span>
              </button>
            </nav>
          </div>

          {/* Sidebar Footer: Active Persona & Vault Lock Toggle */}
          <div className="pt-4 border-t border-white/10 space-y-2">
            <div className="p-3 bg-[#000000] border border-white/15 rounded-[16px] space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-white/50">
                <span>Persona</span>
                <button
                  onClick={() => {
                    if (session.isUnlocked) {
                      lockVault();
                    } else {
                      setActiveTab('settings');
                    }
                  }}
                  className={`flex items-center gap-1 font-bold ${
                    session.isUnlocked ? 'text-emerald-400 hover:text-red-300' : 'text-amber-400'
                  }`}
                  title={session.isUnlocked ? 'Vault unlocked. Click to lock RAM' : 'Vault locked. Click to unlock'}
                >
                  {session.isUnlocked ? <Unlock size={11} /> : <Lock size={11} />}
                  <span>{session.isUnlocked ? 'Lock' : 'Unlock'}</span>
                </button>
              </div>
              <div className="text-xs font-bold text-white truncate">
                {session.activeIdentity?.label || 'Personal'}
              </div>
              <div className="text-[10px] font-mono text-white/40 truncate">
                {session.activeIdentity ? formatHex(session.activeIdentity.pubkey, 8, 4) : '—'}
              </div>
            </div>

            <div className="text-[11px] font-mono text-white/40 text-center">
              Shortcuts: <kbd className="text-white/60">Cmd+K</kbd>
            </div>
          </div>
        </aside>

        {/* Central Content Area */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-5 pb-28 md:pb-8">
          {activeTab === 'feed' && (
            <FeedView
              onInspectEvent={(event) => setInspectEvent(event)}
              onOpenComposer={() => setActiveTab('new')}
            />
          )}

          {activeTab === 'new' && (
            <NewDispatchView
              onPublished={() => setActiveTab('feed')}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView
              onOpenSettings={() => setActiveTab('settings')}
              onInspectEvent={(event) => setInspectEvent(event)}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              onBack={() => setActiveTab('profile')}
            />
          )}
        </main>
      </div>

      {/* 
        Mobile Fixed Bottom Navigation Bar (Mobile Only: md:hidden)
        Anchored to the bottom edge, with two top rounded corners (rounded-t-[24px])
        Contains: Feed, centralized '+' button for create, Profile, Settings
      */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#000000] border-t-2 border-white/20 rounded-t-[24px] px-8 py-2 flex items-center justify-between shadow-2xl">
        {/* Feed Tab */}
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
            activeTab === 'feed' ? 'text-pink-400 font-bold' : 'text-white/60 hover:text-white'
          }`}
        >
          <Layers size={20} />
          <span className="text-[10px] font-mono">Feed</span>
        </button>

        {/* Centralized Plus Button for New Dispatch */}
        <button
          onClick={() => setActiveTab('new')}
          title="New Dispatch"
          className="w-13 h-13 -mt-6 rounded-full bg-pink-500 hover:bg-pink-400 text-black flex items-center justify-center font-bold shadow-[0_0_18px_rgba(236,72,153,0.6)] border-2 border-[#161412] active:scale-95 transition-transform cursor-pointer shrink-0"
        >
          <Plus size={24} className="stroke-[3]" />
        </button>

        {/* Profile Tab */}
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
            activeTab === 'profile' ? 'text-pink-400 font-bold' : 'text-white/60 hover:text-white'
          }`}
        >
          <User size={20} />
          <span className="text-[10px] font-mono">Profile</span>
        </button>

        {/* Settings Tab */}
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
            activeTab === 'settings' ? 'text-pink-400 font-bold' : 'text-white/60 hover:text-white'
          }`}
        >
          <Settings size={20} />
          <span className="text-[10px] font-mono">Settings</span>
        </button>
      </nav>

      {/* Cryptographic Inspector Sidebar (Opens on Inspect click) */}
      {inspectEvent && (
        <InspectRawSidebar
          event={inspectEvent}
          onClose={() => setInspectEvent(null)}
        />
      )}

      {/* Notifications Drawer (Opens on Bell click) */}
      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        relaysOnlineCount={connectedRelaysCount}
      />

      {/* Global Command Palette (Cmd+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(tab) => {
          if (tab === 'feed' || tab === 'vault' || tab === 'relays' || tab === 'telemetry' || tab === 'sync') {
            if (tab === 'feed') setActiveTab('feed');
            else setActiveTab('settings');
          } else {
            setActiveTab('feed');
          }
        }}
        onCompose={() => setActiveTab('new')}
        onLockVault={() => lockVault()}
        onSync={() => setActiveTab('settings')}
      />
    </div>
  );
}
