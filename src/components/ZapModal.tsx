import { useState } from 'react';
import { 
  Zap, 
  CheckCircle2, 
  Copy, 
  Check, 
  QrCode, 
  Sparkles, 
  ArrowRight 
} from 'lucide-react';
import { NostrEvent } from '../types';
import { TactileDrawer } from './TactileDrawer';

interface ZapModalProps {
  event: NostrEvent | null;
  onClose: () => void;
  onConfirmZap: (eventId: string, amountSats: number, comment: string) => void;
}

export function ZapModal({
  event,
  onClose,
  onConfirmZap,
}: ZapModalProps) {
  const [amount, setAmount] = useState<number>(21);
  const [comment, setComment] = useState('');
  const [isZapping, setIsZapping] = useState(false);
  const [zapReceipt, setZapReceipt] = useState<{
    preimage: string;
    invoice: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!event) return null;

  const presets = [21, 69, 420, 1000, 5000];

  const handleSendZap = () => {
    setIsZapping(true);
    setTimeout(() => {
      const fakePreimage = Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      const fakeInvoice = `lnbc${amount}0n1p...zap...${event.id.slice(0, 10)}`;

      setZapReceipt({
        preimage: fakePreimage,
        invoice: fakeInvoice,
      });
      setIsZapping(false);
      onConfirmZap(event.id, amount, comment);
    }, 600);
  };

  const handleCopyInvoice = () => {
    if (zapReceipt) {
      navigator.clipboard.writeText(zapReceipt.invoice);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <TactileDrawer
      id="zap-drawer"
      isOpen={!!event}
      onClose={onClose}
      title="Lightning Zap"
      subtitle={`Send sats to ${event.author?.displayName || event.author?.name || 'Anonymous'}`}
      footerActions={
        zapReceipt ? (
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-[16px] bg-[#10B981] hover:bg-[#059669] text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_12px_#10B98144]"
          >
            Done
          </button>
        ) : (
          <div className="w-full flex items-center justify-between gap-3">
            <span className="text-white text-xs font-mono font-bold">
              Total: {amount.toLocaleString()} sats
            </span>
            <button
              id="confirm-zap-btn"
              disabled={isZapping || amount <= 0}
              onClick={handleSendZap}
              className="px-6 py-2.5 min-h-[44px] rounded-[16px] bg-[#F59E0B] hover:bg-[#d97706] disabled:opacity-40 text-black text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_14px_#F59E0B44]"
            >
              <Zap size={14} className="fill-black" />
              <span>{isZapping ? 'Routing LN...' : `Zap ${amount} Sats`}</span>
            </button>
          </div>
        )
      }
    >
      {zapReceipt ? (
        /* Zap Receipt Success View */
        <div className="flex flex-col items-center justify-center text-center p-4 gap-4">
          <div className="w-16 h-16 rounded-full bg-[#10B981]/20 border-2 border-[#10B981] flex items-center justify-center text-[#10B981] shadow-[0_0_20px_#10B98144]">
            <CheckCircle2 size={32} />
          </div>

          <div>
            <h4 className="text-white font-black text-base uppercase tracking-wider m-0">
              Zap Broadcast Settled!
            </h4>
            <p className="text-white text-xs font-bold mt-1">
              Sent {amount.toLocaleString()} satoshis over the Lightning Network.
            </p>
          </div>

          <div className="w-full p-3 rounded-[16px] bg-[#000000] border border-white/20 text-left flex flex-col gap-1.5 font-mono text-[11px]">
            <span className="text-white font-extrabold text-[10px] uppercase tracking-wider">
              Settlement Preimage
            </span>
            <span className="text-emerald-400 font-bold break-all">
              {zapReceipt.preimage}
            </span>
          </div>

          <button
            onClick={handleCopyInvoice}
            className="flex items-center gap-2 px-4 py-2 rounded-[14px] bg-[#000000] border border-white/20 hover:border-white/50 text-white text-xs font-bold cursor-pointer"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? 'Invoice Copied' : 'Copy Lightning Invoice'}</span>
          </button>
        </div>
      ) : (
        /* Zap Composition Form */
        <div className="flex flex-col gap-4">
          {/* Preset Sats Pills */}
          <div className="flex flex-col gap-2">
            <label className="text-white text-xs font-extrabold uppercase tracking-wider">
              Select Amount (Sats)
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {presets.map((p) => {
                const isSelected = amount === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(p)}
                    className={`py-2 rounded-[12px] text-xs font-mono font-extrabold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#000000] border-2 border-[#F59E0B] text-white shadow-[0_0_10px_#F59E0B44]'
                        : 'bg-[#000000] border border-white/20 text-white hover:border-white/40'
                    }`}
                  >
                    ⚡{p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Amount Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-white text-xs font-extrabold uppercase tracking-wider">
              Custom Sats Amount
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white font-mono font-bold">
                ⚡
              </span>
              <input
                type="number"
                min="1"
                max="1000000"
                value={amount}
                onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-[#000000] border border-white/20 focus:border-[#F59E0B] focus:outline-none rounded-[16px] pl-9 pr-4 py-2.5 text-white font-mono text-sm font-bold transition-colors"
              />
            </div>
          </div>

          {/* Comment input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-white text-xs font-extrabold uppercase tracking-wider">
              Zap Comment (NIP-57)
            </label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Keep stacking cypherpunk speech ⚡"
              className="w-full bg-[#000000] border border-white/20 focus:border-[#F59E0B] focus:outline-none rounded-[16px] px-4 py-2.5 text-white text-xs placeholder:text-white/40 transition-colors"
            />
          </div>

          {/* Target Note Preview Box */}
          <div className="p-3 rounded-[16px] bg-[#000000] border border-white/20 flex flex-col gap-1 text-left">
            <span className="text-white text-[10px] font-extrabold uppercase tracking-wider">
              Target Note
            </span>
            <p className="text-white text-xs font-medium line-clamp-2 m-0 leading-relaxed">
              "{event.content}"
            </p>
          </div>
        </div>
      )}
    </TactileDrawer>
  );
}
