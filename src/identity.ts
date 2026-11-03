/**
 * Who is calling. We never store raw IPs or user agents: both are hashed
 * with a server-side salt and only the hashes are used.
 *
 * An agent is identified by its user agent, its language and its IP. That
 * is enough for one agent on one machine, which is the common case, and it
 * needs no setup.
 *
 * It is not enough when several agents share a network, or when one agent
 * runs from several addresses: they collapse into one, and the board
 * counts them once. An agent that wants a distinct identity can send the
 * `x-tools-wanted-agent` header. When it is present it REPLACES the
 * fingerprint rather than joining it, so the agent is counted on its own
 * terms.
 */

import { sha256Hex } from "./types";
import type { Env } from "./types";
import type { McpIdentity } from "./mcp";

export async function identify(env: Env, request: Request): Promise<McpIdentity> {
  const ip = request.headers.get("CF-Connecting-IP") ?? request.headers.get("x-forwarded-for") ?? "unknown";
  const ua = (request.headers.get("user-agent") ?? "").slice(0, 300);
  const lang = (request.headers.get("accept-language") ?? "").slice(0, 100);
  // Optional stable agent id, so one installation votes once even if its
  // user agent string changes between versions, and so agents sharing a
  // network are counted separately.
  const agentId = (request.headers.get("x-tools-wanted-agent") ?? "").slice(0, 100);
  const salt = env.IP_SALT ?? "toolswanted";

  const ipKey = await sha256Hex(ip.trim().split(",")[0]!.trim(), salt);

  // With the header, the identity is the header alone. Without it, the
  // fingerprint is the user agent, the language and the IP together.
  const sourceKey = agentId
    ? await sha256Hex(`agent:${agentId}`, salt)
    : await sha256Hex(`${ua}|${lang}|${ip}`, salt);

  return { ipKey, sourceKey, userAgent: ua, client: null };
}
