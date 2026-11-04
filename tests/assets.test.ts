import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { layout } from "../src/html";

/**
 * The static assets and the browser's cache.
 *
 * The stylesheet was served with a 24 hour max-age and a URL that never
 * changed, so a change to the CSS was invisible to a returning visitor
 * for a whole day. A shift-reload was the only way to see it.
 *
 * That matters here because the page's script and the stylesheet have
 * to agree. The script reads the stylesheet's --topbar-h and only
 * writes its own when the two disagree, so a browser holding the old
 * stylesheet and the new script behaves as though the fix did not land.
 *
 * The version of the deploy goes in the asset's URL, so a deploy
 * changes the URL, the browser asks for the new asset, and the old URL
 * can stay cached for as long as it likes.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const INDEX_SRC = readFileSync(join(ROOT, "src", "index.ts"), "utf8");
const HTML_SRC = readFileSync(join(ROOT, "src", "html.ts"), "utf8");

describe("the stylesheet", () => {
  it("carries the deploy's version, so a deploy changes its URL", () => {
    const html = layout(
      {
        title: "Tools Wanted",
        description: "x",
        canonical: "https://toolswanted.dev/",
        assetVersion: "abc123",
      },
      "",
    );
    expect(html).toContain('href="/style.css?v=abc123"');
    expect(html).toContain('href="/font.css?v=abc123"');
  });

  it("leaves the URL alone when there is no version", () => {
    // Local development has no VERSION_METADATA, and a bare URL is
    // easier to read in a console.
    const html = layout(
      { title: "Tools Wanted", description: "x", canonical: "https://toolswanted.dev/" },
      "",
    );
    expect(html).toContain('href="/style.css"');
  });

  it("is cached for a year, because the URL changes with the deploy", () => {
    // The max-age used to be a day, which was the whole problem: a long
    // cache on a URL that never changes is a long cache on stale CSS.
    const block = INDEX_SRC.slice(INDEX_SRC.indexOf('path === "/style.css"'));
    // The header, not the comment about the old value.
    const header = block.slice(0, 1200).match(/"cache-control":\s*"([^"]+)"/);
    expect(header).toBeTruthy();
    expect(header![1]).toContain("max-age=31536000");
    expect(header![1]).not.toContain("max-age=86400");
  });

  it("is served with the query string intact", () => {
    // The route matches on the pathname, so the version does not stop
    // the stylesheet being found.
    expect(INDEX_SRC).toMatch(/path === "\/style\.css"/);
    expect(INDEX_SRC).toMatch(/path === "\/font\.css"/);
  });

  it("takes the version from the deploy, not from a number in the source", () => {
    expect(HTML_SRC).toMatch(/assetVersion\?/);
    const boardSrc = readFileSync(join(ROOT, "src", "board.ts"), "utf8");
    expect(boardSrc).toMatch(/assetVersion:\s*env\.VERSION_METADATA\?\.id/);
  });
});
