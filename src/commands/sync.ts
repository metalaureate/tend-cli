import { resolveProjectPath } from '../core/projects.js';
import { recentLog } from '../core/git.js';
import { existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';

export function cmdSync(args: string[]): void {
  let projectPath: string;
  try {
    projectPath = resolveProjectPath(args[0]);
  } catch (e) {
    process.stderr.write(`tend: ${(e as Error).message}\n`);
    process.exit(1);
  }
  const projectName = basename(projectPath);

  const gitLog = recentLog(projectPath, 20) || '';
  const todoFile = join(projectPath, '.tend', 'TODO');
  const todoContent = existsSync(todoFile) ? readFileSync(todoFile, 'utf-8') : '';

  process.stdout.write(`# Tend Sync — ${projectName}

Review the state of this project and reconcile TODO with actual git history.

## Recent Git History (last 20 commits)
${gitLog}

## Current TODO
${todoContent}

## Instructions
1. Compare TODO against git history. Are there items that have been completed and should be removed?
2. Are there items in git history that suggest new TODOs?
3. Produce an updated TODO list.
`);
}
