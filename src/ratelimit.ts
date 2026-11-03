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
  /** True when the counter could not be read or written. */
  degraded: boolean;
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
  let degraded = false;
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
    // The counter write failed.
    //
    // It used to set `hits = 0`, which made `allowed` true for EVERY
    // request — the limit was not degraded, it was absent, and nothing
    // said so. The board went into an unlimited state exactly when D1 was
    // under pressure, which is when the write limit is most likely to
    // have been hit.
    //
    // Now the failure is explicit. `allowed` is false, so a broken
    // limiter cannot be used to spam, and `degraded` says why.
    degraded = true;
    hits = limit + 1;
  }

  return {
    allowed: !degraded && hits <= limit,
    limit,
    used: hits,
    remaining: degraded ? 0 : Math.max(0, limit - hits),
    resetAt,
    degraded,
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
