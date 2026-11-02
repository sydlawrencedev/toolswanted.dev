/**
 * Push the mirror of the official MCP registry forward.
 *
 * The Worker crawls in small batches (the free plan caps CPU and subrequests
 * per invocation), so this drives it. It stops when the registry is exhausted
 * or the daily neuron budget runs out.
 *
 *   node scripts/crawl-registry.ts [maxCalls]
 */

import { readFile } from "node:fs/promises";

const WORKER = process.env.WORKER_URL ?? "https://toolswanted.sydlawrence.workers.dev";
const ADMIN_TOKEN =
  process.env.ADMIN_TOKEN ?? (await readFile("/tmp/admin_token", "utf8")).trim();
const MAX_CALLS = Number(process.argv[2] ?? 400);
const PARALLEL = 1;

async function crawl(): Promise<{ fetched: number; stored: number; exhausted: boolean; skipped?: string }> {
  const res = await fetch(`${WORKER}/admin/crawl`, {
    method: "POST",
    headers: { "x-admin-token": ADMIN_TOKEN },
  });
  const json = (await res.json()) as {
    ok: boolean;
    fetched?: number;
    stored?: number;
    exhausted?: boolean;
    skipped?: string;
    error?: string;
  };
  if (!json.ok) throw new Error(json.error ?? "crawl failed");
  return {
    fetched: json.fetched ?? 0,
    stored: json.stored ?? 0,
    exhausted: json.exhausted ?? false,
    skipped: json.skipped,
  };
}

async function main() {
  console.log(`Crawling the MCP registry via ${WORKER}/admin/crawl ...`);
  let total = 0;
  for (let call = 0; call < MAX_CALLS; call++) {
    const results = await Promise.all(Array.from({ length: PARALLEL }, () => crawl()));
    const stored = results.reduce((n, r) => n + r.stored, 0);
    total += stored;
    if (call % 10 === 0 || results.some((r) => r.exhausted || r.skipped)) {
      process.stdout.write(`  ${total} servers indexed`);
      const skipped = results.find((r) => r.skipped);
      if (skipped?.skipped) process.stdout.write(` (stopped: ${skipped.skipped})`);
      process.stdout.write("\n");
    }
    if (results.some((r) => r.exhausted)) {
      console.log("Registry exhausted.");
      break;
    }
    if (results.some((r) => r.skipped)) {
      console.log("Stopped: out of neuron budget. Run again tomorrow.");
      break;
    }
  }
  console.log(`Done. ${total} servers indexed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

export {};
