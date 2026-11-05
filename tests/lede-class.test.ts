import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { CSS } from "../src/html";
import { renderAbout, renderAgents, renderBuild, renderWishForm } from "../src/board";

/**
 * The lede is a class, not an inline style.
 *
 * Seven pages set the lede's type size inline, and two of them set it
 * to 20px while five set it to 19px. So the same element, with the
 * same class name, rendered at two different sizes depending on which
 * page it was on. The board's hero lede was 20px, and every other
 * page's lede was 19px.
 *
 * The split was invisible in review and obvious to a reader: the
 * first line of every page is the lede, and a reader moving between
 * pages saw the type change under them.
 *
 * The stylesheet has exactly one lede rule, and it is scoped to the
 * hero: `.hero .lede`. So the page ledes were not styled by it at
 * all, and they carried their size inline instead. There was no
 * stylesheet rule for the lede as a general thing.
 *
 * The fix promotes `.lede` to a real class in the stylesheet and takes
 * the size off the markup, so every lede is the same size and it
 * comes from one place.
 *
 * The two form inputs carried `style="font-size:17px"` as well. The
 * `.field` class already sets `font-size:16px`, so the inline style
 * was overriding a rule that was already there, and it was the only
 * thing making the claim form's inputs a pixel larger than every
 * other field on the product.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOARD_SRC = join(ROOT, "src", "board.ts");

const SOURCE = readFileSync(BOARD_SRC, "utf8");

/**
 * A D1 that answers every read with nothing.
 *
 * The About page reads the board so it can print live numbers, so it
 * needs a database. A stub keeps this test about the type size.
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

/** Render a page, whether it is sync or async. */
async function page(render: (e: unknown) => string | Promise<string>): Promise<string> {
  return await render(env);
}

/**
 * Every inline font size in the templates.
 *
 * The brief for this fix is that no type size is set inline. A size
 * set inline is a size that cannot be changed in one place, and the
 * point of the fix is that the size comes from the stylesheet.
 */
const INLINE_FONT_SIZE = /style="[^"]*font-size:/g;

/** The lede, with any inline size taken off it. */
const INLINE_LEDE_SIZE = /class="lede"[^"]*style="[^"]*font-size:/g;

describe("no type size is set inline", () => {
  it("has no inline font-size in the templates", () => {
    // The failure this catches: nine inline font sizes, seven of them
    // on a lede and two on a form input.
    const found = SOURCE.match(INLINE_FONT_SIZE) ?? [];
    expect(found).toEqual([]);
  });

  it("has no inline font-size on any lede", () => {
    // The named case. Seven ledes carried their size inline, five at
    // 19px and two at 20px.
    const found = SOURCE.match(INLINE_LEDE_SIZE) ?? [];
    expect(found).toEqual([]);
  });

  it("has no inline font-size on a form input", () => {
    // The same rule on the controls. `.field` already sets 16px, so
    // the inline 17px was overriding a rule that existed.
    const inline = SOURCE.match(/<input[^>]*style="[^"]*font-size:/g) ?? [];
    expect(inline).toEqual([]);
  });
});

describe("the lede is styled by the stylesheet", () => {
  it("has a .lede rule that is not scoped to the hero", () => {
    // The failure this catches: the only lede rule is
    // `.hero .lede{font-size:20px;...}`, so the page ledes had no
    // rule of their own and carried the size inline instead.
    const rules = CSS.match(/(^|[},])\s*\.lede\s*\{[^}]*\}/g) ?? [];
    expect(rules.length).toBeGreaterThan(0);
    // A rule that only matches inside the hero does not style the
    // lede on any other page.
    const unscoped = rules.filter((r: string) => !/\.hero\s+\.lede/.test(r));
    expect(unscoped.length).toBeGreaterThan(0);
  });

  it("gives the lede one size, so it is the same on every page", () => {
    // The two-sided check. The split was 19px and 20px. A rule that
    // sets one size is what stops the split coming back.
    const rule = CSS.match(/(^|[},])\s*\.lede\s*\{[^}]*\}/);
    expect(rule).toBeTruthy();
    const sizes = [...rule![0]!.matchAll(/font-size:\s*([0-9.]+)px/g)].map((m) => parseFloat(m[1]!));
    expect(sizes.length).toBeGreaterThan(0);
    expect(new Set(sizes).size).toBe(1);
  });
});

describe("the rendered ledes", () => {
  it("are not sized inline on any page", async () => {
    // The confirmer. The rule and the markup have to agree: a page
    // that still carries the size inline is still split from the
    // others.
    const pages: Array<[string, (e: unknown) => string | Promise<string>]> = [
      ["the wish form", renderWishForm as never],
      ["the about page", renderAbout as never],
      ["the agents page", renderAgents as never],
      ["the build page", ((e: unknown) => renderBuild(e as never, "a-wish")) as never],
    ];

    for (const [name, render] of pages) {
      const html = await page(render);
      const ledes = html.match(/<p class="lede"[^>]*>/g) ?? [];
      expect(ledes.length, `${name} has a lede`).toBeGreaterThan(0);
      for (const lede of ledes) {
        expect(lede, `${name} lede carries no inline size`).not.toMatch(/style="[^"]*font-size:/);
      }
    }
  });
});
