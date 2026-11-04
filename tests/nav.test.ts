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
 * That was the first fix. The second one was the same bug on a desktop:
 * the wrap inside the bar was a flex line that could break between the
 * wordmark and the nav, so when they did not both fit the nav dropped to
 * a second row and the bar grew by a whole row. At 1024px and 150% zoom
 * the bar went from 63px to 184px, and the nav, right aligned by
 * margin-left:auto, left a hole under the logo.
 *
 * So the nav is a grid at every width, the number of columns is the
 * browser's to choose, and a track is never narrower than a label needs
 * to stay on one line.
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

function containerBlock(query: string): string {
  const at = CSS.indexOf(`@container (${query})`);
  if (at < 0) throw new Error(`no container query for ${query}`);
  let depth = 0;
  for (let i = at; i < CSS.length; i++) {
    if (CSS[i] === "{") depth++;
    else if (CSS[i] === "}") {
      depth--;
      if (depth === 0) return CSS.slice(at, i + 1);
    }
  }
  throw new Error(`unterminated container query for ${query}`);
}

describe("the nav grid", () => {
  it("sizes its columns to their content, not to a fraction of the bar", () => {
    // The desktop nav. The links sit next to each other and the slack is
    // at the end of the row.
    const navRule = CSS.match(/\.top nav\{[^}]*\}/);
    expect(navRule).toBeTruthy();
    expect(navRule![0]).toContain("grid-template-columns:repeat(6,max-content)");
    expect(navRule![0]).not.toContain("repeat(6,1fr)");
  });

  it("keeps the number of columns fixed, so the bar's height is stable", () => {
    // The columns were the browser's to choose, with auto-fit. That made
    // the number of columns change with every pixel, so the bar was 111px
    // tall at 760px and 223px at 765px and 63px at 810px, and it grew a
    // row and shrank another as the window moved. The number of rows is
    // now a function of the width range, not of the exact width.
    const block = mediaBlock("max-width:760px");
    expect(block).toContain("repeat(3,minmax(0,1fr))");
    // The declaration, not the comment about it.
    expect(block).not.toMatch(/grid-template-columns:[^;}]*auto-fit/);
  });

  it("never lets a track be wider than the space there is", () => {
    // A content sized track is as wide as its label, so three of them
    // need 293px, which a 390px phone at 200% zoom does not have, and
    // the links spilled out of the bar and the page scrolled sideways.
    const block = mediaBlock("max-width:760px");
    expect(block).toMatch(/repeat\(3,minmax\(0,1fr\)\)/);
  });

  it("lets a label break rather than spill out of the bar", () => {
    // The link is a block, not a flex box. As a flex box its label is an
    // anonymous flex item, which does not wrap: the item's minimum width
    // is its content, so the label stayed on one line and ran out of the
    // track and out of the bar.
    const block = mediaBlock("max-width:760px");
    expect(block).toMatch(/\.top nav a\{[^}]*overflow-wrap:anywhere/);
    expect(block).toMatch(/\.top nav a\{[^}]*display:block/);
    expect(block).toMatch(/\.top nav a\{[^}]*white-space:normal/);
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

describe("the bar does not break its line", () => {
  it("is a grid, so the wordmark and the nav cannot land on separate lines", () => {
    // The wrap was display:flex with flex-wrap:wrap. The wordmark and the
    // nav were two items on a breakable flex line, and when they could
    // not both fit the nav was pushed to a second row and the bar grew by
    // a whole row. The nav was right aligned by margin-left:auto, so the
    // dropped nav sat at the right edge and left a hole under the logo.
    //
    // That hole was the "the navbar keeps growing" report.
    const wrapRule = CSS.match(/\.top \.wrap\{[^}]*\}/);
    expect(wrapRule).toBeTruthy();
    expect(wrapRule![0]).toContain("display:grid");
    expect(wrapRule![0]).not.toContain("flex-wrap");
  });

  it("does not hang the nav off the right edge with an auto margin", () => {
    // The auto margin is what let the nav break onto a second line and
    // leave the hole. The nav is right aligned by its grid instead.
    const wrapRule = CSS.match(/\.top \.wrap\{[^}]*\}/);
    expect(wrapRule![0]).not.toContain("margin-left:auto");
    const navRule = CSS.match(/\.top nav\{[^}]*\}/);
    expect(navRule![0]).not.toContain("margin-left:auto");
  });

  it("lets the nav's column shrink, so it never forces the bar wider", () => {
    const wrapRule = CSS.match(/\.top \.wrap\{[^}]*\}/);
    expect(wrapRule![0]).toContain("minmax(0,1fr)");
  });

  it("moves the nav to its own row on purpose, by a container query", () => {
    // A media query cannot do this. The wordmark takes 162px of the bar
    // whatever the window is, so the width the nav has left is not the
    // width of the window. The container query asks the bar.
    const block = containerBlock("max-width:45.5em");
    expect(block).toContain("grid-column:1");
    expect(block).toContain("repeat(3,minmax(0,1fr))");
    // Left aligned, so the hole is not moved to the other side of the bar.
    expect(block).toContain("justify-content:start");
  });

  it("makes the bar one column deep when the nav is on its own row", () => {
    // It was two columns with the nav spanning both. A spanning item
    // does not contribute to the column widths, so the second column
    // collapsed to nothing and the nav was laid out in the width the
    // wordmark's column left over. At 200% zoom on a phone that was
    // 130px for six links, and they spilled out of the bar.
    const block = containerBlock("max-width:45.5em");
    expect(block).toContain(".top .wrap{grid-template-columns:minmax(0,1fr)}");
  });

  it("asks in em, so the break moves with the reader's zoom", () => {
    // The nav needs 56.97em of link font at every zoom level, so a
    // pixel threshold would be wrong for a reader who has zoomed in.
    const block = containerBlock("max-width:45.5em");
    expect(block).toMatch(/max-width:\s*[\d.]+em/);
    expect(CSS).toContain("container-type:inline-size");
  });

  it("does not set the container's own size from inside its own query", () => {
    // A container cannot be styled by a container query about its own
    // size. The row gap is 4px on the wrap for the same reason.
    const wrapRule = CSS.match(/\.top \.wrap\{[^}]*\}/);
    expect(wrapRule![0]).not.toContain("var(--topbar-h)");
    // The gap is the same everywhere, so the bar does not jump as it
    // crosses a breakpoint.
    expect(wrapRule![0]).toContain("gap:4px 16px");
  });

  it("breaks the wordmark rather than truncating it", () => {
    // A wordmark that ends in an ellipsis is not the name of the thing,
    // and "TOOLS WA..." is not a wordmark. Past 1.78x zoom on a 320px
    // phone the wordmark is wider than the screen, so the bar grows a
    // line to hold the two halves rather than the page scrolling
    // sideways.
    const logoRule = CSS.match(/\.logo\{[^}]*\}/);
    expect(logoRule).toBeTruthy();
    expect(logoRule![0]).toContain("white-space:normal");
    expect(logoRule![0]).not.toContain("text-overflow");
  });
});

describe("the top bar height", () => {
  it("has a first-paint value for each breakpoint", () => {
    // The bar's height is measured by a script and written back into the
    // token. The token in the stylesheet is the first-paint value, and it
    // has to be right, because the script measures whatever the stylesheet
    // produced.
    expect(CSS).toMatch(/:root\{[^}]*--topbar-h:\s*\d+px/);
    expect(mediaBlock("max-width:805px")).toContain("--topbar-h:");
    expect(mediaBlock("max-width:384px")).toContain("--topbar-h:");
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
