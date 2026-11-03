import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { CSS } from "../src/html";

/**
 * The touch target standard the project records:
 *
 *   Every standalone control is at least 44px tall: the nav links, the
 *   buttons, the filter chips, the copy button, the client select, the
 *   footer links and the form fields.
 *
 * The 44px treatment for the nav links was written inside the
 * `max-width:760px` media query, so on every screen wider than a phone
 * the nav links were 34px tall. A tablet or a desktop is not a smaller
 * target than a phone.
 *
 * These tests read the stylesheet, because the size of a link is a
 * layout question and the stylesheet is where the answer lives. The
 * browser check in scripts/audit-browser.mjs measures the rendered
 * result at 320, 390, 768 and 1280px.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The rules that apply to a selector, from the stylesheet, with the
 * media queries resolved for a given viewport width.
 *
 * The stylesheet is hand written and flat: a list of rules, with
 * `@media (max-width:Npx)` blocks around some of them. This walks it
 * once, recording each rule with the media query it sits in.
 */
type Rule = { query: number | null; selector: string; body: string };

function parseInto(css: string, query: number | null, out: Rule[]): void {
  let i = 0;

  const readUntilBrace = (from: number): number => {
    let j = from;
    while (j < css.length && css[j] !== "{") j++;
    return j;
  };
  const matchBrace = (from: number): number => {
    let j = from;
    let d = 1;
    while (j < css.length && d > 0) {
      if (css[j] === "{") d++;
      else if (css[j] === "}") d--;
      j++;
    }
    return j;
  };

  while (i < css.length) {
    // Skip whitespace and stray semicolons.
    if (/\s|;/.test(css[i]!)) {
      i++;
      continue;
    }

    if (css[i] === "@") {
      const brace = readUntilBrace(i);
      const prelude = css.slice(i, brace);
      const mm = prelude.match(/max-width:\s*(\d+)px/);
      const end = matchBrace(brace + 1);
      if (mm) {
        // The rules inside the block belong to this media query.
        parseInto(css.slice(brace + 1, end - 1), Number(mm[1]), out);
      }
      i = end;
      continue;
    }

    // A plain rule: selector, then a body.
    const brace = readUntilBrace(i);
    const selector = css.slice(i, brace).trim();
    const end = matchBrace(brace + 1);
    const body = css.slice(brace + 1, end - 1);
    if (selector) out.push({ query, selector, body });
    i = end;
  }
}

const RULES: Rule[] = [];
parseInto(CSS.replace(/\/\*[\s\S]*?\*\//g, ""), null, RULES);

function rulesFor(selector: string, width: number): string {
  return RULES.filter(
    (r) =>
      r.selector.includes(selector) &&
      (r.query === null || r.query === undefined || width <= r.query)
  )
    .map((r) => `${r.selector} { ${r.body} }`)
    .join("\n");
}

describe("the nav links", () => {
  it("are at least 44px tall on a wide screen", () => {
    // The 44px rule was inside the mobile media query only, so at 1280px
    // the nav links were 34px tall. The browser measured 34px at 768px
    // and at 1280px.
    const rules = rulesFor(".top nav a", 1280);
    expect(rules).toMatch(/min-height:\s*44px/);
  });

  it("are at least 44px tall at the 760px boundary", () => {
    // 760px is inside the mobile query and 761px is outside it. The
    // target has to be the same on both sides of the breakpoint.
    expect(rulesFor(".top nav a", 760)).toMatch(/min-height:\s*44px/);
    expect(rulesFor(".top nav a", 761)).toMatch(/min-height:\s*44px/);
  });

  it("are at least 44px tall on a phone", () => {
    expect(rulesFor(".top nav a", 390)).toMatch(/min-height:\s*44px/);
    expect(rulesFor(".top nav a", 320)).toMatch(/min-height:\s*44px/);
  });

  it("keep the desktop nav a single row", () => {
    // The 44px height must not come from wrapping the nav into a grid
    // on a wide screen. The grid is for the phone.
    const rules = rulesFor(".top nav", 1280);
    expect(rules).not.toMatch(/grid-template-columns/);
  });
});

describe("every standalone control", () => {
  const controls: Array<[string, string]> = [
    [".btn", "the buttons"],
    [".chip", "the filter chips"],
    [".copybtn", "the copy button"],
    [".clientpick select", "the client select"],
    [".foot nav a", "the footer links"],
    [".field", "the form fields"],
  ];

  for (const [selector, name] of controls) {
    it(`gives ${name} a 44px touch target`, () => {
      const rules = rulesFor(selector, 1280);
      expect(rules).toMatch(/min-height:\s*44px/);
    });
  }
});

describe("the top bar height token", () => {
  it("is at least as tall as the bar it measures", () => {
    // The filter bar sticks below the top bar, so the token has to be at
    // least the height of the bar. A token that is smaller lets the
    // filter slide underneath the header.
    const src = readFileSync(join(ROOT, "src", "html.ts"), "utf8");
    const tokens = [...src.matchAll(/--topbar-h:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) {
      // 44px of nav, the logo row, and the padding.
      expect(token).toBeGreaterThanOrEqual(44);
    }
  });
});
