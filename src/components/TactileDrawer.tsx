import React, { useState } from 'react';
import { 
  X, 
  Maximize2, 
  Minimize2, 
  ArrowLeft, 
  ExternalLink 
} from 'lucide-react';

interface TactileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footerActions?: React.ReactNode;
  canGoBack?: boolean;
  onGoBack?: () => void;
  onPopOut?: () => void;
  isFullScreenMobile?: boolean;
  id?: string;
}

export function TactileDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footerActions,
  canGoBack,
  onGoBack,
  onPopOut,
  isFullScreenMobile = false,
  id = 'tactile-drawer',
}: TactileDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isOpen) return null;

  const mobileHeight = isFullScreenMobile
    ? 'h-[100dvh]'
    : isExpanded
    ? 'h-[100dvh]'
    : 'h-[60dvh] max-h-[60dvh]';

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/80 md:hidden backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Surface: Fixed 60dvh max / 100dvh on mobile, Native Right Sidebar on Desktop */}
      <div
        id={id}
        className={`fixed z-50 transition-all duration-200 bg-[#161412] flex flex-col border-white/20
          /* Mobile: Bottom drawer with max/ideal height 60dvh or 100dvh for fullscreen */
          bottom-0 left-0 right-0 max-w-full overflow-hidden border-t md:border-t-0
          ${mobileHeight}
          /* Desktop: Native right sidebar */
          md:top-0 md:bottom-0 md:right-0 md:left-auto md:w-[440px] md:h-full md:border-l md:shadow-2xl
        `}
      >
        {/* Top Minimalist Header Layer with Standardized 3-Slot Actions + Leading Back */}
        <div className="shrink-0 px-4 py-3 bg-[#000000] border-b border-white/20 flex items-center justify-between gap-3">
          {/* Leading Back button */}
          <div className="flex items-center gap-2 min-w-0">
            {canGoBack && onGoBack && (
              <button
                id="drawer-back-btn"
                onClick={onGoBack}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all shrink-0 border border-white/20 cursor-pointer"
                title="Back"
                aria-label="Back"
              >
                <ArrowLeft size={16} strokeWidth={2.5} />
              </button>
            )}
            <div className="min-w-0">
              <h3 className="text-white font-black text-sm tracking-wide uppercase truncate m-0">
                {title}
              </h3>
              {subtitle && (
                <p className="text-white text-[11px] font-bold tracking-tight truncate m-0 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Standardized Trailing 3-slot actions: 1. Pop Out, 2. Expand/Contract, 3. Dismiss */}
          <div className="flex items-center gap-1.5 shrink-0">
            {onPopOut && (
              <button
                id="drawer-popout-btn"
                onClick={onPopOut}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/20 cursor-pointer"
                title="Pop out in new tab"
                aria-label="Pop Out"
              >
                <ExternalLink size={14} />
              </button>
            )}

            {/* Expand / Contract dynamic toggle (Mobile viewports) */}
            <button
              id="drawer-expand-btn"
              onClick={() => setIsExpanded(!isExpanded)}
              className="md:hidden w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/20 cursor-pointer"
              title={isExpanded ? 'Contract to 60vh' : 'Expand to Fullscreen'}
              aria-label="Toggle Expand"
            >
              {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>

            {/* Dismiss Close button */}
            <button
              id="drawer-close-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/20 cursor-pointer"
              title="Close"
              aria-label="Close"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
          {children}
        </div>

        {/* Fixed Pinned Non-Scrolling Action Footer */}
        {footerActions && (
          <div className="shrink-0 border-t border-white/15 bg-[#161412] px-5 py-3 md:py-3.5 flex items-center justify-between gap-3">
            {footerActions}
          </div>
        )}
      </div>
    </>
  );
}
