# Brand ship review: product copy and launch content

**Reviewer:** Samira Okafor, Content & Brand Lead
**Date:** 6 November 2026
**Branch reviewed:** `feature/marketing-design-review`, commit `e605145`
**Type:** Ship review. Fourth pass. Decides ship or no ship.
**Final say:** `gtm-owner` on copy decisions, `ceo` on anything that changes what the product claims

---

# VERDICT: DOES NOT SHIP

**The reason, in one paragraph.**

The code fixes landed, and they landed properly. The refresh script no longer refuses to write and now writes "not reported yet" for a field it cannot read, and names the fields it could not read. The false zeros are gone from the README. The registry regex now matches both a figure and "tens of thousands", and the script exits 1 with an explanation when the sentence is missing. The "not N people in N places" clause is grammatical and inverted correctly across all three branches. The theme control's clear button is hidden unless there is an override. `npm test` (390 passing) and `npm run typecheck` are clean. Both founder sentences survive verbatim. The example reply now uses the `llms.txt` shape.

**But the post's own checklist still freezes the figures, and the post still has no number in it.** `docs/show-hn.md:118-120` still reads "The example reply is illustrative of the shape of the reply. The agent count and the wish count in it are the ones that were true when this was written." That is the sentence I named as the reason the figures freeze. It was not touched in `e605145`. The brief asked me to check it and it is still there. And because the example reply is now `N`/`M` placeholders, that sentence describes a state that no longer exists in the post: there are no counts in it to be true or not.

**Worse, the post now has no number at all.** The founder's Decision 5 says: "One number for the post: the registry size. Re-measured, dated, appearing once, prominently, early. Everything else in the post is subordinate to it or cut." The registry size in the committed post is "tens of thousands", which `brand/VOICE.md:95-101` bans by name ("Not as an approximation, not as 'roughly', not as 'around'"). The example reply's figures are now placeholders. The board block carries "6 wishes", which is dated and is not the number the founder chose. Strip out the date, the threshold in words, and the placeholder, and the post body contains no numeric figure a reader can check. That is the opposite of what Decision 5 asked for, and it is a regression introduced by the fix to B3 rather than by the failure to fix B2.

**On my own call about the registry sentence.** The brief asked me to decide whether a sentence that points at the source and is filled in by the script is acceptable, or whether the post has to carry the figure. **The post has to carry the figure, and the way to make that work is to deploy the branch and run the script, not to change the sentence.** The reason is in `brand/VOICE.md` and in Decision 5 both. The voice rule says a figure that cannot be verified does not appear. The script does not make a figure verifiable, it makes a figure *current*: it reads the number from a source and writes it down. Before the deploy, the sentence "There are tens of thousands of servers" is an approximation that no reader can check, because `/api/servers` is 403 by design and production's `/api/stats` does not return `servers`. The sentence added in `e605145` does not fix that. It adds a second, worse problem: the post now tells the reader where the number is, in a sentence that does not contain the number, and mentions a repository script that the reader does not have. That is a paragraph about the build process, inside the launch post, in the second sentence of the piece. It reads as a note to the operator, not as a sentence to the reader.

**What the post should say, exactly.** After the branch deploys, `node scripts/refresh-numbers.mjs` writes the figure and the sentence becomes:

> There are 55,293 servers in the official MCP registry, and it is hard to tell which of them agents actually need.

The figure at the time of this review is **55,293**, not 55,289 and not 55,288. I read it three ways: `SELECT COUNT(*) FROM servers` returns 55293, `SELECT COUNT(DISTINCT name) FROM servers` returns 55293, and `GET /api/stats` does not yet return it because production is not running this branch. It will be 55,294 by the time the post goes up, which is exactly why the script has to write it on the day. **The number should not be typed into the post by hand, and it should not be a pointer to a script. It should be the number the script wrote on the day, sitting in the sentence, with the dated measurement note underneath it.**

**So the sentence as committed does not ship. Two lines, one commit, one deploy, in this order:** (1) deploy `e605145`, (2) run `node scripts/refresh-numbers.mjs` against production and commit the result, (3) replace the three added lines in `docs/show-hn.md:10-12` with nothing, so the paragraph reads as it did before the script started touching it. Nothing else in the post needs to change for that.

---

## 1. Finding-by-finding verification

Status across everything carried forward: **9 fixed, 1 fixed with a residual defect, 4 not fixed, 3 new.**

| # | Finding | Status | Evidence |
|---|---|---|---|
| **B1** | The refresh script mapped a missing field to `0` and wrote two false zeros into the README | **Fixed** | `scripts/refresh-numbers.mjs:104-123`. `REQUIRED` lists eight fields; `missing` filters on `stats[f] === undefined \|\| stats[f] === null`, so a genuine zero and an absent field are distinguishable. `figure(field)` returns `"not reported yet"` for a missing field and `num(stats[field])` otherwise. `:109-114` prints the base URL and the names of the fields it could not read. Verified against production: `node scripts/refresh-numbers.mjs` prints "https://toolswanted.dev/api/stats does not report: distinctIps, servers." and the README rows read `not reported yet` at `:386` and `:390`. No false zero remains. |
| **B1 (the document)** | The README published two false zeros | **Fixed** | `README.md:386` and `:390` now read "Distinct IP addresses behind them \| not reported yet" and "MCP servers in the registry mirror \| not reported yet". Production's database says 3 and 55,293 (read directly: `COUNT(DISTINCT ip_key) FROM wishes WHERE seeded=0` → 3; `COUNT(*) FROM servers` → 55293; `COUNT(DISTINCT name) FROM servers` → 55293). Neither zero is published. The false-zero defect is closed. |
| **B2** | The post's registry size was "tens of thousands" | **Fixed in the script. NOT FIXED in the post.** | `scripts/refresh-numbers.mjs:204-224` now tests for the sentence before replacing it and exits 1 with an explanation when it is not found. The pattern is `/There are (?:[\d,]+ servers\|tens of thousands of servers) in the official MCP registry/`, and I verified it matches both forms: the committed "tens of thousands of servers" and "55,289 servers". I also broke the sentence on purpose, ran the script, and it exited **1** with "the registry size sentence was not found, so it was not rewritten". **But `docs/show-hn.md:9` still says "tens of thousands"**, and the sentence was extended with three lines of build instructions. See NEW-1. |
| **B3** | The example reply carried a figure the board does not produce | **Fixed in the example. NOT FIXED in the checklist.** | `docs/show-hn.md:24` now reads `→ "+1 to an existing wish (N agents want this, M wishes in total)."`, which is the `llms.txt` shape at `src/board.ts:1279` and matches the live reply format at `src/board.ts:973` and `src/mcp.ts:309`. The reply shape is right. **But `docs/show-hn.md:118-120` still reads "The example reply is illustrative of the shape of the reply. The agent count and the wish count in it are the ones that were true when this was written."** `git diff 7c4366e e605145 -- docs/show-hn.md` shows this line is not in the diff. It was not touched. See NEW-2. |
| **B4** | The registry-size regex could not match "tens of thousands", so `replace` silently no-opped and reported success | **Fixed** | `scripts/refresh-numbers.mjs:204-213`. The pattern covers both a figure and the approximation. `:206-213` throws the sentence out and calls `process.exit(1)` with an explanation of the shape the script needs. Verified by direct regex test against both forms and by deliberately corrupting the sentence in a copy of the post and running the script: exit code 1, clear message, no write to the post. The "silent success" class of defect is closed. |
| **H1** | The "not N people in N places" clause was ungrammatical and inverted | **Fixed** | `src/board.ts:1113-1123`. Three branches, all rendered and read directly. **One address** (agents=1, ips=1): "The whole board holds 1 independent agent from one address. That is one machine, so the count is not a community." **Spread** (agents=6, ips=3): "The whole board holds 6 independent agents across 3 distinct IP addresses. Most of that is one machine counted more than once, not 6 people in 6 places." **Equal** (agents=6, ips=6): "The whole board holds 6 independent agents across 6 distinct IP addresses. Every one of them came from a different address, so the count is not one machine counted more than once." **Zero** (agents=0): "No independent agents have filed a wish yet, so there are no distinct IP addresses behind the count." The clause is pluralised via `plural()` at `:1122` and is only reached when `distinctIps < agents`. The inverted reading is gone. |
| **H2** | `README.md:165` says "all ~55k servers", hand-typed and outside the script's markers | **NOT FIXED** | `README.md:165` still reads "\| Registry mirror \| Workers AI \`bge-small\` \| Cheap enough to index all ~55k servers inside the daily neuron budget. |". `git diff 7c4366e e605145 -- README.md` shows only the table rows changed. This is the third appearance of the registry size and the only one the script cannot reach. It is accurate today (55,293 is "~55k") and it will drift. |
| **NEW-8** | The clause was ungrammatical and inverted | **Fixed** | See H1. |
| **NEW-9** | The brief's figures were stale | **Closed, and the board moved again** | At the time of this review: `GET /api/stats` returns **7 wishes, 6 agents, 1 cluster, 3 pending, 0 shipped, 0 seeded**. The database says **55,293 servers**, **55,293 distinct server names**, **3 distinct IPs**, **7 unseeded wishes**. The brief's 4/4 and 55,289 are all out of date. A cluster has now been published on production, which the post's board block will need to pick up. This is the board working, and it is the reason the script exists. |
| **NEW-10** | The registry regex could not match "tens of thousands" | **Fixed** | See B4. |
| **Theme control** | The clear button was shown to every reader for most of whom it did nothing | **Fixed, verified in a browser** | `src/html.ts:1012, 1020, 1022, 1032-1037`. `showClear()` reads `localStorage.getItem('tw-theme')` and sets `display` to `inline-block` or `none`. Driven in a real browser against the local server with a dark system preference: **no override → `display: none`; after pressing the toggle → `display: inline-block`; after pressing clear → `display: none`**. The existing browser test (`tests/theme-control.test.ts:153`) still passes, because the button is visible in the state where the test clicks it. |
| **F6** | `/build` gave three ways to look at an empty board | **Fixed, carried forward** | Unchanged in `e605145`. `src/board.ts:896-901` leads with "The board is young and nothing has been wanted by three independent agents yet, so there is nothing to claim. What works today is the check:" and the live registry check is the first item. |
| **NEW-1** | "1 distinct IP addresses" | **Fixed** | `src/board.ts:1120, 1122, 1123`. The address count is a literal `num(distinctIps)` in every branch and the one-address branch reads "from one address" in words. Rendered at agents=1, ips=1: "The whole board holds 1 independent agent from one address." No "1 distinct IP addresses" anywhere. |
| **NEW-2** | "one machine counted more than once" asserted unconditionally | **Fixed** | `src/board.ts:1113`, `const spread = agents > 0 && distinctIps < agents;`. The clause is gated and the reassuring branch is reachable. Verified in the rendered output. |
| **NEW-5** | Three surfaces pointed at the deleted entry | **Fixed, carried forward** | `src/index.ts:171` (the 404 form) and `src/board.ts:167` (the board's check form) now read "Parse an invoice". `grep -rn "read-uk-council-planning" src/` returns nothing. |
| **NEW-6** | The reply did not show the match scores | **Fixed, carried forward** | `src/board.ts:983-988`. Each server line ends `[match 0.692]`. |
| **M3** | The third appearance of the registry size | **Open, low** | Same as H2. `README.md:165`. |
| **L1** | Named byline on the post | **Open, low** | Still no byline. Show HN carries the account. Unchanged across four reviews. |
| **M1** | "roughly 5,500 wishes a day" and "roughly seven wishes a day" | **Open, low** | `README.md:352,358`. Capacity estimates with a stated basis. Flagged, not fixed, across three reviews. |

---

## 2. New findings

### NEW-1. The post's registry sentence now describes the build process inside the post, and the post still carries an approximation. **Severity: blocking.**

`docs/show-hn.md:9-12`, as committed:

> There are tens of thousands of servers in the official MCP registry, and it is
> hard to tell which of them agents actually need. The exact count is in
> `GET https://toolswanted.dev/api/stats`, and `node scripts/refresh-numbers.mjs`
> writes the figure into this sentence on the day this goes up.

Three separate problems in one sentence.

**The approximation is still there.** `brand/VOICE.md:95-101`: "Every figure quoted must be sourced and checked before the piece goes live. If a number cannot be verified, it does not appear. Not as an approximation, not as 'roughly', not as 'around'." "Tens of thousands" is an approximation. Before the branch deploys, the reader cannot check it: `/api/servers` returns **403** (verified) and production's `/api/stats` returns `{"ok":true,"clusters":1,"wishes":7,"agents":6,"seededWishes":0,"shipped":0,"pending":3}` with no `servers` and no `distinctIps` (verified). The pointer the sentence offers leads to an endpoint that does not carry the number.

**The pointer is not a source.** `GET /api/stats` carries the number only once the branch is deployed. Until then it does not. The sentence points at an endpoint that will carry the number in the future and tells the reader it carries it now.

**The second half of the sentence is a note to the operator.** "and `node scripts/refresh-numbers.mjs` writes the figure into this sentence on the day this goes up" is build-process narration. A reader of a Show HN post does not have this repository, does not run this script, and does not need to know that the author does. It reads like a changelog entry inside the second sentence of the launch post, and it pulls the reader out of the builder's situation (`brand/CONTENT.md:89`: "Open with the reader's situation, not the product"; `brand/CONTENT.md:91-92`: "Do not open a video or article with the product"). The post is supposed to open on "which of these 55,293 servers do agents actually need". Instead it opens on "which of these tens of thousands do agents need", then tells the reader about a script.

**The fix is not to write a different pointer. The fix is to deploy and run.** After the deploy, the script writes "There are 55,293 servers in the official MCP registry" and the paragraph reads:

> There are 55,293 servers in the official MCP registry, and it is hard to tell
> which of them agents actually need.

That is the sentence the founder chose, it carries the number, it is checkable with a curl, and it is the piece Decision 5 asked for. The three added lines at `:10-12` are deleted. Nothing else in the post changes.

### NEW-2. The post's checklist still says the figures are frozen, and it now describes a state the post does not have. **Severity: blocking.**

`docs/show-hn.md:118-120`:

> - The example reply is illustrative of the shape of the reply. The agent
>   count and the wish count in it are the ones that were true when this was
>   written.

This is the sentence my re-review named as the reason the figures freeze, and it is the line the brief asked me to check. **It is still there.** `git diff 7c4366e e605145 -- docs/show-hn.md` does not touch it.

It is now worse than it was, because it is describing numbers that are no longer in the post. The example reply is `N`/`M` placeholders now. There is no agent count and no wish count "in it" that were true when this was written. The item describes a post that used to exist.

A reader of this checklist is the operator on launch day. What they need from this item is the opposite of what it says: the counts in the reply are placeholders *because* they change, and the reply shape is the shape `llms.txt` publishes at `src/board.ts:1279`. The item should say that the reply is illustrative of the shape and carries no frozen figures, or it should be deleted.

### NEW-3. The post body has no number in it, which is the opposite of Decision 5. **Severity: blocking.**

`reviews/product-direction.md:254`: "**One number for the post:** the registry size. Re-measured, dated, appearing once, prominently, early. Everything else in the post is subordinate to it or cut."

I checked every digit in the post body (`docs/show-hn.md:9-102`). The complete set of figures is:

| Line | Figure | What it is |
|---|---|---|
| `:16` | `N`, `M` | Placeholders in the example reply |
| `:48` | `2026-11-05` | The date in the measurement note |
| `:86` | `6 wishes` | The board block, dated, written by the script |
| `:39, :44, `:75` | "three independent agents" | The publish threshold, in words |

There is no number a reader can check. The registry size, which is the number the founder chose for this post, is an approximation in the committed text. The example reply's numbers became placeholders. The board block's "6 wishes" is dated, is not the number Decision 5 named, and it was already **wrong** by the time this review finished: production moved from 6 wishes and 4 pending to **7 wishes and 3 pending**, and a cluster is now published.

The fix is the same fix as NEW-1. Deploy, run the script, and the number is in the first sentence, early, prominent, checkable. The example reply's placeholders are fine and should stay: they are the shape, and Decision 5 says everything else in the post is subordinate to the registry size or cut. But the registry size has to actually be there.

### NEW-4. The README's table names a source for two rows that source does not report. **Severity: low.**

`README.md:381-391`. The third column is `GET /api/stats` on every row, including the two that read `not reported yet`. `/api/stats` does not report those fields today. The value is truthful and "not reported yet" is the right thing to print, so this is a presentation wart rather than a false claim. But the column header is "Where it comes from" and for two rows the answer is "not yet from there". After the deploy it is accurate and needs no change. Before the deploy, the honest third-column value for those two rows is the deployment's own `/api/stats` endpoint once it reports them, or a dash. Low severity, because the value in the second column is the thing a reader actually reads, and it is true.

### NEW-5. The post's board block is already behind production. **Severity: medium, and it is a workflow finding rather than a copy finding.**

At the time of this review, production reads:

```
GET https://toolswanted.dev/api/stats
{"ok":true,"clusters":1,"wishes":7,"agents":6,"seededWishes":0,"shipped":0,"pending":3}
```

The committed post's board block says "Nothing has been wanted by three independent agents yet, so nothing has been published. The 6 wishes on it are real". **A cluster is now published.** The post's board block is wrong today, and it is wrong in the direction that matters most: it tells the reader the board is empty when it is not.

This is not a copy defect and it is not a defect in `e605145`. It is the same live-board problem as NEW-9, and the script is the mechanism that fixes it. It is in this review because it is a concrete instance of the general rule at `docs/show-hn.md:145-147`: "**No live page states a number the board's own queries cannot produce.**" A dated measurement in a table is allowed to be a measurement of that day. The board block is a present-tense statement. So it must be regenerated on the day, and it cannot be, until the branch deploys.

**The launch gate has to be a deploy and a script run, in that order.** Not a commit. The board has moved three times during three reviews. The committed documents cannot be made true by editing them.

### NEW-6. The script writes the README before it checks the post, so a failed post check leaves a half-updated tree. **Severity: low.**

`scripts/refresh-numbers.mjs:159` writes the README, and the post's registry check is at `:206-213`. I verified this: I corrupted the registry sentence in a copy of the post, ran the script, it exited 1 with the right message, and the README had already been rewritten. The exit code is right and the message is right, so the operator sees the failure. But the tree is half-modified, and a script that reports failure should not leave a partial write behind. The check belongs before the first `writeFileSync`. Low severity, because the operator reads the exit code and the message, and the README's own write is correct when it happens.

### NEW-7. `README.md:5` still opens on "tens of thousands", and the script cannot reach it. **Severity: medium.**

`README.md:5`: "There are tens of thousands of servers in the official MCP registry, and it is hard to tell which of them agents need."

The script writes the post's registry sentence and the README's table. It does not write the README's opening sentence. So the README has two hand-typed registry sizes (`:5` and `:165`) that the script cannot reach and that the post's sentence now says are wrong. The README is the project's first reader-facing document and it opens on a banned approximation. This was in my previous review as H2 (`:165` only); I am widening it to `:5` as well, because the same script change could have covered both and did not.

### NEW-8. The theme control's clear button has no test that it is hidden. **Severity: low.**

`src/html.ts:1032-1037` is correct, and I verified it in a real browser across all three states. But `tests/theme-control.test.ts` has no assertion about the clear button's visibility. The browser test at `:153` clicks `#themeclear` after setting an override, so it exercises the visible path and would not catch a regression that hides the button unconditionally and made it unclickable. A one-line assertion that the button's computed display is `none` before any override would hold the fix in place. The behaviour is right; the guard is missing.

---

## 3. Voice compliance, re-run across every changed file

Files re-checked: `README.md`, `docs/show-hn.md`, `scripts/refresh-numbers.mjs`, `src/board.ts`, `src/html.ts`, `src/index.ts`, `tests/favicon.test.ts`.

| Rule | Pass/Fail | Evidence |
|---|---|---|
| **No em dashes** | **PASS** | Zero `—` and zero `–` in all seven files, checked per file. Zero ` -- ` sequences. |
| **No American spellings** | **PASS** | `README.md` 0, `docs/show-hn.md` 0, `scripts/refresh-numbers.mjs` 0, `src/board.ts` 0, `src/index.ts` 3 (all `prefers-color-scheme: dark`, a CSS media feature), `tests/favicon.test.ts` 3 (the same media query in a test name and a regex), `src/html.ts` 69 (all CSS `color:` declarations and `prefers-color-scheme` queries; zero hits outside a stylesheet or a CSS media feature). No `favor`, `recognize`, `organize`, `math`, `personalized`, `behavior`, `catalog`, `labeled`, `centered` or `analyze` in any prose string. Prose uses `sanitised`, `labelled`, `recognised`, `pluralised`. |
| **No banned phrases** | **PASS** | Zero hits across all seven files for "In today's digital age", "Moreover", "Furthermore", "Delve into", "Harness the power of", "Unlock your potential", "Transform your", "Navigate your", "This is not just X. It is Y.", "This isn't only about X. It's about Y.", and for the wider set "revolutionary", "game-chang", "seamless", "leverage", "cutting-edge", "state-of-the-art", "supercharge", "elevate", "AI-powered", "we are excited to announce". |
| **No emoji as punctuation** | **PASS** | `\p{Extended_Pictographic}` scanned all six user-facing files. Zero hits in `docs/show-hn.md`, `src/board.ts`, `src/html.ts`, `src/index.ts`, `scripts/refresh-numbers.mjs`. The four hits in `README.md` are the ASCII box-drawing `▶` in the ASCII pipeline diagram at `:134-139`, not emoji and not standing in for punctuation. |
| **No bullet lists in posts** | **PASS** | `docs/show-hn.md:9-102` is paragraphs and bolded single-line statements. The bullets at `:111-147` are the internal "Before this goes up" checklist, which is not part of the post. |
| **No hedging in the body copy** | **PASS** | The honest dead ends read as statements of the deployment's state rather than as disclaimers: "I have not yet seen a builder claim an entry." and "Nothing is executed. Wish text is untrusted input." The `/build` page's "Claiming is not switched on yet." is declarative. **Exception noted:** the three lines added at `docs/show-hn.md:10-12` read as build instructions rather than as a claim about the product, which is a different defect (NEW-1) and not a hedge. |
| **No generic advice** | **PASS** | The post leads with a mechanism a builder can use today and an observed result ("four working weather servers, all of them already published", `:41-42`). The paragraph on the fingerprint splitting one machine into several agents is the specific observation the rule asks for. |
| **Numbers verified before publication** | **FAIL (blocking)** | `brand/VOICE.md:95-101`. The post opens on "tens of thousands" (`docs/show-hn.md:9`), which is an approximation by name. The README publishes two hand-typed approximations (`:5`, `:165`). The script now correctly refuses to invent a figure and the two false zeros are gone, which is the right behaviour, but the documents still carry figures that no reader can check. |
| **One number that surprises the reader** | **FAIL (blocking)** | Decision 5 named one number for this post: the registry size, re-measured, dated, once, early, checkable. It is an approximation. The example reply's numbers are now `N`/`M`. The board block's "6 wishes" is dated and already behind production. The post body has no checkable number. See NEW-3. |
| **Speak to one person, one situation** | **PASS** | The post addresses one builder deciding what to build this weekend. `src/board.ts:157` opens the page on "Choosing what to build next?". **Weakness, not a failure:** the three added lines at `docs/show-hn.md:10-12` break the second sentence of the post by addressing the operator instead of the reader. |
| **British register, understated confidence** | **PASS** | "The board is young and I would rather say so than let the numbers imply more than they do" (`:52-53`) and "I have not built the loop that takes you from 'I want to build this' to 'I built it' yet, and I would rather say that than fake it" (`:64-67`). |
| **Sound like a person, not a platform** | **PASS** | First person singular throughout the post. "Ask it for 'the current weather for a city' and it comes back with four working weather servers" (`:40-42`) is a person describing something they watched happen. |
| **Named byline** | **Open, low** | Unchanged. Action 15. Show HN carries the account. |
| **Vary the sentence structure** | **PASS** | The post moves between short statements ("Nothing is executed.") and long explanatory sentences. The added three lines are a flat procedural clause, which is the one place the rhythm flattens. |
| **Open with the reader's situation, not the concept** | **PASS, with the NEW-1 caveat** | The post opens on the builder's problem, which is the right place. The problem is that the second sentence tells the reader about a script instead of finishing the thought. |
| **End with one specific next step, not a menu** | **PASS** | "The board is the story, so please go look at it rather than reading my description of it" (`:101-102`). One thing. `/build` leads with one live action. |
| **Every text node legible in a coloured block** | **PASS** | The `themeclear` button is `var(--ink-soft)` on the paper background, same as before, and it is now hidden by default. The `Parse an invoice` placeholder fits at 320px with room to spare, which is the fix that replaced the clipped `Parse a PDF invoice into line items`. |
| **Muted hierarchy still reads** | **PASS** | Unchanged by this commit. The `.hero .herostats` and `.hero .seednote` treatment holds. |
| **Every internal link resolves** | **PASS** | `scripts/check-pages.mjs` walks `/`, `/about`, `/agents`, `/build`, `/weekly`, `/wish` and the 404 route with no broken links. The post's links (`/weekly`, `/api/stats`, `/api/top`, `/api/weekly`, `/auth/github`, `npm run og:sync`) all resolve or are named as internal checklist commands. |
| **No live page states a number the board's own queries cannot produce** | **PASS on the pages. FAIL on the documents.** | `/about`, its registry lede, `llms.txt` and `llms-full.txt` all read from `getStats()`. The pages pass. **The documents do not**: the post's opening sentence and the README's two hand-typed registry sizes. See NEW-1 and NEW-7. |
| **No hedge or approximation** | **FAIL** | "Tens of thousands" survives in five user-facing places: `docs/show-hn.md:9`, `README.md:5`, and the three fallback branches in `src/board.ts:1090, 1211, 1253`. The fallback branches only fire when `servers === 0`, which is correct behaviour for a deployment that has not crawled. The two documents are live on the approximation today. `README.md:165` ("~55k"), `README.md:352` and `:358` ("roughly 5,500 wishes a day", "roughly seven wishes a day") are also approximations in prose. The latter two are capacity estimates with a stated basis and are arguably different in kind, but `brand/VOICE.md` does not carve out an exception. Low severity, flagged not fixed. |

---

## 4. Positive findings worth protecting

The work is good and a lot of it should not be touched.

- **The script now knows the difference between zero and absent, and it repairs rather than refuses.** `REQUIRED` plus `missing` plus `figure()` at `scripts/refresh-numbers.mjs:104-123`. A missing field is written as "not reported yet" and the script names the fields it could not read. This is the right shape for a script that writes figures, and it fixed the false zeros in the document rather than leaving a document that no mechanism can correct.
- **The registry sentence is now checked rather than assumed.** `scripts/refresh-numbers.mjs:204-213`. The pattern covers both forms and the script exits 1 with a usable message when the sentence is missing. I verified both the match and the failure path. The "silent success" class of defect is closed.
- **The address clause tells the truth in every branch, and the reassuring branch is reachable.** `src/board.ts:1113-1123`. Seven agent-and-address combinations rendered and read. "Every one of them came from a different address, so the count is not one machine counted more than once" is exactly the sentence my re-review asked for.
- **The theme control no longer shows a reader a button that does nothing.** `src/html.ts:1032-1037`. Verified in a real browser across all three states: hidden with no override, shown after the toggle, hidden again after clear.
- **The favicon is a real W.** `src/index.ts:71-76`, the Archivo Black glyph outline from the font the site already ships, with `tests/favicon.test.ts` rasterising the path and measuring where the ink is. The test fails on the old X path. This is the kind of fix that stops the next person hand-drawing a letter.
- **The placeholder fits.** "Parse an invoice" at `src/board.ts:167` and `src/index.ts:171`, in place of a clipped string at 320px.
- **Both founder sentences survive verbatim.** "I have not yet seen a builder claim an entry. That is the number the whole thing exists for, and it is zero." (`docs/show-hn.md:59-60`) and "The registry check is the part that works today, with no crowd at all" (`:69-70`). Verified against `reviews/product-direction.md:258` and `:260`.
- **The example reply now matches the live reply shape.** `docs/show-hn.md:24` uses the same `N agents want this, M wishes in total` that `llms.txt` publishes at `src/board.ts:1279` and that the board renders at `src/board.ts:973` and `src/mcp.ts:309`.
- **`npm test` (390 passing, 41 files) and `npm run typecheck` are clean.** `npm run build` passes. The copy is held in place by tests.
- **The publish gate is a genuine correctness fix.** The board has now published its first cluster on production, which is the threshold doing its job.

---

## 5. What has to change, in order

**Blocking. Nothing publishes until these three are done.**

| # | Change | Where | Why |
|---|---|---|---|
| **B1** | Deploy the branch, then run `node scripts/refresh-numbers.mjs` against production, then commit the result. The post's first sentence must read "There are 55,293 servers in the official MCP registry" (or whatever it reads on the day), and the README's two "not reported yet" rows must become `3` and the server count. | `docs/show-hn.md:9-12`, `README.md:386,390` | The post still opens on a banned approximation and the README still says it cannot report two figures that production's database can. The board moved to 7 wishes, 1 published cluster, 3 pending while this review ran. |
| **B2** | Delete the three added lines from the post's registry paragraph. The paragraph reads "There are N servers in the official MCP registry, and it is hard to tell which of them agents actually need." and nothing else. | `docs/show-hn.md:10-12` | "The exact count is in `GET /api/stats`, and `node scripts/refresh-numbers.mjs` writes the figure into this sentence on the day this goes up" is a note to the operator inside the second sentence of the launch post, and it points at an endpoint that does not carry the number until the deploy. See NEW-1. |
| **B3** | Delete or rewrite the checklist item that says the example reply's counts "are the ones that were true when this was written". | `docs/show-hn.md:118-120` | It was not touched in `e605145`, it is the sentence I named twice, and it now describes a post that no longer exists, because the example reply holds placeholders and no counts. See NEW-2. |

**Medium and low, ship-blocking on quality:**

| # | Change | Where | Why |
|---|---|---|---|
| **M1** | Bring `README.md:5` and `README.md:165` under the script's markers, or reword them to refer to the figure without stating it. | `README.md:5,165` | Two hand-typed registry sizes the script cannot reach, on the project's first reader-facing document. The post's sentence says the same registry has a specific count, so the README's approximation is now contradicted by its own sibling document. See NEW-7. |
| **M2** | Move the post's registry-sentence check above the README's first `writeFileSync`, so a failed check does not leave a half-updated tree. | `scripts/refresh-numbers.mjs:159` vs `:206` | The script reports failure correctly and the operator reads the exit code, but a script that exits 1 should not have already written half the output. See NEW-6. |
| **M3** | Add one assertion to `tests/theme-control.test.ts` that the clear button's computed display is `none` before any override is set. | `tests/theme-control.test.ts` | The behaviour is right and I verified it by hand. The guard is missing, and the existing test would not catch a regression that hides the button unconditionally. See NEW-8. |
| **L1** | The README's table names `GET /api/stats` as the source for the two "not reported yet" rows. After the deploy this is accurate and needs no change. | `README.md:386,390` | Truthful value, slightly inaccurate source column. Self-corrects on deploy. See NEW-4. |
| **L2** | A named byline on the post. | `docs/show-hn.md` | Action 15, unchanged across four reviews. Show HN carries the account. |
| **L3** | Decide whether "roughly 5,500 wishes a day" and "roughly seven wishes a day" are estimates allowed to stand. | `README.md:352,358` | `brand/VOICE.md` does not carve out an exception for estimates. Low, but the same rule as B1. |

---

## 6. Status

**Status: approved with changes. Does not ship as it stands.**

The code is in a good place and the copy is in a good place. Two of the three blocking changes are a deploy, a script run, and a commit. The third is deleting three lines from the post and three lines from its checklist.

**I want to be precise about what has changed since my last review, because it is not all good news.** Every mechanical defect I named is fixed. The script writes instead of refusing, and it names what it could not read. The regex matches both forms and fails loudly. The address clause is grammatical and correctly inverted. The clear button is hidden. The false zeros are gone. `npm test` is green at 390.

But the fix to the example reply introduced a new problem in the post body. Taking the frozen "3 agents, 3 wishes" out was right, and replacing it with `N`/`M` was right, and the post no longer publishes a figure the board contradicts. The side effect is that the post's only checkable number was the registry size, and the registry size was never actually put in. **So the post now has no number in it at all.** Decision 5 named one number for this post and said everything else was subordinate to it or cut. The post has cut everything else. It has not put the one number in.

And the three lines added at `docs/show-hn.md:10-12` are the wrong answer to the question I asked. I asked for the figure in the sentence. The branch put a pointer to the figure in the sentence, and a note about how it will get there, in the second sentence of the launch post, aimed at somebody who is not reading the post. A pointer to a source that does not yet carry the number is not verification. It is the same one-step-short pattern I have now named four times, and it is not going away by being written down.

**Next step:** `gtm-owner` owns the copy decisions and the deploy order, `ceo` owns the decision on what the post claims. Deploy `e605145` first, run `node scripts/refresh-numbers.mjs` against production, commit the result, delete the three lines at `docs/show-hn.md:10-12` and the checklist item at `:118-120`, and the post is ready. Nothing else in it needs to change.

**One thing to carry forward.** The board moved three times during three reviews and it has moved again since this review began: production now reads 7 wishes, 6 agents, **1 published cluster**, 3 pending, 3 distinct addresses, 55,293 servers. The brief's 4/4 and 55,289 were stale before I started. Every hand-written number in these documents will be wrong again by the time the post goes up, and the script exists so that they are not. **The documents need a deploy in front of them, not a number typed into them.** That is the whole finding, and it is now a one-step, one-commit operation.
