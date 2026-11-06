import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { getClusterBySlug, getClusterBySlugAnyStatus } from "../src/db";
import { freshDb as testDb } from "./helpers/db";

/**
 * A cluster that has not met the publish threshold is not public.
 *
 * The board's rule is that a capability appears once three independent
 * agents want it. The lookup that served the public surfaces had no
 * status filter, so a cluster sitting in the review queue was readable
 * at `/w/{slug}`, served at `/api/cluster/{slug}`, turned up in
 * `/api/search` results, and had a working badge and OG poster. The
 * board's own list hid it.
 *
 * Both statements were true at once: the entry needed three agents, and
 * a reader could go and read it with one. The threshold was theatre.
 *
 * It is also what made seeding unsafe. A seeded wish creates a pending
 * cluster, so with the gate open a seeded entry was findable and
 * readable, which is exactly what the seeded labelling exists to
 * prevent.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const NOW = "2026-11-05T10:00:00.000Z";

/** A database with the board's schema on it, from the migrations directory. */
const freshDb = () => testDb();

function d1(db: DatabaseSync) {
  return {
    prepare: (sql: string) => {
      const run = (params: unknown[] = []) =>
        db.prepare(sql).run(...(params as never[]));
      const all = (params: unknown[] = []) =>
        db.prepare(sql).all(...(params as never[]));
      return {
        bind: (...params: unknown[]) => ({
          run: async () => run(params),
          all: async () => all(params),
          first: async () => db.prepare(sql).get(...(params as never[])) ?? null,
        }),
        run: async () => run(),
        all: async () => all(),
        first: async () => db.prepare(sql).get() ?? null,
      };
    },
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

/** A board with one published cluster and one pending cluster. */
function board(): DatabaseSync {
  const db = freshDb();
  const insert = db.prepare(
    `INSERT INTO clusters (id, slug, title, title_source, count, unique_agents, week_count,
       first_seen, last_seen, status, shipped, seeded, created_at, updated_at)
     VALUES (?, ?, ?, 'raw', 1, 1, 1, ?, ?, ?, 0, 0, ?, ?)`
  );
  insert.run("c1", "published-entry", "A published entry", NOW, NOW, "published", NOW, NOW);
  insert.run("c2", "pending-entry", "A pending entry", NOW, NOW, "pending", NOW, NOW);
  return db;
}

describe("the public cluster lookup", () => {
  it("does not return a pending cluster", async () => {
    // The failure this catches: the lookup had no status filter, so a
    // cluster waiting in the review queue came back from every public
    // surface that used it.
    const cluster = await getClusterBySlug(d1(board()), "pending-entry");
    expect(cluster).toBeNull();
  });

  it("returns a published cluster", async () => {
    // The other side of the same rule. The board's own entries must
    // still be readable.
    const cluster = await getClusterBySlug(d1(board()), "published-entry");
    expect(cluster).not.toBeNull();
    expect(cluster!.status).toBe("published");
  });

  it("returns a pending cluster to the moderation surfaces", async () => {
    // The confirmer. The admin panel has to be able to see the review
    // queue, so there is a second lookup for it. It is named so that a
    // public surface calling it by accident is visible in review.
    const cluster = await getClusterBySlugAnyStatus(d1(board()), "pending-entry");
    expect(cluster).not.toBeNull();
    expect(cluster!.status).toBe("pending");
  });
});

describe("the public surfaces", () => {
  const source = readFileSync(join(ROOT, "src", "api.ts"), "utf8");
  const index = readFileSync(join(ROOT, "src", "index.ts"), "utf8");
  const boardSource = readFileSync(join(ROOT, "src", "board.ts"), "utf8");

  it("search returns published clusters only", () => {
    // The search was the quiet leak: it excluded merged and rejected
    // clusters, which left pending in. A reader could find an entry
    // that had not met the threshold by searching for it.
    const wish = readFileSync(join(ROOT, "src", "wish.ts"), "utf8");
    const checks = wish.match(/cluster\.status\s*!==\s*"published"/g) ?? [];
    expect(checks.length).toBeGreaterThanOrEqual(2);
  });

  it("the badge route uses the public lookup", () => {
    // A badge is a thing a builder publishes. It has to point at
    // something a reader can open.
    const badge = index.slice(index.indexOf("async function renderBadge"));
    expect(badge).toContain("getClusterBySlug(env.DB, slug)");
  });

  it("the OG route falls back to the default card for an unpublished entry", () => {
    // A link preview is the first thing a reader sees, and it has to be
    // a thing that exists.
    const og = index.slice(index.indexOf("async function renderOg"));
    expect(og).toContain("unpublished");
  });

  it("the cluster page only renders a published cluster", () => {
    // The board's cluster page looked the cluster up with the same
    // public lookup, so it inherited the fix.
    expect(boardSource).toContain("getClusterBySlug(env.DB, slug)");
  });

  it("the API cluster route uses the public lookup", () => {
    expect(source).toContain("getClusterBySlug(env.DB, decodeURIComponent(slug))");
  });
});
