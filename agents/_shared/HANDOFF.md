# HANDOFF

How one agent hands work to another, in a project that has no issue tracker.

The rule is unchanged: **never leave a task in a state where no one knows what comes
next.** What changed is the mechanism. There is no child ticket to create and no
parent to block, so the handoff is a written note, and the note is the handoff.

## When to hand off

Hand off when the next piece of the work is not yours.

- Another agent has to do it, because it needs a skill, a permission or a judgement
  you do not have.
- The work is finished but not verified, and the verification belongs to somebody
  else. This is the ordinary case: you do the work, a different agent signs it off.
  See `agents/_shared/REPORTING.md`.
- You have found something outside your remit that needs an owner, and no owner is
  obvious enough for you to leave it with.
- You are blocked, and the way past the block belongs to somebody else.

Do not hand off because a task is hard, or because you are partway through it. Those
are notes in your own daily note, not a handoff.

Handing off is not the same as stopping. The work is yours until somebody accepts
it. If nobody has answered, it is still yours, and chasing it is part of your job.

## What a handoff contains

Five things. Every one of them is something the next agent could not have worked out
for itself.

1. **The context.** What the work is, why it exists, and what has already been
   tried. Enough that the next agent does not have to reconstruct the problem from
   the artefacts alone.
2. **The acceptance criteria.** What "done" means, in terms that can be checked. Not
   "looks good" and not "works". If the criteria are written down somewhere, quote
   them rather than paraphrasing them.
3. **What success looks like.** The outcome, not the activity. "The sign-up form
   accepts a postcode in the project's date format" is an outcome. "Update the form"
   is an activity.
4. **Where the work lives.** The paths: the branch, the files, the draft, the query,
   the screenshots. If the next agent has to ask where the file is, the handoff is
   incomplete.
5. **What the next agent should do first.** The single next action. Not the whole
   plan: the one thing to do first, and what to check once it is done.

Write it down. A handoff that lives only in your head, or only in your last message,
is not a handoff.

## The template

Copy this into the project's record of the task: your daily note, the work folder,
or wherever the project keeps notes. A handoff is a note, not a ticket.

```markdown
## Handoff: <one line naming the work>

**To:** <agent>
**From:** <agent>

## Context
<why this work exists, what has been tried, what the next agent needs to know>

## Acceptance criteria
<what done means, in terms that can be checked>

## What success looks like
<the outcome, not the activity>

## Where the work lives
<paths: branch, files, draft, query, screenshots>

## Do this first
<the single next action, and what to check when it is done>
```

When you hand off, your own note says the same thing: the task, who holds it now,
and what you are waiting for. You do not close your own work, you move it to the
next person and say so. Read `agents/_shared/REPORTING.md` for who may close what.

**Never leave a task in a state where no one knows what comes next.**
