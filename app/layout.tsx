import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'zup — Ultra-Lean Nostr Client for Systems Thinkers',
  description: 'Ultra-lean, low-bandwidth Nostr web client and workspace ecosystem tailored for engineers, systems thinkers, and technical operators.',
  openGraph: {
    title: 'zup — Ultra-Lean Nostr Client for Systems Thinkers',
    description: 'Ultra-lean, low-bandwidth Nostr web client and workspace ecosystem tailored for engineers, systems thinkers, and technical operators.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'zup — Ultra-Lean Nostr Client for Systems Thinkers',
    description: 'Ultra-lean, low-bandwidth Nostr web client and workspace ecosystem tailored for engineers, systems thinkers, and technical operators.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#161412] text-white antialiased min-h-screen selection:bg-[#6366F1]/30 selection:text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
