import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * The board's stats query must not count the registry mirror.
 *
 * The mirror holds 55,293 servers. `getStats` reported its size with
 * `SELECT COUNT(*) FROM servers`, and the board's stats query runs on
 * every board render, every weekly page and every `/api/stats` call.
 *
 * D1 charges a row read for every row a query touches, including the
 * rows it walks in an index, so a count over the whole table is 55,293
 * row reads. That is five million row reads a day, and on 6 November
 * 2026 the daily read limit took the whole site down at 13:00 UTC: the
 * board, the weekly page and the About page all returned 503.
 *
 * So the count is written down by the crawl and read back as one row.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const db = readFileSync(join(ROOT, "src", "db.ts"), "utf8");

describe("the board's stats query", () => {
  it("reads the server count rather than counting the mirror", () => {
    // The failure this catches: `COUNT(*) FROM servers` inside the
    // stats query. It is 55,293 row reads on every render.
    const stats = db.slice(db.indexOf("export async function getStats"));
    const query = stats.slice(0, stats.indexOf("export async function setServerCount"));

    expect(query).not.toMatch(/COUNT\(\*\)\s*FROM\s+servers/i);
    expect(query).toMatch(/FROM server_counts/i);
  });

  it("has somewhere to write the count down", () => {
    // The count is maintained by the crawl. If the table is missing,
    // the stats query returns zero and nobody notices, because zero is
    // a figure the board can produce.
    expect(db).toMatch(/export async function setServerCount/);
    expect(db).toMatch(/INSERT INTO server_counts/);
  });

  it("has a migration that creates the table and seeds it", () => {
    const migration = readFileSync(
      join(ROOT, "migrations", "0010_server_count.sql"),
      "utf8"
    );
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS server_counts/);
    // The seed matters: the table has to have the current count in it
    // before the first crawl runs, or the board reports zero servers
    // until the crawl gets to it.
    expect(migration).toMatch(/INSERT INTO server_counts/);
  });
});

describe("the crawl", () => {
  const registry = readFileSync(join(ROOT, "src", "registry.ts"), "utf8");

  it("writes the count down after it changes the mirror", () => {
    // The crawl is the only thing that changes the count, so it is the
    // only thing that has to write it.
    expect(registry).toMatch(/setServerCount\(/);
  });

  it("does not count the mirror to do it", () => {
    // A count inside the crawl would be the same 55,293 row reads, just
    // five minutes apart instead of on every render.
    expect(registry).not.toMatch(/COUNT\(\*\)\s*FROM\s+servers/i);
  });
});
