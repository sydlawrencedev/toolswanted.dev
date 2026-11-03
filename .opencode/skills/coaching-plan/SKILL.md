---
name: coaching-plan
description: >
  Generate a personalised coaching plan from interview notes. Use this skill
  whenever a coaching intake interview has happened and the deliverable is a
  plan for one person: parse the notes into client data, write the editable
  markdown plan, then produce the finished document from the edited markdown.
---

# Coaching Plan Generator

## Purpose

Generate a personalised coaching plan (a finished document plus editable markdown) from pasted interview notes. Invoked by the biz-ops agent after a coaching interview with a client.

**The key workflow:** Generate markdown first → edit if needed → produce the final document. This lets you tweak the narrative, actions, and goals before finalising.

---

## When to Use

After conducting a coaching intake interview. Paste the full interview notes (a meeting transcript, handwritten notes, or any format) and receive:
1. An **editable markdown file** you can tweak
2. A **finished document** generated from that markdown — a PDF where the project has a renderer, the markdown itself where it does not

---

## Input

Raw text notes from the coaching session. May include:
- A meeting transcript
- Handwritten or typed notes
- Client name, age, family situation
- Financial data: assets, liabilities, income, expenses
- Goals mentioned or implied
- Pain points or specific concerns
- Existing accounts or providers

**Tip:** The parser extracts more data when notes use explicit patterns like:
- Name + age: "Stephen, age 43" or "Stephen (43)"
- Money: "2M", "1.8M", "200k"
- Goals: "retirement", "savings", "kids", "education"

---

## Output

Two files are generated:

1. **Markdown file** (`coaching-plans/{ClientName}_{YYYY-MM-DD}.md`) — editable, human-readable. You can tweak the narrative, adjust action priorities, add notes, or modify goal considerations before producing the final document.

2. **Final document** (`coaching-plans/{ClientName}_{timestamp}.pdf`) — the deliverable generated from the markdown.

### Markdown Format

The markdown follows this structure (editable after generation):

```markdown
# Coaching Plan: {ClientName}
**Date:** {DD Month YYYY}

## Narrative
{personalised narrative in the brand voice}

## Know where you are
*All figures are estimates — verify with up-to-date account data*
*Amounts carry no currency symbol — use the project's currency*

- **Total Assets:** {amount}
  | Account | Value |
  | Label | Value |
- **Annual Income:** {amount} (before-tax)
- **Annual Expenses:** {amount}

## Goals
### {Goal 1}
### {Goal 2}

## Actions
- **[HIGH]** Action description
  - *Reason/consideration*
  - *Additional detail*
  - {link to a relevant guide}
- **[MEDIUM]** Action description
  - *Reason*
- **[LOW]** Action description
  - *Reason*

doNothingPrice: {amount} over {years}
doNothingDesc: Description of the cost of inaction
```

### Action Format

Actions are formatted with priority badges and multi-line reasons:

```
- **[HIGH]** Review your investment provider's fee structure
  - *At 1.8% a year, you are likely paying <b>36,000 a year</b>. At your asset level, understanding what you're paying for, and comparing it to alternatives, may be worth exploring.*
  - *At 10% annual growth, the real cost of fees on your portfolio is around <b>3.7 million</b> after 20 years of compounding.*
  - *Low-cost index funds and ETFs are one option some investors consider for fee reduction.*
  - *{link to a relevant guide}*
```

---

## Step-by-Step Workflow

### Step 1: Generate (parse notes → create markdown + JSON preview)

The work is the same whether a service does it or you do it.

**With a service**, POST the notes to the project's coaching-plan endpoint:

```bash
curl -X POST <coaching-plan-service>/plan/generate \
  -H "Content-Type: application/json" \
  -d '{ "notes": "..." }'
```

That returns JSON and saves a markdown file to `coaching-plans/{ClientName}_{YYYY-MM-DD}.md`.

**Without one**, extract the client data from the notes yourself, write the markdown file in the format above, and return the same JSON next to it.

Either way you end up with an editable markdown file and a JSON object to check the numbers against:

```json
{ "clientName": "...", "planDate": "...", "narrativeSummary": "...", "actions": [], "goals": [], "totalAssets": 0, "annualIncome": 0, "annualExpenses": 0 }
```

### Step 2: Review and edit the markdown

Open and edit the generated markdown file:
```
coaching-plans/{ClientName}_{YYYY-MM-DD}.md
```

You can:
- Tweak the narrative voice or wording
- Adjust action priorities (HIGH / MEDIUM / LOW)
- Add or remove actions
- Edit goal considerations
- Add personalised links or notes
- Update the financial snapshot numbers

### Step 3: Produce the final document from the edited markdown

Send the edited markdown back through the renderer. With a service:

```bash
curl -X POST <coaching-plan-service>/plan/document \
  -H "Content-Type: application/json" \
  -d '{ "markdown": "$(cat coaching-plans/{ClientName}_{YYYY-MM-DD}.md)" }' \
  -o {ClientName}-coaching-plan-{YYYY-MM-DD}.pdf
```

Without one, render the markdown with whatever the project already uses — a headless browser, a document pipeline, a template. The markdown is the deliverable where there is no renderer, and shipping it beats shipping nothing.

---

## Interface Reference

Whatever does the parsing must return this, whether it is an HTTP service, a script, or a person reading the notes.

### Plan data + markdown
```
Input: the raw notes
Returns: JSON { clientName, planDate, narrativeSummary, actions[], goals[], totalAssets, annualIncome, annualExpenses }
Side effect: writes coaching-plans/{ClientName}_{YYYY-MM-DD}.md
```

### Final document from edited markdown
```
Input: the full markdown content, or the structured plan data
Returns: the finished document
Side effect: writes it alongside the markdown in coaching-plans/
```

### Document only (skip the markdown editing step)
```
Input: the raw notes
Returns: the finished document
Side effect: none — no markdown is saved
```

---

## Example

**Input:**
```
Stephen, age 43. Two kids ages 8 and 4.
~2M with one investment provider (1.8M main + 200k in a tax-deferred account)
House worth 2.5-2.8M, owned outright
Partner earns ~200k a year (variable)
Retirement savings — combined under 200k
No retirement or investment accounts set up for the kids
Anxiety about money — avoids looking at the numbers
Provider charging ~1.5% a year on assets = 30k+ a year
No holistic plan — does not know the burn rate
```

**Step 1** → generates markdown + JSON with actions:
- [HIGH] Review the investment provider's fee structure
- [HIGH] Set up retirement or investment accounts for the children
- [MEDIUM] Set up a monthly money review
- [MEDIUM] Review retirement savings
- [MEDIUM] Review life insurance and protections
- [LOW] Experiment with different scenarios

**Step 2** → edit markdown to add personal touches or adjust actions

**Step 3** → produce the final document from the edited markdown

---

## Technical Details

### Key functions

- `parseNotes(notes)` — extracts client data from raw text
- `matchGoals(parsed)` — maps detected goals to goal considerations
- `generateActionList(parsed)` — builds a prioritised action list
- `generateNarrativeSummary(parsed, goals, actions)` — writes the narrative in the brand voice
- `planToMarkdown(planData)` — converts plan data to editable markdown
- `markdownToPlan(markdown)` — parses edited markdown back to plan data
- `renderDocument(data)` — renders the finished document from the template and the data

### Output

`coaching-plans/` — one markdown file and one finished document per client, named
`{ClientName}_{YYYY-MM-DD}`.

---

## Brand Alignment

All output follows the project's brand guidelines:
- The voice rules in `brand/VOICE.md` — spelling, locale, no em dashes
- The project's currency for every amount
- ICP-aligned voice: direct, warm, specific
- The project's visual style for the rendered document
- The project's date format
