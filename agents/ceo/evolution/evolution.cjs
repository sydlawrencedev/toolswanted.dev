// agents/ceo/evolution/evolution.cjs
// Local evolution loop for ceo
//
// Self-contained: scans this agent's memory and learnings for signals, records
// each new signal as a gene, and appends it to the mutation log. It reads and
// writes two files in its own directory and touches nothing else in the
// project.

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const { scanLocalSignals } = require('./signalScanner.cjs');

// This file lives at agents/<key>/evolution/evolution.cjs, so the agent key is
// the directory two levels up. The source loop read one level up, which
// returned "evolution" for every agent.
const AGENT_KEY = path.basename(path.dirname(path.dirname(__filename)));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

const MUTATION_LOG_PATH = path.join(__dirname, 'mutationLog.jsonl');
const GENE_STORE_PATH = path.join(__dirname, 'geneStore.json');

/**
 * Read the gene store. A missing file is a fresh store; an unreadable or
 * malformed one is an error, because overwriting it would destroy the record
 * it holds.
 */
function readGeneStore() {
  let raw;
  try {
    raw = fs.readFileSync(GENE_STORE_PATH, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { genes: [] };
    throw err;
  }
  const store = JSON.parse(raw);
  if (!store || !Array.isArray(store.genes)) {
    throw new Error(`Gene store is not in the expected shape: ${GENE_STORE_PATH}`);
  }
  return store;
}

/** Write the gene store, keeping any other key it carries. */
function writeGeneStore(store) {
  fs.writeFileSync(GENE_STORE_PATH, JSON.stringify(store, null, 2) + '\n', 'utf8');
}

/**
 * The scanner reports absolute paths. A gene store that bakes the machine's
 * home directory into every gene does not survive the project moving, so a
 * path under the project root is stored project-root-relative.
 */
function relativeSource(absolutePath) {
  const relative = path.relative(PROJECT_ROOT, absolutePath).split(path.sep).join('/');
  if (!relative || relative === '..' || relative.startsWith('../')) {
    return absolutePath;
  }
  return relative;
}

/**
 * A content-derived id. The same signal produces the same id on every run, so
 * re-running the loop over unchanged memory records it once instead of
 * duplicating the store and the log.
 */
function geneId(type, source, snippet) {
  const digest = createHash('sha256')
    .update(`${type}\n${source}\n${snippet}`)
    .digest('hex')
    .slice(0, 12);
  return `gene_${AGENT_KEY}_${type}_${digest}`;
}

/** A cycle id that is unique to the millisecond it was created in. */
function generateCycleId() {
  return 'cycle_' + new Date().toISOString().replace(/[:.]/g, '');
}

/**
 * Append one JSON object per line to the mutation log. The gene fields are
 * the record; the snippet is kept alongside them because it is the only part
 * of a signal that says what actually happened.
 */
function appendMutations(records) {
  const lines = records
    .map((record) => JSON.stringify({ ...record.gene, snippet: record.snippet }))
    .join('\n');
  fs.appendFileSync(MUTATION_LOG_PATH, lines + '\n', 'utf8');
}

/**
 * Run one local evolution cycle: scan this agent's memory for signals, record
 * the new ones as genes, and append them to the mutation log.
 *
 * `dryRun` reports what would be recorded without writing anything. The
 * repo-level engine this loop replaces also took a `strategy`; there is no
 * gene selection here, so there is no strategy to choose.
 */
async function runLocalEvolution(options = {}) {
  const {
    dryRun = process.env.EVOLUTION_DRY_RUN === 'true',
  } = options;

  const cycleId = generateCycleId();
  const signals = scanLocalSignals();
  const store = readGeneStore();

  const known = new Set(store.genes.map((gene) => gene.id));
  const createdAt = new Date().toISOString();
  const records = [];

  for (const signal of signals) {
    const source = relativeSource(signal.source);
    const id = geneId(signal.type, source, signal.snippet);
    if (known.has(id)) continue;
    known.add(id);
    records.push({
      gene: {
        id,
        type: signal.type,
        severity: signal.severity,
        source,
        createdAt,
      },
      snippet: signal.snippet,
    });
  }

  if (!dryRun && records.length > 0) {
    // The order is deliberate. The log is the append-only record and the gene
    // store is derived from it, so the log is written first: a failed store
    // write leaves the log ahead of the store rather than losing the signals.
    appendMutations(records);
    writeGeneStore({
      ...store,
      genes: [...store.genes, ...records.map((record) => record.gene)],
    });
  }

  return {
    cycleId,
    agent: AGENT_KEY,
    status: 'success',
    signals,
    genes: records.map((record) => record.gene),
  };
}

// Run if called directly
if (require.main === module) {
  runLocalEvolution()
    .then((result) => {
      console.log(
        `Evolution cycle ${result.cycleId}: ${result.status} ` +
        `(${result.signals.length} signals, ${result.genes.length} new genes, agent ${result.agent})`
      );
      process.exitCode = result.status === 'success' ? 0 : 1;
    })
    .catch((err) => {
      console.error('Evolution failed:', err);
      process.exitCode = 1;
    });
}

module.exports = { runLocalEvolution };
