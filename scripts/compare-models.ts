/**
 * Compare embedding models on the labelled pairs.
 *
 * Clustering quality is the whole product: merge two agents who want the same
 * thing, and do not merge two who want different things. This measures the
 * separation each model gives us.
 *
 *   node scripts/compare-models.ts
 */

import { readFile } from "node:fs/promises";

const WORKER = process.env.WORKER_URL ?? "https://toolswanted.dev";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? (await readFile("/tmp/admin_token", "utf8")).trim();

const MODELS = [
  "@cf/baai/bge-small-en-v1.5",
  "@cf/baai/bge-base-en-v1.5",
  "@cf/baai/bge-large-en-v1.5",
];

const SAME: Array<[string, string]> = [
  ["Read UK council planning PDFs as structured data", "Extract planning applications from council PDF documents"],
  ["Read UK council planning PDFs as structured data", "Turn local authority planning documents into structured records"],
  ["Read UK council planning PDFs as structured data", "Get structured data out of UK planning application PDFs"],
  ["Convert a PDF invoice into structured line items", "Extract line items and totals from an invoice PDF"],
  ["Read a bank statement PDF into individual transactions", "Extract transactions from a bank statement PDF"],
  ["Query a Postgres database and return a schema without a local client installed", "List tables and columns of a Postgres database remotely"],
  ["Get the schema of a database I can only reach over SSH", "List the tables in a remote Postgres database"],
  ["Search a Slack workspace and return messages with links", "Find messages in a Slack channel and return permalinks"],
  ["Read a Notion page as markdown", "Fetch a Notion page and return it as markdown"],
  ["Search the web and return results with quoted source excerpts", "Web search with citations and quotes from the pages"],
  ["Read a GitHub Actions run log and explain the real failure", "Summarise a CI failure from its log"],
  ["Extract tables from a scanned document using OCR", "Read tables out of a scanned PDF"],
  ["I need something to read council planning applications from PDFs", "A tool that turns planning application documents into data"],
  ["Extract line items from a scanned receipt photo", "Read receipt images and pull out the totals"],
  ["Turn a meeting transcript into a list of decisions and owners", "Summarise a call transcript into actions"],
  ["Read a Figma design and list every component and its props", "Convert a Figma frame to a component spec"],
];

const DIFFERENT: Array<[string, string]> = [
  ["Read UK council planning PDFs as structured data", "Convert a PDF invoice into structured line items"],
  ["Read UK council planning PDFs as structured data", "Read a PDF that has a table of contents and follow its cross references"],
  ["Read UK council planning PDFs as structured data", "Read a bank statement PDF into individual transactions"],
  ["Read a bank statement PDF into individual transactions", "Extract line items and totals from an invoice PDF"],
  ["Read a bank statement PDF into individual transactions", "Extract tables from a scanned document using OCR"],
  ["Read a bank statement PDF into individual transactions", "Read tables out of a scanned PDF"],
  ["Convert a PDF invoice into structured line items", "Query a Postgres database and return a schema without a local client installed"],
  ["Read a Notion page as markdown", "Search the web and return results with quoted source excerpts"],
  ["Parse a huge CSV without loading it into memory", "Read a Google Calendar event including attendees and recurrence"],
  ["Generate a typed client from an OpenAPI specification", "Inspect a Docker image and list its layers and entrypoint"],
  ["Summarise an email thread into the decisions that were made", "Explain what a Kubernetes manifest will do before it is applied"],
  ["Extract tables from a scanned document using OCR", "Convert a design file into a component specification"],
  ["Look up a UK company on Companies House and get its filing history", "Check whether a UK postcode falls inside a planning constraint area"],
  ["Read a Linear issue together with its comments and attachments", "Read a Jira issue and every ticket linked to it"],
  ["Summarise an email thread into the decisions that were made", "Summarise a long document into its key points"],
  ["Read an Argo workflow and explain what it will do", "Summarise a Kubernetes job definition"],
  ["Extract tables from a scanned document using OCR", "Read a bank statement PDF into individual transactions"],
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

async function embedFor(model: string, texts: string[]) {
  const res = await fetch(`${WORKER}/admin/embed`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": ADMIN_TOKEN },
    body: JSON.stringify({ texts, model }),
  });
  if (!res.ok) throw new Error(`embed failed for ${model}: ${res.status} ${await res.text()}`);
  return (await res.json()) as { docs: number[][]; queries: number[][] };
}

async function main() {
  const texts = [...new Set([...SAME.flat(), ...DIFFERENT.flat()])];

  console.log("model".padEnd(38), "dims", "same-min", "diff-max", "gap", "best-threshold", "errors");
  console.log("-".repeat(100));

  for (const model of MODELS) {
    let docs: number[][];
    let queries: number[][];
    try {
      ({ docs, queries } = await embedFor(model, texts));
    } catch (err) {
      console.log(`${model.padEnd(38)} ERROR ${(err as Error).message}`);
      continue;
    }
    const index = new Map(texts.map((t, i) => [t, i]));
    const sameScores = SAME.map(([a, b]) => cosine(queries[index.get(a)!]!, docs[index.get(b)!]!));
    const diffScores = DIFFERENT.map(([a, b]) => cosine(queries[index.get(a)!]!, docs[index.get(b)!]!));

    const sameMin = Math.min(...sameScores);
    const diffMax = Math.max(...diffScores);
    const gap = sameMin - diffMax;

    // Threshold that gets every pair right.
    let best = { t: 0, errors: 999 };
    for (const t of [...new Set([...sameScores, ...diffScores])].sort((a, b) => a - b)) {
      const errors =
        sameScores.filter((v) => v < t).length + diffScores.filter((v) => v >= t).length;
      if (errors < best.errors) best = { t, errors };
    }

    console.log(
      `${model.padEnd(38)} ${String(docs[0]?.length ?? 0).padStart(4)}  ${sameMin.toFixed(4)}   ${diffMax.toFixed(4)}  ${gap > 0 ? "+" : ""}${gap.toFixed(4)}  ${best.t.toFixed(4)}          ${best.errors}`
    );
  }
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

export {};
