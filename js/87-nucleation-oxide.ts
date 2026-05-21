// ============================================================
// js/87-nucleation-oxide.ts — per-mineral nucleation gates (oxide)
// ============================================================
// One `_nuc_<mineral>(sim)` helper per supported oxide-class mineral.
// Each is a pure side-effecting function: reads sim state, conditionally
// calls sim.nucleate(...), and pushes a log line.
//
// VugSimulator.check_nucleation iterates over each class group via
// _nucleateClass_<klass>(sim). See 85-simulator.ts.
//
// Phase B15 of PROPOSAL-MODULAR-REFACTOR.

function _nuc_hematite(sim) {
  const existing_quartz = sim.crystals.filter(c => c.mineral === 'quartz' && c.active);
  const sigma_hem = sim.conditions.supersaturation_hematite();
  const existing_hem = sim.crystals.filter(c => c.mineral === 'hematite' && c.active);
  const total_hem = sim.crystals.filter(c => c.mineral === 'hematite').length;
  if (sigma_hem > MINERAL_GATES_hematite.sigma_crit && !existing_hem.length && total_hem < 3 && !sim._atNucleationCap('hematite')) {
    let pos = 'vug wall';
    if (existing_quartz.length && rng.random() < 0.4) {
      pos = `on quartz #${existing_quartz[0].crystal_id}`;
    }
    const c = sim.nucleate('hematite', pos, sigma_hem);
    sim.log.push(`  ✦ NUCLEATION: Hematite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_hem.toFixed(2)})`);
  }

  // Malachite nucleation — needs sigma > 1.0
}
function _nuc_uraninite(sim) {
  const existing_quartz = sim.crystals.filter(c => c.mineral === 'quartz' && c.active);
  const sigma_urn = sim.conditions.supersaturation_uraninite();
  const existing_urn = sim.crystals.filter(c => c.mineral === 'uraninite' && c.active);
  const total_urn = sim.crystals.filter(c => c.mineral === 'uraninite').length;
  if (sigma_urn > MINERAL_GATES_uraninite.sigma_crit && existing_urn.length < 3 && total_urn < 5 && !sim._atNucleationCap('uraninite')) {
    if (!existing_urn.length || (sigma_urn > 2.5 && rng.random() < 0.3)) {
      const c = sim.nucleate('uraninite', 'vug wall', sigma_urn);
      sim.log.push(`  ✦ NUCLEATION: ☢️ Uraninite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_urn.toFixed(2)}) — radioactive!`);
    }
  }

  // Smithsonite nucleation — needs sigma > 1.0, oxidized Zn environment
}
function _nuc_magnetite(sim) {
  const sigma_mag = sim.conditions.supersaturation_magnetite();
  const existing_mag = sim.crystals.filter(c => c.mineral === 'magnetite' && c.active);
  if (sigma_mag > MINERAL_GATES_magnetite.sigma_crit && !sim._atNucleationCap('magnetite')) {
    if (!existing_mag.length || (sigma_mag > 1.7 && rng.random() < 0.2)) {
      let pos = 'vug wall';
      const active_hem_mag = sim.crystals.filter(c => c.mineral === 'hematite' && c.active);
      if (active_hem_mag.length && rng.random() < 0.3) pos = `on hematite #${active_hem_mag[0].crystal_id}`;
      const c = sim.nucleate('magnetite', pos, sigma_mag);
      sim.log.push(`  ✦ NUCLEATION: Magnetite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_mag.toFixed(2)}, Fe=${sim.conditions.fluid.Fe.toFixed(0)}, O₂=${sim.conditions.fluid.O2.toFixed(2)})`);
    }
  }

  // Lepidocrocite nucleation — Fe + rapid oxidation at low T.
}
function _nuc_cuprite(sim) {
  const sigma_cpr = sim.conditions.supersaturation_cuprite();
  const existing_cpr = sim.crystals.filter(c => c.mineral === 'cuprite' && c.active);
  if (sigma_cpr > MINERAL_GATES_cuprite.sigma_crit && !sim._atNucleationCap('cuprite')) {
    if (!existing_cpr.length || (sigma_cpr > 1.8 && rng.random() < 0.2)) {
      let pos = 'vug wall';
      const active_nc_cpr = sim.crystals.filter(c => c.mineral === 'native_copper' && c.active);
      const active_chc_cpr = sim.crystals.filter(c => c.mineral === 'chalcocite' && c.active);
      if (active_nc_cpr.length && rng.random() < 0.6) pos = `on native_copper #${active_nc_cpr[0].crystal_id}`;
      else if (active_chc_cpr.length && rng.random() < 0.3) pos = `on chalcocite #${active_chc_cpr[0].crystal_id}`;
      const c = sim.nucleate('cuprite', pos, sigma_cpr);
      sim.log.push(`  ✦ NUCLEATION: Cuprite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_cpr.toFixed(2)}, Cu=${sim.conditions.fluid.Cu.toFixed(0)}, O₂=${sim.conditions.fluid.O2.toFixed(1)})`);
    }
  }

  // Azurite nucleation — Cu + high CO₃ + O₂ (limestone-hosted Cu deposit).
}

function _nuc_rutile(sim) {
  const sigma = sim.conditions.supersaturation_rutile();
  if (sigma > MINERAL_GATES_rutile.sigma_crit && !sim._atNucleationCap('rutile') && rng.random() < 0.12) {
    let pos = 'vug wall';
    const qz = sim.crystals.filter(c => c.mineral === 'quartz' && c.active);
    // Rutilated quartz — strong substrate preference for growing quartz
    if (qz.length && rng.random() < 0.55) pos = `included in quartz #${qz[0].crystal_id} (rutilated quartz / Venus hair)`;
    const c = sim.nucleate('rutile', pos, sigma);
    sim.log.push(`  ✦ NUCLEATION: 🔴 Rutile #${c.crystal_id} on ${c.position} (Ti ${sim.conditions.fluid.Ti.toFixed(1)} ppm, T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)})`);
  }
}

function _nuc_chromite(sim) {
  const sigma = sim.conditions.supersaturation_chromite();
  if (sigma > MINERAL_GATES_chromite.sigma_crit && !sim._atNucleationCap('chromite') && rng.random() < 0.10) {
    const c = sim.nucleate('chromite', 'vug wall', sigma);
    sim.log.push(`  ✦ NUCLEATION: ⚫ Chromite #${c.crystal_id} on ${c.position} (Cr ${sim.conditions.fluid.Cr.toFixed(0)} Fe ${sim.conditions.fluid.Fe.toFixed(0)} ppm at T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}) — magmatic spinel`);
  }
}

function _nuc_cassiterite(sim) {
  // SnO₂ — primary tin ore, late-pegmatite to greisen to hydrothermal
  // vein. Per research-cassiterite.md (boss canonical 2026-05).
  // Substrate priority encodes the documented paragenetic ordering
  // (research §Paragenetic Sequence): forms AFTER granite fractionation
  // (Sn concentrates in late melts), BEFORE late sulfides. Typical
  // associations: wolframite, fluorite, topaz, tourmaline, arsenopyrite,
  // quartz. Cassiterite-on-wolframite is the classic Erzgebirge /
  // Cornwall greisen association.
  const sigma_sn = sim.conditions.supersaturation_cassiterite();
  if (sigma_sn > MINERAL_GATES_cassiterite.sigma_crit && !sim._atNucleationCap('cassiterite')) {
    if (rng.random() < 0.18) {
      let pos = 'vug wall';
      const active_wf_sn   = sim.crystals.filter(c => c.mineral === 'wolframite' && c.active);
      const active_tpz_sn  = sim.crystals.filter(c => c.mineral === 'topaz' && c.active);
      const active_tml_sn  = sim.crystals.filter(c => c.mineral === 'tourmaline' && c.active);
      const active_qtz_sn  = sim.crystals.filter(c => c.mineral === 'quartz' && c.active);
      const active_feld_sn = sim.crystals.filter(c => c.mineral === 'feldspar' && c.active);
      if (active_wf_sn.length && rng.random() < 0.40) {
        pos = `on wolframite #${active_wf_sn[0].crystal_id} (classic Cornish Sn-W greisen pair)`;
      } else if (active_tpz_sn.length && rng.random() < 0.30) {
        pos = `on topaz #${active_tpz_sn[0].crystal_id}`;
      } else if (active_tml_sn.length && rng.random() < 0.25) {
        pos = `on tourmaline #${active_tml_sn[0].crystal_id}`;
      } else if (active_qtz_sn.length && rng.random() < 0.30) {
        pos = `on quartz #${active_qtz_sn[0].crystal_id}`;
      } else if (active_feld_sn.length && rng.random() < 0.20) {
        pos = `on feldspar #${active_feld_sn[0].crystal_id}`;
      }
      const c = sim.nucleate('cassiterite', pos, sigma_sn);
      const f = sim.conditions.fluid;
      const T = sim.conditions.temperature;
      const habit_preview = T > 500 ? 'prismatic dipyramid' : (T >= 300 ? 'equant blocky' : 'wood-tin botryoidal');
      sim.log.push(`  ✦ NUCLEATION: Cassiterite #${c.crystal_id} (${habit_preview}) on ${c.position} (T=${T.toFixed(0)}°C, σ=${sigma_sn.toFixed(2)}, Sn=${f.Sn.toFixed(0)} ppm, Fe=${f.Fe.toFixed(0)})`);
    }
  }
}

// v102 (2026-05-19): pyrolusite β-MnO2 — supergene Mn(IV) oxide.
// Substrate priority encodes the canonical Mn-weathering paragenesis
// per the dossier §6:
//   rhodochrosite (epitactic replacement) — strongest, classic "rotted
//     rhomb" texture; pyrolusite forms FROM rhodochrosite under
//     oxidation
//   manganite (epitactic replacement) — polianite pseudomorph;
//     Champness 1971 mechanism. Note: manganite not yet wired in the
//     simulator; substrate branch reserved for when it lands
//   siderite — Mn-bearing siderite produces Fe-Mn "wad" weathering
//   calcite / dolomite — Imini-style karst-host coatings + Mapimí-
//     style on calcite
//   goethite — Fe-Mn weathering rind cohabitation (when both Fe and
//     Mn are oxidized at the same rind interface)
//   wall — fallback for bare-vug-wall nucleation
//
// RNG-CASCADE GUARD: sigma < 1.0 early-out BEFORE substrate-pick
// rng.random() calls. Critical — adding pyrolusite must not perturb
// scenarios where Mn is below threshold.
function _nuc_pyrolusite(sim) {
  const sigma = sim.conditions.supersaturation_pyrolusite();
  if (sigma < MINERAL_GATES_pyrolusite.sigma_crit) return;  // RNG-cascade guard — DO NOT MOVE
  if (sim._atNucleationCap('pyrolusite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'pyrolusite' && c.active);
  const total = sim.crystals.filter(c => c.mineral === 'pyrolusite').length;
  if (existing.length >= 3 || total >= 5) return;
  let pos = 'vug wall';
  const parent_rhodochrosite = sim.crystals.filter(c => c.mineral === 'rhodochrosite' && c.active);
  const dissolving_rhodochrosite = sim.crystals.filter(c => c.mineral === 'rhodochrosite' && c.dissolved);
  const parent_siderite = sim.crystals.filter(c => c.mineral === 'siderite' && c.active);
  const parent_calcite = sim.crystals.filter(c => c.mineral === 'calcite' && c.active);
  const parent_dolomite = sim.crystals.filter(c => c.mineral === 'dolomite' && c.active);
  const parent_goethite = sim.crystals.filter(c => c.mineral === 'goethite' && c.active);
  if (parent_rhodochrosite.length && rng.random() < 0.60) {
    pos = `on rhodochrosite #${parent_rhodochrosite[0].crystal_id} (epitactic replacement — supergene oxidation)`;
  } else if (dissolving_rhodochrosite.length && rng.random() < 0.55) {
    pos = `pseudomorph after rhodochrosite #${dissolving_rhodochrosite[0].crystal_id} ("rotted rhomb")`;
  } else if (parent_siderite.length && rng.random() < 0.35) {
    pos = `on siderite #${parent_siderite[0].crystal_id} (Fe-Mn weathering wad)`;
  } else if (parent_dolomite.length && rng.random() < 0.35) {
    pos = `on dolomite #${parent_dolomite[0].crystal_id} (Imini-style karst coating)`;
  } else if (parent_calcite.length && rng.random() < 0.30) {
    pos = `on calcite #${parent_calcite[0].crystal_id} (Mapimí-style botryoidal coating)`;
  } else if (parent_goethite.length && rng.random() < 0.20) {
    pos = `on goethite #${parent_goethite[0].crystal_id} (Fe-Mn rind cohabitation)`;
  }
  const discount = sim._sigmaDiscountForPosition('pyrolusite', pos);
  if (sigma > 1.2 * discount) {
    if (!existing.length || (sigma > 1.8 && rng.random() < 0.18)) {
      const c = sim.nucleate('pyrolusite', pos, sigma);
      const f = sim.conditions.fluid;
      const T = sim.conditions.temperature;
      const habit_preview = T > 100 ? 'radiating fibrous' :
        (f.Mn > 5 && f.pH >= 7 && f.pH <= 8) ? 'botryoidal reniform' :
        'massive sooty';
      sim.log.push(`  ✦ NUCLEATION: ⚫ Pyrolusite #${c.crystal_id} (${habit_preview}) on ${c.position} (T=${T.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Mn=${f.Mn.toFixed(1)} ppm, pH=${f.pH.toFixed(1)}, O₂=${f.O2.toFixed(2)})`);
    }
  }
}

// v114 (2026-05-20): Brucite Mg(OH)2 — serpentinization byproduct.
// Substrate priority: chrysotile (rodingite host matrix) > magnetite >
// wall. RNG-cascade-guarded.
function _nuc_brucite(sim) {
  const sigma = sim.conditions.supersaturation_brucite();
  if (sigma < MINERAL_GATES_brucite.sigma_crit) return;
  if (sim._atNucleationCap('brucite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'brucite' && c.active);
  if (existing.length >= 4) return;
  let pos = 'vug wall';
  const active_chryso = sim.crystals.filter(c => c.mineral === 'chrysotile' && c.active);
  const active_mag = sim.crystals.filter(c => c.mineral === 'magnetite' && c.active);
  if (active_chryso.length && rng.random() < 0.50) pos = `with chrysotile #${active_chryso[0].crystal_id} — serpentinization Mg byproduct`;
  else if (active_mag.length && rng.random() < 0.35) pos = `with magnetite #${active_mag[0].crystal_id}`;
  const discount = sim._sigmaDiscountForPosition('brucite', pos);
  if (sigma > 1.2 * discount) {
    if (!existing.length || (sigma > 2.0 && rng.random() < 0.22)) {
      const c = sim.nucleate('brucite', pos, sigma);
      sim.log.push(`  ✦ NUCLEATION: ⚪ Brucite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Mg=${sim.conditions.fluid.Mg.toFixed(0)}, pH=${sim.conditions.fluid.pH.toFixed(1)}, CO3=${sim.conditions.fluid.CO3.toFixed(0)}) — tabular hexagonal Mg(OH)2, serpentinization signature`);
    }
  }
}

function _nucleateClass_oxide(sim) {
  _nuc_hematite(sim);
  _nuc_uraninite(sim);
  _nuc_magnetite(sim);
  _nuc_cuprite(sim);
  _nuc_rutile(sim);
  _nuc_chromite(sim);
  _nuc_cassiterite(sim);
  _nuc_pyrolusite(sim);
  _nuc_brucite(sim);
}
