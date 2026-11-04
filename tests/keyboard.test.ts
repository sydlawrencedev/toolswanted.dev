import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { CSS } from "../src/html";
import { renderBoard, renderWeekly, renderWishForm, renderBuild, renderAbout, renderPrivacy, renderAgents } from "../src/board";

/**
 * Keyboard operability.
 *
 * The nav carried `tabindex="0"` so that it would be a focusable scroll
 * region, because the nav used to scroll sideways on a narrow screen and
 * a scrolling region nobody can focus is unreachable by keyboard.
 *
 * The nav does not scroll sideways any more. Commit 33acc0a made the
 * links content sized and the row wrap, so at every width the nav's
 * scrollWidth is its clientWidth and nothing overflows. The tabindex
 * stayed behind the fix.
 *
 * What it costs: a screen reader user tabs to a focusable navigation
 * landmark on every page and hears "Main, navigation" before they reach
 * the first link, and that landmark is not something they can act on. It
 * is a tab stop that goes nowhere.
 *
 * These tests hold the property, not the markup: a landmark container
 * must never be in the tab order, and the nav must not be a scroll
 * region, because if it ever becomes one again the tabindex has to come
 * back with it.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HTML_SRC = join(ROOT, "src", "html.ts");

const env = {
  SITE_URL: "https://toolswanted.dev",
  SITE_NAME: "Tools Wanted",
} as never;

/**
 * A stub D1. The weekly page reads the board, so it needs a database.
 */
function stubDb() {
  const stmt = () => ({
    all: () => ({ results: [] }),
    bind: () => ({
      all: () => ({ results: [] }),
      first: async () => null,
      run: async () => ({ meta: { changes: 0 } }),
    }),
    first: async () => null,
    run: async () => ({ meta: { changes: 0 } }),
  });
  return { prepare: stmt, batch: async () => [], exec: async () => ({}) };
}

const weeklyEnv = { ...(env as object), DB: stubDb() } as never;

async function everyPage(): Promise<Array<[string, string]>> {
  return [
    ["the board", await renderBoard(weeklyEnv, {})],
    ["the weekly page", await renderWeekly(weeklyEnv)],
    ["the wish page", renderWishForm(env)],
    ["the build page", renderBuild(env)],
    ["the about page", renderAbout(env)],
    ["the privacy page", renderPrivacy(env)],
    ["the agents page", renderAgents(env)],
  ];
}

describe("the tab order", () => {
  it("does not put a landmark container in it", async () => {
    // A landmark is a region of the page, not a control. When it takes a
    // tabindex it becomes a focus stop that does nothing when it is
    // activated, and a screen reader announces it as somewhere to act.
    for (const [name, html] of await everyPage()) {
      const landmarks = html.match(/<(nav|main|header|footer|aside|section)\b[^>]*>/g) ?? [];
      expect(landmarks.length, `${name} has no landmark to check`).toBeGreaterThan(0);
      for (const tag of landmarks) {
        expect(tag, `${name}: ${tag} is a landmark in the tab order`).not.toMatch(/tabindex/i);
      }
    }
  });

  it("does not put the nav in it", async () => {
    // The nav used to be a horizontal scroll region, and a scroll region
    // that cannot be focused cannot be scrolled by keyboard. It wraps now,
    // so it is not one, and it has no business being a tab stop.
    for (const [name, html] of await everyPage()) {
      const nav = html.match(/<nav\b[^>]*>/g) ?? [];
      expect(nav.length, `${name} has no nav to check`).toBeGreaterThan(0);
      for (const tag of nav) {
        expect(tag, `${name}: the nav is in the tab order`).not.toMatch(/tabindex/i);
      }
    }
  });

  it("keeps every control that acts reachable by keyboard", async () => {
    // Removing the nav's tabindex must not take the links with it. The
    // nav is still a set of links, and links are focusable on their own.
    const html = await renderBoard(weeklyEnv, {});
    expect(html).toContain('<nav aria-label="Main">');
    // Every destination in the nav is a real link with an href, so it
    // takes focus on its own.
    const hrefs = [...html.matchAll(/<nav aria-label="Main">([\s\S]*?)<\/nav>/g)].map((m) => m[1]!);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const inner of hrefs) {
      const links = inner.match(/<a\b[^>]*href="/g) ?? [];
      expect(links.length, "the nav has no links").toBeGreaterThan(0);
    }
  });
});

describe("the nav as a scroll region", () => {
  it("does not scroll sideways, so it needs no focusable scroll region", () => {
    // The reason the tabindex was there. If the nav ever goes back to
    // scrolling, this fails and the tabindex has to come back with it.
    // The rule is that the nav wraps: it is a flex row that wraps, and
    // at the narrow breakpoint a grid whose columns are content sized.
    const navRule = CSS.match(/\.top nav\{[^}]*\}/);
    expect(navRule).toBeTruthy();
    expect(navRule![0]).toContain("flex-wrap:wrap");

    // Nothing gives the nav an overflow, so it cannot be a scroll region.
    expect(navRule![0]).not.toMatch(/overflow/);
  });

  it("has no CSS that makes it scroll", () => {
    const src = readFileSync(HTML_SRC, "utf8");
    // Every rule that targets the top nav.
    const rules = [...src.matchAll(/\.top nav[^{]*\{[^}]*\}/g)].map((m) => m[0]);
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule, `the nav scrolls sideways: ${rule}`).not.toMatch(/overflow(-x|-y)?\s*:\s*(auto|scroll|hidden)/);
    }
  });

  it("has no focus style, because it cannot be focused", () => {
    // The nav used to carry tabindex="0" so it could be a keyboard
    // scroll region, and a focus style came with it. Now that the
    // tabindex is gone, a :focus-visible rule on the nav styles
    // something that can never take focus. It is dead CSS that reads as
    // though the nav is still interactive.
    const src = readFileSync(HTML_SRC, "utf8");
    const rules = [...src.matchAll(/\.top nav[^{]*\{[^}]*\}/g)].map((m) => m[0]);
    for (const rule of rules) {
      expect(rule, `the nav has a focus style but cannot be focused: ${rule}`).not.toMatch(/:focus/);
    }
  });
});
