// tools/strip_recorder_post_fix_probe.mjs — verify the v157 chip-read
// rewire actually eliminates the equator-spike pyramid artifact.
//
// Before the fix: every chemistry chip's read function sampled
// ring_fluids[i], so values at height 8 (equator) were event-bumped
// and values at heights 0-7 + 9-15 stayed at initial broth. The strip
// view rendered as identical inverted-V pyramids in every time strip.
//
// After the fix: chip reads sample mesh.cells[i*N+c].fluid, which DOES
// carry event chemistry uniformly across all cells. Strip view chemistry
// chips should render as flat horizontal lines (uniform across heights),
// while the wall_distance chip keeps its legit geometric triangle.
//
// This probe records 50 steps of gem_pegmatite and dumps the per-height
// chip values for pH + CO3 + Ca at step 30 (after a few events have
// fired). If the values are uniform across heights, the fix works.
//
// Usage: node tools/strip_recorder_post_fix_probe.mjs

import { loadSimBundle } from './_harness.mjs';

const sim_exports = await loadSimBundle({
  toolName: 'strip_recorder_post_fix_probe',
  extraExports: ['StripRecorder', 'stripDequantizeNormalized', 'stripDataIndex'],
});

const {
  SCENARIOS, VugSimulator, setSeed,
  StripRecorder, stripDataIndex,
} = sim_exports;

setSeed(42);
const scn = SCENARIOS['gem_pegmatite'];
const { conditions, events, defaultSteps } = scn();
const sim = new VugSimulator(conditions, events);

const recorder = new StripRecorder(sim, {
  angular_indices: 24,
  duration_steps: defaultSteps ?? 230,
});
// Manually attach the recorder to test (normally _attachStripRecorderToSim does this)
sim._stripRecorder = recorder;

const total = defaultSteps ?? 230;
for (let i = 0; i < total; i++) sim.run_step();
const dataset = recorder.finalize();

const { axes, chips } = dataset.manifest;
const data = dataset.chip_data;
const chipCount = chips.length;

console.log(`gem_pegmatite recording: ${axes.steps} steps × ${axes.angular_indices} angles × ${axes.height_positions} heights × ${chipCount} chips`);

function chipIndex(id) {
  return chips.findIndex(c => c.id === id);
}

// Sample chip values at a representative step + angle, across all heights
function dumpHeightProfile(stepIdx, angleIdx, chipId, label) {
  const k = chipIndex(chipId);
  if (k < 0) {
    console.log(`  chip ${chipId} not found`);
    return;
  }
  const meta = chips[k];
  const vals = [];
  for (let h = 0; h < axes.height_positions; h++) {
    const idx = stripDataIndex(stepIdx, angleIdx, h, k, axes, chipCount);
    const byte = data[idx];
    vals.push(byte);
  }
  const min = Math.min(...vals.filter(v => v !== 255));
  const max = Math.max(...vals.filter(v => v !== 255));
  const spread = max - min;
  const profile = vals.map(v => v === 255 ? '·' : String(v).padStart(3)).join(' ');
  console.log(`  ${label.padEnd(18)} [${chipId.padEnd(6)}] heights 0..${axes.height_positions-1}: ${profile}   (min=${min} max=${max} spread=${spread})`);
}

for (const step of [10, 30, 50, 100, 150, 200]) {
  if (step >= axes.steps) continue;
  console.log(`\n=== step ${step}, angle 0 ===`);
  dumpHeightProfile(step, 0, 'pH', 'pH');
  dumpHeightProfile(step, 0, 'T', 'temperature');
  dumpHeightProfile(step, 0, 'CO3', 'CO3 ion');
  dumpHeightProfile(step, 0, 'Ca', 'Ca ion');
  dumpHeightProfile(step, 0, 'Na', 'Na ion');
  dumpHeightProfile(step, 0, 'F', 'F ion');
  dumpHeightProfile(step, 0, 'salinity', 'salinity');
  dumpHeightProfile(step, 0, 'SI_calcite', 'SI calcite');
  dumpHeightProfile(step, 0, 'wall', 'wall distance');
}

console.log(`\nexpected outcome:`);
console.log(`  - chemistry chips (pH, CO3, Ca, Na, F, salinity, SI_calcite): UNIFORM across heights (spread ≈ 0)`);
console.log(`  - temperature: uniform across heights (per-ring T diffuses globally)`);
console.log(`  - wall distance: PEAKED at middle height (real geometric signal)`);
