import { describe, it, expect } from "vitest";

import { renderWishForm, renderAgents, renderAbout, renderBuild } from "../src/board";

/**
 * The nav has to mark the page the reader is on.
 *
 * `aria-current="page"` is how a screen reader says "you are here",
 * and how a stylesheet draws the current link as filled. It is only
 * true if it is on the link for the page that was actually rendered.
 *
 * The wish form passed `nav: "/agents"`. So on `/wish`, the "For
 * agents" link was marked as the current page, and "File a wish" was
 * not marked on any page at all.
 *
 * A reader who opened the wish form was told, by the assistive
 * technology, that they were on the agents page. And the one link in
 * the nav that a person can only reach by clicking "File a wish" never
 * lit up, so the nav had six entries and five states.
 *
 * These tests check the rendered markup, because that is what the
 * screen reader reads.
 */

/**
 * A D1 that answers every read with nothing.
 *
 * The About page reads the board so it can print live numbers, so it
 * needs a database. A stub keeps the nav test about the nav.
 */
function stubDb() {
  const statement = () => ({
    all: async () => ({ results: [] }),
    bind: () => ({
      all: async () => ({ results: [] }),
      first: async () => null,
      run: async () => ({ meta: { changes: 0 } }),
    }),
    first: async () => null,
    run: async () => ({ meta: { changes: 0 } }),
  });
  return { prepare: statement, batch: async () => [], exec: async () => ({}) };
}

const env = {
  SITE_URL: "https://toolswanted.dev",
  SITE_NAME: "Tools Wanted",
  DB: stubDb(),
} as never;

/**
 * Render a page, whether it is sync or async.
 *
 * The About page becomes async when it reads the board, and a test
 * written against one shape breaks against the other.
 */
async function page(render: (e: unknown) => string | Promise<string>): Promise<string> {
  return await render(env);
}

/**
 * The links the nav renders, with the ones marked as current.
 *
 * Read from the rendered header, not from the source, so the check is
 * against what a reader gets.
 */
function navLinks(html: string): Array<{ href: string; label: string; current: boolean }> {
  const header = html.slice(html.indexOf('<header class="top">'), html.indexOf("</header>"));
  expect(header.length).toBeGreaterThan(0);
  const links: Array<{ href: string; label: string; current: boolean }> = [];
  const re = /<a href="([^"]*)"([^>]*)>([^<]*)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(header)) !== null) {
    links.push({
      href: m[1]!,
      label: m[3]!.trim(),
      current: m[2]!.includes('aria-current="page"'),
    });
  }
  return links;
}

describe("the nav on the wish form", () => {
  it("marks the wish link as the current page", async () => {
    // The failure this catches: the wish form passes nav "/agents", so
    // "File a wish" is never marked current on any page.
    const html = await page(renderWishForm as never);
    const links = navLinks(html);

    const wish = links.find((l) => l.href === "/wish");
    expect(wish).toBeTruthy();
    expect(wish!.current).toBe(true);
  });

  it("does not mark the agents link as the current page", async () => {
    // The other side of the same claim. A nav that marks two pages as
    // current has not fixed the first one, it has made it worse: a
    // screen reader now says two things are "here".
    const html = await page(renderWishForm as never);
    const links = navLinks(html);

    const agents = links.find((l) => l.href === "/agents");
    expect(agents).toBeTruthy();
    expect(agents!.current).toBe(false);
  });

  it("marks exactly one link as the current page", async () => {
    // The confirmer. The claim is that the current page is right, and
    // "exactly one" is what makes it unambiguous to a screen reader.
    const html = await page(renderWishForm as never);
    const current = navLinks(html).filter((l) => l.current);

    expect(current).toHaveLength(1);
    expect(current[0]!.href).toBe("/wish");
  });
});

describe("the nav on every other page", () => {
  it("marks the right link on each page", async () => {
    // The claim is not about the wish form alone. Every page has to
    // mark itself, or the nav is decoration.
    const pages: Array<[string, (e: unknown) => string | Promise<string>, string]> = [
      ["the agents page", renderAgents as never, "/agents"],
      ["the about page", renderAbout as never, "/about"],
      ["the build page", ((e: unknown) => renderBuild(e as never, "a-wish")) as never, "/build"],
    ];

    for (const [name, render, expected] of pages) {
      const html = await page(render);
      const current = navLinks(html).filter((l) => l.current);
      expect(current, `${name} marks exactly one current link`).toHaveLength(1);
      expect(current[0]!.href, `${name} marks itself current`).toBe(expected);
    }
  });
});
