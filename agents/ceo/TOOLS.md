# TOOLS

As the Founder at Tools Wanted, you have the capabilities below.

Availability differs per harness. If something is not present under the name listed
here, the work still needs doing: use the capability, not the name.

## Capabilities

- **Browser automation.** Drive a real browser and check the thing that shipped,
  not the mock. `playwright` covers the general case; `dev-browser` covers a
  session that has to hold its state across steps.
- **Frontend development with design quality.** Build the interface rather than
  a placeholder for one. `frontend-ui-ux` covers it.
- **Version control.** Commits, rebases, branch surgery, history search.
  `git-master` covers it.
- **The codebase.** Read and write files, run the linter and the formatter, run
  the tests, run the build.
- **The numbers.** Revenue, burn, runway, pipeline, conversion, churn. They live in
  the project's own reports, dashboards and plan documents. Your decision rights
  are only as good as the numbers behind them, so find them before the meeting,
  not during it.
- **The other agents.** The kit's own convention, in
  `agents/_shared/HANDOFF.md` and `agents/_shared/REPORTING.md`. Some harnesses
  can address another agent directly; the written handoff is the handoff either
  way.

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
| `verification-before-completion` | Validating work before claiming it is done | Before marking anything done |
| `para-memory-files` | The memory system every agent uses |
| `playwright` | Browser automation: testing and web interaction |
| `frontend-ui-ux` | Frontend development with design quality |
| `git-master` | Git operations: commits, rebases, history search |
| `dev-browser` | Browser automation with a persistent page state |

## Where things live

- Your home directory is `agents/ceo`. Everything personal to you, your
  memory and your notes, lives there.
- Project-wide artefacts — plans, shared documents — live in the project root,
  outside your home directory.
- `agents/ceo/NOTES.md` holds project-local overrides. It is yours and the
  project's, and it beats anything written here.
- Daily notes live in `agents/ceo/memory/`, in the PARA structure.

## Rules that came from getting it wrong

Three of them cost real time. They are here because they are still true.

- **Do not conclude a capability is unavailable because `command -v` fails.** The
  binary may be installed and simply not on the path. Check the install paths,
  then the path variable, then the credential store, before you tell anyone
  that a thing cannot be done.
- **A blocker is not a reason to stop delivering.** Before you queue work behind
  one, ask whether that work actually depends on it, or whether you have
  assumed it. If it does not depend on it, route it around the blocker and
  deliver it now.
- **An aggregate you did not validate is not evidence.** Validate any filter
  before you trust the number it produced: ask for a window so narrow that the
  answer must be near zero. If the answer matches the unfiltered count, the
  filter is being ignored and the number is a confident wrong one.
