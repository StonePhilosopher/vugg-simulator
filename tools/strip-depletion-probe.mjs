#!/usr/bin/env node
/**
 * tools/strip-depletion-probe.mjs — does the RECORDED strip dataset preserve
 * the depletion halo the live sim produces? (boss 2026-06-03, "surface the
 * real halos — follow the science even when it means I'm wrong")
 *
 * depletion-dip-probe.mjs already showed the LIVE per-cell dips (Ag 22% in
 * reactive_wall, F 10% in mvt). This probe asks the next question: how much
 * survives the recorder's angular downsampling? The recorder (85g) samples
 * ONE midpoint cell per 15° bin (24 of 120 native cells) — so a crystal not
 * sitting on a midpoint contributes ZERO recorded dip. We record a dataset
 * headless, then per chip measure the per-bin SPREAD at the last step:
 *   spread = (max_bin - min_bin) / max_bin   across the 24 angular bins.
 * A real surviving halo → spread > 0 on trace ions; flat → recorder lost it.
 *
 * Commits nothing.  Usage: node tools/strip-depletion-probe.mjs [scenario ...]
 */
import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed, StripRecorder } = await loadSimBundle({
  toolName: 'strip-depletion-probe',
  extraExports: ['StripRecorder', 'stripDataIndex', 'stripDequantizeNormalized'],
});

const SCENS = process.argv.slice(2).length ? process.argv.slice(2)
  : ['mvt', 'reactive_wall', 'gem_pegmatite'];
const WATCH = ['Ag', 'Cd', 'F', 'Sn', 'Ca', 'Zn', 'SiO2', 'Pb', 'Fe', 'Mn'];

function recordDataset(SCEN) {
  setSeed(42);
  const { conditions, events } = SCENARIOS[SCEN]();
  const sim = new VugSimulator(conditions, events);
  const STEPS = SCENARIOS[SCEN]().defaultSteps ?? 120;
  sim._stripRecorder = new StripRecorder(sim, { duration_steps: STEPS });
  for (let s = 0; s < STEPS; s++) sim.run_step();
  return sim._stripRecorder.finalize();
}

function chipSpreadAtLastStep(ds, chipId) {
  const ax = ds.manifest.axes;
  const chips = ds.manifest.chips;
  const k = chips.findIndex((c) => c.id === chipId);
  if (k < 0) return null;
  const step = ax.steps - 1;
  // per-bin mean over heights (skip nulls), then spread across bins
  const binVals = [];
  for (let a = 0; a < ax.angular_indices; a++) {
    let sum = 0, n = 0;
    for (let h = 0; h < ax.height_positions; h++) {
      const li = stripDataIndex(step, a, h, k, ax, chips.length, 0);
      if (li < 0) continue;
      const v = stripDequantizeNormalized(ds.chip_data[li]);
      if (v === null) continue;
      sum += v; n++;
    }
    if (n) binVals.push(sum / n);
  }
  if (binVals.length < 2) return null;
  const max = Math.max(...binVals), min = Math.min(...binVals);
  const mean = binVals.reduce((s, x) => s + x, 0) / binVals.length;
  return { spread: max > 1e-9 ? (max - min) / max : 0, dipBelowMean: mean > 1e-9 ? (mean - min) / mean : 0, bins: binVals.length };
}

console.log(`\n### STRIP-DEPLETION PROBE — does the recorded dataset keep the halo?`);
for (const SCEN of SCENS) {
  if (!SCENARIOS[SCEN]) { console.log(`\n${SCEN}: (no such scenario)`); continue; }
  const ds = recordDataset(SCEN);
  console.log(`\n── ${SCEN}  (recorded ${ds.manifest.axes.steps} steps × ${ds.manifest.axes.angular_indices} bins × ${ds.manifest.axes.height_positions} heights) ──`);
  console.log(`   chip       per-bin spread   dip-below-bin-mean`);
  const ids = new Set(ds.manifest.chips.map((c) => c.id));
  for (const id of WATCH) {
    if (!ids.has(id)) continue;
    const r = chipSpreadAtLastStep(ds, id);
    if (!r) continue;
    const flag = r.spread > 0.02 ? '  ← halo survives' : (r.spread > 0.002 ? '  · faint' : '  (flat)');
    console.log(`   ${id.padEnd(10)} ${(r.spread * 100).toFixed(2).padStart(8)}%       ${(r.dipBelowMean * 100).toFixed(2).padStart(8)}%${flag}`);
  }
}
console.log(`\nlegend: spread≈0 → the midpoint-cell downsample threw the halo away before the strip/sonifier ever saw it.`);
