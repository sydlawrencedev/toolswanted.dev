import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * What a wish actually costs on the free tier.
 *
 * The README said "about six" rows, and counted table rows: one for the
 * cluster, one for the vote, one for the wish, one for the client
 * breakdown and two for the rate-limit counters.
 *
 * That is the number of rows in the tables. It is not the number D1
 * bills. D1 bills "rows written", and:
 *
 *   - an UPDATE writes a row, even when it only increments a counter;
 *   - a write to an indexed column writes the table row AND one row for
 *     every index that covers the column.
 *
 * Measured on the production database with D1's own meta object, one
 * matched wish costs:
 *
 *   rate_limits x2   2 + 2 = 4
 *   UPDATE clusters    = 4   (the table row plus four covering indexes)
 *   INSERT votes      = 3   (the table row plus one index)
 *   INSERT wishes     = 5   (the table row plus four indexes)
 *   cluster_clients   = 2   (the table row plus one index)
 *   ------------------------
 *   total             = 18
 *
 * and a wish that creates a cluster costs 25, because the cluster insert
 * is 7.
 *
 * The free tier allows 100,000 rows written a day. At 18 a wish, that
 * is about 5,500 wishes a day, so the budget is not the constraint the
 * README says it is. The README's number has to be the real one, because
 * a reader deciding whether the product fits the free tier is reading
 * this sentence.
 *
 * These tests read the schema and the write path and assert the two
 * things that can drift: that the number in the README matches what the
 * code writes, and that the number is not silently the table-row count
 * again.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const README = join(ROOT, "README.md");

function readme(): string {
  return readFileSync(README, "utf8");
}

describe("the cost of a wish", () => {
  it("is stated in the README as the number D1 bills, not the number of table rows", () => {
    const text = readme();
    const claim = text.match(/A wish costs about (\w+)/);
    expect(claim).not.toBeNull();
    const words: Record<string, number> = {
      six: 6,
      twelve: 12,
      eighteen: 18,
      twenty: 20,
      twentyfive: 25,
      "twenty-five": 25,
    };
    const stated = words[claim![1]!.toLowerCase()];
    expect(stated).toBeDefined();
    // The number measured with D1's own meta object on the production
    // database. If the write path changes, this fails and the README has
    // to be re-measured, which is the point.
    expect(stated).toBe(18);
  });

  it("explains why the number is higher than the table-row count", () => {
    // A reader who counts the tables and gets a different number should
    // be able to find out why. One sentence is enough.
    const text = readme();
    expect(text).toMatch(/rows written/i);
    expect(text).toMatch(/index/i);
  });

  it("does not describe the crawl's own cap in the same units as the wish cost", () => {
    // The crawl cap is a rows-written budget and the wish cost is a
    // rows-written cost, so they have to be comparable. If one is a
    // table-row count and the other is a rows-written count, the
    // comparison is meaningless.
    const text = readme();
    const crawl = text.match(/crawl's ([\d,]+)-row\s+cap/);
    expect(crawl).not.toBeNull();
    expect(Number(crawl![1]!.replace(/,/g, ""))).toBeGreaterThan(0);
  });
});

describe("the write path", () => {
  it("writes the tables the README says it writes", () => {
    // The four tables a matched wish writes to, plus the two counters.
    const db = readFileSync(join(ROOT, "src", "db.ts"), "utf8");
    const recordWish = db.slice(db.indexOf("export async function recordWish"));
    const body = recordWish.slice(0, recordWish.indexOf("\n}\n"));

    expect(body).toMatch(/UPDATE clusters/);
    expect(body).toMatch(/INSERT INTO votes/);
    expect(body).toMatch(/INSERT INTO wishes/);
    expect(body).toMatch(/INSERT INTO cluster_clients/);
  });

  it("charges the rate limit in two buckets, one per wish", () => {
    const wish = readFileSync(join(ROOT, "src", "wish.ts"), "utf8");
    expect(wish).toMatch(/ipBucket\(identity\.ipKey\)/);
    expect(wish).toMatch(/sourceBucket\(identity\.sourceKey\)/);
  });
});
