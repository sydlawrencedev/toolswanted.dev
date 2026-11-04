// Counts the visible words of each page the way a reader counts them.
//
// The page copy is everything inside <main>, with the nav and the footer
// held out because they are the same on every page. The copy-paste
// instructions are held in their own column: they are instructions, and
// counting them as prose flatters the prose.
//
// Usage: node scripts/count-words.mjs [baseUrl]
import { chromium } from "playwright";

const base = process.argv[2] || "http://localhost:8787";
const paths = ["/", "/about", "/agents", "/build", "/weekly"];

const browser = await chromium.launch();
const page = await browser.newPage();
const rows = [];

for (const p of paths) {
  // The remote dev server proxies through Cloudflare's edge with a 4 hour
  // TTL, so a plain fetch can serve a stale copy of the page. The query
  // string and the cache headers are what make the count honest.
  await page.goto(`${base}${p}?nocache=${Date.now()}`, { waitUntil: "networkidle" });
  const r = await page.evaluate(() => {
    const isVisible = (el) => {
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") return false;
      if (Number(st.opacity) === 0) return false;
      if (el.getAttribute("aria-hidden") === "true") return false;
      if (el.closest("[hidden]")) return false;
      return true;
    };
    const textOf = (root) => {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n;
      let out = "";
      while ((n = w.nextNode())) {
        const el = n.parentElement;
        if (!el || !isVisible(el)) continue;
        if (el.closest("script, style, template, [aria-hidden='true']")) continue;
        out += " " + n.nodeValue;
      }
      return out;
    };
    const wc = (t) =>
      t
        .split(/\s+/)
        .map((x) => x.replace(/[^\w'’·%/.#-]/g, ""))
        .filter((x) => x.length).length;

    const main = document.querySelector("main") || document.body;
    const nav = document.querySelector("header, nav");
    const foot = document.querySelector("footer");
    const bodyText = textOf(main);
    // Only the outermost code elements, so a <code> inside a <pre> is not
    // counted twice.
    const codeEls = [...main.querySelectorAll("pre, code")].filter(
      (el) => !el.parentElement?.closest("pre, code")
    );
    const codeText = codeEls.map(textOf).join(" ");
    return {
      page: wc(bodyText),
      prose: wc(bodyText) - wc(codeText),
      code: wc(codeText),
      chrome: wc(textOf(nav || document.createElement("div"))) + wc(textOf(foot || document.createElement("div"))),
    };
  });
  rows.push({ path: p, ...r });
}

await browser.close();
console.table(rows);
console.log(
  "page copy total:",
  rows.reduce((a, b) => a + b.page, 0),
  "| prose only:",
  rows.reduce((a, b) => a + b.prose, 0),
);
