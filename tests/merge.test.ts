import { describe, it, expect, beforeEach } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { mergeClusters } from "../src/db";
import { freshDb as testDb } from "./helpers/db";

/**
 * The merge is the one place where the board's headline number, the count
 * of independent agents, is recomputed from scratch. It is also the one
 * place where a bug does not show up in a screenshot: the page still
 * renders, the cards still line up, and the number is just wrong.
 *
 * These tests run the real SQL against a real SQLite database built from
 * the production migrations, because the bugs are in the SQL, not in the
 * TypeScript.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Build a database with the production schema. */
/** A database with the board's schema on it, from the migrations directory. */
const freshDb = () => testDb();

/**
 * A D1 shim over node:sqlite, exposing only what `mergeClusters` uses.
 */
function d1(db: DatabaseSync) {
  const run = (sql: string, params: unknown[] = []) => {
    const stmt = db.prepare(sql);
    // D1's .bind() takes positional args; node:sqlite takes an array.
    const info = stmt.run(...(params as never[]));
    return { meta: { changes: Number(info.changes) }, success: true };
  };
  const all = (sql: string, params: unknown[] = []) => {
    const rows = db.prepare(sql).all(...(params as never[]));
    return { results: rows };
  };
  const prepare = (sql: string) => {
    const stmt = {
      bind: (...params: unknown[]) => ({
        run: async () => run(sql, params),
        all: async () => all(sql, params),
        first: async () => db.prepare(sql).get(...(params as never[])) ?? null,
      }),
      run: async () => run(sql),
      all: async () => all(sql),
      first: async () => db.prepare(sql).get() ?? null,
    };
    return stmt;
  };
  return {
    prepare,
    batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => {
      // D1's batch takes already-bound statements.
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

function seedCluster(db: DatabaseSync, id: string, slug: string, seeded = 0) {
  db.prepare(
    `INSERT INTO clusters (id, slug, title, title_source, count, unique_agents, week_count,
       first_seen, last_seen, status, shipped, seeded, created_at, updated_at)
     VALUES (?, ?, ?, 'raw', 0, 0, 0, ?, ?, 'published', 0, ?, ?, ?)`
  ).run(id, slug, slug, NOW, NOW, seeded, NOW, NOW);
}

function seedWish(
  db: DatabaseSync,
  id: string,
  clusterId: string,
  sourceKey: string,
  seeded = 0,
  client = "claude-code"
) {
  db.prepare(
    `INSERT INTO wishes (id, cluster_id, need, need_generic, context, client, model,
       source_key, ip_key, seeded, flagged, flag_reason, created_at)
     VALUES (?, ?, 'need', NULL, NULL, ?, NULL, ?, 'ip', ?, 0, NULL, ?)`
  ).run(id, clusterId, client, sourceKey, seeded, NOW);
  db.prepare(
    `INSERT INTO votes (source_key, cluster_id, created_at, seeded) VALUES (?, ?, ?, ?)
     ON CONFLICT(source_key, cluster_id) DO NOTHING`
  ).run(sourceKey, clusterId, NOW, seeded);
}

function countVotes(db: DatabaseSync, clusterId: string, seeded?: number) {
  const sql = seeded === undefined
    ? "SELECT COUNT(*) AS n FROM votes WHERE cluster_id = ?"
    : "SELECT COUNT(*) AS n FROM votes WHERE cluster_id = ? AND seeded = ?";
  const params = seeded === undefined ? [clusterId] : [clusterId, seeded];
  return Number((db.prepare(sql).get(...(params as never[])) as { n: number }).n);
}

function clusterRow(db: DatabaseSync, id: string) {
  return db.prepare("SELECT * FROM clusters WHERE id = ?").get(id) as {
    count: number;
    unique_agents: number;
    week_count: number;
    status: string;
  };
}

describe("merging two clusters", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = freshDb();
  });

  it("keeps a seeded vote seeded", async () => {
    // The votes table carries a `seeded` flag, and it is the flag that
    // decides whether an operator's own wish counts as agent demand. The
    // merge moved the votes across without the flag, so every seeded vote
    // turned into a real agent vote the moment two clusters were merged.
    seedCluster(db, "c1", "one");
    seedCluster(db, "c2", "two");
    seedWish(db, "w1", "c1", "seed-source-1", 1);
    seedWish(db, "w2", "c2", "agent-alpha", 0);

    expect(countVotes(db, "c2", 1)).toBe(0);
    expect(countVotes(db, "c2", 0)).toBe(1);

    await mergeClusters(d1(db), "c1", "c2");

    expect(countVotes(db, "c2", 1)).toBe(1);
    expect(countVotes(db, "c2", 0)).toBe(1);
  });

  it("does not let a seeded wish count as an independent agent", async () => {
    // The board's headline number is the count of independent agents. A
    // seeded wish is the operator's own and is excluded everywhere else:
    // `recordWish` checks `seeded = 0`, and the migration backfill
    // recomputed `unique_agents` with `WHERE seeded = 0`. The merge
    // recomputed it with no filter at all.
    seedCluster(db, "c1", "one");
    seedCluster(db, "c2", "two");
    seedWish(db, "w1", "c1", "seed-source-1", 1);
    seedWish(db, "w2", "c2", "seed-source-1", 1);
    seedWish(db, "w3", "c2", "agent-alpha", 0);

    await mergeClusters(d1(db), "c1", "c2");

    // One real agent, not two.
    expect(clusterRow(db, "c2").unique_agents).toBe(1);
  });

  it("keeps the client breakdown of the merged cluster", async () => {
    // The board card shows which agents wanted a thing. The merge moved
    // the wishes and deleted the from-cluster's breakdown rows, but never
    // added the from-cluster's clients to the into-cluster, so the card
    // silently lost them.
    seedCluster(db, "c1", "one");
    seedCluster(db, "c2", "two");
    seedWish(db, "w1", "c1", "agent-alpha", 0, "cursor");
    seedWish(db, "w2", "c2", "agent-beta", 0, "claude-code");
    db.prepare(
      `INSERT INTO cluster_clients (cluster_id, client, count) VALUES (?, ?, ?)`
    ).run("c1", "cursor", 1);
    db.prepare(
      `INSERT INTO cluster_clients (cluster_id, client, count) VALUES (?, ?, ?)`
    ).run("c2", "claude-code", 1);

    await mergeClusters(d1(db), "c1", "c2");

    const rows = db
      .prepare("SELECT client, count FROM cluster_clients WHERE cluster_id = ? ORDER BY client")
      .all("c2") as Array<{ client: string; count: number }>;
    expect(rows).toEqual([
      { client: "claude-code", count: 1 },
      { client: "cursor", count: 1 },
    ]);
  });

  it("does not let one agent count twice when it voted in both clusters", async () => {
    // The one-vote-per-agent rule is checked against the votes table, so
    // the merge has to keep one vote per agent. This is the case the
    // ON CONFLICT clause was written for, and it does hold.
    seedCluster(db, "c1", "one");
    seedCluster(db, "c2", "two");
    seedWish(db, "w1", "c1", "agent-alpha", 0);
    seedWish(db, "w2", "c2", "agent-alpha", 0);

    await mergeClusters(d1(db), "c1", "c2");

    expect(countVotes(db, "c2")).toBe(1);
    expect(clusterRow(db, "c2").unique_agents).toBe(1);
  });

  it("lets a real agent vote win over a seeded one for the same agent", async () => {
    // An agent that filed a seeded wish in one cluster and a real one in
    // the other keeps one vote after the merge. That vote has to be a
    // real one: the agent counted, and the seeded flag does not follow.
    // With `ON CONFLICT DO NOTHING` the row that landed first won, so a
    // seeded vote could shadow a real one and the agent stopped counting.
    seedCluster(db, "c1", "one");
    seedCluster(db, "c2", "two");
    seedWish(db, "w1", "c1", "agent-alpha", 1); // seeded
    seedWish(db, "w2", "c2", "agent-alpha", 0); // real

    await mergeClusters(d1(db), "c1", "c2");

    expect(countVotes(db, "c2")).toBe(1);
    expect(countVotes(db, "c2", 0)).toBe(1);
    expect(clusterRow(db, "c2").unique_agents).toBe(1);
  });

  it("recomputes the wish count from the wishes, not the old counter", async () => {
    seedCluster(db, "c1", "one");
    seedCluster(db, "c2", "two");
    seedWish(db, "w1", "c1", "agent-alpha", 0);
    seedWish(db, "w2", "c2", "agent-beta", 0);

    await mergeClusters(d1(db), "c1", "c2");

    expect(clusterRow(db, "c2").count).toBe(2);
  });

  it("marks the merged cluster as merged", async () => {
    seedCluster(db, "c1", "one");
    seedCluster(db, "c2", "two");
    await mergeClusters(d1(db), "c1", "c2");
    expect(clusterRow(db, "c1").status).toBe("merged");
  });

  it("recomputes the weekly count from the wishes, not the old counters", async () => {
    // The board card shows two numbers about the same entry: how many
    // wishes there are in total, and how many were filed this week. The
    // second can never be bigger than the first.
    //
    // It was. `week_count` was a running counter that was never reset at
    // the week boundary, and the merge recomputed `count` from the wishes
    // while leaving `week_count` alone, so it kept the sum of both
    // clusters' weekly counts. The published entry read "17 this week"
    // against 15 wishes in total.
    seedCluster(db, "c1", "one");
    seedCluster(db, "c2", "two");
    seedWish(db, "w1", "c1", "agent-alpha", 0);
    seedWish(db, "w2", "c2", "agent-beta", 0);
    // Stale counters, the way the running total left them.
    db.prepare("UPDATE clusters SET week_count = 10 WHERE id = ?").run("c1");
    db.prepare("UPDATE clusters SET week_count = 7 WHERE id = ?").run("c2");

    await mergeClusters(d1(db), "c1", "c2");

    const row = clusterRow(db, "c2");
    expect(row.count).toBe(2);
    expect(row.week_count).toBe(2);
    expect(row.week_count).toBeLessThanOrEqual(row.count);
  });

  it("does not count a wish from a previous week as a wish this week", async () => {
    // `week_count` is the number of wishes filed in the current week, so a
    // wish from before the week started is not one of them. The counter
    // used to be a running total, so it carried wishes forward forever.
    const lastWeek = "2026-10-20T12:00:00.000Z";
    seedCluster(db, "c1", "one");
    seedWish(db, "w1", "c1", "agent-alpha", 0);
    db.prepare("UPDATE wishes SET created_at = ? WHERE id = ?").run(lastWeek, "w1");
    db.prepare("UPDATE clusters SET count = 1, week_count = 1 WHERE id = ?").run("c1");

    await mergeClusters(d1(db), "c1", "c1");

    const row = clusterRow(db, "c1");
    expect(row.count).toBe(1);
    expect(row.week_count).toBe(0);
  });
});
