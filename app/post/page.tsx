'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { parsePostIntent, buildIntentTags, PostIntentData } from '@/lib/core/intent/postIntent';
import { getActiveSigner, getSessionState, lockVault, SessionState } from '@/lib/state/session';
import { createAndSignEvent, formatHex } from '@/lib/core/nostr';
import { relayManager } from '@/lib/workers/relay-manager';
import { seedDatabaseIfEmpty } from '@/lib/db';
import { ConnectIdentityDrawer } from '@/components/modals/ConnectIdentityDrawer';
import {
  Send,
  Check,
  Tag,
  ExternalLink,
  MessageSquare,
  UserCheck,
  Paperclip,
  Radio,
  ArrowLeft,
  Key,
  Lock,
  Unlock,
  ShieldCheck,
  Cloud,
  Image as ImageIcon
} from 'lucide-react';

function PostIntentComposer() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [session] = useState<SessionState>(getSessionState());
  const [isConnectDrawerOpen, setIsConnectDrawerOpen] = useState(false);
  const [relaysList, setRelaysList] = useState(relayManager.getStatusList());

  // Parse initial intent from search params
  const initialIntent: PostIntentData = useMemo(() => {
    if (!searchParams) {
      return {
        content: '',
        kind: 1,
        e: [],
        p: [],
        t: [],
        r: [],
        media: []
      };
    }
    return parsePostIntent(searchParams);
  }, [searchParams]);

  // Form state initialized from searchParams intent
  const [content, setContent] = useState(initialIntent.content);
  const [kind, setKind] = useState<number>(initialIntent.kind);
  const [title, setTitle] = useState(initialIntent.title || '');
  const [tagsInput, setTagsInput] = useState(initialIntent.t.join(', '));
  const [eList] = useState<string[]>(initialIntent.e);
  const [pList] = useState<string[]>(initialIntent.p);
  const [rList] = useState<string[]>(initialIntent.r);
  const [mediaList] = useState<string[]>(initialIntent.media);
  const [clientApp] = useState<string | undefined>(initialIntent.client);

  const [isPublishing, setIsPublishing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [publishedId, setPublishedId] = useState<string | null>(null);

  useEffect(() => {
    async function initApp() {
      await seedDatabaseIfEmpty();
      relayManager.init();
    }
    initApp();

    const unsubRelays = relayManager.subscribeStatus(setRelaysList);
    return () => unsubRelays();
  }, []);

  const connectedRelaysCount = relaysList.filter((r) => r.status === 'connected').length;
  const signer = getActiveSigner();

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    if (!signer) {
      setIsConnectDrawerOpen(true);
      return;
    }

    setIsPublishing(true);
    setStatusMessage('Signing dispatch with BIP-340 Schnorr...');

    try {
      const parsedHashtags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      const intentData: PostIntentData = {
        content: content.trim(),
        kind,
        title: title.trim() || undefined,
        e: eList,
        p: pList,
        t: parsedHashtags,
        r: rList,
        media: mediaList,
        client: clientApp
      };

      const eventTags = buildIntentTags(intentData);

      const signedEvent = await createAndSignEvent(
        signer,
        kind,
        eventTags,
        content.trim()
      );

      setStatusMessage('Broadcasting to relay network pool...');
      await relayManager.broadcastEvent(signedEvent);

      setPublishedId(signedEvent.id);
      setStatusMessage('Dispatch successfully published!');

      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Publish error';
      setStatusMessage(`Failed to publish: ${msg}`);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#161412] text-white flex flex-col font-sans selection:bg-pink-500/30 selection:text-white">
      {/* Topbar */}
      <header className="sticky top-0 z-40 bg-[#000000] border-b border-white/20 rounded-b-[20px] px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-xl">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 group cursor-pointer"
        >
          <span className="text-xl font-black tracking-tight text-white group-hover:text-pink-400 transition-colors">
            zup
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[14px] bg-[#161412] border border-white/20 text-xs font-mono text-white/80 hover:text-white hover:border-pink-500 transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Go to Home</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-[12px] bg-[#161412] border border-white/15 text-[11px] font-mono text-white/70">
            <Radio size={12} className="text-amber-400" />
            <span className="tabular-nums font-semibold">{connectedRelaysCount}/{relaysList.length} Relays</span>
          </div>
        </div>
      </header>

      {/* Main Intent Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* External Intent Banner */}
        <div className="p-4 bg-[#000000] border border-pink-500/40 rounded-[20px] flex items-center justify-between flex-wrap gap-3 shadow-[0_0_20px_rgba(236,72,153,0.15)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[14px] bg-pink-500/20 text-pink-400 border border-pink-500/30">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-pink-400 tracking-wider uppercase">
                  External Post Intent
                </span>
                {clientApp && (
                  <span className="px-2 py-0.5 rounded-[8px] bg-indigo-500/20 border border-indigo-500/40 text-[11px] font-mono font-bold text-indigo-300">
                    App: {clientApp}
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-white/60">
                An external application requested to dispatch a post via zup compatibility layer.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsConnectDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[14px] bg-pink-500 hover:bg-pink-400 text-black text-xs font-bold font-mono transition-all cursor-pointer"
            >
              <Cloud size={13} />
              <span>Sync / Auth</span>
            </button>

            {session.activeIdentity && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#161412] border border-white/20 rounded-[14px] text-xs font-mono">
                <span className="text-white/50">Posting as:</span>
                <span className="text-emerald-400 font-bold">{session.activeIdentity.label}</span>
                <button
                  onClick={() => lockVault()}
                  className="text-white/40 hover:text-white transition-colors ml-1 cursor-pointer"
                  title="Lock Vault"
                >
                  {session.isUnlocked ? <Unlock size={12} className="text-emerald-400" /> : <Lock size={12} className="text-amber-400" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Intent Form Card */}
        <div className="p-6 bg-[#000000] border border-white/20 rounded-[24px] space-y-5 shadow-2xl">
          <form onSubmit={handlePublish} className="space-y-5">
            {/* Kind & Title Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-mono text-white/70 block mb-1">
                  Event Kind
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={kind}
                    onChange={(e) => setKind(parseInt(e.target.value, 10) || 1)}
                    className="w-20 bg-[#161412] border border-white/20 focus:border-pink-500 rounded-[14px] px-3 py-2 text-xs text-white outline-none font-mono font-bold"
                  />
                  <span className="text-[11px] font-mono text-white/50">
                    {kind === 1 ? 'Standard Note' : kind === 30023 ? 'Long-form Post' : 'Custom Event'}
                  </span>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-mono text-white/70 block mb-1">
                  Title / Subject (Optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Subject line or article title..."
                  className="w-full bg-[#161412] border border-white/20 focus:border-pink-500 rounded-[14px] px-3.5 py-2 text-xs text-white outline-none font-mono placeholder-white/30"
                />
              </div>
            </div>

            {/* Post Content */}
            <div>
              <label className="text-xs font-mono text-white/70 block mb-1 flex items-center justify-between">
                <span>Post Body Content</span>
                <span className="text-[10px] text-white/40">{content.length} characters</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={kind === 30023 ? 10 : 6}
                placeholder="Content payload..."
                className="w-full bg-[#161412] border border-white/20 focus:border-pink-500 rounded-[18px] p-4 text-xs text-white outline-none font-sans resize-none leading-relaxed placeholder-white/30"
                required
              />
            </div>

            {/* Hashtags Input */}
            <div>
              <label className="text-xs font-mono text-white/70 block mb-1 flex items-center gap-1">
                <Tag size={12} /> Hashtags (`#t` tags, comma-separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. nostr, zup, tech"
                className="w-full bg-[#161412] border border-white/20 focus:border-pink-500 rounded-[14px] px-3.5 py-2 text-xs text-white outline-none font-mono placeholder-white/30"
              />
            </div>

            {/* Parsed Intent Tags Summary Accordion / Grid */}
            <div className="p-4 bg-[#161412] border border-white/15 rounded-[18px] space-y-3">
              <h3 className="text-xs font-mono font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
                <Paperclip size={13} className="text-pink-400" />
                <span>Parsed Intent Nostr Tags</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                {/* Replies */}
                {eList.length > 0 && (
                  <div className="p-2.5 bg-[#000000] border border-white/10 rounded-[12px] space-y-1">
                    <div className="text-[10px] text-white/50 flex items-center gap-1">
                      <MessageSquare size={11} className="text-pink-400" />
                      <span>Reply / Referenced Events (`e`)</span>
                    </div>
                    <div className="space-y-1">
                      {eList.map((id, idx) => (
                        <div key={idx} className="text-pink-300 truncate text-[11px]">
                          {formatHex(id, 8, 6)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mentions */}
                {pList.length > 0 && (
                  <div className="p-2.5 bg-[#000000] border border-white/10 rounded-[12px] space-y-1">
                    <div className="text-[10px] text-white/50 flex items-center gap-1">
                      <UserCheck size={11} className="text-emerald-400" />
                      <span>Mentioned Pubkeys (`p`)</span>
                    </div>
                    <div className="space-y-1">
                      {pList.map((pub, idx) => (
                        <div key={idx} className="text-emerald-300 truncate text-[11px]">
                          {formatHex(pub, 8, 6)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* URLs */}
                {rList.length > 0 && (
                  <div className="p-2.5 bg-[#000000] border border-white/10 rounded-[12px] space-y-1">
                    <div className="text-[10px] text-white/50 flex items-center gap-1">
                      <ExternalLink size={11} className="text-amber-400" />
                      <span>External URLs (`r`)</span>
                    </div>
                    <div className="space-y-1">
                      {rList.map((url, idx) => (
                        <a key={idx} href={url} target="_blank" rel="noreferrer" className="text-amber-300 truncate hover:underline block text-[11px]">
                          {url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Media */}
                {mediaList.length > 0 && (
                  <div className="p-2.5 bg-[#000000] border border-white/10 rounded-[12px] space-y-1">
                    <div className="text-[10px] text-white/50 flex items-center gap-1">
                      <ImageIcon size={11} className="text-indigo-400" />
                      <span>Media Attachments (`media`)</span>
                    </div>
                    <div className="space-y-1">
                      {mediaList.map((mUrl, idx) => (
                        <div key={idx} className="text-indigo-300 truncate text-[11px]">
                          {mUrl}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {eList.length === 0 && pList.length === 0 && rList.length === 0 && mediaList.length === 0 && (
                <p className="text-[11px] font-mono text-white/40 italic">
                  No additional threading, media, or URL tags in intent parameters.
                </p>
              )}
            </div>

            {/* Status Indicator */}
            {statusMessage && (
              <div className={`p-3 rounded-[14px] bg-[#161412] border text-xs font-mono flex items-center gap-2 ${
                publishedId ? 'border-emerald-500 text-emerald-300' : 'border-pink-500/50 text-pink-300'
              }`}>
                <Check size={14} className={publishedId ? 'text-emerald-400' : 'text-pink-400'} />
                <span>{statusMessage}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="px-4 py-2.5 rounded-[16px] bg-[#161412] hover:bg-white/10 border border-white/20 text-white font-mono text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isPublishing || !content.trim()}
                className="px-6 py-2.5 rounded-[16px] bg-pink-500 hover:bg-pink-400 text-black font-bold font-mono text-xs transition-all flex items-center gap-2 shadow-lg shadow-pink-500/25 disabled:opacity-50 cursor-pointer"
              >
                <Send size={14} />
                <span>{isPublishing ? 'Publishing...' : 'Sign & Broadcast Dispatch'}</span>
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Connect Drawer Modal */}
      <ConnectIdentityDrawer
        isOpen={isConnectDrawerOpen}
        onClose={() => setIsConnectDrawerOpen(false)}
      />
    </div>
  );
}

export default function PostIntentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#161412] text-white flex items-center justify-center font-mono text-xs">
        Loading post intent layer...
      </div>
    }>
      <PostIntentComposer />
    </Suspense>
  );
}
