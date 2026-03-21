import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, chmodSync } from 'fs';
import { dirname, join } from 'path';
import { config } from '../core/config.js';
import { relayToken, relaySync } from '../core/relay.js';
import { readEvents } from '../core/events.js';

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
    case undefined:
    case '':
      process.stdout.write(`Usage: tend relay <setup|status|pull|token|debug>

  setup    Register with relay, get a token
  status   Show relay configuration
  pull     Force-refresh event cache from relay
  token    Print raw token (for copying to remote envs)
  debug    Show relay session diagnostics
`);
      break;
    default:
      process.stderr.write(`tend: unknown relay command '${subcmd}'\n`);
      process.stderr.write('Usage: tend relay <setup|status|pull|token|debug>\n');
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

Set this on remote environments:
  export TEND_RELAY_TOKEN="${token}"
`);
}

function relayStatus(): void {
  const token = relayToken();
  if (!token) {
    process.stdout.write("Relay: not configured\nRun 'tend relay setup' to register\n");
    return;
  }

  const masked = `${token.slice(0, 8)}...${token.slice(-4)}`;
  process.stdout.write(`Relay:  ${config.relayUrl}\n`);
  process.stdout.write(`Token:  ${masked}\n`);

  if (existsSync(config.relayCacheDir)) {
    try {
      const count = readdirSync(config.relayCacheDir).length;
      process.stdout.write(`Cached: ${count} project(s)\n`);
    } catch {
      process.stdout.write('Cache:  empty\n');
    }
  } else {
    process.stdout.write('Cache:  empty\n');
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

function relayShowToken(): void {
  const token = relayToken();
  if (!token) {
    process.stderr.write("tend: relay not configured. Run 'tend relay setup' first.\n");
    process.exit(1);
  }

  process.stdout.write(`${token}

Set in your remote environment (Codespaces, CI, etc.):
  export TEND_RELAY_TOKEN="${token}"
`);
}

async function relayDebug(): Promise<void> {
  const token = relayToken();
  const envToken = process.env.TEND_RELAY_TOKEN;
  const fileToken = existsSync(config.relayTokenFile)
    ? readFileSync(config.relayTokenFile, 'utf-8').trim()
    : null;

  process.stdout.write(`Relay URL:  ${config.relayUrl}\n`);
  process.stdout.write(`Token:      ${token ? `configured (${token.slice(0, 8)}...${token.slice(-4)})` : 'not configured'}\n`);
  process.stdout.write(`Token src:  ${envToken ? 'env (TEND_RELAY_TOKEN)' : fileToken ? `file (${config.relayTokenFile})` : 'none'}\n`);
  process.stdout.write(`Emit mode:  ${token ? `relay → ${config.relayUrl}` : 'local'}\n`);
  process.stdout.write(`Session ID: ${config.sessionId || 'not set (events will use _cli)'}\n`);
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
        process.stdout.write('Ensure TEND_RELAY_TOKEN is set in your remote agent environment:\n');
        process.stdout.write('  export TEND_RELAY_TOKEN="<your token>"\n');
        process.stdout.write('Copy your token with: tend relay token\n');
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
