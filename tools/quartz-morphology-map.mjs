#!/usr/bin/env node
/**
 * tools/quartz-morphology-map.mjs — CALIBRATION BENCH for a candidate
 * MORPH_TH.quartz registry entry (quartz arc §4.2, RESEARCH-quartz-
 * morphology-2026-06-12.md). The transparent bench, like
 * tools/calcite-morphology-map.mjs: it applies CANDIDATE band edges +
 * boundary-layer damping to every quartz zone across the fleet and
 * reports the thickness-weighted regime mix per scenario, WITHOUT
 * touching the engine. Used to answer: can any σ+damping config place an
 * HONEST fenster (hopper_skeletal) band — one that fires on genuine
 * rapid/gel quartz while leaving SLOW euhedral pegmatite quartz smooth?
 *
 * Basis: post-step σ per zone (the 18th-catch classifier basis) + the
 * crystal size BEFORE the zone (the damping argument's input), exactly
 * as classifyMorphologyStep + morphSurfaceSigma compute them. Mirrors
 * morphRegime's Sunagawa-ordered cut.
 *
 * Usage:
 *   node tools/quartz-morphology-map.mjs [--seed 42] \
 *     [--half 80] [--cap 2000] [--spiral 2] [--mild 8] [--macro 50] [--hopper 200]
 *   --half/--cap   SIZE_HALF_UM / SIZE_DAMP_CAP_UM (Infinity → pass 0)
 *   the four edges are in quartz's own σ units, applied to SURFACE σ.
 */

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'quartz-morphology-map' });

const a = process.argv.slice(2);
const num = (f, d) => (a.includes(f) ? Number(a[a.indexOf(f) + 1]) : d);
const SEED = num('--seed', 42);
const HALF = (() => { const v = num('--half', 80); return v === 0 ? Infinity : v; })();
const CAP = (() => { const v = num('--cap', 2000); return v === 0 ? Infinity : v; })();
const TH = { SPIRAL: num('--spiral', 2), MILD: num('--mild', 8), MACRO: num('--macro', 50), HOPPER: num('--hopper', 200) };

const REGIMES = ['spiral_smooth', 'stepped_mild', 'stepped_macro', 'hopper_skeletal', 'dendritic'];
const surfSigma = (bulk, size) => 1 + (bulk - 1) / (1 + Math.min(Math.max(0, size), CAP) / HALF);
function regime(s) {
  if (s < TH.SPIRAL) return 'spiral_smooth';
  if (s < TH.MILD) return 'stepped_mild';
  if (s < TH.MACRO) return 'stepped_macro';
  if (s < TH.HOPPER) return 'hopper_skeletal';
  return 'dendritic';
}
const fmt = (x) => (isFinite(x) ? (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)) : '—');
const sigmaOf = (cond) => { const fn = cond.supersaturation_quartz; try { return fn.call(cond); } catch { return NaN; } };

console.log(`\n### QUARTZ MORPH MAP (seed ${SEED})  half=${HALF} cap=${CAP}  edges spiral<${TH.SPIRAL} mild<${TH.MILD} macro<${TH.MACRO} hopper<${TH.HOPPER}`);
console.log('  scenario                    qz  zones   meanSurfσ   regime shares (smooth/mild/macro/HOPPER/dend)   dominant');
console.log('  ' + '-'.repeat(118));

const fleet = {};
for (const scen of Object.keys(SCENARIOS)) {
  setSeed(SEED);
  let conditions, events, defaultSteps;
  try { ({ conditions, events, defaultSteps } = SCENARIOS[scen]()); } catch { continue; }
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 120;
  const postByStep = {};
  for (let s = 0; s < steps; s++) { sim.run_step(); postByStep[sim.step] = sigmaOf(sim.conditions); }

  const crystals = sim.crystals.filter((c) => c && c.mineral === 'quartz' && !c.dissolved && c.total_growth_um > 0);
  if (!crystals.length) continue;
  const share = Object.fromEntries(REGIMES.map((r) => [r, 0]));
  let totMass = 0, surfAcc = 0;
  for (const c of crystals) {
    let sizeAcc = 0;
    for (const z of (c.zones || [])) {
      const t = z.thickness_um || 0;
      if (t <= 0) { continue; }
      const bulk = postByStep[z.step];
      if (isFinite(bulk) && bulk >= 1.0) {
        const surf = surfSigma(bulk, sizeAcc);
        share[regime(surf)] += t;
        surfAcc += surf * t; totMass += t;
      }
      sizeAcc += t;
    }
  }
  if (totMass <= 0) continue;
  const pct = (r) => (100 * share[r] / totMass);
  const dom = REGIMES.reduce((best, r) => (share[r] > share[best] ? r : best), REGIMES[0]);
  const fenster = pct('hopper_skeletal') + pct('dendritic');
  fleet[scen] = { fenster, dom };
  const shares = `${fmt(pct('spiral_smooth')).padStart(5)}/${fmt(pct('stepped_mild')).padStart(5)}/${fmt(pct('stepped_macro')).padStart(5)}/${fmt(pct('hopper_skeletal')).padStart(5)}/${fmt(pct('dendritic')).padStart(5)}`;
  console.log(`  ${scen.padEnd(27)} ${String(crystals.length).padStart(2)} ${String(Math.round(totMass)).padStart(6)}   ${fmt(surfAcc / totMass).padStart(7)}    ${shares}     ${dom}${fenster >= 25 ? '  ⟵FENSTER' : ''}`);
}

console.log(`\n  scenarios reading ≥25% fenster (hopper+dendritic): ${Object.entries(fleet).filter(([, v]) => v.fenster >= 25).map(([s]) => s).join(', ') || '(none)'}`);
console.log();
