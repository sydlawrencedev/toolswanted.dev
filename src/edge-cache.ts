/**
 * The edge cache in front of every public read.
 *
 * Two things it does that the old `cached()` did not:
 *
 * 1. It serves a stale copy while it refreshes. A page is fresh for the
 *    TTL in its own cache-control header and then kept for a day more.
 *    A request for a stale page gets the stale page at once, and the
 *    refresh happens in the background. One request per page per data
 *    centre per TTL reaches D1, instead of every request that lands in
 *    the gap between expiry and refresh.
 *
 * 2. It keeps the last good copy when D1 is down. If the refresh fails
 *    or comes back as anything but a 200, the stale copy stays. On
 *    6 November the daily read limit took the whole site down. With
 *    this, the board keeps serving the last good render until midnight
 *    UTC in every data centre that had one.
 *
 * The cache is `caches.default`, which belongs to each data centre, not
 * the whole network. KV would be global, but the free plan allows 1,000
 * KV writes a day, which a 60-second board refresh would spend by
 * lunchtime.
 */

/** How long a page is kept after it stops being fresh. */
export const STALE_FOR_SECONDS = 86_400;

/**
 * How long a refresh holds the stale copy before another request may
 * try again. Without it, every request in a busy data centre would start
 * its own refresh in the second after expiry.
 */
export const REFRESH_LEASE_SECONDS = 30;

const FRESH_UNTIL = "x-fresh-until";
const ORIGIN_CACHE_CONTROL = "x-origin-cache-control";

export interface EdgeCacheOptions {
  /** The deploy's version. It goes in the key, so a deploy invalidates every page. */
  version?: string;
  /** A local run never reads or writes the production cache. */
  bypass?: boolean;
  /** Lets the refresh and the store run after the response has gone. */
  ctx?: Pick<ExecutionContext, "waitUntil">;
  /** For tests. */
  cache?: Cache;
  now?: () => number;
}

/** Seconds a response stays fresh: `s-maxage` if it has one, else `max-age`. */
export function freshSeconds(cacheControl: string | null): number {
  if (!cacheControl || !/\bpublic\b/.test(cacheControl)) return 0;
  const shared = cacheControl.match(/\bs-maxage=(\d+)/);
  if (shared) return Number(shared[1]);
  const max = cacheControl.match(/\bmax-age=(\d+)/);
  return max ? Number(max[1]) : 0;
}

function cacheKey(request: Request, version?: string): Request {
  const url = new URL(request.url);
  if (version) url.searchParams.set("__v", version);
  return new Request(url.toString(), { method: "GET" });
}

/** The copy that goes into the cache, with its freshness written on it. */
function storable(res: Response, now: number): Response | null {
  if (res.status !== 200 || res.headers.has("set-cookie")) return null;
  const original = res.headers.get("cache-control");
  const fresh = freshSeconds(original);
  if (fresh <= 0) return null;
  const copy = new Response(res.clone().body, res);
  copy.headers.set(ORIGIN_CACHE_CONTROL, original ?? "");
  copy.headers.set(FRESH_UNTIL, String(now + fresh * 1000));
  copy.headers.set("cache-control", `public, max-age=${fresh + STALE_FOR_SECONDS}`);
  return copy;
}

/** A cached copy as the client should see it, without the bookkeeping headers. */
function served(hit: Response, state: "HIT" | "STALE"): Response {
  const res = new Response(hit.body, hit);
  const original = res.headers.get(ORIGIN_CACHE_CONTROL);
  if (original) res.headers.set("cache-control", original);
  res.headers.delete(ORIGIN_CACHE_CONTROL);
  res.headers.delete(FRESH_UNTIL);
  res.headers.set("x-cache", state);
  return res;
}

function later(ctx: EdgeCacheOptions["ctx"], work: Promise<unknown>): Promise<unknown> | undefined {
  const quiet = work.catch(() => undefined);
  if (ctx) {
    ctx.waitUntil(quiet);
    return undefined;
  }
  return quiet;
}

export async function edgeCached(
  request: Request,
  produce: () => Promise<Response>,
  opts: EdgeCacheOptions = {}
): Promise<Response> {
  if (request.method !== "GET") return produce();

  if (opts.bypass) {
    const res = await produce();
    const headers = new Headers(res.headers);
    headers.set("cache-control", "no-store");
    headers.set("x-cache", "BYPASS");
    return new Response(res.body, { status: res.status, headers });
  }

  const cache = opts.cache ?? caches.default;
  const now = opts.now ?? Date.now;
  const key = cacheKey(request, opts.version);

  const hit = await cache.match(key);
  if (hit) {
    const freshUntil = Number(hit.headers.get(FRESH_UNTIL) ?? 0);
    if (now() < freshUntil) return served(hit, "HIT");

    // Stale. Take a lease on it, so the requests behind this one serve
    // it as a hit instead of each starting a refresh of its own.
    const leased = new Response(hit.clone().body, hit);
    leased.headers.set(FRESH_UNTIL, String(now() + REFRESH_LEASE_SECONDS * 1000));
    await cache.put(key, leased);

    const refresh = (async () => {
      const fresh = storable(await produce(), now());
      // A failed refresh leaves the stale copy where it is: the last
      // good page is better than the error that replaced it.
      if (fresh) await cache.put(key, fresh);
    })();
    const pending = later(opts.ctx, refresh);
    if (pending) await pending;
    return served(hit, "STALE");
  }

  const res = await produce();
  const copy = storable(res, now());
  if (copy) {
    const pending = later(opts.ctx, cache.put(key, copy));
    if (pending) await pending;
  }
  if (res.status === 200) {
    const headers = new Headers(res.headers);
    headers.set("x-cache", "MISS");
    return new Response(res.body, { status: res.status, headers });
  }
  return res;
}
