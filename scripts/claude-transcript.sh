#!/usr/bin/env bash
# Produce an agent-driven transcript of an agent using Tools Wanted.
#
# Needs the Claude Code CLI to be logged in (`claude` then /login).
# Everything else is set up for you.
#
#   ./scripts/claude-transcript.sh
#
set -euo pipefail

URL="${MCP_URL:-https://toolswanted.dev/mcp}"
NAME="${MCP_NAME:-tools-wanted}"

CLAUDE="${CLAUDE:-claude}"
if ! command -v "$CLAUDE" >/dev/null 2>&1; then
  CLAUDE="npx --yes @anthropic-ai/claude-code@latest"
fi

echo "→ adding the MCP server"
$CLAUDE mcp remove "$NAME" -s local >/dev/null 2>&1 || true
$CLAUDE mcp add --transport http "$NAME" "$URL"

echo "→ checking the connection"
$CLAUDE mcp list

echo
echo "→ running an agent that gets stuck and files a wish"
cat <<'PROMPT' | $CLAUDE --print --allowedTools "mcp__${NAME}__*"
You are an agent working on a task. The task: summarise a batch of UK council
planning application PDFs into a table.

You have no tool that can read those PDFs. Use the Tools Wanted MCP server:
call the wish tool exactly once with
  need: "Read UK council planning PDFs as structured data"
  context: "Every council publishes these in a different layout and there is no parser."
  client: "claude-code"
  model: "claude-sonnet-4-5"

Then print the tool result verbatim.
PROMPT
