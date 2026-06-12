#!/usr/bin/env node
/**
 * tools/halide-hopper-observe.mjs — standing judge for the halide
 * morphology claims (morphology-generalization arc, 2026-06-12;
 * pattern: elmwood-stepped-observe). Runs searles_lake across seeds and
 * reports the claims-table contract per seed:
 *
 *   - halite: ZONED salt-pan log (banded share ≥5% AND hopper share ≥5%
 *     of grown mass — the wet/dry stratification), hopper episodes
 *     present, headline size
 *   - sylvite: hopper episodes on spikes (hopper share > 0)
 *   - control claims: bisbee + tn457_barite_pulses halite stay 100%
 *     smooth (seed 42 spot-check only — the supergene/burial cubes must
 *     NOT hopper; the legacy in-step rule got bisbee wrong)
 *
 * Usage: node tools/halide-hopper-observe.mjs [--seeds 8]
 */

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'halide-hopper-observe' });

const args = process.argv.slice(2);
const N_SEEDS = args.includes('--seeds') ? Number(args[args.indexOf('--seeds') + 1]) : 8;

function runScenario(name, seed) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  for (let s = 0; s < (defaultSteps ?? 120); s++) sim.run_step();
  return sim;
}

function regimeMass(sim, mineral) {
  const mass = {};
  let total = 0, maxUm = 0, n = 0;
  for (const c of sim.crystals) {
    if (!c || c.mineral !== mineral || c.dissolved || !(c.total_growth_um > 0)) continue;
    n++;
    maxUm = Math.max(maxUm, c.total_growth_um);
    for (const z of c.zones || []) {
      if (!(z.thickness_um > 0) || !z.morph_regime) continue;
      mass[z.morph_regime] = (mass[z.morph_regime] || 0) + z.thickness_um;
      total += z.thickness_um;
    }
  }
  const share = (r) => (total > 0 ? (mass[r] || 0) / total : 0);
  return {
    n, maxUm, total,
    banded: share('stepped_mild') + share('stepped_macro'),
    hopper: share('hopper_skeletal'),
    dendr: share('dendritic'),
    smooth: share('spiral_smooth'),
  };
}

const pct = (x) => `${Math.round(x * 100)}%`;
let pass = 0;

console.log(`\n### HALIDE MORPHOLOGY JUDGE — searles_lake × ${N_SEEDS} seeds`);
console.log('  seed  halite n/max-mm   banded  hopper  smooth   sylvite hopper   verdict');
for (let i = 0; i < N_SEEDS; i++) {
  const seed = 42 + i;
  const sim = runScenario('searles_lake', seed);
  const hal = regimeMass(sim, 'halite');
  const syl = regimeMass(sim, 'sylvite');
  const ok = hal.n > 0 && hal.banded >= 0.05 && hal.hopper >= 0.05 && syl.hopper > 0;
  if (ok) pass++;
  console.log(`  ${String(seed).padEnd(5)} ${String(hal.n).padStart(2)} / ${(hal.maxUm / 1000).toFixed(1).padStart(5)}      ${pct(hal.banded).padStart(4)}   ${pct(hal.hopper).padStart(4)}   ${pct(hal.smooth).padStart(4)}     ${pct(syl.hopper).padStart(4)}            ${ok ? 'PAN-LOG ✓' : 'MISS ✗'}`);
}
console.log(`\n  ${pass}/${N_SEEDS} seeds satisfy the salt-pan-log contract (banded ≥5% AND hopper ≥5% + sylvite hopper episodes)`);

// Control claims (seed 42): the smooth scenarios must stay smooth.
console.log('\n### CONTROLS (seed 42) — must be 100% smooth (the legacy in-step rule called bisbee hopper; the ladder must not)');
for (const scen of ['bisbee', 'tn457_barite_pulses']) {
  const sim = runScenario(scen, 42);
  const hal = regimeMass(sim, 'halite');
  const ok = hal.n === 0 || (hal.hopper === 0 && hal.dendr === 0 && hal.banded === 0);
  console.log(`  ${scen.padEnd(22)} halite ${hal.n} crystals, smooth ${pct(hal.smooth)} ${ok ? '✓' : '— NOT SMOOTH ✗'}`);
}
console.log();
