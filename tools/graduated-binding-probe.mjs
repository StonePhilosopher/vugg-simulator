// tools/graduated-binding-probe.mjs — does graduated rationing ever BIND?
//
// Born from the v177 cell-key fix (REVIEW-THREE-METRICS-2026-06-09 §1.3):
// the per-cell competition key had collapsed to per-ring since v128c, yet
// fixing it produced ZERO seed-42 baseline drift across all 31 scenarios.
// The hypothesis that explains both facts: rationing essentially never
// binds at current MASS_BALANCE_SCALE — per-step demands are tiny against
// cell fluid pools, so allocation factors sit at 1.0 and the group key is
// (today) latent. This probe turns that hypothesis into a number.
//
// Reads the _gradCompStats observer counter in 44-graduated-competition.ts.
// Per scenario at seed 42: groups formed, multi-crystal groups (contention
// possible), allocation decisions, how many were BOUND (scaled < 0.999),
// and the deepest scaling seen.
//
// Run: node tools/graduated-binding-probe.mjs [scenario ...]
//      (no args = all scenarios)

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed, _gradCompStats } = await loadSimBundle({
  toolName: 'graduated-binding-probe',
  extraExports: ['_gradCompStats'],
});

const wanted = process.argv.slice(2);
const ids = wanted.length ? wanted : Object.keys(SCENARIOS).sort();

console.log('scenario                          groups  multi  maxSz  allocs  bound  minScale');
console.log('-'.repeat(82));
let totalBound = 0, totalAllocs = 0;
for (const id of ids) {
  if (!SCENARIOS[id]) { console.log(`${id}: unknown scenario`); continue; }
  _gradCompStats.reset();
  setSeed(42);
  const { conditions, events, defaultSteps } = SCENARIOS[id]();
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < (defaultSteps ?? 160); i++) sim.run_step();
  const s = _gradCompStats;
  totalBound += s.bound; totalAllocs += s.allocations;
  console.log(
    id.padEnd(32) +
    String(s.calls).padStart(7) +
    String(s.multiCrystalGroups).padStart(7) +
    String(s.maxGroupSize).padStart(7) +
    String(s.allocations).padStart(8) +
    String(s.bound).padStart(7) +
    (s.bound ? s.minScaling.toFixed(3) : '  —').padStart(10)
  );
}
console.log('-'.repeat(82));
console.log(`TOTAL: ${totalBound}/${totalAllocs} allocations bound (${totalAllocs ? (100 * totalBound / totalAllocs).toFixed(2) : 0}%)`);
