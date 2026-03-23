import { readFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { config } from './config.js';
import { discoverProjects, detectProject } from './projects.js';
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
    discoverProjects().map(p => gitRepoName(p)),
  );

  try {
    const cacheEntries = readdirSync(config.relayCacheDir);
    return cacheEntries.filter((name: string) => !localProjects.has(name));
  } catch {
    return [];
  }
}

// ── TODO API ──

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
