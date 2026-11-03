// agents/test-manager/evolution/signalScanner.cjs
// Local signal scanner for test-manager
// Copies signals from agent memory and prepares for evolution

const fs = require('node:fs');
const path = require('node:path');

const MEMORY_DIR = path.join(__dirname, '..', 'memory');
const LEARNINGS_DIR = path.join(__dirname, '..', 'learnings');

function scanLocalSignals() {
  const signals = [];

  // Scan memory directory
  if (fs.existsSync(MEMORY_DIR)) {
    const files = fs.readdirSync(MEMORY_DIR);
    for (const file of files) {
      if (file.endsWith('.md') || file.endsWith('.log')) {
        const content = fs.readFileSync(path.join(MEMORY_DIR, file), 'utf8');
        signals.push(...extractSignals(content, path.join(MEMORY_DIR, file)));
      }
    }
  }

  // Scan learnings
  if (fs.existsSync(LEARNINGS_DIR)) {
    const files = fs.readdirSync(LEARNINGS_DIR);
    for (const file of files) {
      if (file.endsWith('.md')) {
        const content = fs.readFileSync(path.join(LEARNINGS_DIR, file), 'utf8');
        signals.push(...extractSignals(content, path.join(LEARNINGS_DIR, file)));
      }
    }
  }

  return signals;
}

function extractSignals(content, source) {
  const signals = [];

  // Error patterns
  const errorRegex = /\[ERROR\]|error:|Error:|FAILED|FAILURE/gi;
  let match;
  while ((match = errorRegex.exec(content)) !== null) {
    signals.push({
      type: 'error',
      source,
      snippet: content.substring(Math.max(0, match.index - 50), match.index + 100),
      severity: 'high',
    });
  }

  // Correction patterns
  const correctionRegex = /remember|correct|instead|should be/gi;
  while ((match = correctionRegex.exec(content)) !== null) {
    signals.push({
      type: 'correction',
      source,
      snippet: content.substring(Math.max(0, match.index - 50), match.index + 100),
      severity: 'medium',
    });
  }

  return signals;
}

module.exports = { scanLocalSignals };
