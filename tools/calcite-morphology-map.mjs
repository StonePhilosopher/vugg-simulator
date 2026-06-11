#!/usr/bin/env node
/**
 * tools/calcite-morphology-map.mjs — CALCITE MORPHOLOGY classifier + fleet map
 * (commits nothing, touches no engine code — the classifier lives HERE for now
 * so it can be tuned transparently before it's wired into grow_calcite).
 *
 * Implements the candidate morphology classifier from
 * proposals/RESEARCH-calcite-morphology-2026-06-11.md, with thresholds set in
 * SIM units from tools/calcite-sigma-observe.mjs (the σ distribution is omega-
 * like, 1.05–664, NOT the paper's reduced σ — §5 of the research). Then runs
 * every scenario PER ZONE (each growth layer carries its own σ → its own
 * regime, so a single crystal can be zoned smooth-core / stepped-rim) and
 * reports the emergent morphology map across the fleet.
 *
 * The point: show that the FULL spectrum emerges from the data — smooth spar at
 * low σ, macrostepped at moderate σ, dendrite/hopper at extreme σ — and let the
 * band assignments be checked against what these localities actually look like
 * before any of it is wired in or made visible.
 *
 * Usage:  node tools/calcite-morphology-map.mjs [--seed 42] [--engine]
 *
 * --engine (Phase 0, 2026-06-11): classify from the ENGINE's own per-zone
 * tags (zone.morph_regime, written dark by grow_calcite) instead of this
 * tool's independent recompute, and report the per-zone agreement between
 * the two. They are NOT expected to match 100%: the engine classifies from
 * the IN-STEP σ (before that step's growth depletes the fluid), the tool
 * from the POST-STEP sample. Disagreements cluster at band boundaries.
 * The engine tag is the truth going forward; the recompute is the bench.
 */

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'calcite-morphology-map' });

const args = process.argv.slice(2);
const SEED = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : 42;
const ENGINE = args.includes('--engine');

// ---------------------------------------------------------------------------
// CANDIDATE CLASSIFIER — thresholds in SIM units, from calcite-sigma-observe.
// All five regimes from the research morphology diagram (§3). PROVISIONAL:
// these are the numbers to validate against locality ground-truth.
// ---------------------------------------------------------------------------
const TH = {
  // boundary-layer size damping (Wolthers 2022 §1): big crystals hold a low
  // SURFACE σ even at high bulk σ → stay spiral. surfσ = 1 + (bulkσ−1)/(1+size/HALF)
  SIZE_HALF_UM: 80,
  // Phase 5: δ is BOUNDED at the hydrodynamic scale — damping saturates
  // for crystals above 2 mm (the Elmwood-giant fix; Wolthers's own model
  // uses a fixed boundary-layer thickness). KEEP IN SYNC with js/52.
  SIZE_DAMP_CAP_UM: 2000,
  // regime cutoffs on SURFACE σ (sim units), in SUNAGAWA order:
  // polyhedral → hopper/skeletal → dendritic (peer-review correction
  // 2026-06-11 — hopper is the ONSET of instability, dendrite is it taken
  // further; hopper must sit BELOW dendrite, never above).
  SPIRAL_MAX: 2.0,      // < this → smooth spiral spar (polyhedral, lateral growth)
  STEP_MILD_MAX: 8.0,   // 2–8 → gentle macrosteps (onset 2D nucleation)
  STEP_MACRO_MAX: 50.0, // 8–50 → pronounced macrostepped (step bunching)
  HOPPER_MAX: 200.0,    // 50–200 → hopper / skeletal (faces hollow, still faceted)
  // > HOPPER_MAX → dendritic (the instability branches)
  // impurity / T form axis
  MG_SCALENO: 0.15,     // Mg:Ca above this → scalenohedral elongation (GCA 2015 ~0.2)
  // Phase 4 (SIM 187): Mg step-edge pinning sharpens bunching —
  // effective σ × (1 + MG_BUNCH·min(Mg:Ca,1)) before the regime cut.
  // KEEP IN SYNC with CALCITE_MORPH_TH in js/52-engines-carbonate.ts.
  MG_BUNCH: 0.4,
};

function surfaceSigma(bulkSigma, sizeUm) {
  const effSize = Math.min(Math.max(0, sizeUm), TH.SIZE_DAMP_CAP_UM);
  return 1 + (bulkSigma - 1) / (1 + effSize / TH.SIZE_HALF_UM);
}

function regimeOf(surfSigma) {
  if (surfSigma < TH.SPIRAL_MAX) return 'spiral_smooth';
  if (surfSigma < TH.STEP_MILD_MAX) return 'stepped_mild';
  if (surfSigma < TH.STEP_MACRO_MAX) return 'stepped_macro';
  if (surfSigma < TH.HOPPER_MAX) return 'hopper_skeletal';
  return 'dendritic';
}

function formOf(mgRatio, temperature) {
  if (mgRatio > TH.MG_SCALENO || temperature > 200) return 'scalenohedral';
  return 'rhombohedral';
}

const REGIMES = ['spiral_smooth', 'stepped_mild', 'stepped_macro', 'hopper_skeletal', 'dendritic'];

// ---------------------------------------------------------------------------
// Run the fleet. For each calcite crystal we walk its zones, classify each
// zone's morphology from (zone growth σ proxy, crystal size at that zone), and
// summarize the crystal by its DOMINANT (most-grown) regime + whether it's
// zoned. We reconstruct per-zone σ from the recorded growth_rate where the
// engine stored it; where not available we fall back to bulk σ sampling.
// ---------------------------------------------------------------------------
const fleet = {};

for (const scen of Object.keys(SCENARIOS)) {
  setSeed(SEED);
  let conditions, events, defaultSteps;
  try { ({ conditions, events, defaultSteps } = SCENARIOS[scen]()); } catch (e) { continue; }
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 120;

  // sample bulk σ + Mg:Ca + size each step so we can attribute a σ to
  // each zone by step (post-step basis — the calibrated one, 18th catch)
  const sigmaByStep = {};
  const mgByStep = {};
  for (let s = 0; s < steps; s++) {
    sim.run_step();
    let sg; try { sg = sim.conditions.supersaturation_calcite(); } catch (e) { sg = NaN; }
    sigmaByStep[sim.step] = sg;
    mgByStep[sim.step] = (sim.conditions.fluid.Mg || 0) / Math.max(1e-6, sim.conditions.fluid.Ca || 0);
  }
  const calcites = sim.crystals.filter((c) => c.mineral === 'calcite' && !c.dissolved && c.total_growth_um > 0);
  if (!calcites.length) continue;

  const mgRatio = (sim.conditions.fluid.Mg || 0) / Math.max(1e-6, sim.conditions.fluid.Ca || 0);
  const temperature = sim.conditions.temperature;

  // regime mass (µm grown in each regime) summed over all calcite crystals
  const mass = Object.fromEntries(REGIMES.map((r) => [r, 0]));
  let zonedCount = 0;
  let agreeZones = 0, compareZones = 0;
  for (const c of calcites) {
    let sizeAcc = 0;
    const seen = new Set();
    for (const z of (c.zones || [])) {
      const t = z.thickness_um || 0;
      if (t <= 0) { sizeAcc += 0; continue; }
      const bulk = isFinite(sigmaByStep[z.step]) ? sigmaByStep[z.step] : NaN;
      if (!isFinite(bulk) || bulk < 1.0) { sizeAcc += t; continue; }
      // Phase 4 (SIM 187): Mg bunching term, mirroring the engine.
      const mgBunch = 1 + TH.MG_BUNCH * Math.min(mgByStep[z.step] || 0, 1);
      const ss = surfaceSigma(bulk, sizeAcc) * mgBunch;
      const recomputed = regimeOf(ss);
      // --engine: trust the engine's dark tag; track agreement vs recompute.
      const engineTag = (typeof z.morph_regime === 'string') ? z.morph_regime : null;
      if (engineTag) {
        compareZones++;
        if (engineTag === recomputed) agreeZones++;
      }
      const r = (ENGINE && engineTag) ? engineTag : recomputed;
      mass[r] += t;
      seen.add(r);
      sizeAcc += t;
    }
    if (seen.size > 1) zonedCount++;
  }
  const totalMass = Object.values(mass).reduce((s, x) => s + x, 0);
  if (totalMass <= 0) continue;
  const dominant = REGIMES.reduce((a, b) => (mass[b] > mass[a] ? b : a));
  fleet[scen] = {
    crystals: calcites.length, zoned: zonedCount, mgRatio, temperature,
    form: formOf(mgRatio, temperature),
    dominant, mass, totalMass,
    agreeZones, compareZones,
  };
}

const SHORT = {
  spiral_smooth: 'smooth-spar', stepped_mild: 'stepped(mild)', stepped_macro: 'STEPPED',
  hopper_skeletal: 'hopper/skel', dendritic: 'dendritic',
};

console.log(`\n### CALCITE MORPHOLOGY MAP — emergent regime per scenario (seed ${SEED})`);
console.log('### thresholds (sim-unit surface σ, Sunagawa order): spar<2 | mild<8 | STEPPED<50 | hopper<200 | dendrite≥200\n');
console.log('  scenario                    cryst  zoned  form          dominant        regime mix (µm %)');
console.log('  ----------------------------------------------------------------------------------------------');
const order = Object.keys(fleet).sort((a, b) => REGIMES.indexOf(fleet[a].dominant) - REGIMES.indexOf(fleet[b].dominant));
for (const scen of order) {
  const f = fleet[scen];
  const mix = REGIMES.filter((r) => f.mass[r] > 0)
    .map((r) => `${SHORT[r]} ${Math.round(100 * f.mass[r] / f.totalMass)}%`).join(', ');
  console.log(`  ${scen.padEnd(27)} ${String(f.crystals).padStart(4)}  ${String(f.zoned).padStart(4)}   ${f.form.padEnd(13)} ${SHORT[f.dominant].padEnd(14)}  ${mix}`);
}

console.log('\n### fleet tally by dominant regime');
const tally = Object.fromEntries(REGIMES.map((r) => [r, 0]));
for (const f of Object.values(fleet)) tally[f.dominant]++;
for (const r of REGIMES) console.log(`  ${SHORT[r].padEnd(14)} ${tally[r]} scenarios`);

// Engine-tag agreement (meaningful once grow_calcite writes dark tags;
// before that compareZones is 0 everywhere and this section is silent).
const totCompare = Object.values(fleet).reduce((s, f) => s + f.compareZones, 0);
if (totCompare > 0) {
  const totAgree = Object.values(fleet).reduce((s, f) => s + f.agreeZones, 0);
  console.log(`\n### engine-tag agreement vs tool recompute${ENGINE ? ' (map above used ENGINE tags)' : ''}`);
  console.log(`  ${totAgree}/${totCompare} zones agree (${(100 * totAgree / totCompare).toFixed(1)}%) — disagreements are in-step vs post-step σ sampling at band boundaries`);
  for (const scen of order) {
    const f = fleet[scen];
    if (!f.compareZones) continue;
    const pct = (100 * f.agreeZones / f.compareZones).toFixed(0);
    if (f.agreeZones !== f.compareZones) console.log(`    ${scen.padEnd(27)} ${f.agreeZones}/${f.compareZones} (${pct}%)`);
  }
}
console.log('');
