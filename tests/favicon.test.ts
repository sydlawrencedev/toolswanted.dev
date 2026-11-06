import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * The favicon has to be a W.
 *
 * It was a red "W" in Helvetica Bold, which was not the brand's
 * display face. The fix drew it as a path so it does not depend on a
 * font being present, and the first path traced a letter that read as
 * an X: two top segments at the same height and a crossing at the
 * midpoint, which is the geometry of an X rather than of a W.
 *
 * A favicon is the one piece of the brand a reader sees most often, in
 * the smallest possible size, and it is the only surface where the mark
 * appears with no other context to disambiguate it. A reader who saw
 * the old tab and sees the new one sees a different letter.
 *
 * The path now comes from the real Archivo Black glyph outline in
 * `assets/fonts/ArchivoBlack-Regular.ttf`, which the site already
 * ships.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const index = readFileSync(join(ROOT, "src", "index.ts"), "utf8");

/**
 * Rasterise an SVG path on a square tile and report where the ink is.
 *
 * The rows come back as an array of booleans, one per column, true
 * where the path filled the pixel. It is a crude rasteriser and it does
 * not need to be a good one: it only has to tell a W from an X, and
 * those differ by a wide margin.
 */
function renderInk(path: string, size: number): boolean[][] {
  // The path's commands. Only the ones the favicon uses: move, line,
  // horizontal, vertical, close. Each becomes a point or a line.
  const points: Array<[number, number]> = [];
  let cursor: [number, number] = [0, 0];
  let start: [number, number] = [0, 0];

  const tokens = path.match(/[MLHVZmlhvz]|-?\d+(?:\.\d+)?/g) ?? [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    const n = (k: number) => Number(tokens[i + k]);
    if (cmd === "M") {
      cursor = [n(0), n(1)];
      start = cursor;
      points.push(cursor);
      i += 2;
    } else if (cmd === "L") {
      cursor = [n(0), n(1)];
      points.push(cursor);
      i += 2;
    } else if (cmd === "H") {
      cursor = [n(0), cursor[1]];
      points.push(cursor);
      i += 1;
    } else if (cmd === "V") {
      cursor = [cursor[0], n(0)];
      points.push(cursor);
      i += 1;
    } else if (cmd === "Z" || cmd === "z") {
      points.push(start);
      cursor = start;
    }
  }

  // Fill the polygon with a scanline test at the middle of each row.
  const rows: boolean[][] = [];
  const scale = size / 64;
  for (let y = 0; y < size; y++) {
    const py = (y + 0.5) / scale;
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) / scale;
      let inside = false;
      for (let a = 0, b = points.length - 1; a < points.length; b = a++) {
        const [ax, ay] = points[a]!;
        const [bx, by] = points[b]!;
        if (ay > py !== by > py && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) {
          inside = !inside;
        }
      }
      row.push(inside);
    }
    rows.push(row);
  }
  return rows;
}

describe("the favicon", () => {
  it("is drawn as a path, so it does not depend on a font being present", () => {
    // It used to be a `<text>` element in Helvetica. A tab icon is
    // rendered by whatever the browser has, and the site's display face
    // is not guaranteed to be there.
    //
    // The check is on the favicon's own markup. The badges use text on
    // purpose: they are wider than a square and are read by a browser
    // rather than by an eye, so their letterforms are a different
    // decision.
    const faviconBlock = index.slice(index.indexOf("const FAVICON_PATH"));
    const faviconMarkup = faviconBlock.slice(0, faviconBlock.indexOf("const FAVICON ="));
    expect(faviconMarkup).not.toMatch(/<text/);

    const favicon = index.slice(index.indexOf("const FAVICON ="));
    expect(favicon.slice(0, favicon.indexOf("const FAVICON_DARK"))).toMatch(
      /<path d="\$\{FAVICON_PATH\}"/
    );
  });
  it("is the real Archivo Black W, not a hand-written approximation", () => {
    // The path is the glyph outline from the font file that is already
    // in the repo, scaled to a 50px width on the 64px grid.
    const path = index.match(/FAVICON_PATH\s*=\s*\n?\s*"([^"]+)"/)?.[1];
    expect(path, "the favicon path constant was not found").toBeTruthy();

    // The check that matters is not the shape of the numbers. It is
    // whether the path, rendered, is a W.
    //
    // The first attempt traced a letter that read as an X: two top
    // segments at the same height and a crossing at the midpoint. So
    // the test renders the path and measures the ink.
    //
    // A W and an X differ in where the ink is at the bottom. A W's
    // outer strokes lean inwards, so its feet are in the middle of the
    // tile and the outer columns are empty at the baseline. An X's
    // strokes lean outwards, so its feet are at the outer columns.
    //
    // The baseline is not the last row of the tile. The glyph's cap
    // height sits inside it, so the row with the most ink near the
    // bottom is the baseline.
    const ink = renderInk(path!, 64);
    const bottom = ink.reduce((best, row, y) =>
      y > 48 && row.filter(Boolean).length > best.row.filter(Boolean).length ? { y, row } : best,
    { y: 0, row: ink[0]! });
    const edgeInk = bottom.row.filter((_, x) => x < 12 || x > 51).filter(Boolean).length;
    const middleInk = bottom.row.filter((_, x) => x >= 20 && x <= 43).filter(Boolean).length;

    // A W's feet are in the middle and its outer edges are clear.
    expect(edgeInk, "the baseline has ink at the outer edges, so this is an X").toBe(0);
    expect(middleInk, "the baseline has no ink in the middle, so this is not a W").toBeGreaterThan(0);

    // And the top row has ink at both outer shoulders, which is what
    // makes it a W and not an M or a V.
    const top = ink[Math.floor(64 * 0.34)]!;
    expect(top[10]).toBe(true);
    expect(top[53]).toBe(true);
  });

  it("has a light and a dark variant", () => {
    // A browser's tab strip can be light or dark. The tile has to work
    // on both, and there was one variant, so a browser on a dark tab
    // strip was looking at an ink tile on an ink strip.
    expect(index).toMatch(/const FAVICON_DARK/);
    expect(index).toMatch(/FAVICON_DARK : FAVICON|FAVICON_DARK\)/);
  });

  it("is linked under prefers-color-scheme: dark", () => {
    const html = readFileSync(join(ROOT, "src", "html.ts"), "utf8");
    expect(html).toMatch(/favicon\.svg\?scheme=dark[^>]*prefers-color-scheme: dark/);
  });
});
