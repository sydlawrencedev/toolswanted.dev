import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import worker from "../src/index";
import { signSession } from "../src/auth";

/**
 * The /ship route is the only route a builder can reach without the
 * operator, so it carries the whole "one builder ships their own wish"
 * rule on its own.
 *
 * These tests drive the real Worker through its fetch handler, against a
 * real SQLite database, because the bugs were in the order of the checks
 * and in what the session was allowed to be.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = join(ROOT, "migrations");

const SECRET = "test-secret-value";

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

function seedCluster(
  db: DatabaseSync,
  id: string,
  slug: string,
  claim: { login: string; repo: string } | null
) {
  db.prepare(
    `INSERT INTO clusters (id, slug, title, title_source, count, unique_agents, week_count,
       first_seen, last_seen, status, shipped, claim_login, claim_repo, seeded, created_at, updated_at)
     VALUES (?, ?, ?, 'raw', 1, 1, 0, ?, ?, 'published', 0, ?, ?, 0, ?, ?)`
  ).run(
    id,
    slug,
    slug,
    NOW,
    NOW,
    claim?.login ?? null,
    claim?.repo ?? null,
    NOW,
    NOW
  );
  db.prepare(
    `INSERT INTO wishes (id, cluster_id, need, need_generic, context, client, model,
       source_key, ip_key, seeded, flagged, flag_reason, created_at)
     VALUES (?, ?, 'need', NULL, NULL, 'claude-code', NULL, 'src', 'ip', 0, 0, NULL, ?)`
  ).run(`w-${id}`, id, NOW);
  db.prepare(
    `INSERT INTO votes (source_key, cluster_id, created_at, seeded) VALUES (?, ?, ?, 0)`
  ).run("src", id, NOW);
}

function env(db: DatabaseSync) {
  return {
    DB: d1(db),
    SITE_URL: "https://toolswanted.dev",
    SITE_NAME: "Tools Wanted",
    SESSION_SECRET: SECRET,
    MATCH_THRESHOLD: "0.723",
    SERVER_MATCH_THRESHOLD: "0.57",
    AUTO_PUBLISH_WISHES: "3",
    RATE_LIMIT_WISHES_PER_HOUR: "30",
    RATE_LIMIT_SEARCH_PER_MINUTE: "30",
    REGISTRY_CRON: "*/5 * * * *",
    caches: { default: { match: async () => undefined, put: async () => {}, delete: async () => {} } },
  } as never;
}

async function postShip(
  db: DatabaseSync,
  slug: string,
  cookie: string | null
): Promise<Response> {
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
  };
  if (cookie) headers.cookie = cookie;
  return worker.fetch(
    new Request("https://toolswanted.dev/ship", {
      method: "POST",
      headers,
      body: new URLSearchParams({ slug }).toString(),
    }),
    env(db),
    { waitUntil: () => {}, passThroughOnException: () => {} } as never
  );
}

function shippedFlag(db: DatabaseSync, id: string): number {
  return Number(
    (db.prepare("SELECT shipped FROM clusters WHERE id = ?").get(id) as { shipped: number }).shipped
  );
}

describe("POST /ship", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = freshDb();
  });

  it("refuses a request with no session", async () => {
    seedCluster(db, "c1", "one", { login: "alice", repo: "https://github.com/alice/thing" });
    const res = await postShip(db, "one", null);
    expect(res.status).toBe(401);
    expect(shippedFlag(db, "c1")).toBe(0);
  });

  it("refuses a builder who did not claim the wish", async () => {
    seedCluster(db, "c1", "one", { login: "alice", repo: "https://github.com/alice/thing" });
    const cookie = `tw_session=${await signSession(
      { login: "bob", id: 2, exp: Date.now() + 60_000 },
      SECRET
    )}`;
    const res = await postShip(db, "one", cookie);
    expect(res.status).toBe(403);
    expect(shippedFlag(db, "c1")).toBe(0);
  });

  it("refuses a session with no login", async () => {
    // A session with an empty login is not a signed-in builder. The
    // pending-claim cookie the server hands to every anonymous visitor
    // who starts a claim is exactly such a token, and it is signed with
    // the same secret in the same format, so it must not be usable as a
    // session.
    seedCluster(db, "c1", "one", { login: "", repo: "https://github.com/alice/thing" });
    const cookie = `tw_session=${await signSession(
      { login: "", id: 0, exp: Date.now() + 60_000 },
      SECRET
    )}`;
    const res = await postShip(db, "one", cookie);
    expect(res.status).toBe(401);
    expect(shippedFlag(db, "c1")).toBe(0);
  });

  it("refuses a session with no login when the wish was claimed by somebody", async () => {
    seedCluster(db, "c1", "one", { login: "alice", repo: "https://github.com/alice/thing" });
    const cookie = `tw_session=${await signSession(
      { login: "", id: 0, exp: Date.now() + 60_000 },
      SECRET
    )}`;
    const res = await postShip(db, "one", cookie);
    expect(res.status).toBe(401);
    expect(shippedFlag(db, "c1")).toBe(0);
  });

  it("refuses a wish that was never claimed", async () => {
    // A wish nobody has claimed has no builder to ship it. The route
    // must say so rather than writing a claim with an empty repo.
    seedCluster(db, "c1", "one", null);
    const cookie = `tw_session=${await signSession(
      { login: "alice", id: 1, exp: Date.now() + 60_000 },
      SECRET
    )}`;
    const res = await postShip(db, "one", cookie);
    expect(res.status).toBe(409);
    expect(shippedFlag(db, "c1")).toBe(0);
    // No claim row was written.
    const claims = db.prepare("SELECT COUNT(*) AS n FROM claims").get() as { n: number };
    expect(Number(claims.n)).toBe(0);
  });

  it("lets the builder who claimed it mark it shipped", async () => {
    seedCluster(db, "c1", "one", { login: "alice", repo: "https://github.com/alice/thing" });
    const cookie = `tw_session=${await signSession(
      { login: "alice", id: 1, exp: Date.now() + 60_000 },
      SECRET
    )}`;
    const res = await postShip(db, "one", cookie);
    expect(res.status).toBe(302);
    expect(shippedFlag(db, "c1")).toBe(1);
  });

  it("404s a wish that does not exist", async () => {
    const cookie = `tw_session=${await signSession(
      { login: "alice", id: 1, exp: Date.now() + 60_000 },
      SECRET
    )}`;
    const res = await postShip(db, "nope", cookie);
    expect(res.status).toBe(404);
  });

  it("400s a request with no slug", async () => {
    const cookie = `tw_session=${await signSession(
      { login: "alice", id: 1, exp: Date.now() + 60_000 },
      SECRET
    )}`;
    const res = await worker.fetch(
      new Request("https://toolswanted.dev/ship", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", cookie },
        body: "",
      }),
      env(db),
      { waitUntil: () => {}, passThroughOnException: () => {} } as never
    );
    expect(res.status).toBe(400);
  });

  it("keeps the repo and the note when it ships", async () => {
    seedCluster(db, "c1", "one", { login: "alice", repo: "https://github.com/alice/thing" });
    db.prepare("UPDATE clusters SET claim_note = ? WHERE id = ?").run("Aiming for March", "c1");
    const cookie = `tw_session=${await signSession(
      { login: "alice", id: 1, exp: Date.now() + 60_000 },
      SECRET
    )}`;
    await postShip(db, "one", cookie);
    const row = db.prepare("SELECT claim_repo, claim_note, shipped FROM clusters WHERE id = ?").get("c1") as {
      claim_repo: string;
      claim_note: string;
      shipped: number;
    };
    expect(row.claim_repo).toBe("https://github.com/alice/thing");
    expect(row.claim_note).toBe("Aiming for March");
    expect(row.shipped).toBe(1);
  });
});

describe("the admin ship action", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = freshDb();
  });

  async function adminShip(login: string, repo: string): Promise<Response> {
    return worker.fetch(
      new Request("https://toolswanted.dev/admin/cluster/c1/ship", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-admin-token": "admin-pass",
        },
        body: new URLSearchParams({ login, repo }).toString(),
      }),
      { ...(env(db) as object), ADMIN_TOKEN: "admin-pass" } as never,
      { waitUntil: () => {}, passThroughOnException: () => {} } as never
    );
  }

  it("refuses to write a claim with an empty login", async () => {
    // A cluster with an empty `claim_login` is one anybody holding a
    // login-less session token can ship, so the panel must not write one.
    seedCluster(db, "c1", "one", null);
    await adminShip("", "https://github.com/alice/thing");
    const row = db.prepare("SELECT claim_login FROM clusters WHERE id = ?").get("c1") as {
      claim_login: string | null;
    };
    expect(row.claim_login).toBeNull();
  });

  it("writes the claim when a real login is given", async () => {
    seedCluster(db, "c1", "one", null);
    await adminShip("alice", "https://github.com/alice/thing");
    const row = db.prepare("SELECT claim_login, shipped FROM clusters WHERE id = ?").get("c1") as {
      claim_login: string | null;
      shipped: number;
    };
    expect(row.claim_login).toBe("alice");
    expect(row.shipped).toBe(1);
  });
});
