import { relayListTodos, relayUpdateTodo, relayToken, type RelayTodo } from '../core/relay.js';
import { C } from '../ui/colors.js';

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
    // Handle SSH: git@github.com:owner/repo.git
    const sshMatch = url.match(/github\.com[:/]([^/]+\/[^/.]+)/);
    if (sshMatch) return sshMatch[1];
    // Handle HTTPS: https://github.com/owner/repo.git
    const httpsMatch = url.match(/github\.com\/([^/]+\/[^/.]+)/);
    if (httpsMatch) return httpsMatch[1];
    return null;
  } catch {
    return null;
  }
}

function buildIssueBody(todo: RelayTodo): string {
  const token = relayToken();
  const boardUrl = token ? `${BOARD_URL_BASE}/${token}` : '';

  let body = `## Task\n\n${todo.message}\n`;

  if (todo.project !== '_global') {
    body += `\n**Project:** ${todo.project}\n`;
  }

  body += `\n---\n`;
  body += `Dispatched by [tend](https://tend.cx). Follow the contract in \`AGENTS.md\`.\n`;

  if (boardUrl) {
    body += `\nRelay board: ${boardUrl}\n`;
  }

  return body;
}

export async function cmdDispatch(args: string[]): Promise<void> {
  const dryRun = args.includes('--dry-run');
  const projectIdx = args.indexOf('--project');
  const projectFilter = projectIdx !== -1 ? args[projectIdx + 1] : undefined;

  // Check prerequisites
  const token = relayToken();
  if (!token) {
    process.stderr.write("tend: relay not configured. Run 'tend relay setup' first.\n");
    process.exit(1);
  }

  if (!dryRun && !ghAvailable()) {
    process.stderr.write("tend: 'gh' (GitHub CLI) is required for dispatch.\n");
    process.stderr.write('Install it: https://cli.github.com\n');
    process.exit(1);
  }

  if (!dryRun) {
    const repo = detectGitHubRepo();
    if (!repo) {
      process.stderr.write('tend: could not detect GitHub repo from git remote\n');
      process.exit(1);
    }
  }

  // Fetch pending TODOs
  process.stdout.write('Fetching pending TODOs from relay...\n');
  const todos = await relayListTodos('pending', projectFilter);

  if (todos.length === 0) {
    process.stdout.write('No pending TODOs to dispatch.\n');
    return;
  }

  if (dryRun) {
    process.stdout.write(`\n${C.bold}Would dispatch ${todos.length} task${todos.length === 1 ? '' : 's'}:${C.reset}\n\n`);
    for (const t of todos) {
      const proj = t.project === '_global' ? '' : ` (${t.project})`;
      process.stdout.write(`  #${t.id}  ${t.message}${proj}\n`);
    }
    process.stdout.write(`\nRun without --dry-run to create GitHub issues and assign Copilot.\n`);
    return;
  }

  let dispatched = 0;

  for (const todo of todos) {
    const body = buildIssueBody(todo);
    const title = `tend: ${todo.message}`;

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
        process.stderr.write(`  ✗ Failed: ${todo.message}\n`);
        if (stderr) process.stderr.write(`    ${stderr}\n`);
        continue;
      }

      const issueUrl = result.stdout.toString().trim();
      await relayUpdateTodo(todo.id, 'dispatched', issueUrl);
      dispatched++;
      process.stdout.write(`  ✓ ${todo.message} → ${issueUrl}\n`);
    } catch (e) {
      process.stderr.write(`  ✗ Failed: ${todo.message} — ${(e as Error).message}\n`);
    }
  }

  process.stdout.write(`\nDispatched ${dispatched}/${todos.length} task${todos.length === 1 ? '' : 's'}\n`);
}
