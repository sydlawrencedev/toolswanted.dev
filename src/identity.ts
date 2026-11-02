/**
 * Who is calling. We never store raw IPs or user agents: both are hashed
 * with a server-side salt and only the hashes are used.
 */

import { sha256Hex } from "./types";
import type { Env } from "./types";
import type { McpIdentity } from "./mcp";

export async function identify(env: Env, request: Request): Promise<McpIdentity> {
  const ip = request.headers.get("CF-Connecting-IP") ?? request.headers.get("x-forwarded-for") ?? "unknown";
  const ua = (request.headers.get("user-agent") ?? "").slice(0, 300);
  const lang = (request.headers.get("accept-language") ?? "").slice(0, 100);
  // Optional stable agent id, so one installation votes once even if its
  // user agent string changes between versions.
  const agentId = (request.headers.get("x-tools-wanted-agent") ?? "").slice(0, 100);
  const salt = env.IP_SALT ?? "toolswanted";

  const ipKey = await sha256Hex(ip.trim().split(",")[0]!.trim(), salt);
  const sourceKey = await sha256Hex(`${ua}|${lang}|${agentId}|${ip}`, salt);

  return { ipKey, sourceKey, userAgent: ua, client: null };
}
