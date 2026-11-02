/**
 * Tune the clustering threshold against labelled pairs.
 *
 * The board is only useful if two agents describing the same gap land in the
 * same cluster, and two different gaps do not. This measures both.
 *
 *   npm run tune
 */

const WORKER = process.env.WORKER_URL ?? "https://toolswanted.sydlawrence.workers.dev";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";

/** Pairs that SHOULD match. */
const SAME: Array<[string, string]> = [
  ["Read UK council planning PDFs as structured data", "Extract planning applications from council PDF documents"],
  ["Read UK council planning PDFs as structured data", "Turn local authority planning documents into structured records"],
  ["Read UK council planning PDFs as structured data", "Get structured data out of UK planning application PDFs"],
  ["Convert a PDF invoice into structured line items", "Extract line items and totals from an invoice PDF"],
  ["Read a bank statement PDF into individual transactions", "Extract transactions from a bank statement PDF"],
  ["Convert a PDF invoice into structured line items", "Extract line items and totals from an invoice PDF"],
  ["Query a Postgres database and return a schema without a local client installed", "List tables and columns of a Postgres database remotely"],
  ["Search a Slack workspace and return messages with links", "Find messages in a Slack channel and return permalinks"],
  ["Read a Notion page as markdown", "Fetch a Notion page and return it as markdown"],
  ["Extract tables from a scanned document using OCR", "Read tables out of a scanned PDF"],
  ["Search the web and return results with quoted source excerpts", "Web search with citations and quotes from the pages"],
  ["Read a GitHub Actions run log and explain the real failure", "Summarise a CI failure from its log"],
  ["I need something to read council planning applications from PDFs", "A tool that turns planning application documents into data"],
  ["Extract line items from a scanned receipt photo", "Read receipt images and pull out the totals"],
  ["Get the schema of a database I can only reach over SSH", "List the tables in a remote Postgres database"],
  ["Turn a meeting transcript into a list of decisions and owners", "Summarise a call transcript into actions"],
  ["Read a Figma design and list every component and its props", "Convert a Figma frame to a component spec"],
  ["Fetch a page and pull out every link on it", "Scrape a webpage for its outbound links"],
  ["Look up a person in a company directory by name and role", "Search an employee directory for someone by name"],
];

/** Pairs that should NOT match. */
const DIFFERENT: Array<[string, string]> = [
  ["Read UK council planning PDFs as structured data", "Read a bank statement PDF into individual transactions"],
  ["Convert a PDF invoice into structured line items", "Query a Postgres database and return a schema without a local client installed"],
  ["Read a Notion page as markdown", "Search the web and return results with quoted source excerpts"],
  ["Parse a huge CSV without loading it into memory", "Read a Google Calendar event including attendees and recurrence"],
  ["Generate a typed client from an OpenAPI specification", "Inspect a Docker image and list its layers and entrypoint"],
  ["Summarise an email thread into the decisions that were made", "Explain what a Kubernetes manifest will do before it is applied"],
  ["Extract tables from a scanned document using OCR", "Convert a design file into a component specification"],
  ["Look up a UK company on Companies House and get its filing history", "Check whether a UK postcode falls inside a planning constraint area"],
  ["Read a Linear issue together with its comments and attachments", "Read a Jira issue and every ticket linked to it"],
  ["Summarise an email thread into the decisions that were made", "Summarise a long document into its key points"],
  ["Parse a huge CSV without loading it into memory", "Query a Postgres database and return a schema without a local client installed"],
  ["Read a GitHub Actions run log and explain the real failure", "Inspect a Docker image and list its layers and entrypoint"],
  ["Generate a typed client from an OpenAPI specification", "Explain what a Kubernetes manifest will do before it is applied"],
  ["Convert a PDF invoice into structured line items", "Read a bank statement PDF into individual transactions"],
];

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((n, v) => n + v, 0) / values.length;
  return {
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    mean,
    median: sorted[Math.floor(sorted.length / 2)]!,
  };
}

async function main() {
  const texts = [...new Set([...SAME.flat(), ...DIFFERENT.flat()])];
  const res = await fetch(`${WORKER}/admin/embed`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": ADMIN_TOKEN },
    body: JSON.stringify({ texts }),
  });
  if (!res.ok) {
    console.error(`Embed failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const { docs, queries } = (await res.json()) as { docs: number[][]; queries: number[][] };
  const index = new Map(texts.map((t, i) => [t, i]));

  const sameScores = SAME.map(([a, b]) =>
    cosine(queries[index.get(a)!]!, docs[index.get(b)!]!)
  );
  const diffScores = DIFFERENT.map(([a, b]) =>
    cosine(queries[index.get(a)!]!, docs[index.get(b)!]!)
  );

  console.log("\nSHOULD MATCH");
  SAME.forEach(([a, b], i) => console.log(`  ${sameScores[i]!.toFixed(4)}  ${a.slice(0, 46).padEnd(48)} | ${b.slice(0, 46)}`));
  console.log("\nSHOULD NOT MATCH");
  DIFFERENT.forEach(([a, b], i) => console.log(`  ${diffScores[i]!.toFixed(4)}  ${a.slice(0, 46).padEnd(48)} | ${b.slice(0, 46)}`));

  const s = stats(sameScores);
  const d = stats(diffScores);
  console.log(`\nshould match    min=${s.min.toFixed(4)} median=${s.median.toFixed(4)} max=${s.max.toFixed(4)}`);
  console.log(`should differ   min=${d.min.toFixed(4)} median=${d.median.toFixed(4)} max=${d.max.toFixed(4)}`);

  // Best threshold: everything that should match scores above it, everything
  // that should not scores below it. If the ranges overlap, report the best
  // compromise and how many pairs it gets wrong.
  const candidates = [...new Set([...sameScores, ...diffScores])].sort((a, b) => a - b);
  let best = { threshold: 0, errors: 999 };
  for (const t of candidates) {
    const falseNegatives = sameScores.filter((v) => v < t).length;
    const falsePositives = diffScores.filter((v) => v >= t).length;
    const errors = falseNegatives + falsePositives;
    if (errors < best.errors) best = { threshold: t, errors };
  }
  console.log(`\nbest threshold: ${best.threshold.toFixed(4)}  (${best.errors} errors)`);
  const gap = s.min - d.max;
  console.log(`separation gap: ${gap.toFixed(4)} (${gap > 0 ? "clean" : "overlapping"})`);
  console.log(`\nSet MATCH_THRESHOLD = "${best.threshold.toFixed(3)}" in wrangler.toml\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

export {};
