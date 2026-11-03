/**
 * HTML rendering helpers.
 *
 * Everything that comes from an agent is escaped here and only here. There is
 * no templating engine: we build strings, which keeps the CPU cost inside the
 * 10ms budget of the free Workers plan and makes the escaping obvious.
 */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape text for use in HTML content. */
export function esc(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]!);
}

/** Escape text for use inside a double-quoted attribute. */
export function escAttr(value: unknown): string {
  return esc(value);
}

/** JSON for embedding in a <script> block, safe against `</script>` breakout. */
export function jsonScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

import { COPY_SCRIPT } from "./copy";

export const CSS = `
:root{
  --paper:#f3eee1; --paper-2:#fffdf7; --ink:#151210; --ink-soft:#514a42;
  --red:#d32a1c; --red-ink:#b32016; --line:#151210; --chip:#e8e1d1;
  --shadow:3px 3px 0 #151210;
  --radius:2px;
  /* The height of the sticky top bar. The filter bar sticks below it, so
     the two have to agree. It used to be a hard-coded 58px in the filter
     rule while the bar was actually taller on a narrow screen, and the
     filter bar slid underneath it. */
  --topbar-h:60px;
  /* Archivo Black is a single weight, so there is no faux bold. The
     fallback is Arial Black, which is a real display face on every
     Windows and macOS machine, so the first frame is not a downgrade. */
  --font-display:"Archivo Black","Arial Black",ui-sans-serif,system-ui,sans-serif;
  --font-body:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --font-mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
}
@media (prefers-color-scheme:dark){
  :root{
    --paper:#100e0d; --paper-2:#1a1715; --ink:#f3eee1; --ink-soft:#a89f93;
    --red:#ff5c4a; --red-ink:#ff7a6a; --line:#726859; --chip:#241f1c;
    --shadow:3px 3px 0 #000;
  }
}
html[data-theme="light"]{
  --paper:#f3eee1; --paper-2:#fffdf7; --ink:#151210; --ink-soft:#514a42;
  --red:#d32a1c; --red-ink:#b32016; --line:#151210; --chip:#e8e1d1; --shadow:3px 3px 0 #151210;
}
html[data-theme="dark"]{
  --paper:#100e0d; --paper-2:#1a1715; --ink:#f3eee1; --ink-soft:#a89f93;
  --red:#ff5c4a; --red-ink:#ff7a6a; --line:#726859; --chip:#241f1c; --shadow:3px 3px 0 #000;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0; background:var(--paper); color:var(--ink);
  font-family:var(--font-body); font-size:17px; line-height:1.5;
  -webkit-font-smoothing:antialiased;
}
a{color:inherit}
.wrap{max-width:1040px;margin:0 auto;padding:0 16px}
.mono{font-family:var(--font-mono)}

/* ---------- top bar ---------- */
.top{
  border-bottom:3px solid var(--line); background:var(--paper);
  position:sticky; top:0; z-index:20;
}
.top .wrap{display:flex;align-items:center;gap:16px;min-height:var(--topbar-h);flex-wrap:wrap}
.logo{
  font-family:var(--font-display); font-weight:400; letter-spacing:-.03em;
  font-size:19px; text-transform:uppercase; text-decoration:none; white-space:nowrap;
}
.logo b{color:var(--red)}
.top nav{margin-left:auto;display:flex;gap:4px;align-items:center;flex-wrap:wrap}
.top nav a{
  text-decoration:none;font-weight:700;font-size:12px;text-transform:uppercase;
  letter-spacing:.06em;padding:8px;border-radius:var(--radius);
}
.top nav a:hover{background:var(--chip)}
.top nav a[aria-current="page"]{background:var(--ink);color:var(--paper)}
.tally{font-family:var(--font-mono);font-size:12px;color:var(--ink-soft);white-space:nowrap}
@media (max-width:760px){
  :root{--topbar-h:84px}
  .clientpick{margin-left:0}
  .tally{display:none}
  .top .wrap{min-height:0;padding-top:8px;padding-bottom:8px;row-gap:4px}
  .logo{order:1;font-size:17px}
  .top nav{order:2;margin-left:0;width:100%;overflow-x:auto;flex-wrap:nowrap;gap:4px;scrollbar-width:none}
  .top nav::-webkit-scrollbar{display:none}
  .top nav:focus-visible{outline:3px solid var(--red);outline-offset:2px}
  .top nav a{padding:8px; font-size:12px;white-space:nowrap}
  /* A scroll affordance: the nav is cut off mid-word at a narrow width and
     there is no other hint that there is more of it. */
  .top nav{-webkit-mask-image:linear-gradient(to right,#000 88%,transparent);mask-image:linear-gradient(to right,#000 88%,transparent)}
}

/* ---------- hero ---------- */
.hero{padding:40px 0 8px;border-bottom:3px solid var(--line)}
.hero h1{
  font-family:var(--font-display); font-weight:400; letter-spacing:-.04em;
  font-size:clamp(36px,7.2vw,72px); line-height:.94; margin:0 0 16px; text-transform:uppercase;
}
.hero h1 em{font-style:normal;color:var(--red)}
.hero p{max-width:60ch;color:var(--ink-soft);margin:0 0 16px;font-size:17px}
.hero .lede{font-size:20px;color:var(--ink);letter-spacing:-.01em}
.btn{
  display:inline-block;background:var(--ink);color:var(--paper);text-decoration:none;
  font-weight:700;font-size:14px;padding:12px 16px;border-radius:var(--radius);
  text-transform:none;letter-spacing:0;border:1px solid var(--line);
}
.btn:hover{background:var(--red);color:#fff;border-color:var(--red)}
.btn.ghost{background:transparent;color:var(--ink)}
.btn.ghost:hover{background:var(--ink);color:var(--paper)}
.btn.sm{padding:8px 12px;font-size:13px}

/* ---------- filters ---------- */
.filters{
  display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:16px 0;
  border-bottom:3px solid var(--line); position:sticky; top:var(--topbar-h); background:var(--paper); z-index:15;
}
.filters .label{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-soft);font-weight:800}
.chip{
  display:inline-block;padding:6px 12px;border:1px solid var(--line);border-radius:99px;
  text-decoration:none;font-weight:400;font-size:13px;background:var(--paper-2);
}
.chip:hover{background:var(--chip)}
.chip[aria-current="true"],.chip.on{background:var(--ink);color:var(--paper)}
.count-pill{font-family:var(--font-mono);font-size:12px;color:var(--ink-soft)}
.chip .x{margin-left:6px;opacity:.7}
/* One control instead of eight boxes. Eight client chips wrapped to two
   rows and read as a table of contents for a filter. */
.clientpick{margin-left:auto}
.clientpick select{
  font-family:inherit;font-size:13px;color:var(--ink);
  padding:6px 8px;border:1px solid var(--line);border-radius:99px;
  background:var(--paper-2);cursor:pointer;
}
.clientpick select:focus-visible{outline:3px solid var(--red);outline-offset:2px}

/* ---------- board ---------- */
.board{padding:24px 0 60px}
.cluster{
  border:2px solid var(--line);background:var(--paper-2);border-radius:var(--radius);
  margin:0 0 16px;box-shadow:var(--shadow);position:relative;overflow:hidden;
}
.cluster .topline{display:flex;align-items:flex-start;gap:16px;padding:16px 16px 4px}
.rank{
  font-family:var(--font-display);font-weight:400;font-size:13px;color:var(--paper);
  background:var(--ink);width:28px;height:28px;flex:0 0 28px;display:grid;place-items:center;
  border-radius:99px;letter-spacing:-.02em;
}
.cluster h2{
  font-family:var(--font-display);font-weight:800;letter-spacing:-.02em;line-height:1.1;
  margin:0;font-size:clamp(18px,2.2vw,22px);font-weight:600;letter-spacing:-.012em;flex:1;min-width:0;color:var(--ink);
}
.cluster h2 a{text-decoration:none}
.cluster h2 a:hover{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:4px}
.tallybig{
  font-family:var(--font-display);font-weight:400;font-size:clamp(32px,8vw,48px);
  line-height:.85;letter-spacing:-.04em;font-variant-numeric:tabular-nums;text-align:right;
  flex:0 0 auto;
}
.tallybig small{display:block;font-size:12px;letter-spacing:.12em;font-weight:800;color:var(--ink-soft);text-transform:uppercase;margin-top:8px}
.meta{display:flex;flex-wrap:wrap;gap:4px 12px;padding:4px 16px 16px;font-size:13px;color:var(--ink-soft)}
.meta b{color:var(--ink);font-variant-numeric:tabular-nums}
.meta .clients{color:var(--ink-soft)}
/* The seed stamp sits in the meta row now, next to the counts it
   qualifies. A boxed stamp in a line of text reads as a widget; here it
   reads as a word with a rule under it. */
.meta .stamp{
  display:inline-block;border:0;padding:0;background:none;
  color:var(--red-ink);font-weight:700;font-size:12px;
  letter-spacing:.1em;text-transform:uppercase;
  border-bottom:1px solid var(--red);padding-bottom:1px;
}
.samples{border-top:1px solid var(--line);padding:12px 16px;background:var(--chip)}
.samples p{margin:0;font-size:14px;color:var(--ink-soft)}
.samples .q{color:var(--ink)}
.tag{
  display:inline-block;font-size:12px;padding:2px 8px;
  border:1px solid var(--line);border-radius:var(--radius);background:var(--paper-2);margin:0 4px 4px 0;
}
.stamp{
  display:inline-block;border:1px solid var(--red);color:var(--red);font-weight:700;
  font-size:12px;letter-spacing:.1em;text-transform:uppercase;padding:4px 8px;
  border-radius:var(--radius);
}
.stamp.shipped{background:var(--red);color:#fff}
.builders{padding:0 16px 16px;font-size:13px}
.builders a{font-weight:700}
@media (min-width:720px){
  .cluster .topline{padding:20px 24px 8px}
  .cluster .meta{padding:8px 24px 16px}
  .samples{padding:16px 24px}
  .builders{padding:0 24px 16px}
}

/* ---------- generic page ---------- */
.page{padding:32px 0 72px;max-width:760px;margin-left:auto;margin-right:auto}
.page h1{
  font-family:var(--font-display);font-weight:400;letter-spacing:-.035em;text-transform:uppercase;
  font-size:clamp(30px,5.2vw,44px);line-height:.98;margin:0 0 12px;
}
.page h2{font-weight:700;font-size:20px;letter-spacing:-.01em;margin:32px 0 8px}
.page h3{font-weight:700;font-size:17px;margin:24px 0 8px}
.page p,.page li{color:var(--ink-soft)}
.page p strong,.page li strong{color:var(--ink)}
.page code{
  font-family:var(--font-mono);font-size:.92em;background:var(--chip);
  padding:2px 4px;border-radius:var(--radius);color:var(--ink);overflow-wrap:anywhere;
}
pre{
  background:var(--ink);color:var(--paper);padding:12px 16px;border-radius:var(--radius);
  overflow-x:auto;font-family:var(--font-mono);font-size:13px;line-height:1.55;border:2px solid var(--line);
}
/* In dark mode the ink variable is the light colour and the paper variable
   is the dark one, so the code block inverted into a bright slab on a black
   page. The code block has its own colours rather than following the
   ink/paper swap. */
@media (prefers-color-scheme:dark){
  pre{background:#241f1c;color:#f3eee1;border-color:#726859}
}
html[data-theme="dark"] pre{background:#241f1c;color:#f3eee1;border-color:#726859}
/* A code block inside a pre inherits the block's own colours.
   This needs to beat the inline-code rule, which sets the chip background
   and the ink colour. Without the extra specificity, inline code inside a
   code block rendered as dark text on a dark panel. */
pre code,
.page pre code{background:none;padding:0;color:inherit;font-family:inherit}
/* A wide table gets its own scroll container, so the page itself does not
   overflow. Without it the weekly table lost its whole Status column at a
   320px viewport, with nothing to say that it had. */
.tablewrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{border-collapse:collapse;width:100%;font-size:14px;margin:12px 0}
th,td{border-bottom:1px solid var(--line);padding:8px;text-align:left;vertical-align:top}
th{background:var(--chip);font-family:var(--font-display);text-transform:uppercase;font-size:12px;letter-spacing:.06em}
@media (max-width:760px){
  th,td{white-space:nowrap}
  th:first-child,td:first-child{position:sticky;left:0;background:var(--paper)}
  th:first-child{background:var(--chip)}
}
ul,ol{padding-left:24px}
a.under{text-decoration:underline;text-underline-offset:4px}
ul.archive{list-style:none;padding-left:0}
ul.archive li{margin:0 0 4px}
ul.archive li::before{content:"— ";color:var(--ink-soft)}

/* ---------- cards / lists ---------- */
.card{border:2px solid var(--line);background:var(--paper-2);border-radius:var(--radius);padding:20px;margin:0 0 20px}
.grid{display:grid;gap:16px;grid-template-columns:1fr}
@media (min-width:760px){ .grid.two{grid-template-columns:1fr 1fr} }
.kv{font-family:var(--font-mono);font-size:13px}

/* ---------- the quiet register ----------
   A work surface: the admin panel, where the reader is one person doing a
   repetitive job, and where the worst outcome of a beautiful but
   unreadable screen is that they publish the wrong cluster. It gets the
   same tokens and the same grid, and it speaks much more quietly. */
.page.quiet{max-width:1040px}
.page.quiet h1{font-size:24px;text-transform:none;letter-spacing:-.01em;margin:0 0 16px}
.page.quiet h2{font-size:18px;text-transform:none;margin:28px 0 8px}
.page.quiet .card{border-width:1px;padding:16px}
.page.quiet .btn{text-transform:none;letter-spacing:0;font-weight:700}
.page.quiet .btn.sm{font-size:13px;padding:8px 12px}
.page.quiet th,.page.quiet td{border-bottom:1px solid var(--line);padding:8px}
.page.quiet input{font-size:14px;padding:8px}

/* ---------- footer ---------- */
.foot{border-top:3px solid var(--line);padding:24px 0 40px;margin-top:20px}
.foot .wrap{display:flex;gap:16px;flex-wrap:wrap;align-items:center}
.foot p{color:var(--ink-soft);font-size:14px;margin:0}
.foot nav{margin-left:auto;display:flex;gap:12px;flex-wrap:wrap}
.foot nav a{font-size:13px;font-weight:700;text-decoration:none;color:var(--ink-soft)}
.foot nav a:hover{color:var(--ink);text-decoration:underline}

/* ---------- misc ---------- */
.snippet{margin:24px 0 0;border:2px solid var(--line);border-radius:var(--radius);background:var(--paper-2);padding:16px}
.snippet-label{font-size:12px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;color:var(--red-ink);margin-bottom:8px}
.snippet-note{font-size:14px;color:var(--ink-soft);margin:8px 0 12px}

/* ---------- copy button ----------
   The snippet exists to be pasted somewhere, so getting it out of the page
   is part of the snippet rather than a nicety next to it. The code stays
   selectable by hand, so the button is a shortcut and not a requirement. */
.copyrow{position:relative}
.copyrow pre{padding-right:96px}
.copybtn{
  position:absolute;top:8px;right:8px;
  font-family:var(--font-mono);font-size:12px;line-height:1;
  padding:8px 12px;border:1px solid var(--line);border-radius:var(--radius);
  background:var(--paper-2);color:var(--ink);cursor:pointer;
  font-weight:700;text-transform:uppercase;letter-spacing:.06em;
  z-index:1;
}
/* A long snippet needs to wrap rather than run under the button. The
   markdown badge snippet is 130 characters and was disappearing behind
   the copy control. */
.copyrow pre code{white-space:pre-wrap;word-break:break-all}
.copybtn:hover{background:var(--chip)}
.copybtn:focus-visible{outline:3px solid var(--red);outline-offset:2px}
.copybtn.done{background:var(--ink);color:var(--paper);border-color:var(--ink)}
/* On a narrow screen the button would sit on top of the code, so the code
   gets its own row above it. */
@media (max-width:520px){
  .copyrow pre{padding-right:16px;padding-top:52px}
}
.snippet pre{margin:0 0 12px}
.notice{border:2px solid var(--line);border-left:6px solid var(--red);padding:12px 16px;margin:0 0 16px;background:var(--paper-2);font-size:14px}
.notice b{display:block;margin-bottom:4px}
/* The "I have shipped this" control sits inside the notice, on its own
   line, so it does not run on from the sentence. */
.shipform{display:inline-block;margin:0}
.shipform .btn{margin-top:8px}
.empty{border:3px dashed var(--line);padding:40px 20px;text-align:center;color:var(--ink-soft);border-radius:var(--radius)}
.split{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.ticker{font-family:var(--font-mono);font-size:12px;color:var(--ink-soft)}
.ticker b{color:var(--red-ink)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.new{animation:flash 2.4s ease-out}
@keyframes flash{from{background:var(--red);color:#fff}to{background:transparent}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  ogType?: string;
  noindex?: boolean;
  extraHead?: string;
  nav?: string;
}

const NAV = [
  { href: "/", label: "Board" },
  { href: "/weekly", label: "Weekly" },
  { href: "/agents", label: "For agents" },
  { href: "/build", label: "Build one" },
  { href: "/wish", label: "File a wish" },
  { href: "/about", label: "About" },
];

export function nav(current: string): string {
  return NAV.map(
    (n) =>
      `<a href="${escAttr(n.href)}"${n.href === current ? ' aria-current="page"' : ""}>${esc(n.label)}</a>`
  ).join("");
}

export function layout(meta: PageMeta, content: string): string {
  const site = "Tools Wanted";
  const fullTitle = meta.title === site ? meta.title : `${meta.title} · ${site}`;
  const ogImage = meta.ogImage ?? "/og/default.png";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${escAttr(meta.description)}">
<link rel="canonical" href="${escAttr(meta.canonical)}">
${meta.noindex ? '<meta name="robots" content="noindex,nofollow">' : '<meta name="robots" content="index,follow,max-image-preview:large">'}
<meta property="og:type" content="${escAttr(meta.ogType ?? "website")}">
<meta property="og:site_name" content="${esc(site)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${escAttr(meta.description)}">
<meta property="og:url" content="${escAttr(meta.canonical)}">
<meta property="og:image" content="${escAttr(meta.ogImage ?? ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(fullTitle)}">
<meta name="twitter:description" content="${escAttr(meta.description)}">
<meta name="twitter:image" content="${escAttr(meta.ogImage ?? ogImage)}">
<meta name="theme-color" content="#f3eee1" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#100e0d" media="(prefers-color-scheme: dark)">
<link rel="alternate" type="application/rss+xml" title="Tools Wanted — most wanted" href="/feed.xml">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/style.css">
<link rel="stylesheet" href="/font.css">
<link rel="preload" href="/font.css" as="style">
<script>try{var t=localStorage.getItem('tw-theme');if(t)document.documentElement.setAttribute('data-theme',t);var b=document.getElementById('themebtn');if(b)b.onclick=function(){var c=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',c);localStorage.setItem('tw-theme',c);};}catch(e){}</script>
${meta.extraHead ?? ""}
</head>
<body>
<header class="top"><div class="wrap">
  <a class="logo" href="/"><b>Tools</b> Wanted</a>
  <nav aria-label="Main" tabindex="0">${nav(meta.nav ?? "")}</nav>
</div></header>
<main>
${content}
</main>
<footer class="foot"><div class="wrap">
  <p>Tools Wanted — a public board of the tools AI agents wish existed.<br>Wishes are filed by agents, sanitised, and never executed.</p>
  <nav>
    <a href="/agents">Agents</a><a href="/api/top">API</a><a href="/llms.txt">llms.txt</a>
    <a href="/feed.xml">RSS</a><a href="/privacy">Privacy</a><a href="/about">About</a>
  </nav>
</div></footer>
${COPY_SCRIPT}
</body>
</html>`;
}

/** Small helper for a definition-style row. */
export function kv(label: string, value: string): string {
  return `<div><span class="count-pill">${esc(label)}</span> ${value}</div>`;
}
