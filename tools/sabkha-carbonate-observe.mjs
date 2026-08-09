#!/usr/bin/env node
/** Deterministic receipt for the SIM 254 sabkha carbonate migration. */

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({
  toolName: 'sabkha-carbonate-observe',
});

const args = process.argv.slice(2);
const seed = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : 42;
setSeed(seed);

const { conditions, events, defaultSteps } = SCENARIOS.sabkha_dolomitization();
const sim = new VugSimulator(conditions, events);
const checkpoints = new Set([0, 1, 9, 10, 11, 19, 20, 21, 239, 240, 241, defaultSteps]);

console.log(`sabkha carbonate receipt — run seed ${seed}, shape seed ${conditions.wall.shape_seed}`);
console.log('step    T_C       pH   DIC_mmol  salinity  import_mmol  export_mmol  flags');
const row = (step) => {
  const state = sim._carbonateBoundaryState;
  console.log([
    String(step).padStart(4),
    conditions.temperature.toFixed(2).padStart(7),
    conditions.fluid.pH.toFixed(4).padStart(8),
    (conditions.fluid.CO3 / 60.01).toFixed(4).padStart(10),
    conditions.fluid.salinity.toFixed(1).padStart(9),
    (state.boundaryImportMolKg * 1000).toFixed(4).padStart(12),
    (state.boundaryExportMolKg * 1000).toFixed(4).padStart(12),
    state.uncertainties.join(',') || 'none',
  ].join(' '));
};

row(0);
for (let i = 0; i < defaultSteps; i++) {
  sim.run_step();
  if (checkpoints.has(sim.step)) row(sim.step);
}

const state = sim._carbonateBoundaryState;
const recharge = state.transactions.filter((tx) => tx.kind === 'recharge');
const open = state.transactions.filter((tx) => tx.kind === 'open');
const failures = state.transactions.filter((tx) => tx.ok === false);
const maxRechargeResidual = Math.max(0, ...recharge.map((tx) => Math.abs(tx.carbonErrorMolKg)));
console.log(`\nreplacement-water transactions: ${recharge.length}`);
console.log(`open-boundary transactions: ${open.length}`);
console.log(`failed/unresolved transactions: ${failures.length}`);
console.log(`maximum recharge carbon residual: ${maxRechargeResidual.toExponential(3)} mol/kg`);
console.log(`salinity_model_missing present: ${state.uncertainties.includes('salinity_model_missing')}`);
console.log(`simple carbonate phases: ${(conditions._scenario.carbonate_boundary.simple_carbonate_phases || []).join(', ')}`);
console.log(`surviving minerals: ${[...new Set(sim.crystals.filter((c) => !c.dissolved).map((c) => c.mineral))].sort().join(', ')}`);
if (failures.length) {
  for (const failure of failures) console.log(JSON.stringify(failure));
  process.exitCode = 1;
}
