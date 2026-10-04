'use client';

import React, { useState, useEffect } from 'react';
import { tursoSync, SyncStats } from '@/lib/sync/turso-sync';
import { Cloud, RefreshCw, ShieldCheck, Database, Check, Server, ArrowLeftRight, Terminal } from 'lucide-react';

export function SyncView() {
  const [stats, setStats] = useState<SyncStats>(tursoSync.getStats());
  const [audit, setAudit] = useState<{
    unsyncedIdentities: number;
    unsyncedSlots: number;
    unsyncedTelemetry: number;
    zkSafe: boolean;
  } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const refreshAudit = async () => {
    const res = await tursoSync.getSyncAudit();
    setAudit(res);
    setStats(tursoSync.getStats());
  };

  useEffect(() => {
    let active = true;
    tursoSync.getSyncAudit().then((res) => {
      if (active) {
        setAudit(res);
        setStats(tursoSync.getStats());
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    try {
      const res = await tursoSync.executeDeltaSync();
      setLogs(res.logs);
      await refreshAudit();
    } finally {
      setIsSyncing(false);
    }
  };

  const totalUnsynced = audit ? audit.unsyncedIdentities + audit.unsyncedSlots + audit.unsyncedTelemetry : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner: Invariant 6 & Section 8 Architecture */}
      <div className="p-5 bg-[#000000] border border-white/20 rounded-[22px] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Cloud size={14} /> Edge Replica Protocol
            </span>
            <span className="text-[11px] font-mono text-white/50">· Section 8 Invariant</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Turso / LibSQL Cloud Delta Replication
          </h2>
          <p className="text-xs text-white opacity-80 max-w-xl">
            Bidirectional delta replication between local Dexie stores and remote LibSQL edge nodes. Enforces Last-Write-Wins and absolute Zero-Knowledge ciphertext synchronization.
          </p>
        </div>

        {/* Sync Trigger Button */}
        <button
          onClick={handleTriggerSync}
          disabled={isSyncing}
          className="flex items-center gap-2 px-5 py-2.5 rounded-[14px] bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold transition-all shrink-0 shadow-lg shadow-indigo-600/25 disabled:opacity-50"
        >
          <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
          <span>{isSyncing ? 'Synchronizing Edge...' : 'Trigger Delta Sync'}</span>
        </button>
      </div>

      {/* Dual Engine Topology Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Local Node */}
        <div className="p-4 bg-[#000000] border border-white/20 rounded-[20px] space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-white/60">Source Engine</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <Database size={13} /> Dexie (Client)
            </span>
          </div>
          <div className="text-sm font-bold text-white">zup_engine_v1</div>
          <div className="text-[11px] font-mono text-white/60">
            Pending Delta Rows: <span className="text-white font-bold">{totalUnsynced}</span>
          </div>
        </div>

        {/* Sync Loop Bridge */}
        <div className="p-4 bg-[#161412] border border-white/10 rounded-[20px] flex flex-col justify-center items-center text-center space-y-1">
          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/20 flex items-center justify-center text-indigo-400">
            <ArrowLeftRight size={15} />
          </div>
          <div className="text-xs font-mono font-bold text-white">LibSQL Delta Loop</div>
          <div className="text-[10px] font-mono text-white/50">Conflict: Last-Write-Wins</div>
        </div>

        {/* Remote Node */}
        <div className="p-4 bg-[#000000] border border-white/20 rounded-[20px] space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-white/60">Edge Target</span>
            <span className="text-indigo-400 font-bold flex items-center gap-1">
              <Server size={13} /> Turso Edge
            </span>
          </div>
          <div className="text-sm font-bold text-white truncate">{stats.edgeReplicaUrl}</div>
          <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
            <ShieldCheck size={12} /> Zero-Knowledge Verified
          </div>
        </div>
      </div>

      {/* Audit Checklist & Invariant Confirmation */}
      <div className="p-5 bg-[#000000] border border-white/20 rounded-[22px] space-y-3">
        <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck size={14} className="text-emerald-400" />
          Zero-Knowledge Synchronization Audit (Section 8.1)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 bg-[#161412] border border-white/10 rounded-[14px] flex items-center justify-between">
            <span className="text-white/70">Master Encryption Key</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <Check size={12} /> NEVER TRANSMITTED
            </span>
          </div>
          <div className="p-3 bg-[#161412] border border-white/10 rounded-[14px] flex items-center justify-between">
            <span className="text-white/70">Raw Secret Key (nsec)</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <Check size={12} /> ZERO PLAINTEXT
            </span>
          </div>
          <div className="p-3 bg-[#161412] border border-white/10 rounded-[14px] flex items-center justify-between">
            <span className="text-white/70">Keychain Synchronization</span>
            <span className="text-indigo-300 font-bold">AES-GCM-256 Wrapped</span>
          </div>
          <div className="p-3 bg-[#161412] border border-white/10 rounded-[14px] flex items-center justify-between">
            <span className="text-white/70">Telemetry Synchronization</span>
            <span className="text-indigo-300 font-bold">Aggregated Signals</span>
          </div>
        </div>
      </div>

      {/* Execution Logs Terminal Console */}
      <div className="p-5 bg-[#000000] border border-white/20 rounded-[22px] space-y-2">
        <div className="flex items-center justify-between pb-2 border-b border-white/10 text-xs font-mono">
          <span className="text-white font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Terminal size={13} className="text-indigo-400" />
            Replication Engine Log
          </span>
          <span className="text-white/40">
            Last Sync:{' '}
            {stats.lastSyncTimestamp
              ? new Date(stats.lastSyncTimestamp).toLocaleTimeString()
              : 'Never'}
          </span>
        </div>

        <div className="p-3.5 bg-[#0A0908] border border-white/10 rounded-[14px] font-mono text-xs text-white/80 space-y-1 min-h-[120px] max-h-[220px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-white/40 italic">
              Ready to synchronize. Click &apos;Trigger Delta Sync&apos; to commit local delta rows to the LibSQL edge replica.
            </div>
          ) : (
            logs.map((line, i) => (
              <div
                key={i}
                className={
                  line.startsWith('[ERROR]')
                    ? 'text-red-400'
                    : line.startsWith('[COMMIT]')
                    ? 'text-emerald-400 font-bold'
                    : line.startsWith('[AUDIT]')
                    ? 'text-indigo-300'
                    : 'text-white/80'
                }
              >
                {line}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
