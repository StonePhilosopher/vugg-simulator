// ============================================================
// js/85-nucleation-molybdate.ts — per-mineral nucleation gates (molybdate)
// ============================================================
// One `_nuc_<mineral>(sim)` helper per supported molybdate-class mineral.
// Each is a pure side-effecting function: reads sim state, conditionally
// calls sim.nucleate(...), and pushes a log line.
//
// VugSimulator.check_nucleation iterates over each class group via
// _nucleateClass_<klass>(sim). See 85-simulator.ts.
//
// Phase B15 of PROPOSAL-MODULAR-REFACTOR.

function _nuc_wulfenite(sim) {
  const sigma_wulf = sim.conditions.supersaturation_wulfenite();
  const existing_wulf = sim.crystals.filter(c => c.mineral === 'wulfenite' && c.active);
  const total_wulf = sim.crystals.filter(c => c.mineral === 'wulfenite').length;
  if (sigma_wulf > MINERAL_GATES_wulfenite.sigma_crit && !existing_wulf.length && total_wulf < 2 && !sim._atNucleationCap('wulfenite')) {
    let pos = 'vug wall';
    // Prefers to nucleate on dissolved galena AND/OR dissolved molybdenite
    // Wulfenite = Pb²⁺ (from oxidized galena) + MoO₄²⁻ (from oxidized molybdenite)
    const dissolved_gal = sim.crystals.filter(c => c.mineral === 'galena' && c.dissolved);
    const dissolved_moly = sim.crystals.filter(c => c.mineral === 'molybdenite' && c.dissolved);
    const any_gal = sim.crystals.filter(c => c.mineral === 'galena');
    const any_moly = sim.crystals.filter(c => c.mineral === 'molybdenite');
    if (dissolved_moly.length && dissolved_gal.length && rng.random() < 0.7) {
      pos = `on molybdenite #${dissolved_moly[0].crystal_id} (oxidized, near galena #${dissolved_gal[0].crystal_id})`;
    } else if (dissolved_gal.length && rng.random() < 0.6) {
      pos = `on galena #${dissolved_gal[0].crystal_id} (oxidized)`;
    } else if (dissolved_moly.length && rng.random() < 0.5) {
      pos = `on molybdenite #${dissolved_moly[0].crystal_id} (oxidized)`;
    } else if (any_gal.length && rng.random() < 0.3) {
      pos = `on galena #${any_gal[0].crystal_id}`;
    }
    const c = sim.nucleate('wulfenite', pos, sigma_wulf);
    sim.log.push(`  ✦ NUCLEATION: 🟠 Wulfenite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_wulf.toFixed(2)}) — the collector's prize!`);
  }

  // Ferrimolybdite nucleation — the no-lead Mo-oxidation fork.
  // Lower σ threshold (1.0 vs wulfenite's 1.2) + higher per-check
  // probability (0.18) reflect its faster, less-picky growth. Substrate:
  // dissolving molybdenite (direct oxidation product) > active
  // molybdenite > free vug wall. Coexists with wulfenite; both draw
  // on the MoO₄²⁻ pool but ferrimolybdite wins the early window.
}
function _nuc_ferrimolybdite(sim) {
  const sigma_fmo = sim.conditions.supersaturation_ferrimolybdite();
  if (sigma_fmo > MINERAL_GATES_ferrimolybdite.sigma_crit && !sim._atNucleationCap('ferrimolybdite')) {
    if (rng.random() < 0.18) {
      let pos = 'vug wall';
      const dissolving_mol = sim.crystals.filter(c => c.mineral === 'molybdenite' && c.dissolved);
      const active_mol = sim.crystals.filter(c => c.mineral === 'molybdenite' && c.active);
      if (dissolving_mol.length && rng.random() < 0.7) {
        pos = `on dissolving molybdenite #${dissolving_mol[0].crystal_id}`;
      } else if (active_mol.length && rng.random() < 0.4) {
        pos = `on molybdenite #${active_mol[0].crystal_id}`;
      }
      const c = sim.nucleate('ferrimolybdite', pos, sigma_fmo);
      sim.log.push(`  ✦ NUCLEATION: 🟡 Ferrimolybdite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_fmo.toFixed(2)}, Mo=${sim.conditions.fluid.Mo.toFixed(0)}, Fe=${sim.conditions.fluid.Fe.toFixed(0)}) — canary-yellow tufts on oxidizing molybdenite`);
    }
  }

  // Arsenopyrite nucleation — mesothermal primary sulfide, reducing
  // Fe+As+S. Substrate preference: pyrite (orogenic-gold co-precipitation
  // habit — arsenopyrite rhombs on pyrite cubes) > chalcopyrite > vug
  // wall. σ threshold 1.2 reflects mesothermal pickiness. Au-trapping
  // (in grow_arsenopyrite) competes with native_gold for the fluid Au
  // pool when both are forming.
}
function _nuc_stolzite(sim) {
  let sigma_rasp = sim.conditions.supersaturation_raspite();
  const sigma_stol = sim.conditions.supersaturation_stolzite();
  if (sigma_rasp > MINERAL_GATES_raspite.sigma_crit && sigma_stol > MINERAL_GATES_stolzite.sigma_crit && rng.random() < 0.9) {
    sigma_rasp = 0;
  }
  if (sigma_rasp > MINERAL_GATES_raspite.sigma_crit && !sim._atNucleationCap('raspite')) {
    if (rng.random() < 0.16) {
      const c = sim.nucleate('raspite', 'vug wall', sigma_rasp);
      sim.log.push(`  ✦ NUCLEATION: Raspite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_rasp.toFixed(2)}, Pb=${sim.conditions.fluid.Pb.toFixed(0)}, W=${sim.conditions.fluid.W.toFixed(1)})`);
    }
  }
  if (sigma_stol > MINERAL_GATES_stolzite.sigma_crit && !sim._atNucleationCap('stolzite')) {
    if (rng.random() < 0.18) {
      const c = sim.nucleate('stolzite', 'vug wall', sigma_stol);
      sim.log.push(`  ✦ NUCLEATION: Stolzite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_stol.toFixed(2)}, Pb=${sim.conditions.fluid.Pb.toFixed(0)}, W=${sim.conditions.fluid.W.toFixed(1)})`);
    }
  }

  // Olivenite nucleation — Cu + As + oxidizing.
}

function _nuc_scheelite(sim) {
  const sigma = sim.conditions.supersaturation_scheelite();
  if (sigma > MINERAL_GATES_scheelite.sigma_crit && !sim._atNucleationCap('scheelite') && rng.random() < 0.15) {
    let pos = 'vug wall';
    const wolf = sim.crystals.filter(c => c.mineral === 'wolframite' && c.active);
    if (wolf.length && rng.random() < 0.30) pos = `on wolframite #${wolf[0].crystal_id} (W-paragenesis)`;
    const c = sim.nucleate('scheelite', pos, sigma);
    sim.log.push(`  ✦ NUCLEATION: ⚪ Scheelite #${c.crystal_id} on ${c.position} (Ca ${sim.conditions.fluid.Ca.toFixed(0)} W ${sim.conditions.fluid.W.toFixed(1)} ppm, T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}) — fluoresces bright blue-white SW`);
  }
}

function _nuc_powellite(sim) {
  const sigma = sim.conditions.supersaturation_powellite();
  if (sigma > MINERAL_GATES_powellite.sigma_crit && !sim._atNucleationCap('powellite') && rng.random() < 0.13) {
    let pos = 'vug wall';
    const dissolved_moly = sim.crystals.filter(c => c.mineral === 'molybdenite' && c.dissolved);
    if (dissolved_moly.length && rng.random() < 0.50) pos = `on molybdenite #${dissolved_moly[0].crystal_id} (oxidized)`;
    const c = sim.nucleate('powellite', pos, sigma);
    sim.log.push(`  ✦ NUCLEATION: 🟡 Powellite #${c.crystal_id} on ${c.position} (Ca ${sim.conditions.fluid.Ca.toFixed(0)} Mo ${sim.conditions.fluid.Mo.toFixed(1)} ppm, σ=${sigma.toFixed(2)}) — fluoresces bright yellow SW (vs scheelite blue)`);
  }
}

function _nuc_wolframite(sim) {
  const sigma = sim.conditions.supersaturation_wolframite();
  if (sigma > MINERAL_GATES_wolframite.sigma_crit && !sim._atNucleationCap('wolframite') && rng.random() < 0.13) {
    let pos = 'vug wall';
    const qz = sim.crystals.filter(c => c.mineral === 'quartz' && c.active);
    if (qz.length && rng.random() < 0.45) pos = `on quartz #${qz[0].crystal_id} (Panasqueira-style W-Sn vein)`;
    const c = sim.nucleate('wolframite', pos, sigma);
    sim.log.push(`  ✦ NUCLEATION: ⚫ Wolframite #${c.crystal_id} on ${c.position} (W ${sim.conditions.fluid.W.toFixed(1)} Fe ${sim.conditions.fluid.Fe.toFixed(0)} Mn ${sim.conditions.fluid.Mn.toFixed(0)} ppm, T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}) — non-fluorescent (diagnostic vs scheelite)`);
  }
}

function _nucleateClass_molybdate(sim) {
  _nuc_wulfenite(sim);
  _nuc_ferrimolybdite(sim);
  _nuc_stolzite(sim);
  _nuc_scheelite(sim);
  _nuc_powellite(sim);
  _nuc_wolframite(sim);
}
