import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, chmodSync } from 'fs';
import { dirname } from 'path';
import { config } from '../core/config.js';
import { relayToken, relaySync } from '../core/relay.js';

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
    case undefined:
    case '':
      process.stdout.write(`Usage: tend relay <setup|status|pull|token>

  setup    Register with relay, get a token
  status   Show relay configuration
  pull     Force-refresh event cache from relay
  token    Print raw token (for copying to remote envs)
`);
      break;
    default:
      process.stderr.write(`tend: unknown relay command '${subcmd}'\n`);
      process.stderr.write('Usage: tend relay <setup|status|pull|token>\n');
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
