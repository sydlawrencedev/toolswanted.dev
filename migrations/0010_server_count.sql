-- The number of servers in the mirror, kept rather than counted.
--
-- `getStats` reported the size of the registry mirror with
-- `SELECT COUNT(*) FROM servers`, and the mirror holds 55,293 rows.
--
-- D1 counts a row read for every row a query touches, including the
-- rows it walks in an index, so a count over the whole table is 55,293
-- row reads. The board's stats query runs on every board render, every
-- weekly page and every `/api/stats` call, so the board spent five
-- million row reads a day counting one number, and the daily read
-- limit took the whole site down at 13:00 UTC on 6 November 2026.
--
-- The count changes only when the crawl adds a server, and the crawl
-- already knows how many it added. So it is written down, and the
-- stats query reads one row.
--
-- A row is kept per day rather than one row overwritten, so the
-- history is there if the count is ever wrong and someone needs to
-- reconstruct it. The primary key is the day, so there is one row.
CREATE TABLE IF NOT EXISTS server_counts (
  day   TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);

-- The count for today, or the most recent one before it.
--
-- A crawl that runs just after midnight writes the new day's row, so
-- there is always a row for today or the day before.
INSERT INTO server_counts (day, count)
  SELECT date('now'), COUNT(*) FROM servers
  WHERE NOT EXISTS (SELECT 1 FROM server_counts WHERE day = date('now'));
