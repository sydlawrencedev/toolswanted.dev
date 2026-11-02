/**
 * The admin panel: approve, merge, rename, ship. One passphrase, no accounts.
 */

import { esc, escAttr, layout } from "./html";
import {
  getClaim,
  listFlaggedWishes,
  listPendingClusters,
  mergeClusters,
  renameCluster,
  setClaim,
  setClusterStatus,
  getStats,
} from "./db";
import { num, relativeTime, shortDate, type Env } from "./types";
import { readSession, sessionSecret, signSession, sessionCookie, clearCookie } from "./auth";

async function isAdmin(env: Env, request: Request): Promise<boolean> {
  const session = await readSession(env, request);
  if (session?.admin) return true;
  // A plain GitHub login is not enough; admin requires the passphrase.
  const token = request.headers.get("x-admin-token") ?? "";
  return !!env.ADMIN_TOKEN && token === env.ADMIN_TOKEN;
}

export async function handleAdmin(
  env: Env,
  request: Request,
  url: URL,
  ctx?: ExecutionContext
): Promise<Response> {
  const path = url.pathname;

  if (path === "/admin/login" && request.method === "POST") {
    const form = await request.formData();
    const token = String(form.get("token") ?? "");
    if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
      return new Response("No.", { status: 401 });
    }
    const signed = await signSession(
      { login: "admin", id: 0, exp: Date.now() + 12 * 60 * 60 * 1000, admin: true },
      sessionSecret(env)
    );
    return new Response(null, {
      status: 302,
      headers: { location: "/admin", "set-cookie": sessionCookie(signed, 12 * 60 * 60) },
    });
  }

  if (path === "/admin/logout") {
    return new Response(null, { status: 302, headers: { location: "/", "set-cookie": clearCookie() } });
  }

  if (!(await isAdmin(env, request))) {
    const body = `<section class="page"><div class="wrap">
  <h1>Admin</h1>
  <form method="post" action="/admin/login">
    <p><label for="token">Passphrase</label><br>
    <input id="token" name="token" type="password" required style="width:100%;max-width:340px;padding:10px;font-size:16px;background:var(--paper-2);color:var(--ink);border:2px solid var(--line);border-radius:2px"></p>
    <p><button class="btn" type="submit">In</button></p>
  </form>
</div></section>`;
    return new Response(
      layout(
        {
          title: "Admin",
          description: "Moderation",
          canonical: `${env.SITE_URL}/admin`,
          noindex: true,
        },
        body
      ),
      { status: 401, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  if (path.startsWith("/admin/cluster/") && request.method === "POST") {
    return handleClusterAction(env, request, path);
  }

  // Bulk operations, all admin only.
  if (path === "/admin/og" && request.method === "POST") {
    return handleOgUpload(env, request);
  }
  if (path === "/admin/seed" && request.method === "POST") {
    return handleSeed(env, request, ctx);
  }
  if (path === "/admin/crawl" && request.method === "POST") {
    return handleCrawl(env, request);
  }
  if (path === "/admin/embed" && request.method === "POST") {
    return handleEmbed(env, request);
  }
  if (path === "/admin/reset-wishes" && request.method === "POST") {
    return handleReset(env, request);
  }
  if (path === "/admin/vector-debug" && request.method === "POST") {
    return handleVectorDebug(env, request);
  }
  if (path === "/admin/weekly-snapshot" && request.method === "POST") {
    return handleWeeklySnapshot(env);
  }

  // Dashboard.
  const [pending, flagged, stats] = await Promise.all([
    listPendingClusters(env.DB, 50),
    listFlaggedWishes(env.DB, 25),
    getStats(env.DB),
  ]);

  const pendingRows = await Promise.all(
    pending.map(async (c) => {
      const claim = await getClaim(env.DB, c.id);
      return `<tr>
  <td><a class="under" href="/w/${escAttr(c.slug)}">${esc(c.title)}</a><br><span class="mono" style="color:var(--ink-soft)">${esc(c.slug)}</span></td>
  <td class="mono">${num(c.count)}</td>
  <td class="mono">${esc(shortDate(c.first_seen))}</td>
  <td>${claim ? `@${esc(claim.github_login)}` : ""}</td>
  <td>
    <form method="post" action="/admin/cluster/${escAttr(c.id)}/publish" style="display:inline"><button class="btn sm" type="submit">Publish</button></form>
    <form method="post" action="/admin/cluster/${escAttr(c.id)}/reject" style="display:inline"><button class="btn sm ghost" type="submit">Reject</button></form>
    <form method="post" action="/admin/cluster/${escAttr(c.id)}/rename" style="display:inline">
      <input name="title" placeholder="New title" style="width:160px;padding:5px;font-size:13px;background:var(--paper-2);color:var(--ink);border:2px solid var(--line);border-radius:2px">
      <button class="btn sm" type="submit">Rename</button>
    </form>
  </td>
</tr>`;
    })
  );

  const flaggedRows = flagged
    .map(
      (w) => `<tr>
  <td>${esc(w.need)}</td>
  <td class="mono">${esc(w.flag_reason ?? "?")}</td>
  <td class="mono">${esc(w.client ?? "?")}</td>
  <td class="mono">${esc(shortDate(w.created_at))}</td>
</tr>`
    )
    .join("");

  const body = `<section class="page"><div class="wrap">
  <h1>Admin</h1>
  <p>${num(stats.clusters)} published · ${num(stats.pending)} in review · ${num(stats.wishes)} wishes · ${num(stats.agents)} agents · ${num(stats.shipped)} shipped</p>

  <h2>Review queue</h2>
  <p>New clusters stay hidden until enough independent agents want them, or you publish them.</p>
  <div class="card">
    <table>
      <thead><tr><th>Cluster</th><th>Wishes</th><th>First seen</th><th>Builder</th><th>Actions</th></tr></thead>
      <tbody>${pendingRows.join("") || `<tr><td colspan="5">Nothing waiting.</td></tr>`}</tbody>
    </table>
  </div>

  <h2>Flagged wishes</h2>
  <p>Text that looked like an attempt to give the board instructions. These are counted but not published automatically.</p>
  <div class="card">
    <table>
      <thead><tr><th>Wish</th><th>Reason</th><th>Client</th><th>When</th></tr></thead>
      <tbody>${flaggedRows || `<tr><td colspan="4">Nothing flagged.</td></tr>`}</tbody>
    </table>
  </div>

  <p><a class="under" href="/admin/logout">Log out</a></p>
</div></section>`;

  return new Response(
    layout(
      { title: "Admin", description: "Moderation", canonical: `${env.SITE_URL}/admin`, noindex: true },
      body
    ),
    { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );
}

/**
 * Read a submitted form, whatever the content type says. A claim that
 * silently does nothing because of a missing header is worse than an error.
 */
export async function readForm(
  request: Request
): Promise<{ get(name: string): string | null } | null> {
  try {
    const form = await request.formData();
    return {
      get: (name: string) => {
        const value = form.get(name);
        return typeof value === "string" ? value : null;
      },
    };
  } catch {
    try {
      const text = await request.text();
      if (!text.trim()) return null;
      if (text.trim().startsWith("{")) {
        const json = JSON.parse(text) as Record<string, string>;
        return { get: (name: string) => json[name] ?? null };
      }
      const params = new URLSearchParams(text);
      return { get: (name: string) => params.get(name) };
    } catch {
      return null;
    }
  }
}

async function handleClusterAction(env: Env, request: Request, path: string): Promise<Response> {
  const parts = path.split("/");
  const id = parts[3]!;
  const action = parts[4]!;
  const form = await readForm(request);

  switch (action) {
    case "publish":
      await setClusterStatus(env.DB, id, "published");
      break;
    case "reject":
      await setClusterStatus(env.DB, id, "rejected");
      break;
    case "rename": {
      const title = String(form?.get("title") ?? "").trim();
      if (title) await renameCluster(env.DB, id, title);
      break;
    }
    case "merge": {
      const into = String(form?.get("into") ?? "").trim();
      if (into) await mergeClusters(env.DB, id, into);
      break;
    }
    case "ship": {
      const repo = String(form?.get("repo") ?? "").trim();
      const login = String(form?.get("login") ?? "unknown").trim();
      if (repo) await setClaim(env.DB, { clusterId: id, login, repo, note: null, shipped: true });
      break;
    }
    default:
      return new Response("Unknown action", { status: 400 });
  }

  // The cluster page is cached at the edge: drop it so the change is visible.
  await purgeClusterCache(env, id, new URL(request.url).origin);

  return new Response(null, { status: 302, headers: { location: "/admin" } });
}

/** Drop the cached page for a cluster, so a claim shows up immediately. */
export async function purgeClusterCache(
  env: Env,
  clusterId: string,
  origin?: string
): Promise<void> {
  try {
    const { getClusterById } = await import("./db");
    const cluster = await getClusterById(env.DB, clusterId);
    if (!cluster) return;
    const origins = new Set<string>();
    if (origin) origins.add(new URL(origin).origin);
    origins.add(new URL(env.SITE_URL).origin);
    for (const o of origins) {
      await caches.default.delete(new Request(`${o}/w/${cluster.slug}`));
    }
  } catch {
    /* a stale cache is not worth failing over */
  }
}

/** Mark a cluster as shipped from the admin panel without a GitHub claim. */
export async function markShipped(env: Env, clusterId: string, login: string, repo: string) {
  await setClaim(env.DB, { clusterId, login, repo, note: null, shipped: true });
}

/**
 * Store rendered OG images in KV. The PNGs are rendered offline because the
 * free Workers plan cannot rasterise them inside a request.
 */
async function handleOgUpload(env: Env, request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    images?: Array<{ slug: string; png: string }>;
  } | null;
  if (!body?.images?.length) {
    return new Response(JSON.stringify({ error: "no images" }), { status: 400 });
  }
  let stored = 0;
  for (const image of body.images) {
    if (!image.slug || !image.png) continue;
    const bytes = Uint8Array.from(atob(image.png), (c) => c.charCodeAt(0));
    await env.KV.put(`og:${image.slug}`, bytes, {
      expirationTtl: 60 * 60 * 24 * 365,
    });
    stored++;
  }
  return new Response(JSON.stringify({ ok: true, stored }), {
    headers: { "content-type": "application/json" },
  });
}

/**
 * Seed the board with real wishes so it is not empty on launch. Seeded wishes
 * are marked as such in the database and labelled on the board.
 */
async function handleSeed(env: Env, request: Request, ctx?: ExecutionContext): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    wishes?: Array<{ need: string; context?: string; client?: string; model?: string }>;
    offset?: number;
    limit?: number;
  } | null;
  if (!body?.wishes?.length) {
    return new Response(JSON.stringify({ error: "no wishes" }), { status: 400 });
  }
  // The free plan allows 50 subrequests per invocation and one wish costs
  // about ten of them, so a seeding call is deliberately small.
  const offset = body.offset ?? 0;
  const limit = Math.min(body.limit ?? 4, 6);
  const batch = body.wishes.slice(offset, offset + limit);

  const { fileWish, genericiseWish } = await import("./wish");
  const results: Array<{ title: string; slug: string; matched: boolean }> = [];
  for (const [i, wish] of batch.entries()) {
    try {
      const outcome = await fileWish(
        env,
        {
          ipKey: `seed-ip-${i}`,
          sourceKey: `seed-source-${i}-${Date.now().toString(36)}`,
          userAgent: "seed",
        },
        { need: wish.need, context: wish.context ?? null, client: wish.client ?? null, model: wish.model ?? null },
        { seeded: true, skipRateLimit: true }
      );
      ctx?.waitUntil(
        genericiseWish(env, outcome.wishId, outcome.clusterId, outcome.need, wish.context ?? null).catch(
          () => undefined
        )
      );
      results.push({ title: outcome.title, slug: outcome.slug, matched: outcome.matched });
    } catch (err) {
      results.push({ title: `ERROR: ${(err as Error).message}`, slug: "", matched: false });
    }
  }
  return new Response(
    JSON.stringify({
      ok: true,
      count: results.length,
      offset,
      nextOffset: offset + batch.length,
      total: body.wishes.length,
      done: offset + batch.length >= body.wishes.length,
      results,
    }),
    { headers: { "content-type": "application/json" } }
  );
}

/** Push the registry index forward by one batch. */
async function handleCrawl(env: Env, request: Request): Promise<Response> {
  const { crawlRegistry } = await import("./registry");
  try {
    const result = await crawlRegistry(env, 50);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}

/** Embed arbitrary strings, so the threshold can be tuned against real data. */
async function handleEmbed(env: Env, request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    texts?: string[];
    model?: string;
  } | null;
  if (!body?.texts?.length) {
    return new Response(JSON.stringify({ error: "no texts" }), { status: 400 });
  }
  const model = body.model ?? "@cf/baai/bge-base-en-v1.5";
  const { embedBatch } = await import("./embed");
  const docs = await embedBatch(env, body.texts, model);
  const queries = await embedBatch(
    env,
    body.texts.map((t) => `Represent this sentence for searching relevant passages: ${t}`),
    model
  );
  return new Response(JSON.stringify({ docs, queries, model }), {
    headers: { "content-type": "application/json" },
  });
}

/** Clear wishes and clusters. For development only. */
async function handleReset(env: Env, request: Request): Promise<Response> {
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM votes`),
    env.DB.prepare(`DELETE FROM wishes`),
    env.DB.prepare(`DELETE FROM cluster_clients`),
    env.DB.prepare(`DELETE FROM clusters`),
    env.DB.prepare(`DELETE FROM rate_limits`),
  ]);
  // Drop the cluster vectors from the index so stale centroids cannot match.
  try {
    const vectorize = env.VECTORS as unknown as {
      deleteById?: (ids: Array<{ id: string; namespace: string }>) => Promise<unknown>;
    };
    if (typeof vectorize.deleteById === "function") {
      const listed = await env.VECTORS.query(new Array(768).fill(0), {
        topK: 100,
        namespace: "clusters",
      });
      const ids = (listed.matches ?? []).map((m) => ({ id: m.id, namespace: "clusters" }));
      if (ids.length) await vectorize.deleteById(ids);
    }
  } catch (err) {
    console.error("vector reset failed", err);
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
}

/** Build the weekly snapshot now, rather than waiting for Monday. */
async function handleWeeklySnapshot(env: Env): Promise<Response> {
  const { isoWeekId, weekStart } = await import("./types");
  const db = await import("./db");
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
  return new Response(JSON.stringify({ ok: true, week: weekId, clusters: clusters.length }), {
    headers: { "content-type": "application/json" },
  });
}

/** Look at what is actually in the vector index. */
async function handleVectorDebug(env: Env, request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text ?? "Read UK council planning PDFs as structured data";
  const { embedQuery, queryClusters } = await import("./embed");

  const vector = await embedQuery(env, text);
  void vector;
  const clusters = await queryClusters(env, vector, 10);

  // Also probe the default namespace to see if vectors ended up in the wrong
  // place.
  const probe = new Array(1024).fill(0);
  const raw = await env.VECTORS.query(probe, { topK: 100 });

  const dbClusters = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM clusters`
  ).first<{ n: number }>();

  // Annotate each match with whether its cluster still exists in D1, so we
  // can tell "not indexed yet" from "deleted".
  const ids = clusters.map((m) => m.id);
  const existing = new Set<string>();
  for (const chunk of chunkArray(ids, 40)) {
    const placeholders = chunk.map(() => "?").join(",");
    const rows = await env.DB.prepare(
      `SELECT id FROM clusters WHERE id IN (${placeholders})`
    )
      .bind(...chunk)
      .all<{ id: string }>();
    for (const r of rows.results ?? []) existing.add(r.id);
  }

  return new Response(
    JSON.stringify(
      {
        text,
        clusters_in_db: dbClusters?.n ?? 0,
        matches: clusters.map((m) => ({
          id: m.id,
          score: m.score,
          slug: (m.metadata as Record<string, string> | undefined)?.slug,
          in_db: existing.has(m.id),
        })),
        total_vectors_visible: raw.matches?.length ?? 0,
        visible_ids: (raw.matches ?? []).slice(0, 40).map((m) => m.id),
      },
      null,
      2
    ),
    { headers: { "content-type": "application/json" } }
  );
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export { relativeTime };
