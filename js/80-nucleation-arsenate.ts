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

function _nuc_pharmacolite(sim) {
  // CaHAsO₄·2H₂O — Ca-only hydrated arsenate. The Jáchymov/Schneeberg/
  // Cobalt-Ontario five-element-vein supergene bloom. Per
  // research-pharmacolite.md §Paragenetic Position: "Forms after
  // primary arsenides oxidize, releasing arsenic into supergene
  // fluids. Forms before more stable arsenates including conichalcite,
  // erythrite, annabergite". Substrate priority encodes that ordering:
  // cobaltite + arsenopyrite + native_arsenic + nickeline (As sources)
  // > erythrite + annabergite (paragenetic kin) > calcite (Ca source)
  // > bare wall.
  const sigma_ph = sim.conditions.supersaturation_pharmacolite();
  if (sigma_ph > 1.0 && !sim._atNucleationCap('pharmacolite')) {
    if (rng.random() < 0.22) {
      let pos = 'vug wall';
      const active_cob_ph  = sim.crystals.filter(c => c.mineral === 'cobaltite' && c.active);
      const active_arsp_ph = sim.crystals.filter(c => c.mineral === 'arsenopyrite' && c.active);
      const active_nar_ph  = sim.crystals.filter(c => c.mineral === 'native_arsenic' && c.active);
      const active_nic_ph  = sim.crystals.filter(c => c.mineral === 'nickeline' && c.active);
      const active_ery_ph  = sim.crystals.filter(c => c.mineral === 'erythrite' && c.active);
      const active_ann_ph  = sim.crystals.filter(c => c.mineral === 'annabergite' && c.active);
      const active_cal_ph  = sim.crystals.filter(c => c.mineral === 'calcite' && c.active);
      // As sources first (the documented paragenetic ordering)
      if (active_cob_ph.length && rng.random() < 0.35) {
        pos = `on weathering cobaltite #${active_cob_ph[0].crystal_id}`;
      } else if (active_arsp_ph.length && rng.random() < 0.30) {
        pos = `on weathering arsenopyrite #${active_arsp_ph[0].crystal_id}`;
      } else if (active_nar_ph.length && rng.random() < 0.30) {
        pos = `on weathering native_arsenic #${active_nar_ph[0].crystal_id}`;
      } else if (active_nic_ph.length && rng.random() < 0.25) {
        pos = `on weathering nickeline #${active_nic_ph[0].crystal_id}`;
      } else if (active_ery_ph.length && rng.random() < 0.25) {
        pos = `alongside erythrite #${active_ery_ph[0].crystal_id}`;
      } else if (active_ann_ph.length && rng.random() < 0.25) {
        pos = `alongside annabergite #${active_ann_ph[0].crystal_id}`;
      } else if (active_cal_ph.length && rng.random() < 0.20) {
        pos = `on calcite #${active_cal_ph[0].crystal_id}`;
      }
      const c = sim.nucleate('pharmacolite', pos, sigma_ph);
      const f = sim.conditions.fluid;
      sim.log.push(`  ✦ NUCLEATION: Pharmacolite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_ph.toFixed(2)}, Ca=${f.Ca.toFixed(0)}, As=${f.As.toFixed(0)}, Cu=${f.Cu.toFixed(0)} ppm) — radiating white needle starburst`);
    }
  }
}

function _nuc_conichalcite(sim) {
  // CaCu(AsO₄)(OH) — supergene Ca-Cu arsenate. The Ca-cation analog of
  // olivenite; fires when Ca/(Ca+Cu) > 0.4 in the local fluid (the
  // supersaturation gate enforces this). Substrate priority per
  // research-conichalcite.md §Paragenetic Position: scorodite (As-
  // source weathering product) > olivenite (Cu-As coexistence per
  // research's "May coexist in same vug as two green shades") > native
  // copper > malachite > chrysocolla > bare wall.
  const sigma_con = sim.conditions.supersaturation_conichalcite();
  if (sigma_con > 1.0 && !sim._atNucleationCap('conichalcite')) {
    if (rng.random() < 0.20) {
      let pos = 'vug wall';
      const active_scor_con = sim.crystals.filter(c => c.mineral === 'scorodite' && c.active);
      const active_oli_con  = sim.crystals.filter(c => c.mineral === 'olivenite' && c.active);
      const active_nc_con   = sim.crystals.filter(c => c.mineral === 'native_copper' && c.active);
      const active_mal_con  = sim.crystals.filter(c => c.mineral === 'malachite' && c.active);
      const active_chry_con = sim.crystals.filter(c => c.mineral === 'chrysocolla' && c.active);
      if (active_scor_con.length && rng.random() < 0.35) {
        pos = `on scorodite #${active_scor_con[0].crystal_id}`;
      } else if (active_oli_con.length && rng.random() < 0.30) {
        pos = `on olivenite #${active_oli_con[0].crystal_id}`;
      } else if (active_nc_con.length && rng.random() < 0.25) {
        pos = `on native_copper #${active_nc_con[0].crystal_id}`;
      } else if (active_mal_con.length && rng.random() < 0.25) {
        pos = `on malachite #${active_mal_con[0].crystal_id}`;
      } else if (active_chry_con.length && rng.random() < 0.25) {
        pos = `on chrysocolla #${active_chry_con[0].crystal_id}`;
      }
      const c = sim.nucleate('conichalcite', pos, sigma_con);
      const f = sim.conditions.fluid;
      const ca_fr = f.Ca / (f.Ca + f.Cu);
      sim.log.push(`  ✦ NUCLEATION: Conichalcite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_con.toFixed(2)}, Ca=${f.Ca.toFixed(0)}, Cu=${f.Cu.toFixed(0)}, As=${f.As.toFixed(0)}, Ca/(Ca+Cu)=${ca_fr.toFixed(2)})`);
    }
  }
}

// v97 (2026-05-19): Tsumeb arsenate suite nucleation. Five 2nd-
// oxidation-zone supergene arsenates with distinct cation-ratio gates
// in supersat. All use sigma < 1.0 early-out RNG-cascade guard.

function _nuc_austinite(sim) {
  const sigma = sim.conditions.supersaturation_austinite();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('austinite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'austinite' && c.active);
  if (existing.length >= 2) return;
  let pos = 'vug wall';
  const con = sim.crystals.filter(c => c.mineral === 'conichalcite' && c.active);
  const smith = sim.crystals.filter(c => c.mineral === 'smithsonite' && c.active);
  const dol = sim.crystals.filter(c => c.mineral === 'dolomite' && c.active);
  if (con.length && rng.random() < 0.50) pos = `epitactic on conichalcite #${con[0].crystal_id}`;
  else if (smith.length && rng.random() < 0.35) pos = `on smithsonite #${smith[0].crystal_id}`;
  else if (dol.length && rng.random() < 0.25) pos = `on dolomite #${dol[0].crystal_id}`;
  const c = sim.nucleate('austinite', pos, sigma);
  sim.log.push(`  ✦ NUCLEATION: 🟡 Austinite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Ca=${sim.conditions.fluid.Ca.toFixed(0)}, Zn=${sim.conditions.fluid.Zn.toFixed(0)}, As=${sim.conditions.fluid.As.toFixed(1)}) — Ca-Zn arsenate, Tsumeb 2nd-zone Zn-end`);
}

function _nuc_legrandite(sim) {
  const sigma = sim.conditions.supersaturation_legrandite();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('legrandite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'legrandite' && c.active);
  if (existing.length >= 2) return;
  let pos = 'vug wall';
  const adm = sim.crystals.filter(c => c.mineral === 'adamite' && c.active);
  const will = sim.crystals.filter(c => c.mineral === 'willemite' && c.active);
  const dol = sim.crystals.filter(c => c.mineral === 'dolomite' && c.active);
  if (adm.length && rng.random() < 0.55) pos = `on adamite #${adm[0].crystal_id}`;
  else if (will.length && rng.random() < 0.30) pos = `on willemite #${will[0].crystal_id}`;
  else if (dol.length && rng.random() < 0.25) pos = `on limonite-coated dolomite #${dol[0].crystal_id}`;
  const c = sim.nucleate('legrandite', pos, sigma);
  sim.log.push(`  ✦ NUCLEATION: 🟨 Legrandite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Zn=${sim.conditions.fluid.Zn.toFixed(0)}, As=${sim.conditions.fluid.As.toFixed(1)}, pH=${sim.conditions.fluid.pH.toFixed(1)}) — canary-yellow Tsumeb iconic Zn arsenate`);
}

function _nuc_koettigite(sim) {
  const sigma = sim.conditions.supersaturation_koettigite();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('koettigite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'koettigite' && c.active);
  if (existing.length >= 2) return;
  let pos = 'vug wall';
  const ery = sim.crystals.filter(c => c.mineral === 'erythrite' && c.active);
  const ann = sim.crystals.filter(c => c.mineral === 'annabergite' && c.active);
  const smith = sim.crystals.filter(c => c.mineral === 'smithsonite' && c.active);
  if (ery.length && rng.random() < 0.45) pos = `vivianite-group epitactic on erythrite #${ery[0].crystal_id}`;
  else if (ann.length && rng.random() < 0.40) pos = `vivianite-group epitactic on annabergite #${ann[0].crystal_id}`;
  else if (smith.length && rng.random() < 0.30) pos = `on smithsonite #${smith[0].crystal_id}`;
  const c = sim.nucleate('koettigite', pos, sigma);
  sim.log.push(`  ✦ NUCLEATION: 🌸 Koettigite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Zn=${sim.conditions.fluid.Zn.toFixed(0)}, Co=${sim.conditions.fluid.Co.toFixed(1)}, Ni=${sim.conditions.fluid.Ni.toFixed(1)}) — vivianite-group Zn end, pale pink`);
}

function _nuc_duftite(sim) {
  const sigma = sim.conditions.supersaturation_duftite();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('duftite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'duftite' && c.active);
  if (existing.length >= 2) return;
  let pos = 'vug wall';
  const mal = sim.crystals.filter(c => c.mineral === 'malachite' && c.active);
  const cer = sim.crystals.filter(c => c.mineral === 'cerussite' && c.active);
  const mim = sim.crystals.filter(c => c.mineral === 'mimetite' && c.active);
  const azr = sim.crystals.filter(c => c.mineral === 'azurite' && c.active);
  if (mal.length && rng.random() < 0.45) pos = `on malachite #${mal[0].crystal_id}`;
  else if (cer.length && rng.random() < 0.40) pos = `on cerussite #${cer[0].crystal_id}`;
  else if (mim.length && rng.random() < 0.35) pos = `on mimetite #${mim[0].crystal_id}`;
  else if (azr.length && rng.random() < 0.30) pos = `replacing azurite #${azr[0].crystal_id}`;
  const c = sim.nucleate('duftite', pos, sigma);
  sim.log.push(`  ✦ NUCLEATION: 🟢 Duftite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Pb=${sim.conditions.fluid.Pb.toFixed(0)}, Cu=${sim.conditions.fluid.Cu.toFixed(0)}, As=${sim.conditions.fluid.As.toFixed(1)}) — olive-drab Pb-Cu arsenate`);
}

function _nuc_bayldonite(sim) {
  const sigma = sim.conditions.supersaturation_bayldonite();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('bayldonite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'bayldonite' && c.active);
  if (existing.length >= 2) return;
  let pos = 'vug wall';
  const mim = sim.crystals.filter(c => c.mineral === 'mimetite' && c.active);
  const duf = sim.crystals.filter(c => c.mineral === 'duftite' && c.active);
  const mal = sim.crystals.filter(c => c.mineral === 'malachite' && c.active);
  const olv = sim.crystals.filter(c => c.mineral === 'olivenite' && c.active);
  if (mim.length && rng.random() < 0.50) pos = `epitactic on mimetite #${mim[0].crystal_id}`;
  else if (duf.length && rng.random() < 0.50) pos = `overgrowth on duftite #${duf[0].crystal_id}`;
  else if (olv.length && rng.random() < 0.40) pos = `on olivenite #${olv[0].crystal_id}`;
  else if (mal.length && rng.random() < 0.30) pos = `on malachite #${mal[0].crystal_id}`;
  const c = sim.nucleate('bayldonite', pos, sigma);
  sim.log.push(`  ✦ NUCLEATION: 🟩 Bayldonite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Pb=${sim.conditions.fluid.Pb.toFixed(0)}, Cu=${sim.conditions.fluid.Cu.toFixed(0)}, Cu:Pb=${(sim.conditions.fluid.Cu/Math.max(sim.conditions.fluid.Pb,0.1)).toFixed(1)}) — apple-green Cu-enriched Pb-Cu arsenate`);
}

function _nucleateClass_arsenate(sim) {
  _nuc_scorodite(sim);
  _nuc_adamite(sim);
  _nuc_mimetite(sim);
  _nuc_erythrite(sim);
  _nuc_annabergite(sim);
  _nuc_olivenite(sim);
  _nuc_conichalcite(sim);
  _nuc_pharmacolite(sim);
  // v97 (2026-05-19): Tsumeb suite — order encodes paragenetic sequence
  _nuc_austinite(sim);
  _nuc_legrandite(sim);
  _nuc_koettigite(sim);
  _nuc_duftite(sim);
  _nuc_bayldonite(sim);
}
