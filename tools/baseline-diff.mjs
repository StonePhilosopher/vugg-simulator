#!/usr/bin/env node
/**
 * tools/baseline-diff.mjs — per-scenario movement summary between two
 * seed-42 baselines. The rebake-review companion to gen-js-baseline.mjs
 * (its header says "inspect the diff" — this is that, structured:
 * species gained/lost + crystal-count drift per scenario, plus the
 * fleet-level net-lost list, which is the first red-flag to chase).
 *
 * Usage: node tools/baseline-diff.mjs [vOld] [vNew]
 *   defaults: the two highest seed42_v*.json present.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIR = path.join(ROOT, 'tests-js', 'baselines');

const versions = fs.readdirSync(DIR)
  .map(f => /^seed42_v(\d+)\.json$/.exec(f))
  .filter(Boolean).map(m => Number(m[1])).sort((a, b) => a - b);

const [, , argOld, argNew] = process.argv;
const vNew = argNew ? Number(String(argNew).replace(/^v/, '')) : versions[versions.length - 1];
const vOld = argOld ? Number(String(argOld).replace(/^v/, '')) : versions[versions.length - 2];

const load = v => JSON.parse(fs.readFileSync(path.join(DIR, `seed42_v${v}.json`), 'utf8'));
const A = load(vOld), B = load(vNew);

console.log(`baseline diff: v${vOld} → v${vNew}\n`);

const scens = Object.keys(B).filter(k => !k.startsWith('_'));
let moved = 0;
const gained = [], lost = [];
for (const s of scens) {
  const sa = new Set(Object.keys(A[s] || {})), sb = new Set(Object.keys(B[s] || {}));
  const g = [...sb].filter(x => !sa.has(x)), l = [...sa].filter(x => !sb.has(x));
  const ca = Object.values(A[s] || {}).reduce((n, v) => n + v.total, 0);
  const cb = Object.values(B[s] || {}).reduce((n, v) => n + v.total, 0);
  if (g.length || l.length || ca !== cb) {
    moved++;
    console.log(`  ${s}: species ${sa.size}→${sb.size}, crystals ${ca}→${cb}`
      + (g.length ? `  +[${g.join(',')}]` : '') + (l.length ? `  -[${l.join(',')}]` : ''));
  }
  gained.push(...g); lost.push(...l);
}
console.log(`\n${moved}/${scens.length} scenarios moved; species appearances gained ${gained.length}, lost ${lost.length}`);
const lostNet = [...new Set(lost)].filter(x => !gained.includes(x));
console.log('species lost fleet-wide (in no scenario anymore among the movers): '
  + (lostNet.length ? lostNet.join(', ') : '(none)'));
