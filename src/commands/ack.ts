import { resolveProjectPath, discoverProjects } from '../core/projects.js';
import { appendReset, appendUserReset, sanitizeUserTag } from '../core/events.js';
import { tsLocal } from '../ui/format.js';
import { gitUserEmail, gitRepoName } from '../core/git.js';
import { relayEmit } from '../core/relay.js';
import { cmdBoard } from './board.js';
import { existsSync } from 'fs';
import { join, basename } from 'path';
import { projectState } from '../core/state.js';

async function ackProject(projectPath: string): Promise<string> {
  const projectName = gitRepoName(projectPath);

  if (!existsSync(join(projectPath, '.tend'))) {
    return '';
  }

  const ts = tsLocal();
  const rawEmail = gitUserEmail(projectPath);
  if (rawEmail) {
    const userTag = sanitizeUserTag(rawEmail);
    appendUserReset(join(projectPath, '.tend', 'events'), ts, userTag);
    await relayEmit(projectName, 'idle', 'acknowledged', `*@${userTag}`);
  } else {
    appendReset(join(projectPath, '.tend', 'events'), ts);
    await relayEmit(projectName, 'idle', 'acknowledged', '*');
  }
  return projectName;
}

export async function cmdAck(args: string[]): Promise<void> {
  // td ack --all (or td ack '*') — acknowledge all projects
  if (args[0] === '--all' || args[0] === '-a' || args[0] === '*') {
    const projects = discoverProjects();
    const acked: string[] = [];
    for (const projectPath of projects) {
      const ps = projectState(projectPath);
      if (!ps || ps.state === 'idle') continue;
      const name = await ackProject(projectPath);
      if (name) acked.push(name);
    }
    if (acked.length === 0) {
      process.stdout.write(`Nothing to acknowledge\n\n`);
    } else {
      process.stdout.write(`✓ Acknowledged ${acked.length} project${acked.length > 1 ? 's' : ''}: ${acked.join(', ')}\n\n`);
    }
    await cmdBoard();
    return;
  }

  let projectPath: string;
  try {
    projectPath = resolveProjectPath(args[0]);
  } catch (e) {
    process.stderr.write(`tend: ${(e as Error).message}\n`);
    process.exit(1);
  }
  const projectName = gitRepoName(projectPath);

  if (!existsSync(join(projectPath, '.tend'))) {
    process.stderr.write(`tend: .tend/ not initialized in ${projectName}. Run 'tend init' first.\n`);
    process.exit(1);
  }

  await ackProject(projectPath);
  process.stdout.write(`✓ Acknowledged ${projectName}\n\n`);
  await cmdBoard();
}
