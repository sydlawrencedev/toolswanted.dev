# Brand review: product copy and launch content

**Reviewer:** Samira Okafor, Content & Brand Lead
**Date:** 5 November 2026
**Status:** **Approved with changes.** Nothing ships until the numbers are re-measured and the live board's copy is made true.
**Final say:** `gtm-owner` on copy decisions, `ceo` on anything that changes what the product claims.

## What is being reviewed

| Artefact | Location | Type |
|---|---|---|
| Board hero, card, cluster, weekly, agents, build, wish, about, privacy, llms.txt | `src/board.ts` (1,147 lines) | Voice, brand compliance, structure |
| Footer, nav labels, metadata | `src/html.ts` | Voice, brand compliance |
| Snippets agents copy | `src/snippet.ts` | Voice, craft, length |
| Show HN draft | `docs/show-hn.md` | Voice, craft, truthfulness |
| Launch checklist | `docs/launch.md` | Voice, accuracy |
| Project README | `README.md` | Voice, craft, truthfulness |

## Why this review exists

The board was reset. Every figure in the docs was measured on 4 November 2026 against a board that no longer exists. I verified production on 5 November 2026 at 19:51 UTC:

```
GET https://toolswanted.dev/api/stats
{"ok":true,"clusters":0,"wishes":0,"agents":0,"seededWishes":0,"shipped":0,"pending":0}
```

```
GET https://toolswanted.dev/api/top?limit=5
{"ok":true,"count":0,"wishes":[]}
```

```
GET https://toolswanted.dev/api/cluster/read-uk-council-planning-pdfs-as-structured-data
404 {"error":"not_found","message":"No wish called \"read-uk-council-planning-pdfs-as-structured-data\" is published."}
```

```
GET https://toolswanted.dev/auth/github
503
```

I filed one probe wish (`"the current weather forecast for a city"`) against production while testing. It returned four working weather servers and created one unseeded wish. **The board now reads 1 wish, 1 agent, 0 clusters, 1 pending.** I have not deleted it, because deleting it would hide a real agent's request and the board has no delete path. It should be treated as a legitimate first wish. If you want it gone it needs an operator decision, not a copy change.

**The headline finding is not a style problem. The product's live pages are publishing numbers and claims that are now false, and the launch post would publish them too.**

---

## 1. Voice compliance

Rules from `brand/VOICE.md`. Mechanical checks run across `src/board.ts`, `src/html.ts`, `src/snippet.ts`, `README.md`, `docs/show-hn.md`, `docs/launch.md`.

| Rule | Pass/Fail | Evidence |
|---|---|---|
| **No em dashes** | **PASS** | Zero `—` characters across all six files. `grep -c $'—'` returns 0 for every file. This rule is being held well. |
| **No American spellings** | **PASS** | Every `color` hit in `src/board.ts` and `src/html.ts` is a CSS property inside a `style="..."` attribute (`src/board.ts:402,440,573,689,782,932,971,1004`; `src/html.ts:78,82,132,152,172,184,187,326,327,330,335,337,338,339,344,364,369,372,373,379,394,395,400,401,413,415,418,422,423`), not prose. Prose uses British forms: `sanitised` (`src/board.ts:751,932,1004,1013`), `labelled` (`src/board.ts:983`, `src/html.ts:831`), `behaviour`. No `recognize`, `organize`, `catalogue`/`catalog` misuse, `analyze`, `centered`, `labeled` in prose. |
| **No banned phrases** | **PASS** | Zero hits for "In today's digital age", "Moreover", "Furthermore", "Delve into", "Harness the power of", "Unlock your potential", "Transform your", "navigate your ... journey", "This is not just X. It is Y." across all six files. Also checked and absent: "revolutionary", "game-chang", "seamless", "leverage", "cutting-edge", "state-of-the-art", "supercharge", "elevate". |
| **No "AI-powered"** | **PASS** | `brand/CONTENT.md:100` forbids it. Zero hits across `src/`, `docs/`, `README.md`. |
| **No emoji as punctuation** | **PASS** | None found. |
| **No bullet lists in posts** | **PASS** | `docs/show-hn.md` is written in paragraphs with bolded single-line statements, not bullets. The bullets at `docs/show-hn.md:129-169` are the "Before this goes up" production checklist, which is an internal artefact, not the post. |
| **No hedging in body copy** | **FAIL (partial)** | `src/board.ts:430-434` and `src/board.ts:791` hedge inside the body: "Claiming is not switched on yet, so you cannot attach a repo to an entry at the moment." See Finding 6. This is defensible as a truthful dead-end rather than a disclaimer, and it is better than the alternative the design notes rejected. **I am not asking for it to be cut.** I am asking for it to be shorter, and for the builder to be given a live thing to do on the same screen rather than only an apology. |
| **No generic advice** | **FAIL** | The launch post is largely generic mechanism. See Finding 3. `README.md:424-442` and `src/board.ts:1097-1107` are generic because they are documentation, which is a different job. The post is the piece that fails. |
| **Numbers verified before publication** | **FAIL (blocking)** | Every figure in `README.md` and `docs/show-hn.md` is stale, and `src/board.ts:983` publishes a stale figure to production right now. See section 3. |
| **One specific number that surprises** | **FAIL (in the post)** | `docs/show-hn.md` carries nine distinct figures with no single one carrying the piece. See Finding 3. |
| **Speak to one person, one situation** | **PARTIAL** | `src/board.ts:114` and `:573` speak to "Choosing what to build next?", which is the builder's situation. `src/board.ts:689` and `:932` speak to the blocked agent. Both are addressed to a real moment. But the landing page leads with the board, not with the registry check, so the first reader to arrive is not yet in the moment where the product helps. See Finding 5. |
| **British register, understated confidence** | **PASS** | `docs/show-hn.md:49-56` and `:58-66` are the strongest writing in the project. "That is the number the whole thing exists for, and it is zero" is exactly the register. |
| **Sound like a person, not a platform** | **PASS** | `src/board.ts:978` "We read it too, as a research feed for what to build next at Minith Labs. It is not a separate audience." The launch post uses first person singular throughout. |
| **Named byline** | **N/A** | No byline field exists in the product or the post. The pre-merge checklist asks for one. `docs/show-hn.md` is a personal post in first person, so Show HN's account carries it. **If** a blog post or article is added, it needs a named byline. |
| **Varied sentence structure** | **PASS** | `docs/show-hn.md` moves between short statements and long explanatory sentences. `src/board.ts:114-119` is the exception (Finding 2). |

### On the em-dash rule specifically

It holds, and it holds in the places where it is hardest: `src/board.ts` has 114 lines of dense explanatory prose and not one em dash. The author consistently uses a full stop, a colon or a line break instead. `src/snippet.ts:13-23` and `:36-37` manage long instructional sentences without one. That is a genuine piece of craft and it should be protected.

**One near-miss to watch, not a violation:** `src/snippet.ts:37` uses "POSTing" and `src/board.ts:689` uses "one-call vote". Neither breaks a rule. `docs/show-hn.md:95` uses `*remove*` for emphasis, which is Markdown and renders correctly. `src/board.ts:115` contains a literal `.` followed by a template interpolation. No action.

---

## 2. Content craft findings

Against `brand/CONTENT.md`.

### Finding 1: The live `/about` page publishes a false number. BLOCKING.

`src/board.ts:983`, live at https://toolswanted.dev/about:

> "The sample is thin. A cluster needs three independent agents to appear publicly, and on 4 November 2026 the whole board held 20 independent agents across 4 distinct IP addresses, with 12 on the published entry."

Production today reports **0 clusters and 0 published entry**. The sentence says "with 12 on the published entry" and there is no published entry. It is also hardcoded in source rather than read from the database, so it will go stale again every time the board moves, which the board does minute to minute.

This is the single worst thing in the review. It is a dated figure that was true, is now false, and is baked into a template. The reader cannot check it because the page they are reading contradicts it.

### Finding 2: The board hero is one sentence of statistics with a caveat inside it. FAIL on craft.

`src/board.ts:114-119`:

```
<p class="lede">Choosing what to build next? These are the capabilities agents have got stuck on, ranked by how many independent agents asked for the same thing.</p>
<p>0 wishes from 0 agents, in 0 clusters. 0 shipped. 0 of those wishes were filed by our own agents...</p>
```

The lede is good: it opens with the builder's situation, not with the product. The paragraph under it is the problem, and the problem is structural, not a wording slip.

Today it renders as: **"0 wishes from 0 agents, in 0 clusters. 0 shipped."** That is four zeros in a row. `brand/CONTENT.md:24` wants one number that surprises the reader. Four zeros is not a number, it is an absence, and it tells a builder arriving to decide what to build that the board has nothing to offer them, which is true of the board but not of the product.

The four-clause seed caveat (`src/board.ts:116-118`) is a separate problem. It only renders when `stats.seededWishes > 0`. Today it renders as a single trailing clause, which reads fine. But the conditional means the sentence changes shape depending on the data, and the shape is chosen at runtime by a number nobody editorialises. That is how the copy ends up reading differently on the board, on `/weekly` and in a screenshot.

**The deeper issue:** the hero describes the board, which is the thing that is thin. It does not mention the registry check, which is the thing that works. See Finding 5.

### Finding 3: The launch post is over-indexed on mechanism, and its numbers are diffused. FAIL on craft.

Three separate questions here, and they have different answers.

**Is the security and sanitiser section a voice failure or a legitimate trust argument?**

Mostly a legitimate trust argument, and I want to be clear that I am not asking for it to be cut. The reasoning: Show HN is a forum of builders, and the single most common objection to a board that accepts unauthenticated text from arbitrary agents is "so you're going to execute whatever people post?" `docs/show-hn.md:85-97` answers that precisely, in concrete terms (regex, embeddings not a language model, the model pass can only remove information, output re-sanitised). That is the kind of answer that earns trust with exactly the audience the product wants.

But it is over-length in two specific ways:

- `docs/show-hn.md:91-97`, the "Nothing sensitive is stored" paragraph, is 7 lines and carries three separate mechanisms (regex stripping, the model pass, and the boundary sanitising). It reads as one argument with three implementations. **The argument is: a secret cannot reach storage, whichever of the three paths it takes.** That is one sentence and it is stronger than three.
- The "A few things I had to get right" frame (`docs/show-hn.md:83`) signals "here is a defensive appendix". A reader who trusts you by line 60 skims from there. The paragraph that decides whether a builder trusts the board is the one about what the counts mean (`docs/show-hn.md:99-104`), because that is the one that determines whether they can act on the number. It is currently last in the section.

**Does it have one surprising number, or are the numbers diffused?**

Diffused. `docs/show-hn.md` contains, at minimum:

| Line | Figure |
|---|---|
| 22 | 12 agents, 27 wishes |
| 43-44 | 55,288 servers |
| 52 | 60 seeded wishes |
| 59-60 | 20 agents, 4 IP addresses, 12 agents |
| 68-69 | zero claims |
| 80-81 | four working weather servers |
| 110 | 12 agents, 27 wishes |

Nine figures. `brand/CONTENT.md:24-26` asks for **one** number the reader did not expect, with a unit, a period and a comparison. The post has none that is *the* number, because all nine are given equal weight.

The number that should carry the post is **55,288**. It is the largest, it is the one a builder can independently check, and it is the one that makes the wedge obvious: there are 55,288 servers in the official registry and no signal about which of them agents need. Right now it appears once, at line 43, buried inside the second of two bolded features.

There is a second candidate that the post does not use well: **"twelve agents wanting to read UK planning PDFs"** at `docs/show-hn.md:73`. That is a beautifully specific, slightly absurd, human-scale number, and it is the exact moment where a builder can decide whether the board is real. It is buried in the middle of the ask.

**Does the title promise a top 20 the board cannot show?**

**No, and this is a specific piece of good work.** `docs/show-hn.md:3`:

> "Show HN: A public board where AI agents file the capability they are missing, so you can see what to build next."

It promises a board and a mechanism. It does not promise a count, a ranking size, or a leaderboard. The author's own note at `docs/show-hn.md:150` says "Do not promise a top 20 in the title. The board does not have one, and the title is the one thing every reader sees." That rule was written correctly and it was followed. **Keep this title.** No change.

The problem is that the title's promise is now unbacked for a different reason. "What to build next" is a promise about the board, and the board is empty. The registry check is what still backs it. See Finding 5.

### Finding 4: `SNIPPET_ASK_AGENT` is the wrong length for a chat window. FAIL on craft.

`src/snippet.ts:75`. Measured: **653 characters, 115 words, 7 sentences.**

The design notes (`agents/design-delight/NOTES.md:620`) specify what this snippet should be:

```
Check out https://toolswanted.dev and install it for future use.
```

Nine words. The notes state the design intent precisely at `:622-626`: "it is a request a person makes once, in a chat, to get a capability installed. It is a request, it says what the agent should DO rather than describing a protocol, and it is short enough to read in a chat window."

The shipped string is 7 sentences describing a protocol. It says what the board **is** ("It is a public board of the capabilities AI agents have got stuck on"), what the reply contains (three clauses), and how to configure identity (a clause about a header). None of that is needed to make the install happen.

It fails `brand/CONTENT.md:20-22` on "one specific next step" (it is a request, so it passes that) and on `brand/CONTENT.md:86` "Keep one idea per piece". It also fails the design line's own stated purpose, which is the harder failure.

**There is a real cost to cutting it, and it must be respected.** The stable id header clause is there deliberately (`src/snippet.ts:66-73` explains why: the MCP server identifies a caller by fingerprint, which splits one machine into several agents, and an agent reading a chat request will not go looking for the header on its own). That reasoning is sound. The fix is to keep the header instruction and cut everything else, not to cut the header.

### Finding 5: The site leads with the thing that is thin, not the thing that works. FAIL on positioning.

`agents/design-delight/NOTES.md:96-117` is the founder's decision and it is unambiguous:

> "The wedge is the registry check, not the board. The board is the claim. The registry check is the product that works today. [...] The product leads with the thing that works and keeps the board as the thing that is becoming valuable. The registry check is the reason to stay for two minutes."

**The landing page does not do this.** `src/board.ts:111-135`, the whole hero, is the board: a lede about the board, a stats paragraph about the board, three board links, and then a snippet whose purpose is to wire agents up to the board. The registry check is not mentioned anywhere on `/`.

I verified the registry check works today. A `POST /api/wish` for `"the current weather forecast for a city"` returned four working, already-published weather servers, the first with a 0.692 match score. That is the wedge, working, with no crowd, verifiable by anyone reading the post.

The `/build` page gets closer (`src/board.ts:791` mentions "an agent filing a wish still gets pointed at a tool that already covers the need") but it buries it in a notice about a feature that is switched off.

**Is the builder actually served?**

Partially, and not on the landing page. The builder's needs are:

| Need | Where it is served | Verdict |
|---|---|---|
| See whether agents want a capability | Board cards, `/weekly`, `/build` | Served structurally, empty of data today |
| Know how many independent agents want it | `src/board.ts:275`, `:441`, `:981` | Served and clearly explained. This is the strongest copy in the product. |
| Know whether the tool already exists | Nowhere on the landing page | **Not served** |
| Act on it today (claim it) | `src/board.ts:430-434` | Dead end, honestly labelled. `GET /auth/github` returns 503. |
| Find out how to get it in front of agents | `/agents`, `/build`, README badge | Served well |
| Know it is worth their weekend | Nothing | Not served |

The last row is the gap that matters, and it is the same gap `docs/show-hn.md:71-76` handles beautifully in prose. The site does not.

**The structural point:** `docs/launch.md:218-226` says the post should carry "a mechanism" rather than "a ranking" until the board has three published clusters. The site has the same problem and the same answer. The board cannot currently justify the landing page, so the landing page should carry the registry check and the board should be the thing you scroll to.

### Finding 6: `/build` tells the builder the truth, then gives them nothing to do. PARTIAL.

`src/board.ts:791` is exactly right and I want it said clearly: **this is the honest-dead-end rule working as designed.** The page says claiming is off before it collects a repository URL, which is what `agents/design-delight/NOTES.md:232-263` demands, and which the previous version got wrong. Nothing to fix here.

The gap is what comes next. `src/board.ts:818-823` gives three things to do, and all three are "read the board": read the board, check the weekly list, put the list in your README. With the board empty, that is three ways to look at nothing.

The one genuinely live action available to a builder today is the registry check: ask for a capability and find out whether a tool already covers it. That is the action `docs/show-hn.md:78-81` describes. It is not on `/build`.

### Finding 7: Two copy defects that are small and certain.

**The `/build` badge points at a deleted entry.** `src/board.ts:679-682` hardcodes the fallback slug:

```ts
const target = slug || "read-uk-council-planning-pdfs-as-structured-data";
```

That entry no longer exists. Verified: `GET /badge/read-uk-council-planning-pdfs-as-structured-data.svg` returns **404**, and `GET /api/cluster/read-uk-council-planning-pdfs-as-structured-data` returns 404. So `/build` renders, today, a copyable README badge that 404s. The comment directly above it (`:672-677`) says this exact class of defect is "the one thing the product asks a builder to publish." The fix has already been identified in the codebase and the hardcoded fallback reintroduces it.

**The RSS feed description has a grammar error.** `https://toolswanted.dev/feed.xml` renders "1 wishes from 1 agents." The pluralisation is applied to the count but not to the noun. That is agent-facing machine-readable output, so it matters.

---

## 3. The stale-number problem

This is the blocking section. Every figure below was true on 4 November 2026 and is false today.

### What production says now (5 November 2026, 19:51 UTC)

| Field | Value |
|---|---|
| `clusters` | 0 |
| `wishes` | 0 (1 after my probe wish, 1 agent, 1 pending) |
| `agents` | 0 (1 after my probe wish) |
| `seededWishes` | 0 |
| `shipped` | 0 |
| `pending` | 0 (1 after my probe wish) |
| Published entries | 0 |
| Registry mirror total | **not publicly verifiable**, `/api/servers` returns 403. The 55,288 figure cannot be confirmed from outside. |
| Registry check | **works**, verified: 4 working weather servers returned |

### Files and numbers that need updating

**`src/board.ts:983`** (live `/about` page)

| Currently says | Must become |
|---|---|
| "on 4 November 2026 the whole board held 20 independent agents across 4 distinct IP addresses, with 12 on the published entry" | No hardcoded numbers. Read `stats` from the database. |

**`docs/show-hn.md`** — every number in the post

| Line | Currently | Status |
|---|---|---|
| 22 | `12 agents want this, 27 wishes in total` | False. The entry does not exist. |
| 43-44 | `55,288 servers as of 4 November 2026` | Unverifiable publicly. Needs re-measurement against the mirror, or removal. |
| 52 | `Sixty of the wishes on the board were filed by my own agents` | False. 0 seeded wishes. |
| 58-60 | `20 independent agents across 4 distinct IP addresses`, `12 of those agents` | False. 0 agents, 0 published entries. |
| 68-69 | "I have not yet seen a builder claim an entry [...] and it is zero" | Still true. 0 claims. **Keep.** |
| 73 | `twelve agents wanting to read UK planning PDFs` | False. Needs rework. |
| 80-81 | `four working weather servers` | **Still true. Verified today.** Keep. |
| 109-112 | The pasted board entry, `12 agents · 27 wishes · seeded` | False. There is no published entry. |
| 114-116 | "One entry. It is the whole board" | False. There are zero entries. |

**`README.md`**

| Line | Currently | Status |
|---|---|---|
| 13-14 | `55,288 servers as of 4 November 2026` | Unverifiable publicly. Re-measure or re-date. |
| 88-90 | `20 independent agents across 4 distinct IP addresses`, `12 of those agents` | False. |
| 120-121 | `13 clusters and 60 agents`, `1 published entry and 14 independent agents` | Historical, and dated in context. **This one is fine**, it describes a past bug. Leave it. |
| 383 | `Wishes \| 111` | False. |
| 384 | `Seeded wishes \| 60` | False. |
| 385 | `Independent agents \| 20` | False. |
| 386 | `Distinct IP addresses behind them \| 4` | False. |
| 387 | `Published entries \| 1` | False. |
| 388 | `Entries in the review queue \| 27` | False. |
| 389 | `Claims \| 0` | **Still true.** Keep. |
| 390 | `Shipped \| 0` | **Still true.** Keep. |
| 391 | `MCP servers in the registry mirror \| 55,288` | Unverifiable publicly. |
| 393-394 | "The distinct-IP count of 4 against 20 agents" | False. The whole paragraph rests on a ratio that no longer exists. |
| 402-403 | "Every figure above was read on 4 November 2026" | True as a statement about the table, but the table is now wrong. |
| 505-507 | The README badge snippet, `read-uk-council-planning-pdfs-as-structured-data` | **404 today.** Points at a deleted entry. |

**`docs/launch.md`**

| Line | Currently | Status |
|---|---|---|
| 64-67 | "Sixty of the wishes on the board are seeded" | False. |
| 245-250 | The growth-loop diagram, `97 wishes filed`, `zero claims`, `zero shipped` | 97 is false. 0 claims and 0 shipped are still true. |
| 269-272 | `18 independent agents across 4 distinct IP addresses`, `10 of those agents from 4 addresses` | False. |
| 153-160 | The `/api/weekly` verification, `97 wishes, 15 agents, 60 seeded` | Historical, dated in context. **Leave it.** It documents a past fix. |
| 173-177 | The OG image "4 AGENTS vs 9" | Historical. **Leave it.** |

**Rule of thumb for the fix:** a number in a dated "as measured on X" table is allowed to be stale. A number in an undated present-tense sentence is not. The hardcoded sentence in `src/board.ts:983` is the only one that is both present-tense and undated, and it is live on the public site right now.

---

## 4. Rewrite instructions

Precise enough to act on without asking a question. **Nothing here is a rewrite. These are instructions for whoever rewrites.**

### A. `src/board.ts:983`, the `/about` page sample paragraph

Delete the hardcoded figures. Replace the second and third sentences of "What the counts mean" with a version that reads the current numbers from the database the same way `src/board.ts:115` does, and that names the date the numbers were measured rather than baking the date into the string.

Requirement: the sentence must be true when the board is empty and true when the board is full. Write it so that it degrades honestly. When there are zero published entries, the honest sentence is about the board being empty, not about a stale measurement from a previous day.

The distinct-IP disclosure from `agents/design-delight/NOTES.md:186-191` is the one number that still deserves a place on this page. It is not currently visible anywhere a reader can see. Add it when the count is obtainable.

### B. `src/board.ts:114-119`, the board hero

Two changes.

**B1. Replace the stats paragraph with a single sentence that carries one number.** Today it renders four zeros. Write it so that the zero state reads as an honest state and the populated state reads as evidence, without changing the template per state. If you want the board to carry the seed disclosure when there are seeded wishes, keep the conditional, but move the disclosure into its own `<p class="ticker">` so it never lands mid-paragraph in the stats sentence.

**B2. Add the registry check to the hero.** This is the finding with the most downstream value, because it fixes the positioning, the empty-board problem and the content-craft problem with one change. The product works today without a crowd, so the landing page should say so in the first screen.

Requirement from `brand/CONTENT.md:73` and `:93-94`: do not lead with it as a feature. Lead with the builder's moment, then let the registry check arrive as the answer to it. One sentence on what it does, one number. The number should be the size of the registry, re-measured, and dated, or cut.

Do not turn this into a menu. The hero currently offers three links (`/build`, `/agents`, `/weekly`) and a snippet. Keep the links, but the page needs to say what the thing is before it offers the ways in.

### C. `src/snippet.ts:75`, `SNIPPET_ASK_AGENT`

Cut from 653 characters to roughly 100. Keep the request form. Keep the stable id clause. Cut everything else.

The three things to cut, in priority order: the description of what the board is ("It is a public board of the capabilities AI agents have got stuck on"), the three-clause description of what the reply contains, and the restatement of "no account and no API key" if the surrounding page already says it.

The target shape is a request with a purpose and an identity instruction. Roughly:

```
Install the Tools Wanted MCP server at https://toolswanted.dev/mcp and keep it to hand for the rest of this conversation. When you hit a task you cannot finish because a capability is missing, call its wish() tool with one plain sentence naming that capability. Send the header x-tools-wanted-agent with a stable id of your own so the board counts this installation as one agent rather than several.
```

That is still over the design notes' nine words, and I accept that, because the header clause has to survive and the tool has to be named. But it is 2 sentences instead of 7, and every remaining word is doing a job. Do not cut the header clause to hit a character count.

### D. `docs/show-hn.md`

**D1. The title.** No change. `docs/show-hn.md:3` is correct and `docs/show-hn.md:150` is a rule worth keeping.

**D2. Re-measure every number on the day of posting**, from `GET /api/stats` and `GET /api/top`. The author's own instruction at `docs/show-hn.md:129-137` is correct and should be followed literally. Note the current state is 0 clusters, so section D5 applies.

**D3. Give the post one number.** The number to carry it is the registry size, re-measured and dated, because it is the one a builder can check independently and it makes the wedge obvious. The current placement at `docs/show-hn.md:43-44` is inside the second bolded feature and reads as one of two features rather than as the point of the thing.

Requirements: it must appear once, prominently, early. It must have a unit and a date. Every other number in the post should be visibly subordinate to it, or cut.

**D4. Compress the security section, do not cut it.** `docs/show-hn.md:91-97` becomes one argument and one sentence: a secret cannot reach storage, whichever path it takes, because the sanitiser runs before the write and again on the model's output. Keep the specifics that a reader would actually test (regex, embeddings rather than a language model, the model pass can only remove) but present them as evidence for one claim rather than as three claims.

Move the "The counts mean something" paragraph (`docs/show-hn.md:99-104`) to the front of that section. It is the paragraph that decides whether a builder can act on the number, and it is currently last.

**D5. Rewrite the section from `docs/show-hn.md:106` to `:123`, the board state.** With zero published entries, "Here is the board right now" followed by "One entry. It is the whole board" is false. Do not fill the gap with a wish you filed yourself to make the board look populated; the whole point of the seed labelling is that it is honest, and a self-filed entry shown as a ranking is exactly the thing the labelling exists to prevent.

The honest version names the empty state and points at the thing that does work. `docs/show-hn.md:78-81` already has this paragraph and it is the best writing in the post. **Promote it.** It should come before the board state, not after it.

**D6. Move the "part of the number I do not like" paragraph (`docs/show-hn.md:58-66`).** It is honest, it is the most distinctive paragraph in the post, and it is currently about a measurement that no longer exists. Recast it around the state that does exist: 0 clusters, 0 agents, 0 published entries, and the registry check that works anyway. The *shape* of the paragraph is right. "That is the number the whole thing exists for, and it is zero" at `:68-69` is the strongest sentence in the post and it is still true. Keep that sentence exactly.

### E. `README.md`

**E1.** Replace the table at `README.md:381-391` with a table read from the current database, dated, or delete it. A README table that says 111 wishes when the board says 0 is the first thing a technical reader checks and the first thing that loses them.

**E2.** Fix `README.md:88-90` and `:393-394`. Both rest on the 20-agents-against-4-addresses ratio, which no longer exists.

**E3.** Fix the badge snippet at `README.md:505-507`. It 404s.

**E4.** Leave `README.md:120-121` alone. It is a dated account of a fixed bug and it is correct in context.

### F. `src/board.ts:679-682`, the badge fallback

Do not fall back to a hardcoded slug. When there is no slug, render the weekly badge (`src/board.ts:666-668`) or render nothing. A badge that 404s is worse than no badge, and the comment at `:672-677` in this same file already explains why.

### G. `src/board.ts:430-434` and `:791`, the claim dead ends

Keep the honesty. Change the shape. Both places currently spend three sentences on an apology and then give the builder nothing but a board that is empty.

Add the one action that works today: ask for a capability and find out whether a tool already covers it. That is the same action the launch post describes. It takes one sentence and it gives the builder something to do on the page they landed on.

### H. `src/board.ts:935-941`, the wish form placeholders

These two placeholders are the only concrete examples of a wish anywhere in the product:

```
placeholder="Read UK council planning PDFs as structured data"
placeholder="What you were trying to do, and what stopped you"
```

They refer to the deleted entry. Change them to a capability that is current, or to a generic but still concrete example. A reader who copies the placeholder into the form files a wish about an entry that no longer exists.

---

## 5. Prioritised actions

### Blocking, before anything publishes

| # | Action | Where | Why |
|---|---|---|---|
| 1 | Remove the hardcoded `20 agents / 4 addresses / 12 on the published entry` from the live `/about` page and read the numbers from the database | `src/board.ts:983` | It is false and live right now. The only present-tense, undated, hardcoded figure on a public page. |
| 2 | Re-measure every figure and rewrite `docs/show-hn.md` | `docs/show-hn.md:22,43-44,52,58-60,73,109-112,114-116` | The post publishes eight false numbers. `brand/VOICE.md:95-101` says a number that cannot be verified does not appear. |
| 3 | Replace the `111 / 60 / 20 / 4 / 1 / 27` table and the two surrounding paragraphs | `README.md:13-14, 88-90, 383-391, 393-394` | A README is the first thing a builder reads and the first thing they check. |
| 4 | Fix the 404 badge | `src/board.ts:679-682`, `README.md:505-507` | The product's one ask of a builder. It 404s today. |
| 5 | Fix the `/build` placeholders that reference the deleted entry | `src/board.ts:811, 939, 941` | The only concrete examples of a wish in the product point at nothing. |

### High, ship-blocking on quality

| # | Action | Where | Why |
|---|---|---|---|
| 6 | Add the registry check to the board hero | `src/board.ts:111-135` | `agents/design-delight/NOTES.md:96-107` says the product leads with the thing that works. Today it leads with the thing that is empty. |
| 7 | Give the launch post one number, and promote the registry-check paragraph above the board state | `docs/show-hn.md:43-44, 78-81, 106-123` | Nine diffused numbers currently carry none. The strongest paragraph in the post is currently last. |
| 8 | Cut `SNIPPET_ASK_AGENT` to roughly 100 characters, keeping the request form and the header clause | `src/snippet.ts:75` | 653 characters in a chat window, against a design note that specifies nine words. |
| 9 | Rewrite the board hero stats paragraph so it reads as an honest state, not four zeros | `src/board.ts:114-119` | `brand/CONTENT.md:24` wants one number. Four zeros is an absence. |
| 10 | Give the builder one live action on `/build` | `src/board.ts:818-823` | Three ways to look at an empty board is not a next step. |

### Medium

| # | Action | Where | Why |
|---|---|---|---|
| 11 | Compress the security section to one argument, and move the counts paragraph to the front | `docs/show-hn.md:83-104` | Trust argument, not mechanism dump. |
| 12 | Fix the RSS description pluralisation | `src/rss.ts` | Agent-facing output says "1 wishes from 1 agents". |
| 13 | Add the distinct-IP count to the `/about` page | `src/board.ts:980-983` | `agents/design-delight/NOTES.md:186-191` calls it the one number that makes the seed stamp legible. It is not visible anywhere a reader can see. |
| 14 | Decide what happens to the one probe wish I filed | production | It is real and unseeded. It should stay. Flagging it so nobody assumes it is part of a launch seeding exercise. |

### Low

| # | Action | Where | Why |
|---|---|---|---|
| 15 | Add a named byline to the post and any future long-form piece | `docs/show-hn.md` | Pre-merge checklist. Show HN carries the account, but it should be explicit. |
| 16 | Confirm the registry mirror total from inside the deployment, since `/api/servers` is 403 | `README.md:391`, `docs/show-hn.md:43` | 55,288 cannot be checked from outside. If it cannot be confirmed, it does not go in the post. |

---

## 6. What passed, and should be protected

A review that only lists faults misrepresents the work. These are good and should not be touched in the rewrite:

- **The em-dash discipline.** 114 lines of dense prose in `src/board.ts` with not one em dash. Held under pressure.
- **The title.** `docs/show-hn.md:3` promises exactly what the board can show, and `docs/show-hn.md:150` wrote the rule down.
- **The "part of the number I do not like" paragraph.** `docs/show-hn.md:58-66`. It is the most distinctive paragraph in the project. Its honesty about the fingerprint splitting one machine into several agents is the thing no other board would say.
- **"That is the number the whole thing exists for, and it is zero."** `docs/show-hn.md:69`. Still true. Do not touch it.
- **The honest dead end.** `src/board.ts:791` and `:430-434` say claiming is off before collecting a repository URL. This is the rule from `agents/design-delight/NOTES.md:232-263` working exactly as specified. The previous version got this wrong and cost a review.
- **The seed labelling.** Everywhere it appears, the board says which wishes are ours and counts them separately. `src/board.ts:220-223`, `:446-449`, `:982`, `src/html.ts:831`. This is the board's integrity and it is intact.
- **The count explanations.** `src/board.ts:464`, `:735`, `:981` explain agents versus wishes better than most product documentation. A builder reading them cannot mistake one number for the other.
- **"Nothing is executed."** `src/board.ts:476`, `:751`, `:1017`. Short, specific, and true.
- **The British spelling, throughout, without exception.** Six files, one lapse risk, zero lapses.

---

## 7. Handoff

**Status: approved with changes.**

The voice discipline in this project is genuinely good. The em-dash rule holds under pressure, the banned phrases are absent, the British register is consistent, and the launch post contains two paragraphs I would put in front of any builder without changing a word.

The failure is not a voice failure. It is a **truthfulness failure**, and it is the one the brand layer cares about most: `brand/VOICE.md:95-101` says a figure that cannot be verified does not appear, and `brand/VOICE.md:66-73` says a piece must contain something that could only come from this brand. This project has that. What it also has, right now, is a public site and a launch post quoting a board that no longer exists, including one hardcoded sentence that is live on `/about` at this moment.

Actions 1 through 5 are the blocking set. Actions 6 through 10 are what turns a correct document into a good launch.

**Next step:** `gtm-owner` owns the copy decisions. The order of work is: fix the numbers first, because every other rewrite has to be written against the corrected figures and will otherwise have to be written twice. Then the positioning work, which is the substantive change.

**One dependency to flag:** the registry mirror total (55,288) cannot be verified from outside the deployment, because `/api/servers` returns 403 by design (`agents/design-delight/NOTES.md:150-158`). If that figure is going in the launch post as the post's headline number, it has to be confirmed by somebody with access to the database on the day of posting. It is the number the post would be built around, and it is the one figure a reader could otherwise check and find wrong.

**A note on the OG poster:** `npm run og:sync` is listed in `docs/launch.md:109` and `docs/show-hn.md:152`, but with zero published clusters there is no poster to sync, and `docs/show-hn.md:152-156` says the stale one "still carries an old count". That section needs re-reading against the current state; it describes a problem that may no longer exist in the same form.
