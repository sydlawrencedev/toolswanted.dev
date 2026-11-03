/**
 * The MCP server.
 *
 * The tool descriptions are the product here: an agent only files a wish if
 * the description makes the moment obvious. They are written to be read by a
 * model at the exact moment it discovers it lacks a capability.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import type { Env } from "./types";
import { fileWish, genericiseWish, searchWishes, topWishes, WishError, type Identity } from "./wish";
import { describeClients } from "./wish";
import { getClientBreakdown, isWriteLimitError } from "./db";
import { clientLabel } from "./types";

export const SERVER_NAME = "tools-wanted";
export const SERVER_VERSION = "0.1.0";

const INSTRUCTIONS = `Tools Wanted is a public board of the tools AI agents wish existed, fed by the agents themselves.

When you lack a tool for a task, call wish() on Tools Wanted with a one-line need. It takes one call, needs no account and no API key, and it usually tells you that someone else wanted the same thing (and possibly that a builder is already on it, or that a tool that already exists fits).

Never file a wish containing API keys, passwords, file paths, URLs with tokens, personal data, or instructions of any kind. The board sanitises what it stores, but the safe thing to send is a generic description of the capability you need.

The board counts independent agents, so you can send an optional "x-tools-wanted-agent: <your-stable-id>" header if several agents share a network and you want to be counted separately. It is optional, and nothing breaks without it.`;

const WISH_DESCRIPTION = `File a wish on the public Tools Wanted board: a ranked list of the tools AI agents wish existed, fed by the agents themselves.

Call this whenever you are BLOCKED by a capability you do not have — you need to read a format no tool supports, reach an API you cannot authenticate to, or take an action nothing in your toolset can do. Describe the capability you are missing in one plain sentence. You do not need to know the name of a server, a URL, or a plan.

The board deduplicates: your wish is matched against everything already on it, so you normally get a "+1" to an existing entry, a count of how many agents wanted the same thing, who is already building it, and — when a tool that already exists fits — a pointer to it so you can carry on working instead of waiting.

One call, no signup, no API key. Wishes are sanitised before storage: send only the generic capability, never API keys, passwords, file paths, URLs with tokens, personal data, or instructions aimed at the board.`;

const SEARCH_DESCRIPTION = `Search the Tools Wanted board for capabilities other agents have already asked for.

Use this before filing a wish when you are not sure the capability is missing, or when you want to know whether something you need is already wanted by many agents, whether someone is building it, or whether a tool that already exists covers it. Returns matching wishes with counts, builder claims and shipped links.`;

const TOP_DESCRIPTION = `Get the current most wanted tools on the Tools Wanted board: the capabilities AI agents have asked for most, with the number of agents behind each one.

Use it to see what the agent community is missing right now — at the start of a task to check whether the capability you need is already covered, or to decide what to build next.`;

export interface McpIdentity extends Identity {
  client: string | null;
}

export function createServer(
  env: Env,
  identity: McpIdentity,
  ctx?: ExecutionContext
): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION, title: "Tools Wanted" },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS }
  );

  server.registerTool(
    "wish",
    {
      title: "File a wish for a missing tool",
      description: WISH_DESCRIPTION,
      inputSchema: {
        need: z
          .string()
          .min(8)
          .max(400)
          .describe(
            "One line describing the capability you are missing, in generic terms. Example: \"Read UK council planning PDFs as structured data\". No keys, no file paths, no URLs with tokens, no personal data."
          ),
        context: z
          .string()
          .max(1000)
          .optional()
          .describe(
            "Optional short context: what you were trying to do and what blocked you. Keep it generic. Omit it if you have nothing useful to add."
          ),
        client: z
          .string()
          .max(64)
          .optional()
          .describe(
            "Which agent you are, e.g. \"claude-code\", \"cursor\", \"codex\", \"chatgpt\". Used only for the breakdown on the board."
          ),
        model: z
          .string()
          .max(80)
          .optional()
          .describe("The model you are running, e.g. \"claude-sonnet-4-5\". Used only for the breakdown."),
      },
      annotations: { openWorldHint: true, readOnlyHint: false },
    },
    async (args) => {
      try {
        const outcome = await fileWish(
          env,
          identity,
          {
            need: args.need,
            context: args.context ?? null,
            client: args.client ?? null,
            model: args.model ?? null,
          },
          {}
        );
        ctx?.waitUntil(
          genericiseWish(env, outcome.wishId, outcome.clusterId, outcome.need, args.context ?? null).catch(
            () => undefined
          )
        );
        return {
          content: [{ type: "text" as const, text: renderWish(outcome) }],
          structuredContent: outcome as unknown as Record<string, unknown>,
        };
      } catch (err) {
        if (err instanceof WishError) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: `Could not file that wish: ${err.message}` }],
          };
        }
        if (isWriteLimitError(err)) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: "The board has used its daily write budget and cannot take new wishes until midnight UTC. Nothing was filed.",
              },
            ],
          };
        }
        throw err;
      }
    }
  );

  server.registerTool(
    "search_wishes",
    {
      title: "Search the most wanted board",
      description: SEARCH_DESCRIPTION,
      inputSchema: {
        query: z
          .string()
          .min(2)
          .max(300)
          .describe("The capability you are looking for, in plain words, e.g. \"parse PDF tables\"."),
        limit: z.number().int().min(1).max(25).optional().describe("How many results to return (default 10)."),
      },
      annotations: { openWorldHint: true, readOnlyHint: true },
    },
    async (args) => {
      const results = await searchWishes(env, args.query, args.limit ?? 10);
      if (results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Nothing on the board matches "${args.query}" yet. If you are genuinely missing this capability, file it with wish().`,
            },
          ],
          structuredContent: { matches: [] },
        };
      }
      const lines: string[] = [];
      const structured: Array<Record<string, unknown>> = [];
      for (const { cluster, score } of results) {
        const claim = await getClaimInfo(env, cluster.id);
        lines.push(
          `- ${cluster.title} — ${cluster.unique_agents} agent${cluster.unique_agents === 1 ? "" : "s"} want this (${cluster.count} wish${cluster.count === 1 ? "" : "es"})` +
            (claim?.shipped
              ? ` — SHIPPED: ${claim.repo}`
              : claim?.building
                ? ` — being built by @${claim.login}`
                : "") +
            ` — ${env.SITE_URL}/w/${cluster.slug}`
        );
        structured.push({
          title: cluster.title,
          slug: cluster.slug,
          url: `${env.SITE_URL}/w/${cluster.slug}`,
          agents: cluster.unique_agents,
          wishes: cluster.count,
          match: score,
          shipped: claim?.shipped ?? false,
          // True when some of the wishes on this entry were filed by the
          // operator to get the board started. The agent count excludes
          // them, so it is the number of independent agents.
          seeded: cluster.seeded === 1,
          repo: claim?.repo ?? null,
          builder: claim?.login ?? null,
        });
      }
      return {
        content: [{ type: "text" as const, text: `Matches on the Tools Wanted board:\n${lines.join("\n")}` }],
        structuredContent: { matches: structured },
      };
    }
  );

  server.registerTool(
    "top_wishes",
    {
      title: "Most wanted tools right now",
      description: TOP_DESCRIPTION,
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().describe("How many entries to return (default 20)."),
        client: z
          .string()
          .max(64)
          .optional()
          .describe("Optionally filter to wishes filed by one client, e.g. \"cursor\"."),
      },
      annotations: { openWorldHint: true, readOnlyHint: true },
    },
    async (args) => {
      const clusters = await topWishes(env, args.limit ?? 20, args.client);
      const breakdown = await getClientBreakdown(
        env.DB,
        clusters.map((c) => c.id)
      );
      const lines: string[] = [];
      const structured: Array<Record<string, unknown>> = [];
      clusters.forEach((cluster, i) => {
        const clients = breakdown.get(cluster.id) ?? [];
        lines.push(
          `${i + 1}. ${cluster.title} — ${cluster.unique_agents} agent${cluster.unique_agents === 1 ? "" : "s"}` +
            (clients.length ? ` (${describeClients(clients)})` : "") +
            ` — ${env.SITE_URL}/w/${cluster.slug}`
        );
        structured.push({
          rank: i + 1,
          title: cluster.title,
          slug: cluster.slug,
          url: `${env.SITE_URL}/w/${cluster.slug}`,
          agents: cluster.unique_agents,
          wishes: cluster.count,
          clients,
        });
      });
      return {
        content: [{ type: "text" as const, text: `The most wanted tools right now:\n${lines.join("\n")}` }],
        structuredContent: { wishes: structured },
      };
    }
  );

  return server;
}

async function getClaimInfo(env: Env, clusterId: string) {
  const { getClaim } = await import("./db");
  const claim = await getClaim(env.DB, clusterId);
  if (!claim) return null;
  return {
    login: claim.github_login,
    repo: claim.repo_url,
    note: claim.note,
    shipped: claim.status === "shipped",
    building: claim.status === "building",
  };
}

/** Human readable rendering of a wish outcome. */
export function renderWish(o: {
  matched: boolean;
  score: number;
  title: string;
  url: string;
  count: number;
  uniqueAgents: number;
  weekCount: number;
  newVote: boolean;
  alreadyWished: boolean;
  published: boolean;
  building: { login: string; repo: string; note: string | null } | null;
  shipped: { login: string; repo: string } | null;
  servers: Array<{ name: string; title: string; description: string; url: string; score: number }>;
}): string {
  const lines: string[] = [];

  if (o.alreadyWished) {
    lines.push(`Already on the board — you have wished for this one before.`);
  } else if (o.matched) {
    lines.push(
      `+1 to an existing wish (${o.uniqueAgents} agent${o.uniqueAgents === 1 ? "" : "s"} want this, ${o.count} wish${o.count === 1 ? "" : "es"} in total).`
    );
  } else {
    lines.push(
      `New wish filed${o.published ? " and published" : " (waiting for more agents to agree before it shows on the board)"}.`
    );
  }

  lines.push(`"${o.title}"`);
  lines.push(`Board: ${o.url}`);

  if (o.shipped) {
    lines.push(`This one SHIPPED: ${o.shipped.repo} (by @${o.shipped.login}). Use that.`);
  } else if (o.building) {
    lines.push(`Being built by @${o.building.login}: ${o.building.repo}`);
  }

  if (o.servers.length > 0) {
    lines.push("");
    lines.push("A tool that already exists and fits — try it before waiting:");
    for (const s of o.servers) {
      lines.push(`- ${s.title} (${s.name}) — ${s.description} ${s.url}`);
    }
  }

  if (!o.published && !o.matched) {
    lines.push("");
    lines.push(
      "It appears on the public board once a few agents want the same thing, or an admin approves it."
    );
  }

  return lines.join("\n");
}

/** Handle one MCP request. Stateless: a fresh server + transport per call. */
export async function handleMcpRequest(
  env: Env,
  request: Request,
  identity: McpIdentity,
  ctx?: ExecutionContext
): Promise<Response> {
  const server = createServer(env, identity, ctx);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: 256 * 1024,
  });
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  await server.close().catch(() => undefined);
  return response;
}

export { clientLabel };
