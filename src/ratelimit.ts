/**
 * Rate limiting.
 *
 * Fixed windows in D1. Two buckets are used per wish: one keyed on the
 * hashed IP and one keyed on the client fingerprint, so neither a single
 * agent nor a single network can spam the board.
 */

export interface RateResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  used: number;
}

export async function rateLimit(
  db: D1Database,
  bucket: string,
  limit: number,
  windowSeconds: number
): Promise<RateResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const resetAt = (windowStart + windowSeconds) * 1000;

  let hits = 1;
  try {
    const row = await db
      .prepare(
        `INSERT INTO rate_limits (bucket, window_start, hits) VALUES (?, ?, 1)
         ON CONFLICT(bucket, window_start) DO UPDATE SET hits = hits + 1
         RETURNING hits`
      )
      .bind(bucket, windowStart)
      .first<{ hits: number }>();
    hits = row?.hits ?? 1;
  } catch {
    // If the counter write fails we still allow the request but do not count
    // it: the board should not go dark because the limiter broke.
    hits = 0;
  }

  return {
    allowed: hits <= limit,
    limit,
    used: hits,
    remaining: Math.max(0, limit - hits),
    resetAt,
  };
}

/** Bucket key for an IP. */
export function ipBucket(ipKey: string): string {
  return `wish:ip:${ipKey}`;
}

/** Bucket key for a client fingerprint. */
export function sourceBucket(sourceKey: string): string {
  return `wish:src:${sourceKey}`;
}

/** Bucket key for reads. */
export function readBucket(key: string): string {
  return `read:${key}`;
}
