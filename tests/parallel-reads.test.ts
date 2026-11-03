import { describe, it, expect } from "vitest";

import { renderBoard, renderCluster, renderWeekly } from "../src/board";

/**
 * The parallel reads, and what happens when one of them fails.
 *
 * The board, the entry page and the weekly page each start a read that
 * does not depend on the others, so it runs alongside them instead of
 * after them. That is the change that took the board from four
 * sequential D1 round trips to two.
 *
 * The cost of it is that a promise can be left un-awaited. When one read
 * throws, the function unwinds on that error and never reaches the
 * `await` for the promise it started alongside it. An un-awaited and
 * un-handled promise rejection is a second, separate error, reported
 * against the same request, which is exactly the sort of thing a reader
 * sees as an unexplained failure.
 *
 * So every promise that is started alongside another one carries its own
 * rejection handler from the moment it is made.
 *
 * These tests fail if a handler is removed.
 */

/** Collect the unhandled rejections a test run produces. */
function watchUnhandled(): { stop: () => unknown[] } {
  const rejections: unknown[] = [];
  const onUnhandled = (r: unknown) => {
    rejections.push(r);
  };
  process.on("unhandledRejection", onUnhandled);
  return {
    stop: () => {
      process.off("unhandledRejection", onUnhandled);
      return rejections;
    },
  };
}

/** Let the microtask queue and the rejection handler run. */
function settle(): Promise<void> {
  return new Promise((r) => setTimeout(r, 60));
}

const CLUSTER_ROW = {
  id: "c1",
  slug: "s1",
  title: "T",
  title_source: "raw",
  count: 1,
  unique_agents: 1,
  week_count: 0,
  first_seen: "2026-11-01T00:00:00.000Z",
  last_seen: "2026-11-01T00:00:00.000Z",
  status: "published",
  merged_into: null,
  vector: null,
  shipped: 0,
  claim_login: null,
  claim_repo: null,
  claim_note: null,
  claimed_at: null,
  shipped_at: null,
  seeded: 0,
  notes: null,
  created_at: "2026-11-01T00:00:00.000Z",
  updated_at: "2026-11-03T00:00:00.000Z",
};

/**
 * A D1 where every query fails.
 *
 * Both the read that is awaited and the one started alongside it have to
 * fail for the leak to show: if the second read succeeds there is no
 * rejection to go unhandled, and the test would pass against the broken
 * code by accident. A test that passes by coincidence is not a test.
 */
function allFailingDb() {
  const statement = (_sql: string) => ({
    bind: () => statement(_sql),
    all: async () => {
      throw new Error("database is down");
    },
    first: async () => {
      throw new Error("database is down");
    },
    run: async () => {
      throw new Error("database is down");
    },
  });
  return {
    prepare: (sql: string) => statement(sql),
    batch: async () => [],
    exec: async () => {},
  };
}

/**
 * A D1 where the single-cluster read succeeds and the two reads that run
 * alongside each other both fail.
 *
 * This is the shape of the entry page: the cluster is read first and on
 * its own, and the breakdown and the grouped rows are then started
 * together. If the first of those two throws, the second is the promise
 * left un-awaited.
 */
function clusterReadsFailingDb() {
  const statement = (sql: string) => ({
    bind: () => statement(sql),
    all: async () => {
      throw new Error("database is down");
    },
    first: async () => {
      // The cluster itself is read with `WHERE slug = ?`.
      if (sql.includes("FROM clusters WHERE slug")) return CLUSTER_ROW;
      throw new Error("database is down");
    },
    run: async () => {
      throw new Error("database is down");
    },
  });
  return {
    prepare: (sql: string) => statement(sql),
    batch: async () => [],
    exec: async () => {},
  };
}

const ENV = {
  SITE_URL: "https://toolswanted.dev",
  SITE_NAME: "Tools Wanted",
} as never;

describe("the parallel reads", () => {
  it("renderBoard does not leave the stats promise unhandled when the cluster read fails", async () => {
    const watch = watchUnhandled();
    // Every query fails, so the read that was started alongside the
    // cluster read has a rejection of its own to leak.
    await expect(
      renderBoard({ DB: allFailingDb() } as never, {})
    ).rejects.toThrow(/database is down/);
    await settle();
    expect(watch.stop()).toEqual([]);
  });

  it("renderCluster does not leave the grouped-read promise unhandled when the breakdown fails", async () => {
    const watch = watchUnhandled();
    // The cluster is found, and then both of the reads started alongside
    // each other fail. The first one to throw leaves the other dangling.
    await expect(
      renderCluster({ DB: clusterReadsFailingDb() } as never, "s1")
    ).rejects.toThrow(/database is down/);
    await settle();
    expect(watch.stop()).toEqual([]);
  });

  it("renderWeekly does not leave the stats promise unhandled when the cluster read fails", async () => {
    const watch = watchUnhandled();
    await expect(
      renderWeekly({ DB: allFailingDb() } as never)
    ).rejects.toThrow(/database is down/);
    await settle();
    expect(watch.stop()).toEqual([]);
  });
});
