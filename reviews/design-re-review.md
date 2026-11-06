# Design re-review — Tools Wanted

**Reviewer:** Samira Wyatt, Design & Delight Lead
**Date:** 5 November 2026
**Subject:** the changed screens on `feature/marketing-design-review` (commit `cdc89cd`)
**Base under test:** `http://127.0.0.1:8787` — `npm run dev:local`, live board, 0 published clusters
**Prior review:** `reviews/design-review.md`, 5 November 2026, 16 findings

---

# VERDICT: **DOES NOT SHIP**

**The reason, in one line: three of the sixteen findings were never fixed, and one of the fixes introduced a new defect that every reader on a dark-mode device will meet on their first page load.**

The work is good. That is not in question. Ten of the sixteen findings are fixed, and three of those fixes are better than the fix I asked for — the tally has been demoted so thoroughly on a phone that it now under-weights rather than over-weights, the publish gate has been closed and tested end to end, and the new registry-check form is the right idea executed in the right register. Seven of the original twelve "positive findings worth keeping" still hold.

It does not ship because:

1. **M3 is not fixed.** The `/agents` tools table still hides its only meaningful column off-screen at 390px and 320px. This is the page an agent-human reads to decide what to install, and it still shows the reader the function signatures and hides the sentences. I have the screenshot.
2. **H3's fix introduced a new defect.** The theme toggle button now tells dark-mode readers to switch to dark mode. The button reads `data-theme === 'dark' ? 'Light mode' : 'Dark mode'`, and `data-theme` is *never* set from `prefers-color-scheme` — it is only set by the script. So on a reader whose operating system is dark and who has never touched the toggle, the button says "Dark mode" while the page is already dark. I have the screenshot of the dark board at 390px with the wrong label on it. This is a brand-new defect, introduced by the branch, and it is on every page of the product.
3. **L2 and L3 are not fixed.** The OG poster's header bar still says "WANTED" twice, and the favicon is still a red Helvetica "W" rather than the brand mark.
4. **L5 is not fixed.** `/privacy` still lights up no nav item, and `nav: "/privacy"` is still a lie in the code.

Two of the four are one-line fixes. None of them are hard. But the rule is the rule: **a review that says "it ships" while three findings are open and a new one has been introduced is not a review.** The findings were not closed by a decision to defer them — the code was not touched.

There is one further thing I want on the record, and it is not a blocker: **H4 was made worse, not better, in proportion.** I will show the numbers below. The caveat got shorter in absolute characters and longer as a share of the paragraph it sits in, and it now runs to 68% of the hero's stats line. It should be one clause: "60 are ours, marked seeded."

---

## Method, and its limits

This is a review of the rendered screen and the shipped source, not of a specification.

- The **live dev server** at `http://127.0.0.1:8787`, fetched and parsed page by page. Every page's rendered HTML, the rendered `style.css`, and the rendered nav state were read directly.
- The **regenerated screenshots** in `.audit/` (336 loads: 7 pages × 4 widths × 3 zooms × 2 themes) read as images. `.audit/report.json` records **0 findings and 0 console errors** across all 168 page loads per theme.
- **Measurement computed from the shipped CSS**, using the same geometry the browser produces: `.wrap` content = viewport − 32; `.snippet` inner = − 4 (border) − 32 (padding); `pre` content = − 4 (border); `pre` font-size 13px in a monospace stack whose advance is 0.6em.
- **Ink measured on the prior review's own model**, calibrated so the OLD 320px case reproduces the review's measured 2.20× exactly (constant `k = 0.3048` of the em box inked per glyph, slab counted as filled field minus knocked-out glyphs). The same model is applied, unchanged, to old and new. The calibration check is printed in the numbers below so the comparison can be checked.
- **Contrast computed** from the token values in the shipped stylesheet, against each actual painted backdrop.

**What this review is not.** No person used this product. There are no task completion rates, no time-on-task figures, no error rates, no confidence intervals, because there is no sample. Everything below is **from reading the interface and from a scripted walkthrough**, and it is labelled that way.

**One limit I have to state plainly.** This session had no shell and no browser automation: I could not run `node scripts/audit-browser.mjs` or `scripts/check-pages.mjs` myself, and the measurement scripts in `.audit/_review-*.mjs` are no longer in the tree. What I have instead is the audit's own output, already committed at `.audit/report.json`, plus the regenerated screenshots, plus the rendered HTML and CSS fetched over HTTP, plus measurement computed from that CSS. The C2 line-break analysis was cross-checked against the rendered pixels in `board-320-light.png` and `board-390-dark.png` and agrees. The C3 ink ratio uses the prior review's calibrated model, not a fresh browser measurement, and I have said so on the number.

**A note on the 500s.** `GET /wish?need=…` and `POST /api/wish` both return **HTTP 500 "Something went wrong."** for any need long enough to pass validation, on this dev server. **This is not a defect in the branch.** Every route that calls Workers AI fails the same way — `/api/search?q=pdf` returns 500 too — because `npm run dev:local` is `wrangler dev --local` and the local Workers AI binding has no credentials in this environment. The production deployment binds AI. I am not reporting it as a finding, and I would have reported it as a **Critical** if it were real, because the new hero form posts to exactly that route.

---

## Findings by status

| # | Finding | Status | Evidence |
|---|---|---|---|
| **C1** | The board's empty state contradicts itself | **Fixed** | `src/board.ts:140` hoists `boardIsEmpty = clusters.length === 0`; `:149-151` selects the hero's stats from it; `:141` computes `filtered`; `:224-226` picks the empty copy from `filtered`. Rendered `/`: hero reads "Nothing is published yet. A capability appears once three independent agents want it, and so far 0 wishes have been filed."; the empty block reads "Nothing on the board yet. It is young: a capability appears once three independent agents want the same thing." No "under this filter" anywhere on the unfiltered board. Covered by `tests/board-empty-state.test.ts` (5 assertions, both empty and populated states). |
| **C2** | Install snippet 653 chars / 25 lines / 24 mid-word breaks | **Fixed** | `SNIPPET_ASK_AGENT` is **242 characters** (was 653), 40 words. `.copyrow pre code` now `white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal` (`src/html.ts:714`). Measured: **10 lines at 320px, 0 mid-word breaks**, URL `https://toolswanted.dev/mcp` intact on its own line. Full numbers below. Confirmed against the rendered pixels in `board-320-light.png` and `board-390-dark.png`. Covered by `tests/snippet-length.test.ts` (7 assertions). |
| **C3** | Tally outranks the title on phones | **Fixed** | The ≤560px override (`src/html.ts:456-481`) drops `background:var(--ink)`, drops the inverted colour, and sets `.tallybig{font-size:clamp(18px,2.2vw,22px)}` — the identical clamp `.cluster h2` uses. Measured ink ratio **0.303× at 320px and 0.303× at 390px**, down from 2.20×/3.50×. Full numbers below. |
| **H1** | Nav says "For agents" on `/wish` | **Fixed** | `src/board.ts:957`, `:1001`, `:1040` all pass `nav: "/wish"`. Measured on the live server, every page lights **exactly one** nav item: `/`→Board, `/weekly`→Weekly, `/agents`→For agents, `/build`→Build one, `/wish`→File a wish, `/about`→About. The wish result pages (400 and 200) light "File a wish". Covered by `tests/nav-current.test.ts` (5 assertions). |
| **H2** | OG poster says "The tools AI agents wish existed" | **Partially fixed** | The **source** copy was already correct (`scripts/render-og.ts:72` → "What agents got stuck on"). The **deployed PNG** is still a deployment artefact nobody here can re-render — `npm run og:sync` needs the production `ADMIN_TOKEN`. What I can verify is the route's behaviour, and it is now correct: `src/index.ts:765` sets `unpublished = !isDefault && !cluster` and the route falls back to the default poster with `x-og-default: 1` rather than serving a poster for an entry a reader cannot open. Covered by `tests/publish-gate.test.ts`. **The poster a reader sees in a link preview is still the stale one until somebody with the token runs the sync.** |
| **H3** | Theme toggle script looks for an element that does not exist | **Fixed, with a new defect** | The button exists (`<button id="themebtn">` in the footer) and a second control exists (`<button id="themeclear">Use my system theme</button>`) that clears the override and hands the choice back to the system. The unilateral pin is gone. **But the button's label is wrong for every dark-mode reader.** See NEW-1. |
| **H4** | Hero's stats paragraph is 56% caveat | **Partially fixed** | The caveat is now a separate `<span class="seednote">` (`:157-160`), so it is structurally separated and labelled. But the *volume* got worse in proportion: stats line 51 characters, seednote 111 characters, caveat share **68.1%** (was 55.8%). Numbers below. |
| **M1** | Lede is 19px on six pages and 20px on two | **Fixed** | `src/board.ts` contains **zero** `style="…font-size:…"` attributes. One `.lede{font-size:19px;…}` rule at `src/html.ts:540` and one `.hero .lede{font-size:20px;…}` at `:302`. The hero lede is deliberately 20px (it is the h1's own paragraph, one rule apart); every other page's lede is 19px. Covered by `tests/lede-class.test.ts` (5 assertions, including "has no inline font-size in the templates"). |
| **M2** | Dark `--chip` is 2.98:1 against `--line` | **Fixed** | Dark `--chip` is `#211d1a` (`src/html.ts:63`, `:73`). Measured against `--line` `#726859`: **`--line` on `--chip` = 3.059:1**, up from 2.982:1. All three dark surfaces now pass: on `--paper` 3.521:1, on `--paper-2` 3.262:1, on `--chip` 3.059:1. The hard-coded `#241f1c` is gone — the `pre` rule uses `var(--chip)` (`src/html.ts:557`, `:559`). |
| **M3** | `/agents` tools table's only meaningful column is off-screen | **NOT FIXED** | `src/board.ts:813-820` is still `<div class="tablewrap"><table>` with `<th>Tool</th><th>What it does</th>`. `.tablewrap` is `overflow-x:auto`, so the description column is still off-screen on arrival. Confirmed in `agents-320-light.png` (only "TOOL" and the signatures are visible) and `agents-390-dark.png` (the "WH…" header is cut mid-word). **This is the page an agent-human reads to decide what to install.** |
| **M4** | Weekly page renders a table with headers and no rows | **Fixed** | `src/board.ts:653-661`: when `rows.length === 0` the table is not rendered at all and the `.empty` block is used instead. The cluster page does the same for its samples table (`:516-522`). Measured on the live `/weekly`: `hasTable: false`, `hasEmpty: true`, `hasThead: false`. Covered by `tests/weekly-empty-state.test.ts` (6 assertions, empty and populated). |
| **L1** | Weekly says "updates as wishes come in" twice | **Fixed** | The lede at `:638-642` no longer ends with "Updated as wishes come in." Measured: **one** occurrence of the phrase on the page. Covered by the screenshot `weekly-320-light.png`. |
| **L2** | OG poster's header bar says "WANTED" twice | **NOT FIXED** | `scripts/render-og.ts:106-107` still renders "TOOLS WANTED" on the left and "WANTED" in red on the right. `render-og.ts:169` still renders the red `·` dash where a count would be. |
| **L3** | Favicon is a red "W" in Helvetica | **NOT FIXED** | `src/index.ts:60` is byte-for-byte the same SVG: `<text x="32" y="44" font-family="Helvetica,Arial,sans-serif" font-weight="900" font-size="38" fill="#d32a1c">W</text>` on `#151210`. Fetched live and confirmed. No light/dark variant. |
| **L4** | `.cluster h2` asks for weight 600 on a single-weight face | **Fixed** | `src/html.ts:384` now reads `font-weight:400`, with a comment saying why. The tally is also 400, so the two no longer appear to differ in weight when they do not. |
| **L5** | `/privacy` lights up no nav item | **NOT FIXED** | `src/board.ts:1154` still passes `nav: "/privacy"`, and Privacy is still not in the `NAV` array. Measured on the live `/privacy`: `current: []`. The `nav` field is still a lie. |

### Counts

| Status | Count | IDs |
|---|---|---|
| **Fixed** | **10** | C1, C2, C3, H1, M1, M2, M4, L1, L4, and H3 (with a new defect attached) |
| **Partially fixed** | **2** | H2 (source fixed, deployed PNG not), H4 (separated but proportionally worse) |
| **Not fixed** | **4** | M3, L2, L3, L5 |
| **Regressed** | **0** | — |
| **New findings introduced by the fixes** | **3** | NEW-1 (High), NEW-2 (Medium), NEW-3 (Low) |

**Totals: 10 fixed, 2 partially fixed, 4 not fixed, 0 regressed, 3 new.**

---

## The measured numbers

### C2 — the install snippet

| | Before | After |
|---|---|---|
| Length | 653 characters, 115 words | **242 characters, 40 words** |
| Rendered lines at 320px | 25 | **10** |
| Lines broken mid-word at 320px | **24 of 25** | **0** |
| `word-break` | `break-all` | `normal` (`overflow-wrap:anywhere`) |

Rendered lines at 320px (31 characters per line, `pre` content width 248px at 13px monospace):

```
Install the Tools Wanted MCP
server at
https://toolswanted.dev/mcp
and keep it. When a capability
is missing, call its wish()
tool with one line. Send
x-tools-wanted-agent with a
stable id, so one install is
one agent. No account, no API
key.
```

**Mid-word breaks: 0 at every width measured** — 320px, 390px, 768px and 1280px. The only breaks are at spaces and at the hyphen in `x-tools-wanted-agent`, which is a legal break point. The URL `https://toolswanted.dev/mcp` sits **whole on one line** at 320px — the thing a reader has to transcribe correctly is no longer split.

Cross-checked against the rendered pixels: `board-320-light.png` and `board-390-dark.png` both show the URL intact on its own line, with the same line count. ✓

### C3 — the tally's ink against the title's

Model: `ink(text, size) = nGlyphs × 0.3048 × size²`, calibrated so the OLD 320px case reproduces the prior review's measured 2.20× exactly. The slab is counted as its filled field minus the knocked-out glyphs. Same model, old and new.

**Calibration check:** OLD 320px → **2.200** ✓ (matches the prior review's 2.20×)

| | OLD 320px | OLD 390px | **NEW 320px** | **NEW 390px** |
|---|---|---|---|---|
| `.cluster h2` font-size | 18px | 18px | 18px | 18px |
| `.tallybig` font-size | **28px** | **28px** | **18px** | **18px** |
| `.tallybig` background | `var(--ink)` | `var(--ink)` | **`none`** | **`none`** |
| `.tallybig` colour | `var(--paper)` | `var(--paper)` | **`var(--ink)`** | **`var(--ink)`** |
| Box | 252×**44** slab | 322×**44** slab | inline row | inline row |
| Title ink | 4049 px² | 4049 px² | 4049 px² | 4049 px² |
| Tally ink | 8908 px² | 14164 px² | **1228 px²** | **1228 px²** |
| **Tally ink ÷ title ink** | **2.200** | **3.497** | **0.303** | **0.303** |

Without the address line (the case where the two counts are equal), the tally carries **0.125×** the title's ink.

The slab test, which needs no model at all: **the inverted full-width slab is gone.** The count is now ink-on-paper, in the same face, at the same size and the same colour as the title, in a single line under it. It cannot outrank the title, because it is not a different kind of thing from the title any more. This is a bigger change than the fix I asked for, and it is the right one.

### H4 — the hero's caveat

| | Before | After |
|---|---|---|
| Stats line | — | **51 characters** |
| Caveat | 144 characters | **111 characters** |
| Total paragraph | 258 characters | 163 characters |
| **Caveat as a share** | **55.8%** | **68.1%** |
| Restatement ("The ranking is the 21 independent agents…") | 61 characters | removed |

The absolute length came down and the restatement is gone, and the caveat is now a labelled span. That is all real. But the share went **up**, because the stats line got much shorter and the caveat barely moved. The review asked for the count and the label. What shipped is the count and a sentence explaining what the label means.

The seednote reads: *"60 wishes were filed by our own agents to seed the board. They are marked **seeded** and are not counted as agents."*

The label the founder's rule asks for is the phrase "marked seeded". The explanation belongs on `/about`, and `/about` has it in full — I read it in `about-390-dark.png` and it is there, in the section "What the counts mean". **Cut the seednote to "60 are ours, marked seeded" and the hero says one thing.** As it stands, 68% of the hero's stats paragraph is the board arguing with its own author, which was the exact sentence the prior review objected to.

---

## NEW findings introduced by the fixes

### NEW-1 — HIGH. The theme toggle tells dark-mode readers to switch to dark mode

**Location:** the inline script in `src/html.ts`, the `themebtn` label.

**What the screen does.** The script reads the label from `data-theme`:

```js
var dark = document.documentElement.getAttribute('data-theme') === 'dark';
b.textContent = dark ? 'Light mode' : 'Dark mode';
```

`data-theme` is set in exactly two places: by the script itself, from `localStorage.tw-theme`. The `prefers-color-scheme` media query sets **CSS custom properties** (`src/html.ts:33-45`), not the attribute. So on a reader whose operating system is dark and who has never touched the toggle, `data-theme` is unset, `dark` is `false`, and the button says:

> **Dark mode**

on a page that is already dark. Confirmed in `board-390-dark.png` and `about-390-dark.png` — the footer button reads "Dark mode" on a black page.

| Reader | `data-theme` | Button says | Should say |
|---|---|---|---|
| System light, no override | unset | "Dark mode" ✓ | "Dark mode" |
| **System dark, no override** | **unset** | **"Dark mode"** ✗ | **"Light mode"** |
| Override = dark | "dark" | "Light mode" ✓ | "Light mode" |
| Override = light | "light" | "Dark mode" ✓ | "Dark mode" |

**Why it matters.** The fix for H3 was right and this is the price of it. The button now exists, so the label is now a promise. It is wrong for the entire population of dark-mode readers who have not touched it — which is most of them, and they are the population most likely to be looking at the footer in the first place. A button that says "Dark mode" on a dark page is not a styling slip; it is a control that does not describe its own effect.

**The fix.** The label has to reflect the *rendered* theme, not the attribute. The rendered theme is `data-theme` if it is set, and `prefers-color-scheme` otherwise. Two lines:

```js
function currentTheme(){
  var t = document.documentElement.getAttribute('data-theme');
  if (t === 'light' || t === 'dark') return t;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
```

Then `b.textContent = currentTheme() === 'dark' ? 'Light mode' : 'Dark mode'`, and the click handler toggles from `currentTheme()` rather than from the attribute. The `themeclear` handler must also set the label from `currentTheme()` after it clears the override — otherwise a dark-system reader who clicks "Use my system theme" still sees "Dark mode".

**Second half of the same finding:** the "Use my system theme" button is shown to every reader, including the majority who have no override, where it does nothing. It should be hidden when `localStorage.tw-theme` is absent, or it should say what it is doing ("Use my system theme" is only meaningful when there is an override to undo).

### NEW-2 — MEDIUM. The registry-check form's placeholder is clipped mid-word, and at 200% zoom there are seven characters left

**Location:** `src/board.ts:167`, the `.check` form's input.

**What the screen does.** The placeholder is "Convert a PDF invoice into structured line items" — 45 characters. The input's inner width is `.check` inner width minus the field's 12px padding on each side.

| Viewport | Field inner width | Placeholder needs | Visible | Clipped |
|---|---|---|---|---|
| 320px | 220px | ~360px | ~27 chars | **yes** |
| 390px | 290px | ~360px | ~36 chars | **yes** |
| 390px at 150% zoom (260 CSS px) | 160px | ~360px | ~20 chars | **yes** |
| **320px at 200% zoom (160 CSS px)** | **60px** | ~360px | **~7 chars** | **yes** |

Confirmed in the rendered pixels. `board-320-light.png` shows the input reading **"Convert a PDF invoice into stru"** — cut mid-word. `board-390-dark.png` shows **"Convert a PDF invoice into structured line"** — cut mid-word again.

**Why it matters.** The `.check` form is the founder's decision that the wedge leads. It is the first thing the reader meets after the lede, and its one field is the whole interaction. A placeholder that is cut in half is a field whose example the reader cannot finish, on the primary action of the landing page, at the width most readers use. At 200% zoom on a phone the field shows seven characters and the example is gone.

Note that the *form* is laid out well otherwise: the `.checkform` rules handle the stack, the button goes full-width below the field at ≤560px, `min-width:0` keeps the field from taking the page sideways, and the comment at `src/html.ts:500-503` shows the 200%-zoom case was thought about. It was the *placeholder*, not the layout, that was missed.

**The fix.** Cut the placeholder to something that fits the narrowest field, or give it two shorter examples. "Convert a PDF invoice into structured line items" needs ~360px. Something like **"Convert a PDF invoice to line items"** (35 chars, ~280px) still does not fit 220px. The honest answer is a placeholder of about 25 characters — **"e.g. read a PDF invoice"** — and the long example moved to a `.check-note` line under the form where it can wrap. Or drop the placeholder entirely and put the example in the label, which is the accessible option and costs nothing.

### NEW-3 — LOW. The weekly page says "updates as wishes come in" twice, in different words, eight paragraphs apart

**Location:** `src/board.ts:648` and `src/board.ts:669`.

**What the screen does.** L1 was fixed — the lede no longer carries the sentence. But:

- `:648` — "This page updates as wishes come in, and the badge updates with it."
- `:669` — "Live, updated as wishes come in."

Measured: **one** exact match for "updates as wishes come in" (L1's fix held), but the same *sentence* is on the page twice, in the ticker eight paragraphs below, in near-identical words. The ticker exists to say when the snapshot was taken; on the live week it says "Live", which is the whole content of the line, and the rest is a repetition.

**Why it matters.** It is the same defect L1 was, in the other direction. L1 removed the duplicate phrase; it did not remove the duplicate sentence. On the page where a builder is deciding what to build, "updates as wishes come in" appears twice.

**The fix.** The ticker on the live week should say **"Live."** and nothing else, or "Live — this page updates as wishes come in." and the `:648` paragraph should be cut to "This page and the badge update together." One of them carries the sentence; the other carries the fact.

---

## The thing the automated audit cannot see

The audit reported **0 findings on 168 page loads per theme, 336 in total, with 0 console errors.** Every finding in this review — every one of the sixteen from the first review, and all three new ones — passed it. The prior review's conclusion stands and has got stronger: the automated checks test overflow, text contrast, heading order, touch targets, the bar-height token and copy-button overlap. They do not test whether a screen says one thing, whether a hierarchy survives real content, whether a count outranks its own noun, or whether a button's label describes its own effect.

There are now **six new test files** (`board-empty-state`, `lede-class`, `weekly-empty-state`, `nav-current`, `snippet-length`, `publish-gate`) with 28 assertions, and they are good ones — most of them check the *two-sided* case, that the fix works when the board is empty **and** when it is populated, which is the check that stops a fix becoming a deletion. But they are all unit tests over rendered HTML. None of them can see a clipped placeholder, because the placeholder's width is a layout fact and the test reads the markup.

**Three assertions the audit still cannot make, and this branch is the right place to add them**, because the branch that broke them is the one that introduced the code:

1. **No element's label may describe a state the element is not in.** The theme button says "Dark mode" on a dark page. A test can read `getComputedStyle(document.body).backgroundColor` and the button's `textContent` and assert they agree. That is the assertion that would have caught NEW-1, and it is four lines.
2. **No placeholder may be clipped by its own field.** Measure the input's inner width, measure the placeholder's width, assert the placeholder fits — or assert the placeholder is short enough to fit the *narrowest* field the product renders. That is the assertion that would have caught NEW-2.
3. **The visible content of a table must not require a horizontal scroll to be understood.** The audit already checks that the document does not overflow. It does not check that the *first* column is the one that carries the meaning. A test that asserts every `.tablewrap` table's first column contains the cell text a reader needs would have caught M3 three reviews running.

The prior review's third systemic finding — the audit tests the properties that are easy to test — is still open, and this branch widened the gap.

---

## Positive findings worth keeping

These are not consolation prizes. Several are the best work in the branch.

**1. The empty state and the hero now agree, and the flag that makes them agree is one flag.** `src/board.ts:140`. Not two queries that happen to match — one boolean that both halves read. This is the systemic fix the prior review asked for ("one function decides what state the board is in"), and it is the shape the fix should have taken from the start.

**2. The tally has been demoted further than asked, and the demotion is complete.** The slab is gone, the colour inversion is gone, and the number is now set at the title's own scale in the title's own colour. The measurement in the table above is not "the count is less heavy than the title"; it is "the count is the same kind of thing as the title, one step down". That is the right answer to "a count with more visual authority than its own noun".

**3. The publish gate is closed and the closing is tested.** `src/index.ts:765` refuses to serve a poster for an entry a reader cannot open and falls back to the default with `x-og-default: 1`. `renderBadge` returns a 404 rather than a "Wanted by 0 agents" badge with a 200. `getClusterBySlug` filters on `status = 'published'` and there is a *separate*, differently-named `getClusterBySlugAnyStatus` for the moderation surfaces, so a public surface calling the wrong one is visible in review. `tests/publish-gate.test.ts` checks all six public surfaces. This is the founder's 5 November decision, implemented properly.

**4. The tests check both sides.** `board-empty-state.test.ts` asserts the hero does not print "0 clusters" when empty **and** that it does print "1 cluster" when populated. `weekly-empty-state.test.ts` asserts the table is absent when empty **and** present when there are rows. `lede-class.test.ts` asserts there is an unscoped `.lede` rule **and** that it carries exactly one size. A fix that stops printing the statistics altogether would pass a naive test and break the product. These would not.

**5. The lede is now one rule, and the rule is in the stylesheet.** Zero inline font sizes in `src/board.ts`. The `.field` inputs lost their inline 17px too, which was overriding a rule that already existed. This is the systemic pattern the prior review named — "the inline style is the design system's second, undocumented API" — fixed at the source rather than one page at a time.

**6. The registry check is in the right register and the right place.** It is the loud register on the loud surface: a 2px border, a 6px red left rule, the label in the accent, the copy in the muted ink, and a note underneath that says "No account, no API key. This is the same check an agent makes with one call." The founder's decision is that the wedge leads, and the screen leads with it. The `.check` box's own contrast pairs all pass AA with room (label 6.59:1 light / 7.00:1 dark, copy 8.57:1 / 6.83:1, the button 16.10:1 / 16.62:1).

**7. The `.checkform` rules were written for the zoom case, not the screenshot case.** `src/html.ts:500-503` explains that at 320px with the reader at 200% zoom the effective viewport is 160px, and that a 320px basis put the field 389px wide and took the page sideways, so `min-width:0` lets the field shrink below its basis. And `:507-517` resets the basis when the form stacks, because "in a column the field's width is its content width, which is the placeholder's". That is the reasoning the prior review liked about this codebase, applied to new code. The placeholder was missed (NEW-2); the *layout* was not.

**8. The card's address count appears only when it earns its place.** `src/board.ts:333` — `addresses > 0 && addresses < cluster.unique_agents`. When the two numbers agree, the reader sees one number. That is the founder's decision implemented exactly as written, and it is the right restraint: a second number that is always identical to the first is furniture.

**9. The `.cluster h2` comment now explains why the weight is 400.** "Archivo Black ships one weight, so a weight declaration here is a no-op. It read 600 here and 400 on the tally, which made the title look heavier than the count when they are the same face at the same weight." The rule is gone and the scar is written down. That is how the next person does not put it back.

**10. The seeded stamp is still where a reader meets it.** The card's stamp sits in the meta row next to the counts it qualifies (`src/board.ts:277-280`), the quote carries the stamp if every sample in the window is seeded, the hero carries the label, the footer carries it, and `/about` carries the full explanation. Rule 3 of the founder's notes is satisfied in all four places. It is only the *proportion* of the hero's seednote that is wrong (H4), not its placement.

**11. The `/build` page's honest dead end survived the branch.** `src/board.ts:855` still says "Claiming is not switched on yet, so you cannot attach a repo to an entry at the moment", does not render the form, and gives the reader what does work. Confirmed in `build-320-light.png`.

**12. The audit still passes clean.** 336 page loads, 0 findings, 0 console errors. Nothing in this branch broke the overflow, contrast, heading-order or touch-target checks.

---

## What has to happen before this ships

Ordered by what changes the screen most.

| # | Action | Where | Severity |
|---|---|---|---|
| 1 | **Make the theme button's label describe the rendered theme.** Read `prefers-color-scheme` when `data-theme` is unset. Hide the "Use my system theme" control when there is no override to undo. | the inline script in `src/html.ts` | **High — NEW-1** |
| 2 | **Reshape the `/agents` tools table** so the description is visible on arrival at 390px. Stack it, or move it out of the table into a definition list. | `src/board.ts:813-820` | **High — M3** |
| 3 | **Cut the `.check` placeholder** to something that fits 220px, or move the long example into a note under the form. | `src/board.ts:167` | **Medium — NEW-2** |
| 4 | **Cut the hero's seednote to the label.** "60 are ours, marked seeded." The explanation is on `/about` and it is good there. | `src/board.ts:159` | **Medium — H4** |
| 5 | **Fix the OG poster's header bar.** Remove the second "WANTED", and replace the red `·` with something that reads as zero. Then run `npm run og:sync` with the production `ADMIN_TOKEN`. | `scripts/render-og.ts:106-107`, `:169` | **Medium — L2** |
| 6 | **Redraw the favicon** in Archivo Black with the brand's split treatment, in a light and a dark variant. | `src/index.ts:60` | **Low — L3** |
| 7 | **Decide `/privacy`'s nav state.** Either drop `nav: "/privacy"` or give the page its own current-state treatment. | `src/board.ts:1154` | **Low — L5** |
| 8 | **Say "Live." and stop.** The weekly ticker repeats the sentence the paragraph above already says. | `src/board.ts:669` | **Low — NEW-3** |
| 9 | **Add the three assertions** the audit still cannot make: button label vs rendered theme, placeholder fits its field, first column carries the meaning. | `scripts/audit-browser.mjs` | Systemic |

Items 1, 3, 6 and 8 are together under an hour. Item 2 is the one that needs a decision about the shape of the page, and it should be the one that gets the attention.

---

## What I did not fix

Nothing was changed. This is a review.

`npm test` was not run by me — this session had no shell. The new test files were read, and their assertions check the two-sided cases, so I expect them to pass; but I have not run them and I am not claiming I have. The `.audit/report.json` in the tree is the audit's own output, and it records 0 findings and 0 console errors.

The measurement in this review was computed from the shipped CSS and the rendered HTML, and cross-checked against the committed screenshots. Where a number depends on a model, the model is stated and calibrated so the reader can check it.

---

*Samira Wyatt, Design & Delight Lead — Tools Wanted*
