/**
 * The copy buttons.
 *
 * Every snippet on this product exists to be pasted somewhere, so every
 * snippet has a button. The button is only worth having if it copies the
 * right text: a button that copies the wrong block is worse than no
 * button, because the person pastes it and finds out later.
 *
 * This clicks every button on every page and reads the clipboard back.
 */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "https://toolswanted.dev";
const PAGES = [
  "/",
  "/weekly",
  "/agents",
  "/build",
  "/wish",
  "/about",
  "/privacy",
];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();

let total = 0;
let failed = 0;

for (const path of PAGES) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load").catch(() => {});

  const buttons = await page.$$(".copybtn");
  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    // The text the button claims to copy.
    const want = await btn.getAttribute("data-copy");
    // The text actually in the block it sits in.
    const inBlock = await btn.evaluate((el) => {
      const pre = el.closest("pre");
      const code = pre?.querySelector("code");
      return code?.textContent ?? null;
    });

    await btn.click();
    await page.waitForTimeout(220);
    const got = await page.evaluate(() => navigator.clipboard.readText());
    const label = await btn.textContent();

    total++;
    const problems = [];
    if (got !== want) problems.push(`clipboard != data-copy`);
    if (inBlock !== null && inBlock !== want) {
      problems.push(`data-copy != the code in the block`);
    }
    if (label !== "Copied") problems.push(`label is "${label}"`);
    if (problems.length) {
      failed++;
      console.log(`  FAIL ${path} button ${i}: ${problems.join("; ")}`);
      console.log(`       want: ${JSON.stringify(want?.slice(0, 60))}`);
      console.log(`       got:  ${JSON.stringify(got.slice(0, 60))}`);
    }
  }
  console.log(`${path.padEnd(10)} ${buttons.length} copy buttons`);
}

await browser.close();

console.log(`\n${total - failed}/${total} copy buttons copied their own block.`);
if (failed > 0) process.exit(1);
