# REPORTING

Who reviews what, who signs it off, and who is allowed to close it.

The hierarchy is a convention about **who decides**. It is not about which tool
records the decision. A project with a task tracker records the review there. A
project without one records it in writing, next to the work. Either way the rules
below are the same.

## The hierarchy

Every agent reports to exactly one other agent, except the `ceo` agent — called the
founder here — which reports to the human project owner. Your reviewer is the agent
one line up from you.

The agent keys below are the directory names under `agents/` **in the kit**. This is
the full roster: a project installs the subset it selected, so a key that is not in
the project's `agents/` directory is one the project did not ask for. The keys are
the same identifiers used in the project config and in the generated harness files.

| Agent | Reports to | Owns |
|---|---|---|
| `ceo` | — | Direction, prioritisation, cross-team decisions. The top of the hierarchy. |
| `cto` | `ceo` | Technical direction, and the engineering line. |
| `tech-team` | `cto` † | The engineering lead. Code, infrastructure, security and release. |
| `frontend-engineer` | `tech-team` † | Frontend engineering. |
| `devops` | `tech-team` † | Infrastructure, deployment, environments. |
| `security-researcher` | `tech-team` † | Security research. |
| `version-control` | `tech-team` † | Version control, branching, releases. |
| `product-manager` | `ceo` | What gets built, and in what order. |
| `test-manager` | `ceo` | The quality gate. Verification and sign-off. |
| `design-delight` | `ceo` † | Design, delight and user research. |
| `motion-designer` | `design-delight` | Motion design and animation. |
| `biz-ops` | `ceo` † | Business operations. The numbers behind the decisions. |
| `customer-performance` | `biz-ops` | Customer outcomes, support and retention. |
| `gtm-owner` | `ceo` | Go to market. The channel everything else sells through. |
| `content-brand` | `gtm-owner` | Content and brand. |
| `storyteller` | `gtm-owner` | Narrative and story. |
| `publicist` | `gtm-owner` | Press and public. |
| `voice-over-artist` | `gtm-owner` | Voice and audio. |
| `growth` | `gtm-owner` | Acquisition, activation, retention. |
| `market-strategy-synthesizer` | `gtm-owner` | Market strategy. |
| `community-lead` | `ceo` † | Community and social. |
| `icp` | `product-manager` † | Who the product is for, and the evidence for it. |
| `business-experimenter` | `ceo` † | Whether a business idea is worth pursuing. |

† **The kit's own line.** Thirteen of the twenty-three lines above come straight from
the original reporting table. These ten are the kit's decisions, and they are marked
so that a reshaping is visible as a reshaping rather than hidden:

- `tech-team` to `cto`. The original table put the whole engineering line directly
  under the founder. The kit separates the technical lead from the engineering lead.
- `frontend-engineer` to `tech-team`. The original table named a "Tech Team Lead".
  The kit has one engineering lead, so the line points there.
- `devops`, `security-researcher` and `version-control` to `tech-team`. The original
  table did not cover these roles at all. They are engineering work, so they sit
  under the engineering lead.
- `design-delight` to `ceo`. The original table named this role as its own manager,
  which means it never had one. The kit lifts it to the founder.
- `community-lead` to `ceo`. The same problem, and the same fix.
- `biz-ops` to `ceo`. The same problem, and the same fix.
- `icp` to `product-manager`. The original table did not cover this role. It is
  customer research, so it sits under the product manager.
- `business-experimenter` to `ceo`. The original table did not cover this role. It
  decides whether a business idea is worth pursuing, which is a founder-level
  decision.

**The founder is an agent.** The `ceo` agent is not a human. The human project owner
sits above it. That distinction matters for one rule below, and it is the rule that
most often gets broken by accident.

## Review rules

1. **The agent that does the work moves it into review.** Not into done. Work that
   nobody else has looked at is not finished, however good it is.
2. **A different agent signs it off.** The reviewer is the agent one line up in the
   hierarchy above. One line, not two: the manager reviews, the manager's manager
   does not.
3. **An agent never approves its own work.** Nor its own request for work. If you
   need something approved, ask somebody else to ask for it.
4. **An item that needs a human decision is closed by a human.** No agent closes
   it, however senior. An agent can review such an item and recommend a decision;
   the human makes it.
5. **Say what you checked before you close it.** A close with no written reason
   behind it is indistinguishable from a close that nobody looked at.
6. **A closed item stays closed.** Do not add to it afterwards. If something turns
   out to be wrong, reopen it or raise a new one. A record that keeps changing after
   the decision is not a record of a decision.

**None of this is automatic.** A project does not enforce the convention for you.
The default state of a piece of work is unreviewed, and moving it into review is
something the agent does deliberately, every time.

## Who may close what

| The item | Who closes it |
|---|---|
| Work an agent produced | The reviewing agent, after the review. Never the author. |
| An agent's own request for work | The agent that receives it. The requester may not close its own request. |
| An item that needs a human decision | A human. Never an agent, the founder included. |
| The founder's own work | The human project owner. There is no line above the founder. |
| Work whose only possible reviewer is its author | Nobody. It goes up one line, to the author's manager. |

**Two reviewers where it matters.** Most work has one reviewer: the agent one line
up. Work that changes what a user sees, or what ships, gets a second: the Test
Manager, whose job is the quality gate. When the two are the same agent, one
reviewer does both jobs, and says so in the note.

**Escalate, do not self-approve.** If the only person who could review your work is
you, the answer is to raise it with the human project owner. It is never to close it
yourself.

**Before you close anything:** read `agents/_shared/QUALITY_BAR.md`. The review
checks the work against the acceptance criteria; the quality bar is what "done"
means. **Before you pass work to somebody else:** read `agents/_shared/HANDOFF.md`.
