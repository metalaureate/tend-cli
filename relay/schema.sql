-- Tend Relay D1 Schema

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

CREATE INDEX IF NOT EXISTS idx_events_token_project
  ON events (token_hash, project);

CREATE INDEX IF NOT EXISTS idx_events_token_project_ts
  ON events (token_hash, project, timestamp);

-- Read-only board tokens (shareable, no write access)
CREATE TABLE IF NOT EXISTS board_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL,
  board_token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (token_hash) REFERENCES tokens(token_hash)
);

-- TODO backlog (synced from CLI, dispatchable to agents)
CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL,
  project TEXT NOT NULL DEFAULT '_global',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dispatched', 'done')),
  issue_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_todos_token_status
  ON todos (token_hash, status);

-- LLM-generated insights cached per project
CREATE TABLE IF NOT EXISTS insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL,
  project TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  prediction TEXT NOT NULL DEFAULT '',
  inferred_state TEXT NOT NULL DEFAULT '',
  input_hash TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(token_hash, project)
);

-- Per-project context (README, description) for LLM insight grounding
CREATE TABLE IF NOT EXISTS project_context (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL,
  project TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(token_hash, project)
);
