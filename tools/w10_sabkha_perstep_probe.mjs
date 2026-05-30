// tools/w10_sabkha_perstep_probe.mjs — debugging the sabkha dolomite
// shrink from 49 µm (v144) to 2.5 µm (v145). Prints per-step state of
// the first dolomite crystal: thickness, last growth zone, sigma, omega.

import { loadSimBundle } from './_harness.mjs';

const sim_exports = await loadSimBundle({
  toolName: 'w10_sabkha_perstep_probe',
  extraExports: [
    'carbonateOmega', 'dolomiteRate', 'pwpRateToSimMicronsPerStep',
    'kspSupersatActiveFor',
  ],
});

const {
  SCENARIOS, VugSimulator, setSeed,
  carbonateOmega, dolomiteRate, pwpRateToSimMicronsPerStep,
  kspSupersatActiveFor,
} = sim_exports;

const scn = SCENARIOS.sabkha_dolomitization;
setSeed(42);
const { conditions, events, defaultSteps } = scn();
const sim = new VugSimulator(conditions, events);

console.log('Dolomite SI flag active: ' + kspSupersatActiveFor('dolomite'));
console.log('');
console.log('step | actv  | nz | size  | last_dz | sigma_dol  | f_ord | nc | pH    | vugFill');
console.log('-----+-------+----+-------+---------+------------+-------+----+-------+--------');

for (let i = 0; i < (defaultSteps || 260); i++) {
  sim.run_step();
  const dol = sim.crystals.find(c => c.mineral === 'dolomite');
  if (!dol) continue;
  const lastZone = dol.zones && dol.zones.length ? dol.zones[dol.zones.length - 1] : null;
  const sigma = conditions.supersaturation_dolomite();
  const ringIdx = Math.floor((sim.ring_fluids ? sim.ring_fluids.length : 16) / 2);
  const f = sim.ring_fluids ? sim.ring_fluids[ringIdx] : conditions.fluid;
  const T = sim.ring_temperatures ? sim.ring_temperatures[ringIdx] : conditions.temperature;
  const omega = carbonateOmega('dolomite', f, T);
  const n = conditions._dol_cycle_count || 0;
  const f_ord = 1 - Math.exp(-n / 7);
  const pwp_mol = dolomiteRate(f, T, f_ord);
  const pwp_um = pwpRateToSimMicronsPerStep('dolomite', pwp_mol);
  // Sample every step in early scenario, then every 5
  if (sim.step <= 12 || sim.step % 20 === 0) {
    console.log(
      String(sim.step).padStart(4) + ' | ' +
      String(dol.active).padStart(5) + ' | ' +
      String(dol.zones.length).padStart(2) + ' | ' +
      (dol.total_growth_um || 0).toFixed(2).padStart(5) + ' | ' +
      (lastZone ? lastZone.thickness_um.toFixed(2) : 'n/a').padStart(7) + ' | ' +
      (isFinite(sigma) ? sigma.toExponential(2) : 'NaN').padStart(10) + ' | ' +
      f_ord.toFixed(3).padStart(5) + ' | ' +
      String(n).padStart(2) + ' | ' +
      f.pH.toFixed(2).padStart(5) + ' | ' +
      sim.get_vug_fill().toFixed(3)
    );
  }
}
const dol = sim.crystals.find(c => c.mineral === 'dolomite');
console.log('');
console.log('Final dolomite size: ' + (dol ? dol.total_growth_um.toFixed(2) : 'NaN') + ' µm');
console.log('Total zones: ' + (dol ? dol.zones.length : 'NaN'));
if (dol && dol.zones) {
  let positive = 0, negative = 0, zero = 0;
  let sumPos = 0, sumNeg = 0;
  for (const z of dol.zones) {
    if (z.thickness_um > 0) { positive++; sumPos += z.thickness_um; }
    else if (z.thickness_um < 0) { negative++; sumNeg += z.thickness_um; }
    else zero++;
  }
  console.log('Zone breakdown:');
  console.log('  positive: ' + positive + ' zones, total +' + sumPos.toFixed(2) + ' µm');
  console.log('  negative: ' + negative + ' zones, total ' + sumNeg.toFixed(2) + ' µm');
  console.log('  zero    : ' + zero + ' zones');
}
