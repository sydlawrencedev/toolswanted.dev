# SKILLS

Which skill to reach for, and when.

Two kinds of skill are in play. The kit installs its own into every project:
`para-memory-files`, the memory system, and `coaching-plan`. The rest are the
standard agent environment's skills, which a project inherits from its harness
rather than from the kit. If one of those is not available in the environment you are
running in, the work still needs doing: use the capability, not the name.

Load a skill with the Skill tool. Do not guess at a skill's contents from its name,
and do not follow a recipe you have not read.

## Core process skills (all agents)

| Skill | Purpose | When to use |
|---|---|---|
| `para-memory-files` | Persistent memory and knowledge management | Remembering facts, writing daily notes, managing plans |
| `verification-before-completion` | Validating work before claiming it is done | Before marking anything done |
| `brainstorming` | Creative planning before implementation | Any feature, component or significant change |
| `writing-plans` | Structured planning for multi-step tasks | Complex work of three or more steps |
| `executing-plans` | Following an implementation plan | When a written plan already exists |
| `finishing-a-development-branch` | Completing development work | Before merging, opening a pull request or releasing |

## Tech team

| Skill | Purpose | When to use |
|---|---|---|
| `test-driven-development` | Test-driven development | Writing any new code feature |
| `debugging-and-error-recovery` | Rigorous root-cause investigation | Any bug, test failure or unexpected behaviour |
| `browser-testing-with-devtools` | Browser automation and end-to-end testing | Testing web interactions, form filling, real-browser checks |
| `optimize` | Performance improvement | Slow loading, rendering, bundle size |
| `using-git-worktrees` | Isolated development | Feature work that needs isolation |

## Design and delight

| Skill | Purpose | When to use |
|---|---|---|
| `frontend-design` | Production-grade interfaces with a distinctive design | Building web components, pages, applications |
| `polish` | Final quality pass before shipping | Fixing alignment, spacing, consistency |
| `delight` | Adding moments of personality | Elevating something functional to something delightful |
| `colorize` | Strategic colour | Monochromatic or bland interfaces |
| `bolder` | Amplifying safe or boring designs | Increasing visual impact |
| `quieter` | Toning down aggressive designs | Reducing visual intensity |
| `distill` | Stripping to the essence | Removing unnecessary complexity |
| `adapt` | Responsive design across devices | Multi-screen adaptation |
| `animate` | Motion and micro-interactions | Adding purposeful motion |
| `critique` | UX evaluation | Design reviews |

## Content and brand

| Skill | Purpose | When to use |
|---|---|---|
| `frontend-design` | Visual content creation | Creating pages and graphics |
| `geo` | Search optimisation, including for AI answer engines | Any content that should rank or be cited |
| `geo-llmstxt` | AI crawler optimisation | Helping answer engines understand a site's content |
| `distill` | Simplifying complex content | Removing unnecessary complexity |
| `clarify` | Improving unclear copy | UX copy, error messages |
| `extract` | Reusable components and patterns | Identifying reusable elements |
| `normalize` | Design consistency | Matching a design system |
| `optimize` | Performance | Loading speed, assets |

## Growth

| Skill | Purpose | When to use |
|---|---|---|
| `twitter-thread-creation` | Threads and posts for X | Social posts |
| `linkedin-content` | LinkedIn posts | Professional content |
| `tiktok-captions` | TikTok content | Video captions and scripts |
| `youtube-thumbnail-design` | YouTube thumbnails | Video thumbnails |
| `instagram-content-generation` | Instagram content | Visual social content |
| `stop-slop` | Removing AI writing patterns | Any piece of content |
| `geo` | Search optimisation and brand visibility | Website content |

## Product manager

| Skill | Purpose | When to use |
|---|---|---|
| `brainstorming` | Feature planning | New features, roadmap planning |
| `onboard` | Onboarding flows | User onboarding, empty states |
| `audit` | Comprehensive quality review | Before a major release |
| `harden` | Error handling and edge cases | Making an interface robust |
| `critique` | Design evaluation | Reviewing designs |
| `clarify` | UX copy improvement | Labels, errors, instructions |

## Test manager

| Skill | Purpose | When to use |
|---|---|---|
| `test-driven-development` | Test-first development | Writing tests before code |
| `debugging-and-error-recovery` | Bug investigation | Any test failure |
| `browser-testing-with-devtools` | Browser automation | End-to-end tests, regression testing |
| `verification-before-completion` | Quality validation | Before shipping |

## Biz ops

| Skill | Purpose | When to use |
|---|---|---|
| `para-memory-files` | Tracking metrics | Storing key figures |
| `clarify` | Clear reporting | Data presentation |
| `distill` | Key insights | Extracting the point from the data |
| `coaching-plan` | Generates a personalised coaching plan from interview notes | After an intake interview, when the deliverable is a plan for one person |

## Community lead

| Skill | Purpose | When to use |
|---|---|---|
| `stop-slop` | Authentic communication | Community posts and replies |
| `clarify` | Clear engagement | Messages and responses |
| `onboard` | Community onboarding | Welcome flows |
| `delight` | Community experience | Adding personality |

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

- [ ] Use `stop-slop` to remove AI patterns
- [ ] Use `geo` for search

## Where skills live

- `.opencode/skills/` — skills for the OpenCode harness
- `.claude/skills/` — the same skills, for Claude Code

The kit installs its own skills into both. The environment's own skills are already
there.
