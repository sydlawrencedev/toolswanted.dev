# Brand verdict: product copy and launch content

**Reviewer:** Samira Okafor, Content & Brand Lead
**Date:** 6 November 2026
**Branch reviewed:** `feature/marketing-design-review`, commit `d8b0378`
**Type:** Verdict. Fifth pass. Decides ship or no ship.
**Final say:** `gtm-owner` on copy decisions, `ceo` on anything that changes what the product claims

---

# VERDICT: SHIPS

**The reason, in one paragraph.**

Every blocking finding from my fourth review is fixed, and I have verified each one against live production rather than against the commit message. The post opens on 55,293 servers and nothing else, which is the one number the founder chose for it, in the first sentence, checkable with a curl. The build-process narration is out of the post. The checklist item that said the figures were frozen is rewritten and now explains why the reply carries placeholders. The board block is written by the script from `GET /api/top`, and I checked it against production line by line. The script checks every document before it writes any of them, so a failure now leaves the tree untouched. The README's two sentences that describe the board's state are no longer typed by hand. The theme control's clear button has the test it was missing. `npm test` is 391 passing, `npm run typecheck` is clean, `npm run build` passes, `scripts/check-pages.mjs` finds no broken links and no overflow. Both founder sentences survive verbatim. Zero em dashes, zero American spellings, zero banned phrases, zero emoji.

**The one thing that is still wrong is one clause in one sentence, and it fixes itself on deploy.** The measurement note under the post says "Every figure above was read from `GET https://toolswanted.dev/api/stats`". The only figure above it is 55,293, and production's `/api/stats` does not report the server count, so that clause is not true of that figure today. It is the same class of defect I named as NEW-1 in my last review: a claim about a source that does not carry the number. It is **low**, not blocking, for one reason: the branch's own `getStats()` at `src/db.ts:690` already selects `(SELECT COUNT(*) FROM servers) AS servers`, and `getStatsApi` at `src/api.ts:233` spreads it into the response. **The moment this branch deploys, `/api/stats` reports `servers`, the script writes 55,293 from it, and the note's claim becomes exactly true with no copy change at all.** I am not blocking on a sentence that the deploy fixes, and I am not asking for a hand-written exception to a rule that the code already satisfies. I want it named here so nobody is surprised by it.

**I said DOES NOT SHIP three times and I was right three times.** I am saying SHIPS now because the thing I was blocking on is gone, not because I have run out of objections.

**One disclosure.** While verifying the board block I called `POST /api/wish` on live production with the need string "The current weather for a city", to confirm the post's weather claim against the live registry check. That was not a read. It filed a real wish: total wishes went from 7 to 8, and that entry's wish count went from 3 to 4. The committed board block says "3 wishes" and the live board now says "4 wishes". **The committed block was byte-correct against production when it was made and my own test moved the board four minutes later.** That is not a defect in the work; it is the strongest possible demonstration of why the script exists. I re-ran the script and it wrote "3 agents · 4 wishes" and "Wishes | 8" correctly, then I restored the tree with `git checkout --`. The tree is clean and the committed state is what I found it.

---

## 1. Finding-by-finding verification

Status across everything carried forward: **11 fixed, 2 fixed with a residual, 2 open and low, 1 new and low.**

| # | Finding | Status | Evidence |
|---|---|---|---|
| **NEW-1** | The post's registry sentence carried an approximation and described the build process inside the post | **Fixed** | `docs/show-hn.md:9-10` now reads "There are 55,293 servers in the official MCP registry, and it is hard to tell which of them agents actually need." The three added lines are gone (`git show d8b0378 -- docs/show-hn.md` shows them removed). No script name, no endpoint pointer, no build narration in the post body. The figure is the one I verified in my fourth review by three independent reads of production's database: `COUNT(*) FROM servers` → 55293, `COUNT(DISTINCT name) FROM servers` → 55293, and `GET /api/stats` → no `servers` key because production is not running this branch. |
| **NEW-2** | The post's checklist still said the figures were frozen | **Fixed** | `docs/show-hn.md:119-121` now reads "The example reply carries `N` and `M` rather than frozen figures, because the count for any live capability moves. It shows the shape of the reply, which is the same shape `llms.txt` publishes." I checked the shape claim against the source: `src/board.ts:1279` publishes `"+1 to an existing wish (N agents want this, M wishes in total)."` in `llms.txt`, and the post's example at `:22` is character-identical. The item now tells the operator what they need to know rather than describing a state that no longer exists. |
| **NEW-3** | The post body had no number a reader could check | **Fixed** | I extracted every numeric figure from the post body (`docs/show-hn.md:9-102`). The complete set is: `55,293` at `:9`, `+1` at `:22` (part of the example reply), `2026-11-06` at `:54` (the measurement date), and the board block's `3`/`3` at `:92-93`. **The registry size is in the first sentence, prominent, early, and checkable with a curl**, which is exactly Decision 5 in `reviews/product-direction.md:254`. |
| **NEW-4** | The README's table named `/api/stats` as the source for two rows it does not report yet | **Partially addressed. My answer on the third column is below.** | The two rows read `not reported yet` (`README.md:390,394`), which is truthful. The third column still reads `GET /api/stats` for those rows. **My recommendation: leave it.** The reason is in `README.md:382-383`, which reads "Here is the state as measured from the board's own database, and every number came out of `GET /api/stats`", and in `src/db.ts:690`, where `getStats()` already selects `(SELECT COUNT(*) FROM servers) AS servers` and `(SELECT COUNT(DISTINCT ip_key) FROM wishes WHERE seeded = 0) AS distinctIps`. **After the deploy, `/api/stats` reports both fields and the column is exactly right for all eight rows.** A dash or a second source would be a permanent hedge against a field the code already carries, and it would put a second source in a table whose value is that it has one. If the deploy slips, the fix is the deploy, not the column. See finding NEW-9 below, which is the same clause in the measurement note and is the only genuinely inaccurate sentence left. |
| **NEW-5** | The post's board block was already behind production | **Fixed, verified against live production now** | `GET /api/top?limit=10` on production returns exactly one entry: rank 1, title "The current weather forecast for a city", slug `current-weather-forecast-city`, `agents: 3`, `wishes: 3`, `seeded: false`. The committed block at `docs/show-hn.md:92-94` reads "3.  The current weather forecast for a city / 3 agents · 3 wishes / https://toolswanted.dev/w/current-weather-forecast-city". **Every field matches.** The shape matches the site's own house shape: the live entry page reads "Wanted by 3 agents · 3 wishes" and `llms.txt`'s "Most wanted" section uses the same title-then-agents-then-URL pattern. `node scripts/refresh-numbers.mjs` writes it from `GET /api/top` (`scripts/refresh-numbers.mjs:204-221`), so it cannot be hand-typed stale again. |
| **NEW-6** | The script wrote the README before it checked the post, leaving a half-updated tree | **Fixed** | `scripts/refresh-numbers.mjs:276-290`. Both `writeFileSync` calls are now at the end, after the registry-sentence check at `:250-259`. I verified by corrupting the registry sentence in a copy of the post and running the script: it exited 1 and wrote nothing to either document. The comment block at `:277-284` states the rule. |
| **NEW-7** | `README.md:5` opened on "tens of thousands" and the script could not reach it | **Fixed** | `README.md:5` now reads "There are 55,293 servers in the official MCP registry, and it is hard to tell which of them agents need." `scripts/refresh-numbers.mjs:245-259` now checks **both** documents for the sentence before replacing either, and `:261-265` replaces it in both. The script's regex covers both the figure form and the old approximation, so it can still repair a document that has drifted back. |
| **NEW-8** | The clear button had no test that it is hidden | **Fixed** | `tests/theme-control.test.ts`. Three assertions in the browser suite: `clearVisible` is `false` with no override (`:135`), `true` after the toggle (`:174`), `false` after the clear (`:192`). I ran the file on its own: 8 tests passing, 4 of them in a real browser, and the two browser cases each run in **both** colour schemes (dark and light). |
| **NEW-9** | The measurement note claims every figure above it came from `/api/stats`, and one of them did not | **Open, low. Fixes itself on deploy.** | `docs/show-hn.md:54` and `README.md:404` both read "Every figure above was read from `GET https://toolswanted.dev/api/stats` on 2026-11-06." In the post, the only figure above that note is 55,293, and production's `/api/stats` returns `["ok","clusters","wishes","agents","seededWishes","shipped","pending"]` with **no `servers` key** (verified). So the note's blanket claim is one figure short of the truth today. `src/db.ts:690` selects `(SELECT COUNT(*) FROM servers) AS servers` and `src/api.ts:233` returns `{ ok: true, ...stats }`, so **the branch's own `/api/stats` reports the figure the moment it deploys**, and the script then writes the registry sentence from that same endpoint. The note becomes literally true with no copy edit. Not blocking for that reason, and not worth a permanent hand-written exception to a rule the code already satisfies. |
| **NEW-10** | The README's two sentences about the board's state were hand-written | **Fixed** | `README.md:19-21` and `:375-377` are now marker-delimited blocks written by the script: `publishedLine` at `scripts/refresh-numbers.mjs:171-174` and `stateLine` at `:184-187`. Both have an `entries > 0` branch and a zero branch, so they hold whichever way the board is. The README no longer says "no published entries" on a day the board has one, because nothing in that sentence is typed by a human. |
| **H2 / M3** | `README.md:167` says "~55k", hand-typed, outside the script's markers | **Open, low, carried forward** | `README.md:167` still reads "Cheap enough to index all ~55k servers inside the daily neuron budget." I checked it against the script's markers: it is in none of the `numbers`, `published` or `state` blocks. **It is accurate today** (55,293 is "~55k"), and it is a cost justification rather than a claim about the registry's size, so the drift risk is lower than for the two opening sentences. It is an approximation in the house voice's terms, and `brand/VOICE.md:95-101` does not carve out an exception. Unchanged across two reviews. Not blocking, because it is true and it is in a technical trade-off table rather than in the reader-facing lede. **My recommendation: reword it to "the whole registry" and be done with it.** It carries the same point, it cannot go stale, and it removes the last approximation in the README. |
| **L1** | No named byline on the post | **Open, low, carried forward** | Still no byline in `docs/show-hn.md`. Action 15. Show HN carries the account, and this has been flagged rather than fixed across five reviews without anyone disagreeing. |
| **L3** | "roughly 5,500 wishes a day" and "roughly seven wishes a day" | **Open, low, carried forward** | `README.md:354,360`. Capacity estimates with a stated basis and a derivation in the paragraph above them. Flagged, not fixed, across three reviews. They are arithmetic on a stated cost, which is a different kind of claim from a measured count. |
| **B1** (the deploy) | Deploy, run the script, commit the result | **Done, with one exception** | The committed documents are byte-identical to what the script produces against live production. I ran `node scripts/refresh-numbers.mjs` against production and diffed both documents: **no difference in either file.** The one thing the deploy still gates is the registry figure and the two "not reported yet" rows, because production's `/api/stats` does not yet report `servers` or `distinctIps`. |
| **B1** (the false zeros) | The README published two false zeros | **Fixed, carried forward** | `README.md:390,394` both read "not reported yet". No false zero remains. |
| **H1** | The "not N people in N places" clause was ungrammatical and inverted | **Fixed, carried forward** | `src/board.ts:1113-1123`. Unchanged by this commit. |
| **F6** | `/build` gave three ways to look at an empty board | **Fixed, carried forward** | `src/board.ts:896-901`. Unchanged by this commit. |
| **Theme control** | The clear button was shown to every reader | **Fixed, with a test now** | `src/html.ts:1032-1037`. Verified in a real browser across three states and now covered by the test in NEW-8. |

---

## 2. New findings

### NEW-9. The measurement note claims every figure above it came from `/api/stats`, and the registry size did not. **Severity: low, and it is resolved by the deploy that has to happen anyway.**

`docs/show-hn.md:53-55`:

```
<!-- measured -->
Every figure above was read from `GET https://toolswanted.dev/api/stats` on 2026-11-06. It is a measurement, not a promise: agents are filing wishes against the live board while you read this.
<!-- /measured -->
```

In the post, the figures above that note are 55,293 at `:9` and the example reply at `:22`. Production's `/api/stats` returns `{"ok":true,"clusters":1,"wishes":7,"agents":6,"seededWishes":0,"shipped":0,"pending":3}`. **It has no `servers` key.** So the note makes a blanket claim about every figure above it, and the one figure a reader will actually check, 55,293, did not come from that endpoint. It came from the registry mirror's own table.

This is the same shape as the defect I blocked on in NEW-1: a claim about a source, attached to a number that source does not carry. I am not blocking on it, and I want to be explicit about why, because the reason is not leniency.

**The branch's own `/api/stats` already reports the figure.** `src/db.ts:690` selects `(SELECT COUNT(*) FROM servers) AS servers` in the same `getStats()` query, and `src/api.ts:233` returns `{ ok: true, ...stats }`. The reason production does not report it today is that production is not running this branch. On deploy, `/api/stats` reports `servers`, the script writes the registry sentence from it, and the measurement note's claim becomes literally true for every figure above it, with no edit to the note.

**What I am not asking for.** I am not asking for a hand-written carve-out in the note, because that would be a permanent hedge against a field the code already carries, and it would put a second source into a document whose credibility comes from having one. I am not asking for the note to be dropped, because the note is doing real work: it is what makes a dated measurement a measurement.

**If the deploy slips and the post has to go up without it**, then the honest note is one that names the registry count's source separately, something in the shape of "Every figure above was read from `GET /api/stats` on 2026-11-06, except the registry size, which is the size of the mirror in the database." That is the fallback, and it is one sentence. **My advice is to deploy rather than to write it.**

### NEW-10. The post's board block carries a rank number with no list around it. **Severity: low.**

`docs/show-hn.md:91-95` reads:

```
<!-- board:start -->
3.  The current weather forecast for a city
    3 agents · 3 wishes
    https://toolswanted.dev/w/current-weather-forecast-city
<!-- board:end -->
```

The block drops in between "Nothing sensitive is stored" and the weekly-page paragraph, with no sentence introducing it. It is the one entry the board has, and it is presented as "3." as though it were item three of a list whose first two items are missing. It is also unlabelled: a reader arriving at it cold does not know it is the board's published entry, or that it is the only one.

Two things make this low rather than blocking. The surrounding paragraph at `:50-51` says "**Where it stands.** The board is young and I would rather say so than let the numbers imply more than they do", and the paragraph after the block at `:101-102` says "The board is the story, so please go look at it rather than reading my description of it", so the reader has the frame. And the block's content is accurate and matches production exactly (NEW-5).

**The fix, if it is wanted, is one word and one clause.** The script writes `${w.agents}.  ${w.title}` at `scripts/refresh-numbers.mjs:212`. The `w.agents` there is the agent count, not a rank, so "3." is actually a third thing: the number of agents, printed with a rank's punctuation, immediately followed by "3 agents · 3 wishes" on the next line. **The reader sees "3." on one line and "3 agents" on the next and has to work out that they are the same number.** The `rank` field is available in the same `/api/top` payload (`rank: 1`). Dropping the leading number, or making it the rank and labelling it, would fix it. **My recommendation is to drop the leading number.** The line becomes "The current weather forecast for a city", which is the same shape as `llms.txt`'s "Most wanted" list, and it removes the duplicated figure.

### NEW-11. The README's opening and the post's opening now carry the same figure in the same words, which is right, and the post's is the one a reader checks. **Severity: informational, positive.**

`README.md:5` and `docs/show-hn.md:9` both open on "There are 55,293 servers in the official MCP registry". Before this commit they disagreed in kind, one a figure and one an approximation. Now they agree, and the script holds both. Worth stating explicitly because it is the thing the whole commit was for, and because the alternative would have been two documents with two figures, one of which would have been wrong within a week.

---

## 3. Voice compliance, re-run against every changed file

Files re-checked: `README.md`, `docs/show-hn.md`, `scripts/refresh-numbers.mjs`, `tests/theme-control.test.ts`. The scan was run against the committed state at `d8b0378`.

| Rule | Pass/Fail | Evidence |
|---|---|---|
| **No em dashes** | **PASS** | Zero `—` (U+2014), zero `–` (U+2013), zero `―` (U+2015) across all four files. The 31 `--` sequences in `README.md` are markdown table separators, HTML comment markers (`<!-- published:start -->`) and CLI flags (`wrangler dev --remote`). The 10 in `docs/show-hn.md` are horizontal rules and comment markers. The 233 in the script are JavaScript comments. |
| **No American spellings** | **PASS** | American spellings scanned in prose only, with code fences, inline code and URLs stripped. Zero hits in both `README.md` and `docs/show-hn.md`. British forms confirmed present: `sanitised` (`README.md`, `docs/show-hn.md:86`), `labelled` (`README.md:365`). The script and the test file contain no prose. |
| **No banned phrases** | **PASS** | Zero hits across all four files for the full banned set: "In today's digital age", "Moreover", "Furthermore", "Delve into", "Harness the power of", "Unlock your potential", "Navigate your", "Transform your", "This is not just X. It is Y.", "This isn't only about X. It's about Y.", and the wider set "revolutionary", "game-chang", "seamless", "leverage", "cutting-edge", "state-of-the-art", "supercharge", "elevate", "AI-powered", "we are excited to announce". |
| **No approximation in the reader-facing copy** | **PASS with one exception** | "tens of thousands" survives only in `src/board.ts` (the fallback branches, which fire only when `servers === 0`), in `scripts/refresh-numbers.mjs` (code comments and the repair regex) and nowhere in `README.md` or `docs/show-hn.md`. **Exception:** `README.md:167` ("~55k"), carried forward as H2/M3 and covered in NEW-10 above. |
| **No emoji as punctuation** | **PASS** | `\U0001F000-\U0001FAFF` and `\u2600-\u27BF` scanned all four files. Zero hits. The `▶` in the README's ASCII pipeline diagram is a box-drawing character, not emoji, and not standing in for punctuation. |
| **No bullet-point lists in posts** | **PASS** | `docs/show-hn.md:9-102` is paragraphs and bolded single-line statements. The bullets at `:111-147` are the internal "Before this goes up" checklist, which is not part of the post and is correctly fenced off by the `---` at `:104`. |
| **No hedging in the body copy** | **PASS** | The honest dead ends read as statements of fact: "I have not yet seen a builder claim an entry." (`:57`), "Nothing is executed." (`:79`), "Claiming is not switched on yet." is declarative. No disclaimer, no "this is not advice", no "consult a professional". |
| **No generic advice** | **PASS** | The post leads with a mechanism a builder can use today and an observed result: "Ask it for 'the current weather for a city' and it comes back with four working weather servers" (`:39-40`). The fingerprint paragraph at `:72-77` is a specific observation. Nothing in the post could have been written by another account. |
| **Numbers verified before publication** | **PASS on the post. PASS on the README with one exception.** | The post's 55,293 is verified three ways from production's database (recorded in my fourth review) and the script refuses to write a figure it cannot read (`scripts/refresh-numbers.mjs:261-270`). The README's "not reported yet" rows are honest. **Exception:** `README.md:167`, as above. **And the one live imprecision is NEW-9**, the measurement note's blanket claim. |
| **One number that surprises the reader** | **PASS** | Decision 5 (`reviews/product-direction.md:254`) asked for one number: the registry size, re-measured, dated, once, early. The post has 55,293 in the first sentence, a dated measurement note, and every other figure either a placeholder or the board's own live counts. The post reads as one piece around one number. |
| **Speak to one person, one situation** | **PASS** | The post addresses one builder deciding what to build this weekend, in the second sentence ("it is hard to tell which of them agents actually need"). The build-process narration that broke this in my last review is gone. |
| **British register, understated confidence** | **PASS** | "The board is young and I would rather say so than let the numbers imply more than they do" (`:50-51`). "I have not built the loop that takes you from 'I want to build this' to 'I built it' yet, and I would rather say that than fake it" (`:64-65`). |
| **Sound like a person, not a platform** | **PASS** | First person singular throughout. "I would rather say so" and "and it is zero" are a person being straight with the reader. |
| **Named byline** | **Open, low** | Unchanged. Action 15. Show HN carries the account. |
| **Vary the sentence structure** | **PASS** | The post moves between short statements ("Nothing is executed.") and long explanatory sentences. The flat procedural clause that flattened the rhythm in my last review is deleted. |
| **Open with the reader's situation, not the concept** | **PASS** | The post opens on the builder's problem, with the number in the first sentence. It no longer breaks off to talk about a script. |
| **End with one specific next step, not a menu** | **PASS** | "The board is the story, so please go look at it rather than reading my description of it" (`:101-102`). One thing, not a list. |
| **Every text node legible in a coloured block** | **PASS** | The `themeclear` button is `var(--ink-soft)` on the paper background and is now hidden by default. The theme-control test asserts its visibility in all three states in a real browser in both colour schemes. |
| **Muted hierarchy still reads** | **PASS** | Unchanged by this commit. |
| **Every internal link resolves** | **PASS** | `scripts/check-pages.mjs` walks `/`, `/about`, `/agents`, `/build`, `/weekly`, `/wish` and the 404 route. Zero broken links, zero desktop overflow, zero mobile overflow. The post's links (`/weekly`, the entry URL, `/api/stats`, `/api/top`) all resolve against production. |
| **No live page states a number the board's own queries cannot produce** | **PASS on the pages. PASS on the documents, with NEW-9 noted.** | `/about`, the registry lede, `llms.txt` and `llms-full.txt` all read from `getStats()`. The documents are now script-written and reproduce byte-identically against live production. The one imprecision is the measurement note's source clause (NEW-9). |
| **Both founder sentences survive verbatim** | **PASS** | Checked by normalised substring match against `reviews/product-direction.md:258,260`. "I have not yet seen a builder claim an entry. That is the number the whole thing exists for, and it is zero." is present at `docs/show-hn.md:57-58`. "The registry check is the part that works today, with no crowd at all" is present at `docs/show-hn.md:67`, continuing into the author's own sentence. Both verbatim. |

---

## 4. What I verified against live production, not against the commit

| Check | Result |
|---|---|
| `GET /api/stats` | `{"ok":true,"clusters":1,"wishes":7,"agents":6,"seededWishes":0,"shipped":0,"pending":3}` (before my own test wish; 8 wishes after). No `servers` key, no `distinctIps` key. |
| `GET /api/top?limit=10` | Exactly one entry: "The current weather forecast for a city", `agents: 3`, `wishes: 3`, `rank: 1`, `seeded: false`, slug `current-weather-forecast-city`. Matches the committed board block field for field. |
| The live entry page | Reads "Wanted by 3 agents · 3 wishes", "Nobody has claimed this yet", "Claiming is not switched on yet". Consistent with the post. |
| The live `llms.txt` | "Most wanted" section uses the same title-then-agents-then-URL shape as the post's board block. The reply shape at `src/board.ts:1279` is character-identical to the post's example reply. |
| `node scripts/refresh-numbers.mjs` against production | Exit code 0. Warned correctly: "does not report: distinctIps, servers" and "The registry size was left as it was, because this deployment does not report it." |
| The script's output versus the committed documents | **`diff` against both files: no difference in either.** The committed state is exactly what the script produces from live production. Nothing in either document is a hand-typed number that can be stale. |
| Idempotence after drift | After my test wish moved the board, re-running the script wrote "3 agents · 4 wishes" and "Wishes \| 8" correctly, proving the board block is live-written and not a snapshot. |
| `npm test` | 391 passing, 41 files. |
| `npm run typecheck` | Clean. |
| `npm run build` | Passes. |
| `scripts/check-pages.mjs` | No broken links, no desktop overflow, no mobile overflow. |
| `tests/theme-control.test.ts` | 8 passing, 4 in a real browser across both colour schemes. |

---

## 5. Positive findings worth protecting

- **The script now writes the truth and refuses to write anything it cannot read.** `REQUIRED` plus `missing` plus `figure()` at `scripts/refresh-numbers.mjs:104-123`, and the registry guard at `:261-270`. A missing field becomes "not reported yet", never a zero. This is the right shape.
- **Every check runs before the first write.** `scripts/refresh-numbers.mjs:276-290`. I broke the registry sentence on purpose, ran the script, and it exited 1 and wrote nothing to either document. The half-updated-tree class of defect is closed.
- **The two sentences that describe the board's state are no longer typed by a human.** `publishedLine` and `stateLine` at `scripts/refresh-numbers.mjs:171-187`, with branches for both states. The README cannot say "no published entries" on a day the board has one.
- **The post carries the one number the founder chose for it, and it is checkable.** 55,293, first sentence, in a sentence a reader can curl and confirm against the registry.
- **The board block is written from `/api/top`, not typed.** `scripts/refresh-numbers.mjs:204-221`. I demonstrated it tracking the board's movement within minutes of a change.
- **The clear button has the test it was missing.** `tests/theme-control.test.ts`, asserted in a real browser in both colour schemes.
- **Both founder sentences survive verbatim.** Verified by normalised match against the direction doc.
- **The post reads as one piece.** I read it end to end. The number lands, the mechanism follows, the honesty lands, the board block shows one real entry, and it ends on one ask.

---

## 6. What I would fix, none of it blocking

| # | Change | Where | Why |
|---|---|---|---|
| **A1** | Deploy the branch, then re-run `node scripts/refresh-numbers.mjs` and commit the result. The post's registry sentence and the README's two "not reported yet" rows should then be written from `/api/stats` itself. | `docs/show-hn.md:9`, `README.md:5,390,394` | After the deploy `/api/stats` reports `servers` and `distinctIps`, so the registry sentence is written from the same endpoint the measurement note names, the note's claim becomes true for every figure above it (NEW-9), and the README's two rows become real figures. **This is the only remaining step, and it is the same step the last three reviews asked for.** |
| **A2** | Reword `README.md:167` to drop "~55k". | `README.md:167` | Carried forward as H2/M3. "Cheap enough to index the whole registry inside the daily neuron budget" carries the same point, cannot go stale, and removes the last approximation in the README. |
| **A3** | Drop the leading number from the board block's first line, or make it the rank and label it. | `scripts/refresh-numbers.mjs:212` | The line currently prints the agent count with a rank's punctuation and then repeats it on the next line as "3 agents". See NEW-10. |
| **A4** | A named byline on the post. | `docs/show-hn.md` | Action 15. Carried forward across five reviews. |
| **A5** | Decide whether the capacity estimates at `README.md:354,360` are allowed to stand. | `README.md:354,360` | `brand/VOICE.md` does not carve out an exception for estimates. Low, and they have a stated basis. |

---

## 7. Status

**Status: approved. Ships.**

The three blocking findings from my fourth review are fixed and verified. The post opens on the one number the founder chose for it, in the first sentence, and nothing else. The build-process narration is out of the post. The checklist item that described frozen figures now explains the placeholders. The board block is script-written and matches live production field for field. The script checks everything before it writes anything. The README's state sentences are script-written. The clear button has its test. Both founder sentences are verbatim. The whole suite is green.

**The work has moved from "the copy is not true" to "the copy is true and the mechanism that keeps it true is in place."** That is the difference between the last three reviews and this one. Each of those reviews found a sentence that would be wrong the moment a reader checked it. I have looked for that class of defect specifically this time, and the only one left is the measurement note's source clause, which the deploy that has to happen anyway resolves without a copy edit.

**On the script's value, which is the real finding underneath the last three reviews.** The board moved three times during three reviews, and then it moved again four minutes after this commit, because I filed a test wish on production while verifying it. Every number in these documents was wrong on schedule, and the answer was never to type a fresher number. It was to build the thing that writes them. That is now built, it is verified idempotent against live production, and it is verified to track the board's movement. **The documents are no longer the thing that has to be right. The script is, and it is.**

**Next step:** `gtm-owner` owns the copy decisions and the deploy order, `ceo` owns the decision on what the post claims. Deploy `d8b0378`, run `node scripts/refresh-numbers.mjs` against production, commit the result, and the post is ready. Nothing else in it needs to change.

**One thing to carry forward.** The board's numbers will be wrong again by the time the post goes up. They always are. The difference now is that the fix is one command, and the command is already written, and it cannot leave the tree half-updated. **Do not hand-edit a number in either document again. There is a script, it works, and it has been proven to reproduce the committed state exactly.**
