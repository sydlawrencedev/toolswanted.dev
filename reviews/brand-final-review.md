# Brand final review: product copy and launch content

**Reviewer:** Samira Okafor, Content & Brand Lead
**Date:** 5 November 2026
**Branch reviewed:** `feature/marketing-design-review`, commit `7c4366e`
**Type:** Final review. Third pass. Decides ship or no ship.
**Final say:** `gtm-owner` on copy decisions, `ceo` on anything that changes what the product claims

---

# VERDICT: DOES NOT SHIP

**The reason, in one paragraph.**

Two of the three blocking items are fixed and fixed well. The refresh script now refuses to write when a field is missing, names the fields, exits 1 and leaves the documents untouched. The `/about` page reads its registry size from the database, pluralises its address count, and only says "one machine counted more than once" when the address count is genuinely lower than the agent count. The `/build` page leads with a live action. The reply shows its match scores. The deleted entry is gone from all three surfaces. The em-dash rule holds across every file. Both of the founder's protected sentences survive word for word. `npm test` (386 passing) and `npm run typecheck` are clean.

**But the third blocking item was never fixed, and the first one was fixed in the script but not in the document it protects.** `docs/show-hn.md` still opens with **"There are tens of thousands of servers in the official MCP registry"**, and the post's example reply still reads **"+1 to an existing wish (3 agents want this, 3 wishes in total)"**. Neither of those is in the branch. Both are in the committed file at `7c4366e`. The post's own checklist at line 116 still says the example's counts "are the ones that were true when this was written", which is the sentence my re-review named as the problem. And `README.md` still publishes **"Distinct IP addresses behind them | 0"** and **"MCP servers in the registry mirror | 0"**, each attributed to `GET /api/stats`, while production's database says **3** and **55,289**. The script was taught to refuse. Nobody ran it against a deployment that has the fields and committed the result, so the two false zeros are still sitting in the project's first reader-facing document.

I checked `git diff cdc89cd 7c4366e -- README.md docs/show-hn.md`: **empty**. Those two files were not touched by the commit under review.

---

## 1. Finding-by-finding verification

Status across the three blocking items, the seven new findings and the remaining open items: **7 fixed, 1 partially fixed, 2 not fixed.**

| # | Finding | Action | Status | Evidence |
|---|---|---|---|---|
| **B1** | The refresh script mapped a missing field to `0` and wrote two false zeros into the README | 1, B2 | **Fixed** | `scripts/refresh-numbers.mjs:98-109`. `REQUIRED` lists eight fields; `missing` is computed with `stats[f] === undefined \|\| stats[f] === null`, so a genuine zero and an absent field are now distinguishable. On missing it prints the base URL and the field names and calls `process.exit(1)` **before** any `writeFileSync`. Verified against production: `node scripts/refresh-numbers.mjs` → exit code **1**, stderr reads "https://toolswanted.dev/api/stats does not report: distinctIps, servers.", and `git diff --stat` afterwards was **empty**. Nothing was written. The comment block at `:81-97` records what happened and why, which is the kind of comment that stops the next person putting the `?? 0` back. |
| **B1 (the document)** | The README published two false zeros | 1, B2, B3 | **NOT FIXED** | `README.md:386` and `:390` still read "Distinct IP addresses behind them \| 0" and "MCP servers in the registry mirror \| 0", each labelled `GET /api/stats`. Production's database says **3** and **55,289** (read directly: `SELECT COUNT(DISTINCT ip_key) FROM wishes WHERE seeded=0` → 3; `SELECT COUNT(*) FROM servers` → 55289). The script refuses to write, so the zeros it produced are now frozen in place with no mechanism left to correct them. The blocking condition my re-review named is live on the project's first reader-facing document. `git diff cdc89cd 7c4366e -- README.md` is **empty**. |
| **B2** | The post's registry size was "tens of thousands" | 3, NEW-3 | **NOT FIXED in the post. Fixed everywhere else.** | `docs/show-hn.md:9-10` still reads "There are tens of thousands of servers in the official MCP registry, and it is hard to tell which of them agents actually need." `README.md:5` still reads the same. `git diff cdc89cd 7c4366e -- docs/show-hn.md` is **empty**. **The source code is fixed:** `src/board.ts:1089-1090` (`/about` lede), `:1201-1202` (`llms.txt`) and `:1243-1244` (`llms-full.txt`) now read `stats.servers` from the database and fall back to the approximation only when the count is zero. Verified by rendering: `/about` with `servers: 55289` produces "There are 55,289 servers in the official MCP registry, and it is hard to tell which of them agents need." So the fix exists, runs on the site, and was never applied to the two documents a reader is actually given. |
| **B3** | The example reply carried a figure the board does not produce | 4, NEW-4 | **NOT FIXED** | `docs/show-hn.md:22` still reads `→ "+1 to an existing wish (3 agents want this, 3 wishes in total)."` The `llms.txt` shape the brief names is at `src/board.ts:1270`: `"+1 to an existing wish (N agents want this, M wishes in total)."` The post does not use it. The checklist at `docs/show-hn.md:116-118` still reads "The example reply is illustrative of the shape of the reply. The agent count and the wish count in it are the ones that were true when this was written." That is the sentence my re-review called the problem, and it is still there. The capability is real: `GET /api/cluster/convert-pdf-invoice-structured-line-items` returns **2 agents, 2 wishes**, not 3 and 3. |
| **F6** | `/build` gave three ways to look at an empty board | 10, H3 | **Fixed** | `src/board.ts:896-901`. The page now opens the block with "The board is young and nothing has been wanted by three independent agents yet, so there is nothing to claim. What works today is the check:" and the first bullet is "**Ask whether a tool already covers it.** The board checks every request against a mirror of the official MCP registry, so an agent filing a wish gets pointed at what already exists instead of waiting. [Try it]." The other two bullets are "Read the board and the agent count on each entry" and "Put the weekly most wanted list in your README." **Reads as a next step, not an apology.** The apology is gone; the three items are now one live action and two things to read. |
| **NEW-1** | "1 distinct IP addresses" | H1 | **Fixed** | `src/board.ts:1112`. The one-address branch reads "The whole board holds 1 independent agent from one address." and the spread branch reads "...across 3 distinct IP addresses." The count is never printed with a hardcoded plural. Verified across all five branches by rendering `renderAbout` directly. |
| **NEW-2** | "Most of that is one machine counted more than once" asserted unconditionally | H2 | **Fixed** | `src/board.ts:1109-1114`. `const spread = agents > 0 && distinctIps < agents;` gates the clause. Three branches, all rendered and read: **one address** → "That is one machine, so the count is not a community."; **addresses < agents** → "Most of that is one machine counted more than once, not 6 people in 6 places."; **addresses >= agents** → "Every one of them came from a different address, so the count is not one machine counted more than once." The second is the more reassuring statement and it is now reachable. |
| **NEW-5** | Three surfaces pointed at the deleted entry | M2 | **Fixed** | `src/index.ts:166` (the 404 form) now reads "Parse a PDF invoice into line items"; `src/board.ts:888` (the `/build` slug field) now reads "the-slug-of-the-capability"; `src/index.ts:989` (the `/claim` error) now reads "for example the-slug-of-the-capability-you-are-building". `grep -rn "read-uk-council-planning"` over `src/` returns **nothing**. The string survives in `tests/ux.test.ts`, `tests/badge-slug.test.ts`, `tests/design.test.ts`, `tests/audience.test.ts`, `tests/core.test.ts`, `scripts/test-claim.mjs`, `scripts/check-pages.mjs`, `scripts/screenshots.mjs`, `scripts/shoot.mjs`, `scripts/audit-extra-pages.mjs`, `docs/launch.md` and `docs/transcript.md`. **Every one of those is legitimate and none of it matters.** The tests use it as a fixture slug, not as a product example; `docs/launch.md:203` and `:339` are an internal historical record of a bug that has been fixed; `docs/transcript.md` is a raw MCP wire log, not prose, and is not linked from any public surface. None of it points a reader at an entry that does not exist. |
| **NEW-6** | The reply did not show the match scores | M1 | **Fixed** | `src/board.ts:983-988`. Each server line now ends `[match 0.692]`. Rendered output: `- A Tool (a/b): Does a thing. https://x/y [match 0.692]`. The score is always present: `src/wish.ts:209` writes `score: Number(m.score.toFixed(3))` before the record is stored, so `s.score.toFixed(3)` cannot throw. The number is to three decimals, which matches the four-decimal precision the API returns without implying more accuracy than the embedding gives. |
| **NEW-7** | The probe wish added a fourth wish to production | — | **Noted, no action** | Production now reads 6 wishes, 6 agents, 4 pending. The script picks it up. Nothing to do. See NEW-9 for why this is now a larger number than the brief expected. |
| **M3** | `README.md:165` says "all ~55k servers" | M3 | **Open, low** | Still outside the script's markers, still hand-typed. It is accurate today (55,289 is "~55k") and it will drift. Low severity, but it is the third place the registry size appears and it is the only one the script cannot reach. |
| **L1** | Named byline on the post | L1 | **Open, low** | Still no byline. Show HN carries the account. Unchanged from both prior reviews and still low priority. |

---

## 2. New findings

### NEW-8. The "not N people in N places" construction is still grammatically broken. **Severity: medium.**

This was named in my re-review's H2 as part of the same fix, and the conditional was applied but the grammar was not.

`src/board.ts:1113`:

```
? `The whole board holds ${num(agents)} independent ${plural(agents, "agent", "agents")} across ${num(distinctIps)} distinct IP addresses. Most of that is one machine counted more than once, not ${num(agents)} people in ${num(agents)} places.`
```

`num()` has no plural handling, and neither noun is pluralised. Rendered with one agent and one address:

> "The whole board holds 1 independent agent across 1 distinct IP addresses. Most of that is one machine counted more than once, not 1 people in 1 places."

Two errors in one clause: "1 distinct IP addresses" and "not 1 people in 1 places". My re-review said explicitly: "Also fix the grammar while you are in there: the current construction renders 'not 1 people in 1 places'." It still renders it.

It is worth noting that this branch is not currently reachable in production. `distinctIps < agents` and `distinctIps === 1` are mutually exclusive, so the one-address branch catches the single-agent case first and the broken spread clause only fires at two or more agents across fewer addresses than agents. Production is currently 6 agents across 3 addresses, so it **is** reachable today. It fires, and it reads "not 6 people in 6 places", which is the inversion my re-review complained about: with 6 agents across 3 addresses the sentence is trying to say that some of those agents share a machine, and the construction it uses to say that says the opposite.

The fix is the same shape as the one already applied twice in this file: use `plural()` for both nouns, and drop the "not N people in N places" inversion for something that is true in both directions, such as "Most of them came from fewer machines than that."

### NEW-9. The numbers in the committed documents are now three counts behind production, and they cannot be corrected until a deploy happens. **Severity: medium, and it is a workflow problem rather than a copy problem.**

The brief describes production as "4 wishes, 4 agents" and the production database as saying 55,289 against the post's 55,288. The live board has moved further than that while this review ran. Measured directly against production at the time of writing:

```
GET https://toolswanted.dev/api/stats
{"ok":true,"clusters":0,"wishes":6,"agents":6,"seededWishes":0,"shipped":0,"pending":4}
```

```
Production database:
  COUNT(DISTINCT ip_key) FROM wishes WHERE seeded=0  →  3
  COUNT(*) FROM servers                                 →  55289
  COUNT(DISTINCT name) FROM servers                     →  55289
```

The committed documents say 3 wishes, 3 agents, 3 pending, and 0 distinct addresses. The board says 6, 6, 4 and 3. The README's "Distinct IP addresses behind them | 0" is now wrong by three, and its "MCP servers in the registry mirror | 0" is wrong by 55,289.

Two things follow. First, the review brief's own framing of the 55,288 question is out of date: the number to write is **55,289**, and `COUNT(DISTINCT name) FROM servers` returns the same figure, so it is 55,289 distinct servers and not a count with duplicates in it. If 55,288 appears anywhere on the day it posts, it is wrong by one and a reader with a curl can see it.

Second, and more useful: this is the board working. The numbers move because agents file real wishes, and the script exists precisely so the documents follow. The problem is only that the script cannot be run against production until the branch is deployed, and until it is deployed the committed documents hold figures that are known to be wrong. That is a deploy-order constraint, and it should be named as one rather than discovered on the day. The re-review's B1 already said this: deploy first, then refresh. Nothing has changed about that requirement, and it is still unmet.

### NEW-10. The refresh script's registry-size regex cannot match the committed post. **Severity: medium.**

This is the mechanical reason B2 did not happen, and it will bite whoever tries to fix it by running the script rather than editing the post.

`scripts/refresh-numbers.mjs:181-184`:

```js
post = post.replace(
  /There are [\d,]+ servers in the official MCP registry/,
  `There are ${num(stats.servers)} servers in the official MCP registry`
);
```

The regex matches "There are 55,288 servers in the official MCP registry". The committed post at line 9 says "There are **tens of thousands** of servers in the official MCP registry", with a line break after "and it is". The regex does not match, and `String.replace` with no match returns the string unchanged. **The script fails silently and leaves the approximation in place**, which is the exact class of defect the script was rewritten to eliminate: a figure that is not what the source says, written by a mechanism that reported success.

Verified: `node -e` against the committed post returns `match: false`, and the local run of the script left line 9 byte-identical while rewriting the board block and the measurement note.

The fix is to widen the regex to cover the approximation it is meant to replace, and to throw when it does not match, the way `replaceBetween` already throws when a marker is missing. A script that writes figures must fail loudly when it cannot find the figure it is replacing.

---

## 3. Voice compliance, re-run across every changed file

Files re-checked: `src/board.ts`, `src/html.ts`, `src/index.ts`, `src/rss.ts`, `src/snippet.ts`, `src/wish.ts`, `src/db.ts`, `docs/show-hn.md`, `docs/launch.md`, `README.md`, `scripts/refresh-numbers.mjs`.

| Rule | Pass/Fail | Evidence |
|---|---|---|
| **No em dashes** | **PASS** | Zero `—` and zero `–` in all eleven files. Checked per file, not by a single combined grep. No ` -- ` sequence either. |
| **No American spellings** | **PASS** | Every `color` hit is a CSS property in a stylesheet (`src/html.ts:82,152,335,336,439,451,570,571,578,639,649,685,707,801,810`). `Math.max` / `Math.min` at `src/board.ts:304`, `src/index.ts:108`, `src/db.ts:122,324` are the JavaScript function, not the noun. Prose uses `sanitised`, `labelled`, `behaviour`, `recognised`, `catalogue`, `modelling` where applicable. No `favor`, `recognize`, `organize`, `centered`, `labeled`, `personalized`, `catalog`, `behavior`, `analyze` in any prose string. |
| **No banned phrases** | **PASS** | Zero hits across all eleven files for "In today's digital age", "Moreover", "Furthermore", "Delve into", "Harness the power of", "Unlock your potential", "Transform your", "Navigate your", "This is not just X. It is Y.", "This isn't only about X. It's about Y.", and for the wider set "revolutionary", "game-chang", "seamless", "leverage", "cutting-edge", "state-of-the-art", "supercharge", "elevate", "AI-powered". |
| **No emoji as punctuation** | **PASS** | None in any user-facing file. The `·` middot at `src/board.ts` is a typographic middot in a list marker, not an emoji and not standing in for a full stop. |
| **No bullet lists in posts** | **PASS** | `docs/show-hn.md` body (lines 9-100) is paragraphs and bolded single-line statements. The bullets at `:104-146` are the internal "Before this goes up" checklist, which is not part of the post. The `/build` page's list is a page, not a post, and `brand/VOICE.md` scopes the rule to posts and articles. |
| **No hedging in the body copy** | **PASS** | The honest dead ends remain and read as statements of the deployment's state rather than as disclaimers: "Claiming is not switched on yet. Sign in with GitHub is not configured on this deployment, so a wish cannot be claimed here." ("/build"), and "Nothing is executed. Wish text is untrusted input." (post). The `/about` and hero sentences are declarative in every branch. |
| **No generic advice** | **PASS** | The post leads with a mechanism a builder can use today and a measured result ("four working weather servers, all of them already published"). The paragraph on the fingerprint splitting one machine into several agents is the specific observation the rule asks for. |
| **Numbers verified before publication** | **FAIL (blocking)** | `brand/VOICE.md:95-101`: "If a number cannot be verified, it does not appear. Not as an approximation, not as 'roughly', not as 'around'." **The post opens on "tens of thousands"** (`docs/show-hn.md:9`), which is an approximation, and the number is verifiable: the production database says 55,289. **The README publishes two false zeros** (`README.md:386,390`) attributed to `GET /api/stats`, which returns 3 and 55,289. **The post's example reply** carries "3 agents want this, 3 wishes in total" for a capability with 2 agents and 2 wishes, and its own checklist documents that the figures are frozen. This is the same rule that failed in both prior reviews. It has now failed in a third file. |
| **One number that surprises the reader** | **FAIL** | The founder's Decision 5 named one number for the post: the registry size, re-measured, dated, appearing once, prominently, early. It is an approximation in the first sentence, and the real figure is nowhere in the post. The post currently carries **three competing figures for the same board**: the approximation at `:9`, "3 agents / 3 wishes" in the example at `:22`, and "The 3 wishes on it" at `:92`. Two of those three are wrong, and the third is a different count from the same endpoint. The post is not the piece with one number. |
| **Speak to one person, one situation** | **PASS** | The lede opens on the builder's moment ("Choosing what to build next?", `src/board.ts:157`). The hero check answers "does this already exist" before the board is mentioned. The post addresses one builder deciding what to build this weekend. |
| **British register, understated confidence** | **PASS** | "The board is young and I would rather say so than let the numbers imply more than they do" (`docs/show-hn.md:50-51`) and "I have not built the loop that takes you from 'I want to build this' to 'I built it' yet, and I would rather say that than fake it" (`:64-65`) are the register. |
| **Sound like a person, not a platform** | **PASS** | First person singular throughout the post. "Ask it for 'the current weather for a city' and it comes back with four working weather servers, all of them already published, and the agent carries on" (`:39-40`) is a person describing something they watched happen. |
| **Named byline** | **Open, low** | Unchanged. Action 15 still stands. Show HN carries the account. |
| **Vary the sentence structure** | **PASS** | The post moves between short statements ("Nothing is executed.") and long explanatory sentences. The hero's stats line no longer carries the four-clause run that broke the rhythm in the first review. |
| **Open with the reader's situation, not the concept** | **PASS** | `src/board.ts:157`. The lede leads with "Choosing what to build next?", and the check block that follows is the answer to that moment. |
| **End with one specific next step, not a menu** | **PASS** | The post ends with "The board is the story, so please go look at it rather than reading my description of it" (`:99-100`), which is one thing. The hero ends with a snippet to paste, which is one thing. `/build` now leads with one live action. Finding 6 and H3 are closed. |
| **Every text node legible in a coloured block** | **PASS** | `scripts/check-pages.mjs` reports **0px desktop overflow and 0px mobile overflow** on `/`, `/about`, `/agents`, `/build`, `/weekly` and `/wish`. The `/agents` tools list was rebuilt from a two-column table into a `<dl>` (`src/board.ts:813-819`) with `overflow-wrap:anywhere` on the `dt` (`src/html.ts:657-661`), which fixes the 181px monospace signature in a 128px column. |
| **Muted hierarchy still reads** | **PASS** | `.hero .herostats` and `.hero .seednote` are `var(--ink-soft)`; the seednote's `b` is `var(--red-ink)` at weight 700 (`src/html.ts:336-337`). The seednote is a separate span with its own class, so the muted hierarchy reads as: eyebrow muted, headline full, supporting copy readable. |
| **Every internal link resolves** | **PASS** | `scripts/check-pages.mjs` walks `/`, `/about`, `/agents`, `/build`, `/weekly`, `/wish` and the 404 route with no broken links. The only console error is the deliberate 404 on the pending cluster, which is the publish gate working. |
| **No live page states a number the board's own queries cannot produce** | **PASS on the pages, FAIL on the documents** | `/about`, `/about`'s registry lede, `llms.txt` and `llms-full.txt` all read from `getStats()`. The pages pass. **The README does not.** It states two zeros that the board's own queries contradict. The gate was aimed at the template, then at the script, and it has not yet been aimed at the committed file. |
| **No hedge or approximation** | **FAIL** | "Tens of thousands" survives in five user-facing places: `docs/show-hn.md:9`, `README.md:5`, and the three fallback branches in `src/board.ts:1090,1202,1244`. The fallback branches only fire when `servers === 0`, which is correct behaviour, but the two documents are live on the approximation today. `README.md:165` ("~55k") and `:352,:358` ("roughly 5,500 wishes", "roughly seven wishes a day") are also approximations in prose. The latter two are capacity estimates with a stated basis and are arguably different in kind, but `brand/VOICE.md` does not carve out an exception for estimates. Low severity, flagged not fixed. |

---

## 4. Positive findings worth protecting

The work is good and a lot of it should not be touched.

- **The refresh script now knows the difference between zero and absent.** `REQUIRED` plus `missing` plus `process.exit(1)` before any write. Verified against production: it refuses, names `distinctIps, servers`, exits 1 and leaves `git diff` empty. The comment at `:81-97` records the exact failure it exists to prevent. This is the right shape for a script that writes figures.
- **The one flag still drives the board's state.** `boardIsEmpty` (`src/board.ts:140`) drives the hero, the card area and the empty state together, so they cannot contradict each other. The first review found the hero saying "0 wishes from 0 agents, in 0 clusters" thirty pixels above "Nothing on the board yet". That cannot come back.
- **The empty state stopped blaming the reader.** Filtered and unfiltered branches (`src/board.ts:223-227`), and the unfiltered one says why the board is empty rather than implying the reader is looking in the wrong place.
- **The publish gate is a genuine correctness fix and the most valuable thing in the branch.** `src/db.ts:75-95` filters on `status = 'published'`, with a separate `getClusterBySlugAnyStatus` for admin surfaces. Verified live: `/w/read-uk-council-planning-pdfs-as-structured-data` returns 404 on the branch, and the badge 404s with it. A board whose threshold is theatre is not a board.
- **`/about` now tells the truth in every branch, and the reassuring branch is the reachable one.** Six agent-and-address combinations rendered and read. "Every one of them came from a different address, so the count is not one machine counted more than once" is exactly the sentence my re-review asked for.
- **The hero's seed caveat stopped eating the stats line.** It was 68% of the sentence. It is now "N wishes are ours, marked seeded." with the full explanation in the `title` attribute and again in the footer at `src/html.ts:1045`. Hover-only in the hero is acceptable because the footer carries the same explanation in visible text, so nothing is hidden behind a mouse.
- **The `/build` page now offers one thing a builder can do today.** The apology is gone, the check is first, and the other two items are things to read rather than things to do. Finding 6 and H3 are both closed.
- **The reply shows its match scores.** `[match 0.692]`, always present, always numeric. Decision 3 asked for it and it landed.
- **The deleted entry is gone from every surface a reader meets.** Three surfaces fixed, `grep` over `src/` is clean, and the surviving occurrences are tests and internal docs where they belong.
- **The snippet is right.** 242 characters, 40 words, four sentences. A request a person makes in a chat, not a protocol description. It keeps the header clause, which is the part a reader cannot guess.
- **The RSS pluralises.** Both nouns agree at 0 and at 1.
- **The founder's two protected sentences survive word for word.** "I have not yet seen a builder claim an entry. That is the number the whole thing exists for, and it is zero." (`docs/show-hn.md:57-58`) and "The registry check is the part that works today, with no crowd at all" (`:67-68`). Verified by grep against the exact strings at `reviews/product-direction.md:258` and `:260`.
- **The title still promises exactly what the board can show.** A board and a mechanism, not a count, not a leaderboard. The rule the author wrote at `:124-125` is still there and still obeyed.
- **`npm test` (386 passing, 40 files) and `npm run typecheck` (clean) both pass.** The copy is held in place by tests.
- **The design agent's fixes landed without breaking the voice.** The favicon is now a drawn path rather than a Helvetica "W", the theme control actually wires up and names the theme the reader would get, the `/agents` tools list no longer pushes its only meaningful column off-screen, and the OG poster no longer says "WANTED" twice in one bar. None of it introduced a banned phrase, an em dash or an American spelling.

---

## 5. What has to change, in order

**Blocking. Nothing publishes until these four are done.**

| # | Change | Where | Why |
|---|---|---|---|
| **B1** | Deploy the branch, then run `node scripts/refresh-numbers.mjs` against production, and commit the result. The README must read `Distinct IP addresses behind them \| 3` and `MCP servers in the registry mirror \| 55,289`, not two zeros. | `README.md:386,390` | The two false zeros are still on the project's first reader-facing document. The script now refuses, so nothing will fix them by itself. |
| **B2** | Put the real registry total in the post, once, early, dated. It is **55,289**, not 55,288: the production database says 55289, and `COUNT(DISTINCT name) FROM servers` says 55289 too, so it is a count of distinct servers and not a count with duplicates in it. The reader must be able to check it with `GET https://toolswanted.dev/api/stats`. | `docs/show-hn.md:9-10`, and `README.md:5` for the same sentence | "Tens of thousands" is the approximation `brand/VOICE.md:95-101` forbids, in the one sentence the founder named twice as the number the launch carries. |
| **B3** | Change the example reply to the `llms.txt` shape: `"+1 to an existing wish (N agents want this, M wishes in total)."`. Delete the checklist item that says the counts "are the ones that were true when this was written", because it is the reason the figures freeze. | `docs/show-hn.md:22` and `:116-118` | The invoice capability has 2 agents and 2 wishes. The post says 3 and 3, and documents that it is documenting them. |
| **B4** | Widen the script's registry-size regex to match the sentence it is meant to replace, and make it throw when it does not match, the way `replaceBetween` throws on a missing marker. | `scripts/refresh-numbers.mjs:181-184` | Right now the script silently leaves "tens of thousands" in place and reports success. That is the same class of defect the script was rewritten to eliminate. |

**High, ship-blocking on quality:**

| # | Change | Where | Why |
|---|---|---|---|
| **H1** | Pluralise both nouns in the spread clause and drop the "not N people in N places" inversion. It currently renders "1 distinct IP addresses ... not 1 people in 1 places", and on today's production numbers it renders "not 6 people in 6 places", which inverts the truth. | `src/board.ts:1113` | Named in my re-review as part of H2. The conditional landed, the grammar did not. |
| **H2** | Move `README.md:165` ("all ~55k servers") inside the script's markers, or reword it to refer to the figure without stating it. | `README.md:165` | The third appearance of the registry size, and the only one the script cannot reach. |

**Medium and low:**

| # | Change | Where | Why |
|---|---|---|---|
| **M1** | Decide whether "roughly 5,500 wishes a day" and "roughly seven wishes a day" are estimates that are allowed to stand. If they are, say so once in the README rather than leaving the reader to notice. | `README.md:352,358` | `brand/VOICE.md` does not carve out an exception for estimates. Low, but it is the same rule as B2. |
| **L1** | A named byline on the post. | `docs/show-hn.md` | Action 15, unchanged across all three reviews. Show HN carries the account. |

---

## 6. Status

**Status: approved with changes. Does not ship as it stands.**

The code is in a good place and the copy is in a good place. What has not happened is the last mile on the two documents a reader is actually given. The fix for the registry size exists in `src/board.ts`, in three places, and it runs on the site. It was never applied to `docs/show-hn.md` or `README.md`, and `git diff cdc89cd 7c4366e -- README.md docs/show-hn.md` is empty. The fix for the example reply exists in `llms.txt` at `src/board.ts:1270` and was never applied to the post. The fix for the false zeros exists in the script and was never applied to the README, because the script now correctly refuses and a refusing script does not repair a document it will not write.

That pattern is the finding. Every fix is real and every fix stops one step short of the reader. B1 is a script that refuses where a document needs correcting. B2 is a template that reads the number where a document needs the number. B3 is a string in `llms.txt` where the post needs the string.

**I am not going to call this a near miss.** The rule in `brand/VOICE.md` is absolute and it has now failed three times in three files, each time with a real fix sitting immediately adjacent to the broken text. Two of the four blocking changes are one-line edits to two documents and a regex. The third is a deploy and a script run. The fourth is a grammar fix on a sentence that is already three quarters correct.

**Next step:** `gtm-owner` owns the copy decisions and the deploy order. Deploy first, then run the refresh script against production, then apply the two one-line document edits, then fix the regex so the script cannot fail silently next time. `ceo` owns the decision on whether the registry total goes on the page; my recommendation is unchanged and now stronger, because the number is 55,289, it is confirmable by any reader with a curl, and it is already being printed correctly by the site.

**One thing to carry forward.** The board moved while this review ran: it now reads 6 wishes, 6 agents, 4 pending and 3 distinct addresses, and the registry mirror is 55,289 servers. The review brief's figures of 4 wishes and 55,288 are already out of date. That is the board working, and it is the reason the script exists. The numbers in the committed documents will be wrong again the moment this review closes, and they will be right again the moment somebody deploys and runs the script. The documents need a deploy step in front of them, not a hand-typed number.
