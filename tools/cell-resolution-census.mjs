#!/usr/bin/env node
/**
 * tools/cell-resolution-census.mjs — how many crystals actually fail
 * mesh.cellOf() resolution and grow through the ring_fluids fallback?
 *
 * Born 2026-06-10 from the ring_fluids retire-the-store change: the
 * "last-resort sentinel; should never hit" fallback in
 * _runEngineForCrystal (and its nucleation siblings in 85b) turned out
 * to be LOAD-BEARING — 4 multi-seed tests (schneeberg pharmacolite,
 * roughten_gill sphalerite/brochantite, the canonical-4 stale check)
 * broke when the fallback's source changed from the frozen initial
 * broth to the live ring mean. This probe measures the class: per
 * scenario, which crystals miss cellOf, what minerals they are, and
 * what fraction of engine reads ride the fallback.
 *
 * Usage: node tools/cell-resolution-census.mjs [scenario ...]
 *   (defaults to roughten_gill schneeberg searles_lake mvt)
 */

import { loadSimBundle } from './_harness.mjs';

const { SIM_VERSION, SCENARIOS, VugSimulator, setSeed } =
  await loadSimBundle({ toolName: 'cell_resolution_census' });

const names = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['roughten_gill', 'schneeberg', 'searles_lake', 'mvt'];

console.log(`SIM_VERSION ${SIM_VERSION}\n`);

for (const name of names) {
  if (!SCENARIOS[name]) { console.log(`${name}: unknown scenario, skipped`); continue; }
  setSeed(42);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 160;

  // crystal-step counts: each (crystal, step) pair is one engine read.
  let resolvedReads = 0, fallbackReads = 0;
  const fallbackMinerals = new Map();   // mineral -> crystal-step count
  const fallbackWhy = { noAnchor: 0, nullCellIdx: 0, outOfRange: 0, noFluid: 0 };

  for (let i = 0; i < steps; i++) {
    sim.run_step();
    const mesh = sim.wall_state.meshFor(sim);
    for (const crystal of sim.crystals) {
      if (crystal.dissolved) continue;
      const anchor = sim.wall_state._resolveAnchor(crystal);
      if (!anchor) { fallbackWhy.noAnchor++; fallbackReads++; bump(crystal); continue; }
      if (anchor.ringIdx == null || anchor.cellIdx == null) {
        fallbackWhy.nullCellIdx++; fallbackReads++; bump(crystal); continue;
      }
      const cell = mesh && mesh.cellOf ? mesh.cellOf(crystal, sim.wall_state) : null;
      if (!cell) { fallbackWhy.outOfRange++; fallbackReads++; bump(crystal); continue; }
      if (!cell.fluid) { fallbackWhy.noFluid++; fallbackReads++; bump(crystal); continue; }
      resolvedReads++;
    }
  }
  function bump(crystal) {
    const m = crystal.mineral || '?';
    fallbackMinerals.set(m, (fallbackMinerals.get(m) || 0) + 1);
  }

  const total = resolvedReads + fallbackReads;
  const pct = total ? (100 * fallbackReads / total).toFixed(1) : '0.0';
  console.log(`${name}: ${total} crystal-step engine reads, ${fallbackReads} via fallback (${pct}%)`);
  console.log(`  why: ${JSON.stringify(fallbackWhy)}`);
  if (fallbackMinerals.size) {
    const rows = [...fallbackMinerals.entries()].sort((a, b) => b[1] - a[1]);
    for (const [m, n] of rows.slice(0, 12)) {
      console.log(`  ${m.padEnd(22)} ${n} crystal-steps`);
    }
  }
  console.log('');
}
