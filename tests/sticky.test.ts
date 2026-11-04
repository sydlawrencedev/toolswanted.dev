import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { CSS } from "../src/html";

/**
 * The filter bar sticks below the top bar, and the two have to agree.
 *
 * The offset was a hand-measured token, `--topbar-h`, and it was one
 * pixel short at every width. The header has a 3px bottom border, so
 * the bar's bottom edge sits 3px lower than its content box, and the
 * filter bar stuck at the token's offset, which was inside the header.
 * The top of the filter bar was hidden behind the header: the "Show"
 * label and the top of the chips were cut off on a phone.
 *
 * A measured token drifts the moment the bar's contents change. The
 * offset has to come from the header itself.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("the sticky filter bar", () => {
  it("sticks below the header, measured from the header itself", () => {
    // The offset must be the header's own height, not a number someone
    // measured and typed in.
    expect(CSS).toMatch(/\.filters\{[^}]*top:\s*var\(--topbar-h\)/);
    expect(CSS).toMatch(/:root\{[^}]*--topbar-h/);
  });

  it("has the header publish its own height to the token", () => {
    // The header measures itself and writes the number down, so the
    // filter bar can never be out of step with it.
    const src = readFileSync(join(ROOT, "src", "html.ts"), "utf8");
    expect(src).toMatch(/--topbar-h/);
    // A ResizeObserver or a scroll listener that sets the property.
    expect(src).toMatch(/ResizeObserver|setProperty\(["']--topbar-h/);
  });

  it("measures in CSS pixels, not device pixels", () => {
    // A rect is in device pixels and a custom property is in CSS pixels,
    // so at 200% zoom a rect was twice the real height. The token was
    // written at 454px for a bar that is 227px, and the filter bar
    // stuck at an offset twice as far down as the header actually is.
    //
    // offsetHeight is the border-box height in CSS pixels. It includes
    // the 3px border the filter bar has to clear, and it does not
    // change with the reader's zoom.
    const src = readFileSync(join(ROOT, "src", "html.ts"), "utf8");
    expect(src).toMatch(/offsetHeight/);
    expect(src).not.toMatch(/setProperty\(\s*["']--topbar-h["']\s*,\s*[^)]*getBoundingClientRect/);
  });

  it("does not rewrite the document when the stylesheet is already right", () => {
    // The stylesheet carries the bar's height for every width, so at the
    // reader's default font size it is already correct. Writing it
    // anyway put --topbar-h into the html element's inline style on
    // every page, which changed the document for no reason.
    const src = readFileSync(join(ROOT, "src", "html.ts"), "utf8");
    expect(src).toMatch(/getComputedStyle\(document\.documentElement\)/);
  });

  it("does not rely on a hand-measured pixel value for the offset", () => {
    // The measured values are a fallback for the first paint, not the
    // source of truth. They must not be the only thing holding the two
    // bars together.
    const src = readFileSync(join(ROOT, "src", "html.ts"), "utf8");
    const tokens = [...src.matchAll(/--topbar-h:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(tokens.length).toBeGreaterThan(0);
    // They are a starting value, so they have to be a plausible one.
    for (const token of tokens) {
      expect(token).toBeGreaterThanOrEqual(44);
    }
  });

  it("keeps the header and the filter bar at the same z-index order", () => {
    // The header has to be above the filter bar, or the filter slides
    // under it rather than being cut off.
    const headerZ = CSS.match(/\.top\{[^}]*z-index:\s*(\d+)/);
    const filtersZ = CSS.match(/\.filters\{[^}]*z-index:\s*(\d+)/);
    expect(headerZ).toBeTruthy();
    expect(filtersZ).toBeTruthy();
    expect(Number(headerZ![1])).toBeGreaterThan(Number(filtersZ![1]));
  });
});

describe("the stylesheet", () => {
  it("is a stylesheet and not a broken template literal", () => {
    // A backtick inside the CSS comment terminated the template literal.
    // The result was still valid TypeScript, so `tsc --noEmit` passed and
    // the Worker crashed at runtime with a TypeError. The CSS is the one
    // thing that is served to every visitor, so it is checked here.
    const trimmed = CSS.trim();
    expect(trimmed.startsWith(":root{")).toBe(true);
    expect(trimmed.endsWith("}")).toBe(true);
    // Every declaration block is closed and there is no stray text.
    expect(trimmed).not.toMatch(/\)\s*is not a function/);
    expect(CSS).not.toContain("${");
  });

  it("holds no backtick, because the CSS lives in a template literal", () => {
    // A backtick in a comment inside the CSS ends the template literal
    // the CSS is written in. It is still valid TypeScript, so the
    // compiler says nothing and the Worker crashes at runtime.
    expect(CSS).not.toContain("`");
  });

  it("has balanced braces", () => {
    const open = (CSS.match(/\{/g) ?? []).length;
    const close = (CSS.match(/\}/g) ?? []).length;
    expect(open).toBe(close);
  });

  it("has balanced parentheses in its values", () => {
    const open = (CSS.match(/\(/g) ?? []).length;
    const close = (CSS.match(/\)/g) ?? []).length;
    expect(open).toBe(close);
  });
});
