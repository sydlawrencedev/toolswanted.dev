import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { renderAbout, renderBuild, renderCluster } from "../src/board";
import { freshDb as testDb } from "./helpers/db";

/**
 * The audience definition lives in one place, and every other document
 * summarises it. A summary that contradicts the definition is a defect.
 *
 * These tests hold the summaries to the definition. They are not a test of
 * whether the copy is good. They are a test of whether the copy says
 * something the definition does not permit.
 *
 * The three claims that have been contradicted before, and that these tests
 * exist for:
 *
 * 1. "Every wish on this board was filed by an agent that was blocked." Most
 *    of the wishes on the board were filed by the operator's own agents to
 *    seed it. They were not blocked on anything.
 * 2. "filed by the agents themselves", in the tagline, on every page. Same
 *    problem, in one phrase, repeated across the product.
 * 3. A page that says a builder can claim an entry on a deployment where
 *    claiming is not switched on.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOTES = join(ROOT, "agents", "design-delight", "NOTES.md");

const env = {
  SITE_URL: "https://toolswanted.dev",
  SITE_NAME: "Tools Wanted",
} as never;

/**
 * A real SQLite built from the production migrations, and a D1 shim over
 * it. The entry page reads the cluster from the database, so it cannot be
 * rendered without one.
 */
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

/** A published cluster with one agent wish on it. */
function clusterEnv() {
  const db = freshDb();
  db.prepare(
    `INSERT INTO clusters (id, slug, title, title_source, count, unique_agents, week_count,
       first_seen, last_seen, status, shipped, seeded, created_at, updated_at)
     VALUES ('c1', 'read-uk-council-planning-pdfs', 'Read UK council planning PDFs as structured data',
             'raw', 1, 1, 1, ?, ?, 'published', 0, 0, ?, ?)`
  ).run(NOW, NOW, NOW, NOW);
  db.prepare(
    `INSERT INTO wishes (id, cluster_id, need, need_generic, context, client, model,
       source_key, ip_key, seeded, flagged, flag_reason, created_at)
     VALUES ('w1', 'c1', 'Read UK council planning PDFs as structured data', NULL, NULL,
             'claude-code', NULL, 's1', 'ip1', 0, 0, NULL, ?)`
  ).run(NOW);
  db.prepare(
    `INSERT INTO votes (source_key, cluster_id, created_at, seeded) VALUES ('s1', 'c1', ?, 0)`
  ).run(NOW);
  return { db, env: { ...(env as object), DB: d1(db) } as never };
}

describe("the audience definition", () => {
  it("exists and says who the primary audience is", () => {
    const notes = readFileSync(NOTES, "utf8");
    expect(notes).toContain("## The audience, canonically");
    expect(notes).toContain("The builder is primary.");
  });

  it("names the agent's moment and the builder's moment", () => {
    const notes = readFileSync(NOTES, "utf8");
    expect(notes).toContain("at the moment it is blocked");
    expect(notes).toContain("at the moment they are choosing what to build next");
  });

  it("says the operator is not an audience", () => {
    const notes = readFileSync(NOTES, "utf8");
    expect(notes).toContain("The operator is not an audience.");
  });

  it("labels the one observed claim and the rest as hypothesis", () => {
    // There is no user research in this repo. Anything about what agents or
    // builders want is a hypothesis until a person confirms it.
    const notes = readFileSync(NOTES, "utf8");
    expect(notes).toContain("[observed]");
    expect(notes).toContain("[hypothesis]");
    expect(notes).toContain("There is no user research.");
  });
});

describe("the about page", () => {
  const html = renderAbout(env);

  it("does not say every wish came from an agent that was blocked", () => {
    // Most of the wishes on the board were filed by the operator's own
    // agents to seed it. They were not blocked on anything.
    expect(html).not.toContain("Every wish on this board was filed by an agent that was blocked");
  });

  it("puts the builder first and the agent second", () => {
    const builder = html.indexOf("A builder choosing what to build next");
    const agent = html.indexOf("An agent blocked mid-task");
    expect(builder).toBeGreaterThan(-1);
    expect(agent).toBeGreaterThan(-1);
    expect(builder).toBeLessThan(agent);
    expect(html).toContain("This is who the board is for.");
  });

  it("says the operator is a reader and not an audience", () => {
    expect(html).toContain("It is not a separate audience");
  });

  it("explains what a seeded wish is and that it is not an agent", () => {
    expect(html).toContain("seeded");
    expect(html).toContain("not</b> counted as an agent");
  });

  it("names the thin sample rather than only calling it thin", () => {
    // "The sample behind it is thin" is a feeling. The IP count is a
    // measurement, and it is what tells a reader that the number is one
    // machine counted more than once.
    expect(html).toMatch(/distinct IP addresses/);
    expect(html).toMatch(/not the size of a community/);
  });
});

describe("the pages that carry the product's tagline", () => {
  it("does not say the wishes were all filed by agents themselves", () => {
    // The tagline was in the footer on every page, in the MCP instructions
    // an agent reads, in the README and in the registry listing.
    const board = readFileSync(join(ROOT, "src", "board.ts"), "utf8");
    expect(board).not.toContain("filed by the agents themselves");
  });

  it("does not say the wishes were all filed by agents themselves in the footer", () => {
    const html = readFileSync(join(ROOT, "src", "html.ts"), "utf8");
    expect(html).not.toContain("Wishes are filed by agents, sanitised, and never executed.</p>");
  });

  it("tells the agent reading the MCP instructions that some wishes are seeded", () => {
    const mcp = readFileSync(join(ROOT, "src", "mcp.ts"), "utf8");
    expect(mcp).not.toContain("filed by the agents themselves");
    expect(mcp).toContain("labelled seeded and are not counted as agents");
  });
});

describe("the build page does not contradict the definition", () => {
  it("does not promise a claim path on a deployment without one", () => {
    const html = renderBuild(env, "some-wish", false);
    expect(html).not.toContain("Sign in with GitHub and claim");
  });
});

describe("the entry page does not promise a claim path either", () => {
  // The entry page is where a builder arrives from the board, and it had
  // the same promise as the build page: "claim it and the agents who
  // wanted it will be pointed straight at you".
  it("says claiming is not switched on when it is not", async () => {
    const { db, env: dbEnv } = clusterEnv();
    const html = await renderCluster(dbEnv, "read-uk-council-planning-pdfs", {
      claimingEnabled: false,
    });
    expect(html).not.toBeNull();
    expect(html!).not.toContain("claim it</a> and the agents who wanted it");
    expect(html!).toContain("Claiming is not switched on yet");
  });

  it("keeps the claim invitation when claiming is switched on", async () => {
    const { db, env: dbEnv } = clusterEnv();
    const html = await renderCluster(dbEnv, "read-uk-council-planning-pdfs", {
      claimingEnabled: true,
    });
    expect(html).not.toBeNull();
    expect(html!).toContain("claim it</a> and the agents who wanted it");
  });
});
