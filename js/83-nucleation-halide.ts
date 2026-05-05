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
  if (sigma_f > 1.2 && !existing_fl.length && !sim._atNucleationCap('fluorite')) {
    const c = sim.nucleate('fluorite', 'vug wall', sigma_f);
    sim.log.push(`  ✦ NUCLEATION: Fluorite #${c.crystal_id} on ${c.position}`);
  }

  // Pyrite nucleation
}
function _nuc_halite(sim) {
  const sigma_hal = sim.conditions.supersaturation_halite();
  if (sigma_hal > 1.0 && !sim._atNucleationCap('halite') && rng.random() < 0.15) {
    const c = sim.nucleate('halite', 'vug wall', sigma_hal);
    sim.log.push(`  ✦ NUCLEATION: 🧂 Halite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_hal.toFixed(2)}, concentration=${sim.conditions.fluid.concentration.toFixed(1)}) — bathtub-ring NaCl precipitating from the evaporating brine`);
  }

  // Mirabilite nucleation — cold-side Na-sulfate evaporite. v29.
}

function _nucleateClass_halide(sim) {
  _nuc_fluorite(sim);
  _nuc_halite(sim);
}
