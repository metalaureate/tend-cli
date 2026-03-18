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

/** Determine utilization level from activeHours / 24 */
export function utilizationLevel(activeHours: number): string {
  const pct = activeHours / 24;
  if (pct >= 0.75) return 'full burn';
  if (pct >= 0.5) return 'humming';
  if (pct > 0) return 'warm';
  return 'cold';
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

  // Monday of current ISO week (local time)
  const dow = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(monday.getDate() - (dow - 1));
  const weekStart = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;

  const projects = discoverProjects();

  // Collect all event timestamps in the rolling 24h window for active hours calc
  const activeTimestamps: number[] = [];



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


    }
  }

  // Compute active hours: count distinct hours with at least one event
  if (activeTimestamps.length > 0) {
    const activeHourSet = new Set<number>();
    for (const ts of activeTimestamps) {
      activeHourSet.add(Math.floor(ts / 3600));
    }
    stats.activeHours = activeHourSet.size;
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

  // Active hours + level
  const level = utilizationLevel(stats.activeHours);
  let activeStr = `${stats.activeHours}/24h active  ·  ${level}`;
  if (level === 'full burn') {
    activeStr = `${stats.activeHours}/24h active  ·  ${C.amber}◉${C.reset}${C.dim} ${level}`;
  }
  lines.push(`  ${C.dim}${activeStr}${C.reset}`);

  // Dones today
  lines.push(`  ${C.dim}${stats.donesToday} done today${C.reset}`);

  // Week line (only when it adds info beyond today)
  if (stats.donesWeek > stats.donesToday) {
    lines.push(`  ${C.dim}${stats.donesWeek} done this week${C.reset}`);
  }

  // Open TODOs
  if (stats.todosOpen === 1) {
    lines.push(`  ${C.dim}1 open TODO${C.reset}`);
  } else if (stats.todosOpen > 1) {
    lines.push(`  ${C.dim}${stats.todosOpen} open TODOs${C.reset}`);
  }

  return lines.join('\n');
}
