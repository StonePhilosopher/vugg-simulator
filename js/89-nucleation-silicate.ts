// ============================================================
// js/89-nucleation-silicate.ts — per-mineral nucleation gates (silicate)
// ============================================================
// One `_nuc_<mineral>(sim)` helper per supported silicate-class mineral.
// Each is a pure side-effecting function: reads sim state, conditionally
// calls sim.nucleate(...), and pushes a log line.
//
// VugSimulator.check_nucleation iterates over each class group via
// _nucleateClass_<klass>(sim). See 85-simulator.ts.
//
// Phase B15 of PROPOSAL-MODULAR-REFACTOR.

function _nuc_quartz(sim) {
  const sigma_q = sim.conditions.supersaturation_quartz();
  const existing_quartz = sim.crystals.filter(c => c.mineral === 'quartz' && c.active);
  if (sigma_q > 1.2 && existing_quartz.length < 3 && !sim._atNucleationCap('quartz')) {
    if (!existing_quartz.length || (sigma_q > 2.0 && rng.random() < 0.3)) {
      const c = sim.nucleate('quartz', 'vug wall', sigma_q);
      sim.log.push(`  ✦ NUCLEATION: Quartz #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_q.toFixed(2)})`);
    }
  }
}
function _nuc_apophyllite(sim) {
  const sigma_ap = sim.conditions.supersaturation_apophyllite();
  const existing_ap = sim.crystals.filter(c => c.mineral === 'apophyllite' && c.active);
  if (sigma_ap > 1.0 && !existing_ap.length && !sim._atNucleationCap('apophyllite')) {
    let pos = 'vug wall';
    const existing_q_ap = sim.crystals.filter(c => c.mineral === 'quartz' && c.active);
    const existing_hem_ap = sim.crystals.filter(c => c.mineral === 'hematite' && c.active);
    if (existing_hem_ap.length && rng.random() < 0.4) {
      pos = `on hematite #${existing_hem_ap[0].crystal_id}`;
    } else if (existing_q_ap.length && rng.random() < 0.3) {
      pos = `on quartz #${existing_q_ap[0].crystal_id}`;
    }
    const c = sim.nucleate('apophyllite', pos, sigma_ap);
    sim.log.push(`  ✦ NUCLEATION: Apophyllite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_ap.toFixed(2)})`);
  }

  // Hematite nucleation — needs sigma > 1.2 (harder to nucleate)
}
function _nuc_feldspar(sim) {
  const existing_quartz = sim.crystals.filter(c => c.mineral === 'quartz' && c.active);
  const sigma_feld = sim.conditions.supersaturation_feldspar();
  const existing_feld = sim.crystals.filter(c => c.mineral === 'feldspar' && c.active);
  const total_feld = sim.crystals.filter(c => c.mineral === 'feldspar').length;
  if (sigma_feld > 1.0 && existing_feld.length < 3 && total_feld < 6 && !sim._atNucleationCap('feldspar')) {
    if (!existing_feld.length || (sigma_feld > 1.8 && rng.random() < 0.3)) {
      let pos = 'vug wall';
      // Can nucleate on quartz in pegmatite conditions
      if (existing_quartz.length && rng.random() < 0.3) {
        pos = `on quartz #${existing_quartz[0].crystal_id}`;
      }
      const c = sim.nucleate('feldspar', pos, sigma_feld);
      const T = sim.conditions.temperature;
      const polyName = T > 500 ? 'sanidine' : (T > 300 ? 'orthoclase' : 'microcline');
      c.mineral_display = polyName;
      sim.log.push(`  ✦ NUCLEATION: Feldspar #${c.crystal_id} (${polyName}) on ${c.position} (T=${T.toFixed(0)}°C, σ=${sigma_feld.toFixed(2)}) — ${T > 500 ? 'disordered high-T form' : T > 300 ? 'partially ordered' : 'fully ordered triclinic'}`);
    }
  }

  // Albite nucleation — Na-feldspar, often co-occurs with K-feldspar in pegmatites.
}
function _nuc_albite(sim) {
  const existing_quartz = sim.crystals.filter(c => c.mineral === 'quartz' && c.active);
  const existing_feld = sim.crystals.filter(c => c.mineral === 'feldspar' && c.active);
  const sigma_alb = sim.conditions.supersaturation_albite();
  const existing_alb = sim.crystals.filter(c => c.mineral === 'albite' && c.active);
  const total_alb = sim.crystals.filter(c => c.mineral === 'albite').length;
  if (sigma_alb > 1.0 && existing_alb.length < 2 && total_alb < 4 && !sim._atNucleationCap('albite')) {
    if (!existing_alb.length || (sigma_alb > 1.5 && rng.random() < 0.25)) {
      let pos = 'vug wall';
      // Classic perthite association — albite on feldspar host
      if (existing_feld.length && rng.random() < 0.5) pos = `on feldspar #${existing_feld[0].crystal_id}`;
      else if (existing_quartz.length && rng.random() < 0.3) pos = `on quartz #${existing_quartz[0].crystal_id}`;
      const c = sim.nucleate('albite', pos, sigma_alb);
      sim.log.push(`  ✦ NUCLEATION: Albite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_alb.toFixed(2)})`);
    }
  }

  // Galena nucleation — needs sigma > 1.0, max 4 active / 8 total
}
function _nuc_chrysocolla(sim) {
  const sigma_chry = sim.conditions.supersaturation_chrysocolla();
  const existing_chry = sim.crystals.filter(c => c.mineral === 'chrysocolla' && c.active);
  if (sim._atNucleationCap('chrysocolla')) return;
  // Pick substrate first, then σ-check with discount.
  let pos = 'vug wall';
  const active_azr_chry = sim.crystals.filter(c => c.mineral === 'azurite' && c.active);
  const dissolving_azr_chry = sim.crystals.filter(c => c.mineral === 'azurite' && c.dissolved);
  const active_cpr_chry = sim.crystals.filter(c => c.mineral === 'cuprite' && c.active);
  const active_nc_chry = sim.crystals.filter(c => c.mineral === 'native_copper' && c.active);
  if (dissolving_azr_chry.length && rng.random() < 0.6) pos = `pseudomorph after azurite #${dissolving_azr_chry[0].crystal_id}`;
  else if (active_azr_chry.length && rng.random() < 0.3) pos = `on azurite #${active_azr_chry[0].crystal_id}`;
  else if (active_cpr_chry.length && rng.random() < 0.5) pos = `on cuprite #${active_cpr_chry[0].crystal_id}`;
  else if (active_nc_chry.length && rng.random() < 0.4) pos = `on native_copper #${active_nc_chry[0].crystal_id}`;
  const discount = sim._sigmaDiscountForPosition('chrysocolla', pos);
  if (sigma_chry > 1.2 * discount) {
    if (!existing_chry.length || (sigma_chry > 1.8 && rng.random() < 0.25)) {
      const c = sim.nucleate('chrysocolla', pos, sigma_chry);
      sim.log.push(`  ✦ NUCLEATION: Chrysocolla #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_chry.toFixed(2)}, Cu=${sim.conditions.fluid.Cu.toFixed(0)}, SiO₂=${sim.conditions.fluid.SiO2.toFixed(0)}, CO₃=${sim.conditions.fluid.CO3.toFixed(0)})`);
    }
  }

  // Native copper nucleation — Cu + strongly reducing + low S.
}
function _nuc_spodumene(sim) {
  const sigma_spd = sim.conditions.supersaturation_spodumene();
  const existing_spd = sim.crystals.filter(c => c.mineral === 'spodumene' && c.active);
  if (sigma_spd > 1.5 && !sim._atNucleationCap('spodumene')) {
    if (!existing_spd.length || (sigma_spd > 2.5 && rng.random() < 0.15)) {
      let pos = 'vug wall';
      const existing_qtz_spd = sim.crystals.filter(c => c.mineral === 'quartz' && c.active);
      const existing_feld_spd = sim.crystals.filter(c => c.mineral === 'feldspar' && c.active);
      if (existing_qtz_spd.length && rng.random() < 0.35) {
        pos = `on quartz #${existing_qtz_spd[0].crystal_id}`;
      } else if (existing_feld_spd.length && rng.random() < 0.35) {
        pos = `on feldspar #${existing_feld_spd[0].crystal_id}`;
      }
      const c = sim.nucleate('spodumene', pos, sigma_spd);
      const f = sim.conditions.fluid;
      let tag;
      if (f.Cr > 0.5) tag = 'hiddenite';
      else if (f.Mn > 2.0) tag = 'kunzite';
      else if (f.Fe > 10) tag = 'triphane-yellow';
      else tag = 'triphane';
      sim.log.push(`  ✦ NUCLEATION: Spodumene #${c.crystal_id} (${tag}) on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_spd.toFixed(2)}, Li=${f.Li.toFixed(0)} ppm, Mn=${f.Mn.toFixed(1)}, Cr=${f.Cr.toFixed(2)})`);
    }
  }

  // Beryl family nucleation — Be + Al + SiO₂ with chromophore dispatch.
  // Post-Round-7: 5 species (emerald/morganite/heliodor/aquamarine/
  // goshenite(beryl)) each nucleate via their own supersaturation
  // function, which encodes the priority chain through exclusion
  // preconditions. Dispatch evaluates each in priority order and fires
  // AT MOST ONE per step — the shared Be pool would otherwise let two
  // siblings over-nucleate.
  const beryl_family_candidates = [
    ['emerald', sim.conditions.supersaturation_emerald(), 1.4],
    ['morganite', sim.conditions.supersaturation_morganite(), 1.4],
    ['heliodor', sim.conditions.supersaturation_heliodor(), 1.4],
    ['aquamarine', sim.conditions.supersaturation_aquamarine(), 1.3],
    ['beryl', sim.conditions.supersaturation_beryl(), 1.8],
  ];
  const existing_qtz_ber = sim.crystals.filter(c => c.mineral === 'quartz' && c.active);
  const existing_feld_ber = sim.crystals.filter(c => c.mineral === 'feldspar' && c.active);
  for (const [species, sigma_bf, threshold] of beryl_family_candidates) {
    if (sigma_bf <= threshold) continue;
    if (sim._atNucleationCap(species)) continue;
    const existing_sp = sim.crystals.filter(c => c.mineral === species && c.active);
    if (existing_sp.length && !(sigma_bf > threshold + 0.7 && rng.random() < 0.15)) continue;
    let pos = 'vug wall';
    if (existing_qtz_ber.length && rng.random() < 0.4) {
      pos = `on quartz #${existing_qtz_ber[0].crystal_id}`;
    } else if (existing_feld_ber.length && rng.random() < 0.4) {
      pos = `on feldspar #${existing_feld_ber[0].crystal_id}`;
    }
    const c = sim.nucleate(species, pos, sigma_bf);
    const f = sim.conditions.fluid;
    const speciesCap = species.charAt(0).toUpperCase() + species.slice(1);
    sim.log.push(`  ✦ NUCLEATION: ${speciesCap} #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_bf.toFixed(2)}, Be=${f.Be.toFixed(0)} ppm, Cr=${f.Cr.toFixed(2)}, Fe=${f.Fe.toFixed(0)}, Mn=${f.Mn.toFixed(2)})`);
    break;  // only one beryl-family nucleation per step
  }

  // Corundum family nucleation — Al₂O₃ with SiO₂-undersaturation upper gate.
  // Priority: ruby > sapphire > corundum. One per step (shared Al pool).
  //
  // Stale-mineral retune (2026-05, post-Backlog K): ruby threshold dropped
  // from 1.5 → 1.3 to match the actual σ ceiling the supersaturation_ruby()
  // formula produces in marble_contact_metamorphism (peak σ ≈ 1.42 at
  // T=700°C, Cr=4.5 ppm, Al=65 ppm in tools/stale_mineral_probe.mjs).
  // The 1.5 was the spec's nucleation_sigma anchor; the formula's
  // `base * min(Cr/5, 2)` ceiling never reaches it at typical
  // marble-fluid Cr concentrations (Mogok-type fluids carry ~5-10 ppm Cr).
  // Sapphire stays at 1.4 (Fe+Ti substitution is harder than Cr), corundum
  // at 1.3 (no chromophore selectivity advantage). Priority by array order:
  // ruby first, so the tie with corundum at 1.3 still hands ruby the slot.
  const corundum_family_candidates = [
    ['ruby', sim.conditions.supersaturation_ruby(), MINERAL_GATES_ruby.sigma_crit],
    ['sapphire', sim.conditions.supersaturation_sapphire(), MINERAL_GATES_sapphire.sigma_crit],
    ['corundum', sim.conditions.supersaturation_corundum(), MINERAL_GATES_corundum.sigma_crit],
  ];
  for (const [species, sigma_cf, threshold] of corundum_family_candidates) {
    if (sigma_cf <= threshold) continue;
    if (sim._atNucleationCap(species)) continue;
    const existing_sp = sim.crystals.filter(c => c.mineral === species && c.active);
    if (existing_sp.length && !(sigma_cf > threshold + 0.5 && rng.random() < 0.2)) continue;
    const pos = 'vug wall';
    const c = sim.nucleate(species, pos, sigma_cf);
    const f = sim.conditions.fluid;
    const speciesCap = species.charAt(0).toUpperCase() + species.slice(1);
    sim.log.push(`  ✦ NUCLEATION: ${speciesCap} #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_cf.toFixed(2)}, Al=${f.Al.toFixed(0)}, SiO2=${f.SiO2.toFixed(0)}, Cr=${f.Cr.toFixed(2)}, Fe=${f.Fe.toFixed(1)}, Ti=${f.Ti.toFixed(2)})`);
    break;  // only one corundum-family nucleation per step
  }

  // Tourmaline nucleation — Na + B + Al + SiO₂ (B-gated, σ=1.3).
  // Schorl (Fe²⁺-dominant black) early, elbaite varieties (rubellite,
  // verdelite, indicolite, Paraíba) late as Fe depletes and Li
  // accumulates. Nucleation label previews the variety likely to grow.
}
function _nuc_tourmaline(sim) {
  const sigma_tml = sim.conditions.supersaturation_tourmaline();
  const existing_tml = sim.crystals.filter(c => c.mineral === 'tourmaline' && c.active);
  if (sigma_tml > 1.3 && !sim._atNucleationCap('tourmaline')) {
    if (!existing_tml.length || (sigma_tml > 2.0 && rng.random() < 0.25)) {
      let pos = 'vug wall';
      const existing_qtz_tml = sim.crystals.filter(c => c.mineral === 'quartz' && c.active);
      const existing_feldspar_tml = sim.crystals.filter(c => c.mineral === 'feldspar' && c.active);
      if (existing_qtz_tml.length && rng.random() < 0.4) {
        pos = `on quartz #${existing_qtz_tml[0].crystal_id}`;
      } else if (existing_feldspar_tml.length && rng.random() < 0.4) {
        pos = `on feldspar #${existing_feldspar_tml[0].crystal_id}`;
      }
      const c = sim.nucleate('tourmaline', pos, sigma_tml);
      const f = sim.conditions.fluid;
      let tag;
      if (f.Cu > 1.0) tag = 'Paraíba';
      else if (f.Li > 10 && f.Mn > 0.3) tag = 'rubellite';
      else if (f.Li > 10 && (f.Cr > 0.5 || f.V > 1.0)) tag = 'verdelite';
      else if (f.Fe > 15 && f.Li < 5) tag = 'schorl';
      else if (f.Li > 10) tag = 'elbaite';
      else tag = 'mixed';
      sim.log.push(`  ✦ NUCLEATION: Tourmaline #${c.crystal_id} (${tag}) on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_tml.toFixed(2)}, B=${f.B.toFixed(0)} ppm, Fe=${f.Fe.toFixed(0)}, Li=${f.Li.toFixed(0)})`);
    }
  }

  // Topaz nucleation — Al + SiO₂ + F (F-gated, nucleation_sigma=1.4).
  // Threshold is the Ouro Preto gate: early quartz grows alone while
  // fluorine accumulates; topaz appears only when F crosses saturation.
  // Often grows on quartz (vein-lining paragenesis).
}
function _nuc_topaz(sim) {
  const sigma_tpz = sim.conditions.supersaturation_topaz();
  const existing_tpz = sim.crystals.filter(c => c.mineral === 'topaz' && c.active);
  if (sigma_tpz > 1.4 && !sim._atNucleationCap('topaz')) {
    if (!existing_tpz.length || (sigma_tpz > 2.0 && rng.random() < 0.3)) {
      let pos = 'vug wall';
      const existing_qtz_tpz = sim.crystals.filter(c => c.mineral === 'quartz' && c.active);
      if (existing_qtz_tpz.length && rng.random() < 0.5) {
        pos = `on quartz #${existing_qtz_tpz[0].crystal_id}`;
      }
      const c = sim.nucleate('topaz', pos, sigma_tpz);
      const imperial = sim.conditions.fluid.Cr > 3.0;
      const flag = imperial ? ' ✨ imperial color window open' : '';
      sim.log.push(`  ✦ NUCLEATION: Topaz #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_tpz.toFixed(2)}, F=${sim.conditions.fluid.F.toFixed(0)} ppm, Cr=${sim.conditions.fluid.Cr.toFixed(1)} ppm)${flag}`);
    }
  }

  // Rosasite nucleation — Cu-dominant supergene carbonate (Round 9a).
  // The broth-ratio gate (Cu/(Cu+Zn) > 0.5) is enforced inside
  // supersaturation_rosasite, so we don't double-check here. Substrate
  // preference: weathering chalcopyrite (Cu source) or weathering
  // sphalerite (Zn co-source), or bare wall.
}

function _nuc_lepidolite(sim) {
  // Lepidolite K(Li,Al)₃(Al,Si)₄O₁₀(F,OH)₂ — Li-mica, late-pegmatite
  // (research-lepidolite.md). Nucleates after the quartz/feldspar
  // outer shell + tourmaline/spodumene Li-suite are established;
  // commonly replaces existing spodumene during late hydrothermal
  // phase (research-lepidolite.md §Paragenesis: "Often replaces:
  // Spodumene during late hydrothermal alteration"). Substrate
  // preferences mirror that paragenetic ordering: spodumene > tourmaline
  // > feldspar > quartz > bare wall.
  //
  // Cap 3-4 per vug per the research's §Nucleation Pseudocode
  // ("existing_lepidolite_count < 3-4 per vug"). Threshold 1.2 leaves
  // room for the engine's high-σ ceiling to differentiate the variety
  // chromophore branches in grow_lepidolite.
  const sigma_lep = sim.conditions.supersaturation_lepidolite();
  const existing_lep = sim.crystals.filter(c => c.mineral === 'lepidolite' && c.active);
  if (sigma_lep > 1.2 && existing_lep.length < 3 && !sim._atNucleationCap('lepidolite')) {
    if (!existing_lep.length || (sigma_lep > 2.0 && rng.random() < 0.25)) {
      let pos = 'vug wall';
      // Substrate priority — spodumene first (most paragenetically
      // meaningful, the documented replacement target), then other
      // pegmatite minerals.
      const existing_spd_lep  = sim.crystals.filter(c => c.mineral === 'spodumene'  && c.active);
      const existing_tml_lep  = sim.crystals.filter(c => c.mineral === 'tourmaline' && c.active);
      const existing_feld_lep = sim.crystals.filter(c => c.mineral === 'feldspar'   && c.active);
      const existing_qtz_lep  = sim.crystals.filter(c => c.mineral === 'quartz'     && c.active);
      if (existing_spd_lep.length && rng.random() < 0.4) {
        pos = `on spodumene #${existing_spd_lep[0].crystal_id}`;
      } else if (existing_tml_lep.length && rng.random() < 0.3) {
        pos = `on tourmaline #${existing_tml_lep[0].crystal_id}`;
      } else if (existing_feld_lep.length && rng.random() < 0.3) {
        pos = `on feldspar #${existing_feld_lep[0].crystal_id}`;
      } else if (existing_qtz_lep.length && rng.random() < 0.3) {
        pos = `on quartz #${existing_qtz_lep[0].crystal_id}`;
      }
      const c = sim.nucleate('lepidolite', pos, sigma_lep);
      const f = sim.conditions.fluid;
      let tag;
      if (f.Mn >= 2.0) tag = 'purple-book';
      else if (f.Fe >= 50 && f.Fe < 500) tag = 'gray-book';
      else tag = 'pale-book';
      sim.log.push(`  ✦ NUCLEATION: Lepidolite #${c.crystal_id} (${tag}) on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_lep.toFixed(2)}, Li=${f.Li.toFixed(0)} ppm, F=${f.F.toFixed(0)}, K=${f.K.toFixed(0)}, Mn=${f.Mn.toFixed(1)})`);
    }
  }
}

function _nuc_chrysoprase(sim) {
  // Stale-mineral retune (2026-05): threshold dropped 1.2 → 1.0. The
  // supersaturation_chrysoprase() formula (SiO2/300 × Ni/200 × Mg/200 ×
  // T_factor × pH_window × Cr_competition) peaks at σ ≈ 1.0 under
  // ultramafic_supergene's broth (SiO2≤170, Ni=200, Mg=300 at T=28°C
  // pH=8.5). tools/stale_mineral_probe.mjs found σ > 1.0 in only 1/600
  // (seed × step) pairs — chrysoprase IS hard to form geologically (slow
  // chalcedony deposition needs sustained Ni-Si saturation, hence the
  // weeks-to-years timescale at Marlborough QLD), so the formula
  // ceiling is calibrated correctly. The 1.2 threshold was just above
  // the formula's ceiling — restructuring it as 1.0 lets chrysoprase
  // pass when σ just barely clears unity, matching the geological "rare
  // but possible" semantics.
  const sigma = sim.conditions.supersaturation_chrysoprase();
  if (sigma > 1.0 && !sim._atNucleationCap('chrysoprase') && rng.random() < 0.12) {
    const c = sim.nucleate('chrysoprase', 'vug wall', sigma);
    sim.log.push(`  ✦ NUCLEATION: 🟢 Chrysoprase #${c.crystal_id} on ${c.position} (Ni ${sim.conditions.fluid.Ni.toFixed(0)} Mg ${sim.conditions.fluid.Mg.toFixed(0)} SiO2 ${sim.conditions.fluid.SiO2.toFixed(0)} ppm, σ=${sigma.toFixed(2)}) — apple-green Ni-bearing chalcedony, ultramafic supergene`);
  }
}

// v93 (2026-05-19): Cu-silicate pair for the Tsumeb / Bisbee 2nd
// oxidation zone. Substrate priority encodes the canonical paragenesis:
//   - dioptase preferentially nucleates on calcite, dolomite, chrysocolla
//   - shattuckite preferentially REPLACES malachite/azurite (the Bisbee
//     "pseudomorph after malachite" texture) and nucleates on chrysocolla.
// Per research dossier 2026-05 (Evans & Mrose 1977, Keller 1977, Schaller
// 1915 type locality Shattuck mine).
// v101 (2026-05-19): Opal SiO2·nH2O — amorphous-to-short-range-ordered
// silica. Hot-spring sinter host. Substrate priority encodes the
// "embeds everything" universal-binder role of opal in hot-spring
// systems. RNG-cascade guard via sigma < 1.0 early-out.
function _nuc_opal(sim) {
  const sigma = sim.conditions.supersaturation_opal();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('opal')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'opal' && c.active);
  if (existing.length >= 5) return;  // sinter mound = many opal crystals
  // Opal nucleates on essentially anything in the effluent path
  let pos = 'vug wall';
  const cin = sim.crystals.filter(c => c.mineral === 'cinnabar' && c.active);
  const sul = sim.crystals.filter(c => c.mineral === 'native_sulfur' && c.active);
  const py = sim.crystals.filter(c => c.mineral === 'pyrite' && c.active);
  if (cin.length && rng.random() < 0.30) pos = `sinter coating cinnabar #${cin[0].crystal_id}`;
  else if (sul.length && rng.random() < 0.30) pos = `sinter embedding native_sulfur #${sul[0].crystal_id}`;
  else if (py.length && rng.random() < 0.20) pos = `coating pyrite #${py[0].crystal_id}`;
  const c = sim.nucleate('opal', pos, sigma);
  const stage = sim.conditions.temperature < 50 ? 'opal-A (amorphous, fresh sinter)' : 'opal-CT (partially aged)';
  sim.log.push(`  ✦ NUCLEATION: ⚪ Opal #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, SiO₂=${sim.conditions.fluid.SiO2.toFixed(0)}, pH=${sim.conditions.fluid.pH.toFixed(1)}) — ${stage}, hot-spring sinter platform`);
}

// v99 (2026-05-19): Uranyl silicates — coffinite (U(IV) primary) +
// uranophane (U(VI) supergene). Opposite redox sides. Substrate
// priority encodes Finch & Murakami 1999 paragenesis: coffinite
// replaces uraninite along fractures; uranophane replaces uraninite/
// coffinite at the oxidation front.

function _nuc_coffinite(sim) {
  const sigma = sim.conditions.supersaturation_coffinite();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('coffinite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'coffinite' && c.active);
  if (existing.length >= 2) return;
  let pos = 'vug wall';
  const urn = sim.crystals.filter(c => c.mineral === 'uraninite' && c.active);
  const py = sim.crystals.filter(c => c.mineral === 'pyrite' && c.active);
  if (urn.length && rng.random() < 0.65) pos = `fracture replacement on uraninite #${urn[0].crystal_id}`;
  else if (py.length && rng.random() < 0.25) pos = `with pyrite + organic matter #${py[0].crystal_id}`;
  const c = sim.nucleate('coffinite', pos, sigma);
  sim.log.push(`  ✦ NUCLEATION: ⬛ Coffinite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, U=${sim.conditions.fluid.U.toFixed(1)}, SiO₂=${sim.conditions.fluid.SiO2.toFixed(0)}) — U(IV) silicate, primary reducing; not fluorescent`);
}

function _nuc_uranophane(sim) {
  const sigma = sim.conditions.supersaturation_uranophane();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('uranophane')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'uranophane' && c.active);
  if (existing.length >= 3) return;
  let pos = 'vug wall';
  const urn_diss = sim.crystals.filter(c => c.mineral === 'uraninite' && c.dissolved);
  const urn = sim.crystals.filter(c => c.mineral === 'uraninite' && c.active);
  const cof = sim.crystals.filter(c => c.mineral === 'coffinite' && c.dissolved);
  if (urn_diss.length && rng.random() < 0.55) pos = `oxidation front after uraninite #${urn_diss[0].crystal_id}`;
  else if (cof.length && rng.random() < 0.50) pos = `oxidation front after coffinite #${cof[0].crystal_id}`;
  else if (urn.length && rng.random() < 0.35) pos = `weathering crust on uraninite #${urn[0].crystal_id}`;
  const c = sim.nucleate('uranophane', pos, sigma);
  sim.log.push(`  ✦ NUCLEATION: 💛 Uranophane #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, U=${sim.conditions.fluid.U.toFixed(1)}, Ca=${sim.conditions.fluid.Ca.toFixed(0)}, SiO₂=${sim.conditions.fluid.SiO2.toFixed(0)}) — supergene U(VI) silicate, UV-fluorescent yellow-green`);
}

// v98 (2026-05-19): Zn supergene silicates — hemimorphite + willemite.
// Substrate priority encodes Hitzman 2003 + Boni & Mondillo 2015
// nonsulfide-Zn paragenesis. RNG-cascade guard via sigma < 1.0 early-out.

function _nuc_hemimorphite(sim) {
  const sigma = sim.conditions.supersaturation_hemimorphite();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('hemimorphite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'hemimorphite' && c.active);
  if (existing.length >= 3) return;
  let pos = 'vug wall';
  const smith = sim.crystals.filter(c => c.mineral === 'smithsonite' && c.active);
  const sph = sim.crystals.filter(c => c.mineral === 'sphalerite' && c.dissolved);
  const goe = sim.crystals.filter(c => c.mineral === 'goethite' && c.active);
  if (smith.length && rng.random() < 0.55) pos = `sheaves on smithsonite #${smith[0].crystal_id}`;
  else if (sph.length && rng.random() < 0.40) pos = `replacing sphalerite #${sph[0].crystal_id}`;
  else if (goe.length && rng.random() < 0.30) pos = `on goethite/limonite gossan #${goe[0].crystal_id}`;
  const c = sim.nucleate('hemimorphite', pos, sigma);
  sim.log.push(`  ✦ NUCLEATION: 🔷 Hemimorphite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Zn=${sim.conditions.fluid.Zn.toFixed(0)}, SiO₂=${sim.conditions.fluid.SiO2.toFixed(0)}, CO₃=${sim.conditions.fluid.CO3.toFixed(0)}) — Zn-silicate sheaves, hemimorphic polar crystals`);
}

function _nuc_willemite(sim) {
  const sigma = sim.conditions.supersaturation_willemite();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('willemite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'willemite' && c.active);
  if (existing.length >= 3) return;
  let pos = 'vug wall';
  const sph = sim.crystals.filter(c => c.mineral === 'sphalerite' && c.active);
  const smith = sim.crystals.filter(c => c.mineral === 'smithsonite' && c.active);
  if (sph.length && rng.random() < 0.55) pos = `replacing sphalerite #${sph[0].crystal_id}`;
  else if (smith.length && rng.random() < 0.35) pos = `epitactic on smithsonite #${smith[0].crystal_id}`;
  const c = sim.nucleate('willemite', pos, sigma);
  const mode = sim.conditions.temperature >= 500 ? 'PRIMARY/metamorphic (Franklin)' : 'SUPERGENE nonsulfide (Skorpion)';
  sim.log.push(`  ✦ NUCLEATION: 💚 Willemite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Zn=${sim.conditions.fluid.Zn.toFixed(0)}, SiO₂=${sim.conditions.fluid.SiO2.toFixed(0)}, Mn=${sim.conditions.fluid.Mn.toFixed(2)}) — ${mode}, UV-fluorescent green`);
}

function _nuc_dioptase(sim) {
  const sigma = sim.conditions.supersaturation_dioptase();
  // CRITICAL: early-out before any rng.random() to keep RNG cascade
  // byte-identical for non-Cu-Si scenarios. The 1.0 floor is below the
  // 1.2 nucleation threshold so we still allow substrate picking when
  // there's a real chance to fire.
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('dioptase')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'dioptase' && c.active);
  let pos = 'vug wall';
  const active_cal = sim.crystals.filter(c => c.mineral === 'calcite' && c.active);
  const active_dol = sim.crystals.filter(c => c.mineral === 'dolomite' && c.active);
  const active_chr = sim.crystals.filter(c => c.mineral === 'chrysocolla' && c.active);
  const dissolving_mal = sim.crystals.filter(c => c.mineral === 'malachite' && c.dissolved);
  if (active_cal.length && rng.random() < 0.55) pos = `on calcite #${active_cal[0].crystal_id}`;
  else if (active_dol.length && rng.random() < 0.40) pos = `on dolomite #${active_dol[0].crystal_id}`;
  else if (active_chr.length && rng.random() < 0.35) pos = `on chrysocolla #${active_chr[0].crystal_id}`;
  else if (dissolving_mal.length && rng.random() < 0.15) pos = `pseudomorph after malachite #${dissolving_mal[0].crystal_id}`;
  const discount = sim._sigmaDiscountForPosition('dioptase', pos);
  if (sigma > 1.2 * discount) {
    if (!existing.length || (sigma > 2.0 && rng.random() < 0.20)) {
      const c = sim.nucleate('dioptase', pos, sigma);
      sim.log.push(`  ✦ NUCLEATION: 💎 Dioptase #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Cu=${sim.conditions.fluid.Cu.toFixed(0)}, SiO₂=${sim.conditions.fluid.SiO2.toFixed(0)}, CO₃=${sim.conditions.fluid.CO3.toFixed(0)}) — emerald-green Tsumeb 2nd oxidation zone signature`);
    }
  }
}

function _nuc_shattuckite(sim) {
  const sigma = sim.conditions.supersaturation_shattuckite();
  if (sigma < 1.0) return;  // RNG-cascade guard (see _nuc_dioptase comment)
  if (sim._atNucleationCap('shattuckite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'shattuckite' && c.active);
  let pos = 'vug wall';
  // Replacement of malachite/azurite is the canonical Bisbee texture
  const dissolving_mal = sim.crystals.filter(c => c.mineral === 'malachite' && c.dissolved);
  const active_mal = sim.crystals.filter(c => c.mineral === 'malachite' && c.active);
  const dissolving_azr = sim.crystals.filter(c => c.mineral === 'azurite' && c.dissolved);
  const active_azr = sim.crystals.filter(c => c.mineral === 'azurite' && c.active);
  const active_chr = sim.crystals.filter(c => c.mineral === 'chrysocolla' && c.active);
  if (dissolving_mal.length && rng.random() < 0.65) pos = `pseudomorph after malachite #${dissolving_mal[0].crystal_id}`;
  else if (active_mal.length && rng.random() < 0.45) pos = `replacing malachite #${active_mal[0].crystal_id}`;
  else if (dissolving_azr.length && rng.random() < 0.50) pos = `pseudomorph after azurite #${dissolving_azr[0].crystal_id}`;
  else if (active_azr.length && rng.random() < 0.30) pos = `on azurite #${active_azr[0].crystal_id}`;
  else if (active_chr.length && rng.random() < 0.40) pos = `on chrysocolla #${active_chr[0].crystal_id}`;
  const discount = sim._sigmaDiscountForPosition('shattuckite', pos);
  if (sigma > 1.2 * discount) {
    if (!existing.length || (sigma > 2.0 && rng.random() < 0.20)) {
      const c = sim.nucleate('shattuckite', pos, sigma);
      sim.log.push(`  ✦ NUCLEATION: 🔵 Shattuckite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Cu=${sim.conditions.fluid.Cu.toFixed(0)}, SiO₂=${sim.conditions.fluid.SiO2.toFixed(0)}, CO₃=${sim.conditions.fluid.CO3.toFixed(0)}) — azure-blue Bisbee type-locality Cu-silicate`);
    }
  }
}

// v116 (2026-05-20): Tiger's eye — chalcedony pseudomorph after
// crocidolite. Substrate priority: crocidolite_dissolving (canonical
// pseudomorph substrate, p=0.65) > hematite (BIF tiger-iron context,
// p=0.45) > magnetite > wall.
function _nuc_tigers_eye(sim) {
  const sigma = sim.conditions.supersaturation_tigers_eye();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('tigers_eye')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'tigers_eye' && c.active);
  if (existing.length >= 3) return;
  let pos = 'vug wall';
  const dissolving_croc = sim.crystals.filter(c => c.mineral === 'crocidolite' && c.dissolved);
  const active_hem = sim.crystals.filter(c => c.mineral === 'hematite' && c.active);
  const active_mag = sim.crystals.filter(c => c.mineral === 'magnetite' && c.active);
  if (dissolving_croc.length && rng.random() < 0.65) pos = `pseudomorph after crocidolite #${dissolving_croc[0].crystal_id} (the canonical tiger's eye paragenesis)`;
  else if (active_hem.length && rng.random() < 0.45) pos = `with hematite #${active_hem[0].crystal_id} (TIGER IRON BIF context)`;
  else if (active_mag.length && rng.random() < 0.30) pos = `with magnetite #${active_mag[0].crystal_id} (BIF residual)`;
  const discount = sim._sigmaDiscountForPosition('tigers_eye', pos);
  if (sigma > 1.2 * discount) {
    if (!existing.length || (sigma > 2.0 && rng.random() < 0.22)) {
      const c = sim.nucleate('tigers_eye', pos, sigma);
      const variety = pos.includes('hematite') ? 'TIGER IRON' : (pos.includes('crocidolite') ? 'CHATOYANT pseudomorph' : 'chalcedony');
      sim.log.push(`  ✦ NUCLEATION: 🐅 Tiger's eye #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, SiO₂=${sim.conditions.fluid.SiO2.toFixed(0)}, Fe=${sim.conditions.fluid.Fe.toFixed(0)}, O₂=${sim.conditions.fluid.O2.toFixed(1)}) — ${variety}, supergene chalcedony pseudomorph after crocidolite`);
    }
  }
}

// v114 (2026-05-20): Chrysotile Mg3Si2O5(OH)4 — fibrous serpentine
// asbestos. Jeffrey Mine signature host matrix. Substrate priority:
// magnetite (rodingite co-formation) > olivine_dissolving (the
// serpentinization precursor — when wired; not currently) > wall.
// RNG-cascade-guarded.
function _nuc_chrysotile(sim) {
  const sigma = sim.conditions.supersaturation_chrysotile();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('chrysotile')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'chrysotile' && c.active);
  if (existing.length >= 5) return;  // host-matrix mineral; allow many
  let pos = 'vug wall';
  const active_mag = sim.crystals.filter(c => c.mineral === 'magnetite' && c.active);
  if (active_mag.length && rng.random() < 0.40) pos = `with magnetite #${active_mag[0].crystal_id} — both serpentinization products`;
  const discount = sim._sigmaDiscountForPosition('chrysotile', pos);
  if (sigma > 1.2 * discount) {
    if (!existing.length || (sigma > 2.0 && rng.random() < 0.25)) {
      const c = sim.nucleate('chrysotile', pos, sigma);
      sim.log.push(`  ✦ NUCLEATION: ⚪ Chrysotile #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Mg=${sim.conditions.fluid.Mg.toFixed(0)}, SiO₂=${sim.conditions.fluid.SiO2.toFixed(0)}, pH=${sim.conditions.fluid.pH.toFixed(1)}) — fibrous serpentine, the Jeffrey Mine commercial chrysotile`);
    }
  }
}

// v113 (2026-05-20): Ca-silicate trio (pectolite + wollastonite +
// prehnite) — late-stage rodingite + skarn + basalt-amygdale
// minerals. All RNG-cascade-guarded.
function _nuc_pectolite(sim) {
  const sigma = sim.conditions.supersaturation_pectolite();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('pectolite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'pectolite' && c.active);
  if (existing.length >= 4) return;
  let pos = 'vug wall';
  // Jeffrey Mine spray-on-grossular is the signature substrate
  const active_gross = sim.crystals.filter(c => c.mineral === 'grossular' && c.active);
  const active_diop = sim.crystals.filter(c => c.mineral === 'diopside' && c.active);
  const active_vesu = sim.crystals.filter(c => c.mineral === 'vesuvianite' && c.active);
  const active_cal = sim.crystals.filter(c => c.mineral === 'calcite' && c.active);
  if (active_gross.length && rng.random() < 0.55) pos = `radiating spray on grossular #${active_gross[0].crystal_id}`;
  else if (active_diop.length && rng.random() < 0.45) pos = `with diopside #${active_diop[0].crystal_id}`;
  else if (active_vesu.length && rng.random() < 0.40) pos = `with vesuvianite #${active_vesu[0].crystal_id}`;
  else if (active_cal.length && rng.random() < 0.30) pos = `on calcite #${active_cal[0].crystal_id}`;
  const discount = sim._sigmaDiscountForPosition('pectolite', pos);
  if (sigma > 1.2 * discount) {
    if (!existing.length || (sigma > 2.0 && rng.random() < 0.22)) {
      const c = sim.nucleate('pectolite', pos, sigma);
      const cu = sim.conditions.fluid.Cu;
      const variety = cu > 0.5 ? 'BLUE LARIMAR-TINTED' : 'white spray';
      sim.log.push(`  ✦ NUCLEATION: 🤍 Pectolite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Na=${sim.conditions.fluid.Na.toFixed(0)}, Ca=${sim.conditions.fluid.Ca.toFixed(0)}, Cu=${cu.toFixed(2)}, pH=${sim.conditions.fluid.pH.toFixed(1)}) — ${variety}, Na-Ca inosilicate spray`);
    }
  }
}

function _nuc_wollastonite(sim) {
  const sigma = sim.conditions.supersaturation_wollastonite();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('wollastonite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'wollastonite' && c.active);
  if (existing.length >= 4) return;
  let pos = 'vug wall';
  const active_gross = sim.crystals.filter(c => c.mineral === 'grossular' && c.active);
  const active_diop = sim.crystals.filter(c => c.mineral === 'diopside' && c.active);
  const active_cal = sim.crystals.filter(c => c.mineral === 'calcite' && c.active);
  if (active_gross.length && rng.random() < 0.45) pos = `with grossular #${active_gross[0].crystal_id}`;
  else if (active_diop.length && rng.random() < 0.40) pos = `with diopside #${active_diop[0].crystal_id}`;
  else if (active_cal.length && rng.random() < 0.35) pos = `on calcite #${active_cal[0].crystal_id}`;
  const discount = sim._sigmaDiscountForPosition('wollastonite', pos);
  if (sigma > 1.2 * discount) {
    if (!existing.length || (sigma > 2.0 && rng.random() < 0.20)) {
      const c = sim.nucleate('wollastonite', pos, sigma);
      sim.log.push(`  ✦ NUCLEATION: 🤍 Wollastonite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Ca=${sim.conditions.fluid.Ca.toFixed(0)}, SiO₂=${sim.conditions.fluid.SiO2.toFixed(0)}, pH=${sim.conditions.fluid.pH.toFixed(1)}) — acicular white skarn Ca-silicate`);
    }
  }
}

function _nuc_prehnite(sim) {
  const sigma = sim.conditions.supersaturation_prehnite();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('prehnite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'prehnite' && c.active);
  if (existing.length >= 4) return;
  let pos = 'vug wall';
  // Lake Superior amygdale: native_copper substrate. Rodingite: grossular/
  // diopside. Both produce the same green botryoidal habit.
  const active_nc = sim.crystals.filter(c => c.mineral === 'native_copper' && c.active);
  const active_gross = sim.crystals.filter(c => c.mineral === 'grossular' && c.active);
  const active_diop = sim.crystals.filter(c => c.mineral === 'diopside' && c.active);
  const active_cal = sim.crystals.filter(c => c.mineral === 'calcite' && c.active);
  if (active_nc.length && rng.random() < 0.55) pos = `with native_copper #${active_nc[0].crystal_id}`;
  else if (active_gross.length && rng.random() < 0.45) pos = `with grossular #${active_gross[0].crystal_id}`;
  else if (active_diop.length && rng.random() < 0.40) pos = `with diopside #${active_diop[0].crystal_id}`;
  else if (active_cal.length && rng.random() < 0.30) pos = `on calcite #${active_cal[0].crystal_id}`;
  const discount = sim._sigmaDiscountForPosition('prehnite', pos);
  if (sigma > 1.2 * discount) {
    if (!existing.length || (sigma > 2.0 && rng.random() < 0.20)) {
      const c = sim.nucleate('prehnite', pos, sigma);
      sim.log.push(`  ✦ NUCLEATION: 💚 Prehnite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Ca=${sim.conditions.fluid.Ca.toFixed(0)}, Al=${sim.conditions.fluid.Al.toFixed(0)}, Fe=${sim.conditions.fluid.Fe.toFixed(1)}, pH=${sim.conditions.fluid.pH.toFixed(1)}) — pale-green Ca-Al phyllosilicate, basalt-amygdale + rodingite classic`);
    }
  }
}

// v112 (2026-05-20): Paired Ca-Al-Mg calc-silicates for the Jeffrey
// Mine rodingite arc. Both early-stage rodingite + skarn (T ~300-450°C,
// alkaline). Grossular substrate priority: diopside > wollastonite >
// calcite > magnetite > wall. Diopside substrate priority: serpentinite/
// chrysotile (the rodingite host matrix) > grossular > wollastonite >
// calcite > wall. Both RNG-cascade-guarded at sigma < 1.0 early-out.
function _nuc_grossular(sim) {
  const sigma = sim.conditions.supersaturation_grossular();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('grossular')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'grossular' && c.active);
  if (existing.length >= 4) return;
  let pos = 'vug wall';
  const active_diop = sim.crystals.filter(c => c.mineral === 'diopside' && c.active);
  const active_woll = sim.crystals.filter(c => c.mineral === 'wollastonite' && c.active);
  const active_cal = sim.crystals.filter(c => c.mineral === 'calcite' && c.active);
  const active_mag = sim.crystals.filter(c => c.mineral === 'magnetite' && c.active);
  if (active_diop.length && rng.random() < 0.50) pos = `with diopside #${active_diop[0].crystal_id}`;
  else if (active_woll.length && rng.random() < 0.40) pos = `with wollastonite #${active_woll[0].crystal_id}`;
  else if (active_cal.length && rng.random() < 0.30) pos = `on calcite #${active_cal[0].crystal_id}`;
  else if (active_mag.length && rng.random() < 0.25) pos = `on magnetite #${active_mag[0].crystal_id}`;
  const discount = sim._sigmaDiscountForPosition('grossular', pos);
  if (sigma > 1.2 * discount) {
    if (!existing.length || (sigma > 2.0 && rng.random() < 0.20)) {
      const c = sim.nucleate('grossular', pos, sigma);
      const cr = sim.conditions.fluid.Cr;
      const mn = sim.conditions.fluid.Mn;
      const variety = cr > 1.0 ? 'CHROMIAN GREEN' : (mn > 5.0 ? 'HESSONITE' : 'colorless');
      sim.log.push(`  ✦ NUCLEATION: 💠 Grossular #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Ca=${sim.conditions.fluid.Ca.toFixed(0)}, Al=${sim.conditions.fluid.Al.toFixed(0)}, Cr=${cr.toFixed(2)}, Mn=${mn.toFixed(2)}) — ${variety}, Ca-Al garnet rodingite/skarn`);
    }
  }
}

function _nuc_diopside(sim) {
  const sigma = sim.conditions.supersaturation_diopside();
  if (sigma < 1.0) return;
  if (sim._atNucleationCap('diopside')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'diopside' && c.active);
  if (existing.length >= 4) return;
  let pos = 'vug wall';
  const active_serp = sim.crystals.filter(c => (c.mineral === 'chrysotile' || c.mineral === 'serpentine') && c.active);
  const active_gross = sim.crystals.filter(c => c.mineral === 'grossular' && c.active);
  const active_woll = sim.crystals.filter(c => c.mineral === 'wollastonite' && c.active);
  const active_cal = sim.crystals.filter(c => c.mineral === 'calcite' && c.active);
  if (active_serp.length && rng.random() < 0.50) pos = `in serpentinite matrix on chrysotile #${active_serp[0].crystal_id}`;
  else if (active_gross.length && rng.random() < 0.45) pos = `with grossular #${active_gross[0].crystal_id}`;
  else if (active_woll.length && rng.random() < 0.35) pos = `with wollastonite #${active_woll[0].crystal_id}`;
  else if (active_cal.length && rng.random() < 0.30) pos = `on calcite #${active_cal[0].crystal_id}`;
  const discount = sim._sigmaDiscountForPosition('diopside', pos);
  if (sigma > 1.2 * discount) {
    if (!existing.length || (sigma > 2.0 && rng.random() < 0.20)) {
      const c = sim.nucleate('diopside', pos, sigma);
      const cr = sim.conditions.fluid.Cr;
      const variety = cr > 0.5 ? 'CHROME-DIOPSIDE (emerald green)' : 'diopside';
      sim.log.push(`  ✦ NUCLEATION: 💚 Diopside #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Ca=${sim.conditions.fluid.Ca.toFixed(0)}, Mg=${sim.conditions.fluid.Mg.toFixed(0)}, Cr=${cr.toFixed(2)}) — ${variety}, Ca-Mg clinopyroxene rodingite/skarn`);
    }
  }
}

// v111 (2026-05-20): Vesuvianite Ca10(Mg,Fe)2Al4(SiO4)5(Si2O7)2(OH)4
// — Jeffrey Mine cyprine variety is the headline aesthetic. Substrate
// priority: grossular > diopside > wollastonite > magnetite > calcite >
// wall. All future-prepared (grossular + diopside ship v112; wollastonite
// v113; harmless filter-empty until then). RNG-cascade guard via
// sigma < 1.0 early-out.
function _nuc_vesuvianite(sim) {
  const sigma = sim.conditions.supersaturation_vesuvianite();
  if (sigma < 1.0) return;  // RNG-cascade guard
  if (sim._atNucleationCap('vesuvianite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'vesuvianite' && c.active);
  if (existing.length >= 4) return;
  let pos = 'vug wall';
  const active_gross = sim.crystals.filter(c => c.mineral === 'grossular' && c.active);
  const active_diop = sim.crystals.filter(c => c.mineral === 'diopside' && c.active);
  const active_woll = sim.crystals.filter(c => c.mineral === 'wollastonite' && c.active);
  const active_mag = sim.crystals.filter(c => c.mineral === 'magnetite' && c.active);
  const active_cal = sim.crystals.filter(c => c.mineral === 'calcite' && c.active);
  if (active_gross.length && rng.random() < 0.60) pos = `epitactic on grossular #${active_gross[0].crystal_id}`;
  else if (active_diop.length && rng.random() < 0.50) pos = `on diopside #${active_diop[0].crystal_id}`;
  else if (active_woll.length && rng.random() < 0.40) pos = `with wollastonite #${active_woll[0].crystal_id}`;
  else if (active_mag.length && rng.random() < 0.30) pos = `on magnetite #${active_mag[0].crystal_id}`;
  else if (active_cal.length && rng.random() < 0.25) pos = `on calcite #${active_cal[0].crystal_id}`;
  const discount = sim._sigmaDiscountForPosition('vesuvianite', pos);
  if (sigma > 1.2 * discount) {
    if (!existing.length || (sigma > 2.0 && rng.random() < 0.18)) {
      const c = sim.nucleate('vesuvianite', pos, sigma);
      const cu = sim.conditions.fluid.Cu;
      const variety = (cu >= 0.5 && cu <= 5.0) ? 'sky-blue CYPRINE' : (cu > 5.0 ? 'deep-azure CYPRINE' : 'idocrase');
      sim.log.push(`  ✦ NUCLEATION: 💙 Vesuvianite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Ca=${sim.conditions.fluid.Ca.toFixed(0)}, Mg=${sim.conditions.fluid.Mg.toFixed(0)}, Al=${sim.conditions.fluid.Al.toFixed(0)}, Cu=${cu.toFixed(2)}, pH=${sim.conditions.fluid.pH.toFixed(1)}) — ${variety}, rodingite Ca-Mg-Al sorosilicate`);
    }
  }
}

// v110 (2026-05-20): Datolite CaB(SiO4)(OH) — Jeffrey Mine rodingite
// arc first mineral. Lake Superior basalt-amygdale OR rodingite-
// contact paragenesis. Substrate priority encodes both routes:
// prehnite > wollastonite (both pre-wired for v113) > calcite >
// native_copper > magnetite > wall. RNG-cascade guard via
// sigma < 1.0 early-out.
function _nuc_datolite(sim) {
  const sigma = sim.conditions.supersaturation_datolite();
  if (sigma < 1.0) return;  // RNG-cascade guard — keeps non-datolite scenarios byte-identical
  if (sim._atNucleationCap('datolite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'datolite' && c.active);
  if (existing.length >= 3) return;
  let pos = 'vug wall';
  // Substrate priority — listed in paragenetic preference. prehnite +
  // wollastonite + vesuvianite will be wired in v113-v114; the filter
  // returns empty until then (harmless — falls through to next option).
  const active_pre = sim.crystals.filter(c => c.mineral === 'prehnite' && c.active);
  const active_wol = sim.crystals.filter(c => c.mineral === 'wollastonite' && c.active);
  const active_vesu = sim.crystals.filter(c => c.mineral === 'vesuvianite' && c.active);
  const active_cal = sim.crystals.filter(c => c.mineral === 'calcite' && c.active);
  const dissolving_cal = sim.crystals.filter(c => c.mineral === 'calcite' && c.dissolved);
  const active_nc = sim.crystals.filter(c => c.mineral === 'native_copper' && c.active);
  const active_mag = sim.crystals.filter(c => c.mineral === 'magnetite' && c.active);
  if (active_pre.length && rng.random() < 0.55) pos = `on prehnite #${active_pre[0].crystal_id}`;
  else if (active_wol.length && rng.random() < 0.45) pos = `on wollastonite #${active_wol[0].crystal_id}`;
  else if (active_vesu.length && rng.random() < 0.40) pos = `with vesuvianite #${active_vesu[0].crystal_id}`;
  else if (active_cal.length && rng.random() < 0.35) pos = `on calcite #${active_cal[0].crystal_id}`;
  else if (dissolving_cal.length && rng.random() < 0.25) pos = `pseudomorph after calcite #${dissolving_cal[0].crystal_id}`;
  else if (active_nc.length && rng.random() < 0.30) pos = `with native_copper #${active_nc[0].crystal_id}`;
  else if (active_mag.length && rng.random() < 0.20) pos = `on magnetite #${active_mag[0].crystal_id}`;
  const discount = sim._sigmaDiscountForPosition('datolite', pos);
  if (sigma > 1.2 * discount) {
    if (!existing.length || (sigma > 2.0 && rng.random() < 0.20)) {
      const c = sim.nucleate('datolite', pos, sigma);
      sim.log.push(`  ✦ NUCLEATION: 💎 Datolite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Ca=${sim.conditions.fluid.Ca.toFixed(0)}, B=${sim.conditions.fluid.B.toFixed(1)}, SiO₂=${sim.conditions.fluid.SiO2.toFixed(0)}, pH=${sim.conditions.fluid.pH.toFixed(1)}) — calcium boronosilicate, Lake Superior / Jeffrey Mine signature`);
    }
  }
}

function _nucleateClass_silicate(sim) {
  _nuc_quartz(sim);
  _nuc_apophyllite(sim);
  _nuc_feldspar(sim);
  _nuc_albite(sim);
  _nuc_chrysocolla(sim);
  _nuc_spodumene(sim);
  _nuc_tourmaline(sim);
  _nuc_topaz(sim);
  _nuc_chrysoprase(sim);
  _nuc_lepidolite(sim);
  _nuc_dioptase(sim);
  _nuc_shattuckite(sim);
  _nuc_hemimorphite(sim);
  _nuc_willemite(sim);
  _nuc_coffinite(sim);
  _nuc_uranophane(sim);
  _nuc_opal(sim);
  _nuc_datolite(sim);
  _nuc_vesuvianite(sim);
  _nuc_grossular(sim);
  _nuc_diopside(sim);
  _nuc_pectolite(sim);
  _nuc_wollastonite(sim);
  _nuc_prehnite(sim);
  _nuc_chrysotile(sim);
  _nuc_tigers_eye(sim);
}
