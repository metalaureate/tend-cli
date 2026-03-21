import { readFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { config } from './config.js';
import { discoverProjects } from './projects.js';
import { tsLocal } from '../ui/format.js';

/** Read the relay token from env or file */
export function relayToken(): string | null {
  if (config.relayToken) return config.relayToken;
  try {
    if (existsSync(config.relayTokenFile)) {
      return readFileSync(config.relayTokenFile, 'utf-8').trim();
    }
  } catch {
    // ignore
  }
  return null;
}

/** POST an event to the relay */
export async function relayEmit(
  project: string,
  state: string,
  message: string = '',
  sessionId: string = '',
): Promise<boolean> {
  const token = relayToken();
  if (!token) return false;

  const ts = tsLocal();
  const body: Record<string, string> = { project, state, message, timestamp: ts };
  if (sessionId) body.session_id = sessionId;

  try {
    const response = await fetch(`${config.relayUrl}/v1/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Sync all relay projects to local cache */
export async function relaySync(): Promise<void> {
  const token = relayToken();
  if (!token) return;

  mkdirSync(config.relayCacheDir, { recursive: true });

  // Fetch project list
  let projectList: string[];
  try {
    const response = await fetch(`${config.relayUrl}/v1/projects`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return;
    const data = await response.json() as { projects: string[] };
    projectList = data.projects || [];
  } catch {
    return;
  }

  // Fetch events for each project
  await Promise.all(projectList.map(p => relayFetchProject(p, token)));
}

/** Fetch events for one relay project and append to cache */
async function relayFetchProject(project: string, token: string): Promise<void> {
  const cacheFile = join(config.relayCacheDir, project);

  let sinceParam = '';
  if (existsSync(cacheFile)) {
    try {
      const content = readFileSync(cacheFile, 'utf-8').trimEnd();
      const lines = content.split('\n');
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        const lastTs = lastLine.split(' ')[0];
        if (lastTs) sinceParam = `?since=${lastTs}`;
      }
    } catch {
      // ignore
    }
  }

  try {
    const response = await fetch(`${config.relayUrl}/v1/events/${project}${sinceParam}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return;
    const data = await response.json() as {
      events: Array<{ timestamp: string; session_id?: string; state: string; message?: string }>;
    };

    const lines: string[] = [];
    for (const e of data.events || []) {
      const parts = [e.timestamp];
      if (e.session_id) parts.push(e.session_id);
      parts.push(e.state);
      if (e.message) parts.push(e.message);
      lines.push(parts.join(' '));
    }

    if (lines.length > 0) {
      appendFileSync(cacheFile, lines.join('\n') + '\n');
    }
  } catch {
    // silently fail — relay is optional
  }
}

/** List relay-only projects (in cache but not registered locally) */
export function relayOnlyProjects(): string[] {
  if (!existsSync(config.relayCacheDir)) return [];

  const localProjects = new Set(
    discoverProjects().map(p => basename(p)),
  );

  try {
    const cacheEntries = readdirSync(config.relayCacheDir);
    return cacheEntries.filter((name: string) => !localProjects.has(name));
  } catch {
    return [];
  }
}
