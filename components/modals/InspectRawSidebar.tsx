'use client';

import React, { useState, useEffect } from 'react';
import { LocalEvent } from '@/lib/core/types';
import { serializeEvent, validateEvent, formatHex } from '@/lib/core/nostr';
import { db } from '@/lib/db';
import {
  X,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  CheckCircle2,
  ShieldCheck,
  ExternalLink,
  Code2,
  Terminal,
  Activity
} from 'lucide-react';

interface InspectRawSidebarProps {
  event: LocalEvent | null;
  onClose: () => void;
}

export function InspectRawSidebar({ event, onClose }: InspectRawSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [validation, setValidation] = useState<{
    isValid: boolean;
    computedId: string;
    idMatches: boolean;
    sigValid: boolean;
  } | null>(null);

  useEffect(() => {
    if (!event) return;

    // Run real cryptographic event validation
    validateEvent(event).then((res) => {
      setValidation(res);
    });

    // Invariant: Log inspect_raw interaction directly to local IndexedDB telemetry table
    db.logTelemetry({
      pubkey: localStorage.getItem('zup:active_pubkey') || 'anonymous',
      eventId: event.id,
      targetPubkey: event.pubkey,
      interactionType: 'inspect_raw',
      metadata: {
        kind: event.kind,
        relaySource: event.relay_source
      }
    });
  }, [event]);

  if (!event) return null;

  const canonicalJson = serializeEvent({
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags,
    content: event.content
  });

  const formattedCanonical = JSON.stringify(JSON.parse(canonicalJson), null, 2);
  const sig = event.sig || '';
  const rPart = sig.slice(0, 64);
  const sPart = sig.slice(64, 128);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(formattedCanonical);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-auto bg-black/60 backdrop-blur-xs transition-opacity">
      {/* Backdrop click to dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Tactile Sidebar (OpenBricks 4.0: opaque #161412, border-l border-white/20, width 460px-560px on desktop, 60dvh on mobile) */}
      <div
        className={`relative z-10 w-full flex flex-col bg-[#161412] border-l border-white/20 shadow-2xl transition-all ${
          isExpanded ? 'md:w-[720px]' : 'md:w-[520px]'
        } max-md:h-[60dvh] max-md:mt-auto max-md:rounded-t-[24px] max-md:border-t max-md:border-l-0`}
      >
        {/* Top Header Bar: Order is Back/Title -> Pop Out -> Expand/Contract -> Close */}
        <div className="shrink-0 px-4 py-3 border-b border-white/10 flex items-center justify-between bg-[#161412]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-pink-500/15 border border-pink-500/30 text-pink-400 flex items-center justify-center shrink-0">
              <Code2 size={14} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider truncate">
                Cryptographic Inspector
              </h3>
              <p className="text-[10px] font-mono text-white/50 truncate">
                id: {formatHex(event.id, 8, 6)}
              </p>
            </div>
          </div>

          {/* Standardized 3-Slot Actions (Pop Out -> Expand/Contract -> Dismiss) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                const blob = new Blob([formattedCanonical], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
              }}
              title="Open raw payload in new window"
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            >
              <ExternalLink size={14} />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'Contract Viewport' : 'Expand Viewport'}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors hidden md:inline-flex"
            >
              {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              onClick={onClose}
              title="Close Inspector"
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body (Pitch black #000000 wells) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Validation Status Pill */}
          <div className="p-3.5 bg-[#000000] border border-white/20 rounded-[18px] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-white/60">SHA-256 Event Hash:</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                {validation?.idMatches ? (
                  <>
                    <CheckCircle2 size={13} /> VERIFIED
                  </>
                ) : (
                  'VALIDATING...'
                )}
              </span>
            </div>
            <div className="p-2 bg-[#0A0908] border border-white/10 rounded-[12px] font-mono text-[11px] text-white/90 break-all select-all">
              {event.id}
            </div>
          </div>

          {/* BIP-340 Schnorr Signature 64-byte breakdown */}
          <div className="p-3.5 bg-[#000000] border border-white/20 rounded-[18px] space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-white font-bold uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-400" />
                BIP-340 Schnorr Signature (64 Bytes)
              </span>
              <span className="text-emerald-400 text-[11px] font-bold">
                {validation?.sigValid ? '✓ Valid Signature' : 'Checking'}
              </span>
            </div>

            <div className="space-y-1.5 text-[11px] font-mono">
              <div>
                <span className="text-white/50 text-[10px] block">r Commitment (32 bytes / 64 hex chars):</span>
                <div className="p-1.5 bg-[#0A0908] border border-white/10 rounded-[10px] text-pink-300 break-all">
                  {rPart || '00'.repeat(32)}
                </div>
              </div>
              <div>
                <span className="text-white/50 text-[10px] block">s Scalar (32 bytes / 64 hex chars):</span>
                <div className="p-1.5 bg-[#0A0908] border border-white/10 rounded-[10px] text-indigo-300 break-all">
                  {sPart || '00'.repeat(32)}
                </div>
              </div>
            </div>
          </div>

          {/* Provenance & Relay Metadata */}
          <div className="p-3.5 bg-[#000000] border border-white/20 rounded-[18px] text-xs font-mono space-y-2">
            <div className="text-white font-bold uppercase text-[11px]">Provenance & Ingestion</div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-white/50 block">Relay Source:</span>
                <span className="text-white font-bold truncate block">{event.relay_source}</span>
              </div>
              <div>
                <span className="text-white/50 block">Created At:</span>
                <span className="text-white tabular-nums block">
                  {new Date(event.created_at * 1000).toISOString()}
                </span>
              </div>
            </div>
          </div>

          {/* Canonical NIP-01 JSON Payload */}
          <div className="p-3.5 bg-[#000000] border border-white/20 rounded-[18px] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-white font-bold uppercase tracking-wider">
                Canonical NIP-01 Serialized Array
              </span>
              <button
                onClick={handleCopyJson}
                className="text-[11px] text-pink-400 hover:underline flex items-center gap-1 font-bold"
              >
                {copiedRaw ? <Check size={11} /> : <Copy size={11} />}
                <span>{copiedRaw ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>
            <pre className="p-3 bg-[#0A0908] border border-white/10 rounded-[14px] text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-[220px] leading-relaxed">
              {formattedCanonical}
            </pre>
          </div>
        </div>

        {/* Fixed Non-Scrolling Action Footer (OpenBricks 4.0: shrink-0 border-t bg-[#161412] px-5 py-3) */}
        <div className="shrink-0 border-t border-white/10 bg-[#161412] px-5 py-3 flex items-center justify-between gap-3">
          <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
            <Activity size={12} />
            <span>Telemetry logged to Dexie</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-[14px] bg-white text-black font-bold font-mono text-xs hover:bg-white/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
