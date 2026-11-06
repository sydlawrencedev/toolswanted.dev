import { describe, it, expect, beforeEach } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { getGroupedSamples } from "../src/db";
import { renderCluster } from "../src/board";
import { freshDb as testDb } from "./helpers/db";

/**
 * The cluster page shows one row per distinct capability, with the count
 * of how many times it was asked for.
 *
 * The count used to be counted in JavaScript over the twelve most recent
 * wishes, so it was a count of the sample, not of the cluster. A reader
 * could not tell a truncated count from a real one, and the table is the
 * page a builder reads before deciding what to build.
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

function seedCluster(db: DatabaseSync, id: string, slug: string, count: number) {
  db.prepare(
    `INSERT INTO clusters (id, slug, title, title_source, count, unique_agents, week_count,
       first_seen, last_seen, status, shipped, seeded, created_at, updated_at)
     VALUES (?, ?, ?, 'raw', ?, 0, 0, ?, ?, 'published', 0, 0, ?, ?)`
  ).run(id, slug, slug, count, NOW, NOW, NOW, NOW);
}

function seedWish(
  db: DatabaseSync,
  id: string,
  clusterId: string,
  need: string,
  generic: string | null,
  client: string | null,
  seeded = 0,
  day = 3
) {
  const when = `2026-11-0${day}T00:00:00.000Z`;
  db.prepare(
    `INSERT INTO wishes (id, cluster_id, need, need_generic, context, client, model,
       source_key, ip_key, seeded, flagged, flag_reason, created_at)
     VALUES (?, ?, ?, ?, NULL, ?, NULL, ?, 'ip', ?, 0, NULL, ?)`
  ).run(id, clusterId, need, generic, client, `src-${id}`, seeded, when);
}

describe("the grouped samples on a cluster page", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = freshDb();
  });

  it("counts every wish on the cluster, not the twelve most recent", async () => {
    // Twenty wishes, all for the same capability. The count has to be
    // twenty, not twelve.
    seedCluster(db, "c1", "one", 20);
    for (let i = 0; i < 20; i++) {
      seedWish(db, `w${i}`, "c1", "Read planning PDFs", "Read planning PDFs", "claude-code", 0, 1);
    }

    const groups = await getGroupedSamples(d1(db), "c1");
    expect(groups).toHaveLength(1);
    expect(groups[0]!.count).toBe(20);
  });

  it("counts the wishes outside the twelve most recent", async () => {
    // The first eight are older than the twelve most recent, so a count
    // taken over the sample window would miss them.
    seedCluster(db, "c1", "one", 20);
    for (let i = 0; i < 8; i++) {
      seedWish(db, `old${i}`, "c1", "Read planning PDFs", "Read planning PDFs", "claude-code", 0, 1);
    }
    for (let i = 0; i < 12; i++) {
      seedWish(db, `new${i}`, "c1", "Read planning PDFs", "Read planning PDFs", "claude-code", 0, 3);
    }

    const groups = await getGroupedSamples(d1(db), "c1");
    expect(groups[0]!.count).toBe(20);
  });

  it("groups by the generic text when there is one", async () => {
    seedCluster(db, "c1", "one", 3);
    seedWish(db, "w1", "c1", "read planning pdfs pls", "Read planning PDFs", "claude-code");
    seedWish(db, "w2", "c1", "read planning pdfs", "Read planning PDFs", "cursor");
    seedWish(db, "w3", "c1", "something else", "Something else", "codex");

    const groups = await getGroupedSamples(d1(db), "c1");
    const first = groups.find((g) => g.text === "Read planning PDFs");
    expect(first?.count).toBe(2);
  });

  it("groups by the raw text when there is no generic one", async () => {
    seedCluster(db, "c1", "one", 2);
    seedWish(db, "w1", "c1", "Read planning PDFs", null, "claude-code");
    seedWish(db, "w2", "c1", "Read planning PDFs", null, "cursor");

    const groups = await getGroupedSamples(d1(db), "c1");
    expect(groups).toHaveLength(1);
    expect(groups[0]!.count).toBe(2);
  });

  it("lists the clients that asked for it", async () => {
    seedCluster(db, "c1", "one", 3);
    seedWish(db, "w1", "c1", "Read planning PDFs", "Read planning PDFs", "claude-code");
    seedWish(db, "w2", "c1", "Read planning PDFs", "Read planning PDFs", "cursor");
    seedWish(db, "w3", "c1", "Read planning PDFs", "Read planning PDFs", "cursor");

    const groups = await getGroupedSamples(d1(db), "c1");
    expect(groups[0]!.clients.sort()).toEqual(["claude-code", "cursor"]);
  });

  it("separates the seeded wishes from the real ones", async () => {
    seedCluster(db, "c1", "one", 4);
    seedWish(db, "w1", "c1", "Read planning PDFs", "Read planning PDFs", "claude-code", 1);
    seedWish(db, "w2", "c1", "Read planning PDFs", "Read planning PDFs", "claude-code", 1);
    seedWish(db, "w3", "c1", "Read planning PDFs", "Read planning PDFs", "claude-code", 0);
    seedWish(db, "w4", "c1", "Read planning PDFs", "Read planning PDFs", "claude-code", 0);

    const groups = await getGroupedSamples(d1(db), "c1");
    expect(groups[0]!.count).toBe(4);
    expect(groups[0]!.seeded).toBe(2);
  });

  it("uses the most recent date for the group", async () => {
    seedCluster(db, "c1", "one", 2);
    seedWish(db, "w1", "c1", "Read planning PDFs", "Read planning PDFs", "claude-code", 0, 1);
    seedWish(db, "w2", "c1", "Read planning PDFs", "Read planning PDFs", "claude-code", 0, 3);

    const groups = await getGroupedSamples(d1(db), "c1");
    expect(groups[0]!.when).toBe("2026-11-03T00:00:00.000Z");
  });

  it("renders the true count on the cluster page", async () => {
    seedCluster(db, "c1", "one", 20);
    for (let i = 0; i < 20; i++) {
      seedWish(db, `w${i}`, "c1", "Read planning PDFs", "Read planning PDFs", "claude-code", 0, 1);
    }

    const html = await renderCluster(
      { DB: d1(db), SITE_URL: "https://toolswanted.dev" } as never,
      "one"
    );
    expect(html).toContain("20 times");
    expect(html).not.toContain("12 times");
  });
});
