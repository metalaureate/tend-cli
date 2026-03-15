import { resolveProjectPath } from '../core/projects.js';
import { existsSync, readFileSync, appendFileSync } from 'fs';
import { join, basename } from 'path';
import { tsLocal } from '../ui/format.js';
import { C } from '../ui/colors.js';

export function cmdAdd(args: string[]): void {
  let projectName: string | undefined;
  let rest = [...args];

  // With 2+ args, try first arg as project name
  if (rest.length >= 2) {
    try {
      resolveProjectPath(rest[0]);
      projectName = rest.shift();
    } catch {
      // first arg isn't a project — treat everything as message
    }
  } else if (rest.length === 1) {
    // Single arg: project name (show TODOs) or message (add to current)
    try {
      resolveProjectPath(rest[0]);
      projectName = rest[0];
      rest = [];
    } catch {
      // not a project — treat as message
    }
  }

  const message = rest.join(' ');

  if (!message) {
    // No message: show current TODOs
    let projectPath: string;
    try {
      projectPath = resolveProjectPath(projectName);
    } catch (e) {
      process.stderr.write(`tend: ${(e as Error).message}\n`);
      process.exit(1);
    }
    const pName = basename(projectPath);
    const todoFile = join(projectPath, '.tend', 'TODO');
    if (existsSync(todoFile)) {
      const content = readFileSync(todoFile, 'utf-8').trim();
      if (content) {
        process.stdout.write(`${C.bold}TODO (${pName}):${C.reset}\n`);
        let n = 1;
        for (const line of content.split('\n')) {
          if (!line.trim()) continue;
          let item = line;
          if (item.startsWith('[')) {
            item = item.replace(/^\[[^\]]*\]\s*/, '');
          }
          process.stdout.write(`  ${n}. ${item}\n`);
          n++;
        }
        return;
      }
    }
    process.stdout.write(`No TODOs for ${pName}\n`);
    return;
  }

  let projectPath: string;
  try {
    projectPath = resolveProjectPath(projectName);
  } catch (e) {
    process.stderr.write(`tend: ${(e as Error).message}\n`);
    process.exit(1);
  }
  const pName = basename(projectPath);

  if (!existsSync(join(projectPath, '.tend'))) {
    process.stderr.write(`tend: .tend/ not initialized in ${pName}. Run 'tend init ${pName}' first.\n`);
    process.exit(1);
  }

  const ts = tsLocal();
  appendFileSync(join(projectPath, '.tend', 'TODO'), `[${ts}] ${message}\n`);
  process.stdout.write(`✓ Added to ${pName}/TODO\n`);
}
