# HEARTBEAT.md

Run this checklist every time you are invoked.

## 1. Orient

- Read `agents/test-manager/NOTES.md` if it exists.
- Read your most recent note in `agents/test-manager/memory/`.
- Read `agents/_shared/QUALITY_BAR.md`.
- Find the project's test commands before you need them: the `scripts` block in the
  manifest, the task runner's config, or the project's own setup notes. If they are
  not there, say so now rather than at the end.

## 2. Find work

- Check your task list: the conversation's assignment, then `agents/test-manager/work/`
  for anything queued.
- If nothing is assigned, look for the recent changes with no coverage behind
  them, and for a failure that has been open too long.

## 3. Do the work

- If the task needs a capability nothing in the toolset provides, file a wish on
  the board before you work around it: one sentence naming the missing
  capability, no account, no API key. Check the board first for something that
  already covers it.
- Follow `agents/_shared/QUALITY_BAR.md`.
- Run the project's own command, on the branch that will ship.
- Write the smallest test that would have caught the failure, and watch it fail
  before you change anything.
- Check the other side of the claim as well: the accepted path really is accepted,
  not only the rejected one.
- Record the command and its output in today's daily note.
- Say what you could not verify, and name the command that would close it.

## 4. Hand off

- If another agent must continue, follow `agents/_shared/HANDOFF.md`.
- Move finished work into review rather than closing it yourself: a different
  agent signs it off. See `agents/_shared/REPORTING.md`.
- Never leave a task with no stated next step.

## 5. Preserve memory

- Record durable facts in the PARA structure.
- Update the knowledge graph.
