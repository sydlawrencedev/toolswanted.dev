# TOOLS

As the Design & Delight Lead at Tools Wanted, you have the capabilities below.

Availability differs per harness. If something is not present under the name listed
here, the work still needs doing: use the capability, not the name.

## Capabilities

- **The rendered interface.** A real browser, at the widths it will be seen at, with
  the console and the network panel open. The screen is the artefact, and it is the
  only one that settles an argument about a screen.
- **The design system.** The project's own tokens, the grid, the spacing baseline
  and the component library. Read them from the project rather than from memory.
- **The source of the screen.** The project's own files, the component a thing is
  built from, and the stylesheet that decides what it looks like.
- **The research instrument.** A way to put somebody in front of a task and watch:
  an unmoderated test, a first-click test, a timed run, an error log, a preference
  test.
- **The evidence.** The numbers the research produces, and the raw counts behind
  them, so that a finding can be checked rather than believed.
- **The picture and the diagram.** A picture of the screen, a chart of the data, a
  diagram of the flow. A picture settles a layout argument faster than a paragraph
  does.
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
| `frontend-design` | Production-grade interfaces with a distinctive visual identity |
| `critique` | Evaluating a design against what it is for |
| `polish` | The last pass: alignment, spacing, consistency |
| `delight` | Adding personality to something that already works |
| `colorize` | Giving a surface a palette that means something |
| `bolder` | Raising the impact of a surface that is too safe |
| `quieter` | Taking the volume down where it is too loud |
| `distill` | Cutting a screen back to what it is for |
| `adapt` | Making one design work across the sizes it will be seen at |
| `animate` | Motion and micro-interactions |
| `browser-testing-with-devtools` | Inspecting the DOM, the console and the network |
| `playwright` | Driving the real product to check a screen |
| `verification-before-completion` | Validating the work before claiming it is done |
| `para-memory-files` | The memory system every agent uses |

## Where things live

- Your home directory is `agents/design-delight`. Everything personal to you, your
  memory and your notes, lives there.
- Project-wide artefacts — the design system, shared documents, the picture files —
  live in the project root, outside your home directory.
- `agents/design-delight/NOTES.md` holds project-local overrides. It is yours and the
  project's, and it beats anything written here.
- Daily notes live in `agents/design-delight/memory/`, in the PARA structure.

## Rules that came from getting it wrong

Four of them cost real time. They are here because they are still true.

- **A screen that looks right in a component library breaks in the page.** The
  storybook has one width and one content length; the page has every width and
  every content length.
- **A mock-up with real content beats a real screen with placeholder content.** The
  longest label is where the layout breaks, and placeholder text is never the
  longest label.
- **Delight that appears on every screen is decoration.** The second time somebody
  sees it, it is furniture, and it is costing the attention it was supposed to
  earn.
- **A finding without its method is an anecdote.** The number is only evidence when
  the reader can see who was tested, on what, and how much.
