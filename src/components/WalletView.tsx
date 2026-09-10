import { useState } from 'react';
import { 
  Zap, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Copy, 
  Check, 
  ShieldCheck, 
  QrCode
} from 'lucide-react';
import { NostrKeypair, NostrNotification } from '../types';

interface WalletViewProps {
  keypair: NostrKeypair;
  notifications: NostrNotification[];
  onOpenUnlock?: () => void;
  isVaultLocked?: boolean;
}

export function WalletView({
  keypair,
  notifications,
}: WalletViewProps) {
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedInvoice, setCopiedInvoice] = useState(false);
  const [activeModal, setActiveModal] = useState<'send' | 'receive' | 'nwc' | null>(null);
  const [sendAmount, setSendAmount] = useState<number>(100);
  const [sendRecipient, setSendRecipient] = useState('');
  const [receiveAmount, setReceiveAmount] = useState<number>(500);
  const [generatedInvoice, setGeneratedInvoice] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nwcUri, setNwcUri] = useState('');
  const [isNwcConnected, setIsNwcConnected] = useState(false);

  // Compute zap statistics from real notifications
  const zapNotifications = notifications.filter((n) => n.type === 'zap');
  const totalZapsReceivedSats = zapNotifications.reduce(
    (acc, n) => acc + (n.amountSats || 0),
    0
  );

  const lightningAddress = keypair.lud16 || `${keypair.npub.slice(0, 10)}@zup.me`;

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(lightningAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleGenerateInvoice = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const invoice = `lnbc${receiveAmount}0n1p...zup...wallet${Date.now().toString(16)}`;
      setGeneratedInvoice(invoice);
      setIsProcessing(false);
    }, 400);
  };

  const handleCopyInvoice = () => {
    if (!generatedInvoice) return;
    navigator.clipboard.writeText(generatedInvoice);
    setCopiedInvoice(true);
    setTimeout(() => setCopiedInvoice(false), 2000);
  };

  const handleConnectNWC = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nwcUri.trim()) return;
    setIsNwcConnected(true);
    setActiveModal(null);
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto pb-24 md:pb-12 text-white">
      {/* 1. Main Satoshi Balance Card */}
      <section className="bg-[#161412] border border-white/20 rounded-[24px] p-6 flex flex-col gap-6 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[13px] bg-[#F59E0B]/15 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B] shadow-[0_0_12px_#F59E0B22]">
              <Wallet size={18} />
            </div>
            <div>
              <span className="text-white text-xs font-black uppercase tracking-wider block">
                Lightning Wallet
              </span>
              <span className="text-white/60 text-[11px] font-mono font-medium">
                NIP-47 NWC & NIP-57 Zaps
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>LN Ready</span>
            </span>
          </div>
        </div>

        {/* Big Satoshi Display */}
        <div className="flex flex-col gap-1 my-1">
          <span className="text-white/60 text-xs font-bold uppercase tracking-widest">
            Total Settled Received
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-mono font-black text-white tracking-tight">
              {totalZapsReceivedSats.toLocaleString()}
            </span>
            <span className="text-amber-400 font-black text-sm uppercase tracking-wider font-mono">
              SATS
            </span>
          </div>
          <span className="text-white/50 text-[11px] font-mono font-medium">
            ≈ ${(totalZapsReceivedSats * 0.00065).toFixed(2)} USD
          </span>
        </div>

        {/* Quick Send / Receive Actions */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => setActiveModal('receive')}
            className="py-3 px-4 rounded-[16px] bg-[#000000] border border-white/20 hover:border-amber-400 text-white font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:scale-[1.01] active:scale-[0.99]"
          >
            <ArrowDownLeft size={16} className="text-amber-400" />
            <span>Receive Sats</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('send')}
            className="py-3 px-4 rounded-[16px] bg-[#F59E0B] hover:bg-[#d97706] text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_16px_#F59E0B44] hover:scale-[1.01] active:scale-[0.99]"
          >
            <ArrowUpRight size={16} strokeWidth={2.5} />
            <span>Send Sats</span>
          </button>
        </div>
      </section>

      {/* 2. Lightning Address Card (lud16) */}
      <section className="bg-[#161412] border border-white/20 rounded-[24px] p-5 flex flex-col gap-3 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Zap size={15} className="text-amber-400 fill-amber-400" />
            <span>Your Lightning Address</span>
          </span>
          <span className="text-[10px] font-mono text-white/50 font-bold">NIP-57</span>
        </div>

        <div className="p-3.5 rounded-[18px] bg-[#000000] border border-white/20 flex items-center justify-between gap-3 shadow-sm">
          <div className="min-w-0 flex-1">
            <span className="text-white font-mono font-bold text-xs sm:text-sm truncate block select-all">
              {lightningAddress}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyAddress}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] bg-[#161412] border border-white/20 hover:border-white/50 text-white text-xs font-bold transition-all cursor-pointer shrink-0"
          >
            {copiedAddress ? (
              <>
                <Check size={13} className="text-emerald-400" />
                <span className="text-emerald-400 font-bold">Copied</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* 3. Nostr Wallet Connect (NIP-47) Integration */}
      <section className="bg-[#161412] border border-white/20 rounded-[24px] p-5 flex flex-col gap-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[12px] bg-[#6366F1]/15 border border-[#6366F1]/30 flex items-center justify-center text-[#6366F1]">
              <ShieldCheck size={16} />
            </div>
            <div>
              <h3 className="text-white text-sm font-black uppercase tracking-wide m-0">
                NWC Lightning Bridge
              </h3>
              <p className="text-white/60 text-xs mt-0.5 m-0 font-medium">
                Connect Alby, Mutiny, or Coinos via Nostr Wallet Connect.
              </p>
            </div>
          </div>

          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              isNwcConnected
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-white/10 text-white/70 border border-white/15'
            }`}
          >
            {isNwcConnected ? 'Connected' : 'Standalone'}
          </span>
        </div>

        <div className="p-4 rounded-[18px] bg-[#000000] border border-white/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div>
            <span className="text-white font-bold text-xs block">
              {isNwcConnected ? 'NWC Bridge Active' : 'No External Signer Linked'}
            </span>
            <p className="text-white/50 text-[11px] font-medium mt-0.5 m-0">
              {isNwcConnected
                ? 'Outgoing zaps are automatically signed and settled via your connected wallet.'
                : 'Zup can route instant 1-tap zaps through your own personal lightning node.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setActiveModal('nwc')}
            className="w-full sm:w-auto px-4 py-2 rounded-[14px] bg-white text-black hover:bg-white/90 font-black text-xs uppercase tracking-wider transition-all cursor-pointer shrink-0"
          >
            {isNwcConnected ? 'Manage NWC' : 'Connect NWC'}
          </button>
        </div>
      </section>

      {/* 4. Zap Activity & Receipts History */}
      <section className="bg-[#161412] border border-white/20 rounded-[24px] p-5 flex flex-col gap-3 shadow-xl">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Zap size={14} className="text-amber-400" />
            <span>Recent Lightning Activity</span>
          </span>
          <span className="text-[10px] font-mono text-white/50 font-bold">
            {zapNotifications.length} Events
          </span>
        </div>

        {zapNotifications.length === 0 ? (
          <div className="p-6 text-center text-white/50 text-xs font-medium rounded-[18px] bg-[#000000] border border-white/15">
            No incoming zaps recorded yet. Share valuable thoughts on the feed to stack sats!
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {zapNotifications.map((z) => (
              <div
                key={z.id}
                className="p-3.5 rounded-[16px] bg-[#000000] border border-white/15 flex items-center justify-between gap-3 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                    <Zap size={15} className="fill-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-white font-extrabold text-xs block truncate">
                      {z.sourceName || 'Anonymous Cypherpunk'}
                    </span>
                    <span className="text-white/50 text-[10px] font-medium truncate block">
                      {z.comment || 'Zapped your note'}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 font-mono">
                  <span className="text-amber-400 font-black text-xs block">
                    +{z.amountSats?.toLocaleString() || 21} SATS
                  </span>
                  <span className="text-white/40 text-[9px] font-bold">Settled</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Receive Sats Modal */}
      {activeModal === 'receive' && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161412] border border-white/20 rounded-[24px] p-6 flex flex-col gap-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between">
              <h3 className="text-white text-base font-black uppercase tracking-wider m-0">
                Receive Lightning Sats
              </h3>
              <button
                onClick={() => {
                  setActiveModal(null);
                  setGeneratedInvoice(null);
                }}
                className="text-white/50 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {generatedInvoice ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-48 h-48 rounded-[20px] bg-white p-3 flex items-center justify-center shadow-md">
                  <QrCode size={160} className="text-black" />
                </div>
                <div className="w-full p-3 rounded-[16px] bg-[#000000] border border-white/20 text-left">
                  <span className="text-white/50 text-[10px] font-extrabold uppercase tracking-wider block">
                    Lightning Invoice ({receiveAmount} sats)
                  </span>
                  <p className="text-emerald-400 font-mono text-xs break-all m-0 mt-1 select-all">
                    {generatedInvoice}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyInvoice}
                  className="w-full py-3 rounded-[16px] bg-[#10B981] text-black font-black text-xs uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-2"
                >
                  {copiedInvoice ? <Check size={15} /> : <Copy size={15} />}
                  <span>{copiedInvoice ? 'Invoice Copied' : 'Copy Invoice'}</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <label className="text-white text-xs font-bold uppercase tracking-wider">
                  Amount in Satoshis
                </label>
                <input
                  type="number"
                  min="1"
                  value={receiveAmount}
                  onChange={(e) => setReceiveAmount(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#000000] border border-white/20 rounded-[16px] px-4 py-3 text-white font-mono text-sm font-bold"
                />
                <button
                  type="button"
                  disabled={isProcessing || receiveAmount <= 0}
                  onClick={handleGenerateInvoice}
                  className="w-full py-3.5 rounded-[16px] bg-[#F59E0B] text-black font-black text-xs uppercase tracking-wider cursor-pointer hover:bg-[#d97706] transition-all flex items-center justify-center gap-2 mt-2"
                >
                  {isProcessing ? 'Generating...' : `Create ${receiveAmount} Sats Invoice`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Send Sats Modal */}
      {activeModal === 'send' && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161412] border border-white/20 rounded-[24px] p-6 flex flex-col gap-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between">
              <h3 className="text-white text-base font-black uppercase tracking-wider m-0">
                Send Sats (Lightning / NIP-57)
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-white/50 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-white text-xs font-bold uppercase tracking-wider">
                Recipient (Lightning Address or Invoice)
              </label>
              <input
                type="text"
                placeholder="satoshi@coinos.io or lnbc..."
                value={sendRecipient}
                onChange={(e) => setSendRecipient(e.target.value)}
                className="w-full bg-[#000000] border border-white/20 rounded-[16px] px-4 py-3 text-white text-xs font-mono"
              />

              <label className="text-white text-xs font-bold uppercase tracking-wider mt-1">
                Amount (Sats)
              </label>
              <input
                type="number"
                min="1"
                value={sendAmount}
                onChange={(e) => setSendAmount(parseInt(e.target.value) || 0)}
                className="w-full bg-[#000000] border border-white/20 rounded-[16px] px-4 py-3 text-white font-mono text-sm font-bold"
              />

              <button
                type="button"
                onClick={() => {
                  alert(`Sent ${sendAmount} sats to ${sendRecipient || 'peer'}!`);
                  setActiveModal(null);
                }}
                disabled={!sendRecipient || sendAmount <= 0}
                className="w-full py-3.5 rounded-[16px] bg-[#F59E0B] disabled:opacity-40 text-black font-black text-xs uppercase tracking-wider cursor-pointer hover:bg-[#d97706] transition-all flex items-center justify-center gap-2 mt-2"
              >
                <Zap size={15} className="fill-black" />
                <span>Dispatch {sendAmount} Sats</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connect NWC Modal */}
      {activeModal === 'nwc' && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onSubmit={handleConnectNWC}
            className="w-full max-w-md bg-[#161412] border border-white/20 rounded-[24px] p-6 flex flex-col gap-4 shadow-2xl animate-fadeIn"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-white text-base font-black uppercase tracking-wider m-0">
                Nostr Wallet Connect (NIP-47)
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-white/50 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-white/60 text-xs leading-relaxed m-0 font-medium">
              Paste your NWC connection pairing URI (e.g. from Alby, Mutiny, or your personal node):
            </p>

            <input
              type="password"
              placeholder="nostr+walletconnect://..."
              value={nwcUri}
              onChange={(e) => setNwcUri(e.target.value)}
              className="w-full bg-[#000000] border border-white/20 rounded-[16px] px-4 py-3 text-white text-xs font-mono"
            />

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="flex-1 py-3 rounded-[16px] bg-[#000000] border border-white/20 text-white font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!nwcUri.trim()}
                className="flex-1 py-3 rounded-[16px] bg-[#6366F1] disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider cursor-pointer"
              >
                Save & Connect
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
