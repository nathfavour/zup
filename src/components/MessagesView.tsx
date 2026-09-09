import { useState, type FormEvent } from 'react';
import { 
  Send, 
  Lock, 
  ShieldCheck, 
  ArrowLeft, 
  Plus, 
  Sparkles,
  User 
} from 'lucide-react';
import { DirectMessageThread, NostrKeypair } from '../types';
import { formatTimeAgo, formatTruncatedKey } from '../lib/nostr';

interface MessagesViewProps {
  threads: DirectMessageThread[];
  keypair: NostrKeypair;
  onSendMessage: (peerPubkey: string, content: string) => void;
  onStartNewThread: (peerNpubOrPubkey: string) => void;
  onOpenPro: () => void;
}

export function MessagesView({
  threads,
  keypair,
  onSendMessage,
  onStartNewThread,
  onOpenPro,
}: MessagesViewProps) {
  const [activePeerPubkey, setActivePeerPubkey] = useState<string | null>(
    threads.length > 0 ? threads[0].peerPubkey : null
  );
  const [replyContent, setReplyContent] = useState('');
  const [isStartingNew, setIsStartingNew] = useState(false);
  const [newPeerInput, setNewPeerInput] = useState('');

  const activeThread = threads.find((t) => t.peerPubkey === activePeerPubkey);

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (!activePeerPubkey || !replyContent.trim()) return;
    onSendMessage(activePeerPubkey, replyContent.trim());
    setReplyContent('');
  };

  const handleNewThreadSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newPeerInput.trim()) return;
    onStartNewThread(newPeerInput.trim());
    setNewPeerInput('');
    setIsStartingNew(false);
  };

  return (
    <div className="flex flex-col gap-4 pb-16 md:pb-6">
      {/* Top Bar for Messages: Encrypted notice & Start DM */}
      <div className="p-4 rounded-[22px] bg-[#000000] border border-white/20 flex items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-[14px] bg-[#6366F1]/15 text-[#6366F1] flex items-center justify-center shrink-0 border border-[#6366F1]/30">
            <Lock size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-white font-black text-sm uppercase tracking-wider m-0 truncate">
              Encrypted Direct Messages
            </h3>
            <p className="text-white text-[11px] font-bold mt-0.5 m-0 truncate">
              NIP-04/NIP-44 End-to-End Cryptographic Tunnel
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsStartingNew(!isStartingNew)}
          className="px-3.5 py-2 rounded-[14px] bg-[#6366F1] hover:bg-[#4f46e5] text-white text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_#6366F144]"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">New DM</span>
        </button>
      </div>

      {/* Start New DM Form */}
      {isStartingNew && (
        <form
          onSubmit={handleNewThreadSubmit}
          className="p-4 rounded-[22px] bg-[#000000] border-2 border-[#6366F1] flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shadow-xl animate-in fade-in duration-150"
        >
          <input
            type="text"
            value={newPeerInput}
            onChange={(e) => setNewPeerInput(e.target.value)}
            placeholder="Enter peer npub1... or 64-character hex"
            className="flex-1 bg-[#161412] border border-white/20 focus:border-[#6366F1] focus:outline-none rounded-[16px] px-4 py-2.5 text-white font-mono text-xs placeholder:text-white/40 transition-colors"
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => setIsStartingNew(false)}
              className="px-3 py-2 rounded-[14px] bg-[#161412] border border-white/20 text-white text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newPeerInput.trim()}
              className="px-4 py-2 rounded-[14px] bg-[#6366F1] hover:bg-[#4f46e5] disabled:opacity-40 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
            >
              Open Thread
            </button>
          </div>
        </form>
      )}

      {/* Two-Column Desktop / Mobile Toggle */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Thread List: strictly Flat Conversation Rows (OpenBricks mandate) */}
        <div
          className={`flex flex-col gap-2 ${
            activeThread ? 'hidden md:flex md:col-span-5' : 'col-span-1 md:col-span-5'
          }`}
        >
          <div className="px-1 py-0.5">
            <span className="text-white text-[10px] font-black uppercase tracking-widest">
              Conversations ({threads.length})
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {threads.length === 0 ? (
              <div className="p-6 rounded-[18px] bg-[#000000] border border-white/20 text-center flex flex-col items-center justify-center gap-2 text-white/70 text-xs">
                <span>No encrypted conversations yet.</span>
                <button
                  type="button"
                  onClick={() => setIsStartingNew(true)}
                  className="mt-1 px-3 py-1.5 rounded-[12px] bg-[#6366F1]/20 border border-[#6366F1] text-[#6366F1] font-bold text-xs hover:bg-[#6366F1]/30 transition-all cursor-pointer"
                >
                  Start New Chat
                </button>
              </div>
            ) : (
              threads.map((thread) => {
              const isSelected = activePeerPubkey === thread.peerPubkey;

              return (
                <div
                  key={thread.peerPubkey}
                  id={`thread-row-${thread.peerPubkey.slice(0, 8)}`}
                  onClick={() => setActivePeerPubkey(thread.peerPubkey)}
                  className={`p-3.5 rounded-[18px] transition-all cursor-pointer flex items-center gap-3 group ${
                    isSelected
                      ? 'bg-[#000000] border-2 border-[#6366F1] shadow-[0_0_12px_#6366F133]'
                      : 'bg-[#000000] border border-white/20 hover:border-white/50'
                  }`}
                >
                  <img
                    src={
                      thread.peerAvatar ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${thread.peerPubkey}`
                    }
                    alt={thread.peerName}
                    className="w-10 h-10 rounded-full border border-white/20 bg-black shrink-0 object-cover"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-white font-black text-xs m-0 truncate group-hover:text-[#6366F1] transition-colors">
                        {thread.peerName}
                      </h4>
                      <span className="text-white text-[10px] font-bold shrink-0 font-mono">
                        {formatTimeAgo(thread.timestamp)}
                      </span>
                    </div>

                    <p className="text-white text-[11px] font-medium m-0 mt-0.5 truncate leading-tight">
                      {thread.lastMessage}
                    </p>
                  </div>
                </div>
              );
            }))}
          </div>
        </div>

        {/* Active Conversation Surface */}
        <div
          className={`flex flex-col rounded-[22px] bg-[#000000] border border-white/20 shadow-xl overflow-hidden min-h-[480px] ${
            activeThread ? 'col-span-1 md:col-span-7 flex' : 'hidden md:flex md:col-span-7'
          }`}
        >
          {activeThread ? (
            <>
              {/* Thread Header */}
              <div className="p-3.5 bg-[#161412] border-b border-white/15 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={() => setActivePeerPubkey(null)}
                    className="md:hidden p-1.5 rounded-full bg-white/10 text-white cursor-pointer"
                  >
                    <ArrowLeft size={16} />
                  </button>

                  <img
                    src={
                      activeThread.peerAvatar ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${activeThread.peerPubkey}`
                    }
                    alt={activeThread.peerName}
                    className="w-8 h-8 rounded-full border border-white/20 bg-black shrink-0"
                  />

                  <div className="min-w-0">
                    <h4 className="text-white font-black text-xs m-0 truncate">
                      {activeThread.peerName}
                    </h4>
                    <span className="text-white text-[10px] font-mono font-bold block truncate">
                      {formatTruncatedKey(activeThread.peerNpub || activeThread.peerPubkey, 8, 4)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold">
                  <Lock size={10} />
                  <span>E2EE</span>
                </div>
              </div>

              {/* Message Bubbles History */}
              <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 bg-[#000000]">
                <div className="flex items-center justify-center my-1">
                  <span className="px-2.5 py-1 rounded-full bg-[#161412] text-white text-[10px] font-mono font-bold border border-white/10">
                    🔒 Messages are end-to-end encrypted with Diffie-Hellman secp256k1
                  </span>
                </div>

                {activeThread.messages.map((msg) => {
                  const isMe = msg.senderPubkey === 'my-key' || msg.senderPubkey === keypair.pubkeyHex;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[80%] ${
                        isMe ? 'ml-auto items-end' : 'mr-auto items-start'
                      }`}
                    >
                      <div
                        className={`p-3 rounded-[18px] text-xs font-medium leading-relaxed ${
                          isMe
                            ? 'bg-[#6366F1] text-white rounded-tr-[4px] shadow-[0_0_10px_#6366F133]'
                            : 'bg-[#161412] text-white border border-white/20 rounded-tl-[4px]'
                        }`}
                      >
                        {msg.content}
                      </div>
                      <span className="text-white text-[9px] font-mono font-bold mt-1 px-1">
                        {formatTimeAgo(msg.timestamp)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Inset Message Composer */}
              <form
                onSubmit={handleSend}
                className="p-3 bg-[#161412] border-t border-white/15 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder={`Reply securely to ${activeThread.peerName}...`}
                  className="flex-1 bg-[#000000] border border-white/20 focus:border-[#6366F1] focus:outline-none rounded-[16px] px-4 py-2.5 text-white text-xs placeholder:text-white/40 transition-colors"
                />

                <button
                  type="submit"
                  disabled={!replyContent.trim()}
                  className="w-10 h-10 rounded-[14px] bg-[#6366F1] hover:bg-[#4f46e5] disabled:opacity-40 text-white flex items-center justify-center shrink-0 cursor-pointer transition-all shadow-[0_0_10px_#6366F144]"
                  title="Send Encrypted Message"
                  aria-label="Send Encrypted Message"
                >
                  <Send size={15} />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3">
              <Lock size={32} className="text-white opacity-40" />
              <h4 className="text-white font-black text-sm uppercase tracking-wider m-0">
                Select a Thread
              </h4>
              <p className="text-white text-xs font-bold max-w-xs m-0">
                Choose an encrypted conversation or start a new peer message with any Nostr public key.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
