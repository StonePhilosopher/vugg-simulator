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
  const corundum_family_candidates = [
    ['ruby', sim.conditions.supersaturation_ruby(), 1.5],
    ['sapphire', sim.conditions.supersaturation_sapphire(), 1.4],
    ['corundum', sim.conditions.supersaturation_corundum(), 1.3],
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

function _nucleateClass_silicate(sim) {
  _nuc_quartz(sim);
  _nuc_apophyllite(sim);
  _nuc_feldspar(sim);
  _nuc_albite(sim);
  _nuc_chrysocolla(sim);
  _nuc_spodumene(sim);
  _nuc_tourmaline(sim);
  _nuc_topaz(sim);
}
