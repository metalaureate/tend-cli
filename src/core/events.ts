import { readFileSync, appendFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { isValidState, type TendEvent, type State } from '../types.js';

/** Read all events from an events file, returning parsed TendEvent[] */
export function readEvents(filePath: string): TendEvent[] {
  if (!existsSync(filePath)) return [];
  
  let content: string;
  try {
    const stat = statSync(filePath);
    if (stat.size === 0) return [];
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const events: TendEvent[] = [];
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    const parsed = parseLine(line);
    if (parsed) events.push(parsed);
  }
  return events;
}

/** Parse a single event line into a TendEvent */
export function parseLine(line: string): TendEvent | null {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 2) return null;

  const ts = parts[0];

  // Reset marker: "timestamp * idle" or "timestamp *@branch idle"
  if (parts[1] === '*' || parts[1].startsWith('*@')) {
    return {
      ts,
      sessionId: parts[1],
      state: (parts[2] as State) || 'idle',
      message: '',
    };
  }

  // New format: "timestamp sessionId state message..."
  if (parts.length >= 3 && isValidState(parts[2])) {
    return {
      ts,
      sessionId: parts[1],
      state: parts[2],
      message: parts.slice(3).join(' '),
    };
  }

  // Old format: "timestamp state message..."
  if (isValidState(parts[1])) {
    return {
      ts,
      sessionId: '_cli',
      state: parts[1],
      message: parts.slice(2).join(' '),
    };
  }

  return null;
}

/** Read the last event from an events file */
export function lastEvent(filePath: string): TendEvent | null {
  if (!existsSync(filePath)) return null;
  
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  const lines = content.trimEnd().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const parsed = parseLine(lines[i]);
    if (parsed) return parsed;
  }
  return null;
}

/** Append an event line to the events file */
export function appendEvent(
  filePath: string,
  ts: string,
  sessionId: string,
  state: State,
  message: string,
): void {
  const line = message
    ? `${ts} ${sessionId} ${state} ${message}\n`
    : `${ts} ${sessionId} ${state}\n`;
  appendFileSync(filePath, line);
}

/** Return true if a sessionId represents a reset marker (`*` or `*@branch`) */
export function isResetMarker(sessionId: string): boolean {
  return sessionId === '*' || sessionId.startsWith('*@');
}

/** Strip the `@branch` suffix from a session ID (if present) */
export function stripBranchSuffix(sessionId: string): string {
  const atIdx = sessionId.lastIndexOf('@');
  return atIdx === -1 ? sessionId : sessionId.slice(0, atIdx);
}

/**
 * Extract the branch name from a tagged session ID (e.g. `_cli@feature-auth` → `"feature-auth"`).
 * Returns an empty string when the session ID has no branch suffix.
 */
export function branchFromSessionId(sessionId: string): string {
  const atIdx = sessionId.lastIndexOf('@');
  return atIdx === -1 ? '' : sessionId.slice(atIdx + 1);
}

/**
 * Filter an event array to only include events relevant to the given branch.
 * - Events without a `@branch` tag are included on every branch (backward compat).
 * - Global reset markers (`*`) always pass through.
 * - Branch-scoped reset markers (`*@branch`) only pass for the matching branch.
 * When `branch` is null/undefined the original array is returned unchanged.
 */
export function filterEventsByBranch(events: TendEvent[], branch: string | null | undefined): TendEvent[] {
  if (!branch) return events;
  return events.filter(e => {
    const sid = e.sessionId;
    if (sid === '*') return true; // global reset — backward compat
    if (sid.startsWith('*@')) return sid === `*@${branch}`; // branch-scoped reset
    const atIdx = sid.lastIndexOf('@');
    if (atIdx === -1) return true; // no branch tag — backward compat
    return sid.slice(atIdx + 1) === branch;
  });
}

/** Append a reset marker */
export function appendReset(filePath: string, ts: string): void {
  appendFileSync(filePath, `${ts} * idle\n`);
}

/** Append a branch-scoped reset marker */
export function appendBranchReset(filePath: string, ts: string, branch: string): void {
  appendFileSync(filePath, `${ts} *@${branch} idle\n`);
}

/** Clear an events file */
export function clearEvents(filePath: string): void {
  writeFileSync(filePath, '');
}

/** Merge two event arrays, sorted by timestamp */
export function mergeEvents(a: TendEvent[], b: TendEvent[]): TendEvent[] {
  const all = [...a, ...b];
  all.sort((x, y) => x.ts.localeCompare(y.ts));
  return all;
}

/** Read events from a project's .tend/events file */
export function readProjectEvents(projectPath: string): TendEvent[] {
  return readEvents(join(projectPath, '.tend', 'events'));
}
