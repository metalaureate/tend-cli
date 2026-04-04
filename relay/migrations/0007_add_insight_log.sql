CREATE TABLE IF NOT EXISTS insight_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL,
  project TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  prediction TEXT NOT NULL DEFAULT '',
  inferred_state TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_insight_log_token_project
  ON insight_log (token_hash, project, created_at);
