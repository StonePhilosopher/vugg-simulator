#!/usr/bin/env node
/**
 * tools/drift-audit.mjs — audit the drift RECORD, not the simulator.
 *
 * Everything else in the rebake ritual asks "did the sim move?". This asks
 * "can the summary we read still tell us?" — and it is the instrument that
 * would have caught the defect that motivated it.
 *
 * PASSIVE. It annotates and always exits 0. It is not a gate and must not
 * become one: the gate is tests-js/calibration.test.ts, and the historical
 * findings below are already in the archive and cannot be un-shipped, so a
 * tool that exited 1 on them would be red forever and get switched off.
 *
 * THREE QUESTIONS
 *
 *   1. Does the summary agree with the gate?  For every consecutive pair,
 *      `scenarioMoved` (which IS the gate's comparison) against `legacyMoved`
 *      (the pre-2026-08-13 predicate: species set + SUM of totals per
 *      scenario). Any disagreement is a bump whose recorded review under-
 *      reported. This is kept AFTER the fix, not deleted with it, because the
 *      archive still contains the claims the old predicate produced and a
 *      future reader needs to know which ones to re-read.
 *
 *   2. Does the headline number still discriminate?  "N scenarios moved" is
 *      only useful while it varies. If it ever saturates — most bumps moving
 *      most scenarios — it has stopped being a measurement and the review
 *      needs a magnitude instead. Measured 2026-08-13 over v26-v237: 40% of
 *      bumps moved nothing, median 1 scenario, p90 11, 21 distinct values.
 *      Healthy. Re-run it when the fleet grows.
 *
 *   3. What KIND of drift does each bump carry?  Species / counts / sizes /
 *      the active-dissolved split. Size-only bumps are the category the old
 *      predicate was blind to, so being able to list them is the point.
 *
 * Usage:
 *   node tools/drift-audit.mjs                 whole recorded history
 *   node tools/drift-audit.mjs --from 180      from v180 on
 *   node tools/drift-audit.mjs --kinds         per-bump drift-kind table
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeMove, listVersions, loadBaseline, scenarioMoved } from './baseline-diff.mjs';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const FROM = Number(arg('from', 0));
const KINDS = argv.includes('--kinds');

/**
 * The predicate this tool used before 2026-08-13, kept verbatim.
 *
 * Species set difference plus the SUM of `total` across minerals — so a
 * redistribution at constant scenario total, a max_um shift, or an
 * active/dissolved reclassification all read as "clean".
 */
function legacyMoved(a = {}, b = {}) {
  const sa = new Set(Object.keys(a));
  const sb = new Set(Object.keys(b));
  if ([...sb].some((x) => !sa.has(x)) || [...sa].some((x) => !sb.has(x))) return true;
  const ca = Object.values(a).reduce((n, v) => n + (v.total ?? 0), 0);
  const cb = Object.values(b).reduce((n, v) => n + (v.total ?? 0), 0);
  return ca !== cb;
}

const scenariosOf = (base) => Object.keys(base).filter((k) => !k.startsWith('_'));

const versions = listVersions().filter((v) => v >= FROM);
if (versions.length < 2) {
  console.log('drift-audit: need at least two baselines to compare.');
  process.exit(0);
}

const bumps = [];
let prev = loadBaseline(versions[0]);
for (let i = 1; i < versions.length; i += 1) {
  const next = loadBaseline(versions[i]);
  const scens = [...new Set([...scenariosOf(prev), ...scenariosOf(next)])];
  let gateMovers = 0;
  let legacyMovers = 0;
  const missed = [];
  const kinds = new Set();
  for (const s of scens) {
    const a = prev[s] ?? {};
    const b = next[s] ?? {};
    const gate = scenarioMoved(a, b);
    const legacy = legacyMoved(a, b);
    if (gate) gateMovers += 1;
    if (legacy) legacyMovers += 1;
    if (gate && !legacy) {
      const d = describeMove(a, b);
      missed.push({ s, d });
      if (d.sizes.length) kinds.add('max_um');
      if (d.counts.length) kinds.add('counts');
      if (d.splits) kinds.add('split');
    } else if (gate) {
      const d = describeMove(a, b);
      if (d.gained.length || d.lost.length) kinds.add('species');
      if (d.counts.length) kinds.add('counts');
      if (d.sizes.length) kinds.add('max_um');
      if (d.splits) kinds.add('split');
    }
  }
  bumps.push({ from: versions[i - 1], to: versions[i], scens: scens.length, gateMovers, legacyMovers, missed, kinds: [...kinds] });
  prev = next;
}

/* --- 1. does the summary agree with the gate? ------------------------- */

const disagreements = bumps.filter((x) => x.missed.length > 0);
console.log(`\ndrift-audit — v${versions[0]} → v${versions[versions.length - 1]}, ${bumps.length} consecutive bumps\n`);
console.log('1. summary vs gate');
if (disagreements.length === 0) {
  console.log('   no disagreements: every scenario the gate calls moved, the summary calls moved.');
} else {
  console.log(`   ${disagreements.length} bumps where the LEGACY predicate under-reported`
    + ' (the current one cannot, by construction — it is the gate\'s own comparison)');
  for (const x of disagreements) {
    for (const { s, d } of x.missed) {
      const loud = d.sizes[0] ? `${d.sizes[0].m} ${d.sizes[0].from}→${d.sizes[0].to}` : '';
      console.log(`     v${x.from}→v${x.to}  ${s.padEnd(24)}`
        + `counts ${String(d.counts.length).padStart(2)}  max_um ${String(d.sizes.length).padStart(2)}`
        + `  split ${String(d.splits).padStart(2)}   ${loud}`);
    }
  }
  console.log('   these are already in the archive; the commit messages for them were written'
    + '\n   against the old summary and should be re-read with this list beside them.');
}

/* --- 2. does the headline still discriminate? ------------------------- */

const movers = bumps.map((x) => x.gateMovers);
const q = (p) => [...movers].sort((a, b) => a - b)[Math.min(movers.length - 1, Math.floor(p * movers.length))];
const silent = movers.filter((m) => m === 0).length;
const fleet = bumps[bumps.length - 1].scens;
const saturated = movers.filter((m, i) => m > 0.75 * bumps[i].scens).length;
console.log('\n2. does "N scenarios moved" still discriminate?');
console.log(`   bumps moving nothing      ${silent}/${bumps.length}  (${((silent / bumps.length) * 100).toFixed(0)}%)`);
console.log(`   p10 ${q(0.1)}   median ${q(0.5)}   p90 ${q(0.9)}   max ${Math.max(...movers)}   (fleet is now ${fleet} scenarios)`);
console.log(`   distinct values taken     ${new Set(movers).size}`);
console.log(`   bumps moving >75% of the fleet   ${saturated}`);
console.log(saturated > bumps.length / 2
  ? '   SATURATED — the headline has stopped measuring; review needs a magnitude instead.'
  : '   healthy — the number still separates a big bump from a small one.');

/* --- 3. what kind of drift? ------------------------------------------ */

const tally = {};
for (const x of bumps) for (const k of x.kinds) tally[k] = (tally[k] ?? 0) + 1;
console.log('\n3. drift kinds across the history');
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  console.log(`   ${k.padEnd(10)} ${n} bumps`);
}
const sizeOnly = bumps.filter((x) => x.kinds.length === 1 && x.kinds[0] === 'max_um');
console.log(`   size-only bumps (no species, no counts, no split): ${sizeOnly.length}`
  + (sizeOnly.length ? `  [${sizeOnly.map((x) => `v${x.to}`).join(' ')}]` : ''));

if (KINDS) {
  console.log('\n   per-bump table');
  for (const x of bumps) {
    if (!x.gateMovers) continue;
    console.log(`     v${String(x.to).padEnd(5)} ${String(x.gateMovers).padStart(3)}/${x.scens} moved   ${x.kinds.join(' ') || '-'}`);
  }
}

console.log('\n(passive instrument — reports, never fails. The gate is tests-js/calibration.test.ts.)');
