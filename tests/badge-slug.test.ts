import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { renderBuild, weeklyBadgeSnippet } from "../src/board";

/**
 * A badge must not point at a page that is not there.
 *
 * `badgeSnippet` fell back to a hardcoded slug when it was called with
 * no slug: `read-uk-council-planning-pdfs-as-structured-data`. That
 * slug was the board's example entry and it had been shortened since,
 * so the fallback pointed at a 404.
 *
 * The build page is where a builder pastes the badge into their
 * README. It renders the badge snippet with whatever slug the form
 * carried, and the form's slug field is empty until the builder
 * picks a wish. So the page a builder lands on, before they have
 * chosen anything, handed them a snippet pointing at a page that does
 * not exist. They paste it, and their README carries a broken image
 * and a broken link.
 *
 * That is the one thing the product asks a builder to publish.
 *
 * The fix is that the fallback is gone. With no slug there is no
 * per-wish badge, because there is no wish to point at. The weekly
 * badge points at the weekly list, which always exists.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOARD_SRC = join(ROOT, "src", "board.ts");

const SOURCE = readFileSync(BOARD_SRC, "utf8");

const env = {
  SITE_URL: "https://toolswanted.dev",
  SITE_NAME: "Tools Wanted",
} as never;

/**
 * The slug the fallback used to carry.
 *
 * It was the board's example entry, so it appears in the product's own
 * copy in several places. The check is on the fallback itself, not on
 * the string: the string is allowed to exist as an example.
 */
const DEAD_SLUG = "read-uk-council-planning-pdfs-as-structured-data";

describe("the badge snippet", () => {
  it("has no hardcoded fallback slug", () => {
    // The failure this catches: `const target = slug || "read-uk-council-
    // planning-pdfs-as-structured-data"`. A slug written into the
    // source is a slug that can stop existing, and nothing notices.
    const fallback = SOURCE.match(/slug\s*\|\|\s*"([^"]+)"/);
    expect(fallback, "no slug || \"...\" fallback in the source").toBeNull();
  });

  it("does not contain the dead slug as a fallback anywhere in the source", () => {
    // The belt to the braces. Whatever the shape of the fix, the dead
    // slug must not be sitting in the source as a default target.
    const asDefault = SOURCE.match(
      new RegExp(`(?:\\|\\||\\?\\?|=)\\s*["']${DEAD_SLUG}["']`)
    );
    expect(asDefault).toBeNull();
  });

  it("does not emit a badge for a slug that was not given", () => {
    // The claim under test: with no slug, the builder gets no badge
    // for a wish, because there is no wish to point at.
    const html = renderBuild(env);
    const pre = html.match(/<pre><code>([\s\S]*?)<\/code>/g) ?? [];
    const snippets = pre.map((p) => p.replace(/<[^>]+>/g, ""));

    for (const snippet of snippets) {
      expect(snippet).not.toContain(`/badge/${DEAD_SLUG}.svg`);
      expect(snippet).not.toContain(`/w/${DEAD_SLUG}`);
    }
  });

  it("gives the weekly badge instead, which always exists", () => {
    // The confirmer. The fix is not to remove the badge altogether.
    // The weekly list is always there, and its badge points at it.
    const html = renderBuild(env);
    const weekly = weeklyBadgeSnippet(env);

    expect(weekly).toContain("/badge/weekly.svg");
    expect(html).toContain("/badge/weekly.svg");
  });

  it("still gives a builder the per-wish badge when they pick a wish", () => {
    // The two-sided check. A fix that removed the badge from the build
    // page entirely would pass the checks above and break the thing
    // the page is for.
    const html = renderBuild(env, "a-wish");

    expect(html).toContain("/badge/a-wish.svg");
    expect(html).toContain("/w/a-wish");
  });
});
