// ============================================================
// js/87-nucleation-oxide.ts — per-mineral nucleation gates (oxide)
// ============================================================
// One `_nuc_<mineral>(sim)` helper per supported oxide-class mineral.
// Each is a pure side-effecting function: reads sim state, conditionally
// calls sim.nucleate(...), and pushes a log line.
//
// VugSimulator.check_nucleation iterates over each class group via
// _nucleateClass_<klass>(sim). See 85-simulator.ts.
//
// Phase B15 of PROPOSAL-MODULAR-REFACTOR.

function _nuc_hematite(sim) {
  const existing_quartz = sim.crystals.filter(c => c.mineral === 'quartz' && c.active);
  const sigma_hem = sim.conditions.supersaturation_hematite();
  const existing_hem = sim.crystals.filter(c => c.mineral === 'hematite' && c.active);
  const total_hem = sim.crystals.filter(c => c.mineral === 'hematite').length;
  if (sigma_hem > 1.2 && !existing_hem.length && total_hem < 3 && !sim._atNucleationCap('hematite')) {
    let pos = 'vug wall';
    if (existing_quartz.length && rng.random() < 0.4) {
      pos = `on quartz #${existing_quartz[0].crystal_id}`;
    }
    const c = sim.nucleate('hematite', pos, sigma_hem);
    sim.log.push(`  ✦ NUCLEATION: Hematite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_hem.toFixed(2)})`);
  }

  // Malachite nucleation — needs sigma > 1.0
}
function _nuc_uraninite(sim) {
  const existing_quartz = sim.crystals.filter(c => c.mineral === 'quartz' && c.active);
  const sigma_urn = sim.conditions.supersaturation_uraninite();
  const existing_urn = sim.crystals.filter(c => c.mineral === 'uraninite' && c.active);
  const total_urn = sim.crystals.filter(c => c.mineral === 'uraninite').length;
  if (sigma_urn > 1.5 && existing_urn.length < 3 && total_urn < 5 && !sim._atNucleationCap('uraninite')) {
    if (!existing_urn.length || (sigma_urn > 2.5 && rng.random() < 0.3)) {
      const c = sim.nucleate('uraninite', 'vug wall', sigma_urn);
      sim.log.push(`  ✦ NUCLEATION: ☢️ Uraninite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_urn.toFixed(2)}) — radioactive!`);
    }
  }

  // Smithsonite nucleation — needs sigma > 1.0, oxidized Zn environment
}
function _nuc_magnetite(sim) {
  const sigma_mag = sim.conditions.supersaturation_magnetite();
  const existing_mag = sim.crystals.filter(c => c.mineral === 'magnetite' && c.active);
  if (sigma_mag > 1.0 && !sim._atNucleationCap('magnetite')) {
    if (!existing_mag.length || (sigma_mag > 1.7 && rng.random() < 0.2)) {
      let pos = 'vug wall';
      const active_hem_mag = sim.crystals.filter(c => c.mineral === 'hematite' && c.active);
      if (active_hem_mag.length && rng.random() < 0.3) pos = `on hematite #${active_hem_mag[0].crystal_id}`;
      const c = sim.nucleate('magnetite', pos, sigma_mag);
      sim.log.push(`  ✦ NUCLEATION: Magnetite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_mag.toFixed(2)}, Fe=${sim.conditions.fluid.Fe.toFixed(0)}, O₂=${sim.conditions.fluid.O2.toFixed(2)})`);
    }
  }

  // Lepidocrocite nucleation — Fe + rapid oxidation at low T.
}
function _nuc_cuprite(sim) {
  const sigma_cpr = sim.conditions.supersaturation_cuprite();
  const existing_cpr = sim.crystals.filter(c => c.mineral === 'cuprite' && c.active);
  if (sigma_cpr > 1.2 && !sim._atNucleationCap('cuprite')) {
    if (!existing_cpr.length || (sigma_cpr > 1.8 && rng.random() < 0.2)) {
      let pos = 'vug wall';
      const active_nc_cpr = sim.crystals.filter(c => c.mineral === 'native_copper' && c.active);
      const active_chc_cpr = sim.crystals.filter(c => c.mineral === 'chalcocite' && c.active);
      if (active_nc_cpr.length && rng.random() < 0.6) pos = `on native_copper #${active_nc_cpr[0].crystal_id}`;
      else if (active_chc_cpr.length && rng.random() < 0.3) pos = `on chalcocite #${active_chc_cpr[0].crystal_id}`;
      const c = sim.nucleate('cuprite', pos, sigma_cpr);
      sim.log.push(`  ✦ NUCLEATION: Cuprite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_cpr.toFixed(2)}, Cu=${sim.conditions.fluid.Cu.toFixed(0)}, O₂=${sim.conditions.fluid.O2.toFixed(1)})`);
    }
  }

  // Azurite nucleation — Cu + high CO₃ + O₂ (limestone-hosted Cu deposit).
}

function _nucleateClass_oxide(sim) {
  _nuc_hematite(sim);
  _nuc_uraninite(sim);
  _nuc_magnetite(sim);
  _nuc_cuprite(sim);
}
