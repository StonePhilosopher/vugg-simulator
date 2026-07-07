// tools/c1-depletion-ev-probe.mjs — C1 (boss stone: the local-σ depletion
// field) EV CHECK. Commits no engine code; runs BEFORE any C1 build, per the
// handoff's pre-registered "mass-conservation EV check FIRST"
// (feedback_gamble_ev_check generalizes: budget the solute books before
// trusting emergent behavior).
//
// THE FRAMING (established this session by reading the code, not asserting):
//   RATE already reads LOCAL. _runEngineForCrystal (js/85b) swaps
//   conditions.fluid → the crystal's own cell.fluid before the engine runs,
//   and applyMassBalance debits that same cell. So growth THICKNESS already
//   responds to local depletion, and diffusion (js/24 _diffuseFull) spreads
//   the halo.
//   FORM still reads BULK. Both form classifiers run at the restored bulk
//   view: classifyMorphologyStep (js/85:763) and classifyWulffForm
//   (js/85:806). The calcite biasC integral literally reads
//   sim.conditions.fluid (js/45:1051). O1a's exposure is a fleet-wide
//   constant kExp=0.18 (js/99i:4180), not a real σ gradient.
//
// So C1 = "turn on the pressure": make FORM read the same local σ that RATE
// already reads. This probe measures whether that is worth doing — i.e.
// whether cell σ and bulk σ actually DIVERGE across the fleet (if diffusion
// washes them equal, C1 is a no-op like O1b was), and whether the divergence
// CROSSES a form band edge (biasC / the C0 Ω word) so the player would SEE it.
//
// THREE READOUTS
//   1. SOLUTE BOOKS — per growing crystal, growth-weighted cell σ̄ vs bulk σ̄
//      (own-cell fluid+temp via the placement-skew swap, the c0-probe idiom).
//      Fleet distribution of the drawdown ratio cellσ̄/bulkσ̄. This is the
//      "is there signal at all" headline.
//   2. FORM MOVES — calcite tenants (wulff_calcite): recompute the shipped
//      biasC = wulffCalciteOmegaBias(Ω̄, scaleno) under cell Ω̄ vs bulk Ω̄, and
//      the C0 word calciteMorphForm(...) under cell Ω vs bulk Ω. Count band
//      crossings / word flips — the "would the player see it" headline.
//   3. PERSISTENCE — is the drawdown sustained across the crystal's growth, or
//      a one-step transient the diffusion pass refills? (max vs mean drawdown.)
//
// Usage: node tools/c1-depletion-ev-probe.mjs [--seed 42] [--scen a,b,c] [--csv]

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed, wulffCalciteOmegaBias, calciteMorphForm, MORPH_TH } =
  await loadSimBundle({
    toolName: 'c1-depletion-ev-probe',
    extraExports: ['wulffCalciteOmegaBias', 'calciteMorphForm', 'MORPH_TH'],
  });

const args = process.argv.slice(2);
const SEED = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : 42;
const ONLY = args.includes('--scen') ? args[args.indexOf('--scen') + 1].split(',') : null;
const CSV = args.includes('--csv');

// Swap conditions.fluid + temperature to the crystal's own anchor cell, call
// the mineral's σ closure, restore. Returns { cell, bulk } supersaturations —
// EXACTLY the two views the form path could read (bulk = what it reads now).
function sigmaViews(sim, crystal) {
  const cond = sim.conditions;
  const mineral = crystal.mineral;
  const fn = cond[`supersaturation_${mineral}`];
  if (typeof fn !== 'function') return null;

  // bulk view — conditions is at the restored bulk state post-run_step.
  let bulk = NaN;
  try { bulk = fn.call(cond); } catch { bulk = NaN; }

  // cell view — swap in the anchor cell's fluid + ring temperature.
  const wall = sim.wall_state;
  let cellFluid = null, cellTemp = cond.temperature;
  try {
    const anchor = wall._resolveAnchor ? wall._resolveAnchor(crystal) : null;
    const mesh = wall.meshFor ? wall.meshFor(sim) : null;
    if (anchor && mesh && mesh.cells) {
      const N = wall.cells_per_ring | 0;
      const cell = mesh.cells[anchor.ringIdx * N + anchor.cellIdx];
      if (cell && cell.fluid) cellFluid = cell.fluid;
      const rt = sim.ring_temperatures || [];
      if (anchor.ringIdx < rt.length) cellTemp = rt[anchor.ringIdx];
    }
  } catch { /* bulk fallback */ }
  let cell = bulk;
  if (cellFluid) {
    const savedF = cond.fluid, savedT = cond.temperature;
    cond.fluid = cellFluid; cond.temperature = cellTemp;
    try { cell = fn.call(cond); } catch { cell = NaN; }
    cond.fluid = savedF; cond.temperature = savedT;
  }
  return { cell, bulk };
}

// DIRECTIONAL view — σ at the crystal's wall-anchored base (voxel d=0, the
// slab growth depletes) vs its cavity-facing tip (voxel d=max, center baseline).
// This is O1a's f_geo = 1 + k·(n·û) exposure driver measured as REAL chemistry
// instead of the fleet-wide geometric constant kExp=0.18. base/tip < 1 means the
// crystal genuinely sees more σ toward the cavity — the signal a per-crystal
// (eventually per-direction) exposure k would draw from.
function dirView(sim, crystal) {
  const wall = sim.wall_state;
  const cond = sim.conditions;
  const fn = cond[`supersaturation_${crystal.mineral}`];
  if (typeof fn !== 'function') return null;
  const grid = wall.voxelGridFor ? wall.voxelGridFor(sim) : null;
  if (!grid) return null;
  const anchor = wall._resolveAnchor ? wall._resolveAnchor(crystal) : null;
  if (!anchor) return null;
  const maxD = grid.depth_count - 1;
  const f0 = grid.fluidAt(anchor.ringIdx, anchor.cellIdx, 0);
  const fD = grid.fluidAt(anchor.ringIdx, anchor.cellIdx, maxD);
  if (!f0 || !fD || f0 === fD) return null;
  const rt = sim.ring_temperatures || [];
  const temp = anchor.ringIdx < rt.length ? rt[anchor.ringIdx] : cond.temperature;
  const savedF = cond.fluid, savedT = cond.temperature;
  cond.temperature = temp;
  let s0 = NaN, sD = NaN;
  cond.fluid = f0; try { s0 = fn.call(cond); } catch { s0 = NaN; }
  cond.fluid = fD; try { sD = fn.call(cond); } catch { sD = NaN; }
  cond.fluid = savedF; cond.temperature = savedT;
  return { s0, sD };
}

// Growth-weighted accumulators per crystal, plus per-step drawdown tracking
// for the persistence readout.
const perCrystal = new Map();   // crystal_id → acc
const scenNames = (ONLY || Object.keys(SCENARIOS)).filter((s) => SCENARIOS[s]);

for (const scen of scenNames) {
  setSeed(SEED);
  let conditions, events, defaultSteps;
  try { ({ conditions, events, defaultSteps } = SCENARIOS[scen]()); } catch { continue; }
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 120;
  // Read the Wulff-tenant flag from the CONSTRUCTED wall (sim.conditions.wall),
  // the same object classifyWulffForm reads — not the raw scenario arg, which
  // may be a plain object the constructor replaces with a whitelisting VugWall.
  const calciteOn = !!(sim.conditions && sim.conditions.wall && sim.conditions.wall.wulff_calcite);

  for (let s = 0; s < steps; s++) {
    sim.run_step();
    for (const c of sim.crystals) {
      if (!c || c.dissolved) continue;
      const z = c.zones && c.zones.length ? c.zones[c.zones.length - 1] : null;
      if (!z || z.step !== sim.step || !(z.thickness_um > 0)) continue;   // grew THIS step only
      const v = sigmaViews(sim, c);
      if (!v || !Number.isFinite(v.cell) || !Number.isFinite(v.bulk)) continue;
      const w = z.thickness_um;
      // Key by scenario:id — crystal_id resets per scenario, so keying on id
      // alone MERGES id-1 across all 38 scenarios (the bug that hid calcite).
      const key = `${scen}:${c.crystal_id}`;
      let a = perCrystal.get(key);
      if (!a) {
        a = {
          scen, id: c.crystal_id, mineral: c.mineral,
          env: c.growth_environment || '?',
          cellG: 0, bulkG: 0, G: 0, steps: 0,
          maxDrawdown: 0, sumDrawdown: 0,
          d0G: 0, dDG: 0, dG: 0,   // directional (base d=0 vs tip d=max)
          calcite: c.mineral === 'calcite' && calciteOn,
          scaleno: !!(c._wulffForm && c._wulffForm.scaleno),
        };
        perCrystal.set(key, a);
      }
      a.cellG += v.cell * w;
      a.bulkG += v.bulk * w;
      a.G += w;
      a.steps++;
      // per-step drawdown = 1 − cellσ/bulkσ (fraction the local view sits
      // BELOW the cavity average). Only meaningful when bulk σ is a real
      // positive supersaturation.
      if (v.bulk > 0.01) {
        const dd = 1 - v.cell / v.bulk;
        a.sumDrawdown += dd * w;
        if (dd > a.maxDrawdown) a.maxDrawdown = dd;
      }
      if (a.calcite) a.scaleno = !!(c._wulffForm && c._wulffForm.scaleno);
      // directional (voxel base vs tip) — fluid-grown only
      if (a.env !== 'air') {
        const dv = dirView(sim, c);
        if (dv && Number.isFinite(dv.s0) && Number.isFinite(dv.sD)) {
          a.d0G += dv.s0 * w; a.dDG += dv.sD * w; a.dG += w;
        }
      }
    }
  }
}

// ---- Reduce -----------------------------------------------------------------
const rows = [];
for (const a of perCrystal.values()) {
  if (a.G <= 0) continue;
  const cellBar = a.cellG / a.G, bulkBar = a.bulkG / a.G;
  const ratio = bulkBar !== 0 ? cellBar / bulkBar : NaN;
  const meanDrawdown = a.G > 0 ? a.sumDrawdown / a.G : 0;
  // directional base/tip ratio (voxel d=0 / d=max)
  const d0Bar = a.dG > 0 ? a.d0G / a.dG : NaN;
  const dDBar = a.dG > 0 ? a.dDG / a.dG : NaN;
  const dirRatio = (a.dG > 0 && dDBar !== 0) ? d0Bar / dDBar : NaN;
  const row = {
    scen: a.scen, id: a.id, mineral: a.mineral, env: a.env,
    cellBar, bulkBar, ratio, meanDrawdown, maxDrawdown: a.maxDrawdown,
    dirRatio,
    calcite: a.calcite, scaleno: a.scaleno,
    biasCbulk: NaN, biasCcell: NaN, wordBulk: '', wordCell: '',
  };
  // FORM-MOVES readout for calcite tenants.
  if (a.calcite && typeof wulffCalciteOmegaBias === 'function') {
    row.biasCbulk = wulffCalciteOmegaBias(bulkBar, a.scaleno);
    row.biasCcell = wulffCalciteOmegaBias(cellBar, a.scaleno);
  }
  if (a.calcite && typeof calciteMorphForm === 'function') {
    // C0 word gate: form under the two Ω views. Mg/T held at their fleet
    // defaults so we isolate the Ω branch (subaqueous=true so the gate is live).
    try {
      row.wordBulk = calciteMorphForm(0, 100, bulkBar, true);
      row.wordCell = calciteMorphForm(0, 100, cellBar, true);
    } catch { /* leave blank */ }
  }
  rows.push(row);
}

// ---- Report -----------------------------------------------------------------
const q = (arr, p) => {
  if (!arr.length) return NaN;
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.round(p * (a.length - 1)))];
};
const fmtQ = (arr) => arr.length
  ? `n=${String(arr.length).padStart(4)}  min=${q(arr, 0).toFixed(3)} q25=${q(arr, 0.25).toFixed(3)} med=${q(arr, 0.5).toFixed(3)} q75=${q(arr, 0.75).toFixed(3)} max=${q(arr, 1).toFixed(3)}`
  : 'n=0';

if (CSV) {
  console.log('scen,id,mineral,env,cellBar,bulkBar,ratio,meanDrawdown,maxDrawdown,calcite,scaleno,biasCbulk,biasCcell,wordBulk,wordCell');
  for (const r of rows) {
    console.log([
      r.scen, r.id, r.mineral, r.env,
      r.cellBar.toFixed(4), r.bulkBar.toFixed(4), (Number.isFinite(r.ratio) ? r.ratio.toFixed(4) : ''),
      r.meanDrawdown.toFixed(4), r.maxDrawdown.toFixed(4), r.calcite, r.scaleno,
      (Number.isFinite(r.biasCbulk) ? r.biasCbulk.toFixed(4) : ''),
      (Number.isFinite(r.biasCcell) ? r.biasCcell.toFixed(4) : ''),
      r.wordBulk, r.wordCell,
    ].join(','));
  }
  process.exit(0);
}

console.log(`\nC1 EV probe — local (cell) vs bulk σ across the fleet (seed ${SEED}).`);
console.log('Growth-weighted per crystal. RATE already reads cell σ; this measures what FORM would gain by reading it too.\n');

// ---- Readout 1: SOLUTE BOOKS (the divergence) ----
const fluidRows = rows.filter((r) => r.env !== 'air' && Number.isFinite(r.ratio) && r.bulkBar > 0.01);
const airRows = rows.filter((r) => r.env === 'air' && Number.isFinite(r.ratio) && r.bulkBar > 0.01);
console.log('READOUT 1 — SOLUTE BOOKS: cellσ̄/bulkσ̄ ratio (1.0 = no local depletion; <1 = crystal sits below cavity average)');
console.log(`  fluid-grown : ${fmtQ(fluidRows.map((r) => r.ratio))}`);
console.log(`  air-grown   : ${fmtQ(airRows.map((r) => r.ratio))}`);
console.log('  mean per-step drawdown (fluid, growth-weighted 1−cellσ/bulkσ):');
console.log(`              : ${fmtQ(fluidRows.map((r) => r.meanDrawdown))}`);
console.log('  MAX per-step drawdown (fluid — persistence upper bound):');
console.log(`              : ${fmtQ(fluidRows.map((r) => r.maxDrawdown))}`);
// how many crystals see a materially different local view?
const material = fluidRows.filter((r) => Math.abs(1 - r.ratio) >= 0.10);
console.log(`  crystals whose local σ differs ≥10% from bulk: ${material.length}/${fluidRows.length} fluid-grown`);

// per-mineral divergence (which tenants would move most)
console.log('\n  by mineral (fluid-grown, median ratio + n):');
const byMin = new Map();
for (const r of fluidRows) {
  if (!byMin.has(r.mineral)) byMin.set(r.mineral, []);
  byMin.get(r.mineral).push(r.ratio);
}
const minRows = [...byMin.entries()].sort((a, b) => q(a[1], 0.5) - q(b[1], 0.5));
for (const [m, arr] of minRows) {
  console.log(`    ${m.padEnd(16)} n=${String(arr.length).padStart(4)}  med ratio=${q(arr, 0.5).toFixed(3)}  q25=${q(arr, 0.25).toFixed(3)}`);
}

// ---- Readout 1b: DIRECTIONAL (O1a's real driver) ----
const dirRows = rows.filter((r) => r.env !== 'air' && Number.isFinite(r.dirRatio));
console.log('\nREADOUT 1b — DIRECTIONAL: σ(base d=0)/σ(tip d=max) per crystal — O1a\'s exposure driver as real chemistry');
console.log('  (1.0 = flat radial field, kExp=0.18 constant is fiction; <1 = base starved vs tip, real per-crystal exposure signal)');
console.log(`  fluid-grown : ${fmtQ(dirRows.map((r) => r.dirRatio))}`);
const dirMaterial = dirRows.filter((r) => Math.abs(1 - r.dirRatio) >= 0.10);
console.log(`  crystals with base/tip σ differing ≥10%: ${dirMaterial.length}/${dirRows.length} fluid-grown`);

// ---- Readout 2: FORM MOVES (calcite band crossings) ----
const cal = rows.filter((r) => r.calcite);
console.log(`\nREADOUT 2 — FORM MOVES: calcite tenants (wulff_calcite), n=${cal.length}`);
if (cal.length) {
  console.log('  scenario                       id   bulkΩ̄   cellΩ̄  biasC(bulk) biasC(cell)  Δ    word(bulk)→word(cell)');
  console.log('  ------------------------------ --- ------- ------- ----------- ----------- ----- ----------------------');
  let biasMoves = 0, wordFlips = 0;
  for (const r of cal) {
    const d = (Number.isFinite(r.biasCcell) && Number.isFinite(r.biasCbulk)) ? r.biasCcell - r.biasCbulk : NaN;
    if (Number.isFinite(d) && Math.abs(d) >= 0.01) biasMoves++;
    const flip = r.wordBulk && r.wordCell && r.wordBulk !== r.wordCell;
    if (flip) wordFlips++;
    console.log(
      `  ${r.scen.padEnd(30)} ${String(r.id).padStart(3)} ${r.bulkBar.toFixed(2).padStart(7)} ${r.cellBar.toFixed(2).padStart(7)} ` +
      `${(Number.isFinite(r.biasCbulk) ? r.biasCbulk.toFixed(3) : '  n/a').padStart(11)} ${(Number.isFinite(r.biasCcell) ? r.biasCcell.toFixed(3) : '  n/a').padStart(11)} ` +
      `${(Number.isFinite(d) ? d.toFixed(3) : '  n/a').padStart(5)} ${(r.wordBulk || '-')}${flip ? ' → ' + r.wordCell + '  ⚑FLIP' : ''}`);
  }
  console.log(`\n  biasC moves ≥0.01: ${biasMoves}/${cal.length}   |   C0 word flips (bulk→cell Ω): ${wordFlips}/${cal.length}`);
} else {
  console.log('  (no calcite Wulff tenants grew in the sampled scenarios)');
}

console.log('\nEV SUMMARY');
console.log(`  fleet growing-crystal sample : ${rows.length} crystals across ${scenNames.length} scenarios`);
console.log(`  fluid-grown with real bulk σ : ${fluidRows.length}`);
console.log(`  local view differs ≥10%      : ${material.length}  (${(100 * material.length / Math.max(1, fluidRows.length)).toFixed(0)}%)`);
console.log('  → signal present if the ratio spread is wide and material% is high; a no-op (defer like O1b) if ratios cluster at 1.0.');
