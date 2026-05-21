// ============================================================
// js/83-nucleation-halide.ts — per-mineral nucleation gates (halide)
// ============================================================
// One `_nuc_<mineral>(sim)` helper per supported halide-class mineral.
// Each is a pure side-effecting function: reads sim state, conditionally
// calls sim.nucleate(...), and pushes a log line.
//
// VugSimulator.check_nucleation iterates over each class group via
// _nucleateClass_<klass>(sim). See 85-simulator.ts.
//
// Phase B15 of PROPOSAL-MODULAR-REFACTOR.

function _nuc_fluorite(sim) {
  const sigma_f = sim.conditions.supersaturation_fluorite();
  const existing_fl = sim.crystals.filter(c => c.mineral === 'fluorite' && c.active);
  if (sigma_f > MINERAL_GATES_fluorite.sigma_crit && !existing_fl.length && !sim._atNucleationCap('fluorite')) {
    const c = sim.nucleate('fluorite', 'vug wall', sigma_f);
    sim.log.push(`  ✦ NUCLEATION: Fluorite #${c.crystal_id} on ${c.position}`);
  }

  // Pyrite nucleation
}
function _nuc_halite(sim) {
  const sigma_hal = sim.conditions.supersaturation_halite();
  if (sigma_hal > MINERAL_GATES_halite.sigma_crit && !sim._atNucleationCap('halite') && rng.random() < 0.15) {
    const c = sim.nucleate('halite', 'vug wall', sigma_hal);
    sim.log.push(`  ✦ NUCLEATION: 🧂 Halite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_hal.toFixed(2)}, concentration=${sim.conditions.fluid.concentration.toFixed(1)}) — bathtub-ring NaCl precipitating from the evaporating brine`);
  }

  // Mirabilite nucleation — cold-side Na-sulfate evaporite. v29.
}

function _nuc_atacamite(sim) {
  const sigma = sim.conditions.supersaturation_atacamite();
  if (sigma > MINERAL_GATES_atacamite.sigma_crit && !sim._atNucleationCap('atacamite') && rng.random() < 0.15) {
    let pos = 'vug wall';
    const dissolved_cu = sim.crystals.filter(c => (c.mineral === 'chalcopyrite' || c.mineral === 'bornite' || c.mineral === 'chalcocite') && c.dissolved);
    if (dissolved_cu.length && rng.random() < 0.5) pos = `on ${dissolved_cu[0].mineral} #${dissolved_cu[0].crystal_id} (oxidized)`;
    const c = sim.nucleate('atacamite', pos, sigma);
    sim.log.push(`  ✦ NUCLEATION: 🟢 Atacamite #${c.crystal_id} on ${c.position} (Cu ${sim.conditions.fluid.Cu.toFixed(0)} Cl ${sim.conditions.fluid.Cl.toFixed(0)} ppm, σ=${sigma.toFixed(2)}) — emerald supergene chloride, the Atacama signature`);
  }
}

function _nuc_sylvite(sim) {
  const sigma = sim.conditions.supersaturation_sylvite();
  if (sigma > MINERAL_GATES_sylvite.sigma_crit && !sim._atNucleationCap('sylvite') && rng.random() < 0.12) {
    const c = sim.nucleate('sylvite', 'vug wall', sigma);
    sim.log.push(`  ✦ NUCLEATION: 🧂 Sylvite #${c.crystal_id} on ${c.position} (K=${sim.conditions.fluid.K.toFixed(0)} Cl=${sim.conditions.fluid.Cl.toFixed(0)} ppm, concentration=${sim.conditions.fluid.concentration.toFixed(1)}) — late-stage potash from residual brine`);
  }
}

function _nucleateClass_halide(sim) {
  _nuc_fluorite(sim);
  _nuc_halite(sim);
  _nuc_atacamite(sim);
  _nuc_sylvite(sim);
}
