/**
 * Tools Wanted, one Worker, one routing table.
 *
 * Routes:
 *   GET  /                 the board
 *   GET  /w/:slug          a cluster page
 *   GET  /weekly           the weekly most wanted page
 *   GET  /agents           setup for agents
 *   GET  /build            claim a wish (GitHub login)
 *   GET  /about /privacy   static pages
 *   GET  /llms.txt         for LLM crawlers
 *   GET  /feed.xml         RSS
 *   POST /mcp              the MCP server (streamable HTTP, no auth)
 *   POST /api/wish         REST mirror
 *   GET  /api/top|search|stats|updates|cluster/:slug
 *   GET  /admin            moderation
 *   GET  /auth/github      builder sign in
 */

import { CSS, esc, escAttr, layout } from "./html";
import { fontResponse } from "./font";
import { handleApi } from "./api";
import { handleMcpRequest } from "./mcp";
import { identify } from "./identity";
import { handleAdmin, purgeClusterCache, readForm } from "./admin";
import { isWriteLimitError } from "./db";
import { crawlRegistry } from "./registry";
import { fileWish, WishError } from "./wish";
import * as db from "./db";
import {
  completeGitHubLogin,
  githubAuthorizeUrl,
  makeState,
  readSession,
  readState,
  sessionCookie,
  sessionSecret,
  signSession,
  verifySession,
} from "./auth";
import {
  renderAbout,
  renderAgents,
  renderBoard,
  renderBuild,
  renderCluster,
  renderLlmsFull,
  renderLlmsTxt,
  renderPrivacy,
  renderWeekly,
  renderWishForm,
  renderWishResult,
  type WishFormResult,
} from "./board";
import { isPreviewBot, isCrawler } from "./bots";
import { rateLimit } from "./ratelimit";
import { renderFeed, renderWishFeed } from "./rss";
import { isoWeekId, num, weekStart, countWithVerb, type Env } from "./types";

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#151210"/><text x="32" y="44" font-family="Helvetica,Arial,sans-serif" font-weight="900" font-size="38" fill="#d32a1c" text-anchor="middle">W</text></svg>`;

function html(body: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...headers },
  });
}

/**
 * D1's free plan gives 100,000 rows written a day. When that is spent, say
 * so plainly and say when it resets, rather than showing a Cloudflare error
 * page and making it look like the board is broken.
 */
function writeLimitResponse(err: unknown, request: Request, env: Env): Response {
  if (!isWriteLimitError(err)) {
    console.error("unhandled error", err);
    return new Response("Something went wrong.", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  console.error("d1 write limit reached", err);
  const reset = new Date();
  reset.setUTCHours(24, 0, 0, 0);
  const hours = Math.max(1, Math.ceil((reset.getTime() - Date.now()) / 3_600_000));
  const message = `The board has used its daily write budget (100,000 rows on the free plan). It resets at midnight UTC, in about ${hours} hour${hours === 1 ? "" : "s"}.`;
  const accepts = request.headers.get("accept") ?? "";
  const wantsJson =
    path_isApi(request) ||
    accepts.includes("application/json") ||
    new URL(request.url).searchParams.get("format") === "json";
  if (wantsJson) {
    return new Response(JSON.stringify({ error: "daily_write_limit", message }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  if (request.headers.get("accept")?.includes("text/event-stream")) {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  }
  return html(
    layout(
      {
        title: "Briefly out of writes",
        description: message,
        canonical: `${env.SITE_URL}/`,
        noindex: true,
      },
      `<section class="page"><div class="wrap"><h1>Out of writes</h1><p>${esc(message)}</p><p>Reading the board still works; filing new wishes and moderating do not, for now.</p></div></section>`
    ),
    503
  );
}

function acceptsJson(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/json");
}

function path_isApi(request: Request): boolean {
  const path = new URL(request.url).pathname;
  return path === "/mcp" || path.startsWith("/api/");
}

function notFound(env: Env): Response {
  return html(
    layout(
      {
        title: "Not found",
        description: "That page does not exist. Search the board, or go back to it.",
        canonical: `${env.SITE_URL}/404`,
        noindex: true,
      },
      `<section class="page"><div class="wrap">
  <h1>404</h1>
  <p>There is no page at this address. <a class="under" href="/">Back to the board</a>, or <a class="under" href="/weekly">this week's most wanted</a>.</p>
  <div class="card">
    <form method="get" action="/wish">
      <p><label for="need">Looking for a capability? Search the board for its name.</label></p>
      <p><input class="field" id="need" name="need" placeholder="Read UK council planning PDFs as structured data" style="font-size:17px"></p>
      <p><button class="btn" type="submit">Search the board</button></p>
    </form>
  </div>
</div></section>`
    ),
    404
  );
}

/**
 * Cache GET pages at the edge for a short while to keep D1 reads down.
 *
 * The key carries the deploy version, so a deploy serves the new version
 * immediately rather than the old one for the length of the TTL.
 */
async function cached(
  request: Request,
  _ttlSeconds: number,
  produce: () => Promise<Response>,
  version?: string,
  local = false
): Promise<Response> {
  if (request.method !== "GET") return produce();

  // A local request is never served from a cache, and never stored in one.
  //
  // `wrangler dev --remote` runs on Cloudflare's network, so a local
  // request can be answered from the edge cache, and a plain `curl` to the
  // dev server returns the DEPLOYED page rather than the code being
  // edited. The page looks unchanged, the change looks like it did not
  // apply, and restarting the server does not help because the edge is
  // answering.
  if (local || isLocalRequest(request)) {
    const res = await produce();
    const headers = new Headers(res.headers);
    headers.set("cache-control", "no-store");
    headers.set("x-cache", "BYPASS");
    return new Response(res.body, { status: res.status, headers });
  }

  const cache = caches.default;
  const url = new URL(request.url);
  if (version) url.searchParams.set("__v", version);
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) {
    const res = new Response(hit.body, hit);
    res.headers.set("x-cache", "HIT");
    return res;
  }
  const res = await produce();
  if (res.status === 200 && res.headers.get("cache-control")?.includes("public")) {
    const copy = res.clone();
    // TTL comes from the response's own cache-control header.
    await cache.put(cacheKey, copy);
  }
  return res;
}

/**
 * Is this a local development request?
 *
 * `wrangler dev --remote` runs the Worker on Cloudflare's network, behind
 * the same edge as the deployed site. So a local request can be answered
 * from the edge cache, and a plain `curl` to the dev server returns the
 * DEPLOYED page rather than the code you are editing.
 *
 * That is a trap: the page looks unchanged, the change looks like it did
 * not apply, and the obvious next step is to restart the server, which
 * does not help because the edge is answering.
 *
 * So a local request is never served from a cache. The response is marked
 * no-store so nothing else holds it either.
 */
function isLocalRequest(request: Request): boolean {
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // The deployed Worker always has VERSION_METADATA. `wrangler dev` does
    // not, and that is how a local run knows it is local: it must never
    // serve a cached page, because the cache it would read is the
    // production one and the page it would return is the deployed page
    // rather than the code being edited.
    const local = !env.VERSION_METADATA?.id;
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    // One canonical host. Pages on www redirect to the apex so links, caches
    // and search engines only ever see one version of the board. The API and
    // the MCP endpoint answer on both hosts, because a client that does not
    // follow redirects should still work.
    const canonical = new URL(env.SITE_URL);
    const isApi =
      path === "/mcp" || path.startsWith("/api/") || path.startsWith("/admin") || path.startsWith("/auth");
    if (!isApi && url.hostname === `www.${canonical.hostname}`) {
      const target = new URL(url.pathname + url.search, canonical.origin);
      return new Response(null, { status: 308, headers: { location: target.toString() } });
    }

    // CORS for the public API and the MCP endpoint.
    if (path.startsWith("/api/") || path === "/mcp") {
      const cors = {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "content-type, authorization, mcp-protocol-version",
        "access-control-max-age": "86400",
      };
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
      let response: Response;
      try {
        response = await route(request, env, ctx, url, path, local);
      } catch (err) {
        response = writeLimitResponse(err, request, env);
      }
      const headers = new Headers(response.headers);
      for (const [k, v] of Object.entries(cors)) headers.set(k, v);
      return new Response(response.body, { status: response.status, headers });
    }

    try {
      return await route(request, env, ctx, url, path, local);
    } catch (err) {
      return writeLimitResponse(err, request, env);
    }
  },

  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const cron = event.cron;

    // Background: keep the mirror of the official MCP registry fresh.
    if (cron === env.REGISTRY_CRON) {
      ctx.waitUntil(
        crawlRegistry(env, 25).catch((err) => {
          console.error("registry crawl failed", err);
        })
      );
      return;
    }

    // Weekly snapshot, every Monday.
    if (cron === "0 8 * * 1") {
      const weekId = isoWeekId();
      const clusters = await db.listClusters(env.DB, { status: "published", limit: 20, sort: "agents" });
      const stats = await db.getStats(env.DB);
      const breakdown = await db.getClientBreakdown(
        env.DB,
        clusters.map((c) => c.id)
      );
      await db.putSnapshot(env.DB, weekId, weekStart().toISOString(), {
        week: weekId,
        generated_at: new Date().toISOString(),
        stats,
        wishes: clusters.map((c) => ({
          rank: 0,
          title: c.title,
          slug: c.slug,
          agents: c.unique_agents,
          wishes: c.count,
          this_week: c.week_count,
          first_seen: c.first_seen,
          last_seen: c.last_seen,
          shipped: c.shipped === 1,
          builder: c.claim_login,
          repo: c.claim_repo,
          clients: breakdown.get(c.id) ?? [],
        })),
      });
    }
  },
};

async function route(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  path: string,
  local = false
): Promise<Response> {
  const method = request.method;

  /* ---------------- MCP ---------------- */
  if (path === "/mcp") {
    if (method !== "POST") {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32601, message: "Use POST for MCP requests." },
          id: null,
        }),
        { status: 405, headers: { "content-type": "application/json" } }
      );
    }
    const identity = await identify(env, request);
    try {
      return await handleMcpRequest(env, request, identity, ctx);
    } catch (err) {
      console.error("mcp error", err);
      if (isWriteLimitError(err)) return writeLimitResponse(err, request, env);
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }
  }

  /* ---------------- REST ---------------- */
  if (path.startsWith("/api/")) {
    return handleApi(env, request, url, ctx);
  }

  /* ---------------- static bits ---------------- */
  if (path === "/style.css") {
    // The URL carries the deploy's version, so a deploy changes it and
    // the browser asks for the new stylesheet. That is why the max-age
    // can be a year: the URL is new, so a cached copy of the old one is
    // never wanted again.
    //
    // It was max-age=86400 with a URL that never changed, so a change
    // to the CSS was invisible to a returning visitor for a day. A
    // page whose script and stylesheet disagree behaves as though the
    // fix did not land.
    return new Response(CSS, {
      headers: {
        "content-type": "text/css; charset=utf-8",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }
  if (path === "/font.css") {
    return fontResponse();
  }
  if (path === "/favicon.svg") {
    return new Response(FAVICON, {
      headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=604800" },
    });
  }
  if (path === "/robots.txt") {
    return new Response(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /auth\n\nSitemap: ${env.SITE_URL}/sitemap.xml\n`,
      { headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }
  if (path === "/sitemap.xml") {
    return renderSitemap(env);
  }
  if (path === "/llms.txt") {
    return new Response(await renderLlmsTxt(env), {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
    });
  }
  if (path === "/llms-full.txt") {
    return new Response(renderLlmsFull(env), {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
    });
  }
  if (path === "/feed.xml") {
    return new Response(await renderFeed(env), {
      headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=1800" },
    });
  }
  if (path === "/wishes.xml") {
    return new Response(await renderWishFeed(env), {
      headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=300" },
    });
  }
  if (path.startsWith("/badge/") && path.endsWith(".svg")) {
    const slug = path.slice("/badge/".length, -4);
    // The weekly badge is a different animal: it points at the list, not
    // at a single wish, so it carries the count of the whole board.
    if (slug === "weekly") return renderWeeklyBadge(env);
    return renderBadge(env, slug);
  }
  if (path.startsWith("/og/")) {
    return renderOg(env, path.slice("/og/".length));
  }

  /* ---------------- auth + claims ---------------- */
  if (path === "/auth/github") {
    return startGitHub(env, url);
  }
  if (path === "/auth/github/callback") {
    return finishGitHub(env, request, url);
  }
  if (path === "/claim" && method === "POST") {
    return handleClaim(env, request);
  }
  if (path === "/ship" && method === "POST") {
    return handleShip(env, request);
  }

  /* ---------------- admin ---------------- */
  if (path === "/admin" || path.startsWith("/admin/")) {
    return handleAdmin(env, request, url, ctx);
  }

  /* ---------------- the GET endpoint and the human form ---------------- */
  if (path === "/wish") {
    if (request.method === "POST") return postWishForm(env, request);
    if (request.method === "GET") return getWishForm(env, request, url);
    return new Response("This endpoint takes GET or POST. File a wish with GET /wish?need=your+capability, or POST a JSON body with a \"need\" field to /api/wish.", {
      status: 405,
      headers: { "content-type": "text/plain; charset=utf-8", allow: "GET, POST" },
    });
  }

  /* ---------------- pages ---------------- */
  if (path === "/") {
    const filter = url.searchParams.get("filter") ?? "all";
    const client = url.searchParams.get("client") ?? "all";
    return cached(
      request,
      60,
      async () => {
        const body = await renderBoard(env, { filter, client });
        return html(body, 200, { "cache-control": "public, max-age=30, s-maxage=60" });
      },
      env.VERSION_METADATA?.id,
      local
    );
  }

  if (path.startsWith("/w/")) {
    const slug = decodeURIComponent(path.slice(3));
    // GitHub sign in is a deployment setting. When it is not configured the
    // page must not promise a claim path that dead-ends at a 503.
    const claimingEnabled = Boolean(env.GITHUB_CLIENT_ID);
    return cached(
      request,
      300,
      async () => {
        const session = await readSession(env, request);
        const body = await renderCluster(env, slug, {
          signedInAs: session?.login ?? null,
          claimingEnabled,
        });
        if (!body) return notFound(env);
        return html(body, 200, { "cache-control": "public, max-age=120, s-maxage=300" });
      },
      env.VERSION_METADATA?.id,
      local
    );
  }

  if (path === "/weekly") {
    const claimingEnabled = Boolean(env.GITHUB_CLIENT_ID);
    return cached(
      request,
      600,
      async () =>
        html(await renderWeekly(env, undefined, claimingEnabled), 200, { "cache-control": "public, max-age=300, s-maxage=600" }),
      env.VERSION_METADATA?.id,
      local
    );
  }
  if (path.startsWith("/weekly/")) {
    const id = path.slice("/weekly/".length);
    const claimingEnabled = Boolean(env.GITHUB_CLIENT_ID);
    return cached(request, 3600, async () =>
      html((await renderWeekly(env, id, claimingEnabled)) ?? "", 200, { "cache-control": "public, max-age=3600" })
    );
  }
  if (path === "/agents") {
    return cached(
      request,
      3600,
      async () => html(renderAgents(env), 200, { "cache-control": "public, max-age=3600" }),
      env.VERSION_METADATA?.id,
      local
    );
  }
  if (path === "/build") {
    // The claim form is prefilled from `?wish=`, so a builder who clicks
    // "I want to build one" on a cluster does not have to go and find
    // the slug. The page told them which wish; the form now carries it.
    const slug = url.searchParams.get("wish") ?? "";
    // GitHub sign in is a deployment setting. When it is not configured the
    // page says so before the reader fills the form in, rather than
    // collecting a repository URL and then dead-ending at a 503.
    const claimingEnabled = Boolean(env.GITHUB_CLIENT_ID);
    return cached(
      request,
      600,
      async () => html(renderBuild(env, slug, claimingEnabled), 200, { "cache-control": "public, max-age=600" }),
      env.VERSION_METADATA?.id,
      local
    );
  }
  if (path === "/about") {
    return cached(
      request,
      3600,
      async () => html(renderAbout(env), 200, { "cache-control": "public, max-age=3600" }),
      env.VERSION_METADATA?.id,
      local
    );
  }
  if (path === "/privacy") {
    return cached(
      request,
      3600,
      async () => html(renderPrivacy(env), 200, { "cache-control": "public, max-age=3600" }),
      env.VERSION_METADATA?.id,
      local
    );
  }

  return notFound(env);
}

/* ------------------------------------------------------------------ *
 * Filing a wish over plain HTTP
 * ------------------------------------------------------------------ */

/**
 * GET /wish?need=...
 *
 * For agents that can only fetch a URL, and for humans with a form. It is
 * hard rate limited and link preview bots are ignored, because a GET with a
 * side effect is exactly the shape that turns into spam.
 */
async function getWishForm(env: Env, request: Request, url: URL): Promise<Response> {
  const need = url.searchParams.get("need")?.trim() ?? "";
  if (!need) {
    return html(renderWishForm(env), 200, { "cache-control": "public, max-age=600" });
  }

  const userAgent = request.headers.get("user-agent") ?? "";
  if (isPreviewBot(userAgent) || isCrawler(userAgent)) {
    // A link un-furler is following a link, not asking for a tool. A crawler
    // is indexing, not asking for a tool. Neither should file a wish.
    return html(
      layout(
        {
          title: "Tools Wanted",
          description: "A public board of the capabilities AI agents have got stuck on.",
          canonical: `${env.SITE_URL}/`,
          noindex: true,
        },
        `<section class="page"><div class="wrap"><h1>Tools Wanted</h1><p>A public board of the capabilities AI agents have got stuck on. <a class="under" href="/">See the board</a>.</p></div></section>`
      ),
      200,
      { "cache-control": "public, max-age=3600" }
    );
  }

  const identity = await identify(env, request);
  const limit = await rateLimit(env.DB, `wish:get:${identity.ipKey}`, 10, 3600);
  if (!limit.allowed) {
    return html(
      renderWishResult(env, {
        ok: false,
        error: "Too many wishes from this address. The board takes ten an hour so the counts mean something. Wait, then file one wish for the capability you need.",
      }),
      429,
      { "cache-control": "no-store" }
    );
  }

  let outcome;
  try {
    outcome = await fileWish(
      env,
      identity,
      {
        need,
        context: url.searchParams.get("context") ?? null,
        client: url.searchParams.get("client") ?? "agent",
        model: url.searchParams.get("model") ?? null,
      },
      { skipRateLimit: true }
    );
  } catch (err) {
    if (err instanceof WishError) {
      const status = err.status === 429 ? 429 : 400;
      const body = renderWishResult(env, { ok: false, error: err.message });
      if (acceptsJson(request)) {
        return new Response(JSON.stringify({ error: err.code, message: err.message }), {
          status,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      return html(body, status, { "cache-control": "no-store" });
    }
    throw err;
  }

  const accept = request.headers.get("accept") ?? "";
  const result: WishFormResult = {
    ok: true,
    title: outcome.title,
    slug: outcome.slug,
    url: outcome.url,
    agents: outcome.uniqueAgents,
    wishes: outcome.count,
    matched: outcome.matched,
    alreadyWished: outcome.alreadyWished,
    published: outcome.published,
    building: outcome.building,
    shipped: outcome.shipped,
    servers: outcome.servers,
  };

  if (accept.includes("application/json") || url.searchParams.get("format") === "json") {
    return new Response(JSON.stringify({ ...result }, null, 2), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  if (accept.includes("text/plain") || url.searchParams.get("format") === "text") {
    const lines = [
      result.alreadyWished
        ? "You have wished for this one before."
        : result.matched
          ? `+1 to an existing wish (${countWithVerb(result.agents ?? 0, "agent", "agents", "wants", "want")} this).`
          : "New wish filed.",
      result.title ?? "",
      result.url ?? "",
    ];
    return new Response(lines.join("\n"), {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
  return html(renderWishResult(env, result), 200, { "cache-control": "no-store" });
}

/** POST /wish, from the HTML form. */
async function postWishForm(env: Env, request: Request): Promise<Response> {
  const form = await readForm(request);
  const need = String(form?.get("need") ?? "").trim();
  const context = String(form?.get("context") ?? "").trim() || null;

  if (!need) {
    return html(
      renderWishForm(env, "Say what you need in one line, for example \"Read UK council planning PDFs as structured data\"."),
      400
    );
  }

  const identity = await identify(env, request);
  try {
    const outcome = await fileWish(
      env,
      identity,
      { need, context, client: "human", model: null },
      { skipRateLimit: true }
    );
    return new Response(null, {
      status: 303,
      headers: { location: `/w/${outcome.slug}` },
    });
  } catch (err) {
    if (err instanceof WishError) {
      return html(renderWishForm(env, err.message), 400, { "cache-control": "no-store" });
    }
    throw err;
  }
}

/* ------------------------------------------------------------------ *
 * OG images and badges
 * ------------------------------------------------------------------ */

async function renderOg(env: Env, name: string): Promise<Response> {
  const slug = name.endsWith(".png") ? name.slice(0, -4) : name;
  let object = await db.getOgImage(env.DB, slug);
  let isDefault = false;
  if (!object) {
    object = await db.getOgImage(env.DB, "default");
    isDefault = true;
  }

  if (!object) {
    return new Response("OG image not rendered yet. Run: npm run og:sync", {
      status: 404,
      headers: { "content-type": "text/plain" },
    });
  }

  // A poster carries a number, and the number moves. When the poster is
  // older than the cluster it draws, it is showing a count that has
  // changed, and it is the first thing a reader sees.
  //
  // The header says so, for a machine. A reader is not looking at
  // headers, they are looking at the picture on a link preview, so the
  // picture itself has to stop carrying the wrong number. When the poster
  // is behind, the default card is served instead: it has no count on it,
  // so it cannot be wrong, and it keeps the title of nothing rather than
  // the title of an entry with a number that has moved.
  //
  // The fix is `npm run og:sync` against the deployed board. Until that
  // runs, a stale poster is not served, so the contradiction between the
  // card and the board cannot be shown to a reader.
  const cluster = await db.getClusterBySlug(env.DB, slug);
  const stale = !isDefault && cluster ? object.updatedAt < cluster.updated_at : false;

  if (stale) {
    const fallback = await db.getOgImage(env.DB, "default");
    if (fallback) {
      return new Response(fallback.bytes, {
        headers: {
          "content-type": "image/png",
          "cache-control": "public, max-age=60",
          "x-og-default": "1",
          "x-og-stale": "1",
          "x-og-updated-at": fallback.updatedAt,
          "x-og-stale-for": slug,
        },
      });
    }
  }

  return new Response(object.bytes, {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400",
      "x-og-default": isDefault ? "1" : "0",
      "x-og-updated-at": object.updatedAt,
      ...(stale ? { "x-og-stale": "1" } : {}),
    },
  });
}

/**
 * The badge for the weekly list.
 *
 * It points at the list rather than at a single wish, so it carries the
 * number of capabilities on the board rather than the number of agents on
 * one of them. A builder puts this in their README to say "here is what
 * agents are missing", which is a different claim from "here is how many
 * people want this one thing".
 */
async function renderWeeklyBadge(env: Env): Promise<Response> {
  const clusters = await db.listClusters(env.DB, { status: "published", limit: 50, sort: "agents" });
  const count = clusters.length;
  const label = `${num(count)} most wanted`;
  const width = 60 + label.length * 7;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${escAttr(`${label} on Tools Wanted`)}">
<rect width="${width}" height="20" fill="#151210"/>
<rect x="0" y="0" width="18" height="20" fill="#d32a1c"/>
<text x="9" y="14" font-family="Helvetica,Arial,sans-serif" font-size="11" font-weight="bold" fill="#fff" text-anchor="middle">W</text>
<text x="24" y="14" font-family="Helvetica,Arial,sans-serif" font-size="11" fill="#f3eee1">${esc(label)}</text>
</svg>`;
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=600",
    },
  });
}

async function renderBadge(env: Env, slug: string): Promise<Response> {
  const cluster = await db.getClusterBySlug(env.DB, slug);
  // A badge for a wish that does not exist is a broken image and a broken
  // link in somebody's README. It used to render "Wanted by 0 agents"
  // with a 200, which is a lie rather than a 404.
  if (!cluster) {
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const count = cluster.unique_agents;
  const label = `Wanted by ${num(count)} agent${count === 1 ? "" : "s"}`;
  const width = 60 + label.length * 7;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${escAttr(label)}">
<rect width="${width}" height="20" fill="#151210"/>
<rect x="0" y="0" width="18" height="20" fill="#d32a1c"/>
<text x="9" y="14" font-family="Helvetica,Arial,sans-serif" font-size="11" font-weight="bold" fill="#fff" text-anchor="middle">W</text>
<text x="24" y="14" font-family="Helvetica,Arial,sans-serif" font-size="11" fill="#f3eee1">${esc(label)}</text>
</svg>`;
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=600",
    },
  });
}

async function renderSitemap(env: Env): Promise<Response> {
  const clusters = await db.listClusters(env.DB, { status: "published", limit: 500, sort: "agents" });
  const urls = [
    { loc: `${env.SITE_URL}/`, priority: "1.0", lastmod: undefined as string | undefined },
    { loc: `${env.SITE_URL}/weekly`, priority: "0.7" },
    { loc: `${env.SITE_URL}/agents`, priority: "0.6" },
    { loc: `${env.SITE_URL}/build`, priority: "0.6" },
    { loc: `${env.SITE_URL}/wish`, priority: "0.6" },
    { loc: `${env.SITE_URL}/about`, priority: "0.4" },
    ...clusters.map((c) => ({
      loc: `${env.SITE_URL}/w/${c.slug}`,
      priority: "0.8",
      lastmod: c.last_seen,
    })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<priority>${u.priority}</priority></url>`
  )
  .join("\n")}
</urlset>`;
  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}

/* ------------------------------------------------------------------ *
 * GitHub OAuth + claiming
 * ------------------------------------------------------------------ */

async function startGitHub(env: Env, url: URL): Promise<Response> {
  if (!env.GITHUB_CLIENT_ID) {
    return html(
      layout(
        { title: "Sign in", description: "GitHub sign in", canonical: `${env.SITE_URL}/build`, noindex: true },
        `<section class="page"><div class="wrap"><h1>Not configured</h1><p>GitHub sign in is not set up on this deployment, so a wish cannot be claimed here. The board and the MCP endpoint still work.</p><p><a class="under" href="/">Back to the board</a></p></div></section>`
      ),
      503
    );
  }
  const next = url.searchParams.get("next") ?? "/build";
  const redirectUri = `${env.SITE_URL}/auth/github/callback`;
  const state = await makeState(next, sessionSecret(env));
  return new Response(null, {
    status: 302,
    headers: { location: githubAuthorizeUrl(env, state, redirectUri) },
  });
}

async function finishGitHub(env: Env, request: Request, url: URL): Promise<Response> {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const next = (await readState(state, sessionSecret(env))) ?? "/build";
  if (!code) return new Response("No code", { status: 400 });

  const redirectUri = `${env.SITE_URL}/auth/github/callback`;
  const user = await completeGitHubLogin(env, code, redirectUri);
  if (!user) {
    return new Response("GitHub sign in failed. The code from GitHub was not accepted. Start the sign in again from the build page.", {
      status: 400,
    });
  }

  const session = await signSession(
    { login: user.login, id: user.id, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 },
    sessionSecret(env)
  );

  // If a claim was in flight, finish it now.
  const pending = await readPendingClaim(env, request);
  if (pending) {
    const cluster = await db.getClusterBySlug(env.DB, pending.slug);
    if (cluster) {
      await db.setClaim(env.DB, {
        clusterId: cluster.id,
        login: user.login,
        repo: pending.repo,
        note: pending.note,
        shipped: false,
      });
      return new Response(null, {
        status: 302,
        headers: {
          location: `/w/${cluster.slug}`,
          "set-cookie": `${sessionCookie(session)}; ${clearPendingClaim()}`,
        },
      });
    }
  }

  return new Response(null, {
    status: 302,
    headers: { location: next.startsWith("/") ? next : "/build", "set-cookie": sessionCookie(session) },
  });
}

async function handleClaim(env: Env, request: Request): Promise<Response> {
  const form = await readForm(request);
  const slug = String(form?.get("slug") ?? "").trim();
  const repo = String(form?.get("repo") ?? "").trim();
  const note = String(form?.get("note") ?? "").trim().slice(0, 200);

  if (!slug || !repo) {
    return new Response("Send both a wish slug and a repository URL. The slug is the last part of the wish's address on toolswanted.dev/w/, for example read-uk-council-planning-pdfs-as-structured-data.", {
      status: 400,
    });
  }
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/.test(repo)) {
    return new Response("The repository URL has to be a github.com URL, for example https://github.com/you/your-mcp-server.", {
      status: 400,
    });
  }

  const session = await readSession(env, request);
  if (!session) {
    // Remember the intent and send them to GitHub.
    const intent = await signSession(
      { login: "", id: 0, exp: Date.now() + 10 * 60 * 1000, next: JSON.stringify({ slug, repo, note }) },
      sessionSecret(env)
    );
    return new Response(null, {
      status: 302,
      headers: {
        location: `/auth/github?next=${encodeURIComponent("/claim")}`,
        "set-cookie": `tw_claim=${intent}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      },
    });
  }

  const cluster = await db.getClusterBySlug(env.DB, slug);
  if (!cluster) {
    return new Response(`No wish called "${slug}" is on the board. Find it on https://toolswanted.dev and copy the slug from its address.`, {
      status: 404,
    });
  }
  await db.setClaim(env.DB, {
    clusterId: cluster.id,
    login: session.login,
    repo,
    note: note || null,
    shipped: false,
  });
  await purgeClusterCache(env, cluster.id, new URL(request.url).origin);
  return new Response(null, { status: 302, headers: { location: `/w/${cluster.slug}` } });
}

interface PendingClaim {
  slug: string;
  repo: string;
  note: string;
}

/**
 * Mark a claimed wish as shipped.
 *
 * The build page told a builder "when you ship, mark it shipped", and
 * there was no control anywhere a builder could reach. The only way to
 * set the shipped flag was the admin panel, so the step the product
 * described was a step only the operator could take.
 *
 * The builder has to be the one who claimed it. That is checked against
 * the GitHub login on the session, so a builder can ship their own wish
 * and nobody else's.
 */
async function handleShip(env: Env, request: Request): Promise<Response> {
  const form = await readForm(request);
  const slug = String(form?.get("slug") ?? "").trim();
  if (!slug) {
    return new Response("Send the slug of the wish you shipped. It is the last part of the wish's address on toolswanted.dev/w/.", {
      status: 400,
    });
  }

  const session = await readSession(env, request);
  if (!session) {
    return new Response("Sign in with GitHub first, then mark the wish shipped from the same page you claimed it on.", {
      status: 401,
    });
  }

  const cluster = await db.getClusterBySlug(env.DB, slug);
  if (!cluster) {
    return new Response(`No wish called "${slug}" is on the board. Find it on https://toolswanted.dev and copy the slug from its address.`, {
      status: 404,
    });
  }
  // A claim has to exist before it can be shipped. A cluster with no
  // claim has no `claim_login`, so the ownership check below would fail
  // anyway, but checking the claim first says what is actually wrong,
  // and it stops the route writing a claim row with an empty repo.
  if (!cluster.claim_login || !cluster.claim_repo) {
    return new Response("Nobody has claimed this wish yet. Claim it first, then mark it shipped.", {
      status: 409,
    });
  }
  if (cluster.claim_login !== session.login) {
    return new Response("Only the builder who claimed this can mark it shipped. Sign in with the GitHub account that made the claim.", {
      status: 403,
    });
  }

  await db.setClaim(env.DB, {
    clusterId: cluster.id,
    login: cluster.claim_login,
    repo: cluster.claim_repo,
    note: cluster.claim_note ?? null,
    shipped: true,
  });
  await purgeClusterCache(env, cluster.id, new URL(request.url).origin);
  return new Response(null, { status: 302, headers: { location: `/w/${cluster.slug}` } });
}

/** Read a claim that was started before the GitHub sign in. */
async function readPendingClaim(env: Env, request: Request): Promise<PendingClaim | null> {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie.match(/(?:^|;\s*)tw_claim=([^;]+)/)?.[1];
  if (!token) return null;
  const session = await verifySession(token, sessionSecret(env));
  if (!session?.next) return null;
  try {
    const parsed = JSON.parse(session.next) as PendingClaim;
    if (parsed.slug && parsed.repo) return parsed;
  } catch {
    /* not a claim */
  }
  return null;
}

function clearPendingClaim(): string {
  return "tw_claim=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

export { fileWish };
