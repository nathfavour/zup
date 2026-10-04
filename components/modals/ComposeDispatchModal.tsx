'use client';

import React, { useState } from 'react';
import { getActiveSigner, getSessionState, unlockVault } from '@/lib/state/session';
import { createAndSignEvent, formatHex } from '@/lib/core/nostr';
import { relayManager } from '@/lib/workers/relay-manager';
import { SegmentedControl } from '../ui/SegmentedControl';
import { X, Send, Key, Radio, Terminal, FileText, Check, AlertTriangle } from 'lucide-react';

interface ComposeDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublished?: () => void;
}

export function ComposeDispatchModal({ isOpen, onClose, onPublished }: ComposeDispatchModalProps) {
  const [kind, setKind] = useState<'1' | '30023'>('1');
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [tagsInput, setTagsInput] = useState('systems, nostr');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<Record<string, { ok: boolean; message?: string }> | null>(null);

  if (!isOpen) return null;

  const session = getSessionState();
  const signer = getActiveSigner();

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      alert('Content cannot be empty.');
      return;
    }

    let activeSigner = signer;
    if (!activeSigner) {
      // Auto-unlock with operator password if vault locked
      await unlockVault('zup-operator-2026');
      activeSigner = getActiveSigner();
    }

    if (!activeSigner) {
      alert('Signer unavailable. Please unlock the Master Vault first.');
      return;
    }

    setIsPublishing(true);
    try {
      const parsedTags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean)
        .map((t) => ['t', t]);

      if (kind === '30023' && title.trim()) {
        parsedTags.push(['title', title.trim()]);
        parsedTags.push(['d', title.toLowerCase().replace(/[^a-z0-9]+/g, '-')]);
      }

      const signedEvent = await createAndSignEvent(
        activeSigner,
        parseInt(kind, 10),
        parsedTags,
        content.trim()
      );

      const res = await relayManager.broadcastEvent(signedEvent);
      setPublishStatus(res);

      if (onPublished) onPublished();
      setTimeout(() => {
        onClose();
        setContent('');
        setTitle('');
        setPublishStatus(null);
      }, 1800);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Publish failed';
      alert(`Publish error: ${message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-auto bg-black/60 backdrop-blur-xs">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full flex flex-col bg-[#161412] border-l border-white/20 shadow-2xl md:w-[540px] max-md:h-[60dvh] max-md:mt-auto max-md:rounded-t-[24px] max-md:border-t max-md:border-l-0">
        {/* Top Controls Header */}
        <div className="shrink-0 px-4 py-3 border-b border-white/10 flex items-center justify-between bg-[#161412]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-pink-500/15 border border-pink-500/30 text-pink-400 flex items-center justify-center shrink-0">
              <Send size={13} />
            </div>
            <div>
              <h3 className="text-xs font-bold font-mono text-white uppercase tracking-wider">
                Compose Technical Dispatch
              </h3>
              <p className="text-[10px] font-mono text-white/50">
                Author: {session.activeIdentity?.label || 'Operator'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <form id="compose-form" onSubmit={handlePublish} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Kind Selector Inline */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-white/70 block">Dispatch Format</label>
            <SegmentedControl
              options={[
                { value: '1', label: 'Kind 1 (Micro-Dispatch)', icon: <Terminal size={13} /> },
                { value: '30023', label: 'Kind 30023 (RFC / Long-form)', icon: <FileText size={13} /> }
              ]}
              value={kind}
              onChange={(val) => setKind(val as any)}
              accentColor="#EC4899"
            />
          </div>

          {kind === '30023' && (
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-white/70 block">RFC Title / Identifier</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="RFC-9021: Memory Bounds in Relay Ring Buffers"
                className="w-full bg-[#000000] border border-white/20 focus:border-[#EC4899] rounded-[14px] px-3.5 py-2 text-xs text-white outline-none font-mono"
              />
            </div>
          )}

          {/* Content Inset Textarea */}
          <div className="space-y-1">
            <label className="text-[11px] font-mono text-white/70 block">
              {kind === '30023' ? 'Markdown Specification Payload' : 'Technical Note Content'}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={kind === '30023' ? 10 : 5}
              placeholder={
                kind === '30023'
                  ? '# Abstract\n\nDetailed systems specification...\n\n```rust\nfn main() {}\n```'
                  : 'Broadcast architectural dispatches, kernel benchmarks, or protocol findings...'
              }
              className="w-full bg-[#000000] border border-white/20 focus:border-[#EC4899] rounded-[16px] p-3 text-xs text-white outline-none font-mono resize-none leading-relaxed placeholder-white/30"
              required
            />
          </div>

          {/* Tags */}
          <div className="space-y-1">
            <label className="text-[11px] font-mono text-white/70 block">Topic Hashtags (Comma-separated)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="systems, kernel, distributed, rust"
              className="w-full bg-[#000000] border border-white/20 focus:border-[#EC4899] rounded-[14px] px-3.5 py-2 text-xs text-white outline-none font-mono"
            />
          </div>

          {/* Broadcast Status feedback */}
          {publishStatus && (
            <div className="p-3 bg-[#000000] border border-emerald-500/40 rounded-[14px] space-y-1 text-xs font-mono">
              <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                <Check size={14} /> Signed & Dispatched to Connection Pool
              </div>
              {Object.entries(publishStatus).map(([url, res]) => (
                <div key={url} className="text-[11px] text-white/70 truncate">
                  {res.ok ? '✓' : '✗'} {url}: {res.message}
                </div>
              ))}
            </div>
          )}
        </form>

        {/* Fixed Non-Scrolling Action Footer */}
        <div className="shrink-0 border-t border-white/10 bg-[#161412] px-5 py-3 flex items-center justify-between gap-3">
          <div className="text-[11px] font-mono text-white/50 truncate">
            Signer: {signer ? 'Unlocked (RAM)' : 'Auto-derive Key'}
          </div>
          <button
            type="submit"
            form="compose-form"
            disabled={isPublishing}
            className="px-6 py-2.5 rounded-[14px] bg-pink-500 hover:bg-pink-400 text-black font-bold font-mono text-xs transition-colors flex items-center gap-2 shadow-lg shadow-pink-500/20 disabled:opacity-50"
          >
            <Send size={13} />
            <span>{isPublishing ? 'Signing...' : 'Sign & Broadcast'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
