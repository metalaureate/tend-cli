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

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

interface ProjectRow {
  project: string;
  state: string;
  message: string;
  timestamp: string;
}

function stateIcon(state: string): string {
  switch (state) {
    case 'stuck':
    case 'waiting': return '?';
    case 'done': return '◉';
    case 'working': return '◐';
    default: return '◌';
  }
}

function stateClass(state: string): string {
  switch (state) {
    case 'stuck':
    case 'waiting': return 'ember';
    case 'done': return 'patina';
    case 'working': return 'working';
    default: return 'idle';
  }
}

function buildBoardHtml(rows: ProjectRow[], updatedAt: string): string {
  const rowsHtml = rows.map(r => {
    const icon = stateIcon(r.state);
    const cls = stateClass(r.state);
    const name = r.project.length > 19 ? r.project.slice(0, 18) + '…' : r.project;
    const msg = (r.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const ts = r.timestamp ? `data-ts="${r.timestamp.replace(/"/g, '')}"` : '';
    return `<div class="row">
      <span class="icon ${cls}">${icon}</span>
      <span class="name">${name}</span>
      <span class="state ${cls}">${r.state}</span>
      <span class="msg">${msg}</span>
      <span class="time ${cls}" ${ts}></span>
    </div>`;
  }).join('\n');

  const stuckCount = rows.filter(r => r.state === 'stuck' || r.state === 'waiting').length;
  const doneCount = rows.filter(r => r.state === 'done').length;
  const workingCount = rows.filter(r => r.state === 'working').length;
  const idleCount = rows.filter(r => r.state === 'idle').length;

  const footerParts: string[] = [];
  if (stuckCount > 0) footerParts.push(`<span class="ember">${stuckCount} needs attention</span>`);
  if (doneCount > 0) footerParts.push(`${doneCount} done`);
  if (workingCount > 0) footerParts.push(`<span class="working">${workingCount} working</span>`);
  if (idleCount > 0) footerParts.push(`<span class="idle">${idleCount} idle</span>`);
  const footerHtml = footerParts.length > 0 ? footerParts.join(' · ') : 'no projects yet';

  const emptyMsg = rows.length === 0
    ? '<div class="empty">No events yet — start emitting with <code>tend emit working "your task"</code></div>'
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Tend Board</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { background: #111111; min-height: 100vh; }
    body {
      background: #111111;
      color: #F5F2EB;
      font-family: 'IBM Plex Mono', 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.6;
      padding: 32px 20px;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    .terminal {
      max-width: 720px;
      margin: 0 auto;
      background: #1a1a1a;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      overflow: hidden;
    }
    .titlebar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .dot { width: 10px; height: 10px; border-radius: 50%; }
    .dot-red   { background: rgba(232,85,61,0.4); }
    .dot-yel   { background: rgba(234,179,8,0.4); }
    .dot-grn   { background: rgba(46,158,110,0.4); }
    .titlebar-label { font-size: 11px; color: rgba(138,138,138,0.4); margin-left: 6px; }
    .statusbar {
      display: flex;
      justify-content: space-between;
      padding: 6px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      font-size: 11px;
      color: rgba(138,138,138,0.5);
    }
    .board { padding: 16px 14px 12px; }
    .board-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 14px;
      color: rgba(245,242,235,0.6);
      font-weight: 600;
      letter-spacing: 0.08em;
      font-size: 11px;
    }
    .row {
      display: flex;
      align-items: baseline;
      margin-bottom: 5px;
      font-size: 12px;
    }
    .icon { width: 14px; flex-shrink: 0; }
    .name {
      width: 148px;
      flex-shrink: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: rgba(245,242,235,0.7);
      margin-left: 4px;
    }
    .state { width: 72px; flex-shrink: 0; font-size: 11px; }
    .msg {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: rgba(138,138,138,0.6);
    }
    .time { flex-shrink: 0; margin-left: 8px; font-size: 11px; color: rgba(138,138,138,0.35); }
    .footer {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid rgba(255,255,255,0.05);
      font-size: 11px;
      color: rgba(138,138,138,0.4);
    }
    .empty {
      color: rgba(138,138,138,0.4);
      font-size: 12px;
      padding: 8px 0;
    }
    .empty code { color: rgba(245,242,235,0.5); }
    /* State colours */
    .ember   { color: #E8553D; }
    .patina  { color: #2E9E6E; }
    .working { color: #20A890; }
    .idle    { color: rgba(138,138,138,0.45); }
    /* Countdown */
    .countdown { color: rgba(138,138,138,0.5); }
    .countdown.warn { color: #E8553D; }
  </style>
</head>
<body>
  <div class="terminal">
    <div class="titlebar">
      <span class="dot dot-red"></span>
      <span class="dot dot-yel"></span>
      <span class="dot dot-grn"></span>
      <span class="titlebar-label">$ tend</span>
    </div>
    <div class="statusbar">
      <span>tend board &nbsp;·&nbsp; updated <span id="updated-at">${updatedAt}</span> &nbsp;·&nbsp; next refresh in <span id="countdown" class="countdown">60s</span></span>
      <span>tend.cx</span>
    </div>
    <div class="board">
      <div class="board-header">
        <span>TEND</span>
        <span id="datestamp"></span>
      </div>
      ${emptyMsg}
      ${rowsHtml}
      <div class="footer">${footerHtml}</div>
    </div>
  </div>
  <script>
    // Datestamp
    (function() {
      var now = new Date();
      var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var pad = function(n) { return String(n).padStart(2,'0'); };
      document.getElementById('datestamp').textContent =
        days[now.getDay()] + ' ' + months[now.getMonth()] + ' ' + now.getDate() +
        ', ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
    })();

    // Time-ago for each row
    function timeAgo(isoStr) {
      if (!isoStr) return '';
      var d = new Date(isoStr.replace(' ', 'T'));
      var secs = Math.floor((Date.now() - d.getTime()) / 1000);
      if (secs < 0) secs = 0;
      if (secs < 60) return secs + 's';
      var mins = Math.floor(secs / 60);
      if (mins < 60) return mins + 'm';
      var hrs = Math.floor(mins / 60);
      if (hrs < 24) return hrs + 'h';
      return Math.floor(hrs / 24) + 'd';
    }

    document.querySelectorAll('.time[data-ts]').forEach(function(el) {
      var ts = el.getAttribute('data-ts');
      el.textContent = ts ? '(' + timeAgo(ts) + ')' : '';
    });

    // Countdown + auto-refresh
    var secs = 60;
    var cdEl = document.getElementById('countdown');
    setInterval(function() {
      secs--;
      if (secs <= 0) { location.reload(); return; }
      if (cdEl) {
        cdEl.textContent = secs + 's';
        cdEl.className = 'countdown' + (secs <= 10 ? ' warn' : '');
      }
    }, 1000);
  </script>
</body>
</html>`;
}

function buildLandingHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Tend Board</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { background: #111111; min-height: 100vh; }
    body {
      background: #111111;
      color: #F5F2EB;
      font-family: 'IBM Plex Mono', 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.6;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      -webkit-font-smoothing: antialiased;
    }
    .card {
      max-width: 480px;
      width: 100%;
      background: #1a1a1a;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 32px;
    }
    h1 { font-size: 18px; font-weight: 700; letter-spacing: 0.04em; margin-bottom: 8px; color: #F5F2EB; }
    p { font-size: 12px; color: rgba(138,138,138,0.7); margin-bottom: 24px; line-height: 1.5; }
    label { display: block; font-size: 11px; color: rgba(138,138,138,0.6); margin-bottom: 6px; letter-spacing: 0.05em; }
    .input-row { display: flex; gap: 8px; }
    input {
      flex: 1;
      background: #111111;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 6px;
      color: #F5F2EB;
      font-family: inherit;
      font-size: 12px;
      padding: 8px 12px;
      outline: none;
    }
    input::placeholder { color: rgba(138,138,138,0.35); }
    input:focus { border-color: rgba(255,255,255,0.25); }
    button {
      background: #E8553D;
      border: none;
      border-radius: 6px;
      color: #F5F2EB;
      cursor: pointer;
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      padding: 8px 16px;
      white-space: nowrap;
    }
    button:hover { background: #d44a33; }
    .hint { font-size: 11px; color: rgba(138,138,138,0.4); margin-top: 14px; }
    .hint code { color: rgba(245,242,235,0.45); }
  </style>
</head>
<body>
  <div class="card">
    <h1>tend board</h1>
    <p>Enter your relay token to view your live agent board.</p>
    <label>RELAY TOKEN</label>
    <div class="input-row">
      <input id="token-input" type="text" placeholder="tnd_…" autocomplete="off" spellcheck="false">
      <button onclick="go()">View →</button>
    </div>
    <div class="hint">Get your token: <code>tend relay token</code></div>
  </div>
  <script>
    document.getElementById('token-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') go();
    });
    function go() {
      var t = document.getElementById('token-input').value.trim();
      if (!t) return;
      window.location.href = '/' + encodeURIComponent(t);
    }
    // Auto-fill from URL hash if present (e.g. tend.cx/#tnd_xxx)
    if (window.location.hash) {
      var t = window.location.hash.slice(1);
      if (t) { document.getElementById('token-input').value = t; }
    }
  </script>
</body>
</html>`;
}

function buildNotFoundHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Tend Board — Not Found</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { background: #111111; color: rgba(138,138,138,0.6); font-family: 'IBM Plex Mono','Courier New',monospace; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-size: 13px; padding: 24px; }
    .card { max-width: 400px; width: 100%; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 28px; }
    h1 { color: #E8553D; font-size: 15px; margin-bottom: 10px; }
    p { font-size: 12px; margin-bottom: 14px; line-height: 1.5; }
    a { color: rgba(245,242,235,0.5); }
  </style>
</head>
<body>
  <div class="card">
    <h1>Token not found</h1>
    <p>This relay token doesn't exist or hasn't been used yet.</p>
    <p><a href="/">← Back to tend board</a></p>
  </div>
</body>
</html>`;
}

async function handleBoardView(request: Request, db: D1Database, rawToken: string): Promise<Response> {
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);

  const tokenHash = await hashToken(rawToken);
  const tokenRow = await db.prepare('SELECT token_hash FROM tokens WHERE token_hash = ?')
    .bind(tokenHash)
    .first<{ token_hash: string }>();

  if (!tokenRow) {
    return htmlResponse(buildNotFoundHtml(), 404);
  }

  // Fetch latest state per project using a derived table join for efficiency
  const result = await db.prepare(`
    SELECT e.project, e.state, e.message, e.timestamp
    FROM events e
    INNER JOIN (
      SELECT project, MAX(id) AS max_id
      FROM events
      WHERE token_hash = ?
      GROUP BY project
    ) latest ON e.project = latest.project AND e.id = latest.max_id
    WHERE e.token_hash = ?
    ORDER BY e.project
  `).bind(tokenHash, tokenHash).all<ProjectRow>();

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const updatedAt = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  return htmlResponse(buildBoardHtml(result.results, updatedAt));
}

async function handleLandingPage(_request: Request): Promise<Response> {
  return htmlResponse(buildLandingHtml());
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
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
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

    // Landing page: GET /
    if (path === '/' && request.method === 'GET') {
      return handleLandingPage(request);
    }

    // Board view: GET /<token> (token starts with tnd_)
    if (request.method === 'GET' && /^\/tnd_[a-z0-9]+$/i.test(path)) {
      const rawToken = decodeURIComponent(path.slice(1));
      return handleBoardView(request, env.DB, rawToken);
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
