/**
 * Data access. Everything goes through D1.
 *
 * Notes on the data model:
 *  - `clusters.count` is the number of wishes filed.
 *  - `clusters.unique_agents` is the number of distinct sources. This is the
 *    headline number ("wanted by 212 agents") and it is protected by the
 *    one-vote-per-source-per-cluster rule in the `votes` table.
 */

import type { Cluster, ServerRecord, Wish } from "./types";
import { newId, weekStart } from "./types";

/** True when D1 refused a write because the daily row limit is spent. */
export function isWriteLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /row write limit|exceeded D1/i.test(message);
}

export const CLUSTER_COLUMNS = `id, slug, title, title_source, count, unique_agents, week_count,
  first_seen, last_seen, status, merged_into, vector, shipped, claim_login, claim_repo,
  claim_note, claimed_at, shipped_at, seeded, notes, created_at, updated_at`;

const CLUSTER_COLUMNS_C = CLUSTER_COLUMNS.replace(/(\w+)/g, "c.$1");

/**
 * The columns a listing needs.
 *
 * The same set without the vector.
 *
 * The vector is a base64-encoded 1024-dimension embedding, about 1.5KB a
 * row. The board selects a hundred clusters and renders none of their
 * vectors, so the query was transferring a hundred and a half kilobytes
 * and decoding it for nothing. The board's cost was measured at a p50 of
 * 9ms against a 10ms budget, and this was most of it.
 *
 * The vector is still selected where it is used: `getRecentCentroids` and
 * the single-cluster reads, which are the only two places that decode it.
 */
const CLUSTER_LIST_COLUMNS = CLUSTER_COLUMNS.replace(/, vector/, "");

const CLUSTER_LIST_COLUMNS_C = CLUSTER_LIST_COLUMNS.replace(/(\w+)/g, "c.$1");

export interface ClusterRow extends Cluster {
  [key: string]: unknown;
}

export async function getClusterById(db: D1Database, id: string): Promise<Cluster | null> {
  return db
    .prepare(`SELECT ${CLUSTER_COLUMNS} FROM clusters WHERE id = ?`)
    .bind(id)
    .first<Cluster>();
}

export async function getClusterBySlug(db: D1Database, slug: string): Promise<Cluster | null> {
  return db
    .prepare(`SELECT ${CLUSTER_COLUMNS} FROM clusters WHERE slug = ?`)
    .bind(slug)
    .first<Cluster>();
}

export interface ListOptions {
  status?: string;
  limit?: number;
  client?: string;
  /**
   * "agents" is the default and sorts by the number of independent agents
   * that asked for the capability. It is the number the board's own copy
   * says the ranking rests on, so it is the number the ranking uses.
   */
  sort?: "agents" | "recent" | "rising" | "new";
  weekStart?: string;
  /** A state filter applied on top of the status: "shipped" today. */
  filter?: string;
}

/** Board listing. Sorted server-side so we never ship the whole table. */
export async function listClusters(
  db: D1Database,
  opts: ListOptions = {}
): Promise<Cluster[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const status = opts.status ?? "published";
  // The default order is the agent count, not the wish count.
  //
  // The board says the ranking rests on how many independent agents want
  // a capability, and that is what the count on the card shows. Sorting
  // on the wish count instead would rank a capability that one agent
  // asked for three times above one that three different agents each
  // asked for once, and it would let the seeded wishes, which are all
  // ours and all filed in one batch, carry a position in the ranking that
  // no independent agent put it in.
  const order =
    opts.sort === "recent"
      ? "c.last_seen DESC"
      : opts.sort === "new"
        ? "c.first_seen DESC"
        : opts.sort === "rising"
          ? "c.week_count DESC, c.unique_agents DESC, c.count DESC"
          : "c.unique_agents DESC, c.count DESC, c.week_count DESC, c.last_seen DESC";

  const where: string[] = ["c.status = ?"];
  const binds: unknown[] = [status];

  // "Shipped" is a state, not a sort. A builder whose own wish shipped has
  // no other way to find out: there was no route to it anywhere.
  if (opts.filter === "shipped") {
    where.push("c.shipped = 1");
  }

  if (opts.client && opts.client !== "all") {
    // Filter on the wishes table, not on cluster_clients. The seeded
    // wishes carry client names, so filtering on cluster_clients would
    // return entries that only our own agents ever asked for under the
    // name of the client the reader picked.
    where.push(
      "EXISTS (SELECT 1 FROM wishes w WHERE w.cluster_id = c.id AND w.seeded = 0 AND w.client = ?)"
    );
    binds.push(opts.client);
  }

  const sql = `SELECT ${CLUSTER_LIST_COLUMNS_C} FROM clusters c WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ?`;
  binds.push(limit);

  const { results } = await db.prepare(sql).bind(...binds).all<Cluster>();
  return results ?? [];
}

export interface CentroidRow extends Cluster {
  vector: string | null;
}

/**
 * The most recently active clusters, with their centroids. This is the
 * immediately consistent half of the matcher.
 */
export async function getRecentCentroids(
  db: D1Database,
  limit = 40
): Promise<CentroidRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, vector FROM clusters
       WHERE status IN ('published', 'pending') AND vector IS NOT NULL
       ORDER BY last_seen DESC LIMIT ?`
    )
    .bind(limit)
    .all<CentroidRow>();
  return results ?? [];
}

/** Fetch several clusters by id in one query. */
export async function getClustersByIds(db: D1Database, ids: string[]): Promise<Cluster[]> {
  if (ids.length === 0) return [];
  const out: Cluster[] = [];
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    const placeholders = chunk.map(() => "?").join(",");
    const { results } = await db
      .prepare(`SELECT ${CLUSTER_COLUMNS} FROM clusters WHERE id IN (${placeholders})`)
      .bind(...chunk)
      .all<Cluster>();
    out.push(...(results ?? []));
  }
  return out;
}

/** Fetch a cluster and its claim in one round trip. */
export async function getClusterWithClaim(
  db: D1Database,
  id: string
): Promise<{ cluster: Cluster | null; claim: Claim | null }> {
  const [clusterRows, claimRows] = await db.batch([
    db.prepare(`SELECT ${CLUSTER_COLUMNS} FROM clusters WHERE id = ?`).bind(id),
    db
      .prepare(`SELECT github_login, repo_url, status, note FROM claims WHERE cluster_id = ?`)
      .bind(id),
  ]);
  const cluster = ((clusterRows?.results ?? []) as Cluster[])[0] ?? null;
  const claim = ((claimRows?.results ?? []) as Claim[])[0] ?? null;
  return { cluster, claim };
}

export interface Claim {
  github_login: string;
  repo_url: string;
  status: string;
  note: string | null;
}

/** Sample wishes for a cluster, newest first. */
export async function getSamples(db: D1Database, clusterId: string, limit = 4): Promise<Wish[]> {
  const { results } = await db
    .prepare(
      `SELECT id, cluster_id, need, need_generic, context, client, model, source_key, ip_key,
              seeded, flagged, flag_reason, created_at
       FROM wishes WHERE cluster_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .bind(clusterId, limit)
    .all<Wish>();
  return results ?? [];
}

/**
 * Sample wishes for many clusters in one query. The board needs three
 * samples for each of up to sixty clusters; one query per cluster would be
 * sixty round trips and blow the CPU budget.
 */
export async function getSamplesForClusters(
  db: D1Database,
  clusterIds: string[],
  perCluster = 3
): Promise<Map<string, Wish[]>> {
  const out = new Map<string, Wish[]>();
  if (clusterIds.length === 0) return out;
  for (let i = 0; i < clusterIds.length; i += 40) {
    const chunk = clusterIds.slice(i, i + 40);
    const placeholders = chunk.map(() => "?").join(",");
    // The window function limits the rows the database sends back.
    //
    // It used to select every wish for every cluster and trim to the window
    // in JavaScript. With a hundred clusters that is every wish on the
    // board, read over the network, to build a hundred cards that show
    // twelve rows each. The board's CPU was measured at a p50 of 1.3ms to
    // render, and a p90 of 20ms to serve, and the difference is this read.
    const { results } = await db
      .prepare(
        `SELECT id, cluster_id, need, need_generic, context, client, model, source_key, ip_key,
                seeded, flagged, flag_reason, created_at
         FROM (
           SELECT id, cluster_id, need, need_generic, context, client, model, source_key, ip_key,
                  seeded, flagged, flag_reason, created_at,
                  ROW_NUMBER() OVER (PARTITION BY cluster_id ORDER BY created_at DESC) AS rn
             FROM wishes WHERE cluster_id IN (${placeholders})
         )
         WHERE rn <= ?
         ORDER BY created_at DESC`
      )
      .bind(...chunk, perCluster)
      .all<Wish>();
    for (const wish of results ?? []) {
      const list = out.get(wish.cluster_id) ?? [];
      list.push(wish);
      out.set(wish.cluster_id, list);
    }
  }
  return out;
}

/**
 * Client breakdown for a set of clusters.
 *
 * Seeded wishes are excluded. The breakdown is an attribution to agents,
 * and the seeded wishes were filed by the operator, so counting them here
 * would put our own wishes in a table headed "which agents filed these".
 *
 * It counts wishes, not agents. One agent filing the same wish twice is
 * two rows of count here and one agent in the cluster's agent count, so
 * the two numbers do not add up to each other and the copy has to say so.
 *
 * It is counted from the wishes table rather than read from
 * `cluster_clients` for that reason: `cluster_clients` has no seeded
 * split, so it cannot tell the two apart without a migration and a
 * backfill. The wishes table has the seeded flag on every row already.
 */
export async function getClientBreakdown(
  db: D1Database,
  clusterIds: string[],
  pairsPerCluster = 6
): Promise<Map<string, Array<{ client: string; count: number; total: number }>>> {
  const out = new Map<string, Array<{ client: string; count: number; total: number }>>();
  if (clusterIds.length === 0) return out;
  // The card shows the top four clients and says how many more there are.
  //
  // This used to count every non-seeded wish for every cluster, so the
  // database scanned the whole board to produce four numbers per card. The
  // window function counts per cluster and client and keeps the top few
  // pairs, which is what the card renders.
  //
  // The window is a parameter, because not every caller renders a card.
  // The entry page has a table headed "Which agents filed these", and a
  // table is the whole story: it showed six agents of ten and said
  // nothing about the four it dropped. That caller asks for all of them.
  const limit = Math.max(1, Math.min(pairsPerCluster, 1000));
  const placeholders = clusterIds.map(() => "?").join(",");
  // The window keeps the top pairs per cluster. The total is counted
  // separately, because the card says how many more clients there are and
  // that number has to be the real one rather than the size of the window.
  const { results } = await db
    .prepare(
      `SELECT cluster_id, client, count, total FROM (
         SELECT cluster_id, client, COUNT(*) AS count,
                COUNT(*) OVER (PARTITION BY cluster_id) AS total,
                ROW_NUMBER() OVER (PARTITION BY cluster_id ORDER BY COUNT(*) DESC, client) AS rn
           FROM wishes
          WHERE seeded = 0 AND client IS NOT NULL AND cluster_id IN (${placeholders})
          GROUP BY cluster_id, client
       )
       WHERE rn <= ?
       ORDER BY count DESC`
    )
    .bind(...clusterIds, limit)
    .all<{ cluster_id: string; client: string; count: number; total: number }>();
  for (const row of results ?? []) {
    const list = out.get(row.cluster_id) ?? [];
    list.push({ client: row.client, count: row.count, total: row.total });
    out.set(row.cluster_id, list);
  }
  return out;
}

export interface GroupedSample {
  /** The capability that was asked for, after the model rewrote it. */
  text: string;
  /** How many times it was asked for. The real count, not a sample's. */
  count: number;
  /** How many of those were filed by the operator to seed the board. */
  seeded: number;
  /** The context that came with the first of them. */
  context: string | null;
  /** The clients that asked for it, most popular first. */
  clients: string[];
  /** The most recent date it was asked for. */
  when: string;
}

/**
 * The wishes of a cluster, grouped by what was asked for.
 *
 * The cluster page shows one row per distinct capability, with the count
 * of how many times it was asked for. The count has to be the real one.
 *
 * It used to be counted in JavaScript, over the twelve most recent
 * wishes, so a cluster with sixteen wishes said "4 times" on a row that
 * had been asked for more than that, and the twelve rows said 12 of 16.
 * The reader could not tell a truncated count from a real one, and the
 * table is the page a builder reads before deciding what to build.
 *
 * The grouping happens in SQL, over every wish on the cluster, so the
 * count and the clients are the whole truth. It is one query: the
 * clients and the context come with it, because a second and third
 * round trip to the database are two round trips of latency and two
 * more things that can go wrong.
 *
 * The client list excludes the seeded wishes. The seeded wishes carry
 * client names, so including them would attribute our own wishes to the
 * agent the reader sees in the column, next to a count of independent
 * agents that did not ask for it.
 */
export async function getGroupedSamples(
  db: D1Database,
  clusterId: string,
  limit = 25
): Promise<GroupedSample[]> {
  const { results } = await db
    .prepare(
      `SELECT
         COALESCE(need_generic, need) AS text,
         COUNT(*) AS count,
         SUM(CASE WHEN seeded = 1 THEN 1 ELSE 0 END) AS seeded,
         MAX(created_at) AS last_at,
         GROUP_CONCAT(DISTINCT CASE WHEN seeded = 0 THEN client END) AS clients,
         (SELECT w2.context FROM wishes w2
           WHERE w2.cluster_id = wishes.cluster_id
             AND COALESCE(w2.need_generic, w2.need) = COALESCE(wishes.need_generic, wishes.need)
             AND w2.context IS NOT NULL AND w2.context <> ''
           ORDER BY w2.created_at DESC LIMIT 1) AS context
       FROM wishes
       WHERE cluster_id = ?
       GROUP BY text
       ORDER BY count DESC, last_at DESC
       LIMIT ?`
    )
    .bind(clusterId, limit)
    .all<{
      text: string;
      count: number;
      seeded: number;
      last_at: string;
      clients: string | null;
      context: string | null;
    }>();

  return (results ?? []).map((g) => ({
    text: g.text,
    count: g.count,
    seeded: Number(g.seeded ?? 0),
    context: g.context ?? null,
    clients: g.clients ? g.clients.split(",").filter(Boolean) : [],
    when: g.last_at,
  }));
}

export interface CreateClusterInput {
  title: string;
  slug: string;
  /** Centroid, base64 encoded (see src/vector.ts). */
  vector: string;
  now: string;
  weekStart: string;
  seeded?: boolean;
}

/** Create a cluster and return its id. */
export async function createCluster(db: D1Database, input: CreateClusterInput): Promise<string> {
  const id = newId("c");
  await db
    .prepare(
      `INSERT INTO clusters (id, slug, title, title_source, count, unique_agents, week_count,
         first_seen, last_seen, status, vector, seeded, created_at, updated_at)
       VALUES (?, ?, ?, 'raw', 0, 0, 0, ?, ?, 'pending', ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.slug,
      input.title,
      input.now,
      input.now,
      input.vector,
      input.seeded ? 1 : 0,
      input.now,
      input.now
    )
    .run();
  return id;
}

/**
 * Record a wish and update the cluster counters.
 *
 * The one-vote-per-source-per-cluster rule is enforced by the `votes` table:
 * the UNIQUE constraint decides whether this source is new to the cluster.
 */
export async function recordWish(
  db: D1Database,
  input: {
    clusterId: string;
    need: string;
    context: string | null;
    client: string;
    model: string | null;
    sourceKey: string;
    ipKey: string;
    now: string;
    flagged: boolean;
    flagReason: string | null;
    seeded?: boolean;
    weekStart: string;
    /** Independent agents needed before the cluster appears publicly. */
    autoPublishThreshold: number;
  }
): Promise<{ wishId: string; newVote: boolean }> {
  const wishId = newId("w");

  // One batch, one round trip. The order matters.
  //
  // The wish row goes in first. The cluster's `week_count` is the number of
  // wishes on it that were filed in the current week, and it is counted from
  // the wishes table rather than kept as a running counter. A running
  // counter has to be reset at the week boundary and it has to survive a
  // cluster merge, and neither happened: the published entry read "17 this
  // week" against 15 wishes in total. Counting from the wishes cannot
  // drift, and the wish row has to exist before the count reads it.
  //
  // The counter update reads the votes table to decide whether this source
  // is new to the cluster, so it has to run before the vote is inserted.
  //
  // A seeded wish is the operator's own, not an agent's. It is counted as a
  // wish, and it is labelled, but it is NOT counted as an independent
  // agent and it cannot auto-publish a cluster on its own. Otherwise the
  // board's headline number, "wanted by N agents", would be counting the
  // operator's own wishes as agent demand.
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO wishes (id, cluster_id, need, need_generic, context, client, model,
           source_key, ip_key, seeded, flagged, flag_reason, created_at)
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        wishId,
        input.clusterId,
        input.need,
        input.context,
        input.client,
        input.model,
        input.sourceKey,
        input.ipKey,
        input.seeded ? 1 : 0,
        input.flagged ? 1 : 0,
        input.flagReason,
        input.now
      ),
    db
      .prepare(
        `UPDATE clusters SET
           count = count + 1,
           unique_agents = unique_agents + CASE
             WHEN ? = 1 THEN 0
             WHEN EXISTS (SELECT 1 FROM votes WHERE source_key = ? AND cluster_id = ? AND seeded = 0) THEN 0
             ELSE 1 END,
           week_count = (SELECT COUNT(*) FROM wishes WHERE cluster_id = clusters.id
                          AND created_at >= ?),
           last_seen = ?,
           updated_at = ?,
           seeded = CASE WHEN ? = 1 THEN 1 ELSE seeded END,
           status = CASE
             WHEN status = 'pending'
              AND unique_agents + CASE
                    WHEN ? = 1 THEN 0
                    WHEN EXISTS (SELECT 1 FROM votes WHERE source_key = ? AND cluster_id = ? AND seeded = 0) THEN 0
                    ELSE 1 END >= ?
             THEN 'published'
             ELSE status END
         WHERE id = ?`
      )
      .bind(
        input.seeded ? 1 : 0,
        input.sourceKey,
        input.clusterId,
        input.weekStart,
        input.now,
        input.now,
        input.seeded ? 1 : 0,
        input.seeded ? 1 : 0,
        input.sourceKey,
        input.clusterId,
        input.autoPublishThreshold,
        input.clusterId
      ),
    db
      .prepare(
        `INSERT INTO votes (source_key, cluster_id, created_at, seeded) VALUES (?, ?, ?, ?)
         ON CONFLICT(source_key, cluster_id) DO NOTHING`
      )
      .bind(input.sourceKey, input.clusterId, input.now, input.seeded ? 1 : 0),
    db
      .prepare(
        `INSERT INTO cluster_clients (cluster_id, client, count) VALUES (?, ?, 1)
         ON CONFLICT(cluster_id, client) DO UPDATE SET count = count + 1`
      )
      .bind(input.clusterId, input.client),
  ]);

  // The vote insert is the second statement in the batch, so its result is
  // at index 1. It reports whether this source was new to the cluster.
  const newVote = (results[1]?.meta?.changes ?? 0) > 0;
  return { wishId, newVote };
}

/** Promote a cluster to published once it has enough wishes. */
export async function maybeAutoPublish(
  db: D1Database,
  clusterId: string,
  threshold: number
): Promise<boolean> {
  const cluster = await getClusterById(db, clusterId);
  if (!cluster || cluster.status !== "pending") return false;
  if (cluster.count < threshold) return false;
  await db
    .prepare(`UPDATE clusters SET status = 'published', updated_at = ? WHERE id = ?`)
    .bind(new Date().toISOString(), clusterId)
    .run();
  return true;
}

export async function updateClusterTitle(
  db: D1Database,
  clusterId: string,
  title: string
): Promise<void> {
  await db
    .prepare(`UPDATE clusters SET title = ?, title_source = 'llm', updated_at = ? WHERE id = ?`)
    .bind(title, new Date().toISOString(), clusterId)
    .run();
}

export async function updateWishGeneric(
  db: D1Database,
  wishId: string,
  generic: string
): Promise<void> {
  await db.prepare(`UPDATE wishes SET need_generic = ? WHERE id = ?`).bind(generic, wishId).run();
}

/** Board-wide totals, used in the top bar. */
export async function getStats(db: D1Database): Promise<{
  clusters: number;
  wishes: number;
  agents: number;
  seededWishes: number;
  shipped: number;
  pending: number;
}> {
  const row = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM clusters WHERE status = 'published') AS clusters,
         (SELECT COUNT(*) FROM wishes) AS wishes,
         (SELECT COUNT(DISTINCT source_key) FROM wishes WHERE seeded = 0) AS agents,
         (SELECT COUNT(*) FROM wishes WHERE seeded = 1) AS seededWishes,
         (SELECT COUNT(*) FROM clusters WHERE shipped = 1) AS shipped,
         (SELECT COUNT(*) FROM clusters WHERE status = 'pending') AS pending`
    )
    .first<{
    clusters: number;
    wishes: number;
    agents: number;
    seededWishes: number;
    shipped: number;
    pending: number;
  }>();
  return (
    row ?? {
      clusters: 0,
      wishes: 0,
      agents: 0,
      seededWishes: 0,
      shipped: 0,
      pending: 0,
    }
  );
}

/** Clusters waiting for review. */
export async function listPendingClusters(db: D1Database, limit = 100): Promise<Cluster[]> {
  const { results } = await db
    .prepare(
      `SELECT ${CLUSTER_COLUMNS} FROM clusters WHERE status = 'pending'
       ORDER BY count DESC, last_seen DESC LIMIT ?`
    )
    .bind(limit)
    .all<Cluster>();
  return results ?? [];
}

/** Wishes that tripped the injection detector. */
export async function listFlaggedWishes(db: D1Database, limit = 50): Promise<Wish[]> {
  const { results } = await db
    .prepare(
      `SELECT id, cluster_id, need, need_generic, context, client, model, source_key, ip_key,
              seeded, flagged, flag_reason, created_at
       FROM wishes WHERE flagged = 1 ORDER BY created_at DESC LIMIT ?`
    )
    .bind(limit)
    .all<Wish>();
  return results ?? [];
}

export async function setClusterStatus(
  db: D1Database,
  clusterId: string,
  status: string
): Promise<void> {
  await db
    .prepare(`UPDATE clusters SET status = ?, updated_at = ? WHERE id = ?`)
    .bind(status, new Date().toISOString(), clusterId)
    .run();
}

export async function renameCluster(
  db: D1Database,
  clusterId: string,
  title: string,
  slug?: string
): Promise<void> {
  if (slug) {
    await db
      .prepare(`UPDATE clusters SET title = ?, slug = ?, title_source = 'admin', updated_at = ? WHERE id = ?`)
      .bind(title, slug, new Date().toISOString(), clusterId)
      .run();
  } else {
    await db
      .prepare(`UPDATE clusters SET title = ?, title_source = 'admin', updated_at = ? WHERE id = ?`)
      .bind(title, new Date().toISOString(), clusterId)
      .run();
  }
}

export async function mergeClusters(
  db: D1Database,
  fromId: string,
  intoId: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`UPDATE wishes SET cluster_id = ? WHERE cluster_id = ?`).bind(intoId, fromId),
    // Move the votes with the wishes.
    //
    // A vote is what proves an agent asked for a capability, and the
    // one-vote-per-agent rule is checked against the votes table for the
    // target cluster. Without moving them, an agent that had already
    // wished in the cluster being merged away counted as a NEW
    // independent agent in the target, so three wishes from one agent
    // could auto-publish a cluster, which is exactly what the rule
    // exists to prevent.
    //
    // The `seeded` flag comes with the vote. The flag is what separates
    // the operator's own wishes from agent demand, and it is what the
    // `unique_agents` count and the publish threshold are checked
    // against. A vote that lost its flag on the way across turned the
    // operator's own wishes into agent demand, and the headline number
    // the whole ranking rests on was wrong from then on.
    //
    // The insert is `ON CONFLICT DO UPDATE`, not `DO NOTHING`: an agent
    // that voted in both clusters keeps one vote, and a real agent vote
    // must beat a seeded one. With `DO NOTHING` the row that landed
    // first won, so a seeded vote could shadow a real vote for the same
    // agent and the agent stopped counting.
    db
      .prepare(
        `INSERT INTO votes (source_key, cluster_id, created_at, seeded)
         SELECT source_key, ?, created_at, seeded FROM votes WHERE cluster_id = ?
         ON CONFLICT(source_key, cluster_id) DO UPDATE SET
           seeded = MIN(votes.seeded, excluded.seeded)`
      )
      .bind(intoId, fromId),
    db.prepare(`DELETE FROM votes WHERE cluster_id = ?`).bind(fromId),
    // Rebuild the client breakdown for the target.
    //
    // The merge moved the wishes across but only deleted the from-
    // cluster's breakdown rows, so the target silently lost the clients
    // that had been in the merged cluster. The card says which agents
    // wanted a thing, and it was no longer saying all of them.
    db
      .prepare(
        `INSERT INTO cluster_clients (cluster_id, client, count)
         SELECT ?, client, COUNT(*) FROM wishes
          WHERE cluster_id = ? AND client IS NOT NULL
          GROUP BY client
         ON CONFLICT(cluster_id, client) DO UPDATE SET count = excluded.count`
      )
      .bind(intoId, intoId),
    db.prepare(`DELETE FROM cluster_clients WHERE cluster_id = ?`).bind(fromId),
    db
      .prepare(
        `UPDATE clusters SET status = 'merged', merged_into = ?, updated_at = ? WHERE id = ?`
      )
      .bind(intoId, now, fromId),
  ]);
  // Recompute the counters from the wishes.
  //
  // `unique_agents` excludes the seeded wishes, because a seeded wish is
  // the operator's own and is not agent demand. That is the same rule
  // `recordWish` applies and the same rule the migration backfill used.
  // Counting them made the merged cluster look like more agents wanted
  // it than actually did.
  //
  // `week_count` is recomputed too, and it has to be. It is a count of
  // the wishes filed in the current week, and it was maintained as a
  // running counter that was never reset. So a cluster merged in the
  // same week as its target carried the sum of both clusters' weekly
  // counts against a `count` that had just been recomputed from the
  // wishes. The published entry read "17 this week" against 15 wishes
  // in total, which is a count on this board that is not the whole truth.
  await db
    .prepare(
      `UPDATE clusters SET count = (SELECT COUNT(*) FROM wishes WHERE cluster_id = ?),
         unique_agents = (SELECT COUNT(DISTINCT source_key) FROM wishes
                           WHERE cluster_id = ? AND seeded = 0),
         week_count = (SELECT COUNT(*) FROM wishes WHERE cluster_id = ?
                        AND created_at >= ?),
         updated_at = ?
       WHERE id = ?`
    )
    .bind(intoId, intoId, intoId, weekStart().toISOString(), now, intoId)
    .run();
}

export async function setClaim(
  db: D1Database,
  input: {
    clusterId: string;
    login: string;
    repo: string;
    note: string | null;
    shipped: boolean;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO claims (id, cluster_id, github_login, repo_url, status, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(cluster_id) DO UPDATE SET github_login = excluded.github_login,
         repo_url = excluded.repo_url, status = excluded.status, note = excluded.note,
         updated_at = excluded.updated_at`
    )
    .bind(
      newId("claim"),
      input.clusterId,
      input.login,
      input.repo,
      input.shipped ? "shipped" : "building",
      input.note,
      now,
      now
    )
    .run();
  await db
    .prepare(
      `UPDATE clusters SET claim_login = ?, claim_repo = ?, claim_note = ?, shipped = ?,
         shipped_at = CASE WHEN ? THEN ? ELSE shipped_at END, updated_at = ? WHERE id = ?`
    )
    .bind(
      input.login,
      input.repo,
      input.note,
      input.shipped ? 1 : 0,
      input.shipped ? 1 : 0,
      now,
      now,
      input.clusterId
    )
    .run();
}

export async function getClaim(db: D1Database, clusterId: string): Promise<Claim | null> {
  return db
    .prepare(`SELECT github_login, repo_url, status, note FROM claims WHERE cluster_id = ?`)
    .bind(clusterId)
    .first<Claim>();
}

/* ------------------------------------------------------------------ *
 * Registry mirror
 * ------------------------------------------------------------------ */

/**
 * Store servers, writing only the rows that actually changed.
 *
 * The daily row write limit on the free plan is 100,000. A crawl that
 * re-writes rows it already has would spend the whole day's budget on
 * nothing, so unchanged rows are skipped.
 */
export async function upsertServers(
  db: D1Database,
  servers: Array<ServerRecord & { isLatest?: boolean }>
): Promise<number> {
  if (servers.length === 0) return 0;
  const statements = servers.map((s) =>
    db
      .prepare(
        `INSERT INTO servers (name, title, description, remotes, packages, updated_at, is_latest)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET title = excluded.title,
           description = excluded.description, remotes = excluded.remotes,
           packages = excluded.packages, updated_at = excluded.updated_at,
           is_latest = excluded.is_latest
         WHERE (excluded.is_latest = 1 OR servers.is_latest = 0)
           AND (servers.title IS NOT excluded.title
             OR servers.description IS NOT excluded.description
             OR servers.remotes IS NOT excluded.remotes
             OR servers.packages IS NOT excluded.packages
             OR servers.is_latest IS NOT excluded.is_latest)`
      )
      .bind(
        s.name,
        s.title,
        s.description,
        s.remotes,
        s.packages,
        s.updated_at,
        s.isLatest ? 1 : 0
      )
  );
  // Chunk to stay inside D1 batch limits.
  let written = 0;
  for (let i = 0; i < statements.length; i += 50) {
    const results = await db.batch(statements.slice(i, i + 50));
    for (const result of results) written += result?.meta?.changes ?? 0;
  }
  return written;
}

/** Which of these names are already in the mirror. One query, not one per name. */
export async function getExistingServerNames(
  db: D1Database,
  names: string[]
): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < names.length; i += 40) {
    const chunk = names.slice(i, i + 40);
    const placeholders = chunk.map(() => "?").join(",");
    const { results } = await db
      .prepare(`SELECT name FROM servers WHERE name IN (${placeholders})`)
      .bind(...chunk)
      .all<{ name: string }>();
    for (const row of results ?? []) found.add(row.name);
  }
  return found;
}

export async function getServer(db: D1Database, name: string): Promise<ServerRecord | null> {
  return db
    .prepare(`SELECT name, title, description, remotes, packages, updated_at FROM servers WHERE name = ?`)
    .bind(name)
    .first<ServerRecord>();
}

/* ------------------------------------------------------------------ *
 * OG images
 * ------------------------------------------------------------------ */

export async function putOgImage(
  db: D1Database,
  slug: string,
  bytes: ArrayBuffer
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO og_images (slug, bytes, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET bytes = excluded.bytes, updated_at = excluded.updated_at`
    )
    .bind(slug, bytes, new Date().toISOString())
    .run();
}

export async function getOgImage(
  db: D1Database,
  slug: string
): Promise<{ bytes: Uint8Array; updatedAt: string } | null> {
  const row = await db
    .prepare(`SELECT bytes, updated_at FROM og_images WHERE slug = ?`)
    .bind(slug)
    .first<{ bytes: Uint8Array; updated_at: string }>();
  if (!row?.bytes) return null;
  // D1 hands the blob back as an array-like that Response() will not accept
  // as a body, so make it a real byte array.
  const bytes = row.bytes instanceof Uint8Array ? row.bytes : new Uint8Array(row.bytes as any);
  return { bytes, updatedAt: row.updated_at };
}

/**
 * The clusters whose poster is older than the cluster's last change.
 *
 * A poster is a rendering of a number, and the number moves. The poster
 * on the live board said four agents while the board said nine, because
 * the poster was rendered before the rule that counted seeded wishes
 * changed, and nothing noticed.
 *
 * This is the check that would have noticed. It is a query rather than a
 * guess: it compares the poster's own timestamp with the cluster's.
 */
export async function staleOgImages(db: D1Database): Promise<
  Array<{ slug: string; title: string; og_updated_at: string; cluster_updated_at: string }>
> {
  const { results } = await db
    .prepare(
      `SELECT o.slug, c.title, o.updated_at AS og_updated_at, c.updated_at AS cluster_updated_at
         FROM og_images o
         JOIN clusters c ON c.slug = o.slug
        WHERE o.updated_at < c.updated_at
        ORDER BY c.title`
    )
    .all<{
    slug: string;
    title: string;
    og_updated_at: string;
    cluster_updated_at: string;
  }>();
  return results ?? [];
}

/* ------------------------------------------------------------------ *
 * Meta + snapshots
 * ------------------------------------------------------------------ */

export async function getMeta(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare(`SELECT value FROM meta WHERE key = ?`).bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

export async function setMeta(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare(`INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .bind(key, value)
    .run();
}

export async function putSnapshot(
  db: D1Database,
  id: string,
  weekStartIso: string,
  data: unknown
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO snapshots (id, week_start, data, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, created_at = excluded.created_at`
    )
    .bind(id, weekStartIso, JSON.stringify(data), new Date().toISOString())
    .run();
}

export async function getSnapshot(db: D1Database, id: string): Promise<any | null> {
  const row = await db
    .prepare(`SELECT data FROM snapshots WHERE id = ?`)
    .bind(id)
    .first<{ data: string }>();
  if (!row) return null;
  try {
    return JSON.parse(row.data);
  } catch {
    return null;
  }
}

export async function listSnapshotIds(db: D1Database, limit = 20): Promise<string[]> {
  const { results } = await db
    .prepare(`SELECT id FROM snapshots ORDER BY id DESC LIMIT ?`)
    .bind(limit)
    .all<{ id: string }>();
  return (results ?? []).map((r) => r.id);
}

/** Recent wishes for the live ticker. */
export async function getRecentWishes(db: D1Database, limit = 20): Promise<
  Array<Wish & { cluster_slug: string; cluster_title: string }>
> {
  const { results } = await db
    .prepare(
      `SELECT w.id, w.cluster_id, w.need, w.need_generic, w.context, w.client, w.model,
              w.source_key, w.ip_key, w.seeded, w.flagged, w.flag_reason, w.created_at,
              c.slug AS cluster_slug, c.title AS cluster_title
       FROM wishes w JOIN clusters c ON c.id = w.cluster_id
       WHERE c.status = 'published'
       ORDER BY w.created_at DESC LIMIT ?`
    )
    .bind(limit)
    .all<Wish & { cluster_slug: string; cluster_title: string }>();
  return results ?? [];
}

/** Wishes created after a timestamp, for the live poll endpoint. */
export async function getWishesSince(
  db: D1Database,
  sinceIso: string,
  limit = 20
): Promise<Array<Wish & { cluster_slug: string; cluster_title: string; cluster_count: number }>> {
  const { results } = await db
    .prepare(
      `SELECT w.id, w.cluster_id, w.need, w.need_generic, w.context, w.client, w.model,
              w.source_key, w.ip_key, w.seeded, w.flagged, w.flag_reason, w.created_at,
              c.slug AS cluster_slug, c.title AS cluster_title, c.count AS cluster_count
       FROM wishes w JOIN clusters c ON c.id = w.cluster_id
       WHERE c.status = 'published' AND w.created_at > ?
       ORDER BY w.created_at DESC LIMIT ?`
    )
    .bind(sinceIso, limit)
    .all<Wish & { cluster_slug: string; cluster_title: string; cluster_count: number }>();
  return results ?? [];
}
