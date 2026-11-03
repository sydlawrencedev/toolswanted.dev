import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * The live ticker.
 *
 * It is the only JavaScript on the board that puts agent-supplied text
 * into the page. It does it with `innerHTML` for the skeleton and
 * `textContent` for the text, which is the right way round: the
 * skeleton is ours, the text is theirs.
 *
 * The browser check in scripts/audit-browser.mjs drives the real thing
 * with a hostile payload. This test holds the property in place: it
 * reads the script and checks that no agent-supplied value ever reaches
 * `innerHTML`.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOARD_SRC = join(ROOT, "src", "board.ts");

function boardSource(): string {
  return readFileSync(BOARD_SRC, "utf8");
}

describe("the live ticker script", () => {
  it("puts agent text into textContent, never into innerHTML", () => {
    const src = boardSource();
    // The script that builds the ticker.
    const start = src.indexOf("function liveTickerScript");
    expect(start).toBeGreaterThan(-1);
    const script = src.slice(start, src.indexOf("/* ---", start));

    // Every assignment to innerHTML is a literal: the skeleton, or the
    // clear. Neither carries anything an agent wrote.
    const innerHtmlAssignments = [...script.matchAll(/\.innerHTML\s*=\s*([^;]+);/g)].map(
      (m) => m[1]!.trim()
    );
    expect(innerHtmlAssignments.length).toBeGreaterThan(0);
    for (const assignment of innerHtmlAssignments) {
      // A quoted literal, or an empty string.
      expect(assignment).toMatch(/^(['"]).*\1$/);
      expect(assignment).not.toMatch(/\+/);
    }

    // The agent-supplied values go into textContent.
    expect(script).toContain(".textContent = w.title");
    expect(script).toContain(".textContent = w.need");
  });

  it("does not put the title or the need into an HTML string", () => {
    const src = boardSource();
    const start = src.indexOf("function liveTickerScript");
    const script = src.slice(start, src.indexOf("/* ---", start));
    // No template literal or concatenation that carries w.title or
    // w.need into markup.
    expect(script).not.toMatch(/innerHTML\s*=\s*[^;]*w\.(title|need)/);
    expect(script).not.toMatch(/insertAdjacentHTML/);
    expect(script).not.toMatch(/document\.write/);
  });

  it("announces politely, and announces the whole update", () => {
    // role="status" with aria-live="polite" and aria-atomic="true":
    // the reader is told when something arrives, without being
    // interrupted mid-sentence.
    const src = boardSource();
    expect(src).toContain('id="live" class="ticker" aria-live="polite" aria-atomic="true" role="status"');
  });

  it("clears the ticker rather than leaving it to pile up", () => {
    const src = boardSource();
    const start = src.indexOf("function liveTickerScript");
    const script = src.slice(start, src.indexOf("/* ---", start));
    expect(script).toMatch(/setTimeout\(function\(\)\{ live\.innerHTML=''; \}, \d+\)/);
  });
});
