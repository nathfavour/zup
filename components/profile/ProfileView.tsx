'use client';

import React, { useState, useEffect } from 'react';
import {
  getSessionState,
  setActiveIdentity,
  disconnectIdentity,
  SessionState,
  subscribeSession
} from '@/lib/state/session';
import { db } from '@/lib/db';
import { LocalEvent, UserTelemetry } from '@/lib/core/types';
import { formatHex } from '@/lib/core/nostr';
import {
  User,
  Settings,
  Copy,
  Check,
  ShieldCheck,
  Lock,
  Unlock,
  Key,
  Layers,
  Activity,
  LogOut,
  PlusCircle
} from 'lucide-react';

interface ProfileViewProps {
  onOpenSettings: () => void;
  onInspectEvent: (event: LocalEvent) => void;
  onConnect: () => void;
}

export function ProfileView({ onOpenSettings, onInspectEvent, onConnect }: ProfileViewProps) {
  const [session, setSession] = useState<SessionState>(getSessionState());
  const [userEvents, setUserEvents] = useState<LocalEvent[]>([]);
  const [telemetry, setTelemetry] = useState<UserTelemetry[]>([]);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    const unsub = subscribeSession(setSession);

    const loadUserData = async () => {
      const activePub = localStorage.getItem('zup:active_pubkey');
      const allEvents = await db.events.toArray();
      const myEvents = activePub
        ? allEvents.filter((e) => e.pubkey === activePub)
        : [];

      const tel = await db.telemetry.toArray();
      setUserEvents(myEvents);
      setTelemetry(tel);
    };

    loadUserData();
    return unsub;
  }, []);

  const active = session.activeIdentity;
  const npub = active?.npub || '';

  const handleCopyNpub = () => {
    if (!npub) return;
    navigator.clipboard.writeText(npub);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Derive top interests
  const topicCounts = new Map<string, number>();
  telemetry.forEach((t) => {
    const tags = (t.metadata?.tags as string[]) || [];
    tags.forEach((tag) => topicCounts.set(tag, (topicCounts.get(tag) || 0) + 1));
  });

  const topTopics = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  // If client is not connected to any identity
  if (!active) {
    return (
      <div className="space-y-6 max-w-xl mx-auto py-8">
        <div className="p-8 bg-[#000000] border border-white/20 rounded-[28px] text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-pink-500/10 border-2 border-pink-500/30 flex items-center justify-center mx-auto text-pink-400">
            <Key size={28} />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">
              No Nostr Identity Connected
            </h2>
            <p className="text-xs text-white/60 max-w-sm mx-auto leading-relaxed">
              Connect or generate a local Nostr persona to sign dispatches, calibrate topic affinities, and access your profile.
            </p>
          </div>

          <button
            onClick={onConnect}
            className="px-6 py-3 rounded-[16px] bg-pink-500 hover:bg-pink-400 text-black font-bold font-mono text-xs transition-all shadow-[0_0_16px_rgba(236,72,153,0.3)] cursor-pointer inline-flex items-center gap-2 active:scale-95"
          >
            <PlusCircle size={15} />
            <span>Connect or Create Identity</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Profile Header Card */}
      <div className="p-6 bg-[#000000] border border-white/20 rounded-[24px] space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Avatar Circle */}
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-pink-500 to-indigo-600 p-0.5 shadow-lg">
              <div className="w-full h-full rounded-full bg-[#161412] flex items-center justify-center text-white font-bold text-lg font-mono">
                {active.label.slice(0, 2).toUpperCase()}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {active.label}
                </h2>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <p className="text-xs font-mono text-white/50">
                Persona · Single Vault Architecture
              </p>
            </div>
          </div>

          {/* Actions: Settings & Disconnect */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => disconnectIdentity()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#161412] hover:bg-red-950/40 border border-white/20 hover:border-red-400 rounded-[14px] text-xs font-bold font-mono text-white transition-all cursor-pointer"
              title="Disconnect active identity"
            >
              <LogOut size={13} className="text-red-400" />
              <span>Disconnect</span>
            </button>

            <button
              onClick={onOpenSettings}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#161412] hover:bg-[#1E1C1A] border border-white/20 hover:border-pink-500 rounded-[14px] text-xs font-bold font-mono text-white transition-all shadow-md cursor-pointer"
            >
              <Settings size={14} className="text-pink-400" />
              <span>Settings</span>
            </button>
          </div>
        </div>

        {/* Public Key Bar */}
        <div className="p-3 bg-[#161412] border border-white/10 rounded-[16px] flex items-center justify-between gap-3 text-xs font-mono">
          <div className="min-w-0 flex items-center gap-2">
            <span className="text-pink-400 font-bold shrink-0">npub:</span>
            <span className="text-white/80 truncate">{npub}</span>
          </div>
          <button
            onClick={handleCopyNpub}
            title="Copy Public Key (npub)"
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white shrink-0 transition-colors cursor-pointer"
          >
            {copiedKey ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
        </div>

        {/* Persona Switcher Quick Row */}
        <div className="space-y-2 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between text-xs font-mono text-white/50">
            <span>Switch Active Persona:</span>
            <button
              onClick={onConnect}
              className="text-pink-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <PlusCircle size={12} />
              <span>Add / Import</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {session.identities.map((id) => {
              const isSelected = id.pubkey === session.activePubkey;
              return (
                <button
                  key={id.pubkey}
                  onClick={() => setActiveIdentity(id.pubkey)}
                  className={`p-3 rounded-[16px] text-left transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-[#161412] border-2 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                      : 'bg-[#000000] border border-white/15 hover:border-white/30 text-white/70'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{id.label}</div>
                    <div className="text-[10px] font-mono text-white/40 truncate">
                      {formatHex(id.pubkey, 8, 4)}
                    </div>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                      ACTIVE
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Activity & Interests Section */}
      {topTopics.length > 0 && (
        <div className="p-5 bg-[#000000] border border-white/20 rounded-[24px] space-y-3">
          <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Activity size={14} className="text-indigo-400" />
            Calibrated Topic Interests (Local Telemetry)
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {topTopics.map(([topic, count], idx) => (
              <span
                key={`profile-topic-${topic}-${idx}`}
                className="px-3 py-1 rounded-[12px] bg-[#161412] border border-white/15 text-xs font-mono text-white"
              >
                #{topic} <span className="text-pink-400 ml-1">· {count} reads</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Dispatches Authored by this Identity */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
          <Layers size={14} className="text-pink-400" />
          Dispatches Authored by Persona ({userEvents.length})
        </h3>

        {userEvents.length === 0 ? (
          <div className="p-8 text-center bg-[#000000] border border-white/20 rounded-[20px] text-xs font-mono text-white/50">
            No dispatches published under this persona yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {userEvents.map((ev) => (
              <div
                key={ev.id}
                onClick={() => onInspectEvent(ev)}
                className="p-4 bg-[#000000] border border-white/20 hover:border-white/40 rounded-[18px] cursor-pointer transition-colors space-y-2"
              >
                <div className="flex items-center justify-between text-xs font-mono text-white/50">
                  <span>{new Date(ev.created_at * 1000).toLocaleDateString()}</span>
                  <span>{formatHex(ev.id, 8, 4)}</span>
                </div>
                <p className="text-xs text-white leading-relaxed line-clamp-2">
                  {ev.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
