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

  // Reset marker: "timestamp * idle"
  if (parts[1] === '*') {
    return {
      ts,
      sessionId: '*',
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

/** Append a reset marker */
export function appendReset(filePath: string, ts: string): void {
  appendFileSync(filePath, `${ts} * idle\n`);
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
