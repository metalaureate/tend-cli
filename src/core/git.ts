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
