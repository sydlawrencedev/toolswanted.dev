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
     filter bar slid underneath it.

     This is the value for the first paint. The script in STICKY_SCRIPT
     measures the real height and writes it back, because the bar's
     height depends on the font, the wrapping and the reader's own font
     size. The number here is a fallback, not the truth.

     63px is the bar with the nav on the same row as the wordmark, which
     is the case from 810px up. Below that the nav takes its own row and
     the bar is 159px, and below 385px it is 207px. The breakpoints are
     viewport widths here because this is the first-paint value, and the
     real break point is a container width that moves with the reader's
     zoom; the script corrects it either way. */
  --topbar-h:63px;
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
    --red:#ff5c4a; --red-ink:#ff7a6a; --line:#726859; --chip:#211d1a;
    --shadow:3px 3px 0 #000;
  }
}
html[data-theme="light"]{
  --paper:#f3eee1; --paper-2:#fffdf7; --ink:#151210; --ink-soft:#514a42;
  --red:#d32a1c; --red-ink:#b32016; --line:#151210; --chip:#e8e1d1; --shadow:3px 3px 0 #151210;
}
html[data-theme="dark"]{
  --paper:#100e0d; --paper-2:#1a1715; --ink:#f3eee1; --ink-soft:#a89f93;
  --red:#ff5c4a; --red-ink:#ff7a6a; --line:#726859; --chip:#211d1a; --shadow:3px 3px 0 #000;
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
/* The bar's height is not driven by --topbar-h.
   It used to be: the wrap inside the bar had a min-height of
   var(--topbar-h), and the script measured the bar and wrote its height
   back into the token. That is circular, the bar's height depends on
   the token, and the token is the bar's height, so the measurement
   settled on whatever it was at the moment it ran. It read 63px on a
   66px bar, and the filter bar stuck 3px inside the header again.

   The bar's height comes from its own contents: a 44px nav link, the
   padding above and below it, and the 3px border. The script measures
   the result and writes it down. */
/* The wrap is a grid, not a wrapping flex row.

   It was display:flex with flex-wrap:wrap, so the logo and the nav were
   two items on a breakable flex line. When they could not both fit on one
   line, the nav was pushed to a second line and the header grew by a
   whole row. The nav was right-aligned by margin-left:auto, so the
   dropped nav sat at the right edge and left a hole under the logo.

   That hole was the "the navbar keeps growing" report, and it was
   invisible at 100% zoom: the nav needs 684px and the bar's content box
   is 1008px, so the line never broke. At 1024px and 150% zoom the
   header went from 63px to 184px, and at 200% to 342px.

   A grid line cannot break. The logo is one column, the nav is another,
   and the nav's column is minmax(0,1fr), so it can shrink to nothing.
   The nav is moved to its own row on purpose, by the container query
   below, rather than by accident.

   The wrap is also a container, so the nav can ask how much room the
   logo left it. A media query cannot see that: the logo takes 162px of
   the bar whatever the window is, and the width the nav has left is not
   the width of the window.

   The row gap is 4px, which is the same everywhere. It only shows when
   the nav is on its own row, and it has to be the same in that row as
   it is on a phone, or the bar jumps 4px as it crosses the 760px
   breakpoint. It cannot be set from inside the container query: a
   container cannot be styled by a query about its own size. */
.top .wrap{
  display:grid;grid-template-columns:minmax(0,auto) minmax(0,1fr);
  align-items:center;gap:4px 16px;padding:8px 16px;
  container-type:inline-size;
}
.logo{
  font-family:var(--font-display); font-weight:400; letter-spacing:-.03em;
  font-size:19px; text-transform:uppercase; text-decoration:none;
  /* A 44px touch target without turning the link into a flex container:
     as a flex box the space between "Tools" and "Wanted" collapsed and
     the wordmark ran together. */
  display:block;line-height:44px;
  /* The wordmark is 162px at 19px, so it fits a 320px phone to 1.78x
     zoom. Past that it is wider than the screen.

     It breaks rather than truncates. A wordmark that ends in an
     ellipsis is not the name of the thing, and "TOOLS WA..." is not a
     wordmark. The bar grows a line to hold the two halves instead,
     which is the right trade: a taller bar is a bar, a sideways
     scrolling page is a broken one. */
  min-width:0;white-space:normal;overflow-wrap:normal;
}
.logo b{color:var(--red)}
/* The nav is a grid of content sized columns, not a flex row.

   A flex row with margin-left:auto hung the links off the right edge of
   the bar and left the current page's filled block as a black rectangle
   floating in the space between the logo and the rest of the links. As a
   grid the six links sit on six columns, each sized to its own label,
   and the slack is at the end of the row.

   The nav itself is pushed to the right of the bar by its own column
   being 1fr and the grid's justify-content, not by margin-left:auto.
   The auto margin was what let the nav break onto a second line and
   leave a hole under the logo.

   max-content, not auto: auto floors at the track's minimum content
   contribution, which for a nowrap link is its own width, and a track
   can end up narrower than the thing in it. That is what made the page
   scroll sideways at 200% zoom on a phone. */
.top nav{
  display:grid;grid-template-columns:repeat(6,max-content);
  gap:4px 16px;justify-content:end;align-items:center;align-content:center;
  min-width:0;
}
.top nav a{
  text-decoration:none;font-weight:700;font-size:12px;text-transform:uppercase;
  letter-spacing:.06em;padding:8px;border-radius:var(--radius);
  /* 44px touch target, at every width.
     The 44px rule was written inside the mobile media query, so on a
     tablet or a desktop the nav links were 34px tall: a smaller target
     on a bigger screen. The browser measured 34px at 761px and above.
     The link is a flex box so the padding sets the height without the
     line box moving. */
  min-height:44px;display:inline-flex;align-items:center;
}
.top nav a:hover{background:var(--chip)}
.top nav a[aria-current="page"]{background:var(--ink);color:var(--paper)}
/* When the nav cannot sit beside the logo, it takes its own row.

   The nav needs 776px of the bar to sit beside the wordmark: 162px for
   the logo, a 16px gap, the six links at 565px and the bar's own 32px of
   padding. Below that the nav drops to a second row, where it lays out
   as three columns of two.

   The threshold is in em, and it is measured against the container's
   font-size, which is the body's 17px: 776 / 17 is 45.6em. It has to
   be in em because the requirement is zoom-invariant. The nav needs
   56.97em of link-font at every zoom level, so the break point moves
   with the reader's zoom rather than with the window: a 1024px window
   at 150% zoom has a container of 683px, which is 40em, and the nav
   goes to its own row there, correctly.

   A viewport media query cannot do this. The logo takes 162px of the
   bar whatever the window is, so the width the nav has left is not the
   width of the window. */
@container (max-width:45.5em){
  /* The nav takes its own row, so the bar is one column deep: the
     wordmark in the first row, the nav in the second, each the full
     width of the bar.

     It was two columns with the nav spanning both. A spanning item
     does not contribute to the column widths, so the second column
     collapsed to nothing and the nav was laid out in the width the
     wordmark's column left over. At 200% zoom on a phone that was
     130px for six links, and they spilled out of the bar and the page
     scrolled sideways. */
  .top .wrap{grid-template-columns:minmax(0,1fr)}
  .top nav{
    /* Three columns of two, at the left edge. The row is the full
       width of the bar and the links start under the wordmark. Right
       aligning it would move the hole from under the logo to the other
       side of the bar.

       The columns are three on a wide bar, the same as on a phone. The
       browser's to choose was worse: auto-fit made the number of
       columns change with every pixel, so the bar grew a row and
       shrank another as the window moved.

       minmax(0,1fr): a share of the bar's width, and no wider than the
       space there is. */
    grid-column:1;
    grid-template-columns:repeat(3,minmax(0,1fr));
    justify-content:start;
  }
  /* A label that cannot fit its track breaks rather than spilling out
     of the bar. The link is a block so its label can wrap: as a flex
     box the label is an anonymous flex item, which does not wrap. */
  .top nav a{
    white-space:normal;overflow-wrap:anywhere;min-width:0;
    display:block;
  }
}
@media (max-width:805px){
  /* Below 806px the nav takes its own row under the wordmark, and the
     bar is 159px tall: the logo's row, the nav's two rows of 44px
     links, a 4px row gap, 16px of padding and the 3px border.

     These are the first-paint values; the script in STICKY_SCRIPT
     measures the real height and writes it back, because a number
     measured by hand goes stale the moment the bar's contents change,
     and because the real break point moves with the reader's zoom. */
  :root{--topbar-h:159px}
}
@media (max-width:760px){
  .clientpick{margin-left:0}
  /* The nav is on its own row on a phone, so the bar is one column
     deep: the wordmark, then the nav, each the full width. */
  .top .wrap{grid-template-columns:minmax(0,1fr)}
  /* The logo stays at 19px on a phone. It was 17px, and at 17px the red
     is 4.4:1 against the paper, which is under the 4.5:1 body text
     threshold. The wordmark fits at 19px in 288px, so there is no reason
     to shrink it. */
  .logo{order:1;font-size:19px}
  .top nav{
    order:2;margin-left:0;width:100%;
    /* Six links do not fit on one row at 320px, and the old horizontal
       scroll clipped "File a wish" and "About" off the right edge with
       nothing but a fade to say so. A grid wraps them instead: every
       destination is visible without a gesture.

       The columns are three on a phone. They were the browser's to
       choose, and that was worse: auto-fit made the number of columns
       change with every pixel, so the bar was 111px tall at 760px and
       223px at 765px and 63px at 810px, and it grew a row and shrank
       another as the window moved. The number of rows is now a
       function of the width range, not of the exact width.

       The tracks are minmax(0,1fr): a share of the bar's width, and no
       wider than the space there is. A content sized track is as wide as
       its label, so three of them need 293px, which a 390px phone at
       200% zoom does not have, and the links spilled out of the bar and
       the page scrolled sideways.

       The links fill their tracks and their labels wrap inside them. A
       link narrower than its track leaves the current page's filled
       block floating in the space, which is the "BOARD in a 480px box"
       that read as the navbar growing. */
    grid-column:1;
    display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px 16px;
    justify-content:start;
    overflow:visible;
  }
  .top nav a{
    padding:12px 4px;font-size:12px;
    /* A label that cannot fit its track breaks rather than spilling out
       of the bar. It is one line at every ordinary size.

       The link is a block, not a flex box. As a flex box its label is
       an anonymous flex item, which does not wrap: the item's minimum
       width is its content, so the label stayed on one line and ran out
       of the track and out of the bar. */
    white-space:normal;overflow-wrap:anywhere;min-width:0;
    text-align:left;letter-spacing:.02em;
    display:block;
  }
  /* The current page is a filled block. It only reads as a block if it is
     sized to its label rather than to a grid column. */
  .top nav a[aria-current="page"]{padding-left:12px;padding-right:12px}
}
@media (max-width:384px){
  /* Two columns means three rows of links, so the bar is taller again.
     Measured: 207px, plus the 3px border. */
  .top nav{grid-template-columns:repeat(2,minmax(0,1fr))}
  :root{--topbar-h:207px}
}
/* ---------- hero ---------- */
.hero{padding:40px 0 8px;border-bottom:3px solid var(--line)}
.hero h1{
  font-family:var(--font-display); font-weight:400; letter-spacing:-.04em;
  font-size:clamp(36px,7.2vw,72px); line-height:.94; margin:0 0 16px; text-transform:uppercase;
  /* The heading is one long word per line at the top of its clamp, so it
     has to be allowed to break. "WANTED" at 72px is 331px, which is wider
     than a 320px phone at 200% zoom, and the page scrolled sideways. */
  overflow-wrap:break-word;
}
.hero h1 em{font-style:normal;color:var(--red)}
.hero p{max-width:60ch;color:var(--ink-soft);margin:0 0 16px;font-size:17px}
/* The hero's lede is one size larger than a page lede, because it is the
   largest text on the site and it opens the product's one idea. The page
   lede is set by the shared .lede rule further down. */
.hero .lede{font-size:20px;color:var(--ink);letter-spacing:-.01em}
/* The hero's stats line, and the seeded caveat inside it.
   The caveat is separated from the count so it cannot be read as part of
   it, and so it cannot grow into the sentence it used to be. */
.hero .herostats{color:var(--ink-soft)}
.hero .seednote{color:var(--ink-soft)}
.hero .seednote b{color:var(--red-ink);font-weight:700}
.btn{
  display:inline-block;background:var(--ink);color:var(--paper);text-decoration:none;
  font-weight:700;font-size:14px;padding:12px 16px;border-radius:var(--radius);
  text-transform:none;letter-spacing:0;border:1px solid var(--line);
  /* 44px minimum touch target. The button was 42px, which is a miss on a
     phone. The line box is set so the padding does not have to grow. */
  min-height:44px;display:inline-flex;align-items:center;
}
.btn:hover{background:var(--red);color:#fff;border-color:var(--red)}
.btn.ghost{background:transparent;color:var(--ink)}
.btn.ghost:hover{background:var(--ink);color:var(--paper)}
.btn.sm{padding:8px 12px;font-size:13px;min-height:44px}

/* ---------- filters ---------- */
.filters{
  display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:16px 0;
  border-bottom:3px solid var(--line); position:sticky; top:var(--topbar-h); background:var(--paper); z-index:15;
}
/* The filter bar sticks, so its containing block has to be taller than
   it is. It used to sit in a .wrap of its own, and that wrap was
   exactly as tall as the bar, so the bar had nowhere to travel: it
   stayed pinned to the top of its own parent and the top of it, the
   "Show" label and the top of the chips, was cut off by the header
   above. It now sits at the top of the board's wrap, which is as tall
   as the whole board, so it can stick properly. */
.board > .wrap > .filters:first-child{margin-top:-24px;padding-top:24px}
/* On a phone the bar is four rows of chips and a sentence: 242px of a
   800px screen. A sticky bar that tall is a quarter of the viewport
   held down permanently, over the board the reader came to scan, and
   it cannot fit under the header anyway, so the browser pushes its top
   back under it. It scrolls with the page on a phone and sticks from
   the width where it fits. */
@media (max-width:560px){
  .filters{position:static}
}
.filters .label{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-soft);font-weight:800}
.chip{
  display:inline-block;padding:8px 12px;border:1px solid var(--line);border-radius:99px;
  text-decoration:none;font-weight:400;font-size:13px;background:var(--paper-2);
  /* 44px touch target on a phone. The chip was 34px tall. */
  min-height:44px;display:inline-flex;align-items:center;
}
.chip:hover{background:var(--chip)}
.chip[aria-current="true"],.chip.on{background:var(--ink);color:var(--paper)}
.count-pill{font-family:var(--font-mono);font-size:12px;color:var(--ink-soft)}
.chip .x{margin-left:8px;opacity:.7}
/* One control instead of eight boxes. Eight client chips wrapped to two
   rows and read as a table of contents for a filter. */
.clientpick{margin-left:auto}
.clientpick select{
  font-family:inherit;font-size:13px;color:var(--ink);
  padding:8px 8px;border:1px solid var(--line);border-radius:99px;
  background:var(--paper-2);cursor:pointer;
  min-height:44px;
}
.clientpick select:focus-visible{outline:3px solid var(--red);outline-offset:2px}

/* ---------- board ---------- */
.board{padding:24px 0 60px}
.cluster{
  border:2px solid var(--line);background:var(--paper-2);border-radius:var(--radius);
  margin:0 0 16px;box-shadow:var(--shadow);position:relative;overflow:hidden;
}
.cluster .topline{display:flex;align-items:stretch;gap:16px;padding:16px 16px 4px}
.rank{
  font-family:var(--font-display);font-weight:400;font-size:13px;color:var(--paper);
  background:var(--ink);width:28px;height:28px;flex:0 0 28px;display:grid;place-items:center;
  border-radius:99px;letter-spacing:-.02em;
}
.cluster h2{
  /* Archivo Black ships one weight, so a weight declaration here is a
     no-op. It read 600 here and 400 on the tally, which made the title
     look heavier than the count when they are the same face at the same
     weight. The title is bigger than the count because of its size, not
     its weight. */
  font-family:var(--font-display);font-weight:400;letter-spacing:-.012em;line-height:1.1;
  margin:0;font-size:clamp(18px,2.2vw,22px);flex:1;min-width:0;color:var(--ink);
  align-self:center;
}
.cluster h2 a{text-decoration:none}
.cluster h2 a:hover{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:4px}
/* The tally is a stamp, not a number floating in a gutter.
   It used to be a bare figure set to the right of the title, which left a
   wide hole between a short title and the far edge of the card, and read
   as two competing headlines. As a block of ink it fills that space with
   a shape the register already uses, and the count becomes the thing the
   eye lands on second rather than a stray number. */
.tallybig{
  font-family:var(--font-display);font-weight:400;font-size:clamp(28px,4.4vw,40px);
  line-height:1;letter-spacing:-.04em;font-variant-numeric:tabular-nums;text-align:center;
  flex:0 0 auto;
  background:var(--ink);color:var(--paper);
  padding:8px 16px 12px;margin:-4px -8px -4px 0;
  border-radius:var(--radius);
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  /* A long count has to be able to break rather than widen the card. */
  min-width:0;overflow-wrap:break-word;
}
.tallybig small{display:block;font-size:12px;letter-spacing:.12em;font-weight:800;color:var(--paper);text-transform:uppercase;margin-top:4px;opacity:.72}
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
  border-bottom:1px solid var(--red);padding-bottom:4px;
}
.samples{border-top:1px solid var(--line);padding:12px 16px;background:var(--chip)}
.samples p{margin:0;font-size:14px;color:var(--ink-soft)}
.samples .q{color:var(--ink)}
.tag{
  display:inline-block;font-size:12px;padding:4px 8px;
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
/* On a narrow screen the title wraps to three lines and the tally beside
   it left a column of wrapped words against a block of numbers, with
   neither of them readable.

   So the count moved below the title. What it must not do is become a
   full-width black slab: measured against the title it was carrying
   2.2 times the ink at 28px against the title's 18px, in the same face,
   so the visual order was count-then-title while the DOM order was
   title-then-count. The subject of the card was the second thing the eye
   landed on, at half the weight.

   So the count is a line of meta under the title now, not a slab. It is
   still the count the eye lands on second, because it is set in the
   display face and the title's rank badge is the only thing that
   competes with it. */
@media (max-width:560px){
  .cluster .topline{flex-wrap:wrap;gap:12px}
  .cluster h2{flex:1 1 100%;order:2;align-self:auto}
  .rank{order:1}
  .tallybig{
    order:3;flex:1 1 100%;margin:0;
    flex-direction:row;gap:8px;align-items:baseline;justify-content:flex-start;
    padding:0;
    /* No slab. The number is the display face at the title's scale, and
       the label sits beside it. The block treatment belongs to the
       desktop rule, where the count has a column of its own. */
    background:none;color:var(--ink);
    font-size:clamp(18px,2.2vw,22px);
    letter-spacing:-.012em;line-height:1.1;
    /* The number and its label are a pair that can be too wide for a
       narrow screen at a large font size: 297px at 200% zoom, against a
       320px phone. The pair wraps instead of taking the page sideways. */
    flex-wrap:wrap;min-width:0;
  }
  /* On the strip the label is the same size as the number's own
     optical weight, so the pair reads as one figure and not as a
     number with a caption stuck to it. */
  .tallybig small{margin-top:0;font-size:13px;letter-spacing:.08em;color:var(--ink-soft);font-weight:700}
  .tallybig small.addresses{font-weight:400}
  .cluster .meta{padding-top:8px}
}

/* ---------- the registry check ----------
   The first-class action on the landing page.

   It is the one thing the product does that works with no crowd, so it is
   the thing the page leads with. The board is the reason to come back;
   this is the reason to stay for two minutes. */
.check{
  border:2px solid var(--line);border-left:6px solid var(--red);
  background:var(--paper-2);border-radius:var(--radius);
  padding:16px;margin:0 0 24px;max-width:760px;
}
.check-label{
  font-size:12px;text-transform:uppercase;letter-spacing:.12em;
  font-weight:800;color:var(--red-ink);margin-bottom:4px;
}
.check-copy{margin:0 0 12px;color:var(--ink-soft);font-size:15px;max-width:60ch}
.checkform{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
/* The basis is a hint, not a width. At 320px with the reader at 200%
   zoom the effective viewport is 160px, and a 320px basis put the field
   389px wide and took the page sideways. A zero min-width lets the field
   shrink below its basis, which is what stops it. */
.checkform .field{flex:1 1 240px;min-width:0;width:auto}
.checkform .btn{flex:0 0 auto}
.check-note{margin:8px 0 0;font-size:13px;color:var(--ink-soft)}
@media (max-width:560px){
  /* The basis is the field's width on one row and its height when the
     form stacks, so it has to be reset when it stacks. Left alone it
     made the input 320px tall.

     And in a column the field's width is its content width, which is
     the placeholder's, and that is wider than the form at 200% zoom.
     So it is stretched to the form's width instead. */
  .checkform{flex-direction:column;align-items:stretch}
  .checkform .field{flex:0 0 auto;width:100%;align-self:stretch}
  .checkform .btn{width:100%;justify-content:center}
}

/* ---------- generic page ---------- */
.page{padding:32px 0 72px;max-width:760px;margin-left:auto;margin-right:auto}
.page h1{
  font-family:var(--font-display);font-weight:400;letter-spacing:-.035em;text-transform:uppercase;
  font-size:clamp(30px,5.2vw,44px);line-height:.98;margin:0 0 12px;
  /* The display face at 30px is wider than a 320px phone at 200% zoom,
     and the h1 is the one heading that cannot be shortened. */
  overflow-wrap:break-word;
}
.page h2{font-weight:700;font-size:20px;letter-spacing:-.01em;margin:32px 0 8px}
.page h3{font-weight:700;font-size:17px;margin:24px 0 8px}
/* The lede is the largest paragraph on a page.
   It used to be set by an inline style on six pages at 19px and by
   another inline style on two at 20px, so the size lived in the markup
   rather than in the stylesheet, and a reader moving between pages saw a
   one-pixel difference in the first thing they read. One rule, one
   place. The hero sets its own size because it is not a page lede.

   It sits after the muted body ink so it wins, and it is in full ink
   because the lede is the first thing a reader reads. The muted colour
   is for body copy. */
.page p,.page li{color:var(--ink-soft)}
.page p strong,.page li strong{color:var(--ink)}
.lede{font-size:19px;color:var(--ink);letter-spacing:-.01em}
.page code{
  /* The floor is 12px. A pre block is 13px and this used to be .92em of
     it, which is 11.96px: a rounding accident, and a violation of the
     recorded minimum type size. 12px exactly keeps the floor. */
  font-family:var(--font-mono);font-size:12px;background:var(--chip);
  padding:4px;border-radius:var(--radius);color:var(--ink);overflow-wrap:anywhere;
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
  pre{background:var(--chip);color:#f3eee1;border-color:var(--line)}
}
html[data-theme="dark"] pre{background:var(--chip);color:#f3eee1;border-color:var(--line)}
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
/* A count and a date are single values and must not break across lines.
   "4 times" was wrapping to two lines in a 75px column and
   "2026-11-03" to two lines in a 98px one, which made every row twice
   as tall as the text in it and broke the scan. */
.nowrap{white-space:nowrap}
@media (max-width:760px){
  th,td{white-space:nowrap}
  th:first-child,td:first-child{position:sticky;left:0;background:var(--paper)}
  th:first-child{background:var(--chip)}
}
ul,ol{padding-left:24px}
a.under{text-decoration:underline;text-underline-offset:4px}
/* A standalone underlined link is a control, not a word in a sentence.
   In the hero's action row the links were 26px tall, which is a tap
   target you have to aim at. */
.split a.under{
  display:inline-flex;align-items:center;min-height:44px;
}
/* The back link at the top of a cluster page is standalone too. */
.backlink{
  display:inline-flex;align-items:center;min-height:44px;
  font-size:14px;
}
/* A text field is a control too. The claim form inputs were 42px. */
.field{
  /* The inputs sit after a <br>, so they are inline by default and
     width:100% does nothing to them: they came out at the browser's
     default 20 characters, narrower than the card around them. */
  display:block;width:100%;
  padding:12px;font-size:16px;
  background:var(--paper-2);color:var(--ink);
  border:2px solid var(--line);border-radius:var(--radius);
  min-height:44px;
}
.field::placeholder{color:var(--ink-soft);opacity:1}
.field:focus-visible{outline:3px solid var(--red);outline-offset:2px}
/* The field on a form somebody is filling in is bigger than a field in a
   card, because the reader is typing into it. The size used to be an
   inline style on the two wish form fields, which put it in the markup
   rather than in the stylesheet. */
.field.big{font-size:17px}
.field.short{max-width:420px}
ul.archive{list-style:none;padding-left:0}
ul.archive li{margin:0 0 4px}
ul.archive li::before{content:"· ";color:var(--ink-soft)}

/* The tools on the /agents page.
   It was a two-column table, and the description column was 329px of a
   358px container at 390px. The whole of the only column that carries
   meaning was off-screen on arrival, behind a horizontal scroll with no
   affordance, on the page somebody reads to decide what to install.

   So the description is under the signature, not beside it. The
   signature is the least useful half and the description is the answer
   to "what do I want this for", so the answer is what a reader meets
   first.

   A table would be the wrong shape for a 358px screen anyway: one row
   per tool, two columns, no column relationships worth aligning. */
.tools{margin:12px 0 0}
.tools dt{
  font-size:15px;color:var(--ink);
  padding:12px 0 4px;border-top:1px solid var(--line);
  /* A function signature is a long unbreakable token in a monospace
     face. At 320px with the reader at 200% zoom the column is 128px and
     the longest signature is 181px, so it took the page sideways. */
  overflow-wrap:anywhere;word-break:normal;
}
.tools dt:first-child{border-top:0;padding-top:0}
.tools dd{margin:0 0 4px;color:var(--ink-soft);font-size:15px}

/* ---------- cards / lists ---------- */
.card{border:2px solid var(--line);background:var(--paper-2);border-radius:var(--radius);padding:20px;margin:0 0 20px}
/* A heading that opens a card sits at the card's own top edge, so it
   does not carry the page's heading margin. The rule used to be an
   inline style on three headings on the cluster page, which meant the
   markup had to know about the spacing. */
.card > h2:first-child{margin-top:0}
/* The context line under a grouped wish is secondary to the wish text
   itself, so it is in the muted ink. */
.context{color:var(--ink-soft)}

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
.foot nav a{font-size:13px;font-weight:700;text-decoration:none;color:var(--ink-soft);padding:12px 0;display:inline-block;min-height:44px}
.foot nav a:hover{color:var(--ink);text-decoration:underline}
/* The theme control.
   It used to be a script looking for a button that did not exist, and a
   localStorage read that applied a preference the reader could not see,
   could not change and could not clear. A reader with a stale value was
   pinned to a theme that ignored their system preference with no way
   back except devtools.

   So the button exists, and the control next to it clears the override
   and hands the choice back to the system. */
.foottheme{display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex-basis:100%;margin-top:12px}
.themebtn{
  font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;
  padding:12px 16px;min-height:44px;
  background:var(--paper-2);color:var(--ink);
  border:1px solid var(--line);border-radius:var(--radius);
}
.themebtn:hover{background:var(--chip)}
.themebtn:focus-visible{outline:3px solid var(--red);outline-offset:2px}
.themeclear{font-weight:400;color:var(--ink-soft)}

/* ---------- misc ---------- */
.snippet{margin:24px 0 0;border:2px solid var(--line);border-radius:var(--radius);background:var(--paper-2);padding:16px}
.snippet-label{font-size:12px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;color:var(--red-ink);margin-bottom:8px}
.snippet-note{font-size:14px;color:var(--ink-soft);margin:8px 0 12px}

/* ---------- copy button ----------
   The snippet exists to be pasted somewhere, so getting it out of the page
   is part of the snippet rather than a nicety next to it. The code stays
   selectable by hand, so the button is a shortcut and not a requirement.

   The button sits inside the code block, on the dark, so the block reads
   as one shape. It used to float over the top right corner of the block
   and the code ran underneath it: the reserved space was a hard-coded
   96px and the button on the weekly page is 105px wide, so the tail of
   the badge URL was hidden behind the label.

   The block is a grid. The code takes the first column and the button
   takes the second, so the code gets out of the way by itself and a
   longer button label widens the column rather than overlapping the
   code. A hard-coded reservation cannot do that: it is wrong the moment
   a label is longer than the value it was written for. */
.copyrow pre{
  display:grid;grid-template-columns:minmax(0,1fr) auto;
  align-items:start;column-gap:12px;
}
.copyrow pre code{
  grid-column:1;grid-row:1;
  /* The code is a grid item of the pre, so it has to be a block. */
  display:block;
  /* A long snippet needs to wrap rather than run under the button. The
     markdown badge snippet is 130 characters and was disappearing
     behind the copy control.

     word-break:break-all stopped the run-under, but it also broke
     words mid-syllable. Measured at 320px, the install snippet rendered
     as 25 lines with 24 of them broken mid-word: "MC/P",
     "toolswa|nted.dev", "pub/lic", "capabiliti|es". The URL, the one
     thing in the snippet a reader has to transcribe correctly, was
     broken in half.

     overflow-wrap:anywhere breaks a word only when it cannot fit on a
     line by itself, so prose breaks at spaces and a single long token
     still breaks rather than running under the button. */
  white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal;
}
.copybtn{
  grid-column:2;grid-row:1;
  font-family:var(--font-mono);font-size:12px;line-height:1;
  padding:8px 12px;border:1px solid var(--line);border-radius:var(--radius);
  background:var(--paper-2);color:var(--ink);cursor:pointer;
  font-weight:700;text-transform:uppercase;letter-spacing:.06em;
  white-space:nowrap;
  /* 44px is the touch target minimum. The button was 30px tall, which
     is a tap target you have to aim at on a phone. */
  min-height:44px;display:flex;align-items:center;justify-content:center;
}
.copybtn:hover{background:var(--chip)}
.copybtn:focus-visible{outline:3px solid var(--red);outline-offset:2px}
.copybtn.done{background:var(--ink);color:var(--paper);border-color:var(--ink)}
/* On a narrow screen the button would squeeze the code into a column too
   narrow to read, so it takes a row of its own above the code. */
@media (max-width:520px){
  .copyrow pre{grid-template-columns:minmax(0,1fr)}
  .copyrow pre code{grid-column:1;grid-row:2}
  .copybtn{grid-column:1;grid-row:1;justify-self:start;margin-bottom:8px}
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
/* On a phone the three hero actions stack. The row gap is tighter than
   the column gap so the group reads as one block of links rather than
   three separate paragraphs. */
@media (max-width:560px){
  .split{gap:4px 16px}
}
.ticker{font-family:var(--font-mono);font-size:12px;color:var(--ink-soft)}
.ticker b{color:var(--red-ink)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.new{animation:flash 2.4s ease-out}
@keyframes flash{from{background:var(--red);color:#fff}to{background:transparent}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

/**
 * The filter bar sticks below the top bar, so the offset it sticks at
 * has to be the top bar's height.
 *
 * The offset used to be a number in the stylesheet that somebody had
 * measured by hand: 160px at 760px and under, 208px at 380px and under.
 * Both were one pixel short, because the header has a 3px bottom border
 * that sits outside its content box. The filter bar therefore stuck one
 * pixel inside the header, and on a phone the top of it, the "Show"
 * label and the top of the filter chips, was cut off by the header
 * above it.
 *
 * A measured number is wrong the moment anything about the bar changes.
 * The bar's height depends on the font, the number of links, the
 * wrapping, and the user's own font size, so it is measured at runtime
 * instead: the header publishes its own height and the filter bar reads
 * it.
 *
 * The number in the stylesheet stays as the value for the first paint,
 * before the script has run. It is the fallback, not the truth.
 *
 * The height is measured with offsetHeight, not getBoundingClientRect.
 * A rect is in device pixels and a custom property is in CSS pixels, so
 * at 200% zoom the rect was twice the real height and the token was
 * written at 454px for a bar that is 227px. The filter bar then stuck at
 * an offset twice as far down as the header actually is, and it sat
 * underneath the header. offsetHeight is the border-box height in CSS
 * pixels, it includes the 3px border the filter bar has to clear, and
 * it does not change with the reader's zoom.
 */
export const STICKY_SCRIPT = `<script>
(function(){
  var last = 0;
  function measure(){
    var top = document.querySelector('.top');
    if(!top) return;
    // offsetHeight is the border-box height in CSS pixels: it includes
    // the 3px bottom border, which is what the filter bar has to clear,
    // and it is the same number whatever the reader's zoom.
    var h = top.offsetHeight;
    if(!(h > 0) || h === last) return;
    last = h;
    // Only write when the stylesheet's value is wrong.
    //
    // The stylesheet carries the bar's height for every width, so at
    // the reader's default font size it is already right and there is
    // nothing to correct. Writing it anyway put --topbar-h into the
    // html element's inline style on every page, which changed the
    // document for no reason and made the html look as though it was
    // being rewritten.
    //
    // The script's job is the case the stylesheet cannot know: a
    // reader whose font size is not the default, or who has zoomed in.
    var current = getComputedStyle(document.documentElement).getPropertyValue('--topbar-h');
    if(current && parseFloat(current) === h) return;
    document.documentElement.style.setProperty('--topbar-h', h + 'px');
  }
  measure();
  // The bar changes height when the window changes, when the font
  // loads, and when the reader zooms in.
  if(window.ResizeObserver){
    var top = document.querySelector('.top');
    if(top) new ResizeObserver(measure).observe(top);
  }
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  // The display face swaps in after the first paint, and it changes the
  // height of the wordmark. The font is inlined as a data URL, so it
  // arrives with the stylesheet, but the browser still lays out once
  // with the fallback first.
  if(document.fonts && document.fonts.ready){
    document.fonts.ready.then(measure).catch(function(){});
  }
})();
</script>`;

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  ogType?: string;
  noindex?: boolean;
  extraHead?: string;
  nav?: string;
  /**
   * The version of the deploy, used to bust the browser's cache on the
   * static assets.
   *
   * The stylesheet was served with a 24 hour max-age and no filename
   * that changed, so a change to the CSS was invisible to a returning
   * visitor for a whole day. A shift-reload was the only way to see it,
   * and a page whose script and stylesheet disagree behaves as though
   * the fix did not land.
   *
   * The version goes in the query string of the asset's URL, so a deploy
   * changes the URL, the browser asks for the new one, and the old URL
   * can stay cached for as long as it likes.
   */
  assetVersion?: string;
}

const NAV = [
  { href: "/", label: "Board" },
  { href: "/weekly", label: "Weekly" },
  { href: "/agents", label: "For agents" },
  { href: "/build", label: "Build one" },
  { href: "/wish", label: "File a wish" },
  { href: "/about", label: "About" },
];

/** The main navigation, with the current page marked for assistive tech. */
function nav(current: string): string {
  return NAV.map(
    (n) =>
      `<a href="${escAttr(n.href)}"${n.href === current ? ' aria-current="page"' : ""}>${esc(n.label)}</a>`
  ).join("");
}

export function layout(meta: PageMeta, content: string): string {
  const site = "Tools Wanted";
  const fullTitle = meta.title === site ? meta.title : `${meta.title} · ${site}`;
  const ogImage = meta.ogImage ?? "/og/default.png";
  // The static assets carry the deploy's version, so a deploy changes
  // their URL and the browser asks for the new ones. Without it the
  // stylesheet stayed in the browser's cache for a day.
  const v = meta.assetVersion ? `?v=${encodeURIComponent(meta.assetVersion)}` : "";
  const styleHref = `/style.css${v}`;
  const fontHref = `/font.css${v}`;
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
<link rel="alternate" type="application/rss+xml" title="Tools Wanted: most wanted" href="/feed.xml">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.svg?scheme=dark" type="image/svg+xml" media="(prefers-color-scheme: dark)">
<link rel="stylesheet" href="${escAttr(styleHref)}">
<link rel="stylesheet" href="${escAttr(fontHref)}">
<link rel="preload" href="${escAttr(fontHref)}" as="style">
<script>
/* The theme control.
   It used to be a script looking for a button that did not exist, and a
   localStorage read that applied a preference the reader could not see,
   could not change and could not clear. A reader with a stale value was
   pinned to a theme that ignored their system preference with no way
   back except devtools.

   The script is in the head and the button is in the footer, so the
   button is not in the document when this runs. The wiring waits for
   the DOM, and the theme attribute is applied at once, before the
   first paint, so the page never flashes the wrong theme.

   The button's label has to name the theme the reader would get, not
   the one they would get if they had an override set. The data-theme
   attribute is only set by this script, so a reader whose operating
   system is dark and who has never touched the toggle sees a page that
   is already dark, and a button that says "Dark mode". The system
   preference is what decides when there is no override. */
(function(){
  try{
    var stored=localStorage.getItem('tw-theme');
    if(stored==='light'||stored==='dark')document.documentElement.setAttribute('data-theme',stored);
    function effectiveDark(){
      var forced=document.documentElement.getAttribute('data-theme');
      if(forced==='dark')return true;
      if(forced==='light')return false;
      return !!(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    function label(){return effectiveDark()?'Light mode':'Dark mode';}
    function wire(){
      var b=document.getElementById('themebtn');
      if(b){
        b.textContent=label();
        b.onclick=function(){
          var next=effectiveDark()?'light':'dark';
          document.documentElement.setAttribute('data-theme',next);
          localStorage.setItem('tw-theme',next);
          b.textContent=label();
        };
      }
      var d=document.getElementById('themeclear');
      if(d)d.onclick=function(){
        document.documentElement.removeAttribute('data-theme');
        localStorage.removeItem('tw-theme');
        if(b)b.textContent=label();
      };
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);
    else wire();
    // A reader whose system changes their theme while the page is open
    // should see the button follow it.
    if(window.matchMedia){
      var mq=window.matchMedia('(prefers-color-scheme: dark)');
      if(mq.addEventListener)mq.addEventListener('change',function(){
        var b=document.getElementById('themebtn');
        if(b)b.textContent=label();
      });
    }
  }catch(e){}
})();
</script>
${meta.extraHead ?? ""}
</head>
<body>
<header class="top"><div class="wrap">
  <a class="logo" href="/"><b>Tools</b> Wanted</a>
  <nav aria-label="Main">${nav(meta.nav ?? "")}</nav>
</div></header><main>
${content}
</main>
<footer class="foot"><div class="wrap">
  <p>Tools Wanted, a public board of the capabilities AI agents have got stuck on.<br>Wishes are filed by agents, sanitised, and never executed. Some are filed by our own agents to seed the board: they are labelled seeded and are not counted as agents.</p>
  <nav>
    <a href="/agents">Agents</a><a href="/api/top">API</a><a href="/llms.txt">llms.txt</a>
    <a href="/feed.xml">RSS</a><a href="/privacy">Privacy</a><a href="/about">About</a>
  </nav>
  <div class="foottheme">
    <button type="button" id="themebtn" class="themebtn">Dark mode</button>
    <button type="button" id="themeclear" class="themebtn themeclear">Use my system theme</button>
  </div>
</div></footer>
${COPY_SCRIPT}
${STICKY_SCRIPT}
</body>
</html>`;
}
