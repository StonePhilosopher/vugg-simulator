#!/usr/bin/env node
/**
 * tools/ring-fluid-view-probe.mjs — the review §1.4 contract, made
 * repeatable. After the 2026-06-10 retire-the-store fix there are TWO
 * invariants, checked on reactivated_fluorite_vein (heavy event
 * chemistry — F/Ba/Zn pulses, seal/breach cycles) at seed 42:
 *
 *   1. The LIVE non-equator ring_fluids slots stay FROZEN at the
 *      initial broth (modulo the vadose/open-atmosphere partials —
 *      neither fires on the vein). This is the SIM-neutrality
 *      contract: the mesh-absent fallback readers and the tuned
 *      calibration see exactly what they always saw. (The first cut
 *      of this fix synced the live store every step — byte-identical
 *      at seed 42 but 1.32 ms/step, which timed out the 32-seed
 *      integration tests. The store stays frozen; the projection
 *      moved to snapshot capture.)
 *
 *   2. The REPLAY SNAPSHOT (snap.ring_fluids — the helicoid replay
 *      chips' chemistry source, the store's one live consumer) carries
 *      the PROJECTION of canonical cell chemistry (_ringFluidMeans):
 *      non-equator entries must DIVERGE from the frozen store wherever
 *      event chemistry actually moved the cells. Before the fix the
 *      snapshot cloned the frozen store and replay chips showed
 *      day-zero broth on 15 of 16 rings (100% Zn divergence, 145.7
 *      ppm of event chemistry missing).
 *
 *   3. ring_fluids[equator] === conditions.fluid (the load-bearing
 *      alias) is intact.
 *
 * Usage: node tools/ring-fluid-view-probe.mjs [scenario] [seed]
 *   (defaults: reactivated_fluorite_vein 42)
 */

import { loadSimBundle } from './_harness.mjs';

const { SIM_VERSION, SCENARIOS, VugSimulator, setSeed } =
  await loadSimBundle({ toolName: 'ring_fluid_view_probe' });

const scenarioName = process.argv[2] || 'reactivated_fluorite_vein';
const seed = Number(process.argv[3] || 42);

if (!SCENARIOS[scenarioName]) {
  console.error(`unknown scenario '${scenarioName}'`);
  process.exit(2);
}

setSeed(seed);
const { conditions, events, defaultSteps } = SCENARIOS[scenarioName]();
const initialBroth = {};
for (const k of Object.keys(conditions.fluid)) {
  if (typeof conditions.fluid[k] === 'number') initialBroth[k] = conditions.fluid[k];
}
const sim = new VugSimulator(conditions, events);
const steps = defaultSteps ?? 160;
for (let i = 0; i < steps; i++) sim.run_step();

const nRings = sim.wall_state.ring_count;
const equator = Math.floor(nRings / 2);

console.log(`SIM_VERSION ${SIM_VERSION} | ${scenarioName} seed ${seed} × ${steps} steps`);
console.log(`rings ${nRings}, equator slot ${equator}\n`);

// Invariant 3: the equator alias.
const aliasOk = sim.ring_fluids[equator] === sim.conditions.fluid;
console.log(`equator alias (ring_fluids[${equator}] === conditions.fluid): ${aliasOk ? 'INTACT' : '⚠ BROKEN'}`);

// Invariant 1: live store frozen at the initial broth (sample fields
// the vein's events move hard — F, Ba, Zn, Ca).
const probeFields = ['F', 'Ba', 'Zn', 'Ca'];
let storeFrozen = true;
for (let r = 0; r < nRings; r++) {
  if (r === equator) continue;
  const f = sim.ring_fluids[r];
  for (const k of probeFields) {
    if (typeof initialBroth[k] !== 'number' || !f) continue;
    if (Math.abs(f[k] - initialBroth[k]) > 1e-9) { storeFrozen = false; break; }
  }
}
console.log(`live non-equator store vs initial broth (F/Ba/Zn/Ca): ${storeFrozen ? 'FROZEN — calibration sees what it was tuned against' : '⚠ MOVED — the sim path is reading/writing the retired store'}`);

// Invariant 2: the last replay snapshot's projection diverged from the
// frozen store wherever events moved the cells.
const snaps = sim.wall_state_history || [];
const last = snaps.length ? snaps[snaps.length - 1] : null;
let projectionLive = false;
let worstField = '—', worstDelta = 0, worstRing = -1;
if (last && last.ring_fluids) {
  for (let r = 0; r < nRings; r++) {
    if (r === equator) continue;
    const p = last.ring_fluids[r];
    if (!p) continue;
    for (const k of probeFields) {
      if (typeof initialBroth[k] !== 'number') continue;
      const d = Math.abs(p[k] - initialBroth[k]);
      if (d > worstDelta) { worstDelta = d; worstField = k; worstRing = r; }
      if (d > 1) projectionLive = true;
    }
  }
}
console.log(`replay snapshot projection (snap ${last ? last.step : '—'}): ${projectionLive
  ? `LIVE — e.g. ${worstField} moved ${worstDelta.toFixed(1)} ppm off the broth at ring ${worstRing}`
  : '⚠ STILL FROZEN — replay chips are lying again'}`);

const ok = aliasOk && storeFrozen && projectionLive;
console.log(`\n${ok ? 'ALL THREE INVARIANTS HOLD' : '⚠ CONTRACT VIOLATION — see above'}`);
process.exit(ok ? 0 : 1);
