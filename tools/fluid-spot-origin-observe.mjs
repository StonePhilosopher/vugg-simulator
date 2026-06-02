#!/usr/bin/env node
/**
 * tools/fluid-spot-origin-observe.mjs — Phase 2c.1 DARK OBSERVATION (commits
 * nothing). PROVE the spatial-origin injection mechanism before baking it.
 *
 * 2c.1 wires origin:'cell' movements (js/85j): instead of SETTING the bulk
 * field (global), a movement pins ONE seeded fluid-spot cell's per-vertex fluid
 * to its value (a fixed-composition feeder) and lets the step-end
 * _diffuseRingState carry it outward across mesh cells → a near→far GRADIENT
 * (one-sided growth, the Punjab hematite-on-one-side specimen).
 *
 * The discipline (HANDOFF lesson): verify the MECHANISM from observation, never
 * narrate it. This tool injects an origin:'cell' pH movement at RUNTIME ONLY
 * (no committed file touched, no SIM bump) on a scenario that HAS fluid spots,
 * then reads mesh.cells[].fluid.pH and bins it by graph-distance from the
 * resolved origin cell. The claim "near < far" (acid concentrated at the
 * feeder, relaxing outward) must show in the numbers, or the mechanism is wrong.
 *
 * Three variants, same seed (42) + same cavity (→ same spots + movement stream):
 *   NONE    no movement (uniform bulk pH everywhere)
 *   GLOBAL  origin:'global' pH trend  → bulk pH drops, ~flat across cells
 *   CELL    origin:'cell'   pH trend  → ONE feeder cell pinned, gradient outward
 *
 * Usage:
 *   node tools/fluid-spot-origin-observe.mjs [scenario] [shape_seed] [amp]
 *   defaults:  supergene_oxidation  23  -2.5   (the seed-23 3-feeder showpiece)
 */
import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'fluid-spot-origin-observe' });

const [, , argScen, argSeed, argAmp] = process.argv;
const SCEN = argScen || 'supergene_oxidation';
const SHAPE_SEED = argSeed !== undefined ? Number(argSeed) : 23;
const AMP = argAmp !== undefined ? Number(argAmp) : -2.5;
const FIELD = 'fluid.pH';
const LEAF = 'pH';

if (!SCENARIOS[SCEN]) {
  console.error(`no scenario '${SCEN}'. available:`, Object.keys(SCENARIOS).sort().join(', '));
  process.exit(1);
}

const STEPS = SCENARIOS[SCEN]().defaultSteps ?? 120;
const START = 20;   // match the supergene acid-front startStep (post meteoric flush)
const tex = { theta: 0.3, sigma: 0.0 };  // texture OFF — isolate the gradient, no wobble

function build() {
  setSeed(42);
  const { conditions, events } = SCENARIOS[SCEN]({ wall: { shape_seed: SHAPE_SEED } });
  return new VugSimulator(conditions, events);
}

// Graph distance on the lat-long mesh: |Δring| + wrapped |Δcol|. This is the
// metric diffusion actually relaxes along (4-neighbor adjacency), so binning
// pH by it is the honest "does the injected value decay with hops" question.
function meshDist(a, b, N, ringCount) {
  const ra = Math.floor(a / N), ca = a % N;
  const rb = Math.floor(b / N), cb = b % N;
  const dRing = Math.abs(ra - rb);
  const dCol = Math.min(Math.abs(ca - cb), N - Math.abs(ca - cb));
  return dRing + dCol;
}

function run(origin) {
  const sim = build();
  const N = sim.wall_state.cells_per_ring | 0;
  const ringCount = sim.wall_state.ring_count | 0;
  const spots = (sim._fluidSpots && sim._fluidSpots.openSpots) ? sim._fluidSpots.openSpots() : [];
  let movements = null;
  if (origin) {
    movements = [{
      field: FIELD, startStep: START, endStep: STEPS, base: 6.8,
      ops: [{ kind: 'trend', amp: AMP, ease: true }], texture: tex,
      clampMin: 3.5, origin,
    }];
    sim.conditions._scenario = sim.conditions._scenario || {};
    sim.conditions._scenario.movements = movements;
  }
  for (let s = 0; s < STEPS; s++) sim.run_step();

  const mesh = sim.wall_state.meshFor(sim);
  const cells = mesh.cells;
  const originCell = (sim._movements && sim._movements._state && sim._movements._state[0])
    ? sim._movements._state[0].originCell : -1;

  // Per-cell pH read.
  const pH = cells.map(c => (c && c.fluid && typeof c.fluid[LEAF] === 'number') ? c.fluid[LEAF] : NaN);
  const valid = pH.filter(Number.isFinite);
  const mean = valid.reduce((s, x) => s + x, 0) / Math.max(1, valid.length);
  const min = Math.min(...valid), max = Math.max(...valid);

  // Bin by graph-distance from origin (CELL only; NONE/GLOBAL have no origin).
  let bins = null;
  if (originCell >= 0) {
    const acc = {};
    for (let i = 0; i < pH.length; i++) {
      if (!Number.isFinite(pH[i])) continue;
      const d = meshDist(i, originCell, N, ringCount);
      (acc[d] ??= []).push(pH[i]);
    }
    bins = Object.keys(acc).map(Number).sort((a, b) => a - b)
      .map(d => ({ d, n: acc[d].length, mean: acc[d].reduce((s, x) => s + x, 0) / acc[d].length }));
  }
  return { N, ringCount, spots, originCell, mean, min, max, bins, nCells: pH.length };
}

const NONE = run(null);
const GLOBAL = run('global');
const CELL = run('cell');

console.log(`\n### SPATIAL-ORIGIN INJECTION OBSERVATION — ${SCEN}, shape_seed ${SHAPE_SEED}`);
console.log(`    driving ${FIELD}: base 6.8 → ${(6.8 + AMP).toFixed(1)} (trend amp ${AMP}, clampMin 3.5),`);
console.log(`    startStep ${START}, ${STEPS} steps, seed 42, texture OFF (isolate gradient)`);
console.log(`    mesh ${CELL.ringCount} rings × ${CELL.N} cols = ${CELL.nCells} cells`);
console.log(`    open fluid-spots: ${CELL.spots.map(s => `${s.kind}@cell${s.cell}`).join(', ') || '— none —'}`);
console.log(`    resolved origin cell (CELL variant): ${CELL.originCell}` +
  (CELL.originCell >= 0 ? ` = ring ${Math.floor(CELL.originCell / CELL.N)}, col ${CELL.originCell % CELL.N}` : ''));

console.log(`\n  variant   per-cell pH:  min / mean / max   (spread = max-min)`);
const row = (k, r) => console.log(`  ${k.padEnd(7)} ${r.min.toFixed(2).padStart(8)} / ${r.mean.toFixed(2).padStart(6)} / ${r.max.toFixed(2).padStart(6)}    ${(r.max - r.min).toFixed(2)}`);
row('NONE', NONE);
row('GLOBAL', GLOBAL);
row('CELL', CELL);

if (CELL.bins) {
  console.log(`\n  === CELL variant: pH vs graph-distance from origin cell ${CELL.originCell} ===`);
  console.log(`  (acid pinned at distance 0; pH should RISE back toward bulk with distance)`);
  console.log(`  dist  nCells   mean pH`);
  for (const b of CELL.bins) {
    const bar = '█'.repeat(Math.max(0, Math.round((b.mean - CELL.min) * 6)));
    console.log(`  ${String(b.d).padStart(4)}  ${String(b.n).padStart(5)}   ${b.mean.toFixed(2).padStart(6)}  ${bar}`);
  }
  const near = CELL.bins[0], far = CELL.bins[CELL.bins.length - 1];
  const monotonicEnough = far.mean > near.mean + 0.1;
  console.log(`\n  VERDICT: near (d=${near.d}) pH ${near.mean.toFixed(2)}  →  far (d=${far.d}) pH ${far.mean.toFixed(2)}` +
    `   gradient ${(far.mean - near.mean).toFixed(2)} pH units`);
  console.log(`  ${monotonicEnough ? '✓ GRADIENT PRESENT' : '✗ NO MEANINGFUL GRADIENT'} — ` +
    `${monotonicEnough ? 'acid concentrated at the feeder, relaxing outward (one-sided)' : 'injection did not localize (check diffusion rate / decoupling)'}`);
  console.log(`  GLOBAL spread for contrast: ${(GLOBAL.max - GLOBAL.min).toFixed(2)} (≈0 = uniform bulk drop, as expected)`);
}
