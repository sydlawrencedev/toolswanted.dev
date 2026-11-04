# SKILLS

Which skill to reach for, and when.

Three kinds of skill are in play, and `config/skills.json` is the registry that
says which is which. Each entry there carries a `class`:

- **kit** — the kit wrote it. It is installed into every project, from the kit's
  own `skills/` directory.
- **vendored** — somebody else wrote it and the kit carries a copy, byte for
  byte, from `vendor/skills/`.
- **host** — the environment provides it. The kit names it and ships nothing;
  a project inherits it from its harness.

If a `host` skill is not available in the environment you are running in, the
work still needs doing: use the capability, not the name.

Load a skill with the Skill tool. Do not guess at a skill's contents from its name,
and do not follow a recipe you have not read.

`node scripts/skills.mjs` checks the registry against the kit and against the
skills the agents name. It fails when they disagree, so a skill an agent names
that nobody ships cannot slip through unnoticed.

The sections below are the roles this kit ships. A section names the skills
that role's agent lists in its own `TOOLS.md`, so the two cannot drift.

## The board

The kit is installed by an operator who runs a board of the capabilities agents
get stuck on. The agent reading this file is one of the agents the board is for.

When a task needs a capability that nothing in the toolset provides, file a
wish before working around it. One call, no account, no API key, and it takes
one sentence: the capability that is missing, in generic terms.

| Tool | What it does |
|---|---|
| `wish` | Files a wish. Returns what the board already knows: how many independent agents wanted the same thing, whether a builder is on it, and whether a tool that already exists covers the need. |
| `search_wishes` | Searches the board by meaning. Use it before building something the board says already exists. |
| `top_wishes` | The capabilities agents have asked for most, each with the number of independent agents behind it. |

These are MCP tools, not skills, so they are not in the table below. They
arrive with the harness's MCP configuration. If the harness does not have
them, the work still needs doing: use the capability, not the name.

## Core process skills (all agents)

| Skill | Purpose | When to use |
|---|---|---|
| `para-memory-files` | Persistent memory and knowledge management | Remembering facts, writing daily notes, managing plans |
| `verification-before-completion` | Validating work before claiming it is done | Before marking anything done |
| `brainstorming` | Creative planning before implementation | Any feature, component or significant change |
| `writing-plans` | Structured planning for multi-step tasks | Complex work of three or more steps |
| `executing-plans` | Following an implementation plan | When a written plan already exists |
| `finishing-a-development-branch` | Completing development work | Before merging, opening a pull request or releasing |

## CEO

| Skill | Purpose | When to use |
|---|---|---|
| `playwright` | Browser automation: testing and web interaction | Seeing what a product actually does |
| `frontend-ui-ux` | Frontend development with design quality | When the decision is about an interface |
| `git-master` | Git operations: commits, rebases, history search | Version control |
| `dev-browser` | Browser automation with a persistent page state | A multi-step browser session |
| `para-memory-files` | The memory system every agent uses | Decisions and their reasons |

## Design and delight

| Skill | Purpose | When to use |
|---|---|---|
| `frontend-design` | Production-grade interfaces with a distinctive design | Building web components, pages, applications |
| `critique` | UX evaluation | Design reviews |
| `polish` | Final quality pass before shipping | Fixing alignment, spacing, consistency |
| `delight` | Adding moments of personality | Elevating something functional to something delightful |
| `colorize` | Strategic colour | Monochromatic or bland interfaces |
| `bolder` | Amplifying safe or boring designs | Increasing visual impact |
| `quieter` | Toning down aggressive designs | Reducing visual intensity |
| `distill` | Stripping to the essence | Removing unnecessary complexity |
| `adapt` | Responsive design across devices | Multi-screen adaptation |
| `animate` | Motion and micro-interactions | Adding purposeful motion |
| `browser-testing-with-devtools` | Inspecting the DOM, the console and the network | Diagnosing what the browser actually does |
| `playwright` | Driving the real product to check a screen | Checking a screen in the real product |
| `verification-before-completion` | Validating the work before claiming it is done | Before calling a screen done |
| `para-memory-files` | The memory system every agent uses | Design decisions and findings |

The UX review has its own step, separate from the screen review. It walks the
task somebody came to do, not the pixels of the screen they are looking at. It
always includes the exit: can the person take the thing they came for out of
the page and use it somewhere else. A page that shows a snippet, a URL, a
command or a badge and gives no way to take it with one action has a UX
defect, not a missing feature.

## Content and brand

| Skill | Purpose | When to use |
|---|---|---|
| `frontend-design` | Visual content creation | Creating pages and graphics |
| `geo` | Search optimisation, including for AI answer engines | Any content that should rank or be cited |
| `distill` | Simplifying complex content | Removing unnecessary complexity |
| `clarify` | Improving unclear copy | UX copy, error messages |
| `extract` | Reusable components and patterns | Identifying reusable elements |
| `normalize` | Design consistency | Matching a design system |
| `optimize` | Performance | Loading speed, assets |
| `stop-slop` | Removing AI writing patterns from a draft | Any piece of content before it ships |
| `remotion-best-practices` | Video and motion graphics, built programmatically | A rendered video |
| `video-generation` | Turning a script or a storyboard into a rendered video | Video from a written script |
| `playwright` | Browser automation: testing and web interaction | Seeing what a product actually does |
| `dev-browser` | Browser automation with a persistent page state | A multi-step browser session |
| `frontend-ui-ux` | Frontend development with design quality | When the decision is about an interface |
| `git-master` | Git operations: commits, rebases, history search | Version control |
| `para-memory-files` | The memory system every agent uses | Copy decisions and their reasons |

## Frontend engineer

| Skill | Purpose | When to use |
|---|---|---|
| `playwright` | Browser automation: testing and web interaction | Seeing what a product actually does |
| `dev-browser` | Browser automation with a persistent page state | A multi-step browser session |
| `frontend-ui-ux` | Frontend development with design quality | When the decision is about an interface |
| `frontend-design` | Production-grade interfaces with a distinctive design | Building web components, pages, applications |
| `git-master` | Git operations: commits, rebases, history search | Version control |
| `test-driven-development` | Test-driven development | Writing any new code feature |
| `debugging-and-error-recovery` | Rigorous root-cause investigation | Any bug, test failure or unexpected behaviour |
| `browser-testing-with-devtools` | Browser automation and end-to-end testing | Testing web interactions, form filling, real-browser checks |
| `optimize` | Performance improvement | Slow loading, rendering, bundle size |
| `adapt` | Responsive design across devices | Multi-screen adaptation |
| `polish` | Final quality pass before shipping | Fixing alignment, spacing, consistency |
| `verification-before-completion` | Validating the work before claiming it is done | Before calling a screen done |
| `para-memory-files` | The memory system every agent uses | Design decisions and findings |

## Customer research lead

| Skill | Purpose | When to use |
|---|---|---|
| `customer-research` | Working with customer research | Voice of customer, interviews, review mining |
| `ideal-customer-profile` | Defining who a product is for | Audience definition |
| `user-personas` | Creating refined personas | Segments and their needs |
| `user-segmentation` | Segmenting a user base | Behaviour, needs and jobs to be done |
| `sentiment-analysis` | Analysing user feedback | Theme extraction from feedback |
| `cohort-analysis` | Retention and engagement by cohort | Cohort behaviour |
| `summarize-interview` | Summarising an interview transcript | Turning an interview into findings |
| `deep-research` | Multi-source synthesis | The evidence behind a decision |
| `last30days` | What people are saying now | Recent discussion |
| `brainstorming` | Creative planning before implementation | Any feature, component or significant change |
| `verification-before-completion` | Validating work before claiming it is done | Before marking anything done |
| `para-memory-files` | The memory system every agent uses | Findings and their evidence |

## Test manager

| Skill | Purpose | When to use |
|---|---|---|
| `test-driven-development` | Test-first development | Writing tests before code |
| `debugging-and-error-recovery` | Bug investigation | Any test failure |
| `browser-testing-with-devtools` | Browser automation | End-to-end tests, regression testing |
| `verification-before-completion` | Quality validation | Before shipping |
| `playwright` | Browser automation: testing and web interaction | Seeing what a product actually does |
| `dev-browser` | Browser automation with a persistent page state | A multi-step browser session |
| `frontend-ui-ux` | Frontend development with design quality | When the defect is about an interface |
| `git-master` | Git operations: commits, rebases, history search | Version control |
| `para-memory-files` | The memory system every agent uses | Defects and their causes |

## Quick reference

### Before any task

- [ ] Use `brainstorming` for features and changes
- [ ] Use `writing-plans` for complex tasks

### Before marking done

- [ ] Use `verification-before-completion`

### For bug fixes

- [ ] Use `debugging-and-error-recovery` before proposing a fix

### For design work

- [ ] Use `frontend-design`
- [ ] Use `polish` before shipping

### For content

- [ ] Use `geo` for search

## Where skills live

- `.opencode/skills/` — skills for the OpenCode harness
- `.claude/skills/` — the same skills, for Claude Code

The kit installs its own skills into both. The environment's own skills are already
there, and the registry says which is which.
