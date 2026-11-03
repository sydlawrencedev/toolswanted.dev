import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { renderBoard, renderCluster, renderWeekly } from "../src/board";

/**
 * The query count per page.
 *
 * The board's production cost is dominated by its D1 reads, not by the
 * HTML it builds. The free plan allows fifty subrequests per invocation
 * and ten milliseconds of CPU, and a page that reads the database five
 * times is five times slower than a page that reads it once.
 *
 * The README says every page is a single query. This counts them, so
 * that claim is checked rather than believed.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = join(ROOT, "migrations");
const NOW = "2026-11-03T12:00:00.000Z";

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

/** A D1 shim that counts the queries it is asked to run. */
function countingD1(db: DatabaseSync, counter: { n: number; sql: string[] }) {
  const run = (sql: string, params: unknown[] = []) => {
    counter.n++;
    counter.sql.push(sql.replace(/\s+/g, " ").trim().slice(0, 90));
    const info = db.prepare(sql).run(...(params as never[]));
    return { meta: { changes: Number(info.changes) }, success: true };
  };
  const all = (sql: string, params: unknown[] = []) => {
    counter.n++;
    counter.sql.push(sql.replace(/\s+/g, " ").trim().slice(0, 90));
    return { results: db.prepare(sql).all(...(params as never[])) };
  };
  const first = (sql: string, params: unknown[] = []) => {
    counter.n++;
    counter.sql.push(sql.replace(/\s+/g, " ").trim().slice(0, 90));
    return db.prepare(sql).get(...(params as never[])) ?? null;
  };
  const prepare = (sql: string) => {
    const stmt = {
      bind: (...params: unknown[]) => ({
        run: async () => run(sql, params),
        all: async () => all(sql, params),
        first: async () => first(sql, params),
      }),
      run: async () => run(sql),
      all: async () => all(sql),
      first: async () => first(sql),
    };
    return stmt;
  };
  return {
    prepare,
    batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => {
      // A batch is one round trip, but it is still several statements.
      for (const s of stmts) {
        counter.n++;
        counter.sql.push("(batched) " + s.run.toString().slice(0, 0));
      }
      const results = [];
      for (const s of stmts) results.push(await s.run());
      return results;
    },
    exec: async (sql: string) => {
      db.exec(sql);
    },
  } as never;
}

function seed(): DatabaseSync {
  const db = freshDb();
  const insertCluster = db.prepare(
    `INSERT INTO clusters (id, slug, title, title_source, count, unique_agents, week_count,
       first_seen, last_seen, status, shipped, claim_login, claim_repo, seeded, created_at, updated_at)
     VALUES (?, ?, ?, 'raw', 10, 5, 0, ?, ?, 'published', 0, NULL, NULL, 0, ?, ?)`
  );
  const insertWish = db.prepare(
    `INSERT INTO wishes (id, cluster_id, need, need_generic, context, client, model,
       source_key, ip_key, seeded, flagged, flag_reason, created_at)
     VALUES (?, ?, ?, ?, NULL, 'claude-code', NULL, ?, 'ip', 0, 0, NULL, ?)`
  );
  const insertVote = db.prepare(
    `INSERT INTO votes (source_key, cluster_id, created_at, seeded) VALUES (?, ?, ?, 0)`
  );
  db.exec("BEGIN");
  for (let c = 0; c < 40; c++) {
    insertCluster.run(`c${c}`, `capability-${c}`, `Capability ${c}`, NOW, NOW, NOW, NOW);
    for (let w = 0; w < 16; w++) {
      insertWish.run(`w${c}_${w}`, `c${c}`, "need", "Capability", `src${c}_${w}`, NOW);
      insertVote.run(`src${c}_${w}`, `c${c}`, NOW);
    }
  }
  db.exec("COMMIT");
  return db;
}

describe("the queries a page runs", () => {
  it("counts them", async () => {
    const db = seed();

    const count = async (name: string, fn: (env: never) => Promise<unknown>) => {
      const counter = { n: 0, sql: [] as string[] };
      const env = {
        DB: countingD1(db, counter),
        SITE_URL: "https://toolswanted.dev",
        SITE_NAME: "Tools Wanted",
      } as never;
      await fn(env);
      console.log(`  ${name.padEnd(22)} ${counter.n} queries`);
      for (const s of counter.sql) console.log(`      ${s}`);
      return counter.n;
    };

    console.log("");
    const board = await count("renderBoard", (e) => renderBoard(e, {}));
    const cluster = await count("renderCluster", (e) => renderCluster(e, "capability-0"));
    const weekly = await count("renderWeekly", (e) => renderWeekly(e));

    // The board used to be one query per cluster for the samples, which
    // was sixty round trips for a board of sixty clusters. It is one
    // query for all of them now.
    expect(board).toBeLessThan(10);
    expect(cluster).toBeLessThan(10);
    expect(weekly).toBeLessThan(10);
  });
});
