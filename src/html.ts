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

export const CSS = `
:root{
  --paper:#f3eee1; --paper-2:#fffdf7; --ink:#151210; --ink-soft:#514a42;
  --red:#d32a1c; --red-ink:#b32016; --line:#151210; --chip:#e8e1d1;
  --shadow:4px 4px 0 #151210;
  --radius:2px;
  --font-display:ui-sans-serif,system-ui,"Helvetica Neue",Arial,"Segoe UI",Roboto,sans-serif;
  --font-body:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --font-mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
}
@media (prefers-color-scheme:dark){
  :root{
    --paper:#100e0d; --paper-2:#1a1715; --ink:#f3eee1; --ink-soft:#a89f93;
    --red:#ff5c4a; --red-ink:#ff7a6a; --line:#3a342e; --chip:#241f1c;
    --shadow:4px 4px 0 #000;
  }
}
html[data-theme="light"]{
  --paper:#f3eee1; --paper-2:#fffdf7; --ink:#151210; --ink-soft:#514a42;
  --red:#d32a1c; --red-ink:#b32016; --line:#151210; --chip:#e8e1d1; --shadow:4px 4px 0 #151210;
}
html[data-theme="dark"]{
  --paper:#100e0d; --paper-2:#1a1715; --ink:#f3eee1; --ink-soft:#a89f93;
  --red:#ff5c4a; --red-ink:#ff7a6a; --line:#3a342e; --chip:#241f1c; --shadow:4px 4px 0 #000;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0; background:var(--paper); color:var(--ink);
  font-family:var(--font-body); font-size:17px; line-height:1.5;
  -webkit-font-smoothing:antialiased;
}
a{color:inherit}
.wrap{max-width:1040px;margin:0 auto;padding:0 18px}
.mono{font-family:var(--font-mono)}

/* ---------- top bar ---------- */
.top{
  border-bottom:3px solid var(--line); background:var(--paper);
  position:sticky; top:0; z-index:20;
}
.top .wrap{display:flex;align-items:center;gap:14px;min-height:58px;flex-wrap:wrap}
.logo{
  font-family:var(--font-display); font-weight:900; letter-spacing:-.03em;
  font-size:19px; text-transform:uppercase; text-decoration:none; white-space:nowrap;
}
.logo b{color:var(--red)}
.top nav{margin-left:auto;display:flex;gap:4px;align-items:center;flex-wrap:wrap}
.top nav a{
  text-decoration:none;font-weight:700;font-size:13px;text-transform:uppercase;
  letter-spacing:.06em;padding:7px 9px;border-radius:var(--radius);
}
.top nav a:hover{background:var(--chip)}
.top nav a[aria-current="page"]{background:var(--ink);color:var(--paper)}
.tally{font-family:var(--font-mono);font-size:12px;color:var(--ink-soft);white-space:nowrap}
@media (max-width:760px){
  .tally{display:none}
  .top .wrap{min-height:0;padding-top:9px;padding-bottom:9px;row-gap:6px}
  .logo{order:1;font-size:17px}
  .top nav{order:2;margin-left:0;width:100%;overflow-x:auto;flex-wrap:nowrap;gap:2px;scrollbar-width:none}
  .top nav::-webkit-scrollbar{display:none}
  .top nav a{padding:6px 8px;font-size:12px;white-space:nowrap}
}

/* ---------- hero ---------- */
.hero{padding:38px 0 8px;border-bottom:3px solid var(--line)}
.hero h1{
  font-family:var(--font-display); font-weight:900; letter-spacing:-.035em;
  font-size:clamp(38px,9vw,86px); line-height:.92; margin:0 0 14px; text-transform:uppercase;
}
.hero h1 em{font-style:normal;color:var(--red)}
.hero p{max-width:60ch;color:var(--ink-soft);margin:0 0 18px;font-size:17px}
.hero .lede{font-size:19px;color:var(--ink)}
.btn{
  display:inline-block;background:var(--ink);color:var(--paper);text-decoration:none;
  font-weight:800;font-size:14px;padding:11px 16px;border-radius:var(--radius);
  text-transform:uppercase;letter-spacing:.04em;border:2px solid var(--line);
}
.btn:hover{background:var(--red);color:#fff;border-color:var(--red)}
.btn.ghost{background:transparent;color:var(--ink)}
.btn.ghost:hover{background:var(--ink);color:var(--paper)}
.btn.sm{padding:7px 11px;font-size:12px}

/* ---------- filters ---------- */
.filters{
  display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:16px 0;
  border-bottom:3px solid var(--line); position:sticky; top:58px; background:var(--paper); z-index:15;
}
.filters .label{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-soft);font-weight:800}
.chip{
  display:inline-block;padding:6px 11px;border:2px solid var(--line);border-radius:var(--radius);
  text-decoration:none;font-weight:700;font-size:13px;background:var(--paper-2);
}
.chip:hover{background:var(--chip)}
.chip[aria-current="true"],.chip.on{background:var(--ink);color:var(--paper)}
.count-pill{font-family:var(--font-mono);font-size:12px;color:var(--ink-soft)}

/* ---------- board ---------- */
.board{padding:26px 0 60px}
.cluster{
  border:3px solid var(--line);background:var(--paper-2);border-radius:var(--radius);
  margin:0 0 18px;box-shadow:var(--shadow);position:relative;overflow:hidden;
}
.cluster .topline{display:flex;align-items:flex-start;gap:16px;padding:18px 18px 6px}
.rank{
  font-family:var(--font-display);font-weight:900;font-size:13px;color:var(--paper);
  background:var(--ink);width:30px;height:30px;flex:0 0 30px;display:grid;place-items:center;
  border-radius:var(--radius);letter-spacing:-.02em;
}
.cluster h2{
  font-family:var(--font-display);font-weight:800;letter-spacing:-.02em;line-height:1.1;
  margin:0;font-size:clamp(19px,3.4vw,26px);flex:1;min-width:0;
}
.cluster h2 a{text-decoration:none}
.cluster h2 a:hover{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px}
.tallybig{
  font-family:var(--font-display);font-weight:900;font-size:clamp(40px,11vw,64px);
  line-height:.85;letter-spacing:-.05em;font-variant-numeric:tabular-nums;text-align:right;
  flex:0 0 auto;
}
.tallybig small{display:block;font-size:11px;letter-spacing:.12em;font-weight:800;color:var(--ink-soft);text-transform:uppercase;margin-top:6px}
.meta{display:flex;flex-wrap:wrap;gap:6px 14px;padding:4px 18px 14px;font-size:13px;color:var(--ink-soft)}
.meta b{color:var(--ink);font-variant-numeric:tabular-nums}
.samples{border-top:2px solid var(--line);padding:12px 18px;background:var(--chip)}
.samples p{margin:0 0 8px;font-size:14px;color:var(--ink-soft)}
.samples p:last-child{margin-bottom:0}
.samples .q{color:var(--ink)}
.tag{
  display:inline-block;font-family:var(--font-mono);font-size:11px;padding:2px 7px;
  border:1px solid var(--line);border-radius:99px;background:var(--paper-2);margin:0 4px 4px 0;
}
.stamp{
  display:inline-block;border:2px solid var(--red);color:var(--red);font-weight:900;
  font-size:11px;letter-spacing:.14em;text-transform:uppercase;padding:3px 8px;
  transform:rotate(-3deg);border-radius:var(--radius);
}
.stamp.shipped{background:var(--red);color:#fff}
.builders{padding:0 18px 16px;font-size:13px}
.builders a{font-weight:700}
@media (min-width:720px){
  .cluster .topline{padding:20px 22px 8px}
  .cluster .meta{padding:6px 22px 16px}
  .samples{padding:14px 22px}
  .builders{padding:0 22px 18px}
}

/* ---------- generic page ---------- */
.page{padding:30px 0 70px;max-width:760px}
.page h1{
  font-family:var(--font-display);font-weight:900;letter-spacing:-.03em;text-transform:uppercase;
  font-size:clamp(30px,7vw,56px);line-height:.95;margin:0 0 8px;
}
.page h2{font-family:var(--font-display);font-weight:800;font-size:22px;letter-spacing:-.02em;margin:34px 0 10px;text-transform:uppercase}
.page h3{font-weight:800;font-size:16px;margin:22px 0 6px}
.page p,.page li{color:var(--ink-soft)}
.page p strong,.page li strong{color:var(--ink)}
.page code{
  font-family:var(--font-mono);font-size:.88em;background:var(--chip);
  padding:2px 6px;border-radius:var(--radius);color:var(--ink);overflow-wrap:anywhere;
}
pre{
  background:var(--ink);color:var(--paper);padding:14px 16px;border-radius:var(--radius);
  overflow-x:auto;font-family:var(--font-mono);font-size:13px;line-height:1.55;border:3px solid var(--line);
}
pre code{background:none;padding:0;color:inherit}
table{border-collapse:collapse;width:100%;font-size:14px;margin:12px 0}
th,td{border:2px solid var(--line);padding:9px 11px;text-align:left;vertical-align:top}
th{background:var(--chip);font-family:var(--font-display);text-transform:uppercase;font-size:12px;letter-spacing:.06em}
ul,ol{padding-left:22px}
a.under{text-decoration:underline;text-underline-offset:3px}

/* ---------- cards / lists ---------- */
.card{border:3px solid var(--line);background:var(--paper-2);border-radius:var(--radius);padding:20px;margin:0 0 20px;box-shadow:var(--shadow)}
.grid{display:grid;gap:16px;grid-template-columns:1fr}
@media (min-width:760px){ .grid.two{grid-template-columns:1fr 1fr} }
.kv{font-family:var(--font-mono);font-size:13px}

/* ---------- footer ---------- */
.foot{border-top:3px solid var(--line);padding:26px 0 40px;margin-top:20px}
.foot .wrap{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
.foot p{color:var(--ink-soft);font-size:14px;margin:0}
.foot nav{margin-left:auto;display:flex;gap:12px;flex-wrap:wrap}
.foot nav a{font-size:13px;font-weight:700;text-decoration:none;color:var(--ink-soft)}
.foot nav a:hover{color:var(--ink);text-decoration:underline}

/* ---------- misc ---------- */
.notice{border:2px solid var(--line);border-left:6px solid var(--red);padding:12px 14px;margin:0 0 18px;background:var(--paper-2);font-size:14px}
.notice b{display:block;margin-bottom:3px}
.empty{border:3px dashed var(--line);padding:40px 20px;text-align:center;color:var(--ink-soft);border-radius:var(--radius)}
.split{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.ticker{font-family:var(--font-mono);font-size:12px;color:var(--ink-soft)}
.ticker b{color:var(--red)}
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
<script>try{var t=localStorage.getItem('tw-theme');if(t)document.documentElement.setAttribute('data-theme',t);var b=document.getElementById('themebtn');if(b)b.onclick=function(){var c=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',c);localStorage.setItem('tw-theme',c);};}catch(e){}</script>
${meta.extraHead ?? ""}
</head>
<body>
<header class="top"><div class="wrap">
  <a class="logo" href="/"><b>Tools</b> Wanted</a>
  <nav>${nav(meta.nav ?? "")}</nav>
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
</body>
</html>`;
}

/** Small helper for a definition-style row. */
export function kv(label: string, value: string): string {
  return `<div><span class="count-pill">${esc(label)}</span> ${value}</div>`;
}
