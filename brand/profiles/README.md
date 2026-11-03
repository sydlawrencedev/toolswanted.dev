# Brand profiles

A profile is the part of the brand that only makes sense for one brand in one market. The
core voice and craft live one directory up, in `brand/VOICE.md`, `brand/DESIGN.md` and
`brand/CONTENT.md`, and they are always on. A profile is added on top of them.

The kit ships one profile: `uk-personal-finance`. A project may add its own under its own
`brand/profiles/`.

## The rule

**A profile adds to the core. It never replaces it.**

Every core rule still applies when a profile is active. A profile may add rules, add a
governing sentence, add a content system, add a quality test. It may not relax a core
rule and it may not contradict one. If a profile needs the core to be different, the core
changes in the kit, for everybody. The one exception is a declared override of a house
trait, and it has to be named in the profile or in the agent's `NOTES.md`. See
`brand/README.md`.

## What belongs in a profile

- **The governing sentence.** The one line every piece of content traces back to.
- **The argument.** The non-consensus claim that runs underneath the content, and why this
  brand is the one allowed to make it.
- **The reader.** The audience in detail, in this brand's own words.
- **The content system.** The recurring formats, the weekly calendar, the labels.
- **The offer.** How and when the ask is made.
- **The cornerstones.** The permanent pieces the brand is built on.
- **The niche rules.** The rules that exist only because of this market.
- **The quality test.** The profile's own version of the core test.

What does not belong in a profile: anything that would apply to any brand in any market.
If a rule would still be true for a different company in a different country, it is a core
rule, and it belongs one directory up.

## Adding a profile

1. Copy an existing profile:

   ```
   cp brand/profiles/uk-personal-finance.md brand/profiles/<name>.md
   ```

2. Edit it. Replace the product name with `Tools Wanted`, and the reader placeholders
   with `AI agent builders` and `Builders of MCP servers, agent tools and agent infrastructure, who want to know what to build next.`. Never write the product name
   as a literal: the profile is copied into projects whose product is not this one.

3. Optionally add `brand/profiles/<name>.defaults.json` with the config values the profile
   supplies. Its keys must be a subset of the keys in `config/project.schema.json`, and
   its values are the ones a project using this profile would otherwise have to invent.

4. Register it by setting `brand_profile` to `<name>` in the project's
   `.agents/project.config.json`:

   ```json
   {
     "brand_profile": "<name>"
   }
   ```

5. Re-run the installer, or the sync command, for the project.

## Selecting and switching

`brand_profile` defaults to `none`, which means the core voice only. Only the selected
profile is copied into a project, so a project never ships a profile nobody reads.

Switching the profile off and re-running the sync orphans the old profile files. They are
reported and left in place. Nothing is ever deleted.

## The files in a profile

| File | Purpose |
|---|---|
| `<name>.md` | The profile itself. |
| `<name>.defaults.json` | Optional. The config values the profile supplies. |
