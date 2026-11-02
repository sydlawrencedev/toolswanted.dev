-- The daily Workers AI neuron budget lives in D1, not KV: KV allows only
-- 1,000 writes a day on the free plan and the budget counter is written on
-- every embedding and every crawl batch.
CREATE TABLE IF NOT EXISTS neuron_budget (
  day  TEXT PRIMARY KEY,
  used REAL NOT NULL DEFAULT 0
);
