import type { Metadata } from 'next';
import { fetchNostrEventAndProfile } from '@/lib/core/nostr/fetcher';
import { formatHex, generateLocalIdenticon } from '@/lib/core/nostr';
import { SharedPostClient } from './SharedPostClient';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await fetchNostrEventAndProfile(id);

  const author = post?.author || `Operator ${formatHex(id, 6, 4)}`;
  const content = post?.content || `Verified Nostr dispatch on zup: ${id.slice(0, 32)}...`;
  const picture = post?.picture || generateLocalIdenticon(id);

  const preview = content.length > 120 ? content.slice(0, 117) + '...' : content;
  const title = `${author} on zup: "${preview}"`;

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
          url: picture,
          width: 256,
          height: 256,
          alt: author
        }
      ],
      type: 'article'
    },
    twitter: {
      card: 'summary',
      title,
      description: preview,
      images: [picture]
    }
  };
}

export default async function SharedPostPage({ params }: Props) {
  const { id } = await params;
  const initialPost = await fetchNostrEventAndProfile(id);

  return <SharedPostClient id={id} initialPost={initialPost} />;
}
