/**
 * Tools Wanted — one Worker, one routing table.
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
import { handleApi } from "./api";
import { handleMcpRequest } from "./mcp";
import { identify } from "./identity";
import { handleAdmin, purgeClusterCache, readForm } from "./admin";
import { crawlRegistry } from "./registry";
import { fileWish } from "./wish";
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
} from "./board";
import { renderFeed, renderWishFeed } from "./rss";
import { isoWeekId, num, weekStart, type Env } from "./types";

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#151210"/><text x="32" y="44" font-family="Helvetica,Arial,sans-serif" font-weight="900" font-size="38" fill="#d32a1c" text-anchor="middle">W</text></svg>`;

function html(body: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...headers },
  });
}

function notFound(env: Env): Response {
  return html(
    layout(
      {
        title: "Not found",
        description: "That page does not exist.",
        canonical: `${env.SITE_URL}/404`,
        noindex: true,
      },
      `<section class="page"><div class="wrap"><h1>404</h1><p>Nothing here. <a class="under" href="/">Back to the board</a>.</p></div></section>`
    ),
    404
  );
}

/** Cache GET pages at the edge for a short while to keep D1 reads down. */
async function cached(request: Request, _ttlSeconds: number, produce: () => Promise<Response>): Promise<Response> {
  if (request.method !== "GET") return produce();
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });
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

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
      const response = await route(request, env, ctx, url, path);
      const headers = new Headers(response.headers);
      for (const [k, v] of Object.entries(cors)) headers.set(k, v);
      return new Response(response.body, { status: response.status, headers });
    }

    return route(request, env, ctx, url, path);
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
      const clusters = await db.listClusters(env.DB, { status: "published", limit: 20, sort: "count" });
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
  path: string
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
    return new Response(CSS, {
      headers: {
        "content-type": "text/css; charset=utf-8",
        "cache-control": "public, max-age=86400",
      },
    });
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
    return renderBadge(env, path.slice("/badge/".length, -4));
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

  /* ---------------- admin ---------------- */
  if (path === "/admin" || path.startsWith("/admin/")) {
    return handleAdmin(env, request, url, ctx);
  }

  /* ---------------- pages ---------------- */
  if (path === "/") {
    const filter = url.searchParams.get("filter") ?? "all";
    const client = url.searchParams.get("client") ?? "all";
    return cached(request, 60, async () => {
      const body = await renderBoard(env, { filter, client });
      return html(body, 200, { "cache-control": "public, max-age=30, s-maxage=60" });
    });
  }

  if (path.startsWith("/w/")) {
    const slug = decodeURIComponent(path.slice(3));
    return cached(request, 300, async () => {
      const body = await renderCluster(env, slug);
      if (!body) return notFound(env);
      return html(body, 200, { "cache-control": "public, max-age=120, s-maxage=300" });
    });
  }

  if (path === "/weekly") {
    return cached(request, 600, async () =>
      html(await renderWeekly(env), 200, { "cache-control": "public, max-age=300, s-maxage=600" })
    );
  }
  if (path.startsWith("/weekly/")) {
    const id = path.slice("/weekly/".length);
    return cached(request, 3600, async () =>
      html((await renderWeekly(env, id)) ?? "", 200, { "cache-control": "public, max-age=3600" })
    );
  }
  if (path === "/agents") {
    return cached(request, 3600, async () =>
      html(renderAgents(env), 200, { "cache-control": "public, max-age=3600" })
    );
  }
  if (path === "/build") {
    return cached(request, 600, async () =>
      html(renderBuild(env), 200, { "cache-control": "public, max-age=600" })
    );
  }
  if (path === "/about") {
    return cached(request, 3600, async () =>
      html(renderAbout(env), 200, { "cache-control": "public, max-age=3600" })
    );
  }
  if (path === "/privacy") {
    return cached(request, 3600, async () =>
      html(renderPrivacy(env), 200, { "cache-control": "public, max-age=3600" })
    );
  }

  return notFound(env);
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
  return new Response(object, {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400",
      "x-og-default": isDefault ? "1" : "0",
    },
  });
}

async function renderBadge(env: Env, slug: string): Promise<Response> {
  const cluster = await db.getClusterBySlug(env.DB, slug);
  const count = cluster?.unique_agents ?? 0;
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
  const clusters = await db.listClusters(env.DB, { status: "published", limit: 500, sort: "count" });
  const urls = [
    { loc: `${env.SITE_URL}/`, priority: "1.0", lastmod: undefined as string | undefined },
    { loc: `${env.SITE_URL}/weekly`, priority: "0.7" },
    { loc: `${env.SITE_URL}/agents`, priority: "0.6" },
    { loc: `${env.SITE_URL}/build`, priority: "0.6" },
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
        `<section class="page"><div class="wrap"><h1>Not configured</h1><p>GitHub sign in is not set up on this deployment yet.</p></div></section>`
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
  if (!user) return new Response("GitHub sign in failed", { status: 400 });

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

  if (!slug || !repo) return new Response("slug and repo are required", { status: 400 });
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/.test(repo)) {
    return new Response("repo must be a github.com URL", { status: 400 });
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
  if (!cluster) return new Response("No such wish", { status: 404 });
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
