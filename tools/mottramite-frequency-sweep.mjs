#!/usr/bin/env node
/**
 * tools/mottramite-frequency-sweep.mjs — measure mottramite's spawn FREQUENCY
 * at supergene_oxidation across many seeds, PRE- vs POST- the v196
 * sphalerite/wurtzite redox gate.
 *
 * THE QUESTION (boss, 2026-06-13): the gate dropped seed-42 supergene
 * mottramite 4→0. Is that a real regression, or did seed 42 just resample a
 * MARGINAL species from a hit to a miss? Run N seeds; report the % of seeds
 * mottramite spawns in. If the gate leaves that frequency ~unchanged, the
 * 4→0 is sampling noise on a rare phase (geologically fine — mottramite is a
 * rare supergene microcrystal), NOT the gate suppressing it.
 *
 * Runs BOTH modes in one process: post-gate = the current built engine;
 * pre-gate = the prototype σ methods temporarily replaced with their exact
 * pre-v196 (un-gated) formulas. Same seeds both modes → a clean paired test.
 *
 *   node tools/mottramite-frequency-sweep.mjs [N=100]
 */

import { loadSimBundle } from './_harness.mjs';

const N = parseInt(process.argv[2] || '100', 10);
const SCEN = 'supergene_oxidation';

const { SCENARIOS, VugSimulator, setSeed, VugConditions } =
  await loadSimBundle({ toolName: 'mottramite-frequency-sweep', extraExports: ['VugConditions'] });

const proto = VugConditions.prototype;
const gatedSphalerite = proto.supersaturation_sphalerite;
const gatedWurtzite = proto.supersaturation_wurtzite;

// Exact pre-v196 formulas (no redox gate) — reconstructed verbatim from the
// engine history so "pre-gate" mode is the true prior behavior.
function ungatedSphalerite() {
  if (this.fluid.Zn < 10 || this.fluid.S < 10) return 0;
  const product = (this.fluid.Zn / 100.0) * (this.fluid.S / 100.0);
  const T_factor = this.temperature <= 95
    ? 2.0 * Math.exp(-0.004 * this.temperature)
    : 2.0 * Math.exp(-0.01 * this.temperature);
  return product * T_factor;
}
function ungatedWurtzite() {
  if (this.fluid.Zn < 10 || this.fluid.S < 10) return 0;
  const T = this.temperature;
  const product = (this.fluid.Zn / 100.0) * (this.fluid.S / 100.0);
  if (T > 95) {
    let T_factor;
    if (T < 150) T_factor = (T - 95) / 55.0;
    else if (T <= 300) T_factor = 1.4;
    else T_factor = 1.4 * Math.exp(-0.005 * (T - 300));
    return product * T_factor;
  }
  if (this.fluid.pH >= 4.0) return 0;
  if (product < 1.0) return 0;
  if (this.fluid.Fe < 5) return 0;
  return product * 0.4;
}

const TRACK = ['mottramite', 'descloizite', 'sphalerite', 'molybdenite', 'bornite'];

function sweep(label) {
  const seen = {};   // mineral -> seeds-present count
  const tot = {};    // mineral -> total crystals across seeds
  for (const m of TRACK) { seen[m] = 0; tot[m] = 0; }
  for (let s = 1; s <= N; s++) {
    setSeed(s);
    const { conditions, events, defaultSteps } = SCENARIOS[SCEN]();
    const sim = new VugSimulator(conditions, events);
    const steps = defaultSteps ?? 200;
    for (let i = 0; i < steps; i++) sim.run_step();
    for (const m of TRACK) {
      const n = sim.crystals.filter((c) => c.mineral === m && c.total_growth_um > 0).length;
      if (n > 0) seen[m]++;
      tot[m] += n;
    }
  }
  console.log(`\n  [${label}]  (${N} seeds, ${SCEN})`);
  console.log(`    ${'mineral'.padEnd(14)} seeds-present   mean crystals/seed`);
  for (const m of TRACK) {
    console.log(`    ${m.padEnd(14)} ${String(seen[m]).padStart(3)}/${N} (${(100 * seen[m] / N).toFixed(0)}%)`
      + `     ${(tot[m] / N).toFixed(2)}`);
  }
  return { seen, tot };
}

console.log(`\nmottramite frequency sweep — does the v196 sulfide gate change its RATE, or just reshuffle seed 42?`);

proto.supersaturation_sphalerite = ungatedSphalerite;
proto.supersaturation_wurtzite = ungatedWurtzite;
const pre = sweep('PRE-gate (v195 behavior)');

proto.supersaturation_sphalerite = gatedSphalerite;
proto.supersaturation_wurtzite = gatedWurtzite;
const post = sweep('POST-gate (v196)');

console.log(`\n  VERDICT:`);
for (const m of ['mottramite', 'descloizite']) {
  const dp = (100 * (post.seen[m] - pre.seen[m]) / N).toFixed(0);
  console.log(`    ${m}: ${(100 * pre.seen[m] / N).toFixed(0)}% → ${(100 * post.seen[m] / N).toFixed(0)}%  (Δ ${dp} pts)`);
}
console.log(`\n  If mottramite's % is ~unchanged, the seed-42 4→0 is sampling noise on a rare`);
console.log(`  phase — geologically fine. A large drop would mean the gate truly suppresses it.`);
