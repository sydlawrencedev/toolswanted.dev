import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { renderCluster } from "../src/board";

/**
 * The cluster page's sample table.
 *
 * The table showed one row per distinct capability, with a count of how
 * many times it had been asked for. The count was taken over the twelve
 * most recent wishes, because that is what the query asked for.
 *
 * On the live board that was visible: the cluster had fifteen wishes and
 * the table showed twelve. Two wishes were missing from the table
 * entirely, and one row said "3 times" where the truth was 4.
 *
 * The count is the number the reader compares against the total on the
 * page. A truncated count and a real one look the same, and the reader
 * has no way to tell which they are looking at.
 *
 * These tests drive the real renderer against a real database.
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
    results: db.prepare(sql).all(...(params as never[])),
  });
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

function env(db: DatabaseSync) {
  return {
    DB: d1(db),
    SITE_URL: "https://toolswanted.dev",
    SITE_NAME: "Tools Wanted",
    SESSION_SECRET: "test-secret-value",
    MATCH_THRESHOLD: "0.723",
    SERVER_MATCH_THRESHOLD: "0.57",
    AUTO_PUBLISH_WISHES: "3",
    RATE_LIMIT_WISHES_PER_HOUR: "30",
    RATE_LIMIT_SEARCH_PER_MINUTE: "30",
    REGISTRY_CRON: "*/5 * * * *",
    caches: { default: { match: async () => undefined, put: async () => {}, delete: async () => {} } },
  } as never;
}

/**
 * A cluster with twenty wishes: fifteen of one capability and five of
 * another. The fifteen are spread over more than a page of samples, so a
 * query that caps at the twelve most recent misses three of them.
 */
function seedCluster(db: DatabaseSync, id: string, slug: string) {
  db.prepare(
    `INSERT INTO clusters (id, slug, title, title_source, count, unique_agents, week_count,
       first_seen, last_seen, status, vector, shipped, claim_login, claim_repo, seeded, created_at, updated_at)
     VALUES (?, ?, 'A capability', 'raw', 20, 15, 0, ?, ?, 'published', NULL, 0, NULL, NULL, 0, ?, ?)`
  ).run(id, slug, NOW, NOW, NOW, NOW);

  for (let i = 0; i < 15; i++) {
    db.prepare(
      `INSERT INTO wishes (id, cluster_id, need, need_generic, context, client, model,
         source_key, ip_key, seeded, flagged, flag_reason, created_at)
       VALUES (?, ?, 'raw need', 'The same capability', NULL, ?, NULL, ?, 'ip', 0, 0, NULL, ?)`
    ).run(`w-${id}-a-${i}`, id, i % 2 === 0 ? "claude-code" : "other", `src-a-${i}`, NOW);
  }
  for (let i = 0; i < 5; i++) {
    db.prepare(
      `INSERT INTO wishes (id, cluster_id, need, need_generic, context, client, model,
         source_key, ip_key, seeded, flagged, flag_reason, created_at)
       VALUES (?, ?, 'other need', 'Another capability', NULL, 'cursor', NULL, ?, 'ip', 0, 0, NULL, ?)`
    ).run(`w-${id}-b-${i}`, id, `src-b-${i}`, NOW);
  }
}

describe("the cluster page's sample table", () => {
  it("counts every wish on the cluster, not only the twelve most recent", async () => {
    const db = freshDb();
    seedCluster(db, "c1", "a-wish");

    const html = await renderCluster(env(db), "a-wish");

    // The truth is fifteen and five. A query capped at twelve shows
    // "8 times" and "4 times" instead.
    expect(html).toContain("15 times");
    expect(html).toContain("5 times");
  });

  it("shows a row for every distinct capability on the cluster", async () => {
    const db = freshDb();
    seedCluster(db, "c1", "a-wish");

    const html = await renderCluster(env(db), "a-wish");

    expect(html).toContain("The same capability");
    expect(html).toContain("Another capability");
  });

  it("adds up to the number of wishes the page says there are", async () => {
    // The reader can do this sum. It has to work.
    const db = freshDb();
    seedCluster(db, "c1", "a-wish");

    const html = await renderCluster(env(db), "a-wish");

    const counts = [...(html?.matchAll(/>(\d+) times</g) ?? [])].map((m) => Number(m[1]));
    expect(counts.length).toBeGreaterThan(0);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(20);
  });
});
