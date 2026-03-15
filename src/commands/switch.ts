import { resolveProjectPath } from '../core/projects.js';
import { basename } from 'path';

export function cmdSwitch(args: string[]): void {
  const name = args[0];
  if (!name) {
    process.stderr.write('Usage: tend switch <project>\n');
    process.exit(1);
  }

  let projectPath: string;
  try {
    projectPath = resolveProjectPath(name);
  } catch (e) {
    process.stderr.write(`tend: ${(e as Error).message}\n`);
    process.exit(1);
  }
  const projectName = basename(projectPath);

  const result = Bun.spawnSync(['code', projectPath]);
  if (result.exitCode === 0) {
    process.stdout.write(`▶ Focused: ${projectName} (VSCode)\n`);
  } else {
    process.stderr.write("tend switch: 'code' command not found. Install it from VSCode: Cmd+Shift+P → 'Shell Command: Install'\n");
    process.exit(1);
  }
}
