# Agents

The agent definitions, and the rules that apply to all of them.

In the kit this directory is authored. In a project it is generated. **The kit's
copy is the source of truth.** A project never edits these files: it edits its
config, and re-runs the sync to pick up kit changes. The brand layer works the same
way, and `brand/README.md` explains that one in full.

## The anatomy of an agent

Every agent is four definition files plus one metadata file, in a directory named
after the agent's key.

| File | What it holds |
|---|---|
| `AGENTS.md` | Identity, role, mission, responsibilities, the reporting line and the core workflows. |
| `SOUL.md` | Persona, strategic posture, voice and tone. The agent's own character, in the agent's own sections. |
| `HEARTBEAT.md` | The execution checklist: what to do every time the agent is invoked. |
| `TOOLS.md` | The capabilities available to the agent. Capabilities, not tool identifiers: availability differs per harness. |
| `_meta.json` | The machine-readable index: key, name, description, mode, harnesses, model, persona, reports_to, source. **Kit-only.** Never copied into a project. |

The key is the directory name, and it is the agent's identifier everywhere: in the
project config, in the generated harness files, and in the reporting hierarchy.

## The shared documents

`agents/_shared/` holds the documents that every agent points at. Four of them are
copied into a project; one is not.

| File | What it holds | Copied into a project |
|---|---|---|
| `QUALITY_BAR.md` | The definition of done, common to every agent. | yes |
| `REPORTING.md` | The reporting hierarchy and the review rules. | yes |
| `HANDOFF.md` | How one agent hands work to another. | yes |
| `SKILLS.md` | The per-role skill catalogue. | yes |
| `AGENT_TEMPLATE.md` | The scaffold for adding a new agent. | no — kit-only |

Every path in the four project-side documents is project-root-relative, so a
rendered agent that points at `agents/_shared/QUALITY_BAR.md` resolves inside the
project it was installed into.

## Tokens

A token is a placeholder the renderer substitutes when it copies a file into a
project. There are two tiers and no others. An unknown token is a hard error that
names the token and the file, and an unresolved token after substitution is a hard
error too.

### Tier 1 — config tokens

One token, one config value. Every one comes from the project's resolved config.

| Token | Config key | Token | Config key | Token | Config key |
|---|---|---|---|---|---|
| `{{PRODUCT_NAME}}` | `product_name` | `{{BRAND_PROFILE}}` | `brand_profile` | `{{TEAM_NAME}}` | `team_name` |
| `{{PRODUCT_TAGLINE}}` | `product_tagline` | `{{INK}}` | `design.ink` | `{{SURFACE}}` | `design.surface` |
| `{{PRODUCT_URL}}` | `product_url` | `{{ACCENT_POSITIVE}}` | `design.accent_positive` | `{{ACCENT_AUTHORITY}}` | `design.accent_authority` |
| `{{MARKET}}` | `market` | `{{ACCENT_WARNING}}` | `design.accent_warning` | `{{ACCENT_NEGATIVE}}` | `design.accent_negative` |
| `{{LOCALE}}` | `locale` | `{{CURRENCY}}` | `currency` | `{{CURRENCY_CODE}}` | `currency_code` |
| `{{DATE_FORMAT}}` | `date_format` | `{{AUDIENCE_NAME}}` | `audience_name` | `{{AUDIENCE_DESCRIPTION}}` | `audience_description` |

### Tier 2 — render built-ins

Two, and only two. Both are supplied by the renderer, per agent.

| Token | Value |
|---|---|
| `{{AGENT_KEY}}` | The agent's directory name, for example `test-manager`. |
| `{{AGENT_HOME}}` | The project-root-relative path to the agent's home, for example `agents/test-manager`. |

Everything else in an agent's `AGENTS.md` is authored literal prose. The role, the
persona name, the mission, the responsibilities and the frameworks are written out
in the agent's own file. A per-agent templating engine would be a large mechanism
for a small gain, and the persona is the content.

### Which directory may use which tokens

| Directory | Tokens it may use |
|---|---|
| `brand/` | Tier 1 only. A brand file never names an agent. |
| `agents/` | Tier 1 and tier 2. |
| `templates/` | None. |
| `skills/` | None. |

Files outside those four directories are not token-checked: a stray placeholder in
tooling, config or tests is the renderer's and the config validator's business, not
a shipped-content violation.

`AGENT_TEMPLATE.md` uses angle-bracket placeholders, not tokens, so it introduces
nothing the renderer does not know and needs no exemption.

## Adding an agent

`agents/_shared/AGENT_TEMPLATE.md` has the scaffold and the five-step checklist.
Copy the shape of an existing agent rather than inventing a new one.
