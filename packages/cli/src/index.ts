#!/usr/bin/env node

/**
 * @zup/cli: Command line interface for the zup Nostr ecosystem.
 * Communicates with local Dexie/SQLite DB and configured relays.
 */

import { Command } from 'commander';
import { tailCommand } from './commands/tail';
import { publishCommand } from './commands/publish';
import { identityCommand } from './commands/identity';
import { syncCommand } from './commands/sync';
import { inspectCommand } from './commands/inspect';

const program = new Command();

program
  .name('zup')
  .description('Ultra-lean, low-bandwidth Nostr client and workspace CLI')
  .version('1.0.0');

// Register CLI commands
program.addCommand(tailCommand);
program.addCommand(publishCommand);
program.addCommand(identityCommand);
program.addCommand(syncCommand);
program.addCommand(inspectCommand);

program.parse(process.argv);
