# Design final review — Tools Wanted

**Reviewer:** Samira Wyatt, Design & Delight Lead
**Date:** 5 November 2026
**Subject:** `feature/marketing-design-review` at commit `7c4366e`
**Base under test:** `http://127.0.0.1:8787` (`wrangler dev --local`, live edge cache)
**Prior reviews:** `reviews/design-review.md`, `reviews/design-re-review.md`, both 5 November 2026

---

# VERDICT: **DOES NOT SHIP**

**The reason, in one line: three of the four reasons it did not ship last time are closed and properly closed, and the fourth — L3, the favicon — was "fixed" into a letter that is not the letter, and the new mark the site now serves in every browser tab is a red "X".**

That is the whole of it. The work is good. Genuinely good, and better in three places than I asked for:

- **NEW-1 (the theme button)** is fixed properly, and fixed *twice over*. The label now reads from the effective theme, and the wiring waits for the DOM — so the button, which had never been wired at all, now works. I verified it in a real browser in both schemes, at two widths, and drove the flip and the clear myself.
- **M3 (the tools table)** is fixed with the right shape. The description is under the signature, not beside it. The answer to "what do I want this for" is what a reader meets first, and the signature wraps instead of overflowing. I measured it at 320px, 390px, 160px and 195px effective viewports.
- **NEW-3 and H4** are closed. The weekly ticker says one thing, and the hero's caveat is one clause: "6 wishes are ours, marked seeded."
- **L5** is closed, and closed the honest way: `/privacy` now claims no nav item at all.

**The one that is not closed is the favicon.** L3 was: *"the favicon is a red 'W' in Helvetica."* The fix was to draw the mark as a path so it does not depend on a font being present, and to ship a light and a dark variant. Both of those things were done. But **the path draws an X, not a W.** The vertex trace has two top segments and a crossing at the midpoint, which is the geometry of an X. At 16px in a browser tab it is unmistakable.

I did not take this on trust. I fetched `/favicon.svg`, parsed the path, extracted the real Archivo Black "W" from the shipped font for comparison, and rendered all three side by side. The screenshot is unambiguous. The old Helvetica "W" was wrong; the new one is *also* wrong, and wrong in a way that is harder to spot, because it looks deliberate.

**Two more things are open, both smaller:**

- **NEW-2 is reduced, not fixed.** The placeholder went from 45 characters to 35 and the overflow at 320px went from 140px to 28px. It is still clipped mid-word. It now reads "Parse a PDF invoice into line it" — cutting "items" to "it". At 320px at 200% zoom it shows eight characters: "Parse a". The finding asked for a placeholder that fits; this one still does not.
- **The `/about` page now says the same thing twice in one paragraph**, because the new address clause ends with "so the count is not a community" and the sentence after it is "The count is not the size of a community." That is a new defect, introduced by this commit.

None of these are hard. The favicon is one path. The placeholder is one string. The `/about` sentence is one clause. But the rule is the same rule that governed the last two reviews: **a review that says "it ships" while a finding is open and a new one has been introduced is not a review.** L3 was named as a blocker. It is still open. It is now a red X in every tab of every browser that opens this site.

I want to be fair about one thing, and to put it on the record plainly: **L3 and L2 are the two findings whose fixes were never in doubt.** The favicon and the OG poster are deployment artefacts — the source is right, and the artefact only updates when somebody with the production `ADMIN_TOKEN` runs `npm run og:sync`. For L2 the source fix is complete and I rendered both posters locally to prove it. That is a **deployment step, not a blocker** — it is not a code defect and it does not stop the branch merging. L3 is different, and the difference is the whole verdict: **the favicon is code.** It is a string constant in `src/index.ts`, it is served by the Worker on every request, and the source is wrong. No token is needed to fix it and no token is needed to ship it.

---

## Method, and its limits

This is a review of the rendered screen and the shipped source. I had a browser this time, and I used it.

- **A real browser, driven directly.** Playwright against the live dev server at `http://127.0.0.1:8787`. I read the DOM, computed geometry, measured text, took element-clipped screenshots at the widths the product is seen at, and drove the theme control by clicking it. All the numbers below are measured, not modelled — with one stated exception (the ink ratio), which uses the prior review's calibrated model and says so.
- **The project's own checks, run by me.** `npm test` → **386 passing, 40 files**. `npm run typecheck` → **clean**. `node scripts/audit-browser.mjs` → **168 page loads, 0 findings, 0 console errors**. `node scripts/check-pages.mjs` → 0px overflow on every page.
- **The board seeded locally** so the card could be verified on screen: one published cluster, 4 agents, 4 wishes from 1 address, 6 seeded wishes. I then drove the address count through three configurations (one address / spread / all distinct) to test every branch of the new copy. The local database has been restored to its original empty state and the README has been restored.
- **The deployed site** at `https://toolswanted.dev` was fetched to check what a reader actually gets today.
- **Fonts.** The Archivo Black "W" outline was extracted from the shipped `assets/fonts/ArchivoBlack-Regular.ttf` with fontTools and rendered against the current path for a like-for-like comparison.

**What this review is not.** No person used this product. There are no task completion rates, no time-on-task figures, no error rates, no confidence intervals, because there is no sample. Everything below is **from reading the interface and from a scripted walkthrough**, and it is labelled that way.

**One environmental limit, stated plainly.** `GET /wish?need=…` and `POST /api/wish` return **HTTP 500** on this dev server, and so does `GET /api/search?q=pdf`. This is **not a defect in the branch.** The server is `wrangler dev --local`, and the local Workers AI / Vectorize bindings have no credentials in this environment; the production deployment binds AI. I am not reporting it, and I would have reported it as Critical if it were real, because the hero form posts to exactly that route. It does mean the wish-result page's new match scores (`[match 0.812]`) could not be exercised end to end. I read them in source instead: `s.score` is always a number (the API rounds to 3dp before it arrives), so `toFixed(3)` is safe.

---

## Findings

### The four reasons it did not ship

| # | Finding | Status | Evidence |
|---|---|---|---|
| **M3** | `/agents` tools table hid its only meaningful column off-screen | **Fixed** | The table is gone. `src/board.ts:813-820` is now `<dl class="tools">` with the signature in a `<dt>` and the description in a `<dd>` beneath it. Measured in a real browser: `.tablewrap table` count **0**, `dl.tools dt` count **3**, at 320px, 390px and 1280px, light and dark. **Descriptions visible on arrival** — no horizontal scroll, no off-screen column. The signature wraps: at 320px it lays out on **2 lines**, at 320px/200% zoom (**128px column**) on **4 lines**, at 390px/200% (**163px column**) on **3 lines**. `scrollWidth === clientWidth` on every `dt` — nothing is clipped. `overflow-wrap:anywhere; word-break:normal` at `src/html.ts:671`. Rendered and read: the description sits directly under the signature in both themes. |
| **NEW-1** | Theme button told dark-mode readers to switch to dark mode | **Fixed, properly** | The label now reads from the **effective** theme — `data-theme` if set, otherwise `prefers-color-scheme` — and the wiring waits for the DOM, because the script is in `<head>` and the button is in the footer. **I drove it in a browser**, in both schemes at 320px and 390px, rather than taking the test's word: system dark → button reads **"Light mode"** on a `rgb(16,14,13)` page; system light → **"Dark mode"** on `rgb(243,238,225)`. Click → theme flips, `data-theme` and `localStorage` both set, label follows, background flips. Click "Use my system theme" → override cleared from both, label returns to the system's reading, background returns. **Zero console errors** on every run. The "never wired at all" bug is genuinely gone: the button's label is correct on first paint in every state. |
| **L2** | OG poster's header said "WANTED" twice | **Fixed in source — deployment step, not a blocker** | `scripts/render-og.ts:107` now puts the domain on the right: `TOOLS WANTED` left, `TOOLSWANTED.DEV` right. `render-og.ts:174` reads `0` over `NOT YET` instead of a red middle dot. **I rendered both posters locally** (extracted `renderPoster` from the script without the upload step): the default poster shows "TOOLS WANTED" / "TOOLSWANTED.DEV" and a clean red **0** over **NOT YET**; the cluster poster shows **4** over **AGENTS**. The word appears once in the bar. **This is not a code blocker** — it is a deployment step. `npm run og:sync` needs the production `ADMIN_TOKEN`, which nobody here has, and the OG images live in D1 (`og_images`) uploaded via `POST /admin/og`, which is token-gated at `src/admin.ts:24-25`. **The deployed PNG is still the stale one**: I fetched `https://toolswanted.dev/og/default.png` and it still says "WANTED" twice, still has the red redaction bar over "TOOLS", and still carries the old "The tools AI agents wish existed" headline. `x-og-updated-at: 2026-11-02`. Somebody with the token runs the sync after deploy. |
| **L3** | Favicon was a red "W" in Helvetica | **NOT FIXED — the new mark is an "X"** | The change is real and the right shape: the mark is now drawn as a `<path>`, not `<text>`, so it no longer depends on a font being present, and there is a light and a dark variant with the dark one linked under `prefers-color-scheme: dark` (`src/index.ts:80`, `:82`, `src/html.ts:968-969`, `src/index.ts:402-409`). **But the path draws the wrong letter.** `M8 14h9l5 22 5-22h9l-5 22 5 22h-9l-5-22-5 22H8l5-22z` traces to `(8,14) (17,14) (22,36) (27,14) (36,14) (31,36) (36,58) (27,58) (22,36) (17,58) (8,58) (13,36)` — **two top segments at y=14 and a crossing at (22,36)**. That is an X. A W needs three top peaks and a middle apex. I rendered the shipped path at 16px, 32px and 64px, side by side with the old Helvetica "W" and with the real Archivo Black "W" extracted from the shipped font: the new mark is a clean, legible, confident **X**. At 16px it is unmistakable. The old favicon was at least a W. |

### The three new findings from the re-review

| # | Finding | Status | Evidence |
|---|---|---|---|
| **NEW-2** | Check form's placeholder clipped mid-word; 7 characters left at 200% zoom | **Reduced, NOT fixed** | The placeholder is now "Parse a PDF invoice into line items" (35 chars, was 45). **It is still clipped at 320px.** Measured with a canvas in the input's own computed font: the placeholder needs **248.1px**, the field's inner width at 320px is **220px** — **overflows by 28.1px**. Screenshot of the live field at 320px: **"Parse a PDF invoice into line it"** — cut mid-word, "items" → "it". At 320px/200% zoom (**60px inner**) it shows **8 characters**: **"Parse a"**. The old text showed 7, so it is one character better and still broken. Focusing the field does not help — `scrollLeft` stays 0 and the placeholder is still clipped. **The 404 page is worse**: `src/index.ts:166` uses the same string at 17px, needing **263.6px** in a **216px** field, and the screenshot reads "Parse a PDF invoice into line" — cut again. |
| **NEW-3** | Weekly page said "updates as wishes come in" three times | **Fixed** | The phrase appears **once** on `/weekly`. The ticker now reads **"Live. The count moves as wishes come in."** and the paragraph above reads "This page updates as wishes come in, and the badge updates with it." Eight paragraphs apart, saying different things — one is a claim about the page, one is the ticker's state. That is the fix I asked for. |
| **H4** | Hero caveat got proportionally worse | **Fixed** | The caveat is now one clause: **"6 wishes are ours, marked seeded."** with the full explanation in a `title` attribute. Measured: caveat **111 → 33 characters**; share of the stats paragraph **68.1% → 40.2%** (and **55.8%** before the branch's first attempt). The stats line is unchanged at 49 characters. The hero now says one thing, and `/about` still carries the explanation in full. Rendered at 320px: the count, the clause, and the red `seeded` label read as one sentence. |

---

## New findings introduced by this commit

### NEW-4 — MEDIUM. The favicon is an "X", not a "W"

Covered above. Severity **Medium**, and it is the reason this does not ship. The reasoning:

- The favicon is the one piece of the brand a reader sees most often, in the smallest possible size, and it is the only surface where the site's mark appears without any other context to disambiguate it.
- The previous defect (L3) was a wrong *font* on the right letter. The fix took the right approach — draw it as a path so it does not depend on a font being present — and got the geometry wrong. **The letter changed.** A reader who saw the old tab and sees the new one sees a different letter, not a redraw of the same one.
- It is one string constant in `src/index.ts`. It is served by the Worker on every request. No token, no deployment step, no external dependency.

**The fix.** Use the real Archivo Black "W", extracted from the font that is already shipped in `assets/fonts/`. I did this and rendered it at 16px against the current path to be sure:

```
M36.6 56L32.1 34.84L31.9 34.84L27.4 56H15.13L7 21.25H18.62L22.61 40.95H22.81L26.75 21.25H37.76L41.95 40.95H42.15L45.89 21.25H57L48.87 56Z
```

That is the genuine glyph outline from `ArchivoBlack-Regular.ttf`, scaled to a 50px width on the 64px grid. It renders as a legible W at 16px, 32px and 64px, in both the light and the dark variant. The commit message's own stated intent — *"drawn as a path, not text, so it does not depend on a font being present"* — is honoured by extracting the path **from** the font rather than hand-writing one.

### NEW-5 — LOW. The `/about` page says the same thing twice in one paragraph

**Location:** `src/board.ts:1107-1119`.

The address clause was rewritten in this commit to be true in all three configurations, which was the right call. But two of its three branches now end with a claim that the very next sentence repeats:

> "The whole board holds **4 independent agents from one address**. That is one machine, so **the count is not a community**. **The count is not the size of a community.**"

And in the all-distinct branch:

> "…so **the count is not one machine counted more than once**. **The count is not the size of a community.**"

The trailing "The count is not the size of a community." is at `src/board.ts:1118-1119` and is appended to the clause in every branch. Before this commit the clause ended with a *different* claim ("Most of that is one machine counted more than once, not 4 people in 4 places"), so there was no duplication — **this commit introduced it.**

**The fix.** Drop the trailing sentence from the two branches that now make the same point, and keep it only in the `spread` branch where it adds something. Or cut the clause's own ending clause and let the standing sentence carry it.

**Why it is Low.** It is two sentences that agree, on one page, in one paragraph. It is not a false statement and it does not mislead. But it is the same defect NEW-3 was, on a different page, and this branch fixed NEW-3 for exactly this reason.

### NEW-6 — LOW. "Use my system theme" is a second button that does nothing for most readers

**Location:** `src/html.ts:1052`, `src/html.ts:1014-1019`.

This was the second half of NEW-1, and it is **not** addressed. The button is rendered on every page, always visible, at 13px in the muted ink, sitting immediately beside the primary "Dark mode" button as a peer. For the majority of readers — those with no `tw-theme` override, which is everyone who has never touched the toggle — clicking it does nothing at all: there is no override to undo.

Measured: `visible: true`, `display: block`, `disabled: false`, on both light and dark, with no override set.

**The fix.** Hide it when `localStorage.tw-theme` is absent. It costs three lines in `wire()` and it removes a control that asks a reader to do something that has no effect.

### Carried over from the re-review, not in this commit

### PRE-1 — MEDIUM. The `/weekly` table puts its fifth column off-screen

**Not a regression.** Verified against the parent commit `cdc89cd`: the table is byte-identical there. But it is the *same class of defect as M3*, on a page the fixes did not touch, and M3's fix is the pattern it should follow.

Measured on `/weekly` at 390px: the table is **423px** wide in a **314px** container. The `Status` column is entirely off-screen and the header "THIS WEEK" is cut mid-word. `.tablewrap` is `overflow-x:auto`, so the document does not overflow and **the automated audit passes it** — 0 findings, 0px overflow. A reader on a phone gets a table with a hidden column and no affordance.

The same is true of the cluster page's samples table (`src/board.ts:514-520`): **439px** in a **314px** container at 390px, with the "When" column off-screen.

**The fix.** The same shape M3 got: a definition list, or a stacked layout where the columns become rows.

---

## The measured numbers

### NEW-2 — the placeholder

| | Before (re-review) | **Now** | Fits? |
|---|---|---|---|
| Placeholder | "Convert a PDF invoice into structured line items" | **"Parse a PDF invoice into line items"** | |
| Characters | 45 | **35** | |
| Width needed at 16px | ~360.1px | **248.1px** | |
| Field inner width at 320px | 220px | **220px** | |
| **Overflow at 320px** | **140.1px** | **28.1px** | **no** |
| Visible characters at 320px | ~27 | **31** | |
| Visible characters at 320px/200% | ~7 | **8** | |
| Visible characters at 390px/200% | ~20 | **13** | |
| Fits at 390px | no | **yes** (248.1 ≤ 290) | **yes** |
| 404 page, 17px, 320px inner 216px | — | needs **263.6px**, overflows **47.6px** | **no** |

### H4 — the hero's caveat

| | Before the branch | After the first attempt (re-review) | **Now** |
|---|---|---|---|
| Stats line | — | 51 chars | **49 chars** |
| Caveat | 144 chars | 111 chars | **33 chars** |
| Total paragraph | 258 chars | 163 chars | **82 chars** |
| **Caveat as a share** | **55.8%** | **68.1%** | **40.2%** |

### M3 — the tools list

| Viewport | `dt` column | `wish(need, …)` lines | `scrollWidth` vs `clientWidth` | Document overflow |
|---|---|---|---|---|
| 320px | 288px | **2** | 288 = 288 | none |
| 320px @200% (160px) | 128px | **4** | 128 = 128 | none |
| 390px | 358px | 1 | 358 = 358 | none |
| 390px @200% (195px) | 163px | **3** | 163 = 163 | none |

### NEW-1 — the theme control, all four states, driven in a browser

| System | Override | Page background | Button reads | Correct? |
|---|---|---|---|---|
| dark | none | `rgb(16, 14, 13)` | **"Light mode"** | ✓ |
| light | none | `rgb(243, 238, 225)` | **"Dark mode"** | ✓ |
| dark | dark | `rgb(16, 14, 13)` | "Light mode" | ✓ |
| light | light | `rgb(243, 238, 225)` | "Dark mode" | ✓ |

Flip: `data-theme` and `localStorage` both written, label follows, background flips. Clear: both removed, label returns to the system's reading, background returns. **0 console errors** across every run.

### Contrast of the new elements

| Element | Light | Dark |
|---|---|---|
| `.tools dt` (signature) | **16.10:1** | **16.62:1** |
| `.tools dd` (description) | **7.53:1** | **7.38:1** |
| `.seednote` | **7.53:1** | **7.38:1** |
| `.addresses` ("from 1 address", 13px) | **8.57:1** | **6.83:1** |
| `.tallybig` | **18.34:1** | **15.40:1** |

All pass AA with room. The lowest is the 13px address line on the dark chip at 6.83:1.

### C3 — the tally still does not outrank the title

Using the prior review's calibrated ink model (`0.3048` of the em box per glyph), unchanged:

| | 320px | 390px |
|---|---|---|
| `.cluster h2` | 18px / 400 / ink | 18px / 400 / ink |
| Title ink | **2521** | **2521** |
| Tally ink (count + "agents" + "from 1 address") | **1886** | **1886** |
| **Tally ÷ title** | **0.748** | **0.748** |

The address line adds to the tally block but does not push it past the title. C3's fix holds.

### The card, verified on screen

Seeded locally: 1 published cluster, 4 agents, 4 wishes from 1 address, 6 seeded wishes. The card renders `4 agents` with `from 1 address` beneath it, shown **only when the two differ** — with the cluster set to 1 agent from 1 address, the address line is correctly omitted. The address count excludes seeded wishes (`getAddressBreakdown`, `src/db.ts:382-384`), so `1 address` is true.

### The `/about` address clause, all three branches, driven

| Configuration | Rendered |
|---|---|
| 4 agents, 1 address | "The whole board holds 4 independent agents from one address. That is one machine, so the count is not a community. **The count is not the size of a community.**" |
| 4 agents, 2 addresses | "…across 2 distinct IP addresses. Most of that is one machine counted more than once, not 4 people in 4 places. The count is not the size of a community." |
| 4 agents, 4 addresses | "…across 4 distinct IP addresses. Every one of them came from a different address, so the count is not one machine counted more than once. **The count is not the size of a community.**" |

All three are **truthful**. Two of them repeat themselves.

---

## The registry size, read rather than approximated

Verified working end to end. `getStats` reads `servers` from the database (`src/db.ts:690`). With the mirror seeded:

- `/about` lede: "There are 30,200 servers in the official MCP registry, and it is hard to tell which of them agents need."
- `/llms.txt`: the same sentence, on its own line.
- `/llms-full.txt`: "There are 30,200 servers in the official MCP registry, and it is hard to\ntell which of them agents actually need." — the hardcoded wrap still lands correctly at 5 digits, with the thousands separator.
- `/api/stats`: `"servers": 30200`.

One thing to note: the **fallback** string still says "tens of thousands" (`src/board.ts:1090`, `:1202`, `:1245`), which is the approximation the commit set out to remove. It only fires when `servers === 0`, which in production it is not. Worth knowing, not worth blocking on.

## The README's false zeros are still in the document

`scripts/refresh-numbers.mjs` was fixed correctly: a missing field is now a refusal to write, not a zero. I ran it against the local server and it wrote real numbers (10 wishes, 4 agents, 1 address, 30,200 servers).

But **the stale false zeros are still in the README**, at `README.md:386` and `README.md:390`:

```
| Distinct IP addresses behind them | 0 | `GET /api/stats` |
| MCP servers in the registry mirror | 0 | `GET /api/stats` |
```

Production does not yet report `distinctIps` or `servers` (I checked: both are missing from `https://toolswanted.dev/api/stats`), so the script would now refuse to run against production until the branch is deployed — and the false zeros it wrote earlier are still sitting in a document whose every row claims to come from `GET /api/stats` and which is stamped "measured … on 2026-11-05". The fix prevents the next false zero. It does not repair the last one. **One line to fix, after the deploy that makes the fields exist.**

---

## What has to happen before this ships

| # | Action | Where | Severity |
|---|---|---|---|
| 1 | **Replace the favicon path with one that draws a W.** Use the Archivo Black "W" outline from the shipped font, or a hand-drawn path that has three top peaks. The current path is an X. | `src/index.ts:80`, `:82` | **Medium — NEW-4. The blocker.** |
| 2 | **Shorten the check form's placeholder so it fits the narrowest field** — about 25 characters, e.g. "read a PDF invoice" — and move the long example into the `.check-note` line beneath. The same string is clipped on the 404 page at 17px. | `src/board.ts:167`, `src/index.ts:166` | **Medium — NEW-2** |
| 3 | **Cut the duplicated sentence on `/about`.** The new address clause and the standing "The count is not the size of a community." say the same thing in two of the three branches. | `src/board.ts:1108-1119` | **Low — NEW-5** |
| 4 | **Hide "Use my system theme" when there is no override to undo.** | `src/html.ts:1014-1019`, `:1052` | **Low — NEW-6** |
| 5 | **Reshape the `/weekly` and cluster-page tables** so the last column is not off-screen. Same shape M3 got. | `src/board.ts:514-520`, `:656-660` | **Medium — PRE-1 (pre-existing)** |
| 6 | **Deploy, then run `npm run og:sync` with the production `ADMIN_TOKEN`.** The source is fixed and I rendered both posters to prove it; the deployed PNG is still stale. | deployment | **Deployment step** |
| 7 | **Re-run `npm run refresh-numbers.mjs` against production after the deploy** and check the README's two zero rows. | `README.md:386`, `:390` | **Deployment step** |

Items 1, 3 and 4 are together under an hour. Item 2 is twenty minutes.

**And the three assertions the audit still cannot make**, which the re-review asked for and which are still not there: button label vs rendered theme (would have caught NEW-1), placeholder fits its field (would have caught NEW-2), and first column carries the meaning (would have caught M3 and would catch PRE-1). The `tests/theme-control.test.ts` browser test is a good test and it passes — but it was written *after* the bug was found, and it does not cover the placeholder or the tables. Those two assertions are what stop the same class of defect coming back.

---

## Positive findings worth keeping

**1. The theme control is now right, and it is right for the reason that matters.** The label reads from the *effective* theme, so it describes what the reader would get, not what the attribute says. That is the difference between a control that labels itself and a control that describes its own effect. The `matchMedia` change listener — a reader whose system flips at sunset sees the button follow it — is a small thing that nobody asked for and that I would have asked for.

**2. The tools list is a better shape than the table it replaced.** The description is under the signature because the description is the answer to "what do I want this for" and the signature is the least useful half. The comment at `src/html.ts:648-660` says exactly why, and says why a table was the wrong shape for a 358px screen anyway. The rule that made it hold — `overflow-wrap:anywhere` with `word-break:normal`, so the long unbreakable token wraps rather than overflowing — is the right rule, and it was chosen by computing the column width at 320px/200% zoom first.

**3. The `/about` address clause is now true in all three configurations.** Four agents from one address says so. Four agents from four addresses says so. And it stops claiming "one machine counted more than once" when every agent came from a different address. Before this commit that clause was asserted unconditionally, and it was false on a board where every agent came from a different address. The spread test — `distinctIps < agents` — is the right condition, and the third branch is the one that was missing.

**4. The registry size is read, not approximated.** From the database, on three surfaces, with the thousands separator, and the fallback is unreachable in production. The rule in `brand/VOICE.md` — *"not as an approximation, not as 'roughly', not as 'around'"* — is now actually enforced by the code rather than by good intentions.

**5. The card's address count earns its place.** `addresses > 0 && addresses < cluster.unique_agents` (`src/board.ts:333`). One number when the two agree, two when they do not. The restraint is right and I verified both branches.

**6. The `/build` page got better, not just fixed.** It now leads with what actually works — the registry check — instead of a dead end with a list beside it. "The board is young and nothing has been wanted by three independent agents yet, so there is nothing to claim. What works today is the check:" That is a page that tells the truth and then offers the reader something to do.

**7. The privacy page stopped claiming something false.** Dropping `nav: "/privacy"` is the honest fix. The alternative — inventing a nav state for a page that is not in the nav — would have been worse.

**8. The refresh script's refusal is right.** A missing field now means the deployment is older than the code, and the script says which deployment it needs and exits rather than writing a zero. That is the whole house philosophy in thirty lines: no figure in a document is a guess.

**9. The audit is still clean.** 168 page loads, 0 findings, 0 console errors, 386 tests passing, typecheck clean. Nothing in this branch broke the overflow, contrast, heading-order or touch-target checks — and the h1 `overflow-wrap` rule that was added handles a 78-character cluster title at 320px without a single mid-word break.

**10. The weekly ticker now says one thing.** "Live. The count moves as wishes come in." One sentence, one fact, and it no longer competes with the paragraph eight lines above it.

---

## What I did not fix

Nothing was changed. This is a review. The only things I touched were the local SQLite database (seeded, then restored to its original empty state — 0 wishes, 0 clusters, 0 servers), and `README.md` / `docs/show-hn.md` (the refresh script rewrote them during a test, and I reverted both). `git status` shows no modified tracked files.

`npm test` was run by me: **386 passing, 40 files**. `npm run typecheck` was run by me: **clean**. `node scripts/audit-browser.mjs` was run by me: **168 page loads, 0 findings, 0 console errors**. `node scripts/check-pages.mjs` was run by me: **0px overflow on every page**.

---

*Samira Wyatt, Design & Delight Lead — Tools Wanted*
