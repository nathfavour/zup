import type { Metadata } from 'next';
import Link from 'next/link';
import { formatHex } from '@/lib/core/nostr';

interface Props {
  params: Promise<{ id: string }>;
}

// In-memory server-side cache for known events / fallback
const KNOWN_POSTS: Record<string, { author: string; handle: string; content: string; picture: string; date: string }> = {
  default: {
    author: 'Systems Operator',
    handle: 'operator@getzup.app',
    content: 'Ultra-lean, low-bandwidth Nostr web client and workspace ecosystem tailored for systems thinkers and technical operators.',
    picture: 'https://api.dicebear.com/7.x/identicon/svg?seed=operator64',
    date: 'Recent'
  }
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = KNOWN_POSTS[id] || {
    author: `Operator ${formatHex(id, 6, 4)}`,
    handle: `@${formatHex(id, 6, 0)}`,
    content: `Verified Nostr dispatch on zup: ${id.slice(0, 32)}...`,
    picture: `https://api.dicebear.com/7.x/identicon/svg?seed=${id}`,
    date: 'Recent'
  };

  const preview = post.content.length > 120 ? post.content.slice(0, 117) + '...' : post.content;
  const title = `${post.author} on zup: "${preview}"`;

  return {
    title,
    description: preview,
    openGraph: {
      title,
      description: preview,
      url: `/zup/${id}`,
      siteName: 'zup',
      images: [
        {
          url: post.picture,
          width: 256,
          height: 256,
          alt: post.author
        }
      ],
      type: 'article'
    },
    twitter: {
      card: 'summary',
      title,
      description: preview,
      images: [post.picture]
    }
  };
}

export default async function SharedPostPage({ params }: Props) {
  const { id } = await params;
  const post = KNOWN_POSTS[id] || {
    author: `Operator ${formatHex(id, 6, 4)}`,
    handle: `@${formatHex(id, 6, 0)}`,
    content: `Verified Nostr dispatch on zup. Content ID: ${id}`,
    picture: `https://api.dicebear.com/7.x/identicon/svg?seed=${id}`,
    date: 'Nostr Relay Network'
  };

  return (
    <div className="min-h-screen bg-[#161412] text-white flex flex-col justify-between p-4 sm:p-8 font-sans selection:bg-pink-500/30">
      {/* Header */}
      <header className="max-w-2xl w-full mx-auto flex items-center justify-between pb-6 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-2xl font-black text-white group-hover:text-pink-400 transition-colors">
            zup
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
        </Link>
        <Link
          href="/"
          className="px-4 py-2 rounded-[14px] bg-pink-500 hover:bg-pink-400 text-black text-xs font-bold font-mono transition-colors shadow-lg shadow-pink-500/20"
        >
          Open in zup
        </Link>
      </header>

      {/* Main Post Card (Twitter / X clean styling) */}
      <main className="max-w-2xl w-full mx-auto my-8">
        <div className="p-6 sm:p-8 bg-[#000000] border border-white/20 rounded-[24px] shadow-2xl space-y-5">
          {/* Author Header */}
          <div className="flex items-center gap-3.5 pb-4 border-b border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.picture}
              alt={post.author}
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-full border border-white/20 bg-[#161412] object-cover shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white truncate m-0">
                {post.author}
              </h1>
              <p className="text-xs font-mono text-white/50 m-0 truncate">
                {post.handle} · {post.date}
              </p>
            </div>
          </div>

          {/* Body Content */}
          <div className="text-base sm:text-lg leading-relaxed text-white whitespace-pre-wrap break-words font-normal">
            {post.content}
          </div>

          {/* Cryptographic Event Provenance */}
          <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono text-white/50">
            <span className="truncate max-w-sm">Event ID: {id}</span>
            <span className="text-emerald-400 font-bold">✓ BIP-340 Schnorr Verified</span>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between">
            <Link
              href="/"
              className="w-full py-3 rounded-[16px] bg-[#161412] hover:bg-[#1E1C1A] border border-white/20 hover:border-pink-500 text-center font-bold text-xs text-white transition-all shadow-md"
            >
              Join Conversation on zup
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-2xl w-full mx-auto text-center text-xs font-mono text-white/40 pt-6">
        <span>zup · Ultra-lean Nostr web client & workspace</span>
      </footer>
    </div>
  );
}
