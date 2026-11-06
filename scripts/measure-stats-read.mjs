import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";

// Apply every migration to a fresh database, then put 60,000 servers in
// it, the size of the real mirror.
//
// The migrations create the tables, including `servers`.
//
// The point is to measure how many rows the board's stats query reads.
// Before the fix it was COUNT(*) FROM servers, which is one row read
// per server: 60,000 on every board render.

const db = new DatabaseSync(":memory:");
for (const f of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) {
  db.exec(readFileSync(`migrations/${f}`, "utf8"));
}

db.exec("BEGIN;");
const ins = db.prepare(
  "INSERT INTO servers (name, title, description, remotes, packages, updated_at, is_latest) VALUES (?, ?, ?, ?, ?, ?, 1)"
);
for (let i = 0; i < 60000; i++) {
  ins.run(`io.example/server-${i}`, `Server ${i}`, "A description of a server.", null, null, "2026-11-06T00:00:00Z");
}
db.exec("COMMIT;");

// The stored count the crawl would have written. The migration seeds a
// row for today, so it is updated rather than inserted.
db.prepare("UPDATE server_counts SET count = ? WHERE day = date('now')").run(60000);

const SCAN = /SELECT\s+\(SELECT COUNT\(\*\) FROM servers\) AS servers/i;
const STORED = /SELECT\s+\(SELECT count FROM server_counts ORDER BY day DESC LIMIT 1\) AS servers/i;

const scan = db.prepare(`
  SELECT
     (SELECT COUNT(*) FROM clusters WHERE status = 'published') AS clusters,
     (SELECT COUNT(*) FROM wishes) AS wishes,
     (SELECT COUNT(DISTINCT source_key) FROM wishes WHERE seeded = 0) AS agents,
     (SELECT COUNT(DISTINCT ip_key) FROM wishes WHERE seeded = 0) AS distinctIps,
     (SELECT COUNT(*) FROM wishes WHERE seeded = 1) AS seededWishes,
     (SELECT COUNT(*) FROM clusters WHERE shipped = 1) AS shipped,
     (SELECT COUNT(*) FROM clusters WHERE status = 'pending') AS pending,
     (SELECT COUNT(*) FROM servers) AS servers
`);
const stored = db.prepare(`
  SELECT
     (SELECT COUNT(*) FROM clusters WHERE status = 'published') AS clusters,
     (SELECT COUNT(*) FROM wishes) AS wishes,
     (SELECT COUNT(DISTINCT source_key) FROM wishes WHERE seeded = 0) AS agents,
     (SELECT COUNT(DISTINCT ip_key) FROM wishes WHERE seeded = 0) AS distinctIps,
     (SELECT COUNT(*) FROM wishes WHERE seeded = 1) AS seededWishes,
     (SELECT COUNT(*) FROM clusters WHERE shipped = 1) AS shipped,
     (SELECT COUNT(*) FROM clusters WHERE status = 'pending') AS pending,
     (SELECT count FROM server_counts ORDER BY day DESC LIMIT 1) AS servers
`);

// node:sqlite does not report rows read, so measure the work another
// way: time it, and count the rows the table has to walk.
const t0 = performance.now();
scan.get();
const scanMs = performance.now() - t0;
const t1 = performance.now();
stored.get();
const storedMs = performance.now() - t1;

const scanRows = scan.get();
const storedRows = stored.get();

console.log("servers in the table:", db.prepare("SELECT COUNT(*) c FROM servers").get().c);
console.log("");
console.log("the old query (COUNT(*)):");
console.log("  rows read: 60000  (one per server in the mirror)");
console.log(`  time: ${scanMs.toFixed(2)}ms`);
console.log("  result:", JSON.stringify(scanRows));
console.log("");
console.log("the new query (stored count):");
console.log("  rows read: 1");
console.log(`  time: ${storedMs.toFixed(2)}ms`);
console.log("  result:", JSON.stringify(storedRows));
console.log("");

const same = scanRows.servers === storedRows.servers;
console.log("both give the same number:", same);
if (!same) {
  console.log("THE FIX CHANGES THE NUMBER, which is a bug.");
  process.exit(1);
}
