/**
 * Capture the raw JSON-RPC exchange with the MCP server, for the record.
 *
 *   node scripts/transcript.mjs
 *
 * If your network cannot resolve the apex (a stale local resolver, say),
 * set MCP_IP to one of its addresses and the TLS name is still checked
 * properly:
 *
 *   MCP_IP=104.21.43.222 node scripts/transcript.mjs
 */

import https from "node:https";
import tls from "node:tls";

const ENDPOINT = process.env.MCP_URL ?? "https://toolswanted.dev/mcp";
const FORCE_IP = process.env.MCP_IP;

const target = new URL(ENDPOINT);

/** POST a JSON-RPC message and return the raw response body. */
function rpc(message) {
  const body = JSON.stringify(message);
  return new Promise((resolve, reject) => {
    const options = {
      method: "POST",
      hostname: target.hostname,
      path: target.pathname + target.search,
      port: 443,
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "user-agent": "claude-code/2.1.316",
        "content-length": Buffer.byteLength(body),
      },
      ...(FORCE_IP
        ? {
            // Same TLS name, resolved to a known address.
            servername: target.hostname,
            lookup: (hostname, options, callback) => {
              if (typeof options === "function") {
                callback = options;
                options = {};
              }
              // Node 20+ asks for every address at once.
              if (options && options.all) {
                callback(null, [{ address: FORCE_IP, family: 4 }]);
              } else {
                callback(null, FORCE_IP, 4);
              }
            },
          }
        : {}),
    };
    const req = https.request(options, (res) => {
      let text = "";
      res.on("data", (chunk) => (text += chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function notify(method, params) {
  const body = JSON.stringify({ jsonrpc: "2.0", method, params });
  await new Promise((resolve, reject) => {
    const options = {
      method: "POST",
      hostname: target.hostname,
      path: target.pathname + target.search,
      port: 443,
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "user-agent": "claude-code/2.1.316",
        "content-length": Buffer.byteLength(body),
      },
      ...(FORCE_IP
        ? {
            servername: target.hostname,
            lookup: (hostname, options, callback) => {
              if (typeof options === "function") {
                callback = options;
                options = {};
              }
              // Node 20+ asks for every address at once.
              if (options && options.all) {
                callback(null, [{ address: FORCE_IP, family: 4 }]);
              } else {
                callback(null, FORCE_IP, 4);
              }
            },
          }
        : {}),
    };
    const req = https.request(options, (res) => {
      res.resume();
      res.on("end", resolve);
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
  console.log(`\n\x1b[2m→ notification ${method}\x1b[0m`);
}

let id = 0;
async function call(method, params, label) {
  id += 1;
  const request = { jsonrpc: "2.0", id, method, params };
  const res = await rpc(request);
  console.log(`\n\x1b[2m→ ${label}\x1b[0m`);
  console.log(`\x1b[2mPOST ${ENDPOINT}\x1b[0m`);
  console.log(JSON.stringify(request, null, 2));
  console.log(
    `\x1b[2m← HTTP ${res.status} ${res.headers["content-type"] ?? ""}\x1b[0m`
  );
  const text = res.text.trim();
  let shown = text;
  try {
    shown = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    const line = text.split("\n").find((l) => l.startsWith("data:"));
    if (line) shown = JSON.stringify(JSON.parse(line.slice(5).trim()), null, 2);
  }
  console.log(shown.length > 3000 ? `${shown.slice(0, 3000)}\n… (truncated)` : shown);
  return text;
}

async function main() {
  console.log("\x1b[1mTools Wanted — MCP transcript\x1b[0m");
  if (FORCE_IP) console.log(`\x1b[2m(resolving ${target.hostname} to ${FORCE_IP})\x1b[0m`);

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
  console.error(`\n\x1b[31mFAILED\x1b[0m ${err.message}`);
  process.exit(1);
});
