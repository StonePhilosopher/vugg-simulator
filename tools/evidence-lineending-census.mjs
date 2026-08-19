#!/usr/bin/env node
/**
 * tools/evidence-lineending-census.mjs — which bytes does a receipt actually describe?
 *
 * A PASSIVE INSTRUMENT. It never fails a build, never exits non-zero on an
 * anomaly, and kills nothing. Its whole job is to answer one question honestly:
 * when `archive/evidence/vN.json` recorded a hash for an artifact, was it
 * hashing the bytes on THIS disk, or the bytes in the repository?
 *
 * Those are not the same thing. This repository has no `.gitattributes`, so
 * with `core.autocrlf=true` git stores LF and hands out CRLF only to the files
 * a given checkout happens to rewrite. `tools/evidence-runtime.mjs` hashes raw
 * working-tree bytes, so the recorded hash is a function of checkout history.
 *
 * That stayed invisible while each line baked and verified on its own machine.
 * It became visible the first time two lines merged — canonical's v267 matched
 * raw CRLF bytes 126 of 126, Codex's v271 matched LF-normalised bytes 126 of
 * 126, with nothing in between.
 *
 * THE TRAP THIS TOOL HAD TO CLIMB OUT OF: a file already stored with LF hashes
 * the same either way, so "raw matched" proves nothing about it — the two
 * hypotheses are not distinguishable on that file. The first draft counted such
 * files as raw matches and cheerfully reported a verdict; run mid-rebake, it
 * announced a SPLIT receipt that did not exist. Only a file that actually
 * CONTAINS CRLF can tell the two apart, so those are counted separately and a
 * verdict is refused when none of them exist.
 *
 * Usage:
 *   node tools/evidence-lineending-census.mjs            # every archived receipt
 *   node tools/evidence-lineending-census.mjs v271       # one receipt
 *   node tools/evidence-lineending-census.mjs --verbose  # name the stragglers
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EVIDENCE_DIR = path.join(ROOT, 'archive', 'evidence');
const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const lfNormalise = (buf) => Buffer.from(buf.toString('utf8').split(CR + LF).join(LF), 'utf8');

/**
 * Classify one artifact. `discriminating` is the only field that carries
 * evidence: a file without CRLF on disk hashes identically both ways, so it
 * can agree with anything and settles nothing.
 */
export function classifyArtifact(file, recorded) {
  if (!fs.existsSync(file)) return { verdict: 'missing', discriminating: false };
  const bytes = fs.readFileSync(file);
  const hasCrlf = bytes.includes(CR + LF);
  const rawMatch = sha(bytes) === recorded;
  const lfMatch = sha(lfNormalise(bytes)) === recorded;
  if (!hasCrlf) {
    // raw === normalised here. Agreement is real, but it cannot name a form.
    return { verdict: rawMatch ? 'agrees-indistinguishable' : 'mismatch', discriminating: false };
  }
  if (rawMatch) return { verdict: 'crlf-bound', discriminating: true };
  if (lfMatch) return { verdict: 'lf-bound', discriminating: true };
  return { verdict: 'mismatch', discriminating: true };
}

export function censusReceipt(receiptPath, root = ROOT) {
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  const tally = { crlfBound: 0, lfBound: 0, indistinguishable: 0, mismatch: 0, missing: 0, total: 0 };
  const strays = [];
  for (const [relative, recorded] of Object.entries(receipt.artifacts || {})) {
    tally.total++;
    const { verdict } = classifyArtifact(path.join(root, relative), recorded);
    if (verdict === 'crlf-bound') tally.crlfBound++;
    else if (verdict === 'lf-bound') tally.lfBound++;
    else if (verdict === 'agrees-indistinguishable') tally.indistinguishable++;
    else if (verdict === 'missing') { tally.missing++; strays.push(`missing: ${relative}`); }
    else { tally.mismatch++; strays.push(`mismatch: ${relative}`); }
  }
  return { version: path.basename(receiptPath, '.json'), tally, strays };
}

/**
 * Refuses wherever the evidence refuses. A receipt whose artifacts are all LF
 * on disk has told us nothing about which form it was baked against, and must
 * NOT read as agreement.
 */
export function verdictOf({ crlfBound, lfBound, indistinguishable, mismatch, missing, total }) {
  if (!total) return 'UNKNOWN — receipt records no artifacts';
  if (missing === total) return 'UNKNOWN — nothing on disk to compare against';
  if (crlfBound && lfBound) {
    return `SPLIT — ${crlfBound} CRLF-bound and ${lfBound} LF-bound in one receipt`;
  }
  if (crlfBound) return `CRLF-BOUND — baked on a checkout like this one (${crlfBound} discriminating)`;
  if (lfBound) return `LF-BOUND — describes committed content, not this disk (${lfBound} discriminating)`;
  if (mismatch) return `MISMATCH — ${mismatch} artifact(s) match neither form (real content drift)`;
  return `UNKNOWN — no discriminating artifact: all ${indistinguishable} agree, none carries CRLF`;
}

/** How inconsistent is the working tree itself? */
function worktreeCensus() {
  const dir = path.join(ROOT, 'narratives');
  if (!fs.existsSync(dir)) return null;
  let crlf = 0, lf = 0;
  for (const name of fs.readdirSync(dir).filter(n => n.endsWith('.md'))) {
    if (fs.readFileSync(path.join(dir, name), 'utf8').includes(CR + LF)) crlf++; else lf++;
  }
  return { crlf, lf };
}

const VERBOSE = process.argv.includes('--verbose');
const wanted = process.argv.slice(2).filter(a => !a.startsWith('--'));
const receipts = fs.readdirSync(EVIDENCE_DIR)
  .filter(name => name.endsWith('.json'))
  .filter(name => !wanted.length || wanted.includes(path.basename(name, '.json')))
  .sort();

if (!receipts.length) {
  console.log('[lineending-census] no matching receipts under archive/evidence/.');
} else {
  console.log('[lineending-census] which bytes each receipt describes');
  console.log('  (only files that CONTAIN CRLF on disk can tell the two apart;');
  console.log('   "indist." files agree either way and are evidence of nothing)\n');
  for (const name of receipts) {
    const { version, tally, strays } = censusReceipt(path.join(EVIDENCE_DIR, name));
    console.log(`  ${version.padEnd(6)} ${String(tally.total).padStart(4)} artifacts`
      + `  CRLF-bound ${String(tally.crlfBound).padStart(4)}`
      + `  LF-bound ${String(tally.lfBound).padStart(4)}`
      + `  indist. ${String(tally.indistinguishable).padStart(4)}`
      + `  mismatch ${String(tally.mismatch).padStart(3)}`
      + `  missing ${String(tally.missing).padStart(3)}`);
    console.log(`         -> ${verdictOf(tally)}`);
    if (VERBOSE) {
      for (const stray of strays.slice(0, 10)) console.log(`            ${stray}`);
      if (strays.length > 10) console.log(`            ... and ${strays.length - 10} more`);
    }
  }
}

const tree = worktreeCensus();
if (tree) {
  console.log(`\n[lineending-census] this working tree: ${tree.crlf} narratives with CRLF, `
    + `${tree.lf} with LF — a checkout is not uniform, which is the whole problem.`);
}
console.log('[lineending-census] passive instrument: nothing here fails a build.');
