/**
 * End to end test of the builder flow:
 *   claim a wish with a GitHub-style session  ->  "Being built"
 *   mark it shipped                           ->  agents get pointed at it
 *
 *   node scripts/test-claim.mjs
 */

import { readFile } from "node:fs/promises";
import { createHmac } from "node:crypto";

const WORKER = process.env.WORKER_URL ?? "https://toolswanted.dev";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? (await readFile("/tmp/admin_token", "utf8")).trim();
const SESSION_SECRET =
  process.env.SESSION_SECRET ?? (await readFile("/tmp/session_secret", "utf8")).trim();

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function signSession(session) {
  const payload = b64url(Buffer.from(JSON.stringify(session)));
  const sig = b64url(createHmac("sha256", SESSION_SECRET).update(payload).digest());
  return `${payload}.${sig}`;
}

const SLUG = process.env.SLUG ?? "read-uk-council-planning-pdfs-as-structured-data";
const REPO = "https://github.com/example/planning-pdf-mcp";

function check(label, ok, detail = "") {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const cookie = `tw_session=${signSession({
    login: "example",
    id: 1,
    exp: Date.now() + 60 * 60 * 1000,
  })}`;

  console.log("\n1. Claim a wish");
  const claim = await fetch(`${WORKER}/claim`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie },
    body: new URLSearchParams({ slug: SLUG, repo: REPO, note: "Beta in a fortnight" }).toString(),
    redirect: "manual",
  });
  check("claim redirects to the cluster", claim.status === 302, `status ${claim.status}`);

  const page = await fetch(`${WORKER}/w/${SLUG}`).then((r) => r.text());
  check("the page shows 'Being built'", page.includes("Being built"));
  check("the page links the repo", page.includes(REPO));

  console.log("\n2. An agent searches for it");
  const search = await rpc("tools/call", {
    name: "search_wishes",
    arguments: { query: "read planning PDFs" },
  });
  check("search finds the cluster", search.includes(SLUG));
  check("search says who is building it", search.includes("@example"));

  console.log("\n3. Mark it shipped");
  const cluster = await fetch(`${WORKER}/api/cluster/${SLUG}`).then((r) => r.json());
  const ship = await fetch(`${WORKER}/admin/cluster/${cluster.id}/ship`, {
    method: "POST",
    headers: {
      "x-admin-token": ADMIN_TOKEN,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ login: "example", repo: REPO }).toString(),
    redirect: "manual",
  });
  check("ship accepted", ship.status === 302, `status ${ship.status}`);

  console.log("\n4. Now agents get pointed at it");
  const wish = await rpc("tools/call", {
    name: "wish",
    arguments: {
      need: "Read UK council planning PDFs as structured data",
      client: "cursor",
    },
  });
  check("wish() mentions SHIPPED", /SHIPPED/i.test(wish), wish.split("\n")[0]);
  check("wish() links the repo", wish.includes(REPO));

  const search2 = await rpc("tools/call", {
    name: "search_wishes",
    arguments: { query: "planning PDF" },
  });
  check("search_wishes() says SHIPPED", /SHIPPED/i.test(search2));

  const after = await fetch(`${WORKER}/api/cluster/${SLUG}`).then((r) => r.json());
  check("the API marks it shipped", after.shipped === true);
  check("the API returns the repo", after.repo === REPO);
}

async function rpc(method, params) {
  const res = await fetch(`${WORKER}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "user-agent": "claim-test/0.1",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  return json?.result?.content?.[0]?.text ?? JSON.stringify(json);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
