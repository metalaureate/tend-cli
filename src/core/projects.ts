import { readFileSync, appendFileSync, writeFileSync, existsSync, mkdirSync, realpathSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { config } from './config.js';
import { lastEvent } from './events.js';
import { toEpoch } from '../ui/format.js';
import type { ProjectInfo } from '../types.js';

/** Read all registered project paths */
export function discoverProjects(): string[] {
  if (!existsSync(config.registry)) return [];

  const content = readFileSync(config.registry, 'utf-8');
  const paths: string[] = [];
  for (const line of content.split('\n')) {
    const p = line.trim();
    if (!p) continue;
    if (existsSync(join(p, '.tend'))) {
      paths.push(p);
    }
  }
  return paths;
}

/** Register a project path in the registry (idempotent) */
export function registerProject(projectPath: string): void {
  // Canonicalize
  try {
    projectPath = realpathSync(projectPath);
  } catch {
    // keep as-is if can't resolve
  }

  mkdirSync(dirname(config.registry), { recursive: true });

  if (existsSync(config.registry)) {
    const existing = readFileSync(config.registry, 'utf-8');
    const lines = existing.split('\n').map((l: string) => l.trim().toLowerCase());
    if (lines.includes(projectPath.toLowerCase())) return;
  }

  appendFileSync(config.registry, projectPath + '\n');
}

/** Remove a project path from the registry */
export function unregisterProject(projectPath: string): void {
  try {
    projectPath = realpathSync(projectPath);
  } catch {
    // keep as-is
  }

  if (!existsSync(config.registry)) return;

  const content = readFileSync(config.registry, 'utf-8');
  const lines = content.split('\n').filter(
    (l: string) => l.trim() && l.trim().toLowerCase() !== projectPath.toLowerCase()
  );
  writeFileSync(config.registry, lines.join('\n') + (lines.length ? '\n' : ''));
}

/** Detect the current project from the working directory */
export function detectProject(cwd: string = process.cwd()): string | null {
  let cur: string;
  try {
    cur = realpathSync(cwd);
  } catch {
    cur = cwd;
  }

  while (cur !== '/') {
    // Standard git repo
    try {
      const gitPath = join(cur, '.git');
      const stat = statSync(gitPath);
      if (stat.isDirectory()) return cur;
      
      // Worktree: .git is a file with "gitdir: <path>"
      if (stat.isFile()) {
        const content = readFileSync(gitPath, 'utf-8');
        const match = content.match(/^gitdir:\s*(.+)/);
        if (match) {
          let gitdir = match[1].trim();
          if (!gitdir.startsWith('/')) gitdir = join(cur, gitdir);
          // Follow worktree gitdir back to main repo
          const worktreeMatch = gitdir.match(/^(.+)\/\.git\/worktrees\//);
          if (worktreeMatch) {
            const mainRepo = worktreeMatch[1];
            if (existsSync(join(mainRepo, '.git'))) return mainRepo;
          }
        }
        return cur;
      }
    } catch {
      // .git doesn't exist at this level
    }
    cur = dirname(cur);
  }

  return null;
}

/** Get projects sorted by recency (most recent first, current project pinned to top) */
export function sortedProjects(): string[] {
  const projects = discoverProjects();
  if (projects.length === 0) return [];

  const currentProject = detectProject();

  const withTs: Array<{ path: string; epoch: number }> = projects.map(project => {
    let epoch = 0;

    // Check last event
    const eventsFile = join(project, '.tend', 'events');
    const evt = lastEvent(eventsFile);
    if (evt) {
      epoch = toEpoch(evt.ts);
    }

    // Fallback to git log
    if (epoch === 0 && existsSync(join(project, '.git'))) {
      try {
        const result = Bun.spawnSync(['git', '-C', project, 'log', '-1', '--format=%ct']);
        const ct = result.stdout.toString().trim();
        if (ct) epoch = parseInt(ct, 10) || 0;
      } catch {
        // ignore
      }
    }

    // Pin current project to top
    if (project === currentProject) {
      epoch = 9999999999;
    }

    return { path: project, epoch };
  });

  withTs.sort((a, b) => b.epoch - a.epoch);
  return withTs.map(w => w.path);
}

/** Resolve a project name/number/substring to its full path */
export function resolveProjectPath(name?: string): string {
  if (name) {
    // Numeric shortcut
    if (/^\d+$/.test(name)) {
      const nth = parseInt(name, 10);
      const sorted = sortedProjects();
      if (nth >= 1 && nth <= sorted.length) {
        return sorted[nth - 1];
      }
      throw new Error(`no project at position ${nth}`);
    }

    // Check registry
    if (existsSync(config.registry)) {
      const content = readFileSync(config.registry, 'utf-8');
      const paths = content.split('\n').map((l: string) => l.trim()).filter(Boolean);

      // Exact basename match
      for (const p of paths) {
        if (basename(p) === name && existsSync(p)) return p;
      }
      // Prefix match (require at least 2 chars to avoid accidental matches)
      if (name.length >= 2) {
        for (const p of paths) {
          if (basename(p).startsWith(name) && existsSync(p)) return p;
        }
      }
      // Substring match (require at least 2 chars)
      if (name.length >= 2) {
        for (const p of paths) {
          if (basename(p).includes(name) && existsSync(p)) return p;
        }
      }
    }

    // Fallback: TEND_ROOT direct match
    const directPath = join(config.tendRoot, name);
    if (existsSync(join(directPath, '.git'))) return directPath;

    throw new Error(`project '${name}' not found`);
  }

  // Auto-detect from cwd
  const detected = detectProject();
  if (detected) return detected;

  throw new Error('not inside a project (no .git found)');
}

/** Resolve project name (basename) from path or arg */
export function resolveProjectName(nameOrPath?: string): string {
  const p = resolveProjectPath(nameOrPath);
  return basename(p);
}
