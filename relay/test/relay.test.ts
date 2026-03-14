import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src/index';

async function applySchema(db: D1Database) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL,
      project TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      session_id TEXT,
      state TEXT NOT NULL CHECK (state IN ('working', 'done', 'stuck', 'waiting', 'idle')),
      message TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_events_token_project ON events (token_hash, project);
    CREATE INDEX IF NOT EXISTS idx_events_token_project_ts ON events (token_hash, project, timestamp);
  `);
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
    await env.DB.exec('DELETE FROM events; DELETE FROM tokens;');
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
});
