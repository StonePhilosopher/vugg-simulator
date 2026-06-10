#!/usr/bin/env node
/**
 * tools/redox-anchor-probe.mjs — ehFromO2 ↔ o2FromEh round-trip audit
 * + fleet O2/Eh ceiling sweep.
 *
 * Two parts:
 *
 *   1. FUNCTION AUDIT — sweep Eh ∈ [-650, +1000] and O2 ∈ [1e-5, 30]
 *      through the anchor pair and report the worst round-trip error
 *      per segment. Before the 2026-06-10 fix the top saturation
 *      branch diverged 10× (ehFromO2 rose at 100 mV/decade above
 *      O2=5 while o2FromEh came back at 1000 mV/decade), so an
 *      Eh-canonical movement writing +800 mV snapped to +530 the
 *      step its window closed. After the fix both saturate at
 *      1000 mV/decade and the pair is exact over the full domain.
 *
 *   2. FLEET CEILING — run every scenario at seed 42 for its default
 *      steps and track the maximum fluid.O2 / fluid.Eh ever observed
 *      across ALL containers (ring_fluids + wall cells) at every
 *      step. This is the measured proof of whether a change to the
 *      saturation branches is SIM-neutral: if no scenario ever
 *      reaches O2 > 5 (Eh ≥ +500), the changed branch is unreachable
 *      by current content and baselines must not move.
 *
 * Born from the Movements Phase 1 gate (HANDOFF-REVIEW-REBAKE-MUSIC-
 * 2026-06-10.md Part II, next-step #1): movements drive Eh as the
 * master redox axis, and the o2FromEh→ehFromO2 round trip is the
 * channel a driven Eh must survive. Re-run whenever the anchor maps
 * in js/20c-chemistry-redox.ts change.
 *
 * Usage: node tools/redox-anchor-probe.mjs [--fleet]
 *   (function audit always runs; --fleet adds the scenario sweep)
 */

import { loadSimBundle } from './_harness.mjs';

const wantFleet = process.argv.includes('--fleet');

const { SIM_VERSION, SCENARIOS, VugSimulator, setSeed, ehFromO2, o2FromEh } =
  await loadSimBundle({
    toolName: 'redox_anchor_probe',
    extraExports: ['ehFromO2', 'o2FromEh'],
  });

console.log(`SIM_VERSION ${SIM_VERSION}\n`);

// ---------------------------------------------------------------
// Part 1: function-level round-trip audit
// ---------------------------------------------------------------
// Segments named by the o2FromEh branch boundaries (Eh side). The
// sweep starts at -620 mV: ehFromO2's 1e-6 ppm log floor means lower
// Eh has no O2 image (round trip floors at -620 — documented, not a
// bug; -620 at pH 7 is beyond water stability). Reported separately.
const SEGMENTS = [
  { name: 'below-anchor  (-620..-150)', lo: -620, hi: -150 },
  { name: 'low-mid       (-150..100)', lo: -150, hi: 100 },
  { name: 'high-mid      (100..500) ', lo: 100, hi: 500 },
  { name: 'above-anchor  (Eh > 500) ', lo: 500, hi: 1000 },
];

console.log('— Eh → O2 → Eh round trip (worst |ΔEh| per segment) —');
let worstOverall = 0;
for (const seg of SEGMENTS) {
  let worst = 0, worstAt = null;
  for (let Eh = seg.lo; Eh <= seg.hi; Eh += 1) {
    const d = Math.abs(ehFromO2(o2FromEh(Eh)) - Eh);
    if (d > worst) { worst = d; worstAt = Eh; }
  }
  worstOverall = Math.max(worstOverall, worst);
  console.log(`  ${seg.name}  worst ${worst.toFixed(3)} mV` +
    (worst > 0.001 ? `  (at Eh=${worstAt})` : ''));
}

console.log('\n— O2 → Eh → O2 round trip (worst relative error) —');
let worstRel = 0, worstRelAt = null;
for (let logO2 = -5; logO2 <= 1.5; logO2 += 0.01) {
  const O2 = Math.pow(10, logO2);
  const back = o2FromEh(ehFromO2(O2));
  const rel = Math.abs(back - O2) / O2;
  if (rel > worstRel) { worstRel = rel; worstRelAt = O2; }
}
console.log(`  O2 ∈ [1e-5, ~31.6]   worst ${(worstRel * 100).toFixed(4)}%` +
  (worstRel > 1e-6 ? `  (at O2=${worstRelAt.toFixed(3)} ppm)` : ''));

// The movement case the Movements handoff names explicitly.
const driven = 800;
const survived = ehFromO2(o2FromEh(driven));
console.log(`\n— the Movements case: Eh-canonical write of +${driven} mV —`);
console.log(`  survives the window-close round trip as ${survived.toFixed(1)} mV` +
  `  (${Math.abs(survived - driven) < 0.5 ? 'EXACT — signal survives' : 'SNAPPED — signal lost'})`);

// The representability floor, reported as information (not a failure):
// Eh below -620 mV rounds up to -620 through the O2 image.
console.log(`\n— representability floor —`);
console.log(`  Eh -700 mV round-trips to ${ehFromO2(o2FromEh(-700)).toFixed(1)} mV` +
  ` (1e-6 ppm log floor in ehFromO2; -620 is beyond water stability at pH 7)`);

// Physicality spot-check: synthetic O2 should stay inside the real
// dissolved-O2 ceiling (~14 ppm air-saturated, ~20 supersaturated)
// across the whole plausible Eh domain, so no ratio-form engine site
// ever sees a wild synthetic O2.
console.log('\n— synthetic O2 at high Eh (should stay ≤ ~20 ppm) —');
for (const Eh of [500, 600, 700, 800, 900, 1000]) {
  console.log(`  Eh +${Eh} mV → O2 ${o2FromEh(Eh).toFixed(2)} ppm`);
}

if (!wantFleet) {
  console.log('\n(fleet sweep skipped — pass --fleet to run it)');
  process.exit(worstOverall > 0.5 ? 1 : 0);
}

// ---------------------------------------------------------------
// Part 2: fleet O2/Eh ceiling sweep
// ---------------------------------------------------------------
console.log('\n— fleet ceiling sweep (seed 42, default steps, all containers, every step) —');
console.log('scenario                     max-O2      max-Eh     steps');
console.log('-'.repeat(64));

let fleetMaxO2 = 0, fleetMaxEh = -Infinity, fleetMaxO2At = null;
for (const name of Object.keys(SCENARIOS)) {
  setSeed(42);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 160;
  let maxO2 = 0, maxEh = -Infinity;
  const scan = (f) => {
    if (!f) return;
    if (typeof f.O2 === 'number' && f.O2 > maxO2) maxO2 = f.O2;
    if (typeof f.Eh === 'number' && f.Eh > maxEh) maxEh = f.Eh;
  };
  for (let i = 0; i < steps; i++) {
    sim.run_step();
    const rf = sim.ring_fluids;
    if (rf) for (const f of rf) scan(f);
    const mesh = sim.wall_state && sim.wall_state.meshFor ? sim.wall_state.meshFor(sim) : null;
    if (mesh && mesh.cells) for (const c of mesh.cells) scan(c && c.fluid);
  }
  if (maxO2 > fleetMaxO2) { fleetMaxO2 = maxO2; fleetMaxO2At = name; }
  fleetMaxEh = Math.max(fleetMaxEh, maxEh);
  const flag = maxO2 > 5 ? '  ⚠ ABOVE ANCHOR' : '';
  console.log(`${name.padEnd(28)} ${maxO2.toFixed(3).padStart(7)}  ${maxEh.toFixed(1).padStart(8)}  ${String(steps).padStart(5)}${flag}`);
}

console.log('-'.repeat(64));
console.log(`fleet max O2 = ${fleetMaxO2.toFixed(3)} ppm (${fleetMaxO2At}); fleet max Eh = ${fleetMaxEh.toFixed(1)} mV`);
console.log(fleetMaxO2 <= 5
  ? '→ no scenario reaches the O2 > 5 saturation branch: a slope change there is SIM-NEUTRAL.'
  : '→ ⚠ at least one scenario CROSSES the anchor: a slope change there moves baselines (SIM bump).');
