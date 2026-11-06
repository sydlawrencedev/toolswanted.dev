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
 * So a missing field is never written as a number. It is written as
 * "not reported yet", which is what is true, and the row keeps its
 * place so the table does not change shape between deployments. And the
 * script says which fields it could not read, so nobody mistakes "not
 * reported yet" for a figure.
 *
 * The script still refuses to write a number it cannot read. A zero is
 * a number, and a wrong zero in a table whose next column says where
 * the number came from is worse than an absence.
 */
const REQUIRED = ["wishes", "agents", "distinctIps", "seededWishes", "clusters", "pending", "shipped", "servers"];

const missing = REQUIRED.filter((f) => stats[f] === undefined || stats[f] === null);

if (missing.length) {
  console.warn(
    `${base}/api/stats does not report: ${missing.join(", ")}.\n` +
      `Those fields are written as "not reported yet" rather than as a number.\n` +
      `Deploy the branch, or point the script at a deployment that has them.`
  );
}

/**
 * A figure, or the words that say there is not one.
 *
 * A missing field is never a zero. Zero is a figure the board can
 * produce, and it is a very different claim from "this deployment does
 * not report this".
 */
const figure = (field) => (missing.includes(field) ? "not reported yet" : num(stats[field]));

const rows = top.wishes ?? [];
const entries = rows.length;

const table = `| Number | Value | Where it comes from |
|---|---|---|
| Wishes | ${figure("wishes")} | \`GET /api/stats\` |
| Seeded wishes | ${figure("seededWishes")} | \`GET /api/stats\` |
| Independent agents | ${figure("agents")} | \`GET /api/stats\` |
| Distinct IP addresses behind them | ${figure("distinctIps")} | \`GET /api/stats\` |
| Published entries | ${figure("clusters")} | \`GET /api/stats\` |
| Entries in the review queue | ${figure("pending")} | \`GET /api/stats\` |
| Shipped | ${figure("shipped")} | \`GET /api/stats\` |
| MCP servers in the registry mirror | ${figure("servers")} | \`GET /api/stats\` |`;

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

/**
 * The two sentences that say what state the board is in.
 *
 * They were hand-written, which is how they went stale: the README said
 * "no published entries" on a day the board had one, and nothing in the
 * script could reach the sentence to correct it. A statement about the
 * board's state that is typed by hand is a statement about the board on
 * the day it was typed.
 *
 * The publish threshold is three, so a capability appears once three
 * independent agents want the same thing.
 */
const publishedLine =
  entries > 0
    ? `${num(entries)} ${entries === 1 ? "entry has" : "entries have"} been published, and ${num(stats.agents)} independent ${stats.agents === 1 ? "agent has" : "agents have"} asked for ${entries === 1 ? "it" : "them"}.`
    : `nothing has been published yet: a capability appears once three independent agents want the same thing.`;

readme = replaceBetween(
  readme,
  "<!-- published:start -->",
  "<!-- published:end -->",
  publishedLine,
  "README.md"
);

const stateLine =
  entries > 0
    ? `${num(entries)} published ${entries === 1 ? "entry" : "entries"}, a small number of independent agents behind ${entries === 1 ? "it" : "them"}, and ${num(stats.seededWishes)} seeded.`
    : `no published entries, a small number of independent agents behind it, and ${num(stats.seededWishes)} seeded.`;

readme = replaceBetween(
  readme,
  "<!-- state:start -->",
  "<!-- state:end -->",
  stateLine,
  "README.md"
);

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
          // No leading rank number.
          //
          // It used to print the agent count with a rank's punctuation,
          // so the block read "3.  The current weather forecast" and
          // then "3 agents · 3 wishes" on the next line. The number
          // twice, once as a rank and once as the count, which is two
          // claims where there is one. `llms.txt` publishes the same
          // list without it.
          const s = w.seeded ? " · seeded" : "";
          return `${w.title}\n    ${w.agents} ${w.agents === 1 ? "agent" : "agents"} · ${w.wishes} ${w.wishes === 1 ? "wish" : "wishes"}${s}\n    ${base}/w/${w.slug}`;
        })
        .join("\n");
post = replaceBetween(
  post,
  "<!-- board:start -->",
  "<!-- board:end -->",
  boardBlock,
  "docs/show-hn.md"
);

/**
 * The registry size, in a document that has to carry it.
 *
 * It was "tens of thousands", which is an approximation, and the house
 * voice does not allow one: "Not as an approximation, not as 'roughly',
 * not as 'around'."
 *
 * Two documents carry it: the README's opening and the post's opening.
 * Both are checked rather than assumed. The first version of the
 * replacement used a regex that only matched a figure, so when a
 * document said "tens of thousands" the replace silently did nothing
 * and the script reported success. A script that reports success and
 * writes nothing is the same class of defect the script exists to
 * remove.
 *
 * When the deployment does not report the count, the sentence is left
 * alone and the script says so, because a figure it cannot read is not
 * one it is allowed to write.
 */
const registryPattern =
  /There are (?:[\d,]+ servers|tens of thousands of servers) in the official MCP registry/;

const registrySentences = [
  { file: "README.md", text: readme },
  { file: "docs/show-hn.md", text: post },
];

for (const { file, text } of registrySentences) {
  if (!registryPattern.test(text)) {
    console.error(
      `${file}: the registry size sentence was not found, so nothing was written.\n` +
        `The script needs a sentence matching:\n` +
        "  There are <figure> servers in the official MCP registry"
    );
    process.exit(1);
  }
}

if (!missing.includes("servers")) {
  const replacement = `There are ${num(stats.servers)} servers in the official MCP registry`;
  readme = readme.replace(registryPattern, replacement);
  post = post.replace(registryPattern, replacement);
} else {
  console.warn(
    "The registry size was left as it was, because this deployment does not\n" +
      "report it. Run the script again after deploying."
  );
}

post = post.replace(
  /<!-- measured -->[\s\S]*?<!-- \/measured -->/,
  `<!-- measured -->\nEvery figure above was read from \`GET ${base}/api/stats\` on ${MEASURED}. It is a measurement, not a promise: agents are filing wishes against the live board while you read this.\n<!-- /measured -->`
);

/* ------------------------------------------------------------------ *
 * Write
 *
 * Every check has run by now. The script used to write the README
 * before it checked the post, so a failed check left a half-updated
 * tree: one document current and the other stale, with no error to
 * explain the difference. Now a failure writes nothing at all.
 * ------------------------------------------------------------------ */

writeFileSync(readmePath, readme);
console.log(`README.md: ${figure("wishes")} wishes, ${figure("agents")} agents, ${entries} published`);

writeFileSync(postPath, post);
console.log(`docs/show-hn.md: ${entries} published entries`);
