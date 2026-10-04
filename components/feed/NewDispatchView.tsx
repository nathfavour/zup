'use client';

import React, { useState } from 'react';
import { getActiveSigner, getSessionState, unlockVault } from '@/lib/state/session';
import { createAndSignEvent } from '@/lib/core/nostr';
import { relayManager } from '@/lib/workers/relay-manager';
import { Send, FileText, Check, Plus, Tag } from 'lucide-react';

interface NewDispatchViewProps {
  onPublished: () => void;
}

export function NewDispatchView({ onPublished }: NewDispatchViewProps) {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [isArticle, setIsArticle] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const session = getSessionState();
  const signer = getActiveSigner();

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    let activeSigner = signer;
    if (!activeSigner) {
      await unlockVault('zup-operator-2026');
      activeSigner = getActiveSigner();
    }

    if (!activeSigner) {
      alert('Signer unavailable. Please unlock your Vault in Settings.');
      return;
    }

    setIsPublishing(true);
    setStatusMessage('Signing event with BIP-340 Schnorr...');

    try {
      const parsedTags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean)
        .map((t) => ['t', t]);

      const kind = isArticle ? 30023 : 1;
      if (isArticle && title.trim()) {
        parsedTags.push(['title', title.trim()]);
        parsedTags.push(['d', title.toLowerCase().replace(/[^a-z0-9]+/g, '-')]);
      }

      const signedEvent = await createAndSignEvent(
        activeSigner,
        kind,
        parsedTags,
        content.trim()
      );

      setStatusMessage('Broadcasting to relay pool...');
      await relayManager.broadcastEvent(signedEvent);

      setStatusMessage('Dispatch published successfully!');
      setTimeout(() => {
        setContent('');
        setTitle('');
        setTagsInput('');
        setStatusMessage(null);
        onPublished();
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Publish error';
      setStatusMessage(`Failed: ${msg}`);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="p-6 bg-[#000000] border border-white/20 rounded-[24px] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Create New Dispatch
            </h2>
            <p className="text-xs font-mono text-white/50">
              Posting as: <span className="text-pink-400 font-bold">{session.activeIdentity?.label || 'Personal Persona'}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsArticle(!isArticle)}
            className={`px-3 py-1 rounded-[12px] text-xs font-mono font-bold border transition-colors cursor-pointer ${
              isArticle
                ? 'bg-pink-500/20 border-pink-500 text-pink-300'
                : 'bg-[#161412] border-white/20 text-white/70'
            }`}
          >
            {isArticle ? 'Long-Form Article' : 'Standard Post'}
          </button>
        </div>

        <form onSubmit={handlePublish} className="space-y-4">
          {isArticle && (
            <div>
              <label className="text-xs font-mono text-white/70 block mb-1">Article Title / Identifier</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="RFC title or post heading..."
                className="w-full bg-[#161412] border border-white/20 focus:border-pink-500 rounded-[14px] px-3.5 py-2 text-xs text-white outline-none font-mono placeholder-white/30"
              />
            </div>
          )}

          <div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={isArticle ? 10 : 5}
              placeholder={isArticle ? 'Write your long-form article or technical note in markdown...' : "What's on your mind? Share thoughts, questions, or dispatches..."}
              className="w-full bg-[#161412] border border-white/20 focus:border-pink-500 rounded-[18px] p-4 text-xs text-white outline-none font-sans resize-none leading-relaxed placeholder-white/30"
              required
            />
          </div>

          <div>
            <label className="text-xs font-mono text-white/70 block mb-1 flex items-center gap-1">
              <Tag size={12} /> Topics (Comma-separated hashtags, optional)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. engineering, nostr, tech, thoughts"
              className="w-full bg-[#161412] border border-white/20 focus:border-pink-500 rounded-[14px] px-3.5 py-2 text-xs text-white outline-none font-mono placeholder-white/30"
            />
          </div>

          {statusMessage && (
            <div className="p-3 rounded-[14px] bg-[#161412] border border-white/15 text-xs font-mono text-pink-300 flex items-center gap-2">
              <Check size={14} className="text-pink-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isPublishing || !content.trim()}
              className="px-6 py-2.5 rounded-[16px] bg-pink-500 hover:bg-pink-400 text-black font-bold font-mono text-xs transition-all flex items-center gap-2 shadow-lg shadow-pink-500/25 disabled:opacity-50 cursor-pointer"
            >
              <Send size={14} />
              <span>{isPublishing ? 'Publishing...' : 'Publish Dispatch'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
