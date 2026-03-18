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
  activeHours: number;   // hours with agent activity in rolling 24h
  longestGapMins: number; // longest idle gap in rolling 24h (minutes)
  todosOpen: number;
}

/** Check if gamification display is enabled */
export function gamificationEnabled(): boolean {
  return !config.noGamification;
}

/** Determine utilization level from coverage percentage (activeHours / 24) */
export function utilizationLevel(activeHours: number): string {
  const pct = activeHours / 24;
  if (pct >= 0.75) return 'full burn';
  if (pct >= 0.5) return 'humming';
  if (pct > 0) return 'warming';
  return 'cold';
}

/** Compute gamification stats across all projects */
export function computeStats(): GamificationStats {
  const stats: GamificationStats = {
    donesToday: 0,
    donesWeek: 0,
    activeHours: 0,
    longestGapMins: 0,
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

  // Collect all event timestamps in the rolling 24h window for coverage calc
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

      // Collect timestamps for coverage (any non-idle event = activity)
      if (evt.state !== 'idle') {
        const evtEpoch = toEpochFromTs(evt.ts);
        if (evtEpoch >= twentyFourAgo) {
          activeTimestamps.push(evtEpoch);
        }
      }
    }
  }

  // Compute coverage: count distinct hours with at least one event
  if (activeTimestamps.length > 0) {
    const activeHourSet = new Set<number>();
    for (const ts of activeTimestamps) {
      activeHourSet.add(Math.floor(ts / 3600));
    }
    stats.activeHours = activeHourSet.size;
  }

  // Compute longest gap: sort timestamps, find max gap between consecutive events
  if (activeTimestamps.length > 0) {
    const sorted = [...activeTimestamps].sort((a, b) => a - b);
    let maxGap = sorted[0] - twentyFourAgo; // gap from window start to first event
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i] - sorted[i - 1];
      if (gap > maxGap) maxGap = gap;
    }
    // gap from last event to now
    const tailGap = nowEpoch - sorted[sorted.length - 1];
    if (tailGap > maxGap) maxGap = tailGap;
    stats.longestGapMins = Math.floor(maxGap / 60);
  } else {
    // No events in 24h — the entire window is a gap
    stats.longestGapMins = 24 * 60;
  }

  return stats;
}

/** Parse ISO timestamp to epoch seconds */
function toEpochFromTs(ts: string): number {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return 0;
  return Math.floor(d.getTime() / 1000);
}

/** Format gap duration: "47m" or "3h 12m" */
function formatGap(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Render the gamification footer */
export function renderFooter(): string {
  const stats = computeStats();
  const lines: string[] = [];

  lines.push(`  ${C.dim}──────────────────────────────────────────────────${C.reset}`);

  // Coverage line
  const level = utilizationLevel(stats.activeHours);
  const coveragePct = Math.round((stats.activeHours / 24) * 100);
  let coverageStr = `${stats.activeHours}/24h active  ·  ${coveragePct}% coverage`;
  if (level === 'full burn') {
    coverageStr += `  ·  ${C.amber}◉${C.reset}${C.dim} ${level}`;
  } else {
    coverageStr += `  ·  ${level}`;
  }
  lines.push(`  ${C.dim}${coverageStr}${C.reset}`);

  // Dones + longest gap line
  let todayStr = `${stats.donesToday} done today`;
  if (stats.longestGapMins < 24 * 60) {
    todayStr += `  ·  longest gap: ${formatGap(stats.longestGapMins)}`;
  }
  lines.push(`  ${C.dim}${todayStr}${C.reset}`);

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
