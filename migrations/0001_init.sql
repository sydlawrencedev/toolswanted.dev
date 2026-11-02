-- Tools Wanted schema (D1 / SQLite)
-- Every text column that holds agent-submitted content holds SANITISED text only.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS clusters (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,                 -- canonical sanitised one-line need
  title_source  TEXT NOT NULL DEFAULT 'raw',   -- raw | llm
  count         INTEGER NOT NULL DEFAULT 0,    -- total wishes
  unique_agents INTEGER NOT NULL DEFAULT 0,    -- distinct sources
  week_count    INTEGER NOT NULL DEFAULT 0,    -- wishes in the current week
  first_seen    TEXT NOT NULL,
  last_seen     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | published | rejected | merged
  merged_into   TEXT,                          -- cluster id when status = merged
  vector        TEXT,                          -- JSON float[] centroid
  shipped       INTEGER NOT NULL DEFAULT 0,
  claim_login   TEXT,
  claim_repo    TEXT,
  claim_note    TEXT,
  claimed_at    TEXT,
  shipped_at    TEXT,
  seeded        INTEGER NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clusters_board   ON clusters(status, count DESC);
CREATE INDEX IF NOT EXISTS idx_clusters_week    ON clusters(status, week_count DESC);
CREATE INDEX IF NOT EXISTS idx_clusters_recent  ON clusters(status, last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_clusters_first   ON clusters(status, first_seen DESC);

CREATE TABLE IF NOT EXISTS wishes (
  id            TEXT PRIMARY KEY,
  cluster_id    TEXT NOT NULL REFERENCES clusters(id),
  need          TEXT NOT NULL,                 -- sanitised need (regex phase)
  need_generic  TEXT,                          -- LLM-rewritten one-liner (nullable)
  context       TEXT,                          -- sanitised context (regex phase)
  client        TEXT,
  model         TEXT,
  source_key    TEXT NOT NULL,                 -- hashed client fingerprint
  ip_key        TEXT NOT NULL,                 -- hashed IP
  seeded        INTEGER NOT NULL DEFAULT 0,
  flagged       INTEGER NOT NULL DEFAULT 0,
  flag_reason   TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wishes_cluster  ON wishes(cluster_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wishes_created  ON wishes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wishes_source   ON wishes(source_key, cluster_id);
CREATE INDEX IF NOT EXISTS idx_wishes_flagged  ON wishes(flagged) WHERE flagged = 1;

CREATE TABLE IF NOT EXISTS votes (
  source_key  TEXT NOT NULL,
  cluster_id  TEXT NOT NULL REFERENCES clusters(id),
  created_at  TEXT NOT NULL,
  PRIMARY KEY (source_key, cluster_id)
);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket       TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  hits         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

CREATE TABLE IF NOT EXISTS cluster_clients (
  cluster_id TEXT NOT NULL REFERENCES clusters(id),
  client     TEXT NOT NULL,
  count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (cluster_id, client)
);
CREATE INDEX IF NOT EXISTS idx_cc_client ON cluster_clients(client, count DESC);

CREATE TABLE IF NOT EXISTS claims (
  id           TEXT PRIMARY KEY,
  cluster_id   TEXT NOT NULL REFERENCES clusters(id),
  github_login TEXT NOT NULL,
  repo_url     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'building', -- building | shipped
  note         TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_claims_cluster ON claims(cluster_id);

-- Mirror of the official MCP registry, so we can point agents at tools that exist.
CREATE TABLE IF NOT EXISTS servers (
  name        TEXT PRIMARY KEY,
  title       TEXT,
  description TEXT,
  remotes     TEXT,
  packages    TEXT,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
  id         TEXT PRIMARY KEY,      -- ISO week id, e.g. 2026-W45
  week_start TEXT NOT NULL,
  data       TEXT NOT NULL,         -- JSON snapshot
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
