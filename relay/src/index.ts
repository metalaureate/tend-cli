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

function generateBoardToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const base62 = Array.from(bytes)
    .map(b => b.toString(36))
    .join('')
    .slice(0, 40);
  return `tnb_${base62}`;
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

// ── State Aggregation (same logic as CLI's aggregateState) ──

const STATE_PRIORITY: Record<string, number> = {
  stuck: 5,
  waiting: 4,
  working: 3,
  done: 2,
  idle: 0,
};

const STALE_THRESHOLD_SECONDS = 1800; // 30 minutes
const WAITING_INFERENCE_WINDOW_SECONDS = 600; // 10 minutes

interface EventRow {
  project: string;
  session_id: string | null;
  state: string;
  message: string;
  timestamp: string;
}

function toEpoch(ts: string): number {
  // Handle timestamps with or without timezone suffix
  let normalized = ts;
  if (!/[Z+\-]\d{0,4}$/.test(ts) && /^\d{4}-\d{2}-\d{2}T/.test(ts)) {
    normalized = ts + 'Z';
  }
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return 0;
  return Math.floor(d.getTime() / 1000);
}

function isStale(ts: string): boolean {
  return (Math.floor(Date.now() / 1000) - toEpoch(ts)) > STALE_THRESHOLD_SECONDS;
}

function userTagFromSessionId(sid: string): string {
  const atIdx = sid.indexOf('@');
  return atIdx >= 0 ? sid.slice(atIdx + 1) : '';
}

/** Aggregate raw events for a single project into a computed state (mirrors CLI logic) */
function aggregateProjectEvents(events: EventRow[]): ProjectRow | null {
  if (events.length === 0) return null;

  const sessions = new Map<string, { state: string; ts: string; message: string }>();
  const sessionWorkPending = new Map<string, boolean>();
  const sessionLastWorkingTs = new Map<string, string>();
  let lastTs = '';

  for (const evt of events) {
    const sessionId = evt.session_id || '_';
    lastTs = evt.timestamp;

    if (sessionId === '*') {
      sessions.clear();
      sessionWorkPending.clear();
      sessionLastWorkingTs.clear();
      sessions.set('_', { state: evt.state, ts: evt.timestamp, message: '' });
      continue;
    }

    if (sessionId.startsWith('*@')) {
      const userTag = userTagFromSessionId(sessionId.slice(1));
      for (const [sid] of sessions) {
        if (userTagFromSessionId(sid) === userTag || userTagFromSessionId(sid) === '') {
          sessions.delete(sid);
          sessionWorkPending.delete(sid);
          sessionLastWorkingTs.delete(sid);
        }
      }
      continue;
    }

    if (evt.state === 'working') {
      sessionWorkPending.set(sessionId, true);
      sessionLastWorkingTs.set(sessionId, evt.timestamp);
    } else if (evt.state === 'done') {
      sessionWorkPending.set(sessionId, false);
      sessionLastWorkingTs.delete(sessionId);
    }

    let effectiveState = evt.state;
    if (evt.state === 'idle' && sessionWorkPending.get(sessionId)) {
      const lastWorkingTs = sessionLastWorkingTs.get(sessionId);
      const recentEnough = lastWorkingTs
        ? (toEpoch(evt.timestamp) - toEpoch(lastWorkingTs)) <= WAITING_INFERENCE_WINDOW_SECONDS
        : false;
      if (recentEnough) {
        effectiveState = 'waiting';
      }
    }

    sessions.set(sessionId, { state: effectiveState, ts: evt.timestamp, message: evt.message });
  }

  if (sessions.size === 0) return null;

  // Demote stale working/waiting to idle
  for (const [id, sess] of sessions) {
    if ((sess.state === 'working' || sess.state === 'waiting') && isStale(sess.ts)) {
      sessions.set(id, { ...sess, state: 'idle' });
    }
  }

  // If any session is actively working, inferred waiting on other sessions
  // is noise — the user is clearly engaged with the project.
  const hasActiveWorking = [...sessions.values()].some(s => s.state === 'working');
  if (hasActiveWorking) {
    for (const [id, sess] of sessions) {
      if (sess.state === 'waiting') {
        sessions.set(id, { ...sess, state: 'idle' });
      }
    }
  }

  // Pick highest-priority state; among equal priorities prefer latest timestamp
  let bestState = '';
  let bestPriority = -1;
  let bestMessage = '';
  let bestTs = '';

  for (const [, sess] of sessions) {
    const p = STATE_PRIORITY[sess.state] ?? 0;
    if (p > bestPriority || (p === bestPriority && toEpoch(sess.ts) > toEpoch(bestTs))) {
      bestPriority = p;
      bestState = sess.state;
      bestMessage = sess.message;
      bestTs = sess.ts;
    }
  }

  if (!bestTs) bestTs = lastTs;
  if (!bestState) bestState = 'idle';

  return { project: events[0].project, state: bestState, message: bestMessage, timestamp: bestTs };
}

/** Fetch all events and aggregate per-project state (replaces naive MAX(id) query) */
async function aggregateProjectStates(db: D1Database, tokenHash: string): Promise<ProjectRow[]> {
  const result = await db.prepare(
    'SELECT project, session_id, state, message, timestamp FROM events WHERE token_hash = ? ORDER BY project, id ASC'
  ).bind(tokenHash).all<EventRow>();

  // Group by project
  const byProject = new Map<string, EventRow[]>();
  for (const row of result.results) {
    const arr = byProject.get(row.project) || [];
    arr.push(row);
    byProject.set(row.project, arr);
  }

  // Aggregate each project
  const rows: ProjectRow[] = [];
  for (const [, events] of byProject) {
    const aggregated = aggregateProjectEvents(events);
    if (aggregated) rows.push(aggregated);
  }

  return rows;
}

interface TodoRow {
  id: number;
  project: string;
  message: string;
  status: string;
  issue_url: string | null;
  created_at: string;
  updated_at: string;
}

/** Resolve a tnb_ board token to its parent tnd_ token_hash */
async function resolveBoardToken(boardToken: string, db: D1Database): Promise<string | null> {
  const boardHash = await hashToken(boardToken);
  const row = await db.prepare('SELECT token_hash FROM board_tokens WHERE board_token_hash = ?')
    .bind(boardHash)
    .first<{ token_hash: string }>();
  return row ? row.token_hash : null;
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

function buildBoardHtml(rows: ProjectRow[], updatedAt: string, todos: TodoRow[] = []): string {
  const rowsHtml = rows.map(r => {
    const icon = stateIcon(r.state);
    const cls = stateClass(r.state);
    const name = r.project.length > 19 ? r.project.slice(0, 18) + '…' : r.project;
    const fullName = r.project.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const msg = (r.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const isoTs = r.timestamp ? r.timestamp.replace(/"/g, '') : '';
    const tsAttr = isoTs ? `data-ts="${isoTs}"` : '';
    const timeEl = isoTs
      ? `<time class="time ${cls}" datetime="${isoTs}" ${tsAttr}></time>`
      : `<span class="time ${cls}"></span>`;
    return `<article class="row" data-project="${fullName}" data-state="${r.state}">
      <span class="icon ${cls}" aria-hidden="true">${icon}</span>
      <span class="name" title="${fullName}">${name}</span>
      <span class="state ${cls}">${r.state}</span>
      <span class="msg">${msg}</span>
      ${timeEl}
    </article>`;
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
    .titlebar-label { font-size: 11px; color: rgba(138,138,138,0.65); margin-left: 6px; }
    .statusbar {
      display: flex;
      justify-content: space-between;
      padding: 6px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      font-size: 11px;
      color: rgba(168,168,168,0.8);
    }
    .board { padding: 16px 14px 12px; }
    .board-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 14px;
      color: rgba(245,242,235,0.75);
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
      color: rgba(245,242,235,0.85);
      margin-left: 4px;
    }
    .state { width: 72px; flex-shrink: 0; font-size: 11px; }
    .msg {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: rgba(168,168,168,0.85);
    }
    .time { flex-shrink: 0; margin-left: 8px; font-size: 11px; color: rgba(168,168,168,0.6); }
    .footer {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid rgba(255,255,255,0.05);
      font-size: 11px;
      color: rgba(168,168,168,0.7);
    }
    .empty {
      color: rgba(168,168,168,0.7);
      font-size: 12px;
      padding: 8px 0;
    }
    .empty code { color: rgba(245,242,235,0.65); }
    /* State colours */
    .ember   { color: #E8553D; }
    .patina  { color: #2E9E6E; }
    .working { color: #20A890; }
    .idle    { color: rgba(168,168,168,0.65); }
    /* Countdown */
    .countdown { color: rgba(168,168,168,0.8); }
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
    <nav class="statusbar" aria-label="Board status">
      <span>tend board &nbsp;·&nbsp; updated <time id="updated-at">${updatedAt}</time> &nbsp;·&nbsp; next refresh in <span id="countdown" class="countdown">60s</span></span>
      <span>tend.cx</span>
    </nav>
    <main class="board" role="main">
      <header class="board-header">
        <span>TEND</span>
        <time id="datestamp"></time>
      </header>
      <section class="project-list" aria-label="Projects">
      ${emptyMsg}
      ${rowsHtml}
      </section>
      ${todos.length > 0 ? `
      <section class="backlog" aria-label="Backlog">
        <header class="board-header" style="margin-top:14px;margin-bottom:8px;">
          <span>BACKLOG</span>
          <span>${todos.length} item${todos.length === 1 ? '' : 's'}</span>
        </header>
        ${todos.map(t => {
          const statusCls = t.status === 'dispatched' ? 'working' : 'idle';
          const statusIcon = t.status === 'dispatched' ? '◐' : '○';
          const msg = (t.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const proj = t.project === '_global' ? '' : t.project;
          return `<article class="row">
            <span class="icon ${statusCls}" aria-hidden="true">${statusIcon}</span>
            <span class="name" title="${proj}">${proj}</span>
            <span class="state ${statusCls}">${t.status}</span>
            <span class="msg">${msg}</span>
          </article>`;
        }).join('\n')}
      </section>` : ''}
      <footer class="footer">${footerHtml}</footer>
    </main>
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

/** Resolve a raw token (tnd_ or tnb_) to the owning token_hash for board views */
async function resolveTokenForBoard(rawToken: string, db: D1Database): Promise<string | null> {
  if (rawToken.startsWith('tnb_')) {
    return resolveBoardToken(rawToken, db);
  }
  // tnd_ token: hash it and check if it exists
  const tokenHash = await hashToken(rawToken);
  const row = await db.prepare('SELECT token_hash FROM tokens WHERE token_hash = ?')
    .bind(tokenHash)
    .first<{ token_hash: string }>();
  return row ? row.token_hash : null;
}

async function handleBoardView(request: Request, db: D1Database, rawToken: string): Promise<Response> {
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);

  const tokenHash = await resolveTokenForBoard(rawToken, db);
  if (!tokenHash) {
    return htmlResponse(buildNotFoundHtml(), 404);
  }

  const rows = await aggregateProjectStates(db, tokenHash);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const updatedAt = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const todos = await fetchTodos(db, tokenHash);

  return htmlResponse(buildBoardHtml(rows, updatedAt, todos));
}

function buildLlmsTxt(rows: ProjectRow[], updatedAt: string, todos: TodoRow[] = []): string {
  const now = new Date();
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const pad = (n: number) => String(n).padStart(2, '0');
  const datestamp = `${days[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const stuckCount = rows.filter(r => r.state === 'stuck' || r.state === 'waiting').length;
  const doneCount = rows.filter(r => r.state === 'done').length;
  const workingCount = rows.filter(r => r.state === 'working').length;
  const idleCount = rows.filter(r => r.state === 'idle').length;

  let out = `# Tend Board\n`;
  out += `> Last updated: ${updatedAt} | ${datestamp}\n\n`;
  out += `## Summary\n`;
  out += `- Total projects: ${rows.length}\n`;
  if (stuckCount > 0) out += `- Needs attention: ${stuckCount}\n`;
  if (workingCount > 0) out += `- Working: ${workingCount}\n`;
  if (doneCount > 0) out += `- Done: ${doneCount}\n`;
  if (idleCount > 0) out += `- Idle: ${idleCount}\n`;
  out += `\n## Projects\n\n`;

  if (rows.length === 0) {
    out += `No events yet.\n`;
  } else {
    for (const r of rows) {
      out += `### ${r.project}\n`;
      out += `- State: ${r.state}\n`;
      if (r.message) out += `- Message: ${r.message}\n`;
      if (r.timestamp) out += `- Last event: ${r.timestamp}\n`;
      out += `\n`;
    }
  }

  if (todos.length > 0) {
    const pending = todos.filter(t => t.status === 'pending');
    const dispatched = todos.filter(t => t.status === 'dispatched');
    out += `## Backlog\n\n`;
    if (pending.length > 0) {
      out += `### Pending (${pending.length})\n`;
      for (const t of pending) {
        out += `- [#${t.id}] ${t.message}${t.project !== '_global' ? ` (${t.project})` : ''}\n`;
      }
      out += `\n`;
    }
    if (dispatched.length > 0) {
      out += `### Dispatched (${dispatched.length})\n`;
      for (const t of dispatched) {
        out += `- [#${t.id}] ${t.message}${t.issue_url ? ` → ${t.issue_url}` : ''}${t.project !== '_global' ? ` (${t.project})` : ''}\n`;
      }
      out += `\n`;
    }
  }

  return out;
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

async function handleLlmsTxt(request: Request, db: D1Database, rawToken: string): Promise<Response> {
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);

  const tokenHash = await resolveTokenForBoard(rawToken, db);
  if (!tokenHash) {
    return textResponse('# Tend Board\n\nToken not found.\n', 404);
  }

  const rows = await aggregateProjectStates(db, tokenHash);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const updatedAt = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const todos = await fetchTodos(db, tokenHash);

  return textResponse(buildLlmsTxt(rows, updatedAt, todos));
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

// ── Board Token Handlers ──

async function handleCreateBoardToken(request: Request, db: D1Database, tokenHash: string): Promise<Response> {
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);

  const boardToken = generateBoardToken();
  const boardTokenHash = await hashToken(boardToken);

  await db.prepare('INSERT INTO board_tokens (token_hash, board_token_hash) VALUES (?, ?)')
    .bind(tokenHash, boardTokenHash)
    .run();

  return jsonResponse({ board_token: boardToken }, 201);
}

async function handleDeleteBoardToken(request: Request, db: D1Database, tokenHash: string): Promise<Response> {
  if (request.method !== 'DELETE') return errorResponse('Method not allowed', 405);

  await db.prepare('DELETE FROM board_tokens WHERE token_hash = ?')
    .bind(tokenHash)
    .run();

  return jsonResponse({ ok: true });
}

// ── TODO Handlers ──

const VALID_TODO_STATUSES = ['pending', 'dispatched', 'done'] as const;

async function handleCreateTodo(request: Request, db: D1Database, tokenHash: string): Promise<Response> {
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const { project, message } = body as { project?: string; message?: string };

  if (!message || typeof message !== 'string') {
    return errorResponse('Missing or invalid "message"', 400);
  }

  const proj = project && typeof project === 'string' ? project : '_global';

  const result = await db.prepare(
    'INSERT INTO todos (token_hash, project, message) VALUES (?, ?, ?) RETURNING id, project, message, status, issue_url, created_at, updated_at'
  )
    .bind(tokenHash, proj, message)
    .first<TodoRow>();

  return jsonResponse(result, 201);
}

async function handleListTodos(request: Request, db: D1Database, tokenHash: string): Promise<Response> {
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const project = url.searchParams.get('project');

  let query = 'SELECT id, project, message, status, issue_url, created_at, updated_at FROM todos WHERE token_hash = ?';
  const params: unknown[] = [tokenHash];

  if (status) {
    if (!(VALID_TODO_STATUSES as readonly string[]).includes(status)) {
      return errorResponse(`Invalid "status". Must be one of: ${VALID_TODO_STATUSES.join(', ')}`, 400);
    }
    query += ' AND status = ?';
    params.push(status);
  }
  if (project) {
    query += ' AND project = ?';
    params.push(project);
  }

  query += ' ORDER BY id ASC';

  const result = await db.prepare(query).bind(...params).all<TodoRow>();
  return jsonResponse({ todos: result.results });
}

async function handleUpdateTodo(request: Request, db: D1Database, tokenHash: string, todoId: string): Promise<Response> {
  if (request.method !== 'PATCH') return errorResponse('Method not allowed', 405);

  const id = parseInt(todoId, 10);
  if (isNaN(id)) return errorResponse('Invalid todo ID', 400);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const { status, issue_url } = body as { status?: string; issue_url?: string };

  if (!status || typeof status !== 'string' || !(VALID_TODO_STATUSES as readonly string[]).includes(status)) {
    return errorResponse(`Invalid "status". Must be one of: ${VALID_TODO_STATUSES.join(', ')}`, 400);
  }

  // Fetch current todo to validate ownership and transition
  const existing = await db.prepare('SELECT status FROM todos WHERE id = ? AND token_hash = ?')
    .bind(id, tokenHash)
    .first<{ status: string }>();

  if (!existing) {
    return errorResponse('Todo not found', 404);
  }

  // Optimistic locking: validate state transitions
  const current = existing.status;
  const valid =
    (current === 'pending' && (status === 'dispatched' || status === 'done')) ||
    (current === 'dispatched' && status === 'done') ||
    status === 'done'; // any → done always allowed

  if (!valid) {
    return errorResponse(`Cannot transition from "${current}" to "${status}"`, 409);
  }

  const now = new Date().toISOString().slice(0, 19);

  if (issue_url && typeof issue_url === 'string') {
    await db.prepare('UPDATE todos SET status = ?, issue_url = ?, updated_at = ? WHERE id = ? AND token_hash = ?')
      .bind(status, issue_url, now, id, tokenHash)
      .run();
  } else {
    await db.prepare('UPDATE todos SET status = ?, updated_at = ? WHERE id = ? AND token_hash = ?')
      .bind(status, now, id, tokenHash)
      .run();
  }

  return jsonResponse({ ok: true, updated: { id, status } });
}

async function handleDeleteTodo(request: Request, db: D1Database, tokenHash: string, todoId: string): Promise<Response> {
  if (request.method !== 'DELETE') return errorResponse('Method not allowed', 405);

  const id = parseInt(todoId, 10);
  if (isNaN(id)) return errorResponse('Invalid todo ID', 400);

  const result = await db.prepare('DELETE FROM todos WHERE id = ? AND token_hash = ?')
    .bind(id, tokenHash)
    .run();

  if (result.meta.changes === 0) {
    return errorResponse('Todo not found', 404);
  }

  return jsonResponse({ ok: true });
}

/** Fetch pending/dispatched todos for a token (used by board views) */
async function fetchTodos(db: D1Database, tokenHash: string): Promise<TodoRow[]> {
  const result = await db.prepare(
    "SELECT id, project, message, status, issue_url, created_at, updated_at FROM todos WHERE token_hash = ? AND status IN ('pending', 'dispatched') ORDER BY id ASC"
  ).bind(tokenHash).all<TodoRow>();
  return result.results;
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
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        },
      });
    }

    // Landing page: GET /
    if (path === '/' && request.method === 'GET') {
      return handleLandingPage(request);
    }

    // Board view: GET /<token> (tnd_ or tnb_)
    if (request.method === 'GET' && /^\/(tnd|tnb)_[a-z0-9]+$/i.test(path)) {
      const rawToken = decodeURIComponent(path.slice(1));
      return handleBoardView(request, env.DB, rawToken);
    }

    // LLM-readable plain text: GET /<token>/llms.txt (tnd_ or tnb_)
    if (request.method === 'GET' && /^\/(tnd|tnb)_[a-z0-9]+\/llms\.txt$/i.test(path)) {
      const rawToken = decodeURIComponent(path.split('/')[1]);
      return handleLlmsTxt(request, env.DB, rawToken);
    }

    // Registration (no auth)
    if (path === '/v1/register') {
      const response = await handleRegister(request, env.DB);
      response.headers.set('Access-Control-Allow-Origin', '*');
      return response;
    }

    // All other /v1/* routes require auth (tnd_ Bearer token only)
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
    // Route: POST /v1/board-token
    else if (path === '/v1/board-token' && request.method === 'POST') {
      response = await handleCreateBoardToken(request, env.DB, tokenHash);
    }
    // Route: DELETE /v1/board-token
    else if (path === '/v1/board-token' && request.method === 'DELETE') {
      response = await handleDeleteBoardToken(request, env.DB, tokenHash);
    }
    // Route: POST /v1/todos
    else if (path === '/v1/todos' && request.method === 'POST') {
      response = await handleCreateTodo(request, env.DB, tokenHash);
    }
    // Route: GET /v1/todos
    else if (path === '/v1/todos' && request.method === 'GET') {
      response = await handleListTodos(request, env.DB, tokenHash);
    }
    // Route: PATCH /v1/todos/:id
    else if (/^\/v1\/todos\/\d+$/.test(path) && request.method === 'PATCH') {
      const todoId = path.slice('/v1/todos/'.length);
      response = await handleUpdateTodo(request, env.DB, tokenHash, todoId);
    }
    // Route: DELETE /v1/todos/:id
    else if (/^\/v1\/todos\/\d+$/.test(path) && request.method === 'DELETE') {
      const todoId = path.slice('/v1/todos/'.length);
      response = await handleDeleteTodo(request, env.DB, tokenHash, todoId);
    }
    else {
      response = errorResponse('Not found', 404);
    }

    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  },
};
