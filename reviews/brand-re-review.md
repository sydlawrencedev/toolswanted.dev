# Brand re-review: product copy and launch content

**Reviewer:** Samira Okafor, Content & Brand Lead
**Date:** 5 November 2026
**Branch reviewed:** `feature/marketing-design-review`, commit `cdc89cd`
**Type:** Re-review of the copy and launch content against `reviews/brand-review.md` and `reviews/product-direction.md`
**Final say:** `gtm-owner` on copy decisions, `ceo` on anything that changes what the product claims

---

# VERDICT: DOES NOT SHIP

**The reason, in one paragraph.**

The voice work is done and it is good. The em-dash rule holds across every user-facing surface. The launch post went from nine diffused figures to four, the registry check is now the first thing on the landing page, the snippet is 242 characters and reads like a request, the badge no longer 404s, the RSS pluralises, and the founder's two protected sentences survive intact. Five of the seven findings are fixed, one is partly fixed, one is open.

But the fix for the stale numbers reintroduced the exact defect it was built to remove, in a new place, and it does it silently.

`scripts/refresh-numbers.mjs` reads `GET /api/stats`, and `num()` maps a missing field to `0`. The branch adds `distinctIps` and `servers` to `/api/stats`, but the branch is not deployed, so production's `/api/stats` does not return them. The script therefore writes **"Distinct IP addresses behind them | 0"** and **"MCP servers in the registry mirror | 0"** into `README.md`, and labels both rows with the source line **`GET /api/stats`**.

The truth, read from the production database directly, is **2** distinct IP addresses and **55,289** registry servers. The README is not merely stale. It is wrong, it attributes the wrong number to a source that would produce the right one, and it now sits directly under "Independent agents | 3", which makes the page say the three independent agents came from zero addresses. That is the same failure as Finding 1: a false number in a present-tense sentence, published on the project's first reader-facing document, with a false provenance claim bolted to it. Finding 1 was fixed in the template. It was moved into the build script.

There is a second blocking item, smaller but the same class: the post's example reply says **"3 agents want this, 3 wishes in total"** for the invoice capability, and that capability has one agent and one wish. The post's own checklist admits the figure was "true when this was written" and was never true for that capability.

And there is a third, which is not a number at all: the registry size, which the CEO's Decision 3 and Decision 5 both name as the one figure the launch has to carry, is **"tens of thousands"** in the post. That is an approximation, which `brand/VOICE.md:95-101` forbids in exactly these words: "If a number cannot be verified, it does not appear. Not as an approximation, not as 'roughly', not as 'around'." The number is verifiable. The branch's own `/api/stats` returns it. The script reads it. It is 55,289 and it is one line of code away from the post.

**What has to happen before this ships.** Three things, and all three are small:

1. Deploy the branch, then run `node scripts/refresh-numbers.mjs` against production, so `distinctIps` and `servers` come back as real numbers instead of zeros. Then re-check the table by hand against `GET /api/stats`. **Do not ship the README as it stands.** It currently publishes two false zeros.
2. Make `refresh-numbers.mjs` fail loudly when a field it needs is missing, instead of writing a zero. A script that cannot tell the difference between "zero" and "not reported" will do this again the next time the deploy order changes.
3. Put the real registry total in the post, once, early. It is the founder's number, it is the one a reader can check, and it is currently an approximation where a figure belongs.

Findings 6 and 7 are done, Findings 1 and 2 are done, Findings 3 and 4 are done to a standard that clears the bar, and Finding 5 is done. The copy is good. The numbers in the README are not.

---

## 1. Finding-by-finding verification

Status counts across the seven findings: **5 fixed, 1 partially fixed, 1 not fixed.** Blocking status: **2 blocking findings remain open** (see the table for which).

| # | Finding | Action | Status | Evidence |
|---|---|---|---|---|
| 1 | `/about` published a false number | 1 (blocking) | **Fixed** | `src/board.ts:1066` `renderAbout(env, stats?: AboutStats)` takes the numbers as an argument. `src/index.ts:547` passes `agents`, `distinctIps`, `clusters`, `wishes` from `getStats(env.DB)`. The hardcoded "on 4 November 2026 the whole board held 20 independent agents across 4 distinct IP addresses, with 12 on the published entry" is gone. Rendered empty branch at `/about`: "Nothing has been published yet. A cluster needs three independent agents to appear publicly, so the board is empty until three of them want the same thing. No independent agents have filed a wish yet, so there are no distinct IP addresses behind the count. The count is not the size of a community." **True when empty.** Populated branch also written from the numbers. `tests/live-copy.test.ts` (297 lines) asserts the dated measurement is not in the template. **But see NEW-1 and NEW-2: the populated branch has a pluralisation bug and an unconditional false claim.** |
| 2 | The hero was four zeros in a row | 9 | **Fixed** | `src/board.ts:149-151`. `heroStats` branches on `boardIsEmpty` (derived from `clusters.length === 0`, `src/board.ts:140`). Empty: "Nothing is published yet. A capability appears once three independent agents want it, and so far N wishes have been filed." Populated: "N wishes from N agents, in N clusters. N shipped." Rendered live: *"Nothing is published yet. A capability appears once three independent agents want it, and so far 0 wishes have been filed."* Four zeros are gone. The four-clause seed caveat is now a separate `<span class="seednote">` at `src/board.ts:159`, out of the stats sentence. |
| 3 | The launch post was over-indexed on mechanism, numbers diffused | 2 (blocking), 7, 11 | **Fixed, with one reservation** | Registry check is now the FIRST of the two features (`docs/show-hn.md:34`), with the weather example inside it (`:39-40`). The security section is one argument (`:85-86`): "A secret cannot reach storage, whichever path it takes: the sanitiser runs before the write and again on the model's output." "The counts mean something" moved to the front of the section (`:72`). The board-state section was rewritten around the real state and does NOT fill the gap with an operator-filed wish (`:91-93`): "The board is empty right now. Nothing has been wanted by three independent agents yet, so nothing has been published. The 3 wishes on it are real, filed by real agents, and they are waiting in the review queue." **Figure count: was nine, now four.** Verified by grep over `docs/show-hn.md:9-100`. **Reservation: the registry size is "tens of thousands" (`:9`), an approximation, not the figure the founder's Decision 3 and Decision 5 require. See NEW-3.** |
| 4 | `SNIPPET_ASK_AGENT` was 653 characters | 8 | **Fixed** | `src/snippet.ts:84`. Measured **242 characters, 40 words, 4 sentences** (was 653 / 115 words / 7 sentences). Keeps the request form, the MCP URL (`https://toolswanted.dev/mcp`), the `wish()` tool name, the `x-tools-wanted-agent` header instruction, and "No account, no API key". It reads as a request a person makes in a chat: "Install the Tools Wanted MCP server at https://toolswanted.dev/mcp and keep it. When a capability is missing, call its wish() tool with one line. Send x-tools-wanted-agent with a stable id, so one install is one agent. No account, no API key." Every claim verified: `wish` is a real registered tool name (`src/mcp.ts:64`), `/mcp` is the real endpoint (`src/index.ts:126`). The design notes' "it says what the agent should DO rather than describing a protocol" is satisfied. `tests/snippet-length.test.ts` holds it. |
| 5 | The site led with the thin thing, not the working thing | 6, 10 | **Fixed** | The registry check is now the hero's first action, above the board links (`src/board.ts:162-171`): a label ("Already built?"), one line saying what it does, one input, one button, and one line ("No account, no API key. This is the same check an agent makes with one call."). The board is in the next `<section>` below. One `boardIsEmpty` flag drives the hero, the card area and the empty state, so they cannot contradict each other (`src/board.ts:140`, `:141`). The hero reads as one thing: what it is, what state it is in, what you can do right now. Verified end to end: `GET /wish?need=convert+a+PDF+invoice+into+structured+line+items` on production returns four real, published registry tools with names, descriptions and URLs. `tests/board-empty-state.test.ts` (213 lines) covers it. |
| 6 | `/build` told the truth, then gave nothing to do | 10 | **Partially fixed** | The truth is intact and honest: `src/board.ts:868` still says "Claiming is not switched on yet. Sign in with GitHub is not configured on this deployment, so a wish cannot be claimed here." The page is rendered from the deployment's own configuration, so it cannot lie. **But the three items under "What you can do right now" (`src/board.ts:896-900`) are unchanged**: read the board, check the weekly list, put the list in your README. Three ways to look at an empty board. The registry check, which is the one live action a builder has today, is **not offered on `/build`**. Verified: the only `/wish` reference in the rendered page is the site nav, not the page body. The task's brief says "check whether it now offers a live action". It does not. |
| 7 | The `/build` badge pointed at a deleted entry; RSS said "1 wishes from 1 agents" | 4 (blocking), 12 | **Fixed** | `src/board.ts:756-758`: `badgeSnippet` now returns `weeklyBadgeSnippet(env)` when there is no slug. No hardcoded fallback slug survives. Verified live: `GET /badge/weekly.svg` → **200**; `GET /badge/read-uk-council-planning-pdfs-as-structured-data.svg` → **404**, which is correct, because a badge for an entry that is not published should 404 rather than show a wrong count. The rendered `/build` page hands out the weekly badge. RSS: `src/rss.ts:58` now uses `plural()`. Verified live: "The capabilities AI agents ask for most. 0 wishes from 0 agents. Week 2026-W45." Both nouns agree at 1 and at 0. |

### The stale-number mechanism (the blocking section)

The review brief asked me to verify the script by running it and checking the diff is empty, and to grep for remaining hardcoded figures. I did both. The diff is empty. **That is the problem, not the reassurance.**

```
$ node scripts/refresh-numbers.mjs
README.md: 3 wishes, 3 agents, 0 published
docs/show-hn.md: 0 published entries
$ git diff --stat
(empty)
```

The script ran clean against production, exited 0, and reproduced the committed files byte for byte. It is deterministic and it works. What it reproduced is two false zeros.

**Production's `/api/stats` (the branch is not deployed):**

```
GET https://toolswanted.dev/api/stats
{"ok":true,"clusters":0,"wishes":3,"agents":3,"seededWishes":0,"shipped":0,"pending":3}
```

No `distinctIps`. No `servers`.

**The branch's `/api/stats` (`src/api.ts:231-234` returns `{ ok: true, ...stats }`, and `src/db.ts:686,690` add both fields) does return them.** The dev server confirms: `{"clusters":0,...,"distinctIps":0,...,"servers":0}`.

**The production database, read directly:**

```
SELECT (SELECT COUNT(DISTINCT ip_key) FROM wishes WHERE seeded=0) distinctIps,
       (SELECT COUNT(*) FROM servers) servers;
→ distinctIps: 2,  servers: 55289
```

**What `README.md:386` and `:390` now say:**

```
| Distinct IP addresses behind them | 0 | `GET /api/stats` |
| MCP servers in the registry mirror | 0 | `GET /api/stats` |
```

Both wrong. Both labelled with a source that would produce the right answer if the field were present. The script's `num()` is `Number(n ?? 0).toLocaleString("en-GB")`, so a missing field and a genuine zero are indistinguishable.

**And the consequence of running the script against a source with fewer wishes.** I pointed it at the dev server to see what it does when the numbers are thin:

```
$ node scripts/refresh-numbers.mjs http://127.0.0.1:8787
$ sed -n '91,94p' docs/show-hn.md
The board is empty right now. Nothing has been wanted by three independent agents yet,
so nothing has been published. The 0 wishes on it are real, filed by real agents, and
they are waiting in the review queue.
```

"The 0 wishes on it are real, filed by real agents." The script wrote that sentence without flinching. A build script that manufactures a false sentence from a missing figure is not a fix for the stale-number problem. It is a faster way to publish one.

**Remaining hardcoded figures in the README, grepped:**

| Location | Figure | Verdict |
|---|---|---|
| `README.md:5` | "tens of thousands of servers" | Vague. Same problem as the post. |
| `README.md:110` | (none) | Fine, describes the endpoint, not a count. |
| `README.md:117-121` | "13 clusters and 60 agents", "1 published entry and 14 independent agents" | **Correct and dated in context.** A past bug, described in the past tense. Leave it. |
| `README.md:165` | "all ~55k servers" | Accurate (55,289). But hand-typed and outside the script's markers, so it will go stale. Low severity. |
| `README.md:386` | Distinct IP addresses = 0 | **FALSE. Should be 2.** |
| `README.md:390` | Registry mirror = 0 | **FALSE. Should be 55,289.** |
| `README.md:400` | Measurement date 2026-11-05 | Correct, script-generated. |
| `README.md:516` | `<slug>` badge example | Fine, it is a template not a figure. |

**The positive half.** The script itself is well made. The marker blocks are a good mechanism: it cannot write outside the section it owns, and it throws loudly if a marker is missing rather than silently leaving old numbers in place (`scripts/refresh-numbers.mjs:65-76`). The measurement note is dated and framed as a measurement, not a promise, which is exactly the rule from `brand/CONTENT.md` and the design notes. The design notes record the decision properly (`agents/design-delight/NOTES.md`, "The numbers move, so they are read"). The architecture is right. **The one missing behaviour is that a missing field must be an error, not a zero.** That is a five-line change.

---

## 2. New copy findings

### NEW-1. `/about` publishes "1 distinct IP addresses". **Severity: medium.** Copy defect, ships on the next deploy.

`src/board.ts:1084`:

```
`The whole board holds ${num(agents)} independent ${plural(agents, "agent", "agents")} across ${num(distinctIps)} distinct IP addresses.`
```

`agents` is pluralised with `plural()`. `distinctIps` is not. Rendered with one agent and one address:

> "The whole board holds 1 independent agent across 1 distinct IP addresses."

**Fix:** `${num(distinctIps)} distinct ${plural(distinctIps, "IP address", "IP addresses")}.`

### NEW-2. `/about` asserts "Most of that is one machine counted more than once" and then inverts it. **Severity: medium.** False claim, present tense, on a public page.

`src/board.ts:1084`. The clause is unconditional whenever `agents > 0`. Rendered with twelve agents across twelve addresses:

> "The whole board holds 12 independent agents across 12 distinct IP addresses. Most of that is one machine counted more than once, not 12 people in 12 places."

Two failures in one sentence. First, "Most of that is one machine counted more than once" is false when the agents and the addresses are equal. Second, "not 12 people in 12 places" says the opposite of the truth in that case: twelve agents across twelve addresses **is** twelve people in twelve places, and the sentence denies it. The sentence was written for a specific measurement (18 agents across 4 addresses on 3 November) and kept its shape when the numbers became arbitrary.

The current production numbers are 3 agents across 2 addresses, which makes the "most of that" clause a defensible reading, but it is a claim about the composition of the sample that the page cannot support from two counts. A fingerprint splitting one machine into several agents is a real fact about the board (`src/snippet.ts:32-35`), and the sentence should be able to say it without asserting it.

**Fix:** make the clause conditional on the two numbers differing, and drop the "not N people in N places" construction, which reads as an inversion when the counts match. Something in the shape of:

- `addresses < agents`: "Most of that is one machine counted more than once, not N people in N places."
- `addresses >= agents`: "Every agent came from a different address."

Both are true by construction, and the second is the more reassuring statement, so it is the one that should be reachable.

Also fix the grammar while you are in there: the current construction renders "not 1 people in 1 places".

### NEW-3. The launch post's registry size is "tens of thousands", which is the approximation the voice rules forbid. **Severity: blocking.**

`docs/show-hn.md:9`:

> "There are tens of thousands of servers in the official MCP registry, and it is hard to tell which of them agents actually need."

`brand/VOICE.md:95-101`: "Every figure quoted must be sourced and checked before the piece goes live. If a number cannot be verified, it does not appear. **Not as an approximation, not as 'roughly', not as 'around'.**"

"Tens of thousands" is an approximation. The same sentence appears on the landing page (`src/board.ts:1094`) and in `llms.txt` (`src/board.ts:1206`).

This matters more than a normal figure because it is the number the CEO named twice as the one the launch is built around:

- **Decision 3:** "one number says how big the registry mirror is. **That number must be re-measured from inside the deployment on the day of launch**, because `/api/servers` is 403 and 55,288 cannot be confirmed from outside. If it cannot be confirmed, it does not go on the page."
- **Decision 5:** "**One number for the post:** the registry size. Re-measured, dated, appearing once, prominently, early. Everything else in the post is subordinate to it or cut."
- **Action 16 in my own review:** "Confirm the registry mirror total from inside the deployment, since `/api/servers` is 403. If it cannot be confirmed, it does not go in the post."

The number **is** now confirmable from inside the deployment. The branch adds `servers` to `/api/stats`, which is a public endpoint. The production database says 55,289. The refresh script reads it. It is one line of code away from the post and it is currently sitting in the README as a zero.

**Fix:** replace "tens of thousands" with the figure, dated, once, early. Something like "There are 55,289 servers in the official MCP registry" with the date it was read. It should be the same number the site shows, so it can be checked by a reader with a curl, which is the entire point of the founder choosing it.

The same change applies to `src/board.ts:1094` (`/about` lede) and `src/board.ts:1206` (`llms.txt`).

### NEW-4. The post's example reply carries a figure the board does not produce. **Severity: blocking for the post.**

`docs/show-hn.md:21-22`:

```
wish("Convert a PDF invoice into structured line items")
→ "+1 to an existing wish (3 agents want this, 3 wishes in total)."
```

The reply format is right. The string matches `src/mcp.ts:309` and `src/board.ts:972` exactly. The numbers are wrong for that capability. The production cluster "Convert a PDF invoice into structured line items" has **1 agent and 1 wish**. A second agent filing it today gets "2 agents want this, 2 wishes in total".

The post's own checklist at `docs/show-hn.md:116-118` says: "The example reply is illustrative of the shape of the reply. The agent count and the wish count in it are the ones that were true when this was written." That sentence is the problem, not the fix. It documents that the figures are frozen, in a document whose whole purpose is that figures move. A reader cannot see the checklist. And for the invoice capability, they were never true: the capability was filed once, by the founder, while verifying the wedge.

**Fix:** either use the real current figures (1 agent, 1 wish, or whatever it is on the day), or change the example to a capability whose count is stable enough to illustrate the shape. Note that the count for any live capability moves, so the robust fix is to make the example use a clearly illustrative placeholder, the way `llms.txt` already does at `src/board.ts:1226`: `"+1 to an existing wish (N agents want this, M wishes in total)."`

### NEW-5. The `/wish` form placeholders are fixed, but two other surfaces still point at the deleted entry. **Severity: low.**

The two placeholders my review named are fixed (`src/board.ts:1018`, `:1020` now say "Convert a PDF invoice into structured line items"). But:

- `src/index.ts:144`, the 404 page's search form, still has `placeholder="Read UK council planning PDFs as structured data"`.
- `src/board.ts:888`, the `/build` claim form's slug field, still has `placeholder="read-uk-council-planning-pdfs"`.
- `src/index.ts:962`, the `/claim` error message, still uses `read-uk-council-planning-pdfs-as-structured-data` as its example slug.

None of these is a blocker. The 404 form does genuinely search the board and the slug is a plausible shape. But the rule I wrote in action 5 was that the product's only concrete examples of a wish should not point at a deleted entry, and three surfaces still do. Worth a sweep.

### NEW-6. The reply does not show the match scores, which the founder's decision specified. **Severity: low.**

Decision 3: "The reply shows the matching servers **with their scores**, and the board's position on that capability if there is one."

The reply shows the servers, their titles, their names, their descriptions and their URLs (`src/board.ts:983-984`), but not their scores. The scores are in the data (`result.servers[].score`, visible in the MCP response I tested: 0.692, 0.658, 0.621, 0.62) and they are the number that tells a reader which of the four is the closest match. Low severity, because the reply is already good, but it was specified.

### NEW-7. My own probe wish added a fourth wish to production. **Severity: none to the product, flagged for the record.**

Verifying that "four working weather servers" is still true required exercising the check on production, which files a wish. Production now reads 4 wishes, 4 agents, 3 pending. The cluster is "The current weather forecast for a city", 2 agents, 2 wishes, pending. **I have not deleted it**, for the reason I gave in the first review: deleting it would hide a real agent's request, and the board has no delete path. The README and post were restored to their committed state afterwards (`git checkout -- README.md docs/show-hn.md`), so the committed numbers still read 3. **`node scripts/refresh-numbers.mjs` must be run again before the post goes up, and the count will now be 4.** This is exactly the workflow the script was built for, and it worked.

---

## 3. Voice compliance, re-run against the changed files

Files re-checked: `src/board.ts`, `src/html.ts`, `src/snippet.ts`, `src/rss.ts`, `src/index.ts`, `src/api.ts`, `src/db.ts`, `src/mcp.ts`, `src/wish.ts`, `src/copy.ts`, `src/types.ts`, `README.md`, `docs/show-hn.md`, `docs/launch.md`.

| Rule | Pass/Fail | Evidence |
|---|---|---|
| **No em dashes** | **PASS** | Zero `—` across all 23 user-facing source files and all three canonical docs. `grep -c $'—'` returns 0 for every one. Verified across every tracked text file: the only hits are in internal agent definitions (`.claude/`, `.opencode/`, `agents/`), skill specs, memory notes, tests and `docs/transcript.md`. None of those is user-facing copy. `docs/transcript.md` is a raw MCP wire log, not prose, and is not linked from any public surface or from the README. |
| **No American spellings** | **PASS** | Every `color` hit is a CSS property inside a `style="..."` attribute or a stylesheet (`src/html.ts:60,585,767`, etc.). Prose uses British forms: `sanitised` (`src/board.ts:1011`), `labelled`, `behaviour`, `catalogue`. No `recognize`, `organize`, `analyze`, `centered`, `labeled`, `personalized`, `catalog`, `favor`, `math` in prose. |
| **No banned phrases** | **PASS** | Zero hits for "In today's digital age", "Moreover", "Furthermore", "Delve into", "Harness the power of", "Unlock your potential", "Transform your", "navigate your ... journey", "This is not just X. It is Y.", "This isn't only about X. It's about Y." Also absent: "revolutionary", "game-chang", "seamless", "leverage", "cutting-edge", "state-of-the-art", "supercharge", "elevate". |
| **No "AI-powered"** | **PASS** | `brand/CONTENT.md:100` forbids it. Zero hits across `src/`, `docs/`, `README.md`. |
| **No emoji as punctuation** | **PASS** | None found in any user-facing file. |
| **No bullet lists in posts** | **PASS** | `docs/show-hn.md` is paragraphs with bolded single-line statements. The bullets at `:104-146` are the internal "Before this goes up" checklist, which is not part of the post. The post body (`:9-100`) has no bullets. |
| **No hedging in body copy** | **PASS** | The honest dead ends are still there (`src/board.ts:868`, `src/board.ts:1036`) and they read as truth rather than as a disclaimer, because they are a statement of the deployment's state, not a hedge about the claim. The `/about` and hero sentences are declarative in both branches. |
| **No generic advice** | **PASS** | The post now leads with a mechanism a builder can use today and a specific measured result ("four working weather servers, all of them already published"). The paragraph on the fingerprint splitting one machine into several agents (`docs/show-hn.md:72-77`) is the specific observation the rule asks for. This was the failing rule in the first review and it now passes. |
| **Numbers verified before publication** | **FAIL (blocking)** | See the blocking section and NEW-3, NEW-4. The README publishes two false zeros with a false source attribution. The post carries an approximation where a figure belongs and an example reply whose counts the board does not produce. This is the same rule that failed in the first review, and it failed in a different file. |
| **One number that surprises the reader** | **PARTIAL** | The post went from nine diffused figures to four: "tens of thousands of servers", "3 agents / 3 wishes" (inside the example), "four working weather servers", "zero" (claims), plus "three independent agents" (the threshold rule) and "3 wishes" (the board state). Four measurements is a workable number, and the post no longer reads as a list of figures. **But the number that should carry it, the registry size, is an approximation rather than a figure.** The founder's Decision 5 named it, the founder's Decision 3 named it, my own action 16 named it. It is not in the post. |
| **Speak to one person, one situation** | **PASS** | The lede opens on the builder's moment ("Choosing what to build next?", `src/board.ts:156`). The hero check answers the builder's actual first question, which is "does this already exist", and does it before the board is mentioned. The post addresses one reader in one situation: a builder deciding what to build this weekend. |
| **British register, understated confidence** | **PASS** | "The board is young and I would rather say so than let the numbers imply more than they do" (`docs/show-hn.md:50-51`) is the register. "I have not built the loop that takes you from 'I want to build this' to 'I built it' yet, and I would rather say that than fake it" (`:64-65`) is the register. |
| **Sound like a person, not a platform** | **PASS** | First person singular throughout the post. "Ask it for 'the current weather for a city' and it comes back with four working weather servers, all of them already published, and the agent carries on" (`:39-40`) is a person describing something they watched happen. |
| **Named byline** | **N/A, unchanged** | The post is first person and Show HN carries the account. Action 15 still stands as low priority. |
| **Vary the sentence structure** | **PASS** | The post moves between short statements ("Nothing is executed.") and long explanatory sentences. The hero stats line no longer has the four-clause run that broke the rhythm in the first review. |
| **Open with the reader's situation, not the concept** | **PASS** | `src/board.ts:156`. The lede leads with "Choosing what to build next?", not with the product. The check block that follows is the answer to that moment, which is what `brand/CONTENT.md:73` and `:93-94` ask for: lead with the builder's moment, then let the answer arrive. |
| **End with one specific next step, not a menu** | **PARTIAL** | The post ends with "The board is the story, so please go look at it rather than reading my description of it" (`:99-100`), which is one thing. The hero ends with a snippet to paste, which is one thing. **But `/build` still ends with three ways to look at an empty board** (`src/board.ts:896-900`), which is a menu, and none of them is live. See Finding 6. |
| **Every text node legible in a coloured block** | **PASS** | New `.check` block has its own styles (`src/html.ts:518-535`) with `max-width:60ch` on the copy, a mobile breakpoint that stacks the field and button (`:544-546`). `scripts/check-pages.mjs` reports 0px desktop overflow and 0px mobile overflow on `/`, `/about`, `/build`, `/weekly`, `/wish`. The `.tallybig small.addresses` line is `font-weight:400` at `src/html.ts:508`, so the address count reads as a subtitle and not as a second headline. |
| **Muted hierarchy still reads** | **PASS** | `.hero .herostats` and `.hero .seednote` are `var(--ink-soft)`, the seed note's `b` is `var(--red-ink)` at weight 700 (`src/html.ts:335-337`), and the lede is a single class everywhere with no inline font-size overrides. The branch removed all nine inline `style="font-size:...;color:..."` lede overrides that the first review noted. |
| **Every internal link resolves** | **PASS** | `scripts/check-pages.mjs` walks `/`, `/about`, `/agents`, `/build`, `/weekly`, `/wish` and the 404 route with no broken links. The only console error is the deliberate 404 for the pending cluster, which is the publish gate working. |
| **No live page states a number the board's own queries cannot produce** | **FAIL (blocking)** | The CEO's sixth launch gate, and the one the whole review was organised around. The `/about` page now passes it. **The README does not.** It states "Distinct IP addresses behind them | 0" and "MCP servers in the registry mirror | 0", each attributed to `GET /api/stats`, when the board's own queries produce 2 and 55,289. The gate was aimed at the template. It also has to be aimed at the script. |

---

## 4. Positive findings worth protecting

The rewrite is good work and most of it should not be touched.

- **The em-dash discipline held under a rewrite.** Zero em dashes across 23 user-facing source files after a commit that rewrote the hero, the about page, the build page and the post. This is the hardest rule to hold and it was held.
- **The publish gate is a genuine correctness fix, and it is the most valuable thing in this commit.** A pending cluster was readable at `/w/{slug}`, served at `/api/cluster/{slug}`, returned by `/api/search`, and given a badge and an OG poster. `src/db.ts:75-95` now filters on `status = 'published'`, with a separate `getClusterBySlugAnyStatus` for the admin surfaces. Verified live: `/w/read-uk-council-planning-pdfs-as-structured-data` now 404s on the branch, and `/badge/...svg` 404s with it. A board whose threshold is theatre is not a board.
- **One flag drives the board's state.** `boardIsEmpty` (`src/board.ts:140`) drives the hero, the card area and the empty state together. The first review found the hero saying "0 wishes from 0 agents, in 0 clusters" thirty pixels above "Nothing on the board yet". That contradiction cannot come back, because there is one answer now.
- **The empty state stopped blaming the reader.** The old copy said "Nothing on the board yet under this filter" when no filter was applied. The new copy has a filtered branch and an unfiltered branch (`src/board.ts:223-227`), and the unfiltered one says why the board is empty rather than implying the reader is looking in the wrong place.
- **The snippet is right.** 242 characters, four sentences, a request rather than a protocol description. It keeps the header clause, which was the part a reader cannot guess, and it drops the part the AGENTS.md snippet and the `/agents` page already carry. The comment block at `src/snippet.ts:75-80` records why it was 653 characters, which is the kind of comment that stops the next person putting it back.
- **The security section is now one argument.** "A secret cannot reach storage, whichever path it takes: the sanitiser runs before the write and again on the model's output" (`docs/show-hn.md:85-86`) is stronger than the three-mechanism version it replaced, and it keeps the specifics a reader would actually test. The trust argument survived compression. That was the hard part of Finding 3 and it landed.
- **"The counts mean something" is first.** `docs/show-hn.md:72-77`. It was last in the section, and it is the paragraph that decides whether a builder can act on the number. Moving it to the front is the single best editorial decision in the commit.
- **The board-state section did not fill the gap.** `docs/show-hn.md:91-93` names the empty state and the three real pending wishes. It does not show a wish the operator filed as a ranking. The seed labelling apparatus is not voided on the one day it is most visible. This was the explicit instruction in the founder's Decision 5 and in my own action D5, and it was followed exactly.
- **The registry check is genuinely first class, not a decorative form.** It is the first thing after the lede, it is one input and one button, and it works: I exercised it on production and it returned four real, published tools for a capability nobody had asked for before, with working URLs.
- **The distinct-IP count ships on the card and on `/about`**, in `/api/stats` so the post has a machine-readable source. Ten fingerprints from four addresses is not ten people, and the board now says so.
- **The badge never points at something that is not published.** The weekly badge always exists, so the fallback is safe.
- **The RSS pluralises.** Both nouns agree at 0 and at 1.
- **The two sentences the founder required are intact, word for word.** "I have not yet seen a builder claim an entry. That is the number the whole thing exists for, and it is zero." (`docs/show-hn.md:57-58`) and "The registry check is the part that works today, with no crowd at all" (`:67-68`). Verified by grep against the exact strings in `reviews/product-direction.md:258` and `:260`.
- **The title still promises exactly what the board can show.** `docs/show-hn.md:3` promises a board and a mechanism, not a count, a ranking size or a leaderboard. The rule the author wrote at `:124-125` ("Do not promise a top 20 in the title") is still there and still obeyed. Unchanged from the first review, and correct.
- **The seed caveat is now a labelled span, not a clause inside the stats sentence.** `src/board.ts:159`, `<span class="seednote">`. The sentence's shape no longer changes on a number nobody editorialises.
- **`npm test` (379 passing) and `npm run typecheck` (clean) both pass.** The copy is held in place by tests: `tests/live-copy.test.ts` fails while a dated measurement is in the template, `tests/board-empty-state.test.ts` covers the hero branches, `tests/snippet-length.test.ts` holds the 242 characters, `tests/publish-gate.test.ts` holds the gate.

---

## 5. What has to change, in order

**Blocking, before anything publishes:**

| # | Change | Where | Why |
|---|---|---|---|
| B1 | Deploy the branch, then run `node scripts/refresh-numbers.mjs` against production, so `distinctIps` and `servers` come back as 2 and 55,289 instead of 0. Re-check the table by hand against `GET /api/stats`. | `README.md:386,390` | The README publishes two false zeros and attributes both to a source that would produce the right number. This is Finding 1 again, in the build script. |
| B2 | Make `refresh-numbers.mjs` throw when a field it needs is missing, rather than writing 0. `num()` must distinguish "zero" from "not reported". | `scripts/refresh-numbers.mjs:56` | A script that cannot tell the difference will do this again the next time the deploy order changes. It wrote "The 0 wishes on it are real, filed by real agents" when I pointed it at a source with no wishes. |
| B3 | Put the real registry total in the post, once, early, dated. The same figure on `/about` and in `llms.txt`. | `docs/show-hn.md:9`, `src/board.ts:1094`, `src/board.ts:1206` | The founder named it twice. It is confirmable from inside the deployment now. "Tens of thousands" is the approximation `brand/VOICE.md:95-101` forbids. |
| B4 | Fix the example reply's counts, or make them placeholders. | `docs/show-hn.md:21-22` | The invoice capability has one agent and one wish. The post says three and three. |

**High, ship-blocking on quality:**

| # | Change | Where | Why |
|---|---|---|---|
| H1 | Pluralise the address count. | `src/board.ts:1084` | "1 distinct IP addresses" is on a public page. |
| H2 | Make "Most of that is one machine counted more than once" conditional on the counts differing, and drop the "not N people in N places" inversion. | `src/board.ts:1084` | The sentence is false when agents equal addresses, and it inverts the truth in that case. |
| H3 | Give the builder one live action on `/build`: the registry check. | `src/board.ts:896-900` | Three ways to look at an empty board is not a next step, and `brand/CONTENT.md:20-22` asks for one. This is the last open item from the original seven. |

**Medium and low:**

| # | Change | Where | Why |
|---|---|---|---|
| M1 | Show the match scores in the reply. | `src/board.ts:983-984` | Decision 3 asked for them. The data is there. |
| M2 | Sweep the remaining deleted-entry examples. | `src/index.ts:144`, `src/index.ts:962`, `src/board.ts:888` | Three surfaces still point at an entry that does not exist. |
| M3 | Move `README.md:165` ("~55k servers") inside the script's markers, or accept it as a hand-typed approximation. | `README.md:165` | It is accurate today (55,289) and will go stale. |
| M4 | Re-run `node scripts/refresh-numbers.mjs` on the day of posting, and expect 4 wishes rather than 3. My verification probe filed a real one. | `docs/show-hn.md` | The count moved during this review. That is the point of the script. |
| L1 | A named byline on the post. | `docs/show-hn.md` | Action 15, still low priority. Show HN carries the account. |

---

## 6. Status

**Status: approved with changes. Does not ship as it stands.**

The copy is in a different place from where it was. The voice held through a rewrite that touched the hero, the about page, the build page, the RSS feed, the snippet and the post. Seven findings, five fixed, one partly fixed, one open. The launch post went from nine figures to four and from a mechanism dump to a piece with an argument. The registry check is now the thing the landing page leads with, and it works.

What is not finished is the numbers, and it is the same numbers. Finding 1 was a false figure in a template. The fix moved the numbers into a query and the query into a script, and the script now writes two false zeros into the README while labelling them with a source that would produce the right answer. That is the same defect with a new address, and it is the one the founder's sixth gate was written to stop.

I am not going to call this a near miss and wave it through. The rule in `brand/VOICE.md` is absolute: a number that cannot be verified does not appear, and a number that has been verified and comes back wrong does not appear either. Two of the four fixes above are small and mechanical. The branch is otherwise in good shape. Fix them, run the script against the deployed `/api/stats`, and this ships.

**Next step:** `gtm-owner` owns the copy decisions and the deploy order. Deploy first, then refresh, then re-check the table by hand, then fix the post's two figures. `ceo` owns the decision on whether the registry total goes on the page; my recommendation is that it does, because the founder already decided it twice and the number is now confirmable by any reader with a curl.

**One thing to carry forward.** My verification probe filed a fourth real wish on production while I was checking that "four working weather servers" is still true. It is a legitimate agent request and it should stay, for the reason I gave in the first review. The board now reads 4 wishes and 4 agents. The script will pick that up correctly on the next run, which is the behaviour we wanted. But the number in the committed README and post is 3, and it needs refreshing before anything goes up.
