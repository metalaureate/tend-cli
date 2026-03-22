import { existsSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { resolveProjectPath, unregisterProject } from '../core/projects.js';
import { gitRepoName } from '../core/git.js';

const TEND_MARKER = '## Tend Integration';
const GITIGNORE_ENTRIES = ['.tend/events', '.tend/hook_debug.log', '.scratch/'];

export async function cmdRemove(args: string[]): Promise<void> {
  // Support --yes / -y to skip confirmation
  const forceYes = args.includes('--yes') || args.includes('-y');
  const filtered = args.filter(a => a !== '--yes' && a !== '-y');

  let projectPath: string;
  try {
    projectPath = resolveProjectPath(filtered[0]);
  } catch (e) {
    process.stderr.write(`tend: ${(e as Error).message}\n`);
    process.exit(1);
  }
  const projectName = gitRepoName(projectPath);

  const tendDir = join(projectPath, '.tend');
  if (!existsSync(tendDir)) {
    process.stderr.write(`tend: no .tend/ directory in ${projectName}\n`);
    process.exit(1);
  }

  if (!forceYes) {
    const answer = await prompt(`Remove tend from ${projectName}? This deletes .tend/ and all events. [y/N] `);
    if (answer.toLowerCase() !== 'y') {
      process.stdout.write('Cancelled.\n');
      return;
    }
  }

  // 1. Remove .tend/ directory
  rmSync(tendDir, { recursive: true, force: true });
  process.stdout.write(`✓ Removed .tend/ from ${projectName}\n`);

  // 2. Remove .github/hooks/tend.json
  const hooksFile = join(projectPath, '.github', 'hooks', 'tend.json');
  if (existsSync(hooksFile)) {
    rmSync(hooksFile);
    // Clean up empty dirs
    const hooksDir = join(projectPath, '.github', 'hooks');
    if (readdirSync(hooksDir).length === 0) {
      rmSync(hooksDir, { recursive: true });
      const ghDir = join(projectPath, '.github');
      if (existsSync(ghDir) && readdirSync(ghDir).length === 0) {
        rmSync(ghDir, { recursive: true });
      }
    }
  }

  // 2b. Remove Claude Code hooks
  const claudeFile = join(projectPath, '.claude', 'settings.local.json');
  if (existsSync(claudeFile)) {
    try {
      const existing = JSON.parse(readFileSync(claudeFile, 'utf-8'));
      if (existing.hooks) {
        delete existing.hooks;
        if (Object.keys(existing).length === 0) {
          rmSync(claudeFile);
          const claudeDir = join(projectPath, '.claude');
          if (readdirSync(claudeDir).length === 0) {
            rmSync(claudeDir, { recursive: true });
          }
        } else {
          writeFileSync(claudeFile, JSON.stringify(existing, null, 2) + '\n');
        }
      }
    } catch {}
  }

  process.stdout.write('✓ Removed agent hooks\n');

  // 3. Remove tend section from AGENTS.md
  const agentsFile = join(projectPath, 'AGENTS.md');
  if (existsSync(agentsFile)) {
    const content = readFileSync(agentsFile, 'utf-8');
    if (content.includes(TEND_MARKER)) {
      const lines = content.split('\n');
      const output: string[] = [];
      let inTendBlock = false;

      for (const line of lines) {
        if (line.startsWith(TEND_MARKER)) {
          inTendBlock = true;
          continue;
        }
        if (inTendBlock && line.startsWith('## ')) {
          inTendBlock = false;
          output.push(line);
          continue;
        }
        if (!inTendBlock) {
          output.push(line);
        }
      }

      const result = output.join('\n').trim();
      if (result.length === 0) {
        rmSync(agentsFile);
        process.stdout.write('✓ Removed AGENTS.md (was only tend content)\n');
      } else {
        writeFileSync(agentsFile, result + '\n');
        process.stdout.write('✓ Removed tend section from AGENTS.md\n');
      }
    }
  }

  // 4. Clean .gitignore entries
  const gitignore = join(projectPath, '.gitignore');
  if (existsSync(gitignore)) {
    const content = readFileSync(gitignore, 'utf-8');
    const lines = content.split('\n').filter(l => !GITIGNORE_ENTRIES.includes(l));
    writeFileSync(gitignore, lines.join('\n'));
  }

  // 5. Unregister from ~/.tend/projects
  unregisterProject(projectPath);
  process.stdout.write(`✓ Unregistered ${projectName}\n`);
}

function prompt(msg: string): Promise<string> {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(msg, answer => {
      rl.close();
      resolve(answer);
    });
  });
}
