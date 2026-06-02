#!/usr/bin/env node
/**
 * tools/fluid-spots-observe.mjs — Phase 2a DARK OBSERVATION (commits nothing).
 *
 * Fluid-source spots (js/85k, PROPOSAL §10) are seeded off the cavity seed and,
 * in Phase 2a, are STORED but never consumed (sim-neutral). Before coupling them
 * (2b decay bonus, 2c origin/deposition, 2d events), LOOK at the seeded set:
 * how many, where (cell → phi/theta/orientation), what kinds — and confirm the
 * set is reproducible per cavity and varies with shape_seed.
 *
 * Reads sim._fluidSpots (the FluidSpotField the constructor seeds) — no internal
 * functions needed; this is what the couplings will consume.
 *
 * Usage:
 *   node tools/fluid-spots-observe.mjs                 # all scenarios @ seed 42
 *   node tools/fluid-spots-observe.mjs mvt             # one scenario, vary shape_seed
 */
import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'fluid-spots-observe' });

const [, , argScen] = process.argv;
const ORIENT = (v) => (v && v.orientation) ? v.orientation : '?';
const deg = (r) => (typeof r === 'number' ? Math.round(r * 180 / Math.PI) : NaN);

function spotsFor(scen, shapeSeedOverride) {
  setSeed(42);
  const make = SCENARIOS[scen];
  const overrides = (shapeSeedOverride != null) ? { wall: { shape_seed: shapeSeedOverride } } : {};
  const { conditions, events } = make(overrides);
  const sim = new VugSimulator(conditions, events);
  const field = sim._fluidSpots;
  const mesh = sim.wall_state.meshFor ? sim.wall_state.meshFor(sim) : null;
  const verts = mesh ? mesh.vertices : null;
  const n = mesh ? (mesh.numInterior ?? (mesh.cells ? mesh.cells.length : 0)) : 0;
  const spots = (field && field.spots) ? field.spots : [];
  return { spots, n, verts, seed: (conditions.wall && conditions.wall.shape_seed) };
}

function describe(spots, verts) {
  return spots.map(s => {
    const v = verts && verts[s.cell];
    const pos = v ? `φ${deg(v.phi)}° θ${deg(v.theta)}° ${ORIENT(v)}` : `cell ${s.cell}`;
    return `${s.kind}@${s.cell} [${pos}]`;
  }).join('  |  ');
}

if (argScen) {
  if (!SCENARIOS[argScen]) { console.error('no scenario', argScen); process.exit(1); }
  console.log(`\n### FLUID-SPOTS — ${argScen}, varying shape_seed (reproducibility + variation)\n`);
  for (const seed of [undefined, 1, 2, 3, 7, 42]) {
    const { spots, n, verts, seed: used } = spotsFor(argScen, seed);
    const tag = seed === undefined ? `(authored seed ${used})` : `shape_seed ${seed}`;
    console.log(`  ${tag.padEnd(22)} ${spots.length} spot(s) over ${n} cells: ${describe(spots, verts) || '— none —'}`);
  }
  // reproducibility check
  const a = spotsFor(argScen, 7).spots, b = spotsFor(argScen, 7).spots;
  console.log(`\n  reproducible (seed 7 twice identical): ${JSON.stringify(a) === JSON.stringify(b)}`);
} else {
  console.log(`\n### FLUID-SPOTS — seeded set per scenario @ seed 42\n`);
  const names = Object.keys(SCENARIOS).sort();
  const hist = {};
  for (const scen of names) {
    const { spots, n, verts } = spotsFor(scen);
    hist[spots.length] = (hist[spots.length] || 0) + 1;
    console.log(`  ${scen.padEnd(28)} ${String(spots.length)} spot(s) /${String(n).padStart(4)} cells: ${describe(spots, verts) || '— none —'}`);
  }
  console.log('\n  count distribution across scenarios:', JSON.stringify(hist));
}
