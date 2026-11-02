-- Claims are one per cluster: the builder who claimed it and the repo.
-- The unique index is what makes the upsert work.
DELETE FROM claims;
CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_cluster_unique ON claims(cluster_id);
