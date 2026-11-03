# DESIGN

Core design rules. Always on, in every project that installs this kit.

Read this before producing any visual or layout work: interface screens, marketing pages,
charts, decks, carousels, and the visual layer of a video.

The *values* live in the project's config, not in this file. The *names* live here, so the
rules stay the same while the palette changes.

## Principles

**Context-appropriate aesthetics.** The aesthetic serves the audience and the moment. The
same product can be one thing on a public page and another thing inside a logged-in app,
and both are right, because the context changed.

**Data density with clarity.** High information density without sacrificing readability.
Dense is not the same as cluttered. If a screen can carry the numbers and still be read at
a glance, it should.

**Visual hierarchy.** Clear typography and spacing to guide people through complex data.
If everything is emphasised, nothing is.

**Responsive grids.** A consistent 12-column grid for every layout, from the widest
desktop to the narrowest phone.

**Accessible data visualisation.** Charts and graphs with clear legends and tooltips.
Every mark carries a label a reader can get without hovering.

**Progressive disclosure.** Detailed data collapses until it is needed. The summary stays
visible; the workings are one click away.

**Consistent spacing.** A 4px baseline grid for vertical rhythm. Every spacing value is a
multiple of 4px.

### A worked example, not a default

One project shows what context-appropriate aesthetics means in practice.

A public surface in a neo-brutalist style: bold geometric type, hard edges with no
rounded corners, solid offset shadows, high contrast, 2px borders in #151210. An
authenticated product surface in a professional soft style: clean readable type, 1px
borders, subtle shadows, rounded corners on cards and inputs, generous whitespace.

Both sit on the same 12-column grid and the same 4px baseline. The palette is identical.
What changes is the register of the surface, not the system underneath it.

That is the shape of the rule: one system, two registers, chosen per context. The kit does
not prescribe either register. A project that is neither neo-brutalist nor soft is not in
violation.

## Whimsy

- Rare but impactful. A delight that every reader sees is not a delight, it is furniture.
- Subtle inside the working parts of the product, where the person is trying to get
  something done.
- Never distract from functionality.
- Delight through precision, not decoration.
- Respect the reader's time and intelligence.
- Delight through alignment and grid perfection. A thing that lands exactly where it
  should is quietly better than a thing that was added.

## UX research

**Test the function, not the form.** A person can like a layout and still not be able to
complete the task.

**Measure what matters.** Track user actions, not just opinions.

**Look for patterns in behaviour, not just stated preferences.** What people say they
want and what they actually do rarely match.

**Every insight must be actionable.** If it does not change a decision, it is not a
finding.

**If you can't measure it, don't test it.**

### Methods

- Unmoderated task completion tests
- First-click tests
- Time-on-task measurement
- Error rate analysis
- Preference testing, and only as an A/B

### The questions research answers

- Can people complete the core task?
- Where do they hesitate or fail?
- What is the most efficient path to completion?
- How does performance compare to the benchmark?
- What is the statistical significance of the finding?

### Presenting findings

- Ink and surface first: #151210 on #f3eee1. Colour only when it carries meaning.
- Clear typographic hierarchy.
- Data tables over charts, when the table is the clearer one.
- No decorative elements.
- Every finding carries its confidence interval.
- Positive data in #d32a1c, negative data in #ff5c4a, and the
  same choice everywhere.
- Numbers and dates are formatted for the market: £, en-GB,
  DD/MM/YYYY.

### Rules for the researcher

1. No leading questions.
2. Small sample sizes are better than no data.
3. If it is not statistically significant, it is not a finding.
4. Always include the margin of error.
5. Present data, not opinions.

## Token schema

Six colour tokens. The names live here. The values live in the project's config, so a
project can change its palette without editing a rule.

| Token | Config key | Role |
|---|---|---|
| `#151210` | `design.ink` | The primary ink: text, headings, borders. The default colour of everything that is not data. |
| `#f3eee1` | `design.surface` | The surface content sits on: page and card backgrounds. |
| `#d32a1c` | `design.accent_positive` | Growth, gains, positive outcomes, positive data series. |
| `#b32016` | `design.accent_authority` | Trust and expertise: the colour that marks the credible voice. |
| `#e8e1d1` | `design.accent_warning` | Alerts, caution, attention. |
| `#ff5c4a` | `design.accent_negative` | Losses, risks, negative data series. |

The accent roles are semantic, not decorative. A colour that means growth on one screen
means growth on every screen.

## Grids and spacing

- Every layout uses a 12-column grid.
- Vertical rhythm follows a 4px baseline grid. Every spacing value is a multiple of 4px.
- Spacing, not borders, does most of the work of separating things.
- On a dense data screen, the grid and the baseline are what make the density readable.
  Break them and the screen stops being scannable.
