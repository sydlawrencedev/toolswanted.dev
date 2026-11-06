import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { renderWeekly } from "../src/board";
import { freshDb as testDb } from "./helpers/db";

/**
 * An empty table is a table with headers and nothing in it.
 *
 * The weekly page rendered a five-column table with a header row and a
 * body row that said "No wishes yet." when there were no wishes.
 *
 * A table is a promise about the shape of the data. The headers say
 * there are columns for a rank, a capability, an agent count, a weekly
 * count and a status, and the empty row says there is a rank column
 * spanning five columns and containing nothing. A screen reader
 * announces the column headers before it reaches the row that says
 * there is no data, so the reader hears "#, Capability, Agents, This
 * week, Status" and then "No wishes yet".
 *
 * The board already knows the right answer. Its empty state is a
 * block of copy, not a table. The weekly page should do the same
 * thing: when there is nothing to tabulate, do not tabulate.
 *
 * These tests render the weekly page against a real SQLite database
 * built from the production migrations.
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

function env(db: DatabaseSync) {
  return {
    DB: d1(db),
    SITE_URL: "https://toolswanted.dev",
    SITE_NAME: "Tools Wanted",
  } as never;
}

/** A board with one published cluster, so the weekly page has a row. */
function populatedBoard(): DatabaseSync {
  const db = freshDb();
  db.prepare(
    `INSERT INTO clusters (id, slug, title, title_source, count, unique_agents, week_count,
       first_seen, last_seen, status, shipped, seeded, created_at, updated_at)
     VALUES ('c1', 'a-wish', 'A wish', 'raw', 3, 3, 3, ?, ?, 'published', 0, 0, ?, ?)`
  ).run(NOW, NOW, NOW, NOW);
  for (let i = 0; i < 3; i++) {
    db.prepare(
      `INSERT INTO wishes (id, cluster_id, need, need_generic, context, client, model,
         source_key, ip_key, seeded, flagged, flag_reason, created_at)
       VALUES (?, 'c1', 'need', NULL, NULL, 'claude-code', NULL, ?, 'ip', 0, 0, NULL, ?)`
    ).run(`w${i}`, `src-${i}`, NOW);
  }
  return db;
}

describe("the weekly page with no rows", () => {
  it("does not render a table", async () => {
    // The failure this catches: the page renders a five-column table
    // with a "No wishes yet" row in it.
    const html = await renderWeekly(env(freshDb()));

    expect(html).not.toContain("<table");
  });

  it("renders an empty state instead", async () => {
    // The confirmer. The fix is not to delete the table and leave a
    // hole. There has to be something in its place that says the
    // board is empty.
    const html = await renderWeekly(env(freshDb()));

    expect(html).toMatch(/class="empty"/);
  });

  it("does not leave the table headers behind", async () => {
    // The headers are the part a screen reader reads first. "Capability,
    // Agents, This week, Status" followed by "there is nothing here"
    // is the shape the fix removes.
    const html = await renderWeekly(env(freshDb()));

    expect(html).not.toContain("<thead");
    expect(html).not.toContain("<th>");
  });

  it("does not leave the placeholder row behind", async () => {
    const html = await renderWeekly(env(freshDb()));

    expect(html).not.toContain("No wishes yet");
  });
});

describe("the weekly page with rows", () => {
  it("still renders the table", async () => {
    // The two-sided check. A fix that removes the table always, rather
    // than when it is empty, has broken the page for the case it
    // exists to serve.
    const html = await renderWeekly(env(populatedBoard()));

    expect(html).toContain("<table");
    expect(html).toContain("<th>");
    expect(html).toContain("A wish");
  });

  it("does not show the empty state when there are rows", async () => {
    const html = await renderWeekly(env(populatedBoard()));

    expect(html).not.toMatch(/class="empty"/);
  });
});
