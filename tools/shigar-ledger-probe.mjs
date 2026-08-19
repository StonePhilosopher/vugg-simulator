// Diagnostic for the SIM 241 mole-correct ledger calibration of the Shigar
// pegmatite. It records the actual production topaz decision, the cell-fluid
// ranges that growth engines consume, and any formula-pool caps on the anchor
// phases. Passive instrument: prints JSON and never edits simulation state.
// Run after `npm run build`.
import { loadSimBundle } from './_harness.mjs';

const {
  SCENARIOS, VugSimulator, setSeed, assessProductionNucleationDecision,
  MINERAL_GATES_topaz,
} = await loadSimBundle({
  toolName: 'shigar-ledger-probe',
  extraExports: ['assessProductionNucleationDecision', 'MINERAL_GATES_topaz'],
});

function cellRanges(sim, fields) {
  const cells = sim.wall_state.meshFor(sim).cells || [];
  const result = {};
  for (const field of fields) {
    const values = cells.map(c => Number(c?.fluid?.[field])).filter(Number.isFinite);
    result[field] = values.length
      ? { min: Math.min(...values), max: Math.max(...values) }
      : null;
  }
  return result;
}

const sweep = process.argv.includes('--sweep');
if (sweep) {
  const results = [];
  for (const diameter_mm of [140, 180, 220, 280, 360, 500]) {
    setSeed(42);
    const { conditions, events, defaultSteps } = SCENARIOS.shigar_pegmatite();
    conditions.wall.vug_diameter_mm = diameter_mm;
    const candidate = new VugSimulator(conditions, events);
    for (let i = 0; i < defaultSteps; i++) candidate.run_step();
    const sizes = mineral => candidate.crystals
      .filter(c => c.mineral === mineral)
      .map(c => c.c_length_mm)
      .sort((a, b) => b - a);
    results.push({
      diameter_mm,
      fill: candidate.get_vug_fill(),
      species: [...new Set(candidate.crystals.map(c => c.mineral))].sort(),
      aquamarine_mm: sizes('aquamarine'),
      topaz_mm: sizes('topaz'),
      albite_mm: sizes('albite'),
    });
  }
  console.log(JSON.stringify({ sim_version: 241, diameter_sweep: results }, null, 2));
  process.exit(0);
}

setSeed(42);
const { conditions, events, defaultSteps } = SCENARIOS.shigar_pegmatite();
const sim = new VugSimulator(conditions, events);
const trace = [];
for (let i = 0; i < defaultSteps; i++) {
  sim.run_step();
  if (sim.step < 44 || sim.step > 60) continue;
  const sigma = sim.conditions.supersaturation_topaz();
  const decision = assessProductionNucleationDecision(
    'topaz', sim, sigma, MINERAL_GATES_topaz.sigma_crit,
  );
  trace.push({
    step: sim.step,
    temperature_C: sim.conditions.temperature,
    sigma,
    production_eligible: decision.eligible,
    blockers: decision.blockers,
    at_nucleation_cap: sim._atNucleationCap('topaz'),
    vug_fill: sim.get_vug_fill(),
    total_topaz: sim.crystals.filter(c => c.mineral === 'topaz').length,
    bulk: Object.fromEntries(['Al', 'SiO2', 'F'].map(k => [k, sim.conditions.fluid[k]])),
    cells: cellRanges(sim, ['Al', 'SiO2', 'F']),
  });
}

const cappedZones = sim.crystals
  .filter(c => ['aquamarine', 'topaz', 'albite', 'feldspar'].includes(c.mineral))
  .flatMap(c => (c.zones || [])
    .filter(z => z._stoichiometric_budget_cap)
    .map(z => ({
      crystal_id: c.crystal_id,
      mineral: c.mineral,
      step: z.step,
      cap: z._stoichiometric_budget_cap,
    })));

console.log(JSON.stringify({
  sim_version: sim.SIM_VERSION,
  trace,
  capped_zones: cappedZones,
  final_species: [...new Set(sim.crystals.map(c => c.mineral))].sort(),
}, null, 2));
