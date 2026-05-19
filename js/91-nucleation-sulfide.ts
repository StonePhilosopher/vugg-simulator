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
  // 2026-05 cascade-gate audit Arc 3 calibration tier: threshold 1.2 → 1.0.
  // After the Arc 1 activity-correction copy-paste fix (e9248c5) lifted
  // stibnite's σ in porphyry from 0.87 to 1.16, σ was just under the 1.2
  // outlier threshold. Sibling sulfides (pyrite, marcasite, chalcopyrite,
  // galena, etc.) use σ>1.0 as the canonical lower-tier nucleation gate.
  // Dropping stibnite to match completes the audit's stibnite arc.
  if (sigma_stb > 1.0 && !sim._atNucleationCap('stibnite')) {
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
// Cinnabar (HgS) — mercury sulfide. Hot-spring deposit nucleation:
// gated by Hg + S availability + mildly-reducing redox. Broad pH
// tolerance (acid Sulphur Bank style and mildly-alkaline Sicily style
// both fire). The nucleation threshold σ > 1.0 follows the same
// canonical lower-tier gate used by pyrite/marcasite/galena.
//
// Substrate preference: cinnabar at Sulphur Bank often nucleates on
// or alongside native_sulfur (both products of the H₂S + O₂ mixing
// zone). At Almadén the substrate is typically quartz veining. The
// nucleation handler weights these accordingly.
function _nuc_cinnabar(sim) {
  const sigma_cb = sim.conditions.supersaturation_cinnabar();
  const existing_cb = sim.crystals.filter(c => c.mineral === 'cinnabar' && c.active);
  if (sigma_cb > 1.0 && !sim._atNucleationCap('cinnabar')) {
    if (!existing_cb.length || (sigma_cb > 1.8 && rng.random() < 0.2)) {
      let pos = 'vug wall';
      const active_ns = sim.crystals.filter(c => c.mineral === 'native_sulfur' && c.active);
      const active_qtz_cb = sim.crystals.filter(c => c.mineral === 'quartz' && c.active);
      // Substrate preference: native_sulfur > quartz > wall.
      // At Sulphur Bank, cinnabar and native_sulfur are co-deposited
      // in the same mixing zone, so substrate association is real.
      if (active_ns.length && rng.random() < 0.4) pos = `on native_sulfur #${active_ns[0].crystal_id}`;
      else if (active_qtz_cb.length && rng.random() < 0.3) pos = `on quartz #${active_qtz_cb[0].crystal_id}`;
      const c = sim.nucleate('cinnabar', pos, sigma_cb);
      sim.log.push(`  ✦ NUCLEATION: Cinnabar #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_cb.toFixed(2)}, Hg=${sim.conditions.fluid.Hg.toFixed(1)}, S=${sim.conditions.fluid.S.toFixed(0)})`);
    }
  }
}

// Realgar (AsS) — orange-red As-sulfide. Hot-spring + epithermal
// deposit. Substrate preference at Sulphur Bank: nucleates alongside
// native_sulfur (same H₂S + O₂ mixing zone) > on existing arsenopyrite
// > on quartz > free wall. Allchar's realgar specimens grow on calcite
// + dolomite — different scenario, different substrate logic.
function _nuc_realgar(sim) {
  const sigma_rlg = sim.conditions.supersaturation_realgar();
  const existing_rlg = sim.crystals.filter(c => c.mineral === 'realgar' && c.active);
  if (sigma_rlg > 1.0 && !sim._atNucleationCap('realgar')) {
    if (!existing_rlg.length || (sigma_rlg > 1.8 && rng.random() < 0.2)) {
      let pos = 'vug wall';
      const active_ns = sim.crystals.filter(c => c.mineral === 'native_sulfur' && c.active);
      const active_apy = sim.crystals.filter(c => c.mineral === 'arsenopyrite' && c.active);
      const active_qtz = sim.crystals.filter(c => c.mineral === 'quartz' && c.active);
      if (active_ns.length && rng.random() < 0.35) pos = `on native_sulfur #${active_ns[0].crystal_id}`;
      else if (active_apy.length && rng.random() < 0.30) pos = `on arsenopyrite #${active_apy[0].crystal_id}`;
      else if (active_qtz.length && rng.random() < 0.25) pos = `on quartz #${active_qtz[0].crystal_id}`;
      const c = sim.nucleate('realgar', pos, sigma_rlg);
      sim.log.push(`  ✦ NUCLEATION: Realgar #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_rlg.toFixed(2)}, As=${sim.conditions.fluid.As.toFixed(1)}, S=${sim.conditions.fluid.S.toFixed(0)})`);
    }
  }
}

// Orpiment (As₂S₃) — golden-yellow As-sulfide. Same depositional
// environment as realgar; tends to nucleate ON realgar (or alongside)
// in many specimens (the Allchar + Shimen + Getchell type material).
function _nuc_orpiment(sim) {
  const sigma_orp = sim.conditions.supersaturation_orpiment();
  const existing_orp = sim.crystals.filter(c => c.mineral === 'orpiment' && c.active);
  if (sigma_orp > 1.0 && !sim._atNucleationCap('orpiment')) {
    if (!existing_orp.length || (sigma_orp > 1.8 && rng.random() < 0.2)) {
      let pos = 'vug wall';
      const active_rlg = sim.crystals.filter(c => c.mineral === 'realgar' && c.active);
      const active_ns = sim.crystals.filter(c => c.mineral === 'native_sulfur' && c.active);
      const active_apy = sim.crystals.filter(c => c.mineral === 'arsenopyrite' && c.active);
      // Orpiment prefers realgar substrate (co-deposition, then
      // overgrowth as σ-trajectory shifts S/As ratio toward orpiment-
      // favored). Falls through to native_sulfur, arsenopyrite, wall.
      if (active_rlg.length && rng.random() < 0.40) pos = `on realgar #${active_rlg[0].crystal_id}`;
      else if (active_ns.length && rng.random() < 0.30) pos = `on native_sulfur #${active_ns[0].crystal_id}`;
      else if (active_apy.length && rng.random() < 0.25) pos = `on arsenopyrite #${active_apy[0].crystal_id}`;
      const c = sim.nucleate('orpiment', pos, sigma_orp);
      sim.log.push(`  ✦ NUCLEATION: Orpiment #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_orp.toFixed(2)}, As=${sim.conditions.fluid.As.toFixed(1)}, S=${sim.conditions.fluid.S.toFixed(0)})`);
    }
  }
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

// v95 (2026-05-19): Diarsenide quartet nucleation. The four primary
// arsenides of the Schneeberg / Jachymov / Cobalt-Ontario / Bou Azzer
// five-element-vein paragenesis. Substrate priority encodes Kissin
// (1992) + Markl (2016) zoned-rosette texture:
//   native_bismuth / native_silver → seed nucleation for skutterudite
//   rammelsbergite (Ni-rich core) → safflorite (Co mantle)
//   skutterudite / safflorite → loellingite (Fe-rich rim)
// All gated on `if (sigma < 1.0) return` before any rng.random()
// substrate-pick to keep the RNG cascade byte-identical for non-five-
// element scenarios.

function _nuc_skutterudite(sim) {
  const sigma = sim.conditions.supersaturation_skutterudite();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('skutterudite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'skutterudite' && c.active);
  if (existing.length >= 2) return;
  let pos = 'vug wall';
  // Markl: highest X_Ni in skutterudite grown directly on native metals
  const native_bi = sim.crystals.filter(c => c.mineral === 'native_bismuth' && c.active);
  const native_ag = sim.crystals.filter(c => c.mineral === 'native_silver' && c.active);
  const native_as = sim.crystals.filter(c => c.mineral === 'native_arsenic' && c.active);
  if (native_bi.length && rng.random() < 0.50) pos = `on native_bismuth #${native_bi[0].crystal_id}`;
  else if (native_ag.length && rng.random() < 0.40) pos = `on native_silver #${native_ag[0].crystal_id}`;
  else if (native_as.length && rng.random() < 0.35) pos = `on native_arsenic #${native_as[0].crystal_id}`;
  const c = sim.nucleate('skutterudite', pos, sigma);
  sim.log.push(`  ✦ NUCLEATION: ⬛ Skutterudite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Co=${sim.conditions.fluid.Co.toFixed(0)}, Ni=${sim.conditions.fluid.Ni.toFixed(0)}, As=${sim.conditions.fluid.As.toFixed(0)}) — five-element vein (Co,Ni,Fe)As₃, deepest+hottest arsenide`);
}

function _nuc_safflorite(sim) {
  const sigma = sim.conditions.supersaturation_safflorite();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('safflorite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'safflorite' && c.active);
  if (existing.length >= 2) return;
  let pos = 'vug wall';
  // Safflorite mantles rammelsbergite/skutterudite cores (Cobalt-Ontario)
  const ramm = sim.crystals.filter(c => c.mineral === 'rammelsbergite' && c.active);
  const sktd = sim.crystals.filter(c => c.mineral === 'skutterudite' && c.active);
  const cobaltite = sim.crystals.filter(c => c.mineral === 'cobaltite' && c.active);
  if (ramm.length && rng.random() < 0.45) pos = `mantling rammelsbergite #${ramm[0].crystal_id}`;
  else if (sktd.length && rng.random() < 0.45) pos = `mantling skutterudite #${sktd[0].crystal_id}`;
  else if (cobaltite.length && rng.random() < 0.30) pos = `alongside cobaltite #${cobaltite[0].crystal_id}`;
  const c = sim.nucleate('safflorite', pos, sigma);
  sim.log.push(`  ✦ NUCLEATION: ⬜ Safflorite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Co=${sim.conditions.fluid.Co.toFixed(0)}, Fe=${sim.conditions.fluid.Fe.toFixed(0)}, As=${sim.conditions.fluid.As.toFixed(0)}) — five-element vein (Co,Fe)As₂, star-twin habit`);
}

function _nuc_rammelsbergite(sim) {
  const sigma = sim.conditions.supersaturation_rammelsbergite();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('rammelsbergite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'rammelsbergite' && c.active);
  if (existing.length >= 2) return;
  let pos = 'vug wall';
  // Rammelsbergite: innermost arsenide when Ni dominates fluid
  const nickeline = sim.crystals.filter(c => c.mineral === 'nickeline' && c.active);
  const native_bi = sim.crystals.filter(c => c.mineral === 'native_bismuth' && c.active);
  if (nickeline.length && rng.random() < 0.55) pos = `on nickeline #${nickeline[0].crystal_id}`;
  else if (native_bi.length && rng.random() < 0.35) pos = `on native_bismuth #${native_bi[0].crystal_id}`;
  const c = sim.nucleate('rammelsbergite', pos, sigma);
  sim.log.push(`  ✦ NUCLEATION: 🌸 Rammelsbergite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Ni=${sim.conditions.fluid.Ni.toFixed(0)}, As=${sim.conditions.fluid.As.toFixed(0)}) — five-element vein NiAs₂, pinkish-white`);
}

function _nuc_loellingite(sim) {
  const sigma = sim.conditions.supersaturation_loellingite();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('loellingite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'loellingite' && c.active);
  if (existing.length >= 2) return;
  let pos = 'vug wall';
  // Loellingite: outermost arsenide rim, OR first on Fe-bearing wall
  const arsenopy = sim.crystals.filter(c => c.mineral === 'arsenopyrite' && c.active);
  const sktd = sim.crystals.filter(c => c.mineral === 'skutterudite' && c.active);
  const saff = sim.crystals.filter(c => c.mineral === 'safflorite' && c.active);
  if (sktd.length && rng.random() < 0.40) pos = `rim on skutterudite #${sktd[0].crystal_id}`;
  else if (saff.length && rng.random() < 0.35) pos = `rim on safflorite #${saff[0].crystal_id}`;
  else if (arsenopy.length && rng.random() < 0.40) pos = `intergrown with arsenopyrite #${arsenopy[0].crystal_id}`;
  const c = sim.nucleate('loellingite', pos, sigma);
  sim.log.push(`  ✦ NUCLEATION: 🔘 Loellingite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Fe=${sim.conditions.fluid.Fe.toFixed(0)}, As=${sim.conditions.fluid.As.toFixed(0)}, S=${sim.conditions.fluid.S.toFixed(2)}) — five-element vein FeAs₂, steel-gray outermost rim`);
}

// v101 (2026-05-19): Metacinnabar β-HgS — the low-T cubic polymorph.
// Substrate priority encodes Sulphur Bank paragenesis (White & Roberson
// 1962): metacinnabar coats cinnabar overgrowths + opal sinter +
// fracture surfaces. RNG-cascade guard via sigma < 1.0 early-out.
function _nuc_metacinnabar(sim) {
  const sigma = sim.conditions.supersaturation_metacinnabar();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('metacinnabar')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'metacinnabar' && c.active);
  if (existing.length >= 3) return;
  let pos = 'vug wall';
  const cin = sim.crystals.filter(c => c.mineral === 'cinnabar' && c.active);
  const sul = sim.crystals.filter(c => c.mineral === 'native_sulfur' && c.active);
  const opl = sim.crystals.filter(c => c.mineral === 'opal' && c.active);
  if (cin.length && rng.random() < 0.55) pos = `black coating on cinnabar #${cin[0].crystal_id}`;
  else if (opl.length && rng.random() < 0.45) pos = `sooty coating on opal sinter #${opl[0].crystal_id}`;
  else if (sul.length && rng.random() < 0.30) pos = `on native_sulfur #${sul[0].crystal_id}`;
  const c = sim.nucleate('metacinnabar', pos, sigma);
  sim.log.push(`  ✦ NUCLEATION: ⬛ Metacinnabar #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Hg=${sim.conditions.fluid.Hg.toFixed(1)}, S=${sim.conditions.fluid.S.toFixed(0)}, pH=${sim.conditions.fluid.pH.toFixed(1)}) — black cubic β-HgS (kinetically favored vs cinnabar at low T)`);
}

// v96 (2026-05-19): Ruby silvers nucleation. Late-stage epithermal Ag,
// post-arsenide, post-main-sulfide, syn-to-post-native_silver. The
// As:Sb fork is in the supersaturation engines; the nucleation
// functions just encode substrate priority for the late-Ag stage.
// RNG-cascade guard via sigma < 1.0 early-out.

function _nuc_proustite(sim) {
  const sigma = sim.conditions.supersaturation_proustite();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('proustite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'proustite' && c.active);
  if (existing.length >= 2) return;
  let pos = 'vug wall';
  // Late epithermal Ag — sits on early arsenides + acanthite + native_Ag
  const ag = sim.crystals.filter(c => c.mineral === 'native_silver' && c.active);
  const acn = sim.crystals.filter(c => c.mineral === 'acanthite' && c.active);
  const arsd = sim.crystals.filter(c => c.mineral === 'arsenopyrite' && c.active);
  const cob = sim.crystals.filter(c => c.mineral === 'cobaltite' && c.active);
  if (ag.length && rng.random() < 0.45) pos = `on native_silver #${ag[0].crystal_id}`;
  else if (acn.length && rng.random() < 0.40) pos = `alongside acanthite #${acn[0].crystal_id}`;
  else if (arsd.length && rng.random() < 0.30) pos = `post-arsenide on arsenopyrite #${arsd[0].crystal_id}`;
  else if (cob.length && rng.random() < 0.25) pos = `post-arsenide on cobaltite #${cob[0].crystal_id}`;
  const c = sim.nucleate('proustite', pos, sigma);
  sim.log.push(`  ✦ NUCLEATION: 🔴 Proustite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Ag=${sim.conditions.fluid.Ag.toFixed(2)}, As=${sim.conditions.fluid.As.toFixed(1)}, Sb=${(sim.conditions.fluid.Sb||0).toFixed(1)}) — scarlet light ruby silver, photodecomposes if exposed`);
}

function _nuc_pyrargyrite(sim) {
  const sigma = sim.conditions.supersaturation_pyrargyrite();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('pyrargyrite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'pyrargyrite' && c.active);
  if (existing.length >= 2) return;
  let pos = 'vug wall';
  const ag = sim.crystals.filter(c => c.mineral === 'native_silver' && c.active);
  const acn = sim.crystals.filter(c => c.mineral === 'acanthite' && c.active);
  const stb = sim.crystals.filter(c => c.mineral === 'stibnite' && c.active);
  const tdr = sim.crystals.filter(c => c.mineral === 'tetrahedrite' && c.active);
  if (ag.length && rng.random() < 0.45) pos = `on native_silver #${ag[0].crystal_id}`;
  else if (acn.length && rng.random() < 0.40) pos = `alongside acanthite #${acn[0].crystal_id}`;
  else if (tdr.length && rng.random() < 0.30) pos = `with tetrahedrite #${tdr[0].crystal_id}`;
  else if (stb.length && rng.random() < 0.25) pos = `on stibnite #${stb[0].crystal_id}`;
  const c = sim.nucleate('pyrargyrite', pos, sigma);
  sim.log.push(`  ✦ NUCLEATION: 🍒 Pyrargyrite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Ag=${sim.conditions.fluid.Ag.toFixed(2)}, As=${sim.conditions.fluid.As.toFixed(1)}, Sb=${(sim.conditions.fluid.Sb||0).toFixed(1)}) — cherry-red dark ruby silver, photodecomposes slowly`);
}

// v94 (2026-05-19): enargite — Cu₃AsS₄ high-sulfidation primary Cu-As-S.
// Distinguishes from tennantite via pH + sulfidation-state proxy in the
// supersat engine. Substrate priority: pyrite (primary, same paragenetic
// stage) > chalcopyrite (lower-sulfidation neighbor) > vug wall.
// RNG-cascade guard: early-out if sigma < 1.0 BEFORE substrate picks.
function _nuc_enargite(sim) {
  const sigma = sim.conditions.supersaturation_enargite();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('enargite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'enargite' && c.active);
  if (existing.length) return;  // primary stage — one nucleation per phase
  let pos = 'vug wall';
  const active_py = sim.crystals.filter(c => c.mineral === 'pyrite' && c.active);
  const active_cp = sim.crystals.filter(c => c.mineral === 'chalcopyrite' && c.active);
  if (active_py.length && rng.random() < 0.50) pos = `on pyrite #${active_py[0].crystal_id}`;
  else if (active_cp.length && rng.random() < 0.35) pos = `on chalcopyrite #${active_cp[0].crystal_id}`;
  const c = sim.nucleate('enargite', pos, sigma);
  const polymorph_label = sim.conditions.temperature >= 320 ? 'enargite' : 'luzonite';
  sim.log.push(`  ✦ NUCLEATION: ⬛ Enargite #${c.crystal_id} (${polymorph_label}) on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Cu=${sim.conditions.fluid.Cu.toFixed(0)}, As=${sim.conditions.fluid.As.toFixed(0)}, S=${sim.conditions.fluid.S.toFixed(0)}, pH=${sim.conditions.fluid.pH.toFixed(1)}) — high-sulfidation primary Cu-As-S`);
}

function _nucleateClass_sulfide(sim) {
  _nuc_sphalerite(sim);
  _nuc_wurtzite(sim);
  _nuc_pyrite(sim);
  _nuc_marcasite(sim);
  _nuc_chalcopyrite(sim);
  _nuc_tetrahedrite(sim);
  _nuc_tennantite(sim);
  _nuc_enargite(sim);
  // v95 diarsenide quartet — order matters: rammelsbergite (Ni-rich
  // innermost) → skutterudite (Co-Ni core on natives) → safflorite
  // (Co mantle on Ni cores) → loellingite (Fe-rich outermost rim)
  _nuc_rammelsbergite(sim);
  _nuc_skutterudite(sim);
  _nuc_safflorite(sim);
  _nuc_loellingite(sim);
  _nuc_arsenopyrite(sim);
  _nuc_galena(sim);
  _nuc_molybdenite(sim);
  _nuc_stibnite(sim);
  _nuc_cinnabar(sim);
  _nuc_metacinnabar(sim);
  _nuc_realgar(sim);
  _nuc_orpiment(sim);
  _nuc_bismuthinite(sim);
  _nuc_argentite(sim);
  _nuc_nickeline(sim);
  _nuc_millerite(sim);
  _nuc_cobaltite(sim);
  _nuc_acanthite(sim);
  // v96 ruby silvers — late epithermal Ag, post-arsenide/post-acanthite
  _nuc_proustite(sim);
  _nuc_pyrargyrite(sim);
  _nuc_bornite(sim);
  _nuc_chalcocite(sim);
  _nuc_covellite(sim);
  _nuc_calaverite(sim);
  _nuc_sylvanite(sim);
  _nuc_hessite(sim);
  _nuc_naumannite(sim);
  _nuc_clausthalite(sim);
  _nuc_greenockite(sim);
  _nuc_hawleyite(sim);
}

// v63 brief-19: telluride / selenide / Cd-sulfide nucleation gates.

function _nuc_calaverite(sim) {
  const sigma = sim.conditions.supersaturation_calaverite();
  if (sigma > 1.4 && !sim._atNucleationCap('calaverite') && rng.random() < 0.10) {
    let pos = 'vug wall';
    const qz = sim.crystals.filter(c => c.mineral === 'quartz' && c.active);
    const flu = sim.crystals.filter(c => c.mineral === 'fluorite' && c.active);
    if (qz.length && rng.random() < 0.40) pos = `on quartz #${qz[0].crystal_id} (epithermal vein)`;
    else if (flu.length && rng.random() < 0.30) pos = `on fluorite #${flu[0].crystal_id}`;
    const c = sim.nucleate('calaverite', pos, sigma);
    sim.log.push(`  ✦ NUCLEATION: 🟡 Calaverite #${c.crystal_id} on ${c.position} (Au ${sim.conditions.fluid.Au.toFixed(2)} Te ${sim.conditions.fluid.Te.toFixed(1)} ppm, T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}) — gold telluride, the Cripple Creek bonanza ore`);
  }
}

function _nuc_sylvanite(sim) {
  const sigma = sim.conditions.supersaturation_sylvanite();
  if (sigma > 1.4 && !sim._atNucleationCap('sylvanite') && rng.random() < 0.10) {
    let pos = 'vug wall';
    const cal = sim.crystals.filter(c => c.mineral === 'calaverite' && c.active);
    if (cal.length && rng.random() < 0.40) pos = `intergrown with calaverite #${cal[0].crystal_id}`;
    const c = sim.nucleate('sylvanite', pos, sigma);
    sim.log.push(`  ✦ NUCLEATION: ⚪ Sylvanite #${c.crystal_id} on ${c.position} (Au ${sim.conditions.fluid.Au.toFixed(2)} Ag ${sim.conditions.fluid.Ag.toFixed(0)} Te ${sim.conditions.fluid.Te.toFixed(1)} ppm, σ=${sigma.toFixed(2)}) — silver-white photosensitive Au-Ag-Te intergrowth`);
  }
}

function _nuc_hessite(sim) {
  const sigma = sim.conditions.supersaturation_hessite();
  if (sigma > 1.3 && !sim._atNucleationCap('hessite') && rng.random() < 0.12) {
    let pos = 'vug wall';
    const acan = sim.crystals.filter(c => (c.mineral === 'acanthite' || c.mineral === 'argentite') && c.active);
    if (acan.length && rng.random() < 0.40) pos = `with ${acan[0].mineral} #${acan[0].crystal_id} (Ag-paragenesis)`;
    const c = sim.nucleate('hessite', pos, sigma);
    sim.log.push(`  ✦ NUCLEATION: ⚫ Hessite #${c.crystal_id} on ${c.position} (Ag ${sim.conditions.fluid.Ag.toFixed(0)} Te ${sim.conditions.fluid.Te.toFixed(1)} ppm, T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}) — silver telluride`);
  }
}

function _nuc_naumannite(sim) {
  const sigma = sim.conditions.supersaturation_naumannite();
  if (sigma > 1.3 && !sim._atNucleationCap('naumannite') && rng.random() < 0.10) {
    let pos = 'vug wall';
    const claus = sim.crystals.filter(c => c.mineral === 'clausthalite' && c.active);
    if (claus.length && rng.random() < 0.45) pos = `with clausthalite #${claus[0].crystal_id} (Erzgebirge selenide vein)`;
    const c = sim.nucleate('naumannite', pos, sigma);
    sim.log.push(`  ✦ NUCLEATION: ⚫ Naumannite #${c.crystal_id} on ${c.position} (Ag ${sim.conditions.fluid.Ag.toFixed(0)} Se ${sim.conditions.fluid.Se.toFixed(1)} ppm, σ=${sigma.toFixed(2)}) — silver selenide`);
  }
}

function _nuc_clausthalite(sim) {
  const sigma = sim.conditions.supersaturation_clausthalite();
  if (sigma > 1.3 && !sim._atNucleationCap('clausthalite') && rng.random() < 0.12) {
    let pos = 'vug wall';
    const gal = sim.crystals.filter(c => c.mineral === 'galena' && c.active);
    if (gal.length && rng.random() < 0.35) pos = `with galena #${gal[0].crystal_id} (high-T solid solution; lamellae on cooling)`;
    const c = sim.nucleate('clausthalite', pos, sigma);
    sim.log.push(`  ✦ NUCLEATION: ⚫ Clausthalite #${c.crystal_id} on ${c.position} (Pb ${sim.conditions.fluid.Pb.toFixed(0)} Se ${sim.conditions.fluid.Se.toFixed(1)} ppm, σ=${sigma.toFixed(2)}) — lead selenide`);
  }
}

function _nuc_greenockite(sim) {
  const sigma = sim.conditions.supersaturation_greenockite();
  if (sigma > 1.0 && !sim._atNucleationCap('greenockite') && rng.random() < 0.18) {
    let pos = 'vug wall';
    const sph = sim.crystals.filter(c => c.mineral === 'sphalerite' && (c.dissolved || c.active));
    if (sph.length && rng.random() < 0.65) pos = `${sph[0].dissolved ? 'on dissolved' : 'coating'} sphalerite #${sph[0].crystal_id} (Cd liberation source)`;
    const c = sim.nucleate('greenockite', pos, sigma);
    sim.log.push(`  ✦ NUCLEATION: 🟡 Greenockite #${c.crystal_id} on ${c.position} (Cd ${sim.conditions.fluid.Cd.toFixed(2)} S ${sim.conditions.fluid.S.toFixed(0)} ppm, T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}) — honey-yellow CdS, hexagonal hemimorphic pyramid`);
  }
}

function _nuc_hawleyite(sim) {
  const sigma = sim.conditions.supersaturation_hawleyite();
  if (sigma > 1.0 && !sim._atNucleationCap('hawleyite') && rng.random() < 0.15) {
    let pos = 'vug wall';
    const sph = sim.crystals.filter(c => c.mineral === 'sphalerite' && (c.dissolved || c.active));
    if (sph.length && rng.random() < 0.55) pos = `coating sphalerite #${sph[0].crystal_id}`;
    const c = sim.nucleate('hawleyite', pos, sigma);
    sim.log.push(`  ✦ NUCLEATION: 🟡 Hawleyite #${c.crystal_id} on ${c.position} (Cd ${sim.conditions.fluid.Cd.toFixed(2)} S ${sim.conditions.fluid.S.toFixed(0)} ppm, T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}) — cadmium-yellow cubic CdS dust`);
  }
}
