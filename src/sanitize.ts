/**
 * Sanitiser for agent-submitted text.
 *
 * Design rules (non-negotiable, see README "Privacy and safety"):
 *  1. The text we STORE is the output of the synchronous regex phase only.
 *     It is safe to store because secrets, emails, paths and URLs are removed
 *     by construction, not by hoping the LLM behaves.
 *  2. The optional LLM phase may only REPLACE the stored text with a shorter,
 *     more generic one-liner, and only if that output passes the same regex
 *     gate again. It can never introduce new content.
 *  3. Nothing here executes, follows, or interprets the text. Wish text is
 *     always treated as untrusted data.
 *
 * This module is deliberately dependency-free and pure so it can be unit
 * tested in isolation.
 */

/** Placeholder used when a value has been removed. */
const REDACTED = "[redacted]";

export interface SanitiseResult {
  /** Sanitised text, single line, length-capped. Empty string if nothing survived. */
  text: string;
  /** Categories of things that were removed (for logging / tests). */
  removed: string[];
  /** True if the text looks like it was trying to give us instructions. */
  flagged: boolean;
  /** Short reason for the flag, if flagged. */
  flagReason: string | null;
}

/* ------------------------------------------------------------------ *
 * Phase 0: invisible characters
 * ------------------------------------------------------------------ */

// Control chars, zero-width chars, and bidi overrides. These are used to
// hide text from humans but let an LLM read something different.
const INVISIBLE_RE =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

// HTML-ish tags (we escape on render too, but stripping keeps text clean).
const TAG_RE = /<\/?[a-zA-Z][^>]{0,200}>/g;

/* ------------------------------------------------------------------ *
 * Phase 1: secret redaction
 * ------------------------------------------------------------------ */

// Ordered: most specific first so a generic rule never eats a known format.
interface Rule {
  name: string;
  re: RegExp;
  replace: string | ((match: string, ...args: any[]) => string);
}

const SECRET_RULES: Rule[] = [
  {
    name: "private-key",
    re: /-----BEGIN[A-Z ]*PRIVATE KEY-----[\s\S]*?-----END[A-Z ]*PRIVATE KEY-----/g,
    replace: REDACTED,
  },
  {
    name: "jwt",
    re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    replace: "[redacted-token]",
  },
  {
    name: "openai-key",
    re: /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}\b/g,
    replace: "[redacted-key]",
  },
  {
    name: "anthropic-key",
    re: /\bsk-ant-[A-Za-z0-9_-]{16,}\b/g,
    replace: "[redacted-key]",
  },
  {
    name: "github-token",
    re: /\b(?:gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
    replace: "[redacted-token]",
  },
  {
    name: "aws-key",
    re: /\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/g,
    replace: "[redacted-key]",
  },
  {
    name: "google-key",
    re: /\bAIza[0-9A-Za-z_-]{30,45}\b/g,
    replace: "[redacted-key]",
  },
  {
    name: "slack-token",
    re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
    replace: "[redacted-token]",
  },
  {
    name: "npm-token",
    re: /\bnpm_[A-Za-z0-9]{30,}\b/g,
    replace: "[redacted-token]",
  },
  {
    name: "bearer-header",
    re: /\bBearer\s+[A-Za-z0-9._~+/-]{12,}={0,2}/g,
    replace: "Bearer [redacted-token]",
  },
  {
    // Any identifier that *contains* a sensitive word, followed by a value:
    // api_key=, secret=, aws_secret_access_key=, GITHUB_TOKEN:, ...
    name: "assigned-secret",
    re: /\b[\w.-]{0,40}(?:secret|password|passwd|api[_-]?key|apikey|access[_-]?key|auth[_-]?token|access[_-]?token|refresh[_-]?token|private[_-]?key|client[_-]?secret|credential|pwd|passphrase|token)[\w.-]{0,40}\b(\s*[:=]\s*)["']?([^\s"',;)]{6,})["']?/gi,
    replace: (_m, sep: string, value: string) => {
      // Keep obvious placeholders: they carry no secret and read better.
      if (/^(none|null|undefined|nil|example|changeme|placeholder|redacted|xxx+|\*+)$/i.test(value)) {
        return `${sep}${value}`;
      }
      // Only redact things that actually look like a credential.
      const looksSecret =
        /[0-9]/.test(value) ||
        /[_\-./+=]/.test(value) ||
        (value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value));
      return looksSecret ? `${sep}[redacted-secret]` : `${sep}${value}`;
    },
  },
  {
    name: "hex-blob",
    re: /\b[A-Fa-f0-9]{32,}\b/g,
    replace: "[redacted-blob]",
  },
  {
    name: "base64-blob",
    re: /\b[A-Za-z0-9+/]{40,}={0,2}\b/g,
    replace: "[redacted-blob]",
  },
];

/* ------------------------------------------------------------------ *
 * Phase 1b: emails, URLs, paths
 * ------------------------------------------------------------------ */

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const URL_RE = /\b(?:https?|ftp):\/\/[^\s<>"'`]+/gi;

// Long opaque segment in a path == pre-signed URL / secret in path.
const OPAQUE_SEGMENT_RE = /[A-Za-z0-9_-]{20,}/;
const HEX_SEGMENT_RE = /\b[A-Fa-f0-9]{16,}\b/;

const WINDOWS_PATH_RE = /\b[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*/g;
const UNC_PATH_RE = /\\\\[A-Za-z0-9._-]+\\[^\s"']+/g;
const HOME_PATH_RE = /~(?:\/[^\s"']+)+/g;

// Two or more segments where the last has a file extension: src/index.ts
const RELATIVE_FILE_RE = /(?:^|(?<=\s|\(|'|"|`|\[|>|,))(?:[A-Za-z0-9_.@+-]+\/){1,}[A-Za-z0-9_.@+-]+\.[A-Za-z0-9]{1,10}\b/g;
// Three or more segments, no extension needed: /usr/local/share/thing
const DEEP_ABS_PATH_RE = /(?:^|(?<=\s|\(|'|"|`|\[|>|,))(?:\/[A-Za-z0-9_.@+-]+){2,}\/?[A-Za-z0-9_.@+-]*/g;
// Sensitive well-known locations, even shallow: /etc/passwd, /Users/me
const SENSITIVE_ROOT_RE = /(?:^|(?<=\s|\(|'|"|`|\[|>|,))\/(?:etc|var|home|usr|root|Users|tmp|private|opt|srv|mnt|Volumes|proc|sys|dev|Applications|Library)(?:\/[^\s"',;)]*)?/g;

const FILE_EXTENSIONS = [
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rb", "go", "rs", "java", "kt", "swift",
  "c", "h", "cc", "cpp", "hpp", "cs", "php", "scala", "ex", "exs", "erl", "clj", "sh", "bash",
  "zsh", "fish", "ps1", "sql", "md", "markdown", "txt", "log", "csv", "tsv", "yaml", "yml",
  "toml", "ini", "conf", "cfg", "env", "pem", "key", "crt", "cer", "p12", "pfx", "jks",
  "keystore", "sqlite", "sqlite3", "db", "json", "jsonl", "xml", "html", "htm", "css", "scss",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "png", "jpg", "jpeg", "gif", "webp",
  "svg", "zip", "tar", "gz", "bz2", "7z", "mp4", "mov", "mp3", "wav", "tf", "tfvars",
];
const FILE_NAME_RE = new RegExp(
  `\\b[A-Za-z0-9_.@-]+\\.(?:${FILE_EXTENSIONS.join("|")})\\b`,
  "g"
);

/* ------------------------------------------------------------------ *
 * Phase 2: prompt-injection detection (flag, do not rewrite silently)
 * ------------------------------------------------------------------ */

const INJECTION_RULES: Array<{ name: string; re: RegExp }> = [
  { name: "ignore-instructions", re: /\b(?:ignore|disregard|forget|override)\b[^.\n]{0,40}\b(?:previous|prior|above|earlier|all)\b[^.\n]{0,20}\b(?:instruction|prompt|rule|direction|guideline)s?\b/i },
  { name: "you-are-now", re: /\byou\s+are\s+now\b/i },
  { name: "new-instructions", re: /\b(?:new|updated|revised)\s+(?:system\s+)?instructions?\b\s*[:\-]/i },
  { name: "system-prompt-tag", re: /^\s*(?:system|assistant|developer)\s*:/im },
  { name: "reveal-prompt", re: /\b(?:reveal|print|output|repeat|show|disclose)\b[^.\n]{0,30}\b(?:system\s+)?prompt\b/i },
  { name: "exfiltrate", re: /\b(?:send|post|upload|email|exfiltrate|leak)\b[^.\n]{0,40}\b(?:secret|token|key|credential|env|environment variable|api key)s?\b/i },
  { name: "template-injection", re: /\{\{[^}]{1,200}\}\}/ },
  { name: "html-injection", re: /<\s*\/?\s*(?:script|iframe|object|embed|svg|style|form|img)\b/i },
  { name: "jailbreak", re: /\b(?:jailbreak|dan mode|developer mode enabled|ignore all previous)\b/i },
  { name: "role-hijack", re: /\b(?:act|behave|respond)\s+as\s+(?:a|an|the)?\s*\w+\s+(?:assistant|agent|model|bot)\b/i },
  { name: "do-not-tell-user", re: /\bdo\s+not\s+(?:tell|inform|mention|reveal|show)\b/i },
];

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function stripInvisible(input: string): string {
  return input.replace(INVISIBLE_RE, "");
}

function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/**
 * Rewrite a URL so it can be stored safely: drop credentials, query strings
 * and fragments entirely, and drop the whole URL if the path contains
 * something that looks like a pre-signed secret.
 */
function sanitiseUrl(raw: string): string {
  let url = raw;
  // Trailing sentence punctuation is not part of the URL.
  url = url.replace(/[.,;:!?)\]}]+$/, "");

  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    return "[url]";
  }

  if (parsed.username || parsed.password) return "[url]";

  const path = parsed.pathname || "";
  if (HEX_SEGMENT_RE.test(path)) return "[url]";
  if (path.split("/").some((seg) => OPAQUE_SEGMENT_RE.test(seg))) return "[url]";

  const keep = `${parsed.protocol}//${parsed.host}${path.slice(0, 80)}`;
  return keep.length > 120 ? "[url]" : keep;
}

/** Cap length on a word boundary so we do not cut a word in half. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd() + "…";
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/**
 * Phase 1: remove secrets, emails, URLs-with-tokens and paths, and normalise
 * the text. This is the only output that is ever persisted.
 */
export function sanitizeText(raw: string, maxLength = 300): SanitiseResult {
  const removed: string[] = [];
  if (typeof raw !== "string" || raw.length === 0) {
    return { text: "", removed, flagged: false, flagReason: null };
  }

  let text = stripInvisible(raw);

  // Injection detection runs on the SUBMITTED text, before redaction: we want
  // to know that someone tried to give us instructions, not that the
  // instruction survived cleaning.
  const injection = detectInjection(text);

  const before = text;
  text = text.replace(TAG_RE, " ");
  if (text !== before) removed.push("tags");

  for (const rule of SECRET_RULES) {
    const re = new RegExp(rule.re.source, rule.re.flags);
    const next = text.replace(re, rule.replace as any);
    if (next !== text) {
      removed.push(rule.name);
      text = next;
    }
  }

  // URLs: strip credentials, query and fragment.
  {
    const re = new RegExp(URL_RE.source, URL_RE.flags);
    let hit = false;
    text = text.replace(re, (m) => {
      hit = true;
      return sanitiseUrl(m);
    });
    if (hit) removed.push("url");
  }

  {
    const re = new RegExp(EMAIL_RE.source, EMAIL_RE.flags);
    const next = text.replace(re, "[email]");
    if (next !== text) removed.push("email");
    text = next;
  }

  for (const [name, re] of [
    ["windows-path", WINDOWS_PATH_RE],
    ["unc-path", UNC_PATH_RE],
    ["home-path", HOME_PATH_RE],
    ["sensitive-path", SENSITIVE_ROOT_RE],
    ["deep-path", DEEP_ABS_PATH_RE],
    ["relative-file", RELATIVE_FILE_RE],
    ["file-name", FILE_NAME_RE],
  ] as const) {
    const r = new RegExp(re.source, re.flags);
    const next = text.replace(r, "[path]");
    if (next !== text) {
      removed.push(name);
      text = next;
    }
  }

  text = collapseWhitespace(text);
  text = truncate(text, maxLength);

  // Final gate: if anything that looks like a secret survived the rules above,
  // drop the whole string rather than risk storing it.
  for (const rule of SECRET_RULES) {
    if (rule.name === "assigned-secret") continue;
    const re = new RegExp(rule.re.source, rule.re.flags);
    if (re.test(text)) {
      return {
        text: "",
        removed: [...removed, "unsafe"],
        flagged: true,
        flagReason: "contained-unremovable-secret",
      };
    }
  }

  const injectionCheck = detectInjection(text);

  return {
    text,
    removed,
    flagged: injection.flagged || injectionCheck.flagged,
    flagReason: injection.reason ?? injectionCheck.reason,
  };
}

/** Detect prompt-injection style content. Used to route wishes to review. */
export function detectInjection(text: string): { flagged: boolean; reason: string | null } {
  for (const rule of INJECTION_RULES) {
    if (rule.re.test(text)) return { flagged: true, reason: rule.name };
  }
  return { flagged: false, reason: null };
}

/**
 * Gate for the LLM rewrite. The model's output is untrusted too: it must
 * survive the same redaction, be a single line, and be short. If the model
 * emits anything secret-shaped we reject the whole rewrite rather than
 * silently redacting it, because that means the rewrite is not trustworthy.
 */
export function sanitiseGeneric(raw: string, maxLength = 160): string | null {
  const cleaned = collapseWhitespace(stripInvisible(raw.replace(/^["'`\s]+|["'`\s]+$/g, "")));
  if (!cleaned) return null;
  if (cleaned.length > maxLength * 2) return null;

  // Reject outright if the model produced something secret-shaped.
  for (const rule of SECRET_RULES) {
    const re = new RegExp(rule.re.source, rule.re.flags);
    if (re.test(cleaned)) return null;
  }

  const result = sanitizeText(cleaned, maxLength);
  if (!result.text) return null;
  // The rewrite must not be a security incident in itself.
  if (detectInjection(result.text).flagged) return null;
  return result.text;
}

/** Placeholders that carry no meaning. */
const PLACEHOLDER_RE = /\[(?:redacted[^\]]*|path|url|email|file)\]/gi;

/** True if the sanitised text is usable as a wish. */
export function isUsableNeed(text: string): boolean {
  const t = text.trim();
  if (t.length < 8) return false;
  if (t.length > 300) return false;
  // Must contain at least a couple of real words, ignoring placeholders.
  const meaningful = t.replace(PLACEHOLDER_RE, " ").trim();
  if (meaningful.length < 8) return false;
  return (meaningful.match(/[A-Za-z]{3,}/g) || []).length >= 2;
}
