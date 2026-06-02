#!/usr/bin/env node
/**
 * tools/mvt-redox-observe.mjs — Phase 4c.3b DARK OBSERVATION (commits nothing).
 *
 * The MVT redox research (RESEARCH-mvt-redox-2026-06-02.md) corrected the pilot:
 * the ore fluid is REDUCING throughout (log fO2 ~ -52..-55, deep in the sulfide
 * field), NOT oscillating. But `mvt` expects BARITE (a sulfate) — a strongly-
 * reducing fluid suppresses sulfate, so a naive "reducing throughout" Eh movement
 * may WIPE barite. This injects candidate Eh movements at RUNTIME (no commit, no
 * baseline bake) and reports the resulting assemblage so we pick a shape that
 * keeps the full expects_species [sphalerite, galena, fluorite, barite, calcite].
 *
 * Variants (Eh is driven; with a movement on fluid.Eh, run_step flips to
 * Eh-canonical — 4c.3a — so O2 follows Eh = o2FromEh(Eh)):
 *   BASE   no movement (current ship state: Eh flat ~+24 mV, O2 0.25)
 *   FLAT   Eh held reducing ~-250 mV the whole run + OU texture
 *          (the "always in the sulfide field" literal reading — barite risk)
 *   TREND  Eh +50 mV (barite/sulfate-stable) → -250 mV (reducing) smoothstep
 *          + OU — the paragenetic reading: sulfate gangue early, sulfides late
 *
 * Usage: node tools/mvt-redox-observe.mjs
 */

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'mvt-redox-observe' });

const SCEN = 'mvt';
const STEPS = SCENARIOS[SCEN]().defaultSteps ?? 120;
const EXPECTS = ['sphalerite', 'galena', 'fluorite', 'barite', 'calcite'];

const SHAPES = {
  BASE: null,
  FLAT: [{ field: 'fluid.Eh', startStep: 0, endStep: STEPS, base: -250,
          ops: [{ kind: 'trend', amp: 0 }], texture: { theta: 0.3, sigma: 15 } }],
  TREND: [{ field: 'fluid.Eh', startStep: 0, endStep: STEPS, base: 50,
           ops: [{ kind: 'trend', amp: -300, ease: true }], texture: { theta: 0.3, sigma: 15 } }],
};

function run(movements) {
  setSeed(42);
  const { conditions, events } = SCENARIOS[SCEN]();
  const sim = new VugSimulator(conditions, events);
  if (movements) {
    if (!sim.conditions._scenario) sim.conditions._scenario = {};
    sim.conditions._scenario.movements = movements;
  }
  const eh = [];
  for (let s = 0; s < STEPS; s++) { sim.run_step(); eh.push(sim.conditions.fluid.Eh); }
  const counts = {};
  for (const c of sim.crystals) {
    counts[c.mineral] = counts[c.mineral] || { n: 0, max: 0 };
    counts[c.mineral].n++;
    if (c.total_growth_um > counts[c.mineral].max) counts[c.mineral].max = Math.round(c.total_growth_um);
  }
  const ehMin = Math.min(...eh), ehMax = Math.max(...eh);
  const ehMean = eh.reduce((s, x) => s + x, 0) / eh.length;
  return { counts, ehMin, ehMax, ehMean };
}

const R = {};
for (const k of Object.keys(SHAPES)) R[k] = run(SHAPES[k]);

console.log(`\n### MVT redox dark observation — ${STEPS} steps, seed 42 (Eh-canonical when driven)\n`);
console.log('  variant   Eh min / mean / max (mV)');
for (const k of Object.keys(R)) {
  console.log(`  ${k.padEnd(7)} ${R[k].ehMin.toFixed(0).padStart(6)} / ${R[k].ehMean.toFixed(0).padStart(5)} / ${R[k].ehMax.toFixed(0).padStart(5)}`);
}

console.log('\n  === expects_species survival (n crystals, max µm) ===');
console.log('  mineral        BASE            FLAT            TREND');
console.log('  ----------------------------------------------------------------');
const fmt = (c) => c ? `${c.n}×${c.max}µm`.padEnd(14) : '— GONE —'.padEnd(14);
for (const m of EXPECTS) {
  console.log(`  ${m.padEnd(13)} ${fmt(R.BASE.counts[m])}  ${fmt(R.FLAT.counts[m])}  ${fmt(R.TREND.counts[m])}`);
}

console.log('\n  === full assemblage per variant ===');
for (const k of Object.keys(R)) {
  const sp = Object.keys(R[k].counts).sort();
  const lost = EXPECTS.filter((m) => !R[k].counts[m]);
  console.log(`  ${k}: ${sp.length} species — ${sp.join(', ')}`);
  console.log(`     expects_species lost: ${lost.length ? lost.join(', ') : 'NONE ✓'}`);
}
