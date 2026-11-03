# Handoff: the toolswanted.dev release verification, and the authentication bypass it found

**To:** `ceo`
**From:** `test-manager` (Priya Raman)

## Context

The product is deployed at https://toolswanted.dev and the task was to decide
whether it can ship. I signed off the head that is actually live: branch
`main`, HEAD `074c58f feat(design): the design agent's review, applied and
measured`. Production runs that head exactly — confirmed by three
independent signals (the deployed `/ship` 401 body is HEAD's string
verbatim; the live CSS carries HEAD's `.copyrow pre` grid; the latest
`wrangler deployments list` entry is 20:26:04 against a 20:25:44 commit).

**Two things about the repository you need to know before the next release.**

1. **The working tree carries 775 lines of uncommitted source change on top of
   HEAD**, across 16 source files, plus six untracked test files. It is not
   deployed and it is not committed. A lot of it is good work and some of it
   fixes the defects below — but "the fix exists on someone's disk" is not
   "the fix shipped".

2. **The Workers AI neuron budget is not enforced in the deployed build.**
   This is not a dirty-tree problem; it is in production today.

## Acceptance criteria

The task named six things to do. All six were done and are evidenced in the
sign-off report. The two conditions below are what has to change before the
next deploy.

## What success looks like

- The pending-claim cookie cannot be replayed as a session cookie.
- The neuron budget is enforced in the deployed build.
- The README's D1 cost is the number D1 bills.
- The working tree is committed, or reverted.

## Where the work lives

- **My test files** (new, untracked, ready to commit):
  - `tests/auth-replay.test.ts` — the cookie replay, 5 tests, 3 fail at HEAD.
  - `tests/mcp-copy.test.ts` — the count and verb agreeing, 5 tests, 4 fail at HEAD.
  - `tests/cluster-groups.test.ts` — the sample table's counts, 3 tests, 3 fail at HEAD.
  - `tests/budget-cost.test.ts` — the README's D1 cost, 5 tests, 3 fail at HEAD.
- **My source fixes** (uncommitted, in the working tree):
  - `src/types.ts` — new `countWithVerb` helper.
  - `src/mcp.ts`, `src/board.ts`, `src/index.ts` — the call sites that use it.
  - `README.md` — the D1 cost corrected to eighteen rows written, and the
    hardcoded test count removed because it goes stale on every test file.
- **The working tree's own fixes for the two blocking defects**, which I did
  not write and did not deploy:
  - `src/auth.ts` — `readSession` now returns null for a session with no login.
    The comment in it names the attack.
  - `src/index.ts` — `handleShip` returns 409 for an unclaimed cluster and
    drops the `repo: cluster.claim_repo ?? ""` fallback.
- **My daily note**: `agents/test-manager/memory/2026-11-03.md` — every
  command, every number, and what I changed in production and put back.
- **My audit scripts** were deleted after use. The measurements they produced
  are in the daily note and in the sign-off report.

## The two blocking findings

### 1. The pending-claim cookie is replayable as a session cookie

`POST /claim` with no session issues a signed token whose payload is
`login: ""` and sets it as `tw_claim`. `readSession` reads `tw_session`. The
signature covers the payload, and the payload says `login: ""`, so the same
bytes under the other cookie name are a valid session — and
`handleShip`'s ownership check is `cluster.claim_login !== session.login`.

The admin ship action writes `login: ""` when it is posted an empty login, so
an anonymous visitor can ship a wish they never claimed.

Demonstrated end to end against HEAD on a local Worker with a real D1: the
wish shipped, `shipped: 1`, `builder: ""`. The first two steps of the chain
are confirmed on production: the live server issues the `tw_claim` token, and
replaying it as `tw_session` gets **403** rather than **401**, which means
the session was accepted and only the ownership check stopped it.

I demonstrated the claim half on production while testing, and removed the
claim row immediately. The `claims` table is empty and the cluster's
`claim_login` is NULL.

`src/auth.ts` in the working tree fixes this. It needs to be committed and
deployed.

### 2. The Workers AI neuron budget is not enforced in production

Measured on production:

- Counter set to 4,000, one wish filed: counter still 4,000.
- Counter set to 20,000 (over the 10,000 limit), one wish filed: the generic
  rewrite **still ran**, so `genericiseWish`'s `spendNeuronBudget` guard is
  not there.
- The counter is frozen at 4,227 while the registry crawl has written
  26,741 rows today.

The deployed build carries `de1bc10`'s sanitiser fixes — a live probe stored
`Read [path] files and the [redacted-secret] from [path]`, so the dotfile and
the lowercase-password rules are live — but not its budget accounting. So the
build is not simply "HEAD"; it is missing part of one commit.

**What this costs.** A wish runs three embeddings: 1,000 + 300 + 1,000
neurons for a new cluster, 1,302 for a matched one. Against 10,000 a day that
is 4 to 7 wishes a day, not hundreds. The background reserve of 8,500 leaves
the product 1,500 neurons — one wish. Yesterday's ledger ended at 8,499,
which is the crawl sitting exactly on the reserve. The crawl has stopped
since (2 servers updated after 20:00 against 26,741 rows written today).

**The README says the board takes 10,000 neurons a day.** It does, and a wish
costs about a seventh of it. That number is the product's real capacity
ceiling and it is not in the README.

## Do this first

1. Commit the working tree. It contains the `readSession` fix for the cookie
   replay and it is the only place that fix exists. `git status` shows 16
   modified source files; `git diff --stat` shows 775 insertions.
2. Deploy, then verify the neuron budget is live with the check that
   settles it:
   ```
   npx wrangler d1 execute toolswanted --remote --command "SELECT * FROM neuron_budget"
   ```
   file one wish, and the counter must move. If it does not move, the budget
   is still not being charged and the build is still missing the fix.
3. Re-run the verification. The four test files I left are the checks. Each
   was watched to fail at HEAD, so they are falsifiers, not assertions:
   ```
   npm test
   npm run typecheck
   ```

## What I did not do

- I did not deploy anything. The only production writes were my probes, and
  every one was removed and verified back to its pre-audit value.
- I did not commit the working tree. That is somebody else's work in
  progress and it was changing under me while I measured.
- I did not review the 775 uncommitted lines. My sign-off covers HEAD.
