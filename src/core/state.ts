import { config } from './config.js';
import { type TendEvent, type SessionState, type ProjectState, type State, STATE_PRIORITY } from '../types.js';
import { isStale, toEpoch } from '../ui/format.js';
import { readEvents, mergeEvents, isResetMarker, userTagFromSessionId } from './events.js';
import { lastCommitEpoch as getLastCommitEpoch, gitRepoName } from './git.js';
import { join } from 'path';
import { existsSync } from 'fs';

/** Aggregate events into a single ProjectState */
export function aggregateState(
  events: TendEvent[],
  staleThreshold: number = config.staleThreshold,
  commitEpoch?: number,
): ProjectState | null {
  if (events.length === 0) return null;

  const sessions = new Map<string, SessionState>();
  let lastTs = '';

  for (const evt of events) {
    lastTs = evt.ts;

    if (evt.sessionId === '*') {
      // Global reset marker — clear all sessions (backward compat)
      sessions.clear();
      sessions.set('_', { state: evt.state, ts: evt.ts, message: '' });
      continue;
    }

    if (evt.sessionId.startsWith('*@')) {
      // User-scoped reset — only clear sessions tagged for this user,
      // plus any untagged sessions (backward compat with old event formats).
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

  if (sessions.size === 0) return null;

  // Demote stale working sessions to idle
  for (const [id, sess] of sessions) {
    if (sess.state === 'working' && isStale(sess.ts, staleThreshold)) {
      sessions.set(id, { ...sess, state: 'idle' });
    }
    // Demote working sessions when a newer commit exists
    if (sess.state === 'working' && commitEpoch && toEpoch(sess.ts) < commitEpoch) {
      sessions.set(id, { ...sess, state: 'idle' });
    }
  }

  // Demote orphan working sessions: if a user has a newer session
  // (any state), older working sessions are orphans.
  // A user can only actively work in one session at a time.
  const latestByUser = new Map<string, { ts: string; state: string }>();
  for (const [id, sess] of sessions) {
    const userTag = userTagFromSessionId(id);
    const existing = latestByUser.get(userTag);
    if (!existing || toEpoch(sess.ts) > toEpoch(existing.ts)) {
      latestByUser.set(userTag, { ts: sess.ts, state: sess.state });
    }
  }
  for (const [id, sess] of sessions) {
    if (sess.state !== 'working') continue;
    const userTag = userTagFromSessionId(id);
    const latest = latestByUser.get(userTag);
    if (latest && toEpoch(latest.ts) > toEpoch(sess.ts)) {
      sessions.set(id, { ...sess, state: 'idle' });
    }
  }

  // Aggregate: pick highest-priority state
  let bestState: State = 'idle';
  let bestPriority = 0;
  let bestMessage = '';
  let bestTs = '';
  const stateCounts = new Map<State, number>();
  const workingTimestamps: string[] = [];

  for (const [, sess] of sessions) {
    const p = STATE_PRIORITY[sess.state];
    stateCounts.set(sess.state, (stateCounts.get(sess.state) || 0) + 1);
    if (sess.state === 'working') workingTimestamps.push(sess.ts);

    if (p > bestPriority || (p === bestPriority && toEpoch(sess.ts) > toEpoch(bestTs))) {
      bestPriority = p;
      bestState = sess.state;
      bestMessage = sess.message;
      bestTs = sess.ts;
    }
  }

  if (!bestTs) bestTs = lastTs;

  return {
    state: bestState,
    message: bestMessage,
    ts: bestTs,
    activeCount: stateCounts.get(bestState) || 0,
    workingTimestamps,
  };
}

/** Get aggregate state for a project path (reads local events + relay cache) */
export function projectState(projectPath: string): ProjectState | null {
  const eventsFile = join(projectPath, '.tend', 'events');
  const projectName = gitRepoName(projectPath);
  const relayCache = join(config.relayCacheDir, projectName);

  const localEvents = readEvents(eventsFile);
  const relayEvents = existsSync(relayCache) ? readEvents(relayCache) : [];

  if (localEvents.length === 0 && relayEvents.length === 0) return null;

  const merged = localEvents.length > 0 && relayEvents.length > 0
    ? mergeEvents(localEvents, relayEvents)
    : localEvents.length > 0
      ? localEvents
      : relayEvents;

  const commitEpoch = getLastCommitEpoch(projectPath) ?? undefined;
  return aggregateState(merged, config.staleThreshold, commitEpoch);
}

/** Get aggregate state for a relay-only project (from cache only) */
export function relayProjectState(projectName: string): ProjectState | null {
  const cacheFile = join(config.relayCacheDir, projectName);
  const events = readEvents(cacheFile);
  return aggregateState(events);
}

/** Check if a state needs human attention */
export function needsAttention(state: State): boolean {
  return state === 'done' || state === 'stuck' || state === 'waiting';
}

/** Get the icon for a state */
export function stateIcon(state: State | ''): string {
  switch (state) {
    case 'stuck':
    case 'waiting':
      return '?';
    case 'done':
      return '◉';
    case 'working':
      return '◐';
    case 'idle':
    default:
      return '◌';
  }
}

/** Get the ANSI color code for a state */
export function stateColor(state: State | ''): string {
  // Import dynamically to avoid circular — use inline
  const isTTY = process.stdout.isTTY ?? false;
  const noColor = !!process.env.NO_COLOR;
  if (!isTTY || noColor) return '';
  
  switch (state) {
    case 'stuck':
    case 'waiting':
      return '\x1b[31m'; // red
    case 'done':
      return '\x1b[32m'; // green
    case 'working':
      return '\x1b[36m'; // cyan
    default:
      return '\x1b[90m'; // grey
  }
}

/** Get the display label for a state */
export function stateLabel(state: State | ''): string {
  switch (state) {
    case 'done': return 'done';
    case 'stuck': return 'stuck';
    case 'waiting': return 'waiting';
    case 'working': return 'working';
    case 'idle': return 'idle';
    default: return 'no signal';
  }
}
