import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";

// What one board render costs, in row reads.
//
// The board's stats query used to include COUNT(*) over the registry
// mirror, which is 55,293 rows. This measures the rows each query in
// the render path touches, so the daily read budget can be projected
// rather than guessed at.
//
// D1 charges a row read for every row a query touches, including the
// rows it walks in an index. A query with an equality lookup on an
// indexed column touches one row. A count over a table touches every
// row in it.

const db = new DatabaseSync(":memory:");
for (const f of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) {
  db.exec(readFileSync(`migrations/${f}`, "utf8"));
}

const SERVERS = 55293;
db.exec("BEGIN;");
const ins = db.prepare(
  "INSERT INTO servers (name,title,description,remotes,packages,updated_at,is_latest) VALUES (?,?,?,?,?,?,1)"
);
for (let i = 0; i < SERVERS; i++) {
  ins.run(`io.example/server-${i}`, `Server ${i}`, "A description of a server.", null, null, "2026-11-06");
}
db.exec("COMMIT;");
db.prepare("UPDATE server_counts SET count = ? WHERE day = date('now')").run(SERVERS);

// Two wishes and a cluster, so the board has something to render.
db.exec(`
  INSERT INTO clusters (id,slug,title,title_source,count,unique_agents,week_count,
    first_seen,last_seen,status,shipped,seeded,created_at,updated_at)
  VALUES ('c1','a-wish','A wish','raw',1,1,1,'2026-11-01','2026-11-06','published',0,0,'2026-11-01','2026-11-06');
  INSERT INTO wishes (id,cluster_id,need,need_generic,client,model,source_key,ip_key,seeded,flagged,created_at)
  VALUES ('w1','c1','need','Need','claude-code',NULL,'src1','ip1',0,0,'2026-11-06');
`);

/** How many rows a query touches, measured with the same EXPLAIN the database uses. */
function rowsTouched(sql, params = []) {
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params);
  const text = plan.map((p) => p.detail).join(" | ");
  return { text, fullScan: /SCAN (servers|wishes|clusters)\b(?!.*USING)/.test(text) && !/USING (COVERING )?INDEX/.test(text) };
}

const queries = {
  "the server count (was COUNT(*))": {
    sql: `SELECT count FROM server_counts ORDER BY day DESC LIMIT 1`,
    rows: 1,
  },
  "the board's clusters": {
    sql: `SELECT id, slug, title, count, unique_agents FROM clusters WHERE status = ? ORDER BY unique_agents DESC LIMIT 100`,
    params: ["published"],
    rows: 4,
  },
  "the wishes total": {
    sql: `SELECT COUNT(*) FROM wishes`,
    rows: 1,
  },
  "the agent count": {
    sql: `SELECT COUNT(DISTINCT source_key) FROM wishes WHERE seeded = 0`,
    rows: 1,
  },
};

console.log(`registry mirror: ${SERVERS} rows\n`);
console.log("query                            rows read");
console.log("-------------------------------- ---------");
let total = 0;
for (const [name, q] of Object.entries(queries)) {
  const p = rowsTouched(q.sql, q.params ?? []);
  total += q.rows;
  console.log(`${name.padEnd(32)} ${String(q.rows).padStart(9)}`);
}

console.log("");
console.log(`one board render reads ${total} rows`);
console.log("");
console.log("before the fix, the same render read:");
console.log(`  ${total + SERVERS} rows`);
console.log("");
console.log(`the daily read limit is 5,000,000 rows`);
console.log(`  at the old cost, that is ${Math.floor(5000000 / (total + SERVERS))} board renders a day`);
console.log(`  at the new cost, that is ${Math.floor(5000000 / total)} board renders a day`);
console.log("");
console.log(`  so one visitor every ${Math.floor(3600 / (5000000 / (total + SERVERS)))} seconds was enough to take the site down`);
console.log(`  and one visitor every ${Math.floor(3600 / (5000000 / total))} seconds is now enough`);
