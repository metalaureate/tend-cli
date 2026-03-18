import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { discoverProjects } from '../core/projects.js';
import { projectState, relayProjectState } from '../core/state.js';
import { relayOnlyProjects } from '../core/relay.js';
import { config } from '../core/config.js';

const STATUS_CACHE = join(config.tendDir, 'status_cache');
const REFRESH_PID = join(config.tendDir, 'status_refresh.pid');
const REFRESH_STALE_MS = 30_000; // consider refresh PID stale after 30s

/** Invalidate status cache so next prompt recomputes synchronously */
export function invalidateStatusCache(): void {
  try { unlinkSync(STATUS_CACHE); } catch { /* ignore */ }
}

/** Output compact status indicator for shell prompt: ○ or ?N ◐N ◉N */
export function cmdStatus(): void {
  // If no cache exists yet, compute synchronously (first run only)
  if (!existsSync(STATUS_CACHE)) {
    const output = computeStatus();
    process.stdout.write(output + '\n');
    try {
      mkdirSync(config.tendDir, { recursive: true });
      writeFileSync(STATUS_CACHE, output);
    } catch {
      // ignore write errors
    }
    return;
  }

  // Print cached result immediately, then refresh in background
  let cached = '○';
  try {
    cached = readFileSync(STATUS_CACHE, 'utf-8').trim() || '○';
  } catch {
    // ignore read errors
  }
  process.stdout.write(cached + '\n');

  // Guard: skip spawn if a refresh is already running
  if (isRefreshRunning()) return;

  // Spawn background refresh (fire-and-forget)
  try {
    const self = process.argv[0];
    Bun.spawn([self, 'status', '--refresh'], {
      stdio: ['ignore', 'ignore', 'ignore'],
    }).unref();
  } catch {
    // If spawn fails, fall through — cache stays stale
  }
}

/** Check if a refresh process is already running (or stale) */
function isRefreshRunning(): boolean {
  try {
    if (!existsSync(REFRESH_PID)) return false;
    const content = readFileSync(REFRESH_PID, 'utf-8').trim();
    const [pidStr, tsStr] = content.split(' ');
    const pid = parseInt(pidStr, 10);
    const ts = parseInt(tsStr, 10);
    if (!pid || !ts) return false;

    // Stale PID file — process probably died without cleanup
    if (Date.now() - ts > REFRESH_STALE_MS) {
      try { unlinkSync(REFRESH_PID); } catch { /* ignore */ }
      return false;
    }

    // Check if PID is still alive
    try {
      process.kill(pid, 0);
      return true; // still running
    } catch {
      // Process is dead, clean up
      try { unlinkSync(REFRESH_PID); } catch { /* ignore */ }
      return false;
    }
  } catch {
    return false;
  }
}

/** Compute status and write to cache file (called via --refresh) */
export function cmdStatusRefresh(): void {
  // Write PID file so concurrent refreshes are skipped
  try {
    mkdirSync(config.tendDir, { recursive: true });
    writeFileSync(REFRESH_PID, `${process.pid} ${Date.now()}`);
  } catch { /* ignore */ }

  // Self-destruct timeout: if we hang, exit hard after 10s
  const watchdog = setTimeout(() => process.exit(1), 10_000);
  if (watchdog.unref) watchdog.unref();

  try {
    const output = computeStatus();
    try {
      writeFileSync(STATUS_CACHE, output);
    } catch {
      // ignore write errors
    }
  } finally {
    // Clean up PID file
    try { unlinkSync(REFRESH_PID); } catch { /* ignore */ }
    clearTimeout(watchdog);
  }
}

function computeStatus(): string {
  let hot = 0;
  let working = 0;
  let doneCount = 0;

  const projects = discoverProjects();
  for (const project of projects) {
    const ps = projectState(project);
    if (!ps) continue;
    switch (ps.state) {
      case 'stuck':
      case 'waiting':
        hot++;
        break;
      case 'working':
        working += ps.activeCount > 0 ? ps.activeCount : 1;
        break;
      case 'done':
        doneCount++;
        break;
    }
  }

  // Also count relay-only projects (from cache, no network)
  for (const rp of relayOnlyProjects()) {
    const ps = relayProjectState(rp);
    if (!ps) continue;
    switch (ps.state) {
      case 'stuck':
      case 'waiting':
        hot++;
        break;
      case 'working':
        working += ps.activeCount > 0 ? ps.activeCount : 1;
        break;
      case 'done':
        doneCount++;
        break;
    }
  }

  // Use stderr TTY check for colors (prompt output via $(...))
  const noColor = !!process.env.NO_COLOR;
  const useColor = !noColor && (process.stderr.isTTY || !!process.env.TEND_FORCE_COLOR);
  const r = useColor ? '\x1b[0m' : '';
  const red = useColor ? '\x1b[31m' : '';
  const cyan = useColor ? '\x1b[36m' : '';
  const green = useColor ? '\x1b[32m' : '';

  const parts: string[] = [];
  if (hot > 0) parts.push(`${red}?${hot}${r}`);
  if (working > 0) parts.push(`${cyan}◐${working}${r}`);
  if (doneCount > 0) parts.push(`${green}◉${doneCount}${r}`);

  if (parts.length === 0) {
    return '○';
  }
  return parts.join(' ');
}
