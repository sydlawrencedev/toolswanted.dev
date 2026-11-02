/**
 * Screenshot the board, in light and dark, on desktop and mobile.
 *
 *   node scripts/screenshots.mjs
 */

import { chromium } from "playwright";

const BASE = process.env.WORKER_URL ?? "https://toolswanted.dev";
const OUT = process.env.OUT_DIR ?? "/tmp/tw-shots";

const PAGES = [
  { path: "/", name: "board" },
  { path: "/w/read-uk-council-planning-pdfs-as-structured-data", name: "cluster" },
  { path: "/agents", name: "agents" },
  { path: "/wish", name: "wish" },
  { path: "/weekly", name: "weekly" },
];

const browser = await chromium.launch({ channel: "chrome" });

for (const scheme of ["light", "dark"]) {
  for (const viewport of [
    { width: 1280, height: 1000, tag: "desktop" },
    { width: 390, height: 844, tag: "mobile" },
  ]) {
    const context = await browser.newContext({
      colorScheme: scheme,
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    for (const target of PAGES) {
      await page.goto(`${BASE}${target.path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      const file = `${OUT}/${target.name}-${scheme}-${viewport.tag}.png`;
      await page.screenshot({ path: file, fullPage: viewport.tag === "desktop" });
      console.log(file);
    }
    await context.close();
  }
}

await browser.close();
