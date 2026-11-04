import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSS = readFileSync(join(ROOT, "src", "html.ts"), "utf8");

/**
 * The nav grid.
 *
 * It used to be three columns of one fraction each, so every link claimed
 * a third of the bar. At 760px "BOARD" sat in a 480px black box with 400px
 * of nothing beside it, and the links spread further apart as the window
 * narrowed. It read as the navbar growing.
 *
 * The columns are content sized now, so the links sit next to each other
 * and the slack is at the end of the row.
 */

function mediaBlock(query: string): string {
  const at = CSS.indexOf(`@media (${query})`);
  if (at < 0) throw new Error(`no media query for ${query}`);
  // The block ends at the first closing brace at the same nesting depth.
  let depth = 0;
  for (let i = at; i < CSS.length; i++) {
    if (CSS[i] === "{") depth++;
    else if (CSS[i] === "}") {
      depth--;
      if (depth === 0) return CSS.slice(at, i + 1);
    }
  }
  throw new Error(`unterminated media query for ${query}`);
}

describe("the nav grid", () => {
  it("sizes its columns to their content, not to a fraction of the bar", () => {
    const block = mediaBlock("max-width:760px");
    expect(block).toContain("grid-template-columns:repeat(3,auto)");
    expect(block).not.toContain("repeat(3,1fr)");
  });

  it("does the same at the two column breakpoint", () => {
    const block = mediaBlock("max-width:380px");
    expect(block).toContain("grid-template-columns:repeat(2,auto)");
    expect(block).not.toContain("repeat(2,1fr)");
  });

  it("leaves the slack at the end of the row", () => {
    const block = mediaBlock("max-width:760px");
    expect(block).toContain("justify-content:start");
  });

  it("left-aligns the links rather than centring them in their column", () => {
    const block = mediaBlock("max-width:760px");
    expect(block).toContain("text-align:left");
    expect(block).not.toContain("text-align:center");
  });

  it("pads the current page so the filled block fits its label", () => {
    // The active link is a filled block. With the label centred in a wide
    // column the block read as a huge empty box, so it carries its own
    // horizontal padding instead.
    const block = mediaBlock("max-width:760px");
    expect(block).toMatch(/a\[aria-current="page"\]\{[^}]*padding-left/);
  });
});

describe("the top bar height", () => {
  it("has a first-paint value for each breakpoint", () => {
    // The bar's height is measured by a script and written back into the
    // token. The token in the stylesheet is the first-paint value, and it
    // has to be right, because the script measures whatever the stylesheet
    // produced.
    expect(mediaBlock("max-width:760px")).toContain("--topbar-h:");
    expect(mediaBlock("max-width:380px")).toContain("--topbar-h:");
  });

  it("does not drive the bar's own height from the token", () => {
    // It used to. The bar's height came from the token, and the token was
    // the bar's height, so the measurement settled on whatever it was at
    // the moment it ran and the filter bar stuck inside the header.
    const wrapRule = CSS.match(/\.top \.wrap\{[^}]*\}/);
    expect(wrapRule).toBeTruthy();
    expect(wrapRule![0]).not.toContain("var(--topbar-h)");
  });
});
