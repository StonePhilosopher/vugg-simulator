// tools/w10_dolomite_calibration_probe.mjs — Week 10 prep: sigma_crit
// calibration probe for dolomite engine promotion. Sister tool to
// tools/w9_calcite_calibration_probe.mjs.
//
// PWP calibration factor (_PWP_CALIBRATION_FACTOR = 5e4) is global —
// already tuned at Week 9 for calcite and consumed by every per-mineral
// rate function. This probe only resolves sigma_crit for dolomite (and
// also reports dolomiteRate + pwp_um for cross-checks against the
// empirical 4.5 × excess growth formula).
//
// Dolomite-firing scenarios on v144 baseline:
//   sabkha_dolomitization (the Kim 2023 headline; small crystals)
//   jeffrey_mine (ultramafic skarn — small dolomite)
//   ultramafic_supergene (supergene — small)
//   zoned_dripstone_cave (cave dripstone Mg-Ca — large)
//
// Current empirical MINERAL_GATES_dolomite.sigma_crit = 1.0 (no
// kinetic-barrier margin). SI engine omega = 1.0 at equilibrium so
// sigma_crit = 1.0 would mean nucleation at exact equilibrium, which
// is geologically too eager for dolomite (which actually has a
// LARGER kinetic barrier than calcite per Kim 2023 — that's the whole
// point of the cyclic-omega mechanism).
//
// Usage: node tools/w10_dolomite_calibration_probe.mjs

import { loadSimBundle } from './_harness.mjs';

const sim_exports = await loadSimBundle({
  toolName: 'w10_dolomite_calibration_probe',
  extraExports: [
    'carbonateSaturationIndex', 'carbonateOmega',
    'pwpNetRate', 'pwpRateToSimMicronsPerStep',
    'dolomiteRate',
  ],
});

const {
  SCENARIOS, VugSimulator, setSeed,
  carbonateSaturationIndex, carbonateOmega,
  pwpNetRate, pwpRateToSimMicronsPerStep,
  dolomiteRate,
} = sim_exports;

const TARGET_SCENARIOS = [
  'sabkha_dolomitization',
  'jeffrey_mine',
  'ultramafic_supergene',
  'zoned_dripstone_cave',
];

const EMP_SIGMA_CRIT = 1.0;  // current empirical dolomite nucleation threshold

const allPoints = [];

function probeScenario(scenarioName) {
  const scn = SCENARIOS && SCENARIOS[scenarioName];
  if (!scn) return [];
  setSeed(42);
  const { conditions, events, defaultSteps } = scn();
  const sim = new VugSimulator(conditions, events);
  const total = defaultSteps ?? 100;
  const points = [];
  for (let i = 0; i < total; i++) {
    sim.run_step();
    const ringIdx = Math.floor((sim.ring_fluids ? sim.ring_fluids.length : 16) / 2);
    const f = sim.ring_fluids ? sim.ring_fluids[ringIdx] : conditions.fluid;
    const T = sim.ring_temperatures ? sim.ring_temperatures[ringIdx] : conditions.temperature;
    let sigma_emp;
    try {
      sigma_emp = conditions.supersaturation_dolomite();
    } catch {
      sigma_emp = NaN;
    }
    const omega = carbonateOmega('dolomite', f, T);
    const SI = carbonateSaturationIndex('dolomite', f, T);
    const cycle_count = conditions._dol_cycle_count || 0;
    const f_ord = 1 - Math.exp(-cycle_count / 7);
    const pwp_mol = dolomiteRate(f, T, f_ord);
    const pwp_um  = pwpRateToSimMicronsPerStep('dolomite', pwp_mol);
    points.push({
      scenario: scenarioName,
      step: sim.step,
      sigma_emp,
      omega,
      SI,
      f_ord,
      cycle_count,
      pwp_mol_per_cm2_s: pwp_mol,
      pwp_um_per_step: pwp_um,
      pH: f.pH, Ca: f.Ca, Mg: f.Mg, CO3: f.CO3, T,
    });
  }
  return points;
}

console.log('Probing dolomite-firing scenarios at seed 42 (v144 baseline)...');
for (const sName of TARGET_SCENARIOS) {
  const pts = probeScenario(sName);
  if (!pts.length) {
    console.log('  ' + sName + ' - scenario not loaded or empty');
    continue;
  }
  allPoints.push(...pts);
  const empNonZero = pts.filter(p => isFinite(p.sigma_emp) && p.sigma_emp > 0);
  const peakEmp = empNonZero.length ? Math.max(...empNonZero.map(p => p.sigma_emp)) : 0;
  const peakOmega = Math.max(...pts.map(p => isFinite(p.omega) ? p.omega : -Infinity));
  const stepsAboveCrit = pts.filter(p => isFinite(p.sigma_emp) && p.sigma_emp >= EMP_SIGMA_CRIT).length;
  const peakFOrd = Math.max(...pts.map(p => p.f_ord));
  console.log('  ' + sName.padEnd(28) +
    ' peak_emp=' + (isFinite(peakEmp) ? peakEmp.toFixed(2) : 'NaN').padStart(7) +
    ' peak_omega=' + (isFinite(peakOmega) ? peakOmega.toExponential(2) : 'NaN').padStart(10) +
    ' steps>=crit=' + String(stepsAboveCrit).padStart(4) +
    ' peak_f_ord=' + peakFOrd.toFixed(3));
}

function quantile(arr, q) {
  if (arr.length === 0) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

console.log('');
console.log('Calibration analysis - points where empirical sigma >= 1.0 (nucleation regime):');

const nucPoints = allPoints.filter(p =>
  isFinite(p.sigma_emp) && p.sigma_emp >= EMP_SIGMA_CRIT &&
  isFinite(p.omega) && p.omega > 0
);
const nearCritPoints = allPoints.filter(p =>
  isFinite(p.sigma_emp) && p.sigma_emp >= EMP_SIGMA_CRIT * 0.9 && p.sigma_emp <= EMP_SIGMA_CRIT * 1.5 &&
  isFinite(p.omega) && p.omega > 0
);

if (nucPoints.length === 0) {
  console.log('  No points crossed empirical sigma_crit.');
} else {
  const omegas = nucPoints.map(p => p.omega);
  console.log('  N points above sigma_crit: ' + nucPoints.length);
  console.log('  omega percentiles at nucleation-regime points:');
  console.log('    p05  = ' + quantile(omegas, 0.05).toFixed(3));
  console.log('    p25  = ' + quantile(omegas, 0.25).toFixed(3));
  console.log('    p50  = ' + quantile(omegas, 0.50).toFixed(3));
  console.log('    p75  = ' + quantile(omegas, 0.75).toFixed(3));
  console.log('    p95  = ' + quantile(omegas, 0.95).toFixed(3));
}

if (nearCritPoints.length > 0) {
  const omegas = nearCritPoints.map(p => p.omega);
  console.log('');
  console.log('  Near-threshold (emp 0.9-1.5x of crit) - the nucleation-onset band:');
  console.log('    N points: ' + nearCritPoints.length);
  console.log('    omega median = ' + quantile(omegas, 0.50).toFixed(3));
  console.log('    omega p25-p75 = ' + quantile(omegas, 0.25).toFixed(3) + ' - ' + quantile(omegas, 0.75).toFixed(3));
}

console.log('');
console.log('Per-scenario sample at peak empirical sigma:');
const byScen = {};
for (const p of allPoints) {
  if (!byScen[p.scenario] || (p.sigma_emp > (byScen[p.scenario].sigma_emp || -Infinity))) {
    byScen[p.scenario] = p;
  }
}
console.log('scenario                       step | sig_emp |   omega    |    SI  | f_ord | pwp_mol  | pwp_um(5e4)');
console.log('-------------------------------+------+--------+------------+-------+-------+----------+-----------');
for (const sName of TARGET_SCENARIOS) {
  const p = byScen[sName];
  if (!p) continue;
  console.log(
    sName.padEnd(30) + ' | ' +
    String(p.step).padStart(4) + ' | ' +
    (isFinite(p.sigma_emp) ? p.sigma_emp.toFixed(2) : 'NaN').padStart(6) + ' | ' +
    (isFinite(p.omega) ? p.omega.toExponential(2) : 'NaN').padStart(10) + ' | ' +
    (isFinite(p.SI) ? p.SI.toFixed(2) : 'NaN').padStart(5) + ' | ' +
    p.f_ord.toFixed(3).padStart(5) + ' | ' +
    (isFinite(p.pwp_mol_per_cm2_s) ? p.pwp_mol_per_cm2_s.toExponential(2) : 'NaN').padStart(8) + ' | ' +
    (isFinite(p.pwp_um_per_step) ? p.pwp_um_per_step.toExponential(2) : 'NaN').padStart(9)
  );
}

console.log('');
console.log('PWP per-step growth analysis (at calibration_factor=5e4 from W9):');
const growthPoints = allPoints.filter(p =>
  isFinite(p.sigma_emp) && p.sigma_emp > EMP_SIGMA_CRIT &&
  isFinite(p.pwp_um_per_step) && p.pwp_um_per_step > 0
);
if (growthPoints.length > 0) {
  const pwp_ums = growthPoints.map(p => p.pwp_um_per_step);
  console.log('  pwp_um/step distribution (over nucleation-regime points):');
  console.log('    p25  = ' + quantile(pwp_ums, 0.25).toExponential(3));
  console.log('    p50  = ' + quantile(pwp_ums, 0.50).toExponential(3));
  console.log('    p75  = ' + quantile(pwp_ums, 0.75).toExponential(3));
  console.log('  empirical engine base_rate = 4.5 * excess (multiplied by f_ord gate)');
  console.log('  empirical typical growth: 0.5-4 um/step at sigma 1.1-1.9');
}
