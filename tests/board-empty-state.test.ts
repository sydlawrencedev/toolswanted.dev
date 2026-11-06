import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { renderBoard } from "../src/board";
import { freshDb as testDb } from "./helpers/db";

/**
 * The hero and the body cannot contradict each other.
 *
 * The board is two sections: a hero with a count of what is on the
 * board, and a body with the list of it. When the board has no
 * published clusters, the two said different things.
 *
 * The hero printed "0 wishes from 0 agents, in 0 clusters. 0 shipped."
 * and the body printed "Nothing on the board yet under this filter."
 *
 * The body's sentence is wrong on its own terms. There is nothing under
 * the filter because the board is empty, not because the filter is
 * hiding something. The reader is told to go and file a wish, which is
 * the right advice, but the reason given is a fiction: a filter that
 * filters nothing cannot be hiding anything.
 *
 * And the hero is wrong in the other direction. It prints the cluster
 * count as a statistic, in the same sentence as the wish count and the
 * agent count, which reads as "here is the shape of the board" rather
 * than "there is no board yet".
 *
 * So the fix is one rule: when there are no published clusters, the
 * hero does not print cluster statistics and the body does not print a
 * filter-scoped empty message. The two halves have to agree about
 * whether the board is empty or the filter is narrow.
 *
 * These tests use a real SQLite database built from the production
 * migrations, so the board is rendered from the same reads the Worker
 * makes.
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

/** The hero section, which is the part above the board's list. */
function heroOf(html: string): string {
  const start = html.indexOf('<section class="hero">');
  const end = html.indexOf('<section class="board">');
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end);
}

/** The board section, which is the list and its empty state. */
function bodyOf(html: string): string {
  const start = html.indexOf('<section class="board">');
  const end = html.indexOf("</section>", html.indexOf("liveTickerScript") === -1 ? start : start);
  return html.slice(start, start + 4000);
}

/**
 * A board with no published clusters.
 *
 * Nothing is seeded, so `listClusters` returns nothing and `getStats`
 * reports zero clusters.
 */
function emptyBoard(): DatabaseSync {
  return freshDb();
}

/**
 * A board with one published cluster and three independent agents, so
 * the two states can be told apart.
 */
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

describe("the board with no published clusters", () => {
  it("does not print cluster statistics in the hero", async () => {
    // The failure this catches: the hero prints "in 0 clusters" and
    // "0 shipped" as statistics, in the same sentence as the wish and
    // agent counts, which reads as a description of the board rather
    // than an admission that there is not one.
    const html = await renderBoard(env(emptyBoard()), { filter: "all" });
    const hero = heroOf(html);

    expect(hero).not.toMatch(/\b0 clusters\b/);
    expect(hero).not.toMatch(/\bin 0\b/);
  });

  it("does not print a filter-scoped empty message in the body", async () => {
    // The failure this catches: the body says "Nothing on the board
    // yet under this filter", which blames the filter for an empty
    // board. Nothing is being filtered out. The board is empty.
    const html = await renderBoard(env(emptyBoard()), { filter: "all" });
    const body = bodyOf(html);

    expect(body).not.toContain("under this filter");
  });

  it("says the board is empty in the same terms in both halves", async () => {
    // The confirmer. The fix is not to delete the sentence, it is to
    // make the two halves agree. There has to be an empty state, and
    // it has to say that the board is empty rather than that a filter
    // is hiding something.
    const html = await renderBoard(env(emptyBoard()), { filter: "all" });
    const body = bodyOf(html);

    expect(body).toMatch(/class="empty"/);
    expect(body).toMatch(/nothing on the board|board is empty|no wishes yet/i);
    expect(body).not.toContain("under this filter");
  });

  it("still tells the reader what to do", async () => {
    // The empty state has to give the reader the next step, or the fix
    // has replaced a confusing message with no message.
    const html = await renderBoard(env(emptyBoard()), { filter: "all" });
    const body = bodyOf(html);

    expect(body).toMatch(/href="\/agents"/);
  });
});

describe("the board with published clusters", () => {
  it("still prints the cluster statistics in the hero", async () => {
    // The two-sided check. A fix that stops the hero printing cluster
    // counts when the board is empty, but stops it printing them
    // always, has not fixed the contradiction. It has removed the
    // statistics.
    const html = await renderBoard(env(populatedBoard()), { filter: "all" });
    const hero = heroOf(html);

    expect(hero).toMatch(/\b1 cluster\b/);
    expect(hero).toMatch(/\b3 agents\b/);
  });

  it("does not print an empty state when there are clusters", async () => {
    const html = await renderBoard(env(populatedBoard()), { filter: "all" });
    const body = bodyOf(html);

    expect(body).not.toMatch(/class="empty"/);
  });
});
