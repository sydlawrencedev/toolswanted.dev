/**
 * Vector helpers.
 *
 * We keep a copy of every cluster centroid in D1 and match against it
 * directly, because Vectorize is eventually consistent: a vector that was
 * just upserted is not queryable for a few seconds. Without this, two agents
 * filing the same wish a second apart would land in different clusters.
 *
 * D1 is the source of truth for recent clusters, Vectorize is the index for
 * the long tail.
 */

export function encodeVector(values: number[]): string {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < values.length; i++) view.setFloat32(i * 4, values[i]!, true);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Decode a stored centroid. Handles both the compact format and legacy JSON. */
export function decodeVector(stored: string | null | undefined): Float32Array | null {
  if (!stored) return null;
  try {
    if (stored.startsWith("[")) {
      const parsed = JSON.parse(stored) as number[];
      return Float32Array.from(parsed);
    }
    const binary = atob(stored);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Float32Array(bytes.buffer);
  } catch {
    return null;
  }
}

/** Cosine similarity. Vectors are short enough that a plain loop is fastest. */
export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
