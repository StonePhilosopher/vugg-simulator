// ============================================================
// js/88-nucleation-phosphate.ts — per-mineral nucleation gates (phosphate)
// ============================================================
// One `_nuc_<mineral>(sim)` helper per supported phosphate-class mineral.
// Each is a pure side-effecting function: reads sim state, conditionally
// calls sim.nucleate(...), and pushes a log line.
//
// VugSimulator.check_nucleation iterates over each class group via
// _nucleateClass_<klass>(sim). See 85-simulator.ts.
//
// Phase B15 of PROPOSAL-MODULAR-REFACTOR.

function _nuc_descloizite(sim) {
  const sigma_des = sim.conditions.supersaturation_descloizite();
  if (sigma_des > 1.0 && !sim._atNucleationCap('descloizite')) {
    if (rng.random() < 0.18) {
      let pos = 'vug wall';
      const active_van_des = sim.crystals.filter(c => c.mineral === 'vanadinite' && c.active);
      if (active_van_des.length && rng.random() < 0.4) pos = `on vanadinite #${active_van_des[0].crystal_id}`;
      const c = sim.nucleate('descloizite', pos, sigma_des);
      sim.log.push(`  ✦ NUCLEATION: Descloizite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_des.toFixed(2)}, Pb=${sim.conditions.fluid.Pb.toFixed(0)}, Zn=${sim.conditions.fluid.Zn.toFixed(0)}, V=${sim.conditions.fluid.V.toFixed(1)})`);
    }
  }

  // Mottramite nucleation — Pb + Cu + V + oxidizing.
}
function _nuc_mottramite(sim) {
  const sigma_mot = sim.conditions.supersaturation_mottramite();
  if (sigma_mot > 1.0 && !sim._atNucleationCap('mottramite')) {
    if (rng.random() < 0.18) {
      let pos = 'vug wall';
      const active_van_mot = sim.crystals.filter(c => c.mineral === 'vanadinite' && c.active);
      if (active_van_mot.length && rng.random() < 0.4) pos = `on vanadinite #${active_van_mot[0].crystal_id}`;
      const c = sim.nucleate('mottramite', pos, sigma_mot);
      sim.log.push(`  ✦ NUCLEATION: Mottramite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_mot.toFixed(2)}, Pb=${sim.conditions.fluid.Pb.toFixed(0)}, Cu=${sim.conditions.fluid.Cu.toFixed(0)}, V=${sim.conditions.fluid.V.toFixed(1)})`);
    }
  }

  // Tungstate pair — raspite + stolzite both PbWO4, kinetic preference
  // dispatcher gives stolzite ~90% of the time.
  let sigma_rasp = sim.conditions.supersaturation_raspite();
}
function _nuc_clinobisvanite(sim) {
  const sigma_cbv = sim.conditions.supersaturation_clinobisvanite();
  const existing_cbv = sim.crystals.filter(c => c.mineral === 'clinobisvanite' && c.active);
  if (sigma_cbv > 1.5 && !sim._atNucleationCap('clinobisvanite')) {
    if (!existing_cbv.length || (sigma_cbv > 2.0 && rng.random() < 0.3)) {
      let pos = 'vug wall';
      const dissolving_nbi = sim.crystals.filter(c => c.mineral === 'native_bismuth' && c.dissolved);
      const dissolving_bmt_cbv = sim.crystals.filter(c => c.mineral === 'bismuthinite' && c.dissolved);
      if (dissolving_nbi.length && rng.random() < 0.5) pos = `on native_bismuth #${dissolving_nbi[0].crystal_id}`;
      else if (dissolving_bmt_cbv.length && rng.random() < 0.4) pos = `on bismuthinite #${dissolving_bmt_cbv[0].crystal_id}`;
      const c = sim.nucleate('clinobisvanite', pos, sigma_cbv);
      sim.log.push(`  ✦ NUCLEATION: Clinobisvanite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_cbv.toFixed(2)}, Bi=${sim.conditions.fluid.Bi.toFixed(1)}, V=${sim.conditions.fluid.V.toFixed(1)})`);
    }
  }

  // Cuprite nucleation — Cu + narrow O₂ window (Eh-boundary mineral).
}
function _nuc_pyromorphite(sim) {
  const sigma_pyr = sim.conditions.supersaturation_pyromorphite();
  const existing_pyr = sim.crystals.filter(c => c.mineral === 'pyromorphite' && c.active);
  if (sigma_pyr > 1.2 && !sim._atNucleationCap('pyromorphite')) {
    if (!existing_pyr.length || (sigma_pyr > 1.8 && rng.random() < 0.3)) {
      let pos = 'vug wall';
      const dissolving_cer_p = sim.crystals.filter(c => c.mineral === 'cerussite' && c.dissolved);
      const active_cer_p = sim.crystals.filter(c => c.mineral === 'cerussite' && c.active);
      const existing_goe_pyr = sim.crystals.filter(c => c.mineral === 'goethite' && c.active);
      if (dissolving_cer_p.length && rng.random() < 0.6) pos = `on cerussite #${dissolving_cer_p[0].crystal_id}`;
      else if (active_cer_p.length && rng.random() < 0.3) pos = `on cerussite #${active_cer_p[0].crystal_id}`;
      else if (existing_goe_pyr.length && rng.random() < 0.3) pos = `on goethite #${existing_goe_pyr[0].crystal_id}`;
      const c = sim.nucleate('pyromorphite', pos, sigma_pyr);
      sim.log.push(`  ✦ NUCLEATION: Pyromorphite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_pyr.toFixed(2)}, P=${sim.conditions.fluid.P.toFixed(1)}, Cl=${sim.conditions.fluid.Cl.toFixed(0)})`);
    }
  }

  // Vanadinite nucleation — Pb + V + Cl (supergene, V-gated).
}
function _nuc_vanadinite(sim) {
  const sigma_vnd = sim.conditions.supersaturation_vanadinite();
  const existing_vnd = sim.crystals.filter(c => c.mineral === 'vanadinite' && c.active);
  if (sigma_vnd > 1.3 && !sim._atNucleationCap('vanadinite')) {
    if (!existing_vnd.length || (sigma_vnd > 1.8 && rng.random() < 0.3)) {
      let pos = 'vug wall';
      const existing_goe_vnd = sim.crystals.filter(c => c.mineral === 'goethite' && c.active);
      const dissolving_cer_v = sim.crystals.filter(c => c.mineral === 'cerussite' && c.dissolved);
      if (existing_goe_vnd.length && rng.random() < 0.7) pos = `on goethite #${existing_goe_vnd[0].crystal_id}`;
      else if (dissolving_cer_v.length && rng.random() < 0.4) pos = `on cerussite #${dissolving_cer_v[0].crystal_id}`;
      const c = sim.nucleate('vanadinite', pos, sigma_vnd);
      sim.log.push(`  ✦ NUCLEATION: Vanadinite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_vnd.toFixed(2)}, V=${sim.conditions.fluid.V.toFixed(1)}, Pb=${sim.conditions.fluid.Pb.toFixed(0)})`);
    }
  }

  // Spodumene nucleation — Li + Al + SiO₂ (Li-gated, σ > 1.5).
  // Lithium competes with elbaite tourmaline for the same fluid Li —
  // spodumene also needs a hotter fluid (T > 400°C), so pocket
  // paragenesis tends to see schorl → spodumene → elbaite as the
  // fluid cools and Li remains. max_nucleation_count=4.
}
function _nuc_torbernite(sim) {
  const sigma_tor = sim.conditions.supersaturation_torbernite();
  if (sigma_tor > 1.0 && !sim._atNucleationCap('torbernite')) {
    if (rng.random() < 0.20) {
      let pos = 'vug wall';
      const weathering_urn = sim.crystals.filter(c => c.mineral === 'uraninite' && c.dissolved);
      if (weathering_urn.length && rng.random() < 0.5) {
        pos = `on weathering uraninite #${weathering_urn[0].crystal_id}`;
      }
      const c = sim.nucleate('torbernite', pos, sigma_tor);
      const p_as = sim.conditions.fluid.P + sim.conditions.fluid.As;
      const p_pct = p_as > 0 ? (sim.conditions.fluid.P / p_as * 100) : 0;
      sim.log.push(`  ✦ NUCLEATION: Torbernite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_tor.toFixed(2)}, U=${sim.conditions.fluid.U.toFixed(2)}, P=${sim.conditions.fluid.P.toFixed(1)}, As=${sim.conditions.fluid.As.toFixed(1)}, P-fraction=${p_pct.toFixed(0)}%) — anion-competition branch: P-dominant`);
    }
  }

  // Zeunerite nucleation — As-branch of the uranyl anion-competition trio.
}
function _nuc_zeunerite(sim) {
  const sigma_zeu = sim.conditions.supersaturation_zeunerite();
  if (sigma_zeu > 1.0 && !sim._atNucleationCap('zeunerite')) {
    if (rng.random() < 0.20) {
      let pos = 'vug wall';
      const weathering_urn = sim.crystals.filter(c => c.mineral === 'uraninite' && c.dissolved);
      const weathering_apy = sim.crystals.filter(c => c.mineral === 'arsenopyrite' && c.dissolved);
      const active_tor = sim.crystals.filter(c => c.mineral === 'torbernite' && c.active);
      if (weathering_urn.length && rng.random() < 0.4) {
        pos = `on weathering uraninite #${weathering_urn[0].crystal_id}`;
      } else if (weathering_apy.length && rng.random() < 0.4) {
        pos = `on weathering arsenopyrite #${weathering_apy[0].crystal_id}`;
      } else if (active_tor.length && rng.random() < 0.3) {
        pos = `adjacent to torbernite #${active_tor[0].crystal_id}`;
      }
      const c = sim.nucleate('zeunerite', pos, sigma_zeu);
      const p_as = sim.conditions.fluid.P + sim.conditions.fluid.As;
      const as_pct = p_as > 0 ? (sim.conditions.fluid.As / p_as * 100) : 0;
      sim.log.push(`  ✦ NUCLEATION: Zeunerite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_zeu.toFixed(2)}, U=${sim.conditions.fluid.U.toFixed(2)}, P=${sim.conditions.fluid.P.toFixed(1)}, As=${sim.conditions.fluid.As.toFixed(1)}, As-fraction=${as_pct.toFixed(0)}%) — anion-competition branch: As-dominant`);
    }
  }

  // Carnotite nucleation — V-branch of the uranyl anion-competition trio (Round 9c).
  // Substrate preference: weathering uraninite (U source) or "organic-rich" position
  // via Fe>5 + low-T proxy (real carnotite famously concentrates around petrified
  // wood; sim doesn't track organic matter as a separate species).
}
function _nuc_carnotite(sim) {
  const sigma_car = sim.conditions.supersaturation_carnotite();
  if (sigma_car > 1.0 && !sim._atNucleationCap('carnotite')) {
    if (rng.random() < 0.20) {
      let pos = 'vug wall';
      const weathering_urn = sim.crystals.filter(c => c.mineral === 'uraninite' && c.dissolved);
      if (weathering_urn.length && rng.random() < 0.5) {
        pos = `on weathering uraninite #${weathering_urn[0].crystal_id}`;
      } else if (sim.conditions.fluid.Fe > 5 && sim.conditions.temperature < 30 && rng.random() < 0.3) {
        pos = 'around organic carbon (roll-front position)';
      }
      const c = sim.nucleate('carnotite', pos, sigma_car);
      const anion_total = sim.conditions.fluid.P + sim.conditions.fluid.As + sim.conditions.fluid.V;
      const v_pct = anion_total > 0 ? (sim.conditions.fluid.V / anion_total * 100) : 0;
      sim.log.push(`  ✦ NUCLEATION: Carnotite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_car.toFixed(2)}, K=${sim.conditions.fluid.K.toFixed(0)}, U=${sim.conditions.fluid.U.toFixed(2)}, V=${sim.conditions.fluid.V.toFixed(1)}, V-fraction=${v_pct.toFixed(0)}%) — anion-competition branch: V-dominant`);
    }
  }

  // Autunite nucleation — Ca-branch of the uranyl cation+anion fork
  // (Round 9d, May 2026). Substrate preference: weathering uraninite
  // (canonical paragenesis). The cation fork (Ca/(Cu+Ca)>0.5) is enforced
  // inside supersaturation_autunite — we don't double-check here.
}
function _nuc_autunite(sim) {
  const sigma_aut = sim.conditions.supersaturation_autunite();
  if (sigma_aut > 1.0 && !sim._atNucleationCap('autunite')) {
    if (rng.random() < 0.20) {
      let pos = 'vug wall';
      const weathering_urn = sim.crystals.filter(c => c.mineral === 'uraninite' && c.dissolved);
      if (weathering_urn.length && rng.random() < 0.5) {
        pos = `on weathering uraninite #${weathering_urn[0].crystal_id}`;
      }
      const c = sim.nucleate('autunite', pos, sigma_aut);
      const cation_total = sim.conditions.fluid.Cu + sim.conditions.fluid.Ca;
      const ca_pct = cation_total > 0 ? (sim.conditions.fluid.Ca / cation_total * 100) : 0;
      sim.log.push(`  ✦ NUCLEATION: Autunite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_aut.toFixed(2)}, Ca=${sim.conditions.fluid.Ca.toFixed(0)}, U=${sim.conditions.fluid.U.toFixed(2)}, P=${sim.conditions.fluid.P.toFixed(1)}, Ca-fraction=${ca_pct.toFixed(0)}%) — cation+anion fork: Ca-dominant on the P-branch`);
    }
  }

  // Uranospinite nucleation — Ca-branch / As-anion of the autunite-
  // group fork (Round 9e). Substrate preference: weathering uraninite
  // OR weathering arsenopyrite OR active zeunerite (the Cu-cation
  // partner often co-mineralizes at Schneeberg).
}
function _nuc_uranospinite(sim) {
  const sigma_uros = sim.conditions.supersaturation_uranospinite();
  if (sigma_uros > 1.0 && !sim._atNucleationCap('uranospinite')) {
    if (rng.random() < 0.20) {
      let pos = 'vug wall';
      const weathering_urn = sim.crystals.filter(c => c.mineral === 'uraninite' && c.dissolved);
      const weathering_apy = sim.crystals.filter(c => c.mineral === 'arsenopyrite' && c.dissolved);
      const active_zeu = sim.crystals.filter(c => c.mineral === 'zeunerite' && c.active);
      if (weathering_urn.length && rng.random() < 0.4) {
        pos = `on weathering uraninite #${weathering_urn[0].crystal_id}`;
      } else if (weathering_apy.length && rng.random() < 0.4) {
        pos = `on weathering arsenopyrite #${weathering_apy[0].crystal_id}`;
      } else if (active_zeu.length && rng.random() < 0.3) {
        pos = `adjacent to zeunerite #${active_zeu[0].crystal_id}`;
      }
      const c = sim.nucleate('uranospinite', pos, sigma_uros);
      const cation_total = sim.conditions.fluid.Cu + sim.conditions.fluid.Ca;
      const ca_pct = cation_total > 0 ? (sim.conditions.fluid.Ca / cation_total * 100) : 0;
      sim.log.push(`  ✦ NUCLEATION: Uranospinite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_uros.toFixed(2)}, Ca=${sim.conditions.fluid.Ca.toFixed(0)}, U=${sim.conditions.fluid.U.toFixed(2)}, As=${sim.conditions.fluid.As.toFixed(1)}, Ca-fraction=${ca_pct.toFixed(0)}%) — cation+anion fork: Ca-dominant on the As-branch`);
    }
  }

  // Tyuyamunite nucleation — Ca-branch / V-anion of the autunite-group
  // fork (Round 9e). Substrate preference: weathering uraninite OR
  // active carnotite (the K-cation partner often intergrown in Colorado
  // Plateau and Tyuya-Muyun deposits) OR roll-front position.
}
function _nuc_tyuyamunite(sim) {
  const sigma_tyu = sim.conditions.supersaturation_tyuyamunite();
  if (sigma_tyu > 1.0 && !sim._atNucleationCap('tyuyamunite')) {
    if (rng.random() < 0.20) {
      let pos = 'vug wall';
      const weathering_urn = sim.crystals.filter(c => c.mineral === 'uraninite' && c.dissolved);
      const active_car = sim.crystals.filter(c => c.mineral === 'carnotite' && c.active);
      if (weathering_urn.length && rng.random() < 0.4) {
        pos = `on weathering uraninite #${weathering_urn[0].crystal_id}`;
      } else if (active_car.length && rng.random() < 0.4) {
        pos = `adjacent to carnotite #${active_car[0].crystal_id}`;
      } else if (sim.conditions.fluid.Fe > 5 && sim.conditions.temperature < 30 && rng.random() < 0.3) {
        pos = 'around organic carbon (roll-front position)';
      }
      const c = sim.nucleate('tyuyamunite', pos, sigma_tyu);
      const cation_total = sim.conditions.fluid.K + sim.conditions.fluid.Ca;
      const ca_pct = cation_total > 0 ? (sim.conditions.fluid.Ca / cation_total * 100) : 0;
      sim.log.push(`  ✦ NUCLEATION: Tyuyamunite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_tyu.toFixed(2)}, Ca=${sim.conditions.fluid.Ca.toFixed(0)}, U=${sim.conditions.fluid.U.toFixed(2)}, V=${sim.conditions.fluid.V.toFixed(1)}, Ca-fraction=${ca_pct.toFixed(0)}%) — cation+anion fork: Ca-dominant on the V-branch`);
    }
  }
}

function _nucleateClass_phosphate(sim) {
  _nuc_descloizite(sim);
  _nuc_mottramite(sim);
  _nuc_clinobisvanite(sim);
  _nuc_pyromorphite(sim);
  _nuc_vanadinite(sim);
  _nuc_torbernite(sim);
  _nuc_zeunerite(sim);
  _nuc_carnotite(sim);
  _nuc_autunite(sim);
  _nuc_uranospinite(sim);
  _nuc_tyuyamunite(sim);
}
