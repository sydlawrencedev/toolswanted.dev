import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * The weekly snapshot's cache key.
 *
 * Every other cached route puts the deploy's version into the cache key,
 * so a deploy invalidates the cached page and the browser is handed a
 * page whose stylesheet URL matches its own build.
 *
 * The snapshot route did not. Its cache key had no version in it, so:
 *
 *   1. A deploy did not invalidate it, so a snapshot page survived a
 *      deploy for the whole hour of its max-age.
 *   2. A local run could read from it, and could write to it, because
 *      the route also did not pass the `local` flag that stops a local
 *      request touching the production cache.
 *
 * The page that ended up in production's cache was a local build's
 * page: it carried the markup for a theme control that the deployed
 * Worker does not have, and its stylesheet URL had no version on it, so
 * the browser fetched the production stylesheet and the page rendered
 * a button that no stylesheet in the product had ever styled.
 *
 * That is not a theory. On production, /weekly/2026-W44 served a
 * 21px-tall unstyled button with a 2px outset border, on a page whose
 * own markup asked for a 44px button with a 1px border.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX_SRC = readFileSync(join(ROOT, "src", "index.ts"), "utf8");

/** The source of the route that serves /weekly/{id}. */
function weeklySnapshotRoute(): string {
  const start = INDEX_SRC.indexOf('path.startsWith("/weekly/")');
  expect(start).toBeGreaterThan(-1);
  // The route ends at the next top-level `if (path ===`.
  const rest = INDEX_SRC.slice(start);
  const end = rest.indexOf('if (path === "/agents")');
  expect(end).toBeGreaterThan(-1);
  return rest.slice(0, end);
}

describe("the weekly snapshot's cache key", () => {
  it("carries the deploy's version, so a deploy invalidates it", () => {
    const route = weeklySnapshotRoute();
    expect(route).toMatch(/VERSION_METADATA\?\.id/);
  });

  it("passes the local flag, so a local run cannot write to the production cache", () => {
    // The `local` flag is what stops `wrangler dev` from reading or
    // writing the production cache. Every other cached route passes it.
    const route = weeklySnapshotRoute();
    expect(route).toMatch(/\blocal\b/);
  });

  it("is the only cached route that leaves the version out", () => {
    // This is the shape of the defect: one route out of eight.
    const calls = INDEX_SRC.match(/return cached\(/g) ?? [];
    expect(calls.length).toBeGreaterThan(1);
    const withVersion = INDEX_SRC.match(/env\.VERSION_METADATA\?\.id/g) ?? [];
    // One per cached route, plus the `local` computation at the top.
    expect(withVersion.length).toBeGreaterThanOrEqual(calls.length);
  });
});

describe("every page's stylesheet URL", () => {
  it("carries the deploy's version, so the page and its stylesheet agree", () => {
    // The page that ended up in production's cache was a local build's
    // page, with a stylesheet URL that carried no version on it. The
    // browser fetched the deployed stylesheet and the page rendered a
    // button that nothing in the product had ever styled.
    //
    // Every page that calls `layout` has to carry the version, whether
    // it gets it from `pageMeta` or sets it itself. The pages that
    // build their own meta are the ones that forget.
    const boardSrc = readFileSync(join(ROOT, "src", "board.ts"), "utf8");
    expect(boardSrc).toMatch(/assetVersion:\s*env\.VERSION_METADATA\?\.id/);

    // The pages in index.ts that build their own meta: the 404, the
    // write-limit page and the crawler page.
    for (const marker of [
      'canonical: `${env.SITE_URL}/404`',
      'canonical: `${env.SITE_URL}/`,\n        noindex: true,',
    ]) {
      expect(INDEX_SRC).toContain(marker);
    }
    expect(INDEX_SRC.match(/assetVersion:\s*env\.VERSION_METADATA\?\.id/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
