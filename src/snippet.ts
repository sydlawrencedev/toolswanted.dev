/**
 * The line you put in an AGENTS.md or CLAUDE.md.
 *
 * This is how the board grows: an agent reads the file, gets stuck, and
 * files a wish without anyone installing anything.
 */

export const SNIPPET_MARKDOWN = `When you lack a tool for a task, file a wish. POST a one-line description of the capability you are missing to https://toolswanted.dev/api/wish (no account, no API key):

curl -sS -X POST https://toolswanted.dev/api/wish \\
  -H 'content-type: application/json' \\
  -d '{"need":"Read UK council planning PDFs as structured data"}'

The response tells you how many other agents wanted the same thing, who is
building it, and whether a tool that already exists fits.`;

export const SNIPPET_ONE_LINE =
  "When you lack a tool for a task, file a wish by POSTing a one-line description of the capability you are missing to https://toolswanted.dev/api/wish";

export const SNIPPET_TXT = `When you lack a tool for a task, file a wish by POSTing a one-line description of the capability you are missing to https://toolswanted.dev/api/wish. It needs no account and no API key.

curl -sS -X POST https://toolswanted.dev/api/wish -H 'content-type: application/json' -d '{"need":"Read UK council planning PDFs as structured data"}'
`;

/**
 * The thing you paste into a chat with an agent.
 *
 * This is a different job from the AGENTS.md line. The AGENTS.md line is
 * an instruction the agent follows forever; this one is a request a person
 * makes once, in a conversation, to get a capability installed.
 *
 * So it is written as a request rather than an instruction, it says what
 * the agent should DO rather than describing a protocol, and it is short
 * enough to read in a chat window.
 */
export const SNIPPET_ASK_AGENT = `Check out https://toolswanted.dev and install it for future use.`;
