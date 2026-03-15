import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { discoverProjects } from '../core/projects.js';
import { readEvents } from '../core/events.js';
import { toEpoch } from './format.js';
import { C } from './colors.js';
import { config } from '../core/config.js';
import { isValidState } from '../types.js';

export interface GamificationStats {
  donesToday: number;
  donesWeek: number;
  peakToday: number;
  peakWeek: number;
  streak: number;
  todosOpen: number;
}

/** Check if gamification display is enabled */
export function gamificationEnabled(): boolean {
  return !config.noGamification;
}

/** Determine kitchen heat from board counters */
export function kitchenHeat(
  working: number,
  needs: number,
  stuck: number,
  waitAge: number,
  ready: number,
): string {
  if (needs > 0 && waitAge > 900) return 'fire';
  if (needs > 0 && waitAge > 300) return 'hot';
  if (needs > 0) return 'warming';
  if (working > 0) return 'simmering';
  if (ready > 0) return 'ready';
  return 'cold';
}

/** Compute gamification stats across all projects */
export function computeStats(): GamificationStats {
  const stats: GamificationStats = {
    donesToday: 0,
    donesWeek: 0,
    peakToday: 0,
    peakWeek: 0,
    streak: 0,
    todosOpen: 0,
  };

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Monday of current ISO week
  const dow = now.getDay() || 7; // Convert Sunday=0 to 7
  const monday = new Date(now);
  monday.setDate(monday.getDate() - (dow - 1));
  const weekStart = monday.toISOString().slice(0, 10);

  const projects = discoverProjects();
  const doneDays = new Set<string>();
  const todaySessions = new Set<string>();
  const weekSessions = new Set<string>();

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
        doneDays.add(dateStr);
      }

      if (evt.state === 'working') {
        if (dateStr === today) todaySessions.add(evt.sessionId);
        if (dateStr >= weekStart) weekSessions.add(evt.sessionId);
      }
    }
  }

  stats.peakToday = todaySessions.size;
  stats.peakWeek = weekSessions.size;

  // Compute streak: consecutive days ending today with at least one done
  if (doneDays.size > 0) {
    const sortedDays = [...doneDays].sort().reverse();
    const todayEpoch = Math.floor(new Date(today + 'T00:00:00').getTime() / 1000);
    let expected = todayEpoch;
    let streak = 0;

    for (const d of sortedDays) {
      const dEpoch = Math.floor(new Date(d + 'T00:00:00').getTime() / 1000);
      if (dEpoch === expected) {
        streak++;
        expected -= 86400;
      } else {
        break;
      }
    }
    stats.streak = streak;
  }

  return stats;
}

/** Render the gamification footer */
export function renderFooter(): string {
  const stats = computeStats();
  const lines: string[] = [];

  lines.push(`  ${C.dim}──────────────────────────────────────────────────${C.reset}`);

  // Today line
  let todayStr = `${stats.donesToday} done today`;
  if (stats.peakToday === 1) todayStr += '  ·  peak 1 agent';
  else if (stats.peakToday > 1) todayStr += `  ·  peak ${stats.peakToday} agents`;

  // Streak indicator
  let streakStr = '';
  if (stats.streak >= 7) {
    streakStr = `  ·  ${C.amber}▲${C.reset}${C.dim} ${stats.streak}-day streak`;
  } else if (stats.streak > 0) {
    streakStr = `  ·  ◆ ${stats.streak}-day streak`;
  }

  lines.push(`  ${C.dim}${todayStr}${streakStr}${C.reset}`);

  // Week line (only when it adds info beyond today)
  if (stats.donesWeek > stats.donesToday) {
    let weekStr = `${stats.donesWeek} done this week`;
    if (stats.peakWeek === 1) weekStr += '  ·  peak 1 agent';
    else if (stats.peakWeek > 1) weekStr += `  ·  peak ${stats.peakWeek} agents`;
    lines.push(`  ${C.dim}${weekStr}${C.reset}`);
  }

  // Open TODOs
  if (stats.todosOpen === 1) {
    lines.push(`  ${C.dim}1 open TODO${C.reset}`);
  } else if (stats.todosOpen > 1) {
    lines.push(`  ${C.dim}${stats.todosOpen} open TODOs${C.reset}`);
  }

  return lines.join('\n');
}
