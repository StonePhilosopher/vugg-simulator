// ============================================================
// js/90-nucleation-sulfate.ts — per-mineral nucleation gates (sulfate)
// ============================================================
// One `_nuc_<mineral>(sim)` helper per supported sulfate-class mineral.
// Each is a pure side-effecting function: reads sim state, conditionally
// calls sim.nucleate(...), and pushes a log line.
//
// VugSimulator.check_nucleation iterates over each class group via
// _nucleateClass_<klass>(sim). See 85-simulator.ts.
//
// Phase B15 of PROPOSAL-MODULAR-REFACTOR.

function _nuc_barite(sim) {
  const sigma_brt = sim.conditions.supersaturation_barite();
  if (sim._atNucleationCap('barite')) return;
  // Q5 — snowball substrate pick. When a sulfide host (sphalerite/
  // galena/pyrite) is available, this barite is a snowball seed
  // (Sweetwater-type radiating-epitaxy aggregate). Use 'on' not
  // 'near' so the substrate-affinity discount + CDR detection +
  // _assignWallCell host-inheritance all see the host. Bare-wall
  // barite stays gated at the legacy 0.15 probability.
  let pos = 'vug wall';
  let snowball = false;
  const active_sph_brt = sim.crystals.filter(c => c.mineral === 'sphalerite' && c.active);
  const active_gal_brt = sim.crystals.filter(c => c.mineral === 'galena'     && c.active);
  const active_py_brt  = sim.crystals.filter(c => c.mineral === 'pyrite'     && c.active);
  if (active_sph_brt.length && rng.random() < 0.4) {
    pos = `on sphalerite #${active_sph_brt[0].crystal_id}`;
    snowball = true;
  } else if (active_gal_brt.length && rng.random() < 0.3) {
    pos = `on galena #${active_gal_brt[0].crystal_id}`;
    snowball = true;
  } else if (active_py_brt.length && rng.random() < 0.2) {
    pos = `on pyrite #${active_py_brt[0].crystal_id}`;
    snowball = true;
  }
  // σ-discount via Q1c paragenesis table (barite has 0.7× entries on
  // sphalerite/galena/pyrite hosts).
  const discount = sim._sigmaDiscountForPosition('barite', pos);
  if (sigma_brt <= 1.0 * discount) return;
  // Free-wall barite stays gated at low probability (~one nucleation
  // per ~7 steps when σ is already over threshold). Snowball seeds
  // bypass this gate — when the substrate aligns, the aggregate
  // forms.
  if (!snowball && rng.random() >= 0.15) return;
  const c = sim.nucleate('barite', pos, sigma_brt);
  if (snowball) c.habit = 'snowball';
  const tag = snowball ? ' (snowball seed)' : '';
  sim.log.push(`  ✦ NUCLEATION: ⚪ Barite #${c.crystal_id} on ${c.position}${tag} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_brt.toFixed(2)}, Ba=${sim.conditions.fluid.Ba.toFixed(0)}, S=${sim.conditions.fluid.S.toFixed(0)}, O₂=${sim.conditions.fluid.O2.toFixed(2)}) — heavy spar, MVT gangue`);

  // Celestine nucleation — the Sr sequestration mineral; pale celestial
  // blue. Substrate priority: existing barite (celestobarite-barytocelestine
  // pair) > vug wall.
}
function _nuc_celestine(sim) {
  const sigma_cel = sim.conditions.supersaturation_celestine();
  if (sigma_cel > 1.0 && !sim._atNucleationCap('celestine')) {
    if (rng.random() < 0.15) {
      let pos = 'vug wall';
      const active_brt_cel = sim.crystals.filter(c => c.mineral === 'barite' && c.active);
      if (active_brt_cel.length && rng.random() < 0.25) {
        pos = `on barite #${active_brt_cel[0].crystal_id} (celestobarite-barytocelestine pair)`;
      }
      const c = sim.nucleate('celestine', pos, sigma_cel);
      sim.log.push(`  ✦ NUCLEATION: 🟦 Celestine #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_cel.toFixed(2)}, Sr=${sim.conditions.fluid.Sr.toFixed(0)}, S=${sim.conditions.fluid.S.toFixed(0)}, O₂=${sim.conditions.fluid.O2.toFixed(2)}) — pale celestial blue, Sr sulfate`);
    }
  }

  // Jarosite nucleation — the AMD-yellow Fe sulfate. Substrate prefers
  // dissolving pyrite/marcasite (the diagnostic yellow rim).
}
function _nuc_jarosite(sim) {
  const sigma_jar = sim.conditions.supersaturation_jarosite();
  if (sigma_jar > 1.0 && !sim._atNucleationCap('jarosite')) {
    // v5: per-check 0.45 (was 0.18) so jarosite fires reliably (~95%)
    // during brief acid windows in carbonate-buffered systems like
    // Tsumeb (where ev_supergene_acidification holds pH near 4 for
    // only ~15 steps before meteoric flush neutralizes).
    if (rng.random() < 0.45) {
      let pos = 'vug wall';
      const diss_py_jar = sim.crystals.filter(c => c.mineral === 'pyrite' && c.dissolved);
      const diss_mar_jar = sim.crystals.filter(c => c.mineral === 'marcasite' && c.dissolved);
      const active_py_jar = sim.crystals.filter(c => c.mineral === 'pyrite' && c.active);
      if (diss_py_jar.length && rng.random() < 0.7) {
        pos = `on dissolving pyrite #${diss_py_jar[0].crystal_id}`;
      } else if (diss_mar_jar.length && rng.random() < 0.6) {
        pos = `on dissolving marcasite #${diss_mar_jar[0].crystal_id}`;
      } else if (active_py_jar.length && rng.random() < 0.4) {
        pos = `on pyrite #${active_py_jar[0].crystal_id}`;
      }
      const c = sim.nucleate('jarosite', pos, sigma_jar);
      sim.log.push(`  ✦ NUCLEATION: 🟡 Jarosite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_jar.toFixed(2)}, K=${sim.conditions.fluid.K.toFixed(0)}, Fe=${sim.conditions.fluid.Fe.toFixed(0)}, pH=${sim.conditions.fluid.pH.toFixed(1)}) — AMD yellow, Mars-class mineral`);
    }
  }

  // Alunite nucleation — advanced argillic alteration; substrate prefers
  // dissolving feldspar (the wall-leaching origin of Al).
}
function _nuc_alunite(sim) {
  const sigma_alu = sim.conditions.supersaturation_alunite();
  if (sigma_alu > 1.0 && !sim._atNucleationCap('alunite')) {
    // v5: per-check 0.45 (was 0.15) — same rationale as jarosite,
    // tighter alunite window (Al/25 cap means only 3 of 4 acid
    // pulses cross threshold).
    if (rng.random() < 0.45) {
      let pos = 'vug wall';
      const diss_fel_alu = sim.crystals.filter(c => c.mineral === 'feldspar' && c.dissolved);
      const active_fel_alu = sim.crystals.filter(c => c.mineral === 'feldspar' && c.active);
      if (diss_fel_alu.length && rng.random() < 0.7) {
        pos = `on dissolving feldspar #${diss_fel_alu[0].crystal_id}`;
      } else if (active_fel_alu.length && rng.random() < 0.4) {
        pos = `on feldspar #${active_fel_alu[0].crystal_id}`;
      }
      const c = sim.nucleate('alunite', pos, sigma_alu);
      sim.log.push(`  ✦ NUCLEATION: ⚪ Alunite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_alu.toFixed(2)}, K=${sim.conditions.fluid.K.toFixed(0)}, Al=${sim.conditions.fluid.Al.toFixed(0)}, pH=${sim.conditions.fluid.pH.toFixed(1)}) — advanced argillic alteration index`);
    }
  }

  // Brochantite nucleation — wet-supergene Cu sulfate (pH 4-7 fork end).
  // Substrate priority: dissolving Cu sulfides > active Cu sulfides > vug wall.
}
function _nuc_brochantite(sim) {
  const sigma_brn_sulf = sim.conditions.supersaturation_brochantite();
  if (sigma_brn_sulf > 1.0 && !sim._atNucleationCap('brochantite')) {
    if (rng.random() < 0.18) {
      let pos = 'vug wall';
      const diss_chc_brn = sim.crystals.filter(c => c.mineral === 'chalcocite' && c.dissolved);
      const diss_cov_brn = sim.crystals.filter(c => c.mineral === 'covellite' && c.dissolved);
      const active_chc_brn = sim.crystals.filter(c => c.mineral === 'chalcocite' && c.active);
      if (diss_chc_brn.length && rng.random() < 0.7) {
        pos = `on dissolving chalcocite #${diss_chc_brn[0].crystal_id}`;
      } else if (diss_cov_brn.length && rng.random() < 0.6) {
        pos = `on dissolving covellite #${diss_cov_brn[0].crystal_id}`;
      } else if (active_chc_brn.length && rng.random() < 0.4) {
        pos = `on chalcocite #${active_chc_brn[0].crystal_id}`;
      }
      const c = sim.nucleate('brochantite', pos, sigma_brn_sulf);
      sim.log.push(`  ✦ NUCLEATION: 🟢 Brochantite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_brn_sulf.toFixed(2)}, Cu=${sim.conditions.fluid.Cu.toFixed(0)}, S=${sim.conditions.fluid.S.toFixed(0)}, pH=${sim.conditions.fluid.pH.toFixed(1)}) — emerald-green Cu sulfate`);
    }
  }

  // Antlerite nucleation — dry-acid Cu sulfate (pH 1-3.5 fork end).
  // Substrate-prefers dissolving brochantite (pH-fork conversion).
}
function _nuc_antlerite(sim) {
  const sigma_ant = sim.conditions.supersaturation_antlerite();
  if (sigma_ant > 1.0 && !sim._atNucleationCap('antlerite')) {
    if (rng.random() < 0.18) {
      let pos = 'vug wall';
      const diss_brn_ant = sim.crystals.filter(c => c.mineral === 'brochantite' && c.dissolved);
      const diss_chc_ant = sim.crystals.filter(c => c.mineral === 'chalcocite' && c.dissolved);
      if (diss_brn_ant.length && rng.random() < 0.8) {
        pos = `on dissolving brochantite #${diss_brn_ant[0].crystal_id} (pH-fork conversion)`;
      } else if (diss_chc_ant.length && rng.random() < 0.5) {
        pos = `on dissolving chalcocite #${diss_chc_ant[0].crystal_id}`;
      }
      const c = sim.nucleate('antlerite', pos, sigma_ant);
      sim.log.push(`  ✦ NUCLEATION: 🟢 Antlerite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_ant.toFixed(2)}, Cu=${sim.conditions.fluid.Cu.toFixed(0)}, S=${sim.conditions.fluid.S.toFixed(0)}, pH=${sim.conditions.fluid.pH.toFixed(1)}) — dry-acid Chuquicamata Cu sulfate`);
    }
  }

  // Anhydrite nucleation — high-T or saline-low-T Ca sulfate.
  // Substrate-agnostic; in Bingham deep-zone often co-precipitates
  // with chalcopyrite (porphyry deep-brine paragenesis).
}
function _nuc_anhydrite(sim) {
  const sigma_anh = sim.conditions.supersaturation_anhydrite();
  if (sigma_anh > 1.0 && !sim._atNucleationCap('anhydrite')) {
    if (rng.random() < 0.16) {
      let pos = 'vug wall';
      const active_cp_anh = sim.crystals.filter(c => c.mineral === 'chalcopyrite' && c.active);
      if (active_cp_anh.length && sim.conditions.temperature > 200 && rng.random() < 0.3) {
        pos = `near chalcopyrite #${active_cp_anh[0].crystal_id} (porphyry deep-brine paragenesis)`;
      }
      const c = sim.nucleate('anhydrite', pos, sigma_anh);
      sim.log.push(`  ✦ NUCLEATION: ⚪ Anhydrite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_anh.toFixed(2)}, Ca=${sim.conditions.fluid.Ca.toFixed(0)}, S=${sim.conditions.fluid.S.toFixed(0)}, salinity=${sim.conditions.fluid.salinity.toFixed(0)}‰)`);
    }
  }

  // Selenite nucleation — low temperature, oxidized sulfate environment
  // The crystal that grows when everything else is ending
}
function _nuc_selenite(sim) {
  const sigma_sel = sim.conditions.supersaturation_selenite();
  const existing_sel = sim.crystals.filter(c => c.mineral === 'selenite' && c.active);
  const total_sel = sim.crystals.filter(c => c.mineral === 'selenite').length;
  if (sigma_sel > 1.0 && existing_sel.length < 2 && total_sel < 4 && !sim._atNucleationCap('selenite')) {
    if (!existing_sel.length || (sigma_sel > 1.8 && rng.random() < 0.3)) {
      let pos = 'vug wall';
      // Prefers to grow on dissolved sulfide surfaces — the oxidation zone paragenesis
      const dissolved_py = sim.crystals.filter(c => c.mineral === 'pyrite' && c.dissolved);
      const dissolved_cp = sim.crystals.filter(c => c.mineral === 'chalcopyrite' && c.dissolved);
      if (dissolved_py.length && rng.random() < 0.6) {
        pos = `on pyrite #${dissolved_py[0].crystal_id} (oxidized)`;
      } else if (dissolved_cp.length && rng.random() < 0.5) {
        pos = `on chalcopyrite #${dissolved_cp[0].crystal_id} (oxidized)`;
      }
      const c = sim.nucleate('selenite', pos, sigma_sel);
      sim.log.push(`  ✦ NUCLEATION: 💎 Selenite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_sel.toFixed(2)}) — gypsum blades forming in the cooling, oxidizing fluid`);
    }
  }

  // Halite nucleation — chloride evaporite, fires when a vadose-
  // transition concentration boost pushes Na × Cl × concentration²
  // into supersaturation. v27 mirror of vugg.py.
}
function _nuc_mirabilite(sim) {
  const sigma_mirab = sim.conditions.supersaturation_mirabilite();
  if (sigma_mirab > 1.0 && !sim._atNucleationCap('mirabilite') && rng.random() < 0.13) {
    const c = sim.nucleate('mirabilite', 'vug wall', sigma_mirab);
    sim.log.push(`  ✦ NUCLEATION: ❄️ Mirabilite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_mirab.toFixed(2)}, concentration=${sim.conditions.fluid.concentration.toFixed(1)}) — Glauber salt from the cold playa brine`);
  }

  // Thenardite nucleation — warm-side Na-sulfate evaporite. v29.
}
function _nuc_thenardite(sim) {
  const sigma_then = sim.conditions.supersaturation_thenardite();
  if (sigma_then > 1.0 && !sim._atNucleationCap('thenardite') && rng.random() < 0.13) {
    const c = sim.nucleate('thenardite', 'vug wall', sigma_then);
    sim.log.push(`  ✦ NUCLEATION: 🌫️ Thenardite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_then.toFixed(2)}, concentration=${sim.conditions.fluid.concentration.toFixed(1)}) — anhydrous Na₂SO₄ from the warm playa surface`);
  }

  // Borax nucleation — alkaline-brine borate evaporite, v28 mirror
  // of vugg.py. Needs Na + B + alkaline pH + low T + concentration
  // boost. Stays dormant in scenarios that don't drain.
}
function _nuc_chalcanthite(sim) {
  const sigma_cha = sim.conditions.supersaturation_chalcanthite();
  if (sigma_cha > 1.0 && !sim._atNucleationCap('chalcanthite')) {
    if (rng.random() < 0.20) {
      let pos = 'vug wall';
      const dissolving_brh_cha = sim.crystals.filter(c => c.mineral === 'brochantite' && c.dissolved);
      const dissolving_atl_cha = sim.crystals.filter(c => c.mineral === 'antlerite' && c.dissolved);
      if (dissolving_brh_cha.length && rng.random() < 0.5) pos = `on brochantite #${dissolving_brh_cha[0].crystal_id}`;
      else if (dissolving_atl_cha.length && rng.random() < 0.4) pos = `on antlerite #${dissolving_atl_cha[0].crystal_id}`;
      const c = sim.nucleate('chalcanthite', pos, sigma_cha);
      sim.log.push(`  ✦ NUCLEATION: Chalcanthite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_cha.toFixed(2)}, Cu=${sim.conditions.fluid.Cu.toFixed(0)}, S=${sim.conditions.fluid.S.toFixed(0)}, pH=${sim.conditions.fluid.pH.toFixed(1)}, salinity=${sim.conditions.fluid.salinity.toFixed(1)})`);
    }
  }

  // Descloizite nucleation — Pb + Zn + V + oxidizing.
}
function _nuc_anglesite(sim) {
  const sigma_ang = sim.conditions.supersaturation_anglesite();
  const existing_ang = sim.crystals.filter(c => c.mineral === 'anglesite' && c.active);
  if (sigma_ang > 1.1 && !sim._atNucleationCap('anglesite')) {
    if (!existing_ang.length || (sigma_ang > 1.8 && rng.random() < 0.25)) {
      let pos = 'vug wall';
      const dissolving_gal = sim.crystals.filter(c => c.mineral === 'galena' && (c.dissolved || rng.random() < 0.6));
      const active_gal_ang = sim.crystals.filter(c => c.mineral === 'galena' && c.active);
      if (dissolving_gal.length && rng.random() < 0.6) pos = `on galena #${dissolving_gal[0].crystal_id}`;
      else if (active_gal_ang.length && rng.random() < 0.4) pos = `on galena #${active_gal_ang[0].crystal_id}`;
      const c = sim.nucleate('anglesite', pos, sigma_ang);
      sim.log.push(`  ✦ NUCLEATION: Anglesite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_ang.toFixed(2)}, Pb=${sim.conditions.fluid.Pb.toFixed(0)}, S=${sim.conditions.fluid.S.toFixed(0)})`);
    }
  }

  // Cerussite nucleation — Pb + CO₃ (supergene).
}

function _nucleateClass_sulfate(sim) {
  _nuc_barite(sim);
  _nuc_celestine(sim);
  _nuc_jarosite(sim);
  _nuc_alunite(sim);
  _nuc_brochantite(sim);
  _nuc_antlerite(sim);
  _nuc_anhydrite(sim);
  _nuc_selenite(sim);
  _nuc_mirabilite(sim);
  _nuc_thenardite(sim);
  _nuc_chalcanthite(sim);
  _nuc_anglesite(sim);
}
