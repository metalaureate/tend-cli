import { readFileSync, appendFileSync, existsSync, mkdirSync, readdirSync, writeFileSync, statSync } from 'fs';
import { join, basename } from 'path';
import { createHash } from 'crypto';
import { config } from './config.js';
import { discoverProjects, detectProject } from './projects.js';
import { formatTs } from '../ui/format.js';
import { gitRepoName } from './git.js';

/** Get the path to the project-level relay token file in the current git root */
export function projectRelayTokenFile(): string | null {
  const project = detectProject();
  if (!project) return null;
  return join(project, '.tend', 'relay_token');
}

/** Read the relay token from env, project file, or global file */
export function relayToken(): string | null {
  // 1. Env var takes highest precedence
  if (config.relayToken) return config.relayToken;

  // 2. Project-level .tend/relay_token (committable to git)
  const projectFile = projectRelayTokenFile();
  if (projectFile) {
    try {
      if (existsSync(projectFile)) {
        const t = readFileSync(projectFile, 'utf-8').trim();
        if (t) return t;
      }
    } catch {
      // ignore
    }
  }

  // 3. Global ~/.tend/relay_token
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

  const ts = new Date().toISOString().slice(0, 19);
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
        if (lastTs) {
          // Cache timestamps are local; convert to UTC for relay API query
          const utcTs = new Date(lastTs).toISOString().slice(0, 19);
          sinceParam = `?since=${utcTs}`;
        }
      }
    } catch {
      // ignore
    }
  }

  try {
    const limitParam = sinceParam ? `${sinceParam}&limit=1000` : '?limit=1000';
    const response = await fetch(`${config.relayUrl}/v1/events/${project}${limitParam}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return;
    const data = await response.json() as {
      events: Array<{ timestamp: string; session_id?: string; state: string; message?: string }>;
    };

    const lines: string[] = [];
    for (const e of data.events || []) {
      // Relay timestamps are UTC; convert to local time to match local event format
      const localTs = formatTs(new Date(e.timestamp + 'Z'));
      const parts = [localTs];
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

  // Build a set of all names a local project might be known by:
  // git remote name AND directory basename
  const localNames = new Set<string>();
  for (const p of discoverProjects()) {
    localNames.add(gitRepoName(p));
    const dirName = p.split('/').pop();
    if (dirName) localNames.add(dirName);
  }

  try {
    const cacheEntries = readdirSync(config.relayCacheDir);
    return cacheEntries.filter((name: string) =>
      !name.includes('.') && !localNames.has(name),
    );
  } catch {
    return [];
  }
}

// ── Insights API ──

export interface RelayInsight {
  project: string;
  summary: string;
  prediction: string;
  inferred_state: string;
}

/** Fetch cached LLM insights from the relay (non-blocking, returns empty on failure) */
export async function relayFetchInsights(): Promise<Map<string, RelayInsight>> {
  const token = relayToken();
  if (!token) return new Map();

  try {
    const response = await fetch(`${config.relayUrl}/v1/insights`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return new Map();
    const data = await response.json() as { insights: RelayInsight[] };
    const map = new Map<string, RelayInsight>();
    for (const i of data.insights || []) {
      map.set(i.project, i);
    }
    return map;
  } catch {
    return new Map();
  }
}

// ── Project Context (README) ──

const MAX_README_SIZE = 8000;
const CONTEXT_RECHECK_MS = 60 * 60 * 1000; // 1 hour

/** Push the project README to the relay for LLM context. Checks at most once per 24h. */
export async function relayPushContext(projectPath: string, projectName: string): Promise<void> {
  const token = relayToken();
  if (!token) return;

  mkdirSync(config.relayCacheDir, { recursive: true });
  const hashFile = join(config.relayCacheDir, `${projectName}.ctx_hash`);

  // Time gate: skip entirely if hash file was written in the last 24h
  try {
    if (existsSync(hashFile)) {
      const mtime = statSync(hashFile).mtimeMs;
      if (Date.now() - mtime < CONTEXT_RECHECK_MS) return;
    }
  } catch {
    // ignore — proceed with check
  }

  // Try README.md, then README, then readme.md
  let readmePath: string | null = null;
  for (const name of ['README.md', 'README', 'readme.md']) {
    const candidate = join(projectPath, name);
    if (existsSync(candidate)) {
      readmePath = candidate;
      break;
    }
  }
  if (!readmePath) return;

  let content: string;
  try {
    content = readFileSync(readmePath, 'utf-8').slice(0, MAX_README_SIZE);
  } catch {
    return;
  }
  if (!content.trim()) return;

  // Content hash check — avoid the PUT if nothing actually changed
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
  try {
    if (existsSync(hashFile) && readFileSync(hashFile, 'utf-8').trim() === hash) {
      // Content unchanged — touch the file to reset the 24h timer
      writeFileSync(hashFile, hash);
      return;
    }
  } catch {
    // ignore
  }

  try {
    const response = await fetch(`${config.relayUrl}/v1/projects/${encodeURIComponent(projectName)}/context`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      writeFileSync(hashFile, hash);
    }
  } catch {
    // silently fail — context push is best-effort
  }
}

// ── TODO API ──

/** Remove a project and all its data from the relay */
export async function relayRemoveProject(project: string): Promise<boolean> {
  const token = relayToken();
  if (!token) return false;

  try {
    const response = await fetch(`${config.relayUrl}/v1/projects/${encodeURIComponent(project)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export interface RelayTodo {
  id: number;
  project: string;
  message: string;
  status: string;
  issue_url: string | null;
  created_at: string;
  updated_at: string;
}

/** Create a TODO on the relay */
export async function relayAddTodo(project: string, message: string): Promise<boolean> {
  const token = relayToken();
  if (!token) return false;

  try {
    const response = await fetch(`${config.relayUrl}/v1/todos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ project, message }),
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** List TODOs from the relay */
export async function relayListTodos(status?: string, project?: string): Promise<RelayTodo[]> {
  const token = relayToken();
  if (!token) return [];

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (project) params.set('project', project);
  const qs = params.toString() ? `?${params.toString()}` : '';

  try {
    const response = await fetch(`${config.relayUrl}/v1/todos${qs}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return [];
    const data = await response.json() as { todos: RelayTodo[] };
    return data.todos || [];
  } catch {
    return [];
  }
}

/** Update a TODO's status on the relay */
export async function relayUpdateTodo(
  id: number,
  status: string,
  issueUrl?: string,
): Promise<boolean> {
  const token = relayToken();
  if (!token) return false;

  const body: Record<string, string> = { status };
  if (issueUrl) body.issue_url = issueUrl;

  try {
    const response = await fetch(`${config.relayUrl}/v1/todos/${id}`, {
      method: 'PATCH',
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

/** Delete a TODO from the relay */
export async function relayDeleteTodo(id: number): Promise<boolean> {
  const token = relayToken();
  if (!token) return false;

  try {
    const response = await fetch(`${config.relayUrl}/v1/todos/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Create a read-only board token */
export async function relayCreateBoardToken(): Promise<string | null> {
  const token = relayToken();
  if (!token) return null;

  try {
    const response = await fetch(`${config.relayUrl}/v1/board-token`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const data = await response.json() as { board_token: string };
    return data.board_token;
  } catch {
    return null;
  }
}
