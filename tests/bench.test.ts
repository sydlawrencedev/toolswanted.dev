import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { renderBoard, renderCluster, renderWeekly } from "../src/board";
import { freshDb as testDb } from "./helpers/db";

/**
 * A CPU benchmark for the board render.
 *
 * The product has to render inside 10ms of CPU on the free Workers
 * plan, and the board is the heaviest page. This renders the board
 * against a local D1 seeded with a realistic board, and times the
 * render alone, so the number can be compared before and after a
 * change without deploying.
 *
 *   npx vitest run tests/bench.test.ts
 *
 * It is a test rather than a script because vitest already resolves the
 * project's TypeScript, and it prints the numbers rather than asserting
 * on them: the budget is enforced by the deployment, and the point here
 * is to see the number move when the code changes.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOW = "2026-11-03T12:00:00.000Z";

const CLUSTERS = 40;
const WISHES = 16;

const CAPABILITIES = [
  "Read planning PDFs as structured data",
  "Read heritage listing PDFs as structured data",
  "Extract structured data from council planning PDFs",
  "Convert invoices to structured data",
  "Search a codebase by meaning",
  "Run a shell command and parse the output",
  "Read a GitHub issue with its comments",
  "Post a message to a Slack channel",
  "Look up a UK postcode",
  "Read a PDF and answer questions about it",
  "Write to a Google Sheet",
  "Query a Postgres database",
];
const CLIENTS = ["claude-code", "cursor", "codex", "chatgpt", "gemini-cli", "other"];

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

function seed(): DatabaseSync {
  const db = freshDb();
  const insertCluster = db.prepare(
    `INSERT INTO clusters (id, slug, title, title_source, count, unique_agents, week_count,
       first_seen, last_seen, status, shipped, claim_login, claim_repo, seeded, created_at, updated_at)
     VALUES (?, ?, ?, 'raw', ?, ?, 0, ?, ?, 'published', 0, NULL, NULL, ?, ?, ?)`
  );
  const insertWish = db.prepare(
    `INSERT INTO wishes (id, cluster_id, need, need_generic, context, client, model,
       source_key, ip_key, seeded, flagged, flag_reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 'ip', ?, 0, NULL, ?)`
  );
  const insertVote = db.prepare(
    `INSERT INTO votes (source_key, cluster_id, created_at, seeded) VALUES (?, ?, ?, ?)`
  );

  db.exec("BEGIN");
  for (let c = 0; c < CLUSTERS; c++) {
    const id = `c${c}`;
    const seeded = c < 10 ? 1 : 0;
    insertCluster.run(
      ...([
        id,
        `capability-${c}`,
        CAPABILITIES[c % CAPABILITIES.length],
        WISHES,
        10,
        NOW,
        NOW,
        seeded,
        NOW,
        NOW,
      ] as never[])
    );
    for (let w = 0; w < WISHES; w++) {
      const cap = CAPABILITIES[(c + w) % CAPABILITIES.length];
      const isSeeded = seeded && w < 8 ? 1 : 0;
      insertWish.run(
        ...([
          `w${c}_${w}`,
          id,
          `need ${w} for capability ${c}`,
          cap,
          w % 3 === 0 ? "some context that an agent supplied" : null,
          CLIENTS[w % CLIENTS.length],
          `src${c}_${w}`,
          isSeeded,
          NOW,
        ] as never[])
      );
      insertVote.run(...([`src${c}_${w}`, id, NOW, isSeeded] as never[]));
    }
  }
  db.exec("COMMIT");
  return db;
}

async function bench(name: string, fn: () => Promise<unknown>, iter = 60): Promise<number> {
  for (let i = 0; i < 5; i++) await fn();
  const times: number[] = [];
  for (let i = 0; i < iter; i++) {
    const t0 = performance.now();
    await fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const p = (q: number) => times[Math.min(times.length - 1, Math.floor(times.length * q))]!;
  console.log(
    `  ${name.padEnd(24)} p50=${p(0.5).toFixed(2)}ms  p95=${p(0.95).toFixed(2)}ms  max=${times[times.length - 1]!.toFixed(2)}ms`
  );
  return p(0.5);
}

describe("the board render cost", () => {
  it("reports how long each page takes to render", async () => {
    const db = seed();
    const env = {
      DB: d1(db),
      SITE_URL: "https://toolswanted.dev",
      SITE_NAME: "Tools Wanted",
    } as never;

    console.log(
      `\nboard render: ${CLUSTERS} clusters, ${CLUSTERS * WISHES} wishes (node:sqlite, so the D1 read cost is not counted)\n`
    );
    const board = await bench("renderBoard", () => renderBoard(env, {}));
    await bench("renderBoard (shipped)", () => renderBoard(env, { filter: "shipped" }));
    await bench("renderCluster", () => renderCluster(env, "capability-0"));
    await bench("renderWeekly", () => renderWeekly(env));

    // The budget is on the Worker as a whole, and the D1 reads are part
    // of it, so the render alone has to leave room for them. It is a
    // guard against a change that makes the board an order of magnitude
    // more expensive, not a substitute for the deployment measurement.
    expect(board).toBeLessThan(50);
  });
});
