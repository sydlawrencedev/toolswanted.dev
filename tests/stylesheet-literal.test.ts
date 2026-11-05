import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * The stylesheet lives in a template literal, and a backtick in a CSS
 * comment ends it.
 *
 * The result is still valid TypeScript, so `tsc --noEmit` says nothing.
 * The Worker crashes at runtime with a TypeError, and every visitor gets
 * a broken page, because the stylesheet is the one thing every visitor
 * gets.
 *
 * It happened three times while this branch was being built. Each time
 * the failure looked like twenty unrelated test files failing to load,
 * because the rest of `src/html.ts` became JavaScript and stopped
 * parsing. The check that exists in `tests/sticky.test.ts` reads the
 * CSS, so it only runs if the module parsed at all, which means it
 * cannot be the thing that catches this.
 *
 * So the check is here, in a file that imports nothing from the module.
 * It reads the source as text and counts.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("the stylesheet's template literal", () => {
  it("holds no backtick inside the CSS", () => {
    // The CSS literal opens with a backtick and closes with a backtick
    // followed by a semicolon. When the literal is intact, the text
    // between the opener and the closer holds exactly two backticks:
    // the opener and the closer.
    //
    // A backtick in a comment makes it three, and the literal ended
    // there instead.
    const src = readFileSync(join(ROOT, "src", "html.ts"), "utf8");
    const opener = src.indexOf("export const CSS = `");
    expect(opener).toBeGreaterThan(-1);

    // The closer is the first backtick that is followed by a semicolon.
    const close = src.slice(opener).search(/`;/);
    expect(close).toBeGreaterThan(-1);

    const region = src.slice(opener, opener + close + 2);
    const backticks = region.match(/`/g) ?? [];
    expect(backticks.length).toBe(2);
  });

  it("holds no backtick inside the inline script literals either", () => {
    // The two script blocks are template literals too, and a backtick
    // in either of them breaks the page's JavaScript in the same way.
    const src = readFileSync(join(ROOT, "src", "html.ts"), "utf8");
    for (const name of ["STICKY_SCRIPT", "COPY_SCRIPT"]) {
      const opener = src.indexOf(`export const ${name} = \``);
      if (opener < 0) continue;
      const close = src.slice(opener).search(/`;/);
      expect(close, `${name} has no closing backtick`).toBeGreaterThan(-1);
      const region = src.slice(opener, opener + close + 2);
      const backticks = region.match(/`/g) ?? [];
      expect(backticks.length, `${name} holds a backtick`).toBe(2);
    }
  });
});
