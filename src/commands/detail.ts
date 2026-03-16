import { resolveProjectPath } from '../core/projects.js';
import { projectState, relayProjectState, stateIcon, stateLabel } from '../core/state.js';
import { readEvents, mergeEvents, isResetMarker, stripUserTag, userTagFromSessionId } from '../core/events.js';
import { currentBranch, commitsToday } from '../core/git.js';
import { ago, isStale } from '../ui/format.js';
import { C } from '../ui/colors.js';
import { config } from '../core/config.js';
import { existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import type { TendEvent, SessionState, State } from '../types.js';
import { isValidState } from '../types.js';

function stateColor(state: string): string {
  const isTTY = process.stdout.isTTY ?? false;
  const noColor = !!process.env.NO_COLOR;
  if (!isTTY || noColor) return '';
  switch (state) {
    case 'stuck': case 'waiting': return '\x1b[31m';
    case 'done': return '\x1b[32m';
    case 'working': return '\x1b[36m';
    default: return '\x1b[90m';
  }
}

export function cmdDetail(name: string): void {
  let projectPath: string | null = null;
  let projectName = name;
  let isRelayOnly = false;

  try {
    projectPath = resolveProjectPath(name);
    projectName = basename(projectPath);
  } catch {
    // Check relay cache
    const cacheFile = join(config.relayCacheDir, name);
    if (existsSync(cacheFile)) {
      isRelayOnly = true;
    } else {
      process.stderr.write(`tend: cannot resolve project '${name}'\n`);
      process.exit(1);
    }
  }

  let state = '';
  let msg = '';
  let ts = '';
  let activeCount = 0;

  if (!isRelayOnly && projectPath) {
    const ps = projectState(projectPath);
    if (ps) {
      state = ps.state;
      msg = ps.message;
      ts = ps.ts;
      activeCount = ps.activeCount;
    }
  } else {
    const ps = relayProjectState(projectName);
    if (ps) {
      state = ps.state;
      msg = ps.message;
      ts = ps.ts;
      activeCount = ps.activeCount;
    }
  }

  const icon = stateIcon(state as any || '');
  const color = stateColor(state);
  let label = stateLabel(state as any || '');
  if (activeCount > 1) label = `${activeCount} ${state}`;

  const upperName = projectName.toUpperCase();
  const reset = C.reset;

  process.stdout.write(`\n  ${C.bold}${upperName}${reset}                               ${color}${icon} ${label}${reset}\n\n`);

  if (msg) process.stdout.write(`  Current: ${msg}\n`);
  if (ts) {
    const agoStr = ago(ts);
    process.stdout.write(`  Since:   ${ts} (${agoStr} ago)\n`);
  }

  if (!isRelayOnly && projectPath) {
    const branch = currentBranch(projectPath);
    if (branch) process.stdout.write(`  Branch:  ${branch}\n`);

    const commitCount = commitsToday(projectPath);
    if (commitCount > 0) process.stdout.write(`  Commits: ${commitCount} today\n`);
  }

  // Session breakdown
  const localEvents = !isRelayOnly && projectPath
    ? readEvents(join(projectPath, '.tend', 'events'))
    : [];
  
  const relayCache = join(config.relayCacheDir, projectName);
  const relayEvents = existsSync(relayCache) ? readEvents(relayCache) : [];

  if (localEvents.length > 0 || relayEvents.length > 0) {
    process.stdout.write(`\n  ${C.bold}Sessions:${reset}\n`);

    // Build per-source session maps — all branches are shown so that sessions on
    // other worktree branches remain visible. Branch-scoped resets only clear
    // sessions for that particular branch.
    const renderSessions = (events: TendEvent[], source: string) => {
      const sessions = new Map<string, SessionState>();

      for (const evt of events) {
        if (evt.sessionId === '*') {
          // Global reset — clear all sessions
          sessions.clear();
          continue;
        }
        if (evt.sessionId.startsWith('*@')) {
          // User-scoped reset — only clear sessions tagged for that user
          const userTag = userTagFromSessionId(evt.sessionId.slice(1)); // strip leading '*'
          for (const [sid] of sessions) {
            if (userTagFromSessionId(sid) === userTag || userTagFromSessionId(sid) === '') {
              sessions.delete(sid);
            }
          }
          continue;
        }
        sessions.set(evt.sessionId, {
          state: evt.state,
          ts: evt.ts,
          message: evt.message,
        });
      }

      const entries: Array<{ sid: string; state: State; ts: string; msg: string; source: string }> = [];
      for (const [sid, sess] of sessions) {
        entries.push({ sid, state: sess.state, ts: sess.ts, msg: sess.message, source });
      }
      return entries;
    };

    const allSessions = [
      ...renderSessions(localEvents, 'local'),
      ...renderSessions(relayEvents, 'relay'),
    ];

    let sessionCount = 0;
    for (const s of allSessions) {
      sessionCount++;
      let sessState = s.state;

      // Demote stale working
      if (sessState === 'working' && isStale(s.ts, config.staleThreshold)) {
        sessState = 'idle';
      }

      const sIcon = stateIcon(sessState);
      const sColor = stateColor(sessState);
      const sLabel = stateLabel(sessState);

      // Format session ID — show base ID with user context where present
      const bareId = stripUserTag(s.sid);
      const userTag = userTagFromSessionId(s.sid);
      let displaySid = bareId;
      if (bareId === '_cli') displaySid = 'cli';
      else if (bareId.length > 16) displaySid = `${bareId.slice(0, 8)}…${bareId.slice(-4)}`;
      if (userTag) displaySid += ` (${userTag})`;

      const sourceTag = s.source === 'relay' ? ' ↗' : '';
      const agoStr = s.ts ? ago(s.ts) : '';
      const msgDisplay = s.msg && s.msg !== '-' ? s.msg : '';

      let line = `    ${sColor}${sIcon} ${sLabel.padEnd(10)}  ${(displaySid + sourceTag).padEnd(20)} ${reset}`;
      if (msgDisplay) line += `  ${msgDisplay}`;
      if (agoStr) line += `  ${C.grey}(${agoStr})${reset}`;
      process.stdout.write(line + '\n');
    }

    if (sessionCount === 0) {
      process.stdout.write('    No active sessions\n');
    }
  }

  // TODOs
  if (!isRelayOnly && projectPath) {
    const todoFile = join(projectPath, '.tend', 'TODO');
    if (existsSync(todoFile)) {
      const content = readFileSync(todoFile, 'utf-8').trim();
      if (content) {
        process.stdout.write(`\n  ${C.bold}TODO:${reset}\n`);
        let n = 1;
        for (const line of content.split('\n')) {
          if (!line.trim()) continue;
          let item = line;
          if (item.startsWith('[')) {
            item = item.replace(/^\[[^\]]*\]\s*/, '');
          }
          process.stdout.write(`    ${n}. ${item}\n`);
          n++;
        }
      }
    }
  }

  process.stdout.write('\n');
}
