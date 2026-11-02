/**
 * Mirror of the official MCP registry.
 *
 * Purpose: when an agent wishes for something that already exists, we say so
 * instead of making it wait. The registry has tens of thousands of servers,
 * so the crawl runs in the background in small batches: the free Workers plan
 * gives 10ms of CPU per invocation and we stay well inside it.
 */

import { embedBatch, upsertServerVectors, SERVER_MODEL } from "./embed";
import { upsertServers } from "./db";
import { backgroundBudget } from "./budget";
import { getMeta, setMeta } from "./db";
import type { Env } from "./types";
import type { ServerRecord } from "./types";

const REGISTRY_BASE = "https://registry.modelcontextprotocol.io/v0.1";
const PAGE_SIZE = 25;

interface RegistryServer {
  server?: {
    name?: string;
    title?: string;
    description?: string;
    version?: string;
    remotes?: Array<{ type?: string; url?: string }>;
    packages?: Array<{ registry_type?: string; identifier?: string; version?: string }>;
  };
}

export interface CrawlResult {
  fetched: number;
  stored: number;
  nextCursor: string | null;
  exhausted: boolean;
  skipped?: string;
}

/** Fetch one page of the registry. */
export async function fetchRegistryPage(
  cursor: string | null,
  limit = PAGE_SIZE
): Promise<{ servers: RegistryServer[]; nextCursor: string | null }> {
  const url = new URL(`${REGISTRY_BASE}/servers`);
  url.searchParams.set("limit", String(limit));
  if (cursor) url.searchParams.set("cursor", cursor);
  const res = await fetch(url.toString(), {
    headers: { accept: "application/json", "user-agent": "toolswanted/0.1 (+https://toolswanted.dev)" },
  });
  if (!res.ok) throw new Error(`registry returned ${res.status}`);
  const json = (await res.json()) as { servers?: RegistryServer[]; metadata?: { nextCursor?: string } };
  return {
    servers: json.servers ?? [],
    nextCursor: json.metadata?.nextCursor ?? null,
  };
}

function toRecord(entry: RegistryServer): ServerRecord | null {
  const server = entry.server;
  if (!server?.name) return null;
  const remote =
    server.remotes?.find((r) => r.type === "streamable-http")?.url ??
    server.remotes?.find((r) => r.url)?.url ??
    null;
  const pkg = server.packages?.[0];
  const pkgUrl =
    pkg?.registry_type === "npm" && pkg.identifier
      ? `https://www.npmjs.com/package/${pkg.identifier}`
      : null;
  return {
    name: server.name,
    title: (server.title ?? server.name).slice(0, 120),
    description: (server.description ?? "").slice(0, 600),
    remotes: JSON.stringify({ remote, pkg: pkgUrl, version: server.version ?? null }),
    packages: server.packages ? JSON.stringify(server.packages) : null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Crawl up to `max` servers, embed them and store them.
 * Returns how far it got.
 */
export async function crawlRegistry(env: Env, max = PAGE_SIZE): Promise<CrawlResult> {
  const cursor = await getMeta(env.DB, "registry_cursor");
  const { servers, nextCursor } = await fetchRegistryPage(cursor, PAGE_SIZE);

  const records: ServerRecord[] = [];
  for (const entry of servers) {
    const record = toRecord(entry);
    if (record) records.push(record);
  }
  if (records.length === 0) {
    return { fetched: 0, stored: 0, nextCursor, exhausted: !nextCursor };
  }

  // Embed only the text we search against.
  const texts = records.map((r) => `${r.title}. ${r.description}`.slice(0, 480));
  const estimated = Math.ceil(texts.reduce((n, t) => n + t.length / 4, 0) / 1000) + 1;
  const allowed = await backgroundBudget(env, estimated);
  if (!allowed) {
    return {
      fetched: records.length,
      stored: 0,
      nextCursor: cursor,
      exhausted: false,
      skipped: "daily neuron budget",
    };
  }

  const vectors = await embedBatch(env, texts, SERVER_MODEL);

  await upsertServers(env.DB, records);
  await upsertServerVectors(
    env,
    records.map((r, i) => ({
      id: r.name,
      values: vectors[i]!,
      metadata: {
        title: r.title ?? r.name,
        description: (r.description ?? "").slice(0, 220),
        url: serverUrl(r),
      },
    }))
  );

  if (nextCursor) await setMeta(env.DB, "registry_cursor", nextCursor);
  else await setMeta(env.DB, "registry_cursor", "");

  return { fetched: records.length, stored: records.length, nextCursor, exhausted: !nextCursor };
}

/** Best link for a server. */
export function serverUrl(record: ServerRecord): string {
  try {
    const parsed = JSON.parse(record.remotes ?? "{}") as {
      remote?: string | null;
      pkg?: string | null;
    };
    if (parsed.remote) return parsed.remote;
    if (parsed.pkg) return parsed.pkg;
  } catch {
    /* fall through */
  }
  return `https://registry.modelcontextprotocol.io/v0.1/servers?search=${encodeURIComponent(record.name)}`;
}

/** Search the registry API directly, for the admin panel. */
export async function searchRegistry(query: string, limit = 10): Promise<RegistryServer[]> {
  const url = new URL(`${REGISTRY_BASE}/servers`);
  url.searchParams.set("search", query);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString(), { headers: { accept: "application/json" } });
  if (!res.ok) return [];
  const json = (await res.json()) as { servers?: RegistryServer[] };
  return json.servers ?? [];
}
