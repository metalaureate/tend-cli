import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { discoverProjects } from '../core/projects.js';
import { readEvents } from '../core/events.js';

import { C } from './colors.js';
import { config } from '../core/config.js';
import { isValidState } from '../types.js';

export interface GamificationStats {
  donesToday: number;
  donesWeek: number;
  activeHours: number;    // distinct hours with agent activity in rolling 24h
  todosOpen: number;
}

/** Check if gamification display is enabled */
export function gamificationEnabled(): boolean {
  return !config.noGamification;
}

/** Compute gamification stats across all projects */
export function computeStats(): GamificationStats {
  const stats: GamificationStats = {
    donesToday: 0,
    donesWeek: 0,
    activeHours: 0,
    todosOpen: 0,
  };

  const now = new Date();
  const nowEpoch = Math.floor(now.getTime() / 1000);
  const twentyFourAgo = nowEpoch - 86400;
  const pad = (n: number) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  // Rolling 7-day window (local time)
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weekStart = `${sevenDaysAgo.getFullYear()}-${pad(sevenDaysAgo.getMonth() + 1)}-${pad(sevenDaysAgo.getDate())}`;

  const projects = discoverProjects();

  // Collect all event timestamps in the rolling 24h window for active hours calc
  const activeTimestamps: number[] = [];
  // Track working spans: session → start epoch
  const workingStarts = new Map<string, number>();

  for (const project of projects) {
    // Count open TODOs
    const todoFile = join(project, '.tend', 'TODO');
    if (existsSync(todoFile)) {
      try {
        const content = readFileSync(todoFile, 'utf-8').trim();
        if (content) {
          stats.todosOpen += content.split('\n').filter(l => l.trim()).length;
        }
      } catch {
        // ignore
      }
    }

    // Parse events
    const events = readEvents(join(project, '.tend', 'events'));
    for (const evt of events) {
      if (evt.sessionId === '*') continue;
      const dateStr = evt.ts.slice(0, 10);

      if (evt.state === 'done') {
        if (dateStr === today) stats.donesToday++;
        if (dateStr >= weekStart) stats.donesWeek++;
      }

      // Collect timestamps for active hours (any non-idle event = activity)
      if (evt.state !== 'idle') {
        const evtEpoch = toEpochFromTs(evt.ts);
        if (evtEpoch >= twentyFourAgo) {
          activeTimestamps.push(evtEpoch);
        }
      }

      // Track working spans for continuous hour coverage
      const evtEpoch = toEpochFromTs(evt.ts);
      const sessionKey = `${project}:${evt.sessionId}`;
      if (evt.state === 'working') {
        workingStarts.set(sessionKey, evtEpoch);
      } else if (workingStarts.has(sessionKey)) {
        // End of a working span — fill in all hours between start and end
        const start = Math.max(workingStarts.get(sessionKey)!, twentyFourAgo);
        const end = evtEpoch;
        if (end > twentyFourAgo && start < nowEpoch) {
          for (let t = start; t <= end; t += 3600) {
            activeTimestamps.push(t);
          }
        }
        workingStarts.delete(sessionKey);
      }


    }
  }

  // Fill in hours for sessions still working (no end event yet)
  // Cap at stale threshold — a session without a follow-up event for 30min
  // is effectively idle, not continuously active.
  for (const [, start] of workingStarts) {
    const end = Math.min(start + config.staleThreshold, nowEpoch);
    const clampedStart = Math.max(start, twentyFourAgo);
    if (clampedStart < end) {
      for (let t = clampedStart; t <= end; t += 3600) {
        activeTimestamps.push(t);
      }
    }
  }

  // Compute active hours: count distinct hours with at least one event
  if (activeTimestamps.length > 0) {
    const activeHourSet = new Set<number>();
    for (const ts of activeTimestamps) {
      activeHourSet.add(Math.floor(ts / 3600));
    }
    stats.activeHours = Math.min(activeHourSet.size, 24);
  }

  return stats;
}

/** Parse ISO timestamp to epoch seconds */
function toEpochFromTs(ts: string): number {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return 0;
  return Math.floor(d.getTime() / 1000);
}

/** Render the gamification footer */
export function renderFooter(): string {
  const stats = computeStats();
  const lines: string[] = [];

  lines.push(`  ${C.dim}──────────────────────────────────────────────────${C.reset}`);

  // Compact single-line stats
  const parts: string[] = [];
  parts.push(`${stats.activeHours}/24h active`);
  parts.push(`${stats.donesToday} done today`);
  if (stats.donesWeek > stats.donesToday) {
    parts.push(`${stats.donesWeek} this week`);
  }
  if (stats.todosOpen > 0) {
    parts.push(`${stats.todosOpen} open TODO${stats.todosOpen > 1 ? 's' : ''}`);
  }
  lines.push(`  ${C.dim}${parts.join('  ·  ')}${C.reset}`);

  // End-of-day nudge: if it's evening (after 8pm) and there are idle agents
  const nudge = endOfDayNudge(stats);
  if (nudge) {
    lines.push(`  ${C.dim}${nudge}${C.reset}`);
  }

  return lines.join('\n');
}

/** Suggest teeing up overnight work when it's late in the user's day */
function endOfDayNudge(stats: GamificationStats): string | null {
  const now = new Date();
  const hour = now.getHours();
  const min = now.getMinutes();
  if (hour < 16 || (hour === 16 && min < 30)) return null; // only after 4:30pm

  // Count idle projects (ones that could take work)
  const projects = discoverProjects();
  let idleCount = 0;
  for (const project of projects) {
    const events = readEvents(join(project, '.tend', 'events'));
    if (events.length === 0) { idleCount++; continue; }
    const last = events[events.length - 1];
    if (last.state === 'idle' || last.state === 'done') idleCount++;
  }

  if (idleCount === 0) return null;

  // Check for open TODOs — if they have them, nudge to assign
  if (stats.todosOpen > 0) {
    return `💡 ${idleCount} idle + ${stats.todosOpen} open TODO${stats.todosOpen > 1 ? 's' : ''} — queue overnight work?`;
  }

  // No TODOs but idle projects — suggest creating some
  return `💡 ${idleCount} idle — jot a TODO before bed, agents work while you sleep`;
}
