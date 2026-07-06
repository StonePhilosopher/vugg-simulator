// tools/c0-calcite-form-probe.mjs — C0 (boss stone #1) probe stage: the
// calcite σ/Ca:CO₃ FORM lever, step 0 of the 4a.7 recipe (probe → law →
// calibrate at true g → sweep → ship). Commits nothing, touches no engine code.
//
// THE QUESTION
// ------------
// calciteMorphForm (js/52) currently fences dogtooth↔nailhead on Mg:Ca > 0.15
// OR T > 200°C — no σ or Ca:CO₃ term. The kinetic literature's OTHER driver:
// scalenohedral {21-31} faces are S/K faces that persist only under fast
// step supply (high σ) and non-stoichiometric Ca:CO₃ changes obtuse/acute step
// kinetics asymmetrically (elongation with Ca excess). Before writing any law,
// MEASURE the fleet's landscape on the sim's OWN σ scale (the sigma-observe
// header's standing rule: ratio-like Ω, never transcribe paper thresholds):
//   1. Per calcite crystal: GROWTH-WEIGHTED σ̄, r̄ = molar Ca:CO₃, Mg:Ca, T̄ —
//      the wulfenite-4a.7 integral (weights = zone thickness, only on steps the
//      crystal actually grew), read against the crystal's OWN CELL fluid (the
//      broth is half-dynamic; bulk σ would lie about feeder-spot crystals).
//   2. Which branch of the CURRENT fence fired (mg / T / none) + the habit and
//      σ-regime the crystal actually carries.
//   3. Does a σ̄ or r̄ threshold SEPARATE the dogtooth-genre localities from
//      nailhead-genre ones — or do the two levers disagree with the Mg story?
//
// Usage: node tools/c0-calcite-form-probe.mjs [--seed 42] [--scen a,b,c] [--csv]

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'c0-calcite-form-probe' });

const args = process.argv.slice(2);
const SEED = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : 42;
const ONLY = args.includes('--scen') ? args[args.indexOf('--scen') + 1].split(',') : null;
const CSV = args.includes('--csv');

const M_CA = 40.078, M_CO3 = 60.009;   // g/mol — r̄ is MOLAR (the wulfenite convention)

// σ + fluid read against the crystal's own anchor cell (placement-skew idiom:
// swap conditions.fluid/temperature, call the σ closure, restore). Falls back
// to bulk when the mesh/cell is unavailable.
function cellView(sim, crystal) {
  const wall = sim.wall_state;
  const cond = sim.conditions;
  let fluid = cond.fluid, temp = cond.temperature;
  try {
    const anchor = wall._resolveAnchor ? wall._resolveAnchor(crystal) : null;
    const mesh = wall.meshFor ? wall.meshFor(sim) : null;
    if (anchor && mesh && mesh.cells) {
      const N = wall.cells_per_ring | 0;
      const cell = mesh.cells[anchor.ringIdx * N + anchor.cellIdx];
      if (cell && cell.fluid) fluid = cell.fluid;
      const rt = sim.ring_temperatures || [];
      if (anchor.ringIdx < rt.length) temp = rt[anchor.ringIdx];
    }
  } catch { /* bulk fallback */ }
  const savedF = cond.fluid, savedT = cond.temperature;
  cond.fluid = fluid; cond.temperature = temp;
  let sigma = 0;
  try { sigma = cond.supersaturation_calcite(); } catch { sigma = 0; }
  cond.fluid = savedF; cond.temperature = savedT;
  return { sigma, fluid, temp };
}

const rows = [];
const scenNames = (ONLY || Object.keys(SCENARIOS)).filter((s) => SCENARIOS[s]);

for (const scen of scenNames) {
  setSeed(SEED);
  let conditions, events, defaultSteps;
  try { ({ conditions, events, defaultSteps } = SCENARIOS[scen]()); } catch { continue; }
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 120;
  const acc = new Map();   // crystal_id → integrals
  for (let s = 0; s < steps; s++) {
    sim.run_step();
    for (const c of sim.crystals) {
      if (!c || c.mineral !== 'calcite') continue;
      const z = c.zones && c.zones.length ? c.zones[c.zones.length - 1] : null;
      if (!z || z.step !== sim.step || !(z.thickness_um > 0)) continue;   // grew THIS step only
      const w = z.thickness_um;
      const v = cellView(sim, c);
      const f = v.fluid || {};
      const ca = f.Ca || 0, co3 = f.CO3 || 0, mg = f.Mg || 0;
      const r = co3 > 0 ? (ca / M_CA) / (co3 / M_CO3) : NaN;
      let a = acc.get(c.crystal_id);
      if (!a) { a = { sG: 0, rG: 0, rW: 0, mgG: 0, tG: 0, G: 0 }; acc.set(c.crystal_id, a); }
      a.sG += v.sigma * w;
      if (Number.isFinite(r)) { a.rG += r * w; a.rW += w; }
      a.mgG += (ca > 0 ? mg / ca : 0) * w;
      a.tG += v.temp * w;
      a.G += w;
    }
  }
  for (const c of sim.crystals) {
    if (!c || c.mineral !== 'calcite') continue;
    const a = acc.get(c.crystal_id);
    if (!a || a.G <= 0) continue;
    const habit = String(c.habit || '');
    const mgBar = a.mgG / a.G, tBar = a.tG / a.G;
    rows.push({
      scen, id: c.crystal_id,
      sizeMm: +(c.c_length_mm || 0).toFixed(1),
      dissolved: !!c.dissolved,
      habit,
      regime: (c._morphology && c._morphology.regime) || '-',
      scaleno: habit.indexOf('scaleno') >= 0,
      sBar: a.sG / a.G,
      rBar: a.rW > 0 ? a.rG / a.rW : NaN,
      mgBar, tBar,
      // which branch of the CURRENT fence explains the word (at ω̄ conditions)
      fence: mgBar > 0.15 ? 'mg' : (tBar > 200 ? 'T' : 'none'),
    });
  }
}

if (CSV) {
  console.log('scen,id,sizeMm,dissolved,habit,regime,scaleno,sBar,rBar,mgBar,tBar,fence');
  for (const r of rows) console.log([r.scen, r.id, r.sizeMm, r.dissolved, r.habit, r.regime, r.scaleno, r.sBar.toFixed(3), (r.rBar || 0).toFixed(2), r.mgBar.toFixed(3), r.tBar.toFixed(0), r.fence].join(','));
} else {
  console.log(`\nC0 probe — growth-weighted per-crystal calcite landscape (seed ${SEED}).`);
  console.log('σ̄ = growth-weighted Ω the crystal ACTUALLY grew at (own-cell fluid); r̄ = molar Ca:CO₃; fence = which current-rule branch fired.\n');
  console.log('scenario                       id  size   habit                         regime      σ̄       r̄     Mg:Ca   T̄    fence scaleno');
  console.log('------------------------------ --- ----- ----------------------------- ---------- ------- ------- ------ ----- ----- -------');
  for (const r of rows) {
    console.log(
      `${r.scen.padEnd(30)} ${String(r.id).padStart(3)} ${String(r.sizeMm).padStart(5)} ${(r.habit || '-').slice(0, 29).padEnd(29)} ` +
      `${String(r.regime).slice(0, 10).padEnd(10)} ${r.sBar.toFixed(2).padStart(7)} ${(Number.isFinite(r.rBar) ? r.rBar.toFixed(1) : '  n/a').padStart(7)} ` +
      `${r.mgBar.toFixed(3).padStart(6)} ${r.tBar.toFixed(0).padStart(5)} ${r.fence.padStart(5)} ${r.scaleno ? '  DOG' : '  nail'}`);
  }
  // fleet split: σ̄ + r̄ distributions BY current form outcome
  const dog = rows.filter((r) => r.scaleno), nail = rows.filter((r) => !r.scaleno);
  const q = (arr, p) => { if (!arr.length) return NaN; const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.round(p * (a.length - 1)))]; };
  const stats = (arr) => `n=${String(arr.length).padStart(3)}  q25=${q(arr, 0.25).toFixed(2)} med=${q(arr, 0.5).toFixed(2)} q75=${q(arr, 0.75).toFixed(2)} max=${q(arr, 1).toFixed(2)}`;
  console.log('\nFLEET SPLIT (does σ̄ / r̄ already separate the current forms?)');
  console.log(`  σ̄  dogtooth : ${stats(dog.map((r) => r.sBar))}`);
  console.log(`  σ̄  nailhead : ${stats(nail.map((r) => r.sBar))}`);
  console.log(`  r̄  dogtooth : ${stats(dog.filter((r) => Number.isFinite(r.rBar)).map((r) => r.rBar))}`);
  console.log(`  r̄  nailhead : ${stats(nail.filter((r) => Number.isFinite(r.rBar)).map((r) => r.rBar))}`);
  const fenceTally = {};
  for (const r of rows) { const k = `${r.scaleno ? 'DOG' : 'nail'}/${r.fence}`; fenceTally[k] = (fenceTally[k] || 0) + 1; }
  console.log(`  fence branches: ${Object.entries(fenceTally).map(([k, v]) => `${k}:${v}`).join('  ')}`);
}
