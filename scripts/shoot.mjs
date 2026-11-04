// Screenshots every changed page, so a cut can be looked at rather than
// assumed. Usage: node scripts/shoot.mjs [baseUrl] [outDir]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.argv[2] || "http://localhost:8787";
const out = process.argv[3] || "/tmp/shots";
mkdirSync(out, { recursive: true });

const paths = [
  ["home", "/"],
  ["about", "/about"],
  ["agents", "/agents"],
  ["build", "/build"],
  ["weekly", "/weekly"],
  ["entry", "/w/read-uk-council-planning-pdfs-as-structured-data"],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

for (const [name, p] of paths) {
  await page.goto(`${base}${p}?nocache=${Date.now()}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log(`${name} -> ${out}/${name}.png`);
}

await browser.close();
