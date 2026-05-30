// tools/w8_diagnostic_sabkha.mjs — Week 8 follow-up: print the actual
// _dol_cycle_count trajectory for sabkha_dolomitization.
//
// Why: the Week 8 commit shipped with a SOFTER assertion than the
// proposal asked for. Proposal critical pass: f_ord > 0.7 by cycle 9
// (= _dol_cycle_count ≥ 9 by step 180). Shipped assertion:
// cycle_count > 0 AND ≤ 20. The soft assertion hides whether the Kim
// mechanism is firing AT STRENGTH (12 cycles, perfect tracking) or AT
// 20% (2-3 cycles, threshold detection misses most flood/evap pairs).
//
// This script prints per-step _dol_cycle_count + f_ord + SI_dolomite
// + DIC + pH for sabkha so we can see the actual mechanism behavior.
//
// Acceptance criteria for Week 9 promotion: if cycle_count tops out
// below ~5, the per-cycle threshold detection is the soft point in
// Kim's wiring (proposal flags `_omega_history per ring` as the
// structural fix); fix that before calcite promotion would be ideal
// but is decoupled (calcite promotion doesn't touch the Kim path).
//
// Usage: node tools/w8_diagnostic_sabkha.mjs

import { loadSimBundle } from './_harness.mjs';

const {
  SCENARIOS, VugSimulator, setSeed,
  carbonateSaturationIndex, equilibriumPCO2,
} = await loadSimBundle({
  toolName: 'w8_diagnostic_sabkha',
  extraExports: ['carbonateSaturationIndex', 'equilibriumPCO2'],
});

const scn = SCENARIOS && SCENARIOS.sabkha_dolomitization;
if (!scn) {
  console.error('sabkha_dolomitization scenario not loaded');
  process.exit(1);
}

setSeed(42);
const { conditions, events, defaultSteps } = scn();
const sim = new VugSimulator(conditions, events);
const total = defaultSteps ?? 260;

const rows = [];
for (let i = 0; i < total; i++) {
  sim.run_step();
  const ringIdx = Math.floor((sim.ring_fluids ? sim.ring_fluids.length : 16) / 2);
  const f = sim.ring_fluids ? sim.ring_fluids[ringIdx] : conditions.fluid;
  const T = sim.ring_temperatures ? sim.ring_temperatures[ringIdx] : conditions.temperature;
  const n = conditions._dol_cycle_count || 0;
  rows.push({
    step: sim.step,
    n_cycles: n,
    f_ord: 1 - Math.exp(-n / 7),
    SI_dol: carbonateSaturationIndex('dolomite', f, T),
    SI_cal: carbonateSaturationIndex('calcite', f, T),
    Mg: f.Mg,
    Ca: f.Ca,
    pH: f.pH,
    CO3: f.CO3,
    pCO2: equilibriumPCO2(f, T),
    T,
  });
}

// Header
console.log('Sabkha _dol_cycle_count trajectory — seed 42, v143 baseline');
console.log('');
console.log('Scheduled flood/evap pairs: 12 (steps 10/20, 30/40, ..., 230/240)');
console.log('Kim N0 = 7; proposal critical pass: f_ord > 0.7 by cycle 9');
console.log('');
console.log('step | n  | f_ord | SI_dol | SI_cal | Mg     | Ca     | pH    | pCO2     | T(C)');
console.log('-----+----+-------+--------+--------+--------+--------+-------+----------+-----');

// Sample every 10 steps + every step where n changes
let lastN = -1;
for (const r of rows) {
  const change = r.n_cycles !== lastN;
  const periodic = r.step % 10 === 0;
  if (change || periodic) {
    console.log(
      String(r.step).padStart(4) + ' | ' +
      String(r.n_cycles).padStart(2) + ' | ' +
      (isFinite(r.f_ord) ? r.f_ord.toFixed(3) : 'NaN').padStart(5) + ' | ' +
      (isFinite(r.SI_dol) ? r.SI_dol.toFixed(2) : 'NaN').padStart(6) + ' | ' +
      (isFinite(r.SI_cal) ? r.SI_cal.toFixed(2) : 'NaN').padStart(6) + ' | ' +
      (isFinite(r.Mg) ? r.Mg.toFixed(1) : 'NaN').padStart(6) + ' | ' +
      (isFinite(r.Ca) ? r.Ca.toFixed(1) : 'NaN').padStart(6) + ' | ' +
      (isFinite(r.pH) ? r.pH.toFixed(2) : 'NaN').padStart(5) + ' | ' +
      (isFinite(r.pCO2) ? r.pCO2.toExponential(2) : 'NaN').padStart(8) + ' | ' +
      (isFinite(r.T) ? r.T.toFixed(1) : 'NaN').padStart(4) +
      (change ? ' <-- cycle++' : '')
    );
    lastN = r.n_cycles;
  }
}

console.log('');
console.log('Summary:');
const finalN = rows[rows.length - 1].n_cycles;
const finalFOrd = rows[rows.length - 1].f_ord;
console.log(`  final _dol_cycle_count: ${finalN}`);
console.log(`  final f_ord:            ${finalFOrd.toFixed(4)}`);
console.log(`  proposal target:        cycle_count ≥ 9, f_ord > 0.7`);
console.log(`  scheduled pairs:        12 (max possible if every threshold crossing tracks cleanly)`);
const pct = finalN > 0 ? (finalN / 12 * 100).toFixed(0) : '0';
console.log(`  cycles detected:        ${finalN}/12 = ${pct}% of scheduled`);

if (finalN >= 9) {
  console.log('  verdict: STRONG — Kim mechanism firing at proposal-target strength.');
} else if (finalN >= 5) {
  console.log('  verdict: MEDIUM — mechanism firing but threshold detection drops some.');
  console.log('           _omega_history per-ring upgrade would tighten this.');
} else {
  console.log('  verdict: WEAK — threshold detection missing most flood/evap pairs.');
  console.log('           Per-cycle threshold is the soft point; consider _omega_history per-ring before W11.');
}
