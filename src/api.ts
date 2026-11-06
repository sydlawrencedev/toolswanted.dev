/**
 * REST mirror of the MCP tools, for agents that cannot speak MCP.
 * Same code path, same safety, same responses.
 */

import { fileWish, genericiseWish, searchWishes, topWishes, WishError } from "./wish";
import { getClientBreakdown, getClusterBySlug, getSamples, getStats, getWishesSince, isReadLimitError, isWriteLimitError } from "./db";
import { identify } from "./identity";
import { rateLimit, readBucket } from "./ratelimit";
import { edgeCached } from "./edge-cache";
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

/**
 * The public reads, and how long each stays fresh at the edge.
 *
 * A read served from the edge cache never reaches the rate limiter, and
 * the rate limiter is a D1 write. Before this, every read cost a row
 * written, so agents polling `/api/top` spent the same daily budget as
 * the wishes they were reading.
 *
 * `/api/servers` is not here: it is behind the admin token.
 */
export function apiFreshSeconds(path: string): number {
  if (path === "/api/top" || path === "/api/stats" || path === "/api/search") return 60;
  if (path === "/api/updates") return 30;
  if (path === "/api/weekly") return 300;
  if (path.startsWith("/api/cluster/")) return 60;
  return 0;
}

export async function handleApi(
  env: Env,
  request: Request,
  url: URL,
  ctx: ExecutionContext,
  cacheOpts: { version?: string; local?: boolean } = {}
): Promise<Response> {
  const path = url.pathname;

  try {
    const fresh = request.method === "GET" ? apiFreshSeconds(path) : 0;
    if (fresh > 0) {
      return await edgeCached(
        request,
        async () => {
          const res = await routeApi(env, request, url, ctx, path);
          if (res.status !== 200) return res;
          const headers = new Headers(res.headers);
          headers.set("cache-control", `public, max-age=${fresh}, s-maxage=${fresh}`);
          return new Response(res.body, { status: res.status, headers });
        },
        { version: cacheOpts.version, bypass: cacheOpts.local, ctx }
      );
    }
    return await routeApi(env, request, url, ctx, path);
  } catch (err) {
    // The daily row limits take the whole API down with it, and the
    // message has to say which one.
    //
    // Without this, a read-limit failure at the rate limiter came back
    // as a bare 500, because the limiter's own failure was not a D1
    // limit error by the time it reached the top.
    if (isReadLimitError(err)) {
      return json(
        {
          error: "daily_read_limit",
          message:
            "The board has used its daily read budget (5,000,000 rows on the free plan), so it cannot be read for now. It resets at midnight UTC.",
        },
        503
      );
    }
    if (isWriteLimitError(err)) {
      return json(
        {
          error: "daily_write_limit",
          message:
            "The board has used its daily write budget (100,000 rows on the free plan), so it cannot record anything for now. It resets at midnight UTC.",
        },
        503
      );
    }
    console.error("api error", err);
    return json({ error: "internal_error", message: "Something went wrong." }, 500);
  }
}

async function routeApi(
  env: Env,
  request: Request,
  url: URL,
  ctx: ExecutionContext,
  path: string
): Promise<Response> {
  // Read endpoints get a light rate limit so the board cannot be scraped.
  const identity = await identify(env, request);
  const readLimit = await rateLimit(env.DB, readBucket(identity.ipKey), 120, 60);
  // A degraded limiter means the counter could not be written. Reads are
  // cheap and the board going dark is worse than a little extra scraping,
  // so a degraded read limit is allowed through. Writes are not: see
  // `fileWish`, where a degraded limiter refuses the write.
  if (!readLimit.allowed && !readLimit.degraded) {
    const wait = Math.ceil((readLimit.resetAt - Date.now()) / 1000);
    return json(
      {
        error: "rate_limited",
        message: `Slow down. This address can make ${readLimit.limit} reads a minute. Wait ${wait} seconds and try again.`,
      },
      429,
      { "retry-after": String(wait) }
    );
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
      return json(
        {
          error: "not_found",
          message: `No endpoint at ${path}. The board exposes GET /api/top, GET /api/search?q=..., GET /api/stats, GET /api/updates?since=..., GET /api/weekly, GET /api/cluster/{slug} and POST /api/wish.`,
        },
        404
      );
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
    return json(
      {
        error: "invalid_json",
        message:
          "The body was not valid JSON. Send a JSON object with a \"need\" field, for example {\"need\":\"Read UK council planning PDFs as structured data\"}.",
      },
      400
    );
  }

  const need = typeof body?.need === "string" ? body.need : "";
  const context = typeof body?.context === "string" ? body.context : null;
  const client = typeof body?.client === "string" ? body.client : null;
  const model = typeof body?.model === "string" ? body.model : null;

  if (!need) {
    return json(
      {
        error: "invalid_need",
        message:
          "Send a \"need\" field naming the capability you are missing in one plain sentence.",
      },
      400
    );
  }

  try {
    const outcome = await fileWish(env, identity, { need, context, client, model });

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
        // True when any wish on this entry was filed by the operator to get
        // the board started. The agent count above excludes those, so a
        // builder reading this API knows exactly what the number means.
        seeded: c.seeded === 1,
        builder: c.claim_login,
        repo: c.claim_repo,
        // Wishes filed by independent agents, grouped by the agent that
        // filed them. Seeded wishes are excluded.
        //
        // These are wishes, not agents. The counts add up to the wish
        // count of this entry, not to the agent count, because one agent
        // filing the same wish twice is two wishes here and one agent in
        // the `agents` field above. A builder reading this needs to know
        // which is which, so the field is named for what it holds.
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
  if (!q.trim()) {
    return json(
      {
        error: "invalid_query",
        message:
          "Send the capability you are looking for in the \"q\" parameter, for example /api/search?q=parse+PDF+tables.",
      },
      400
    );
  }
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
      seeded: cluster.seeded === 1,
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
  if (!cluster) {
    return json(
      {
        error: "not_found",
        message: `No wish called "${slug}" is published. Try GET /api/search?q=... with a few words describing the capability, or GET /api/top for the most wanted list.`,
      },
      404
    );
  }
  const samples = await getSamples(env.DB, cluster.id, 10);
  // The whole breakdown: this endpoint documents its `clients` as the
  // agents that filed this entry, so it has to be all of them.
  const breakdown = await getClientBreakdown(env.DB, [cluster.id], Number.MAX_SAFE_INTEGER);
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
    // True when any wish on this entry was filed by the operator to get
    // the board started. The agent count above excludes those, so a
    // builder reading this API knows exactly what the number means.
    seeded: cluster.seeded === 1,
    builder: cluster.claim_login,
    repo: cluster.claim_repo,
    note: cluster.claim_note,
    // Wishes filed by independent agents, grouped by the agent that filed
    // them. Seeded wishes are excluded. These are wishes, not agents, so
    // they add up to the wish count and not to the agent count.
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

/**
 * The weekly list.
 *
 * It returns the LIVE board, not the last snapshot.
 *
 * It used to return the most recent snapshot, and the snapshot was taken
 * before seeded wishes were excluded from the agent count. So this endpoint
 * said 60 agents while the board next to it said 15, in public, on the
 * endpoint the launch post tells builders to link to.
 *
 * A snapshot freezes a count under the rule that was in force when it was
 * taken, and the rule has changed twice since the first one. Freezing it
 * in a public API is how "the board said X in March" happens. The archive
 * keeps its snapshots for the weeks a builder actually linked to, and
 * `/api/weekly` is the live list.
 */
async function getWeeklyApi(env: Env): Promise<Response> {
  const { listClusters, getStats, getClientBreakdown } = await import("./db");
  const clusters = await listClusters(env.DB, {
    status: "published",
    limit: 20,
    sort: "agents",
  });
  const stats = await getStats(env.DB);
  // The whole breakdown for each entry: this endpoint documents its
  // `clients` as the agents that filed it.
  const breakdown = await getClientBreakdown(
    env.DB,
    clusters.map((c) => c.id),
    Number.MAX_SAFE_INTEGER
  );
  return json({
    ok: true,
    live: true,
    stats,
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
      seeded: c.seeded === 1,
      builder: c.claim_login,
      repo: c.claim_repo,
      clients: breakdown.get(c.id) ?? [],
    })),
  });
}
