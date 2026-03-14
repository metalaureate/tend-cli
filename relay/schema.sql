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
