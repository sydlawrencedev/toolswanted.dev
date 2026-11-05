import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { CSS } from "../src/html";

/**
 * The dark mode chip has to be visible against the dark mode border.
 *
 * The chip is the background of a table header, of a tag, of a copy
 * button on hover, and of the sample block on an entry page. The
 * border is `--line`, which is the line every rule on the page is
 * drawn with. So a chip and a border next to each other are the chip
 * sitting on the line, and the reader's eye has to find the edge
 * between them.
 *
 * In dark mode `--chip` was `#241f1c` and `--line` was `#726859`.
 * That is 2.98:1, which is under the 3:1 that
 * `agents/design-delight/NOTES.md` sets for a UI component boundary.
 *
 * The light mode pair is not affected: `--chip:#e8e1d1` against
 * `--line:#151210` is 14.3:1.
 *
 * These tests parse the values out of the stylesheet and compute the
 * ratio, rather than asserting a hex code. A fix that moves the chip
 * to any value that clears 3:1 passes, and one that does not, fails
 * whatever the hex code is.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HTML_SRC = join(ROOT, "src", "html.ts");

/* ------------------------------------------------------------------ *
 * Contrast
 * ------------------------------------------------------------------ */

/** A hex colour to its relative luminance. */
function luminance(hex: string): number {
  const c = hex.replace("#", "").trim();
  if (c.length !== 6) throw new Error(`not a six digit hex colour: ${hex}`);
  const rgb = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const linear = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

/** The contrast ratio between two colours, from 1 to 21. */
function contrast(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/* ------------------------------------------------------------------ *
 * Reading the tokens
 * ------------------------------------------------------------------ */

/**
 * The `--chip` and `--line` values in a block of CSS.
 *
 * The dark mode values are written twice: once under
 * `prefers-color-scheme:dark` and once under `html[data-theme="dark"]`,
 * so the reader can set the theme by hand. Both have to clear 3:1, or
 * a reader who overrides the theme gets a different board.
 */
function darkTokens(css: string): Array<{ chip: string; line: string; where: string }> {
  const blocks: Array<{ text: string; where: string }> = [];

  const dark = css.indexOf("@media (prefers-color-scheme:dark)");
  if (dark >= 0) {
    // The block ends at the first closing brace at the same depth.
    let depth = 0;
    for (let i = dark; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") {
        depth--;
        if (depth === 0) {
          blocks.push({ text: css.slice(dark, i + 1), where: "prefers-color-scheme:dark" });
          break;
        }
      }
    }
  }

  const forced = css.match(/html\[data-theme="dark"\]\s*\{[^}]*\}/);
  if (forced) blocks.push({ text: forced[0], where: 'html[data-theme="dark"]' });

  return blocks.map((b) => {
    const chip = b.text.match(/--chip:\s*(#[0-9a-fA-F]{3,6})/);
    const line = b.text.match(/--line:\s*(#[0-9a-fA-F]{3,6})/);
    if (!chip) throw new Error(`no --chip in the ${b.where} block`);
    if (!line) throw new Error(`no --line in the ${b.where} block`);
    return { chip: chip[1]!, line: line[1]!, where: b.where };
  });
}

/** The light mode values, for the check that they are unaffected. */
function lightTokens(css: string): { chip: string; line: string } {
  const block = css.match(/html\[data-theme="light"\]\s*\{[^}]*\}/);
  if (!block) throw new Error("no html[data-theme=\"light\"] block");
  const chip = block[0].match(/--chip:\s*(#[0-9a-fA-F]{3,6})/);
  const line = block[0].match(/--line:\s*(#[0-9a-fA-F]{3,6})/);
  if (!chip) throw new Error("no --chip in the light block");
  if (!line) throw new Error("no --line in the light block");
  return { chip: chip[1]!, line: line[1]! };
}

describe("the dark mode chip against the dark mode border", () => {
  const tokens = darkTokens(CSS);

  it("finds the dark mode tokens", () => {
    // The guard on the guard. If the parser stopped finding the dark
    // block, every contrast check below would pass on an empty list.
    expect(tokens.length).toBeGreaterThan(0);
  });

  it("clears 3:1 against the border, as the design notes require", () => {
    // The failure this catches: #241f1c against #726859 is 2.98:1, so
    // the chip and the border around it are not distinguishable. The
    // design notes set 3:1 for a UI component boundary.
    for (const t of tokens) {
      expect(contrast(t.chip, t.line), `${t.where}: --chip ${t.chip} on --line ${t.line}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("clears 3:1 in the hand-set theme as well as the system one", () => {
    // The dark values are written twice. A reader who sets the theme
    // by hand gets the second copy, and it has to clear the bar too.
    const forced = tokens.find((t) => t.where.includes("data-theme"));
    expect(forced, "the forced dark theme has its own tokens").toBeTruthy();
    expect(contrast(forced!.chip, forced!.line)).toBeGreaterThanOrEqual(3);
  });
});

describe("the light mode chip against the light mode border", () => {
  it("is unaffected", () => {
    // The other side of the claim. The fix moves the dark chip; it
    // must not break the light one, which was already 14:1.
    const t = lightTokens(CSS);
    expect(contrast(t.chip, t.line)).toBeGreaterThanOrEqual(3);
  });
});

describe("the stylesheet the values came from", () => {
  it("is the one the product serves", () => {
    // The values are parsed out of `src/html.ts`, so the check is
    // against the file the stylesheet is built from. If the stylesheet
    // were served from somewhere else, this would be the wrong file.
    const source = readFileSync(HTML_SRC, "utf8");
    expect(source).toContain("export const CSS = `");
    expect(source).toContain("--chip:");
  });
});
