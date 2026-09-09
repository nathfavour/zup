import { useState, type FormEvent } from 'react';
import { Send, MessageSquare, ShieldCheck, Radio } from 'lucide-react';
import { NostrEvent, NostrKeypair, RelayInfo } from '../types';
import { TactileDrawer } from './TactileDrawer';
import { formatTimeAgo, formatTruncatedKey } from '../lib/nostr';

interface ReplyDrawerProps {
  targetEvent: NostrEvent | null;
  isOpen: boolean;
  onClose: () => void;
  keypair: NostrKeypair;
  relays: RelayInfo[];
  onSubmitReply: (content: string, targetEvent: NostrEvent) => void;
}

export function ReplyDrawer({
  targetEvent,
  isOpen,
  onClose,
  keypair,
  relays,
  onSubmitReply,
}: ReplyDrawerProps) {
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);

  if (!targetEvent) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSending(true);
    setTimeout(() => {
      onSubmitReply(content.trim(), targetEvent);
      setIsSending(false);
      setContent('');
      onClose();
    }, 400);
  };

  return (
    <TactileDrawer
      id="reply-drawer"
      isOpen={isOpen}
      onClose={onClose}
      title="Reply to Note"
      subtitle={`Replying to @${targetEvent.author?.name || 'peer'}`}
      footerActions={
        <div className="w-full flex items-center justify-between gap-3">
          <span className="text-white text-xs font-mono font-bold">
            NIP-10 Thread Convention
          </span>
          <button
            id="submit-reply-btn"
            disabled={!content.trim() || isSending}
            onClick={handleSubmit}
            className="px-6 py-2.5 min-h-[44px] rounded-[16px] bg-[#EC4899] hover:bg-[#db2777] disabled:opacity-40 text-white text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_12px_#EC489944]"
          >
            <Send size={14} />
            <span>{isSending ? 'Broadcasting...' : 'Post Reply'}</span>
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Parent Note Well */}
        <div className="p-4 rounded-[18px] bg-[#000000] border border-white/20 flex flex-col gap-2 shadow-md">
          <div className="flex items-center gap-2.5">
            <img
              src={
                targetEvent.author?.avatar ||
                `https://api.dicebear.com/7.x/identicon/svg?seed=${targetEvent.pubkey}`
              }
              alt=""
              className="w-7 h-7 rounded-full border border-white/20 bg-black shrink-0"
            />
            <span className="text-white font-black text-xs">
              {targetEvent.author?.displayName || targetEvent.author?.name || 'Peer'}
            </span>
            <span className="text-white text-[10px] font-mono font-bold">
              {formatTimeAgo(targetEvent.created_at)}
            </span>
          </div>
          <p className="text-white text-xs font-medium leading-relaxed m-0 line-clamp-3">
            {targetEvent.content}
          </p>
        </div>

        {/* Inset Textarea */}
        <div className="flex flex-col gap-1.5">
          <label className="text-white text-xs font-extrabold uppercase tracking-wider">
            Your Reply
          </label>
          <textarea
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your decentralized response..."
            className="w-full bg-[#000000] border border-white/20 focus:border-[#EC4899] focus:outline-none rounded-[16px] px-4 py-3 text-white text-xs placeholder:text-white/40 resize-none leading-relaxed transition-colors"
          />
        </div>
      </div>
    </TactileDrawer>
  );
}
