import { resolveProjectPath, resolveProjectName } from '../core/projects.js';
import { appendEvent, sanitizeUserTag } from '../core/events.js';
import { relayEmit, relayToken, relayPushContext } from '../core/relay.js';
import { tsLocal } from '../ui/format.js';
import { config } from '../core/config.js';
import { isValidState, type State } from '../types.js';
import { gitUserEmail } from '../core/git.js';
import { existsSync } from 'fs';
import { join } from 'path';
import { invalidateStatusCache } from './status.js';
import { clearNote } from './note.js';

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

  // Try to resolve the local project path. In cloud/relay-only sessions (e.g. GitHub
  // Actions or Copilot agents) the project may not have a local .tend/ directory — that
  // is fine as long as a relay token is available for relay-only emit.
  let projectPath: string | null = null;
  try {
    projectPath = resolveProjectPath();
  } catch {
    // Not inside a recognised project; relay-only emit may still succeed below.
  }

  const tendDir = projectPath ? join(projectPath, '.tend') : null;
  const hasLocalTend = tendDir !== null && existsSync(tendDir);

  if (hasLocalTend && tendDir && projectPath) {
    // Local write.
    const ts = tsLocal();
    const rawEmail = gitUserEmail(projectPath);
    const rawSessionId = config.sessionId || '_cli';
    const sessionId = rawEmail ? `${rawSessionId}@${sanitizeUserTag(rawEmail)}` : rawSessionId;
    appendEvent(join(tendDir, 'events'), ts, sessionId, state as State, message);
    clearNote(projectPath);
    invalidateStatusCache();
  }

  // Send to relay if a token is configured (best-effort, does not affect local write).
  const token = relayToken();
  if (token) {
    let projectName: string;
    try {
      projectName = resolveProjectName();
    } catch {
      // Prefer GITHUB_REPOSITORY (set in all GitHub Actions / Copilot agent environments)
      // so the project name on the relay board matches the repo name.
      const ghRepo = process.env.GITHUB_REPOSITORY;
      projectName = ghRepo
        ? ghRepo.split('/').pop() || 'unknown'
        : process.cwd().split('/').pop() || 'unknown';
    }
    const relayProjectPath = projectPath ?? process.cwd();
    const rawEmailRelay = gitUserEmail(relayProjectPath);
    const rawSessionIdRelay = config.sessionId || '_cli';
    const sessionIdRelay = rawEmailRelay ? `${rawSessionIdRelay}@${sanitizeUserTag(rawEmailRelay)}` : rawSessionIdRelay;
    await Promise.all([
      relayEmit(projectName, state, message, sessionIdRelay),
      relayPushContext(relayProjectPath, projectName),
    ]);
  } else if (!hasLocalTend) {
    // No local .tend/ and no relay token — cannot emit anywhere.
    process.stderr.write("tend: .tend/ not initialized. Run 'tend init' first, or set TEND_RELAY_TOKEN for relay-only mode.\n");
    process.exit(1);
  }
}
