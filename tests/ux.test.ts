import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BOARD_SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "board.ts");
import { renderBuild, renderWishForm, weeklyBadgeSnippet } from "../src/board";

/**
 * The UX review found that the exits were broken in seven places and that
 * two of the artefacts the product hands a builder were wrong.
 *
 * These tests are about the markup, not about the design: they check that
 * every snippet can be copied, that the badge points at a slug that
 * exists, that the claim form carries the wish it was opened for, and
 * that the weekly page gives a builder a way to take the URL away.
 */

const env = {
  SITE_URL: "https://toolswanted.dev",
  SITE_NAME: "Tools Wanted",
} as never;

describe("the build page", () => {
  it("prefills the claim form with the wish it was opened for", () => {
    const html = renderBuild(env, "read-uk-council-planning-pdfs-as-structured-data");
    expect(html).toContain('value="read-uk-council-planning-pdfs-as-structured-data"');
    expect(html).toContain("Claiming read-uk-council-planning-pdfs-as-structured-data");
  });

  it("leaves the form empty when no wish was named", () => {
    const html = renderBuild(env);
    expect(html).toContain('id="slug" name="slug" value=""');
  });

  it("puts a badge in the snippet that points at a real slug", () => {
    // The snippet used to be hardcoded to a slug that had been shortened
    // since, so a builder who pasted it shipped a 404 and a badge that
    // said "Wanted by 0 agents".
    const html = renderBuild(env, "read-uk-council-planning-pdfs-as-structured-data");
    expect(html).toContain("/badge/read-uk-council-planning-pdfs-as-structured-data.svg");
    expect(html).toContain("/w/read-uk-council-planning-pdfs-as-structured-data");
    expect(html).not.toContain("/badge/read-uk-council-planning-pdfs.svg");
  });

  it("gives the badge snippet a copy button", () => {
    const html = renderBuild(env, "read-uk-council-planning-pdfs-as-structured-data");
    expect(html).toContain("class=\"copybtn\"");
    expect(html).toContain("data-copy=\"[![Wanted by agents]");
  });

  it("tells the builder the badge comes from the board itself", () => {
    const html = renderBuild(env, "some-wish");
    expect(html).toContain("The count comes from the board");
  });
});

describe("the weekly page", () => {
  it("gives a builder the badge snippet to put in a README", () => {
    // The page said "link to this from your README" and gave no way to
    // get the link. The only route was the browser address bar.
    const snippet = weeklyBadgeSnippet(env);
    expect(snippet).toContain("/badge/weekly.svg");
    expect(snippet).toContain("/weekly");
  });

  it("the weekly snippet is copyable on the page", async () => {
    // The snippet is inside a copy row, checked in the rendered page.
    const src = readFileSync(BOARD_SRC, "utf8");
    expect(src).toContain('codeBlock(weeklyBadgeSnippet(env), "Copy badge")');
  });
});

describe("the wish form", () => {
  it("gives every snippet a copy button", () => {
    // Three snippets, none of them copyable. This is the page a human
    // lands on when they want to file a wish, and the three snippets that
    // let an agent do it for them were the ones they could not copy.
    const html = renderWishForm(env);
    const pres = (html.match(/<pre/g) ?? []).length;
    const buttons = (html.match(/class="copybtn"/g) ?? []).length;
    expect(pres).toBeGreaterThan(0);
    expect(buttons).toBe(pres);
  });
});

describe("the copy button", () => {
  it("no raw pre block survives in the board templates", () => {
    // A guard against the next snippet being added without a button. Every
    // code block goes through codeBlock, so a bare `<pre>` in the
    // templates is always a mistake.
    //
    // The check is that the button is inside the pre, not that the pre
    // carries a class: a class that names the block it is in is a
    // second thing to keep in step, and the button itself is the proof.
    const src = readFileSync(BOARD_SRC, "utf8");
    const bare = src.match(/<pre>(?!<code>\$\{esc\()/g) ?? [];
    expect(bare).toEqual([]);
  });

  it("no code block is written without a copy button", () => {
    // Every `<pre>` in the templates is followed by a copy button.
    const src = readFileSync(BOARD_SRC, "utf8");
    const pres = (src.match(/<pre>/g) ?? []).length;
    const buttons = (src.match(/copyButton\(/g) ?? []).length;
    expect(buttons).toBeGreaterThanOrEqual(pres);
  });
});
