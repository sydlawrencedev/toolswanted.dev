import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { CSS } from "../src/html";

/**
 * The stylesheet and the markup have to agree.
 *
 * A class in the stylesheet that nothing uses is a rule that has to be
 * read, understood and maintained for no page. A class in the markup
 * that nothing styles is markup that has to be read and maintained for
 * no effect. Both are small, and both add up to the thing that makes a
 * stylesheet hard to change: you cannot tell which parts matter.
 *
 * The design agent's commit added 199 lines to the stylesheet. This is
 * the check that the next 199 lines do not add more.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

/** Every class name used in the markup of the source files. */
function markupClasses(): Set<string> {
  const used = new Set<string>();
  for (const file of readdirSync(SRC)) {
    if (!file.endsWith(".ts")) continue;
    const text = readFileSync(join(SRC, file), "utf8");
    for (const m of text.matchAll(/class="([^"{}]+)"/g)) {
      for (const cls of m[1]!.split(/\s+/)) {
        if (cls && !cls.includes("$") && !cls.includes("{") && !cls.includes("}")) {
          used.add(cls);
        }
      }
    }
  }
  return used;
}

/** Every class name that has a rule in the stylesheet. */
function cssClasses(): Set<string> {
  const css = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const names = new Set<string>();
  for (const m of css.matchAll(/\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g)) {
    names.add(m[1]!);
  }
  return names;
}

describe("the stylesheet", () => {
  it("has no rule for a class nothing uses", () => {
    const used = markupClasses();
    const css = cssClasses();
    // The copy button's "done" state is added by the script, not by the
    // markup, and "new" is the ticker's flash class. Both are real.
    const addedByScript = new Set(["done", "new"]);
    const dead = [...css].filter(
      (c) => !used.has(c) && !addedByScript.has(c) && !c.startsWith("g-")
    );
    expect(dead).toEqual([]);
  });

  it("has no class in the markup that nothing styles", () => {
    const used = markupClasses();
    const css = cssClasses();
    const orphans = [...used].filter((c) => !css.has(c));
    expect(orphans).toEqual([]);
  });
});

describe("the exported helpers", () => {
  it("has no helper in html.ts that nothing calls", () => {
    // An exported function that nothing uses is dead code with a public
    // surface. It has to be found and removed, not left for the next
    // person to wonder about.
    //
    // Only html.ts is checked: the other modules export functions that
    // the scripts and the Worker's entry point use, and those are
    // called from outside src.
    const files = [
      ...readdirSync(SRC)
        .filter((f) => f.endsWith(".ts"))
        .map((f) => ({ name: `src/${f}`, text: readFileSync(join(SRC, f), "utf8") })),
      ...readdirSync(join(ROOT, "tests"))
        .filter((f) => f.endsWith(".ts"))
        .map((f) => ({
          name: `tests/${f}`,
          text: readFileSync(join(ROOT, "tests", f), "utf8"),
        })),
    ];

    const dead: string[] = [];
    for (const { name, text } of files) {
      if (!name.endsWith("html.ts")) continue;
      const exports = [...text.matchAll(/export (?:async )?function (\w+)/g)].map((m) => m[1]!);
      for (const fn of exports) {
        const used = files.some(
          (other) => other.name !== name && new RegExp(`\\b${fn}\\s*\\(`).test(other.text)
        );
        if (!used) dead.push(`${name}: ${fn}`);
      }
    }
    expect(dead).toEqual([]);
  });
});
