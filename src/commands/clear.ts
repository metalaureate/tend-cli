import { resolveProjectPath } from '../core/projects.js';
import { clearEvents } from '../core/events.js';
import { relayDeleteProject } from '../core/relay.js';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { config } from '../core/config.js';
import { gitRepoName } from '../core/git.js';

export async function cmdClear(args: string[]): Promise<void> {
  const name = args[0];

  // Try to resolve locally first
  let projectPath: string | null = null;
  let projectName: string;
  try {
    projectPath = resolveProjectPath(name);
    projectName = gitRepoName(projectPath);
  } catch {
    // Not found locally — treat the raw name as a relay-only project
    if (!name) {
      process.stderr.write(`tend: not inside a project (no .git found)\n`);
      process.exit(1);
    }
    projectName = name;
  }

  // Clear local events if we have a local project
  let clearedLocal = false;
  if (projectPath) {
    const eventsFile = join(projectPath, '.tend', 'events');
    if (existsSync(eventsFile)) {
      clearEvents(eventsFile);
      clearedLocal = true;
    }
  }

  // Always try to delete from relay
  const clearedRelay = await relayDeleteProject(projectName);

  // If the user-provided name differs from the resolved name, also delete
  // the raw name from the relay (handles ghost projects with stale names)
  let clearedAlias = false;
  if (name && name !== projectName) {
    clearedAlias = await relayDeleteProject(name);
    const aliasCacheFile = join(config.relayCacheDir, name);
    if (existsSync(aliasCacheFile)) {
      try { unlinkSync(aliasCacheFile); } catch { /* ignore */ }
    }
  }

  // Also clean up the local relay cache file
  const cacheFile = join(config.relayCacheDir, projectName);
  if (existsSync(cacheFile)) {
    try { unlinkSync(cacheFile); } catch { /* ignore */ }
  }

  if (clearedLocal && clearedRelay) {
    process.stdout.write(`✓ Cleared events for ${projectName} (local + relay)\n`);
  } else if (clearedLocal) {
    process.stdout.write(`✓ Cleared local events for ${projectName}\n`);
  } else if (clearedRelay) {
    process.stdout.write(`✓ Removed ${projectName} from relay\n`);
  } else {
    process.stdout.write(`No events to clear for ${projectName}\n`);
  }
}
