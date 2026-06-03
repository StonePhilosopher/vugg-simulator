#!/usr/bin/env node
/**
 * tools/strip-floor-probe.mjs — does the format_version-3 depletion FLOOR
 * channel capture the halo the midpoint LEVEL misses? (boss 2026-06-03,
 * "surface the real halos — follow the science").
 *
 * strip-depletion-probe showed the midpoint-sampled LEVEL (chip_data) loses
 * ~80-90% of the live halo. The floor channel (floor_data) records the per-bin
 * MINIMUM for ION chips. This probe records a v3 dataset and, per ion chip,
 * compares the LEVEL's per-bin spread to the FLOOR's dip below the level —
 * the floor should recover the full cell-depth halo. Commits nothing.
 *
 * Usage: node tools/strip-floor-probe.mjs [scenario ...]
 */
import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed, StripRecorder } = await loadSimBundle({
  toolName: 'strip-floor-probe',
  extraExports: ['StripRecorder', 'stripDataIndex', 'stripDequantizeNormalized'],
});

const SCENS = process.argv.slice(2).length ? process.argv.slice(2)
  : ['mvt', 'reactive_wall', 'gem_pegmatite'];
const WATCH = ['Ag', 'Cd', 'F', 'Sn', 'Ca', 'Zn', 'SiO2', 'Pb', 'Fe', 'Mn'];

function record(SCEN) {
  setSeed(42);
  const { conditions, events } = SCENARIOS[SCEN]();
  const sim = new VugSimulator(conditions, events);
  const STEPS = SCENARIOS[SCEN]().defaultSteps ?? 120;
  sim._stripRecorder = new StripRecorder(sim, { duration_steps: STEPS });
  for (let s = 0; s < STEPS; s++) sim.run_step();
  return sim._stripRecorder.finalize();
}

// For chip k at the last step: level = mean over bins of chip_data; levelMin =
// min over bins of chip_data (what the OLD strip could show); floorMin = min
// over bins of floor_data (the NEW depletion floor). Returns dips vs level mean.
function probe(ds, chipId) {
  const ax = ds.manifest.axes, chips = ds.manifest.chips;
  const k = chips.findIndex((c) => c.id === chipId);
  if (k < 0 || !ds.floor_data) return null;
  const step = ax.steps - 1;
  const levelBins = [], floorBins = [];
  for (let a = 0; a < ax.angular_indices; a++) {
    let lSum = 0, lN = 0, fMin = Infinity;
    for (let h = 0; h < ax.height_positions; h++) {
      const li = stripDataIndex(step, a, h, k, ax, chips.length, 0);
      if (li < 0) continue;
      const lv = stripDequantizeNormalized(ds.chip_data[li]);
      const fv = stripDequantizeNormalized(ds.floor_data[li]);
      if (lv !== null) { lSum += lv; lN++; }
      if (fv !== null && fv < fMin) fMin = fv;
    }
    if (lN) levelBins.push(lSum / lN);
    if (fMin !== Infinity) floorBins.push(fMin);
  }
  if (!levelBins.length || !floorBins.length) return null;
  const levelMean = levelBins.reduce((s, x) => s + x, 0) / levelBins.length;
  const levelMin = Math.min(...levelBins);
  const floorMin = Math.min(...floorBins);
  return {
    levelSpread: levelMean > 1e-9 ? (levelMean - levelMin) / levelMean : 0,   // OLD strip could show this
    floorDip:    levelMean > 1e-9 ? (levelMean - floorMin) / levelMean : 0,   // NEW floor channel shows this
  };
}

console.log(`\n### STRIP-FLOOR PROBE — does floor_data recover the halo the midpoint level loses?`);
for (const SCEN of SCENS) {
  if (!SCENARIOS[SCEN]) { console.log(`\n${SCEN}: (no such scenario)`); continue; }
  const ds = record(SCEN);
  console.log(`\n── ${SCEN}  (format_version ${ds.manifest.format_version}, floor_data ${ds.floor_data ? 'present' : 'ABSENT'}) ──`);
  console.log(`   chip       LEVEL spread (old)    FLOOR dip (new)`);
  const ids = new Set(ds.manifest.chips.map((c) => c.id));
  for (const id of WATCH) {
    if (!ids.has(id)) continue;
    const r = probe(ds, id);
    if (!r) continue;
    const gain = r.floorDip > r.levelSpread * 1.5 && r.floorDip > 0.02 ? '  ← halo recovered' : '';
    console.log(`   ${id.padEnd(10)} ${(r.levelSpread * 100).toFixed(2).padStart(9)}%        ${(r.floorDip * 100).toFixed(2).padStart(8)}%${gain}`);
  }
}
console.log(`\nlegend: FLOOR dip ≫ LEVEL spread → the floor channel surfaces the depletion the level couldn't.`);
