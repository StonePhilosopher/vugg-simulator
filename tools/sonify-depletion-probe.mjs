#!/usr/bin/env node
/**
 * tools/sonify-depletion-probe.mjs — does the DEPLETION VOICE sing only where
 * the broth is actually drawn down? (boss 2026-06-04, "build the depletion
 * voice" — the audible twin of the floor shadow.)
 *
 * The shadow channel (strip-floor-probe) showed floor_data recovers the per-cell
 * halo the midpoint level loses. The sonifier turns that same floor_data into a
 * soft undertone beneath each chip's drone, swelling with the depletion depth
 * (level − floor) and silent where the broth is uniform. This probe records a
 * v3 dataset, builds a sonify plan per ion chip, and reports — per chip — the
 * shadow's peak gain + how much of the run it sounds. The mechanism is RIGHT
 * iff limiting ions (Ag, Cd, F, Sn) grow an audible shadow while abundant ones
 * (Ca, Zn, SiO2) stay silent — the ear agreeing with the floor channel the eye
 * reads. Commits nothing; a headless probe verifies the CODE, not the EAR.
 *
 * Usage: node tools/sonify-depletion-probe.mjs [scenario ...]
 */
import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed, StripRecorder } = await loadSimBundle({
  toolName: 'sonify-depletion-probe',
  extraExports: ['StripRecorder', 'buildStripSonifyPlan', 'stripSonifyGetDepletion',
    'stripDataIndex', 'stripDequantizeNormalized'],
});

const SCENS = process.argv.slice(2).length ? process.argv.slice(2)
  : ['reactive_wall', 'mvt', 'gem_pegmatite'];
const WATCH = ['Ag', 'Cd', 'F', 'Sn', 'Pb', 'Ca', 'Zn', 'SiO2'];

function record(SCEN) {
  setSeed(42);
  const { conditions, events } = SCENARIOS[SCEN]();
  const sim = new VugSimulator(conditions, events);
  const STEPS = SCENARIOS[SCEN]().defaultSteps ?? 120;
  sim._stripRecorder = new StripRecorder(sim, { duration_steps: STEPS });
  for (let s = 0; s < STEPS; s++) sim.run_step();
  return sim._stripRecorder.finalize();
}

// The plan's shadow summary (what the EAR gets): present?, peak gain, sounded %.
function shadowOf(ds, chipId) {
  const plan = buildStripSonifyPlan(ds, chipId, { stepDurationMs: 100 });
  if (!plan) return null;
  if (!plan.shadowGains || !plan.shadowGains.length) return { present: false, peak: 0, openFrac: 0 };
  const gains = plan.shadowGains.map((g) => g.gain);
  return { present: true, peak: Math.max(...gains), openFrac: gains.filter((g) => g > 0.05).length / gains.length };
}

// The RAW numbers behind the gate — at the step of deepest drawdown, the
// chip's level mean, floor scalar (mean-of-ring-min, exactly what the voice
// uses), the ABSOLUTE normalized depth (level−floor, the gate input + the
// visual band height), and the RELATIVE dip (depth as a fraction of the level —
// the "how hollow is the pocket" the eye on a low-baseline ion can't see).
function rawOf(ds, chipId) {
  if (!ds.floor_data) return null;
  const ax = ds.manifest.axes, chips = ds.manifest.chips;
  const k = chips.findIndex((c) => c.id === chipId);
  if (k < 0) return null;
  let best = { depth: -1, level: 0, floor: 0 };
  for (let step = 0; step < ax.steps; step++) {
    let lSum = 0, lN = 0, fMin = Infinity;   // level = bulk MEAN; floor = deepest pocket (global MIN)
    for (let h = 0; h < ax.height_positions; h++) {
      for (let a = 0; a < ax.angular_indices; a++) {
        const li = stripDataIndex(step, a, h, k, ax, chips.length, 0);
        if (li < 0) continue;
        const lv = stripDequantizeNormalized(ds.chip_data[li]);
        const fv = stripDequantizeNormalized(ds.floor_data[li]);
        if (lv !== null) { lSum += lv; lN++; }
        if (fv !== null && fv < fMin) fMin = fv;
      }
    }
    if (!lN || fMin === Infinity) continue;
    const level = lSum / lN, floor = fMin, depth = Math.max(0, level - floor);
    if (depth > best.depth) best = { depth, level, floor };
  }
  if (best.depth < 0) return null;
  return { ...best, relDip: best.level > 1e-9 ? best.depth / best.level : 0 };
}

console.log(`\n### SONIFY-DEPLETION PROBE — does the shadow voice sing only where the broth is drawn down?`);
console.log(`(depletion voice is ${stripSonifyGetDepletion() ? 'ON' : 'OFF'} by default)`);
for (const SCEN of SCENS) {
  if (!SCENARIOS[SCEN]) { console.log(`\n${SCEN}: (no such scenario)`); continue; }
  const ds = record(SCEN);
  console.log(`\n── ${SCEN}  (format_version ${ds.manifest.format_version}, floor_data ${ds.floor_data ? 'present' : 'ABSENT'}) ──`);
  console.log(`   chip        level   floor   abs-depth   rel-dip    shadow peak   sounded`);
  const ids = new Set(ds.manifest.chips.map((c) => c.id));
  for (const id of WATCH) {
    if (!ids.has(id)) continue;
    const r = shadowOf(ds, id), raw = rawOf(ds, id);
    if (!r || !raw) continue;
    const tag = r.present ? '  ← sings' : '';
    console.log(`   ${id.padEnd(8)} ${raw.level.toFixed(3).padStart(7)} ${raw.floor.toFixed(3).padStart(7)} ${raw.depth.toFixed(3).padStart(9)}  ${(raw.relDip * 100).toFixed(1).padStart(6)}%   ${r.peak.toFixed(3).padStart(8)}    ${(r.openFrac * 100).toFixed(0).padStart(4)}%${tag}`);
  }
}
console.log(`\nlegend: abs-depth = level−floor (0..1, the gate input + the visual band height);`);
console.log(`        rel-dip = depth/level (how hollow the pocket is — large for limiting ions on a low baseline).`);
