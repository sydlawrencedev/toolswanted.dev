import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { staleOgImages } from "../src/db";

/**
 * A poster is a rendering of a number, and the number moves.
 *
 * The poster on the live board said four agents while the board said
 * nine, because it was rendered before the rule that counts seeded wishes
 * changed. Nothing noticed: the image was stored, served, and never
 * compared with the cluster it draws.
 *
 * These tests run against a real SQLite built from the production
 * migrations, because the check is a query.
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

/**
 * The D1-shaped wrapper the query functions expect.
 *
 * D1's prepared statement carries `all`, `first` and `run` directly, and
 * `bind` returns another statement with the same shape. So both have to
 * work, and the bound one has to carry the arguments.
 */
function d1(db: DatabaseSync) {
  const shape = (stmt: any, args: unknown[]) => ({
    async all<T>() {
      return { results: stmt.all(...(args as never[])) as T[] };
    },
    async first<T>() {
      const row = stmt.get(...(args as never[])) as T | undefined;
      return row ?? null;
    },
    async run() {
      stmt.run(...(args as never[]));
      return { success: true };
    },
    bind(...more: unknown[]) {
      return shape(stmt, [...args, ...more]);
    },
  });
  return {
    prepare(sql: string) {
      return shape(db.prepare(sql), []);
    },
  } as never;
}

function seedCluster(db: DatabaseSync, updatedAt: string): void {
  db.prepare(
    `INSERT INTO clusters (id, slug, title, title_source, count, unique_agents, week_count,
       first_seen, last_seen, status, shipped, seeded, created_at, updated_at)
     VALUES ('c1', 'read-planning-pdfs', 'Read planning PDFs', 'seed', 3, 3, 3,
       '2026-11-02T10:00:00.000Z', '2026-11-02T10:00:00.000Z', 'published', 0, 1,
       '2026-11-02T10:00:00.000Z', ?)`
  ).run(updatedAt);
}

function seedPoster(db: DatabaseSync, updatedAt: string): void {
  db.prepare(
    `INSERT INTO og_images (slug, bytes, updated_at) VALUES ('read-planning-pdfs', x'89504e47', ?)`
  ).run(updatedAt);
}

describe("stale OG images", () => {
  it("reports a poster older than the entry it draws", async () => {
    const db = freshDb();
    seedCluster(db, "2026-11-03T10:00:00.000Z");
    seedPoster(db, "2026-11-02T10:00:00.000Z");

    const stale = await staleOgImages(d1(db));
    expect(stale).toHaveLength(1);
    expect(stale[0]!.slug).toBe("read-planning-pdfs");
    expect(stale[0]!.og_updated_at).toBe("2026-11-02T10:00:00.000Z");
    expect(stale[0]!.cluster_updated_at).toBe("2026-11-03T10:00:00.000Z");
  });

  it("reports nothing when the poster is current", async () => {
    const db = freshDb();
    seedCluster(db, "2026-11-02T10:00:00.000Z");
    seedPoster(db, "2026-11-03T10:00:00.000Z");

    const stale = await staleOgImages(d1(db));
    expect(stale).toEqual([]);
  });

  it("reports nothing when the poster is newer than the entry", async () => {
    const db = freshDb();
    seedCluster(db, "2026-11-02T10:00:00.000Z");
    seedPoster(db, "2026-11-03T10:00:00.000Z");

    expect(await staleOgImages(d1(db))).toEqual([]);
  });

  it("ignores a poster with no entry behind it", async () => {
    const db = freshDb();
    seedPoster(db, "2026-11-02T10:00:00.000Z");

    expect(await staleOgImages(d1(db))).toEqual([]);
  });

  it("reports every stale poster, not just the first", async () => {
    const db = freshDb();
    db.prepare(
      `INSERT INTO clusters (id, slug, title, title_source, count, unique_agents, week_count,
         first_seen, last_seen, status, shipped, seeded, created_at, updated_at)
       VALUES ('c1', 'a', 'A', 'seed', 1, 1, 1, '2026-11-02T10:00:00.000Z',
         '2026-11-02T10:00:00.000Z', 'published', 0, 1, '2026-11-02T10:00:00.000Z',
         '2026-11-03T10:00:00.000Z')`
    ).run();
    db.prepare(
      `INSERT INTO clusters (id, slug, title, title_source, count, unique_agents, week_count,
         first_seen, last_seen, status, shipped, seeded, created_at, updated_at)
       VALUES ('c2', 'b', 'B', 'seed', 1, 1, 1, '2026-11-02T10:00:00.000Z',
         '2026-11-02T10:00:00.000Z', 'published', 0, 1, '2026-11-02T10:00:00.000Z',
         '2026-11-03T10:00:00.000Z')`
    ).run();
    db.prepare(
      `INSERT INTO og_images (slug, bytes, updated_at) VALUES ('a', x'89504e47', '2026-11-02T10:00:00.000Z')`
    ).run();
    db.prepare(
      `INSERT INTO og_images (slug, bytes, updated_at) VALUES ('b', x'89504e47', '2026-11-03T10:00:00.000Z')`
    ).run();

    const stale = await staleOgImages(d1(db));
    expect(stale.map((s) => s.slug)).toEqual(["a"]);
  });
});
