import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import worker, { Env, parseInsightResponse } from '../src/index';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {}
}

async function applySchema(db: D1Database) {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now')))"
  );
  await db.exec(
    "CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT NOT NULL, project TEXT NOT NULL, timestamp TEXT NOT NULL, session_id TEXT, state TEXT NOT NULL CHECK (state IN ('working', 'done', 'stuck', 'waiting', 'idle')), message TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))"
  );
  await db.exec("CREATE INDEX IF NOT EXISTS idx_events_token_project ON events (token_hash, project)");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_events_token_project_ts ON events (token_hash, project, timestamp)");
  await db.exec(
    "CREATE TABLE IF NOT EXISTS board_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT NOT NULL, board_token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now')))"
  );
  await db.exec(
    "CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT NOT NULL, project TEXT NOT NULL DEFAULT '_global', message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dispatched', 'done')), issue_url TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))"
  );
  await db.exec("CREATE INDEX IF NOT EXISTS idx_todos_token_status ON todos (token_hash, status)");
  await db.exec(
    "CREATE TABLE IF NOT EXISTS insights (id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT NOT NULL, project TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', prediction TEXT NOT NULL DEFAULT '', inferred_state TEXT NOT NULL DEFAULT '', input_hash TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(token_hash, project))"
  );
  await db.exec(
    "CREATE TABLE IF NOT EXISTS project_context (id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT NOT NULL, project TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', content_hash TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(token_hash, project))"
  );
  await db.exec(
    "CREATE TABLE IF NOT EXISTS insight_log (id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT NOT NULL, project TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', prediction TEXT NOT NULL DEFAULT '', inferred_state TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')))"
  );
  await db.exec("CREATE INDEX IF NOT EXISTS idx_insight_log_token_project ON insight_log (token_hash, project, created_at)");
}

async function makeRequest(method: string, path: string, body?: unknown, token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const request = new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

async function registerToken(): Promise<string> {
  const response = await makeRequest('POST', '/v1/register');
  const data = await response.json() as { token: string };
  return data.token;
}

async function hashTokenForTest(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('Tend Relay', () => {
  beforeEach(async () => {
    await applySchema(env.DB);
    // Clean tables between tests
    await env.DB.exec('DELETE FROM events; DELETE FROM board_tokens; DELETE FROM todos; DELETE FROM tokens; DELETE FROM insights; DELETE FROM project_context;');
  });

  describe('POST /v1/register', () => {
    it('creates a token with tnd_ prefix', async () => {
      const response = await makeRequest('POST', '/v1/register');
      expect(response.status).toBe(201);
      const data = await response.json() as { token: string };
      expect(data.token).toMatch(/^tnd_/);
    });

    it('generates unique tokens', async () => {
      const t1 = await registerToken();
      const t2 = await registerToken();
      expect(t1).not.toBe(t2);
    });
  });

  describe('POST /v1/events', () => {
    it('emits an event with auth', async () => {
      const token = await registerToken();
      const response = await makeRequest('POST', '/v1/events', {
        project: 'my-app',
        state: 'working',
        message: 'building auth',
      }, token);
      expect(response.status).toBe(201);
      const data = await response.json() as { ok: boolean };
      expect(data.ok).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const response = await makeRequest('POST', '/v1/events', {
        project: 'my-app',
        state: 'working',
      });
      expect(response.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const response = await makeRequest('POST', '/v1/events', {
        project: 'my-app',
        state: 'working',
      }, 'tnd_bogustoken');
      expect(response.status).toBe(401);
    });

    it('rejects invalid state', async () => {
      const token = await registerToken();
      const response = await makeRequest('POST', '/v1/events', {
        project: 'my-app',
        state: 'dancing',
      }, token);
      expect(response.status).toBe(400);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('Invalid "state"');
    });

    it('rejects missing project', async () => {
      const token = await registerToken();
      const response = await makeRequest('POST', '/v1/events', {
        state: 'working',
      }, token);
      expect(response.status).toBe(400);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('project');
    });

    it('accepts all valid states', async () => {
      const token = await registerToken();
      for (const state of ['working', 'done', 'stuck', 'waiting', 'idle']) {
        const response = await makeRequest('POST', '/v1/events', {
          project: 'my-app',
          state,
        }, token);
        expect(response.status).toBe(201);
      }
    });

    it('accepts optional session_id and timestamp', async () => {
      const token = await registerToken();
      const response = await makeRequest('POST', '/v1/events', {
        project: 'my-app',
        state: 'working',
        message: 'building auth',
        timestamp: '2026-03-14T14:20:00',
        session_id: 'sess_abc',
      }, token);
      expect(response.status).toBe(201);
    });
  });

  describe('GET /v1/events/:project', () => {
    it('fetches events for a project', async () => {
      const token = await registerToken();
      await makeRequest('POST', '/v1/events', {
        project: 'my-app',
        state: 'working',
        message: 'building auth',
        timestamp: '2026-03-14T14:20:00',
      }, token);
      await makeRequest('POST', '/v1/events', {
        project: 'my-app',
        state: 'done',
        message: 'auth complete',
        timestamp: '2026-03-14T14:30:00',
      }, token);

      const response = await makeRequest('GET', '/v1/events/my-app', undefined, token);
      expect(response.status).toBe(200);
      const data = await response.json() as { events: Array<{ state: string; message: string }> };
      expect(data.events).toHaveLength(2);
      expect(data.events[0].state).toBe('working');
      expect(data.events[1].state).toBe('done');
    });

    it('filters by since parameter', async () => {
      const token = await registerToken();
      await makeRequest('POST', '/v1/events', {
        project: 'my-app',
        state: 'working',
        message: 'first',
        timestamp: '2026-03-14T14:00:00',
      }, token);
      await makeRequest('POST', '/v1/events', {
        project: 'my-app',
        state: 'done',
        message: 'second',
        timestamp: '2026-03-14T15:00:00',
      }, token);

      const response = await makeRequest('GET', '/v1/events/my-app?since=2026-03-14T14:30:00', undefined, token);
      expect(response.status).toBe(200);
      const data = await response.json() as { events: Array<{ message: string }> };
      expect(data.events).toHaveLength(1);
      expect(data.events[0].message).toBe('second');
    });

    it('respects limit parameter', async () => {
      const token = await registerToken();
      for (let i = 0; i < 5; i++) {
        await makeRequest('POST', '/v1/events', {
          project: 'my-app',
          state: 'working',
          message: `event ${i}`,
          timestamp: `2026-03-14T14:0${i}:00`,
        }, token);
      }

      const response = await makeRequest('GET', '/v1/events/my-app?limit=2', undefined, token);
      const data = await response.json() as { events: unknown[] };
      expect(data.events).toHaveLength(2);
    });

    it('returns 401 without auth', async () => {
      const response = await makeRequest('GET', '/v1/events/my-app');
      expect(response.status).toBe(401);
    });

    it('returns empty for unknown project', async () => {
      const token = await registerToken();
      const response = await makeRequest('GET', '/v1/events/no-such-project', undefined, token);
      expect(response.status).toBe(200);
      const data = await response.json() as { events: unknown[] };
      expect(data.events).toHaveLength(0);
    });
  });

  describe('GET /v1/projects', () => {
    it('lists projects with events', async () => {
      const token = await registerToken();
      await makeRequest('POST', '/v1/events', {
        project: 'app-one',
        state: 'working',
        message: 'test',
      }, token);
      await makeRequest('POST', '/v1/events', {
        project: 'app-two',
        state: 'idle',
      }, token);

      const response = await makeRequest('GET', '/v1/projects', undefined, token);
      expect(response.status).toBe(200);
      const data = await response.json() as { projects: string[] };
      expect(data.projects).toContain('app-one');
      expect(data.projects).toContain('app-two');
      expect(data.projects).toHaveLength(2);
    });

    it('isolates projects between tokens', async () => {
      const token1 = await registerToken();
      const token2 = await registerToken();

      await makeRequest('POST', '/v1/events', {
        project: 'secret-app',
        state: 'working',
      }, token1);

      const response = await makeRequest('GET', '/v1/projects', undefined, token2);
      const data = await response.json() as { projects: string[] };
      expect(data.projects).toHaveLength(0);
    });
  });

  describe('Cross-token isolation', () => {
    it('cannot read another token\'s events', async () => {
      const token1 = await registerToken();
      const token2 = await registerToken();

      await makeRequest('POST', '/v1/events', {
        project: 'my-app',
        state: 'stuck',
        message: 'private data',
      }, token1);

      const response = await makeRequest('GET', '/v1/events/my-app', undefined, token2);
      const data = await response.json() as { events: unknown[] };
      expect(data.events).toHaveLength(0);
    });
  });

  describe('Full lifecycle', () => {
    it('register → emit → fetch roundtrip', async () => {
      const token = await registerToken();

      await makeRequest('POST', '/v1/events', {
        project: 'my-app',
        state: 'working',
        message: 'building auth scaffold',
        timestamp: '2026-03-14T14:20:00',
        session_id: 'sess_123',
      }, token);

      await makeRequest('POST', '/v1/events', {
        project: 'my-app',
        state: 'done',
        message: 'auth scaffold complete',
        timestamp: '2026-03-14T14:45:00',
        session_id: 'sess_123',
      }, token);

      const response = await makeRequest('GET', '/v1/events/my-app', undefined, token);
      const data = await response.json() as {
        events: Array<{ timestamp: string; session_id: string | null; state: string; message: string }>
      };
      expect(data.events).toHaveLength(2);
      expect(data.events[0].timestamp).toBe('2026-03-14T14:20:00');
      expect(data.events[0].session_id).toBe('sess_123');
      expect(data.events[0].state).toBe('working');
      expect(data.events[0].message).toBe('building auth scaffold');
      expect(data.events[1].state).toBe('done');
    });
  });

  describe('CORS', () => {
    it('returns CORS headers on OPTIONS', async () => {
      const request = new Request('http://localhost/v1/events', { method: 'OPTIONS' });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });

  describe('404', () => {
    it('returns 404 for unknown routes', async () => {
      const token = await registerToken();
      const response = await makeRequest('GET', '/v1/unknown', undefined, token);
      expect(response.status).toBe(404);
    });
  });

  describe('GET / (landing page)', () => {
    it('returns HTML landing page', async () => {
      const request = new Request('http://localhost/', { method: 'GET' });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/html');
      const html = await response.text();
      expect(html).toContain('tend board');
      expect(html).toContain('tnd_');
    });
  });

  describe('GET /<token> (board view)', () => {
    it('returns 404 HTML for unknown token', async () => {
      const request = new Request('http://localhost/tnd_unknowntoken000000', { method: 'GET' });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);
      expect(response.status).toBe(404);
      const html = await response.text();
      expect(html).toContain('Token not found');
    });

    it('returns HTML board for valid token with no events', async () => {
      const token = await registerToken();
      const request = new Request(`http://localhost/${token}`, { method: 'GET' });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/html');
      const html = await response.text();
      expect(html).toContain('tend board');
      expect(html).toContain('No events yet');
    });

    it('shows project and state in board HTML for valid token with events', async () => {
      const token = await registerToken();
      await makeRequest('POST', '/v1/events', {
        project: 'my-app',
        state: 'working',
        message: 'building auth',
        timestamp: '2026-03-14T14:20:00',
      }, token);
      await makeRequest('POST', '/v1/events', {
        project: 'other-proj',
        state: 'done',
        message: 'PR ready',
        timestamp: '2026-03-14T14:30:00',
      }, token);

      const request = new Request(`http://localhost/${token}`, { method: 'GET' });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('my-app');
      expect(html).toContain('working');
      expect(html).toContain('building auth');
      expect(html).toContain('other-proj');
      expect(html).toContain('done');
      expect(html).toContain('PR ready');
    });

    it('shows only latest state per project', async () => {
      const token = await registerToken();
      await makeRequest('POST', '/v1/events', {
        project: 'my-app',
        state: 'working',
        message: 'old task',
        timestamp: '2026-03-14T14:00:00',
      }, token);
      await makeRequest('POST', '/v1/events', {
        project: 'my-app',
        state: 'done',
        message: 'task complete',
        timestamp: '2026-03-14T15:00:00',
      }, token);

      const request = new Request(`http://localhost/${token}`, { method: 'GET' });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('done');
      expect(html).toContain('task complete');
    });

    it('auto-refresh countdown script is present', async () => {
      const token = await registerToken();
      const request = new Request(`http://localhost/${token}`, { method: 'GET' });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);
      const html = await response.text();
      expect(html).toContain('location.reload');
      expect(html).toContain('countdown');
    });

    it('isolates boards between tokens', async () => {
      const token1 = await registerToken();
      const token2 = await registerToken();

      await makeRequest('POST', '/v1/events', {
        project: 'secret-project',
        state: 'working',
        message: 'private work',
      }, token1);

      const request = new Request(`http://localhost/${token2}`, { method: 'GET' });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);
      const html = await response.text();
      expect(html).not.toContain('secret-project');
      expect(html).not.toContain('private work');
    });
  });

  describe('Board tokens (tnb_)', () => {
    it('creates a board token with tnb_ prefix', async () => {
      const token = await registerToken();
      const response = await makeRequest('POST', '/v1/board-token', undefined, token);
      expect(response.status).toBe(201);
      const data = await response.json() as { board_token: string };
      expect(data.board_token).toMatch(/^tnb_/);
    });

    it('board token can view board HTML', async () => {
      const token = await registerToken();
      await makeRequest('POST', '/v1/events', {
        project: 'my-app', state: 'working', message: 'building',
      }, token);

      const btResponse = await makeRequest('POST', '/v1/board-token', undefined, token);
      const { board_token } = await btResponse.json() as { board_token: string };

      const request = new Request(`http://localhost/${board_token}`, { method: 'GET' });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('my-app');
      expect(html).toContain('working');
    });

    it('board token can view llms.txt', async () => {
      const token = await registerToken();
      await makeRequest('POST', '/v1/events', {
        project: 'my-app', state: 'done', message: 'complete',
      }, token);

      const btResponse = await makeRequest('POST', '/v1/board-token', undefined, token);
      const { board_token } = await btResponse.json() as { board_token: string };

      const request = new Request(`http://localhost/${board_token}/llms.txt`, { method: 'GET' });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('my-app');
      expect(text).toContain('done');
    });

    it('board token cannot write events', async () => {
      const token = await registerToken();
      const btResponse = await makeRequest('POST', '/v1/board-token', undefined, token);
      const { board_token } = await btResponse.json() as { board_token: string };

      const response = await makeRequest('POST', '/v1/events', {
        project: 'my-app', state: 'working',
      }, board_token);
      expect(response.status).toBe(401);
    });

    it('board token cannot access /v1/projects', async () => {
      const token = await registerToken();
      const btResponse = await makeRequest('POST', '/v1/board-token', undefined, token);
      const { board_token } = await btResponse.json() as { board_token: string };

      const response = await makeRequest('GET', '/v1/projects', undefined, board_token);
      expect(response.status).toBe(401);
    });

    it('board token cannot create todos', async () => {
      const token = await registerToken();
      const btResponse = await makeRequest('POST', '/v1/board-token', undefined, token);
      const { board_token } = await btResponse.json() as { board_token: string };

      const response = await makeRequest('POST', '/v1/todos', { message: 'hack' }, board_token);
      expect(response.status).toBe(401);
    });

    it('DELETE /v1/board-token revokes all board tokens', async () => {
      const token = await registerToken();
      await makeRequest('POST', '/v1/events', {
        project: 'my-app', state: 'working', message: 'building',
      }, token);

      const btResponse = await makeRequest('POST', '/v1/board-token', undefined, token);
      const { board_token } = await btResponse.json() as { board_token: string };

      // Revoke
      const delResponse = await makeRequest('DELETE', '/v1/board-token', undefined, token);
      expect(delResponse.status).toBe(200);

      // Board token should no longer work
      const request = new Request(`http://localhost/${board_token}`, { method: 'GET' });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);
      expect(response.status).toBe(404);
    });
  });

  describe('TODO API', () => {
    it('POST /v1/todos creates a todo', async () => {
      const token = await registerToken();
      const response = await makeRequest('POST', '/v1/todos', {
        message: 'add dark mode',
      }, token);
      expect(response.status).toBe(201);
      const data = await response.json() as { id: number; project: string; message: string; status: string };
      expect(data.id).toBeGreaterThan(0);
      expect(data.project).toBe('_global');
      expect(data.message).toBe('add dark mode');
      expect(data.status).toBe('pending');
    });

    it('POST /v1/todos with project', async () => {
      const token = await registerToken();
      const response = await makeRequest('POST', '/v1/todos', {
        project: 'my-app',
        message: 'fix bug #42',
      }, token);
      expect(response.status).toBe(201);
      const data = await response.json() as { project: string };
      expect(data.project).toBe('my-app');
    });

    it('POST /v1/todos rejects missing message', async () => {
      const token = await registerToken();
      const response = await makeRequest('POST', '/v1/todos', {}, token);
      expect(response.status).toBe(400);
    });

    it('GET /v1/todos lists todos', async () => {
      const token = await registerToken();
      await makeRequest('POST', '/v1/todos', { message: 'task one' }, token);
      await makeRequest('POST', '/v1/todos', { message: 'task two' }, token);

      const response = await makeRequest('GET', '/v1/todos', undefined, token);
      expect(response.status).toBe(200);
      const data = await response.json() as { todos: Array<{ message: string }> };
      expect(data.todos).toHaveLength(2);
    });

    it('GET /v1/todos filters by status', async () => {
      const token = await registerToken();
      const createResp = await makeRequest('POST', '/v1/todos', { message: 'task one' }, token);
      const created = await createResp.json() as { id: number };
      await makeRequest('POST', '/v1/todos', { message: 'task two' }, token);

      // Mark first as done
      await makeRequest('PATCH', `/v1/todos/${created.id}`, { status: 'done' }, token);

      const response = await makeRequest('GET', '/v1/todos?status=pending', undefined, token);
      const data = await response.json() as { todos: Array<{ message: string }> };
      expect(data.todos).toHaveLength(1);
      expect(data.todos[0].message).toBe('task two');
    });

    it('GET /v1/todos filters by project', async () => {
      const token = await registerToken();
      await makeRequest('POST', '/v1/todos', { project: 'app-a', message: 'task a' }, token);
      await makeRequest('POST', '/v1/todos', { project: 'app-b', message: 'task b' }, token);

      const response = await makeRequest('GET', '/v1/todos?project=app-a', undefined, token);
      const data = await response.json() as { todos: Array<{ message: string }> };
      expect(data.todos).toHaveLength(1);
      expect(data.todos[0].message).toBe('task a');
    });

    it('PATCH /v1/todos/:id transitions pending → dispatched', async () => {
      const token = await registerToken();
      const createResp = await makeRequest('POST', '/v1/todos', { message: 'task' }, token);
      const { id } = await createResp.json() as { id: number };

      const response = await makeRequest('PATCH', `/v1/todos/${id}`, {
        status: 'dispatched',
        issue_url: 'https://github.com/owner/repo/issues/1',
      }, token);
      expect(response.status).toBe(200);
      const data = await response.json() as { ok: boolean; updated: { id: number; status: string } };
      expect(data.ok).toBe(true);
      expect(data.updated.status).toBe('dispatched');
    });

    it('PATCH /v1/todos/:id transitions dispatched → done', async () => {
      const token = await registerToken();
      const createResp = await makeRequest('POST', '/v1/todos', { message: 'task' }, token);
      const { id } = await createResp.json() as { id: number };

      await makeRequest('PATCH', `/v1/todos/${id}`, { status: 'dispatched' }, token);
      const response = await makeRequest('PATCH', `/v1/todos/${id}`, { status: 'done' }, token);
      expect(response.status).toBe(200);
    });

    it('PATCH /v1/todos/:id rejects dispatched → pending', async () => {
      const token = await registerToken();
      const createResp = await makeRequest('POST', '/v1/todos', { message: 'task' }, token);
      const { id } = await createResp.json() as { id: number };

      await makeRequest('PATCH', `/v1/todos/${id}`, { status: 'dispatched' }, token);
      const response = await makeRequest('PATCH', `/v1/todos/${id}`, { status: 'pending' }, token);
      expect(response.status).toBe(409);
    });

    it('PATCH /v1/todos/:id returns 404 for wrong token', async () => {
      const token1 = await registerToken();
      const token2 = await registerToken();
      const createResp = await makeRequest('POST', '/v1/todos', { message: 'task' }, token1);
      const { id } = await createResp.json() as { id: number };

      const response = await makeRequest('PATCH', `/v1/todos/${id}`, { status: 'done' }, token2);
      expect(response.status).toBe(404);
    });

    it('DELETE /v1/todos/:id removes a todo', async () => {
      const token = await registerToken();
      const createResp = await makeRequest('POST', '/v1/todos', { message: 'task' }, token);
      const { id } = await createResp.json() as { id: number };

      const response = await makeRequest('DELETE', `/v1/todos/${id}`, undefined, token);
      expect(response.status).toBe(200);

      // Verify it's gone
      const listResp = await makeRequest('GET', '/v1/todos', undefined, token);
      const data = await listResp.json() as { todos: unknown[] };
      expect(data.todos).toHaveLength(0);
    });

    it('DELETE /v1/todos/:id returns 404 for unknown id', async () => {
      const token = await registerToken();
      const response = await makeRequest('DELETE', '/v1/todos/99999', undefined, token);
      expect(response.status).toBe(404);
    });

    it('todos appear in llms.txt backlog section', async () => {
      const token = await registerToken();
      await makeRequest('POST', '/v1/todos', { message: 'implement dark mode' }, token);
      await makeRequest('POST', '/v1/events', {
        project: 'my-app', state: 'idle',
      }, token);

      const request = new Request(`http://localhost/${token}/llms.txt`, { method: 'GET' });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);
      const text = await response.text();
      expect(text).toContain('## Backlog');
      expect(text).toContain('implement dark mode');
    });

    it('todos appear in board HTML backlog section', async () => {
      const token = await registerToken();
      await makeRequest('POST', '/v1/todos', { message: 'add tests' }, token);
      await makeRequest('POST', '/v1/events', {
        project: 'my-app', state: 'idle',
      }, token);

      const request = new Request(`http://localhost/${token}`, { method: 'GET' });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);
      const html = await response.text();
      expect(html).toContain('BACKLOG');
      expect(html).toContain('add tests');
    });

    it('cross-token isolation for todos', async () => {
      const token1 = await registerToken();
      const token2 = await registerToken();

      await makeRequest('POST', '/v1/todos', { message: 'secret task' }, token1);

      const response = await makeRequest('GET', '/v1/todos', undefined, token2);
      const data = await response.json() as { todos: unknown[] };
      expect(data.todos).toHaveLength(0);
    });
  });

  describe('State aggregation on board', () => {
    it('infers waiting from working→idle within 10 minutes', async () => {
      const token = await registerToken();

      await makeRequest('POST', '/v1/events', {
        project: 'my-app', state: 'working', message: 'building feature',
        session_id: 'a1', timestamp: new Date(Date.now() - 120_000).toISOString()
      }, token);

      await makeRequest('POST', '/v1/events', {
        project: 'my-app', state: 'idle', message: '',
        session_id: 'a1', timestamp: new Date(Date.now() - 60_000).toISOString()
      }, token);

      const llmsRes = await makeRequest('GET', `/${token}/llms.txt`);
      const llms = await llmsRes.text();
      expect(llms).toContain('waiting');
    });

    it('does not infer waiting if idle came much later', async () => {
      const token = await registerToken();

      await makeRequest('POST', '/v1/events', {
        project: 'my-app', state: 'working', message: 'building',
        session_id: 'a1', timestamp: new Date(Date.now() - 900_000).toISOString()
      }, token);

      await makeRequest('POST', '/v1/events', {
        project: 'my-app', state: 'idle', message: '',
        session_id: 'a1', timestamp: new Date(Date.now() - 60_000).toISOString()
      }, token);

      const llmsRes = await makeRequest('GET', `/${token}/llms.txt`);
      const llms = await llmsRes.text();
      expect(llms).not.toContain('waiting');
      expect(llms).toContain('idle');
    });

    it('picks highest priority state across sessions', async () => {
      const token = await registerToken();
      const now = Date.now();

      await makeRequest('POST', '/v1/events', {
        project: 'my-app', state: 'idle', message: '',
        session_id: 'session1', timestamp: new Date(now - 60_000).toISOString()
      }, token);

      await makeRequest('POST', '/v1/events', {
        project: 'my-app', state: 'stuck', message: 'need creds',
        session_id: 'session2', timestamp: new Date(now - 30_000).toISOString()
      }, token);

      const llmsRes = await makeRequest('GET', `/${token}/llms.txt`);
      const llms = await llmsRes.text();
      expect(llms).toContain('stuck');
      expect(llms).toContain('need creds');
    });

    it('demotes stale working to idle', async () => {
      const token = await registerToken();

      await makeRequest('POST', '/v1/events', {
        project: 'my-app', state: 'working', message: 'running tests',
        session_id: 'a1', timestamp: new Date(Date.now() - 3600_000).toISOString()
      }, token);

      const llmsRes = await makeRequest('GET', `/${token}/llms.txt`);
      const llms = await llmsRes.text();
      expect(llms).toContain('idle');
      expect(llms).not.toContain('working');
    });

    it('handles reset markers (* clears all sessions)', async () => {
      const token = await registerToken();
      const now = Date.now();

      await makeRequest('POST', '/v1/events', {
        project: 'my-app', state: 'stuck', message: 'blocked',
        session_id: 's1', timestamp: new Date(now - 120_000).toISOString()
      }, token);

      await makeRequest('POST', '/v1/events', {
        project: 'my-app', state: 'idle', message: 'reset',
        session_id: '*', timestamp: new Date(now - 60_000).toISOString()
      }, token);

      const llmsRes = await makeRequest('GET', `/${token}/llms.txt`);
      const llms = await llmsRes.text();
      expect(llms).toContain('idle');
      expect(llms).not.toContain('stuck');
    });

    it('cross-token isolation in aggregation', async () => {
      const token1 = await registerToken();
      const token2 = await registerToken();

      await makeRequest('POST', '/v1/events', {
        project: 'secret-app', state: 'working', message: 'classified',
        session_id: 'a1', timestamp: new Date().toISOString()
      }, token1);

      const llmsRes = await makeRequest('GET', `/${token2}/llms.txt`);
      const llms = await llmsRes.text();
      expect(llms).not.toContain('secret-app');
    });
  });

  describe('Insights API', () => {
    it('GET /v1/insights returns empty when no insights exist', async () => {
      const token = await registerToken();
      const response = await makeRequest('GET', '/v1/insights', undefined, token);
      expect(response.status).toBe(200);
      const data = await response.json() as { insights: unknown[] };
      expect(data.insights).toHaveLength(0);
    });

    it('GET /v1/insights returns cached insights', async () => {
      const token = await registerToken();

      // Manually insert an insight (simulating what recomputeInsight would do)
      const tokenHash = await hashTokenForTest(token);
      await env.DB.prepare(
        "INSERT INTO insights (token_hash, project, summary, prediction, input_hash) VALUES (?, ?, ?, ?, ?)"
      ).bind(tokenHash, 'my-app', 'Debugging auth flow after 3 failed attempts', 'Run tests then push fix', 'abc123').run();

      const response = await makeRequest('GET', '/v1/insights', undefined, token);
      expect(response.status).toBe(200);
      const data = await response.json() as { insights: Array<{ project: string; summary: string; prediction: string }> };
      expect(data.insights).toHaveLength(1);
      expect(data.insights[0].project).toBe('my-app');
      expect(data.insights[0].summary).toBe('Debugging auth flow after 3 failed attempts');
      expect(data.insights[0].prediction).toBe('Run tests then push fix');
    });

    it('GET /v1/insights/:project returns single insight', async () => {
      const token = await registerToken();
      const tokenHash = await hashTokenForTest(token);
      await env.DB.prepare(
        "INSERT INTO insights (token_hash, project, summary, prediction, input_hash) VALUES (?, ?, ?, ?, ?)"
      ).bind(tokenHash, 'my-app', 'Working on auth', 'Commit and deploy', 'def456').run();

      const response = await makeRequest('GET', '/v1/insights/my-app', undefined, token);
      expect(response.status).toBe(200);
      const data = await response.json() as { insight: { project: string; summary: string } };
      expect(data.insight.project).toBe('my-app');
      expect(data.insight.summary).toBe('Working on auth');
    });

    it('GET /v1/insights/:project returns null for unknown project', async () => {
      const token = await registerToken();
      const response = await makeRequest('GET', '/v1/insights/nonexistent', undefined, token);
      expect(response.status).toBe(200);
      const data = await response.json() as { insight: null };
      expect(data.insight).toBeNull();
    });

    it('cross-token isolation for insights', async () => {
      const token1 = await registerToken();
      const token2 = await registerToken();
      const tokenHash1 = await hashTokenForTest(token1);

      await env.DB.prepare(
        "INSERT INTO insights (token_hash, project, summary, prediction, input_hash) VALUES (?, ?, ?, ?, ?)"
      ).bind(tokenHash1, 'secret-app', 'Private summary', 'Private prediction', 'xyz').run();

      const response = await makeRequest('GET', '/v1/insights', undefined, token2);
      const data = await response.json() as { insights: unknown[] };
      expect(data.insights).toHaveLength(0);
    });

    it('insights appear in board HTML', async () => {
      const token = await registerToken();
      const tokenHash = await hashTokenForTest(token);

      await makeRequest('POST', '/v1/events', {
        project: 'my-app', state: 'working', message: 'building auth',
      }, token);

      await env.DB.prepare(
        "INSERT INTO insights (token_hash, project, summary, prediction, input_hash) VALUES (?, ?, ?, ?, ?)"
      ).bind(tokenHash, 'my-app', 'Third session on auth module today', 'Run test suite then commit', 'abc').run();

      const request = new Request(`http://localhost/${token}`, { method: 'GET' });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);
      const html = await response.text();
      expect(html).toContain('Third session on auth module today');
      expect(html).toContain('Run test suite then commit');
      expect(html).toContain('msg-insight');
    });

    it('insights appear in llms.txt', async () => {
      const token = await registerToken();
      const tokenHash = await hashTokenForTest(token);

      await makeRequest('POST', '/v1/events', {
        project: 'my-app', state: 'stuck', message: 'need API key',
      }, token);

      await env.DB.prepare(
        "INSERT INTO insights (token_hash, project, summary, prediction, input_hash) VALUES (?, ?, ?, ?, ?)"
      ).bind(tokenHash, 'my-app', 'Blocked on missing API credentials', 'Ask team lead for staging keys', 'def').run();

      const request = new Request(`http://localhost/${token}/llms.txt`, { method: 'GET' });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);
      const text = await response.text();
      expect(text).toContain('- Insight: Blocked on missing API credentials');
      expect(text).toContain('- Next: Ask team lead for staging keys');
    });

    it('GET /v1/insights requires auth', async () => {
      const response = await makeRequest('GET', '/v1/insights');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /v1/insights/:project/history', () => {
    it('returns empty history for project with no logs', async () => {
      const token = await registerToken();
      const response = await makeRequest('GET', '/v1/insights/my-app/history', undefined, token);
      expect(response.status).toBe(200);
      const data = await response.json() as { project: string; history: unknown[] };
      expect(data.project).toBe('my-app');
      expect(data.history).toHaveLength(0);
    });

    it('returns insight history in reverse chronological order', async () => {
      const token = await registerToken();
      const tokenHash = await hashTokenForTest(token);

      await env.DB.prepare(
        "INSERT INTO insight_log (token_hash, project, summary, prediction, inferred_state, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(tokenHash, 'my-app', 'First summary', 'First pred', 'working', '2026-01-01T10:00:00').run();
      await env.DB.prepare(
        "INSERT INTO insight_log (token_hash, project, summary, prediction, inferred_state, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(tokenHash, 'my-app', 'Second summary', 'Second pred', 'done', '2026-01-01T11:00:00').run();

      const response = await makeRequest('GET', '/v1/insights/my-app/history', undefined, token);
      expect(response.status).toBe(200);
      const data = await response.json() as { project: string; history: Array<{ summary: string; inferred_state: string; created_at: string }> };
      expect(data.history).toHaveLength(2);
      expect(data.history[0].summary).toBe('Second summary');
      expect(data.history[1].summary).toBe('First summary');
      expect(data.history[0].inferred_state).toBe('done');
    });

    it('respects limit parameter', async () => {
      const token = await registerToken();
      const tokenHash = await hashTokenForTest(token);

      for (let i = 0; i < 5; i++) {
        await env.DB.prepare(
          "INSERT INTO insight_log (token_hash, project, summary, prediction, inferred_state, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(tokenHash, 'my-app', `Summary ${i}`, `Pred ${i}`, 'working', `2026-01-01T1${i}:00:00`).run();
      }

      const response = await makeRequest('GET', '/v1/insights/my-app/history?limit=2', undefined, token);
      expect(response.status).toBe(200);
      const data = await response.json() as { history: unknown[] };
      expect(data.history).toHaveLength(2);
    });

    it('isolates history across tokens', async () => {
      const token1 = await registerToken();
      const token2 = await registerToken();
      const tokenHash1 = await hashTokenForTest(token1);

      await env.DB.prepare(
        "INSERT INTO insight_log (token_hash, project, summary, prediction, inferred_state, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(tokenHash1, 'my-app', 'Secret summary', 'Secret pred', 'working', '2026-01-01T10:00:00').run();

      const response = await makeRequest('GET', '/v1/insights/my-app/history', undefined, token2);
      const data = await response.json() as { history: unknown[] };
      expect(data.history).toHaveLength(0);
    });

    it('requires auth', async () => {
      const response = await makeRequest('GET', '/v1/insights/my-app/history');
      expect(response.status).toBe(401);
    });
  });

  describe('PUT /v1/projects/:project/context', () => {
    it('stores project context', async () => {
      const token = await registerToken();
      const response = await makeRequest('PUT', '/v1/projects/myapp/context', { content: '# My App\nA cool project' }, token);
      expect(response.status).toBe(200);
      const data = await response.json() as { ok: boolean; changed: boolean };
      expect(data.ok).toBe(true);
      expect(data.changed).toBe(true);
    });

    it('skips update when content unchanged', async () => {
      const token = await registerToken();
      const content = '# My App\nA cool project';
      await makeRequest('PUT', '/v1/projects/myapp/context', { content }, token);
      const response = await makeRequest('PUT', '/v1/projects/myapp/context', { content }, token);
      expect(response.status).toBe(200);
      const data = await response.json() as { ok: boolean; changed: boolean };
      expect(data.ok).toBe(true);
      expect(data.changed).toBe(false);
    });

    it('rejects empty content', async () => {
      const token = await registerToken();
      const response = await makeRequest('PUT', '/v1/projects/myapp/context', { content: '' }, token);
      expect(response.status).toBe(400);
    });

    it('rejects missing content field', async () => {
      const token = await registerToken();
      const response = await makeRequest('PUT', '/v1/projects/myapp/context', { foo: 'bar' }, token);
      expect(response.status).toBe(400);
    });

    it('requires auth', async () => {
      const response = await makeRequest('PUT', '/v1/projects/myapp/context', { content: 'hello' });
      expect(response.status).toBe(401);
    });

    it('invalidates insight cache on context change', async () => {
      const token = await registerToken();
      const tokenHash = await hashTokenForTest(token);

      // Seed an insight with a known hash
      await env.DB.prepare(
        "INSERT INTO insights (token_hash, project, summary, prediction, input_hash) VALUES (?, 'myapp', 'old summary', 'old pred', 'abc123')"
      ).bind(tokenHash).run();

      // Push context
      await makeRequest('PUT', '/v1/projects/myapp/context', { content: '# My App' }, token);

      // Insight input_hash should be invalidated
      const row = await env.DB.prepare(
        "SELECT input_hash FROM insights WHERE token_hash = ? AND project = 'myapp'"
      ).bind(tokenHash).first<{ input_hash: string }>();
      expect(row?.input_hash).toBe('');
    });

    it('isolates context across tokens', async () => {
      const token1 = await registerToken();
      const token2 = await registerToken();

      await makeRequest('PUT', '/v1/projects/myapp/context', { content: '# Token1 App' }, token1);
      await makeRequest('PUT', '/v1/projects/myapp/context', { content: '# Token2 App' }, token2);

      const hash1 = await hashTokenForTest(token1);
      const hash2 = await hashTokenForTest(token2);

      const row1 = await env.DB.prepare(
        "SELECT content FROM project_context WHERE token_hash = ? AND project = 'myapp'"
      ).bind(hash1).first<{ content: string }>();
      const row2 = await env.DB.prepare(
        "SELECT content FROM project_context WHERE token_hash = ? AND project = 'myapp'"
      ).bind(hash2).first<{ content: string }>();

      expect(row1?.content).toBe('# Token1 App');
      expect(row2?.content).toBe('# Token2 App');
    });
  });
});

describe('parseInsightResponse', () => {
  it('passes through prediction when confidence is high', () => {
    const result = parseInsightResponse('auth refactor in progress\nrun tests, open PR\nworking\n85');
    expect(result).not.toBeNull();
    expect(result!.summary).toBe('auth refactor in progress');
    expect(result!.prediction).toBe('run tests, open PR');
    expect(result!.inferred_state).toBe('working');
  });

  it('gates prediction to "what\'s next?" when confidence is low', () => {
    const result = parseInsightResponse('reading mission code\nRead code, return verbatim\nworking\n15');
    expect(result).not.toBeNull();
    expect(result!.summary).toBe('reading mission code');
    expect(result!.prediction).toBe("what's next?");
    expect(result!.inferred_state).toBe('working');
  });

  it('gates prediction when confidence line is missing', () => {
    const result = parseInsightResponse('some summary\nsome prediction\nworking');
    expect(result).not.toBeNull();
    expect(result!.prediction).toBe("what's next?");
  });

  it('gates prediction when confidence is exactly at threshold', () => {
    const result = parseInsightResponse('summary line\nreal prediction\nworking\n40');
    expect(result).not.toBeNull();
    expect(result!.prediction).toBe('real prediction');
  });

  it('gates prediction when confidence is just below threshold', () => {
    const result = parseInsightResponse('summary line\nreal prediction\nworking\n39');
    expect(result).not.toBeNull();
    expect(result!.prediction).toBe("what's next?");
  });

  it('handles numbered line prefixes', () => {
    const result = parseInsightResponse('1. auth shipped\n2. deploy to prod\n3. done\n4. 90');
    expect(result).not.toBeNull();
    expect(result!.summary).toBe('auth shipped');
    expect(result!.prediction).toBe('deploy to prod');
    expect(result!.inferred_state).toBe('done');
  });

  it('returns null for insufficient lines', () => {
    expect(parseInsightResponse('only one line')).toBeNull();
    expect(parseInsightResponse('')).toBeNull();
  });

  it('truncates summary and prediction to 36 chars', () => {
    const long = 'a'.repeat(50);
    const result = parseInsightResponse(`${long}\n${long}\nworking\n80`);
    expect(result).not.toBeNull();
    expect(result!.summary.length).toBe(36);
    expect(result!.prediction.length).toBe(36);
  });

  it('treats non-numeric confidence as zero', () => {
    const result = parseInsightResponse('summary\nprediction\nworking\nhigh');
    expect(result).not.toBeNull();
    expect(result!.prediction).toBe("what's next?");
  });
});
