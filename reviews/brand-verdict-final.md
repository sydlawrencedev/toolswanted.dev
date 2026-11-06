# Brand verdict: final pass after `d8b0378` and `85784c9`

**Reviewer:** Samira Okafor, Content & Brand Lead
**Date:** 6 November 2026
**Branch reviewed:** `feature/marketing-design-review`, commit `85784c9`
**Type:** Verdict. Sixth pass. Decides ship or no ship.
**Previous verdict:** `reviews/brand-verdict.md` — SHIPS
**Final say:** `gtm-owner` on copy decisions, `ceo` on anything that changes what the product claims

---

# VERDICT: SHIPS

**The reason, in one paragraph.**

The two fixes I asked for are both done, and I verified them against live production rather than against the commit message. The README's "~55k servers" is now "the whole registry", which is the last approximation in the README, and the board block no longer prints the agent count twice. The whole diff since my last review is thirteen lines across three files, and none of it is in `src/`. I ran `node scripts/refresh-numbers.mjs` against production and diffed both documents: **no difference in either file, on two consecutive runs.** The committed state is byte-for-byte what the script produces from the live board, which means no figure in either document is typed by a human and none of them can be stale. The board block matches `GET /api/top` field for field, right now. Both founder sentences survive verbatim. Zero em dashes, zero American spellings, zero banned phrases, zero emoji. `npm test` is 391 passing across 41 files, `npm run typecheck` is clean, `npm run build` passes, `scripts/check-pages.mjs` finds no broken links and no overflow at either width, and every internal link resolves against production with a 200. The tree is clean.

**One new finding, and it does not touch a reader.** The commit message for `85784c9` says the block "now matches the shape llms.txt publishes", and the script's new code comment says "`llms.txt` publishes the same list without it". Both claims are false. `llms.txt` publishes its Most wanted list as a **numbered** list: `1. The current weather forecast for a city (wanted by 3 agents): https://...` (`src/board.ts:1239`). The post's block is unnumbered. The claim is new in `85784c9`, it lives in a code comment and a commit message, and neither is user-facing copy, so the reader never sees it. It is a wrong sentence in a place where a wrong sentence costs nothing today and a little credibility tomorrow if it gets copied into something a reader reads. Low, not blocking, and I have named it so nobody inherits it as fact.

**I said DOES NOT SHIP three times and I was right three times.** I am saying SHIPS now because the thing I was blocking on is gone, and because the mechanism that keeps the copy true is in place and verified. I am not saying it because I have run out of objections. I found one, and it is the right size.

---

## 1. Status of my two fixes

| # | My fix | Status | Evidence |
|---|---|---|---|
| **A2 / H2 / M3** | `README.md:167` said "~55k servers". I asked for "the whole registry". | **FIXED** | `README.md:167` now reads "Cheap enough to index the whole registry inside the daily neuron budget." Applied in `85784c9`. This is the **last approximation in the README**, and the point it makes is now carried by the figure in the opening paragraph, which the script writes from `/api/stats`. It cannot go stale, because it is not a number. |
| **A3 / NEW-10** | The board block's leading "3." printed the agent count with a rank's punctuation and then repeated it on the next line. I asked for the leading number to be dropped. | **FIXED, and better than I asked** | `scripts/refresh-numbers.mjs:220` now writes `${w.title}\n    ${w.agents} ${w.agents === 1 ? "agent" : "agents"} · ${w.wishes} ${w.wishes === 1 ? "wish" : "wishes"}${s}\n    ${base}/w/${w.slug}`. The block at `docs/show-hn.md:91-95` now reads exactly as specified. **I checked the singular cases too**, which I had not asked for: the previous code hard-coded "agents" and "wishes" for every row. It now emits "1 agent · 1 wish" for a single agent and a single wish, and "3 agents · 4 wishes" for the live entry. That is a real improvement and it is not mentioned in the commit message. |

**Both judgement calls left as I said I would leave them.**

| # | My call | Status |
|---|---|---|
| **A4 / L1** | The byline (Action 15). I said I would leave it low. I leave it low. | Still no byline in `docs/show-hn.md`. Show HN carries the account. Flagged, not fixed, across six reviews without anyone disagreeing. Not blocking. |
| **NEW-4** | The README table's third column stays `GET /api/stats` for the two rows that read "not reported yet". | Left as it is, as instructed. The reasoning holds: `src/db.ts:686,690` already selects `distinctIps` and `servers` in the same `getStats()` query, and `src/api.ts:233` spreads them into the response. After the deploy, `/api/stats` reports both and the column is exactly right for all eight rows. A dash or a second source would put a second source into a table whose value is that it has one. **The fix for this row is the deploy, not the column.** |

---

## 2. New findings

### NEW-12. The commit message and a code comment claim the post's board block matches `llms.txt`. It does not. **Severity: low. Not in user-facing copy.**

The commit message for `85784c9` reads: "The leading number is gone and the block now matches the shape llms.txt publishes."

The new code comment at `scripts/refresh-numbers.mjs:211-218` reads:

```
// It used to print the agent count with a rank's punctuation,
// so the block reads "3.  The current weather forecast" and
// then "3 agents · 3 wishes" on the next line. The number
// twice, once as a rank and once as the count, which is two
// claims where there is one. `llms.txt` publishes the same
// list without it.
```

**Both are wrong, and I checked against the live file and the source.** `llms.txt`'s "Most wanted" section is a numbered list. `src/board.ts:1239`:

```js
lines.push(`${i + 1}. ${c.title} (wanted by ${c.unique_agents} agents): ${env.SITE_URL}/w/${c.slug}`);
```

Live production, right now:

```
## Most wanted

1. The current weather forecast for a city (wanted by 3 agents): https://toolswanted.dev/w/current-weather-forecast-city
```

So `llms.txt` publishes the leading number **as a rank**, correctly, alongside the agent count in a separate clause. The post's block publishes the leading number as nothing at all. **These are not the same shape.** The fix I recommended was right for the right reason (the number was being printed twice), but the justification attached to it is false.

**Why this is low and not blocking.** The claim lives in two places, and neither is a reader's copy:

1. A JavaScript comment in `scripts/refresh-numbers.mjs`. Not user-facing. Not rendered. Not published.
2. A commit message in git history. Not user-facing, but permanent, and it is the more durable of the two because it is the version that gets quoted later.

**What I checked so that this finding is exactly one thing and not three.** I looked for the same claim in the user-facing documents and it is not there. `docs/show-hn.md:121` says "It shows the shape of the reply, which is the same shape `llms.txt` publishes." That is a **different claim about a different thing**: it is about the reply shape `wish()` returns, not the board list shape. I verified it: `src/board.ts:1279` publishes `"+1 to an existing wish (N agents want this, M wishes in total)."` in `llms-full.txt`, and the post's example at `docs/show-hn.md:22` is character-identical. **That claim is true.** The false one is confined to the script comment and the commit message.

**What I am asking for.** One word in a code comment, and it is not worth blocking on: the comment should say that the leading number was the agent count wearing a rank's punctuation, and that the entry is now published without it. If the intent was to say the post matches `llms.txt`, then `llms.txt` is the one that needs changing, because `llms.txt` is the machine-readable file an agent reads to learn the board's conventions, and teaching it two conventions for the same list is worse than teaching it one.

**Why I am raising it at all.** This is the same class of defect I blocked on in NEW-1: a claim about a source, attached to a shape that source does not have. It happens to be in a comment, so it costs nothing to the reader today. My rule has been to name every instance of the class, because the class is what erodes credibility, not the individual sentence.

### NEW-13. The board's numbers moved again between my last review and this one, and the documents tracked it. **Severity: informational, positive.**

The committed board block moved from "3 agents · 3 wishes" to "3 agents · 4 wishes", and the README's Wishes row moved from 7 to 8. That is my own test wish from the last review, which I disclosed then. **The script caught it and the documents were updated by the script, not by hand.** I re-ran the script against production and it produced exactly the committed state, byte for byte, twice. The board's count moved; the documents moved with it; nothing was typed.

This is the point of the whole mechanism, and it is now demonstrated end to end rather than argued for.

### NEW-14. The script now handles singular correctly in the board block. **Severity: informational, positive.**

I did not ask for this. The old line hard-coded "agents" and "wishes" for every row, so a board with one agent and one wish would have read "1 agents · 1 wishes". The new template at `scripts/refresh-numbers.mjs:220` branches on both. I verified all three shapes by running the template: "1 agent · 1 wish", "3 agents · 4 wishes", and the seeded case "3 agents · 4 wishes · seeded". The seeded suffix is also only applied when `w.seeded` is true, so an operator-seeded entry can never be mistaken for a real one.

---

## 3. The script against production: idempotence

**Ran:** `node scripts/refresh-numbers.mjs` (no argument, so production), twice, from the repository root.

**Exit code:** 0 on both runs.

**Output (both runs, identical):**

```
https://toolswanted.dev/api/stats does not report: distinctIps, servers.
Those fields are written as "not reported yet" rather than as a number.
Deploy the branch, or point the script at a deployment that has them.
The registry size was left as it was, because this deployment does not
report it. Run the script again after deploying.
README.md: 8 wishes, 6 agents, 1 published
docs/show-hn.md: 1 published entries
```

**Diff against the committed state:**

```
=== DIFF README.md ===
(no difference)
=== DIFF docs/show-hn.md ===
(no difference)
```

**`git diff --stat README.md docs/show-hn.md` after the runs: empty.** The committed state is exactly what the script produces from the live board. Nothing in either document is a hand-typed number that can be stale.

**Restored with** `git checkout -- README.md docs/show-hn.md`. **`git status` is clean at the end**: no modified tracked files. The untracked entries (`.DS_Store`, `.audit/`, `.dev.vars`, `.wrangler/`, `node_modules/`, `toolswanted-kit/`, and the other review files) were all present before I started and are not mine to remove.

**The script's own two warnings are correct behaviour, not defects.** Production's `/api/stats` does not report `servers` or `distinctIps`, so the script refuses to write a figure it cannot read and says which fields it could not read. It also leaves the registry sentence alone rather than inventing one. That is the rule in `brand/VOICE.md:95-101` working as intended: a number it cannot verify does not get written.

---

## 4. `GET /api/top` against the post's board block, field for field

Live production, `GET https://toolswanted.dev/api/top?limit=10`, read directly:

| Field in `/api/top` | Live value | In the post's block | Match |
|---|---|---|---|
| `title` | "The current weather forecast for a city" | "The current weather forecast for a city" | Yes |
| `slug` | `current-weather-forecast-city` | in the URL: `.../w/current-weather-forecast-city` | Yes |
| `agents` | 3 | "3 agents" | Yes |
| `wishes` | 4 | "4 wishes" | Yes |
| `rank` | 1 | not printed | Correct: the leading rank number was dropped on purpose |
| `seeded` | false | no " · seeded" suffix | Yes |
| `shipped` | false | not printed | Correct |
| `url` | `https://toolswanted.dev/w/current-weather-forecast-city` | identical | Yes |

**Every field matches.** The block is exactly:

```
<!-- board:start -->
The current weather forecast for a city
    3 agents · 4 wishes
    https://toolswanted.dev/w/current-weather-forecast-city
<!-- board:end -->
```

**The live entry page agrees:** `https://toolswanted.dev/w/current-weather-forecast-city` reads "Wanted by 3 AI agents: The current weather forecast for a city". Consistent with the block and with the post.

**`GET /api/weekly` and `GET /api/stats` agree**, which the post's own checklist at `docs/show-hn.md:138-140` asks for. Weekly reports `wishes: 8, agents: 6, clusters: 1, pending: 3`; stats reports the same four values.

**The one thing that does not match is `llms.txt`, and that is NEW-12.** It publishes "1. The current weather forecast for a city (wanted by 3 agents)". The figures agree. The shape does not.

---

## 5. Voice compliance, re-run against every changed file

Files re-checked: `README.md`, `docs/show-hn.md`, `scripts/refresh-numbers.mjs`. The scan was run against the committed state at `85784c9`, after `git checkout --`, so it is scanning the committed bytes.

| Rule | Pass/Fail | Evidence |
|---|---|---|
| **No em dashes** | **PASS** | Scanned for U+2014 (em dash), U+2013 (en dash), U+2015 (horizontal bar), U+2012 (figure dash) and U+2212 (minus sign) across all three files. **Zero occurrences of any of them in any of the three files.** The `--` sequences that do appear are markdown table separators (`\|---\|`), HTML comment markers (`<!-- board:start -->`), horizontal rules (`---`), and CLI flags (`wrangler dev --remote`). None is a dash in prose. |
| **No American spellings** | **PASS** | 54 American forms scanned (favor, recognize, organize, color, math, personalized, behavior, catalog, analyze, optimize, summarize, center, labor, license, defense, program, modeling, labeled, canceling, and the rest), in prose only, with code fences, inline code, URLs, HTML comments and table rows stripped. **Zero hits in both documents.** British forms confirmed present: `sanitised` (3), `sanitiser` (4), `labelled` (4). |
| **No banned phrases** | **PASS** | Zero hits across all three files for the full banned set in `brand/VOICE.md:148-172`: "In today's digital age", "Moreover", "Furthermore", "Delve into", "Harness the power of", "Unlock your potential", "Navigate your", "Transform your", "This is not just", "This isn't only about", and the wider set "revolutionary", "game-chang", "seamless", "leverage", "cutting-edge", "state-of-the-art", "supercharge", "elevate", "AI-powered", "we are excited to announce", "in this article", "best-in-class", "world-class". |
| **No emoji as punctuation** | **PASS** | Scanned U+1F000-U+1FAFF, U+2600-U+27BF, U+1F900-U+1F9FF, U+2190-U+21FF, U+2B00-U+2BFF across all three files. **The only hits are two occurrences of `→` (U+2192), a mathematical arrow, not an emoji**: `README.md:287` inside a bash code fence (the `claim → build → ship` comment) and `docs/show-hn.md:22` inside a code fence showing the `wish()` call and its reply. **Neither is punctuation in prose and neither is decoration.** The script has zero hits. |
| **No bullet-point lists in posts** | **PASS** | `docs/show-hn.md:9-102` scanned: zero lines beginning with `-`, `*` or `+`. Paragraphs and bolded single-line statements only. The bullets at `:111-147` are the internal "Before this goes up" checklist, correctly fenced off by the `---` at `:104` and not part of the post. |
| **No hedging in the body copy** | **PASS** | Scanned the post body for "not advice", "consult a professional", "this is not", "we believe", "in our opinion", "may want to", "should consider". **Zero hits.** The honest dead ends are declarative: "I have not yet seen a builder claim an entry." (`:57`), "Nothing is executed." (`:79`), "Claiming is not switched on yet." is stated as fact in the checklist. |
| **No generic advice** | **PASS** | The post leads with a mechanism a builder can use today and an observed result: "Ask it for 'the current weather for a city' and it comes back with four working weather servers, all of them already published" (`:39-40`). The fingerprint paragraph at `:72-77` is a specific observation. Nothing in the post could have been written by another account. |
| **No vague language** | **PASS** | Every claim in the post body carries a named quantity, an endpoint, or a stated behaviour. The one remaining "roughly" in the README is confined to the capacity estimates (see below), which carry their derivation in the paragraph above them. |
| **Numbers verified before publication** | **PASS** | The post's 55,293 was verified three ways from production's database in my fourth review and is written by the script from `/api/stats` (`scripts/refresh-numbers.mjs:104-123` refuses to write a missing field, and `:261-270` refuses to write a registry figure it cannot read). The board block is written from `/api/top` and matches production field for field, verified above. The README's two "not reported yet" rows are honest absences, not zeros. **No unverified figure remains in either document.** |
| **One number that surprises the reader** | **PASS** | 55,293 is in the first sentence of the post, dated, and checkable with a curl against the registry. The complete set of numeric figures in the post body is 55,293 (`:9`), the `N` and `M` placeholders in the example reply (`:22`), the date 2026-11-06 (`:54`), and the board block's 3 and 4 (`:92-93`). The post reads as one piece around one number. |
| **Speak to one person, one situation** | **PASS** | One builder, deciding what to build this weekend, addressed in the second sentence ("it is hard to tell which of them agents actually need"). Unchanged by these commits. |
| **British register, understated confidence** | **PASS** | "The board is young and I would rather say so than let the numbers imply more than they do" (`:50-51`). "I have not built the loop that takes you from 'I want to build this' to 'I built it' yet, and I would rather say that than fake it" (`:64-65`). |
| **Sound like a person, not a platform** | **PASS** | First person singular throughout. "I would rather say so", "and it is zero", "I had to get right" (`:70`). |
| **Named byline** | **Open, low** | Unchanged. Action 15. Left low by agreement. Show HN carries the account. |
| **Vary the sentence structure** | **PASS** | The post moves between short statements ("Nothing is executed.") and long explanatory sentences. No change in these commits. |
| **Open with the reader's situation, not the concept** | **PASS** | The post opens on the builder's problem, with the number in the first sentence. |
| **End with one specific next step, not a menu** | **PASS** | "The board is the story, so please go look at it rather than reading my description of it" (`:101-102`). One thing, not a list. |
| **Every internal link resolves** | **PASS** | Every URL in the post and the README returns 200 against production: `/`, `/weekly`, `/w/current-weather-forecast-city`, `/api/stats`, `/api/top`, `/about`, `/build`, `/agents`. `scripts/check-pages.mjs` walks `/`, `/about`, `/agents`, `/build`, `/weekly`, `/wish` and the 404 route: **zero broken links, zero desktop overflow, zero mobile overflow.** |
| **No live page states a number the board's own queries cannot produce** | **PASS on the pages.** | `/about`, the registry lede, `llms.txt` and `llms-full.txt` all read from `getStats()`. The two documents are script-written and reproduce byte-identically against live production. **The one imprecision left is NEW-9, the measurement note's source clause, which is unchanged and still resolves on deploy.** |
| **Both founder sentences survive verbatim** | **PASS** | Verified by whitespace-normalised match against `reviews/product-direction.md:258,260`. **Sentence 1** — "I have not yet seen a builder claim an entry. That is the number the whole thing exists for, and it is zero." — is present at `docs/show-hn.md:57-58`, verbatim, split across two lines by the wrap. **Sentence 2** — "The registry check is the part that works today, with no crowd at all" — is present at `docs/show-hn.md:67`, verbatim, continuing into the author's own clause "and it is the part you can use whether or not you ever look at the board again", exactly as it stood in my last review. Neither has been touched by these commits. |
| **A source claim in a comment must be true** | **FAIL, low** | NEW-12. The code comment at `scripts/refresh-numbers.mjs:211-218` and the commit message for `85784c9` both claim the post's board block matches `llms.txt`'s shape. `llms.txt` publishes a numbered list (`src/board.ts:1239`). The claim is false, it is not in user-facing copy, and it does not block the ship. |

---

## 6. Verification against live production

| Check | Result |
|---|---|
| `GET /api/stats` | `{"ok":true,"clusters":1,"wishes":8,"agents":6,"seededWishes":0,"shipped":0,"pending":3}`. **No `servers` key, no `distinctIps` key.** Production is not running this branch yet. |
| `GET /api/top?limit=10` | Exactly one entry: `rank: 1`, title "The current weather forecast for a city", slug `current-weather-forecast-city`, `agents: 3`, `wishes: 4`, `this_week: 4`, `seeded: false`, `shipped: false`, `builder: null`, `repo: null`. **Matches the committed block field for field.** |
| `GET /api/weekly` | Reports the same `wishes: 8, agents: 6, clusters: 1, pending: 3` as `/api/stats`, and the same entry with the same counts. **The two agree**, which is what the post's own checklist asks for. |
| The live entry page | "Wanted by 3 AI agents: The current weather forecast for a city". Consistent with the block. |
| The live `llms.txt` | "Most wanted" publishes "1. The current weather forecast for a city (wanted by 3 agents): https://...". **Figures agree, shape does not. This is NEW-12.** |
| The live `llms-full.txt` | Publishes the reply shape `"+1 to an existing wish (N agents want this, M wishes in total)."` at `src/board.ts:1279`, character-identical to the post's example at `:22`. **The post's claim about the reply shape is true.** |
| `node scripts/refresh-numbers.mjs` against production | Exit code 0, twice. Warned correctly about `distinctIps` and `servers`, and left the registry size alone for the same reason. |
| The script's output versus the committed documents | **`diff` against both files: no difference in either. Twice.** The committed state is exactly what the script produces from live production. |
| `npm test` | 391 passing, 41 files. |
| `npm run typecheck` | Clean. |
| `npm run build` | Passes (391 tests in the build run). |
| `scripts/check-pages.mjs` | No broken links, no desktop overflow, no mobile overflow. The only console error is the deliberate 404 route check. |
| `git status` after restore | **Clean.** No modified tracked files. Untracked entries are pre-existing and unrelated. |

---

## 7. Positive findings worth protecting

- **The script is the mechanism, and it is verified.** This is now the second consecutive review where the script reproduced the committed state byte for byte against live production. The documents are no longer the thing that has to be right. The script is, and it is.
- **The board moved and the documents followed without a human.** Between my last review and this one the live count went from 3 wishes to 4 on the entry and from 7 to 8 on the board. The committed documents track it. That is the whole argument for the script, demonstrated rather than asserted.
- **The board block no longer prints a number twice.** One fewer thing for a reader to reconcile.
- **The script got the singular right.** "1 agent · 1 wish" instead of "1 agents · 1 wishes". I did not ask for it. It is the kind of thing that gets noticed the first time a board has one entry, which is exactly the state the board is in now.
- **The seeded suffix stays conditional.** `w.seeded ? " · seeded" : ""` means an operator-seeded entry can never be mistaken for demand. The post's own checklist at `:122-125` insists on this, and the code honours it.
- **The last approximation is out of the README.** "~55k servers" was the only one left, and it is gone.
- **Both founder sentences survive.** Verified by normalised match against the direction doc.
- **The registry size is in the first sentence, once, and it is checkable.** 55,293.
- **The branch's `/api/stats` already carries `servers` and `distinctIps`** (`src/db.ts:686,690`, `src/api.ts:233`), so the last two "not reported yet" rows and the measurement note's source clause all become true on deploy with no copy edit.

---

## 8. What I would fix, none of it blocking

| # | Change | Where | Why |
|---|---|---|---|
| **A6** | Correct the code comment. Say that the leading number was the agent count wearing a rank's punctuation, and that the entry is now published without it. Drop the `llms.txt` comparison, or change `llms.txt` so the comparison is true. | `scripts/refresh-numbers.mjs:211-218` | NEW-12. The claim is false and it is permanent in git history. It costs a reader nothing today, and it is the same class of defect I blocked on before: a claim about a source, attached to a shape that source does not have. |
| **A1** | Deploy the branch, then re-run `node scripts/refresh-numbers.mjs` and commit the result. | `docs/show-hn.md:9`, `README.md:5,390,394` | Unchanged from my last review and still the only remaining step. After the deploy `/api/stats` reports `servers` and `distinctIps`, so the registry sentence is written from the same endpoint the measurement note names, the note's claim becomes true for every figure above it (NEW-9), and the README's two rows become real figures. |
| **A4** | A named byline on the post. | `docs/show-hn.md` | Action 15. Left low by agreement. Carried forward across six reviews. |
| **A5** | Decide whether the capacity estimates at `README.md:354,360` are allowed to stand. | `README.md:354,360` | Unchanged. I re-checked the arithmetic: 100,000 rows ÷ 18 rows per wish = 5,555, so "roughly 5,500" holds; 10,000 neurons ÷ 1,300 per wish = 7.7, so "roughly seven" holds; and 18 ÷ 6 = 3, so "a third of the real cost" holds. They are arithmetic on a stated cost with the derivation in the paragraph above. `brand/VOICE.md` does not carve out an exception for estimates. Low. |

---

## 9. Status

**Status: approved. Ships.**

My two fixes are done and verified against live production, not against the commit messages. The last approximation is out of the README. The board block no longer prints the count twice, it matches `/api/top` field for field right now, and the script that writes it handles the singular correctly and marks seeded entries honestly. The script is idempotent: two consecutive runs against production, no difference in either document, and the tree restored clean. Both founder sentences survive verbatim. Zero em dashes, zero American spellings, zero banned phrases, zero emoji. The whole suite is green, every link resolves, and nothing in `src/` changed.

**The one new finding is a false sentence in a code comment**, not in a reader's copy. It is not worth holding a launch for, and I am not holding it.

**Next step:** `gtm-owner` owns the copy decisions and the deploy order, `ceo` owns the decision on what the post claims. Deploy `85784c9`, run `node scripts/refresh-numbers.mjs` against production, commit the result, and the post is ready. Nothing in the reader-facing copy needs to change.

**One thing to carry forward.** The board's numbers will be wrong again by the time the post goes up. They always are. The difference now is that the fix is one command, and the command is already written, and it cannot leave the tree half-updated. **Do not hand-edit a number in either document again. There is a script, it works, and it has been proven twice to reproduce the committed state exactly.**
