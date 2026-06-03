#!/usr/bin/env node
/**
 * tools/sonify-drone-probe.mjs — verify the boss's ear (2026-06-03):
 *   "a lot of the modes don't play most of the even droning lines."
 *
 * The chip voices (js/85i) articulate on a RHYTHM grid: a gate fires only
 * when the quantized pitch CHANGES, or every STRIP_RHYTHM.maxRest slots.
 * A STEADY ("even") line never changes pitch → it only gets the sparse
 * heartbeat → it rests at ~0 most of the time, so the drone goes near-silent.
 * Continuous mode, by contrast, sustains one gate the whole run.
 *
 * This probe builds synthetic chips (flat / gentle-drift / wiggly) at a dim
 * and a bright color, builds the plan in every scale mode, and reports per
 * chip×mode: gate COUNT and SOUNDED FRACTION (Σ gate.durSec / durationSec).
 * If flat lines have a low sounded fraction in the scale modes but ~1.0 in
 * continuous, the boss's ear is confirmed and the fix is to let held pitches
 * SUSTAIN (drone) instead of resting to silence. Commits nothing.
 */
import { loadSimBundle } from './_harness.mjs';

const { buildStripSonifyPlan, STRIP_SONIFY_SCALES, stripAllocateData, stripDataIndex } =
  await loadSimBundle({
    toolName: 'sonify-drone-probe',
    extraExports: ['buildStripSonifyPlan', 'STRIP_SONIFY_SCALES', 'stripAllocateData', 'stripDataIndex'],
  });

const STEPS = 240;
const STEP_MS = 140;

// contour generators (normalized 0..1 per step)
const CONTOURS = {
  'flat (even drone)':  (s) => 0.5,
  'gentle drift':       (s) => 0.40 + 0.20 * (s / (STEPS - 1)),
  'wiggly (active)':    (s) => 0.5 + 0.35 * Math.sin((s / STEPS) * Math.PI * 8),
};

// two colors: dim (low luminance → slow "pad/drone" subdiv=6) and bright
// (high luminance → busy subdiv=2). Drones live in the dim band.
const COLORS = { dim: 0x223344, bright: 0xffee88 };

function makeDataset(contourFn, color) {
  const axes = { steps: STEPS, angular_indices: 2, height_positions: 2, depth_positions: 1 };
  const chips = [{ id: 'c', label: 'C', system: 'special', range: [0, 1], units: '', color }];
  const data = stripAllocateData(axes, 1);
  for (let s = 0; s < STEPS; s++) {
    const v = Math.max(0, Math.min(1, contourFn(s)));
    const byte = Math.round(v * 254);
    for (let a = 0; a < 2; a++) for (let h = 0; h < 2; h++) {
      data[stripDataIndex(s, a, h, 0, axes, 1, 0)] = byte;
    }
  }
  return { manifest: { format_version: 2, sim_version: 0, scenario_id: 'probe', seed: 42,
    recorded_at: 0, duration_steps: STEPS, axes, chips }, chip_data: data, nucleation_events: [] };
}

function measure(contourFn, color, scaleId) {
  const ds = makeDataset(contourFn, color);
  const plan = buildStripSonifyPlan(ds, 'c', { stepDurationMs: STEP_MS, scaleId });
  if (!plan) return null;
  const sounded = plan.gates.reduce((s, g) => s + g.durSec, 0);
  return { gates: plan.gates.length, soundedFrac: sounded / plan.durationSec, subdiv: plan.subdiv };
}

console.log(`\n### SONIFY DRONE PROBE — ${STEPS} steps @ ${STEP_MS}ms, gate sounded-fraction per mode`);
console.log(`(sounded fraction = how much of the run the voice is actually audible)\n`);

for (const band of ['dim', 'bright']) {
  console.log(`── ${band} color 0x${COLORS[band].toString(16)} (subdiv ${measure(CONTOURS['flat (even drone)'], COLORS[band], 'major_pentatonic').subdiv}) ──`);
  const header = ['contour'.padEnd(20), ...STRIP_SONIFY_SCALES.map(s => s.id.slice(0, 10).padStart(11))].join('');
  console.log(header);
  for (const [name, fn] of Object.entries(CONTOURS)) {
    const cells = STRIP_SONIFY_SCALES.map(sc => {
      const m = measure(fn, COLORS[band], sc.id);
      return `${(m.soundedFrac * 100).toFixed(0)}%/${m.gates}`.padStart(11);
    });
    console.log(name.padEnd(20) + cells.join(''));
  }
  console.log('');
}
console.log(`legend: "SOUNDED%/GATES"  — continuous should be ~100%; watch the flat row in scale modes.`);
