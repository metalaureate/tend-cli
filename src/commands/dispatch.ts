import { relayListTodos, relayUpdateTodo, relayToken, type RelayTodo } from '../core/relay.js';
import { C } from '../ui/colors.js';
import { createInterface } from 'readline';

const BOARD_URL_BASE = 'https://relay.tend.cx';

function ghAvailable(): boolean {
  try {
    const result = Bun.spawnSync(['gh', '--version']);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

function detectGitHubRepo(): string | null {
  try {
    const result = Bun.spawnSync(['git', 'remote', 'get-url', 'origin']);
    if (result.exitCode !== 0) return null;
    const url = result.stdout.toString().trim();
    const sshMatch = url.match(/github\.com[:/]([^/]+\/[^/.]+)/);
    if (sshMatch) return sshMatch[1];
    const httpsMatch = url.match(/github\.com\/([^/]+\/[^/.]+)/);
    if (httpsMatch) return httpsMatch[1];
    return null;
  } catch {
    return null;
  }
}

function buildIssueBody(message: string, project: string): string {
  const token = relayToken();
  const boardUrl = token ? `${BOARD_URL_BASE}/${token}` : '';

  let body = `## Task\n\n${message}\n`;

  if (project !== '_global') {
    body += `\n**Project:** ${project}\n`;
  }

  body += `\n---\n`;
  body += `Dispatched by [tend](https://tend.cx). Follow the contract in \`AGENTS.md\`.\n`;

  if (boardUrl) {
    body += `\nRelay board: ${boardUrl}\n`;
  }

  return body;
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

export async function cmdDispatch(args: string[]): Promise<void> {
  const projectIdx = args.indexOf('--project');
  const projectFilter = projectIdx !== -1 ? args[projectIdx + 1] : undefined;

  // Check prerequisites
  const token = relayToken();
  if (!token) {
    process.stderr.write("tend: relay not configured. Run 'tend relay setup' first.\n");
    process.exit(1);
  }

  if (!ghAvailable()) {
    process.stderr.write("tend: 'gh' (GitHub CLI) is required for dispatch.\n");
    process.stderr.write('Install it: https://cli.github.com\n');
    process.exit(1);
  }

  const repo = detectGitHubRepo();
  if (!repo) {
    process.stderr.write('tend: could not detect GitHub repo from git remote\n');
    process.exit(1);
  }

  // Fetch pending TODOs
  process.stdout.write('Fetching pending TODOs from relay...\n');
  const todos = await relayListTodos('pending', projectFilter);

  if (todos.length === 0) {
    process.stdout.write('No pending TODOs to dispatch.\n');
    return;
  }

  // Non-interactive — just list and exit
  if (!process.stdin.isTTY) {
    process.stdout.write(`${todos.length} pending TODO${todos.length === 1 ? '' : 's'}:\n`);
    for (let i = 0; i < todos.length; i++) {
      const t = todos[i];
      const proj = t.project === '_global' ? '' : ` (${t.project})`;
      process.stdout.write(`  ${i + 1}. ${t.message}${proj}\n`);
    }
    process.stdout.write('\nRun interactively to dispatch.\n');
    return;
  }

  // Step 1: Show TODOs and ask user to pick one
  process.stdout.write(`\n${C.bold}Pending TODOs:${C.reset}\n\n`);
  for (let i = 0; i < todos.length; i++) {
    const t = todos[i];
    const proj = t.project === '_global' ? '' : ` ${C.dim}(${t.project})${C.reset}`;
    process.stdout.write(`  ${i + 1}. ${t.message}${proj}\n`);
  }
  process.stdout.write('\n');

  const pickAnswer = await prompt(`${C.dim}Which TODO to dispatch? (#, or Enter to cancel):${C.reset} `);
  const pick = parseInt(pickAnswer.trim(), 10);
  if (isNaN(pick) || pick < 1 || pick > todos.length) {
    process.stdout.write('Cancelled.\n');
    return;
  }

  const todo = todos[pick - 1];

  // Step 2: Show the TODO and let user edit in-place
  process.stdout.write(`\n${C.bold}Issue title:${C.reset}\n  tend: ${todo.message}\n\n`);
  const editAnswer = await prompt(`${C.dim}Edit description (Enter to keep as-is):${C.reset}\n  `);
  const finalMessage = editAnswer.trim() || todo.message;

  if (finalMessage !== todo.message) {
    process.stdout.write(`\n${C.bold}Updated:${C.reset} ${finalMessage}\n`);
  }

  // Step 3: Confirm
  const confirmAnswer = await prompt(`\n${C.dim}Create GitHub issue in ${C.reset}${repo}${C.dim}? (y/N):${C.reset} `);
  if (confirmAnswer.trim().toLowerCase() !== 'y') {
    process.stdout.write('Cancelled.\n');
    return;
  }

  // Dispatch
  const body = buildIssueBody(finalMessage, todo.project);
  const title = `tend: ${finalMessage}`;

  try {
    const result = Bun.spawnSync([
      'gh', 'issue', 'create',
      '--title', title,
      '--body', body,
      '--assignee', '@me',
      '--label', 'copilot',
    ]);

    if (result.exitCode !== 0) {
      const stderr = result.stderr.toString().trim();
      process.stderr.write(`✗ Failed: ${finalMessage}\n`);
      if (stderr) process.stderr.write(`  ${stderr}\n`);
      return;
    }

    const issueUrl = result.stdout.toString().trim();
    await relayUpdateTodo(todo.id, 'dispatched', issueUrl);
    process.stdout.write(`✓ ${finalMessage} → ${issueUrl}\n`);
  } catch (e) {
    process.stderr.write(`✗ Failed: ${finalMessage} — ${(e as Error).message}\n`);
  }
}
