'use client';

import React, { useState } from 'react';
import { LocalEvent } from '@/lib/core/types';
import { db } from '@/lib/db';
import { getSessionState } from '@/lib/state/session';
import { calculateEventId, formatHex } from '@/lib/core/nostr';
import { schnorrSign } from '@/lib/core/crypto';
import { relayManager } from '@/lib/workers/relay-manager';
import { X, Send, MessageCircle, ShieldCheck } from 'lucide-react';

interface AddCommentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  parentEvent: LocalEvent | null;
  parentAuthorName: string;
  onCommentAdded: (newComment: LocalEvent) => void;
}

export function AddCommentDrawer({
  isOpen,
  onClose,
  parentEvent,
  parentAuthorName,
  onCommentAdded
}: AddCommentDrawerProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const session = getSessionState();

  if (!isOpen || !parentEvent) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = content.trim();
    if (!text || isSubmitting) return;

    const pubkey = session.activeIdentity?.pubkey || 'anonymous_operator';
    setIsSubmitting(true);

    try {
      const created_at = Math.floor(Date.now() / 1000);
      const tags = [
        ['e', parentEvent.id, '', 'reply'],
        ['p', parentEvent.pubkey]
      ];

      const id = await calculateEventId({
        pubkey,
        created_at,
        kind: 1,
        tags,
        content: text
      });

      // Sign with mock key or Schnorr
      const mockPriv = '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b';
      const sig = await schnorrSign(id, mockPriv);

      const commentEvent: LocalEvent = {
        id,
        pubkey,
        kind: 1,
        created_at,
        tags,
        content: text,
        sig,
        first_seen_at: Date.now(),
        relay_source: 'local_dispatch'
      };

      // Broadcast live to all connected Nostr relays and commit locally to Dexie
      await relayManager.broadcastEvent(commentEvent);

      // Log interaction telemetry
      await db.logTelemetry({
        pubkey,
        eventId: parentEvent.id,
        targetPubkey: parentEvent.pubkey,
        interactionType: 'expand_thread',
        metadata: { action: 'reply', replyId: id }
      });

      setContent('');
      onCommentAdded(commentEvent);
      onClose();
    } catch (err: unknown) {
      alert('Failed to post reply: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeAuthor = session.activeIdentity?.label || 'Connected Persona';

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center items-center bg-black/80 backdrop-blur-xs animate-in fade-in duration-200 p-0 md:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Container: max-h-[60vh] */}
      <div className="relative z-10 w-full max-w-lg bg-[#161412] border-t-2 md:border-2 border-white/20 rounded-t-[28px] md:rounded-[28px] shadow-2xl flex flex-col max-h-[60vh] overflow-hidden">
        {/* Mobile drag handle */}
        <div className="md:hidden w-12 h-1 bg-white/30 rounded-full mx-auto my-2.5 shrink-0" />

        {/* Drawer Header */}
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-400">
              <MessageCircle size={15} />
            </div>
            <span className="text-xs font-bold text-white">Add Comment</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Parent post snippet */}
          <div className="p-3 bg-[#000000] border border-white/10 rounded-[16px] space-y-1 text-xs">
            <div className="text-[11px] font-mono text-white/50">
              Replying to <span className="text-pink-400 font-semibold">{parentAuthorName}</span>
            </div>
            <p className="text-white/80 line-clamp-2 italic text-[11px] font-mono">
              &quot;{parentEvent.content.slice(0, 140)}{parentEvent.content.length > 140 ? '...' : ''}&quot;
            </p>
          </div>

          {/* Comment text area */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-white/50">
              <span>Author: <span className="text-white font-semibold">{activeAuthor}</span></span>
              <span>{content.length}/500</span>
            </div>
            <textarea
              autoFocus
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Write your comment or technical reply..."
              className="w-full bg-[#000000] border border-white/20 focus:border-pink-500 rounded-[16px] p-3 text-xs text-white placeholder-white/40 outline-none resize-none font-sans leading-relaxed"
            />
          </div>

          {/* Footer with Submit button */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] font-mono text-white/40 flex items-center gap-1">
              <ShieldCheck size={11} className="text-emerald-400" />
              <span>Signed with BIP-340</span>
            </span>

            <button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className="px-5 py-2.5 rounded-[14px] bg-pink-500 hover:bg-pink-400 text-black font-bold font-mono text-xs transition-all flex items-center gap-2 shadow-md shadow-pink-500/25 cursor-pointer disabled:opacity-40 active:scale-95"
            >
              <Send size={13} />
              <span>{isSubmitting ? 'Posting...' : 'Post Reply'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
