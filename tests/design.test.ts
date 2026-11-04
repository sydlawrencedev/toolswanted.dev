import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { CSS } from "../src/html";
import { renderBoard, renderWeekly, renderWishForm, renderBuild, renderAbout, renderPrivacy, renderAgents } from "../src/board";
import { plural } from "../src/types";

/**
 * The design review found defects that only show up in the rendered
 * page, not in the markup: a navigation that ran off the right edge of
 * a phone, a copy button sitting on top of the code it was copying, a
 * type size that had drifted under the floor, and a code snippet that
 * was not a runnable command.
 *
 * These tests are about the stylesheet and the rendered markup, so a
 * change that reintroduces one of them fails here.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOARD_SRC = join(ROOT, "src", "board.ts");
const HTML_SRC = join(ROOT, "src", "html.ts");

const env = {
  SITE_URL: "https://toolswanted.dev",
  SITE_NAME: "Tools Wanted",
} as never;

/**
 * A stub D1. The weekly page reads the board, so it needs a database.
 */
function stubDb() {
  const stmt = (sql: string) => {
    const all = () => ({ results: [] });
    return {
      all,
      bind: () => ({
        all,
        first: async () => null,
        run: async () => ({ meta: { changes: 0 } }),
      }),
      first: async () => null,
      run: async () => ({ meta: { changes: 0 } }),
    };
  };
  return { prepare: stmt, batch: async () => [], exec: async () => ({}) };
}

const weeklyEnv = { ...(env as object), DB: stubDb() } as never;

/* ------------------------------------------------------------------ *
 * The stylesheet
 * ------------------------------------------------------------------ */

describe("the stylesheet", () => {
  it("sets no type below the 12px floor", () => {
    // A code block is 13px and the inline rule used to be .92em of it,
    // which is 11.96px. Nothing is allowed under 12px.
    const sizes = [...CSS.matchAll(/font-size:\s*([0-9.]+)px/g)].map((m) => parseFloat(m[1]!));
    const under = sizes.filter((s) => s < 12);
    expect(under).toEqual([]);
  });

  it("does not use an em font size that can land under the floor", () => {
    // An em size is relative, so it can only be checked at the value it
    // resolves to. The only em size in the sheet was .92em on a 13px
    // base, which resolved to 11.96px.
    const ems = [...CSS.matchAll(/font-size:\s*([0-9.]+)em/g)].map((m) => parseFloat(m[1]!));
    for (const em of ems) {
      // The smallest base any em size can sit on is 12px.
      expect(em * 12).toBeGreaterThanOrEqual(12);
    }
  });

  it("wraps the top nav into a grid on a narrow screen", () => {
    // The nav was a horizontal scroller: 505px of links in a 288px
    // space, so "File a wish" and "About" were off the right edge with
    // nothing but a fade to say so.
    const narrow = CSS.slice(CSS.indexOf("@media (max-width:760px)"));
    expect(narrow).toMatch(/grid-template-columns/);
  });

  it("does not clip the nav with a scroll container", () => {
    expect(CSS).not.toMatch(/\.top nav\{[^}]*overflow-x:auto/);
  });

  it("gives the copy button a 44px touch target", () => {
    expect(CSS).toMatch(/\.copybtn\{[^}]*min-height:44px/);
  });

  it("gives the buttons a 44px touch target", () => {
    expect(CSS).toMatch(/\.btn\{[^}]*min-height:44px/);
  });

  it("gives the filter chips a 44px touch target", () => {
    expect(CSS).toMatch(/\.chip\{[^}]*min-height:44px/);
  });

  it("lays the copy button out as a grid beside the code, not over it", () => {
    // The reserved space was a hard-coded 96px and the button on the
    // weekly page is 105px wide, so the code ran under it.
    expect(CSS).toMatch(/\.copyrow pre\{[^}]*grid-template-columns/);
    expect(CSS).not.toMatch(/padding-right:96px/);
  });

  it("keeps every spacing value on the 4px baseline", () => {
    // Borders and the visually-hidden utility are not spacing.
    //
    // The comments are stripped first. The rule below looks for a
    // spacing declaration and then reads forward for a value, and a
    // comment that mentions one, margin-left:auto, is not a
    // declaration: the words after it are prose, and a number in the
    // prose was read as a spacing value.
    const declarations = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    const values = [...declarations.matchAll(/(?:margin|padding|gap)[a-z-]*:\s*([^;{}]+)/g)]
      .flatMap((m) => m[1]!.split(/[\s/]+/))
      .map((v) => v.trim())
      .filter((v) => /^-?\d+(\.\d+)?px$/.test(v))
      .map((v) => parseFloat(v));
    const off = values.filter((v) => v !== 0 && v % 4 !== 0);
    expect(off).toEqual([]);
  });

  it("does not shrink the logo below the size where the red passes AA", () => {
    // The logo was 17px on a phone. The red is #d32a1c on #f3eee1, which
    // is 4.4:1 at that size: under the 4.5:1 threshold for body text.
    // The wordmark fits at 19px in 288px, so it does not need to shrink.
    const narrow = CSS.slice(CSS.indexOf("@media (max-width:760px)"));
    const logo = narrow.match(/\.logo\{[^}]*\}/);
    expect(logo).toBeTruthy();
    const size = parseFloat(logo![0]!.match(/font-size:\s*([0-9.]+)px/)![1]!);
    expect(size).toBeGreaterThanOrEqual(19);
  });

  it("keeps the red of the logo above the body text threshold", () => {
    // #d32a1c on #f3eee1. At 19px and 700 weight it is large text and
    // needs 3:1; at anything under 18.66px it is body text and needs
    // 4.5:1. The measured ratio is 4.4:1, so the size is the part that
    // has to hold.
    const ratio = 4.4;
    const logo = CSS.match(/\.logo\{[^}]*font-size:\s*([0-9.]+)px/);
    expect(logo).toBeTruthy();
    const size = parseFloat(logo![1]!);
    const large = size >= 24 || (size >= 18.66 && true);
    expect(large ? ratio >= 3 : ratio >= 4.5).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * The rendered pages
 * ------------------------------------------------------------------ */

describe("every code block", () => {
  const pages: Array<[string, string]> = [
    ["the wish form", renderWishForm(env)],
    ["the build page", renderBuild(env, "read-uk-council-planning-pdfs-as-structured-data")],
    ["the agents page", renderAgents(env)],
  ];

  for (const [name, html] of pages) {
    it(`on ${name} has a copy button inside the block it copies`, () => {
      const pres = html.match(/<pre\b[^>]*>/g) ?? [];
      const buttons = html.match(/class="copybtn"/g) ?? [];
      expect(pres.length).toBeGreaterThan(0);
      expect(buttons.length).toBe(pres.length);
      // The button is a child of the pre, so the block reads as one shape
      // and the code cannot run under the control.
      const inPre = html.match(/<pre\b[^>]*>(?:(?!<\/pre>).)*class="copybtn"/gs) ?? [];
      expect(inPre.length).toBe(pres.length);
    });
  }
});

describe("the wish form", () => {
  it("gives the POST snippet as a command that runs", () => {
    // The snippet was "POST https://.../api/wish" on one line and a bare
    // JSON object on the next. Pasting it produced neither a request nor
    // valid JSON.
    const html = renderWishForm(env);
    expect(html).toContain("curl -sS -X POST https://toolswanted.dev/api/wish");
    expect(html).not.toContain('POST https://toolswanted.dev/api/wish\n{');
  });

  it("does not print a raw POST line with a JSON body under it", () => {
    const html = renderWishForm(env);
    const m = html.match(/data-copy="([^"]*api\/wish[^"]*)"/);
    expect(m).toBeTruthy();
    const snippet = m![1]!.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    expect(snippet).toMatch(/^curl /);
  });
});

describe("the weekly page", () => {
  it("does not use an em dash in the body copy", async () => {
    // The house voice bans them outright.
    const html = await renderWeekly(weeklyEnv);
    const body = html.slice(html.indexOf("<h1>"), html.indexOf("<footer"));
    expect(body).not.toContain("—");
  });

  it("gives the badge snippet a copy button labelled for what it does", async () => {
    const html = await renderWeekly(weeklyEnv);
    expect(html).toContain('data-label="Copy badge"');
  });
});

describe("pluralisation", () => {
  it("uses the singular for one", () => {
    expect(plural(1, "cluster", "clusters")).toBe("cluster");
    expect(plural(0, "cluster", "clusters")).toBe("clusters");
    expect(plural(2, "cluster", "clusters")).toBe("clusters");
  });

  it("does not say '1 clusters' on the board", () => {
    const src = readFileSync(BOARD_SRC, "utf8");
    // The count is rendered through plural() rather than a bare noun.
    expect(src).toContain('plural(stats.clusters, "cluster", "clusters")');
  });

  it("does not say '1 agents' in the board hero", () => {
    const src = readFileSync(BOARD_SRC, "utf8");
    expect(src).toContain('plural(stats.agents, "agent", "agents")');
  });
});

describe("the prose pages", () => {
  it("do not use an em dash in the body copy", () => {
    for (const html of [renderAbout(env), renderPrivacy(env), renderAgents(env)]) {
      const body = html.slice(html.indexOf("<h1>"), html.indexOf("<footer"));
      expect(body).not.toContain("—");
    }
  });
});

describe("the top bar", () => {
  it("keeps the wordmark's space", () => {
    // The logo was made a flex container to give it a 44px touch target
    // and the space between "Tools" and "Wanted" collapsed, so the
    // wordmark read TOOLSWANTED.
    const src = readFileSync(HTML_SRC, "utf8");
    expect(src).not.toMatch(/\.logo\{[^}]*display:inline-flex/);
  });

  it("marks the current page for assistive technology", async () => {
    const html = await renderWeekly(weeklyEnv);
    expect(html).toContain('aria-current="page"');
  });
});
