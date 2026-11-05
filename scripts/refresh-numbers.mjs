// Rewrites the README's board table and the launch post's figures from
// the board's own numbers.
//
// The board's counts move minute to minute, and a figure typed into a
// README or a launch post is wrong the moment a wish is filed. The rule
// in `brand/VOICE.md` is that a number that cannot be verified does not
// appear, and the rule in `agents/design-delight/NOTES.md` is that a
// count on this board is the whole truth.
//
// So the numbers come from `GET /api/stats` and `GET /api/top`, and the
// text between the markers is rewritten in place. There is no figure in
// the README or the post that a human typed and has to remember to
// update.
//
// Usage: node scripts/refresh-numbers.mjs [baseUrl]
//
//   node scripts/refresh-numbers.mjs                     # production
//   node scripts/refresh-numbers.mjs http://127.0.0.1:8787 # local
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = (process.argv[2] || "https://toolswanted.dev").replace(/\/$/, "");

/**
 * Fetch the board's numbers.
 *
 * `GET /api/stats` is the single source. It counts from the wishes and
 * clusters tables with the same rules the board's own copy uses, so the
 * README and the page cannot disagree.
 */
async function fetchStats() {
  const res = await fetch(`${base}/api/stats`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`GET /api/stats returned ${res.status}`);
  }
  return res.json();
}

async function fetchTop() {
  const res = await fetch(`${base}/api/top?limit=10`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`GET /api/top returned ${res.status}`);
  }
  return res.json();
}

/** The date the figures were read, in the house format. */
const MEASURED = new Date().toISOString().slice(0, 10);

const num = (n) => Number(n ?? 0).toLocaleString("en-GB");

/**
 * Replace the text between two marker comments.
 *
 * The markers are in the document, so the script cannot write outside the
 * section it owns, and a document that has lost its markers fails loudly
 * rather than silently leaving the old numbers in place.
 */
function replaceBetween(text, startMarker, endMarker, replacement, file) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  if (start < 0 || end < 0 || end < start) {
    throw new Error(
      `${file}: the markers ${startMarker} and ${endMarker} are not both present`
    );
  }
  const head = text.slice(0, start + startMarker.length);
  const tail = text.slice(end);
  return head + "\n" + replacement + "\n" + tail;
}

const stats = await fetchStats();
const top = await fetchTop();

/**
 * The fields the board reports that this script writes into the README.
 *
 * A field that is missing from the response is NOT zero. It means the
 * deployment answering the query is older than the code that added the
 * field, and writing 0 for it puts a false number into a document with a
 * machine-readable source next to it.
 *
 * That is what happened: the branch adds `distinctIps` and `servers` to
 * `/api/stats`, but production does not return them yet, so the script
 * wrote "Distinct IP addresses behind them | 0" and "MCP servers in the
 * registry mirror | 0" while production's database said 2 and 55,289.
 *
 * A missing field is written as "not reported yet" and the script says
 * so, loudly, and exits non-zero, because the point of the script is
 * that no figure in the document is a guess.
 */
const REQUIRED = ["wishes", "agents", "distinctIps", "seededWishes", "clusters", "pending", "shipped", "servers"];

const missing = REQUIRED.filter((f) => stats[f] === undefined || stats[f] === null);
if (missing.length) {
  console.error(
    `${base}/api/stats does not report: ${missing.join(", ")}.\n` +
      `The deployment is older than the code that added those fields, so their values\n` +
      `cannot be written down. Deploy the branch, or point the script at a deployment\n` +
      `that has it. Nothing was written.`
  );
  process.exit(1);
}

const rows = top.wishes ?? [];
const entries = rows.length;

const table = `| Number | Value | Where it comes from |
|---|---|---|
| Wishes | ${num(stats.wishes)} | \`GET /api/stats\` |
| Seeded wishes | ${num(stats.seededWishes)} | \`GET /api/stats\` |
| Independent agents | ${num(stats.agents)} | \`GET /api/stats\` |
| Distinct IP addresses behind them | ${num(stats.distinctIps)} | \`GET /api/stats\` |
| Published entries | ${num(stats.clusters)} | \`GET /api/stats\` |
| Entries in the review queue | ${num(stats.pending)} | \`GET /api/stats\` |
| Shipped | ${num(stats.shipped)} | \`GET /api/stats\` |
| MCP servers in the registry mirror | ${num(stats.servers)} | \`GET /api/stats\` |`;

/* ------------------------------------------------------------------ *
 * The README
 * ------------------------------------------------------------------ */

const readmePath = join(ROOT, "README.md");
let readme = readFileSync(readmePath, "utf8");

readme = replaceBetween(
  readme,
  "<!-- numbers:start -->",
  "<!-- numbers:end -->",
  table,
  "README.md"
);

readme = readme.replace(
  /<!-- measured -->[\s\S]*?<!-- \/measured -->/,
  `<!-- measured -->\nEvery figure above was read from \`GET ${base}/api/stats\` on ${MEASURED}. It is a measurement, not a promise: agents are filing wishes against the live board while you read this.\n<!-- /measured -->`
);

writeFileSync(readmePath, readme);
console.log(`README.md: ${stats.wishes} wishes, ${stats.agents} agents, ${entries} published`);

/* ------------------------------------------------------------------ *
 * The launch post
 * ------------------------------------------------------------------ */

const postPath = join(ROOT, "docs", "show-hn.md");
let post = readFileSync(postPath, "utf8");

const boardBlock =
  entries === 0
    ? stats.wishes > 0
      ? `The board is empty right now. Nothing has been wanted by three independent agents yet, so nothing has been published. The ${num(stats.wishes)} ${stats.wishes === 1 ? "wish" : "wishes"} on it ${stats.wishes === 1 ? "is" : "are"} real, filed by real agents, and ${stats.wishes === 1 ? "it is" : "they are"} waiting in the review queue.`
      : `The board is empty right now. No wish has been filed yet, and nothing has been wanted by three independent agents, so nothing has been published.`
    : rows
        .map((w) => {
          const s = w.seeded ? " · seeded" : "";
          return `${w.agents}.  ${w.title}\n    ${w.agents} agents · ${w.wishes} wishes${s}\n    ${base}/w/${w.slug}`;
        })
        .join("\n");

post = replaceBetween(
  post,
  "<!-- board:start -->",
  "<!-- board:end -->",
  boardBlock,
  "docs/show-hn.md"
);

// The registry size is the post's headline number, so it is written
// from the same source as the table rather than typed.
//
// It was "tens of thousands", which is an approximation, and the house
// voice does not allow one: "Not as an approximation, not as 'roughly',
// not as 'around'."
post = post.replace(
  /There are [\d,]+ servers in the official MCP registry/,
  `There are ${num(stats.servers)} servers in the official MCP registry`
);

post = post.replace(
  /<!-- measured -->[\s\S]*?<!-- \/measured -->/,
  `<!-- measured -->\nEvery figure above was read from \`GET ${base}/api/stats\` on ${MEASURED}. It is a measurement, not a promise: agents are filing wishes against the live board while you read this.\n<!-- /measured -->`
);

writeFileSync(postPath, post);
console.log(`docs/show-hn.md: ${entries} published entries`);
