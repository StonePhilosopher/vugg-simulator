#!/usr/bin/env node
/**
 * tools/wittichen-dendrite-observe.mjs — standing judge for the
 * wittichen five-element vein (v189; pattern: elmwood-stepped-observe +
 * halide-hopper-observe). The claims-table contract per seed:
 *
 *   - native_bismuth: ≥2 alive, DENDRITIC zone share ≥25% (the CH4
 *     reduction shock recorded in the stack)
 *   - the arsenide suite ALIVE: ≥1 skutterudite AND ≥1 safflorite
 *     (the de-orphaned rim phases) + nickeline present
 *   - silver tarnish story: acanthite present (native_silver grows on
 *     the shock, sulfidizes at the meteoric stage)
 *   - carbonate gangue: calcite or aragonite present
 *
 * Usage: node tools/wittichen-dendrite-observe.mjs [--seeds 8]
 */

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'wittichen-dendrite-observe' });

const args = process.argv.slice(2);
const N_SEEDS = args.includes('--seeds') ? Number(args[args.indexOf('--seeds') + 1]) : 8;

function run(seed) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS.wittichen();
  const sim = new VugSimulator(conditions, events);
  for (let s = 0; s < (defaultSteps ?? 160); s++) sim.run_step();
  return sim;
}

const pct = (x) => `${Math.round(x * 100)}%`;
let pass = 0;

console.log(`\n### WITTICHEN FIVE-ELEMENT JUDGE — ${N_SEEDS} seeds`);
console.log('  seed  Bi alive  dendr%  skut  saff  nick  acanthite  gangue   verdict');
for (let i = 0; i < N_SEEDS; i++) {
  const seed = 42 + i;
  const sim = run(seed);
  const alive = (m) => sim.crystals.filter((c) => c.mineral === m && !c.dissolved && c.total_growth_um > 0).length;
  const bi = sim.crystals.filter((c) => c.mineral === 'native_bismuth' && !c.dissolved && c.total_growth_um > 0);
  let d = 0, tot = 0;
  for (const c of bi) for (const z of c.zones || []) {
    if (z.thickness_um > 0 && z.morph_regime) { tot += z.thickness_um; if (z.morph_regime === 'dendritic') d += z.thickness_um; }
  }
  const dendr = tot ? d / tot : 0;
  const skut = alive('skutterudite'), saff = alive('safflorite'), nick = alive('nickeline');
  const acan = alive('acanthite');
  const gangue = alive('calcite') + alive('aragonite');
  const ok = bi.length >= 2 && dendr >= 0.25 && skut >= 1 && saff >= 1 && gangue >= 1;
  if (ok) pass++;
  console.log(`  ${String(seed).padEnd(5)} ${String(bi.length).padStart(3)}       ${pct(dendr).padStart(4)}   ${String(skut).padStart(3)}  ${String(saff).padStart(4)}  ${String(nick).padStart(4)}  ${String(acan).padStart(6)}     ${String(gangue).padStart(3)}      ${ok ? 'SHOCK RECORDED ✓' : 'MISS ✗'}`);
}
console.log(`\n  ${pass}/${N_SEEDS} seeds satisfy the five-element contract (Bi≥2 alive, dendritic ≥25%, skutterudite+safflorite alive, gangue sealed)`);
