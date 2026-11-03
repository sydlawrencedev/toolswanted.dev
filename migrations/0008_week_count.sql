-- `week_count` is the number of wishes on a cluster that were filed in the
-- current week. It was maintained as a running counter that was never reset
-- at the week boundary, and the cluster merge recomputed `count` from the
-- wishes while leaving `week_count` alone, so a merged cluster carried the
-- sum of both clusters' weekly counts.
--
-- The two drifted apart, and a count on this board that is not the whole
-- truth is the thing the whole board's honesty rests on not being. The
-- published entry read "17 this week" against 15 wishes in total.
--
-- It is counted from the wishes now, in both `recordWish` and
-- `mergeClusters`. This migration puts the rows that are already stored back
-- in line, so the fix is not waiting for the next wish to arrive.
--
-- The week starts on Monday, UTC, which is what `weekStart()` in
-- src/types.ts returns.
UPDATE clusters
   SET week_count = (
         SELECT COUNT(*) FROM wishes
          WHERE wishes.cluster_id = clusters.id
            AND wishes.created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', date('now', '-' || ((strftime('%w', date('now')) + 6) % 7) || ' days'))
       );
