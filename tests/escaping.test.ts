import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { renderBoard, renderCluster, renderWeekly, renderWishForm, renderBuild, renderAbout, renderPrivacy, renderAgents } from "../src/board";
import { renderFeed, renderWishFeed } from "../src/rss";
import { esc } from "../src/html";

/**
 * The escaping audit.
 *
 * Every path where text an agent filed reaches the HTML has to escape
 * it. The sanitiser strips HTML tags on the way in, but the sanitiser
 * is the first line of defence, not the last: `esc()` on the way out is
 * the one that holds when the sanitiser is wrong, or when the text came
 * from somewhere else entirely (a claim note, a repo URL, a cluster
 * title an admin typed).
 *
 * These tests render the pages with adversarial text and assert that
 * nothing in it becomes markup.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = join(ROOT, "migrations");

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of [
    "0001_init.sql",
    "0002_claims_unique.sql",
    "0003_servers_latest.sql",
    "0004_neuron_budget.sql",
    "0005_og_images.sql",
    "0006_usage_budget.sql",
    "0007_votes_seeded.sql",
  ]) {
    db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  return db;
}

function d1(db: DatabaseSync) {
  const run = (sql: string, params: unknown[] = []) => {
    const info = db.prepare(sql).run(...(params as never[]));
    return { meta: { changes: Number(info.changes) }, success: true };
  };
  const all = (sql: string, params: unknown[] = []) => ({
    results: db.prepare(sql).all(...(params as never[])),
  });
  const prepare = (sql: string) => {
    const stmt = {
      bind: (...params: unknown[]) => ({
        run: async () => run(sql, params),
        all: async () => all(sql, params),
        first: async () => db.prepare(sql).get(...(params as never[])) ?? null,
      }),
      run: async () => run(sql),
      all: async () => all(sql),
      first: async () => db.prepare(sql).get() ?? null,
    };
    return stmt;
  };
  return {
    prepare,
    batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => {
      const results = [];
      for (const s of stmts) results.push(await s.run());
      return results;
    },
    exec: async (sql: string) => {
      db.exec(sql);
    },
  } as never;
}

/** The hostile strings. Every one of them must come out as text. */
const HOSTILE = [
  `<script>alert('xss')</script>`,
  `<img src=x onerror=alert(1)>`,
  `"><script>alert(1)</script>`,
  `'` + `"` + ` onmouseover=alert(1) x="`,
  `</textarea></script><script>alert(1)</script>`,
  `<!--<script>alert(1)</script>-->`,
  `<svg/onload=alert(1)>`,
  `<iframe src=javascript:alert(1)>`,
  `<a href="javascript:alert(1)">click</a>`,
  `&lt;script&gt;already escaped&lt;/script&gt;`,
  `javascript:alert(1)`,
  `"><b>bold</b>`,
  `\u0000\u0001 control chars`,
  "zero width space",
  "‮rtl override",
  "𝕦𝕟𝕚𝕔𝕠𝕕𝕖 mathematical bold",
  "日本語のテキスト",
  "emoji 🎉 and accents éàü",
];

const NOW = "2026-11-03T12:00:00.000Z";

/**
 * The attribute names in a tag, the way a browser sees them.
 *
 * The raw text of a tag is not enough: an escaped "&lt;img src=x
 * onerror=...&gt;" inside a href value is a URL string, and the text
 * "onerror=" appears in it legitimately. What matters is whether the
 * browser parsed an attribute called "onerror", and that means decoding
 * the entities first and then reading the attribute names.
 */
function attributeNames(tag: string): string[] {
  // The tag's inner text, with the entities decoded.
  const inner = tag
    .replace(/^<[a-zA-Z][^>]*>/, "")
    .replace(/>$/, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
  const names: string[] = [];
  // Attribute names are the words before an "=", or the bare words
  // before a space.
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"[^"]*"|'[^']*'|[^\s>]*))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    names.push(m[1]!.toLowerCase());
  }
  return names;
}

function seedHostileCluster(db: DatabaseSync, id: string, slug: string, hostile: string) {
  db.prepare(
    `INSERT INTO clusters (id, slug, title, title_source, count, unique_agents, week_count,
       first_seen, last_seen, status, shipped, claim_login, claim_repo, claim_note, seeded, created_at, updated_at)
     VALUES (?, ?, ?, 'raw', 1, 1, 0, ?, ?, 'published', 1, 'alice', ?, ?, 0, ?, ?)`
  ).run(
    id,
    slug,
    hostile,
    NOW,
    NOW,
    `https://github.com/x/${hostile}`,
    hostile,
    NOW,
    NOW
  );
  db.prepare(
    `INSERT INTO wishes (id, cluster_id, need, need_generic, context, client, model,
       source_key, ip_key, seeded, flagged, flag_reason, created_at)
     VALUES (?, ?, ?, ?, ?, 'claude-code', NULL, 'src', 'ip', 0, 0, NULL, ?)`
  ).run(`w-${id}`, id, hostile, hostile, hostile, NOW);
  db.prepare(
    `INSERT INTO votes (source_key, cluster_id, created_at, seeded) VALUES (?, ?, ?, 0)`
  ).run("src", id, NOW);
}

describe("the escaping audit", () => {
  for (const hostile of HOSTILE) {
    it(`does not let ${JSON.stringify(hostile.slice(0, 40))} become markup`, async () => {
      const db = freshDb();
      seedHostileCluster(db, "c1", "one", hostile);
      const env = {
        DB: d1(db),
        SITE_URL: "https://toolswanted.dev",
        SITE_NAME: "Tools Wanted",
      } as never;

      const pages = await Promise.all([
        renderBoard(env, {}),
        renderCluster(env, "one"),
        renderWeekly(env),
        renderFeed(env),
        renderWishFeed(env),
      ]);
      const pages2 = [
        renderWishForm(env),
        renderBuild(env, hostile),
        renderAbout(env),
        renderPrivacy(env),
        renderAgents(env),
      ];

      for (const html of [...pages, ...pages2]) {
        // The hostile text must not appear as live markup. The escaped
        // form is fine; the raw form is not.
        expect(html).not.toContain(`<script>alert`);
        expect(html).not.toContain("<img src=x onerror");
        expect(html).not.toContain("<svg/onload");
        expect(html).not.toContain("<iframe");
        // No event handler attribute was broken out of.
        //
        // The check has to look at the attribute names, not at the raw
        // text of the tag: an escaped "&lt;img src=x onerror=...&gt;"
        // inside a href value is a URL string, not an event handler, and
        // the string "onerror=" appears in it legitimately.
        for (const tag of html?.match(/<[a-zA-Z][^>]*>/g) ?? []) {
          for (const attr of attributeNames(tag)) {
            // The product's own handler on the filter's select.
            if (attr === "onchange" && tag.includes('onchange="this.form.submit()"')) continue;
            expect(attr.startsWith("on")).toBe(false);
          }
        }
        // The escaping helper itself.
        expect(esc(hostile)).not.toContain("<");
        expect(esc(hostile)).not.toContain(">");
      }
    });
  }

  it("escapes the title in the h1 of a cluster page", async () => {
    const db = freshDb();
    seedHostileCluster(db, "c1", "one", `<script>alert('xss')</script>`);
    const html = await renderCluster(
      { DB: d1(db), SITE_URL: "https://toolswanted.dev" } as never,
      "one"
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
  });

  it("escapes a repo URL in an href", async () => {
    const db = freshDb();
    seedHostileCluster(db, "c1", "one", "ok");
    db.prepare("UPDATE clusters SET claim_repo = ? WHERE id = ?").run(
      `javascript:alert(1)"onmouseover="x`,
      "c1"
    );
    const html = await renderCluster(
      { DB: d1(db), SITE_URL: "https://toolswanted.dev" } as never,
      "one"
    );
    // The quote must be escaped, so the attribute cannot be closed early.
    expect(html).not.toContain(`"onmouseover="x`);
    expect(html).toContain("&quot;");
  });

  it("escapes the claim note", async () => {
    const db = freshDb();
    seedHostileCluster(db, "c1", "one", "ok");
    db.prepare("UPDATE clusters SET claim_note = ? WHERE id = ?").run(
      `<script>alert(1)</script>`,
      "c1"
    );
    const html = await renderCluster(
      { DB: d1(db), SITE_URL: "https://toolswanted.dev" } as never,
      "one"
    );
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("escapes the slug in a data attribute and a link", async () => {
    const db = freshDb();
    seedHostileCluster(db, "c1", `a" onmouseover="x`, "ok");
    const html = await renderBoard(
      { DB: d1(db), SITE_URL: "https://toolswanted.dev" } as never,
      {}
    );
    expect(html).not.toContain(`onmouseover="x`);
  });
});
