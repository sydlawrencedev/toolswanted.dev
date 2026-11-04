/**
 * A browser audit of the live board.
 *
 * Every page, at every width, in both themes: overflow, heading order,
 * contrast, touch targets, and whether each copy button copies its own
 * block. Run it against production or against a local dev server:
 *
 *   node scripts/audit-browser.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "https://toolswanted.dev";
const OUT = new URL("../.audit/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const WIDTHS = [320, 390, 768, 1280];
const THEMES = ["light", "dark"];

/**
 * The zoom levels the board is checked at.
 *
 * The bar's height depends on the reader's font size, so a reader who has
 * zoomed in sees a different bar. That is the case the header was broken
 * in: at 100% zoom nothing was wrong at any width, and at 150% zoom on a
 * laptop the nav dropped below the wordmark and the bar grew by a whole
 * row.
 *
 * Zoom is applied to the body, which is what a browser's zoom does to the
 * layout, so the measurements are of the layout the reader gets.
 */
const ZOOMS = [1, 1.5, 2];

const PAGES = [
  { path: "/", name: "board" },
  { path: "/weekly", name: "weekly" },
  { path: "/agents", name: "agents" },
  { path: "/build", name: "build" },
  { path: "/wish", name: "wish" },
  { path: "/about", name: "about" },
  { path: "/privacy", name: "privacy" },
];

/**
 * The audit itself. It is a single string of JS evaluated in the page, so
 * the colour helpers have to live inside it: the browser has no access to
 * this module's scope.
 */
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

  // Horizontal overflow of the document itself.
  const overflow = de.scrollWidth - de.clientWidth;
  if (overflow > 1) {
    findings.push({
      kind: "overflow",
      detail: `document scrollWidth ${de.scrollWidth} > clientWidth ${de.clientWidth}`,
    });
  }

  // The zoom the audit applied, if any. A rect is in device pixels and
  // the viewport is in CSS pixels, so every rect is divided by the zoom
  // before it is compared with anything else.
  const zoom = parseFloat(document.body.style.zoom) || 1;

  // Any element sticking out past the viewport.
  const vw = de.clientWidth;
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right / zoom > vw + 1) {
      const tag = el.tagName.toLowerCase();
      const cls =
        el.className && typeof el.className === "string"
          ? `.${el.className.split(" ").join(".")}`
          : "";
      // An element inside a scroll container is allowed to be wider.
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
        detail: `${tag}${cls} right=${Math.round(r.right / zoom)} > ${vw}`,
      });
    }
  }

  // Exactly one h1.
  const h1s = [...document.querySelectorAll("h1")];
  if (h1s.length !== 1) {
    findings.push({ kind: "h1-count", detail: `${h1s.length} h1 elements` });
  }

  // No heading level skips.
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

  // Contrast: every text node's element against its effective background.
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
    // Minimum type size.
    if (size < 12) {
      findings.push({ kind: "type-floor", detail: `${el.tagName.toLowerCase()} font-size ${size}px` });
    }
  }

  // Touch targets: standalone controls at least 44px tall.
  for (const el of document.querySelectorAll("a, button, select, input")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.height / zoom < 44) {
      const inline = getComputedStyle(el).display === "inline";
      // A link inside a sentence is a word in a sentence.
      if (inline && el.tagName === "A") continue;
      findings.push({
        kind: "touch-target",
        detail: `${el.tagName.toLowerCase()} "${(el.textContent || el.value || "").trim().slice(0, 30)}" height=${Math.round(r.height / zoom)}`,
      });
    }
  }

  // The nav: every link fully on screen.
  const nav = document.querySelector(".top nav");
  if (nav) {
    for (const a of nav.querySelectorAll("a")) {
      const r = a.getBoundingClientRect();
      if (r.right / zoom > vw + 1 || r.left / zoom < -1) {
        findings.push({
          kind: "nav-clipped",
          detail: `"${a.textContent.trim()}" left=${Math.round(r.left / zoom)} right=${Math.round(r.right / zoom)} vw=${vw}`,
        });
      }
      if (r.width === 0 || r.height === 0) {
        findings.push({ kind: "nav-hidden", detail: `"${a.textContent.trim()}" has no box` });
      }
    }

    // The logo and the nav are the bar's only children, and the bar's
    // height is the height of the rows they make: the wordmark's row,
    // the nav's rows, the gap between them, the bar's padding and its
    // 3px border. If the bar is taller than that, a line broke that
    // should not have.
    const logo = document.querySelector(".top .logo");
    const top = document.querySelector(".top");
    const wrap = document.querySelector(".top .wrap");
    if (logo && top && wrap) {
      const nr = nav.getBoundingClientRect();
      const lr = logo.getBoundingClientRect();
      const css = (v) => v / zoom;
      const onLogoRow = Math.round(css(nr.top)) === Math.round(css(lr.top));
      const startsAtLeft = css(nr.left) <= css(lr.left) + 2;
      if (!onLogoRow && !startsAtLeft) {
        findings.push({
          kind: "nav-hole",
          detail: `nav on its own row but starts at ${Math.round(css(nr.left))} while the logo starts at ${Math.round(css(lr.left))}: the bar left a hole`,
        });
      }

      // The bar must not be taller than the rows it holds. The nav's own
      // height already includes its rows and its gaps, so the bar is the
      // logo's row and the nav's row, or just the nav's row.
      //
      // Everything here is in CSS pixels. A rect is in device pixels,
      // and the audit zooms the body, so the rects are divided by the
      // zoom: a 66px rect at 150% is a 44px box.
      const wcs = getComputedStyle(wrap);
      const rowGap = parseFloat(wcs.rowGap) || 0;
      const padTop = parseFloat(wcs.paddingTop) || 0;
      const padBottom = parseFloat(wcs.paddingBottom) || 0;
      const border = parseFloat(getComputedStyle(top).borderBottomWidth) || 0;
      const expected = onLogoRow
        ? Math.max(css(lr.height), css(nr.height)) + padTop + padBottom + border
        : css(nr.height) + rowGap + css(lr.height) + padTop + padBottom + border;
      const actual = css(top.getBoundingClientRect().height);
      if (actual > expected + 2) {
        findings.push({
          kind: "bar-too-tall",
          detail: `bar is ${Math.round(actual)}px but its rows need ${Math.round(expected)}px`,
        });
      }
    }
  }

  // Copy buttons must not overlap the code they copy.
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

  // Every pre has a copy button.
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

/* ---------- run ---------- */
const browser = await chromium.launch();
const all = [];
const consoleErrors = [];

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    for (const zoom of ZOOMS) {
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
        // Not `networkidle`: the live ticker polls /api/updates every eight
        // seconds, so the network is never idle on the board page.
        const res = await page
          .goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
          .catch((e) => {
            errs.push("goto failed: " + e.message);
            return null;
          });
        if (!res) {
          all.push({
            page: p.name,
            width,
            theme,
            zoom,
            findings: [{ kind: "load-failed", detail: errs.join("; ") }],
          });
          await page.close();
          continue;
        }
        // Wait for the stylesheet, so the measurements are of the styled
        // page and not of the unstyled one.
        await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {});
        await page.evaluate(() => document.fonts?.ready).catch(() => {});
        // Zoom the body, the way a browser's zoom changes the layout, and
        // let the sticky script re-measure the bar.
        await page.evaluate((z) => {
          if (z !== 1) document.body.style.zoom = String(z);
        }, zoom);
        await page.waitForTimeout(150);
        const findings = await page.evaluate(auditPage);
        if (errs.length) consoleErrors.push({ page: p.name, width, theme, zoom, errs });
        all.push({ page: p.name, width, theme, zoom, status: res.status(), findings });
        if (width === 320 && theme === "light" && zoom === 1) {
          await page.screenshot({ path: `${OUT}${p.name}-320-light.png`, fullPage: true });
        }
        if (width === 390 && theme === "dark" && zoom === 1) {
          await page.screenshot({ path: `${OUT}${p.name}-390-dark.png`, fullPage: true });
        }
        await page.close();
      }
      await context.close();
    }
  }
}
await browser.close();

writeFileSync(`${OUT}report.json`, JSON.stringify({ base: BASE, all, consoleErrors }, null, 2));

// Print a summary.
const byKind = new Map();
for (const r of all) {
  for (const f of r.findings) {
    const k = `${f.kind}`;
    if (!byKind.has(k)) byKind.set(k, []);
    byKind.get(k).push({ page: r.page, width: r.width, theme: r.theme, zoom: r.zoom, ...f });
  }
}
console.log(`base: ${BASE}`);
console.log(
  `pages checked: ${all.length} (${PAGES.length} pages x ${WIDTHS.length} widths x ${THEMES.length} themes x ${ZOOMS.length} zooms)`
);
console.log(`console errors: ${consoleErrors.length}`);
for (const c of consoleErrors) console.log("  ", c.page, c.width, c.theme, c.zoom, c.errs.join(" | "));
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
      console.log(`  ${f.page} @${f.width}/${f.theme}/z${f.zoom}: ${f.detail}`);
    }
    console.log("");
  }
}
