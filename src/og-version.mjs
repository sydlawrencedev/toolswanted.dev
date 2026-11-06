/**
 * The version of the poster's copy.
 *
 * A poster is a rendering of a number *and* of a design. The number
 * moves when a wish is filed, and the design moves when somebody edits
 * `scripts/render-og.ts`. Staleness was detected by comparing the
 * poster's timestamp with its cluster's timestamp, which catches the
 * first and not the second.
 *
 * So a poster carries the version of the template it was rendered from,
 * and the image route refuses a poster whose version is not the current
 * one, in the same way it refuses one that is behind its entry.
 *
 * **This value has to change when the poster's copy or layout
 * changes.** It is a fingerprint of the design, not of the code: editing
 * the script without editing this leaves the old posters serving.
 *
 * It is a `.mjs` file and not a `.ts` one because both sides need it:
 * the render script runs under plain Node and cannot import TypeScript,
 * and the Worker imports it. A constant in two places would drift.
 */
export const OG_COPY_VERSION = "2026-11-06.1";
