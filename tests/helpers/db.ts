import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

/**
 * A database with the board's schema on it.
 *
 * Every test file used to carry its own hard-coded list of migration
 * files, and the lists had drifted apart: some had
 * `0006_usage_budget.sql`, some had `0007_client_breakdown.sql`, some
 * had `0007_votes_seeded.sql`, and two had an `0008` that the rest did
 * not. Adding a migration meant editing a dozen files and hoping you
 * found all of them, and forgetting one produced a test failure that
 * said `no such column` rather than saying what was wrong.
 *
 * So the list lives in one place: the migrations directory, applied in
 * order.
 */

// This file is in tests/helpers/, so the repository root is two levels up.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MIGRATIONS = join(ROOT, "migrations");

/** A fresh database with every migration applied, in order. */
export function freshDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");

  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  return db;
}

/**
 * The migration files, in the order they are applied.
 *
 * Exported so a test can assert that the schema it is running against
 * is the schema the repository has.
 */
export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}
