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
  const sessionWorkPending = new Map<string, boolean>();
  const sessionLastWorkingTs = new Map<string, string>();
  let lastTs = '';

  // Maximum gap (seconds) between a working event and a subsequent idle event
  // for the idle to be inferred as 'waiting'. Longer gaps indicate a natural
  // end-of-session that went idle without an explicit done, rather than a
  // mid-task pause that needs attention.
  const WAITING_INFERENCE_WINDOW_SECONDS = 600; // 10 minutes

  for (const evt of events) {
    lastTs = evt.ts;

    if (evt.sessionId === '*') {
      // Global reset marker — clear all sessions (backward compat)
      sessions.clear();
      sessionWorkPending.clear();
      sessionLastWorkingTs.clear();
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
          sessionWorkPending.delete(sid);
          sessionLastWorkingTs.delete(sid);
        }
      }
      continue;
    }

    // Track working-without-done per session
    if (evt.state === 'working') {
      sessionWorkPending.set(evt.sessionId, true);
      sessionLastWorkingTs.set(evt.sessionId, evt.ts);
    } else if (evt.state === 'done') {
      sessionWorkPending.set(evt.sessionId, false);
      sessionLastWorkingTs.delete(evt.sessionId);
    }

    // Infer waiting: idle after working without done, but only if the session
    // went idle within WAITING_INFERENCE_WINDOW seconds of the last working
    // event. Long-running sessions that end naturally (idle after hours of
    // work) should not be shown as waiting.
    let effectiveState = evt.state;
    if (evt.state === 'idle' && sessionWorkPending.get(evt.sessionId)) {
      const lastWorkingTs = sessionLastWorkingTs.get(evt.sessionId);
      const recentEnough = lastWorkingTs
        ? (toEpoch(evt.ts) - toEpoch(lastWorkingTs)) <= WAITING_INFERENCE_WINDOW_SECONDS
        : false;
      if (recentEnough) {
        effectiveState = 'waiting';
      }
    }

    sessions.set(evt.sessionId, {
      state: effectiveState,
      ts: evt.ts,
      message: evt.message,
    });
  }

  if (sessions.size === 0) return null;

  // Demote stale working/waiting sessions to idle
  for (const [id, sess] of sessions) {
    if ((sess.state === 'working' || sess.state === 'waiting') && isStale(sess.ts, staleThreshold)) {
      sessions.set(id, { ...sess, state: 'idle' });
    }
    // Demote working sessions when a newer commit exists
    if (sess.state === 'working' && commitEpoch && toEpoch(sess.ts) < commitEpoch) {
      sessions.set(id, { ...sess, state: 'idle' });
    }
    // A commit near or after the session started working means the user attended to it.
    // Grace window accounts for hook events firing slightly after the actual commit.
    // Only promote if the working event was within 1 hour of the commit (not ancient sessions).
    if (sess.state === 'waiting' && commitEpoch) {
      const workTs = sessionLastWorkingTs.get(id);
      if (workTs && toEpoch(workTs) <= commitEpoch + 120 && commitEpoch - toEpoch(workTs) < 3600) {
        sessions.set(id, { ...sess, state: 'done' });
      }
    }
  }

  // Demote orphan working/waiting sessions: if a user's most recent session
  // is idle or done, their older working/waiting sessions are orphans
  // (e.g. user-prompt hook fired but stop hook never followed).
  const latestByUser = new Map<string, { ts: string; state: string }>();
  for (const [id, sess] of sessions) {
    const userTag = userTagFromSessionId(id);
    const existing = latestByUser.get(userTag);
    if (!existing || toEpoch(sess.ts) > toEpoch(existing.ts)) {
      latestByUser.set(userTag, { ts: sess.ts, state: sess.state });
    }
  }
  for (const [id, sess] of sessions) {
    if (sess.state !== 'working' && sess.state !== 'waiting') continue;
    const userTag = userTagFromSessionId(id);
    const latest = latestByUser.get(userTag);
    if (latest && (latest.state === 'idle' || latest.state === 'done') && toEpoch(latest.ts) > toEpoch(sess.ts)) {
      sessions.set(id, { ...sess, state: 'idle' });
    }
  }

  // If any session is actively working, inferred waiting on other sessions
  // is noise — the user is clearly engaged with the project.
  const hasActiveWorking = [...sessions.values()].some(s => s.state === 'working');
  if (hasActiveWorking) {
    for (const [id, sess] of sessions) {
      if (sess.state === 'waiting') {
        sessions.set(id, { ...sess, state: 'idle' });
      }
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
