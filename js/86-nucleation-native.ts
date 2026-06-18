// ============================================================
// js/86-nucleation-native.ts — per-mineral nucleation gates (native)
// ============================================================
// One `_nuc_<mineral>(sim)` helper per supported native-class mineral.
// Each is a pure side-effecting function: reads sim state, conditionally
// calls sim.nucleate(...), and pushes a log line.
//
// VugSimulator.check_nucleation iterates over each class group via
// _nucleateClass_<klass>(sim). See 85-simulator.ts.
//
// Phase B15 of PROPOSAL-MODULAR-REFACTOR.

function _nuc_native_bismuth(sim) {
  const sigma_nbi = sim.conditions.supersaturation_native_bismuth();
  const existing_nbi = sim.crystals.filter(c => c.mineral === 'native_bismuth' && c.active);
  // 2026-05 cascade-gate audit Arc 2: nuc threshold 1.4 → 1.0 (sibling
  // mineral). The 1.4 was an outlier — every other native_X uses 1.0
  // (native_arsenic, native_sulfur, native_tellurium) or 1.2
  // (native_silver). The strict 1.4 made native_bismuth nearly impossible
  // to fire even in its canonical scenario (Schneeberg) once the
  // structural S>12 gate softening let σ become non-zero. Secondary-
  // nucleation tier (>2.0) preserved as-is.
  if (sigma_nbi > MINERAL_GATES_native_bismuth.sigma_crit && !sim._atNucleationCap('native_bismuth')) {
    if (!existing_nbi.length || (sigma_nbi > 2.0 && rng.random() < 0.15)) {
      let pos = 'vug wall';
      const dissolving_bmt = sim.crystals.filter(c => c.mineral === 'bismuthinite' && c.dissolved);
      if (dissolving_bmt.length && rng.random() < 0.5) pos = `on bismuthinite #${dissolving_bmt[0].crystal_id}`;
      const c = sim.nucleate('native_bismuth', pos, sigma_nbi);
      sim.log.push(`  ✦ NUCLEATION: Native bismuth #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_nbi.toFixed(2)}, Bi=${sim.conditions.fluid.Bi.toFixed(0)}, S=${sim.conditions.fluid.S.toFixed(0)})`);
    }
  }

  // Argentite nucleation — Ag + S + reducing + T > 173°C.
  // High-T sibling of acanthite. Will paramorph on cooling
  // (handled by applyParamorphTransitions in run_step).
}
function _nuc_native_tellurium(sim) {
  const sigma_nte = sim.conditions.supersaturation_native_tellurium();
  if (sigma_nte > MINERAL_GATES_native_tellurium.sigma_crit && !sim._atNucleationCap('native_tellurium')) {
    if (rng.random() < 0.16) {
      let pos = 'vug wall';
      const active_au_nte = sim.crystals.filter(c => c.mineral === 'native_gold' && c.active);
      if (active_au_nte.length && rng.random() < 0.4) pos = `on native_gold #${active_au_nte[0].crystal_id}`;
      const c = sim.nucleate('native_tellurium', pos, sigma_nte);
      sim.log.push(`  ✦ NUCLEATION: Native tellurium #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_nte.toFixed(2)}, Te=${sim.conditions.fluid.Te.toFixed(2)}, Au=${sim.conditions.fluid.Au.toFixed(2)})`);
    }
  }

  // Native sulfur nucleation — synproportionation Eh window + acidic + low base metals.
}
function _nuc_native_sulfur(sim) {
  const sigma_nsu = sim.conditions.supersaturation_native_sulfur();
  if (sigma_nsu > MINERAL_GATES_native_sulfur.sigma_crit && !sim._atNucleationCap('native_sulfur')) {
    if (rng.random() < 0.18) {
      let pos = 'vug wall';
      const active_cel_nsu = sim.crystals.filter(c => c.mineral === 'celestine' && c.active);
      const active_arag_nsu = sim.crystals.filter(c => c.mineral === 'aragonite' && c.active);
      const active_gyp_nsu = sim.crystals.filter(c => c.mineral === 'selenite' && c.active);
      if (active_cel_nsu.length && rng.random() < 0.5) pos = `on celestine #${active_cel_nsu[0].crystal_id}`;
      else if (active_arag_nsu.length && rng.random() < 0.4) pos = `on aragonite #${active_arag_nsu[0].crystal_id}`;
      else if (active_gyp_nsu.length && rng.random() < 0.3) pos = `on selenite #${active_gyp_nsu[0].crystal_id}`;
      const c = sim.nucleate('native_sulfur', pos, sigma_nsu);
      sim.log.push(`  ✦ NUCLEATION: Native sulfur #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_nsu.toFixed(2)}, S=${sim.conditions.fluid.S.toFixed(0)}, O₂=${sim.conditions.fluid.O2.toFixed(2)}, pH=${sim.conditions.fluid.pH.toFixed(1)})`);
    }
  }

  // Native arsenic nucleation — As + strongly_reducing + S<10 + Fe<50.
  // The residual-overflow mineral.
}
function _nuc_native_arsenic(sim) {
  const sigma_nas = sim.conditions.supersaturation_native_arsenic();
  if (sigma_nas > MINERAL_GATES_native_arsenic.sigma_crit && !sim._atNucleationCap('native_arsenic')) {
    if (rng.random() < 0.16) {
      let pos = 'vug wall';
      const dissolving_apy_nas = sim.crystals.filter(c => c.mineral === 'arsenopyrite' && c.dissolved);
      if (dissolving_apy_nas.length && rng.random() < 0.5) pos = `on arsenopyrite #${dissolving_apy_nas[0].crystal_id}`;
      const c = sim.nucleate('native_arsenic', pos, sigma_nas);
      sim.log.push(`  ✦ NUCLEATION: Native arsenic #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_nas.toFixed(2)}, As=${sim.conditions.fluid.As.toFixed(0)}, S=${sim.conditions.fluid.S.toFixed(1)}, Fe=${sim.conditions.fluid.Fe.toFixed(0)})`);
    }
  }

  // Native silver nucleation — Ag + strongly_reducing + S < 2.
  // The depletion mineral. Substrate preferences track the geological
  // pathway: dissolving acanthite (supergene Ag-enrichment route at
  // Tsumeb), dissolving tetrahedrite, or native_copper (Keweenaw
  // co-precipitation in S-poor basalt amygdules).
}
function _nuc_native_silver(sim) {
  const sigma_nag = sim.conditions.supersaturation_native_silver();
  // 2026-05 cascade-gate audit Arc 3: threshold 1.2 → 1.0 matches sibling
  // natives (native_tellurium, native_sulfur, native_arsenic, native_bismuth
  // all use 1.0). The 1.2 was an outlier — same pattern as native_bismuth's
  // 1.4 outlier dropped in Arc 2.
  if (sigma_nag > MINERAL_GATES_native_silver.sigma_crit && !sim._atNucleationCap('native_silver')) {
    if (rng.random() < 0.16) {
      let pos = 'vug wall';
      const dissolving_aca_nag = sim.crystals.filter(c => c.mineral === 'acanthite' && c.dissolved);
      const dissolving_tet_nag = sim.crystals.filter(c => c.mineral === 'tetrahedrite' && c.dissolved);
      const active_ncopper_nag = sim.crystals.filter(c => c.mineral === 'native_copper' && c.active);
      if (dissolving_aca_nag.length && rng.random() < 0.6) pos = `on acanthite #${dissolving_aca_nag[0].crystal_id}`;
      else if (dissolving_tet_nag.length && rng.random() < 0.5) pos = `on tetrahedrite #${dissolving_tet_nag[0].crystal_id}`;
      else if (active_ncopper_nag.length && rng.random() < 0.4) pos = `on native_copper #${active_ncopper_nag[0].crystal_id}`;
      const c = sim.nucleate('native_silver', pos, sigma_nag);
      sim.log.push(`  ✦ NUCLEATION: Native silver #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_nag.toFixed(2)}, Ag=${sim.conditions.fluid.Ag.toFixed(2)}, S=${sim.conditions.fluid.S.toFixed(1)})`);
    }
  }

  // Acanthite nucleation — Ag + S + reducing + T < 173°C.
  // Substrate preference: galena (the classic Ag-bearing parent),
  // dissolving tetrahedrite (often the supergene Ag source), or bare wall.
  // First Ag mineral in the sim — paragenetic successor to galena/
  // tetrahedrite/proustite, predecessor to native_silver in S-depleted pockets.
}
function _nuc_native_copper(sim) {
  const sigma_nc = sim.conditions.supersaturation_native_copper();
  const existing_nc_nuc = sim.crystals.filter(c => c.mineral === 'native_copper' && c.active);
  if (sigma_nc > MINERAL_GATES_native_copper.sigma_crit && !sim._atNucleationCap('native_copper')) {
    if (!existing_nc_nuc.length || (sigma_nc > 2.2 && rng.random() < 0.15)) {
      let pos = 'vug wall';
      const active_chc_nc = sim.crystals.filter(c => c.mineral === 'chalcocite' && c.active);
      const active_brn_nc = sim.crystals.filter(c => c.mineral === 'bornite' && c.active);
      if (active_chc_nc.length && rng.random() < 0.4) pos = `on chalcocite #${active_chc_nc[0].crystal_id}`;
      else if (active_brn_nc.length && rng.random() < 0.3) pos = `on bornite #${active_brn_nc[0].crystal_id}`;
      const c = sim.nucleate('native_copper', pos, sigma_nc);
      sim.log.push(`  ✦ NUCLEATION: Native copper #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_nc.toFixed(2)}, Cu=${sim.conditions.fluid.Cu.toFixed(0)}, O₂=${sim.conditions.fluid.O2.toFixed(2)})`);
    }
  }

  // Native gold nucleation — Au + tolerant of both Eh regimes.
  // Substrate preference: chalcocite (supergene Au-on-chalcocite,
  // Bisbee enrichment-blanket habit) > pyrite (orogenic gold-on-pyrite)
  // > bornite > free vug wall.
}
function _nuc_native_gold(sim) {
  const sigma_au = sim.conditions.supersaturation_native_gold();
  const existing_au = sim.crystals.filter(c => c.mineral === 'native_gold' && c.active);
  if (sigma_au > MINERAL_GATES_native_gold.sigma_crit && !sim._atNucleationCap('native_gold')) {
    if (!existing_au.length || (sigma_au > 1.5 && rng.random() < 0.2)) {
      let pos = 'vug wall';
      const active_chc_au = sim.crystals.filter(c => c.mineral === 'chalcocite' && c.active);
      const active_py_au = sim.crystals.filter(c => c.mineral === 'pyrite' && c.active);
      const active_brn_au = sim.crystals.filter(c => c.mineral === 'bornite' && c.active);
      if (active_chc_au.length && rng.random() < 0.4) pos = `on chalcocite #${active_chc_au[0].crystal_id}`;
      else if (active_py_au.length && rng.random() < 0.25) pos = `on pyrite #${active_py_au[0].crystal_id}`;
      else if (active_brn_au.length && rng.random() < 0.2) pos = `on bornite #${active_brn_au[0].crystal_id}`;
      const c = sim.nucleate('native_gold', pos, sigma_au);
      sim.log.push(`  ✦ NUCLEATION: Native gold #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma_au.toFixed(2)}, Au=${sim.conditions.fluid.Au.toFixed(2)} ppm)`);
    }
  }

  // Bornite nucleation — Cu + Fe + S, Cu:Fe > 2:1.
}

// v114 (2026-05-20): Awaruite (Ni,Fe) — serpentinization Ni-Fe alloy.
// Substrate priority: chrysotile (rodingite matrix) > magnetite >
// wall. STRICT reducing + alkaline + S-free gate; sulfides win Ni
// when S > 5. RNG-cascade-guarded.
function _nuc_awaruite(sim) {
  const sigma = sim.conditions.supersaturation_awaruite();
  if (sigma < MINERAL_GATES_awaruite.sigma_crit) return;
  if (sim._atNucleationCap('awaruite')) return;
  const existing = sim.crystals.filter(c => c.mineral === 'awaruite' && c.active);
  if (existing.length >= 3) return;
  let pos = 'vug wall';
  const active_chryso = sim.crystals.filter(c => c.mineral === 'chrysotile' && c.active);
  const active_mag = sim.crystals.filter(c => c.mineral === 'magnetite' && c.active);
  if (active_chryso.length && rng.random() < 0.55) pos = `embedded in chrysotile #${active_chryso[0].crystal_id} matrix`;
  else if (active_mag.length && rng.random() < 0.35) pos = `with magnetite #${active_mag[0].crystal_id} — serpentinization Fe-Ni pair`;
  const discount = sim._sigmaDiscountForPosition('awaruite', pos);
  if (sigma > 1.2 * discount) {
    if (!existing.length || (sigma > 2.0 && rng.random() < 0.18)) {
      const c = sim.nucleate('awaruite', pos, sigma);
      sim.log.push(`  ✦ NUCLEATION: ⚙️ Awaruite #${c.crystal_id} on ${c.position} (T=${sim.conditions.temperature.toFixed(0)}°C, σ=${sigma.toFixed(2)}, Ni=${sim.conditions.fluid.Ni.toFixed(0)}, Fe=${sim.conditions.fluid.Fe.toFixed(0)}, pH=${sim.conditions.fluid.pH.toFixed(1)}, O₂=${sim.conditions.fluid.O2.toFixed(2)}) — Ni-Fe alloy serpentinization signature`);
    }
  }
}

function _nucleateClass_native(sim) {
  _runNuc(sim, _nuc_native_bismuth);
  _runNuc(sim, _nuc_native_tellurium);
  _runNuc(sim, _nuc_native_sulfur);
  _runNuc(sim, _nuc_native_arsenic);
  _runNuc(sim, _nuc_native_silver);
  _runNuc(sim, _nuc_native_copper);
  _runNuc(sim, _nuc_native_gold);
  _runNuc(sim, _nuc_awaruite);
}
