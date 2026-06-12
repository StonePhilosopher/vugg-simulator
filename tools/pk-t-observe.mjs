#!/usr/bin/env node
/**
 * tools/pk-t-observe.mjs — the carbonate pK(T) calibration-debt judge
 * (review §2.2, 2026-06-09: "pK(T) slopes in js/20b are ~5–10× too
 * flat ... the '<0.05 pK up to 60°C' comment is wrong by ~4×").
 *
 * Two modes:
 *
 *   --table   Old (shipping linear fits) vs NEW (Plummer & Busenberg
 *             1982 analytic expressions, the same coefficients PHREEQC
 *             ships for CO2/HCO3/CO3) vs the PB82 literature anchors,
 *             on a temperature grid. This is the science pin: the new
 *             curve must hit the lit values; the old curve's drift IS
 *             the measured debt.
 *
 *   --fleet   DARK-OBSERVE (the t-story-observe pattern): run every
 *             scenario at seed 42 with the LIVE engine untouched, and
 *             per step compute the SHADOW values the corrected pK
 *             would produce — effectiveCO3 ratio shift (the σ-gate
 *             lever), carbonateIonPpm shift (the Ksp/SI lever), the
 *             H2CO3 fraction shift (the PWP kinetics lever), and
 *             equilibrium pCO2 shift (the degassing lever). Summarizes
 *             worst-case + thickness-weighted-typical shift per
 *             scenario, so the rebake prediction is MEASURED before
 *             the engine moves.
 *
 * Usage:
 *   node tools/pk-t-observe.mjs --table
 *   node tools/pk-t-observe.mjs --fleet [--seed 42] [--scenarios a,b]
 */

import { loadSimBundle } from './_harness.mjs';

// ---- the corrected curves (PB82 / PHREEQC analytic expressions) ----
// log K = A1 + A2·T + A3/T + A4·log10(T) + A5/T²   (T in Kelvin)
// Coefficients: Plummer & Busenberg 1982 (GCA 46), as shipped in
// PHREEQC phreeqc.dat / wateq4f.dat for the reactions
//   CO2(g) = CO2(aq)        (Henry: log K = −pKH)
//   CO2(aq) + H2O = H+ + HCO3−   (log K1)
//   HCO3− = H+ + CO3−2           (log K2)
// VERIFIED against canonical wateq4f.dat (usgs-coupled/phreeqc3 master,
// fetched 2026-06-12): K1/K2 are the exact negations of the association
// entries ('HCO3- + H+ = H2CO3' 356.3094/0.06091960/−21834.37/
// −126.8339/1684915; 'H+ + CO3-2 = HCO3-' 107.8871/0.03252849/−5151.79/
// −38.92561/563713.9); KH is the CO2(g) phase entry verbatim. The
// internal consistency check holds: logK1+logK2 at 25°C = −16.680 vs
// the database's combined 'CO3-2 + 2H+ = CO2 + H2O' 16.681.
const PB82 = {
  K1: [-356.3094, -0.06091960, 21834.37, 126.8339, -1684915],
  K2: [-107.8871, -0.03252849, 5151.79, 38.92561, -563713.9],
  KH: [108.3865, 0.01985076, -6919.53, -40.45154, 669365],
};

function pb82LogK(c, T_celsius) {
  const TK = T_celsius + 273.15;
  return c[0] + c[1] * TK + c[2] / TK + c[3] * Math.log10(TK) + c[4] / (TK * TK);
}
export function pK1New(T) { return -pb82LogK(PB82.K1, T); }
export function pK2New(T) { return -pb82LogK(PB82.K2, T); }
export function pKHNew(T) { return -pb82LogK(PB82.KH, T); }

// ---- the shipping linear fits (mirror of js/20b, pre-fix) ----
function clamp80(T) { return Math.max(0, Math.min(80, T)); }
function pK1Old(T) { return 6.352 - 0.0007 * (clamp80(T) - 25); }
function pK2Old(T) { return 10.329 - 0.0029 * (clamp80(T) - 25); }
function pKHOld(T) { return 1.464 + 0.005 * (clamp80(T) - 25); }

// PB82 literature anchors (their Table 1 smoothed values).
const LIT = [
  // T°C,  pK1,   pK2,   pKH
  [0, 6.58, 10.63, 1.11],
  [5, 6.52, 10.55, 1.19],
  [15, 6.42, 10.43, 1.34],
  [25, 6.35, 10.33, 1.47],
  [45, 6.29, 10.20, 1.67],
  [60, 6.29, 10.14, 1.78],
  [90, 6.32, 10.08, 1.94],
];

const args = process.argv.slice(2);

if (args.includes('--table')) {
  console.log('\n### pK(T) — shipping linear fit vs PB82 analytic vs PB82 literature');
  console.log('   T°C |  pK1 old   new   lit  |  pK2 old    new    lit  |  pKH old   new   lit');
  for (const [T, l1, l2, lh] of LIT) {
    console.log(
      `  ${String(T).padStart(4)} |  ${pK1Old(T).toFixed(2)}   ${pK1New(T).toFixed(2)}  ${l1.toFixed(2)}  |` +
      `  ${pK2Old(T).toFixed(2)}   ${pK2New(T).toFixed(2)}  ${l2.toFixed(2)}  |` +
      `  ${pKHOld(T).toFixed(2)}  ${pKHNew(T).toFixed(2)}  ${lh.toFixed(2)}`);
  }
  // hot extrapolation view (above the old clamp)
  console.log('\n  hot range (old clamps at 80°C; PB82 analytic valid to ~250°C):');
  for (const T of [100, 150, 200, 250]) {
    console.log(`  ${String(T).padStart(4)} |  ${pK1Old(T).toFixed(2)}   ${pK1New(T).toFixed(2)}        |  ${pK2Old(T).toFixed(2)}   ${pK2New(T).toFixed(2)}         |  ${pKHOld(T).toFixed(2)}  ${pKHNew(T).toFixed(2)}`);
  }
  // max |err| vs lit for both
  let mo = 0, mn = 0;
  for (const [T, l1, l2, lh] of LIT) {
    mo = Math.max(mo, Math.abs(pK1Old(T) - l1), Math.abs(pK2Old(T) - l2), Math.abs(pKHOld(T) - lh));
    mn = Math.max(mn, Math.abs(pK1New(T) - l1), Math.abs(pK2New(T) - l2), Math.abs(pKHNew(T) - lh));
  }
  console.log(`\n  max |error| vs PB82 lit anchors: OLD ${mo.toFixed(3)} pK units, NEW ${mn.toFixed(3)} pK units`);
  process.exit(0);
}

// ---- fleet dark-observe ----
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'pk-t-observe' });

const SEED = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : 42;
const only = args.includes('--scenarios')
  ? args[args.indexOf('--scenarios') + 1].split(',') : null;

// shadow Bjerrum with the NEW constants
function fractionsNew(pH, T) {
  const H = Math.pow(10, -pH);
  const K1 = Math.pow(10, -pK1New(T));
  const K2 = Math.pow(10, -pK2New(T));
  const f0 = H * H, f1 = H * K1, f2 = K1 * K2;
  const tot = f0 + f1 + f2;
  return { H2CO3: f0 / tot, HCO3: f1 / tot, CO3: f2 / tot };
}
function fractionsOld(pH, T) {
  const H = Math.pow(10, -pH);
  const K1 = Math.pow(10, -pK1Old(T));
  const K2 = Math.pow(10, -pK2Old(T));
  const f0 = H * H, f1 = H * K1, f2 = K1 * K2;
  const tot = f0 + f1 + f2;
  return { H2CO3: f0 / tot, HCO3: f1 / tot, CO3: f2 / tot };
}
const REF_PH = 7.5, DAMP = 0.5;
function effRatio(fr, pH, T) {
  const a = fr(pH, T).CO3, r = fr(REF_PH, T).CO3;
  if (r <= 0) return 1;
  return 1 + DAMP * (a / r - 1);
}

console.log(`\n### pK(T) DARK-OBSERVE — fleet sweep, seed ${SEED} (live engine untouched; shadow = PB82)`);
console.log('  scenario                    T range      | eff-CO3 shift    | CO3²⁻ ppm shift  | H2CO3 frac shift | pCO2 shift');
console.log('                                           | typ      worst   | typ      worst   | typ      worst   | typ');
const names = Object.keys(SCENARIOS).filter((n) => !only || only.includes(n));
for (const name of names.sort()) {
  let sim;
  try {
    setSeed(SEED);
    const { conditions, events, defaultSteps } = SCENARIOS[name]();
    sim = new VugSimulator(conditions, events);
    const n = defaultSteps ?? 120;
    let tMin = Infinity, tMax = -Infinity;
    const effShifts = [], co3Shifts = [], h2co3Shifts = [], pco2Shifts = [];
    for (let s = 0; s < n; s++) {
      sim.run_step();
      const T = sim.conditions.temperature;
      const pH = sim.conditions.fluid.pH;
      tMin = Math.min(tMin, T); tMax = Math.max(tMax, T);
      const eo = effRatio(fractionsOld, pH, T), en = effRatio(fractionsNew, pH, T);
      effShifts.push(en / Math.max(1e-9, eo));
      const co = fractionsOld(pH, T).CO3, cn = fractionsNew(pH, T).CO3;
      co3Shifts.push(cn / Math.max(1e-12, co));
      const ho = fractionsOld(pH, T).H2CO3, hn = fractionsNew(pH, T).H2CO3;
      h2co3Shifts.push(hn / Math.max(1e-12, ho));
      // pCO2 ∝ f.H2CO3 / KH → shift = (hn/ho) · 10^(pKHnew−pKHold)
      pco2Shifts.push((hn / Math.max(1e-12, ho)) * Math.pow(10, pKHNew(T) - pKHOld(T)));
    }
    const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
    const worst = (a) => a.reduce((m, x) => Math.abs(Math.log(x)) > Math.abs(Math.log(m)) ? x : m, 1);
    console.log(`  ${name.padEnd(27)} ${String(Math.round(tMin)).padStart(4)}–${String(Math.round(tMax)).padEnd(4)}°C  | ×${med(effShifts).toFixed(2)}    ×${worst(effShifts).toFixed(2)}    | ×${med(co3Shifts).toFixed(2)}    ×${worst(co3Shifts).toFixed(2)}    | ×${med(h2co3Shifts).toFixed(2)}    ×${worst(h2co3Shifts).toFixed(2)}    | ×${med(pco2Shifts).toFixed(2)}`);
  } catch (e) {
    console.log(`  ${name.padEnd(27)} ERROR ${e.message}`);
  }
}
console.log('\n  eff-CO3 = the damped σ-gate lever (all 13 carbonate gates); CO3²⁻ = the undamped Ksp/SI lever');
console.log('  (calcite SI is engine-promoted since v144); H2CO3 = the PWP kinetics lever; pCO2 = degassing.');
