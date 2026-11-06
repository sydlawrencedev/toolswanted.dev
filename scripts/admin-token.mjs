/**
 * Reading the admin token, one way.
 *
 * Four scripts talk to the admin API, and they used to disagree about
 * where the token comes from. `render-og.ts`, `seed.ts` and
 * `tune-threshold.ts` read the environment variable and had no
 * fallback. `crawl-registry.ts`, `compare-models.ts` and
 * `test-claim.mjs` read the environment variable and fell back to a
 * file. So somebody who learned "the file works" from one script ran
 * another and got a 401 with no explanation of why.
 *
 * This module is the one convention:
 *
 *   1. `ADMIN_TOKEN` in the environment, if it is there.
 *   2. `/tmp/admin_token`, if it is there.
 *   3. Nothing, and a clear error.
 *
 * `/tmp` is the right place for the fallback. It is cleared on reboot,
 * so the token does not outlive the session, and it is outside the
 * repository, so it cannot be committed by accident.
 *
 * The token itself is never logged. A script that fails on the token
 * says so, and says nothing about the value.
 */

import { readFile } from "node:fs/promises";

const TOKEN_FILE = "/tmp/admin_token";

/**
 * The token, or an empty string.
 *
 * An empty string is what the scripts should pass to the admin API when
 * there is no token, because that is what produces a 401 rather than a
 * confusing failure further down.
 */
export async function adminToken() {
  const fromEnv = process.env.ADMIN_TOKEN;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();

  try {
    const fromFile = await readFile(TOKEN_FILE, "utf8");
    const token = fromFile.trim();
    if (token) return token;
  } catch {
    // No file. The caller decides whether that is fatal.
  }

  return "";
}

/**
 * The token, or a failure with an explanation.
 *
 * Used by the scripts that would otherwise spend a minute rendering
 * images before discovering they cannot upload them.
 */
export async function requireAdminToken() {
  const token = await adminToken();
  if (token) return token;

  throw new Error(
    "No admin token.\n" +
      "Set it in the environment:\n" +
      "  ADMIN_TOKEN='...' npm run og:sync\n" +
      "or put it in " +
      TOKEN_FILE +
      ":\n" +
      "  printf '%s' '...' > " +
      TOKEN_FILE +
      " && chmod 600 " +
      TOKEN_FILE
  );
}
