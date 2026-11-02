/**
 * Capture the raw JSON-RPC exchange with the MCP server, for the record.
 *
 *   node scripts/transcript.mjs
 */

const ENDPOINT = process.env.MCP_URL ?? "https://toolswanted.sydlawrence.workers.dev/mcp";

let id = 0;

async function call(method, params, label) {
  id += 1;
  const request = { jsonrpc: "2.0", id, method, params };
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "user-agent": "claude-code/2.1.316",
    },
    body: JSON.stringify(request),
  });
  const text = await res.text();
  console.log(`\n\x1b[2m→ ${label}\x1b[0m`);
  console.log(`\x1b[2mPOST ${ENDPOINT}\x1b[0m`);
  console.log(JSON.stringify(request, null, 2));
  console.log(`\x1b[2m← HTTP ${res.status} ${res.headers.get("content-type") ?? ""}\x1b[0m`);
  const parsed = text.trim().startsWith("{") ? JSON.stringify(JSON.parse(text), null, 2) : text;
  console.log(parsed.length > 3000 ? `${parsed.slice(0, 3000)}\n… (truncated)` : parsed);
  return text;
}

async function notify(method, params) {
  await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "user-agent": "claude-code/2.1.316",
    },
    body: JSON.stringify({ jsonrpc: "2.0", method, params }),
  });
  console.log(`\n\x1b[2m→ notification ${method}\x1b[0m`);
}

async function main() {
  console.log("\x1b[1mTools Wanted — MCP transcript\x1b[0m");

  await call(
    "initialize",
    {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "claude-code", version: "2.1.316" },
    },
    "initialize"
  );
  await notify("notifications/initialized", {});

  const toolsText = await call("tools/list", {}, "tools/list");
  const tools = JSON.parse(toolsText).result.tools;
  console.log(`\n\x1b[2m(tools: ${tools.map((t) => t.name).join(", ")})\x1b[0m`);

  await call(
    "tools/call",
    {
      name: "wish",
      arguments: {
        need: "Read UK council planning PDFs as structured data",
        context: "Every council publishes these in a different layout and there is no parser.",
        client: "claude-code",
        model: "claude-sonnet-4-5",
      },
    },
    "tools/call wish"
  );

  await call(
    "tools/call",
    { name: "search_wishes", arguments: { query: "planning PDFs" } },
    "tools/call search_wishes"
  );

  await call(
    "tools/call",
    { name: "top_wishes", arguments: { limit: 3 } },
    "tools/call top_wishes"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
