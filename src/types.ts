/**
 * Shared types and small helpers.
 */

export interface Env {
  DB: D1Database;
  VECTORS: Vectorize;
  SERVER_VECTORS: Vectorize;
  AI: Ai;
  KV: KVNamespace;
  SITE_URL: string;
  SITE_NAME: string;
  /** Cosine similarity above which a wish folds into an existing cluster. */
  MATCH_THRESHOLD: string;
  /** Cosine similarity above which an existing MCP server is suggested. */
  SERVER_MATCH_THRESHOLD: string;
  /** Wishes needed before a new cluster auto-publishes. */
  AUTO_PUBLISH_WISHES: string;
  RATE_LIMIT_WISHES_PER_HOUR: string;
  RATE_LIMIT_SEARCH_PER_MINUTE: string;
  REGISTRY_CRON: string;
  ADMIN_TOKEN?: string;
  SESSION_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  IP_SALT?: string;
}

export type ClusterStatus = "pending" | "published" | "rejected" | "merged";

export interface Cluster {
  id: string;
  slug: string;
  title: string;
  title_source: string;
  count: number;
  unique_agents: number;
  week_count: number;
  first_seen: string;
  last_seen: string;
  status: ClusterStatus;
  merged_into: string | null;
  vector: string | null;
  shipped: number;
  claim_login: string | null;
  claim_repo: string | null;
  claim_note: string | null;
  claimed_at: string | null;
  shipped_at: string | null;
  seeded: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Wish {
  id: string;
  cluster_id: string;
  need: string;
  need_generic: string | null;
  context: string | null;
  client: string | null;
  model: string | null;
  source_key: string;
  ip_key: string;
  seeded: number;
  flagged: number;
  flag_reason: string | null;
  created_at: string;
}

export interface ServerRecord {
  name: string;
  title: string | null;
  description: string | null;
  remotes: string | null;
  packages: string | null;
  updated_at: string;
}

/** Known agent clients, used for the client breakdown and the "by client" filter. */
export const CLIENTS: Array<{ id: string; label: string }> = [
  { id: "claude-code", label: "Claude Code" },
  { id: "claude-desktop", label: "Claude Desktop" },
  { id: "cursor", label: "Cursor" },
  { id: "codex", label: "Codex" },
  { id: "chatgpt", label: "ChatGPT" },
  { id: "gemini-cli", label: "Gemini CLI" },
  { id: "cline", label: "Cline" },
  { id: "aider", label: "Aider" },
  { id: "continue", label: "Continue" },
  { id: "windsurf", label: "Windsurf" },
  { id: "zed", label: "Zed" },
  { id: "openai-codex", label: "OpenAI Codex" },
  { id: "other", label: "Other" },
];

const CLIENT_ALIASES: Array<[RegExp, string]> = [
  [/claude[\s-]?code/i, "claude-code"],
  [/claude[\s-]?desktop/i, "claude-desktop"],
  [/cursor/i, "cursor"],
  [/^codex$|openai[\s-]?codex|codex[\s-]?cli/i, "codex"],
  [/chatgpt|openai[\s-]?api/i, "chatgpt"],
  [/gemini/i, "gemini-cli"],
  [/cline/i, "cline"],
  [/aider/i, "aider"],
  [/continue/i, "continue"],
  [/windsurf/i, "windsurf"],
  [/zed/i, "zed"],
];

/** Normalise a free-text client name into one of the known buckets. */
export function normaliseClient(input?: string | null): string {
  if (!input) return "other";
  const value = input.trim().slice(0, 64);
  for (const [re, id] of CLIENT_ALIASES) {
    if (re.test(value)) return id;
  }
  return "other";
}

export function clientLabel(id: string | null | undefined): string {
  if (!id) return "Unknown";
  return CLIENTS.find((c) => c.id === id)?.label ?? id;
}

export function num(n: number): string {
  return n.toLocaleString("en-US");
}

/** RFC3339 -> "3 days ago" style. */
export function relativeTime(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.round((now - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

/** ISO date for display. */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** ISO week id, e.g. 2026-W45. Used for the weekly page and week counters. */
export function isoWeekId(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Monday 00:00 UTC of the week containing `date`. */
export function weekStart(date = new Date()): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
}

/** Random id, base36-ish, no crypto dependency needed beyond Math.random fallback. */
export function newId(prefix = ""): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += b.toString(36).padStart(2, "0");
  return prefix ? `${prefix}_${out.slice(0, 16)}` : out.slice(0, 16);
}

/** SHA-256 hex, used for hashing IPs and fingerprints. */
export async function sha256Hex(input: string, salt = ""): Promise<string> {
  const data = new TextEncoder().encode(salt + input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
