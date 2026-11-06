import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { renderAbout } from "../src/board";
import { getStats } from "../src/db";
import { freshDb as testDb } from "./helpers/db";

/**
 * The numbers in the product copy.
 *
 * The About page carried a measurement in the prose: "on 4 November 2026
 * the whole board held 20 independent agents across 4 distinct IP
 * addresses, with 12 on the published entry".
 *
 * Three things are wrong with a number written into a template string.
 *
 * It goes stale the moment a wish is filed, and nothing notices: the
 * page keeps saying 20 agents to a reader who can count 21 in the hero
 * above it. The date in the sentence is what made it read as a
 * measurement rather than a guess, and it is the date that turns a stale
 * number into a false one.
 *
 * It cannot be checked. Every other number on the product is read from
 * the database, so it is right by construction. This one was typed in.
 *
 * And it is a claim about the size of a community, made in the present
 * tense, about a sample that is thin and mostly one machine counted more
 * than once. The paragraph says so itself: "The count is not the size of
 * a community." A number that cannot be re-derived makes that caveat
 * unverifiable too.
 *
 * So the page reads the numbers live. These tests fail while the
 * measurement is in the template string, and pass once it comes from
 * `getStats`.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOARD_SRC = join(ROOT, "src", "board.ts");

const SOURCE = readFileSync(BOARD_SRC, "utf8");

/**
 * A date in words, as it would appear in the copy: "4 November 2026",
 * "on 4 November", "November 2026".
 *
 * A number in prose that names when it was measured is a measurement,
 * and a measurement written into a template string is stale by
 * definition.
 */
const DATED_MEASUREMENT =
  /\b(?:on\s+)?\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b|\bon\s+\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/i;

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

const env = {
  DB: d1(freshDb()),
  SITE_URL: "https://toolswanted.dev",
  SITE_NAME: "Tools Wanted",
} as never;

/**
 * The source of the About page, and nothing after it.
 *
 * The function is bounded by the next top-level `export` so the check
 * is about the About page and not about whatever follows it.
 */
function aboutSource(): string {
  const start = SOURCE.search(/export (?:async )?function renderAbout/);
  if (start < 0) throw new Error("no renderAbout in the source");
  const rest = SOURCE.slice(start);
  const next = rest.slice(1).search(/\nexport (?:async )?function /);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

/**
 * Render the About page with a board behind it.
 *
 * There are two ways the page can get live numbers, and the fix may
 * take either:
 *
 * 1. The page reads the board itself, and becomes async.
 * 2. The page stays sync and the caller passes the numbers in.
 *
 * The claim under test is "the page prints the board's real numbers",
 * not "the page calls `getStats`". So this helper tries the page's own
 * read first, and falls back to handing it the numbers a caller would
 * have fetched. Both are the same claim, and a test that only accepts
 * one of them is a test of an implementation.
 */
async function aboutWith(db: DatabaseSync): Promise<string> {
  const render = renderAbout as unknown as (
    e: unknown,
    stats?: unknown
  ) => string | Promise<string>;
  const e = {
    DB: d1(db),
    SITE_URL: "https://toolswanted.dev",
    SITE_NAME: "Tools Wanted",
  };

  // Shape 2 first: the caller passes the numbers in. This works for
  // both shapes, because a page that reads the board itself ignores
  // the second argument and reads the same board.
  const stats = await getStats(d1(db));
  const withStats = await render(e, stats);
  if (typeof withStats === "string" && withStats.length > 0) return withStats;

  // Shape 1: the page reads the board itself.
  const html = await render(e);
  if (typeof html === "string" && html.length > 0) return html;

  throw new Error("the About page rendered nothing");
}

async function about(): Promise<string> {
  return await aboutWith(freshDb());
}

describe("the About page does not carry a measurement in its copy", () => {
  it("has no date-stamped measurement string in the template", () => {
    // The failure this catches: the sentence "on 4 November 2026 the
    // whole board held 20 independent agents across 4 distinct IP
    // addresses, with 12 on the published entry" is written into the
    // template string. It reads as a measurement, it is checked by
    // nobody, and it is wrong the moment a wish is filed.
    expect(SOURCE).not.toMatch(DATED_MEASUREMENT);
  });

  it("does not name a specific board size in the template", () => {
    // The other half of the same fault: even without the date, "20
    // independent agents across 4 distinct IP addresses, with 12 on the
    // published entry" is a typed-in board size. It cannot be true of
    // every board.
    expect(SOURCE).not.toMatch(
      /\d+\s+independent agents across\s+\d+\s+distinct IP addresses/i
    );
    expect(SOURCE).not.toMatch(/with\s+\d+\s+on the published entry/i);
  });

  it("still carries the distinct-IP measurement", async () => {
    // The confirmer, and the part of the sentence that must survive.
    //
    // "The sample is thin" is a feeling. The address count is a
    // measurement, and it is what tells a reader that the agent count
    // is one machine counted more than once. The design notes call it
    // "the single most useful thing the design line can add next".
    //
    // So the fix is not to delete the measurement, it is to read it.
    // A page that drops the address count and keeps saying the sample
    // is thin has lost the evidence and kept the caveat.
    //
    // `tests/audience.test.ts` already asserts this phrase is on the
    // page. This test asserts it is on the page AND that it is not
    // typed in.
    const html = await about();
    expect(html).toMatch(/distinct IP addresses/);
    expect(html).toMatch(/not the size of a community/);
  });

  it("reads the numbers from the database rather than from a constant", () => {
    // The fix is that the page asks the board for the figures rather
    // than carrying them. The read is what makes the number true.
    //
    // Two shapes are acceptable, and the check accepts both:
    //
    // 1. The page reads the board itself: `getStats(env.DB)`.
    // 2. The page stays sync and the caller passes the numbers in, so
    //    the page's signature carries a stats argument.
    //
    // What is not acceptable is the page printing a constant.
    expect(SOURCE).toMatch(/getStats\(/);

    const aboutBlock = aboutSource();
    expect(aboutBlock.length).toBeGreaterThan(0);
    const readsItself = /getStats\(env\.DB\)/.test(aboutBlock);
    const takesIt = /renderAbout\s*\(\s*env\s*:\s*Env\s*,\s*(stats|board)/.test(SOURCE);
    expect(
      readsItself || takesIt,
      "the About page reads the board, or is given the board's numbers"
    ).toBe(true);

    // And it uses the figures it was given rather than a constant.
    expect(aboutBlock).toMatch(
      /(stats|agents|addresses)\.(agents|clusters|wishes|seededWishes|addresses)|\$\{(?:num\()?\s*(stats\.)?(agents|addresses)/
    );
  });
});

describe("the About page shows the live numbers", () => {
  /**
   * A board with three independent agents behind two addresses.
   *
   * Two addresses, so the page's address count is checkable as well
   * as its agent count. If the page printed the old typed-in figures
   * it would say 20 agents across 4 addresses; it has to say 3 across
   * 2.
   */
  function seedTwoAddressBoard(): DatabaseSync {
    const db = freshDb();
    db.prepare(
      `INSERT INTO clusters (id, slug, title, title_source, count, unique_agents, week_count,
         first_seen, last_seen, status, shipped, seeded, created_at, updated_at)
       VALUES ('c1', 'a-wish', 'A wish', 'raw', 3, 3, 3, ?, ?, 'published', 0, 0, ?, ?)`
    ).run(NOW, NOW, NOW, NOW);
    const ips = ["ip-a", "ip-a", "ip-b"];
    for (let i = 0; i < 3; i++) {
      db.prepare(
        `INSERT INTO wishes (id, cluster_id, need, need_generic, context, client, model,
           source_key, ip_key, seeded, flagged, flag_reason, created_at)
         VALUES (?, 'c1', 'need', NULL, NULL, 'claude-code', NULL, ?, ?, 0, 0, NULL, ?)`
      ).run(`w${i}`, `src-${i}`, ips[i]!, NOW);
    }
    return db;
  }

  it("prints the number of independent agents the board actually has", async () => {
    // The confirmer. The board holds three independent agents, so the
    // page must not print the old typed-in 20.
    const html = await aboutWith(seedTwoAddressBoard());

    expect(html).toMatch(/\b3\b/);
    expect(html).not.toContain("20 independent agents");
    expect(html).not.toContain("4 November");
  });

  it("prints the number of addresses the board actually has", async () => {
    // The address count is the measurement that makes "the sample is
    // thin" a fact rather than a feeling. Two addresses, not the four
    // that were typed in.
    const html = await aboutWith(seedTwoAddressBoard());

    expect(html).toMatch(/2\s+distinct IP addresses/);
    expect(html).not.toMatch(/4\s+distinct IP addresses/);
  });

  it("does not print a board size it cannot have derived from the data", async () => {
    // The falsifier, and the same check from the other side: a page
    // that prints no agent count at all has not been fixed, it has had
    // the sentence deleted. The live number has to be there.
    const html = await aboutWith(seedTwoAddressBoard());

    const body = html.slice(html.indexOf("<h1>"), html.indexOf("<footer"));
    expect(body).toMatch(/\b3\b/);
    expect(body).not.toMatch(DATED_MEASUREMENT);
  });
});
