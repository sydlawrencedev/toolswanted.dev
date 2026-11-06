# Design verdict — Tools Wanted

**Reviewer:** Samira Wyatt, Design & Delight Lead
**Date:** 6 November 2026
**Subject:** `feature/marketing-design-review` at `85784c9`
**Base under test:** `http://127.0.0.1:8787` (`npm run dev`, live edge cache)
**Prior review:** `reviews/design-ship-review.md` at `e605145` — **SHIPS**
**Changes under review:** `d8b0378`, `85784c9` — `README.md`, `docs/show-hn.md`, `scripts/refresh-numbers.mjs`, `tests/theme-control.test.ts`. No source in `src/`, no CSS, no layout.

---

# VERDICT: **SHIPS**

**The reason, in one line: the two copy-level commits closed one of my three Low findings properly and are honest about the board, the third is one line of CSS that was never a launch blocker and still is not one, and the new copy defects they introduced are in documents rather than on screens — but the board block in the launch post now renders as a run-on line, which I am holding back from blocking on and writing down here so it gets fixed before the post goes up.**

**I want to be precise about what I am approving.** This branch ships the *site*. The launch post is a document that gets pasted into a form on a Tuesday. A run-on line in that document is a five-minute fix, and the script that produces it will keep producing it until someone changes one template string. It does not stop the branch merging or the site going live. It does stop the post being pasted as-is, and I would rather say that plainly than bury it.

---

## The three Low findings from the last review

| # | Finding | Status | Evidence |
|---|---|---|---|
| **L1 (NEW-7)** | The README said "no published entries" when production has one, and the sentence was outside every script-managed block so it could not self-correct | **CLOSED — properly closed, not just edited** | See below |
| **L2 (NEW-8)** | The post's board block was false until the refresh script ran against production | **CLOSED — and the fix is stronger than the one I asked for** | See below |
| **L3 (NEW-9)** | The clear-theme button was on the page for two frames before hiding, and forever with JavaScript off | **STILL OPEN — not a blocker** | See below |

### L1 — CLOSED. The sentence is now script-written, and the script is atomic.

The README carried two hand-written statements about the board's state. Both are now inside markers — `<!-- published:start -->` / `<!-- published:end -->` and `<!-- state:start -->` / `<!-- state:end -->` — and `refresh-numbers.mjs` writes both from `GET /api/stats`.

**I did not take the commit message's word for it. I ran the script against production and got a byte-identical tree:**

```
$ node scripts/refresh-numbers.mjs          # against https://toolswanted.dev
README.md: 8 wishes, 6 agents, 1 published
docs/show-hn.md: 1 published entries

$ git status --short README.md docs/show-hn.md
(empty)
```

Zero diff. The committed documents already match live production exactly, and the script is idempotent against it. That is the strongest form of this finding being closed: not "the sentence happens to be right today", but "the sentence cannot be wrong today, and it will be right tomorrow".

**The branch is right.** The script writes every branch from the same source and I drove all three of them against a mock:

| Board state | `published:` block | `state:` block |
|---|---|---|
| **0 published** | "nothing has been published yet: a capability appears once three independent agents want the same thing." | "no published entries, a small number of independent agents behind it, and 0 seeded." |
| **1 published, 3 agents** | "1 entry has been published, and 3 independent agents have asked for it." | "1 published entry, a small number of independent agents behind it, and 0 seeded." |
| **2 published, 17 agents** | "2 entries have been published, and 17 independent agents have asked for them." | "2 published entries, a small number of independent agents behind them, and 3 seeded." |

The singular/plural is right in both sentences ("1 entry has", "2 entries have", "asked for it", "asked for them"). The 0-branch reproduces the original hand-written text verbatim, so nothing that read correctly before has been degraded.

**The atomicity claim in the commit message is also true, and I tested it rather than trusting it.** The old script wrote the README before it checked the post, so a failed check left one document current and the other stale. I broke the registry sentence in the post and re-ran it:

```
docs/show-hn.md: the registry size sentence was not found, so nothing was written.
README md5 before: b0b4543154f51b4bf0b1b7753946877c
README md5 after:  b0b4543154f51b4bf0b1b7753946877c
RESULT: README NOT written on post-check failure.
```

Nothing is written on a failed check. The README and the post move together or not at all.

**One thing the commit message does not say and I checked anyway:** the old regex could not match "tens of thousands" and silently did nothing while reporting success. The new pattern matches both forms, and when the pattern is missing the script **exits non-zero and writes nothing** — I confirmed the README is untouched by md5 in that case too. A script that reports success and writes nothing was the original defect; it is now a script that fails loudly and writes nothing. That is the right shape.

### L2 — CLOSED. The board block now comes from `GET /api/top` and matches production.

The committed block:

```
The current weather forecast for a city
    3 agents · 4 wishes
    https://toolswanted.dev/w/current-weather-forecast-city
```

Live `GET /api/top` on production: `agents: 3, wishes: 4`, same title, same slug. The block is true.

**The commit also fixed a real defect I would otherwise have had to report.** Before `85784c9`, the script printed the *agent count* with a rank's punctuation:

```
3.  The current weather forecast for a city
    3 agents · 3 wishes
```

The "3." was not a rank — it was the agent count wearing a rank's punctuation, so the same number was printed twice, once as a position and once as a count. Two claims where there is one. `85784c9` removes it and adds the singular/plural handling (`1 agent · 1 wish`), which I verified against a mock with a one-agent entry.

**The block now agrees with the board, the API and `llms.txt` on the numbers**, which was the point of the finding: 3 agents, 4 wishes, same title, same URL.

### L3 — STILL OPEN. Not a blocker, and I will say why.

The CSS is unchanged. `src/html.ts:726` reads:

```css
.themeclear{font-weight:400;color:var(--ink-soft)}
```

There is no `display:none`. The button is rendered unconditionally in the markup at line 1069 and hidden by `showClear()` at line 1036, which runs at `DOMContentLoaded`. So the two-frame flash and the no-JS case are both still there, exactly as I measured last time.

**I re-measured it rather than assuming it survived, and it did:**

| | My last review | Now |
|---|---|---|
| Frames sampled | 40 | 39 |
| Frames with the button at width > 0 | **2** | **2** |
| When | t = 33.4ms, 35.9ms | t = 70.8ms, 78.7ms |
| **No-JS: clear button** | not measured | **167.59 × 44px, `display:block`, visible, does nothing** |
| No-JS: toggle button | — | 103.92 × 44px, reads "Dark mode", does nothing |

**The no-JS case is the half that matters and it is unfixed.** With JavaScript off, the reader sees a "Use my system theme" button sitting in the footer at full size and full contrast, next to a "Dark mode" button. Neither does anything. There is no override to clear, because the script that creates overrides never ran.

**Is it a blocker? No, and here is my reasoning rather than a shrug.**

- The button lives in the **footer**, below the board, below the hero, below everything the reader came for. A reader who has JavaScript off and scrolls to the bottom sees a control that does nothing. It does not obscure the primary action, it does not misrepresent a number, and it does not break the page.
- The affected population is small and shrinking. JavaScript-off browsing is a minority of traffic, and on the paths where this matters most — an agent reading the API, a builder reading the source — the button is irrelevant either way.
- The branch's own product position is that this is a small product with a working wedge and an honest board. Shipping a small cosmetic imperfection in a footer does not contradict that position.
- **It is one line.** I applied it, measured it, and reverted it. The measurements:

| | Before | With `display:none` added |
|---|---|---|
| Frames with button at width > 0 | **2** | **0** |
| No-JS clear button | visible, 167.59px | **`display:none`, width 0** |
| No-JS toggle button | visible | visible (unchanged, and correct — the reader does get the system theme) |
| Override = dark, JS on | `block`, 167.59px | `block`, 167.59px — **unchanged** |

One line closes both the flash and the no-JS case and breaks nothing. The commit `d8b0378` even added a browser test for the clear button — and that test is the reason I can be precise about what is and is not covered: it asserts `display !== "none"` **after the script has run**, so it passes today, and it would have passed before the fix too. It never looks at the pre-script state or the no-JS state. The test covers the behaviour that works and not the behaviour that is broken.

**My call: not a blocker. Fix it in the next commit, not this one.** It is the third Low on the list and it is the cheapest of the three.

---

## The checks I ran myself

| Check | Result |
|---|---|
| `npm test` | **391 passed, 41 files** |
| `npm run typecheck` | **clean** |
| `node scripts/audit-browser.mjs http://127.0.0.1:8787` | **168 page loads, 0 findings, 0 console errors** |
| `node scripts/audit-extra-pages.mjs http://127.0.0.1:8787` | **No findings** (the 404s in the log are the 404-page loads) |
| `node scripts/check-pages.mjs` | **0px overflow on every page**, one `h1` per page, no skipped heading levels |

**Nothing I closed last time has regressed.** I checked each one on the rendered screen:

| Closed last time | Re-verified now |
|---|---|
| The favicon is a W, not an X | Path unchanged; `tests/favicon.test.ts` passes (it rasterises and measures the ink at the baseline, which is why it caught the X) |
| The placeholder fits | `placeholder="Parse an invoice"` — unchanged |
| The nav lights exactly one item | `/`→1, `/weekly`→1, `/agents`→1, `/build`→1, `/wish`→1, `/about`→1, `/privacy`→0. Exactly as before |
| The clear button appears only with an override | Verified in four states: no-override light → `none`; no-override dark → `none`; override dark → `block`, toggle reads "Light mode"; override light → `block`, toggle reads "Dark mode" |
| The `/about` address clause | "The whole board holds 6 independent agents across 3 distinct IP addresses. Most of that is one machine counted more than once, not 6 people in 6 places." |
| The board card's address line | "3 agents from 1 address" |
| The registry figure is consistent | `/about` and `llms.txt` both say "There are 55,293 servers in the official MCP registry" — the same figure the README and the post now carry |

---

## New findings

### NEW-A — **LOW.** The README's populated branch reads as a comma splice with two "and"s

**Location:** `README.md:18-22`, produced by `scripts/refresh-numbers.mjs:167-171`.

The script writes the `published:` sentence into the middle of a paragraph. Rendered, the README now says:

> **The board is young.** It has a small number of independent agents behind it, and 1 entry has been published, and 6 independent agents have asked for it.

Three clauses, two "and"s, and the second one is a comma splice. The sentence before the change read cleanly:

> **The board is young.** It has a small number of independent agents behind it, and nothing has been published yet: a capability appears once three independent agents want the same thing.

**The empty-board branch is unaffected** — it reproduces the original wording verbatim. Only the populated branch, which is the branch production is actually in, produces the splice.

This is a copy defect, not a truth defect: every number in the sentence is correct and comes from the API. But `brand/VOICE.md` asks for "British in register. The rhythm of the sentence" and "Vary the sentence structure", and a double-"and" run-on is the rhythm failing in the most-read paragraph of the README.

**The fix — one template string, so the sentence stands on its own and the paragraph reads as two:**

```js
const publishedLine = entries > 0
  ? `${num(entries)} ${entries === 1 ? "entry has" : "entries have"} been published, and ${num(stats.agents)} independent ${stats.agents === 1 ? "agent has" : "agents have"} asked for ${entries === 1 ? "it" : "them"}.`
  : `nothing has been published yet: a capability appears once three independent agents want the same thing.`;
```

which is what is there now — the problem is the **preceding** text in the README, which ends in "and". Move the "and" out of the hand-written line, so the block starts a sentence rather than continuing one:

```
**The board is young.** It has a small number of independent agents behind it.
<!-- published:start -->
1 entry has been published, and 6 independent agents have asked for it.
<!-- published:end -->
```

That renders as two sentences and reads correctly in both branches.

### NEW-A — LOW, same shape, but in the post's board block

**Location:** `docs/show-hn.md:91-95`, produced by `scripts/refresh-numbers.mjs:208-220`.

**The block does not render as three lines. It renders as one run-on paragraph, and it runs straight into the paragraph after it.**

I rendered the committed post through a CommonMark renderer rather than guessing:

```html
<p>The current weather forecast for a city
    3 agents · 4 wishes
    <a href="https://toolswanted.dev/w/current-weather-forecast-city">…</a></p>
```

The first line has no indentation and the next two have four spaces, but because the block does not follow a blank line the four-space indent does not open a code block — it is collapsed into the paragraph. **What a reader sees on Show HN:**

> The current weather forecast for a city 3 agents · 4 wishes https://toolswanted.dev/w/current-weather-forecast-city The weekly "most wanted" page (https://toolswanted.dev/weekly) updates as wishes come in…

One wrapped line, no break between the entry and the paragraph that follows it, and the entry's title indistinguishable from the prose around it.

**Two shapes fix it, and I measured both:**

| Shape | Renders as |
|---|---|
| Current (0-indent first line, 4-space rest) | one `<p>` — the run-on above |
| **All three lines 4-space indented** | `<pre><code>` — a code block, three lines |
| **`1. Title (wanted by 3 agents): url`** | `<ol><li>` — a list item, one line |

I would use the **`llms.txt` shape**, for one reason: it is a list, it matches the board's own card (which carries a rank badge), it matches `GET /api/top` (which has a `rank` field), and it matches what `llms.txt` publishes. Four surfaces, one shape.

**And this is where I have to correct the commit message.** `85784c9`'s code comment says:

> "`llms.txt` publishes the same list without it."

That is **false**. `src/board.ts:1239` publishes:

```
`${i + 1}. ${c.title} (wanted by ${c.unique_agents} agents): ${env.SITE_URL}/w/${c.slug}`
```

`llms.txt` keeps the rank number. So the post's block is now the *only* one of the four that drops it, and the commit removed it on the strength of a reference that does not say so.

**The diagnosis in `85784c9` was right even so.** The old `3.` was the agent count in a rank's clothing, so the number really was printed twice and once as a false rank. Removing a *false* rank is correct. But the fix removed the rank rather than replacing a false rank with a true one, and it removed it while citing a source that keeps it.

**The fix — one line in the script:**

```js
return `${i + 1}. ${w.title} (wanted by ${w.agents} agents): ${base}/w/${w.slug}`;
```

which also brings the post's block into agreement with `llms.txt` exactly, and makes the "matches the shape llms.txt publishes" claim true.

**Neither of these two findings is a reason to hold the branch.** They are in two documents, they cost a few minutes, and neither number is wrong. But the launch post is the one artefact here that gets read in public, so they should be fixed before it goes up, not after.

### NEW-B — **LOW.** The operator instructions no longer list everything the script writes

**Location:** `docs/show-hn.md:111-115`.

The "Before this goes up" section says the script rewrites "the table in the README, the board block in this post, the registry size in the opening sentence, and the measurement note." It now also writes the two state sentences in the README (L1's fix) and the README's opening registry sentence.

Nothing here is false — the list is incomplete, not wrong. But it is the operator's instruction for the day the post goes up, and a list of what a script touches that under-reports what it touches is how somebody ends up hand-editing a script-managed block on the day.

**The fix:** add the two state sentences and the README's opening sentence to that bullet.

---

## What I did not change

Nothing was changed. This is a review. I patched `src/html.ts` locally to measure the L3 fix, took the measurements, and **reverted it** — `git diff HEAD -- src/ scripts/ README.md docs/` is empty and `git status --short` shows no modified tracked file. I did not touch the local database. The temporary measurement scripts are in the system temp directory and are not in the repository.

I ran `node scripts/refresh-numbers.mjs` against production twice, and both runs produced a byte-identical tree, so no document was modified.

---

## One thing for the founder, which is not a design finding

`NOTES.md` records, under "The board and the poster have to agree", that the OG poster carries a stale count and that fixing it needs the production `ADMIN_TOKEN`, which is not in the repository. That is still true and it is still a deployment step, not a code defect. `85784c9` did not touch `render-og.ts`, and `docs/show-hn.md:128-131` correctly says to run `npm run og:sync` before posting. I am not re-reporting it as a finding. I am repeating it once so it is not lost, because the poster is the thing that reaches a reader first and the post is about to go up.

---

## The short version

| | |
|---|---|
| **Verdict** | **SHIPS** |
| **L1** — README's hand-written state sentence | **CLOSED**, and closed properly: script-written, atomic, idempotent against production, all three branches verified |
| **L2** — the post's board block | **CLOSED**, and the numbers now come from `GET /api/top`; the double-counted "3." is gone |
| **L3** — the clear-theme button | **STILL OPEN, not a blocker.** One line of CSS. Verified fix: 0 visible frames, no-JS hidden, override behaviour unchanged |
| **NEW-A** | **LOW.** The README's populated branch reads as a comma splice with two "and"s |
| **NEW-A (post)** | **LOW.** The board block renders as a run-on paragraph on Show HN, and the commit's own justification for dropping the rank is factually wrong about `llms.txt` |
| **NEW-B** | **LOW.** The operator instructions under-report what the script now writes |
| **Regressions** | **None.** All 391 tests pass, typecheck clean, 168 page loads with 0 findings, 0px overflow, and every item I closed last time re-verified on the rendered screen |

Two of the three new findings are one-line fixes in `scripts/refresh-numbers.mjs` and one sentence in `README.md`. None of them is a reason to hold a branch whose site is clean, whose numbers are true, and whose board, API, `llms.txt` and README all agree.

---

*Samira Wyatt, Design & Delight Lead — Tools Wanted*
