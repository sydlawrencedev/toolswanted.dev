import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { getClientBreakdown } from "../src/db";
import { describeClients } from "../src/wish";

/**
 * The client breakdown, and who gets the whole of it.
 *
 * The board card shows the top four clients and says how many more there
 * are. The entry page shows a table headed "Which agents filed these",
 * and that table is the whole story — so it has to be the whole list.
 *
 * The perf change made the query windowed: it counts per cluster and
 * client, keeps the top few pairs, and carries the total with it so the
 * card can say "+N more". That window is right for the card and wrong
 * for the table, which showed six agents of ten and said nothing about
 * the four it dropped.
 *
 * So the window is a parameter. The card asks for what it renders; the
 * table asks for all of it.
 *
 * These tests run against a real SQLite built from the production
 * migrations, because the check is a query.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = join(ROOT, "migrations");

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of [
    "0001_init.sql",
    "0002_claims_unique.sql",
    "0003_servers_latest.sql",
    "0004_neuron_budget.sql",
    "0005_og_images.sql",
    "0006_usage_budget.sql",
    "0007_votes_seeded.sql",
  ]) {
    db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  return db;
}

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

function seedCluster(db: DatabaseSync, id: string): void {
  db.prepare(
    `INSERT INTO clusters (id, slug, title, title_source, count, unique_agents, week_count,
       first_seen, last_seen, status, shipped, seeded, created_at, updated_at)
     VALUES (?, ?, ?, 'raw', 0, 0, 0, ?, ?, 'published', 0, 0, ?, ?)`
  ).run(id, id, id, NOW, NOW, NOW, NOW);
}

/** A cluster with `clients` distinct clients, one wish each. */
function seedClients(db: DatabaseSync, clusterId: string, clients: string[]): void {
  const ins = db.prepare(
    `INSERT INTO wishes (id, cluster_id, need, need_generic, context, client, model,
       source_key, ip_key, seeded, flagged, flag_reason, created_at)
     VALUES (?, ?, 'need', NULL, NULL, ?, NULL, ?, 'ip', 0, 0, NULL, ?)`
  );
  clients.forEach((client, i) => ins.run(`w_${clusterId}_${i}`, clusterId, client, `s_${client}`, NOW));
}

describe("the client breakdown", () => {
  it("returns every client when the caller asks for all of them", async () => {
    const db = freshDb();
    seedCluster(db, "c1");
    seedClients(db, "c1", ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]);

    const all = await getClientBreakdown(d1(db), ["c1"], Number.MAX_SAFE_INTEGER);
    const list = all.get("c1") ?? [];

    expect(list.length).toBe(10);
    expect(list.map((c) => c.client).sort()).toEqual(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]);
  });

  it("returns the top few when the caller asks for the card's window", async () => {
    const db = freshDb();
    seedCluster(db, "c1");
    seedClients(db, "c1", ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]);

    const top = await getClientBreakdown(d1(db), ["c1"], 6);
    const list = top.get("c1") ?? [];

    expect(list.length).toBe(6);
    // The total is the real number of distinct clients, not the size of
    // the window, so the card can say how many are hidden.
    expect(list[0]!.total).toBe(10);
  });

  it("counts the seeded wishes out of the breakdown", async () => {
    const db = freshDb();
    seedCluster(db, "c1");
    seedClients(db, "c1", ["a", "b"]);
    db.prepare(
      `INSERT INTO wishes (id, cluster_id, need, need_generic, context, client, model,
         source_key, ip_key, seeded, flagged, flag_reason, created_at)
       VALUES ('w_seed', 'c1', 'need', NULL, NULL, 'seeded-agent', NULL, 's_seed', 'ip', 1, 0, NULL, ?)`
    ).run(NOW);

    const all = await getClientBreakdown(d1(db), ["c1"], Number.MAX_SAFE_INTEGER);
    const list = all.get("c1") ?? [];

    expect(list.map((c) => c.client)).toEqual(["a", "b"]);
    expect(list[0]!.total).toBe(2);
  });

  it("counts the wishes per client, not the clients", async () => {
    const db = freshDb();
    seedCluster(db, "c1");
    seedClients(db, "c1", ["a"]);
    db.prepare(
      `INSERT INTO wishes (id, cluster_id, need, need_generic, context, client, model,
         source_key, ip_key, seeded, flagged, flag_reason, created_at)
       VALUES ('w_a2', 'c1', 'need', NULL, NULL, 'a', NULL, 's_a2', 'ip', 0, 0, NULL, ?)`
    ).run(NOW);

    const all = await getClientBreakdown(d1(db), ["c1"], Number.MAX_SAFE_INTEGER);
    const list = all.get("c1") ?? [];

    expect(list.length).toBe(1);
    expect(list[0]!.count).toBe(2);
  });
});

describe("the client list on the MCP card", () => {
  it("says how many are hidden rather than dropping them silently", async () => {
    const db = freshDb();
    seedCluster(db, "c1");
    seedClients(db, "c1", ["a", "b", "c", "d", "e", "f", "g", "h"]);

    const breakdown = await getClientBreakdown(d1(db), ["c1"], 6);
    const list = breakdown.get("c1") ?? [];

    // The MCP card shows four and says how many more there are.
    const text = describeClients(list);
    expect(text).toContain("+4 more");
  });

  it("says nothing about hidden clients when there are none", async () => {
    const db = freshDb();
    seedCluster(db, "c1");
    seedClients(db, "c1", ["a", "b"]);

    const breakdown = await getClientBreakdown(d1(db), ["c1"], 6);
    const list = breakdown.get("c1") ?? [];

    expect(describeClients(list)).not.toContain("more");
  });
});
