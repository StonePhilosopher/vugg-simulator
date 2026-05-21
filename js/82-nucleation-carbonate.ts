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

// Post-Tranche-6 (2026-05): air-mode nucleation probability per step.
// Cave-style scenarios (wall.air_mode_default = true) replace the
// strict serial gate `!existing_<mineral>.length` with a Bernoulli
// roll, bounded by the per-mineral max_nucleation_count. The result
// is multiple speleothems growing concurrently — Carlsbad caves have
// dozens of stalactites and stalagmites in the same chamber at once,
// not a strict one-at-a-time queue.
//
// 0.06 (6% per step) is calibrated so a 100-step run with σ always
// above threshold gives ~6 nucleations on average — comfortably below
// the per-mineral cap of 10 (calcite) or 4 (aragonite), with the cap
// providing the upper bound when σ is high for long stretches. Tuned
// empirically against stalactite_demo (target: 5-10 concurrent
// crystals so the c-axis world-down/up gravity bias is legibly
// demonstrated visually).
const _AIR_MODE_NUCLEATION_PROB = 0.06;

function _nuc_calcite(sim) {
  const sigma_c = sim.conditions.supersaturation_calcite();
  const existing_calcite = sim.crystals.filter(c => c.mineral === 'calcite' && c.active);
  const air_mode = !!(sim.conditions.wall && sim.conditions.wall.air_mode_default);
  // Air-mode (cave): drop the serial !existing_calcite gate, add a
  // probabilistic roll, still respect the per-mineral cap.
  // Water-mode (default): legacy serial gate — one active calcite at
  // a time per scenario, matching every scenario's existing baseline.
  const gateClear = air_mode
    ? (rng.random() < _AIR_MODE_NUCLEATION_PROB)
    : !existing_calcite.length;
  if (sigma_c > MINERAL_GATES_calcite.sigma_crit && gateClear && !sim._atNucleationCap('calcite')) {
    const c = sim.nucleate('calcite', 'vug wall', sigma_c);
    sim.log.push(`  ✦ NUCLEATION: Calcite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_c.toFixed(2)})`);
  }

  // Aragonite nucleation — Mg/Ca + T + Ω + trace Sr/Pb/Ba favorability.
}
function _nuc_aragonite(sim) {
  const sigma_arag = sim.conditions.supersaturation_aragonite();
  const existing_arag = sim.crystals.filter(c => c.mineral === 'aragonite' && c.active);
  const air_mode = !!(sim.conditions.wall && sim.conditions.wall.air_mode_default);
  // Air-mode path matches calcite above. See _AIR_MODE_NUCLEATION_PROB
  // for tuning rationale.
  const gateClear = air_mode
    ? (rng.random() < _AIR_MODE_NUCLEATION_PROB)
    : !existing_arag.length;
  if (sigma_arag > MINERAL_GATES_aragonite.sigma_crit && gateClear && !sim._atNucleationCap('aragonite')) {
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
  if (sigma_dol > MINERAL_GATES_dolomite.sigma_crit && !existing_dol.length && !sim._atNucleationCap('dolomite')) {
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
  if (sigma_sid > MINERAL_GATES_siderite.sigma_crit && !existing_sid.length && !sim._atNucleationCap('siderite')) {
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
  if (sigma_rho > MINERAL_GATES_rhodochrosite.sigma_crit && !existing_rho.length && !sim._atNucleationCap('rhodochrosite')) {
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
  if (existing_mal.length || total_mal >= 3 || sim._atNucleationCap('malachite')) return;
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
  const discount = sim._sigmaDiscountForPosition('malachite', pos);
  if (sigma_mal > MINERAL_GATES_malachite.sigma_crit * discount) {
    const c = sim.nucleate('malachite', pos, sigma_mal);
    sim.log.push(`  ✦ NUCLEATION: Malachite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_mal.toFixed(2)})`);
  }

  // Uraninite nucleation — needs sigma > 1.5, max 3 active / 5 total
}
function _nuc_smithsonite(sim) {
  const sigma_sm = sim.conditions.supersaturation_smithsonite();
  const existing_sm = sim.crystals.filter(c => c.mineral === 'smithsonite' && c.active);
  const total_sm = sim.crystals.filter(c => c.mineral === 'smithsonite').length;
  if (existing_sm.length || total_sm >= 3 || sim._atNucleationCap('smithsonite')) return;
  // Pick substrate first (preserve narrative qualifiers), then σ-check
  // with paragenesis discount for the chosen host.
  let pos = 'vug wall';
  const dissolved_sph = sim.crystals.filter(c => c.mineral === 'sphalerite' && c.dissolved);
  const any_sph = sim.crystals.filter(c => c.mineral === 'sphalerite');
  if (dissolved_sph.length && rng.random() < 0.7) {
    pos = `on sphalerite #${dissolved_sph[0].crystal_id} (oxidized)`;
  } else if (any_sph.length && rng.random() < 0.3) {
    pos = `on sphalerite #${any_sph[0].crystal_id}`;
  }
  const discount = sim._sigmaDiscountForPosition('smithsonite', pos);
  if (sigma_sm > MINERAL_GATES_smithsonite.sigma_crit * discount) {
    const c = sim.nucleate('smithsonite', pos, sigma_sm);
    sim.log.push(`  ✦ NUCLEATION: Smithsonite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_sm.toFixed(2)}) — zinc carbonate from oxidized sphalerite`);
  }

  // Wulfenite nucleation — needs sigma > 1.2, RARE: requires both Pb and Mo
}
function _nuc_azurite(sim) {
  const sigma_azr = sim.conditions.supersaturation_azurite();
  const existing_azr = sim.crystals.filter(c => c.mineral === 'azurite' && c.active);
  if (sim._atNucleationCap('azurite')) return;
  // Pick substrate first (preserve narrative), then σ-check with discount.
  let pos = 'vug wall';
  const active_cpr_azr = sim.crystals.filter(c => c.mineral === 'cuprite' && c.active);
  const active_nc_azr = sim.crystals.filter(c => c.mineral === 'native_copper' && c.active);
  if (active_cpr_azr.length && rng.random() < 0.4) pos = `on cuprite #${active_cpr_azr[0].crystal_id}`;
  else if (active_nc_azr.length && rng.random() < 0.3) pos = `on native_copper #${active_nc_azr[0].crystal_id}`;
  const discount = sim._sigmaDiscountForPosition('azurite', pos);
  if (sigma_azr > MINERAL_GATES_azurite.sigma_crit * discount) {
    if (!existing_azr.length || (sigma_azr > 2.0 && rng.random() < 0.25)) {
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
  if (sigma_cer > MINERAL_GATES_cerussite.sigma_crit && !sim._atNucleationCap('cerussite')) {
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
  if (sigma_ros > MINERAL_GATES_rosasite.sigma_crit && !sim._atNucleationCap('rosasite')) {
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
  if (sigma_aur > MINERAL_GATES_aurichalcite.sigma_crit && !sim._atNucleationCap('aurichalcite')) {
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

function _nuc_strontianite(sim) {
  const sigma = sim.conditions.supersaturation_strontianite();
  if (sigma > MINERAL_GATES_strontianite.sigma_crit && !sim._atNucleationCap('strontianite') && rng.random() < 0.15) {
    const c = sim.nucleate('strontianite', 'vug wall', sigma);
    sim.log.push(`  ✦ NUCLEATION: 🟠 Strontianite #${c.crystal_id} on ${c.position} (Sr ${sim.conditions.fluid.Sr.toFixed(0)} CO3 ${sim.conditions.fluid.CO3.toFixed(0)} ppm, σ=${sigma.toFixed(2)}) — pseudohex cyclic-twinned Sr carbonate`);
  }
}

function _nuc_witherite(sim) {
  const sigma = sim.conditions.supersaturation_witherite();
  if (sigma > MINERAL_GATES_witherite.sigma_crit && !sim._atNucleationCap('witherite') && rng.random() < 0.15) {
    let pos = 'vug wall';
    const flu = sim.crystals.filter(c => c.mineral === 'fluorite' && c.active);
    if (flu.length && rng.random() < 0.35) pos = `on fluorite #${flu[0].crystal_id} (Cave-in-Rock association)`;
    const c = sim.nucleate('witherite', pos, sigma);
    sim.log.push(`  ✦ NUCLEATION: 🟠 Witherite #${c.crystal_id} on ${c.position} (Ba ${sim.conditions.fluid.Ba.toFixed(0)} CO3 ${sim.conditions.fluid.CO3.toFixed(0)} ppm, σ=${sigma.toFixed(2)}) — pseudohex Ba carbonate, fluoresces bluish-white SW`);
  }
}

// v98 (2026-05-19): Hydrozincite — latest+coolest Zn supergene
// carbonate-hydroxide. Substrate priority encodes smithsonite-alteration
// + cave-floor paragenesis (Iglesiente Sardinia + Mežica Slovenia).
function _nuc_hydrozincite(sim) {
  const sigma = sim.conditions.supersaturation_hydrozincite();
  if (sigma < MINERAL_GATES_hydrozincite.sigma_crit) return;
  if (sim._atNucleationCap('hydrozincite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'hydrozincite' && c.active);
  if (existing.length >= 3) return;
  let pos = 'vug wall';
  const smith = sim.crystals.filter(c => c.mineral === 'smithsonite' && c.active);
  const aur = sim.crystals.filter(c => c.mineral === 'aurichalcite' && c.active);
  const cal = sim.crystals.filter(c => c.mineral === 'calcite' && c.active);
  if (smith.length && rng.random() < 0.60) pos = `alteration after smithsonite #${smith[0].crystal_id}`;
  else if (aur.length && rng.random() < 0.40) pos = `with aurichalcite #${aur[0].crystal_id}`;
  else if (cal.length && rng.random() < 0.30) pos = `cave-floor coating on calcite #${cal[0].crystal_id}`;
  const c = sim.nucleate('hydrozincite', pos, sigma);
  sim.log.push(`  ✦ NUCLEATION: ⚪ Hydrozincite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Zn=${sim.conditions.fluid.Zn.toFixed(0)}, CO₃=${sim.conditions.fluid.CO3.toFixed(0)}, pH=${sim.conditions.fluid.pH.toFixed(1)}) — chalk-white Zn-carbonate-hydroxide, pale-blue SW-UV fluorescent`);
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
  _nuc_strontianite(sim);
  _nuc_witherite(sim);
  _nuc_hydrozincite(sim);
}
