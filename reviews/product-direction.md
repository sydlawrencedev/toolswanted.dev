# Product direction: decisions

**Decided by:** Rowan Ashby, Founder
**Date:** 5 November 2026
**For:** `gtm-owner`, `design-delight`, `content-brand`, `frontend-engineer`
**Supersedes:** nothing. Adds to `agents/design-delight/NOTES.md`, which stays the canonical design record.

These are decisions. Work to them. Come back only if a decision itself has to change.

---

## 0. What production actually says, measured today

I did not take the reviews' word for it. I measured production at 5 November 2026.

```
GET https://toolswanted.dev/api/stats
{"ok":true,"clusters":0,"wishes":3,"agents":3,"seededWishes":0,"shipped":0,"pending":3}

GET https://toolswanted.dev/api/top?limit=5
{"ok":true,"count":0,"wishes":[]}
```

The board is empty. That is confirmed. Three corrections to the brief I was given, and one to the brand review:

**Correction 1. The board is not at zero wishes.** It was at zero when the brand review measured it, and at 2 when I started (the brand review's own probe wish, plus one more), and at 3 now. My probe wish added the third. All three are unseeded, all three are pending, none is published. The direction of travel is right: the board is empty of *published* entries and it is accumulating *real* unseeded wishes. That distinction matters for Decision 1, and I want it stated plainly before I decide anything: **the board is not empty, it is unproven.**

**Correction 2. The published entry does still exist, and it is reachable.** The brand review reported a 404 on `GET /api/cluster/read-uk-council-planning-pdfs-as-structured-data`. It is a 200 today. But its `status` is **`pending`**, not `published`:

```json
{"ok":true,"slug":"read-uk-council-planning-pdfs-as-structured-data",
 "agents":1,"wishes":1,"status":"pending","seeded":false}
```

**Correction 3. This is a publish-gate leak, and it is a bug.** `src/index.ts:470` serves `/w/{slug}` through `getClusterBySlug` (`src/db.ts:55`), which has **no `status` filter**. The same cluster is also served at `/api/cluster/{slug}` and it **appears in `/api/search` results** (verified: the weather cluster came back from `GET /api/search?q=weather` with `"agents":1` and a live URL). So a pending cluster is publicly readable, searchable, and has a working OG poster route, while the board's own list hides it.

This is the single most important thing in this document, because it decides Question 1 for me. I did not choose it; it is a defect that already exists. **Decision 1 is built on fixing it first.**

**Correction 4. The stale OG poster is not being served, and the brand review's H2 concern is half wrong.** The design review reported that the poster for the deleted entry "still serves". I measured it:

```
GET /og/read-uk-council-planning-pdfs-as-structured-data.png
HTTP/2 200  content-type: image/png  x-og-default: 1  x-og-stale: 1
```

The image route already falls back to the default card when a poster is behind its entry. The stale "12 agents" poster is **not** reaching a reader. The mechanical fix in `docs/launch.md` ("run `npm run og:sync`") is still right, but it is not urgent, and it is not what is between us and launch. What *is* urgent is the leak in Correction 3.

**Correction 5. The registry check works. I verified it end to end, myself, on production.**

```
POST /api/wish  {"need":"Convert a PDF invoice into structured line items"}
→ existing_tools: 4 servers, top score 0.683
  io.github.fashionmascherine-svg/document-to-json-mcp
  io.github.PabloG6/pdfparse
  io.github.Alex-Dev-Web-C-DE/document-to-json-mcp
  ai.extend/extend
```

Four real, published, working tools for a capability nobody had asked for before. **The wedge is real and it is the product.** Everything below is downstream of that being true.

**Correction 6. `/api/servers` is still 403 and `GET /auth/github` is still 503.** Both unchanged. The claim path is still dead.

---

## Decision 1: The seeding strategy: keep seeded wishes visible, separate the two signals, and fix the publish gate first

**The call:** Option (b), with the seeded signal *moved out of the ranking entirely* and given a name of its own. And a precondition: **the publish-gate leak gets fixed before any seed runs.**

Concretely:

1. **Seeded wishes stay visible.** They stay on the board, on the cluster page, in the weekly list, in the feeds and in the API, labelled everywhere, exactly as `NOTES.md` requires. I am not removing them and I am not hiding them.
2. **Seeded wishes are removed from the ranking, and they are also removed from the *denominator* of the ranking.** The board's ranking is computed over unseeded wishes only. This is already true of the agent count (`unique_agents` counts `seeded = 0`), and it needs to become true of the ordering as well, so a seeded wish can never influence which entry sits at rank 1.
3. **The seeded signal gets its own label and its own count, and it never sits inside the ranking's number.** The card carries two things, not three: the ranking number (independent agents, unseeded only) and a distinct **"ours"** stamp carrying the seeded wish count. The stamp is not a rank, not a count competing with the rank, and not a caveat attached to the rank.
4. **The publish gate is closed first.** A cluster whose status is `pending` must not be readable at `/w/{slug}`, must not appear in `/api/search`, and must not be served at `/api/cluster/{slug}`. Until that is true, seeding is unsafe, because a seeded wish would create a pending cluster that a reader can find and read, and the board's "three independent agents" rule would be visibly meaningless.
5. **A seeded cluster can never be published, and a cluster with only seeded wishes never appears at all.** `NOTES.md` says a seeded wish "cannot publish a cluster on its own". I am tightening that to: a cluster with **zero** unseeded wishes never appears anywhere public, seeded or not.

**Why, and why not the others:**

Option (a), "keep seeded visible, compute the ranking from unseeded only", is close to right and I am choosing a stricter version of it. The reason to go further is that the brand review's objection is not really about *counting*. It is about **the reader being unable to tell which number is the evidence.** With one seeded entry on the board, a reader sees "12 agents" and a "SEEDED" stamp and has to work out whether the 12 is real demand. The label is doing a job no label can do well: it is qualifying the headline number of the product. So the fix is not to demote the label. The fix is to stop asking the label to qualify the headline number, by making the headline number mean only one thing.

Option (c), "remove seeded wishes from the public board entirely", is rejected, and this is the call I most want to be unambiguous about. It sounds clean and it is the wrong answer for this product, for a reason that is not squeamishness: **the seeded wishes are how the board demonstrates that its categories are real.** They are not fake demand masquerading as demand; they are a catalogue of capabilities the operator's own agents are known to hit, and they are labelled as such at every point they appear. If the board's public surface contained only what strangers happened to file in the last four days, then the board would show three weather and invoice capabilities, and every builder arriving would correctly conclude that the three most-wanted MCP capabilities in the world are weather forecasts and invoice parsing. That is a *worse* board than a labelled catalogue, and it is a board that teaches the wrong lesson.

Option (d), and here is the part I want the team to take seriously. The thing that makes seeded wishes dangerous is not that they are seeded. It is that **they can escape the queue.** The current system allows a pending cluster to be read, searched and shared while the board's own list hides it. That is the defect. Seeding is the accelerant. So I am fixing the defect rather than throwing away the accelerant.

**What it costs:**
- One query change (ranking over unseeded wishes) and one schema-level guard (a cluster with zero unseeded wishes is invisible).
- The publish gate fix touches `/w/{slug}`, `/api/cluster/{slug}`, `/api/search`, the OG route and the badge route. That is the real cost of this decision, and it is worth paying. It is also a *correctness* fix that stands on its own, independent of seeding: a cluster that has not met the publish threshold is not public, and right now it is.
- The card copy has to carry two numbers where it carried one. The design line owns that, and it is a card change, not a new surface.
- Seeded entries can never appear in the ranking, so a seeded wish can never be at rank 1. A builder scanning the board will not see a seeded entry at the top. That is correct and it is the point.

**What specifically changes:**
- `src/db.ts:55` `getClusterBySlug` gains a `status = 'published'` predicate, and the callers in `src/index.ts` and `src/api.ts` are checked.
- `src/api.ts` search and cluster routes return 404 for a non-published cluster.
- The board's card renders the seeded stamp as a distinct "ours" count, not as a qualifier on the agent count.
- `NOTES.md` gets one line recording this decision and the two-signal split.

---

## Decision 2: The publish threshold stays at three, and the board publishes nothing until three real agents ask

**The call:** **Three stays. It does not move. And the board publishes nothing at launch.**

I want to be clear about what I am not doing, because the pressure here is obvious. The board is empty and an empty board at launch looks like a dead product. The tempting move is to lower the threshold to two so that the queue drains and the board has something on it.

**Why three holds:** The threshold is not a display setting. It is the definition of the number the ranking rests on. Three agents from three addresses is the first configuration where "three people wanted this" is a statement about people rather than about one machine with three personalities. Lowering it to two publishes entries whose second rank is "two agents, one address", which is the exact sentence the board's copy exists to prevent a builder from reading. The bar is not a number to be tuned to the shape of today's queue. It is the bar.

**But the board must not launch empty, and "publish nothing" is not the answer either.** Here is the actual decision:

**The board launches empty, and the launch is about the registry check.** The board's claim is a ranking. A ranking over zero entries is not a ranking, and no copy trick makes it one. The registry check is a real, working product that helps a real person in a real moment, and it needs no crowd. So:

- The **hero action is the registry check**, and it is the thing the page leads with. This is the founder's standing decision from `NOTES.md` ("The wedge is the registry check, not the board"), and the brand review's Finding 5 is the correct reading of it: the landing page currently does the opposite.
- The board is still on the page, still linked, still the reason to come back, and its empty state is written as a deliberate state that says what to do. The brand review and the design review agree the current empty state fails: the hero says "2 wishes from 2 agents, in 0 clusters" and the body says "Nothing on the board yet", thirty pixels apart. One flag drives both.

**And here is the part that is new, because the empty board creates a problem the reviews did not name.**

A builder arriving cold needs to see *something*. Not a fake ranking. Something true. So:

**The board publishes a "coverage" section that is not a ranking and does not pretend to be one.** It is the set of capabilities the operator's own agents have hit, labelled as ours, in a distinct section below the ranking, with no rank numbers and no agent counts. It is the catalogue, and it is labelled. A builder arriving sees: nothing is published yet because nobody has asked three times, and here is what we know is missing, from our own machines.

That section is **not** the board's ranking, it carries **no rank**, and it **cannot be the thing the ranking rests on.** It does not require a new page. It is a section on the board page that renders only when the ranking is empty or thin. This is the one thing I will authorise that adds surface area to the board, and I am authorising it because the alternative is a landing page with nothing on it. `NOTES.md` says "the design line does not work on: New surfaces." I am not adding a page. I am adding a section to a page that already exists, and I am ruling that this is within the line.

I need to be honest with myself here, because this contradicts Decision 1. Decision 1 says a cluster with zero unseeded wishes never appears anywhere public. Decision 2 says the coverage section shows seeded capabilities publicly. Those are in tension, and I will not ship a contradiction.

**Resolution, and it is the right one: the coverage section is not the board.** It is a separate, explicitly labelled section with its own heading, its own visual treatment and its own label ("ours, not demand"), rendered from seeded wishes only. It never carries a rank number, never contributes to the ranking, never appears in `/api/top`, never appears in `/api/weekly`, never gets an OG poster, and never gets a cluster page. It is the operator's seeded catalogue, shown as the operator's catalogue.

That is honest, it gives the arriving builder something real to read, and it cannot contaminate the ranking because it is not part of the ranking. It also means Decision 1 stands as written: **the published board**, meaning the ranking, the API, the cluster pages and the feeds, contains nothing that has not met the threshold from unseeded agents.

**What it costs:**
- A new rendering path for a labelled section on the board page, and the copy for it. One section, one style, one label.
- The temptation this creates: every time the board is empty, someone will want to add a rank to that section. The rule is that it does not get one, and it never will.
- One more thing to get wrong on the landing page, which is currently carrying four contradictions.

**What specifically changes:**
- `src/board.ts`: one `boardIsEmpty` flag (or `boardIsThin`) drives the hero stats, the card area, and the rendering of the coverage section. The design review's C1 is the same defect; the flag is the fix.
- The coverage section renders from the seeded wishes, labelled, with no rank.
- The empty state on `/weekly` (design review M4) renders the `.empty` treatment instead of a header-only table.

---

## Decision 3: The registry check becomes the first-class hero action

**The call: yes.** It becomes the primary action on the landing page, above the board, not beside it.

Both reviews reached this independently and both are right. The brand review's table of builder needs has the row that matters:

| Need | Where it is served | Verdict |
|---|---|---|
| Know whether the tool already exists | Nowhere on the landing page | **Not served** |

A builder's first question is not "what is popular". It is "does this already exist". Today the product answers that question *well*, *for free*, *with no crowd*, and *does not put it on the front page*. That is the whole problem in one row.

**What "first-class hero action" means concretely, so it is not a redesign:**

- The hero's lede keeps the builder's situation as its opening. It does not become a feature list.
- Immediately under it, one line states what the check does, and one number says how big the registry mirror is. **That number must be re-measured from inside the deployment on the day of launch**, because `/api/servers` is 403 and 55,288 cannot be confirmed from outside. If it cannot be confirmed, it does not go on the page. The brand review's point that this is the number the launch post should carry is right, and it is right here too.
- The action is **one input and one button**: "Ask whether a tool already covers this" plus a capability field. It is the same one-call shape the agent uses, but a human can use it too. This is not a new product. It is the existing `/api/wish` path with a human surface on top of it.
- The reply shows the matching servers with their scores, and the board's position on that capability if there is one.
- The board follows below, as the reason to come back.

**Why it is not just "add a box to the hero":** the value of putting the check first is that it makes the *empty board* stop being a problem. A builder who arrives, asks about a capability, and gets four working tools has had a good two minutes. They never needed the ranking to be useful. The ranking is what they come back for.

**What it costs:**
- A new route or a POST from the landing page. It needs to fit the 10ms CPU budget, and it needs the same rate limiting and the same sanitiser as the agent path. The sanitiser is the security boundary and a human-facing form does not get an exemption from it.
- The registry check costs embeddings. The Workers AI budget is 10,000 neurons a day and roughly seven wishes a day on the product's share. **A human-facing form multiplies the wish path's cost.** This is a real constraint, not a footnote: the form needs to hit the same budget counter and the same refusal path, or a popular launch will eat the day's budget and the crawl stops. The budget code already exists and the form should use it rather than a second path.
- The design line has to make this a first-class action in the loud register without turning the hero into a menu.

**What specifically changes:**
- A human-facing check action in the hero, above the board links.
- The registry total, measured from inside the deployment, dated, and rendered from a single source.
- One more thing on the board page, which is now crowded. The design line's call how to lay it out. I am not going to pretend this is free.

---

## Decision 4: The distinct-IP count ships now, on the card and on `/about`

**The call: yes, ship it now. Both places. It is not a `/about` item and it is not a card item. It is both.**

`NOTES.md` names this as the design line's next task. I am confirming it and removing the ambiguity about the form.

**The form.** On the board card, the agent count gets a line under it:

```
Wanted by 3 agents
from 2 addresses
```

Not "3 agents, 2 addresses" in one line, which reads as two counts of the same thing. Two lines, because they are two different claims: *how many wanted it* and *how spread out they are*. A builder deciding whether to spend a weekend on it needs both, and the second one is the one that tells them whether the first one is real.

The line appears whenever the two numbers differ. When they are equal, the line is absent, because then it says nothing.

**On `/about`:** the board-wide distinct-IP count, in the "What the counts mean" section, next to the agent count. This is where it belongs, because `/about` is where the copy explains what the numbers mean.

**Where it does not go:** not in the hero stats paragraph. The hero's job is to be one sentence. Not in the API's `/api/stats` unless it is cheap. Actually, it should be in `/api/stats`, because the launch post needs to quote it and the launch post needs a machine-readable source for it. The brand review flagged that "no public endpoint returns it, so it has to be read before the post goes up". That is a defect in the product's own tooling. **Add `distinctIps` to `/api/stats`**, counted as `COUNT(DISTINCT ip_key) FROM wishes WHERE seeded = 0`, matching the `agents` count's rule exactly.

**Why it ships now and not later:** because the seeding decision depends on it. Decision 1 asks a reader to trust that the ranking is over independent agents. The distinct-IP count is the only way a reader can check that claim, and it is the thing that makes the "ours" stamp legible. Shipping the seed labelling without the address count means asking a reader to take the ranking on faith, which is exactly what the brand review says is wrong with the current design. The two ship together or the labelling is decoration.

**What it costs:**
- One query per board render for the per-cluster address counts. The board render is already at "one query" per `NOTES.md`, and the free tier has a 10ms CPU budget. **This has to be a single windowed query over the visible clusters, the same shape as `getClientBreakdown`**, not N queries. If it cannot be done in one query, it does not ship on the card.
- One new field on `/api/stats`.

**What specifically changes:**
- A `getAddressBreakdown` alongside `getClientBreakdown`, one windowed query, `seeded = 0` only.
- The card renders the second line when the counts differ.
- `/about` renders the board-wide address count from the database, not hardcoded. **The hardcoded "20 independent agents across 4 distinct IP addresses, with 12 on the published entry" on the live `/about` page is the single worst defect in the project** and it comes out today, as the brand review's blocking action 1.

---

## Decision 5: The launch sequencing

**The call:** The Show HN post goes up **after** the following, in this order. The post does not go up today, and it does not go up with the board empty and unexplained.

**Order of work, hard sequence:**

**Phase 1: make the product true (blocking, before anything else).**
1. Fix the publish-gate leak. Pending clusters are not readable at `/w/{slug}`, not in `/api/search`, not at `/api/cluster/{slug}`, not in the OG route, not in the badge route.
2. Remove the hardcoded figures from `/about`. Read them from the database. This is live and false right now.
3. Add `distinctIps` to `/api/stats` and the per-cluster address count to the card. (Decision 4.)
4. Fix the `/build` badge fallback, which hardcodes a slug for an entry that is not published, and so renders a badge that 404s.
5. Fix the `/wish` form placeholders, which reference the deleted entry.
6. Fix the RSS pluralisation ("1 wishes from 1 agents").

**Phase 2: make the product good (the wedge).**
7. The registry check becomes the hero action. (Decision 3.)
8. One `boardIsEmpty` flag drives the hero, the card area and the coverage section. The board's empty state is written as a deliberate state.
9. The board card separates the ranking from the "ours" count. (Decision 1.)
10. Cut `SNIPPET_ASK_AGENT` to the request plus the header clause. Keep the header clause. Do not cut it to hit a character count.
11. The design review's C3, H1, H4 and M4 land. H2's stale-poster concern is downgraded: the stale poster is not being served, but the copy fix and the duplicated "WANTED" still need doing.
12. Re-measure the registry total from inside the deployment. It is the launch post's headline number and it must be confirmable.

**Phase 3: decide the claim path, then launch.**
13. **Decision: the post does not tell a builder they can claim an entry, and we do not wait for GitHub OAuth to launch.** `GET /auth/github` returns 503. The `/build` page already tells the truth about that, honestly and well. The post carries the mechanism and the honest state of the sample. Configuring OAuth is worth doing, and it is worth doing before launch if it is a twenty-minute job, but it is **not** a launch blocker. A post that promises nothing false is worth more than a post that promises something early.
14. `npm run og:sync` against the deployed board.
15. Re-measure every figure in `docs/show-hn.md` and `README.md` on the day, from `/api/stats` and `/api/top`.
16. Rewrite the board-state section of the post around the real state: zero published entries, three real unseeded wishes, and the registry check that works. **The post does not fill the gap with a wish the operator filed.** The seed labelling exists to prevent exactly that, and doing it in the launch post would void the whole labelling apparatus on the one day it is most visible.

**What must be true before the Show HN post goes up. All five, same as `docs/launch.md`, restated with today's state:**

1. The working tree is deployed, so the copy on the board and the copy in the post are the same copy.
2. `npm run og:sync` has run against the deployed board, so the poster's number matches the board's.
3. The pasted entries in the post match `GET /api/top` on the day it goes up. **Today that is zero entries, so the post carries zero entries and says so.**
4. `GET /api/weekly` and `GET /api/stats` report the same numbers.
5. The post does not say a builder can claim an entry unless `GET /auth/github` returns 200.

**And one new gate, which is the point of Decision 2:**

6. **No live page states a number that the board's own queries cannot produce.** No hardcoded dated figures in a present-tense sentence. This kills the `/about` defect permanently, not just this instance.

**What does *not* gate the launch, and I am settling this so nobody reopens it:**
- A non-empty ranking. The board launches empty and says so.
- GitHub OAuth.
- A claim. A claim is the goal, not the precondition for saying hello.
- Seeded content on the board. The board is better for having no seeded entries and an honest empty state than for having a catalogue presented as demand.

**One number for the post:** the registry size. Re-measured, dated, appearing once, prominently, early. Everything else in the post is subordinate to it or cut. The brand review is right about this and I am endorsing it: it is the number a reader can check independently, and it is what makes the wedge obvious.

**The two sentences that must survive into the final draft**, because they are the most honest writing in the project and they are still true:

> "I have not yet seen a builder claim an entry. That is the number the whole thing exists for, and it is zero."

> "The registry check is the part that works today, with no crowd at all."

---

## What I am not deciding

These are not mine to decide and I am not going to pretend otherwise:

- **The exact layout** of the hero check action, the coverage section and the card's address line. That is the design line's, and it has to fit on a page that is about to get three new elements. I have said what each element has to do, not where it goes.
- **The wording** of the coverage section's label, the empty state and the post. `gtm-owner` owns the copy. My constraint is that it says one thing and that every number in it can be produced by a query.
- **Whether the claim path gets configured.** I have decided it is not a launch gate. Whether it gets done this week is an operator's call.
- **What the thresholds are after the launch.** If the board grows, the threshold stays at three. If the board does not grow, the threshold stays at three. It is not a variable.

---

## Summary of the decisions

| # | Decision |
|---|---|
| 1 | Seeded wishes stay visible and labelled. Ranking is computed over unseeded wishes only. Seeded count is a separate "ours" stamp, never a rank. **Prerequisite: close the publish-gate leak, so a pending cluster is not readable, searchable or shareable.** A cluster with zero unseeded wishes never appears in the published board. |
| 2 | The publish threshold stays at **three**. The board launches empty and says so. A labelled "ours" coverage section shows the seeded catalogue below the ranking, with no ranks, no agent counts, no cluster pages and no OG posters. |
| 3 | The **registry check becomes the first-class hero action**, above the board. One input, one call, the reply shows matching servers. The registry total is re-measured from inside the deployment and dated. |
| 4 | The **distinct-IP count ships now**, on the card (second line under the agent count, only when the two differ) and on `/about` (board-wide). `distinctIps` is added to `/api/stats` so the launch post has a source for it. |
| 5 | **Launch sequence**: Phase 1 make it true (publish-gate fix, hardcoded numbers, badge, placeholders, RSS), Phase 2 make it good (registry hero, empty state, card split, snippet), Phase 3 launch (OG sync, re-measure, rewrite the board-state section around the real state). Six gates, including a new one: no live page states a number the board's own queries cannot produce. |

**One disclosure.** My verification filed three real wishes on production, because the registry check can only be verified by exercising it: the brand review's weather probe, one I filed, and the invoice probe I filed while confirming the wedge. All three are unseeded, all three are pending, none is published, and none of them is the operator seeding the board to make it look full. They are in the database because agents filed them. **The board's honest state right now is three pending entries and zero published, and that is the number the launch post must carry.**
