# Design review — Tools Wanted

**Reviewer:** Samira Wyatt, Design & Delight Lead
**Date:** 5 November 2026
**Subject:** the live product, seven public pages, both themes, 320/390/768/1280px, 100/150/200% zoom
**Base under test:** `http://127.0.0.1:9001` — `wrangler dev --remote` against the production D1
**Board state during review:** 0 published clusters, 1–2 pending wishes. The empty state was live, not hypothetical.

---

## Method, and its limits

This is a review of the rendered screen, read from a real browser, not a specification. The
findings below come from:

- `scripts/audit-browser.mjs` run against the live base: 7 pages × 4 widths × 2 themes × 3
  zooms = **168 page loads, 0 automated findings, 0 console errors.**
- Six purpose-built measurement scripts (in `.audit/_review-*.mjs`) that instrument the DOM:
  computed type sizes, rendered line counts, per-character rect measurement for mid-word
  breaks, foreground/background pairs resolved against *actual painted backdrops*, border
  contrast against the surface each border sits on, focus-ring behaviour under real Tab
  presses, and DOM-vs-visual order on the board card.
- A synthetic cluster card injected into the live board DOM, so the card hierarchy could be
  measured at every width while the real board is empty.
- Reading every screenshot in `.audit/`, plus the OG poster and the favicon fetched from the
  running server.

**What this review is not.** No person used this product. There are no task completion
rates, no time-on-task figures, no error rates, no confidence intervals, because there is no
sample. Everything below is **from reading the interface and from a scripted walkthrough**,
and it is labelled that way. Where I say a thing "costs the reader," I mean it cost the
rendered layout, measured.

**One thing the automated audit could not see.** The audit returned zero findings on 168
page loads. Every one of the Critical and High findings below passed it. The automated
checks test for overflow, contrast on text, heading order, touch targets and the bar's
height token. They do not test whether a screen says one thing, whether a hierarchy
survives real content, or whether two paragraphs on the same page contradict each other.
Those are the failures that are actually in this product.

---

## Anti-patterns verdict

**It does not look AI-generated. It looks like a real product that has been argued about by
several people who each won one round.**

This is a specific kind of good, and it is worth saying precisely where the good is and
where the drag comes from.

The system underneath is genuinely disciplined: one grid decision, one baseline, one token
vocabulary, one iconless type system, a hand-rolled stylesheet in a template literal, and
a 44px touch-target rule applied at every width rather than only on a phone. Almost every
line of `src/html.ts` carries a comment explaining *what broke and why the fix is shaped the
way it is*. That is not what generated code looks like. That is what code looks like when
somebody has been burned and wrote down the scar so it would not happen again.

The neo-brutalist register is coherent and committed — 2px borders, 2px radius, 3px offset
shadow, Archivo Black at display sizes, hard edges. It is not "a brutalist theme applied
generically." The board card, the rank badge and the tally block share one shape language.

**The anti-pattern is not visual. It is argumentative.** The product's copy is written as
though it is in a deposition — every number defensible, every caveat stated in the same
breath as the claim it qualifies, and no sentence allowed to make a reader feel anything
that could not be sourced. That discipline has produced paragraphs like this, in the
hero of the homepage, above the board:

> 114 wishes from 21 agents, in 1 cluster. 0 shipped. 60 of those wishes were filed by our
> own agents to seed the board, and are marked seeded: they are counted as wishes, not as
> independent agents. The ranking is the 21 independent agents, not the 114 wishes.

That is 258 characters and four clauses, and clauses three and four are a footnote to
clause one. It is the sound of a product defending itself to a reader who has not accused
it of anything. The screen is not arguing with a hostile reader. It is arguing with its
own author.

The second anti-pattern is the **tally block**, and this one *is* the AI-ish tell, because
it is the failure mode of "make the important number prominent": the number is promoted
until it outranks the thing it describes. On a phone the "13 AGENTS" slab is 44px tall,
full width, inverted, and carries **2.2× the ink** of the card title it belongs to. The
title it belongs to. A count with more visual authority than its own noun.

**Verdict: 6/10 for AI-generated feel.** Not because of a purple gradient or a glassmorphic
card. Because of the way the numbers have been promoted past the words, and the way every
sentence arrives pre-defended. Fix the voice and the hierarchy and this stops being a
foundry artefact.

---

## Findings by severity

### CRITICAL

---

#### C1. The board's empty state contradicts itself, in the same scroll

**Location:** `src/board.ts:115` (hero stats) vs `src/board.ts:171` (empty block)

**What the screen does.** The hero prints the live statistics. The body prints the empty
state. On the live site, at the moment of review:

```
hero says:    2 wishes from 2 agents, in 0 clusters. 0 shipped.
body says:    Nothing on the board yet under this filter. Claim a wish when one appears,
              or wire your agent up and file one yourself.
```

A reader scrolling the board sees a number and, thirty pixels later, a denial of that
number. Both are true — 2 wishes exist, 0 clusters are published, so the card list is
empty — and neither statement acknowledges the other. The reader has to work out, alone,
that "0 clusters" and "nothing on the board" are the same statement said twice, and that
the two wishes they are reading about are sitting in a pending queue somewhere.

**Why it matters.** This is the board's *front door* and the board is currently empty. The
empty state is not a hypothetical state for this product — it is the state a visitor sees
today. NOTES.md is explicit: *"The board's empty state is the state it is in for most
filters right now. That state has to look deliberate and say what to do, rather than look
like a failure."* Right now it looks like two pages rendered on top of each other.

There is a second, quieter defect in the same string: **"under this filter"** is a lie
when the filter is `All`. The reader chose no filter. The copy blames the reader's choice
for a board that has nothing on it. If the board is genuinely empty, the sentence should
say the board is young, not that the reader has filtered it wrong.

**The fix.** The hero statistics must branch on the same condition the card list branches
on. When `stats.clusters === 0`, the hero's stats paragraph must not print cluster counts
at all — it should print the invitation ("Nothing published yet. One agent asking for the
same thing twice is enough to start an entry.") and the empty block should drop "under this
filter". The two must be generated from one flag, not two independent queries. The
condition lives in `renderBoard`; make the hero and the card area read from it.

**The specific fix:** in `src/board.ts`, hoist `const boardIsEmpty = stats.clusters === 0`
before the content template. Use it to select the hero's stats paragraph, and change
`src/board.ts:171` to read `Nothing on the board yet.` (no "under this filter") when
`filter === "all"`, keeping the filter-scoped wording only when a filter is actually
applied.

---

#### C2. The install snippet is 653 characters, renders as 25 lines at 320px, and breaks 24 of them mid-word

**Location:** `src/snippet.ts:75` (`SNIPPET_ASK_AGENT`), `src/html.ts:619`
(`word-break:break-all`), `src/board.ts:128` (rendered in the hero)

**What the screen does.** Measured, at 320px, on the live page:

| | |
|---|---|
| Length | **653 characters, 115 words** |
| Rendered lines | **25** (in a 216px-wide column) |
| `word-break` | `break-all` |
| Lines that break mid-word | **24 of 25** |

The actual breaks, measured character by character:

```
ools Wanted MC | P server at http
ttps://toolswa | nted.dev/mcp, th
, then keep it | to hand for the
he rest of thi | s conversation.
n. It is a pub | lic board of the
the capabiliti | es AI agents hav
have got stuck | on. When you hit
hit a task you | cannot finish be
 because a cap | ability is missi
ssing, call it | s wish() tool wi
 with one plai | n sentence namin
ming that capa | bility. The repl
```

**Why it matters.** Two failures in one.

*Failure one, the content.* NOTES.md sets the bar for this exact snippet: it "is a request,
it says what the agent should do rather than describing a protocol, and **it is short
enough to read in a chat window**." 653 characters is not short enough to read in a chat
window. It is a paragraph and a half. The snippet's job is to be pasted into a chat; a
person pasting 653 characters into a chat is doing something nobody does.

*Failure two, the rendering.* `word-break:break-all` was added to `src/html.ts:619` to
stop the code running under the copy button — and it does stop that. But it also breaks
"MC/P", "toolswante/d.dev", "pub/lic", "capabiliti/es", "missi/ng", "plai/n". Those are
not code. They are prose rendered in a monospace face, broken mid-syllable, in the most
prominent box on the homepage. The URL — the one thing in the snippet a reader must
transcribe correctly — is broken at "toolswa|nted.dev".

**The fix.** Two changes, both required.

*Content:* cut `SNIPPET_ASK_AGENT` to the request only. The paragraph currently explains
what the board is, what the reply tells you, and what the header does. The header
explanation is a footnote to an instruction — and `src/snippet.ts`'s own header comment
says the explanation must come *before* the block it explains, not after. Move the header
clause to the front or drop it; the `/agents` page already carries the full protocol. A
target of **under 200 characters** is right: two sentences, one URL, one thing to do.

*Rendering:* `word-break:break-all` is the wrong tool. `overflow-wrap:anywhere` breaks a
word only when it cannot fit on a line by itself, which for prose means it rarely breaks
at all. Change `src/html.ts:619` from `word-break:break-all` to `overflow-wrap:anywhere`
(keeping `word-break:normal`), and drop `word-break:break-all` from any code path where
the content is prose.

---

#### C3. The tally block outranks the card title on every phone

**Location:** `src/html.ts:411-421` (`.tallybig`), `src/html.ts:460-478` (the ≤560px
override), `src/board.ts:275` (markup)

**What the screen does.** Measured on the live board with a synthetic card injected at
every width:

| | 320px | 390px | 768px | 1280px |
|---|---|---|---|---|
| Title font-size | 18px | 18px | 18px | 22px |
| Title box | 252×40 | 322×40 | 536×20 | 808×24 |
| Tally font-size | **28px** | **28px** | 33.8px | 40px |
| Tally box | 252×**44** | 322×**44** | 96×70 | 96×76 |
| Tally treatment | full-width slab | full-width slab | side block | side block |
| **Tally ink ÷ title ink** | **2.20** | **2.20** | 0.57 | 0.36 |

So on a phone the count carries **2.2 times the visual weight** of the capability it
counts, and the relationship *reverses* between mobile and desktop. The title is
ink-on-paper at 18px; the tally is paper-on-ink at 28px, full width, with the word
"AGENTS" set at 16px in bold underneath the number. It is a black bar with white text on
a cream card.

**Why it matters.** The DOM order is `rank → h2 → tally` (`src/board.ts:271-276`), so the
accessibility tree reads title-then-count. The visual order on a phone is count-then-title.
The card's subject — "Read UK council planning PDFs as structured data" — is the thing a
builder scans for and it is the *second* thing they see, at half the weight, in a face
that is not visually distinct from the count because both are Archivo Black.

NOTES.md says the tally "sits to the right of the title on a wide screen and becomes a
full-width strip below the title under 560px", and gives the reason for the block treatment:
"it fills that space with a shape the register already uses, and **the count becomes the
thing the eye lands on second** rather than a stray number." On desktop it does land
second. On a phone it lands first, and there is nothing in the same frame to compete with
it.

**The fix.** On a phone the count must stop being a block. Below 560px, `.tallybig` should
become an inline pair on the same row as the title, or a single line of meta under the
title — not an inverted full-width slab. The concrete change at `src/html.ts:464-472`:
remove `flex:1 1 100%` and `background:var(--ink);color:var(--paper)` from the ≤560px
override, drop the number to the same scale as the title (or below it), and let the block
treatment exist only in the desktop rule. If the count must stay a block, it must not be
inverted and it must not be larger than the title. One of those two.

---

### HIGH

---

#### H1. The nav says "For agents" is the current page when you are on the wish form

**Location:** `src/board.ts:961` (`nav: "/agents"`), `src/html.ts:772` (`/wish` **is** a
nav item), `src/html.ts:780` (the comparison)

**What the screen does.** `renderWishForm` passes `nav: "/agents"`. The nav function
compares `n.href === current`, so the `/agents` link gets `aria-current="page"` and the
`/wish` link — which exists at `src/html.ts:772` — does not. Measured on the live site:

```
nav aria-current on /        -> ["Board"]
nav aria-current on /weekly  -> ["Weekly"]
nav aria-current on /agents  -> ["For agents"]
nav aria-current on /build   -> ["Build one"]
nav aria-current on /wish    -> ["For agents"]     ← wrong: "File a wish" is a nav item
nav aria-current on /about   -> ["About"]
nav aria-current on /privacy -> []
```

The `/privacy` row is a separate, smaller finding: Privacy is in the footer nav
(`src/html.ts:834`) but not in the top nav, so `/privacy` lights up nothing at all. That is
arguably correct — it is a footer destination — but it should be a deliberate decision
rather than an accident of the `NAV` array.

**Why it matters.** The wish form is the loudest register in the product (NOTES.md: "One
call, and it should feel like a call"), it is the page an agent lands on, and the nav tells
the reader they are somewhere else. The "File a wish" link is **dead in the nav** — it is
never, on any page, marked as current. A nav item that can never light up is a nav item
that has been confused with another one.

**The fix.** `src/board.ts:961` should pass `nav: "/wish"`. One character. Separately,
`renderWishResult` (`src/board.ts:880` and `src/board.ts:920`) passes **no** `nav` at all,
so the post-filing success and error pages light up nothing — measured `[]`. They should
pass `nav: "/wish"` too, or `nav: "/agents"`, depending on whether you consider filing a
wish part of the "for agents" job.

---

#### H2. The OG poster says "The tools AI agents wish existed"

**Location:** the deployed PNG at `/og/default.png`; the current source is
`scripts/render-og.ts:72`, which says `"What agents got stuck on"`

**What the screen does.** The deployed poster's headline is **"The tools AI agents wish
existed"**. That is not English — "wish" is not the past tense of "wish". The current
script already fixed it to "What agents got stuck on". The poster has not been re-rendered.

Three further observations on the poster:

- The header bar reads **"TOOLS WANTED"** on the left and **"WANTED"** in red on the
  right. The word "WANTED" appears twice in one bar, once as part of the product name.
- The body's right-hand panel shows a **red dash** (`·`, `scripts/render-og.ts:169`) where
  a count would be, above the word "TOOLS". A red horizontal bar on a cream panel reads as
  a redaction, not as a zero.
- The poster's headline is set in a grotesque bold, not Archivo Black, despite
  `scripts/render-og.ts:103,131` asking for `fontFamily: "Archivo Black"` — the font is
  registered at `scripts/render-og.ts:41` but the *rendered* default poster is in Lato
  Bold. Either the deployed PNG predates the font registration or satori fell back.

**Why it matters.** The poster is the first thing a reader sees when the link is shared,
and it reaches further than the site. NOTES.md already names this class of defect: *"The
design line treats 'the poster is stale' as a defect, not as a housekeeping chore."* The
stale-check that exists (`x-og-stale`, `src/index.ts:741`) only catches a poster that is
*behind a count*. This poster has no count and is still wrong, so nothing catches it.
The header on the deployed poster also says `x-og-default: 0` for the default poster,
which means the staleness machinery does not even recognise it as the default.

**The fix.** Run `npm run og:sync` against production with the `ADMIN_TOKEN` — that is the
mechanical fix for the copy. But the mechanical fix does not catch the next one, so also:
(a) make `renderOg` treat `slug === "default"` as the default regardless of what is
stored, and set `x-og-default: 1` accordingly; (b) add a staleness check that compares
the poster's *stored copy*, not only its timestamp, so a poster rendered from an older
script version is caught; (c) fix the duplicated "WANTED" in the header bar and replace
the red `·` with something that reads as zero.

---

#### H3. The theme toggle script looks for an element that does not exist

**Location:** `src/html.ts:820`

**What the screen does.** The inline script in `<head>` does three things: reads
`tw-theme` from localStorage and applies it as `data-theme`; then looks up
`document.getElementById('themebtn')`; then, **if that element exists**, wires a click
handler that flips the theme. Measured on the live site:

```
themebtnExists: false
anyThemeBtn:    0
```

No element with that id exists anywhere in the codebase.

**Now the part that matters, and where the suspicion needs correcting.** The
`data-theme` CSS overrides at `src/html.ts:67-74` **are reachable**. Verified two ways:

1. Setting `localStorage.tw-theme = "dark"` on a light-scheme browser and reloading
   produces `data-theme="dark"` and `background: rgb(16, 14, 13)`.
2. Forcing `data-theme="light"` on a dark-scheme browser produces `background:
   rgb(243, 238, 225)`.

So the CSS is fine and the mechanism works. **What is dead is the button** — the script's
second half is unreachable code, and the first half applies a preference the reader cannot
see, cannot change, and did not ask for. NOTES.md already knows this: *"There is no
dark-mode toggle in the CSS. Dark mode follows `prefers-color-scheme`; the `data-theme`
overrides exist for the button that is not wired up yet."*

**Why it matters.** Two ways.

*The code.* `document.getElementById('themebtn')` returning `null` and the `if (b)` guard
is fine, but the whole `onclick` block is dead code shipped to every visitor on every
page. NOTES.md's own standard is "A class in the stylesheet that nothing uses is a rule
somebody has to read and maintain for no page" — the same rule applies to a script.

*The behaviour, which is worse.* A reader who once set `tw-theme` in localStorage — by
pasting a snippet from a chat, or with a console, or from a previous deploy that did have
the button — is now permanently pinned to a theme that ignores their system preference,
with no way to get it back except devtools. The site silently stops following
`prefers-color-scheme` for that reader and gives them no indication that it has.

**The fix.** Either build the button (and then the `data-theme` overrides earn their
place), or delete the dead half of the script and keep only the localStorage read. But
do **not** keep the current state: a script that reads a preference and applies it
unilaterally, with no affordance to change or clear it. If the read stays, the button has
to come with it.

---

#### H4. The hero's statistics paragraph is four clauses of caveat where a reader decides whether to keep reading

**Location:** `src/board.ts:115-119`

**What the screen does.** The paragraph below the lede, with the board in its populated
state (114 wishes / 21 agents / 1 cluster / 60 seeded — the numbers from the pre-reset
board), is 258 characters across four clauses:

```
[0] 114 wishes from 21 agents, in 1 cluster
[1] 0 shipped
[2] 60 of those wishes were filed by our own agents to seed the board, and are marked
    seeded: they are counted as wishes, not as independent agents          ← 145 chars
[3] The ranking is the 21 independent agents, not the 114 wishes.
```

Clause 3 is **145 characters, 56% of the paragraph**, and every word of it is caveat.
Clause 4 restates clause 1. A reader arriving at the board has to get through 200
characters of methodology before they reach the first thing they can act on.

**Why it matters.** The founder's own decision (NOTES.md) is that the registry check leads
and the board is the story. The board's *first job* is to let a builder see what agents
want. The stats paragraph is in the position where that job is done, and it is spending
56% of itself on the board's own methodology.

There is a worse reading of this. Clause 3 exists because the board's number can be
mistaken for demand. But the fix for a number being mistaken is not a paragraph —
NOTES.md says it twice: *"The card's missing address count is the single most useful thing
the design line can add next."* A distinct-IP count next to the agent count fixes the
problem structurally. A 145-character explanation of what the count is not fixes it
rhetorically, every time, on every page load.

**The fix.** Cut clause 3 to the shortest form that still labels the seeded wishes, and
move the full explanation to where a reader actually meets it — the About page already has
it, and NOTES.md rule 3 requires the label on the card, the footer, the hero and the
About page, but not the *explanation* in all four: *"The explanation belongs in all four,
and the full explanation belongs in one."* The hero needs the label, not the explanation.

Concretely: the hero's stats paragraph should read the count and the label —
"114 wishes from 21 agents. 60 are ours, marked seeded." — and the explanation belongs on
`/about`, where it already is. If the seeded caveat must stay in the hero, it should be
a `title` attribute or a short link, not 145 characters of running text. See also C1: this
paragraph has to branch for the empty board anyway, and that rewrite is the natural place
to fix it.

---

### MEDIUM

---

#### M1. The lede is 19px on six pages and 20px on two

**Location:** `src/board.ts:440` (cluster, 20px), `src/html.ts:328` (`.hero .lede`, 20px),
`src/board.ts:573, 689, 782, 932, 971, 1004` (19px, inline styles)

**What the screen does.** Measured live:

| Path | Lede size | Where it comes from |
|---|---|---|
| `/` | **20px** | `.hero .lede` rule, `src/html.ts:328` |
| `/weekly` | **19px** | inline `style="font-size:19px"` |
| `/agents` | **19px** | inline |
| `/build` | **19px** | inline |
| `/wish` | **19px** | inline |
| `/about` | **19px** | inline |
| `/privacy` | **19px** | inline |
| `/w/<slug>` | **20px** | inline, `src/board.ts:440` |

The suspicion as stated was inverted — the cluster page and the board are the 20px pair,
and six pages are the 19px pair — but the defect is real and the drift is worse than a
two-page discrepancy, because **six of the eight ledes are hard-coded inline styles**.

**Why it matters.** Two reasons.

One: a 1px difference in the largest paragraph on a page is a 5% difference in the size of
the thing the reader reads first. It is exactly the kind of drift NOTES.md's debt sweep
exists to catch, and it is invisible in a screenshot comparison but not to a reader moving
between pages.

Two, and worse: the 19px lede is set by **inline style on six separate pages**, and the
20px lede on the cluster page is *also* inline. So the one rule that exists — `.hero .lede`
at `src/html.ts:328` — covers exactly one page, and every other lede in the product
overrides the stylesheet from the markup. When the design line changes the lede size, it
changes one page and misses seven.

**The fix.** Delete all six inline `style="font-size:19px;color:var(--ink)"` attributes.
Promote `.lede` to a real class rule at the top of the generic page styles —
`.page .lede{font-size:19px;color:var(--ink)}` — and let the hero's `.hero .lede` set
20px, or unify on one size. One decision, one place. Then change `src/board.ts:440` to
drop its inline style so the cluster page reads from the same rule as the other seven.

---

#### M2. The dark-mode `--chip` surface is 2.98:1 against `--line`, below the 3:1 boundary requirement

**Location:** `src/html.ts:63` and `src/html.ts:73` (`--chip:#241f1c`), `src/html.ts:506`
(the dark `pre` panel), `src/html.ts:435` (`.samples`)

**What the screen does.** NOTES.md's accessibility standard says: *"The dark-mode border
colour is `#726859` specifically because it clears 3:1 against both dark surfaces."*
There are **three** dark surfaces, not two: `--paper` (#100e0d), `--paper-2` (#1a1715)
and `--chip` (#241f1c). Measured against each actual painted backdrop:

| Border | Backdrop | Ratio | Need | |
|---|---|---|---|---|
| `--line` on `--paper` | #100e0d | 3.52 | 3 | pass |
| `--line` on `--paper-2` | #1a1715 | 3.26 | 3 | pass |
| **`--line` on `--chip`** | **#241f1c** | **2.98** | **3** | **FAIL** |

Two elements are affected, and both are real UI boundaries, not decorative: the `pre`
panel's 2px border (`src/html.ts:506`) and the `.samples` panel's 1px border
(`src/html.ts:435`). Both are the only thing separating a code block or a quote from the
card behind it.

**Why it matters.** It misses by 0.02, which is how it survived every review — including
the automated one, because `scripts/audit-browser.mjs` checks *text* contrast
(`scripts/audit-browser.mjs:176`) and never checks a border against its surface. The
NOTES.md claim that #726859 "clears 3:1 against both dark surfaces" is a **drifted
statement** as well as a missed pair: the standard says two surfaces and the product has
three.

Separately, on separation rather than contrast: `--chip` sits at 1.18:1 against `--paper`
and 1.09:1 against `--paper-2`. The suspicion that `#241f1c` on `#100e0d` is "very low
separation" is **confirmed** — a 10% luminance step is at the edge of what a display can
resolve, and the `.samples` panel is a quote box a reader is meant to scan as a distinct
region. It reads as the card's background continuing.

**The fix.** Two changes.

(a) Move `--chip` in dark mode from `#241f1c` to a value that clears 3:1 against
`--line`. Working backwards from `--line` #726859, a `--chip` of **#2b2521** or lighter
clears it. `#2b2521` on `#726859` is 3.09:1, and it also raises the chip-to-paper
separation from 1.18 to about 1.22. Note the `pre` panel at `src/html.ts:506` uses a
hard-coded `#241f1c` rather than the token — that hard-code must move to the token too,
or the two will drift apart again.

(b) Add a border-contrast check to `scripts/audit-browser.mjs`: for every element with a
border of 1px or more, resolve the nearest opaque backdrop *including the element's own
background* and assert ≥3:1. The current audit would not have caught this and would not
catch the next one.

---

#### M3. The `/agents` table's only column that carries meaning is entirely off-screen

**Location:** `src/board.ts:736-743` (the tools table), `src/html.ts:518` (`.tablewrap`)

**What the screen does.** At 390px the tools table measures:

```
container   358px
table       657px
overflow    299px
columns     ["Tool", "What it does"]
last column 329px
```

The "What it does" column is 329px of a 358px container. It is entirely off-screen on
arrival. The reader sees "TOOL" and a column of function signatures, and has to
discover by horizontal scroll — a gesture with no affordance, on a table whose first
column is sticky — that there is a second column explaining what each tool does.

**Why it matters.** This is the page an agent-human reads to decide what to install. The
tool signatures are the least useful half; "Files a wish, and tells you what the board
knows" is the half that answers "what do I want this for". The screen shows the answer
second and off-screen.

**Why it passes the automated audit:** the table *does* scroll rather than overflow the
document, which is exactly what NOTES.md requires and exactly what the audit tests. The
defect is not overflow. It is that the content that matters is not the content that is
visible.

**The fix.** The table has two columns and one row per tool. At 390px it should stack:
the tool name as a row header and the description beneath it, or the description should
move out of the table into a definition list. A two-column table is the wrong shape for a
358px screen. If the table stays, the second column needs to be visible on arrival — a
stacked card layout per tool, or the description on its own line under the signature.

---

#### M4. The weekly page's table renders with headers and no rows

**Location:** `src/board.ts:590` (`<tr><td colspan="5">No wishes yet.</td></tr>`),
`src/board.ts:587-592` (the table), `src/html.ts:521` (`th` styling)

**What the screen does.** With no published clusters, the weekly page renders a table
with a full header row (`# CAPABILITY AGENTS THIS WEEK STATUS`) and a single body row
saying "No wishes yet." At 320px the header is cut mid-word — the screenshot shows
`# CAPABILITY AGENTS THIS` with "WEEK" off-screen.

**Why it matters.** AGENTS.md asks the question directly: *"Can the person tell what is
here and what is not? A page that shows one row of data should not look like a full
table."* This is a page showing zero rows of data, rendered as a five-column table. The
headers carry the structure of a ranking that does not exist. It reads as a broken
report, not as a young board.

And the same contradiction as C1 appears here in a different shape: the table says "No
wishes yet" while the prose three paragraphs below says "2 wishes from 2 agents across 0
clusters."

**The fix.** When `rows.length === 0`, do not render the table at all. Render the same
`.empty` treatment the board uses, with a link to the board and the weekly archive. The
table only appears when there is something to rank. Same for the "No samples yet" row at
`src/board.ts:456` on the cluster page.

---

### LOW

---

#### L1. The weekly page says "updates as wishes come in" twice, in consecutive paragraphs

**Location:** `src/board.ts:573` (lede) and `src/board.ts:583`

**What the screen does.**

```
[0] Choosing what to build next? These are the capabilities agents have asked for most,
    with the number of independent agents behind each one. Updated as wishes come in.
[1] This page updates as wishes come in, and the badge updates with it.
```

The lede ends with "Updated as wishes come in." The very next paragraph opens with "This
page updates as wishes come in." Two sentences, adjacent, saying the same thing.

**Why it matters.** It is the loudest repetition on the product and it is on the page
where a builder is deciding what to build. It reads as two people editing the same
paragraph.

**The fix.** Delete the sentence from the lede at `src/board.ts:573` and let the
paragraph at `src/board.ts:583` carry it — it is the one that says *what* updates
(the badge), which is the useful half.

---

#### L2. The OG poster's header bar says "WANTED" twice

**Location:** `scripts/render-og.ts:106-107`

**What the screen does.** The bar renders "TOOLS WANTED" on the left and "WANTED" in red
on the right. The product name already contains the word.

**The fix.** Change the right-hand item to something that carries information — the
week id, or "a public board of wanted tools" — or remove it and let the left item sit
alone. See H2 for the wider poster problem.

---

#### L3. The favicon is a red "W" in Helvetica Bold on near-black, not the brand mark

**Location:** `src/index.ts` (the `/favicon.svg` route)

**What the screen does.** The favicon is
`<text font-family="Helvetica,Arial,sans-serif" font-weight="900" font-size="38" fill="#d32a1c">W</text>`
on a `#151210` square. Rendered, it is a plain red W in a system grotesque. The site's
display face is Archivo Black, and the brand's own mark is the split wordmark "TOOLS
**WANTED**" with the second half in red.

**Why it matters.** The favicon is the only part of the brand a reader sees in a browser
tab, and it is the one piece that does not use the brand's type. The wordmark treatment —
"Tools" in ink, "Wanted" in red — is the product's signature; a single red W is not.

It also fails the "logo is 19px, not 18px" reasoning that NOTES.md applies to the
wordmark: at 16px favicon size the red W on near-black is 4.40:1 in the light-mode
colourway, and there is no light/dark favicon variant, so a browser on a light tab strip
and a browser on a dark one show the same dark tile.

**The fix.** Draw the favicon in Archivo Black (`assets/fonts/ArchivoBlack-Regular.ttf`
is already in the repo) and use the brand's split treatment — the red "W" from "Wanted"
against the ink "T" from "Tools", or the full stacked mark. Ship a light and a dark
variant (`<link rel="icon" media="(prefers-color-scheme: dark)">`).

---

#### L4. `.cluster h2` asks for a font weight the face does not have

**Location:** `src/html.ts:399` (`font-weight:600`), `src/html.ts:56` (Archivo Black
declared at weight 400 only)

**What the screen does.** `.cluster h2` sets `font-weight:600` on a face that ships one
weight. Measured: the rendered width of "Read UK council planning PDFs" at weight 400,
600 and 700 is **378.39px in all three cases** — the browser does not synthesise a bold
for this face, so the declaration is a no-op.

**Why it matters.** Not a rendering defect — the title renders correctly. It matters
because it is misleading to the next person: the code says the title is 600 and the
tally is 400, which reads as "the title is heavier". They are the same weight in the
same face. That is *why* C3 is a problem: the two things on the card are typographically
identical except for size, and on a phone size is the only difference, and the size is
the wrong way round.

**The fix.** Remove `font-weight:600` from `src/html.ts:399` so the stylesheet stops
claiming a weight that does not exist. If the title is meant to be heavier than the
count, that is a size problem, not a weight problem, and it is C3.

---

#### L5. `/privacy` lights up no nav item

**Location:** `src/html.ts:767-774` (the `NAV` array), `src/board.ts:1031`
(`nav: "/privacy"`)

**What the screen does.** Privacy is reachable from the footer nav but is not in the top
nav, so `nav: "/privacy"` matches nothing and the top bar shows no current page.

**Why it matters.** Minor, and arguably correct — a footer destination need not be in the
top nav. But it means the `nav` field on the privacy page is a lie, and the mechanism
that makes it a lie is the same one that makes H1 a lie. One of the two should change.

**The fix.** Either accept that the top nav is the primary set and drop `nav: "/privacy"`
from `src/board.ts:1031`, or give the privacy page its own current-state treatment.

---

## Systemic patterns

Four patterns run underneath the individual findings. Fixing them fixes more than the
findings do.

### 1. The inline style is the design system's second, undocumented API

Six of eight ledes set their own font-size from the markup. The `max-width:420px` on
three `/build` form fields (`src/board.ts:811, 813, 815`), the `font-size:17px` on two
`/wish` form fields (`src/board.ts:939, 941`), and `style="margin-top:0"` on three
cluster-page `<h2>`s (`src/board.ts:453, 463, 471`) are the same habit.

The rule in NOTES.md — "A class in the stylesheet that nothing uses is a rule somebody has
to read and maintain for no page" — is enforced by `tests/dead-css.test.ts` in one
direction only. Nothing checks the other: that a value expressed in the markup should be
in the stylesheet. Result: the stylesheet is not the single place a decision lives, so a
change to the lede size, the form field size or the field width is made in seven places
and lands in one.

**The systemic fix:** a lint rule that fails the build on `style="` attributes in
`src/board.ts`, with an explicit allowlist for genuinely one-off values. The codebase
already has the test infrastructure for the mirror-image check.

### 2. Two independent queries answer the same question

The hero stats and the card list are rendered from separate reads and do not know about
each other. `stats.clusters` comes from `getStats`; the card list comes from
`listClusters`. Both are correct and they disagree about what the board looks like.

This is the root of C1 and M4. It is also the shape of the defect NOTES.md already
catalogued: *"A count on this board is the whole truth"* was violated by the weekly
count, which was "kept as a running counter that was never reset". The same class of bug
— two sources of truth for one number — has now appeared in the *presentation* layer
rather than the data layer.

**The systemic fix:** one function decides what state the board is in — populated,
empty, or filtered-empty — and both the hero and the card area render from it.

### 3. The automated audit tests the properties that are easy to test, and the failures are in the properties it does not test

168 page loads produced zero findings. Every Critical and High finding in this report
passed it. What the audit checks: overflow, text contrast, heading order, touch targets,
the bar-height token, copy-button overlap. What it does not check: **whether two
elements on one screen contradict each other; whether a hierarchy survives real content;
whether a count outranks its own noun; whether a sentence is repeated; whether a
paragraph is 56% caveat.** Those are the failures that are actually in this product.

**The systemic fix:** add three assertions to `scripts/audit-browser.mjs`:
(a) *no two visible text blocks on a page assert conflicting numbers about the same
thing* — at minimum, that the hero's cluster count and the board body's emptiness state
agree; (b) *no rendered element's ink area exceeds that of its own parent heading* —
catches the tally inversion; (c) *border contrast against the nearest opaque backdrop,
including the element's own background* — catches M2.

### 4. The design system's rules live in NOTES.md, and the stylesheet does not implement them

NOTES.md says things the code does not do, and the difference is invisible until someone
reads both. Three instances found in this review:

- *"The dark-mode border colour is `#726859` specifically because it clears 3:1 against
  both dark surfaces."* There are three dark surfaces. It clears two of them (M2).
- *"The nav needs 776px of the bar to sit beside the wordmark"* — the container query
  threshold at `src/html.ts:206` is `45.5em`, which at 17px is 773.5px. Close enough to
  be right; not a finding.
- *"`data-theme` overrides exist for the button that is not wired up yet"* — NOTES.md
  describes this as intentional. It is not fully honest: the *read* half of that script
  is live and unilateral, and a reader with a stale `tw-theme` in localStorage is pinned
  to a theme with no way out (H3).

**The systemic fix:** when a rule in NOTES.md describes the design system, the stylesheet
should be the thing that enforces it, and NOTES.md should describe what the stylesheet
does. A rule that lives only in prose is a rule that drifts.

---

## Positive findings worth keeping

These are not consolation prizes. Several are the best work in the codebase.

**1. The touch-target rule is applied at every width, and it holds.** NOTES.md records
that the 44px rule was once written inside the `max-width:760px` media query, so desktop
nav links were 34px. The fix moved it out. I measured every `a`, `button`, `select` and
`input` on `/`, `/wish`, `/build` and `/agents` at 320px: **zero controls under 44px.**
Nav links 44px, chips 44px, copy buttons 44px, form fields 48px, the select 44px.

**2. The copy button is a grid column, not a floated overlay.** `src/html.ts:608-620`
puts the code in column 1 and the button in column 2 of a grid, so a longer button label
widens the column instead of running under the code. The comment explains the history
(96px hard-coded reservation, 105px weekly button, URL disappearing underneath). It is
the right answer to the problem it was written for, and the audit's copy-overlap check
confirms it never fires.

**3. The focus rings are correct and were verified by pressing Tab.** The site adds a
3px red `solid` ring at 2px offset to form fields and copy buttons. Links and buttons
fall through to the browser's default focus ring, which is visible and correct. Every
element I tabbed to on `/wish` and `/` reported `matches(":focus-visible") === true`.

**4. The tables scroll instead of overflowing the document.** Both dense tables
(`/weekly` and `/agents`) sit in a `.tablewrap` with `overflow-x:auto`, and the sticky
first column at `src/html.ts:529` keeps the key visible while the rest scrolls. The
document's `scrollWidth` never exceeds `clientWidth` at any width, in either theme, at
any zoom. This is the single most-often-broken thing on the web and it is right here.

**5. The nav is a container query in `em`, and it is zoom-invariant.** `src/html.ts:206`
moves the nav to its own row on a threshold of 45.5em of the container's font size, not
on a viewport media query. The reasoning is in the comment and it is correct: the wordmark
takes 162px of the bar whatever the window is, so the width the nav has left is not the
width of the window. The audit's `bar-too-tall` and `nav-hole` checks found nothing at
any width, theme or zoom — including at 200% zoom, where the bar was previously
double-height and the nav spilled out of it.

**6. The `--topbar-h` token is measured in CSS pixels with `offsetHeight`, not
`getBoundingClientRect`.** `src/html.ts:704` and the comment above it explain exactly
why: a rect is in device pixels and a custom property is in CSS pixels, so at 200% zoom
the token was twice the real height and the filter bar sat under the header. The script
only writes when the value is wrong, so it does not rewrite the document on every load.
The audit's `token-mismatch` check found zero mismatches across all 168 loads.

**7. The card's client breakdown says when it is cut.** `src/board.ts:206-213` takes the
first four clients and appends "+N more", with a `title` attribute explaining that these
are wishes and not agents. The comment records the reason: "It used to take the first
five and drop the rest silently, so a reader could not tell that 'Other 7 · Claude Code
5' was the whole story." A count that admits it is truncated.

**8. The seeded stamp is qualified where a reader meets it.** `src/board.ts:220-223`
puts the stamp in the meta row next to the counts it qualifies, and `src/board.ts:257`
prefers an unseeded sample for the quote — and if every sample in the window is seeded,
the quote itself carries the stamp rather than the meta row where a scanning reader will
not see it. That is a thoughtful piece of defence of the board's honesty, and it is the
right instinct. It is undermined in exactly one place: the hero paragraph (H4).

**9. The `pre` block has its own dark-mode colours.** `src/html.ts:505-507` overrides
the code block so it does not follow the ink/paper swap and become a bright slab on a
dark page, and `src/html.ts:513-514` beats the inline-code rule with `.page pre code`
so code inside a code block does not render as dark text on a dark panel. Both are
specific, both are commented, and both are the kind of bug that is invisible until you
look in dark mode.

**10. The heading structure is clean on every page.** Measured: exactly one `h1` per
page, no level skips, on all seven pages plus the cluster page. H1 → H2 throughout.

**11. The empty state on `/build` says what does not work before the reader commits.**
`src/board.ts:788-792` renders a notice that GitHub sign in is not configured, does not
render the form, and gives the reader the three things that do work. This is NOTES.md's
rule — "a button that goes nowhere is a design defect" — implemented exactly as written,
and it is the model the board's empty state (C1) should follow.

**12. The `/build` badge snippet points at a slug that exists.** `src/board.ts:679-682`
falls back to a known slug rather than emitting a URL to a 404. The comment records that
the old hard-coded slug had been shortened since, so the snippet pointed at a 404 and the
badge rendered "Wanted by 0 agents" — a lie with a 200 on it.

---

## Prioritised action list

Ordered by what changes the screen most, per unit of work.

| # | Action | Where | Severity |
|---|---|---|---|
| 1 | **Make the empty state agree with itself.** One `boardIsEmpty` flag drives the hero stats, the lede and the empty block. Drop "under this filter" when no filter is applied. | `src/board.ts:115, 114, 171` | C1 |
| 2 | **Cut the install snippet to under 200 characters** and stop it explaining the protocol. Move the header clause to the front or drop it. | `src/snippet.ts:75` | C2 |
| 3 | **Stop breaking prose mid-word.** `word-break:break-all` → `overflow-wrap:anywhere`. | `src/html.ts:619` | C2 |
| 4 | **Demote the tally on phones.** Below 560px it stops being an inverted full-width block and stops being larger than the title. | `src/html.ts:464-472` | C3 |
| 5 | **Fix the nav's current page.** `/wish` passes `nav: "/agents"`; it should pass `nav: "/wish"`. The wish result pages pass nothing. | `src/board.ts:961, 880, 920` | H1 |
| 6 | **Re-render the OG poster** and fix its copy, its duplicated "WANTED" and its red dash. Then make the staleness check compare copy, not only timestamps. | `scripts/render-og.ts:72, 106, 169` | H2 |
| 7 | **Cut the hero's caveat paragraph** to the count and the seeded label. The explanation stays on `/about`. | `src/board.ts:115-119` | H4 |
| 8 | **Decide the theme toggle.** Build the button, or delete the dead half of the script and the unilateral localStorage read with it. | `src/html.ts:820` | H3 |
| 9 | **Move `--chip` in dark mode** to a value that clears 3:1 against `--line` (#2b2521 or lighter), and replace the hard-coded `#241f1c` in the `pre` rule with the token. | `src/html.ts:63, 73, 506` | M2 |
| 10 | **Unify the lede.** Delete the six inline `style="font-size:19px"` attributes; promote `.lede` to a class rule; drop the cluster page's inline 20px. | `src/board.ts:440, 573, 689, 782, 932, 971, 1004` | M1 |
| 11 | **Don't render a table with no rows.** Use the `.empty` treatment when `rows.length === 0`, on `/weekly` and on the cluster page. | `src/board.ts:590, 456` | M4 |
| 12 | **Reshape the `/agents` tools table** so the description is visible on arrival at 390px — stack it, or move it out of the table. | `src/board.ts:736-743` | M3 |
| 13 | **Delete the repeated sentence** on `/weekly`. | `src/board.ts:573` | L1 |
| 14 | **Redraw the favicon** in Archivo Black with the brand's split treatment, in a light and a dark variant. | favicon route | L3 |
| 15 | **Add three assertions to the browser audit:** hero/empty-state agreement, no element outranking its own parent heading, and border contrast against the nearest opaque backdrop. | `scripts/audit-browser.mjs` | Systemic |
| 16 | **Lint out inline styles** from `src/board.ts`, with an allowlist. | `src/board.ts` | Systemic |
| 17 | **Fix the OG header's duplicated "WANTED".** | `scripts/render-og.ts:106-107` | L2 |
| 18 | **Remove the no-op `font-weight:600`** on `.cluster h2`. | `src/html.ts:399` | L4 |
| 19 | **Decide `/privacy`'s nav state** — either drop `nav: "/privacy"` or give it a current-state treatment. | `src/board.ts:1031` | L5 |

---

## What I did not fix

Nothing was changed. This is a review.

The measurement scripts I wrote are in `.audit/_review-*.mjs` and `.audit/_review-extract.mjs`,
alongside the existing audit artefacts. The `.audit/` screenshots in the repo were
regenerated by `scripts/audit-browser.mjs` during this review, which means they now show
the **live empty board** rather than the one-entry board the earlier screenshots showed.
That is an improvement to the record, not a loss — the empty state is now captured
instead of hypothetical.

`npm test` passes: 323 tests across 29 files, unchanged. `scripts/audit-browser.mjs`
reports zero findings on 168 page loads, unchanged. Both of those are true, and both are
also consistent with this report: the automated checks are working, and they are checking
the wrong things for the failures that are actually in this product.

---

*Samira Wyatt, Design & Delight Lead — Tools Wanted*
