import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { recordWish } from "../src/db";
import { freshDb as testDb } from "./helpers/db";

/**
 * The weekly count.
 *
 * The board card shows two numbers about the same entry: how many wishes
 * there are in total, and how many were filed this week. The second can
 * never be bigger than the first.
 *
 * It was. `week_count` was a running counter: it went up by one on every
 * wish, and it was never reset at the week boundary. On the live board
 * the published entry read "26 this week" against 25 wishes in total,
 * and it was two over because two wishes had been folded into the entry
 * by a merge, which moved the wishes across but not the counter.
 *
 * A reader cannot tell a drifted count from a real one, and the weekly
 * count is the number a builder reads to decide whether a capability is
 * heating up.
 *
 * The count is now taken from the wishes table, so it cannot drift. These
 * tests run against a real SQLite built from the production migrations.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** A database with the board's schema on it, from the migrations directory. */
const freshDb = () => testDb();

function d1(db: DatabaseSync) {
  const run = (sql: string, params: unknown[] = []) => {
    const info = db.prepare(sql).run(...(params as never[]));
    return { meta: { changes: Number(info.changes) }, success: true };
  };
  const all = (sql: string, params: unknown[] = []) => ({
    results: db.prepare(sql).all(...(params as never[])) as unknown[],
  });
  const prepare = (sql: string) => ({
    bind: (...params: unknown[]) => ({
      run: async () => run(sql, params),
      all: async () => all(sql, params),
      first: async () => db.prepare(sql).get(...(params as never[])) ?? null,
    }),
    run: async () => run(sql),
    all: async () => all(sql),
    first: async () => db.prepare(sql).get() ?? null,
  });
  return {
    prepare,
    batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => {
      const results = [];
      for (const s of stmts) results.push(await s.run());
      return results;
    },
    exec: async (sql: string) => {
      db.exec(sql);
    },
  } as never;
}

const NOW = "2026-11-03T12:00:00.000Z";
const WEEK_START = "2026-11-02T00:00:00.000Z";

function seedCluster(db: DatabaseSync, id = "c1"): void {
  db.prepare(
    `INSERT INTO clusters (id, slug, title, title_source, count, unique_agents, week_count,
       first_seen, last_seen, status, shipped, seeded, created_at, updated_at)
     VALUES (?, ?, ?, 'raw', 0, 0, 0, ?, ?, 'published', 0, 0, ?, ?)`
  ).run(id, id, id, NOW, NOW, NOW, NOW);
}

function wish(
  db: DatabaseSync,
  clusterId: string,
  id: string,
  sourceKey: string,
  now = NOW
): void {
  db.prepare(
    `INSERT INTO wishes (id, cluster_id, need, need_generic, context, client, model,
       source_key, ip_key, seeded, flagged, flag_reason, created_at)
     VALUES (?, ?, 'need', NULL, NULL, 'claude-code', NULL, ?, 'ip', 0, 0, NULL, ?)`
  ).run(id, clusterId, sourceKey, now);
}

async function record(
  db: DatabaseSync,
  clusterId: string,
  sourceKey: string,
  now = NOW,
  weekStart = WEEK_START
): Promise<void> {
  await recordWish(d1(db), {
    clusterId,
    need: "need",
    context: null,
    client: "claude-code",
    model: null,
    sourceKey,
    ipKey: "ip",
    now,
    flagged: false,
    flagReason: null,
    weekStart,
    autoPublishThreshold: 3,
  });
}

function counters(db: DatabaseSync, id = "c1") {
  return db.prepare("SELECT count, week_count, unique_agents FROM clusters WHERE id = ?").get(id) as {
    count: number;
    week_count: number;
    unique_agents: number;
  };
}

describe("the weekly count on a cluster", () => {
  it("counts only the wishes filed this week", async () => {
    const db = freshDb();
    seedCluster(db);
    // Two wishes from before the week started, three from this week.
    // They are put in the wishes table directly, so the cluster's own
    // counters start at zero and only the three recorded wishes move
    // them. What matters here is the weekly count: three, not five.
    wish(db, "c1", "old1", "s0", "2026-10-30T10:00:00.000Z");
    wish(db, "c1", "old2", "s1", "2026-10-31T10:00:00.000Z");

    await record(db, "c1", "s2");
    await record(db, "c1", "s3");
    await record(db, "c1", "s4");

    const row = counters(db);
    expect(row.count).toBe(3);
    // The two older wishes are not in this week.
    expect(row.week_count).toBe(3);
    // The weekly count can never be bigger than the total.
    expect(row.week_count).toBeLessThanOrEqual(row.count);
  });

  it("does not count a wish from last week after the week rolls over", async () => {
    const db = freshDb();
    seedCluster(db);

    // A wish filed in the old week.
    await record(db, "c1", "s1", "2026-10-30T10:00:00.000Z", "2026-10-26T00:00:00.000Z");
    expect(counters(db).week_count).toBe(1);

    // The week rolls over. The new week's count starts at zero, and the
    // old wish is not in it. A running counter would still be showing 1.
    await record(db, "c1", "s2", "2026-11-03T10:00:00.000Z", "2026-11-02T00:00:00.000Z");

    const row = counters(db);
    expect(row.count).toBe(2);
    expect(row.week_count).toBe(1);
  });

  it("does not keep a stale weekly count when the counter was wrong", async () => {
    const db = freshDb();
    seedCluster(db);
    // A drifted counter, the way a running total leaves it.
    db.prepare("UPDATE clusters SET week_count = 99 WHERE id = 'c1'").run();

    await record(db, "c1", "s1");

    // The count is taken from the wishes, so the drift is gone.
    expect(counters(db).week_count).toBe(1);
  });

  it("does not grow the weekly count past the number of wishes", async () => {
    const db = freshDb();
    seedCluster(db);
    for (let i = 0; i < 12; i++) {
      await record(db, "c1", `s${i}`);
    }
    const row = counters(db);
    expect(row.count).toBe(12);
    expect(row.week_count).toBe(12);
    expect(row.week_count).toBeLessThanOrEqual(row.count);
  });

  it("counts a seeded wish as a wish this week", async () => {
    const db = freshDb();
    seedCluster(db);
    await recordWish(d1(db), {
      clusterId: "c1",
      need: "need",
      context: null,
      client: "other",
      model: null,
      sourceKey: "seeded-source",
      ipKey: "ip",
      now: NOW,
      flagged: false,
      flagReason: null,
      seeded: true,
      weekStart: WEEK_START,
      autoPublishThreshold: 3,
    });
    const row = counters(db);
    expect(row.count).toBe(1);
    expect(row.week_count).toBe(1);
    // A seeded wish is not an independent agent.
    expect(row.unique_agents).toBe(0);
  });
});
