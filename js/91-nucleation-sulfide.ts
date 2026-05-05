// ============================================================
// js/91-nucleation-sulfide.ts — per-mineral nucleation gates (sulfide)
// ============================================================
// One `_nuc_<mineral>(sim)` helper per supported sulfide-class mineral.
// Each is a pure side-effecting function: reads sim state, conditionally
// calls sim.nucleate(...), and pushes a log line.
//
// VugSimulator.check_nucleation iterates over each class group via
// _nucleateClass_<klass>(sim). See 85-simulator.ts.
//
// Phase B15 of PROPOSAL-MODULAR-REFACTOR.

function _nuc_sphalerite(sim) {
  const sigma_s = sim.conditions.supersaturation_sphalerite();
  const existing_sph = sim.crystals.filter(c => c.mineral === 'sphalerite' && c.active);
  if (sigma_s > 1.0 && !existing_sph.length && !sim._atNucleationCap('sphalerite')) {
    const c = sim.nucleate('sphalerite', 'vug wall', sigma_s);
    sim.log.push(`  ✦ NUCLEATION: Sphalerite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_s.toFixed(2)})`);
  }

  // Wurtzite nucleation — T>95°C hexagonal ZnS dimorph
}
function _nuc_wurtzite(sim) {
  const sigma_wz = sim.conditions.supersaturation_wurtzite();
  const existing_wz = sim.crystals.filter(c => c.mineral === 'wurtzite' && c.active);
  if (sigma_wz > 1.0 && !existing_wz.length && !sim._atNucleationCap('wurtzite')) {
    const c = sim.nucleate('wurtzite', 'vug wall', sigma_wz);
    sim.log.push(`  ✦ NUCLEATION: Wurtzite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_wz.toFixed(2)})`);
  }
}
function _nuc_pyrite(sim) {
  const sigma_py = sim.conditions.supersaturation_pyrite();
  const existing_py = sim.crystals.filter(c => c.mineral === 'pyrite' && c.active);
  if (sigma_py > 1.0 && !existing_py.length && !sim._atNucleationCap('pyrite')) {
    let pos = 'vug wall';
    const existing_sph2 = sim.crystals.filter(c => c.mineral === 'sphalerite' && c.active);
    if (existing_sph2.length && rng.random() < 0.5) {
      pos = `on sphalerite #${existing_sph2[0].crystal_id}`;
    }
    const c = sim.nucleate('pyrite', pos, sigma_py);
    sim.log.push(`  ✦ NUCLEATION: Pyrite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_py.toFixed(2)})`);
  }

  // Marcasite nucleation — pH<5, T<240. The acidic dimorph.
}
function _nuc_marcasite(sim) {
  const sigma_mc = sim.conditions.supersaturation_marcasite();
  const existing_mc = sim.crystals.filter(c => c.mineral === 'marcasite' && c.active);
  if (sigma_mc > 1.0 && !existing_mc.length && !sim._atNucleationCap('marcasite')) {
    let pos = 'vug wall';
    const existing_sph3 = sim.crystals.filter(c => c.mineral === 'sphalerite' && c.active);
    const existing_gal = sim.crystals.filter(c => c.mineral === 'galena' && c.active);
    if (existing_sph3.length && rng.random() < 0.5) {
      pos = `on sphalerite #${existing_sph3[0].crystal_id}`;
    } else if (existing_gal.length && rng.random() < 0.4) {
      pos = `on galena #${existing_gal[0].crystal_id}`;
    }
    const c = sim.nucleate('marcasite', pos, sigma_mc);
    sim.log.push(`  ✦ NUCLEATION: Marcasite #${c.crystal_id} on ${c.position} (pH=${sim.conditions.fluid.pH.toFixed(1)}, σ=${sigma_mc.toFixed(2)})`);
  }

  // Chalcopyrite nucleation
}
function _nuc_chalcopyrite(sim) {
  const existing_py = sim.crystals.filter(c => c.mineral === 'pyrite' && c.active);
  const sigma_cp = sim.conditions.supersaturation_chalcopyrite();
  const existing_cp = sim.crystals.filter(c => c.mineral === 'chalcopyrite' && c.active);
  if (sigma_cp > 1.0 && !existing_cp.length && !sim._atNucleationCap('chalcopyrite')) {
    let pos = 'vug wall';
    if (existing_py.length && rng.random() < 0.4) {
      pos = `on pyrite #${existing_py[0].crystal_id}`;
    }
    const c = sim.nucleate('chalcopyrite', pos, sigma_cp);
    sim.log.push(`  ✦ NUCLEATION: Chalcopyrite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_cp.toFixed(2)})`);
  }

  // Tetrahedrite nucleation — Sb-endmember fahlore, Cu-Sb-S hydrothermal.
}
function _nuc_tetrahedrite(sim) {
  const sigma_td = sim.conditions.supersaturation_tetrahedrite();
  const existing_td = sim.crystals.filter(c => c.mineral === 'tetrahedrite' && c.active);
  if (sigma_td > 1.0 && !existing_td.length && !sim._atNucleationCap('tetrahedrite')) {
    let pos = 'vug wall';
    const existing_cp2 = sim.crystals.filter(c => c.mineral === 'chalcopyrite' && c.active);
    const existing_py2 = sim.crystals.filter(c => c.mineral === 'pyrite' && c.active);
    if (existing_cp2.length && rng.random() < 0.5) pos = `on chalcopyrite #${existing_cp2[0].crystal_id}`;
    else if (existing_py2.length && rng.random() < 0.3) pos = `on pyrite #${existing_py2[0].crystal_id}`;
    const c = sim.nucleate('tetrahedrite', pos, sigma_td);
    sim.log.push(`  ✦ NUCLEATION: Tetrahedrite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_td.toFixed(2)})`);
  }

  // Tennantite nucleation — As-endmember fahlore.
}
function _nuc_tennantite(sim) {
  const sigma_tn = sim.conditions.supersaturation_tennantite();
  const existing_tn = sim.crystals.filter(c => c.mineral === 'tennantite' && c.active);
  if (sigma_tn > 1.0 && !existing_tn.length && !sim._atNucleationCap('tennantite')) {
    let pos = 'vug wall';
    const existing_cp3 = sim.crystals.filter(c => c.mineral === 'chalcopyrite' && c.active);
    const existing_td3 = sim.crystals.filter(c => c.mineral === 'tetrahedrite' && c.active);
    if (existing_cp3.length && rng.random() < 0.4) pos = `on chalcopyrite #${existing_cp3[0].crystal_id}`;
    else if (existing_td3.length && rng.random() < 0.3) pos = `alongside tetrahedrite #${existing_td3[0].crystal_id}`;
    const c = sim.nucleate('tennantite', pos, sigma_tn);
    sim.log.push(`  ✦ NUCLEATION: Tennantite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_tn.toFixed(2)})`);
  }

  // Apophyllite nucleation — alkaline silicate, low-T zeolite vesicle filling.
}
function _nuc_arsenopyrite(sim) {
  const sigma_apy = sim.conditions.supersaturation_arsenopyrite();
  if (sigma_apy > 1.2 && !sim._atNucleationCap('arsenopyrite')) {
    if (rng.random() < 0.12) {
      let pos = 'vug wall';
      const active_py_apy = sim.crystals.filter(c => c.mineral === 'pyrite' && c.active);
      const active_cp_apy = sim.crystals.filter(c => c.mineral === 'chalcopyrite' && c.active);
      if (active_py_apy.length && rng.random() < 0.5) {
        pos = `on pyrite #${active_py_apy[0].crystal_id}`;
      } else if (active_cp_apy.length && rng.random() < 0.3) {
        pos = `on chalcopyrite #${active_cp_apy[0].crystal_id}`;
      }
      const c = sim.nucleate('arsenopyrite', pos, sigma_apy);
      sim.log.push(`  ✦ NUCLEATION: ⚪ Arsenopyrite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_apy.toFixed(2)}, Fe=${sim.conditions.fluid.Fe.toFixed(0)}, As=${sim.conditions.fluid.As.toFixed(0)}, Au=${sim.conditions.fluid.Au.toFixed(2)} ppm) — striated diamond-section prisms; will trap invisible-gold`);
    }
  }

  // Scorodite nucleation — the arsenate supergene gateway; classic
  // "crystallized on dissolving arsenopyrite" habit. σ threshold 1.0
  // + per-check 0.20 reflect supergene speed. Substrate priority:
  // dissolving arsenopyrite (direct parent — the famous habit) >
  // active arsenopyrite > dissolving pyrite (often co-occurs) > vug
  // wall.
}
function _nuc_galena(sim) {
  const sigma_gal = sim.conditions.supersaturation_galena();
  const existing_gal = sim.crystals.filter(c => c.mineral === 'galena' && c.active);
  const total_gal = sim.crystals.filter(c => c.mineral === 'galena').length;
  if (sigma_gal > 1.0 && existing_gal.length < 4 && total_gal < 8 && !sim._atNucleationCap('galena')) {
    if (!existing_gal.length || (sigma_gal > 2.0 && rng.random() < 0.3)) {
      let pos = 'vug wall';
      const existing_sph3 = sim.crystals.filter(c => c.mineral === 'sphalerite' && c.active);
      if (existing_sph3.length && rng.random() < 0.4) {
        pos = `on sphalerite #${existing_sph3[0].crystal_id}`;
      }
      const c = sim.nucleate('galena', pos, sigma_gal);
      sim.log.push(`  ✦ NUCLEATION: Galena #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_gal.toFixed(2)})`);
    }
  }

  // Molybdenite nucleation — Mo + S at high T (porphyry), max 3 active / 6 total
}
function _nuc_molybdenite(sim) {
  const sigma_moly = sim.conditions.supersaturation_molybdenite();
  const existing_moly = sim.crystals.filter(c => c.mineral === 'molybdenite' && c.active);
  const total_moly = sim.crystals.filter(c => c.mineral === 'molybdenite').length;
  if (sigma_moly > 1.0 && existing_moly.length < 3 && total_moly < 6 && !sim._atNucleationCap('molybdenite')) {
    if (!existing_moly.length || (sigma_moly > 1.5 && rng.random() < 0.25)) {
      let pos = 'vug wall';
      // Often associates with chalcopyrite or pyrite in porphyry systems
      const existing_cp2 = sim.crystals.filter(c => c.mineral === 'chalcopyrite' && c.active);
      const existing_py2 = sim.crystals.filter(c => c.mineral === 'pyrite' && c.active);
      if (existing_cp2.length && rng.random() < 0.4) {
        pos = `on chalcopyrite #${existing_cp2[0].crystal_id}`;
      } else if (existing_py2.length && rng.random() < 0.3) {
        pos = `on pyrite #${existing_py2[0].crystal_id}`;
      }
      const c = sim.nucleate('molybdenite', pos, sigma_moly);
      sim.log.push(`  ✦ NUCLEATION: Molybdenite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_moly.toFixed(2)}) — Mo pulse arriving`);
    }
  }

  // Goethite nucleation — the ghost mineral, now real.
  // Classic pseudomorph after pyrite/marcasite; also forms on dissolving chalcopyrite.
}
function _nuc_stibnite(sim) {
  const sigma_stb = sim.conditions.supersaturation_stibnite();
  const existing_stb = sim.crystals.filter(c => c.mineral === 'stibnite' && c.active);
  if (sigma_stb > 1.2 && !sim._atNucleationCap('stibnite')) {
    if (!existing_stb.length || (sigma_stb > 1.8 && rng.random() < 0.2)) {
      let pos = 'vug wall';
      const active_qtz_stb = sim.crystals.filter(c => c.mineral === 'quartz' && c.active);
      if (active_qtz_stb.length && rng.random() < 0.4) pos = `on quartz #${active_qtz_stb[0].crystal_id}`;
      const c = sim.nucleate('stibnite', pos, sigma_stb);
      sim.log.push(`  ✦ NUCLEATION: Stibnite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_stb.toFixed(2)}, Sb=${sim.conditions.fluid.Sb.toFixed(0)}, S=${sim.conditions.fluid.S.toFixed(0)})`);
    }
  }

  // Bismuthinite nucleation — Bi + S + high T + reducing.
}
function _nuc_bismuthinite(sim) {
  const sigma_bmt = sim.conditions.supersaturation_bismuthinite();
  const existing_bmt = sim.crystals.filter(c => c.mineral === 'bismuthinite' && c.active);
  if (sigma_bmt > 1.3 && !sim._atNucleationCap('bismuthinite')) {
    if (!existing_bmt.length || (sigma_bmt > 1.8 && rng.random() < 0.2)) {
      let pos = 'vug wall';
      const active_qtz_bmt = sim.crystals.filter(c => c.mineral === 'quartz' && c.active);
      const active_cp_bmt = sim.crystals.filter(c => c.mineral === 'chalcopyrite' && c.active);
      if (active_qtz_bmt.length && rng.random() < 0.3) pos = `on quartz #${active_qtz_bmt[0].crystal_id}`;
      else if (active_cp_bmt.length && rng.random() < 0.3) pos = `on chalcopyrite #${active_cp_bmt[0].crystal_id}`;
      const c = sim.nucleate('bismuthinite', pos, sigma_bmt);
      sim.log.push(`  ✦ NUCLEATION: Bismuthinite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_bmt.toFixed(2)}, Bi=${sim.conditions.fluid.Bi.toFixed(0)}, S=${sim.conditions.fluid.S.toFixed(0)})`);
    }
  }

  // Native bismuth nucleation — Bi + very low S + reducing.
}
function _nuc_argentite(sim) {
  const sigma_arg = sim.conditions.supersaturation_argentite();
  if (sigma_arg > 1.0 && !sim._atNucleationCap('argentite')) {
    if (rng.random() < 0.18) {
      let pos = 'vug wall';
      const active_galena_arg = sim.crystals.filter(c => c.mineral === 'galena' && c.active);
      if (active_galena_arg.length && rng.random() < 0.4) pos = `on galena #${active_galena_arg[0].crystal_id}`;
      const c = sim.nucleate('argentite', pos, sigma_arg);
      sim.log.push(`  ✦ NUCLEATION: Argentite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_arg.toFixed(2)}, Ag=${sim.conditions.fluid.Ag.toFixed(2)}, S=${sim.conditions.fluid.S.toFixed(0)})`);
    }
  }

  // Chalcanthite nucleation — Cu + S + acidic + oxidizing + concentrated.
}
function _nuc_nickeline(sim) {
  const sigma_nik = sim.conditions.supersaturation_nickeline();
  if (sigma_nik > 1.0 && !sim._atNucleationCap('nickeline')) {
    if (rng.random() < 0.18) {
      let pos = 'vug wall';
      const active_apy_nik = sim.crystals.filter(c => c.mineral === 'arsenopyrite' && c.active);
      if (active_apy_nik.length && rng.random() < 0.4) pos = `on arsenopyrite #${active_apy_nik[0].crystal_id}`;
      const c = sim.nucleate('nickeline', pos, sigma_nik);
      sim.log.push(`  ✦ NUCLEATION: Nickeline #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_nik.toFixed(2)}, Ni=${sim.conditions.fluid.Ni.toFixed(0)}, As=${sim.conditions.fluid.As.toFixed(0)})`);
    }
  }

  // Millerite nucleation — Ni + S + reducing + As-poor.
}
function _nuc_millerite(sim) {
  const sigma_mil = sim.conditions.supersaturation_millerite();
  if (sigma_mil > 1.0 && !sim._atNucleationCap('millerite')) {
    if (rng.random() < 0.18) {
      let pos = 'vug wall';
      const active_pyr_mil = sim.crystals.filter(c => c.mineral === 'pyrite' && c.active);
      if (active_pyr_mil.length && rng.random() < 0.3) pos = `on pyrite #${active_pyr_mil[0].crystal_id}`;
      const c = sim.nucleate('millerite', pos, sigma_mil);
      sim.log.push(`  ✦ NUCLEATION: Millerite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_mil.toFixed(2)}, Ni=${sim.conditions.fluid.Ni.toFixed(0)}, S=${sim.conditions.fluid.S.toFixed(0)})`);
    }
  }

  // Cobaltite nucleation — three-element gate Co+As+S + reducing + high T.
}
function _nuc_cobaltite(sim) {
  const sigma_cob = sim.conditions.supersaturation_cobaltite();
  if (sigma_cob > 1.2 && !sim._atNucleationCap('cobaltite')) {
    if (rng.random() < 0.16) {
      let pos = 'vug wall';
      const active_apy_cob = sim.crystals.filter(c => c.mineral === 'arsenopyrite' && c.active);
      if (active_apy_cob.length && rng.random() < 0.5) pos = `on arsenopyrite #${active_apy_cob[0].crystal_id}`;
      const c = sim.nucleate('cobaltite', pos, sigma_cob);
      sim.log.push(`  ✦ NUCLEATION: Cobaltite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_cob.toFixed(2)}, Co=${sim.conditions.fluid.Co.toFixed(0)}, As=${sim.conditions.fluid.As.toFixed(0)}, S=${sim.conditions.fluid.S.toFixed(0)})`);
    }
  }

  // Native tellurium nucleation — Te + reducing + telluride-metal-poor.
}
function _nuc_acanthite(sim) {
  const sigma_aca = sim.conditions.supersaturation_acanthite();
  if (sigma_aca > 1.0 && !sim._atNucleationCap('acanthite')) {
    if (rng.random() < 0.18) {
      let pos = 'vug wall';
      const active_galena_aca = sim.crystals.filter(c => c.mineral === 'galena' && c.active);
      const dissolving_tet_aca = sim.crystals.filter(c => c.mineral === 'tetrahedrite' && c.dissolved);
      if (active_galena_aca.length && rng.random() < 0.4) pos = `on galena #${active_galena_aca[0].crystal_id}`;
      else if (dissolving_tet_aca.length && rng.random() < 0.6) pos = `on tetrahedrite #${dissolving_tet_aca[0].crystal_id}`;
      const c = sim.nucleate('acanthite', pos, sigma_aca);
      sim.log.push(`  ✦ NUCLEATION: Acanthite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_aca.toFixed(2)}, Ag=${sim.conditions.fluid.Ag.toFixed(2)}, S=${sim.conditions.fluid.S.toFixed(0)})`);
    }
  }

  // Clinobisvanite nucleation — Bi + V + oxidizing + low T.
}
function _nuc_bornite(sim) {
  const sigma_brn = sim.conditions.supersaturation_bornite();
  const existing_brn = sim.crystals.filter(c => c.mineral === 'bornite' && c.active);
  if (sigma_brn > 1.0 && !sim._atNucleationCap('bornite')) {
    if (!existing_brn.length || (sigma_brn > 1.7 && rng.random() < 0.2)) {
      let pos = 'vug wall';
      const dissolving_cp_brn = sim.crystals.filter(c => c.mineral === 'chalcopyrite' && c.dissolved);
      const active_cp_brn = sim.crystals.filter(c => c.mineral === 'chalcopyrite' && c.active);
      if (dissolving_cp_brn.length && rng.random() < 0.5) pos = `on chalcopyrite #${dissolving_cp_brn[0].crystal_id}`;
      else if (active_cp_brn.length && rng.random() < 0.3) pos = `on chalcopyrite #${active_cp_brn[0].crystal_id}`;
      const c = sim.nucleate('bornite', pos, sigma_brn);
      sim.log.push(`  ✦ NUCLEATION: Bornite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_brn.toFixed(2)}, Cu=${sim.conditions.fluid.Cu.toFixed(0)}, Fe=${sim.conditions.fluid.Fe.toFixed(0)})`);
    }
  }

  // Chalcocite nucleation — Cu-rich + S + low T + reducing.
}
function _nuc_chalcocite(sim) {
  const sigma_chc = sim.conditions.supersaturation_chalcocite();
  const existing_chc = sim.crystals.filter(c => c.mineral === 'chalcocite' && c.active);
  if (sigma_chc > 1.1 && !sim._atNucleationCap('chalcocite')) {
    if (!existing_chc.length || (sigma_chc > 1.7 && rng.random() < 0.25)) {
      let pos = 'vug wall';
      const dissolving_cp_chc = sim.crystals.filter(c => c.mineral === 'chalcopyrite' && c.dissolved);
      const active_cp_chc = sim.crystals.filter(c => c.mineral === 'chalcopyrite' && c.active);
      const dissolving_brn = sim.crystals.filter(c => c.mineral === 'bornite' && c.dissolved);
      const active_brn = sim.crystals.filter(c => c.mineral === 'bornite' && c.active);
      if (dissolving_cp_chc.length && rng.random() < 0.6) pos = `on chalcopyrite #${dissolving_cp_chc[0].crystal_id}`;
      else if (active_cp_chc.length && rng.random() < 0.4) pos = `on chalcopyrite #${active_cp_chc[0].crystal_id}`;
      else if (dissolving_brn.length && rng.random() < 0.6) pos = `on bornite #${dissolving_brn[0].crystal_id}`;
      else if (active_brn.length && rng.random() < 0.4) pos = `on bornite #${active_brn[0].crystal_id}`;
      const c = sim.nucleate('chalcocite', pos, sigma_chc);
      sim.log.push(`  ✦ NUCLEATION: Chalcocite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_chc.toFixed(2)}, Cu=${sim.conditions.fluid.Cu.toFixed(0)}, S=${sim.conditions.fluid.S.toFixed(0)})`);
    }
  }

  // Covellite nucleation — Cu + S-rich + low T (transition zone).
}
function _nuc_covellite(sim) {
  const sigma_cov = sim.conditions.supersaturation_covellite();
  const existing_cov = sim.crystals.filter(c => c.mineral === 'covellite' && c.active);
  if (sigma_cov > 1.2 && !sim._atNucleationCap('covellite')) {
    if (!existing_cov.length || (sigma_cov > 1.7 && rng.random() < 0.2)) {
      let pos = 'vug wall';
      const active_chc_cov = sim.crystals.filter(c => c.mineral === 'chalcocite' && c.active);
      const active_cp_cov = sim.crystals.filter(c => c.mineral === 'chalcopyrite' && c.active);
      if (active_chc_cov.length && rng.random() < 0.5) pos = `on chalcocite #${active_chc_cov[0].crystal_id}`;
      else if (active_cp_cov.length && rng.random() < 0.3) pos = `on chalcopyrite #${active_cp_cov[0].crystal_id}`;
      const c = sim.nucleate('covellite', pos, sigma_cov);
      sim.log.push(`  ✦ NUCLEATION: Covellite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_cov.toFixed(2)}, Cu=${sim.conditions.fluid.Cu.toFixed(0)}, S=${sim.conditions.fluid.S.toFixed(0)})`);
    }
  }

  // Anglesite nucleation — Pb + oxidized S + O₂ (supergene).
}

function _nucleateClass_sulfide(sim) {
  _nuc_sphalerite(sim);
  _nuc_wurtzite(sim);
  _nuc_pyrite(sim);
  _nuc_marcasite(sim);
  _nuc_chalcopyrite(sim);
  _nuc_tetrahedrite(sim);
  _nuc_tennantite(sim);
  _nuc_arsenopyrite(sim);
  _nuc_galena(sim);
  _nuc_molybdenite(sim);
  _nuc_stibnite(sim);
  _nuc_bismuthinite(sim);
  _nuc_argentite(sim);
  _nuc_nickeline(sim);
  _nuc_millerite(sim);
  _nuc_cobaltite(sim);
  _nuc_acanthite(sim);
  _nuc_bornite(sim);
  _nuc_chalcocite(sim);
  _nuc_covellite(sim);
}
