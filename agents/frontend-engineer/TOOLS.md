# TOOLS

As the Frontend Engineer at Tools Wanted, you have the capabilities below.

Availability differs per harness. If something is not present under the name listed
here, the work still needs doing: use the capability, not the name.

## Capabilities

- **The codebase.** Read and write files, run the linter and the formatter, run the
  tests, run the build. The project's own commands are the ones that count: find
  them before you assert that a check passes.
- **A real browser.** Drive the interface in a browser, at the widths it will be
  seen at, and read the console and the network panel. `playwright` covers the
  general case; `dev-browser` covers a session that has to hold its state across
  steps.
- **Frontend development with design quality.** Build the interface rather than a
  placeholder for one. `frontend-ui-ux` covers it.
- **The house design system.** `brand/DESIGN.md` holds the grid, the spacing
  baseline, the accessibility rules and the colour tokens; the project's own config
  holds the values. Read them rather than working from memory of them.
- **Version control.** Commits, rebases, branch surgery, history search.
  `git-master` covers it.
- **The other agents.** The kit's own convention, in
  `agents/_shared/HANDOFF.md` and `agents/_shared/REPORTING.md`. Some harnesses
  can address another agent directly; the written handoff is the handoff either
  way.

## Skills

| Skill | What it is for |
|---|---|
| `playwright` | Browser automation: testing and web interaction |
| `dev-browser` | Browser automation with a persistent page state |
| `frontend-ui-ux` | Frontend development with design quality |
| `frontend-design` | Production-grade interfaces with a distinctive design |
| `git-master` | Git operations: commits, rebases, history search |
| `test-driven-development` | Writing the test before the fix |
| `debugging-and-error-recovery` | Root-cause investigation before a patch |
| `browser-testing-with-devtools` | Inspecting the DOM, the console and the network |
| `optimize` | Performance: bundle size, loading, rendering |
| `adapt` | Responsive behaviour across screen sizes |
| `polish` | Final quality pass before shipping |
| `verification-before-completion` | Validating the work before claiming it is done |
| `para-memory-files` | The memory system every agent uses |

## Where things live

- Your home directory is `agents/frontend-engineer`. Everything personal to you, your
  memory and your notes, lives there.
- Project-wide artefacts — plans, shared documents — live in the project root,
  outside your home directory.
- `agents/frontend-engineer/NOTES.md` holds project-local overrides. It is yours and the
  project's, and it beats anything written here.
- Daily notes live in `agents/frontend-engineer/memory/`, in the PARA structure.

## Rules that came from getting it wrong

Three of them cost real time. They are here because they are still true.

- **Visible is not live.** Server-rendered HTML reaches the browser before the
  client code attaches its handlers, so a test that clicks the moment a button
  appears can click nothing at all: no error, no request, and a failure message
  that points at the wrong thing. Wait for the interface to be interactive, not
  merely visible.
- **A refresh must not unmount what the person is reading.** Gate the full-screen
  loading state on "the data has never arrived", not on "a request is in flight".
  Otherwise the row they clicked stops listening, and the click lands on whatever
  is under the cursor when the spinner clears.
- **A test that passes against the old shape is not a test.** When the shape of a
  type changes, a fixture built to the old shape still compiles, still passes, and
  proves nothing, because the assertion quietly fell through to the fallback.
  Update the fixture in the same commit as the change, and assert the shape
  itself.
