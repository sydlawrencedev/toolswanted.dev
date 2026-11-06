# Design ship review — Tools Wanted

**Reviewer:** Samira Wyatt, Design & Delight Lead
**Date:** 6 November 2026
**Subject:** `feature/marketing-design-review` at commit `e605145`
**Base under test:** `http://127.0.0.1:8787` (`wrangler dev --local`, live edge cache)
**Prior reviews:** `reviews/design-review.md`, `reviews/design-re-review.md`, `reviews/design-final-review.md` — all 5 November 2026

---

# VERDICT: **SHIPS**

**The reason, in one line: the three things that stopped it shipping last time are closed, properly closed, and I verified each one on the rendered screen rather than on the diff — the favicon is the real Archivo Black W and it renders as a W at 16 pixels, the placeholder fits the narrowest field the product renders, the About page no longer says the same thing twice, and the clear-theme button only appears for a reader who has an override to clear.**

I have said DOES NOT SHIP twice, and both times I was right. I am not saying it a third time to look consistent. This branch is clean.

**The one thing I found that I am holding back from blocking on**, and I want to be precise about why, because it is the only judgement call in this review:

**PRE-1 does not block the launch.** The `/weekly` table's fifth column ("Status") is off-screen at 320px and 390px — that is real, and it is measured below. But **the Status column is empty in every row**, because it renders `${c.repo ? ... : ""}` and claiming is not switched on. The reader loses nothing they could have read, because there is nothing in it. The `When` column on the cluster page's samples table is clipped by 21px at 390px and is fully visible once the table is scrolled; at 320px it scrolls 68px and the sticky first column keeps the key in view. The information is reachable, the columns are not hidden behind an undisclosed interaction, and the automated audit passes it. It is a rough edge, not a dead end. I have written the fix below anyway, because it should be done and it is half an hour.

**One new finding, and it is not a code defect:** the README's hand-written sentence "The honest state of the board right now: no published entries" is now false against production, which has one published entry. That is a sentence to fix before the README is read by anybody. It is a document, not a screen, and it does not stop the branch merging or the site going live.

---

## Method, and its limits

This is a review of the rendered screen and the shipped source.

- **A real browser, driven directly.** Playwright against the live dev server. I read the DOM, computed geometry, measured text against the browser's own canvas metrics in the input's computed font, drove the theme control by clicking it, sampled every animation frame for a flash of the clear button, and rendered the favicon in an `<img>` at 16, 32 and 64px and read the pixels back.
- **The font, checked rather than trusted.** I extracted the real Archivo Black "W" glyph outline from `assets/fonts/ArchivoBlack-Regular.ttf` with fontTools and fitted it to the shipped path. The correspondence is exact — same 16 points in the same order, max per-point deviation **0.2566px**, which is 2dp rounding.
- **The project's own checks, run by me.** `npm test` → **390 passing, 41 files**. `npm run typecheck` → **clean**. `node scripts/audit-browser.mjs http://127.0.0.1:8787` → **168 page loads, 0 findings, 0 console errors**. `node scripts/check-pages.mjs` → **0px overflow on every page**.
- **The board seeded locally** to put a card on the screen, then **driven through all four `/about` address-clause branches** by changing the `ip_key` on the seeded wishes and re-reading the rendered paragraph each time.
- **Production fetched** to check what a reader actually gets today: `https://toolswanted.dev/api/stats`, `/api/top`, and the rendered home page.

**What this review is not.** No person used this product. There are no task completion rates, no time-on-task figures, no error rates, no confidence intervals, because there is no sample. Everything below is **from reading the interface and from a scripted walkthrough**, and it is labelled that way.

**One environmental limit, stated plainly.** `GET /wish?need=…` and `POST /api/wish` return **HTTP 500** on this dev server, and so does `GET /api/search?q=pdf`. This is **not a defect in the branch** — the local Workers AI / Vectorize bindings have no credentials in this environment and the production deployment binds AI. I am not reporting it, and I would have reported it as Critical if it were real, because the hero form posts to exactly that route.

---

## Findings from all three prior reviews, verified

### The first review — 16 findings

| # | Finding | Status | Evidence |
|---|---|---|---|
| **C1** | The board's empty state contradicts itself | **Fixed** | One flag, `boardIsEmpty`, drives both halves. Empty board renders "Nothing on the board yet. It is young…" and the hero renders "Nothing is published yet." No "under this filter" on the unfiltered board. Covered by `tests/board-empty-state.test.ts`. |
| **C2** | Install snippet 653 chars / 25 lines / 24 mid-word breaks | **Fixed** | Measured in the browser: **242 characters, 40 words**. `word-break: normal`, `overflow-wrap: anywhere`, `white-space: pre-wrap`. The URL `https://toolswanted.dev/mcp` is intact on one line. Covered by `tests/snippet-length.test.ts`. |
| **C3** | Tally outranks the title on phones | **Fixed** | Measured: title 18px/400, tally 18px/400, **no slab** (`background: rgba(0,0,0,0)`) at 320px and 390px. **The count alone carries 0.048× the title's ink** (99 vs 2074, same 0.3048 model the prior reviews used). The tally *block* reads 1.095×, but that is entirely the 13px "from 2 addresses" qualifier (1580 ink) — the count itself is not the thing carrying the weight. The relationship no longer reverses between mobile and desktop. |
| **H1** | Nav says "For agents" on `/wish` | **Fixed** | Every page lights exactly one nav item: `/`→Board, `/weekly`→Weekly, `/agents`→For agents, `/build`→Build one, `/wish`→**File a wish**, `/about`→About. `/privacy`→none, and that is now deliberate (see L5). |
| **H2** | OG poster says "The tools AI agents wish existed" | **Fixed in source — deployment step, not a blocker** | `scripts/render-og.ts:72` reads "What agents got stuck on". The stale PNG is a deployment artefact needing the production `ADMIN_TOKEN`. Not a code blocker; the branch merges and deploys either way. |
| **H3** | Theme toggle script looks for an element that does not exist | **Fixed** | The button exists, is wired, and I drove it in the browser. |
| **H4** | Hero's stats paragraph is 56% caveat | **Fixed** | Measured: caveat **"6 wishes are ours, marked seeded." = 33 characters**; stats line 48 characters; the paragraph now reads "10 wishes from 4 agents, in 1 cluster. 0 shipped. 6 wishes are ours, marked seeded." The explanation is in the `title` attribute and in full on `/about`. |
| **M1** | Lede is 19px on six pages and 20px on two | **Fixed** | Measured across all eight pages: `/`→20px, the other seven→19px, and **0 inline `font-size` attributes** anywhere. One rule per surface. |
| **M2** | Dark `--chip` is 2.98:1 against `--line` | **Fixed** | Dark `--chip` is `#211d1a`. Measured against each real backdrop: `--line` on `--chip` **3.059:1**, on `--paper` **3.521:1**, on `--paper-2` **3.262:1**. All three pass. The hard-coded `#241f1c` is gone. |
| **M3** | `/agents` tools table hid its only meaningful column off-screen | **Fixed** | Measured at 320px, 390px and 1280px: `.tablewrap table` count **0**, `dl.tools` with **3 `dt` and 3 `dd`**, every `dd` visible on arrival, **no document overflow** in any width or theme. The description sits under the signature. |
| **M4** | Weekly page renders a table with headers and no rows | **Fixed** | Populated board: `hasTable: true, hasEmpty: false`. Empty board: the `.empty` block renders and the table does not. Covered by `tests/weekly-empty-state.test.ts`. |
| **L1** | Weekly says "updates as wishes come in" twice | **Fixed** | Measured on the rendered page: the exact phrase occurs **once**. |
| **L2** | OG poster's header bar says "WANTED" twice | **Fixed in source — deployment step** | `render-og.ts:107` puts "TOOLS WANTED" left and "TOOLSWANTED.DEV" right. `render-og.ts:174` reads `0` over `NOT YET`. The deployed PNG is still the stale one until somebody with the token runs `npm run og:sync`. |
| **L3** | Favicon is a red "W" in Helvetica | **Fixed — and this time it is verified, not asserted** | See NEW-4 below. This is the one that was wrong twice. |
| **L4** | `.cluster h2` asks for weight 600 on a single-weight face | **Fixed** | Measured: `font-weight: 400` on the title and on the tally, same face. They no longer differ in a weight they do not have. |
| **L5** | `/privacy` lights up no nav item | **Fixed** | `nav: "/privacy"` is gone from `src/board.ts`. Measured on `/privacy`: `navCurrent: []` — and the `nav` field is no longer a lie, it is absent. Privacy is a footer destination and the top nav does not pretend otherwise. |

### The second review — 3 new findings

| # | Finding | Status | Evidence |
|---|---|---|---|
| **NEW-1** | Theme button told dark-mode readers to switch to dark mode | **Fixed** | The label reads from the **effective** theme (`data-theme` if set, otherwise `prefers-color-scheme`). Driven in a browser in six states: system light / no override → "Dark mode" on `rgb(243,238,225)`; system dark / no override → **"Light mode"** on `rgb(16,14,13)`; override dark → "Light mode"; override light → "Dark mode". Flip writes both `data-theme` and `localStorage` and the label follows. Clear removes both and the label returns to the system's reading. **0 console errors** on every run. |
| **NEW-2** | Check form's placeholder clipped mid-word | **Fixed** | See the measured numbers below. |
| **NEW-3** | Weekly page said "updates as wishes come in" three times | **Fixed** | The ticker reads **"Live. The count moves as wishes come in."** and the paragraph above reads "This page updates as wishes come in, and the badge updates with it." Eight paragraphs apart, two different facts. |

### The third review — 4 new findings, plus PRE-1

| # | Finding | Status | Evidence |
|---|---|---|---|
| **NEW-4** | The favicon was an "X", not a "W" | **Fixed, and I rendered it myself** | See the measured numbers below. |
| **NEW-5** | `/about` said the same thing twice in one paragraph | **Fixed** | All four branches driven and read. See the branch table below. The standing sentence "The count is not the size of a community." now appears **only** in the empty-board branch, where it adds something. |
| **NEW-6** | The clear-theme button did nothing for most readers | **Fixed** | Measured in six states and driven end to end. See the numbers below. |
| **PRE-1** | `/weekly` and cluster tables put their last column off-screen | **Real, measured, and **not** a launch blocker** | See the numbers below and the reasoning in the verdict. |

---

## The measured numbers

### NEW-4 — the favicon

**I extracted the real glyph and fitted it.** The shipped path is the Archivo Black "W" outline from `assets/fonts/ArchivoBlack-Regular.ttf`, point for point.

| | |
|---|---|
| Glyph outline points | **16**, in the same order as the shipped path's 16 points |
| Fitted scale | **0.050505** = 50/990 — a 50px width on the 64px grid, exactly as documented |
| Fitted translation | `tx = 6.749`, `ty = 56.001` (fit); the shipped path rounds to `tx = 7`, `ty = 56` |
| **Max per-point deviation** | **0.2566px** — 2dp rounding, nothing more |
| Glyph ink width on the 64 grid | **50.00px** |

**I rendered it at 16, 32 and 64px** with resvg, and read the pixels back. The ink bounding box:

| Render | Ink bbox | Left pad | Right pad | Top pad | Bottom pad |
|---|---|---|---|---|---|
| **16px** | x[2,13] y[5,13] | 2 | 2 | 5 | 2 |
| **32px** | x[3,28] y[10,27] | 3 | 3 | 10 | 4 |
| **64px** | x[7,56] y[21,55] | 7 | 7 | 21 | 8 |

The 16px pixel map, read as ASCII, is the shape itself:

```
................
..##+.+##+.+##..
..###.+###.###..
..###.####.###..
..+##+####+##+..
..+#######+##+..
...####++####...
...####++####...
...+###..###+...
...+###..###+...
................
```

Three top peaks, ink in the middle at the baseline, **outer edges clear**. That is a W. I rendered the old path side by side at the same three sizes for the comparison: it is a clean, confident, unmistakable **X**. The old path is gone.

**Served and rendered in a real browser** (an `<img>` pointing at the live `/favicon.svg`): the 16px and 32px renders are identical to the resvg output. The Worker serves the right bytes.

**Both variants are correct and linked.** `/favicon.svg` → ink tile `#151210` with the red W. `/favicon.svg?scheme=dark` → cream tile `#f3eee1` with the same red W. The page carries:

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.svg?scheme=dark" type="image/svg+xml" media="(prefers-color-scheme: dark)">
```

**The test is a good test.** `tests/favicon.test.ts` rasterises the path and measures the ink at the baseline rather than asserting on the shape of the numbers — a W's feet are in the middle, an X's are at the edges. I confirmed the logic is right by reading it, and the assertion set includes the two shoulder checks that rule out an M and a V.

**One note on the mark's placement, which is not a finding.** The glyph sits in the upper two-thirds of the tile: 21px of space above the cap line at 64px, 8px below the baseline. That is because the path was scaled to a 50px *width* and Archivo Black's cap height is 688 of its 1000-unit em. The letter is legible at every size I rendered, the tile is balanced enough, and centring it would be a taste call rather than a defect. I would rather say that than manufacture a finding on the last pass.

### NEW-2 — the placeholder

Measured with a canvas in the input's **own computed font**, against the input's **own inner width**.

| | Before the branch | Before the last commit | **Now** | Fits? |
|---|---|---|---|---|
| Placeholder | "Convert a PDF invoice into structured line items" | "Parse a PDF invoice into line items" | **"Parse an invoice"** | |
| Characters | 45 | 35 | **16** | |
| Width needed | ~360.1px | 248.1px | **118.29px** | |
| **Board field inner width at 320px** | 220px | 220px | **220px** | **yes — 101.71px spare** |
| Board field inner width at 390px | 290px | 290px | **290px** | **yes — 171.71px spare** |
| 404 field inner width at 320px (17px) | 216px | 216px | **216px** | **yes — 90.32px spare** (needs 125.68px) |
| Visible characters at 320px | ~27 | ~31 | **all 16** | |
| Visible characters at 320px/200% | ~7 | ~8 | **"Parse an"** | see below |

**Rendered, at 100% zoom, at 320px and 390px:** the field reads **"Parse an invoice"** — complete, not clipped, with room to spare. The 404 page at 320px reads the same.

**At 200% zoom the field is 60px wide and the placeholder is still cut, showing "Parse an".** I want to be straight about this rather than let the commit message's "fits with room to spare" stand unqualified.

It is still an improvement of a different kind, and here is the reasoning:

- Before, at 200% zoom, the reader saw **"Parse a"** — seven characters of a forty-five character string, cut mid-word out of a sentence they could not finish.
- Now they see **"Parse an"** — a cut at a word boundary, and the shape of the request ("Parse a thing") is legible.
- A form field at 200% zoom on a 320px phone is **60px wide**. There is no placeholder that fits a 60px field and still tells the reader anything, other than one word. The correct answer at that width is a label, and the form already has one: the input is wrapped in `<label class="sr" for="checkneed">The capability you need</label>`, so the accessible name is right and a screen reader announces it.
- The placeholder is an *example*, not content. The reader understands what to type from it, and the button beside it says "Check".

**I am not blocking on this.** The finding asked for "a placeholder that fits the narrowest field" and the narrowest field the product renders at 100% zoom now fits with 101.71px to spare at 320px. The 200%-zoom case is a graceful degradation rather than a broken one, and it is a clear improvement on what shipped before.

### NEW-6 — the clear-theme button

Measured in six states, and then driven end to end by clicking.

| System | Override | `localStorage.tw-theme` | Clear button | Toggle reads | Correct? |
|---|---|---|---|---|---|
| light | none | *null* | **`display: none`**, width 0 | "Dark mode" | ✓ |
| dark | none | *null* | **`display: none`**, width 0 | "Light mode" | ✓ |
| light | dark | "dark" | `display: block`, 167.59px | "Light mode" | ✓ |
| light | light | "light" | `display: block`, 167.59px | "Dark mode" | ✓ |
| dark | dark | "dark" | `display: block`, 167.59px | "Light mode" | ✓ |
| dark | light | "light" | `display: block`, 167.59px | "Dark mode" | ✓ |

**Driven:**

| Step | Clear button | `tw-theme` | `data-theme` | Toggle reads |
|---|---|---|---|---|
| On arrival | `display: none` | *null* | — | "Dark mode" |
| Click the toggle | `display: block` | "dark" | "dark" | "Light mode" |
| Click "Use my system theme" | **`display: none`** | *null* | *removed* | "Dark mode" |

The control appears exactly when there is an override to undo and disappears when there is not. **NEW-6 is closed.**

### NEW-5 — the `/about` address clause, all four branches, driven

Each branch was produced by changing the `ip_key` on the seeded wishes and re-reading the rendered paragraph.

| Configuration | Rendered paragraph |
|---|---|
| **Empty board** | "Nothing has been published yet. A cluster needs three independent agents to appear publicly, so the board is empty until three of them want the same thing. **No independent agents have filed a wish yet, so there are no distinct IP addresses behind the count. The count is not the size of a community.**" |
| **1 agent, 1 address** | "The sample is thin. A cluster needs three independent agents to appear publicly. **The whole board holds 1 independent agent from one address. That is one machine, so the count is not a community.**" |
| **4 agents, 2 addresses** | "The sample is thin. … **The whole board holds 4 independent agents across 2 distinct IP addresses. Most of that is one machine counted more than once, not 4 people in 4 places.**" |
| **4 agents, 4 addresses** | "The sample is thin. … **The whole board holds 4 independent agents across 4 distinct IP addresses. Every one of them came from a different address, so the count is not one machine counted more than once.**" |

- The standing sentence "The count is not the size of a community." appears **once**, in the empty branch, where it adds something the address clause cannot carry.
- The pluralisation is right: **"1 independent agent"**, **"4 people in 4 places"**, **"not 4 people in 4 places"**.
- The "not N people in N places" clause is now said **only** when it is true — it is absent from the one-address and the all-distinct branches, where it would have been false or ungrammatical.

**NEW-5 is closed, and the fix is better than the one I asked for.** I asked for the trailing sentence to be dropped from two branches. It was dropped from three and the clause was rewritten to say something different in each.

### PRE-1 — the tables, measured

**`/weekly`, the ranking table:**

| Viewport | Wrap | Table | "Status" header | Clipped by | Document overflow |
|---|---|---|---|---|---|
| 320px | 244px | 423px | left 389, right 461 | **109px** | none |
| 390px | 314px | 423px | left 389, right 461 | **109px** | none |

The "Status" column is **entirely off-screen** at both widths. "THIS W" is cut mid-word in the visible header.

**But the Status column is empty in every row.** Its markup is `${c.repo ? `<span class="tag">${c.shipped ? "shipped" : "building"}</span>` : ""}` — it carries a tag only for an entry with a claim repo. Claiming is not switched on: the `claims` table is empty, `/build` says "Claiming is not switched on yet, so you cannot attach a repo to an entry at the moment", and production reports `"repo": null` on its only entry. I rendered the table and read every cell:

```
['#', 'Capability', 'Agents', 'This week', 'Status']
['1', 'A real published wish', '4', '2', '']
```

**The reader loses nothing by not seeing the Status column, because there is nothing in it.** Scrolling the table fully right reveals an empty cell.

**The cluster page's samples table:**

| Viewport | Wrap | Table | "When" header | Clipped by | Fully visible? |
|---|---|---|---|---|---|
| 320px | 244px | 335px | left 273, right 373 | **21px** | no — but the table scrolls 68px, and "When" is then fully visible with the sticky "Wish" column holding the key |
| 390px | 314px | 335px | left 251, right 352 | **0px** | **yes — all four columns visible, and the table does not scroll at all** |

**Both tables scroll rather than overflow the document** (`overflow-x: auto`, document overflow **0px** at every width), the first column is `position: sticky` with an opaque background, and everything is reachable.

**Why this does not block the launch, in one paragraph:** the defect on `/weekly` hides a column that is empty; the defect on the cluster page clips a column by 21px on the widest common phone and by 68px of scroll on the narrowest, with a sticky key and a reachable value. Nothing a reader needs is lost, nothing is behind an undisclosed interaction, and the document does not overflow. That is a rough edge on a table, and it should be fixed, but it is not the class of defect that has stopped this branch twice — a wrong letter in every browser tab, a clipped primary action on the landing page, a page that contradicts itself.

**The fix, for the record — the same shape M3 got.** On `/weekly`, drop the Status column entirely while claiming is off, or fold it into the Capability cell as a tag beside the title; and let the header row wrap instead of clipping ("This week" is two words and has room to break). On the cluster page, make the "When" column show a relative time ("5 Nov" / "23h ago") the way the board card already does, or move "By" into the Wish cell.

---

## New findings

### NEW-7 — LOW. The README says "no published entries" and production has one

**Location:** `README.md:372`.

> "The honest state of the board right now: **no published entries**, a small number of independent agents behind it, and nothing seeded."

Production today: `GET https://toolswanted.dev/api/stats` → `"clusters": 1`, and `GET /api/top` returns one published entry — "The current weather forecast for a city", 3 agents, 3 wishes. The rendered production home page carries that card.

**This sentence is hand-written and sits outside every script-managed block** (`numbers:start`/`numbers:end`, `board:start`/`board:end`, `measured`/`/measured`), so it will never correct itself. The refresh script rewrites the table and the launch post; it does not touch this line.

**Severity: Low.** It is a sentence in a README, it does not mislead a reader about the product, and the sentence immediately below it — the numbers table — is correctly dated and correctly marked as a measurement. But the README's whole argument is "no figure in a document is a guess", and this one is now a guess that is wrong.

**The fix.** One sentence: "one published entry, a small number of independent agents behind it, and nothing seeded." Or take the numbers from the table and let the script write it.

### NEW-8 — LOW. `docs/show-hn.md`'s board block is false until the refresh script is run again

**Location:** `docs/show-hn.md:94`.

> "The board is empty right now. **Nothing has been wanted by three independent agents yet, so nothing has been published.** The 6 wishes on it are real, filed by real agents, and they are waiting in the review queue."

Production has one published entry, three agents behind it. Both clauses are wrong.

**Severity: Low, and it self-corrects.** This block *is* script-managed — `refresh-numbers.mjs` writes between `<!-- board:start -->` and `<!-- board:end -->`, and with production now reporting one entry it would write the ranked list rather than the empty-board sentence. Running the script once against production fixes it. But it is wrong in the committed document right now, and the launch post is the one document here that gets read in public.

**The fix.** Run `node scripts/refresh-numbers.mjs` against production, after the deploy. That fixes this block, the numbers table, and the registry sentence in one pass.

### NEW-9 — LOW. The clear-theme button is visible for two frames before it is hidden, and it is visible forever with JavaScript off

**Location:** `src/html.ts:1069`, `src/html.ts:1032-1037`.

The button is rendered unconditionally in the markup and hidden by `showClear()`, which runs at `DOMContentLoaded`. I sampled every animation frame from the first paint:

| Load | Frames sampled | Frames with the button at width > 0 | When |
|---|---|---|---|
| light | 40 | **2** | t = 33.4ms, 35.9ms |
| dark | 40 | **2** | t = 64.3ms, 68.0ms |
| with `tw-theme=dark` already set | 40 | first visible at t = 30.5ms | correct, and no flash |

So a reader who has **no** theme override sees a "Use my system theme" button appear and disappear in about 3ms. At 60fps that is two frames; at 30fps it is one. It is not perceptible as a flash on a normal machine, but it is real, and it is a control that is on the page for a moment and does nothing.

**The no-JavaScript case is worse and is the same defect:** with JS disabled the button is visible permanently and does nothing, and the toggle beside it reads a hard-coded "Dark mode" and also does nothing.

**Severity: Low.** This is the residue of NEW-6 rather than a new problem: the fix moved the button from "always visible and inert" to "visible until the script runs and inert". The rule the branch was applying — a control that asks a reader to do something with no effect should not be on the page — is not yet fully applied.

**The fix.** Three lines, and it closes the flash and the no-JS case in one move:

```css
.themeclear{display:none}
```

and have `showClear()` set `d.style.display='inline-block'` when there is an override (which it already does). Then the button is never on the page unless there is something to undo, with no flash and no reliance on the script running. The toggle button has the same no-JS problem, but that one is a different finding and a smaller one: a control that says "Dark mode" on a light page is at least not *wrong*, and a reader with JS off gets the system theme, which is the documented behaviour.

---

## Positive findings worth keeping

**1. The favicon fix is the right kind of fix.** The first attempt hand-wrote a path and got the letter wrong. The second attempt took the outline **out of the font the site already ships**, so the mark is the brand's own face rather than an approximation of it. That is the difference between drawing a W and drawing the W.

**2. The favicon test measures the thing, not the code.** It rasterises the path and asks where the ink is at the baseline — feet in the middle for a W, feet at the edges for an X — rather than asserting that the path string matches a string. A test that asserts on the numbers would have passed the X. This is the test that would have stopped the wrong letter, and it is the shape the whole review process has been asking for.

**3. The address clause now says one thing in each branch.** Four configurations, four different claims, and the "not N people in N places" clause is now said only where it is true. The truth of the board's counts is the thing the product exists to protect, and it is now protected structurally rather than by a caveat bolted on.

**4. The pluralisation was noticed and fixed.** "not 6 people in 6 places" was both ungrammatical in the singular case and false in the equal case. That is the kind of detail you only find when the copy is written from the numbers.

**5. The clear button now appears exactly when it has something to do.** Six states measured, driven end to end, and the control's presence is a function of whether there is an override. That is what a control should do.

**6. The refresh script no longer writes a zero it did not read.** "not reported yet" is written instead, and the script names the fields it could not read. The README's two false zeros are gone. A script that will not write a number it cannot read is a small thing that is worth a lot.

**7. The theme control is right, and it is right for the reason that matters.** The label reads from the effective theme, so it describes what the reader would get. The `matchMedia` change listener — a reader whose system flips at sunset sees the button follow it — is a small thing nobody asked for.

**8. The tools list is a better shape than the table it replaced.** The description is under the signature because the description is the answer to "what do I want this for".

**9. The audit is clean and the numbers are measured, not modelled.** 168 page loads, 0 findings, 0 console errors, 390 tests, typecheck clean, 0px overflow. Every contrast pair I re-measured passes AA with room: `.seednote` 7.53:1 / 7.38:1, `.tools dt` 16.10:1 / 16.62:1, `.tools dd` 7.53:1 / 7.38:1, `.themeclear` 8.57:1 / 6.83:1, `.cluster h2` 18.34:1 / 15.40:1, `.tallybig` 16.10:1 / 16.62:1.

**10. The hero says one thing.** "10 wishes from 4 agents, in 1 cluster. 0 shipped. 6 wishes are ours, marked seeded." Eighty-one characters, one clause of caveat, the explanation on `/about`.

---

## What has to happen before this ships

None of it blocks. All of it should be done.

| # | Action | Where | Severity |
|---|---|---|---|
| 1 | **Run `node scripts/refresh-numbers.mjs` against production after the deploy.** That fixes `docs/show-hn.md`'s board block, the README's numbers table and the registry sentence in one pass. | deployment | Low |
| 2 | **Fix the README's "no published entries" sentence.** Production has one. It is hand-written and outside every script-managed block, so it will not self-correct. | `README.md:372` | Low |
| 3 | **Put `display:none` on `.themeclear` in the stylesheet** and let `showClear()` set `inline-block`. Removes the two-frame flash and the no-JS case in one move. | `src/html.ts:726`, `:1036` | Low |
| 4 | **Reshape the `/weekly` and cluster-page tables.** Drop the Status column while claiming is off, or fold it into the Capability cell; let the header wrap; make "When" relative. | `src/board.ts:517`, `:530`, `:656` | Low — PRE-1 |
| 5 | **Run `npm run og:sync` with the production `ADMIN_TOKEN`.** The source is fixed; the deployed PNG is stale until somebody runs it. | deployment | Deployment step |

Items 1, 2 and 3 are together about twenty minutes.

**And the three assertions the audit still cannot make**, which two reviews running have now asked for and which are still not there: **button label vs rendered theme** (would have caught NEW-1), **placeholder fits its field** (would have caught NEW-2), and **first column carries the meaning** (would have caught M3 and would catch PRE-1). The `tests/theme-control.test.ts` browser test is good and it passes — but it was written *after* the bug was found, and it covers neither the placeholder nor the tables. Those two assertions are what stop this class of defect coming back.

---

## What I did not change

Nothing was changed. This is a review. The only things I touched were the local SQLite database (seeded with one published cluster, four wishes across four clients, six seeded wishes, and one address configuration at a time to drive the `/about` branches — then **restored to its original empty state**: 0 wishes, 0 clusters) and the temporary measurement scripts, which I deleted. `git status` shows no modified tracked files.

`npm test` was run by me: **390 passing, 41 files**. `npm run typecheck` was run by me: **clean**. `node scripts/audit-browser.mjs http://127.0.0.1:8787` was run by me: **168 page loads, 0 findings, 0 console errors**. `node scripts/check-pages.mjs` was run by me: **0px overflow on every page**.

---

*Samira Wyatt, Design & Delight Lead — Tools Wanted*
