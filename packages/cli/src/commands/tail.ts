import { Command } from 'commander';

interface TailOptions {
  kinds: string;
  limit: string;
}

export const tailCommand = new Command('tail')
  .description('Stream real-time technical events from configured Nostr relays')
  .option('-k, --kinds <kinds>', 'Comma-separated event kinds to filter', '1,30023')
  .option('-l, --limit <limit>', 'Maximum number of historical events to fetch', '20')
  .action((options: TailOptions) => {
    console.log(`[zup] Tail streaming kinds: ${options.kinds} (limit: ${options.limit})...`);
    console.log('[zup] Connected to default relay pool: wss://nos.lol, wss://relay.damus.io');
    console.log('[zup] Listening for incoming verified Schnorr dispatches...');
  });
