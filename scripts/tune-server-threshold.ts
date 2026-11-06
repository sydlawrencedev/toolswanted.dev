/**
 * Tune the "this already exists" threshold.
 *
 * The registry mirror is used to tell an agent that a tool it wants already
 * exists. A wrong suggestion wastes the agent's time; a missing suggestion is
 * merely a missed opportunity. So this leans towards precision.
 *
 *   node scripts/tune-server-threshold.ts
 */

import { adminToken } from "./admin-token.mjs";

const WORKER = process.env.WORKER_URL ?? "https://toolswanted.dev";
const ADMIN_TOKEN = await adminToken();

/** wish text -> a server that genuinely does this */
const SHOULD_MATCH: Array<[string, string]> = [
  ["Read a PDF invoice into structured line items", "invoice"],
  ["Convert a PDF to text", "pdf"],
  ["Read a PDF document and summarise it", "pdf"],
  ["Get the weather for a city", "weather"],
  ["Search the web for news", "search"],
  ["Send an email", "email"],
  ["Post a message to Slack", "slack"],
  ["Store and query data in a database", "database"],
  ["Generate an image from a prompt", "image"],
  ["Transcribe an audio file to text", "audio"],
  ["Look up a package on npm", "npm"],
  ["Fetch a web page and return its content", "fetch"],
  ["Read a GitHub repository", "github"],
  ["Query a Postgres database", "postgres"],
];

async function main() {
  console.log("wish".padEnd(52), "expected", "best server", "score");
  console.log("-".repeat(110));

  const bestScores: number[] = [];
  for (const [i, [wish, expected]] of SHOULD_MATCH.entries()) {
    const found = await fetch(`${WORKER}/api/servers?q=${encodeURIComponent(wish)}&vector=1`, {
      headers: { "x-admin-token": ADMIN_TOKEN },
    });
    if (!found.ok) {
      console.log(`${wish.padEnd(52)} ERROR ${found.status}`);
      continue;
    }
    const json = (await found.json()) as { matches: Array<{ name: string; score: number; description: string }> };
    const hit = json.matches.find((m) => m.name.toLowerCase().includes(expected.toLowerCase()));
    const top = json.matches[0];
    bestScores.push(hit?.score ?? 0);
    console.log(
      `${wish.padEnd(52)} ${expected.padEnd(9)} ${(hit?.name ?? top?.name ?? "-").slice(0, 34).padEnd(35)} ${(hit?.score ?? 0).toFixed(4)}`
    );
  }

  const usable = bestScores.filter((s) => s > 0);
  console.log(`\n${usable.length}/${SHOULD_MATCH.length} wishes found a relevant server.`);
  if (usable.length) {
    console.log(`weakest relevant match: ${Math.min(...usable).toFixed(4)}`);
    console.log(`Suggest setting SERVER_MATCH_THRESHOLD just below that, e.g. ${(Math.min(...usable) - 0.01).toFixed(3)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

export {};
