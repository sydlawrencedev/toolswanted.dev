# Design closing verdict — Tools Wanted

**Reviewer:** Samira Wyatt, Design & Delight Lead
**Date:** 6 November 2026
**Subject:** `feature/marketing-design-review` at `d83de41` (includes `3ee7279`, the commit under closing review)
**Base under test:** `http://127.0.0.1:8787` (branch code, local D1), plus `http://127.0.0.1:8788` (`wrangler dev --remote`, branch code against production's data), plus `https://toolswanted.dev` for deployment state
**Prior review:** `reviews/design-verdict.md` at `85784c9` — **SHIPS**, with three Low findings

---

# VERDICT: **SHIPS**

**The reason, in one line: all three of my Low findings are closed and closed properly — the two document findings are now self-correcting rather than merely correct today, and the button fix is one line of CSS that makes the control behave honestly with the script off — and the branch introduces no new defect on any surface I can measure.**

**One thing the founder needs to know, and it is a deployment step rather than a code defect:** the fix for the broken weekly snapshot is on this branch and is **not deployed**. Production is still serving that page with a 21px unstyled button. The branch ships; it has to be deployed for the fix to reach a reader. Details in "One thing for the founder" below.

---

## The three Low findings from the last review

| # | Finding | Status | Evidence |
|---|---|---|---|
| **L1 (NEW-7)** | The README's "no published entries" was hand-written and could not self-correct | **CLOSED — properly closed, not just edited** | Below |
| **L2 (NEW-8)** | The post's board block rendered as a run-on paragraph | **CLOSED** | Below |
| **L3 (NEW-9)** | The clear-theme button was visible for two frames, and forever with JS off | **CLOSED** | Below |

### L1 — CLOSED. The sentence is managed whole, lead included, and cannot collide.

The claim to check was not "the sentence is right today" but "the sentence *cannot* be wrong today, and will be right tomorrow". Both hold.

**Against production, the committed tree is byte-identical after a script run:**

```
$ md5 -q README.md docs/show-hn.md
32846fe595ab951173165b87adbef4d6
5a0c9938259aecd66dee11f08b1e6b45

$ node scripts/refresh-numbers.mjs
README.md: 26 wishes, 7 agents, 2 published
docs/show-hn.md: 2 published entries

$ md5 -q README.md docs/show-hn.md
32846fe595ab951173165b87adbef4d6
5a0c9938259aecd66dee11f08b1e6b45

$ git status --short README.md docs/show-hn.md
(empty)
```

Zero diff, and idempotent — I ran it twice and the second run changed nothing, which is what the post now instructs the operator to expect.

**The stronger claim is that the two halves of the sentence cannot collide into a comma splice, and that holds because the script owns the whole sentence, lead included.** I drove it through three board states with a mock, on a copy of the repository so the real tree was never touched:

| Board state | README `published:` block |
|---|---|
| **0 published** | "**The board is young.** It has a small number of independent agents behind it, and nothing has been published yet: a capability appears once three independent agents want the same thing." |
| **1 published, 1 agent** | "**The board is young.** It has a small number of independent agents behind it. 1 entry has been published, and 1 independent agent has asked for it." |
| **2 published, 7 agents** | "**The board is young.** It has a small number of independent agents behind it. 2 entries have been published, and 7 independent agents have asked for them." |

Two things worth saying plainly:

- **The empty branch reproduces the original hand-written wording verbatim.** Nothing that read correctly before has been degraded.
- **Every branch is two sentences, not one.** The populated branch ends the first sentence at "behind it." and the managed clause starts a new one. There is no comma splice, because there is no "and" left in the hand-written lead for the managed clause to collide with. The `state:` block agrees in all three branches and pluralises correctly ("1 published entry", "2 published entries", "behind it", "behind them").

**And the numbers still move.** The board has moved since the commit (production now reads 35 wishes, 8 agents, 4 agents on the top entry). I ran the script against the live board and it wrote "4 agents · 28 wishes" and "8 independent agents" — matching `GET /api/top` and `GET /api/stats` exactly. Then I restored the committed tree with `git checkout`. The documents are current to the day they are posted, and the script is what makes them current.

### L2 — CLOSED. The block is fenced, and the script writes the fence.

Last time I rendered the post through a CommonMark renderer rather than guessing, and that is how I caught the run-on. I did the same thing again.

**The board block now renders as a code block, and the paragraph after it is a separate paragraph:**

```html
<pre><code>Read UK council planning PDFs as structured data
    3 agents · 19 wishes
    https://toolswanted.dev/w/read-uk-council-planning-pdfs-as-structured-data
The current weather forecast for a city
    3 agents · 4 wishes
    https://toolswanted.dev/w/current-weather-forecast-city
</code></pre>
<p>The weekly &quot;most wanted&quot; page (<a href="https://toolswanted.dev/weekly">…</a>) updates as
wishes come in and has an RSS feed…</p>
```

Run-on paragraphs containing the listing, across the whole document: **0**. The three code blocks in the post all have their content intact.

**The fence is written by the script, not by a human.** I proved this by running the script against a mock board: the "one entry" and "two entries" branches both emit the fence themselves, and the empty branch emits the prose block, which needs no fence. A human cannot add the fence and have it survive the next run.

**One correction to my own last review, now that the shape has changed.** Last time I recommended the `llms.txt` shape (`1. Title (wanted by 3 agents): url`) as the one to use, on the grounds that four surfaces publishing the same list should publish it the same way. `3ee7279` went with a fenced block instead. **I am not going to call that a finding**, and I want to be clear about why, because I argued the other way last time.

The rank is not lost from `llms.txt` — I verified it is still there, and I checked the singular case end-to-end against a seeded board rather than taking the commit message's word for it:

```
1. Read UK council planning PDFs as structured data (wanted by 3 agents): https://toolswanted.dev/w/…
2. The current weather forecast for a city (wanted by 1 agent): https://toolswanted.dev/w/…
```

The two are now different surfaces with different jobs: `llms.txt` is a ranked list an agent reads, and the post's block is a listing a human skims in a paragraph. A fence is a legible way to show a three-line record. The one thing I did insist on — that the false claim about `llms.txt` dropping the rank be corrected — is corrected: the rank is there, and the commit no longer cites a source that does not say so.

### L3 — CLOSED. Measured in a real browser, in all five states.

This was the one I said "fix it in the next commit, not this one". It is fixed, and the fix is the one line I specified.

**The measurements, in a real browser, not by reading the CSS:**

| State | Clear button | Main toggle |
|---|---|---|
| JS on, no override | `display:none`, 0×0 | `display:block`, 103.92×44, "Dark mode" |
| JS on, override set | `display:block`, 167.59×44 | `display:block`, 106.48×44, "Light mode" |
| JS on, after pressing the **clear** button | `display:none`, 0×0 | `display:block`, "Dark mode" — `data-theme` removed, localStorage nulled |
| JS on, after pressing the **toggle** | `display:block`, 167.59×44 | `display:block`, "Light mode" |
| **JavaScript disabled** | **`display:none`, 0×0** | `display:block`, 103.92×44, "Dark mode" |

**Frames with the button visible during load: 0.** 49 frames sampled. Last time it was 2, at t = 70.8ms and 78.7ms. The flash is gone, and it is gone because the stylesheet's default is `display:none` and the script opts *in*, rather than the script opting *out* after the paint.

**The no-JS case — the half that mattered — is fixed.** With JavaScript off, the reader sees one working-looking control, the toggle, which does what it says by following the system. There is no second button that does nothing, because without the script there is no override to clear. The logic holds: the control appears only when there is something to undo.

**The hierarchy is right when it does appear.** Measured with an override set:

| | Weight | Ink | Height | Border | Radius |
|---|---|---|---|---|---|
| Toggle | 700 | `rgb(243,238,225)` | 44px | 1px solid | 2px |
| Clear | 400 | `rgb(168,159,147)` | 44px | 1px solid | 2px |

The clear button reads as the secondary it is — lighter weight, softer ink, same 44px target, same 2px radius, same 1px border. Contrast passes on every pair: dark clear text 6.83:1, dark toggle 15.40:1, dark border 3.26:1 (the 3:1 UI-boundary floor), light clear 8.57:1, light toggle 18.34:1.

**One small thing I checked and am not reporting as a finding:** the script writes `display:inline-block` inline, but the computed value is `block`. That is the flex container (`.foottheme{display:flex}`) blockifying the button, and it blockifies it either way. The rendered result is identical. Not a defect.

---

## Regressions: none

I re-verified every item I closed in earlier rounds, on the rendered screen:

| Closed before | Re-verified now |
|---|---|
| The favicon is a W, not an X | Path unchanged; `tests/favicon.test.ts` passes |
| The placeholder fits | `placeholder="Parse an invoice"` — unchanged |
| The nav lights exactly one item | `/`→1, `/weekly`→1, `/agents`→1, `/build`→1, `/wish`→1, `/about`→1, `/privacy`→0. Exactly as before |
| The clear button appears only with an override | Verified in four states above, plus the JS-off state |
| The `/about` address clause | "holds 4 independent agents across 3 distinct IP addresses" — with a seeded board carrying 4 agents on 3 addresses |
| The board card's address line | "3 agents from 2 addresses", and shown only because the two numbers differ |
| The registry figure is consistent | 55,293 on `/about`, in `llms.txt`, and in both documents' openings |

**The board card's tally pluralises correctly too**, which I checked with a deliberately one-agent entry: `aria-label="3 agents want this"` and `aria-label="1 agent wants this"`.

**The checks I ran myself:**

| Check | Result |
|---|---|
| `npm test` | **395 passed, 42 files** |
| `npm run typecheck` | **clean** |
| `npm run build` | **clean** |
| `node scripts/audit-browser.mjs http://127.0.0.1:8787` | **168 page loads, 0 findings, 0 console errors** |
| `node scripts/audit-browser.mjs http://127.0.0.1:8788` (remote dev, branch code, real data) | **168 page loads, 0 findings, 0 console errors** |
| `node scripts/audit-extra-pages.mjs http://127.0.0.1:8788` | **48 page loads, no findings** |
| `node scripts/check-pages.mjs` | **0px overflow on every page**, one `h1` per page, no skipped heading levels |
| `node scripts/refresh-numbers.mjs` against production, twice | **byte-identical tree both times** |

**On the count.** The brief said 391 tests. It is **395**, because `d83de41` added `tests/weekly-cache-key.test.ts` (4 tests). The branch is further along than the brief described.

**On the local audit's findings.** The local `--local` server produces three findings on the `wish-result` page (contrast on a `<pre>`, 0 `h1` elements, a `<pre>` without a copy button). **These are not defects and not regressions.** The log says it plainly:

```
ERROR unhandled error Error: Binding AI needs to be run remotely
  at async embedQuery (src/embed.ts:78:15)
```

`wrangler dev --local` cannot run Workers AI, so the wish path 500s and the page renders the error page instead of the result page. The repo's own `scripts/serve.mjs` says this: "That is the only way to exercise the wish path locally: Vectorize has no local mode." Against the remote dev server running the branch's code against production's real data, the same audit reports **no findings** and the wish-result page renders a proper `<h1>Read UK council planning PDFs as structured data</h1>`. The local findings are the local mode's limitation, and I am recording that so nobody reads them as a defect later.

---

## New findings

**None.** I went looking for new defects in the two commits and did not find any.

What I checked beyond the audits, and found nothing wrong with:

- **The responsive sweep** at 320, 390, 768 and 1280px: 0px overflow, one `h1` per page, the toggle 44px at every width, the clear button correctly hidden at every width.
- **The contrast sweep** on the changed controls, as measured above — every pair passes its own threshold.
- **Every route's stylesheet URL**, local: `/`, `/weekly`, `/weekly/2026-W44`, `/agents`, `/build`, `/wish`, `/about`, `/privacy` and the 404 all carry `?v=640f8c8e-…`. The three pages that build their own meta — the 404, the write-limit page and the crawler page — now set `assetVersion` themselves, and the 404 and crawler page are confirmed rendering with a versioned URL.
- **The post's full rendered text**, for copy defects: all three code blocks intact, no empty blockquotes, the board listing reading as a listing.
- **The `llms.txt` pluralisation**, driven through the real template with the db stubbed: `unique_agents=1` → "wanted by 1 agent"; `unique_agents=2` → "wanted by 2 agents"; each entry pluralises independently; 12,345 → "12,345 agents" with a separator; and the rank is retained.

**One judgement I want on the record, because it is a disagreement with the commit and it is not a finding.** `d83de41` carries the deploy's version in the weekly snapshot's cache key and passes the `local` flag. I verified the local build now serves `/style.css?v=640f8c8e-…` on `/weekly/2026-W44` and that the route sets `cache-control: no-store` for local requests. The remote dev preview still showed the unversioned URL, and I chased that down rather than leaving it: the remote preview forwards through the same edge as production (`Server: cloudflare`, `CF-Ray`, `Nel` headers on the response), so it was answering from production's cache, not from the branch's Worker. The branch's own route code is right. Not a finding — but the reason is worth knowing before somebody deploys and wonders.

---

## One thing for the founder, which is not a design finding

**The fix for the broken weekly snapshot is on this branch and is not deployed. Production is still serving that page wrong today.**

This is not a new observation and it is not a defect in the branch. It is the deployment state, and it needs a deploy. But the reader is affected *now*, so I am putting it at the top rather than in a footnote.

Measured on production, `/weekly/2026-W44`, in a real browser:

| | Branch (`d83de41`) | Production (deployed) |
|---|---|---|
| Stylesheet URL | `/style.css?v=640f8c8e-…` | `/style.css` — **no version** |
| Theme button height | **44px** | **21px** |
| Button border | `1px solid rgb(21,18,16)` | `2px outset rgb(0,0,0)` |
| Button background | `rgb(255,253,247)` (paper-2) | `rgb(239,239,239)` — raw OS grey |
| min-height | `44px` | `0px` |

And the stylesheet URL comparison across the whole product:

| Page | Branch | Production |
|---|---|---|
| `/` | `style.css?v=640f8c8e-…` | `style.css?v=eea4aba7-…` |
| `/weekly` | `?v=640f8c8e-…` | `?v=eea4aba7-…` |
| **`/weekly/2026-W44`** | **`?v=640f8c8e-…`** | **`style.css` — no version** |
| `/about`, `/agents`, `/build`, `/wish` | `?v=640f8c8e-…` | `?v=eea4aba7-…` |

**Production's weekly snapshot is the one page out of seven whose stylesheet URL carries no version.** It is serving a page whose markup came from a newer build with a stylesheet from an older one, so the theme button renders as a raw OS button — the one screen in the product that no stylesheet has ever styled.

**This also confirms `d83de41`'s diagnosis is right.** The commit says the deployed Worker is an older build; I checked, and production's `/style.css` contains **no `.themebtn` rule and no `.themeclear` rule at all** — it predates the theme feature. The clear button still measures `display:none` on that page, but that is the page's own newer inline script doing it, not CSS. The toggle gets nothing at all.

**What this needs:** deploy the branch, and purge the edge cache for `/weekly/*` so the stale snapshot is replaced. The stale entry carries `cache-control: public, max-age=3600`, so it can sit for up to an hour on its own; the fix should not wait on it.

**One more deployment fact, for completeness.** Production's homepage is running deploy `eea4aba7-c65e-4627-91fa-23edc3d84fdf`; the branch builds `640f8c8e-3b5d-4eeb-91f4-b850844b2975`. Its hero says "26 wishes from 7 agents, in 2 clusters", which agrees with `/api/stats` exactly — so production is *consistent*, just behind. Nothing on production is lying to a reader. It is simply an older build, and the weekly snapshot is the one page where that shows.

---

## What I did not change

**Nothing was changed.** This is a review. I did not modify a single tracked file in the repository.

For the measurements that needed data, I worked on copies:

- The script's three board states were driven against a mock server on a **copy** of the two documents in the system temp directory. The repository's own `README.md` and `docs/show-hn.md` were never written to.
- I seeded the **local D1** with a controlled board to exercise the populated surfaces, and **restored it from a backup** afterwards. The final state is exactly as I found it: `clusters 0, wishes 0, votes 0, rate_limits 0, snapshots 0`.
- I ran `node scripts/refresh-numbers.mjs` against production twice; both runs produced a byte-identical tree. I ran it a third time deliberately, to confirm it tracks a board that has moved since the commit, and then restored the committed tree with `git checkout -- README.md docs/show-hn.md`.
- The temporary measurement scripts are in the system temp directory and are not in the repository.
- I created a git worktree at `85784c9` for comparison and **removed it**. `git worktree list` shows one entry: the repository itself.

**The tree is clean:** `git status --short` shows no modified tracked file. The untracked entries are all pre-existing (`.audit/`, `.dev.vars`, `.wrangler/`, `node_modules/`, `.DS_Store`, `toolswanted-kit/`, and the earlier review documents).

---

## The short version

| | |
|---|---|
| **Verdict** | **SHIPS** |
| **L1** — the README's hand-written state sentence | **CLOSED.** The whole sentence is script-managed, lead included. Byte-identical against production, idempotent, and all three branches verified — including the empty branch reproducing the original wording |
| **L2** — the post's board block | **CLOSED.** Renders as a `<pre><code>` block, the paragraph after it is a separate paragraph, zero run-on paragraphs in the document, and the script writes the fence |
| **L3** — the clear-theme button | **CLOSED.** `display:none` by default, revealed by the script only when there is an override. 0 visible frames (was 2). Hidden with JavaScript off. Four states and the no-JS state all measured in a browser |
| **New findings** | **None** |
| **Regressions** | **None.** 395 tests pass, typecheck and build clean, 168 page loads with 0 findings against both the local and the remote dev server, the extra-pages audit reports no findings, 0px overflow on every page, and every item I closed in earlier rounds re-verified on the rendered screen |
| **One deployment step** | The weekly-snapshot fix is on the branch and **not deployed**. Production still serves that page with a 21px unstyled button. Deploy, and purge the edge cache for `/weekly/*` |

The three findings are closed. The branch does not regress anything I closed before, and it does not introduce anything new. **It ships.**

---

*Samira Wyatt, Design & Delight Lead — Tools Wanted*
