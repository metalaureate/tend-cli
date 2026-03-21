import { resolveProjectPath, resolveProjectName } from '../core/projects.js';
import { appendEvent, sanitizeUserTag } from '../core/events.js';
import { relayEmit, relayToken } from '../core/relay.js';
import { tsLocal } from '../ui/format.js';
import { config } from '../core/config.js';
import { isValidState, type State } from '../types.js';
import { gitUserEmail } from '../core/git.js';
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

  // Relay mode: POST to relay when TEND_RELAY_TOKEN is set (env var) or relay_token file exists
  const token = relayToken();
  let relayOk = false;
  if (token) {
    let projectName: string;
    try {
      projectName = resolveProjectName();
    } catch {
      projectName = process.cwd().split('/').pop() || 'unknown';
    }
    const rawEmail = gitUserEmail(process.cwd());
    const rawSessionId = config.sessionId || '';
    const sessionId = rawEmail ? `${rawSessionId}@${sanitizeUserTag(rawEmail)}` : rawSessionId;
    relayOk = await relayEmit(projectName, state, message, sessionId);
    if (!relayOk) {
      process.stderr.write('tend: relay unreachable, falling back to local\n');
    }
  }

  // Attempt to write locally too (so local board reflects current state).
  // If relay already succeeded and local is not initialized, skip silently.
  let projectPath: string;
  try {
    projectPath = resolveProjectPath();
  } catch (e) {
    if (relayOk) return; // relay succeeded, local not available — that's fine
    process.stderr.write(`tend: ${(e as Error).message}\n`);
    process.exit(1);
  }

  const tendDir = join(projectPath, '.tend');
  if (!existsSync(tendDir)) {
    if (relayOk) return; // relay succeeded, local not initialized — that's fine
    process.stderr.write("tend: .tend/ not initialized. Run 'tend init' first.\n");
    process.exit(1);
  }

  const ts = tsLocal();
  const rawEmail = gitUserEmail(projectPath);
  const rawSessionId = config.sessionId || '_cli';
  const sessionId = rawEmail ? `${rawSessionId}@${sanitizeUserTag(rawEmail)}` : rawSessionId;
  appendEvent(join(projectPath, '.tend', 'events'), ts, sessionId, state as State, message);
  invalidateStatusCache();
}
