/**
 * Slugs for cluster URLs: short, readable, stable, and safe in a path.
 */

const STOP_WORDS = new Set([
  "a", "an", "the", "to", "for", "of", "in", "on", "and", "or", "with", "that",
  "this", "it", "its", "my", "our", "we", "i", "you", "your", "as", "into",
  "from", "by", "is", "are", "be", "can", "need", "want", "wants", "wished",
]);

export function slugify(text: string, maxLen = 64): string {
  const words = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const kept: string[] = [];
  for (const w of words) {
    if (STOP_WORDS.has(w) && kept.length === 0) continue;
    kept.push(w);
  }

  let slug = kept.join("-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (slug.length > maxLen) {
    slug = slug.slice(0, maxLen);
    const cut = slug.lastIndexOf("-");
    if (cut > maxLen * 0.5) slug = slug.slice(0, cut);
    slug = slug.replace(/-$/, "");
  }
  return slug || "wish";
}

/**
 * Turn a raw need into a short, human title. This is what shows up as the
 * big heading on the board, so it should read like a headline.
 */
export function titleFromNeed(need: string, maxLen = 110): string {
  const cleaned = need
    .replace(/\s+/g, " ")
    .replace(/^(?:i|we)\s+(?:really\s+)?(?:need|want|wish)\s+(?:a|an|the|some)?\s*/i, "")
    .replace(/^(?:a|an|the)\s+(?:tool|server|mcp|api|function)\s+(?:that\s+|to\s+|for\s+|which\s+)?/i, "")
    .replace(/\s+(?:please|thanks|thank you)[.!]?$/i, "")
    .trim();
  const capped = cleaned.length > maxLen ? `${cleaned.slice(0, maxLen - 1).trimEnd()}…` : cleaned;
  return capped || need.slice(0, maxLen);
}

/** Capitalise the first letter, leave the rest alone. */
export function sentenceCase(text: string): string {
  if (!text) return text;
  return text[0]!.toUpperCase() + text.slice(1);
}
