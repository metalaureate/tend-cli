import { existsSync } from 'fs';
import { join } from 'path';

function git(projectPath: string, ...args: string[]): string | null {
  try {
    const result = Bun.spawnSync(['git', '-C', projectPath, ...args]);
    if (result.exitCode !== 0) return null;
    return result.stdout.toString().trim();
  } catch {
    return null;
  }
}

/** Get the last commit message (subject line only) */
export function lastCommitMessage(projectPath: string): string | null {
  return git(projectPath, 'log', '--oneline', '-1', '--format=%s');
}

/** Get the last commit epoch timestamp */
export function lastCommitEpoch(projectPath: string): number | null {
  const ct = git(projectPath, 'log', '-1', '--format=%ct');
  if (!ct) return null;
  return parseInt(ct, 10) || null;
}

/** Get the last commit ISO timestamp */
export function lastCommitTs(projectPath: string): string | null {
  return git(projectPath, 'log', '-1', '--format=%ad', '--date=format:%Y-%m-%dT%H:%M:%S');
}

/** Get relative time of last commit (e.g., "2 hours ago") */
export function lastCommitAgo(projectPath: string): string | null {
  return git(projectPath, 'log', '--oneline', '-1', '--format=%ar');
}

/** Check if project has uncommitted changes (dirty working tree) */
export function isDirty(projectPath: string): boolean {
  const status = git(projectPath, 'status', '--porcelain');
  return status !== null && status.length > 0;
}

/** Get current branch name */
export function currentBranch(projectPath: string): string | null {
  return git(projectPath, 'branch', '--show-current');
}

/** Count commits since midnight today */
export function commitsToday(projectPath: string): number {
  const output = git(projectPath, 'log', '--oneline', '--since=midnight');
  if (!output) return 0;
  return output.split('\n').filter(l => l.trim()).length;
}

/** Get recent commit log */
export function recentLog(projectPath: string, count: number = 20): string | null {
  return git(projectPath, 'log', '--oneline', `-${count}`, '--format=%h %s (%ar)');
}

/** Check if path has a git repo */
export function hasGit(projectPath: string): boolean {
  return existsSync(join(projectPath, '.git'));
}

/** Get git configured user email. Returns null when not set or git is unavailable. */
export function gitUserEmail(projectPath: string): string | null {
  return git(projectPath, 'config', 'user.email');
}

/** Summarise uncommitted changes as a short topic string.
 *  Uses changed file paths to infer what area of the codebase was touched.
 *  Returns e.g. "changes in src/api" or "3 files changed" as a fallback.
 */
export function dirtySummary(projectPath: string): string {
  const raw = git(projectPath, 'diff', '--name-only', 'HEAD');
  // Also include untracked files
  const untracked = git(projectPath, 'ls-files', '--others', '--exclude-standard');

  const files: string[] = [];
  if (raw) files.push(...raw.split('\n').filter(l => l.trim()));
  if (untracked) files.push(...untracked.split('\n').filter(l => l.trim()));

  if (files.length === 0) return 'uncommitted changes';

  // Filter out noise files (.tend/, .scratch/, etc.)
  const meaningful = files.filter(f =>
    !f.startsWith('.tend/') && !f.startsWith('.scratch/') && !f.startsWith('.github/hooks/')
  );
  const src = meaningful.length > 0 ? meaningful : files;

  // Extract first directory component from each file
  const dirs = new Map<string, number>();
  for (const f of src) {
    const parts = f.split('/');
    const key = parts.length > 1 ? parts.slice(0, Math.min(2, parts.length - 1)).join('/') : parts[0];
    dirs.set(key, (dirs.get(key) || 0) + 1);
  }

  // Find the dominant directory
  let topDir = '';
  let topCount = 0;
  for (const [dir, count] of dirs) {
    if (count > topCount) { topDir = dir; topCount = count; }
  }

  // If one area dominates (≥50% of files), name it
  if (topDir && topCount >= src.length * 0.5) {
    return `changes in ${topDir}`;
  }

  // Otherwise, count files
  return `${src.length} files changed`;
}
