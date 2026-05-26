// tools/w9_calcite_calibration_probe.mjs — Week 9 prep: sigma_crit + PWP
// calibration probe for calcite engine promotion.
//
// Runs every calcite-firing scenario at seed 42, samples (empirical_sigma,
// omega, SI, mineralogical-outcome) pairs at every step. Used to:
//
//   1. Decide a new sigma_crit for the SI engine that produces similar
//      nucleation-onset behavior to the empirical engine's 1.3 cutoff.
//
//   2. Tune _PWP_CALIBRATION_FACTOR so that pwpRateToSimMicronsPerStep
//      lands near the empirical engine's per-step calcite growth rates.
//
// Calcite-firing scenarios on v143 baseline (per gen-baseline diff):
//   zoned_dripstone_cave, stalactite_demo, deccan_zeolite, jeffrey_mine,
//   marble_contact_metamorphism, mvt, pulse, sunnyside_american_tunnel,
//   tutorial_travertine, bisbee (1 dissolved), sabkha_dolomitization.
//
// Strategy: at every step, ask the empirical engine for σ_emp via
// supersaturation_calcite() AND ask the SI engine for omega via
// carbonateOmega('calcite', ...). At steps where σ_emp ≥ 1.3 (the
// nucleation threshold), record the omega. The median omega at the
// nucleation threshold becomes the new sigma_crit.
//
// Usage: node tools/w9_calcite_calibration_probe.mjs

import { loadSimBundle } from './_harness.mjs';

const sim_exports = await loadSimBundle({
  toolName: 'w9_calcite_calibration_probe',
  extraExports: [
    'carbonateSaturationIndex', 'carbonateOmega',
    'pwpNetRate', 'pwpRateToSimMicronsPerStep',
    'calciteRate',
  ],
});

const {
  SCENARIOS, VugSimulator, setSeed,
  carbonateSaturationIndex, carbonateOmega,
  pwpNetRate, pwpRateToSimMicronsPerStep,
  calciteRate,
} = sim_exports;

// All calcite-firing scenarios on v143.
const TARGET_SCENARIOS = [
  'zoned_dripstone_cave',
  'stalactite_demo',
  'deccan_zeolite',
  'bisbee',
  'jeffrey_mine',
  'marble_contact_metamorphism',
  'mvt',
  'pulse',
  'sabkha_dolomitization',
  'sunnyside_american_tunnel',
  'tutorial_travertine',
];

const EMP_SIGMA_CRIT = 1.3;  // current empirical calcite nucleation threshold

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
    // Sample the equator ring (per_vertex paths use ring_fluids;
    // global path uses conditions.fluid).
    const ringIdx = Math.floor((sim.ring_fluids ? sim.ring_fluids.length : 16) / 2);
    const f = sim.ring_fluids ? sim.ring_fluids[ringIdx] : conditions.fluid;
    const T = sim.ring_temperatures ? sim.ring_temperatures[ringIdx] : conditions.temperature;
    // Empirical sigma — call supersaturation_calcite on the conditions
    // object. Conditions holds the global fluid; for per-vertex scenarios
    // this samples the global. For mode-consistent calibration we want
    // the same fluid going into both engines.
    let sigma_emp;
    try {
      sigma_emp = conditions.supersaturation_calcite();
    } catch {
      sigma_emp = NaN;
    }
    const omega = carbonateOmega('calcite', f, T);
    const SI = carbonateSaturationIndex('calcite', f, T);
    const pwp_mol = pwpNetRate('calcite', f, T);
    const pwp_um  = pwpRateToSimMicronsPerStep('calcite', pwp_mol);
    points.push({
      scenario: scenarioName,
      step: sim.step,
      sigma_emp,
      omega,
      SI,
      pwp_mol_per_cm2_s: pwp_mol,
      pwp_um_per_step_x_1: pwp_um,   // factor=1.0 placeholder
      pH: f.pH, Ca: f.Ca, CO3: f.CO3, Mg: f.Mg, T,
    });
  }
  return points;
}

console.log('Probing calcite-firing scenarios at seed 42…');
for (const sName of TARGET_SCENARIOS) {
  const pts = probeScenario(sName);
  if (!pts.length) {
    console.log('  ' + sName + ' — scenario not loaded or empty');
    continue;
  }
  allPoints.push(...pts);
  const peakEmp = Math.max(...pts.map(p => isFinite(p.sigma_emp) ? p.sigma_emp : -Infinity));
  const peakOmega = Math.max(...pts.map(p => isFinite(p.omega) ? p.omega : -Infinity));
  const stepsAboveCrit = pts.filter(p => isFinite(p.sigma_emp) && p.sigma_emp >= EMP_SIGMA_CRIT).length;
  console.log('  ' + sName.padEnd(34) +
    ' peak_emp=' + (isFinite(peakEmp) ? peakEmp.toFixed(2) : 'NaN').padStart(8) +
    ' peak_omega=' + (isFinite(peakOmega) ? peakOmega.toExponential(2) : 'NaN').padStart(10) +
    ' steps>=crit=' + String(stepsAboveCrit).padStart(4));
}

console.log('');
console.log('Calibration analysis — points where empirical sigma >= 1.3 (nucleation regime):');
console.log('');

const nucPoints = allPoints.filter(p => isFinite(p.sigma_emp) && p.sigma_emp >= EMP_SIGMA_CRIT && isFinite(p.omega) && p.omega > 0);
const nearCritPoints = allPoints.filter(p =>
  isFinite(p.sigma_emp) && p.sigma_emp >= EMP_SIGMA_CRIT * 0.9 && p.sigma_emp <= EMP_SIGMA_CRIT * 1.5 &&
  isFinite(p.omega) && p.omega > 0
);

function quantile(arr, q) {
  if (arr.length === 0) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

if (nucPoints.length === 0) {
  console.log('  No points crossed empirical sigma_crit. Engine may not fire on these scenarios.');
} else {
  const omegas = nucPoints.map(p => p.omega);
  console.log('  N points above sigma_crit: ' + nucPoints.length);
  console.log('  omega percentiles at nucleation-regime points:');
  console.log('    p05  = ' + quantile(omegas, 0.05).toFixed(3));
  console.log('    p25  = ' + quantile(omegas, 0.25).toFixed(3));
  console.log('    p50  = ' + quantile(omegas, 0.50).toFixed(3));
  console.log('    p75  = ' + quantile(omegas, 0.75).toFixed(3));
  console.log('    p95  = ' + quantile(omegas, 0.95).toFixed(3));
  console.log('    min  = ' + Math.min(...omegas).toFixed(3));
  console.log('    max  = ' + Math.max(...omegas).toFixed(3));
}

if (nearCritPoints.length > 0) {
  const omegas = nearCritPoints.map(p => p.omega);
  console.log('');
  console.log('  Near-threshold (emp 0.9-1.5 × sigma_crit) — the nucleation-onset band:');
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
console.log('scenario                             step | sig_emp |   omega    |    SI  |  pwp_mol  | pwp_um(x1)');
console.log('-------------------------------------+------+--------+------------+-------+-----------+-----------');
for (const sName of TARGET_SCENARIOS) {
  const p = byScen[sName];
  if (!p) continue;
  console.log(
    sName.padEnd(36) + ' | ' +
    String(p.step).padStart(4) + ' | ' +
    (isFinite(p.sigma_emp) ? p.sigma_emp.toFixed(2) : 'NaN').padStart(6) + ' | ' +
    (isFinite(p.omega) ? p.omega.toExponential(2) : 'NaN').padStart(10) + ' | ' +
    (isFinite(p.SI) ? p.SI.toFixed(2) : 'NaN').padStart(5) + ' | ' +
    (isFinite(p.pwp_mol_per_cm2_s) ? p.pwp_mol_per_cm2_s.toExponential(2) : 'NaN').padStart(9) + ' | ' +
    (isFinite(p.pwp_um_per_step_x_1) ? p.pwp_um_per_step_x_1.toExponential(2) : 'NaN').padStart(9)
  );
}

console.log('');
console.log('PWP calibration analysis:');
console.log('');
console.log('  Empirical engine grow_calcite produces calcite growth in the range');
console.log('  ~0.5-5 µm/step at typical scenarios. We want pwp_um_per_step (x calibration_factor)');
console.log('  to land in the same band so promotion does not shift mineralogical outcomes.');
console.log('');

// Take a representative scenario where calcite is comfortably supersat
// and compute the calibration factor that lands at ~1 µm/step.
const repPoints = allPoints.filter(p =>
  isFinite(p.sigma_emp) && p.sigma_emp > 1.5 && p.sigma_emp < 5 &&
  isFinite(p.pwp_um_per_step_x_1) && p.pwp_um_per_step_x_1 > 0
);
if (repPoints.length > 0) {
  const pwp_ums = repPoints.map(p => p.pwp_um_per_step_x_1);
  const median_pwp = quantile(pwp_ums, 0.50);
  const p25_pwp = quantile(pwp_ums, 0.25);
  const p75_pwp = quantile(pwp_ums, 0.75);
  console.log('  pwp_um @ calibration_factor=1.0 (across emp sigma 1.5-5 regime):');
  console.log('    p25  = ' + p25_pwp.toExponential(3) + ' µm/step');
  console.log('    p50  = ' + median_pwp.toExponential(3) + ' µm/step');
  console.log('    p75  = ' + p75_pwp.toExponential(3) + ' µm/step');
  console.log('');
  // Target: empirical typical growth ~1 µm/step.
  const targetUmPerStep = 1.0;
  const factor = targetUmPerStep / median_pwp;
  console.log('  To land pwp at ~1 µm/step (typical empirical):');
  console.log('    calibration_factor ≈ ' + factor.toExponential(3));
  console.log('  To land at 0.5-2 µm/step band (empirical engine range):');
  console.log('    calibration_factor ≈ ' + (0.5/median_pwp).toExponential(3) + ' - ' + (2.0/median_pwp).toExponential(3));
}
