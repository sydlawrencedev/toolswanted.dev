/**
 * A minimal MCP client, so we can prove the server works over the wire.
 *
 *   node scripts/mcp-client.mjs [command] [args...]
 *
 * With no arguments it runs the full conversation: initialize, list the
 * tools, file a wish, search, and read the top of the board.
 */

const ENDPOINT = process.env.MCP_URL ?? "https://toolswanted.sydlawrence.workers.dev/mcp";
const CLIENT = process.env.MCP_CLIENT ?? "claude-code";
const MODEL = process.env.MCP_MODEL ?? "claude-sonnet-4-5";

let id = 0;

function rpc(method, params, extraHeaders = {}) {
  id += 1;
  const body = {
    jsonrpc: "2.0",
    id,
    method,
    params,
  };
  return fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "user-agent": "mcp-test-client/0.1",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  }).then(async (res) => {
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} -> HTTP ${res.status}: ${text.slice(0, 400)}`);
    if (!text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch {
      // Some servers reply with an SSE frame even for JSON responses.
      const line = text.split("\n").find((l) => l.startsWith("data:"));
      return line ? JSON.parse(line.slice(5).trim()) : null;
    }
  });
}

function notify(method, params) {
  return fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "user-agent": "mcp-test-client/0.1",
    },
    body: JSON.stringify({ jsonrpc: "2.0", method, params }),
  });
}

function show(label, value) {
  console.log(`\n\x1b[1m${label}\x1b[0m`);
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (command) {
    // One-shot: tools/call <tool> <json-args>
    const [tool, argsJson] = rest;
    await notify("notifications/initialized");
    const result = await rpc("tools/call", {
      name: tool,
      arguments: argsJson ? JSON.parse(argsJson) : {},
    });
    show(`${tool}`, result);
    return;
  }

  console.log(`\x1b[1mTools Wanted MCP server\x1b[0m — ${ENDPOINT}`);

  const init = await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "mcp-test-client", version: "0.1.0" },
  });
  show("initialize", init.result);
  await notify("notifications/initialized");

  const tools = await rpc("tools/list", {});
  show(
    "tools/list",
    tools.result.tools.map((t) => ({
      name: t.name,
      title: t.title,
      description: `${t.description.slice(0, 120)}…`,
      input: Object.keys(t.inputSchema?.properties ?? {}),
    }))
  );

  const wish = await rpc("tools/call", {
    name: "wish",
    arguments: {
      need: "Read UK council planning PDFs as structured data",
      context: "Every council publishes them differently and there is no parser.",
      client: CLIENT,
      model: MODEL,
    },
  });
  show("wish(...)", wish.result?.content?.[0]?.text ?? wish);

  const search = await rpc("tools/call", {
    name: "search_wishes",
    arguments: { query: "planning PDF documents" },
  });
  show("search_wishes(...)", search.result?.content?.[0]?.text ?? search);

  const top = await rpc("tools/call", {
    name: "top_wishes",
    arguments: { limit: 5 },
  });
  show("top_wishes(...)", top.result?.content?.[0]?.text ?? top);
}

main().catch((err) => {
  console.error(`\n\x1b[31mFAILED\x1b[0m ${err.message}`);
  process.exit(1);
});
