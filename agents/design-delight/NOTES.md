# Design notes — Tools Wanted

Anything here overrides the defaults in the agent's definition for this project only.
It never overrides the brand layer.

## The display face

Archivo Black, and only Archivo Black, is the display face. It is already the
brand's face: the OG poster is drawn with it. The site was using the system
grotesque at weight 900, which is why the masthead read as a bold sans rather
than as a poster.

- The face is subset to Latin and compressed to WOFF2: 11KB, served from the
  Worker as an inlined data URL at `/font.css`.
- `scripts/build-font.mjs` regenerates `src/font.ts` from the source TTF. Run
  it after changing the font.
- The fallback is Arial Black, which is a real display face on every Windows
  and macOS machine, so the first frame is not a downgrade.
- **Archivo Black is a poster face.** It belongs at 36px and above. The `h1`
  uses it. The `h2` and `h3` do not: they are the body face at 700, because a
  section heading in a display face is a poster with a small poster inside it.
- Body text stays on the system stack. One webfont request, not two.

## The registers

The product is a single-column editorial surface. Two registers, chosen by what the
reader is here to do, not by brand.

| Surface | Register | Because |
|---|---|---|
| Board `/` | Loud | The reader's job is to stop and scan what agents want. |
| `/weekly` | Quiet | The reader is reading a table of numbers. |
| `/agents` | Quiet | The reader is doing a thing: paste a snippet, add a server. |
| `/admin` | Quiet | One person, doing a repetitive job, where a wrong Publish is the worst outcome. |
| `/about`, `/privacy` | Loud, softened | Prose. The masthead is fine; the sections are not shouting. |
| `/build` | Loud | This page sells the act of building. |
| Wish form `/wish` | Loud | One call, and it should feel like a call. |

The board card, the 3px offset shadow and the display masthead are the
product's signature. They belong on the board. They do not belong on a screen
somebody is working in.

## The token roles

The six tokens in `brand/DESIGN.md` are named for their meaning in the brand
system. This project uses two of them differently, and that is a deliberate
decision recorded here rather than a drift:

| Token | Value | How this project uses it |
|---|---|---|
| `accent_positive` | `#d32a1c` | The primary brand accent: links, buttons, headings, the logo. **Not** used to mean growth — the board has no growth series. |
| `accent_warning` | `#e8e1d1` | A neutral fill: nav hover, table headers, inline code, the sample panel. **Not** used to mean caution — nothing on this board is a warning. |

Two more colours are in use and are not in the six-token schema:

| Where | Value | Role |
|---|---|---|
| `--paper-2` | `#fffdf7` | The raised surface: cards, code blocks, tables. Lighter than `design.surface`, so the page background still reads as the surface. |
| `--ink-soft` | `#514a42` | The muted ink. Carries body copy, meta text and captions. |

If a seventh colour is ever needed, it is added here first, not on the screen.

## The layout

The 12-column grid does not apply to this product. Every surface is a single
column of content — the board is a stack of cards, the cluster page is a
column of panels, the weekly archive is one table. A 12-column grid would have
nothing to align against.

The governing constants are the two max-widths:

- `1040px` — `.wrap`, the board and the page shell.
- `760px` — `.page`, the single-column prose and panel column.

The `.page` column is centred with `margin-left:auto;margin-right:auto`. It
was not, and every prose surface rendered hard against the left edge while the
board centred correctly. A child cannot centre its parent, so the margin has
to be on the parent.

The dense surfaces are the two tables. They get their own scroll container
rather than a grid, so the page itself never overflows.

## The top bar on a phone

Below 760px the nav is a three-column grid, two rows, and at 380px and under
it is two columns, three rows. Every destination is on screen.

It was a horizontal scroller. The six links came to 505px in a 288px space
at 320px, so "File a wish" and "About" ran off the right edge with nothing
but a mask gradient to say so. A fade is not an affordance: it says "there is
something here" without saying what, and it leaves a keyboard user with no
way to know the nav scrolls at all.

The nav height is a token, `--topbar-h`, because the filter bar sticks below
it and the two have to agree. The value changes at each breakpoint, so the
token changes with it: 146px at 760px and under, 190px at 380px and under.

## The tally on the board card

The count of agents is a block of ink with the number set into it, the same
shape the rank badge uses. It sits to the right of the title on a wide
screen and becomes a full-width strip below the title under 560px.

It was a bare figure set to the right of the title. A short title left a wide
hole between it and the far edge of the card, and the number read as a second
headline competing with the title rather than as the count it was. As a block
it fills that space with a shape the register already uses.

## The copy button

The button sits inside the code block, on the dark, in its own grid column.
The code takes the first column and the button the second.

It floated over the top right corner of the block, and the space reserved for
it was a hard-coded 96px. The button on the weekly page is 105px wide, so the
tail of the badge URL ran underneath it and was hidden behind the label. A
reserved width cannot fix this: it is wrong the moment a label is longer than
the value it was written for. A grid column cannot be wrong that way.

On a screen under 520px the button takes a row of its own above the code,
right aligned, because a button in a column would squeeze the code too far.

## The baseline

Every spacing value is a multiple of 4px. The exceptions are border widths
(1px, 2px, 3px) and the visually-hidden utility, which are not spacing.

The radius is 2px. The hard-edged character comes from the 1px and 2px
borders and the 3px offset shadow, not from the radius.

## Touch targets

Every standalone control is at least 44px tall: the nav links, the buttons,
the filter chips, the copy button, the client select, the footer links and
the form fields. A link inside a sentence is a word in a sentence, and is
left at its natural size.

## Accessibility standard

WCAG 2.2 AA, measured against the real foreground/background pairs rather
than the tokens in isolation.

- **Minimum type size: 12px.** Nothing is set below it. 11px was the old floor
  and it carried the board's key labels. Inline code was a rounding accident:
  a code block is 13px and the inline rule was .92em of it, which is 11.96px.
  It is 12px exactly now.
- **Contrast: 4.5:1** for body text, **3:1** for large text and UI component
  boundaries. Every pair on every page passes in both themes. The dark-mode
  border colour is `#726859` specifically because it clears 3:1 against both
  dark surfaces.
- **Every page has exactly one h1**, and heading levels do not skip.
- **Tables scroll**, they do not overflow the document.
- **A count and a date never break across lines.** They are single values,
  and a table where every row is twice as tall as the text in it stops
  being scannable.
- The code block has its own colours in dark mode. It does not follow the
  ink/paper swap, which would turn it into a bright slab on a dark page.
  Inline code inside a code block inherits the block's colours; the
  specificity has to be `.page pre code`, or the inline rule wins and the
  code renders as dark text on a dark panel.
- The logo is 19px, not 18px. At 18px the red falls below the large-text
  threshold and fails AA.

## Getting things off the page

Every snippet on this product exists to be pasted somewhere, so every snippet
has a copy button. The code stays selectable by hand, so the button is a
shortcut and not a requirement.

The button is a plain `<button>` with the text in a `data-copy` attribute and
one small script that wires up every button on the page. The clipboard API
needs a secure context, so there is a fallback through a hidden textarea and
`document.execCommand('copy')`.

The page that carries the most important snippet of all is the one that asks
a person to send a line to their agent:

    Check out https://toolswanted.dev and install it for future use.

That is different from the AGENTS.md line, which is an instruction an agent
follows forever. The one above is a request a person makes once, in a chat,
to get a capability installed. It is a request, it says what the agent should
do rather than describing a protocol, and it is short enough to read in a
chat window.

## What is deliberately not here

There is no component library, no CSS framework and no build step. The board
is hand-rolled SSR because it has to render inside the free plan's 10ms CPU
budget. Adding a framework would cost more than every problem it solved.

There is no dark-mode toggle in the CSS. Dark mode follows
`prefers-color-scheme`; the `data-theme` overrides exist for the button that
is not wired up yet.
