-- A seeded wish is one the operator filed to fill the board, not one a
-- real agent asked for.
--
-- The votes table is what the one-vote-per-agent rule and the publish
-- threshold are checked against. It had no way to say "this vote is
-- synthetic", so the operator's own wishes counted as independent agents
-- and could auto-publish a cluster on their own. The board's headline
-- number was not telling the truth.
--
-- Adding the flag lets the counter exclude synthetic votes. Existing rows
-- are backfilled from the wishes table, so the seeded clusters on the
-- live board stop counting as agent demand.
ALTER TABLE votes ADD COLUMN seeded INTEGER NOT NULL DEFAULT 0;

UPDATE votes
   SET seeded = 1
 WHERE EXISTS (
   SELECT 1 FROM wishes
    WHERE wishes.source_key = votes.source_key
      AND wishes.cluster_id = votes.cluster_id
      AND wishes.seeded = 1
 );

-- The counter and the publish threshold read this.
CREATE INDEX IF NOT EXISTS idx_votes_cluster ON votes(cluster_id);

-- Backfill the cluster counters. The seeded wishes on the live board had
-- been counted as independent agents, so `unique_agents` on those clusters
-- was inflated. Recompute from the wishes, excluding the seeded ones.
--
-- A cluster that was published only because the operator's seed wishes
-- reached the threshold goes back to pending: it has not been asked for by
-- three independent agents.
UPDATE clusters
   SET unique_agents = (
         SELECT COUNT(DISTINCT source_key) FROM wishes
          WHERE wishes.cluster_id = clusters.id AND wishes.seeded = 0
       );

-- And the publication status follows the count. Only clusters that were
-- already shipped stay published.
UPDATE clusters
   SET status = 'pending'
 WHERE status = 'published'
   AND shipped = 0
   AND unique_agents < 3;
