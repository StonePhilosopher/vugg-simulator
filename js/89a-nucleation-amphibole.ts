// ============================================================
// js/89a-nucleation-amphibole.ts — per-amphibole nucleation gates
// ============================================================
// v116 (2026-05-20): commercial-asbestos quintet — tremolite +
// actinolite + anthophyllite + amosite + crocidolite. All RNG-cascade
// guarded (sigma < 1.0 early-out per the standard pattern).
//
// Each amphibole has a paragenetically-shaped substrate priority:
//   tremolite:    diopside (skarn pair) > chrysotile (rodingite host) > wall
//   actinolite:   diopside > grossular > chrysotile > wall
//   anthophyllite: chrysotile (ultramafic host) > magnetite > wall
//   amosite:      magnetite (BIF Fe-host) > hematite > wall
//   crocidolite:  magnetite (BIF Fe-host) > hematite > wall
//
// _nucleateClass_amphibole is dispatched from js/85d-simulator-step.ts
// alphabetically-first (before _nucleateClass_arsenate). The RNG-cascade
// guard in each _nuc_*amphibole ensures non-amphibole-firing scenarios
// see byte-identical RNG state to pre-v116.

function _nuc_tremolite(sim) {
  const sigma = sim.conditions.supersaturation_tremolite();
  if (sigma < MINERAL_GATES_tremolite.sigma_crit) return;
  if (sim._atNucleationCap('tremolite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'tremolite' && c.active);
  if (existing.length >= 4) return;
  let pos = 'vug wall';
  const active_diop = sim.crystals.filter(c => c.mineral === 'diopside' && c.active);
  const active_chryso = sim.crystals.filter(c => c.mineral === 'chrysotile' && c.active);
  const active_cal = sim.crystals.filter(c => c.mineral === 'calcite' && c.active);
  if (active_diop.length && rng.random() < 0.50) pos = `with diopside #${active_diop[0].crystal_id} (skarn calc-silicate pair)`;
  else if (active_chryso.length && rng.random() < 0.40) pos = `in chrysotile #${active_chryso[0].crystal_id} matrix (Jeffrey-style contaminant)`;
  else if (active_cal.length && rng.random() < 0.30) pos = `on calcite #${active_cal[0].crystal_id} (impure-dolomite skarn)`;
  const discount = sim._sigmaDiscountForPosition('tremolite', pos);
  if (sigma > 1.2 * discount) {
    if (!existing.length || (sigma > 2.0 && rng.random() < 0.20)) {
      const c = sim.nucleate('tremolite', pos, sigma);
      const variety = (sigma - 1.0) > 1.4 ? 'ASBESTIFORM' : 'bladed';
      sim.log.push(`  ✦ NUCLEATION: 🤍 Tremolite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Ca=${sim.conditions.fluid.Ca.toFixed(0)}, Mg=${sim.conditions.fluid.Mg.toFixed(0)}) — ${variety} Ca-Mg amphibole, skarn + rodingite + Jeffrey-style chrysotile-contaminant`);
    }
  }
}

function _nuc_actinolite(sim) {
  const sigma = sim.conditions.supersaturation_actinolite();
  if (sigma < MINERAL_GATES_actinolite.sigma_crit) return;
  if (sim._atNucleationCap('actinolite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'actinolite' && c.active);
  if (existing.length >= 4) return;
  let pos = 'vug wall';
  const active_diop = sim.crystals.filter(c => c.mineral === 'diopside' && c.active);
  const active_gross = sim.crystals.filter(c => c.mineral === 'grossular' && c.active);
  const active_chryso = sim.crystals.filter(c => c.mineral === 'chrysotile' && c.active);
  if (active_diop.length && rng.random() < 0.50) pos = `with diopside #${active_diop[0].crystal_id}`;
  else if (active_gross.length && rng.random() < 0.40) pos = `with grossular #${active_gross[0].crystal_id} (greenschist-facies association)`;
  else if (active_chryso.length && rng.random() < 0.35) pos = `with chrysotile #${active_chryso[0].crystal_id}`;
  const discount = sim._sigmaDiscountForPosition('actinolite', pos);
  if (sigma > 1.2 * discount) {
    if (!existing.length || (sigma > 2.0 && rng.random() < 0.20)) {
      const c = sim.nucleate('actinolite', pos, sigma);
      const cr = sim.conditions.fluid.Cr;
      const variety = cr > 1.0 ? 'SMARAGDITE (Cr emerald-green)' : ((sigma - 1.0) > 1.4 ? 'ASBESTIFORM' : 'green bladed');
      sim.log.push(`  ✦ NUCLEATION: 💚 Actinolite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Ca=${sim.conditions.fluid.Ca.toFixed(0)}, Fe=${sim.conditions.fluid.Fe.toFixed(0)}, Cr=${cr.toFixed(1)}) — ${variety} Ca-Mg-Fe amphibole`);
    }
  }
}

function _nuc_anthophyllite(sim) {
  const sigma = sim.conditions.supersaturation_anthophyllite();
  if (sigma < MINERAL_GATES_anthophyllite.sigma_crit) return;
  if (sim._atNucleationCap('anthophyllite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'anthophyllite' && c.active);
  if (existing.length >= 3) return;
  let pos = 'vug wall';
  const active_chryso = sim.crystals.filter(c => c.mineral === 'chrysotile' && c.active);
  const active_mag = sim.crystals.filter(c => c.mineral === 'magnetite' && c.active);
  if (active_chryso.length && rng.random() < 0.50) pos = `in chrysotile #${active_chryso[0].crystal_id} matrix (ultramafic-host serpentinite)`;
  else if (active_mag.length && rng.random() < 0.30) pos = `with magnetite #${active_mag[0].crystal_id}`;
  const discount = sim._sigmaDiscountForPosition('anthophyllite', pos);
  if (sigma > 1.2 * discount) {
    if (!existing.length || (sigma > 2.0 && rng.random() < 0.20)) {
      const c = sim.nucleate('anthophyllite', pos, sigma);
      const variety = (sigma - 1.0) > 0.8 ? 'ASBESTIFORM' : 'brown prismatic';
      sim.log.push(`  ✦ NUCLEATION: 🟤 Anthophyllite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Mg=${sim.conditions.fluid.Mg.toFixed(0)}, Fe=${sim.conditions.fluid.Fe.toFixed(0)}) — ${variety} Mg-Fe orthoamphibole (Finland + Carolina type)`);
    }
  }
}

function _nuc_amosite(sim) {
  const sigma = sim.conditions.supersaturation_amosite();
  if (sigma < MINERAL_GATES_amosite.sigma_crit) return;
  if (sim._atNucleationCap('amosite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'amosite' && c.active);
  if (existing.length >= 3) return;
  let pos = 'vug wall';
  const active_mag = sim.crystals.filter(c => c.mineral === 'magnetite' && c.active);
  const active_hem = sim.crystals.filter(c => c.mineral === 'hematite' && c.active);
  if (active_mag.length && rng.random() < 0.55) pos = `with magnetite #${active_mag[0].crystal_id} (BIF Fe-amphibole assemblage)`;
  else if (active_hem.length && rng.random() < 0.45) pos = `with hematite #${active_hem[0].crystal_id} (BIF Fe-formation)`;
  const discount = sim._sigmaDiscountForPosition('amosite', pos);
  if (sigma > 1.2 * discount) {
    if (!existing.length || (sigma > 2.0 && rng.random() < 0.20)) {
      const c = sim.nucleate('amosite', pos, sigma);
      sim.log.push(`  ✦ NUCLEATION: 🟫 Amosite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Fe=${sim.conditions.fluid.Fe.toFixed(0)}) — "BROWN ASBESTOS" Fe-dominant cummingtonite-grunerite asbestiform (Penge SA type)`);
    }
  }
}

function _nuc_crocidolite(sim) {
  const sigma = sim.conditions.supersaturation_crocidolite();
  if (sigma < MINERAL_GATES_crocidolite.sigma_crit) return;
  if (sim._atNucleationCap('crocidolite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'crocidolite' && c.active);
  if (existing.length >= 3) return;
  let pos = 'vug wall';
  const active_mag = sim.crystals.filter(c => c.mineral === 'magnetite' && c.active);
  const active_hem = sim.crystals.filter(c => c.mineral === 'hematite' && c.active);
  if (active_mag.length && rng.random() < 0.55) pos = `with magnetite #${active_mag[0].crystal_id} (BIF Fe-amphibole assemblage)`;
  else if (active_hem.length && rng.random() < 0.45) pos = `with hematite #${active_hem[0].crystal_id} (BIF Fe-formation)`;
  const discount = sim._sigmaDiscountForPosition('crocidolite', pos);
  if (sigma > 1.2 * discount) {
    if (!existing.length || (sigma > 2.0 && rng.random() < 0.20)) {
      const c = sim.nucleate('crocidolite', pos, sigma);
      sim.log.push(`  ✦ NUCLEATION: 🟦 Crocidolite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Na=${sim.conditions.fluid.Na.toFixed(0)}, Fe=${sim.conditions.fluid.Fe.toFixed(0)}, O2=${sim.conditions.fluid.O2.toFixed(2)}) — "BLUE ASBESTOS" riebeckite-asbestiform variety (Wittenoom Australia + Northern Cape SA); tiger's eye precursor when O2 rises`);
    }
  }
}

function _nucleateClass_amphibole(sim) {
  _runNuc(sim, _nuc_tremolite);
  _runNuc(sim, _nuc_actinolite);
  _runNuc(sim, _nuc_anthophyllite);
  _runNuc(sim, _nuc_amosite);
  _runNuc(sim, _nuc_crocidolite);
}
