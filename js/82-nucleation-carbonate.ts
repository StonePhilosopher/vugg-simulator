// ============================================================
// js/82-nucleation-carbonate.ts — per-mineral nucleation gates (carbonate)
// ============================================================
// One `_nuc_<mineral>(sim)` helper per supported carbonate-class mineral.
// Each is a pure side-effecting function: reads sim state, conditionally
// calls sim.nucleate(...), and pushes a log line.
//
// VugSimulator.check_nucleation iterates over each class group via
// _nucleateClass_<klass>(sim). See 85-simulator.ts.
//
// Phase B15 of PROPOSAL-MODULAR-REFACTOR.

function _nuc_calcite(sim) {
  const sigma_c = sim.conditions.supersaturation_calcite();
  const existing_calcite = sim.crystals.filter(c => c.mineral === 'calcite' && c.active);
  if (sigma_c > 1.3 && !existing_calcite.length && !sim._atNucleationCap('calcite')) {
    const c = sim.nucleate('calcite', 'vug wall', sigma_c);
    sim.log.push(`  ✦ NUCLEATION: Calcite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_c.toFixed(2)})`);
  }

  // Aragonite nucleation — Mg/Ca + T + Ω + trace Sr/Pb/Ba favorability.
}
function _nuc_aragonite(sim) {
  const sigma_arag = sim.conditions.supersaturation_aragonite();
  const existing_arag = sim.crystals.filter(c => c.mineral === 'aragonite' && c.active);
  if (sigma_arag > 1.0 && !existing_arag.length && !sim._atNucleationCap('aragonite')) {
    let pos = 'vug wall';
    const existing_goe_a = sim.crystals.filter(c => c.mineral === 'goethite' && c.active);
    const existing_hem_a = sim.crystals.filter(c => c.mineral === 'hematite' && c.active);
    if (existing_goe_a.length && rng.random() < 0.4) pos = `on goethite #${existing_goe_a[0].crystal_id}`;
    else if (existing_hem_a.length && rng.random() < 0.3) pos = `on hematite #${existing_hem_a[0].crystal_id}`;
    const mg_ratio = sim.conditions.fluid.Mg / Math.max(sim.conditions.fluid.Ca, 0.01);
    const c = sim.nucleate('aragonite', pos, sigma_arag);
    sim.log.push(`  ✦ NUCLEATION: Aragonite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, Mg/Ca=${mg_ratio.toFixed(2)}, σ=${sigma_arag.toFixed(2)})`);
  }

  // Dolomite nucleation — Ca-Mg carbonate, needs both cations + T > 50°C.
}
function _nuc_dolomite(sim) {
  const sigma_dol = sim.conditions.supersaturation_dolomite();
  const existing_dol = sim.crystals.filter(c => c.mineral === 'dolomite' && c.active);
  if (sigma_dol > 1.0 && !existing_dol.length && !sim._atNucleationCap('dolomite')) {
    let pos = 'vug wall';
    const existing_cal_d = sim.crystals.filter(c => c.mineral === 'calcite' && c.active);
    if (existing_cal_d.length && rng.random() < 0.4) pos = `on calcite #${existing_cal_d[0].crystal_id}`;
    const mg_ratio = sim.conditions.fluid.Mg / Math.max(sim.conditions.fluid.Ca, 0.01);
    const c = sim.nucleate('dolomite', pos, sigma_dol);
    sim.log.push(`  ✦ NUCLEATION: Dolomite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, Mg/Ca=${mg_ratio.toFixed(2)}, σ=${sigma_dol.toFixed(2)})`);
  }

  // Siderite nucleation — Fe carbonate, brown rhomb. Reducing only.
}
function _nuc_siderite(sim) {
  const sigma_sid = sim.conditions.supersaturation_siderite();
  const existing_sid = sim.crystals.filter(c => c.mineral === 'siderite' && c.active);
  if (sigma_sid > 1.0 && !existing_sid.length && !sim._atNucleationCap('siderite')) {
    let pos = 'vug wall';
    const existing_py_s = sim.crystals.filter(c => c.mineral === 'pyrite' && c.active);
    const existing_sph_s = sim.crystals.filter(c => c.mineral === 'sphalerite' && c.active);
    if (existing_py_s.length && rng.random() < 0.4) pos = `on pyrite #${existing_py_s[0].crystal_id}`;
    else if (existing_sph_s.length && rng.random() < 0.3) pos = `on sphalerite #${existing_sph_s[0].crystal_id}`;
    const c = sim.nucleate('siderite', pos, sigma_sid);
    sim.log.push(`  ✦ NUCLEATION: Siderite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, Fe=${sim.conditions.fluid.Fe.toFixed(0)}, σ=${sigma_sid.toFixed(2)})`);
  }

  // Rhodochrosite nucleation — Mn carbonate, the pink mineral.
}
function _nuc_rhodochrosite(sim) {
  const sigma_rho = sim.conditions.supersaturation_rhodochrosite();
  const existing_rho = sim.crystals.filter(c => c.mineral === 'rhodochrosite' && c.active);
  if (sigma_rho > 1.0 && !existing_rho.length && !sim._atNucleationCap('rhodochrosite')) {
    let pos = 'vug wall';
    const existing_goe_r = sim.crystals.filter(c => c.mineral === 'goethite' && c.active);
    const existing_py_r = sim.crystals.filter(c => c.mineral === 'pyrite' && c.active);
    const existing_sph_r = sim.crystals.filter(c => c.mineral === 'sphalerite' && c.active);
    if (existing_goe_r.length && rng.random() < 0.5) pos = `on goethite #${existing_goe_r[0].crystal_id}`;
    else if (existing_sph_r.length && rng.random() < 0.4) pos = `on sphalerite #${existing_sph_r[0].crystal_id}`;
    else if (existing_py_r.length && rng.random() < 0.3) pos = `on pyrite #${existing_py_r[0].crystal_id}`;
    const c = sim.nucleate('rhodochrosite', pos, sigma_rho);
    sim.log.push(`  ✦ NUCLEATION: Rhodochrosite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, Mn=${sim.conditions.fluid.Mn.toFixed(0)}, σ=${sigma_rho.toFixed(2)})`);
  }
}
function _nuc_malachite(sim) {
  const existing_hem = sim.crystals.filter(c => c.mineral === 'hematite' && c.active);
  const sigma_mal = sim.conditions.supersaturation_malachite();
  const existing_mal = sim.crystals.filter(c => c.mineral === 'malachite' && c.active);
  const total_mal = sim.crystals.filter(c => c.mineral === 'malachite').length;
  if (sigma_mal > 1.0 && !existing_mal.length && total_mal < 3 && !sim._atNucleationCap('malachite')) {
    let pos = 'vug wall';
    // Preference for chalcopyrite surface (classic oxidation paragenesis!)
    const dissolving_cp = sim.crystals.filter(c => c.mineral === 'chalcopyrite' && c.dissolved);
    const active_cp_all = sim.crystals.filter(c => c.mineral === 'chalcopyrite');
    if (dissolving_cp.length && rng.random() < 0.7) {
      pos = `on chalcopyrite #${dissolving_cp[0].crystal_id}`;
    } else if (active_cp_all.length && rng.random() < 0.4) {
      pos = `on chalcopyrite #${active_cp_all[0].crystal_id}`;
    } else if (existing_hem.length && rng.random() < 0.3) {
      pos = `on hematite #${existing_hem[0].crystal_id}`;
    }
    const c = sim.nucleate('malachite', pos, sigma_mal);
    sim.log.push(`  ✦ NUCLEATION: Malachite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_mal.toFixed(2)})`);
  }

  // Uraninite nucleation — needs sigma > 1.5, max 3 active / 5 total
}
function _nuc_smithsonite(sim) {
  const sigma_sm = sim.conditions.supersaturation_smithsonite();
  const existing_sm = sim.crystals.filter(c => c.mineral === 'smithsonite' && c.active);
  const total_sm = sim.crystals.filter(c => c.mineral === 'smithsonite').length;
  if (sigma_sm > 1.0 && !existing_sm.length && total_sm < 3 && !sim._atNucleationCap('smithsonite')) {
    let pos = 'vug wall';
    // Prefers to nucleate on dissolved sphalerite — classic oxidation zone paragenesis
    const dissolved_sph = sim.crystals.filter(c => c.mineral === 'sphalerite' && c.dissolved);
    const any_sph = sim.crystals.filter(c => c.mineral === 'sphalerite');
    if (dissolved_sph.length && rng.random() < 0.7) {
      pos = `on sphalerite #${dissolved_sph[0].crystal_id} (oxidized)`;
    } else if (any_sph.length && rng.random() < 0.3) {
      pos = `on sphalerite #${any_sph[0].crystal_id}`;
    }
    const c = sim.nucleate('smithsonite', pos, sigma_sm);
    sim.log.push(`  ✦ NUCLEATION: Smithsonite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_sm.toFixed(2)}) — zinc carbonate from oxidized sphalerite`);
  }

  // Wulfenite nucleation — needs sigma > 1.2, RARE: requires both Pb and Mo
}
function _nuc_azurite(sim) {
  const sigma_azr = sim.conditions.supersaturation_azurite();
  const existing_azr = sim.crystals.filter(c => c.mineral === 'azurite' && c.active);
  if (sigma_azr > 1.4 && !sim._atNucleationCap('azurite')) {
    if (!existing_azr.length || (sigma_azr > 2.0 && rng.random() < 0.25)) {
      let pos = 'vug wall';
      const active_cpr_azr = sim.crystals.filter(c => c.mineral === 'cuprite' && c.active);
      const active_nc_azr = sim.crystals.filter(c => c.mineral === 'native_copper' && c.active);
      if (active_cpr_azr.length && rng.random() < 0.4) pos = `on cuprite #${active_cpr_azr[0].crystal_id}`;
      else if (active_nc_azr.length && rng.random() < 0.3) pos = `on native_copper #${active_nc_azr[0].crystal_id}`;
      const c = sim.nucleate('azurite', pos, sigma_azr);
      sim.log.push(`  ✦ NUCLEATION: Azurite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_azr.toFixed(2)}, Cu=${sim.conditions.fluid.Cu.toFixed(0)}, CO₃=${sim.conditions.fluid.CO3.toFixed(0)})`);
    }
  }

  // Chrysocolla nucleation — Cu²⁺ + SiO₂ at low-T oxidation, the
  // cyan finale of the copper paragenesis. Pseudomorphs azurite when
  // the pCO₂ drop arrives with silica — the Bisbee signature.
}
function _nuc_cerussite(sim) {
  const sigma_cer = sim.conditions.supersaturation_cerussite();
  const existing_cer = sim.crystals.filter(c => c.mineral === 'cerussite' && c.active);
  if (sigma_cer > 1.0 && !sim._atNucleationCap('cerussite')) {
    if (!existing_cer.length || (sigma_cer > 1.8 && rng.random() < 0.3)) {
      let pos = 'vug wall';
      const dissolving_ang = sim.crystals.filter(c => c.mineral === 'anglesite' && c.dissolved);
      const dissolving_gal_c = sim.crystals.filter(c => c.mineral === 'galena' && c.dissolved);
      const active_gal_c = sim.crystals.filter(c => c.mineral === 'galena' && c.active);
      if (dissolving_ang.length && rng.random() < 0.7) pos = `on anglesite #${dissolving_ang[0].crystal_id}`;
      else if (dissolving_gal_c.length && rng.random() < 0.5) pos = `on galena #${dissolving_gal_c[0].crystal_id}`;
      else if (active_gal_c.length && rng.random() < 0.3) pos = `on galena #${active_gal_c[0].crystal_id}`;
      const c = sim.nucleate('cerussite', pos, sigma_cer);
      sim.log.push(`  ✦ NUCLEATION: Cerussite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_cer.toFixed(2)}, Pb=${sim.conditions.fluid.Pb.toFixed(0)}, CO3=${sim.conditions.fluid.CO3.toFixed(0)})`);
    }
  }

  // Pyromorphite nucleation — Pb + P + Cl (supergene, P-gated).
}
function _nuc_rosasite(sim) {
  const sigma_ros = sim.conditions.supersaturation_rosasite();
  if (sigma_ros > 1.0 && !sim._atNucleationCap('rosasite')) {
    if (rng.random() < 0.20) {
      let pos = 'vug wall';
      const weathering_cpy = sim.crystals.filter(c => c.mineral === 'chalcopyrite' && c.dissolved);
      const weathering_sph = sim.crystals.filter(c => c.mineral === 'sphalerite' && c.dissolved);
      if (weathering_cpy.length && rng.random() < 0.4) {
        pos = `on weathering chalcopyrite #${weathering_cpy[0].crystal_id}`;
      } else if (weathering_sph.length && rng.random() < 0.3) {
        pos = `on weathering sphalerite #${weathering_sph[0].crystal_id}`;
      }
      const c = sim.nucleate('rosasite', pos, sigma_ros);
      const cu_zn = sim.conditions.fluid.Cu + sim.conditions.fluid.Zn;
      const cu_pct = cu_zn > 0 ? (sim.conditions.fluid.Cu / cu_zn * 100) : 0;
      sim.log.push(`  ✦ NUCLEATION: Rosasite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_ros.toFixed(2)}, Cu=${sim.conditions.fluid.Cu.toFixed(0)}, Zn=${sim.conditions.fluid.Zn.toFixed(0)}, Cu-fraction=${cu_pct.toFixed(0)}%) — broth-ratio branch: Cu-dominant`);
    }
  }

  // Aurichalcite nucleation — Zn-dominant supergene carbonate (Round 9a).
  // Mirror of rosasite. Substrate preference: weathering sphalerite or
  // adjacent active rosasite (the two species are commonly intergrown).
}
function _nuc_aurichalcite(sim) {
  const sigma_aur = sim.conditions.supersaturation_aurichalcite();
  if (sigma_aur > 1.0 && !sim._atNucleationCap('aurichalcite')) {
    if (rng.random() < 0.20) {
      let pos = 'vug wall';
      const weathering_sph = sim.crystals.filter(c => c.mineral === 'sphalerite' && c.dissolved);
      const active_ros = sim.crystals.filter(c => c.mineral === 'rosasite' && c.active);
      if (weathering_sph.length && rng.random() < 0.4) {
        pos = `on weathering sphalerite #${weathering_sph[0].crystal_id}`;
      } else if (active_ros.length && rng.random() < 0.4) {
        pos = `adjacent to rosasite #${active_ros[0].crystal_id}`;
      }
      const c = sim.nucleate('aurichalcite', pos, sigma_aur);
      const cu_zn = sim.conditions.fluid.Cu + sim.conditions.fluid.Zn;
      const zn_pct = cu_zn > 0 ? (sim.conditions.fluid.Zn / cu_zn * 100) : 0;
      sim.log.push(`  ✦ NUCLEATION: Aurichalcite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_aur.toFixed(2)}, Cu=${sim.conditions.fluid.Cu.toFixed(0)}, Zn=${sim.conditions.fluid.Zn.toFixed(0)}, Zn-fraction=${zn_pct.toFixed(0)}%) — broth-ratio branch: Zn-dominant`);
    }
  }

  // Torbernite nucleation — P-branch of the uranyl anion-competition
  // trio (Round 9b). Substrate preference: weathering uraninite or wall.
}

function _nucleateClass_carbonate(sim) {
  _nuc_calcite(sim);
  _nuc_aragonite(sim);
  _nuc_dolomite(sim);
  _nuc_siderite(sim);
  _nuc_rhodochrosite(sim);
  _nuc_malachite(sim);
  _nuc_smithsonite(sim);
  _nuc_azurite(sim);
  _nuc_cerussite(sim);
  _nuc_rosasite(sim);
  _nuc_aurichalcite(sim);
}
