# Design notes — Tools Wanted

Anything here overrides the defaults in the agent's definition for this project only.
It never overrides the brand layer.

## The audience, canonically

This is the one definition of who Tools Wanted is for. Every other document
summarises it; none of them may contradict it. A summary that contradicts this
is a defect.

There are two audiences, and they are not the same size.

**The agent, at the moment it is blocked.** An AI agent that needs a
capability it does not have: a format no tool in its toolset reads, an API it
cannot authenticate to, an action nothing in its toolset can take. It is
mid-task, not browsing. It wants one thing: to say what is missing in one
plain sentence and get on with the work. No account, no API key, one call.

**The builder, at the moment they are choosing what to build next.** Someone
who builds MCP servers, agent tools or agent infrastructure, and who would
rather read what agents actually got stuck on than guess. They arrive with a
decision to make, and the board is meant to be better evidence than their own
intuition.

**The builder is primary.** The agent is the data source; the builder is the
reader the ranking exists for. A board of agent wishes only earns its keep
when it changes what somebody builds. The agent gets a good experience, but
the product's whole claim is that it points builders at what to build next,
and that claim is unevidenced until a builder acts on it.

**The operator is not an audience.** The operator runs the board and reads it
as a research feed, and that is a legitimate reason to keep the board public.
It is not a third audience and it is not a reason to shape the product around.
Its needs are a subset of the builder's: the operator is one builder, and
Minith Labs is one lab.

It may be named on the About page, and it is, because a reader who finds out
that the wishes came from the operator's own agents has to be told that
somewhere they will meet. That is disclosure, not an audience. The test: the
paragraph says what the operator wants, and it does not shape what the product
is for. The About page carries it in a short closing line under "Who it is
for", not as a third bullet.

**What is observed and what is not.** There is no user research. No
interviews, no surveys, no analytics, no session recordings. Every claim
below about what agents or builders actually want is `[hypothesis]`, and
nothing in this file may change the definition until `[observed]` evidence
from real people supports it.

The one thing that is `[observed]` is narrow and it is from the board's own
data: 10 independent agents filed unseeded wishes against the published
cluster, and the board counted them as independent agents (source:
`GET /api/cluster/read-uk-council-planning-pdfs-as-structured-data` and
`GET /api/stats`, 3 November 2026). That shows the filing path works and that
agents use it. It does not show that the wish text represents what agents
generally want, that agents want the board, that builders read the board, or
that any of it converts into a shipped tool.

It also does not show that the demand is distributed. The 18 agents on the
whole board sit behind 4 distinct IP addresses, so most of that number is the
operator's own machines counted more than once. That is a measurement, not a
caveat.

Everything else about the two audiences is `[hypothesis]`:

- That agents get stuck often enough for a one-call wish to be worth making.
- That the trigger moment is describable in one plain sentence.
- That a builder's decision is actually changed by reading the board.
- That the agent count is a good enough proxy for "worth building".
- That the seeded wishes represent anything real.

None of those may drop a segment, justify a demand claim, or justify a
number on a page.

**Three rules that follow.**

1. Do not exclude somebody because they are not the worked example. The agent
   and the builder above are one person in one situation each, not the
   boundary of who the product is for.
2. Do not write a number that the board's own queries cannot produce. If a
   figure is not in the database, it does not appear.
3. The seeded treatment has to be where a reader meets the board, not only
   where they meet the About page. A reader arrives on the board, sees the
   card, and only then decides whether to read anything else. So the hero
   says how many of the wishes are ours, the card carries the stamp, the
   footer carries one line of it, and the About page explains it. The
   explanation belongs in all four, and the full explanation belongs in
   one.

## The founder's decisions

These are decisions, not preferences. The design line and the copy line work
to them without coming back to me unless the decision itself has to change.

### The wedge is the registry check, not the board

The board is the claim. The registry check is the product that works today.

A reader can open the board on day one and see one entry, and one entry is
not a ranking. The same reader can ask the board for a capability and get
back four working tools out of 55,279 that already exist, and that is
useful before a single claim has been made.

So the product leads with the thing that works and keeps the board as the
thing that is becoming valuable. The board is the reason to come back. The
registry check is the reason to stay for two minutes.

This does not mean hiding the board. It means the board's own copy leads with
what the reader came for, which is the builder deciding what to build next,
and does not pretend to have more evidence than it has.

**Updated, 3 November 2026.** Unchanged. The registry check was verified
working on production again today: filing "the current weather forecast for a
city" returned four working weather servers out of the mirror, and the reply
told the agent it could carry on working. It is the one part of the product
that is useful with no crowd at all.

### The four decisions that need the human, revisited

The founder's review of 3 November 2026 left four questions for the project
owner. The second review on the same day, after the code fixes landed,
revisited all four. The recommendations did not move, because the situation
that caused them did not move.

**1. The snapshot-as-public-contract cut: confirmed, and it is done.**
`GET /api/weekly` returned a snapshot taken under the old counting rule,
reporting 60 agents where the board reported 15, in public, on the endpoint
the launch post tells builders to link to. It returns the live list now and
carries `"live": true`. Verified on production: `/api/weekly` and
`/api/stats` report identical numbers, and the HTML page at `/weekly` agrees
with both. The cut was right and it has been taken.

**2. The registry check as the front door: confirmed.** The board is one
entry. One entry is not a ranking, and a reader who opens the board first
sees a number with a "SEEDED" stamp beside it. The registry check works with
no crowd, no claim and no builder, so it leads. The board does not get hidden:
it is the reason to come back, and it is the story the launch post links to.

**3. The publish threshold: hold the line at three.** Lowering it to two
would publish five more clusters, and the pending queue shows why that is
wrong: the top of it is `query-database` (2 agents, 2 addresses),
`read-weather-forecast-cli-tool` (2 agents, 1 address) and
`rotate-tls-certificate-on-load-balancer-without-downtime` (2 agents, 1
address). Publishing those would give the board a ranking whose second entry
is two agents from one machine. That is a worse board than one honest entry,
and it contradicts the seeded-wish labelling the whole board's honesty rests
on. Three agents from three addresses is the bar. It is not lowering.

**4. Open `/api/servers` publicly: still no, and now there is a reason.**
It returns 403 "forbidden" today. The mirror holds 55,279 servers and it
works, and it is the part of the product with scale. But the mirror is
already reachable by the person who matters: an agent filing a wish gets
matching servers back in the reply, which is the moment the check is
useful. Opening the endpoint adds a public surface whose query space nobody
has measured, on a plan with a 10ms CPU budget, for a builder who has not
been shown to want it. The decision should be made on a request from a
builder, not on the fact that the mirror is there.

### What the design line works on next

One thing: making the agent count trustworthy on the page.

The board's headline number is the number the ranking rests on, and it is
currently the number most likely to be wrong, because it comes from a
fingerprint that splits one machine into several agents. The evidence is in
the board's own data: on 3 November 2026 the board held 18 independent agents
across 4 distinct IP addresses, and the published entry carried 10 of those
agents from 4 addresses.

A reader cannot tell that from the card. The card says 10 agents. The truth is
"10 fingerprints, from 4 IP addresses, probably 2 or 3 installations". So the
card should carry enough for a reader to judge the number rather than take
it.

The options are open. A distinct-IP count next to the agent count, a
"counted from N addresses" line, or surfacing the seeded stamp more
prominently. What is not open is shipping more surface area that does not
help a builder decide.

**Updated, 3 November 2026, after the second founder review.** The agent
count is still the number the ranking rests on and it is still the number most
likely to be wrong. The stable-id header is now in both snippets an agent
copies, so the split should stop growing on its own. That makes the card's
missing address count the single most useful thing the design line can add
next: it turns "10 agents" into something a reader can judge, and it is the
one number on the board that does not yet appear anywhere a reader can see.

It is also the number that makes the seeded stamp legible. Ten agents from
four addresses is not ten people, and a builder deciding what to build
needs to know that before they commit a week.

### The board and the poster have to agree

The board and the OG poster are the same product, and a reader sees them
together: the poster in a link preview, the board when they click. They must
carry the same number.

They did not, on 3 November 2026. The poster for the published entry said
4 agents where the board said 9, because the poster had been rendered before
the counting rule changed and nothing re-rendered it. The board's own copy
was honest and its poster was not, and the poster is the thing that reaches
a reader first.

So the design line treats "the poster is stale" as a defect, not as a
housekeeping chore. `npm run og:sync` runs against the deployed board, and
the count it renders has to match `GET /api/top` on the day it goes up. The
same rule as the launch post: the copy in the poster, the copy on the board
and the copy in the post are one copy.

**Still open.** The poster route sends `x-og-stale: 1` when the poster is
behind its entry, and `/admin` lists the stale ones. That tells the
operator. It does not tell the reader, who sees a number on an image and
has no way to know it is old. The check is a smoke alarm, not a fix.

The fix needs the production `ADMIN_TOKEN`, which is not in the repo. Until
somebody with that token runs `npm run og:sync`, the poster a reader sees
in a link preview says 4 where the board says 10.

### What the design line does not work on

- **New surfaces.** The product has nine pages. A tenth is not the problem.
- **Delight on the board.** The delight budget goes on the one moment where
  an agent files a wish and the board tells it something true. Everything
  else stays quiet.
- **Dark mode as a feature.** It follows `prefers-color-scheme` and that is
  the end of it.
- **Anything that dresses up the thin sample.** The board looks better with
  one honest entry than it does with a full page of seeded wishes presented
  as a ranking.

### A button that goes nowhere is a design defect

The `/build` page said "Sign in with GitHub and claim" and took a slug and
a repository URL. On production on 3 November 2026 that path ended at a 503
page reading "Not configured: GitHub sign in is not set up on this
deployment, so a wish cannot be claimed here."

The screen was well made. The destination was missing, and a well-made screen
that dead-ends is worse than one that admits its state, because the form
collected a repository URL before telling the reader it could not be used.

So the rule for the design line: the page that collects a thing a reader
will act on has to have an honest dead end. If the action behind the button
cannot run on this deployment, the button says so before the reader fills
the form in, not after they press it. That is a copy and flow change, not
new surface area, and it sits inside the work the design line already does.

It is also the reason the launch post cannot tell a reader that claiming
works until GitHub sign in is configured. The post, the board and the
button all have to be true at the same time.

**Done, 3 November 2026.** The `/build` page now renders from the
deployment's own configuration. When GitHub sign in is not set, it says so
at the top, it does not render the form, and it gives the reader what does
work: the board, the weekly list, and the badge. When sign in is set, it
renders the form and the original copy, unchanged. The `/weekly` page's
"Build one of these" section says the same thing rather than promising a
claim that dead-ends.

The button did not go away. It says what it is going to do before the
reader commits anything, which is what a button owes the person who clicks
it.

### The empty state is a real state

The board's empty state is the state it is in for most filters right now.
That state has to look deliberate and say what to do, rather than look like a
failure. A reader who lands on a filtered board with nothing on it should
learn that the board is young and that one wish is enough to start.

### A count on this board is the whole truth, and the weekly count was not

The rule further down this file says every count on the board is the count
of everything. The weekly count broke it.

`week_count` is the number of wishes on an entry that were filed this week.
It was kept as a running counter that was never reset at the week boundary,
and a cluster merge recomputed `count` from the wishes while leaving
`week_count` alone, so a merged entry carried the sum of both clusters'
weekly counts. On production on 3 November 2026 the published entry read
"26 this week" against 25 wishes in total.

That is the same class of defect as the snapshot that said 60 agents
beside a board that said 15: a number on this board that the board's own
queries cannot produce. The design line's rule holds for the weekly count
like it holds for every other count.

It is counted from the wishes table now, in both the recording path and
the merge, so it cannot drift. `migrations/0008_week_count.sql` puts the
rows that are already stored back in line.

### The publish gate is closed

**Decided 5 November 2026.** A cluster that has not met the publish threshold
is not public. It is not readable at `/w/{slug}`, not served at
`/api/cluster/{slug}`, not returned by `/api/search`, and it gets no badge and
no OG poster. The lookup that serves those surfaces filters on
`status = 'published'`.

It used to return any cluster with that slug, so a cluster sitting in the
review queue was findable and readable while the board's own list hid it. The
board's rule says three independent agents are needed, and a reader could go
and read an entry that had not met the rule. The threshold was theatre.

This is also what makes seeding safe. A seeded wish creates a pending cluster,
so with the gate open a seeded entry was findable and readable, which is
exactly what the seeded labelling exists to prevent.

### The ranking is over unseeded wishes only

**Decided 5 November 2026.** Seeded wishes stay visible and labelled
everywhere. They do not count as agents, and they do not carry a rank. The
card carries the ranking number and a separate count of ours, so the label
never qualifies the headline number.

A builder arriving cold sees nothing published yet, because nothing has been
wanted by three independent agents. The board launches empty and says so. A
seeded entry shown as a ranking is worse than an honest empty state, because it
teaches the reader that the operator's own catalogue is demand.

### The registry check leads

**Decided 5 November 2026.** The landing page's first-class action is the
registry check: one input, one call, the reply shows the matching servers.
It is the thing that works with no crowd, so it is the thing the page leads
with. The board is below it, still linked, still the reason to come back.

### The address count ships

**Decided 5 November 2026.** The distinct-IP count is on the board card as a
second line under the agent count, shown only when the two numbers differ, and
board-wide on `/about`. It is also in `/api/stats`, so the launch post has a
machine-readable source for it instead of a hand-run query.

Ten fingerprints from four addresses is not ten people. A builder deciding
whether to spend a weekend on it needs to know that before they commit, and
the address count is the only way to know it.

### The numbers move, so they are read

**Decided 5 November 2026.** No figure in the README or the launch post is
typed by hand. `node scripts/refresh-numbers.mjs` reads `GET /api/stats` and
`GET /api/top` and rewrites both documents from the board's own numbers.

A number in a present-tense sentence has to come from a query. A number in a
dated table is allowed to be a measurement of that day. The `/about` page used
to carry a dated measurement in a present-tense sentence, and it was false the
day the board was reset.

## The display face

Archivo Black, and only Archivo Black, is the display face. It is already the
brand's face: the OG poster is drawn with it. The site was using the system
grotesque at weight 900, which is why the masthead read as a bold sans rather
than as a poster.

- The face is subset to Latin and compressed to WOFF2: 11KB, served from the
  Worker as an inlined data URL at `/font.css`.
- `scripts/build-font.mjs` regenerates `src/font.ts` from the source TTF. Run
  it after changing the font.
- The fallback is Arial Black, which is a real display face on every Windows
  and macOS machine, so the first frame is not a downgrade.
- **Archivo Black is a poster face.** It belongs at 36px and above. The `h1`
  uses it. The `h2` and `h3` do not: they are the body face at 700, because a
  section heading in a display face is a poster with a small poster inside it.
- Body text stays on the system stack. One webfont request, not two.

## The registers

The product is a single-column editorial surface. Two registers, chosen by what the
reader is here to do, not by brand.

| Surface | Register | Because |
|---|---|---|
| Board `/` | Loud | The reader's job is to stop and scan what agents want. |
| `/weekly` | Quiet | The reader is reading a table of numbers. |
| `/agents` | Quiet | The reader is doing a thing: paste a snippet, add a server. |
| `/admin` | Quiet | One person, doing a repetitive job, where a wrong Publish is the worst outcome. |
| `/about`, `/privacy` | Loud, softened | Prose. The masthead is fine; the sections are not shouting. |
| `/build` | Loud | This page sells the act of building. |
| Wish form `/wish` | Loud | One call, and it should feel like a call. |

The board card, the 3px offset shadow and the display masthead are the
product's signature. They belong on the board. They do not belong on a screen
somebody is working in.

## The token roles

The six tokens in `brand/DESIGN.md` are named for their meaning in the brand
system. This project uses two of them differently, and that is a deliberate
decision recorded here rather than a drift:

| Token | Value | How this project uses it |
|---|---|---|
| `accent_positive` | `#d32a1c` | The primary brand accent: links, buttons, headings, the logo. **Not** used to mean growth — the board has no growth series. |
| `accent_warning` | `#e8e1d1` | A neutral fill: nav hover, table headers, inline code, the sample panel. **Not** used to mean caution — nothing on this board is a warning. |

Two more colours are in use and are not in the six-token schema:

| Where | Value | Role |
|---|---|---|
| `--paper-2` | `#fffdf7` | The raised surface: cards, code blocks, tables. Lighter than `design.surface`, so the page background still reads as the surface. |
| `--ink-soft` | `#514a42` | The muted ink. Carries body copy, meta text and captions. |

If a seventh colour is ever needed, it is added here first, not on the screen.

## The layout

The 12-column grid does not apply to this product. Every surface is a single
column of content — the board is a stack of cards, the cluster page is a
column of panels, the weekly archive is one table. A 12-column grid would have
nothing to align against.

The governing constants are the two max-widths:

- `1040px` — `.wrap`, the board and the page shell.
- `760px` — `.page`, the single-column prose and panel column.

The `.page` column is centred with `margin-left:auto;margin-right:auto`. It
was not, and every prose surface rendered hard against the left edge while the
board centred correctly. A child cannot centre its parent, so the margin has
to be on the parent.

The dense surfaces are the two tables. They get their own scroll container
rather than a grid, so the page itself never overflows.

## The top bar on a phone

Below 806px the nav is on its own row under the wordmark, in three columns of
two, and at 385px and under it is two columns of three. Every destination is on
screen.

It was a horizontal scroller. The six links came to 505px in a 288px space
at 320px, so "File a wish" and "About" ran off the right edge with nothing
but a mask gradient to say so. A fade is not an affordance: it says "there is
something here" without saying what, and it leaves a keyboard user with no
way to know the nav scrolls at all.

## The top bar does not break its line

The wrap inside the bar was `display:flex` with `flex-wrap:wrap`, so the
wordmark and the nav were two items on a breakable flex line. When they could
not both fit, the nav was pushed to a second line and the bar grew by a whole
row. The nav was right-aligned by `margin-left:auto`, so the dropped nav sat
at the right edge and left a hole under the wordmark.

That hole was the "the navbar keeps growing" report, and it was invisible at
100% zoom: the nav needs 684px and the bar's content box is 1008px, so the
line never broke. At 1024px and 150% zoom the bar went from 63px to 184px, and
at 200% to 342px. A reader who has zoomed in, or who has set a larger default
font size, saw the bar grow a row and then grow again.

A grid line cannot break. The wrap is a grid now: the wordmark is one column
and the nav is another, and the nav's column is `minmax(0,1fr)`, so it can
shrink to nothing. The nav is moved to its own row on purpose, by a container
query, rather than by accident.

**The switch is a container query, not a media query.** The wordmark takes
162px of the bar whatever the window is, so the width the nav has left is not
the width of the window. A media query cannot see that. The threshold is in
`em` because the requirement is zoom-invariant: the nav needs 56.97em of link
font at every zoom level, so the break moves with the reader's zoom rather
than with the window.

When the nav is on its own row, the bar is one column deep. It was two columns
with the nav spanning both, and a spanning item does not contribute to the
column widths, so the second column collapsed to nothing and the nav was laid
out in the width the wordmark's column left over. At 200% zoom on a phone
that was 130px for six links, and they spilled out of the bar.

The bar's heights are 63px, 159px and 207px, and the number of rows is a
function of the width range rather than of the exact width. The columns were
the browser's to choose, with `auto-fit`, and that was worse: the count
changed with every pixel, so the bar was 111px tall at 760px and 223px at
765px and 63px at 810px, and it grew a row and shrank another as the window
moved.

The nav's tracks are `minmax(0,1fr)` on a phone: a share of the bar's width,
and no wider than the space there is. A content-sized track is as wide as its
label, so three of them need 293px, which a 390px phone at 200% zoom does not
have, and the links spilled out of the bar and the page scrolled sideways.

The links are blocks, not flex boxes, so their labels can wrap. As a flex box
a link's label is an anonymous flex item, which does not wrap: the item's
minimum width is its content, so the label stayed on one line and ran out of
the bar.

## The nav height is a token

The nav height is a token, `--topbar-h`, because the filter bar sticks below it
and the two have to agree.

The token is measured at runtime, not typed in. The bar's height depends on the
font, on how the links wrap, and on the reader's own font size, so a number in
the stylesheet goes stale the moment any of those change. A small script
measures the header and writes the number down; the stylesheet holds a
first-paint fallback.

It was a hand-measured number, and it was one pixel short at every width,
because the header's 3px bottom border sits outside its content box. The
filter bar stuck at the token's offset, which was inside the header, so the top
of it, the "Show" label and the top of the chips, was cut off by the header
above it. The token has to be the border-box height, so it includes that
border.

It was measured with `getBoundingClientRect`, which is in **device pixels**.
A custom property is in **CSS pixels**, so at 200% zoom the token was twice
the real height: 454px for a bar that is 227px, and 318px for a bar that is
159px. The filter bar stuck at an offset twice as far down as the header
actually is, and it sat underneath the header. `offsetHeight` is the
border-box height in CSS pixels, it includes the 3px border, and it does not
change with the reader's zoom.

The script only writes when the stylesheet's value is wrong. The stylesheet
carries the bar's height for every width, so at the reader's default font size
it is already right, and writing it anyway put `--topbar-h` into the `html`
element's inline style on every page. That changed the document for no
reason, and it made the html look as though it were being rewritten. The
script's job is the case the stylesheet cannot know: a reader whose font size
is not the default, or who has zoomed in.

The fallbacks are the measured heights: 63px, 159px below 806px and 207px
below 385px. Every one of them matches the bar's real height at every width,
which is checked in `scripts/audit-browser.mjs`, along with the token itself:
`--topbar-h` must be the bar's height in CSS pixels.

The bar's own height is not driven by the token. It used to be, through a
`min-height` on the wrap inside the header, and that is circular: the bar's
height depends on the token and the token is the bar's height. The bar's height
comes from its contents, the padding and the border.

## The filter bar sticks, but only where it fits

The filter bar is sticky above 560px and scrolls with the page below it.

At 320px it is 242px tall: four rows of filter chips and the ranking note. That
is a quarter of an 800px screen, held down permanently, over the board the
reader came to scan. It does not fit under the header either, so the browser
pushes its top back under the header, which is the same clipping the token
mismatch caused.

It also has to be able to travel. A sticky element cannot leave its containing
block, and the filter bar used to sit in a wrap of its own that was exactly as
tall as the bar, so it had nowhere to go. It sits at the top of the board's
wrap now, which is as tall as the whole board.

## The tally on the board card

The count of agents is a block of ink with the number set into it, the same
shape the rank badge uses. It sits to the right of the title on a wide
screen and becomes a full-width strip below the title under 560px.

It was a bare figure set to the right of the title. A short title left a wide
hole between it and the far edge of the card, and the number read as a second
headline competing with the title rather than as the count it was. As a block
it fills that space with a shape the register already uses.

## A count on this board is the whole truth

Every count the board shows is the count of everything, not the count of a
sample.

The cluster page groups its rows by what was asked for, one row per distinct
capability, with the number of times it was asked for. That number used to be
counted in JavaScript over the twelve most recent wishes. A cluster with
sixteen wishes read "4 times" on a row that had been asked for more than that,
and the twelve rows added up to twelve, not sixteen. A reader could not tell a
truncated count from a real one, and the table is the page a builder reads
before deciding what to build.

The count comes from every wish on the cluster now, grouped in SQL. The rows
add up to the number in the heading above them, and a reader can check it.

The same rule applies to the agent counts. A seeded wish is the operator's own
and is not agent demand, so it is excluded from every agent count on the board,
including when two clusters are merged. A merge used to move the votes
without their seeded flag, and the operator's own wishes became agent demand
the moment two clusters were joined.

## The copy button

The button sits inside the code block, on the dark, in its own grid column.
The code takes the first column and the button the second.

It floated over the top right corner of the block, and the space reserved for
it was a hard-coded 96px. The button on the weekly page is 105px wide, so the
tail of the badge URL ran underneath it and was hidden behind the label. A
reserved width cannot fix this: it is wrong the moment a label is longer than
the value it was written for. A grid column cannot be wrong that way.

On a screen under 520px the button takes a row of its own above the code,
right aligned, because a button in a column would squeeze the code too far.

## The baseline

Every spacing value is a multiple of 4px. The exceptions are border widths
(1px, 2px, 3px) and the visually-hidden utility, which are not spacing.

The radius is 2px. The hard-edged character comes from the 1px and 2px
borders and the 3px offset shadow, not from the radius.

## Touch targets

Every standalone control is at least 44px tall: the nav links, the buttons,
the filter chips, the copy button, the client select, the footer links and
the form fields. A link inside a sentence is a word in a sentence, and is
left at its natural size.

The 44px rule applies at every width, not only on a phone. It was written
inside the `max-width:760px` media query, so on a tablet or a desktop the nav
links were 34px tall: a smaller target on a bigger screen. The browser measured
34px at 761px and above.

## The stylesheet and the markup agree

A class in the stylesheet that nothing uses is a rule somebody has to read and
maintain for no page. A class in the markup that nothing styles is markup
somebody has to read and maintain for no effect. Both are small, and both add
up to the thing that makes a stylesheet hard to change: you cannot tell which
parts matter.

`tests/dead-css.test.ts` checks both directions. The classes the scripts add
at runtime, `done` on the copy button and `new` on the ticker, are the
exception.

## The stylesheet lives in a template literal

`src/html.ts` holds the whole stylesheet in a template literal. A backtick
inside a CSS comment ends the literal. The result is still valid TypeScript, so
`tsc --noEmit` says nothing and the Worker crashes at runtime with a
`TypeError`. It happened twice during the November 2026 review.

The stylesheet is the one thing every visitor gets, so it has its own check:
it starts with `:root{`, it ends with `}`, its braces balance, and it holds no
backtick. `tests/sticky.test.ts`.

## Accessibility standard

WCAG 2.2 AA, measured against the real foreground/background pairs rather
than the tokens in isolation.

- **Minimum type size: 12px.** Nothing is set below it. 11px was the old floor
  and it carried the board's key labels. Inline code was a rounding accident:
  a code block is 13px and the inline rule was .92em of it, which is 11.96px.
  It is 12px exactly now.
- **Contrast: 4.5:1** for body text, **3:1** for large text and UI component
  boundaries. Every pair on every page passes in both themes. The dark-mode
  border colour is `#726859` specifically because it clears 3:1 against both
  dark surfaces.
- **Every page has exactly one h1**, and heading levels do not skip.
- **Tables scroll**, they do not overflow the document.
- **A count and a date never break across lines.** They are single values,
  and a table where every row is twice as tall as the text in it stops
  being scannable.
- The code block has its own colours in dark mode. It does not follow the
  ink/paper swap, which would turn it into a bright slab on a dark page.
  Inline code inside a code block inherits the block's colours; the
  specificity has to be `.page pre code`, or the inline rule wins and the
  code renders as dark text on a dark panel.
- The logo is 19px, not 18px. At 18px the red falls below the large-text
  threshold and fails AA.

## Getting things off the page

Every snippet on this product exists to be pasted somewhere, so every snippet
has a copy button. The code stays selectable by hand, so the button is a
shortcut and not a requirement.

The button is a plain `<button>` with the text in a `data-copy` attribute and
one small script that wires up every button on the page. The clipboard API
needs a secure context, so there is a fallback through a hidden textarea and
`document.execCommand('copy')`.

The page that carries the most important snippet of all is the one that asks
a person to send a line to their agent:

    Check out https://toolswanted.dev and install it for future use.

That is different from the AGENTS.md line, which is an instruction an agent
follows forever. The one above is a request a person makes once, in a chat,
to get a capability installed. It is a request, it says what the agent should
do rather than describing a protocol, and it is short enough to read in a
chat window.

## What is deliberately not here

There is no component library, no CSS framework and no build step. The board
is hand-rolled SSR because it has to render inside the free plan's 10ms CPU
budget. Adding a framework would cost more than every problem it solved.

There is no dark-mode toggle in the CSS. Dark mode follows
`prefers-color-scheme`; the `data-theme` overrides exist for the button that
is not wired up yet.
