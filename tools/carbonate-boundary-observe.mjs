#!/usr/bin/env node
/**
 * Deterministic receipt for the conserved carbonate boundary.
 *
 * Usage: node tools/carbonate-boundary-observe.mjs [--seed 42]
 */

import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed } = await loadSimBundle({
  toolName: 'carbonate-boundary-observe',
});

const args = process.argv.slice(2);
const seed = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : 42;
setSeed(seed);

const { conditions, events, defaultSteps } = SCENARIOS.tutorial_travertine();
const sim = new VugSimulator(conditions, events);
const checkpoints = new Set([0, 1, 9, 10, 11, 24, 25, 26, 39, 40, 41, defaultSteps]);

const row = (step) => {
  const state = sim._carbonateBoundaryState;
  const dicMmol = conditions.fluid.CO3 / 60.01;
  const sigma = conditions.supersaturation_calcite();
  const totalMmol = (state.lastDICMolKg + state.headspaceCO2MolKg) * 1000;
  console.log([
    String(step).padStart(4),
    conditions.temperature.toFixed(2).padStart(7),
    conditions.fluid.pH.toFixed(4).padStart(8),
    dicMmol.toFixed(4).padStart(10),
    sigma.toFixed(4).padStart(9),
    totalMmol.toFixed(4).padStart(11),
    (state.boundaryExportMolKg * 1000).toFixed(4).padStart(12),
  ].join(' '));
};

console.log(`carbonate boundary receipt — tutorial_travertine, run seed ${seed}, shape seed ${conditions.wall.shape_seed}`);
console.log('step    T_C       pH   DIC_mmol     sigma  Csys_mmol  export_mmol');
row(0);
for (let i = 0; i < defaultSteps; i++) {
  sim.run_step();
  if (checkpoints.has(sim.step)) row(sim.step);
}

const state = sim._carbonateBoundaryState;
console.log('\nvent transactions');
for (const tx of state.transactions.filter((entry) => entry.kind === 'open')) {
  console.log(JSON.stringify({
    note: tx.note,
    target_pCO2_bar: tx.after.pCO2Bar,
    exported_mmol_C_kg: Math.max(0, -tx.boundaryDeltaMolKg) * 1000,
    solved_pH: tx.after.pH,
    dic_mmol_C_kg: tx.after.dicMolKg * 1000,
    reduced_alkalinity_eq_kg: state.reducedAlkalinityEqKg,
  }));
}

const closed = state.transactions.filter((entry) => entry.kind === 'closed');
const maxClosedError = Math.max(0, ...closed.map((tx) => Math.abs(tx.carbonErrorMolKg)));
console.log(`\nclosed transactions: ${closed.length}; max carbon residual ${maxClosedError.toExponential(3)} mol/kg`);
const failures = state.transactions.filter((entry) => entry.ok === false);
console.log(`failed/unresolved transactions: ${failures.length}`);
for (const tx of failures) console.log(JSON.stringify(tx));
console.log(`uncertainties: ${state.uncertainties.join(', ') || 'none'}`);
console.log(`calcite crystals: ${sim.crystals.filter((c) => c.mineral === 'calcite').length}`);
