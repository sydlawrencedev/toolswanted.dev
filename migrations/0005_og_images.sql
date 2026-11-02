-- OG images live in D1: KV allows only 1,000 writes a day on the free plan,
-- and a board with a page per cluster re-renders its images often.
CREATE TABLE IF NOT EXISTS og_images (
  slug       TEXT PRIMARY KEY,
  bytes      BLOB NOT NULL,
  updated_at TEXT NOT NULL
);
