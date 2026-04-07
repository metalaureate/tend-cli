export interface Env {
  DB: D1Database;
  OPENROUTER_API_KEY?: string;
  TEND_AI_MODEL?: string;
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
const MIN_WORKING_DURATION_SECONDS = 60; // must work ≥60s before idle→waiting

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
      const gap = lastWorkingTs ? (toEpoch(evt.timestamp) - toEpoch(lastWorkingTs)) : Infinity;
      if (gap >= MIN_WORKING_DURATION_SECONDS && gap <= WAITING_INFERENCE_WINDOW_SECONDS) {
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

  // Demote orphan working/waiting sessions: if a user has a newer session
  // (any state), older working/waiting sessions are orphans.
  // A user can only actively work in one session at a time.
  const latestByUser = new Map<string, { ts: string; state: string }>();
  for (const [id, sess] of sessions) {
    const userTag = userTagFromSessionId(id);
    const existing = latestByUser.get(userTag);
    if (!existing || toEpoch(sess.ts) > toEpoch(existing.ts)) {
      latestByUser.set(userTag, { ts: sess.ts, state: sess.state });
    }
  }
  for (const [id, sess] of sessions) {
    if (sess.state !== 'working' && sess.state !== 'waiting') continue;
    const userTag = userTagFromSessionId(id);
    const latest = latestByUser.get(userTag);
    if (latest && toEpoch(latest.ts) > toEpoch(sess.ts)) {
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

  if (!bestState) bestState = 'idle';

  // Use lastTs (most recent event) for the display timestamp so the board always
  // shows when the project was last active, even if the winning state (e.g. "done")
  // came from an older session that beat a stale working session in priority.
  return { project: events[0].project, state: bestState, message: bestMessage, timestamp: lastTs };
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

  // Sort: needs-attention first, then by most recent event (newest first)
  const statePriority: Record<string, number> = { stuck: 0, waiting: 0, working: 1, done: 2, idle: 3 };
  rows.sort((a, b) => {
    const pa = statePriority[a.state] ?? 4;
    const pb = statePriority[b.state] ?? 4;
    if (pa !== pb) return pa - pb;
    // Within same priority, sort by timestamp descending
    return (b.timestamp || '').localeCompare(a.timestamp || '');
  });

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

function buildBoardHtml(rows: ProjectRow[], updatedAt: string, todos: TodoRow[] = [], insights: InsightRow[] = [], rawToken: string = '', isWritable: boolean = false): string {
  const insightsByProject = new Map(insights.map(i => [i.project, i]));
  const rowsHtml = rows.map(r => {
    const insight = insightsByProject.get(r.project);
    // Never let stale LLM insight override idle, waiting, or done — these are definitive heuristic signals
    const effectiveState = (insight?.inferred_state && VALID_INSIGHT_STATES.has(insight.inferred_state) && r.state !== 'idle' && r.state !== 'waiting' && r.state !== 'done') ? insight.inferred_state : r.state;
    const icon = stateIcon(effectiveState);
    const cls = stateClass(effectiveState);
    const name = r.project.length > 19 ? r.project.slice(0, 18) + '…' : r.project;
    const fullName = r.project.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const msg = (r.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const isoTs = r.timestamp ? r.timestamp.replace(/"/g, '') : '';
    const tsAttr = isoTs ? `data-ts="${isoTs}"` : '';
    const timeEl = isoTs
      ? `<time class="time ${cls}" datetime="${isoTs}" ${tsAttr}></time>`
      : `<span class="time ${cls}"></span>`;
    const displayMsg = insight
      ? `<span class="msg msg-insight">${(insight.summary + ' → ' + insight.prediction).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`
      : `<span class="msg">${msg}</span>`;
    return `<article class="row" data-project="${fullName}" data-state="${effectiveState}">
      <span class="icon ${cls}" aria-hidden="true">${icon}</span>
      <span class="name" title="${fullName}">${name}</span>
      <span class="state ${cls}">${effectiveState}</span>
      ${displayMsg}
      ${timeEl}
    </article>`;
  }).join('\n');

  const projectNames = rows.map(r => r.project);

  // Compute effective states (insight-overridden) for footer counts
  const effectiveStates = rows.map(r => {
    const insight = insightsByProject.get(r.project);
    return (insight?.inferred_state && VALID_INSIGHT_STATES.has(insight.inferred_state) && r.state !== 'idle' && r.state !== 'waiting' && r.state !== 'done') ? insight.inferred_state : r.state;
  });
  const stuckCount = effectiveStates.filter(s => s === 'stuck' || s === 'waiting').length;
  const doneCount = effectiveStates.filter(s => s === 'done').length;
  const workingCount = effectiveStates.filter(s => s === 'working').length;
  const idleCount = effectiveStates.filter(s => s === 'idle').length;

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
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='%23111' stroke='%23F5F2EB' stroke-width='2'/%3E%3Ccircle cx='16' cy='16' r='5' fill='%2320A890'/%3E%3C/svg%3E">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { background: #111111; min-height: 100vh; }
    body {
      background: #111111;
      color: #F5F2EB;
      font-family: 'IBM Plex Mono', 'Courier New', monospace;
      font-size: 18px;
      line-height: 1.6;
      padding: 32px 24px;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    .terminal {
      max-width: 100%;
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
    .titlebar-label { font-size: 14px; color: rgba(138,138,138,0.65); margin-left: 6px; }
    .statusbar {
      display: flex;
      justify-content: space-between;
      padding: 10px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      font-size: 14px;
      color: rgba(168,168,168,0.8);
    }
    .board { padding: 20px 20px 16px; }
    .board-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 14px;
      color: rgba(245,242,235,0.75);
      font-weight: 600;
      letter-spacing: 0.08em;
      font-size: 14px;
    }
    .row {
      display: flex;
      align-items: baseline;
      margin-bottom: 8px;
      font-size: 16px;
    }
    .icon { width: 20px; flex-shrink: 0; }
    .name {
      width: 220px;
      flex-shrink: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: rgba(245,242,235,0.85);
      margin-left: 4px;
    }
    .state { width: 90px; flex-shrink: 0; }
    .msg {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: rgba(168,168,168,0.85);
    }
    .time { flex-shrink: 0; margin-left: 8px; color: rgba(168,168,168,0.6); }
    .msg-insight {
      color: rgba(217,158,78,0.9);
    }
    .footer {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid rgba(255,255,255,0.05);
      font-size: 14px;
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
    /* TODO CRUD */
    .todo-actions { display: inline-flex; gap: 4px; margin-left: 8px; opacity: 0; transition: opacity 0.15s; }
    .row:hover .todo-actions, .row:focus-within .todo-actions { opacity: 1; }
    .todo-btn {
      background: none; border: 1px solid rgba(255,255,255,0.15); color: rgba(168,168,168,0.8);
      font-family: inherit; font-size: 11px; padding: 1px 6px; border-radius: 4px; cursor: pointer;
    }
    .todo-btn:hover { border-color: rgba(255,255,255,0.35); color: #F5F2EB; }
    .todo-btn.del:hover { border-color: #E8553D; color: #E8553D; }
    .todo-add-form {
      display: none; gap: 8px; margin-top: 8px; align-items: center;
    }
    .todo-add-form.visible { display: flex; }
    .todo-add-btn {
      background: none; border: 1px solid rgba(255,255,255,0.12); color: rgba(168,168,168,0.5);
      font-family: inherit; font-size: 12px; padding: 2px 8px; border-radius: 4px;
      cursor: pointer; margin-top: 8px;
    }
    .todo-add-btn:hover { border-color: rgba(255,255,255,0.3); color: #F5F2EB; }
    .todo-select {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
      color: rgba(168,168,168,0.8); font-family: inherit; font-size: 13px;
      padding: 4px 6px; border-radius: 4px; outline: none; max-width: 160px;
    }
    .todo-select:focus { border-color: rgba(255,255,255,0.3); }
    .todo-select option { background: #1a1a1a; color: #F5F2EB; }
    .todo-input {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
      color: #F5F2EB; font-family: inherit; font-size: 14px; padding: 4px 8px;
      border-radius: 4px; flex: 1; outline: none;
    }
    .todo-input:focus { border-color: rgba(255,255,255,0.3); }
    .todo-input::placeholder { color: rgba(168,168,168,0.4); }
    .todo-edit-input {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2);
      color: #F5F2EB; font-family: inherit; font-size: 14px; padding: 2px 6px;
      border-radius: 4px; flex: 1; outline: none;
    }
    .todo-edit-input:focus { border-color: #20A890; }
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
      <span>tend board &nbsp;·&nbsp; updated <time id="updated-at"></time> &nbsp;·&nbsp; next refresh in <span id="countdown" class="countdown">60s</span></span>
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
      ${todos.length > 0 || isWritable ? `
      <section class="backlog" aria-label="Backlog" id="backlog-section">
        <header class="board-header" style="margin-top:14px;margin-bottom:8px;">
          <span>BACKLOG</span>
          <span id="todo-count">${todos.length} item${todos.length === 1 ? '' : 's'}</span>
        </header>
        ${todos.map(t => {
          const statusCls = t.status === 'dispatched' ? 'working' : 'idle';
          const statusIcon = t.status === 'dispatched' ? '◐' : '○';
          const msg = (t.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const proj = t.project === '_global' ? '' : t.project;
          const actions = isWritable ? `<span class="todo-actions">
            <button class="todo-btn" onclick="editTodo(${t.id}, this)" title="Edit">✎</button>
            <button class="todo-btn del" onclick="deleteTodo(${t.id})" title="Delete">✕</button>
          </span>` : '';
          return `<article class="row" data-todo-id="${t.id}">
            <span class="icon ${statusCls}" aria-hidden="true">${statusIcon}</span>
            <span class="name" title="${proj}">${proj}</span>
            <span class="state ${statusCls}">${t.status}</span>
            <span class="msg">${msg}</span>
            ${actions}
          </article>`;
        }).join('\n')}
        ${isWritable ? `<button class="todo-add-btn" onclick="toggleAddForm()" id="todo-add-toggle">+ add</button>
        <form class="todo-add-form" id="todo-add-form" onsubmit="addTodo(event)">
          <select class="todo-select" name="project">
            <option value="_global">(global)</option>
            ${projectNames.map(p => `<option value="${p.replace(/"/g, '&quot;')}">${p.replace(/</g, '&lt;')}</option>`).join('')}
          </select>
          <input class="todo-input" type="text" name="message" placeholder="todo..." autocomplete="off" />
          <button class="todo-btn" type="submit">+</button>
        </form>` : ''}
      </section>` : ''}
      <footer class="footer">${footerHtml}</footer>
    </main>
  </div>
  <script>
    // Datestamp + updated-at (local time)
    (function() {
      var now = new Date();
      var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var pad = function(n) { return String(n).padStart(2,'0'); };
      document.getElementById('datestamp').textContent =
        days[now.getDay()] + ' ' + months[now.getMonth()] + ' ' + now.getDate() +
        ', ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
      document.getElementById('updated-at').textContent =
        pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    })();

    // Time-ago for each row
    function timeAgo(isoStr) {
      if (!isoStr) return '';
      var s = isoStr.replace(' ', 'T');
      if (!/[Z+\-]\d{0,4}$/.test(s)) s += 'Z';
      var d = new Date(s);
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

    // TODO CRUD (only active when token is writable)
    var TOKEN = '${rawToken}';
    var IS_WRITABLE = ${isWritable ? 'true' : 'false'};
    var API_BASE = location.origin;

    function todoApi(method, path, body) {
      var opts = {
        method: method,
        headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }
      };
      if (body) opts.body = JSON.stringify(body);
      return fetch(API_BASE + path, opts);
    }

    function toggleAddForm() {
      var form = document.getElementById('todo-add-form');
      var btn = document.getElementById('todo-add-toggle');
      if (form.classList.contains('visible')) {
        form.classList.remove('visible');
        btn.style.display = '';
      } else {
        form.classList.add('visible');
        btn.style.display = 'none';
        form.querySelector('input[name="message"]').focus();
      }
    }

    function addTodo(e) {
      e.preventDefault();
      if (!IS_WRITABLE) return;
      var input = e.target.querySelector('input[name="message"]');
      var select = e.target.querySelector('select[name="project"]');
      var msg = input.value.trim();
      if (!msg) return;
      var proj = select.value;
      input.disabled = true;
      var body = { message: msg };
      if (proj && proj !== '_global') body.project = proj;
      todoApi('POST', '/v1/todos', body).then(function(r) {
        if (r.ok) location.reload();
        else { input.disabled = false; input.focus(); }
      }).catch(function() { input.disabled = false; });
    }

    function deleteTodo(id) {
      if (!IS_WRITABLE) return;
      todoApi('DELETE', '/v1/todos/' + id).then(function(r) {
        if (r.ok) {
          var el = document.querySelector('[data-todo-id="' + id + '"]');
          if (el) el.remove();
          updateTodoCount();
        }
      });
    }

    function editTodo(id, btn) {
      if (!IS_WRITABLE) return;
      var row = btn.closest('.row');
      var msgEl = row.querySelector('.msg');
      var oldText = msgEl.textContent;
      var input = document.createElement('input');
      input.type = 'text';
      input.value = oldText;
      input.className = 'todo-edit-input';
      msgEl.replaceWith(input);
      input.focus();
      input.select();

      function save() {
        var newText = input.value.trim();
        if (!newText || newText === oldText) {
          var span = document.createElement('span');
          span.className = 'msg';
          span.textContent = oldText;
          input.replaceWith(span);
          return;
        }
        // Delete old + create new (no PATCH message endpoint)
        todoApi('DELETE', '/v1/todos/' + id).then(function(r) {
          if (r.ok) return todoApi('POST', '/v1/todos', { message: newText });
        }).then(function(r) {
          if (r && r.ok) location.reload();
        });
      }

      input.addEventListener('keydown', function(ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); save(); }
        if (ev.key === 'Escape') {
          var span = document.createElement('span');
          span.className = 'msg';
          span.textContent = oldText;
          input.replaceWith(span);
        }
      });
      input.addEventListener('blur', save);
    }

    function updateTodoCount() {
      var countEl = document.getElementById('todo-count');
      if (!countEl) return;
      var rows = document.querySelectorAll('[data-todo-id]');
      countEl.textContent = rows.length + ' item' + (rows.length === 1 ? '' : 's');
    }
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
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='%23111' stroke='%23F5F2EB' stroke-width='2'/%3E%3Ccircle cx='16' cy='16' r='5' fill='%2320A890'/%3E%3C/svg%3E">
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
  const insights = await fetchInsights(db, tokenHash);

    const isWritable = rawToken.startsWith('tnd_');
  return htmlResponse(buildBoardHtml(rows, updatedAt, todos, insights, rawToken, isWritable));
}

function buildLlmsTxt(rows: ProjectRow[], updatedAt: string, todos: TodoRow[] = [], insights: InsightRow[] = []): string {
  const insightsByProject = new Map(insights.map(i => [i.project, i]));
  const effectiveState = (r: ProjectRow) => {
    const ins = insightsByProject.get(r.project);
    return (ins?.inferred_state && VALID_INSIGHT_STATES.has(ins.inferred_state) && r.state !== 'idle' && r.state !== 'waiting' && r.state !== 'done') ? ins.inferred_state : r.state;
  };
  const now = new Date();
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const pad = (n: number) => String(n).padStart(2, '0');
  const datestamp = `${days[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const stuckCount = rows.filter(r => { const s = effectiveState(r); return s === 'stuck' || s === 'waiting'; }).length;
  const doneCount = rows.filter(r => effectiveState(r) === 'done').length;
  const workingCount = rows.filter(r => effectiveState(r) === 'working').length;
  const idleCount = rows.filter(r => effectiveState(r) === 'idle').length;

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
      out += `- State: ${effectiveState(r)}\n`;
      if (r.message) out += `- Message: ${r.message}\n`;
      if (r.timestamp) out += `- Last event: ${r.timestamp}\n`;
      const ins = insightsByProject.get(r.project);
      if (ins) {
        out += `- Insight: ${ins.summary}\n`;
        out += `- Next: ${ins.prediction}\n`;
      }
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
  const insights = await fetchInsights(db, tokenHash);

  return textResponse(buildLlmsTxt(rows, updatedAt, todos, insights));
}

async function handleLandingPage(_request: Request): Promise<Response> {
  return htmlResponse(buildLandingHtml());
}

// ── LLM Insights ──

interface InsightRow {
  project: string;
  summary: string;
  prediction: string;
  inferred_state: string;
  input_hash: string;
  updated_at: string;
}

const INSIGHT_CONFIDENCE_THRESHOLD = 40;

const INSIGHT_SYSTEM_PROMPT =
  'You write ultra-short status lines for a developer dashboard.' +
  ' Given a project\'s event log and TODOs, output EXACTLY four lines:\n' +
  'Line 1: What\'s happening RIGHT NOW based on recent events. ≤30 chars. Telegram style.\n' +
  'Line 2: Predicted next step — infer from the TRAJECTORY of recent work, not the TODO list.' +
  ' TODOs are a backlog, not a plan.' +
  ' If latest event is "done", the described work (including commit/push) is ALREADY COMPLETE — predict what comes AFTER.' +
  ' ≤30 chars. Start with verb. Telegram style.\n' +
  'Line 3: The project state — EXACTLY one of: working, done, stuck, waiting, idle\n' +
  'Line 4: Confidence (0–100) that Line 2 is a meaningful, non-obvious inference.' +
  ' Score LOW (<40) if Line 2 simply restates a recent "working" message, echoes a TODO verbatim, or is generic.' +
  ' Score HIGH (>70) only when the trajectory makes the next step clearly predictable.\n' +
  'IMPORTANT: "working" messages are raw user prompts captured by editor hooks — they are NOT task descriptions.' +
  ' Ignore their literal text. Focus on "done" messages and the overall pattern of work/idle cycles to understand what actually happened.\n' +
  'CLOSURE DETECTION — this is the key concept for state inference:\n' +
  '- "done" is an explicit CLOSURE signal. It means the task was completed.\n' +
  '- "working → idle" WITHOUT a "done" = NO CLOSURE. Work was interrupted or abandoned. This is WAITING.\n' +
  '- "working → done → quiet" = closure happened. State is done.\n' +
  'State definitions:\n' +
  '- working: agent actively producing output RIGHT NOW (last working event < 5 min ago)\n' +
  '- done: most recent session ended with an explicit "done" event. Task completed, committed, shipped.\n' +
  '- stuck: explicit "stuck" event, or evidence of repeated failures/blocks\n' +
  '- waiting: agent was working but stopped WITHOUT "done" — no closure. Unfinished work exists. Last activity < 24h ago.\n' +
  '- idle: fallback — either waiting decayed (> 24h without activity), or genuinely nothing pending, or state is unclear.\n' +
  'Time matters: check the "(Xm ago)" annotations. A "waiting" project that has been quiet for days should be idle, not waiting.\n' +
  'No labels, prefixes, bullets. Examples:\n' +
  '3rd pass at auth, was stuck\nrun tests, open PR\nworking\n85\n\n' +
  'auth module shipped, tests pass\npick next backlog item\ndone\n75\n\n' +
  'started refactor, no commit yet\nresume refactor, commit\nwaiting\n60\n\n' +
  'idle 2d, dirty worktree\ncommit WIP or stash\nidle\n50';

const MAX_INSIGHT_EVENTS = 25;

async function computeInputHash(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

const VALID_INSIGHT_STATES = new Set(['working', 'done', 'stuck', 'waiting', 'idle']);

export function parseInsightResponse(text: string): { summary: string; prediction: string; inferred_state: string } | null {
  const lines = text
    .split('\n')
    .map(l => l.replace(/^\d+[.:)\-]\s*/, '').trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  // Line 3 is the state — validate it, default to empty if invalid
  const rawState = (lines[2] || '').toLowerCase().trim();
  const inferred_state = VALID_INSIGHT_STATES.has(rawState) ? rawState : '';
  // Line 4 is confidence (0-100). Gate low-confidence predictions.
  const rawConfidence = parseInt(lines[3] || '', 10);
  const confidence = Number.isFinite(rawConfidence) ? rawConfidence : 0;
  const prediction = confidence >= INSIGHT_CONFIDENCE_THRESHOLD
    ? lines[1].slice(0, 36)
    : "what's next?";
  return {
    summary: lines[0].slice(0, 36),
    prediction,
    inferred_state,
  };
}

async function recomputeInsight(
  db: D1Database,
  tokenHash: string,
  project: string,
  apiKey: string,
  model: string,
): Promise<void> {
  // Fetch last N events for this project
  const eventsResult = await db.prepare(
    'SELECT timestamp, session_id, state, message FROM events WHERE token_hash = ? AND project = ? ORDER BY id DESC LIMIT ?'
  ).bind(tokenHash, project, MAX_INSIGHT_EVENTS).all<EventRow>();

  if (!eventsResult.results || eventsResult.results.length === 0) return;

  // Reverse to chronological order
  const events = eventsResult.results.reverse();

  // Fetch pending TODOs for this project
  const todosResult = await db.prepare(
    "SELECT message FROM todos WHERE token_hash = ? AND (project = ? OR project = '_global') AND status IN ('pending', 'dispatched') ORDER BY id ASC"
  ).bind(tokenHash, project).all<{ message: string }>();
  const todosBlock = (todosResult.results || []).map(t => `- ${t.message}`).join('\n');

  // Fetch project context (README etc.) if available
  const ctxRow = await db.prepare(
    'SELECT content FROM project_context WHERE token_hash = ? AND project = ?'
  ).bind(tokenHash, project).first<{ content: string }>();
  const contextBlock = ctxRow?.content?.slice(0, 2000) || '';

  // Build input for hash check
  const inputKey = events.map(e => `${e.timestamp}${e.state}${e.message}`).join('') + todosBlock + contextBlock;
  const hash = await computeInputHash(inputKey);

  // Remember the latest event ID at the time we started — used to detect stale results
  const latestAtStart = await db.prepare(
    'SELECT MAX(id) as max_id FROM events WHERE token_hash = ? AND project = ?'
  ).bind(tokenHash, project).first<{ max_id: number }>();
  const startMaxId = latestAtStart?.max_id || 0;

  // Check if we already have a fresh insight with same hash
  const existing = await db.prepare(
    'SELECT input_hash FROM insights WHERE token_hash = ? AND project = ?'
  ).bind(tokenHash, project).first<{ input_hash: string }>();

  if (existing && existing.input_hash === hash) return; // No change

  // Build prompt
  const last = events[events.length - 1];
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString().slice(0, 19);

  function relAge(ts: string): string {
    const diff = nowMs - new Date(ts + 'Z').getTime();
    if (diff < 0) return '';
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  const eventsBlock = events
    .map(e => `${e.timestamp} (${relAge(e.timestamp)}) [${e.session_id || '_'}] ${e.state}${e.message ? ' ' + e.message : ''}`)
    .join('\n');

  let userPrompt = `Project: ${project}\nCurrent time: ${nowIso}\nCurrent state: ${last.state} (${relAge(last.timestamp)})`;
  if (last.message) userPrompt += `\nLatest message: ${last.message}`;
  if (contextBlock) userPrompt += `\n\nProject README (truncated):\n${contextBlock}`;
  userPrompt += `\n\nRecent events (oldest → newest):\n${eventsBlock}`;
  if (todosBlock) userPrompt += `\n\nTODO list:\n${todosBlock}`;

  // Call OpenRouter
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://tend.cx',
        'X-Title': 'tend-relay',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: INSIGHT_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 100,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return;

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return;

    const parsed = parseInsightResponse(text);
    if (!parsed) return;

    // Staleness check: if new events arrived while the LLM was thinking,
    // this result is based on outdated data — the newer event's recompute will handle it.
    const latestNow = await db.prepare(
      'SELECT MAX(id) as max_id FROM events WHERE token_hash = ? AND project = ?'
    ).bind(tokenHash, project).first<{ max_id: number }>();
    if ((latestNow?.max_id || 0) > startMaxId) return;

    const now = new Date().toISOString().slice(0, 19);
    await db.prepare(
      `INSERT INTO insights (token_hash, project, summary, prediction, inferred_state, input_hash, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(token_hash, project) DO UPDATE SET
         summary = excluded.summary,
         prediction = excluded.prediction,
         inferred_state = excluded.inferred_state,
         input_hash = excluded.input_hash,
         updated_at = excluded.updated_at`
    ).bind(tokenHash, project, parsed.summary, parsed.prediction, parsed.inferred_state, hash, now).run();

    // Append to insight log (activity history)
    await db.prepare(
      'INSERT INTO insight_log (token_hash, project, summary, prediction, inferred_state, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(tokenHash, project, parsed.summary, parsed.prediction, parsed.inferred_state, now).run();
  } catch {
    // Timeout or network error — silently skip
  }
}

/** Fetch cached insights for all projects under a token */
async function fetchInsights(db: D1Database, tokenHash: string): Promise<InsightRow[]> {
  const result = await db.prepare(
    'SELECT project, summary, prediction, inferred_state, input_hash, updated_at FROM insights WHERE token_hash = ?'
  ).bind(tokenHash).all<InsightRow>();
  return result.results || [];
}

/** Fetch cached insight for a single project */
async function fetchProjectInsight(db: D1Database, tokenHash: string, project: string): Promise<InsightRow | null> {
  return db.prepare(
    'SELECT project, summary, prediction, inferred_state, input_hash, updated_at FROM insights WHERE token_hash = ? AND project = ?'
  ).bind(tokenHash, project).first<InsightRow>();
}

async function handleGetInsights(request: Request, db: D1Database, tokenHash: string): Promise<Response> {
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);
  const insights = await fetchInsights(db, tokenHash);
  return jsonResponse({ insights });
}

const MAX_INSIGHT_HISTORY = 100;

async function handleGetInsightHistory(request: Request, db: D1Database, tokenHash: string, project: string): Promise<Response> {
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, MAX_INSIGHT_HISTORY);

  const result = await db.prepare(
    'SELECT project, summary, prediction, inferred_state, created_at FROM insight_log WHERE token_hash = ? AND project = ? ORDER BY id DESC LIMIT ?'
  ).bind(tokenHash, project, limit).all<{ project: string; summary: string; prediction: string; inferred_state: string; created_at: string }>();

  return jsonResponse({ project, history: result.results || [] });
}

const MAX_CONTEXT_LENGTH = 8000;

async function handlePutProjectContext(request: Request, db: D1Database, tokenHash: string, project: string): Promise<Response> {
  if (request.method !== 'PUT') return errorResponse('Method not allowed', 405);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const content = typeof body.content === 'string' ? body.content.slice(0, MAX_CONTEXT_LENGTH) : '';
  if (!content) return errorResponse('Missing or empty "content"', 400);

  const data = new TextEncoder().encode(content);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);

  // Skip if content hasn't changed
  const existing = await db.prepare(
    'SELECT content_hash FROM project_context WHERE token_hash = ? AND project = ?'
  ).bind(tokenHash, project).first<{ content_hash: string }>();

  if (existing?.content_hash === hash) {
    return jsonResponse({ ok: true, changed: false });
  }

  const now = new Date().toISOString().slice(0, 19);
  await db.prepare(
    `INSERT INTO project_context (token_hash, project, content, content_hash, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(token_hash, project) DO UPDATE SET
       content = excluded.content,
       content_hash = excluded.content_hash,
       updated_at = excluded.updated_at`
  ).bind(tokenHash, project, content, hash, now).run();

  // Invalidate insight cache so next event triggers a re-compute with new context
  await db.prepare(
    "UPDATE insights SET input_hash = '' WHERE token_hash = ? AND project = ?"
  ).bind(tokenHash, project).run();

  return jsonResponse({ ok: true, changed: true });
}

async function handleGetProjectInsight(request: Request, db: D1Database, tokenHash: string, project: string): Promise<Response> {
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);
  const insight = await fetchProjectInsight(db, tokenHash, project);
  if (!insight) return jsonResponse({ insight: null });
  return jsonResponse({ insight });
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

async function handleEmitEvent(request: Request, db: D1Database, tokenHash: string, ctx: ExecutionContext, env: Env): Promise<Response> {
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

  // Asynchronously recompute LLM insight after responding
  const apiKey = env.OPENROUTER_API_KEY;
  if (apiKey) {
    const model = env.TEND_AI_MODEL || 'google/gemini-2.0-flash-001';
    ctx.waitUntil(recomputeInsight(db, tokenHash, project, apiKey, model));
  }

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
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
      response = await handleEmitEvent(request, env.DB, tokenHash, ctx, env);
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
    // Route: PUT /v1/projects/:project/context
    else if (path.startsWith('/v1/projects/') && path.endsWith('/context') && request.method === 'PUT') {
      const project = decodeURIComponent(path.slice('/v1/projects/'.length, path.length - '/context'.length));
      response = project
        ? await handlePutProjectContext(request, env.DB, tokenHash, project)
        : errorResponse('Missing project name', 400);
    }
    // Route: GET /v1/insights
    else if (path === '/v1/insights' && request.method === 'GET') {
      response = await handleGetInsights(request, env.DB, tokenHash);
    }
    // Route: GET /v1/insights/:project/history
    else if (path.match(/^\/v1\/insights\/(.+)\/history$/) && request.method === 'GET') {
      const project = decodeURIComponent(path.slice('/v1/insights/'.length, path.length - '/history'.length));
      response = project
        ? await handleGetInsightHistory(request, env.DB, tokenHash, project)
        : errorResponse('Missing project name', 400);
    }
    // Route: GET /v1/insights/:project
    else if (path.startsWith('/v1/insights/') && request.method === 'GET') {
      const project = decodeURIComponent(path.slice('/v1/insights/'.length));
      response = project
        ? await handleGetProjectInsight(request, env.DB, tokenHash, project)
        : errorResponse('Missing project name', 400);
    }
    else {
      response = errorResponse('Not found', 404);
    }

    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  },
};
