// ============================================================
// js/80-nucleation-arsenate.ts — per-mineral nucleation gates (arsenate)
// ============================================================
// One `_nuc_<mineral>(sim)` helper per supported arsenate-class mineral.
// Each is a pure side-effecting function: reads sim state, conditionally
// calls sim.nucleate(...), and pushes a log line.
//
// VugSimulator.check_nucleation iterates over each class group via
// _nucleateClass_<klass>(sim). See 85-simulator.ts.
//
// Phase B15 of PROPOSAL-MODULAR-REFACTOR.

function _nuc_scorodite(sim) {
  const sigma_sco = sim.conditions.supersaturation_scorodite();
  if (sigma_sco > 1.0 && !sim._atNucleationCap('scorodite')) {
    if (rng.random() < 0.20) {
      let pos = 'vug wall';
      const diss_apy_sco = sim.crystals.filter(c => c.mineral === 'arsenopyrite' && c.dissolved);
      const active_apy_sco = sim.crystals.filter(c => c.mineral === 'arsenopyrite' && c.active);
      const diss_py_sco = sim.crystals.filter(c => c.mineral === 'pyrite' && c.dissolved);
      if (diss_apy_sco.length && rng.random() < 0.8) {
        pos = `on dissolving arsenopyrite #${diss_apy_sco[0].crystal_id}`;
      } else if (active_apy_sco.length && rng.random() < 0.5) {
        pos = `on arsenopyrite #${active_apy_sco[0].crystal_id}`;
      } else if (diss_py_sco.length && rng.random() < 0.4) {
        pos = `on dissolving pyrite #${diss_py_sco[0].crystal_id}`;
      }
      const c = sim.nucleate('scorodite', pos, sigma_sco);
      sim.log.push(`  ✦ NUCLEATION: 💎 Scorodite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_sco.toFixed(2)}, Fe=${sim.conditions.fluid.Fe.toFixed(0)}, As=${sim.conditions.fluid.As.toFixed(0)}, pH=${sim.conditions.fluid.pH.toFixed(1)}) — pale blue-green dipyramids, sequesters arsenic`);
    }
  }

  // Barite nucleation — the Ba sequestration mineral. σ threshold 1.0
  // + per-check 0.15. Wide-T habit; substrate-agnostic but in MVT often
  // perches near galena/sphalerite (co-precipitation paragenesis).
}
function _nuc_adamite(sim) {
  const existing_hem = sim.crystals.filter(c => c.mineral === 'hematite' && c.active);
  const sigma_adam = sim.conditions.supersaturation_adamite();
  const existing_adam = sim.crystals.filter(c => c.mineral === 'adamite' && c.active);
  const total_adam = sim.crystals.filter(c => c.mineral === 'adamite').length;
  if (sigma_adam > 1.0 && !existing_adam.length && total_adam < 4 && !sim._atNucleationCap('adamite')) {
    let pos = 'vug wall';
    const existing_goe = sim.crystals.filter(c => c.mineral === 'goethite' && c.active);
    if (existing_goe.length && rng.random() < 0.6) {
      pos = `on goethite #${existing_goe[0].crystal_id}`;
    } else if (existing_hem.length && rng.random() < 0.4) {
      pos = `on hematite #${existing_hem[0].crystal_id}`;
    }
    const c = sim.nucleate('adamite', pos, sigma_adam);
    sim.log.push(`  ✦ NUCLEATION: Adamite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_adam.toFixed(2)})`);
    // Second crystal — fluorescent/non-fluorescent pair
    if (sigma_adam > 1.3 && rng.random() < 0.5 && !sim._atNucleationCap('adamite')) {
      const c2 = sim.nucleate('adamite', pos, sigma_adam);
      sim.log.push(`  ✦ NUCLEATION: Adamite #${c2.crystal_id} alongside #${c.crystal_id} — will one fluoresce and the other stay dark?`);
    }
  }

  // Mimetite nucleation — Pb + As + Cl + O₂, oxidation zone
}
function _nuc_mimetite(sim) {
  const sigma_mim = sim.conditions.supersaturation_mimetite();
  const existing_mim = sim.crystals.filter(c => c.mineral === 'mimetite' && c.active);
  const total_mim = sim.crystals.filter(c => c.mineral === 'mimetite').length;
  if (sigma_mim > 1.0 && !existing_mim.length && total_mim < 3 && !sim._atNucleationCap('mimetite')) {
    let pos = 'vug wall';
    const existing_gal2 = sim.crystals.filter(c => c.mineral === 'galena');
    const existing_goe2 = sim.crystals.filter(c => c.mineral === 'goethite' && c.active);
    if (existing_gal2.length && rng.random() < 0.6) {
      pos = `on galena #${existing_gal2[0].crystal_id}`;
    } else if (existing_goe2.length && rng.random() < 0.3) {
      pos = `on goethite #${existing_goe2[0].crystal_id}`;
    }
    const c = sim.nucleate('mimetite', pos, sigma_mim);
    sim.log.push(`  ✦ NUCLEATION: Mimetite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_mim.toFixed(2)})`);
  }

  // Erythrite nucleation — the cobalt bloom, low-T oxidation of Co arsenides.
}
function _nuc_erythrite(sim) {
  const sigma_ery = sim.conditions.supersaturation_erythrite();
  const existing_ery = sim.crystals.filter(c => c.mineral === 'erythrite' && c.active);
  if (sigma_ery > 1.0 && !existing_ery.length && !sim._atNucleationCap('erythrite')) {
    let pos = 'vug wall';
    const existing_goe_e = sim.crystals.filter(c => c.mineral === 'goethite' && c.active);
    const existing_adam_e = sim.crystals.filter(c => c.mineral === 'adamite' && c.active);
    if (existing_goe_e.length && rng.random() < 0.5) {
      pos = `on goethite #${existing_goe_e[0].crystal_id}`;
    } else if (existing_adam_e.length && rng.random() < 0.3) {
      pos = `on adamite #${existing_adam_e[0].crystal_id}`;
    }
    const c = sim.nucleate('erythrite', pos, sigma_ery);
    sim.log.push(`  ✦ NUCLEATION: Erythrite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_ery.toFixed(2)})`);
  }

  // Annabergite nucleation — the nickel bloom, Ni equivalent of erythrite.
}
function _nuc_annabergite(sim) {
  const sigma_ann = sim.conditions.supersaturation_annabergite();
  const existing_ann = sim.crystals.filter(c => c.mineral === 'annabergite' && c.active);
  if (sigma_ann > 1.0 && !existing_ann.length && !sim._atNucleationCap('annabergite')) {
    let pos = 'vug wall';
    const existing_goe_a = sim.crystals.filter(c => c.mineral === 'goethite' && c.active);
    const existing_ery_a = sim.crystals.filter(c => c.mineral === 'erythrite' && c.active);
    if (existing_goe_a.length && rng.random() < 0.5) {
      pos = `on goethite #${existing_goe_a[0].crystal_id}`;
    } else if (existing_ery_a.length && rng.random() < 0.3) {
      pos = `alongside erythrite #${existing_ery_a[0].crystal_id}`;
    }
    const c = sim.nucleate('annabergite', pos, sigma_ann);
    sim.log.push(`  ✦ NUCLEATION: Annabergite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_ann.toFixed(2)})`);
  }

  // Magnetite nucleation — Fe + moderate O2 (HM buffer).
}
function _nuc_olivenite(sim) {
  const sigma_oli = sim.conditions.supersaturation_olivenite();
  if (sigma_oli > 1.0 && !sim._atNucleationCap('olivenite')) {
    if (rng.random() < 0.18) {
      let pos = 'vug wall';
      const active_mal_oli = sim.crystals.filter(c => c.mineral === 'malachite' && c.active);
      if (active_mal_oli.length && rng.random() < 0.3) pos = `on malachite #${active_mal_oli[0].crystal_id}`;
      const c = sim.nucleate('olivenite', pos, sigma_oli);
      sim.log.push(`  ✦ NUCLEATION: Olivenite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_oli.toFixed(2)}, Cu=${sim.conditions.fluid.Cu.toFixed(0)}, As=${sim.conditions.fluid.As.toFixed(0)})`);
    }
  }

  // Nickeline nucleation — Ni + As + reducing + high T.
}

function _nucleateClass_arsenate(sim) {
  _nuc_scorodite(sim);
  _nuc_adamite(sim);
  _nuc_mimetite(sim);
  _nuc_erythrite(sim);
  _nuc_annabergite(sim);
  _nuc_olivenite(sim);
}
