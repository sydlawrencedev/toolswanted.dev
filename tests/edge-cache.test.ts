import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { edgeCached, freshSeconds, STALE_FOR_SECONDS } from "../src/edge-cache";
import { apiFreshSeconds } from "../src/api";

/**
 * The edge cache in front of the board and the public API.
 *
 * On 6 November the daily D1 read limit took the whole site down. The
 * cache now keeps the last good copy of every page for a day, serves it
 * while it refreshes, and keeps it when the refresh fails.
 */

/** An in-memory stand-in for `caches.default`. */
class FakeCache {
  store = new Map<string, { body: string; init: ResponseInit }>();
  puts = 0;
  async match(req: Request): Promise<Response | undefined> {
    const e = this.store.get(req.url);
    return e ? new Response(e.body, e.init) : undefined;
  }
  async put(req: Request, res: Response): Promise<void> {
    this.puts++;
    this.store.set(req.url, {
      body: await res.text(),
      init: { status: res.status, headers: Object.fromEntries(res.headers) },
    });
  }
}

function page(body: string, cc = "public, max-age=30, s-maxage=60"): Response {
  return new Response(body, { status: 200, headers: { "content-type": "text/html", "cache-control": cc } });
}

function setup() {
  const cache = new FakeCache();
  let t = 1_000_000;
  const clock = { now: () => t, advance: (s: number) => (t += s * 1000) };
  const waits: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => void waits.push(p) };
  const settle = () => Promise.all(waits.splice(0));
  const opts = { cache: cache as unknown as Cache, now: clock.now, ctx, version: "v1" };
  return { cache, clock, settle, opts };
}

const req = () => new Request("https://toolswanted.dev/");

describe("freshSeconds", () => {
  it("prefers s-maxage, falls back to max-age, and ignores anything not public", () => {
    expect(freshSeconds("public, max-age=30, s-maxage=60")).toBe(60);
    expect(freshSeconds("public, max-age=600")).toBe(600);
    expect(freshSeconds("no-store")).toBe(0);
    expect(freshSeconds("private, max-age=60")).toBe(0);
    expect(freshSeconds(null)).toBe(0);
  });
});

describe("edgeCached", () => {
  it("renders once and serves the copy while it is fresh", async () => {
    const { settle, opts } = setup();
    let renders = 0;
    const produce = async () => page(`render ${++renders}`);

    const first = await edgeCached(req(), produce, opts);
    expect(first.headers.get("x-cache")).toBe("MISS");
    await settle();

    const second = await edgeCached(req(), produce, opts);
    expect(second.headers.get("x-cache")).toBe("HIT");
    expect(await second.text()).toBe("render 1");
    expect(renders).toBe(1);
  });

  it("hands the client its own cache-control, not the day-long storage one", async () => {
    const { settle, opts, cache } = setup();
    await edgeCached(req(), async () => page("x"), opts);
    await settle();
    const stored = [...cache.store.values()][0]!;
    expect((stored.init.headers as Record<string, string>)["cache-control"]).toBe(
      `public, max-age=${60 + STALE_FOR_SECONDS}`
    );

    const hit = await edgeCached(req(), async () => page("y"), opts);
    expect(hit.headers.get("cache-control")).toBe("public, max-age=30, s-maxage=60");
    expect(hit.headers.get("x-fresh-until")).toBeNull();
    expect(hit.headers.get("x-origin-cache-control")).toBeNull();
  });

  it("serves the stale copy at once and refreshes behind it", async () => {
    const { clock, settle, opts } = setup();
    let renders = 0;
    const produce = async () => page(`render ${++renders}`);
    await edgeCached(req(), produce, opts);
    await settle();

    clock.advance(61);
    const stale = await edgeCached(req(), produce, opts);
    expect(stale.headers.get("x-cache")).toBe("STALE");
    expect(await stale.text()).toBe("render 1");
    await settle();

    const next = await edgeCached(req(), produce, opts);
    expect(next.headers.get("x-cache")).toBe("HIT");
    expect(await next.text()).toBe("render 2");
  });

  it("starts one refresh, not one per request, while a refresh is running", async () => {
    const { clock, settle, opts } = setup();
    let renders = 0;
    const produce = async () => page(`render ${++renders}`);
    await edgeCached(req(), produce, opts);
    await settle();

    clock.advance(61);
    await edgeCached(req(), produce, opts);
    // The lease went into the cache before the refresh ran.
    const behind = await edgeCached(req(), produce, opts);
    expect(behind.headers.get("x-cache")).toBe("HIT");
    await settle();
    expect(renders).toBe(2);
  });

  it("keeps the last good page when D1 is down", async () => {
    const { clock, settle, opts } = setup();
    await edgeCached(req(), async () => page("good"), opts);
    await settle();

    clock.advance(61);
    const down = async (): Promise<Response> => {
      throw new Error("D1_ERROR: daily read limit exceeded");
    };
    const first = await edgeCached(req(), down, opts);
    expect(await first.text()).toBe("good");
    await settle();

    clock.advance(3600);
    const later = await edgeCached(req(), async () => new Response("limit", { status: 503 }), opts);
    expect(await later.text()).toBe("good");
    await settle();

    clock.advance(3600);
    const still = await edgeCached(req(), down, opts);
    expect(await still.text()).toBe("good");
  });

  it("does not store an error, a private page, or a page that sets a cookie", async () => {
    const { settle, opts, cache } = setup();
    await edgeCached(new Request("https://toolswanted.dev/a"), async () => new Response("no", { status: 503 }), opts);
    await edgeCached(new Request("https://toolswanted.dev/b"), async () => page("p", "no-store"), opts);
    await edgeCached(
      new Request("https://toolswanted.dev/c"),
      async () => new Response("c", { headers: { "cache-control": "public, max-age=60", "set-cookie": "a=b" } }),
      opts
    );
    await settle();
    expect(cache.store.size).toBe(0);
  });

  it("never touches the cache when bypassed, and says so", async () => {
    const { settle, opts, cache } = setup();
    const res = await edgeCached(req(), async () => page("local"), { ...opts, bypass: true });
    await settle();
    expect(res.headers.get("x-cache")).toBe("BYPASS");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(cache.puts).toBe(0);
  });

  it("puts the deploy's version in the key", async () => {
    const { settle, opts, cache } = setup();
    await edgeCached(req(), async () => page("x"), opts);
    await settle();
    expect([...cache.store.keys()][0]).toContain("__v=v1");
  });

  it("does not cache anything but GET", async () => {
    const { settle, opts, cache } = setup();
    await edgeCached(new Request("https://toolswanted.dev/", { method: "POST" }), async () => page("x"), opts);
    await settle();
    expect(cache.puts).toBe(0);
  });
});

describe("the public API's edge cache", () => {
  it("caches the public reads", () => {
    for (const p of ["/api/top", "/api/stats", "/api/search", "/api/updates", "/api/weekly", "/api/cluster/x"]) {
      expect(apiFreshSeconds(p)).toBeGreaterThan(0);
    }
  });

  it("does not cache the admin-only server search or anything unknown", () => {
    expect(apiFreshSeconds("/api/servers")).toBe(0);
    expect(apiFreshSeconds("/api/wish")).toBe(0);
    expect(apiFreshSeconds("/api/nope")).toBe(0);
  });
});

describe("a signed-in builder's wish page", () => {
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
  const INDEX_SRC = readFileSync(join(ROOT, "src", "index.ts"), "utf8");

  it("is never stored, because it carries a button for them alone", () => {
    const start = INDEX_SRC.indexOf('path.startsWith("/w/")');
    const route = INDEX_SRC.slice(start, INDEX_SRC.indexOf('if (path === "/weekly")', start));
    expect(route).toMatch(/getSessionCookieValue\(request\)/);
    expect(route).toMatch(/local \|\| signedIn/);
  });
});
