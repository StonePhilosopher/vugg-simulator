#!/usr/bin/env node
/** Seed-42 evidence probe for the mine-specific Roughton Gill reconstruction. */
import { loadSimBundle } from './_harness.mjs';

const { SCENARIOS, VugSimulator, setSeed, simulatorSulfurLedgerSnapshot,
  simulatorCarbonLedgerSnapshot } = await loadSimBundle({
  toolName: 'roughten-gill-reconciliation-observe',
  extraExports: ['simulatorSulfurLedgerSnapshot', 'simulatorCarbonLedgerSnapshot'],
});

const seedArg = process.argv.indexOf('--seed');
const seed = seedArg >= 0 ? Number(process.argv[seedArg + 1]) : 42;
setSeed(seed);
const { conditions, events, defaultSteps } = SCENARIOS.roughten_gill();
const sim = new VugSimulator(conditions, events);
const watched = [
  'quartz', 'calcite', 'dolomite', 'galena', 'sphalerite', 'chalcopyrite',
  'malachite', 'cerussite', 'rosasite', 'aurichalcite', 'hemimorphite',
  'pyromorphite', 'plumbogummite',
];
const maxima = Object.fromEntries(watched.map(name => [name, { sigma: 0, step: -1 }]));
const snapshots = new Set([1, 30, 59, 60, 99, 100, 139, 140, 179, 180, 214, 215, defaultSteps]);

function sigma(name) {
  const fn = sim.conditions[`supersaturation_${name}`];
  try { return typeof fn === 'function' ? Number(fn.call(sim.conditions)) || 0 : 0; }
  catch { return 0; }
}

for (let i = 0; i < defaultSteps; i++) {
  sim.run_step();
  for (const name of watched) {
    const value = sigma(name);
    if (value > maxima[name].sigma) maxima[name] = { sigma: value, step: sim.step };
  }
  if (snapshots.has(sim.step)) {
    const f = sim.conditions.fluid;
    console.log(JSON.stringify({
      step: sim.step,
      temperature_C: Number(sim.conditions.temperature.toFixed(2)),
      pH: Number(f.pH.toFixed(3)),
      O2: Number(f.O2.toFixed(3)),
      Eh_mV: Number(f.Eh.toFixed(1)),
      SiO2: Number(f.SiO2.toFixed(2)),
      Ca: Number(f.Ca.toFixed(2)),
      Mg: Number(f.Mg.toFixed(2)),
      CO3: Number(f.CO3.toFixed(2)),
      Cu: Number(f.Cu.toFixed(2)),
      Pb: Number(f.Pb.toFixed(2)),
      Zn: Number(f.Zn.toFixed(2)),
      S_sulfide: Number(f.S_sulfide.toFixed(2)),
      S_sulfate: Number(f.S_sulfate.toFixed(2)),
      fluid_surface_ring: sim.conditions.fluid_surface_ring,
    }));
  }
}

const census = {};
for (const crystal of sim.crystals) {
  const row = census[crystal.mineral] ||= { total: 0, active: 0, dissolved: 0, max_um: 0 };
  row.total++;
  if (crystal.dissolved) row.dissolved++;
  else row.active++;
  row.max_um = Math.max(row.max_um, Number(crystal.total_growth_um) || 0);
}
for (const row of Object.values(census)) row.max_um = Number(row.max_um.toFixed(1));

const excludedAppearances = Object.keys(SCENARIOS.roughten_gill._json5_spec.excluded_species || {})
  .filter(name => census[name]);
const phosphateLineage = sim.crystals
  .filter(crystal => crystal.mineral === 'pyromorphite' || crystal.mineral === 'plumbogummite')
  .map(crystal => ({
    crystal_id: crystal.crystal_id,
    mineral: crystal.mineral,
    nucleation_step: crystal.nucleation_step,
    active: !!crystal.active,
    dissolved: !!crystal.dissolved,
    habit: crystal.habit,
    position: crystal.position,
    growth_um: Number((Number(crystal.total_growth_um) || 0).toFixed(1)),
  }));
console.log(JSON.stringify({
  seed,
  steps: defaultSteps,
  maxima,
  census,
  phosphateLineage,
  excludedAppearances,
  sulfurLedger: simulatorSulfurLedgerSnapshot(sim),
  sulfurTransactions: sim._sulfurBoundaryTransactions,
  carbonLedger: simulatorCarbonLedgerSnapshot(sim),
  carbonTransactions: sim._carbonSourceTransactions,
  fluidBoundaryTransactions: sim._fluidBoundaryTransactions,
  fluidBoundaryViolations: sim._fluidBoundaryViolations,
}, null, 2));
