// ============================================================
// js/81-nucleation-borate.ts — per-mineral nucleation gates (borate)
// ============================================================
// One `_nuc_<mineral>(sim)` helper per supported borate-class mineral.
// Each is a pure side-effecting function: reads sim state, conditionally
// calls sim.nucleate(...), and pushes a log line.
//
// VugSimulator.check_nucleation iterates over each class group via
// _nucleateClass_<klass>(sim). See 85-simulator.ts.
//
// Phase B15 of PROPOSAL-MODULAR-REFACTOR.

function _nuc_borax(sim) {
  const sigma_brx = sim.conditions.supersaturation_borax();
  if (sigma_brx > 1.0 && !sim._atNucleationCap('borax') && rng.random() < 0.12) {
    const c = sim.nucleate('borax', 'vug wall', sigma_brx);
    sim.log.push(`  ✦ NUCLEATION: 💎 Borax #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_brx.toFixed(2)}, concentration=${sim.conditions.fluid.concentration.toFixed(1)}, pH=${sim.conditions.fluid.pH.toFixed(1)}) — alkaline-brine evaporite from the playa-lake chemistry of this drained vug`);
  }

  // Feldspar nucleation — needs sigma > 1.0, K or Na + Al + Si
}

function _nucleateClass_borate(sim) {
  _nuc_borax(sim);
}
