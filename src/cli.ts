#!/usr/bin/env bun

import { cmdBoard } from './commands/board.js';
import { cmdDashboard } from './commands/dashboard.js';
import { cmdDemo } from './commands/demo.js';
import { cmdDetail } from './commands/detail.js';
import { cmdInit } from './commands/init.js';
import { cmdEmit } from './commands/emit.js';
import { cmdClear } from './commands/clear.js';
import { cmdStatus, cmdStatusRefresh } from './commands/status.js';
import { cmdAdd } from './commands/add.js';
import { cmdAck } from './commands/ack.js';
import { cmdSwitch } from './commands/switch.js';
import { cmdRelay } from './commands/relay.js';
import { cmdDispatch } from './commands/dispatch.js';
import { cmdHook } from './commands/hooks.js';
import { cmdVersion } from './commands/version.js';
import { cmdHelp } from './commands/help.js';
import { cmdRemove } from './commands/remove.js';
import { cmdNote } from './commands/note.js';
import { resolveProjectPath } from './core/projects.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cmd = args[0] || '';
  const rest = args.slice(1);

  try {
    switch (cmd) {
      case '':
        await cmdBoard();
        break;
      case 'watch':
      case '-': // legacy alias
        await cmdDashboard();
        break;
      case 'demo':
        await cmdDemo(rest);
        break;
      case 'init':
        cmdInit(rest);
        break;
      case 'emit':
        await cmdEmit(rest);
        break;
      case 'clear':
        cmdClear(rest);
        break;
      case 'status':
        if (rest.includes('--refresh')) {
          cmdStatusRefresh();
        } else {
          cmdStatus();
        }
        break;
      case 'add':
      case 'todo':
      case 'todos':
        await cmdAdd(rest);
        break;
      case 'ack':
        await cmdAck(rest);
        break;
      case 'switch':
      case 'sw':
        cmdSwitch(rest);
        break;
      case 'relay':
        await cmdRelay(rest);
        break;
      case 'dispatch':
        await cmdDispatch(rest);
        break;
      case 'remove':
        await cmdRemove(rest);
        break;
      case 'note':
        await cmdNote(rest);
        break;
      case 'hook':
        await cmdHook(rest);
        break;
      case 'version':
        cmdVersion();
        break;
      case 'help':
      case '-h':
      case '--help':
        cmdHelp();
        break;
      default: {
        // Shortcut: "tend #2" → switch to project 2
        if (/^#\d+$/.test(cmd)) {
          cmdSwitch([cmd.slice(1)]);
          break;
        }
        // Check if it's a project name or number (detail view)
        try {
          resolveProjectPath(cmd);
          cmdDetail(cmd);
        } catch {
          process.stderr.write(`tend: unknown command '${cmd}'\n`);
          process.stderr.write("Run 'tend help' for usage\n");
          process.exit(1);
        }
        break;
      }
    }
  } catch (e) {
    if (e instanceof Error) {
      process.stderr.write(`tend: ${e.message}\n`);
    }
    process.exit(1);
  }
}

main();
