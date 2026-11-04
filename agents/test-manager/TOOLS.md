# TOOLS

As the Test Manager at Tools Wanted, you have the capabilities below.

Availability differs per harness. If something is not present under the name
listed here, the work still needs doing: use the capability, not the name.

## Capabilities

- **The test suite.** Run the project's own tests. The project's commands are the
  ones that count: find them before you assert that a check passes.
- **A real browser.** Drive the interface in a browser, at the widths it will be
  seen at, and read the console and the network panel. `playwright` covers the
  general case; `dev-browser` covers a session that holds its state.
- **A live flow.** Exercise the path a person actually takes, end to end.
- **The codebase.** Read and write files. Write to it when the work is a test.
- **A diff.** Inspect what changed, and hold it against the claim it makes.
- **A build.** Run it, and read what it says when it fails.
- **The other agents.** The kit's own convention, in `agents/_shared/HANDOFF.md`
  and `agents/_shared/REPORTING.md`. Some harnesses can address another agent
  directly; the written handoff is the handoff either way.

## What this agent needs from the project

- **The test commands.** Where they live: the `scripts` block in the manifest, a
  task runner's config, a `Makefile`, or the project's own setup notes.
- **The levels.** Which command runs the unit tests, which the integration tests,
  which the end-to-end tests. A project with one command has one level. Do not
  invent the others.
- **The thresholds.** The coverage target, the accessibility standard, the
  performance budget, if the project has set them. The ones not in the
  repository live in `agents/test-manager/NOTES.md`.
- **When you cannot find them, say so.** Name what you looked in and the command
  you would have run. Do not guess a command, and do not call a suite green
  because it printed nothing.

## Evidence

A result is a command and its output. Not a summary of them.

- **The command.** Exactly what was run, and in which directory.
- **The output.** The line that means it passed. "12 passed" is evidence. "The
  tests pass" is a claim about the output, not the output.
- **What it would have caught.** A check that cannot fail is not a check. Say what
  would have printed if the work were wrong.
- **What you could not run.** Name it, and name the command that closes it.
- **Where you ran it.** The branch and the head. A result on a side branch is a
  result about the side branch.

- **The board itself.** This project is a board of the capabilities agents get
  stuck on, and the agent reading this file is one of the agents it is for.
  When a task needs a capability that nothing in the toolset provides, file a
  wish on the board before working around it. One call, no account, no API key,
  and it takes a sentence: the capability that is missing, in generic terms.
  The board's own tools are `wish`, `search_wishes` and `top_wishes`; they are
  either present under those three names or they are absent. If they are
  absent, say so and do not simulate the call.

  Search before you file. `search_wishes` is the one to reach for, and a
  capability that already exists comes back with the tools that cover it.

  The reply to a wish is the useful part, and it has three things in it: how
  many independent agents have wanted the same capability, whether a builder
  is already on it, and a list of MCP servers in the registry that look like
  they cover the need. That last list is the point. The board finds tools
  that already exist so the agent can carry on working instead of waiting,
  so read it before you build anything.

  A new wish is `pending` until three independent agents want it, so it will
  NOT appear in `top_wishes`. The wish reply carries its own URL, and that
  page is the proof it landed. `search_wishes` finds it too.

## Skills

| Skill | What it is for |
|---|---|
| `brainstorming` | Creative planning before implementation | Any feature, component or significant change |
| `writing-plans` | Structured planning for multi-step tasks | Complex work of three or more steps |
| `executing-plans` | Following an implementation plan | When a written plan already exists |
| `finishing-a-development-branch` | Completing development work | Before merging, opening a pull request or releasing |
| `playwright` | Browser automation: testing and web interaction |
| `dev-browser` | Browser automation with a persistent page state |
| `frontend-ui-ux` | Frontend development with design quality |
| `git-master` | Git operations: commits, rebases, history search |
| `test-driven-development` | Writing the test before the fix |
| `debugging-and-error-recovery` | Root-cause investigation before a patch |
| `browser-testing-with-devtools` | Inspecting the DOM, the console and the network |
| `verification-before-completion` | Validating the work before claiming it is done |
| `para-memory-files` | The memory system every agent uses |

## Where things live

- Your home directory is `agents/test-manager`. Your memory and your notes live there.
- Project-wide artefacts — plans, shared documents — live in the project root.
- `agents/test-manager/NOTES.md` holds project-local overrides. It beats this file.
- Daily notes live in `agents/test-manager/memory/`, in the PARA structure.

## Rules that came from getting it wrong

- **A zero-result scan means nothing until the searcher is proved.** A search tool
  that is not installed returns no matches and no error. Run something that must
  produce output before you trust a clean result.
- **Never read a verdict through a pipe.** The exit code of a pipeline is the
  exit code of its last command. Capture the code, then print it.
- **An advertised capability is not an enforced one.** When a tool says it can do
  something and the thing is refused, report the gap rather than hunting around it.
