-- LLM-generated insights cached per project
CREATE TABLE IF NOT EXISTS insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL,
  project TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  prediction TEXT NOT NULL DEFAULT '',
  input_hash TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(token_hash, project)
);
