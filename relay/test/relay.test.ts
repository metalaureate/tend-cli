import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import worker, { Env } from '../src/index';

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

describe('Tend Relay', () => {
  beforeEach(async () => {
    await applySchema(env.DB);
    // Clean tables between tests
    await env.DB.exec('DELETE FROM events; DELETE FROM board_tokens; DELETE FROM todos; DELETE FROM tokens;');
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
});
