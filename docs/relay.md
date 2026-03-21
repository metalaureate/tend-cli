# Tend Relay

**A lightweight event relay for remote AI agents.**

Local agents write to `.tend/events` directly — no network, no accounts, plain text. But agents increasingly run elsewhere: Codex in the cloud, CI pipelines, SSH sessions, remote worktrees. Without a common protocol, the developer is back to maintaining per-environment solutions.

The relay solves this. The agent's instructions don't change. The developer sets a token on the remote environment and the CLI handles the rest.

---

## How It Works

```
Remote agent → tend emit working "building auth scaffold"
  → CLI detects TEND_RELAY_TOKEN
  → HTTP POST relay.tend.dev/v1/events
  → D1 insert

Local developer → tend
  → reads local .tend/events per project
  → pulls relay events from relay.tend.dev
  → merges & renders the departures board
```

The command is always the same:

```bash
tend emit working "building auth scaffold"
```

On a local machine, that writes to `.tend/events`. On a remote machine with `TEND_RELAY_TOKEN` set, the CLI posts to `relay.tend.dev` instead. The departures board, shell prompt, and every other command work identically regardless of where the events came from.

The relay is a single hosted Cloudflare Worker that we deploy and run. Users never run a server, worker, or any HTTP infrastructure. They interact with `tend` the same way they always have — the relay is invisible plumbing.

---

## User Flow

```bash
# On your laptop — one-time setup
tend relay setup
# → Gets a token from relay.tend.dev
# → Stores it in ~/.tend/relay_token
# → Prints the token for you to copy

# On the remote environment — set the token
export TEND_RELAY_TOKEN="tnd_abc123..."

# Remote agent uses tend normally
tend emit working "building auth scaffold"
tend emit done "auth scaffold complete (PR #204)"

# Back on your laptop — events appear on the board
tend
#   TEND                               Fri Mar 14, 14:32
#
#   ◐ my-app               working    building auth scaffold (3m)  ↗
#   ○ other-project         idle       update deps (2h ago)
```

No accounts. No passwords. No signup. Just a token.

---

## Architecture

### Deployment

- **`relay/`** in the monorepo — a Cloudflare Worker (TypeScript) backed by D1 (SQLite)
- Deployed to `relay.tend.dev` (initially `*.workers.dev`)
- All tend users share the same hosted relay
- The `relay/` project is our deployment artifact, not something users install

### Token Model

- `tend relay setup` calls `POST /v1/register` — the relay generates a crypto-random token and returns it
- CLI stores the token in `~/.tend/relay_token`
- Developer copies the same token to remote environments as `TEND_RELAY_TOKEN`
- All API calls use `Authorization: Bearer <token>`
- Relay stores only the SHA-256 hash of the token — the plaintext is never persisted server-side

### Performance

- `tend status` (shell prompt indicator) reads from `~/.tend/relay_cache/`, never hits the network — stays under 100ms
- `tend` (departures board) refreshes the relay cache on each invocation, then renders from cache
- No daemon. No background sync. Consistent with tend's "no persistent process" principle.

---

## API

All routes are prefixed with `/v1`.

### `POST /v1/register`

Generate a new token. Rate-limited by IP.

**Response** `201`:
```json
{ "token": "tnd_abc123..." }
```

### `POST /v1/events`

Emit an event. Requires auth.

**Body**:
```json
{
  "project": "my-app",
  "state": "working",
  "message": "building auth scaffold",
  "timestamp": "2026-03-14T14:20:00",
  "session_id": "sess_abc"
}
```

`timestamp` and `session_id` are optional. If `timestamp` is omitted, the server uses the current time.

**Validation**: `state` must be one of `working`, `done`, `stuck`, `waiting`, `idle`.

**Response** `201`:
```json
{ "ok": true }
```

### `GET /v1/events/:project`

Fetch events for a project. Requires auth.

**Query params**:
- `since` — ISO-8601 timestamp, return only events after this time
- `limit` — max events to return (default 100)

**Response** `200`:
```json
{
  "events": [
    {
      "timestamp": "2026-03-14T14:20:00",
      "session_id": "sess_abc",
      "state": "working",
      "message": "building auth scaffold"
    }
  ]
}
```

### `GET /v1/projects`

List projects with events for this token. Requires auth.

**Response** `200`:
```json
{
  "projects": ["my-app", "api-server"]
}
```

### Auth

All routes except `POST /v1/register` require:
```
Authorization: Bearer <token>
```

Invalid or missing token returns `401`.

### Board Token: `POST /v1/board-token`

Generate a read-only board token. Requires auth.

**Response** `201`:
```json
{ "board_token": "tnb_xyz789..." }
```

Board tokens (`tnb_` prefix) can only be used for:
- `GET /<tnb_token>` — view the HTML board
- `GET /<tnb_token>/llms.txt` — view the LLM-readable board

They cannot be used as Bearer tokens for any `/v1/*` endpoint. This makes them safe to share with teammates.

### Board Token: `DELETE /v1/board-token`

Revoke all board tokens for this write token. Requires auth.

**Response** `200`:
```json
{ "ok": true }
```

### TODO: `POST /v1/todos`

Create a TODO item. Requires auth.

**Body**:
```json
{
  "project": "my-app",
  "message": "add dark mode support"
}
```

`project` is optional (defaults to `_global`).

**Response** `201`:
```json
{
  "id": 1,
  "project": "my-app",
  "message": "add dark mode support",
  "status": "pending",
  "issue_url": null,
  "created_at": "2026-03-21 14:20:00",
  "updated_at": "2026-03-21 14:20:00"
}
```

### TODO: `GET /v1/todos`

List TODOs. Requires auth.

**Query params**:
- `status` — filter by status (`pending`, `dispatched`, `done`)
- `project` — filter by project name

**Response** `200`:
```json
{
  "todos": [
    {
      "id": 1,
      "project": "my-app",
      "message": "add dark mode",
      "status": "pending",
      "issue_url": null,
      "created_at": "2026-03-21 14:20:00",
      "updated_at": "2026-03-21 14:20:00"
    }
  ]
}
```

### TODO: `PATCH /v1/todos/:id`

Update a TODO's status. Requires auth.

**Body**:
```json
{
  "status": "dispatched",
  "issue_url": "https://github.com/owner/repo/issues/42"
}
```

`issue_url` is optional. Status transitions are validated:
- `pending` → `dispatched` or `done`
- `dispatched` → `done`
- Any → `done` (always allowed)

Invalid transitions return `409 Conflict`.

**Response** `200`:
```json
{ "ok": true, "updated": { "id": 1, "status": "dispatched" } }
```

### TODO: `DELETE /v1/todos/:id`

Remove a TODO. Requires auth.

**Response** `200`:
```json
{ "ok": true }
```

---

## D1 Schema

```sql
CREATE TABLE tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL,
  project TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  session_id TEXT,
  state TEXT NOT NULL CHECK (state IN ('working', 'done', 'stuck', 'waiting', 'idle')),
  message TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE board_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL,
  board_token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (token_hash) REFERENCES tokens(token_hash)
);

CREATE TABLE todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL,
  project TEXT NOT NULL DEFAULT '_global',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dispatched', 'done')),
  issue_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_events_token_project ON events (token_hash, project);
CREATE INDEX idx_events_token_project_ts ON events (token_hash, project, timestamp);
CREATE INDEX idx_todos_token_status ON todos (token_hash, status);
```

---

## CLI Changes

### Modified: `tend emit`

```
if TEND_RELAY_TOKEN is set:
  POST to TEND_RELAY_URL (default https://relay.tend.dev) via curl
  on failure: warn to stderr, fall back to local .tend/events if it exists
else:
  existing local file behavior (unchanged)
```

### New: `tend relay` subcommand

| Subcommand | Description |
|---|---|
| `tend relay setup` | Register with relay, store token in `~/.tend/relay_token` |
| `tend relay status` | Show masked token, relay URL, last sync time |
| `tend relay pull` | Force-refresh event cache from relay |
| `tend relay token` | Print raw token (for copying to remote envs) |
| `tend relay link` | Write relay token to this project's `.tend/relay_token` |
| `tend relay share` | Generate a read-only board URL (safe to share with teammates) |
| `tend relay debug` | Show relay session diagnostics |

### New: `tend dispatch`

Dispatch pending TODOs from the relay as GitHub issues assigned to the Copilot coding agent.

```bash
tend dispatch              # Create issues for all pending TODOs
tend dispatch --dry-run    # Preview what would be dispatched
tend dispatch --project X  # Only dispatch TODOs for project X
```

Requires `gh` (GitHub CLI) to be installed and authenticated.

**Flow**:
1. Fetches pending TODOs from relay
2. Creates a GitHub issue for each with `tend: <message>` title
3. Marks the TODO as `dispatched` on the relay with the issue URL
4. Copilot picks up the issue, reads `AGENTS.md`, and emits events back to relay

### Modified: `tend add`

Now dual-writes to relay (best-effort) when a relay token is configured:
- Local: appends to `.tend/TODO`
- Relay: `POST /v1/todos`

### Modified: Departures board

- Before rendering, refresh relay cache: fetch project list + events for each
- Add relay-only projects to the board (projects on relay but not local)
- Mark relay projects with `↗` indicator

### Modified: `tend status`

- Count relay project states alongside local ones (from cache only — no network)

---

## Monorepo Structure

```
tend-cli/
├── bin/tend                    # CLI (bash)
├── relay/                      # Cloudflare Worker
│   ├── src/
│   │   ├── index.ts            # Worker entry point, routing
│   │   ├── routes.ts           # API route handlers
│   │   └── auth.ts             # Token auth middleware
│   ├── test/                   # vitest + miniflare tests
│   ├── schema.sql              # D1 schema
│   ├── wrangler.toml           # Cloudflare config
│   ├── package.json
│   └── tsconfig.json
├── test/test_tend.sh           # CLI tests (existing + relay)
├── Makefile                    # + relay-install, relay-deploy, relay-dev
└── ...
```

---

## Implementation Phases

### Phase 1: Relay Worker

1. Scaffold `relay/` — wrangler.toml, package.json, tsconfig, src structure
2. D1 schema — tokens + events tables with indexes
3. API routes — register, emit, fetch events, list projects
4. Auth middleware — SHA-256 bearer token lookup
5. Worker entry point — routing, CORS, error handling
6. Tests — vitest + miniflare: full register→emit→fetch cycle, auth, validation, isolation

### Phase 2: CLI Integration

7. Modify `tend emit` — relay POST when `TEND_RELAY_TOKEN` is set
8. Add relay event fetching — `_tend_fetch_relay_events`, JSON parsing via python3, local cache
9. Modify board + status — merge relay events alongside local, relay-only projects on board
10. Add `tend relay` subcommand — setup, status, pull, token
11. CLI tests — mock curl, test relay emit/board/fallback paths

### Phase 3: Polish

12. Makefile targets — relay-install, relay-deploy, relay-dev
13. Update README — move relay from "Coming Soon" to documented
14. Update AGENTS.md template — note that relay is transparent (no agent-side changes)

---

## Decisions

| Decision | Rationale |
|---|---|
| D1 over KV | KV can't query by timestamp or do atomic append. D1 gives SQL, filtering, isolation. |
| Server-generated tokens | Prevents weak client-generated tokens. Relay generates crypto-random tokens. |
| Cache-based prompt | `tend status` reads from `~/.tend/relay_cache/`, never hits network. Preserves <100ms budget. |
| python3 for JSON | More portable than requiring `jq`. Available on macOS and most Linux. |
| No daemon | Consistent with "no persistent process" principle. Cache refreshes when board runs. |
| Shared hosted relay | One Cloudflare Worker for all users. Users never run infrastructure. |

---

## Verification

1. **Worker tests**: `cd relay && npm test` — vitest + miniflare
2. **CLI tests**: `bash test/test_tend.sh` — existing 49 tests pass + new relay tests
3. **Local integration**: `npx wrangler dev` → `TEND_RELAY_URL=http://localhost:8787` → setup → emit → verify board
4. **Edge cases**: relay unreachable (warn, don't crash), invalid token (clear error), mixed local+relay events (merge correctly), prompt <100ms

---

## Out of Scope (v1)

- User accounts / OAuth
- Web dashboard UI
- Relay-to-relay federation
- Event retention / pruning (follow-up: scheduled Worker cron, 30-day TTL)
- WebSocket push (against design principles)
- Marketing site (separate project)

---

## Future Considerations

1. **Custom domain**: `relay.tend.dev` needs DNS on Cloudflare. Default `*.workers.dev` works for launch.
2. **Event retention**: D1 grows unbounded. Scheduled Worker to prune events >30 days is a natural follow-up.
3. **JSON parsing perf**: `python3 -c` adds ~50ms. Could detect and prefer `jq`. Start with python3, optimize later.
