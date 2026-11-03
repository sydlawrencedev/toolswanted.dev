# QUALITY BAR

The definition of done. It applies to every agent in this project and to every
deliverable, whatever the role. A designer, a writer and an engineer are held to the
same bar; only the shape of the evidence differs.

Read it before you start, not after you are about to claim something is finished.

## Evidence before assertion

Never mark something done without a check that could have failed.

A check that cannot fail is not a check. "The code looks right", "I reviewed it" and
"the tests pass" are evidence only when you can name the command you ran and the
result it gave. If you did not run it, you did not check it.

The evidence belongs next to the claim. A claim with no evidence attached is an
opinion, and an opinion in a status update is indistinguishable from a verified
result. So:

**Before you write "done", be able to answer these three questions.**

1. What did you run?
2. What did it print?
3. What would it have printed if the work were wrong?

If you cannot answer the third, you have not verified anything. Say what you did
instead of implying you did more than you did.

The same rule applies to reading. When you review someone else's work, the claim you
are checking is "this works". To check it, run something that would have failed if it
did not.

## No fabrication

Never invent a number, a quote, a user, a result or a citation.

This applies to every artefact, not only to published copy: a figure in a report, a
quote from a customer, a name in an example, a metric in a chart, a reference in a
document, a screenshot you describe from memory. If the number is not known, say it
is not known. If an example is illustrative, label it as illustrative.

A fabricated detail is worse than a missing one, because a reader cannot tell which
it is. Everything else in this file exists to make sure a reader can trust the next
thing you say.

For user-facing copy the bar is stricter still: a number that cannot be verified does
not appear at all, not as an approximation and not with a hedge. That rule lives in
`brand/VOICE.md` and it is not relaxed here.

## Specific over general

Prefer one concrete example over three general ones.

"Improved performance" says nothing. "The list view loads in 400ms instead of 2.1s"
says what changed and can be checked by someone else. General claims cost the reader
more, because the reader has to work out what you meant before they can use it.

The same rule applies to how you write about the work. Name the file, the command,
the function, the screen, the line number, the setting. Name the customer, the
channel, the date.

**The test:** could a reader repeat your check without asking you a question?

## The smallest test

Add the smallest test that would have caught the bug.

A bug that shipped had a hole in the checks. The fix is not only the change that
makes the symptom go away; it is the check that would have failed before that change.
If you cannot write that check, you do not know what you fixed, and you have not
stopped it happening again.

Keep it small. A test that reproduces the bug and nothing else is enough. It should
fail before the fix, pass after it, and still be there next month when someone
touches that code again.

**The same failure must not be paid for twice.** When something breaks, write down
three things: the failure mode (what actually went wrong), the detection signal (what
you would have looked at to see it coming), and the prevention rule (what stops it
happening again). A lesson that is not written down is a lesson that gets paid for
twice.

## State what you could not verify

If you could not run a verification, say so and give the exact command.

Do not quietly drop a check that did not run. Do not describe a check you skipped as
a check you passed. Write what you did not verify, and the exact command that would
verify it, so that whoever picks this up can close the gap in one step.

"Untested on mobile" is a gap. "Untested on mobile; run
`npm run test:e2e -- --project=mobile` to close it" is a task. The command is
illustrative; use the one your project actually has.

An unverified claim and a verified claim look identical in a summary. The difference
is one sentence saying which one this is. Write that sentence.

## Definition of done

A task is done when all three of these are true.

1. **The behaviour matches the acceptance criteria.** What was asked for is what was
   built. If the acceptance criteria changed along the way, say so explicitly, in
   the hand-off.
2. **The checks pass.** The smallest test that would have caught the bug is in place
   and passes. The existing suite passes. You can name both commands and both
   results.
3. **A short verification story exists.** Two or three sentences: what you changed,
   what you ran, what it printed, and anything you could not verify.

If any of the three is missing, the task is not done. It is in progress, and it
says so.

A task is also not done while it is waiting on somebody else. It is handed over, and
the hand-off says where it went. Read `agents/_shared/HANDOFF.md` before you hand
anything on, and `agents/_shared/REPORTING.md` before you close anything.
