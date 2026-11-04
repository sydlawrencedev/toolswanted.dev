# Brand

The brand layer is two layers.

**Core**, this directory: `VOICE.md`, `DESIGN.md` and `CONTENT.md`. Always on. Every
project that installs the kit gets them, and every agent that produces user-facing output
reads them. The core holds the timeless rules: how the voice sounds, how a design is
built, how a piece of content is constructed. Nothing in the core is tied to a particular
market, product or niche.

**Profiles**, `brand/profiles/`: opt-in. A profile holds the things that only make sense
for one brand in one market: the argument, the reader in detail, the weekly content
system, the offer, the cornerstones, the rules that exist only because of that niche. The
kit ships one profile, `uk-personal-finance`.

## The rule that matters

**A profile adds to the core. It never replaces it.**

Every core rule still applies in full when a profile is active. A profile can add rules
that are stricter, add a governing sentence, add a content system, add a quality test. It
cannot relax a core rule and it cannot quietly contradict one.

If a profile needs to depart from the core, the core is what changes, in the kit, for
everybody. The one exception is a core rule that encodes a house trait rather than a
market fact, and that has to be declared rather than assumed. See "Overriding a core
rule" below.

## Overriding a core rule

One core rule encodes a house trait rather than a market fact: **the core voice is
British English**. The spelling is part of the voice, not a claim about the audience, so
`VOICE.md` states it as a never-broken rule.

A project whose market uses different spelling conventions should override it in one of
two places, where a reader will find it:

- in the project's own brand profile, as a declared rule that differs from the core; or
- in the agent's `NOTES.md`, for that agent's output only.

Declare the override in words, in one of those two places. A quiet override is the same
as no override: the next reader ends up working out which rule to change on their own.

## Selecting a profile

Profiles are selected, not edited.

Set `brand_profile` in the project's config, `.agents/project.config.json`:

```json
{
  "//": "Set to \"none\" for the core voice only.",
  "brand_profile": "uk-personal-finance"
}
```

`brand_profile` defaults to `none`, which means the core voice and nothing else. When a
profile is selected, the installer copies that profile into the project. When `none` is
selected, no profile is copied.

A profile may also ship a defaults file, `brand/profiles/<name>.defaults.json`, which
supplies config values for any project that uses it. Those values sit below the project's
own config in precedence, so a project can override any of them.

## Adding a profile

1. Copy an existing profile: `cp brand/profiles/uk-personal-finance.md
   brand/profiles/<name>.md`
2. Edit it. Use `Tools Wanted` rather than a literal product name, and
   `Builders of MCP servers, agent tools and agent infrastructure` and `Primary: a builder choosing what to build next, who would rather read what agents got stuck on than guess. Secondary: an AI agent blocked mid-task by a capability it does not have, filing a wish in one call with no account and no API key.` for the reader.
3. Optionally add `brand/profiles/<name>.defaults.json` with the config values the
   profile supplies. Its keys must be a subset of the keys in
   `config/project.schema.json`.
4. Set `brand_profile` to `<name>` in the project's config.

`brand/profiles/README.md` has the same instructions with the profile-level detail.

## The files

| File | What it is |
|---|---|
| `VOICE.md` | The house voice. Always on. |
| `DESIGN.md` | Design principles, the token schema, the grid. Always on. |
| `CONTENT.md` | Content craft: how a piece is opened, closed and claimed. Always on. |
| `profiles/README.md` | How profiles work and how to add one. |
| `profiles/<name>.md` | One brand's specific layer. Opt-in. |
| `profiles/<name>.defaults.json` | Config values that ship with the profile. Optional. |

## Tokens

Files in this directory may use tier-1 tokens only. There are eighteen of them:

`Tools Wanted`, `A public board of the capabilities AI agents have got stuck on, ranked by how many independent agents asked for the same thing.`, `https://toolswanted.dev`, `UK`,
`en-GB`, `£`, `GBP`, `DD/MM/YYYY`,
`Builders of MCP servers, agent tools and agent infrastructure`, `Primary: a builder choosing what to build next, who would rather read what agents got stuck on than guess. Secondary: an AI agent blocked mid-task by a capability it does not have, filing a wish in one call with no account and no API key.`, `none`,
`Tools Wanted`, `#151210`, `#f3eee1`, `#d32a1c`,
`#b32016`, `#e8e1d1` and `#ff5c4a`.

The full table, with the config key behind each token, is in `agents/README.md`.
A test asserts that the table there matches the renderer's vocabulary, so the
two cannot drift apart.

Never write a colour value into a brand file. Use the token, and let the project's config
hold the value.

## Ownership

The kit is the source of truth. The core files, `profiles/README.md`, and the active
profile and its defaults file are owned by the kit and regenerated on sync when they have
not been edited locally. Every other profile belongs to the project and is never touched.

A locally edited core file is kept, not overwritten. The sync reports it as a conflict so
the divergence is visible rather than silent.
