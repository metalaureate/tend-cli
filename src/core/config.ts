import { homedir } from 'os';
import { join } from 'path';

export const TEND_VERSION = '0.1.3';

export const config = {
  tendRoot: process.env.TEND_ROOT || join(homedir(), 'projects'),
  staleThreshold: parseInt(process.env.TEND_STALE_THRESHOLD || '1800', 10),
  relayUrl: process.env.TEND_RELAY_URL || 'https://relay.tend.cx',
  relayToken: process.env.TEND_RELAY_TOKEN || '',
  sessionId: process.env.TEND_SESSION_ID || '',
  hookDebug: process.env.TEND_HOOK_DEBUG === '1',
  noColor: !!process.env.NO_COLOR,
  noGamification: process.env.TEND_NO_GAMIFICATION === '1',
  forceColor: !!process.env.TEND_FORCE_COLOR,
  
  // Paths
  tendDir: join(homedir(), '.tend'),
  registry: join(homedir(), '.tend', 'projects'),
  relayTokenFile: join(homedir(), '.tend', 'relay_token'),
  relayCacheDir: join(homedir(), '.tend', 'relay_cache'),
};
