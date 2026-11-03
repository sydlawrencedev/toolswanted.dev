# MEMORY

How the project owner operates. Patterns, preferences, lessons.

## How this project is run

- **Six agents, one operator.** The owner drives the agents and the product
  at the same time, so the agents' work is reviewed in the same session it is
  produced. Reviews land as soon as the work exists.
- **The agents work concurrently on one working tree.** More than one agent
  can have uncommitted changes at the same time. This has already caused
  damage: a `git stash` by one agent removed another's work, and it took a
  `git stash pop` and a manual reconciliation to put it back. Check
  `git status` before and after any working-tree operation, and prefer
  committing over stashing.
- **The house voice is enforced in review, not in a linter.** Em dashes,
  American spellings and unverified numbers get caught at review time and
  sent back. Assume copy will be re-read against `brand/VOICE.md`.

## What the owner values

- **Evidence before assertion, absolutely.** A number that cannot be checked
  does not appear. This applies to the product copy as much as to the
  internal reports, and it is why the seeded-wish labelling exists at all.
- **Honesty about a thin sample over a dressed-up board.** The seeded-wish
  labelling, the "one published entry" wording and the dated figures are
  deliberate. The owner would rather ship a small true thing than a large
  flattering one.
- **The product is the story.** The launch post links the board rather than
  describing it.

## Lessons

- **Verify against the live database, not the brief.** Every number in the
  founder review of 3 November 2026 came from `wrangler d1 execute --remote`
  or a live HTTP call, and one briefed number was already out of date.
- **The board's numbers move during a review.** Sibling agents file wishes
  against the live board while the review runs. Date every figure and prefer
  a structural fact (agents against distinct IPs) over a moving count.
- **A ranking claim is only as good as its sort key.** The board said
  "ranked by how many independent agents want the same thing" while sorting
  by total wish count. Check that the claim and the implementation say the
  same thing.
