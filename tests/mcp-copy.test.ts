import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { handleMcpRequest } from "../src/mcp";

/**
 * The MCP responses, read by an agent.
 *
 * The board's HTML said "1 clusters" and "1 agents" until commit
 * 074c58f fixed it. The MCP responses were never touched. They pluralise
 * the noun by hand and leave the verb alone, so a capability exactly one
 * agent wants reads:
 *
 *   - Convert a PDF invoice into structured line items (1 agent want this, 5 wishes filed)
 *
 * The MCP response is the half of the product an agent actually reads and
 * the half nobody eyeballs, so a fault there survives a review that looks
 * at the board.
 *
 * These tests drive the real MCP server over the real transport, against
 * a real SQLite database, so what is asserted is the string the agent
 * receives and not a helper's return value.
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

/**
 * A published cluster with a centroid, so the search matches it exactly.
 * The vector is the all-ones vector: cosine against it is 1 for the query
 * embedding the stub returns.
 */
function seedCluster(db: DatabaseSync, id: string, slug: string, agents: number, wishes: number) {
  const vector = Buffer.from(new Float32Array([1, 0, 0, 0]).buffer).toString("base64");
  db.prepare(
    `INSERT INTO clusters (id, slug, title, title_source, count, unique_agents, week_count,
       first_seen, last_seen, status, vector, shipped, claim_login, claim_repo, seeded, created_at, updated_at)
     VALUES (?, ?, ?, 'raw', ?, ?, 0, ?, ?, 'published', ?, 0, NULL, NULL, 0, ?, ?)`
  ).run(id, slug, slug, wishes, agents, NOW, NOW, vector, NOW, NOW);
  for (let i = 0; i < wishes; i++) {
    db.prepare(
      `INSERT INTO wishes (id, cluster_id, need, need_generic, context, client, model,
         source_key, ip_key, seeded, flagged, flag_reason, created_at)
       VALUES (?, ?, 'need', NULL, NULL, 'claude-code', NULL, ?, 'ip', 0, 0, NULL, ?)`
    ).run(`w-${id}-${i}`, id, `src-${i}`, NOW);
  }
}

function env(db: DatabaseSync) {
  return {
    DB: d1(db),
    SITE_URL: "https://toolswanted.dev",
    SITE_NAME: "Tools Wanted",
    SESSION_SECRET: "test-secret-value",
    MATCH_THRESHOLD: "0.723",
    SERVER_MATCH_THRESHOLD: "0.57",
    AUTO_PUBLISH_WISHES: "3",
    RATE_LIMIT_WISHES_PER_HOUR: "30",
    RATE_LIMIT_SEARCH_PER_MINUTE: "30",
    REGISTRY_CRON: "*/5 * * * *",
    AI: {
      run: async () => ({ data: [[1, 0, 0, 0]] }),
    },
    VECTORS: {
      query: async () => ({ matches: [] }),
      upsert: async () => undefined,
    },
    SERVER_VECTORS: {
      query: async () => ({ matches: [] }),
      upsert: async () => undefined,
    },
    caches: { default: { match: async () => undefined, put: async () => {}, delete: async () => {} } },
  } as never;
}

async function callTool(db: DatabaseSync, name: string, args: Record<string, unknown>): Promise<string> {
  const res = await handleMcpRequest(
    env(db),
    new Request("https://toolswanted.dev/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
    }),
    { ipKey: "ip", sourceKey: "src", userAgent: "test", client: "claude-code" } as never,
    { waitUntil: () => {}, passThroughOnException: () => {} } as never
  );
  const json = (await res.json()) as {
    result?: { content?: Array<{ text?: string }> };
    error?: { message?: string };
  };
  if (json.error) throw new Error(json.error.message ?? "mcp error");
  return json.result?.content?.[0]?.text ?? "";
}

describe("the MCP agent count", () => {
  it("agrees in number when one agent wants the capability", async () => {
    const db = freshDb();
    seedCluster(db, "c1", "one-agent-wish", 1, 5);

    const text = await callTool(db, "top_wishes", { limit: 10 });

    expect(text).toContain("1 agent");
    // "1 agent want this" is the fault. It must read "1 agent wants this".
    expect(text).not.toMatch(/\b1 agent want\b/);
    expect(text).toMatch(/\b1 agent wants\b/);
  });

  it("agrees in number when several agents want the capability", async () => {
    const db = freshDb();
    seedCluster(db, "c1", "many-agent-wish", 4, 9);

    const text = await callTool(db, "top_wishes", { limit: 10 });

    expect(text).toContain("4 agents");
    expect(text).toMatch(/\b4 agents want\b/);
    expect(text).not.toMatch(/\b4 agents wants\b/);
  });

  it("agrees in number in a search result", async () => {
    const db = freshDb();
    seedCluster(db, "c1", "one-agent-wish", 1, 5);

    const text = await callTool(db, "search_wishes", { query: "one agent wish" });

    expect(text).not.toMatch(/\b1 agent want\b/);
    expect(text).toMatch(/\b1 agent wants\b/);
  });
});

describe("the board's own count sentences", () => {
  it("agrees in number on the board card's tally", async () => {
    // The tally's aria-label is what a screen reader reads out. "1 agents
    // want this" is what it said.
    const db = freshDb();
    seedCluster(db, "c1", "one-agent-wish", 1, 5);

    const { renderBoard } = await import("../src/board");
    const html = await renderBoard(env(db), { filter: "all" });

    expect(html).toContain('aria-label="1 agent wants this"');
    expect(html).not.toContain('aria-label="1 agents want this"');
  });

  it("agrees in number when several agents want it", async () => {
    const db = freshDb();
    seedCluster(db, "c1", "many-agent-wish", 4, 9);

    const { renderBoard } = await import("../src/board");
    const html = await renderBoard(env(db), { filter: "all" });

    expect(html).toContain('aria-label="4 agents want this"');
    expect(html).not.toContain('aria-label="4 agents wants this"');
  });
});
