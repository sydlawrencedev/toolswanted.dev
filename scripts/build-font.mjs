/**
 * Build the display font module.
 *
 * Takes assets/fonts/ArchivoBlack-Regular.ttf, subsets it to Latin and
 * compresses it to WOFF2, and writes src/font.ts with the result inlined
 * as base64.
 *
 * The font is inlined rather than served as a file because the Worker
 * serves every other static bit itself, and a second routing table for
 * one font would be one more thing to keep in step.
 *
 * Run it after changing the source font:
 *
 *   node scripts/build-font.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "assets/fonts/ArchivoBlack-Regular.ttf");
const OUT = join(ROOT, "src/font.ts");

/**
 * The characters the site can display. Latin, plus the punctuation that
 * appears in the copy, plus the digits.
 */
const CHARSET = [
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "abcdefghijklmnopqrstuvwxyz",
  "0123456789",
  " .,:;!?'\"()[]{}<>/\\|-_=+*&%$#@~^`",
  "ToolsWantedBoardWeeklyAgentsBuildOneFileAWishAboutPrivacy",
  "The quick brown fox jumps over the lazy dog",
].join("");

/** The python that does the work. fontTools and brotli are both needed. */
const PYTHON = process.env.PYTHON ?? "python3";

const script = `
import sys
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options

src, out, text = sys.argv[1], sys.argv[2], sys.argv[3]
font = TTFont(src)
opts = Options()
opts.flavor = "woff2"
opts.desubroutinize = True
opts.layout_features = ["*"]
opts.name_IDs = ["*"]
opts.notdef_outline = True
opts.recalc_bounds = True
s = Subsetter(options=opts)
s.populate(text=text)
s.subset(font)
font.flavor = "woff2"
font.save(out)
`;

const tmpDir = join(ROOT, ".fontbuild");
execFileSync("mkdir", ["-p", tmpDir]);
const tmpScript = join(tmpDir, "subset.py");
const tmpFont = join(tmpDir, "out.woff2");
writeFileSync(tmpScript, script);

execFileSync(PYTHON, [tmpScript, SRC, tmpFont, CHARSET], { stdio: "inherit" });

const base64 = readFileSync(tmpFont).toString("base64");
const module = readFileSync(OUT, "utf8").replace(
  /__FONT_BASE64__/,
  base64
);
writeFileSync(OUT, module);

const kb = (n) => (n / 1024).toFixed(1);
console.log(`font: ${kb(readFileSync(SRC).length)}KB ttf -> ${kb(readFileSync(tmpFont).length)}KB woff2 (${kb(base64.length)}KB base64)`);

execFileSync("rm", ["-rf", tmpDir]);
