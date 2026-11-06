# Brand closing verdict: after `85784c9` and `3ee7279`

**Reviewer:** Samira Okafor, Content & Brand Lead
**Date:** 6 November 2026
**Commits reviewed:** `85784c9`, `3ee7279` (on top of `d8b0378`)
**Type:** Closing check. Decides ship or no ship.
**Previous verdict:** `reviews/brand-verdict-final.md` — SHIPS
**Final say:** `gtm-owner` on copy decisions, `ceo` on anything that changes what the product claims

---

# VERDICT: SHIPS

**The reason, in one paragraph.**

All four changes landed as described and I verified each against live production rather than against the commit messages. The false `llms.txt` claim is gone from the script comment, and `llms.txt` now pluralises its agent count like every other surface. The board block is fenced, and I read it through CommonMark's fenced-code semantics: it renders as a three-line listing with its line breaks intact, and the paragraph after it can no longer be pulled into it. The README's state sentence is now managed whole, lead included, so the comma splice with two "and"s cannot happen. The operator instructions describe what the script actually rewrites, and tell the operator to run it twice. I ran `node scripts/refresh-numbers.mjs` against production twice and diffed both documents: **no difference in either file, on either run.** The committed state is byte-for-byte what the script produces from the live board. The board block matches `GET /api/top` field for field, right now. Both founder sentences survive verbatim. Zero em dashes, zero American spellings in prose, zero banned phrases, zero emoji. `npm test` is 391 passing across 41 files, `npm run typecheck` is clean, `npm run build` passes, `scripts/check-pages.mjs` finds no broken links and no overflow at either width, and every internal link resolves against production with a 200. The tree has no modified tracked files at the end.

**Two things I am carrying forward, neither blocking.** The byline on the post is still open, as it has been across seven reviews, because Show HN carries the account. And the two `not reported yet` rows in the README's table still wait on the deploy, because the branch's `/api/stats` already carries `servers` and `distinctIps`; the fix for those rows is the deploy, not a copy edit. Neither touches a reader today.

---

## 1. Status of each item

| # | Item | Status | Evidence |
|---|---|---|---|
| **1** | The false `llms.txt` claim is gone. The comment saying "`llms.txt` publishes the same list without it" is removed, because `llms.txt` keeps the rank. `llms.txt` now pluralises its agent count. | **FIXED, verified both ways** | `scripts/refresh-numbers.mjs:218-229` no longer contains the claim. The comment now reads: "No leading rank number. It used to print the agent count with a rank's punctuation, so the block read '3.  The current weather forecast' and then '3 agents · 3 wishes' on the next line. The number twice, once as a rank and once as the count, which is two claims where there is one." It then says the block is fenced because Markdown collapses a plain newline. **The `llms.txt` comparison is gone entirely.** `src/board.ts:1236-1240` now writes `` `${i + 1}. ${c.title} (wanted by ${num(c.unique_agents)} ${plural(c.unique_agents, "agent", "agents")}): ${env.SITE_URL}/w/${c.slug}` ``, so `llms.txt` keeps the rank and pluralises the count. The one surviving `llms.txt` claim in the documents, at `docs/show-hn.md:124`, is the one about the `wish()` reply shape, and that one is true: `llms-full.txt` publishes `"+1 to an existing wish (N agents want this, M wishes in total)."` character-identically to the post's example at `docs/show-hn.md:22`. |
| **2** | The post's board block is fenced. The script writes the fence. | **FIXED, verified in the source and in the rendered bytes** | `scripts/refresh-numbers.mjs:215` opens the fence with `` "```\n" `` and `:233-234` closes it with `` "\n```" ``. The committed block at `docs/show-hn.md:91-97` is the fenced form. See section 5 for the render check. |
| **3** | The README's sentence about the board's state was a comma splice with two "and"s. The lead is now managed by the script, so the two halves cannot collide. | **FIXED, verified in the source and in the committed bytes** | `scripts/refresh-numbers.mjs:177-180` now builds `publishedSentence`, the whole sentence including the lead: `**The board is young.** It has a small number of independent agents behind it. ${entries} ${entry has / entries have} been published, and ${agents} independent ${agent has / agents have} asked for ${it / them}.` The `replaceBetween` at `:182-188` owns the whole string, so there is no separate hand-written lead left to collide with it. The committed README at `README.md:19` reads: "**The board is young.** It has a small number of independent agents behind it. 1 entry has been published, and 6 independent agents have asked for it." **One "and", one full stop between the lead and the clause, no comma splice.** |
| **4** | The operator instructions under "Before this goes up" now say the script rewrites the registry size in both openings, the two state sentences, the board block and the measurement note, and that it should be run twice because the second run should change nothing. | **FIXED** | `docs/show-hn.md:113-118` now reads: "Run `node scripts/refresh-numbers.mjs` on the day. It reads `GET /api/stats` and `GET /api/top` and rewrites the table in the README, the registry size in both openings, the two sentences that describe the board's state, the board block in this post, and the measurement note. No figure in either document is typed by hand, so none of them can be stale. Run it twice: the second run should change nothing." **Every claim in that instruction is true of the script.** The script writes: the README table (`refresh-numbers.mjs:146-152`), the measurement note in both documents (`:154-157`, `:292-295`), the README state sentence (`:182-188`), the README state line (`:195-201`), the post's board block (`:235-241`), and the registry size in both openings (`:281-284`). "Run it twice" is now enforced by the script's own idempotence, verified below. |

---

## 2. The script against production: idempotence

**Ran:** `node scripts/refresh-numbers.mjs` with no argument, so production, twice, from the repository root.

**Exit code:** 0 on both runs.

**Output (both runs, identical):**

```
https://toolswanted.dev/api/stats does not report: distinctIps, servers.
Those fields are written as "not reported yet" rather than as a number.
Deploy the branch, or point the script at a deployment that has them.
The registry size was left as it was, because this deployment does not
report it. Run the script again after deploying.
README.md: 16 wishes, 6 agents, 1 published
docs/show-hn.md: 1 published entries
```

**Diff of run 1 against the committed state:**

```
=== DIFF RUN1 vs COMMITTED README ===
(no difference)
=== DIFF RUN1 vs COMMITTED POST ===
(no difference)
```

**Diff of run 2 against run 1:**

```
=== DIFF RUN2 vs RUN1 README ===
(no difference)
=== DIFF RUN2 vs RUN1 POST ===
(no difference)
```

**`git diff --stat README.md docs/show-hn.md` after the two runs: empty.** The committed state is exactly what the script produces from the live board, and the second run changes nothing.

**Restored with** `git checkout -- README.md docs/show-hn.md`. **No modified tracked files at the end.** The untracked entries (`.DS_Store`, `.audit/`, `.dev.vars`, `.wrangler/`, `node_modules/`, `toolswanted-kit/`, and the other review files) were all present before I started and are not mine to remove.

**The script's two warnings are correct behaviour, not defects.** Production's `/api/stats` does not report `servers` or `distinctIps`, so the script refuses to write a figure it cannot read and says which fields it could not read. It also leaves the registry sentence alone rather than inventing one. That is `brand/VOICE.md:95-101` working as intended.

**One note on the operator instruction.** The instruction says "the two sentences that describe the board's state". The script does manage two such pieces: the README's `published` sentence (`:182-188`) and the README's `state` line (`:195-201`). The post's state is expressed in prose at `docs/show-hn.md:50-51` and `:57-58`, and the script does not touch those, but they carry no figure. The instruction is accurate about what the script does.

---

## 3. `GET /api/top` against the post's board block, field for field

Live production, `GET https://toolswanted.dev/api/top?limit=10`, read directly:

| Field in `/api/top` | Live value | In the post's block | Match |
|---|---|---|---|
| `title` | "The current weather forecast for a city" | "The current weather forecast for a city" | Yes |
| `slug` | `current-weather-forecast-city` | in the URL: `.../w/current-weather-forecast-city` | Yes |
| `agents` | 3 | "3 agents" | Yes |
| `wishes` | 4 | "4 wishes" | Yes |
| `rank` | 1 | not printed | Correct: the leading rank number was dropped on purpose, and `llms.txt` keeps it |
| `seeded` | false | no " · seeded" suffix | Yes |
| `shipped` | false | not printed | Correct |
| `url` | `https://toolswanted.dev/w/current-weather-forecast-city` | identical | Yes |
| `this_week` | 4 | not printed | Correct: the post does not make a weekly claim |
| `first_seen` | 2026-11-05T19:56:05.917Z | not printed | Correct |
| `last_seen` | 2026-11-06T09:43:29.251Z | not printed | Correct |
| `builder` | null | not printed | Correct |
| `repo` | null | not printed | Correct |
| `clients` | `[{"client":"other","label":"Other","count":4}]` | not printed | Correct |

**Every field matches.** The committed block is exactly:

```
<!-- board:start -->
```
The current weather forecast for a city
    3 agents · 4 wishes
    https://toolswanted.dev/w/current-weather-forecast-city
```
<!-- board:end -->
```

**`GET /api/weekly` and `GET /api/stats` agree**, which the post's own checklist asks for. Both report `wishes: 16, agents: 6, clusters: 1, pending: 3`. `/api/top` and `/api/weekly` carry the same entry with the same counts.

**`llms.txt`, now correct about its own shape.** Live production publishes:

```
## Most wanted

1. The current weather forecast for a city (wanted by 3 agents): https://toolswanted.dev/w/current-weather-forecast-city
```

The figures agree. The rank is present, correctly, and the agent count is pluralised. The new-12 finding from my last review is closed.

---

## 4. Voice compliance, re-run against every changed file

Files re-checked: `README.md`, `docs/show-hn.md`, `scripts/refresh-numbers.mjs`, `src/board.ts`, `src/html.ts`. These are the five files changed since `d8b0378`.

| Rule | Pass/Fail | Evidence |
|---|---|---|
| **No em dashes** | **PASS** | Scanned all five files for U+2012 (figure dash), U+2013 (en dash), U+2014 (em dash), U+2015 (horizontal bar) and U+2212 (minus sign). **Zero occurrences of any of them in any of the five files.** The `--` sequences that do appear are markdown table separators (`\|---\|`), HTML comment markers, horizontal rules and CLI flags. None is a dash in prose. |
| **No American spellings** | **PASS** | Scanned all five files for 25 American forms (`favor`, `recognize`, `organize`, `color`, `math`, `personalized`, `behavior`, `catalog`, `analyze`, `optimize`, `summarize`, `center`, `labor`, `license`, `defense`, `program`, `modeling`, `labeled`, `canceling`, `customize`, `initialize`, `prioritize`, `standardize`, `sanitize`, `utilize`), then reviewed every hit in context. **Every hit is code, not prose:** `README.md:284` is the comment `# initialize, list tools, wish, search, top` in a bash fence, `README.md:457` is the filename `sanitize.ts` in a directory listing, `src/board.ts:304` is the identifier `moreWishes`, and the `src/html.ts` hits are CSS property names (`color`, `align-content:center`, `text-align`, `prefers-color-scheme`). **Zero American spellings in reader-facing prose.** British forms confirmed present: `sanitised`, `sanitiser`, `labelled`, `pluralises` in the script's own comment. |
| **No banned phrases** | **PASS** | Zero hits across all five files for the full banned set in `brand/VOICE.md:148-172` ("In today's digital age", "Moreover", "Furthermore", "Delve into", "Harness the power of", "Unlock your potential", "Navigate your ... journey", "Transform your ...", "This is not just X. It is Y.", "This isn't only about X. It's about Y.") and the wider set ("revolutionary", "game-chang", "seamless", "leverage", "cutting-edge", "state-of-the-art", "supercharge", "elevate", "AI-powered", "we are excited to announce", "in this article", "best-in-class", "world-class"). **Zero hits.** |
| **No emoji as punctuation** | **PASS** | Scanned U+1F000-U+1FAFF, U+2600-U+27BF, U+1F900-U+1F9FF, U+2190-U+21FF and U+2B00-U+2BFF across all five files. **The only hits are three mathematical arrows, not emoji**: `README.md:286` has two `→` (U+2192) inside a bash code fence (`claim → build → ship`), `docs/show-hn.md:22` has one `→` (U+2192) inside a code fence showing the `wish()` call and its reply, and `src/board.ts:499` has one `←` (U+2190) inside a code comment. **None is punctuation in prose and none is decoration.** The script has zero hits. |
| **No bullet-point lists in posts** | **PASS** | `docs/show-hn.md:9-102` scanned: zero lines beginning with `-`, `*` or `+`. Paragraphs and bolded single-line statements only. The bullets at `:113-150` are the internal "Before this goes up" checklist, fenced off by the `---` at `:106` and not part of the post. |
| **No hedging in the body copy** | **PASS** | Scanned the post body for "not advice", "consult a professional", "this is not", "we believe", "in our opinion", "may want to", "should consider". **Zero hits.** The honest dead ends are declarative: "I have not yet seen a builder claim an entry." (`:57-58`), "Nothing is executed." (`:79`), and the checklist's claim switch is stated as fact. |
| **No generic advice** | **PASS** | The post leads with a mechanism a builder can use today and an observed result: "Ask it for 'the current weather for a city' and it comes back with four working weather servers, all of them already published" (`:39-40`). The fingerprint paragraph at `:72-77` is a specific observation. Nothing in the post could have been written by another account. |
| **No vague language** | **PASS** | Every claim in the post body carries a named quantity, an endpoint, or a stated behaviour. The README's "roughly" instances remain confined to the capacity estimates, which carry their derivation in the paragraph above. |
| **Numbers verified before publication** | **PASS** | The post's 55,293 was verified against production's database in my earlier reviews and is written by the script from `/api/stats` (`refresh-numbers.mjs:104-123` refuses to write a missing field; `:281-290` refuses to write a registry figure it cannot read). The board block is written from `/api/top` and matches production field for field, verified above. The README's two "not reported yet" rows are honest absences, not zeros. **No unverified figure remains in either document.** |
| **One number that surprises the reader** | **PASS** | 55,293 is in the first sentence of the post, dated, and checkable with a curl against the registry. The complete set of numeric figures in the post body is 55,293 (`:9`), the `N` and `M` placeholders in the example reply (`:22`), the date 2026-11-06 (`:54`), and the board block's 3 and 4 (`:93-94`). |
| **Speak to one person, one situation** | **PASS** | One builder, deciding what to build this weekend, addressed in the second sentence ("it is hard to tell which of them agents actually need"). Unchanged by these commits. |
| **British register, understated confidence** | **PASS** | "The board is young and I would rather say so than let the numbers imply more than they do" (`:50-51`). "I have not built the loop that takes you from 'I want to build this' to 'I built it' yet, and I would rather say that than fake it" (`:64-65`). The new README sentence is understated and plain: "It has a small number of independent agents behind it." |
| **Sound like a person, not a platform** | **PASS** | First person singular throughout. "I would rather say so", "and it is zero", "I had to get right" (`:70`). |
| **Named byline** | **Open, low** | Unchanged. No byline in `docs/show-hn.md`. Show HN carries the account. Flagged, not fixed, across seven reviews without anyone disagreeing. Not blocking. |
| **Vary the sentence structure** | **PASS** | The post moves between short statements ("Nothing is executed.") and long explanatory sentences. No change in these commits. |
| **Open with the reader's situation, not the concept** | **PASS** | The post opens on the builder's problem, with the number in the first sentence. |
| **End with one specific next step, not a menu** | **PASS** | "The board is the story, so please go look at it rather than reading my description of it" (`:103-104`). One thing, not a list. |
| **A source claim in a comment must be true** | **PASS** | NEW-12 is closed. The false `llms.txt` comparison is gone from `scripts/refresh-numbers.mjs`. The remaining comment now describes only what the code does, and what it does is what it says. |
| **The board's numbers are machine-written, not typed** | **PASS** | Verified by the two-run idempotence check in section 2. The committed state is byte-for-byte what the script produces, and the second run changes nothing. |
| **Both founder sentences survive verbatim** | **PASS** | Verified by whitespace-normalised match against `reviews/product-direction.md:258,260`. **Sentence 1** — "I have not yet seen a builder claim an entry. That is the number the whole thing exists for, and it is zero." — is present at `docs/show-hn.md:57-58`, verbatim, split across two lines by the wrap. **Sentence 2** — "The registry check is the part that works today, with no crowd at all." — is present at `docs/show-hn.md:67` as the opening clause of the sentence, verbatim, continuing into the author's own clause "and it is the part you can use whether or not you ever look at the board again", exactly as it stood in my last review. **Neither sentence was touched by `85784c9` or `3ee7279`**; `git diff 85784c9..3ee7279 -- docs/show-hn.md` shows changes only to the board block and the operator checklist. |
| **Every internal link resolves** | **PASS** | Every URL in the post and the README returns 200 against production: `/`, `/weekly`, `/w/current-weather-forecast-city`, `/api/stats`, `/api/top`, `/about`, `/build`, `/agents`, `/llms.txt`, `/llms-full.txt`. `scripts/check-pages.mjs` walks `/`, `/about`, `/agents`, `/build`, `/weekly`, `/wish` and the 404 route: **zero broken links, zero desktop overflow, zero mobile overflow.** The only console error is the deliberate 404 route check. |

---

## 5. The fenced block, read as a renderer would

The block as it sits in `docs/show-hn.md:91-97`:

```
<!-- board:start -->
```
The current weather forecast for a city
    3 agents · 4 wishes
    https://toolswanted.dev/w/current-weather-forecast-city
```
<!-- board:end -->
```

**What a CommonMark renderer does with it, checked step by step:**

1. The HTML comments are block-level HTML and are passed through or hidden, depending on the renderer. Either way they do not interrupt the paragraph.
2. The first line after the comment is a fence of three backticks at column zero. The opening fence's info string is empty, so it is a plain code block with no language.
3. The fence is closed by the second three-backtick line at column zero. The two delimiters are balanced, and there is no trailing whitespace on either.
4. CommonMark preserves newlines inside a fenced code block and strips up to the opening fence's indentation from each content line. The content lines therefore render as three literal lines with their line breaks intact and their four-space indents preserved.
5. The paragraph that follows, "The weekly 'most wanted' page ...", sits outside the fence and remains a separate paragraph.

**Rendered as the reader sees it:**

```
The current weather forecast for a city
    3 agents · 4 wishes
    https://toolswanted.dev/w/current-weather-forecast-city
```

followed by a blank line and then:

```
The weekly "most wanted" page (https://toolswanted.dev/weekly) updates as
```

**Confirmed: it reads as a listing, not a run-on.** The title is on its own line, the count is on the second line, the URL is on the third. The block cannot merge with the paragraph after it, because a fenced code block is not a paragraph and the newlines inside it are preserved rather than collapsed. This is the fix the branch claims, and it works.

**The script writes the fence, not a person.** `refresh-numbers.mjs:215` and `:233-234` open and close it, so the next run cannot lose it.

---

## 6. Verification against live production

| Check | Result |
|---|---|
| `GET /api/stats` | `{"ok":true,"clusters":1,"wishes":16,"agents":6,"seededWishes":0,"shipped":0,"pending":3}`. **No `servers` key, no `distinctIps` key.** Production is not running this branch yet. |
| `GET /api/top?limit=10` | Exactly one entry: `rank: 1`, title "The current weather forecast for a city", slug `current-weather-forecast-city`, `url: https://toolswanted.dev/w/current-weather-forecast-city`, `agents: 3`, `wishes: 4`, `this_week: 4`, `seeded: false`, `shipped: false`, `builder: null`, `repo: null`. **Matches the committed block field for field.** |
| `GET /api/weekly` | Reports the same `wishes: 16, agents: 6, clusters: 1, pending: 3` as `/api/stats`, and the same entry with the same counts. **The two agree.** |
| The live `llms.txt` | "1. The current weather forecast for a city (wanted by 3 agents): https://...". **The rank is present and the count is pluralised.** NEW-12 is closed. |
| The live `llms-full.txt` | Publishes the reply shape `"+1 to an existing wish (N agents want this, M wishes in total)."`, character-identical to the post's example at `docs/show-hn.md:22`. **The post's claim about the reply shape is true.** |
| `node scripts/refresh-numbers.mjs` against production | Exit code 0, twice. Warned correctly about `distinctIps` and `servers`, and left the registry size alone for the same reason. |
| The script's output versus the committed documents | **`diff` against both files: no difference in either. Twice.** The committed state is exactly what the script produces from live production. |
| `npm test` | 391 passing, 41 files. |
| `npm run typecheck` | Clean. |
| `npm run build` | Passes (391 tests in the build run). |
| `scripts/check-pages.mjs` | No broken links, no desktop overflow, no mobile overflow. The only console error is the deliberate 404 route check. |
| Internal links against production | All ten return 200. |
| `git status` after restore | **No modified tracked files.** Untracked entries are pre-existing and unrelated. |

---

## 7. New findings

**None.** I found nothing new in these two commits that is not already fixed, and I found no regression. The previous review's NEW-12 is closed by the removal of the false claim and by the `llms.txt` pluralisation.

**One thing that is not a finding, but is worth naming.** The script's `publishedSentence` now embeds Markdown bold markers in the string it writes (`**The board is young.**`). That means the script owns the emphasis as well as the wording, and the lead is no longer hand-written. That is the right design and it is why the comma splice cannot recur. It is not a defect. It does mean that if the lead is ever changed, it is changed in `scripts/refresh-numbers.mjs`, not in `README.md`, because the script will overwrite it. The comment at `:160-176` says so.

---

## 8. What I would fix, none of it blocking

| # | Change | Where | Why |
|---|---|---|---|
| **A1** | Deploy the branch, then re-run `node scripts/refresh-numbers.mjs` and commit the result. | `docs/show-hn.md:9`, `README.md:5,390,394` | Unchanged. After the deploy `/api/stats` reports `servers` and `distinctIps`, so the registry sentence is written from the same endpoint the measurement note names, the note's claim becomes true for every figure above it, and the README's two rows become real figures. |
| **A4** | A named byline on the post. | `docs/show-hn.md` | Unchanged. Carried across seven reviews. Show HN carries the account. |
| **A5** | Decide whether the capacity estimates at `README.md:354,360` are allowed to stand. | `README.md:354,360` | Unchanged. The arithmetic holds and the derivation sits in the paragraph above. Low. |

---

## 9. Status

**Status: approved. Ships.**

All four changes landed, and I verified them against live production rather than against the commit messages. The false `llms.txt` claim is gone and `llms.txt` now pluralises its count. The board block is fenced and renders as a listing with its line breaks intact, not as a run-on that bleeds into the paragraph after it. The README's state sentence is managed whole, so the comma splice cannot recur. The operator instructions describe what the script actually does, including running it twice.

The script is idempotent: two consecutive runs against production, no difference in either document, and the tree restored clean. The board block matches `/api/top` field for field right now. Both founder sentences survive verbatim. Zero em dashes, zero American spellings in prose, zero banned phrases, zero emoji. The whole suite is green, every link resolves, and nothing in `src/` changed beyond the `llms.txt` pluralisation and the theme button's CSS.

**Next step:** `gtm-owner` owns the copy decisions and the deploy order, `ceo` owns the decision on what the post claims. Deploy `3ee7279`, run `node scripts/refresh-numbers.mjs` against production, commit the result, and the post is ready. Nothing in the reader-facing copy needs to change.

**One thing to carry forward.** The board's numbers will be wrong again by the time the post goes up. They always are. The difference now is that the fix is one command, and the command is already written, and it cannot leave the tree half-updated. **Do not hand-edit a number in either document again. There is a script, it works, and it has now been proven twice more to reproduce the committed state exactly.**
