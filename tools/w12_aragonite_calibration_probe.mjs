// tools/w12_aragonite_calibration_probe.mjs — Week 12 prep.
// Per-scenario probe of (sigma_emp, omega, SI, aragoniteRate, pwp_um)
// across aragonite-firing scenarios. Picks sigma_crit for the SI
// engine promotion. PWP _PWP_CALIBRATION_FACTOR is global (5e4 from
// W9); aragoniteRate already applies the ×3 factor per Wollast 1990 /
// Burton-Walter 1987.
//
// Aragonite is the kinetic-favored polymorph when Mg/Ca > 4.0 AND T >
// 30°C per Burton-Walter 1987 (already encoded in
// aragoniteKineticallyFavoredOver in 52b). The current empirical
// supersaturation_aragonite returns omega × favorability_weighted_sum
// (where favorability mixes Mg-factor, T-factor, omega-factor, trace-
// factor). Under the SI engine, supersaturation_aragonite would return
// raw textbook omega. We pick sigma_crit so existing aragonite firings
// remain firing under the new path.
//
// Scenarios in v146 baseline:
//   - zoned_dripstone_cave: 4 active, max 28663 µm (cave dripstone)
//   - marble_contact_metamorphism: 1 active, 1 dissolved, max 9373 µm
//   - sabkha_dolomitization: 1 active, max 188 µm (sabkha-rim aragonite)
//
// Usage: node tools/w12_aragonite_calibration_probe.mjs

import { loadSimBundle } from './_harness.mjs';

const sim_exports = await loadSimBundle({
  toolName: 'w12_aragonite_calibration_probe',
  extraExports: [
    'carbonateSaturationIndex', 'carbonateOmega',
    'pwpNetRate', 'pwpRateToSimMicronsPerStep',
    'aragoniteRate', 'aragoniteKineticallyFavoredOver',
  ],
});

const {
  SCENARIOS, VugSimulator, setSeed,
  carbonateSaturationIndex, carbonateOmega,
  pwpNetRate, pwpRateToSimMicronsPerStep,
  aragoniteRate, aragoniteKineticallyFavoredOver,
} = sim_exports;

const TARGET_SCENARIOS = [
  'zoned_dripstone_cave',
  'marble_contact_metamorphism',
  'sabkha_dolomitization',
];

const EMP_SIGMA_CRIT = 1.0;

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
    try { sigma_emp = conditions.supersaturation_aragonite(); }
    catch { sigma_emp = NaN; }
    const omega = carbonateOmega('aragonite', f, T);
    const SI = carbonateSaturationIndex('aragonite', f, T);
    const pwp_mol = aragoniteRate(f, T);
    const pwp_um = pwpRateToSimMicronsPerStep('aragonite', pwp_mol);
    const kinetically_favored = aragoniteKineticallyFavoredOver(f, T);
    const mg_ratio = f.Mg / Math.max(f.Ca, 0.01);
    points.push({
      scenario: scenarioName,
      step: sim.step,
      sigma_emp, omega, SI, pwp_mol, pwp_um, kinetically_favored, mg_ratio,
      pH: f.pH, Ca: f.Ca, Mg: f.Mg, T,
    });
  }
  return points;
}

console.log('Probing aragonite-firing scenarios at seed 42 (v146 baseline)...');
for (const sName of TARGET_SCENARIOS) {
  const pts = probeScenario(sName);
  if (!pts.length) continue;
  allPoints.push(...pts);
  const empNonZero = pts.filter(p => isFinite(p.sigma_emp) && p.sigma_emp > 0);
  const peakEmp = empNonZero.length ? Math.max(...empNonZero.map(p => p.sigma_emp)) : 0;
  const peakOmega = Math.max(...pts.map(p => isFinite(p.omega) ? p.omega : -Infinity));
  const stepsAboveCrit = pts.filter(p => isFinite(p.sigma_emp) && p.sigma_emp >= EMP_SIGMA_CRIT).length;
  const stepsKineticFavored = pts.filter(p => p.kinetically_favored).length;
  console.log('  ' + sName.padEnd(34) +
    ' peak_emp=' + (isFinite(peakEmp) ? peakEmp.toFixed(2) : 'NaN').padStart(7) +
    ' peak_omega=' + (isFinite(peakOmega) ? peakOmega.toExponential(2) : 'NaN').padStart(10) +
    ' steps>=crit=' + String(stepsAboveCrit).padStart(4) +
    ' kinFav=' + String(stepsKineticFavored).padStart(4));
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
console.log('Calibration analysis — empirical sigma >= 1.0 (nucleation regime):');
const nucPoints = allPoints.filter(p =>
  isFinite(p.sigma_emp) && p.sigma_emp >= EMP_SIGMA_CRIT && isFinite(p.omega) && p.omega > 0);
const nearCritPoints = allPoints.filter(p =>
  isFinite(p.sigma_emp) && p.sigma_emp >= EMP_SIGMA_CRIT * 0.9 && p.sigma_emp <= EMP_SIGMA_CRIT * 2 &&
  isFinite(p.omega) && p.omega > 0);

if (nucPoints.length === 0) {
  console.log('  No points crossed empirical sigma_crit.');
} else {
  const omegas = nucPoints.map(p => p.omega);
  console.log('  N points above sigma_crit: ' + nucPoints.length);
  console.log('  omega percentiles:');
  console.log('    p05  = ' + quantile(omegas, 0.05).toFixed(3));
  console.log('    p25  = ' + quantile(omegas, 0.25).toFixed(3));
  console.log('    p50  = ' + quantile(omegas, 0.50).toFixed(3));
  console.log('    p75  = ' + quantile(omegas, 0.75).toFixed(3));
  console.log('    p95  = ' + quantile(omegas, 0.95).toFixed(3));
}
if (nearCritPoints.length > 0) {
  const omegas = nearCritPoints.map(p => p.omega);
  console.log('');
  console.log('  Near-threshold (emp 0.9-2.0x of crit) — nucleation onset band:');
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
console.log('scenario                       step | sig_emp |   omega    |   SI  | kinFav | Mg/Ca | T(C)  | pwp_um(5e4)');
console.log('-------------------------------+------+--------+------------+-------+--------+-------+-------+-----------');
for (const sName of TARGET_SCENARIOS) {
  const p = byScen[sName];
  if (!p) continue;
  console.log(
    sName.padEnd(30) + ' | ' +
    String(p.step).padStart(4) + ' | ' +
    (isFinite(p.sigma_emp) ? p.sigma_emp.toFixed(2) : 'NaN').padStart(6) + ' | ' +
    (isFinite(p.omega) ? p.omega.toExponential(2) : 'NaN').padStart(10) + ' | ' +
    (isFinite(p.SI) ? p.SI.toFixed(2) : 'NaN').padStart(5) + ' | ' +
    String(p.kinetically_favored).padStart(6) + ' | ' +
    p.mg_ratio.toFixed(2).padStart(5) + ' | ' +
    p.T.toFixed(1).padStart(5) + ' | ' +
    (isFinite(p.pwp_um) ? p.pwp_um.toExponential(2) : 'NaN').padStart(9)
  );
}

console.log('');
console.log('PWP per-step growth analysis (calibration_factor=5e4 from W9):');
const growthPoints = allPoints.filter(p =>
  isFinite(p.sigma_emp) && p.sigma_emp > EMP_SIGMA_CRIT &&
  isFinite(p.pwp_um) && p.pwp_um > 0);
if (growthPoints.length > 0) {
  const pwp_ums = growthPoints.map(p => p.pwp_um);
  console.log('  pwp_um/step over nucleation-regime points:');
  console.log('    p25 = ' + quantile(pwp_ums, 0.25).toExponential(3));
  console.log('    p50 = ' + quantile(pwp_ums, 0.50).toExponential(3));
  console.log('    p75 = ' + quantile(pwp_ums, 0.75).toExponential(3));
  console.log('  empirical engine rate = 1.5-7 um/step typical at sigma 1.1-2.0');
}
