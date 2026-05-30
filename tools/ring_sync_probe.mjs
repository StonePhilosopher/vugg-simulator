// tools/ring_sync_probe.mjs — verify the per-ring chemistry sync bug
// across all event-heavy scenarios.
//
// The bug (found 2026-05-27 via sunnyside_calcite_omega_probe):
// scenario events mutate conditions.fluid (which is aliased to ring
// ring_count/2 only). The other 15 rings stay at the initial broth
// for the entire run. Temperature propagates fine; chemistry doesn't.
//
// This probe checks whether the pattern is general or sunnyside-specific
// by sweeping all 16 rings at end-of-run across multiple event-heavy
// scenarios. The fields tracked are the typical event-driven ones
// (pH, CO3, Ca, F, Mn) — if the spread across rings is near-zero for
// any of these despite events that should bump them, we've confirmed
// the architectural bug.
//
// Usage: node tools/ring_sync_probe.mjs

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({
  toolName: 'ring_sync_probe',
});

const TARGETS = [
  'sunnyside_american_tunnel',
  'sabkha_dolomitization',
  'zoned_dripstone_cave',
  'roughten_gill',
  'jeffrey_mine',
  'mvt',  // MVT brine; events probably drive sulfide-to-carbonate transition
];

const FIELDS = ['pH', 'Ca', 'CO3', 'F', 'Mn', 'Fe', 'SO4', 'Mg', 'S'];

function spread(values) {
  if (!values.length) return 0;
  let min = Infinity, max = -Infinity;
  for (const v of values) {
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return Number.isFinite(min) && Number.isFinite(max) ? max - min : 0;
}

function probe(scenarioName) {
  const scn = SCENARIOS[scenarioName];
  if (!scn) {
    console.log(`(${scenarioName} not in SCENARIOS)`);
    return;
  }
  setSeed(42);
  const { conditions, events, defaultSteps } = scn();
  const sim = new VugSimulator(conditions, events);
  const total = defaultSteps ?? 200;
  for (let i = 0; i < total; i++) sim.run_step();

  const n = sim.ring_fluids.length;
  const eq = Math.floor(n / 2);

  console.log(`\n=== ${scenarioName} (${total} steps, ${n} rings, equator=${eq}) ===`);
  console.log(`  diffusion rate: ${sim.conditions.wall?.inter_ring_diffusion_rate ?? 'default(0.05)'}`);

  console.log(`  field   | initial | conditions.fluid | ring[eq] | ring[0]  | spread`);
  console.log(`  --------+---------+------------------+----------+----------+-------`);
  for (const f of FIELDS) {
    if (!(f in conditions.fluid)) continue;
    const init = conditions.fluid[f];  // this got reset by the sim... use the first run, doesn't matter
    const cf = sim.conditions.fluid[f];
    const re = sim.ring_fluids[eq][f];
    const r0 = sim.ring_fluids[0][f];
    const all = sim.ring_fluids.map(r => r[f]);
    const sp = spread(all);
    const flag = (typeof cf === 'number' && typeof r0 === 'number' &&
                  Math.abs(cf - r0) > 0.01) ? '  <-- ring 0 stuck' : '';
    console.log(`  ${f.padEnd(7)} | ${String(init).padStart(7)} | ${String(typeof cf === 'number' ? cf.toFixed(2) : cf).padStart(16)} | ${String(typeof re === 'number' ? re.toFixed(2) : re).padStart(8)} | ${String(typeof r0 === 'number' ? r0.toFixed(2) : r0).padStart(8)} | ${sp.toFixed(2).padStart(6)}${flag}`);
  }

  // Are non-equator rings all identical? If yes → all stuck at initial.
  let nonEqAllSame = true;
  for (const f of FIELDS) {
    if (!(f in conditions.fluid)) continue;
    const ref = sim.ring_fluids[0][f];
    for (let k = 0; k < n; k++) {
      if (k === eq) continue;
      if (Math.abs(sim.ring_fluids[k][f] - ref) > 0.01) {
        nonEqAllSame = false;
        break;
      }
    }
    if (!nonEqAllSame) break;
  }
  console.log(`  non-equator rings all identical for tracked fields: ${nonEqAllSame ? 'YES (all stuck at initial)' : 'no (some movement)'}`);
}

for (const name of TARGETS) probe(name);

// =====================================================================
// Diagnostic 2: where engines ACTUALLY read from — mesh.cells[].fluid.
// If mesh cells reflect the event chemistry uniformly, then engines
// might be seeing it correctly and ring_fluids[] being stale is just
// a probe-artifact. If mesh cells are ALSO stale, the bug is real.
// =====================================================================
console.log(`\n=== diagnostic 2: mesh.cells[].fluid (where engines actually read) ===`);
setSeed(42);
{
  const scn = SCENARIOS['sunnyside_american_tunnel'];
  const { conditions, events, defaultSteps } = scn();
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < (defaultSteps ?? 200); i++) sim.run_step();

  const mesh = sim.wall_state.meshFor(sim);
  const ringCount = sim.wall_state.ring_count;
  const cellsPerRing = sim.wall_state.cells_per_ring;
  const eq = Math.floor(ringCount / 2);

  console.log(`  mesh: ${ringCount} rings × ${cellsPerRing} cells = ${mesh.cells.length} total`);
  console.log(`  conditions.fluid: pH=${sim.conditions.fluid.pH.toFixed(2)} Ca=${sim.conditions.fluid.Ca.toFixed(0)} CO3=${sim.conditions.fluid.CO3.toFixed(0)}`);

  // Sample one cell per ring (cell 0 of each ring) to see how event
  // chemistry propagates into the mesh.
  console.log(`  per-ring sample (cell 0 of each ring):`);
  for (let r = 0; r < ringCount; r++) {
    const idx = r * cellsPerRing + 0;
    const cell = mesh.cells[idx];
    if (!cell || !cell.fluid) {
      console.log(`    ring ${String(r).padStart(2)}: cell missing`);
      continue;
    }
    const f = cell.fluid;
    console.log(`    ring ${String(r).padStart(2)}: pH=${f.pH?.toFixed(2)} Ca=${f.Ca?.toFixed(0)} CO3=${f.CO3?.toFixed(0)} Mn=${f.Mn?.toFixed(1)} Fe=${f.Fe?.toFixed(1)}`);
  }

  // Check: is conditions.fluid the SAME object as mesh.cells[?]
  console.log(`\n  identity checks:`);
  const equatorCell = mesh.cells[eq * cellsPerRing + 0];
  console.log(`    conditions.fluid === sim.ring_fluids[${eq}]?  ${sim.conditions.fluid === sim.ring_fluids[eq]}`);
  console.log(`    conditions.fluid === equator cell.fluid?      ${sim.conditions.fluid === equatorCell?.fluid}`);
  console.log(`    sim.ring_fluids[${eq}] === equator cell.fluid?     ${sim.ring_fluids[eq] === equatorCell?.fluid}`);
}
