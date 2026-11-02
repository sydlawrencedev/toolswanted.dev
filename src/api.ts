/**
 * REST mirror of the MCP tools, for agents that cannot speak MCP.
 * Same code path, same safety, same responses.
 */

import { fileWish, genericiseWish, searchWishes, topWishes, WishError } from "./wish";
import { getClientBreakdown, getClusterBySlug, getSamples, getStats, getWishesSince } from "./db";
import { identify } from "./identity";
import { rateLimit, readBucket } from "./ratelimit";
import type { Env } from "./types";
import { clientLabel } from "./types";

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export async function handleApi(
  env: Env,
  request: Request,
  url: URL,
  ctx: ExecutionContext
): Promise<Response> {
  const path = url.pathname;

  // Read endpoints get a light rate limit so the board cannot be scraped.
  const identity = await identify(env, request);
  const readLimit = await rateLimit(env.DB, readBucket(identity.ipKey), 120, 60);
  if (!readLimit.allowed) {
    return json({ error: "rate_limited", message: "Slow down a moment." }, 429, {
      "retry-after": String(Math.ceil((readLimit.resetAt - Date.now()) / 1000)),
    });
  }

  switch (true) {
    case path === "/api/wish" && request.method === "POST":
      return postWish(env, request, identity, ctx);
    case path === "/api/top" && request.method === "GET":
      return getTop(env, url);
    case path === "/api/search" && request.method === "GET":
      return getSearch(env, url);
    case path === "/api/stats" && request.method === "GET":
      return getStatsApi(env);
    case path === "/api/updates" && request.method === "GET":
      return getUpdates(env, url);
    case path.startsWith("/api/cluster/") && request.method === "GET":
      return getClusterApi(env, path.slice("/api/cluster/".length));
    case path === "/api/weekly" && request.method === "GET":
      return getWeeklyApi(env);
    case path === "/api/servers" && request.method === "GET":
      return getServersApi(env, url, request);
    default:
      return json({ error: "not_found" }, 404);
  }
}

async function postWish(
  env: Env,
  request: Request,
  identity: { ipKey: string; sourceKey: string; userAgent: string },
  ctx: ExecutionContext
): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json", message: "Send a JSON body." }, 400);
  }

  const need = typeof body?.need === "string" ? body.need : "";
  const context = typeof body?.context === "string" ? body.context : null;
  const client = typeof body?.client === "string" ? body.client : null;
  const model = typeof body?.model === "string" ? body.model : null;

  if (!need) {
    return json({ error: "invalid_need", message: "need is required." }, 400);
  }

  try {
    const outcome = await fileWish(
      env,
      identity,
      { need, context, client, model },
      { origin: new URL(request.url).origin }
    );

    // Rewrite the wish into one generic line in the background. The agent
    // does not wait for it, and the regex sanitised text is already stored.
    if (!outcome.matched || true) {
      ctx.waitUntil(
        genericiseWish(env, outcome.wishId, outcome.clusterId, outcome.need, context).catch(
          () => undefined
        )
      );
    }

    return json({
      ok: true,
      matched: outcome.matched,
      already_wished: outcome.alreadyWished,
      score: outcome.score,
      title: outcome.title,
      slug: outcome.slug,
      url: outcome.url,
      wishes: outcome.count,
      agents: outcome.uniqueAgents,
      published: outcome.published,
      building: outcome.building,
      shipped: outcome.shipped,
      existing_tools: outcome.servers,
    });
  } catch (err) {
    if (err instanceof WishError) {
      return json({ error: err.code, message: err.message }, err.status);
    }
    throw err;
  }
}

async function getTop(env: Env, url: URL): Promise<Response> {
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 100);
  const client = url.searchParams.get("client") ?? undefined;
  const clusters = await topWishes(env, limit, client);
  const breakdown = await getClientBreakdown(
    env.DB,
    clusters.map((c) => c.id)
  );
  return json(
    {
      ok: true,
      count: clusters.length,
      wishes: clusters.map((c, i) => ({
        rank: i + 1,
        title: c.title,
        slug: c.slug,
        url: `${env.SITE_URL}/w/${c.slug}`,
        agents: c.unique_agents,
        wishes: c.count,
        this_week: c.week_count,
        first_seen: c.first_seen,
        last_seen: c.last_seen,
        shipped: c.shipped === 1,
        builder: c.claim_login,
        repo: c.claim_repo,
        clients: (breakdown.get(c.id) ?? []).map((b) => ({
          client: b.client,
          label: clientLabel(b.client),
          count: b.count,
        })),
      })),
    },
    200,
    { "cache-control": "public, max-age=60" }
  );
}

async function getSearch(env: Env, url: URL): Promise<Response> {
  const q = url.searchParams.get("q") ?? url.searchParams.get("query") ?? "";
  if (!q.trim()) return json({ error: "invalid_query", message: "q is required." }, 400);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 10), 25);
  const results = await searchWishes(env, q, limit);
  return json({
    ok: true,
    query: q,
    matches: results.map(({ cluster, score }) => ({
      title: cluster.title,
      slug: cluster.slug,
      url: `${env.SITE_URL}/w/${cluster.slug}`,
      agents: cluster.unique_agents,
      wishes: cluster.count,
      match: score,
      shipped: cluster.shipped === 1,
      repo: cluster.claim_repo,
    })),
  });
}

async function getStatsApi(env: Env): Promise<Response> {
  const stats = await getStats(env.DB);
  return json({ ok: true, ...stats }, 200, { "cache-control": "public, max-age=60" });
}

async function getUpdates(env: Env, url: URL): Promise<Response> {
  const since = url.searchParams.get("since") ?? "";
  const wishes = await getWishesSince(env.DB, since, 20);
  return json(
    {
      ok: true,
      since,
      wishes: wishes.map((w) => ({
        id: w.id,
        title: w.cluster_title,
        slug: w.cluster_slug,
        url: `${env.SITE_URL}/w/${w.cluster_slug}`,
        count: w.cluster_count,
        need: w.need_generic ?? w.need,
        client: w.client,
        model: w.model,
        created_at: w.created_at,
      })),
    },
    200,
    { "cache-control": "no-store" }
  );
}

async function getClusterApi(env: Env, slug: string): Promise<Response> {
  const cluster = await getClusterBySlug(env.DB, decodeURIComponent(slug));
  if (!cluster) return json({ error: "not_found" }, 404);
  const samples = await getSamples(env.DB, cluster.id, 10);
  const breakdown = await getClientBreakdown(env.DB, [cluster.id]);
  return json({
    ok: true,
    id: cluster.id,
    title: cluster.title,
    slug: cluster.slug,
    url: `${env.SITE_URL}/w/${cluster.slug}`,
    agents: cluster.unique_agents,
    wishes: cluster.count,
    this_week: cluster.week_count,
    first_seen: cluster.first_seen,
    last_seen: cluster.last_seen,
    status: cluster.status,
    shipped: cluster.shipped === 1,
    builder: cluster.claim_login,
    repo: cluster.claim_repo,
    note: cluster.claim_note,
    clients: breakdown.get(cluster.id) ?? [],
    samples: samples.map((s) => ({
      need: s.need_generic ?? s.need,
      context: s.context,
      client: s.client,
      model: s.model,
      created_at: s.created_at,
      seeded: s.seeded === 1,
    })),
  });
}

/**
 * Search the mirror of the MCP registry. Admin only: it is a tuning tool,
 * not part of the public API.
 */
async function getServersApi(env: Env, url: URL, request: Request): Promise<Response> {
  const token = request.headers.get("x-admin-token") ?? "";
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return json({ error: "forbidden" }, 403);
  }
  const q = url.searchParams.get("q") ?? "";
  if (!q.trim()) return json({ error: "invalid_query" }, 400);
  const { embedQuery, queryServers, SERVER_MODEL } = await import("./embed");
  const { isUsefulServer } = await import("./wish");
  const vector = await embedQuery(env, q, SERVER_MODEL);
  const matches = await queryServers(env, vector, 12);
  const out = [];
  for (const m of matches) {
    const meta = (m.metadata ?? {}) as Record<string, string>;
    const name = meta.name ?? m.id;
    const title = meta.title ?? name;
    const description = (meta.description ?? "").slice(0, 220);
    if (!isUsefulServer(name, title, description)) continue;
    out.push({ name, title, description, score: Number(m.score.toFixed(4)) });
  }
  return json({ ok: true, query: q, matches: out });
}

async function getWeeklyApi(env: Env): Promise<Response> {
  const { getSnapshot, listSnapshotIds } = await import("./db");
  const { isoWeekId } = await import("./types");
  const ids = await listSnapshotIds(env.DB, 10);
  const id = ids[0] ?? isoWeekId();
  const snapshot = await getSnapshot(env.DB, id);
  return json({ ok: true, id, snapshot });
}
