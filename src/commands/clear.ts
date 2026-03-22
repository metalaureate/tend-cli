import { resolveProjectPath } from '../core/projects.js';
import { clearEvents } from '../core/events.js';
import { existsSync } from 'fs';
import { join } from 'path';
import { gitRepoName } from '../core/git.js';

export function cmdClear(args: string[]): void {
  let projectPath: string;
  try {
    projectPath = resolveProjectPath(args[0]);
  } catch (e) {
    process.stderr.write(`tend: ${(e as Error).message}\n`);
    process.exit(1);
  }
  const projectName = gitRepoName(projectPath);
  const eventsFile = join(projectPath, '.tend', 'events');

  if (!existsSync(eventsFile)) {
    process.stdout.write(`No events to clear for ${projectName}\n`);
    return;
  }

  clearEvents(eventsFile);
  process.stdout.write(`✓ Cleared events for ${projectName}\n`);
}
