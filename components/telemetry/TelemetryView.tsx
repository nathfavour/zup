'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { UserTelemetry } from '@/lib/core/types';
import { formatHex } from '@/lib/core/nostr';
import { Activity, Download, Trash2, ShieldCheck, Eye, Code2, Tag, Zap } from 'lucide-react';

export function TelemetryView() {
  const [telemetry, setTelemetry] = useState<UserTelemetry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTelemetry = async () => {
    try {
      const records = await db.telemetry.orderBy('timestamp').reverse().toArray();
      setTelemetry(records);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    db.telemetry
      .orderBy('timestamp')
      .reverse()
      .toArray()
      .then((records) => {
        if (active) {
          setTelemetry(records);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleClear = async () => {
    if (confirm('Clear all local telemetry records from Dexie IndexedDB?')) {
      await db.telemetry.clear();
      await loadTelemetry();
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(telemetry, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `zup-telemetry-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Heuristic Topic Affinity Ranking (Section 7)
  const tagScores = new Map<string, number>();
  telemetry.forEach((t) => {
    const weight = t.interactionType === 'inspect_raw' ? 5 : t.interactionType === 'dwell' ? Math.min(Math.round((t.dwellTimeMs || 1000) / 1000), 10) : 2;
    const tags = (t.metadata?.tags as string[]) || [];
    tags.forEach((tag) => {
      tagScores.set(tag, (tagScores.get(tag) || 0) + weight);
    });
  });

  const sortedAffinities = Array.from(tagScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maxAffinity = sortedAffinities.length > 0 ? sortedAffinities[0][1] : 1;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 bg-[#000000] border border-white/20 rounded-[22px] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Activity size={14} /> Edge Behavior Profiler
            </span>
            <span className="text-[11px] font-mono text-white/50">· Section 7 Engine</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Local Interaction Telemetry & Topic Affinity
          </h2>
          <p className="text-xs text-white opacity-80 max-w-xl">
            Logged directly into Dexie IndexedDB. Tracks dwell times (&gt;800ms) and cryptographic inspections to synthesize client-side heuristic feed ranking without external data leakage.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-[14px] bg-[#161412] hover:bg-white/10 border border-white/20 text-white font-mono text-xs font-bold transition-all"
          >
            <Download size={13} />
            <span>Export JSON</span>
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-[14px] bg-[#161412] hover:bg-red-950/40 border border-white/20 hover:border-red-400 text-white font-mono text-xs font-bold transition-all"
          >
            <Trash2 size={13} className="text-red-400" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Heuristic Topic Affinity Dashboard */}
      <div className="p-5 bg-[#000000] border border-white/20 rounded-[22px] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider flex items-center gap-2">
            <Tag size={14} className="text-indigo-400" />
            Client-Side Topic Affinity Scores (Section 7)
          </h3>
          <span className="text-[11px] font-mono text-white/50">Calculated from dwell & inspect actions</span>
        </div>

        {sortedAffinities.length === 0 ? (
          <p className="text-xs font-mono text-white/50 py-2">
            No topic dwell interactions logged yet. Browse technical dispatches in the feed to calibrate local affinities.
          </p>
        ) : (
          <div className="space-y-2.5">
            {sortedAffinities.map(([tag, score]) => {
              const pct = Math.round((score / maxAffinity) * 100);
              return (
                <div key={tag} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-white font-bold">#{tag}</span>
                    <span className="text-indigo-400 tabular-nums font-bold">{score} pts ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 bg-[#161412] rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Raw Telemetry Records Table */}
      <div className="p-5 bg-[#000000] border border-white/20 rounded-[22px] space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <span className="text-xs font-bold font-mono text-white uppercase tracking-wider">
            Raw Telemetry Table ({telemetry.length} records)
          </span>
          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
            <ShieldCheck size={12} /> Stored in Browser Only
          </span>
        </div>

        {loading ? (
          <div className="p-4 text-center font-mono text-xs text-white/60">Loading...</div>
        ) : telemetry.length === 0 ? (
          <div className="p-6 text-center font-mono text-xs text-white/50">Zero records logged.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 text-white/50 text-[11px]">
                  <th className="pb-2">Timestamp</th>
                  <th className="pb-2">Interaction</th>
                  <th className="pb-2">Event ID</th>
                  <th className="pb-2">Dwell Time</th>
                  <th className="pb-2">Metadata</th>
                  <th className="pb-2 text-right">Replication</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white">
                {telemetry.slice(0, 20).map((record) => {
                  const dateStr = new Date(record.timestamp).toLocaleTimeString([], {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });

                  return (
                    <tr key={record.id} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 text-white/60">{dateStr}</td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 text-[10px] font-bold border border-indigo-500/30">
                          {record.interactionType}
                        </span>
                      </td>
                      <td className="py-2.5 font-bold text-white/80">
                        {record.eventId ? formatHex(record.eventId, 8, 4) : '—'}
                      </td>
                      <td className="py-2.5 tabular-nums text-emerald-400">
                        {record.dwellTimeMs ? `${(record.dwellTimeMs / 1000).toFixed(1)}s` : '—'}
                      </td>
                      <td className="py-2.5 text-white/60 truncate max-w-[200px]">
                        {record.metadata ? JSON.stringify(record.metadata) : '—'}
                      </td>
                      <td className="py-2.5 text-right text-white/50">
                        {record.syncedAt ? '✓ LibSQL' : 'Local'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
