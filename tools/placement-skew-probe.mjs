// tools/placement-skew-probe.mjs — observe-before-assert for the per-vertex
// placement flip (BACKLOG: "make 'nucleate where σ is highest' the default").
//
// THE QUESTION
// ------------
// _perVertexNucleationSample weights candidate cells by (σ−1)² with NO cell-
// area term. The legacy free-wall path (_assignWallRing) weights rings by
// ringAreaWeight(r) = sin(π(r+0.5)/n) — the polar-thinning correction that
// keeps the equatorial wall (which has the most surface area) hosting
// proportionally more nuclei. On the default 16-ring lat-long mesh every ring
// has the SAME cell count, so under a near-uniform σ field the per-vertex
// sampler gives every ring equal weight → it over-nucleates the floor/ceiling
// poles. The zoned_dripstone_cave showcase hides this because its σ field is
// sharply zoned (σ dynamic range ≫ the sin(φ) 10× range).
//
// This probe MEASURES the floor/wall/ceiling nucleation distribution for the
// dominant mineral of each scenario under three weightings, WITHOUT modifying
// the bundle:
//   (a) legacy   : P(ring r) ∝ ringAreaWeight(r)                 [what OFF does]
//   (b) current  : P(ring r) ∝ Σ_c (σ(r,c)−1)²                   [what ON does now]
//   (c) proposed : P(ring r) ∝ ringAreaWeight(r) · Σ_c (σ(r,c)−1)²[ON + area term]
//
// It also empirically samples sim._perVertexNucleationSample(mineral) a few
// thousand times to confirm the analytic (b) matches the real sampler.
//
// Usage: node tools/placement-skew-probe.mjs

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({
  toolName: 'placement-skew-probe',
});

// Representative set: no-zoning carbonate, pegmatites, marble, porphyry,
// cooling, an evaporite, the simplest tutorial, and the zoned showcase
// (which MUST keep its sort under (c) — the area term should be second-order
// where chemistry is sharply zoned).
const TARGETS = [
  'tutorial_first_crystal',
  'mvt',
  'gem_pegmatite',
  'marble_contact_metamorphism',
  'porphyry',
  'cooling',
  'naica_geothermal',
  'sabkha_dolomitization',
  'zoned_dripstone_cave',
];

const EMPIRICAL_TRIALS = 4000;

function zoneOf(wall, r) {
  return wall.ringOrientation(r);
}

// Compute per-cell σ for `mineral` across the whole mesh, mirroring
// _perVertexNucleationSample's swap loop. Returns { perRingWeightB, cleared }
// where perRingWeightB[r] = Σ_c max(0, σ−1)² over that ring's cells.
function sigmaLandscape(sim, mineral) {
  const wall = sim.wall_state;
  const ringCount = wall.ring_count | 0;
  const N = wall.cells_per_ring | 0;
  const mesh = wall.meshFor ? wall.meshFor(sim) : null;
  if (!mesh || !mesh.cells || mesh.cells.length < ringCount * N) return null;
  const sigmaFn = sim.conditions[`supersaturation_${mineral}`];
  if (typeof sigmaFn !== 'function') return null;
  const ringTemps = sim.ring_temperatures || [];

  const savedFluid = sim.conditions.fluid;
  const savedTemp = sim.conditions.temperature;
  const perRingWeightB = new Float64Array(ringCount);
  let cleared = 0;          // cells with σ > 1
  let sigmaMax = 0;
  let sigmaSum = 0;
  let sigmaCells = 0;
  try {
    for (let r = 0; r < ringCount; r++) {
      const tempR = (r < ringTemps.length) ? ringTemps[r] : savedTemp;
      sim.conditions.temperature = tempR;
      for (let c = 0; c < N; c++) {
        const cell = mesh.cells[r * N + c];
        const cf = cell ? cell.fluid : null;
        if (!cf) continue;
        sim.conditions.fluid = cf;
        let s = 0;
        try { s = sigmaFn.call(sim.conditions); } catch { s = 0; }
        if (!Number.isFinite(s)) continue;
        sigmaSum += s; sigmaCells++;
        if (s > sigmaMax) sigmaMax = s;
        if (s > 1) { perRingWeightB[r] += (s - 1) * (s - 1); cleared++; }
      }
    }
  } finally {
    sim.conditions.fluid = savedFluid;
    sim.conditions.temperature = savedTemp;
  }
  return {
    perRingWeightB, cleared,
    sigmaMax, sigmaAvg: sigmaCells ? sigmaSum / sigmaCells : 0,
  };
}

function bucketize(sim, perRingWeight) {
  const wall = sim.wall_state;
  const ringCount = wall.ring_count | 0;
  let floor = 0, wallw = 0, ceil = 0, total = 0;
  for (let r = 0; r < ringCount; r++) {
    const w = perRingWeight(r);
    total += w;
    const z = zoneOf(wall, r);
    if (z === 'floor') floor += w;
    else if (z === 'ceiling') ceil += w;
    else wallw += w;
  }
  if (total <= 0) return null;
  return {
    floor: 100 * floor / total,
    wall: 100 * wallw / total,
    ceiling: 100 * ceil / total,
  };
}

function pct(x) { return x == null ? '  —  ' : `${x.toFixed(1).padStart(5)}%`; }

function dominantMinerals(sim, k = 3) {
  const tally = {};
  for (const c of sim.crystals) {
    if (c.dissolved) continue;
    tally[c.mineral] = (tally[c.mineral] || 0) + 1;
  }
  return Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .filter(([m]) => typeof sim.conditions[`supersaturation_${m}`] === 'function')
    .slice(0, k);
}

function probe(name) {
  const scn = SCENARIOS[name];
  if (!scn) { console.log(`(scenario ${name} not found)`); return; }
  setSeed(42);
  const { conditions, events, defaultSteps } = scn();
  const sim = new VugSimulator(conditions, events);
  const total = defaultSteps ?? 100;
  const snapAt = Math.max(1, Math.floor(total / 2));
  for (let i = 0; i < snapAt; i++) sim.run_step();

  const flag = !!(conditions.wall && conditions.wall.per_vertex_nucleation);
  const zoneChem = !!(conditions.wall && conditions.wall.zone_chemistry);
  console.log(`\n=== ${name} ===   (snapshot @ step ${snapAt}/${total}; flag=${flag}, zone_chemistry=${zoneChem})`);

  // Legacy distribution (a) is mineral-independent (pure area weight).
  const distA = bucketize(sim, (r) => sim.wall_state.ringAreaWeight(r));
  console.log(`  (a) legacy area-weighted     floor=${pct(distA.floor)}  wall=${pct(distA.wall)}  ceiling=${pct(distA.ceiling)}`);

  const doms = dominantMinerals(sim, 3);
  if (!doms.length) { console.log('  (no nucleated mineral with a supersaturation_<m> fn yet)'); return; }

  for (const [mineral, count] of doms) {
    const land = sigmaLandscape(sim, mineral);
    if (!land) { console.log(`  ${mineral}: no σ landscape`); continue; }
    const distB = bucketize(sim, (r) => land.perRingWeightB[r]);
    const distC = bucketize(sim, (r) => sim.wall_state.ringAreaWeight(r) * land.perRingWeightB[r]);

    // Empirical (b): hammer the real sampler.
    let ef = 0, ew = 0, ec = 0, en = 0;
    for (let i = 0; i < EMPIRICAL_TRIALS; i++) {
      const p = sim._perVertexNucleationSample(mineral);
      if (!p) { en++; continue; }
      const z = zoneOf(sim.wall_state, p.ringIdx);
      if (z === 'floor') ef++; else if (z === 'ceiling') ec++; else ew++;
    }
    const eTot = ef + ew + ec;
    const distE = eTot > 0
      ? { floor: 100 * ef / eTot, wall: 100 * ew / eTot, ceiling: 100 * ec / eTot }
      : null;

    console.log(`  mineral=${mineral} (×${count}, ${land.cleared} cells σ>1, σavg=${land.sigmaAvg.toFixed(2)}, σmax=${land.sigmaMax.toFixed(2)})`);
    console.log(`    (b) current (σ−1)²         floor=${pct(distB?.floor)}  wall=${pct(distB?.wall)}  ceiling=${pct(distB?.ceiling)}`);
    console.log(`    (b) empirical sampler      floor=${pct(distE?.floor)}  wall=${pct(distE?.wall)}  ceiling=${pct(distE?.ceiling)}   (${en} null fall-throughs)`);
    console.log(`    (c) proposed sinφ·(σ−1)²   floor=${pct(distC?.floor)}  wall=${pct(distC?.wall)}  ceiling=${pct(distC?.ceiling)}`);
  }
}

console.log('Floor/wall/ceiling nucleation distribution by weighting scheme.');
console.log('Legacy (a) = geological target (area-proportional). (b) current per-vertex.');
console.log('(c) = per-vertex with the sin(φ) area term restored. Poles = floor+ceiling.');
for (const name of TARGETS) probe(name);
