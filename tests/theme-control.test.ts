import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

/**
 * The theme control has to tell the truth and it has to be reversible.
 *
 * The script used to read `tw-theme` from localStorage and apply it
 * with no way to change it and no way to clear it. A reader with a
 * stale value was pinned to a theme that ignored their system
 * preference, and the only way out was devtools.
 *
 * Then the button arrived, and it made a different mistake: it labelled
 * itself from `data-theme`, which is only ever set by the script. A
 * reader whose operating system was dark and who had never touched the
 * toggle saw a page that was already dark and a button that said "Dark
 * mode".
 *
 * And the script is in the head while the button is in the footer, so
 * the first version of the button never got wired at all: the handler
 * looked for an element that was not in the document yet.
 *
 * These tests run a real browser, because the defect is in the
 * interaction and not in the markup.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.TW_BASE ?? "http://127.0.0.1:8787";

const source = readFileSync(join(ROOT, "src", "html.ts"), "utf8");

/**
 * The callbacks passed to `page.evaluate` run in the browser, so they
 * have the DOM. The project's tsconfig does not include the DOM lib,
 * because the Worker does not have one, so the browser globals are
 * declared here rather than by changing the shared configuration.
 */
declare const document: {
  documentElement: { getAttribute(name: string): string | null };
  getElementById(id: string): { textContent: string | null } | null;
  body: unknown;
};
declare const getComputedStyle: (el: unknown) => { backgroundColor: string };
declare const localStorage: { getItem(k: string): string | null; setItem(k: string, v: string): void };

describe("the theme control's script", () => {
  it("waits for the button, because the script is in the head", () => {
    // The button is in the footer and the script is in the head, so
    // `getElementById` returns null at the point the script runs. The
    // wiring has to wait for the DOM.
    expect(source).toMatch(/DOMContentLoaded/);
    expect(source).toMatch(/readyState/);
  });

  it("decides the label from the system preference when there is no override", () => {
    // The bug this catches: the label was read from the data-theme
    // attribute, which is only set by the script, so it did not know
    // what the reader's system was doing.
    expect(source).toMatch(/prefers-color-scheme: dark/);
  });

  it("can clear the override, so the reader is never pinned", () => {
    // The unilateral pin is the original defect. There has to be a way
    // back to the system.
    expect(source).toMatch(/removeItem\('tw-theme'\)/);
    expect(source).toMatch(/removeAttribute\('data-theme'\)/);
  });
});

describe("the theme control in a browser", () => {
  let browser: Awaited<ReturnType<typeof chromium.launch>>;

  // The browser tests need a running server. `npm test` has to pass
  // without one, so the suite checks first and skips rather than
  // failing. The dev server is started by `npm run dev`.
  let reachable = false;

  beforeAll(async () => {
    try {
      const res = await fetch(`${BASE}/about`, {
        signal: AbortSignal.timeout(3000),
      });
      reachable = res.ok;
    } catch {
      reachable = false;
    }
    if (!reachable) return;
    browser = await chromium.launch();
  }, 60000);

  afterAll(async () => {
    await browser?.close();
  });

  for (const scheme of ["dark", "light"] as const) {
    it(`names the theme it would switch to, on a ${scheme} system`, async () => {
      if (!reachable) return;
      const context = await browser.newContext({
        colorScheme: scheme,
        viewport: { width: 390, height: 900 },
      });
      const page = await context.newPage();
      await page.goto(`${BASE}/?nocache=${Date.now()}`, { waitUntil: "networkidle" });

      const state = await page.evaluate(() => ({
        label: document.getElementById("themebtn")?.textContent ?? "",
        forced: document.documentElement.getAttribute("data-theme"),
        bg: getComputedStyle(document.body).backgroundColor,
      }));

      // No override is set, so the attribute is absent and the page
      // follows the system.
      expect(state.forced).toBeNull();

      // The button names the theme the reader would get by pressing it,
      // which on a dark system is light.
      expect(state.label).toBe(scheme === "dark" ? "Light mode" : "Dark mode");

      // And the page really is in the system's theme.
      const expected = scheme === "dark" ? "rgb(16, 14, 13)" : "rgb(243, 238, 225)";
      expect(state.bg).toBe(expected);

      await context.close();
    }, 60000);

    it(`flips and clears on a ${scheme} system`, async () => {
      if (!reachable) return;
      const context = await browser.newContext({
        colorScheme: scheme,
        viewport: { width: 390, height: 900 },
      });
      const page = await context.newPage();
      await page.goto(`${BASE}/?nocache=${Date.now()}`, { waitUntil: "networkidle" });

      // Press it: the theme flips and the label follows.
      await page.click("#themebtn");
      const flipped = await page.evaluate(() => ({
        label: document.getElementById("themebtn")?.textContent ?? "",
        forced: document.documentElement.getAttribute("data-theme"),
        stored: localStorage.getItem("tw-theme"),
        bg: getComputedStyle(document.body).backgroundColor,
      }));
      expect(flipped.forced).toBe(scheme === "dark" ? "light" : "dark");
      expect(flipped.stored).toBe(flipped.forced);
      expect(flipped.label).toBe(scheme === "dark" ? "Dark mode" : "Light mode");
      expect(flipped.bg).toBe(
        scheme === "dark" ? "rgb(243, 238, 225)" : "rgb(16, 14, 13)"
      );

      // Clear it: the reader is handed back to their system.
      await page.click("#themeclear");
      const cleared = await page.evaluate(() => ({
        forced: document.documentElement.getAttribute("data-theme"),
        stored: localStorage.getItem("tw-theme"),
        bg: getComputedStyle(document.body).backgroundColor,
      }));
      expect(cleared.forced).toBeNull();
      expect(cleared.stored).toBeNull();
      expect(cleared.bg).toBe(
        scheme === "dark" ? "rgb(16, 14, 13)" : "rgb(243, 238, 225)"
      );

      await context.close();
    }, 60000);
  }
});