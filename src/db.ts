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
import { newId } from "./types";

/** True when D1 refused a write because the daily row limit is spent. */
export function isWriteLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /row write limit|exceeded D1/i.test(message);
}

export const CLUSTER_COLUMNS = `id, slug, title, title_source, count, unique_agents, week_count,
  first_seen, last_seen, status, merged_into, vector, shipped, claim_login, claim_repo,
  claim_note, claimed_at, shipped_at, seeded, notes, created_at, updated_at`;

const CLUSTER_COLUMNS_C = CLUSTER_COLUMNS.replace(/(\w+)/g, "c.$1");

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
  sort?: "count" | "recent" | "rising" | "new";
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
  const order =
    opts.sort === "recent"
      ? "c.last_seen DESC"
      : opts.sort === "new"
        ? "c.first_seen DESC"
        : opts.sort === "rising"
          ? "c.week_count DESC, c.count DESC"
          : "c.count DESC, c.week_count DESC, c.last_seen DESC";

  const where: string[] = ["c.status = ?"];
  const binds: unknown[] = [status];

  // "Shipped" is a state, not a sort. A builder whose own wish shipped has
  // no other way to find out: there was no route to it anywhere.
  if (opts.filter === "shipped") {
    where.push("c.shipped = 1");
  }

  if (opts.client && opts.client !== "all") {
    where.push(
      "EXISTS (SELECT 1 FROM cluster_clients cc WHERE cc.cluster_id = c.id AND cc.client = ?)"
    );
    binds.push(opts.client);
  }

  const sql = `SELECT ${CLUSTER_COLUMNS_C} FROM clusters c WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ?`;
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
      `SELECT ${CLUSTER_COLUMNS} FROM clusters
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
    const { results } = await db
      .prepare(
        `SELECT id, cluster_id, need, need_generic, context, client, model, source_key, ip_key,
                seeded, flagged, flag_reason, created_at
         FROM wishes WHERE cluster_id IN (${placeholders})
         ORDER BY created_at DESC`
      )
      .bind(...chunk)
      .all<Wish>();
    for (const wish of results ?? []) {
      const list = out.get(wish.cluster_id) ?? [];
      if (list.length < perCluster) {
        list.push(wish);
        out.set(wish.cluster_id, list);
      }
    }
  }
  return out;
}

/** Client breakdown for a set of clusters. */
export async function getClientBreakdown(
  db: D1Database,
  clusterIds: string[]
): Promise<Map<string, Array<{ client: string; count: number }>>> {
  const out = new Map<string, Array<{ client: string; count: number }>>();
  if (clusterIds.length === 0) return out;
  const placeholders = clusterIds.map(() => "?").join(",");
  const { results } = await db
    .prepare(
      `SELECT cluster_id, client, count FROM cluster_clients
       WHERE cluster_id IN (${placeholders}) ORDER BY count DESC`
    )
    .bind(...clusterIds)
    .all<{ cluster_id: string; client: string; count: number }>();
  for (const row of results ?? []) {
    const list = out.get(row.cluster_id) ?? [];
    list.push({ client: row.client, count: row.count });
    out.set(row.cluster_id, list);
  }
  return out;
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
  const isNewWeek = input.now >= input.weekStart;

  // One batch, one round trip. The order matters: the counter update reads
  // the votes table to decide whether this source is new to the cluster, so
  // it has to run before the vote is inserted.
  //
  // A seeded wish is the operator's own, not an agent's. It is counted as a
  // wish, and it is labelled, but it is NOT counted as an independent
  // agent and it cannot auto-publish a cluster on its own. Otherwise the
  // board's headline number — "wanted by N agents" — would be counting the
  // operator's own wishes as agent demand.
  const results = await db.batch([
    db
      .prepare(
        `UPDATE clusters SET
           count = count + 1,
           unique_agents = unique_agents + CASE
             WHEN ? = 1 THEN 0
             WHEN EXISTS (SELECT 1 FROM votes WHERE source_key = ? AND cluster_id = ? AND seeded = 0) THEN 0
             ELSE 1 END,
           week_count = week_count + ?,
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
        isNewWeek ? 1 : 0,
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
        `INSERT INTO cluster_clients (cluster_id, client, count) VALUES (?, ?, 1)
         ON CONFLICT(cluster_id, client) DO UPDATE SET count = count + 1`
      )
      .bind(input.clusterId, input.client),
  ]);

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
    // independent agent in the target — so three wishes from one agent
    // could auto-publish a cluster, which is exactly what the rule
    // exists to prevent.
    //
    // The insert is `ON CONFLICT DO NOTHING`: an agent that voted in both
    // clusters keeps one vote, and the count of distinct agents is
    // unchanged by the merge.
    db
      .prepare(
        `INSERT INTO votes (source_key, cluster_id, created_at)
         SELECT source_key, ?, created_at FROM votes WHERE cluster_id = ?
         ON CONFLICT(source_key, cluster_id) DO NOTHING`
      )
      .bind(intoId, fromId),
    db.prepare(`DELETE FROM votes WHERE cluster_id = ?`).bind(fromId),
    db.prepare(`UPDATE cluster_clients SET count = 0 WHERE cluster_id = ?`).bind(fromId),
    db.prepare(`DELETE FROM cluster_clients WHERE cluster_id = ?`).bind(fromId),
    db
      .prepare(
        `UPDATE clusters SET status = 'merged', merged_into = ?, updated_at = ? WHERE id = ?`
      )
      .bind(intoId, now, fromId),
  ]);
  await db
    .prepare(
      `UPDATE clusters SET count = (SELECT COUNT(*) FROM wishes WHERE cluster_id = ?),
         unique_agents = (SELECT COUNT(DISTINCT source_key) FROM wishes WHERE cluster_id = ?),
         updated_at = ?
       WHERE id = ?`
    )
    .bind(intoId, intoId, now, intoId)
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
): Promise<Uint8Array | null> {
  const row = await db
    .prepare(`SELECT bytes FROM og_images WHERE slug = ?`)
    .bind(slug)
    .first<{ bytes: Uint8Array }>();
  if (!row?.bytes) return null;
  // D1 hands the blob back as an array-like that Response() will not accept
  // as a body, so make it a real byte array.
  return row.bytes instanceof Uint8Array ? row.bytes : new Uint8Array(row.bytes as any);
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
