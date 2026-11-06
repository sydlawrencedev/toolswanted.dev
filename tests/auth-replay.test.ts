import { describe, it, expect, beforeEach } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import worker from "../src/index";
import { signSession } from "../src/auth";
import { freshDb as testDb } from "./helpers/db";

/**
 * The pending-claim cookie replay.
 *
 * When an anonymous visitor starts a claim, the server hands them a
 * signed token whose payload is `login: ""` — there is no builder yet —
 * and sets it as `tw_claim`. The routes that trust the login (`/claim`
 * and `/ship`) read `tw_session`.
 *
 * A token is a token. The signature covers the payload, and the payload
 * says `login: ""`, so the same bytes under the other cookie name are a
 * valid session. If the claim's owner is also `""` — which is what the
 * admin ship action writes when it is posted an empty login — then
 * `cluster.claim_login !== session.login` is false and the ownership
 * check passes for somebody who never signed in and never claimed
 * anything.
 *
 * This is a test at the level the bug lives: the real Worker, the real
 * fetch handler, a real database, and the real cookies.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SECRET = "test-secret-value";

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

async function post(
  db: DatabaseSync,
  path: string,
  body: Record<string, string>,
  cookie?: string
): Promise<Response> {
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
  };
  if (cookie) headers.cookie = cookie;
  return worker.fetch(
    new Request(`https://toolswanted.dev${path}`, {
      method: "POST",
      headers,
      body: new URLSearchParams(body).toString(),
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

describe("the pending-claim cookie", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = freshDb();
  });

  it("is not a session when it is replayed under the session cookie name", async () => {
    // The whole attack in one step: take the token the server hands to
    // every anonymous visitor who starts a claim, and present it as a
    // session.
    seedCluster(db, "c1", "some-wish", { login: "", repo: "https://github.com/x/y" });

    const claim = await post(
      db,
      "/claim",
      { slug: "some-wish", repo: "https://github.com/attacker/repo" }
    );
    expect(claim.status).toBe(302);

    const setCookie = claim.headers.get("set-cookie") ?? "";
    const token = setCookie.match(/tw_claim=([^;]+)/)?.[1];
    expect(token).toBeTruthy();

    // The payload is the server's own: it says there is no builder yet.
    const payload = Buffer.from(
      token!.split(".")[0]!.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString();
    expect(payload).toContain('"login":""');

    const ship = await post(db, "/ship", { slug: "some-wish" }, `tw_session=${token}`);

    // The session must be refused, and the wish must not be shipped.
    expect(ship.status).toBe(401);
    expect(shippedFlag(db, "c1")).toBe(0);
  });

  it("cannot claim a wish with a replayed token either", async () => {
    seedCluster(db, "c1", "some-wish", null);

    const claim = await post(
      db,
      "/claim",
      { slug: "some-wish", repo: "https://github.com/attacker/repo" }
    );
    const token = (claim.headers.get("set-cookie") ?? "").match(/tw_claim=([^;]+)/)?.[1];
    expect(token).toBeTruthy();

    const second = await post(
      db,
      "/claim",
      { slug: "some-wish", repo: "https://github.com/attacker/repo" },
      `tw_session=${token}`
    );

    // A visitor with no GitHub account must not be able to claim a wish.
    // The route may answer 401, or it may send them to GitHub to sign in
    // (302); what it must not do is write the claim.
    expect([302, 401]).toContain(second.status);
    if (second.status === 302) {
      expect(second.headers.get("location")).toMatch(/^\/auth\/github/);
    }

    const row = db.prepare("SELECT claim_login FROM clusters WHERE id = ?").get("c1") as {
      claim_login: string | null;
    };
    expect(row.claim_login).toBeNull();
  });

  it("refuses a session whose login is empty", async () => {
    seedCluster(db, "c1", "some-wish", { login: "", repo: "https://github.com/x/y" });

    const token = await signSession(
      { login: "", id: 0, exp: Date.now() + 60_000 },
      SECRET
    );
    const ship = await post(db, "/ship", { slug: "some-wish" }, `tw_session=${token}`);

    expect(ship.status).toBe(401);
    expect(shippedFlag(db, "c1")).toBe(0);
  });

  it("still lets the real builder ship their own wish", async () => {
    // The confirmer. A fix that refuses every session would pass the
    // tests above and break the product, so the other side is asserted
    // too: the builder who claimed it can ship it.
    seedCluster(db, "c1", "some-wish", { login: "alice", repo: "https://github.com/alice/thing" });

    const token = await signSession(
      { login: "alice", id: 7, exp: Date.now() + 60_000 },
      SECRET
    );
    const ship = await post(db, "/ship", { slug: "some-wish" }, `tw_session=${token}`);

    expect(ship.status).toBe(302);
    expect(shippedFlag(db, "c1")).toBe(1);
  });
});

describe("the admin ship action", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = freshDb();
  });

  it("does not write a claim with an empty login", async () => {
    // The admin ship action posts a login. An empty one is not a
    // builder, and a claim with an empty owner is a claim anybody with
    // an empty session can satisfy.
    seedCluster(db, "c1", "some-wish", null);

    const res = await post(
      db,
      "/admin/cluster/c1/ship",
      { login: "", repo: "https://github.com/x/y" },
      undefined
    );
    // No admin token: the request must not be allowed at all.
    expect([401, 403]).toContain(res.status);

    const row = db.prepare("SELECT claim_login FROM clusters WHERE id = ?").get("c1") as {
      claim_login: string | null;
    };
    expect(row.claim_login).toBeNull();
  });
});
