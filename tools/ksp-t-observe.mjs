#!/usr/bin/env node
/**
 * tools/ksp-t-observe.mjs — the carbonate Ksp(T) calibration-debt judge
 * (the pK(T) debt's SIBLING, exposed by SIM 192: with the carbonate IAP
 * side made exact by the PB82 pK fix, the Ksp side was still constant-ΔH
 * van't Hoff — ~1.3 log too FLAT at 158°C — and the mixed fidelity
 * flipped the cooling-scenario SI drift sign. This tool is the same
 * instrument pk-t-observe.mjs was, pointed at the lattice term.)
 *
 * Two modes:
 *
 *   --table   Old (constant-ΔH van't Hoff) vs NEW (PHREEQC analytic
 *             expression, wateq4f.dat verbatim) vs the 25°C anchor, on a
 *             temperature grid, per engine-promoted carbonate. The
 *             science pin: the analytic must reproduce the anchor at
 *             25°C and bend hard hot; the old curve's flatness IS the
 *             measured debt. SI shift = logKsp_old − logKsp_new (SI =
 *             logIAP − logKsp, so a more-negative analytic Ksp RAISES SI).
 *
 *   --fleet   DARK-OBSERVE: run every scenario at seed 42 with the LIVE
 *             engine untouched, and per step compute the SI shift the
 *             analytic Ksp would produce for calcite + aragonite +
 *             dolomite, sampled at the mid-ring (T, pH). Summarizes
 *             typical + worst SI shift per scenario AND flags which
 *             scenarios actually GROW each carbonate (the movers), so
 *             the rebake prediction is MEASURED before the engine moves.
 *             dolomite has NO wateq4f analytic → its shift is shown as
 *             0 (van't Hoff retained); it's listed to prove it's inert.
 *
 * Usage:
 *   node tools/ksp-t-observe.mjs --table
 *   node tools/ksp-t-observe.mjs --fleet [--seed 42] [--scenarios a,b]
 */

import { loadSimBundle } from './_harness.mjs';

// ---- the curves -----------------------------------------------------
// analytic: logK(T) = A1 + A2·TK + A3/TK + A4·log10(TK) + A5/TK²
// VERIFIED verbatim against canonical wateq4f.dat (fetched 2026-06-12):
//   'Calcite 12'     -analytical -171.9065 -0.077993 2839.319  71.595   0
//   'Aragonite 21'   -analytical -171.9773 -0.077993 2903.293  71.595   0
//   'Strontianite'   -analytical  155.0305  0       -7239.594 -56.58638 0
//   'Witherite'      -analytical  607.642   0.121098 -20011.25 -236.4948 0
// dolomite / siderite / rhodochrosite / smithsonite / cerussite carry
// NO -analytical line in wateq4f → they stay van't Hoff (honest mixed
// fidelity: analytic where the database has it, van't Hoff where it
// doesn't).
const ANALYTIC = {
  calcite:      [-171.9065, -0.077993, 2839.319, 71.595, 0],
  aragonite:    [-171.9773, -0.077993, 2903.293, 71.595, 0],
  strontianite: [155.0305, 0, -7239.594, -56.58638, 0],
  witherite:    [607.642, 0.121098, -20011.25, -236.4948, 0],
};
// constant-ΔH van't Hoff params (the shipping pre-v194 form).
const VANTHOFF = {
  calcite:      { logK25: -8.48, dH: -10.5 },
  aragonite:    { logK25: -8.336, dH: -10.0 },
  dolomite:     { logK25: -17.09, dH: -28.0 },
  strontianite: { logK25: -9.271, dH: -1.67 },
  witherite:    { logK25: -8.562, dH: 2.94 },
};
const T_CLAMP = [0, 250];
function clampT(T) { return Math.max(T_CLAMP[0], Math.min(T_CLAMP[1], T)); }
function analyticLogK(c, Tc) { const TK = clampT(Tc) + 273.15; return c[0] + c[1] * TK + c[2] / TK + c[3] * Math.log10(TK) + (c[4] || 0) / (TK * TK); }
function vanthoffLogK(p, Tc) { const TK = clampT(Tc) + 273.15; return p.logK25 - (p.dH / (Math.LN10 * 8.31446e-3)) * (1 / TK - 1 / 298.15); }
// logKsp old vs new for a mineral (new = analytic if available, else van't Hoff)
function logKspOld(m, Tc) { return vanthoffLogK(VANTHOFF[m], Tc); }
function logKspNew(m, Tc) { return ANALYTIC[m] ? analyticLogK(ANALYTIC[m], Tc) : vanthoffLogK(VANTHOFF[m], Tc); }

const args = process.argv.slice(2);

if (args.includes('--table')) {
  const grid = [0, 25, 60, 90, 120, 158, 200, 250];
  for (const m of ['calcite', 'aragonite', 'dolomite']) {
    console.log(`\n### ${m} logKsp(T) — van't Hoff (old) vs analytic (new) vs 25°C anchor`);
    if (!ANALYTIC[m]) {
      console.log(`  (no wateq4f -analytical line — STAYS van't Hoff; shown to confirm it's inert)`);
    }
    console.log('   T°C |  logKsp old   logKsp new    Δ(new−old)   SI shift (=old−new)');
    for (const T of grid) {
      const o = logKspOld(m, T), n = logKspNew(m, T);
      console.log(`  ${String(T).padStart(4)} |   ${o.toFixed(3).padStart(8)}    ${n.toFixed(3).padStart(8)}     ${(n - o).toFixed(3).padStart(7)}      ${(o - n >= 0 ? '+' : '') + (o - n).toFixed(3)}`);
    }
    // 25°C anchor reproduction check
    const anchor = VANTHOFF[m].logK25, at25 = logKspNew(m, 25);
    console.log(`  anchor check: logKsp_25C ${anchor}  vs  analytic(25°C) ${at25.toFixed(4)}  (Δ ${(at25 - anchor).toFixed(4)})`);
  }
  console.log('\n  SI = logIAP − logKsp, so a MORE-NEGATIVE analytic Ksp at hot T RAISES SI (more supersaturated).');
  console.log('  The retrograde steepening is the fix: vant Hoff was ~1.3 log too flat at 158C for calcite.');
  process.exit(0);
}

// ---- fleet dark-observe ----
const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({ toolName: 'ksp-t-observe' });

const SEED = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : 42;
const only = args.includes('--scenarios') ? args[args.indexOf('--scenarios') + 1].split(',') : null;

console.log(`\n### Ksp(T) DARK-OBSERVE — fleet sweep, seed ${SEED} (live engine untouched; shadow = analytic Ksp)`);
console.log('  SI shift = logKsp_old − logKsp_new, sampled at mid-ring (T,pH) each step. + = SI rises (more supersat).');
console.log('  GROWS column: which of the engine-promoted carbonates actually grow crystals (the real movers).\n');
console.log('  scenario                    T range      | calcite SI   | aragonite SI | dolomite SI | grows');
console.log('                                           | typ    worst | typ    worst | (van’tHoff) |');
const names = Object.keys(SCENARIOS).filter((n) => !only || only.includes(n));
for (const name of names.sort()) {
  try {
    setSeed(SEED);
    const { conditions, events, defaultSteps } = SCENARIOS[name]();
    const sim = new VugSimulator(conditions, events);
    const n = defaultSteps ?? 120;
    let tMin = Infinity, tMax = -Infinity;
    const sh = { calcite: [], aragonite: [], dolomite: [] };
    for (let s = 0; s < n; s++) {
      sim.run_step();
      const ringIdx = Math.floor((sim.ring_temperatures ? sim.ring_temperatures.length : 16) / 2);
      const T = sim.ring_temperatures ? sim.ring_temperatures[ringIdx] : sim.conditions.temperature;
      tMin = Math.min(tMin, T); tMax = Math.max(tMax, T);
      for (const m of ['calcite', 'aragonite', 'dolomite']) {
        sh[m].push(logKspOld(m, T) - logKspNew(m, T)); // SI shift
      }
    }
    const grows = ['calcite', 'aragonite', 'dolomite', 'HMC', 'siderite'].filter((m) =>
      sim.crystals.some((c) => c.mineral === m && !c.dissolved && c.total_growth_um > 0));
    const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
    const worst = (a) => a.reduce((m, x) => Math.abs(x) > Math.abs(m) ? x : m, 0);
    const fmt = (v) => (v >= 0 ? '+' : '') + v.toFixed(2);
    console.log(`  ${name.padEnd(27)} ${String(Math.round(tMin)).padStart(4)}–${String(Math.round(tMax)).padEnd(4)}°C  | ${fmt(med(sh.calcite)).padStart(5)}  ${fmt(worst(sh.calcite)).padStart(5)} | ${fmt(med(sh.aragonite)).padStart(5)}  ${fmt(worst(sh.aragonite)).padStart(5)} | ${fmt(med(sh.dolomite)).padStart(5)}       | ${grows.join(',') || '—'}`);
  } catch (e) {
    console.log(`  ${name.padEnd(27)} ERROR ${e.message}`);
  }
}
console.log('\n  Only scenarios in the GROWS column move seed-42 carbonate output; the rest shift only the SI display/strip chips.');
console.log('  dolomite SI shift is 0 everywhere (no wateq4f analytic — retains van’t Hoff, inert this arc).');
