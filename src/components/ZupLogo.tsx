import { SVGProps } from 'react';

interface ZupLogoProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

export function ZupLogo({ size = 36, className = '', ...props }: ZupLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-label="Zup Logo"
      {...props}
    >
      <defs>
        {/* Pink conversation gradient for top chat segment ("Say what's up") */}
        <linearGradient id="zup-pink-grad" x1="20" y1="20" x2="80" y2="45" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>

        {/* Gold lightning gradient for bottom zap segment ("Get zapped") */}
        <linearGradient id="zup-gold-grad" x1="44" y1="50" x2="80" y2="85" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
      </defs>

      {/* Upper Speech Segment: Top bar of Z curving into the lightning diagonal */}
      <path
        d="M 22 22 H 78 L 44 50"
        stroke="url(#zup-pink-grad)"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Lower Zap Segment: Electric horizontal jog & diagonal down to the base */}
      <path
        d="M 44 50 H 64 L 26 78 H 78"
        stroke="url(#zup-gold-grad)"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Speech Pointer Tail: Dialogue beak pointing down-left */}
      <path
        d="M 26 78 L 14 90"
        stroke="url(#zup-gold-grad)"
        strokeWidth="11"
        strokeLinecap="round"
      />
    </svg>
  );
}
