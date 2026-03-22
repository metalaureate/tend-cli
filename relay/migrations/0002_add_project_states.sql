-- Computed project states (pushed from CLI, mirrors local board exactly)
CREATE TABLE IF NOT EXISTS project_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL,
  project TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('working', 'done', 'stuck', 'waiting', 'idle')),
  message TEXT DEFAULT '',
  timestamp TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(token_hash, project)
);
