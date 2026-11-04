// Looks at every changed page in a real browser and reports what a reader
// sees: the rendered text, any horizontal overflow, and the console errors.
// Usage: node scripts/check-pages.mjs [baseUrl]
import { chromium } from "playwright";

const base = process.argv[2] || "http://localhost:8787";
const paths = ["/", "/about", "/agents", "/build", "/weekly", "/wish", "/w/read-uk-council-planning-pdfs-as-structured-data"];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`${page.url()} :: ${m.text()}`);
});
page.on("pageerror", (e) => errors.push(`${page.url()} :: ${e.message}`));

for (const p of paths) {
  await page.goto(`${base}${p}?nocache=${Date.now()}`, { waitUntil: "networkidle" });

  const info = await page.evaluate(() => {
    const doc = document.documentElement;
    const overflow = doc.scrollWidth - doc.clientWidth;
    // any element wider than the viewport
    const wide = [...document.querySelectorAll("main *")]
      .filter((el) => el.getBoundingClientRect().right > doc.clientWidth + 1)
      .map((el) => `${el.tagName}.${el.className}`)
      .slice(0, 5);
    const main = document.querySelector("main");
    return {
      overflow,
      wide,
      mainHeight: main ? Math.round(main.getBoundingClientRect().height) : 0,
      h1: document.querySelector("h1")?.innerText.replace(/\n/g, " "),
      h2s: [...document.querySelectorAll("main h2")].map((h) => h.innerText),
    };
  });

  // mobile pass
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(120);
  const mobile = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      overflow: doc.scrollWidth - doc.clientWidth,
      wide: [...document.querySelectorAll("main *")]
        .filter((el) => el.getBoundingClientRect().right > doc.clientWidth + 1)
        .map((el) => `${el.tagName}.${el.className}`)
        .slice(0, 5),
    };
  });
  await page.setViewportSize({ width: 1280, height: 900 });

  console.log(
    `\n== ${p} ==\n  h1: ${info.h1}\n  h2: ${info.h2s.join(" | ")}\n  desktop overflow: ${info.overflow}px ${info.wide.join(", ")}\n  mobile overflow: ${mobile.overflow}px ${mobile.wide.join(", ")}\n  main height: ${info.mainHeight}px`
  );
}

console.log("\n== console errors ==");
console.log(errors.length ? errors.join("\n") : "none");
await browser.close();
