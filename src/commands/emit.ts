import { resolveProjectPath, resolveProjectName } from '../core/projects.js';
import { appendEvent } from '../core/events.js';
import { relayEmit } from '../core/relay.js';
import { tsLocal } from '../ui/format.js';
import { config } from '../core/config.js';
import { isValidState, type State } from '../types.js';
import { existsSync } from 'fs';
import { join } from 'path';
import { invalidateStatusCache } from './status.js';

export async function cmdEmit(args: string[]): Promise<void> {
  const state = args[0];
  const message = args.slice(1).join(' ');

  if (!state) {
    process.stderr.write('Usage: tend emit <state> [message]\n');
    process.stderr.write('States: working, done, stuck, waiting, idle\n');
    process.exit(1);
  }

  if (!isValidState(state)) {
    process.stderr.write(`tend: invalid state '${state}'\n`);
    process.stderr.write('Valid states: working, done, stuck, waiting, idle\n');
    process.exit(1);
  }

  // Relay mode: POST to relay when TEND_RELAY_TOKEN is set
  if (config.relayToken) {
    let projectName: string;
    try {
      projectName = resolveProjectName();
    } catch {
      projectName = process.cwd().split('/').pop() || 'unknown';
    }
    const sessionId = config.sessionId || '';
    const ok = await relayEmit(projectName, state, message, sessionId);
    if (ok) return;
    process.stderr.write('tend: relay unreachable, falling back to local\n');
  }

  const projectPath = (() => {
    try {
      return resolveProjectPath();
    } catch (e) {
      process.stderr.write(`tend: ${(e as Error).message}\n`);
      process.exit(1);
    }
  })();

  const tendDir = join(projectPath, '.tend');
  if (!existsSync(tendDir)) {
    process.stderr.write("tend: .tend/ not initialized. Run 'tend init' first.\n");
    process.exit(1);
  }

  const ts = tsLocal();
  const sessionId = config.sessionId || '_cli';
  appendEvent(join(projectPath, '.tend', 'events'), ts, sessionId, state as State, message);
  invalidateStatusCache();
}
