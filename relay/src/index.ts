export interface Env {
  DB: D1Database;
}

const VALID_STATES = ['working', 'done', 'stuck', 'waiting', 'idle'] as const;
type State = typeof VALID_STATES[number];

function isValidState(s: string): s is State {
  return (VALID_STATES as readonly string[]).includes(s);
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function authenticate(request: Request, db: D1Database): Promise<string | null> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const row = await db.prepare('SELECT token_hash FROM tokens WHERE token_hash = ?')
    .bind(tokenHash)
    .first<{ token_hash: string }>();
  return row ? row.token_hash : null;
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const base62 = Array.from(bytes)
    .map(b => b.toString(36))
    .join('')
    .slice(0, 40);
  return `tnd_${base62}`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

async function handleRegister(request: Request, db: D1Database): Promise<Response> {
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);

  const token = generateToken();
  const tokenHash = await hashToken(token);

  await db.prepare('INSERT INTO tokens (token_hash) VALUES (?)')
    .bind(tokenHash)
    .run();

  return jsonResponse({ token }, 201);
}

async function handleEmitEvent(request: Request, db: D1Database, tokenHash: string): Promise<Response> {
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const { project, state, message, timestamp, session_id } = body as {
    project?: string;
    state?: string;
    message?: string;
    timestamp?: string;
    session_id?: string;
  };

  if (!project || typeof project !== 'string') {
    return errorResponse('Missing or invalid "project"', 400);
  }
  if (!state || typeof state !== 'string' || !isValidState(state)) {
    return errorResponse(`Invalid "state". Must be one of: ${VALID_STATES.join(', ')}`, 400);
  }

  const ts = timestamp && typeof timestamp === 'string' ? timestamp : new Date().toISOString().slice(0, 19);

  await db.prepare(
    'INSERT INTO events (token_hash, project, timestamp, session_id, state, message) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(tokenHash, project, ts, session_id ?? null, state, message ?? '')
    .run();

  return jsonResponse({ ok: true }, 201);
}

async function handleGetEvents(request: Request, db: D1Database, tokenHash: string, project: string): Promise<Response> {
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);

  const url = new URL(request.url);
  const since = url.searchParams.get('since');
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '100', 10) || 100, 1), 1000);

  let query: string;
  const params: unknown[] = [tokenHash, project];

  if (since) {
    query = 'SELECT timestamp, session_id, state, message FROM events WHERE token_hash = ? AND project = ? AND timestamp > ? ORDER BY timestamp ASC LIMIT ?';
    params.push(since, limit);
  } else {
    query = 'SELECT timestamp, session_id, state, message FROM events WHERE token_hash = ? AND project = ? ORDER BY timestamp ASC LIMIT ?';
    params.push(limit);
  }

  const result = await db.prepare(query).bind(...params).all<{
    timestamp: string;
    session_id: string | null;
    state: string;
    message: string;
  }>();

  return jsonResponse({ events: result.results });
}

async function handleGetProjects(request: Request, db: D1Database, tokenHash: string): Promise<Response> {
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);

  const result = await db.prepare(
    'SELECT DISTINCT project FROM events WHERE token_hash = ? ORDER BY project'
  ).bind(tokenHash).all<{ project: string }>();

  return jsonResponse({ projects: result.results.map(r => r.project) });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        },
      });
    }

    // Registration (no auth)
    if (path === '/v1/register') {
      const response = await handleRegister(request, env.DB);
      response.headers.set('Access-Control-Allow-Origin', '*');
      return response;
    }

    // All other routes require auth
    const tokenHash = await authenticate(request, env.DB);
    if (!tokenHash) {
      return errorResponse('Unauthorized', 401);
    }

    let response: Response;

    // Route: POST /v1/events
    if (path === '/v1/events') {
      response = await handleEmitEvent(request, env.DB, tokenHash);
    }
    // Route: GET /v1/events/:project
    else if (path.startsWith('/v1/events/')) {
      const project = decodeURIComponent(path.slice('/v1/events/'.length));
      if (!project) {
        response = errorResponse('Missing project name', 400);
      } else {
        response = await handleGetEvents(request, env.DB, tokenHash, project);
      }
    }
    // Route: GET /v1/projects
    else if (path === '/v1/projects') {
      response = await handleGetProjects(request, env.DB, tokenHash);
    }
    else {
      response = errorResponse('Not found', 404);
    }

    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  },
};
