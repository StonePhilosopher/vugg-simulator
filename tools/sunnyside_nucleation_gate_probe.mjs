// tools/sunnyside_nucleation_gate_probe.mjs — recheck the sunnyside
// calcite question now that we know mesh.cells DO carry event chemistry.
//
// The earlier sunnyside_calcite_omega_probe.mjs was reading from
// sim.ring_fluids[0] (a now-vestigial store that engines don't use).
// This probe reads via sim.conditions.supersaturation_calcite() — the
// actual nucleation-gate path. If omega is reasonable here but the
// crystal still doesn't fire, the blocker is somewhere else (sigma_crit,
// gateClear, air_mode, paragenesis discount, etc.) — not chemistry.
//
// Usage: node tools/sunnyside_nucleation_gate_probe.mjs

import { loadSimBundle } from './_harness.mjs';

const sim_exports = await loadSimBundle({
  toolName: 'sunnyside_nucleation_gate_probe',
  extraExports: ['MINERAL_GATES_calcite', 'carbonateOmega'],
});

const {
  SCENARIOS, VugSimulator, setSeed,
  MINERAL_GATES_calcite, carbonateOmega,
} = sim_exports;

console.log(`MINERAL_GATES_calcite =`, MINERAL_GATES_calcite);

setSeed(42);
const scn = SCENARIOS['sunnyside_american_tunnel'];
const { conditions, events, defaultSteps } = scn();
const sim = new VugSimulator(conditions, events);
const total = defaultSteps ?? 200;

const SAMPLE_STEPS = [29, 30, 31, 50, 69, 70, 71, 90, 109, 110, 111, 130, 149, 150, 151, 160, 170, 175, 180, 185, 190, 195, 199];
const sampleSet = new Set(SAMPLE_STEPS);

console.log(`\nstep | T   | pH   | Ca  | CO3 | omega_via_engine | sigma_crit | gateClear?`);
console.log(`-----+-----+------+-----+-----+------------------+------------+-----------`);

let peakOmegaEngine = 0;
let peakStep = -1;
let firstFire = -1;

for (let i = 0; i < total; i++) {
  sim.run_step();
  if (sampleSet.has(i)) {
    const omega = sim.conditions.supersaturation_calcite();
    const T = sim.conditions.temperature;
    const f = sim.conditions.fluid;
    const gate = omega > MINERAL_GATES_calcite.sigma_crit;
    if (omega > peakOmegaEngine) {
      peakOmegaEngine = omega;
      peakStep = i;
    }
    if (gate && firstFire < 0) firstFire = i;
    console.log(
      `${String(i).padStart(4)} | ${T.toFixed(0).padStart(3)} | ${f.pH.toFixed(2).padStart(4)} | ${f.Ca.toFixed(0).padStart(3)} | ${f.CO3.toFixed(0).padStart(3)} | ${omega.toFixed(3).padStart(16)} | ${MINERAL_GATES_calcite.sigma_crit.toFixed(2).padStart(10)} | ${gate ? '✓' : '–'}`,
    );
  }
}

console.log(`\npeak omega via engine = ${peakOmegaEngine.toFixed(3)} at step ${peakStep}`);
console.log(`first gate-clear      = ${firstFire >= 0 ? `step ${firstFire}` : 'never'}`);

const calcites = sim.crystals.filter(c => c.mineral === 'calcite');
console.log(`\ncalcite crystals at end: ${calcites.length}`);
for (const c of calcites) {
  const sz = (c.zones ?? []).reduce((s, z) => s + (z.thickness_um || 0), 0);
  console.log(`  #${c.crystal_id}: nucleation_step=${c.nucleation_step}, size=${sz.toFixed(0)} µm, active=${c.active}, enc=${c.enclosed_by ?? '-'}, dis=${c.dissolved}`);
}

// What were the existing calcite crystals at the moment omega peaked?
// Air-mode check too. _nuc_calcite has the air_mode branch — if air_mode
// is on, the gate is probabilistic; if off, it requires !existing_calcite.length.
console.log(`\nwall.air_mode_default for sunnyside: ${sim.conditions.wall?.air_mode_default}`);
