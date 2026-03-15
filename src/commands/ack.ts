import { resolveProjectPath } from '../core/projects.js';
import { appendReset } from '../core/events.js';
import { tsLocal } from '../ui/format.js';
import { existsSync } from 'fs';
import { join, basename } from 'path';

export function cmdAck(args: string[]): void {
  let projectPath: string;
  try {
    projectPath = resolveProjectPath(args[0]);
  } catch (e) {
    process.stderr.write(`tend: ${(e as Error).message}\n`);
    process.exit(1);
  }
  const projectName = basename(projectPath);

  if (!existsSync(join(projectPath, '.tend'))) {
    process.stderr.write(`tend: .tend/ not initialized in ${projectName}. Run 'tend init' first.\n`);
    process.exit(1);
  }

  const ts = tsLocal();
  appendReset(join(projectPath, '.tend', 'events'), ts);
  process.stdout.write(`✓ Acknowledged ${projectName}\n`);
}
