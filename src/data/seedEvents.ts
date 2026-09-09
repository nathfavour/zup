import { NostrEvent } from '../types';

export const INITIAL_EVENTS: NostrEvent[] = [
  {
    id: 'e101-ai-speculative-decoding',
    pubkey: '3bf0c63fcb93463407af97b5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
    created_at: Math.floor(Date.now() / 1000) - 120,
    kind: 1,
    tags: [['t', 'ai'], ['t', 'tech'], ['t', 'engineering']],
    content: `Benchmarked speculative decoding on 70B MoE models with our custom CUDA kernel today.

Speedup went from 38 tok/sec to 114 tok/sec (3.0x) on single-node dual H100 with FlashAttention-3. The key is pipelining the draft model's KV-cache across unified NVLink without host roundtrips.

Code and Triton kernels open-sourced on GitHub: github.com/zup-mesh/fast-spec-decode ⚡🔥`,
    sig: 'c89fa...valid',
    author: {
      name: 'karpathy_fan',
      displayName: 'Alex Chen (AI Systems)',
      npub: 'npub1chenai80cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkws',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      nip05: 'alex@chen.ai',
    },
    relayUrl: 'wss://relay.damus.io',
    signalTier: 'tier1',
    category: 'ai',
    likesCount: 384,
    repostsCount: 112,
    zapsCount: 8400,
    repliesCount: 47,
    isLiked: false,
    isReposted: false,
    isZapped: false,
  },
  {
    id: 'e102-systems-rust-ebpf',
    pubkey: '82341f882b6eabcd2d62ef022249ec371142166391a11c5183dd2b8361e67182',
    created_at: Math.floor(Date.now() / 1000) - 480,
    kind: 1,
    tags: [['t', 'systems'], ['t', 'rust'], ['t', 'tech']],
    content: `Replaced our ingress reverse proxy with an eBPF XDP filter written in Rust (Aya).

Results under 40M packet/sec DDoS test:
- Kernel context switches: dropped 92%
- p99 latency: 1.8ms -> 94μs
- Zero memory copies between NIC ring buffer and userspace

If you're building high-throughput distributed networks, stop parsing TCP packets in userspace. Let the NIC driver drop invalid packets at line rate.`,
    sig: 'd92ba...valid',
    author: {
      name: 'vlad_rust',
      displayName: 'Vlad Kozlov',
      npub: 'npub1vladsystems6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      nip05: 'vlad@kernel.dev',
    },
    relayUrl: 'wss://nos.lol',
    signalTier: 'tier1',
    category: 'systems',
    likesCount: 520,
    repostsCount: 168,
    zapsCount: 12500,
    repliesCount: 63,
    isLiked: true,
    isReposted: false,
    isZapped: false,
  },
  {
    id: 'e103-stem-quantum-spectroscopy',
    pubkey: '460c25e682fda7832b52d6910658427631979aa37e89184550cbe3a1cfa830f2',
    created_at: Math.floor(Date.now() / 1000) - 1340,
    kind: 1,
    tags: [['t', 'stem'], ['t', 'physics'], ['t', 'cryptography']],
    content: `New paper on lattice-based Ring-LWE post-quantum key exchange on resource-constrained microcontrollers:

We managed to fit Kyber-768 inside 16KB of SRAM on an STM32F4 with constant-time polynomial multiplication via Number Theoretic Transform (NTT).

T2 coherence of our topological qubit simulator also held for 3.4ms at 15mK dilution fridge temperatures. Rigorous peer review preprint uploaded to arXiv today. 🔬📐`,
    sig: 'e102f...valid',
    author: {
      name: 'dr_elena',
      displayName: 'Dr. Elena Rostova',
      npub: 'npub1elenaquantum0cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkws',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      nip05: 'elena@mit.edu',
    },
    relayUrl: 'wss://relay.nostr.band',
    signalTier: 'tier1',
    category: 'stem',
    likesCount: 680,
    repostsCount: 215,
    zapsCount: 14200,
    repliesCount: 81,
    isLiked: false,
    isReposted: false,
    isZapped: true,
  },
  {
    id: 'e104-tech-startup-migration',
    pubkey: 'fa98341f882b6eabcd2d62ef022249ec371142166391a11c5183dd2b8361e671',
    created_at: Math.floor(Date.now() / 1000) - 2400,
    kind: 1,
    tags: [['t', 'tech'], ['t', 'startups'], ['t', 'builders']],
    content: `Why we migrated our 1.2M MAU developer telemetry platform from AWS to bare-metal Supermicro colocation:

- AWS bill: $48,500/month
- Bare metal co-lo (4x dual EPYC 9654 nodes + 100Gbps transit): $4,200/month
- Latency: cut p95 by 44% because no noisy neighbor virtualization

Cloud is great for 0-to-1 prototyping. For serious data-plane volume, sovereign infrastructure wins on unit economics every single time. 🛠️`,
    sig: 'f442b...valid',
    author: {
      name: 'marcus_builds',
      displayName: 'Marcus Sterling',
      npub: 'npub1marcusfoundertkh0xzn2vs2rrnmxdwlsahllc0x23dun62q99egwfwl9sa5qu79m94',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
      nip05: 'marcus@infra.sh',
    },
    relayUrl: 'wss://relay.primal.net',
    signalTier: 'tier1',
    category: 'tech',
    likesCount: 940,
    repostsCount: 340,
    zapsCount: 31000,
    repliesCount: 112,
    isLiked: false,
    isReposted: false,
    isZapped: true,
  },
  {
    id: 'e105-systems-distributed-consensus',
    pubkey: '1726a482b6eabcd2d62ef022249ec371142166391a11c5183dd2b8361e67182',
    created_at: Math.floor(Date.now() / 1000) - 4100,
    kind: 1,
    tags: [['t', 'systems'], ['t', 'crypto'], ['t', 'tech']],
    content: `Nostr relays don't need Raft or Paxos consensus because notes are immutable, cryptographically signed DAG events.

By shifting verification from the database cluster to client-side Secp256k1 validation, Nostr clients like Zup can query 10 untrusted relays in parallel and deterministically eliminate invalid state.

Dumb relays + smart cryptographic clients is the optimal architecture for censorship-resistant communication.`,
    sig: 'a881c...valid',
    author: {
      name: 'jack',
      displayName: 'jack',
      npub: 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0km5gr',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      nip05: 'jack@cash.app',
    },
    relayUrl: 'wss://nos.lol',
    signalTier: 'tier1',
    category: 'systems',
    likesCount: 1420,
    repostsCount: 490,
    zapsCount: 65000,
    repliesCount: 148,
    isLiked: true,
    isReposted: true,
    isZapped: false,
  },
  {
    id: 'e106-stem-robotics-sim2real',
    pubkey: '9211c482b6eabcd2d62ef022249ec371142166391a11c5183dd2b8361e67182',
    created_at: Math.floor(Date.now() / 1000) - 5600,
    kind: 1,
    tags: [['t', 'stem'], ['t', 'robotics'], ['t', 'ai']],
    content: `Sim-to-real transfer for bipedal locomotion using reinforcement learning over domain-randomized physics:

We trained an end-to-end MLP policy in Isaac Gym with 4096 parallel environments in 35 minutes on one RTX 4090. Zero fine-tuning on physical hardware; walked across gravel, stairs, and ice on the first run.

The era of hand-tuned PID controllers for dynamic robotics is officially over. 🤖🦾`,
    sig: 'b112c...valid',
    author: {
      name: 'maya_robotics',
      displayName: 'Maya Lin (Robotics)',
      npub: 'npub1mayarobotics92j4s3evf6u64th6gkwsyjh6w60cvv07tjdrrgpa0j7j7tmnyl',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
      nip05: 'maya@robotics.cmu.edu',
    },
    relayUrl: 'wss://relay.damus.io',
    signalTier: 'tier1',
    category: 'stem',
    likesCount: 712,
    repostsCount: 189,
    zapsCount: 9200,
    repliesCount: 54,
    isLiked: false,
    isReposted: false,
    isZapped: false,
  },
  // Simulated Spam Items (Aggressively filtered out by default Tier 1 Curation Shield)
  {
    id: 'e999-spam-airdrop-bot',
    pubkey: '0000deadbeefbot000000000000000000000000000000000000000000000000',
    created_at: Math.floor(Date.now() / 1000) - 300,
    kind: 1,
    tags: [['t', 'airdrop'], ['t', 'free']],
    content: '🚨 URGENT FREE 10,000 TOKEN AIRDROP! Connect your seed phrase now at free-tokens-claim.xyz to verify your wallet before snapshot ends!! 💸🚀',
    sig: 'fake_sig',
    author: {
      name: 'CryptoGiveawayBot99',
      displayName: 'CLAIM FREE TOKENS NOW',
    },
    relayUrl: 'wss://untrusted.spambot.net',
    signalTier: 'spam',
    isSpam: true,
    likesCount: 1,
    repostsCount: 0,
    zapsCount: 0,
    repliesCount: 0,
  },
  {
    id: 'e998-spam-telegram-promo',
    pubkey: '0000telegrampump000000000000000000000000000000000000000000000000',
    created_at: Math.floor(Date.now() / 1000) - 600,
    kind: 1,
    tags: [['t', 'crypto'], ['t', 'signals']],
    content: 'Join our VIP signal group on t.me/pump100x_signals for guaranteed 500% daily returns on leverage trading!! Click fast!',
    sig: 'fake_sig',
    author: {
      name: 'VIP_Signals_Bot',
      displayName: '100X DAILY SIGNALS',
    },
    relayUrl: 'wss://junk-relay.xyz',
    signalTier: 'spam',
    isSpam: true,
    likesCount: 0,
    repostsCount: 0,
    zapsCount: 0,
    repliesCount: 0,
  }
];

export const INITIAL_DIRECT_MESSAGES = [
  {
    peerPubkey: '82341f882b6eabcd2d62ef022249ec371142166391a11c5183dd2b8361e67182',
    peerNpub: 'npub1vladsystems6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q',
    peerName: 'Vlad Kozlov',
    peerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    lastMessage: 'Benchmarked the SIMD vector parser on the relay feed. Ready to merge into Zup core.',
    timestamp: Math.floor(Date.now() / 1000) - 320,
    unreadCount: 1,
    messages: [
      {
        id: 'm1',
        senderPubkey: '82341f882b6eabcd2d62ef022249ec371142166391a11c5183dd2b8361e67182',
        content: 'Check out the AVX-512 JSON parser. Drops event deserialization latency from 4μs to 380ns.',
        timestamp: Math.floor(Date.now() / 1000) - 900,
        isEncrypted: true,
      },
      {
        id: 'm2',
        senderPubkey: 'my-key',
        content: 'Impressive throughput numbers. Integrating with Zup encrypted stream cache.',
        timestamp: Math.floor(Date.now() / 1000) - 600,
        isEncrypted: true,
      },
      {
        id: 'm3',
        senderPubkey: '82341f882b6eabcd2d62ef022249ec371142166391a11c5183dd2b8361e67182',
        content: 'Benchmarked the SIMD vector parser on the relay feed. Ready to merge into Zup core.',
        timestamp: Math.floor(Date.now() / 1000) - 320,
        isEncrypted: true,
      },
    ],
  },
  {
    peerPubkey: '460c25e682fda7832b52d6910658427631979aa37e89184550cbe3a1cfa830f2',
    peerNpub: 'npub1elenaquantum0cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkws',
    peerName: 'Dr. Elena Rostova',
    peerAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    lastMessage: 'The post-quantum key exchange test vector was verified on Nostr NIP-44.',
    timestamp: Math.floor(Date.now() / 1000) - 1800,
    unreadCount: 0,
    messages: [
      {
        id: 'm4',
        senderPubkey: '460c25e682fda7832b52d6910658427631979aa37e89184550cbe3a1cfa830f2',
        content: 'The post-quantum key exchange test vector was verified on Nostr NIP-44.',
        timestamp: Math.floor(Date.now() / 1000) - 1800,
        isEncrypted: true,
      },
    ],
  },
];
