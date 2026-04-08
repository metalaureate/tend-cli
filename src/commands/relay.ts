import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, chmodSync } from 'fs';
import { dirname, join } from 'path';
import { config } from '../core/config.js';
import { relayToken, relaySync, projectRelayTokenFile, relayCreateBoardToken, relayRemoveProject } from '../core/relay.js';
import { readEvents } from '../core/events.js';

const BOARD_URL_BASE = 'https://relay.tend.cx';

export async function cmdRelay(args: string[]): Promise<void> {
  const subcmd = args[0];

  switch (subcmd) {
    case 'setup':
      await relaySetup();
      break;
    case 'status':
      relayStatus();
      break;
    case 'pull':
      await relayPull();
      break;
    case 'token':
      relayShowToken();
      break;
    case 'debug':
      await relayDebug();
      break;
    case 'link':
      relayLink();
      break;
    case 'share':
      await relayShare();
      break;
    case 'remove':
      await relayRemove(args.slice(1));
      break;
    case undefined:
    case '':
      process.stdout.write(`Usage: tend relay <setup|status|pull|token|link|share|remove|debug>

  setup          Register with relay, get a token
  status         Show relay configuration
  pull           Force-refresh event cache from relay
  token          Print raw token (for copying to remote envs)
  link           Write relay token to this project's .tend/relay_token
  share          Generate a read-only board URL (safe to share)
  remove <name>  Remove a project from the relay board
  debug          Show relay session diagnostics
`);
      break;
    default:
      process.stderr.write(`tend: unknown relay command '${subcmd}'\n`);
      process.stderr.write('Usage: tend relay <setup|status|pull|token|link|share|remove|debug>\n');
      process.exit(1);
  }
}

async function relaySetup(): Promise<void> {
  const relayUrl = config.relayUrl;
  process.stdout.write(`Registering with relay at ${relayUrl}...\n`);

  let response: Response;
  try {
    response = await fetch(`${relayUrl}/v1/register`, {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    process.stderr.write(`tend: failed to reach relay at ${relayUrl}\n`);
    process.exit(1);
  }

  if (!response.ok) {
    process.stderr.write('tend: unexpected response from relay\n');
    process.exit(1);
  }

  const data = await response.json() as { token: string };
  const token = data.token;

  mkdirSync(dirname(config.relayTokenFile), { recursive: true });
  writeFileSync(config.relayTokenFile, token);
  chmodSync(config.relayTokenFile, 0o600);

  process.stdout.write(`
✓ Token stored in ${config.relayTokenFile}

Your relay token:
  ${token}

To use relay in cloud agents (GitHub Copilot, Codespaces, CI, etc.) without
setting an environment variable, commit the token to your project:
  cd <your-project>
  tend relay link
  git add .tend/relay_token
  git commit -m "add tend relay token"

Alternatively, set the token as an environment variable:
  export TEND_RELAY_TOKEN="${token}"

Verify the token is available in the agent session:
  echo "TEND_RELAY_TOKEN=\${TEND_RELAY_TOKEN:-NOT SET}"
  tend relay debug
`);
}

function relayStatus(): void {
  const token = relayToken();
  if (!token) {
    process.stdout.write("Relay: not configured\nRun 'tend relay setup' to register\n");
    return;
  }

  const masked = `${token.slice(0, 8)}...${token.slice(-4)}`;
  process.stdout.write(`Relay:     ${config.relayUrl}\n`);
  process.stdout.write(`Token:     ${masked}\n`);
  process.stdout.write(`Board URL: ${BOARD_URL_BASE}/${token}\n`);

  if (existsSync(config.relayCacheDir)) {
    try {
      const count = readdirSync(config.relayCacheDir).length;
      process.stdout.write(`Cached:    ${count} project(s)\n`);
    } catch {
      process.stdout.write('Cache:     empty\n');
    }
  } else {
    process.stdout.write('Cache:     empty\n');
  }
}

async function relayPull(): Promise<void> {
  const token = relayToken();
  if (!token) {
    process.stderr.write("tend: relay not configured. Run 'tend relay setup' first.\n");
    process.exit(1);
  }

  process.stdout.write('Syncing relay events...\n');
  await relaySync();
  process.stdout.write('✓ Cache refreshed\n');
}

function relayLink(): void {
  const token = relayToken();
  if (!token) {
    process.stderr.write("tend: relay not configured. Run 'tend relay setup' first.\n");
    process.exit(1);
  }

  const projectFile = projectRelayTokenFile();
  if (!projectFile) {
    process.stderr.write('tend: not inside a git project. Run this command from a project directory.\n');
    process.exit(1);
  }

  mkdirSync(dirname(projectFile), { recursive: true });
  writeFileSync(projectFile, token);

  process.stdout.write(`✓ Token written to ${projectFile}

Board URL: ${BOARD_URL_BASE}/${token}

Commit this file so cloud agents pick it up automatically:
  git add .tend/relay_token
  git commit -m "add tend relay token"
`);
}

function relayShowToken(): void {
  const token = relayToken();
  if (!token) {
    process.stderr.write("tend: relay not configured. Run 'tend relay setup' first.\n");
    process.exit(1);
  }

  process.stdout.write(`${token}

Board URL: ${BOARD_URL_BASE}/${token}

⚠  This token grants write access. Use 'tend relay share' for read-only board links.

Commit the token to your project for cloud agents (no env var needed):
  cd <your-project>
  tend relay link
  git add .tend/relay_token
  git commit -m "add tend relay token"

Or set in your remote agent environment (Codespaces, CI, etc.):
  export TEND_RELAY_TOKEN="${token}"

Verify the token is available in the agent session:
  echo "TEND_RELAY_TOKEN=\${TEND_RELAY_TOKEN:-NOT SET}"
  tend relay debug
`);
}

async function relayShare(): Promise<void> {
  const token = relayToken();
  if (!token) {
    process.stderr.write("tend: relay not configured. Run 'tend relay setup' first.\n");
    process.exit(1);
  }

  process.stdout.write('Generating read-only board token...\n');
  const boardToken = await relayCreateBoardToken();
  if (!boardToken) {
    process.stderr.write('tend: failed to create board token\n');
    process.exit(1);
  }

  process.stdout.write(`
✓ Read-only board URL:
  ${BOARD_URL_BASE}/${boardToken}

Share this URL with teammates. It grants view-only access to your board.
It cannot be used to emit events, create todos, or modify anything.

LLM-readable version:
  ${BOARD_URL_BASE}/${boardToken}/llms.txt
`);
}

async function relayDebug(): Promise<void> {
  const token = relayToken();
  const envToken = process.env.TEND_RELAY_TOKEN;
  const globalFileToken = existsSync(config.relayTokenFile)
    ? readFileSync(config.relayTokenFile, 'utf-8').trim()
    : null;
  const projectFile = projectRelayTokenFile();
  const projectFileToken = projectFile && existsSync(projectFile)
    ? readFileSync(projectFile, 'utf-8').trim()
    : null;

  process.stdout.write(`Relay URL:  ${config.relayUrl}\n`);
  process.stdout.write(`Token:      ${token ? `configured (${token.slice(0, 8)}...${token.slice(-4)})` : 'not configured'}\n`);
  if (token) {
    process.stdout.write(`Board URL:  ${BOARD_URL_BASE}/${token}\n`);
  }

  let tokenSrc: string;
  let showHint = false;
  if (envToken) {
    tokenSrc = 'env (TEND_RELAY_TOKEN)';
  } else if (projectFileToken) {
    tokenSrc = `file (${projectFile})`;
  } else if (globalFileToken) {
    tokenSrc = `file (${config.relayTokenFile})`;
    showHint = true;
  } else {
    tokenSrc = 'none';
  }

  process.stdout.write(`Token src:  ${tokenSrc}\n`);
  if (showHint) {
    process.stdout.write(`            ↳ run 'tend relay link' to commit the token to your project\n`);
    process.stdout.write(`               or: export TEND_RELAY_TOKEN="$(tend relay token | head -1)"\n`);
  }
  // Detect GitHub environment
  const ghRepo = process.env.GITHUB_REPOSITORY;
  const ghRunId = process.env.GITHUB_RUN_ID;
  const isGitHub = !!(ghRepo || ghRunId);
  const emitMode = token
    ? `relay → ${config.relayUrl}`
    : 'local only (no relay token)';

  process.stdout.write(`Emit mode:  ${emitMode}\n`);
  process.stdout.write(`Session ID: ${config.sessionId || 'not set (events will use _cli)'}\n`);
  if (isGitHub) {
    process.stdout.write(`GitHub env: yes\n`);
    process.stdout.write(`  GITHUB_REPOSITORY: ${ghRepo || '(not set)'}\n`);
    process.stdout.write(`  GITHUB_RUN_ID:     ${ghRunId || '(not set)'}\n`);
    if (!token) {
      process.stdout.write(`\n⚠  No relay token found in this GitHub environment.\n`);
      process.stdout.write(`   Cloud agent events will NOT reach the dashboard.\n`);
      process.stdout.write(`   Fix: commit .tend/relay_token to your repo, or set TEND_RELAY_TOKEN secret.\n`);
    }
  }
  process.stdout.write(`Cache dir:  ${config.relayCacheDir}\n`);

  if (!existsSync(config.relayCacheDir)) {
    process.stdout.write('Projects:   0\n');
    process.stdout.write('Sessions:   0\n');
  } else {
    let projects: string[] = [];
    try {
      projects = readdirSync(config.relayCacheDir);
    } catch {
      // ignore
    }

    process.stdout.write(`Projects:   ${projects.length}\n`);

    const sessions = new Set<string>();
    for (const project of projects) {
      const cacheFile = join(config.relayCacheDir, project);
      const events = readEvents(cacheFile);
      for (const e of events) {
        // Skip local CLI sessions ('_cli'), old-format events with no session ID,
        // and reset markers (e.g. '*' or '*@user') — only count genuine remote sessions.
        if (e.sessionId && e.sessionId !== '_cli' && !e.sessionId.startsWith('*')) {
          sessions.add(e.sessionId);
        }
      }
    }

    process.stdout.write(`Sessions:   ${sessions.size}\n`);

    if (sessions.size > 0) {
      process.stdout.write('\nSessions seen:\n');
      for (const s of [...sessions].sort()) {
        process.stdout.write(`  ${s}\n`);
      }
    }
  }

  // Live relay connectivity check
  if (!token) {
    process.stdout.write('\nNo relay sessions seen yet.\n');
    return;
  }

  process.stdout.write('\nChecking relay...\n');
  try {
    const response = await fetch(`${config.relayUrl}/v1/projects`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const data = await response.json() as { projects: string[] };
      const relayProjects = data.projects || [];
      process.stdout.write(`Relay:      ✓ connected (${relayProjects.length} project${relayProjects.length === 1 ? '' : 's'} on relay)\n`);
      if (relayProjects.length === 0) {
        process.stdout.write('\nNo cloud agent events received yet.\n');
        process.stdout.write("Run 'tend relay link' in your project to commit the token to git,\n");
        process.stdout.write('or ensure TEND_RELAY_TOKEN is set in your remote agent environment:\n');
        process.stdout.write(`  export TEND_RELAY_TOKEN="${token}"\n`);
      }
    } else {
      process.stdout.write(`Relay:      ✗ error (HTTP ${response.status})\n`);
    }
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    if (isTimeout) {
      process.stdout.write(`Relay:      ✗ timed out connecting to ${config.relayUrl}\n`);
    } else {
      process.stdout.write(`Relay:      ✗ could not connect to ${config.relayUrl}\n`);
    }
  }
}

async function relayRemove(args: string[]): Promise<void> {
  const project = args[0];
  if (!project) {
    process.stderr.write('Usage: tend relay remove <project-name>\n');
    process.exit(1);
  }

  const token = relayToken();
  if (!token) {
    process.stderr.write("tend: relay not configured. Run 'tend relay setup' first.\n");
    process.exit(1);
  }

  const ok = await relayRemoveProject(project);
  if (ok) {
    process.stdout.write(`✓ Removed '${project}' from relay\n`);
  } else {
    process.stderr.write(`tend: failed to remove '${project}' from relay\n`);
    process.exit(1);
  }
}
