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

/** Return true if a sessionId represents a reset marker (`*` or `*@user`) */
export function isResetMarker(sessionId: string): boolean {
  return sessionId === '*' || sessionId.startsWith('*@');
}

/** Strip the `@user` suffix from a session ID (if present) */
export function stripUserTag(sessionId: string): string {
  const atIdx = sessionId.lastIndexOf('@');
  return atIdx === -1 ? sessionId : sessionId.slice(0, atIdx);
}

/**
 * Extract the user tag from a session ID (e.g. `_cli@alice_example.com` → `"alice_example.com"`).
 * Returns an empty string when the session ID has no user tag suffix.
 */
export function userTagFromSessionId(sessionId: string): string {
  const atIdx = sessionId.lastIndexOf('@');
  return atIdx === -1 ? '' : sessionId.slice(atIdx + 1);
}

/** Maximum length for a sanitized user tag to keep event lines readable */
const MAX_USER_TAG_LENGTH = 40;

/**
 * Sanitize a value (e.g. a git user email) for safe use as a session tag.
 * Replaces `@` with `_` and any non-alphanumeric non-`.`-`-` characters with `-`.
 * Truncates to MAX_USER_TAG_LENGTH characters.
 */
export function sanitizeUserTag(value: string): string {
  return value.replace(/@/g, '_').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, MAX_USER_TAG_LENGTH);
}

/**
 * Filter an event array to only include events relevant to the given user tag.
 * - Events without a `@user` tag are included for every user (backward compat).
 * - Global reset markers (`*`) always pass through.
 * - User-scoped reset markers (`*@user`) only pass for the matching user.
 * When `userTag` is null/undefined the original array is returned unchanged.
 */
export function filterEventsByUser(events: TendEvent[], userTag: string | null | undefined): TendEvent[] {
  if (!userTag) return events;
  return events.filter(e => {
    const sid = e.sessionId;
    if (sid === '*') return true; // global reset — backward compat
    if (sid.startsWith('*@')) return sid === `*@${userTag}`; // user-scoped reset
    const atIdx = sid.lastIndexOf('@');
    if (atIdx === -1) return true; // no user tag — backward compat
    return sid.slice(atIdx + 1) === userTag;
  });
}

/** Append a reset marker */
export function appendReset(filePath: string, ts: string): void {
  appendFileSync(filePath, `${ts} * idle\n`);
}

/** Append a user-scoped reset marker */
export function appendUserReset(filePath: string, ts: string, userTag: string): void {
  appendFileSync(filePath, `${ts} *@${userTag} idle\n`);
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
