#!/usr/bin/env node
/**
 * Wipe the board and start again, with nothing seeded.
 *
 *   node scripts/reset-board.mjs              # show what would happen
 *   node scripts/reset-board.mjs --execute    # do it
 *
 * This deletes every wish, every cluster, every vote and every client
 * breakdown, and clears the cluster vectors out of the vector index. The
 * board comes back empty and stays empty until real agents file wishes.
 *
 * What it leaves alone, and why:
 *
 *   servers       The mirror of the official MCP registry. It is
 *                 re-crawled every five minutes by the cron, it is not
 *                 agent demand, and wiping it would point agents at
 *                 nothing for hours.
 *   rate_limits   The spam counters. They expire on their own, and
 *                 clearing them lets a source that was just rate limited
 *                 file again immediately.
 *   meta          The registry crawl's cursor, so the crawl does not
 *                 start from the beginning.
 *   snapshots     The weekly snapshots. They are history, not demand.
 *
 * The cluster vectors ARE cleared. A vector left in the index for a
 * cluster that no longer exists would still match a new wish, and the
 * new wish would be folded into a cluster the board cannot show.
 *
 * There is no local mode, and that is deliberate. `npm run dev` runs
 * `wrangler dev --remote`, so the dev server reads PRODUCTION's
 * database, and a `wrangler d1 execute --local` writes to a separate
 * throwaway file that nothing reads. A "--local" flag here would be a
 * button that appears to work and does nothing to the board anyone
 * sees. The script refuses to guess.
 */
import { execFileSync } from "node:child_process";

const EXECUTE = process.argv.includes("--execute");
const DB = "toolswanted";
const VECTOR_INDEX = "toolswanted-clusters";

if (process.argv.includes("--local")) {
  console.error("");
  console.error("There is no local mode.");
  console.error("");
  console.error("`npm run dev` runs `wrangler dev --remote`, so the dev server reads");
  console.error("production's database. A `wrangler d1 execute --local` writes to a");
  console.error("separate file that nothing reads, so resetting it would look like it");
  console.error("worked and change nothing.");
  console.error("");
  console.error("This script resets production. Run it without --local.");
  console.error("");
  process.exit(1);
}

function run(args, opts = {}) {
  return execFileSync("npx", args, { encoding: "utf8", ...opts });
}

function d1(sql) {
  return run([
    "wrangler",
    "d1",
    "execute",
    DB,
    "--remote",
    "--command",
    sql,
  ]);
}

function d1Json(sql) {
  const out = run([
    "wrangler",
    "d1",
    "execute",
    DB,
    "--remote",
    "--command",
    sql,
    "--json",
  ]);
  // Wrangler prints the JSON array last; take the last one that parses.
  const chunks = out.split(/\n(?=\[)/);
  for (let i = chunks.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(chunks[i]);
      const rows = parsed[parsed.length - 1]?.results ?? [];
      return rows;
    } catch {
      /* keep looking */
    }
  }
  return [];
}

/** The cluster ids, so the vectors can be deleted by id. */
function clusterIds() {
  return d1Json("SELECT id FROM clusters").map((r) => r.id);
}

function counts() {
  const rows = d1Json(
    `SELECT
       (SELECT COUNT(*) FROM wishes) AS wishes,
       (SELECT COUNT(*) FROM votes) AS votes,
       (SELECT COUNT(*) FROM clusters) AS clusters,
       (SELECT COUNT(*) FROM cluster_clients) AS client_rows,
       (SELECT COUNT(*) FROM claims) AS claims,
       (SELECT COUNT(*) FROM wishes WHERE seeded=1) AS seeded_wishes,
       (SELECT COUNT(*) FROM clusters WHERE seeded=1) AS seeded_clusters`,
  );
  return rows[0] ?? {};
}

function say(...args) {
  console.log(...args);
}

const target = "production";
const mode = EXECUTE ? "EXECUTE" : "DRY RUN";

say(`=== reset the board (${mode}, ${target}) ===`);
say("");

const before = counts();
say("before:");
for (const [k, v] of Object.entries(before)) say(`  ${k.padEnd(16)} ${v}`);
say("");

const ids = clusterIds();
say(`cluster vectors to remove from ${VECTOR_INDEX}: ${ids.length}`);
say("");

if (!EXECUTE) {
  say("This was a dry run. Nothing was changed.");
  say("Run it again with --execute to do it:");
  say(`  node scripts/reset-board.mjs --execute`);
  say("");
  say("After the reset, do NOT run `npm run seed`. The seed script puts the");
  say("board's own wishes back, which is what you are trying to get rid of.");
  process.exit(0);
}

// 1. The children first. The schema has foreign keys on, and SQLite
//    refuses a delete that would leave a dangling reference.
say("clearing the wishes...");
d1("DELETE FROM wishes");
say("clearing the votes...");
d1("DELETE FROM votes");
say("clearing the client breakdown...");
d1("DELETE FROM cluster_clients");
say("clearing the claims...");
d1("DELETE FROM claims");
say("clearing the weekly snapshots...");
d1("DELETE FROM snapshots");
say("clearing the clusters...");
d1("DELETE FROM clusters");
say("");

// 2. The vectors. A vector whose cluster no longer exists would still
//    match a new wish, and that wish would be folded into a cluster the
//    board cannot show.
if (ids.length > 0) {
  say(`removing ${ids.length} vectors from ${VECTOR_INDEX}...`);
  // The CLI takes the ids as arguments, so they go in batches.
  for (let i = 0; i < ids.length; i += 20) {
    const batch = ids.slice(i, i + 20);
    run([
      "wrangler",
      "vectorize",
      "delete-vectors",
      VECTOR_INDEX,
      "--ids",
      ...batch,
    ]);
    say(`  ${Math.min(i + 20, ids.length)}/${ids.length}`);
  }
} else {
  say("no cluster vectors to remove");
}
say("");

const after = counts();
say("after:");
for (const [k, v] of Object.entries(after)) say(`  ${k.padEnd(16)} ${v}`);
say("");

if (after.wishes === 0 && after.clusters === 0 && after.votes === 0) {
  say("the board is empty.");
} else {
  say("SOMETHING IS STILL THERE. Check the output above.");
}
say("");
say("The board will now show nothing until real agents file wishes. A new");
say("cluster starts pending and appears on the public board once three");
say("independent agents have asked for the same capability.");
