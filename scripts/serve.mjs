#!/usr/bin/env node
/**
 * Open the site locally.
 *
 * `wrangler dev --remote` runs the Worker on Cloudflare's network, so it has
 * the real D1, the real Vectorize and the real Workers AI. That is the only
 * way to exercise the wish path locally: Vectorize has no local mode.
 *
 * The catch is that the dev server forwards through the same edge as the
 * deployed site, so a request for a URL the edge has seen before comes back
 * from the edge cache, and it is the DEPLOYED page rather than the code you
 * just edited. The page looks unchanged, the change looks like it did not
 * apply, and restarting the server does not help, because the edge is
 * answering.
 *
 * So this script starts the dev server and then prints a URL that asks the
 * edge not to cache: a request carrying `Cache-Control: no-cache` is
 * answered by the Worker, not by the edge.
 *
 *   node scripts/serve.mjs           start the server and print the URL
 *   node scripts/serve.mjs --port 9000
 */

import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const PORT = portIndex >= 0 ? args[portIndex + 1] : "8787";
const HOST = "127.0.0.1";

/**
 * The local secrets.
 *
 * `wrangler dev` reads .dev.vars. The values here are local-only: the
 * salt and session secret just have to be stable within a session, and the
 * admin passphrase is the one you would use on your own machine. It is
 * deliberately NOT the production value, so a local run cannot write to
 * production as an admin.
 */
const DEV_VARS = `ADMIN_TOKEN="local-dev"
IP_SALT="local-dev-salt"
SESSION_SECRET="local-dev-session-secret"
`;

if (!existsSync(join(ROOT, ".dev.vars"))) {
  writeFileSync(join(ROOT, ".dev.vars"), DEV_VARS);
  console.log("wrote .dev.vars with local-only secrets");
}

console.log(`starting the dev server on http://${HOST}:${PORT} ...`);
console.log("");

const child = spawn(
  "npx",
  ["wrangler", "dev", "--remote", "--port", PORT, "--ip", HOST],
  { cwd: ROOT, stdio: ["ignore", "inherit", "inherit"] }
);

const url = `http://${HOST}:${PORT}`;
console.log(`  the site:      ${url}`);
console.log(`  fresh copy:    ${url}/about`);
console.log("");
console.log("  The dev server runs behind the same edge as the deployed site, so a");
console.log("  URL the edge has already seen can come back from its cache and show");
console.log("  the DEPLOYED page rather than your edits. If a change does not appear,");
console.log("  add a query parameter to the URL:");
console.log("");
console.log(`      ${url}/?nocache=${Date.now()}`);
console.log("");
console.log("  Ctrl-C to stop.");

const stop = () => {
  child.kill("SIGINT");
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => process.exit(code ?? 0));
