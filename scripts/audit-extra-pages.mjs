/**
 * The pages the standard audit does not cover.
 *
 * scripts/audit-browser.mjs checks seven pages. The entry page, the
 * weekly snapshot and the 404 are not among them, and they are not the
 * easy ones: the entry page has the widest tables, the notices and the
 * copy button, and the 404 has a form in it.
 *
 * The checks are the same ones the standard audit makes, so the output
 * can be read the same way.
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "https://toolswanted.dev";
const OUT = new URL("../.audit/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const WIDTHS = [320, 390, 768, 1280];
const THEMES = ["light", "dark"];

// The entry pages that exist on the live board, plus the ones that answer
// whatever you ask them.
const PAGES = [
  { path: "/w/read-uk-council-planning-pdfs-as-structured-data", name: "entry" },
  { path: "/w/parse-alert-1-tables", name: "entry-pending" },
  { path: "/weekly/2026-W44", name: "weekly-snapshot" },
  { path: "/nonexistent-page-xyz", name: "notfound" },
  { path: "/build?wish=read-uk-council-planning-pdfs-as-structured-data", name: "build-claimed" },
  { path: "/wish?need=Read+UK+council+planning+PDFs+as+structured+data", name: "wish-result" },
];

function auditPage() {
  const findings = [];
  const de = document.documentElement;

  const parseRgb = (str) => {
    const m = str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(",").map((s) => parseFloat(s));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] === undefined ? 1 : parts[3] };
  };
  const hexToRgb = (hex) => {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
  };
  const lum = ([r, g, b]) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const contrast = (a, b) => {
    const l1 = lum(hexToRgb(a));
    const l2 = lum(hexToRgb(b));
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  const overflow = de.scrollWidth - de.clientWidth;
  if (overflow > 1) {
    findings.push({
      kind: "overflow",
      detail: `document scrollWidth ${de.scrollWidth} > clientWidth ${de.clientWidth}`,
    });
  }

  const vw = de.clientWidth;
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1) {
      const tag = el.tagName.toLowerCase();
      const cls = el.className && typeof el.className === "string" ? `.${el.className.split(" ").join(".")}` : "";
      let p = el.parentElement;
      let inScroller = false;
      while (p && p !== document.body) {
        const ov = getComputedStyle(p).overflowX;
        if (ov === "auto" || ov === "scroll") {
          inScroller = true;
          break;
        }
        p = p.parentElement;
      }
      if (inScroller) continue;
      findings.push({
        kind: "overflow-element",
        detail: `${tag}${cls} right=${Math.round(r.right)} > ${vw}`,
      });
    }
  }

  const h1s = [...document.querySelectorAll("h1")];
  if (h1s.length !== 1) {
    findings.push({ kind: "h1-count", detail: `${h1s.length} h1 elements` });
  }

  const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")];
  let prev = 0;
  for (const h of headings) {
    const level = Number(h.tagName[1]);
    if (prev && level > prev + 1) {
      findings.push({
        kind: "heading-skip",
        detail: `h${prev} -> h${level}: "${(h.textContent || "").trim().slice(0, 50)}"`,
      });
    }
    prev = level;
  }

  const bgOf = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const c = parseRgb(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0.9) return c;
      node = node.parentElement;
    }
    return parseRgb(getComputedStyle(document.body).backgroundColor);
  };
  const seen = new Set();
  for (const el of document.querySelectorAll("body *")) {
    const text = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join("");
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    if (parseFloat(cs.opacity) < 0.5) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const fg = parseRgb(cs.color);
    const bg = bgOf(el);
    if (!fg || !bg) continue;
    const key = `${cs.color}|${bg.r},${bg.g},${bg.b}|${cs.fontSize}|${cs.fontWeight}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const fgHex = "#" + [fg.r, fg.g, fg.b].map((v) => v.toString(16).padStart(2, "0")).join("");
    const bgHex = "#" + [bg.r, bg.g, bg.b].map((v) => v.toString(16).padStart(2, "0")).join("");
    const ratio = contrast(fgHex, bgHex);
    const size = parseFloat(cs.fontSize);
    const weight = Number(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    if (ratio < need) {
      findings.push({
        kind: "contrast",
        detail: `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} ${fgHex} on ${bgHex} = ${ratio.toFixed(2)}:1 (needs ${need}) size=${size} weight=${weight} text="${text.slice(0, 40)}"`,
      });
    }
    if (size < 12) {
      findings.push({ kind: "type-floor", detail: `${el.tagName.toLowerCase()} font-size ${size}px` });
    }
  }

  for (const el of document.querySelectorAll("a, button, select, input")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.height < 44) {
      const inline = getComputedStyle(el).display === "inline";
      if (inline && el.tagName === "A") continue;
      findings.push({
        kind: "touch-target",
        detail: `${el.tagName.toLowerCase()} "${(el.textContent || el.value || "").trim().slice(0, 30)}" height=${Math.round(r.height)}`,
      });
    }
  }

  const nav = document.querySelector(".top nav");
  if (nav) {
    for (const a of nav.querySelectorAll("a")) {
      const r = a.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) {
        findings.push({
          kind: "nav-clipped",
          detail: `"${a.textContent.trim()}" left=${Math.round(r.left)} right=${Math.round(r.right)} vw=${vw}`,
        });
      }
      if (r.width === 0 || r.height === 0) {
        findings.push({ kind: "nav-hidden", detail: `"${a.textContent.trim()}" has no box` });
      }
    }
  }

  for (const btn of document.querySelectorAll(".copybtn")) {
    const pre = btn.closest("pre");
    if (!pre) {
      findings.push({ kind: "copy-outside", detail: "copy button not inside a pre" });
      continue;
    }
    const code = pre.querySelector("code");
    if (!code) {
      findings.push({ kind: "copy-no-code", detail: "pre with a copy button has no code element" });
      continue;
    }
    const b = btn.getBoundingClientRect();
    const c = code.getBoundingClientRect();
    const overlapX = Math.min(b.right, c.right) - Math.max(b.left, c.left);
    const overlapY = Math.min(b.bottom, c.bottom) - Math.max(b.top, c.top);
    if (overlapX > 1 && overlapY > 1) {
      findings.push({
        kind: "copy-overlap",
        detail: `button overlaps code by ${Math.round(overlapX)}x${Math.round(overlapY)}`,
      });
    }
  }

  for (const pre of document.querySelectorAll("pre")) {
    if (!pre.querySelector(".copybtn")) {
      findings.push({
        kind: "pre-no-copy",
        detail: `pre without a copy button: "${(pre.textContent || "").trim().slice(0, 40)}"`,
      });
    }
  }

  return findings;
}

const browser = await chromium.launch();
const all = [];
const consoleErrors = [];

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      colorScheme: theme,
      deviceScaleFactor: 1,
    });
    for (const p of PAGES) {
      const page = await context.newPage();
      const errs = [];
      page.on("console", (m) => {
        if (m.type() === "error") errs.push(m.text());
      });
      page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
      const url = BASE + p.path;
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch((e) => {
        errs.push("goto failed: " + e.message);
        return null;
      });
      if (!res) {
        all.push({ page: p.name, width, theme, findings: [{ kind: "load-failed", detail: errs.join("; ") }] });
        await page.close();
        continue;
      }
      await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {});
      await page.evaluate(() => document.fonts?.ready).catch(() => {});
      const findings = await page.evaluate(auditPage);
      if (errs.length) consoleErrors.push({ page: p.name, width, theme, errs });
      all.push({ page: p.name, width, theme, status: res.status(), findings });
      if (width === 320 && theme === "light") {
        await page.screenshot({ path: `${OUT}extra-${p.name}-320-light.png`, fullPage: true });
      }
      await page.close();
    }
    await context.close();
  }
}
await browser.close();

writeFileSync(`${OUT}report-extra.json`, JSON.stringify({ base: BASE, all, consoleErrors }, null, 2));

const byKind = new Map();
for (const r of all) {
  for (const f of r.findings) {
    const k = `${f.kind}`;
    if (!byKind.has(k)) byKind.set(k, []);
    byKind.get(k).push({ page: r.page, width: r.width, theme: r.theme, ...f });
  }
}
console.log(`base: ${BASE}`);
console.log(`pages checked: ${all.length} (${PAGES.length} pages x ${WIDTHS.length} widths x ${THEMES.length} themes)`);
console.log(`console errors: ${consoleErrors.length}`);
for (const c of consoleErrors) console.log("  ", c.page, c.width, c.theme, c.errs.join(" | "));
if (byKind.size === 0) {
  console.log("\nNo findings.");
} else {
  console.log("");
  for (const [kind, list] of [...byKind.entries()].sort()) {
    console.log(`## ${kind} (${list.length})`);
    const seen = new Set();
    for (const f of list) {
      if (seen.has(f.detail)) continue;
      seen.add(f.detail);
      console.log(`  ${f.page} @${f.width}/${f.theme}: ${f.detail}`);
    }
    console.log("");
  }
}
