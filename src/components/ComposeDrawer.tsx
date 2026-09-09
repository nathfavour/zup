import { useState } from 'react';
import { 
  Send, 
  Flame, 
  Radio, 
  Globe2, 
  Hash, 
  Sparkles, 
  ShieldCheck, 
  Tag 
} from 'lucide-react';
import { NostrKeypair, RelayInfo } from '../types';
import { TactileDrawer } from './TactileDrawer';
import { formatTruncatedKey } from '../lib/nostr';

interface ComposeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  keypair: NostrKeypair;
  relays: RelayInfo[];
  onPublish: (content: string, tags: string[][], targetRelays: string[]) => void;
}

export function ComposeDrawer({
  isOpen,
  onClose,
  keypair,
  relays,
  onPublish,
}: ComposeDrawerProps) {
  const [content, setContent] = useState('');
  const [accessMode, setAccessMode] = useState<'public' | 'ephemeral'>('public');
  const [selectedRelays, setSelectedRelays] = useState<string[]>(
    relays.filter((r) => r.write).map((r) => r.url)
  );
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(['nostr', 'privacy']);
  const [isPublishing, setIsPublishing] = useState(false);

  const toggleRelay = (url: string) => {
    if (selectedRelays.includes(url)) {
      if (selectedRelays.length > 1) {
        setSelectedRelays(selectedRelays.filter((r) => r !== url));
      }
    } else {
      setSelectedRelays([...selectedRelays, url]);
    }
  };

  const handleAddTag = () => {
    const clean = tagInput.trim().replace(/^#/, '');
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = () => {
    if (!content.trim()) return;
    setIsPublishing(true);

    const formattedTags = tags.map((t) => ['t', t]);
    if (accessMode === 'ephemeral') {
      formattedTags.push(['expiration', String(Math.floor(Date.now() / 1000) + 3600)]);
    }

    setTimeout(() => {
      onPublish(content.trim(), formattedTags, selectedRelays);
      setIsPublishing(false);
      setContent('');
      onClose();
    }, 400);
  };

  return (
    <TactileDrawer
      id="compose-drawer"
      isOpen={isOpen}
      onClose={onClose}
      title="Publish Note"
      subtitle={`Broadcasting as ${keypair.name || formatTruncatedKey(keypair.npub, 6, 4)}`}
      footerActions={
        <div className="w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-white text-xs font-mono font-bold truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="truncate">{selectedRelays.length} Relays Target</span>
          </div>

          <button
            id="broadcast-note-submit-btn"
            disabled={!content.trim() || isPublishing}
            onClick={handleSubmit}
            className="px-6 py-2.5 min-h-[44px] rounded-[16px] bg-[#EC4899] hover:bg-[#db2777] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-[0_0_14px_#EC489955] cursor-pointer"
          >
            <Send size={14} />
            <span>{isPublishing ? 'Signing...' : 'Broadcast'}</span>
          </button>
        </div>
      }
    >
      {/* Flat Inline Tactile Segmented Pill Control (Public vs Ephemeral) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-white text-xs font-extrabold uppercase tracking-wider">
          Broadcast Privacy
        </label>
        <div className="p-1 rounded-[16px] bg-[#000000] border border-white/20 grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setAccessMode('public')}
            className={`py-2 px-3 rounded-[12px] text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              accessMode === 'public'
                ? 'bg-[#161412] text-white border-2 border-[#EC4899] shadow-[0_0_10px_#EC489933]'
                : 'text-white border border-transparent hover:border-white/20'
            }`}
          >
            <Globe2 size={13} className={accessMode === 'public' ? 'text-[#EC4899]' : 'text-white'} />
            <span className="truncate">Public Note</span>
          </button>

          <button
            type="button"
            onClick={() => setAccessMode('ephemeral')}
            className={`py-2 px-3 rounded-[12px] text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              accessMode === 'ephemeral'
                ? 'bg-[#161412] text-white border-2 border-[#F59E0B] shadow-[0_0_10px_#F59E0B33]'
                : 'text-white border border-transparent hover:border-white/20'
            }`}
          >
            <Flame size={13} className={accessMode === 'ephemeral' ? 'text-[#F59E0B]' : 'text-white'} />
            <span className="truncate">Ephemeral (1h Wipe)</span>
          </button>
        </div>
      </div>

      {/* Dark Inset Textarea Well */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-white text-xs font-extrabold uppercase tracking-wider">
            Note Content
          </label>
          <span className="text-white font-mono text-[11px] font-bold">
            {content.length} / 500
          </span>
        </div>
        <textarea
          id="compose-note-textarea"
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's happening on the sovereign decentralized web? (Signed locally with secp256k1)"
          className="w-full bg-[#000000] border border-white/20 focus:border-[#EC4899] focus:outline-none rounded-[16px] px-4 py-3 text-white text-sm leading-relaxed placeholder:text-white/40 resize-none transition-colors"
        />
      </div>

      {/* Tags Section */}
      <div className="flex flex-col gap-2">
        <label className="text-white text-xs font-extrabold uppercase tracking-wider">
          Topic Tags
        </label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white" />
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="Add tag and press Enter"
              className="w-full bg-[#000000] border border-white/20 focus:border-[#EC4899] focus:outline-none rounded-[16px] pl-9 pr-3 py-2 text-white text-xs placeholder:text-white/40 transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={handleAddTag}
            className="px-3.5 py-2 rounded-[14px] bg-[#000000] border border-white/20 hover:border-white/50 text-white text-xs font-bold cursor-pointer"
          >
            Add
          </button>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {tags.map((tag) => (
              <span
                key={tag}
                onClick={() => handleRemoveTag(tag)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[10px] bg-[#000000] border border-white/25 text-white text-[11px] font-mono font-bold cursor-pointer hover:border-red-500 hover:text-red-400 transition-colors"
                title="Click to remove"
              >
                #{tag}
                <span className="text-white/60 text-xs">×</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Target Relays Selector */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-white text-xs font-extrabold uppercase tracking-wider">
            Broadcast Relays ({selectedRelays.length})
          </label>
          <span className="text-white text-[10px] font-bold">
            Tap to toggle
          </span>
        </div>

        <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
          {relays.map((relay) => {
            const isSelected = selectedRelays.includes(relay.url);
            return (
              <div
                key={relay.url}
                onClick={() => toggleRelay(relay.url)}
                className={`p-2.5 rounded-[14px] bg-[#000000] border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'border-emerald-500/60 shadow-[0_0_8px_#10B98122]'
                    : 'border-white/20 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Radio size={13} className={isSelected ? 'text-emerald-400' : 'text-white'} />
                  <span className="text-white font-mono text-xs font-bold truncate">
                    {relay.url}
                  </span>
                </div>
                <span
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-white/10 text-white border-white/20'
                  }`}
                >
                  {isSelected ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </TactileDrawer>
  );
}
