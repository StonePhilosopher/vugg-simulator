// tools/sigma-structure-probe.mjs — "make the feature matter first" (BACKLOG).
//
// The placement-skew probe showed per-cell σ is ~uniform in every non-zoned
// scenario (σavg ≈ σmax), so "nucleate where σ is highest" has no gradient to
// follow. The boss's question: is diffusion homogenizing away the local-
// depletion gradients that per-vertex placement SHOULD exploit? Or is it a
// scale problem (too few crystals vs 1920 cells)?
//
// This probe runs a scenario at several inter_ring_diffusion_rate values and
// measures, for the dominant mineral at end-of-run:
//   * σ at cells that HOLD a crystal (depleted?) vs empty cells
//   * coefficient of variation of σ across all cells (the "structure")
//   * fraction of cells with σ < 0.9·max (the depleted-halo footprint)
//   * # crystals vs # cells (the scale ratio)
//
// If lowering diffusion sharply raises CV / occupied-vs-empty contrast, the
// lever is diffusion. If CV stays ~0 even at diffusion=0, it's a scale problem
// (depletion touches too few cells to matter) and the feature needs designed
// σ structure (zone_chemistry) or a high-fill / slow-diffusion regime, not a
// global flag flip.
//
// Usage: node tools/sigma-structure-probe.mjs

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({
  toolName: 'sigma-structure-probe',
});

const TARGETS = ['mvt', 'reactive_wall', 'bisbee', 'sabkha_dolomitization'];
const DIFFUSION_RATES = [0, 0.01, 0.05, 0.2];

function dominantMineral(sim) {
  const tally = {};
  for (const c of sim.crystals) {
    if (c.dissolved) continue;
    if (typeof sim.conditions[`supersaturation_${c.mineral}`] !== 'function') continue;
    tally[c.mineral] = (tally[c.mineral] || 0) + 1;
  }
  const e = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  return e ? e[0] : null;
}

function sigmaPerCell(sim, mineral) {
  const wall = sim.wall_state;
  const ringCount = wall.ring_count | 0;
  const N = wall.cells_per_ring | 0;
  const mesh = wall.meshFor(sim);
  if (!mesh || !mesh.cells) return null;
  const sigmaFn = sim.conditions[`supersaturation_${mineral}`];
  if (typeof sigmaFn !== 'function') return null;
  const ringTemps = sim.ring_temperatures || [];
  const savedFluid = sim.conditions.fluid;
  const savedTemp = sim.conditions.temperature;
  const sig = new Float64Array(ringCount * N);
  try {
    for (let r = 0; r < ringCount; r++) {
      sim.conditions.temperature = (r < ringTemps.length) ? ringTemps[r] : savedTemp;
      for (let c = 0; c < N; c++) {
        const idx = r * N + c;
        const cell = mesh.cells[idx];
        const cf = cell ? cell.fluid : null;
        if (!cf) { sig[idx] = NaN; continue; }
        sim.conditions.fluid = cf;
        let s = 0;
        try { s = sigmaFn.call(sim.conditions); } catch { s = NaN; }
        sig[idx] = s;
      }
    }
  } finally {
    sim.conditions.fluid = savedFluid;
    sim.conditions.temperature = savedTemp;
  }
  return { sig, ringCount, N };
}

function occupiedCellIdx(sim) {
  const wall = sim.wall_state;
  const N = wall.cells_per_ring | 0;
  const set = new Set();
  for (const c of sim.crystals) {
    if (c.dissolved) continue;
    const a = wall._resolveAnchor(c);
    if (a) set.add(a.ringIdx * N + a.cellIdx);
  }
  return set;
}

function stats(arr) {
  const v = arr.filter((x) => Number.isFinite(x));
  if (!v.length) return null;
  const mean = v.reduce((s, x) => s + x, 0) / v.length;
  const variance = v.reduce((s, x) => s + (x - mean) * (x - mean), 0) / v.length;
  const sd = Math.sqrt(variance);
  let max = -Infinity, min = Infinity;
  for (const x of v) { if (x > max) max = x; if (x < min) min = x; }
  return { mean, sd, cv: mean !== 0 ? sd / Math.abs(mean) : 0, max, min, n: v.length };
}

function probe(name) {
  const scn = SCENARIOS[name];
  if (!scn) { console.log(`(scenario ${name} not found)`); return; }
  console.log(`\n=== ${name} ===`);
  for (const d of DIFFUSION_RATES) {
    setSeed(42);
    const { conditions, events, defaultSteps } = scn();
    // Override the diffusion rate for this run.
    if (!conditions.wall) { console.log('  (no wall)'); return; }
    conditions.wall.inter_ring_diffusion_rate = d;
    const sim = new VugSimulator(conditions, events);
    const total = defaultSteps ?? 100;
    for (let i = 0; i < total; i++) sim.run_step();

    const m = dominantMineral(sim);
    if (!m) { console.log(`  diffusion=${d}: no dominant mineral`); continue; }
    const land = sigmaPerCell(sim, m);
    if (!land) { console.log(`  diffusion=${d}: no σ landscape for ${m}`); continue; }
    const occ = occupiedCellIdx(sim);
    const totalCells = land.ringCount * land.N;

    const occArr = [], empArr = [];
    for (let i = 0; i < land.sig.length; i++) {
      if (!Number.isFinite(land.sig[i])) continue;
      (occ.has(i) ? occArr : empArr).push(land.sig[i]);
    }
    const all = stats(Array.from(land.sig));
    const so = stats(occArr);
    const se = stats(empArr);
    // depleted footprint: cells below 0.9·max
    let belowCount = 0, finite = 0;
    for (let i = 0; i < land.sig.length; i++) {
      if (!Number.isFinite(land.sig[i])) continue;
      finite++;
      if (land.sig[i] < 0.9 * all.max) belowCount++;
    }
    const contrast = (so && se && se.mean !== 0) ? (so.mean / se.mean) : NaN;
    console.log(
      `  diffusion=${String(d).padEnd(5)} ${m.padEnd(14)} ` +
      `cells=${totalCells} occ=${String(occ.size).padStart(3)}  ` +
      `σ[all] mean=${all.mean.toFixed(2)} CV=${(100 * all.cv).toFixed(2)}%  ` +
      `σ[occ]=${so ? so.mean.toFixed(2) : '—'} σ[empty]=${se ? se.mean.toFixed(2) : '—'} ` +
      `occ/empty=${Number.isFinite(contrast) ? contrast.toFixed(3) : '—'}  ` +
      `<0.9max: ${belowCount}/${finite} (${(100 * belowCount / finite).toFixed(1)}%)`,
    );
  }
}

console.log('Per-cell σ structure vs diffusion rate (dominant mineral, end of run).');
console.log('CV≈0 + occ/empty≈1 → no depletion structure → per-vertex has nothing to track.');
console.log('CV rises as diffusion→0 → diffusion is the homogenizer (the lever).');
for (const name of TARGETS) probe(name);
