#!/usr/bin/env node
/**
 * tools/wittichen-sulfate-probe.mjs — why doesn't barite fire at
 * wittichen? (fix-backlog 2026-06-12; the gate-census pattern from the
 * roughten_gill linarite arc: measure the gate components per step,
 * find which one misses and by how much.)
 *
 * Logs, per step: T, pH, fluid O2, Ba, S, σ_barite, plus the gate
 * component verdicts (Ba≥5, S≥10, sulfateRedoxAvailable@0.1) and the
 * erythrite components (Co, As(V), T≤50?, O2) — to settle whether
 * erythrite is reachable inside this scenario's window at all.
 *
 * Usage: node tools/wittichen-sulfate-probe.mjs [--seed 42] [--every 5]
 *        [--set Ba=75] (probe a hypothetical broth tune without editing
 *        the scenario — applied to the initial fluid before step 0)
 */

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'wittichen-sulfate-probe' });

const args = process.argv.slice(2);
const SEED = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : 42;
const EVERY = args.includes('--every') ? Number(args[args.indexOf('--every') + 1]) : 5;
const sets = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--set' && args[i + 1]) {
    const [k, v] = args[i + 1].split('=');
    sets.push([k, Number(v)]);
  }
}

setSeed(SEED);
const { conditions, events, defaultSteps } = SCENARIOS.wittichen();
for (const [k, v] of sets) {
  conditions.fluid[k] = v;
  console.log(`[probe] initial fluid.${k} := ${v}`);
}
const sim = new VugSimulator(conditions, events);
const n = defaultSteps ?? 160;

console.log(`\n### WITTICHEN SULFATE GATE CENSUS — seed ${SEED}, ${n} steps`);
console.log('  step    T     pH    O2     Ba     S    σ_brt  | gate: Ba≥5  S≥10  redox | ery: Co   As    T≤50  σ_ery');
let bariteEverPositive = false, eryEverPositive = false;
let bariteFirst = -1;
for (let s = 0; s < n; s++) {
  sim.run_step();
  const c = sim.conditions, f = c.fluid;
  const sigB = c.supersaturation_barite();
  const sigE = c.supersaturation_erythrite();
  if (sigB > 0 && bariteFirst < 0) bariteFirst = s;
  if (sigB >= 1) bariteEverPositive = true;
  if (sigE >= 1) eryEverPositive = true;
  if (s % EVERY === 0 || sigB >= 1 || sigE >= 1) {
    console.log(`  ${String(s).padStart(4)}  ${c.temperature.toFixed(0).padStart(4)}  ${f.pH.toFixed(1).padStart(5)}  ${(f.O2 ?? 0).toFixed(2).padStart(5)}  ${f.Ba.toFixed(0).padStart(4)}  ${f.S.toFixed(0).padStart(4)}   ${sigB.toFixed(2).padStart(5)}  |       ${f.Ba >= 5 ? '✓' : '✗'}     ${f.S >= 10 ? '✓' : '✗'}     ${(f.O2 ?? 0) >= 0.1 ? '✓' : '✗'}   |    ${f.Co.toFixed(0).padStart(3)}  ${f.As.toFixed(0).padStart(4)}    ${c.temperature <= 50 ? '✓' : '✗'}   ${sigE.toFixed(2).padStart(5)}`);
  }
}
const alive = (m) => sim.crystals.filter((x) => x.mineral === m && !x.dissolved && x.total_growth_um > 0).length;
console.log(`\n  barite σ first >0 at step ${bariteFirst}; ever ≥1: ${bariteEverPositive}; barite crystals: ${alive('barite')}`);
console.log(`  erythrite ever σ≥1: ${eryEverPositive}; erythrite crystals: ${alive('erythrite')}`);
console.log(`  suite check: skutterudite ${alive('skutterudite')}, safflorite ${alive('safflorite')}, native_bismuth ${alive('native_bismuth')}, acanthite ${alive('acanthite')}, calcite ${alive('calcite')}`);
// full species census — watch for Ba-budget side effects (witherite is
// the BaCO3 competitor at the carbonate stage; not a Wittichen mineral)
const census = {};
for (const x of sim.crystals) {
  if (x.dissolved || !(x.total_growth_um > 0)) continue;
  census[x.mineral] = (census[x.mineral] || 0) + 1;
}
console.log(`  census: ${Object.entries(census).sort().map(([m, k]) => `${m}×${k}`).join('  ')}`);
