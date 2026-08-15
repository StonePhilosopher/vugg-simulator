#!/usr/bin/env node
/**
 * tools/drift-audit.mjs — audit the drift RECORD, not the simulator.
 *
 * ADDITIVE. Depends only on tools/drift-analysis.mjs. tools/baseline-diff.mjs
 * is untouched and keeps its exact behaviour and interface; this runs it as a
 * subprocess and reports what it says, so the two instruments can be read side
 * by side. Delete this file and drift-analysis.mjs and the rebake workflow is
 * exactly as it was.
 *
 * PASSIVE. Annotates, always exits 0. It is not a gate and must not become
 * one: the findings below are already in the archive and cannot be un-shipped,
 * so a tool that exited 1 on them would be red forever and get switched off.
 * The gate is tests-js/calibration-shard-*.test.ts.
 *
 * WHAT IT ANSWERS
 *
 *   1. WHERE THE LEGACY SUMMARY UNDER-REPORTS. tools/baseline-diff.mjs asks a
 *      narrower question than the gate — species set plus the SUM of `total`
 *      per scenario — so redistribution at constant total, size-only movement
 *      and active/dissolved reclassification are all invisible to it. This
 *      names every scenario the gate calls moved that the summary did not, and
 *      WHY each one counts as changed. That comparison is the most useful
 *      result here, and it is why baseline-diff.mjs stays exactly as it is:
 *      the archive's claims were written against that tool, so it is the only
 *      valid measuring stick for deciding which claims to re-read.
 *
 *   2. WHETHER THE HEADLINE STILL DISCRIMINATES. "N scenarios moved" is only
 *      useful while it varies. If it saturates it has stopped measuring and
 *      review needs a magnitude instead.
 *
 *   3. WHAT KIND OF DRIFT each bump carried — species / redistribution /
 *      counts / size / split.
 *
 * Usage:
 *   node tools/drift-audit.mjs                 whole recorded history
 *   node tools/drift-audit.mjs --from 180      from v180 on
 *   node tools/drift-audit.mjs --pair 189 190  one bump, in detail
 *   node tools/drift-audit.mjs --kinds         per-bump drift-kind table
 *
 * Runs the legacy tool once per bump, so a full sweep takes about a minute.
 */
import { compareBump, listVersions } from './drift-analysis.mjs';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const FROM = Number(arg('from', 0));
const KINDS = argv.includes('--kinds');
const PAIR = argv.indexOf('--pair');

const pct = (n, d) => `${((n / d) * 100).toFixed(0)}%`;
const loudest = (d) => (d.sizes[0]
  ? `${d.sizes[0].mineral} ${d.sizes[0].from}→${d.sizes[0].to}` : '');

/* --- one bump, in detail ---------------------------------------------- */

if (PAIR !== -1) {
  const vOld = Number(String(argv[PAIR + 1]).replace(/^v/, ''));
  const vNew = Number(String(argv[PAIR + 2]).replace(/^v/, ''));
  const r = compareBump(vOld, vNew);
  console.log(`\ndrift-audit — v${vOld} → v${vNew}\n`);
  console.log(`  legacy baseline-diff says   ${r.legacy.parsed ? `${r.legacy.moved}/${r.legacy.total} moved` : 'UNPARSEABLE — its output format changed'}`
    + (r.legacy.movers.length ? `  [${r.legacy.movers.join(', ')}]` : ''));
  console.log(`  the gate says               ${r.gateMovers.length}/${r.scenarios} moved`
    + (r.gateMovers.length ? `  [${r.gateMovers.join(', ')}]` : ''));
  if (!r.missed.length) {
    console.log('\n  the two agree on this bump.');
  } else {
    console.log(`\n  ${r.missed.length} scenario(s) the summary did not name:\n`);
    for (const m of r.missed) {
      console.log(`    ${m.scenario}`);
      console.log(`      why it counts as changed: ${m.classes.join(', ')}`);
      console.log(`      species ${m.gained.length ? `+${m.gained.join(',')}` : 'unchanged'}`
        + `${m.lost.length ? ` -${m.lost.join(',')}` : ''}`
        + `   crystals ${m.countA}→${m.countB}`);
      console.log(`      counts moved on ${m.counts.length}, max_um on ${m.sizes.length}, active/dissolved on ${m.splits}`);
      if (m.sizes.length) {
        for (const s of m.sizes.slice(0, 5)) console.log(`        ${s.mineral.padEnd(20)} ${s.from} → ${s.to}`);
        if (m.sizes.length > 5) console.log(`        ... and ${m.sizes.length - 5} more`);
      }
    }
  }
  console.log('\n(passive instrument — reports, never fails. The gate is tests-js/calibration-shard-*.test.ts.)');
  process.exit(0);
}

/* --- the whole history ------------------------------------------------ */

const versions = listVersions().filter((v) => v >= FROM);
if (versions.length < 2) {
  console.log('drift-audit: need at least two baselines to compare.');
  process.exit(0);
}

const bumps = [];
for (let i = 1; i < versions.length; i += 1) {
  bumps.push(compareBump(versions[i - 1], versions[i]));
}

console.log(`\ndrift-audit — v${versions[0]} → v${versions[versions.length - 1]}, ${bumps.length} consecutive bumps\n`);

/* 1. where the legacy summary under-reports */

const disagreements = bumps.filter((x) => x.missed.length > 0);
const missedTotal = disagreements.reduce((n, x) => n + x.missed.length, 0);
const unparseable = bumps.filter((x) => !x.legacy.parsed);
console.log('1. where the legacy summary under-reports');
if (unparseable.length) {
  console.log(`   WARNING: ${unparseable.length} bumps where baseline-diff.mjs output could not be parsed`
    + ' — its format may have changed, and these rows are not trustworthy.');
}
if (!disagreements.length) {
  console.log('   none: every scenario the gate calls moved, the summary names too.');
} else {
  console.log(`   ${disagreements.length} bumps, ${missedTotal} scenario-instances the gate calls moved`
    + ' and baseline-diff.mjs did not name\n');
  for (const x of disagreements) {
    for (const m of x.missed) {
      // 27 wide: 'redistribution+size+split' is 25 and must not run into the
      // counts column, which is what makes this table scannable at all.
      console.log(`     v${x.from}→v${x.to}  ${m.scenario.padEnd(24)}${m.classes.join('+').padEnd(27)}`
        + `counts ${String(m.counts.length).padStart(2)}  max_um ${String(m.sizes.length).padStart(2)}`
        + `  split ${String(m.splits).padStart(2)}   ${loudest(m)}`);
    }
  }
  console.log('\n   These are already in the archive. The commit messages and version-history'
    + '\n   entries for them were written against the legacy summary and should be'
    + '\n   re-read with this list beside them.');
}

/* 2. does the headline still discriminate? */

const movers = bumps.map((x) => x.gateMovers.length);
const q = (p) => [...movers].sort((a, b) => a - b)[Math.min(movers.length - 1, Math.floor(p * movers.length))];
const silent = movers.filter((m) => m === 0).length;
const saturated = bumps.filter((x, i) => movers[i] > 0.75 * x.scenarios).length;
console.log('\n2. does "N scenarios moved" still discriminate?');
console.log(`   bumps moving nothing      ${silent}/${bumps.length}  (${pct(silent, bumps.length)})`);
console.log(`   p10 ${q(0.1)}   median ${q(0.5)}   p90 ${q(0.9)}   max ${Math.max(...movers)}`
  + `   (fleet is now ${bumps[bumps.length - 1].scenarios} scenarios)`);
console.log(`   distinct values taken     ${new Set(movers).size}`);
console.log(`   bumps moving >75% of the fleet   ${saturated}`);
console.log(saturated > bumps.length / 2
  ? '   SATURATED — the headline has stopped measuring; review needs a magnitude instead.'
  : '   healthy — the number still separates a big bump from a small one.');

/* 3. what kind of drift? */

const tally = {};
for (const x of bumps) {
  const kinds = new Set();
  for (const m of x.missed) for (const c of m.classes) kinds.add(c);
  for (const k of kinds) tally[k] = (tally[k] ?? 0) + 1;
}
console.log('\n3. drift classes among the movements the summary missed');
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  console.log(`   ${k.padEnd(16)} ${n} bumps`);
}

if (KINDS) {
  console.log('\n   per-bump table (bumps with a missed scenario)');
  for (const x of disagreements) {
    console.log(`     v${String(x.to).padEnd(5)} gate ${String(x.gateMovers.length).padStart(3)}/${x.scenarios}`
      + `   legacy ${String(x.legacy.moved).padStart(3)}/${x.legacy.total}`
      + `   missed ${x.missed.map((m) => m.scenario).join(' ')}`);
  }
}

console.log('\n(passive instrument — reports, never fails. The gate is tests-js/calibration-shard-*.test.ts.)');
