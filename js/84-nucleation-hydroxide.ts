// ============================================================
// js/84-nucleation-hydroxide.ts — per-mineral nucleation gates (hydroxide)
// ============================================================
// One `_nuc_<mineral>(sim)` helper per supported hydroxide-class mineral.
// Each is a pure side-effecting function: reads sim state, conditionally
// calls sim.nucleate(...), and pushes a log line.
//
// VugSimulator.check_nucleation iterates over each class group via
// _nucleateClass_<klass>(sim). See 85-simulator.ts.
//
// Phase B15 of PROPOSAL-MODULAR-REFACTOR.

function _nuc_goethite(sim) {
  const sigma_goe = sim.conditions.supersaturation_goethite();
  const existing_goe_active = sim.crystals.filter(c => c.mineral === 'goethite' && c.active);
  const total_goe = sim.crystals.filter(c => c.mineral === 'goethite').length;
  if (sigma_goe > 1.0 && !existing_goe_active.length && total_goe < 3 && !sim._atNucleationCap('goethite')) {
    let pos = 'vug wall';
    const dissolving_py = sim.crystals.filter(c => c.mineral === 'pyrite' && c.dissolved);
    const dissolving_cp = sim.crystals.filter(c => c.mineral === 'chalcopyrite' && c.dissolved);
    const active_hem = sim.crystals.filter(c => c.mineral === 'hematite' && c.active);
    if (dissolving_py.length && rng.random() < 0.7) {
      pos = `pseudomorph after pyrite #${dissolving_py[0].crystal_id}`;
    } else if (dissolving_cp.length && rng.random() < 0.5) {
      pos = `pseudomorph after chalcopyrite #${dissolving_cp[0].crystal_id}`;
    } else if (active_hem.length && rng.random() < 0.3) {
      pos = `on hematite #${active_hem[0].crystal_id}`;
    }
    const c = sim.nucleate('goethite', pos, sigma_goe);
    sim.log.push(`  ✦ NUCLEATION: Goethite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_goe.toFixed(2)})`);
  }

  // Adamite nucleation — Zn + As + O₂, low T oxidation zone
}
function _nuc_lepidocrocite(sim) {
  const sigma_lep = sim.conditions.supersaturation_lepidocrocite();
  const existing_lep = sim.crystals.filter(c => c.mineral === 'lepidocrocite' && c.active);
  if (sigma_lep > 1.1 && !sim._atNucleationCap('lepidocrocite')) {
    if (!existing_lep.length || (sigma_lep > 1.7 && rng.random() < 0.25)) {
      let pos = 'vug wall';
      const dissolving_py_lep = sim.crystals.filter(c => c.mineral === 'pyrite' && c.dissolved);
      const active_qtz_lep = sim.crystals.filter(c => c.mineral === 'quartz' && c.active);
      if (dissolving_py_lep.length && rng.random() < 0.6) pos = `on pyrite #${dissolving_py_lep[0].crystal_id}`;
      else if (active_qtz_lep.length && rng.random() < 0.3) pos = `on quartz #${active_qtz_lep[0].crystal_id}`;
      const c = sim.nucleate('lepidocrocite', pos, sigma_lep);
      sim.log.push(`  ✦ NUCLEATION: Lepidocrocite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_lep.toFixed(2)}, Fe=${sim.conditions.fluid.Fe.toFixed(0)})`);
    }
  }

  // Stibnite nucleation — Sb + S + moderate T + reducing.
}

function _nucleateClass_hydroxide(sim) {
  _nuc_goethite(sim);
  _nuc_lepidocrocite(sim);
}
