// ============================================================
// js/75-transitions.ts — Paramorph + dehydration in-place mineral transitions
// ============================================================
// PARAMORPH_TRANSITIONS (T-driven cubic→monoclinic etc.) and DEHYDRATION_TRANSITIONS (humidity/heat-driven hydrate→anhydrate). applyParamorphTransitions runs each step.
//
// Phase B9 of PROPOSAL-MODULAR-REFACTOR. SCRIPT-mode TS — top-level decls
// stay global so call sites in 99-legacy-bundle.ts keep working.

// ============================================================
// PARAMORPH TRANSITIONS
// ============================================================
// In-place polymorph conversions on cooling — distinct from thermal
// decomposition (which destroys the crystal). A paramorph preserves
// habit + dominant_forms + zones (the external shape and growth
// history) while the internal lattice inverts to a different structure.
//
// First entry, Round 8a (Apr 2026):
//   argentite (cubic Ag2S, >173°C)  →  acanthite (monoclinic Ag2S, <173°C)
//
// Mirrors PARAMORPH_TRANSITIONS in vugg.py.
const PARAMORPH_TRANSITIONS = {
  // mineral_when_hot: [mineral_when_cool, T_threshold_C]
  argentite: ['acanthite', 173],
};

function applyParamorphTransitions(crystal, T, step) {
  // Convert a crystal in-place when it crosses a paramorph T threshold.
  // Returns [old, new] pair if a transition fired, null otherwise.
  if (!crystal.active || crystal.dissolved) return null;
  const entry = PARAMORPH_TRANSITIONS[crystal.mineral];
  if (!entry) return null;
  const [coolMineral, Tthresh] = entry;
  if (T >= Tthresh) return null;
  const oldMineral = crystal.mineral;
  crystal.mineral = coolMineral;
  crystal.paramorph_origin = oldMineral;
  if (step != null) crystal.paramorph_step = step;
  return [oldMineral, coolMineral];
}

// v28 dehydration paramorph transitions — environment-triggered
// counterpart to PARAMORPH_TRANSITIONS. Borax left in a vadose ring
// loses its structural water and pseudomorphs to tincalconite.
// Mirrors DEHYDRATION_TRANSITIONS in vugg.py. Format:
// hydrated_mineral → [dehydrated_mineral, threshold_steps,
//                     concentration_min, T_max].
// v85 (2026-05-19): autunite-group meta- variants. Per research-autunite.md /
// research-torbernite.md / research-zeunerite.md, all three parent uranyl
// minerals lose ~3-4 H₂O above ~75-80°C OR after sustained dry-air exposure;
// the dehydration is irreversible. Threshold steps tuned to 40 — slower than
// borax's 25 (uranyl phosphates are more lattice-stable than the borate cage)
// but faster than the literature would suggest for room-T air (real timescale
// is months-to-years; the sim compresses that to a ~40-step "post-collection
// stale" window, mirroring how pararealgar's 60-step light threshold compresses
// the realgar→pararealgar real timescale). At schneeberg the uranyls form
// post-cooling at ambient T in aqueous rings, so neither the heat path nor
// the vadose path fires during the 160-step run — schneeberg baseline is
// preserved. The transitions become observable only in scenarios where
// uranyl-bearing rings later evaporate (none currently shipped — covered by
// test pins that force vadose or T>80°C).
// v90 (2026-05-19): pharmacolite → haidingerite. Per Palache, Berman,
// Frondel (1951) Dana's System of Mineralogy v.II 708-709; Ferraris,
// Jones, Yerkess (1972) Acta Cryst. 28:209-214 (neutron + X-ray
// refinement of CaHAsO₄·H₂O structure); Cassien, Herpin, Permingeat
// (1966) Bull. Minéral. 89:18-22 (crystal structure paper). Haidingerite
// is the pharmacolite-dehydration product — loses 1 H₂O of 2,
// transforming from monoclinic CaHAsO₄·2H₂O to orthorhombic CaHAsO₄·H₂O.
// Specific gravity rises from 2.64-2.73 (pharmacolite) to 2.85-2.96
// (haidingerite) — the water-loss densification signature. Type
// locality Jáchymov, type pseudomorph occurrence Getchell mine Nevada
// per the Handbook of Mineralogy "Formed by dehydration of pharmacolite"
// citation. Threshold 30 steps matches pharmacolite's efflorescent
// reputation (between borax's 25 and the autunite-group's 40). T_max
// 80°C is the documented onset of dehydration (research-pharmacolite.md).
const DEHYDRATION_TRANSITIONS = {
  // Pure Na2B4O7-H2O transition: 60.8 C. A halite-saturated
  // NaCl-Na2B4O7 solution lowers it to 39.6 C (Bowser 1964; Christ,
  // Truesdell & Jones 1967). The saturated-brine branch is selected
  // explicitly below rather than inventing an unsupported continuous
  // salt-composition polynomial.
  borax: ['tincalconite', 25, 1.5, 60.8],
  mirabilite: ['thenardite', 30, 1.5, 32.4],
  autunite: ['meta-autunite', 40, 1.0, 80.0],
  torbernite: ['metatorbernite', 40, 1.0, 75.0],
  zeunerite: ['metazeunerite', 40, 1.0, 75.0],
  pharmacolite: ['haidingerite', 30, 1.0, 80.0],
};

const BORAX_TINCALCONITE_SALINE_TRANSITION_C = 39.6;
const BORAX_TINCALCONITE_HALITE_SATURATION_SW_MULT = 10.6;

function boraxTincalconiteHeatThreshold(ringFluid) {
  const concentration = Math.max(0, Number(ringFluid?.concentration) || 1.0);
  const salinity = Math.max(0, Number(ringFluid?.salinity) || 0.0);
  const brineStrength = (salinity / 35.0) * concentration;
  return brineStrength >= BORAX_TINCALCONITE_HALITE_SATURATION_SW_MULT
    ? BORAX_TINCALCONITE_SALINE_TRANSITION_C
    : DEHYDRATION_TRANSITIONS.borax[3];
}

function applyDehydrationTransitions(crystal, ringFluid, ringWaterState, T, step) {
  // v28: convert a hydrated mineral in place when its host ring has
  // been dry for too long. Increments crystal.dry_exposure_steps each
  // step the ring is dry; transition fires once the count reaches
  // threshold OR T exceeds T_max (heat path is instantaneous).
  // Mirrors apply_dehydration_transitions in vugg.py.
  if (!crystal.active || crystal.dissolved) return null;
  const spec = DEHYDRATION_TRANSITIONS[crystal.mineral];
  if (!spec) return null;
  const [newMineral, thresholdSteps, concMin, Tmax] = spec;
  const heatThreshold = crystal.mineral === 'borax'
    ? boraxTincalconiteHeatThreshold(ringFluid)
    : Tmax;
  const isHot = T >= heatThreshold;
  let isDry;
  if (ringWaterState === 'vadose') isDry = true;
  else if (ringWaterState === 'meniscus') isDry = ringFluid.concentration >= concMin;
  else isDry = false;
  if (isHot) {
    if (rng.random() < 0.8) {
      const old = crystal.mineral;
      crystal.mineral = newMineral;
      crystal.paramorph_origin = old;
      if (step != null) crystal.paramorph_step = step;
      crystal.dehydration_driver = 'temperature';
      crystal.dehydration_threshold_C = heatThreshold;
      return [old, newMineral];
    }
    return null;
  }
  if (isDry) {
    crystal.dry_exposure_steps = (crystal.dry_exposure_steps || 0) + 1;
    if (crystal.dry_exposure_steps >= thresholdSteps) {
      const old = crystal.mineral;
      crystal.mineral = newMineral;
      crystal.paramorph_origin = old;
      if (step != null) crystal.paramorph_step = step;
      crystal.dehydration_driver = 'dry-exposure';
      return [old, newMineral];
    }
  }
  return null;
}

// ============================================================
// CaSO4 DISSOLUTION-REPRECIPITATION REPLACEMENT
// ============================================================

const GYPSUM_MOLAR_VOLUME_CM3_MOL = 73.9;
const ANHYDRITE_MOLAR_VOLUME_CM3_MOL = 46.1;

type CaSO4PhaseTransitionRecord = {
  step: number | null;
  from: 'selenite' | 'anhydrite';
  to: 'selenite' | 'anhydrite';
  driver: 'gypsum-to-anhydrite-replacement' | 'anhydrite-rehydration';
  waterTransferMmolKg: number;
  formulaAmountMmolKg: number;
  boundaryC: number;
  uncertaintyC: number;
  waterActivity: number;
  sourceSI: number;
  productSI: number;
  caBeforePpm: number;
  caAfterPpm: number;
  sulfateBeforePpm: number;
  sulfateAfterPpm: number;
};

// Replacement preserves the existing external envelope and every booked Ca/S
// shell. Structural water is tracked separately: positive means released to
// solvent, negative means consumed from solvent. The formula amount uses the
// same disclosed axial mmol/kg proxy as the growth ledger.
function applyCaSO4PhaseTransition(
  crystal: any,
  fluid: any,
  temperatureC: number,
  fluidPressureKbar: number,
  step: number | null,
): CaSO4PhaseTransitionRecord | null {
  if (!crystal?.active || crystal.dissolved) return null;
  if (crystal.mineral !== 'selenite' && crystal.mineral !== 'anhydrite') return null;
  if (!(Number(crystal.total_growth_um) > 0)) return null;

  const evaluation = evaluateCaSO4System(fluid, temperatureC, fluidPressureKbar);
  const from = crystal.mineral as 'selenite' | 'anhydrite';
  const to = from === 'selenite' ? 'anhydrite' : 'selenite';
  const admissible = from === 'selenite'
    ? evaluation.gypsumToAnhydriteAdmissible
    : evaluation.anhydriteToGypsumAdmissible;
  if (!admissible) return null;

  const sulfateBeforePpm = typeof sulfateAvailablePpm === 'function'
    ? sulfateAvailablePpm(fluid, temperatureC)
    : Math.max(0, Number(fluid?.S) || 0);
  const caBeforePpm = Math.max(0, Number(fluid?.Ca) || 0);
  const formulaAmountMmolKg = Number(crystal.total_growth_um)
    * STOICHIOMETRIC_GROWTH_BUDGET_FORMULA_MMOL_PER_KG_PER_UM;
  const waterTransferMmolKg = (from === 'selenite' ? 2 : -2) * formulaAmountMmolKg;

  crystal.mineral = to;
  // Compatibility fields keep old saves/replay consumers functional. This is
  // explicitly a replacement, not asserted to be a solid-state paramorph.
  crystal.paramorph_origin = from;
  if (step != null) crystal.paramorph_step = step;
  crystal.phase_transition_origin = from;
  crystal.phase_transition_step = step;
  crystal.phase_transition_driver = from === 'selenite'
    ? 'gypsum-to-anhydrite-replacement'
    : 'anhydrite-rehydration';
  crystal._ca_so4_hydration_water_mmolkg =
    Number(crystal._ca_so4_hydration_water_mmolkg || 0) + waterTransferMmolKg;
  crystal._ca_so4_solid_volume_ratio = to === 'anhydrite'
    ? ANHYDRITE_MOLAR_VOLUME_CM3_MOL / GYPSUM_MOLAR_VOLUME_CM3_MOL
    : 1;
  crystal._ca_so4_replacement_porosity_fraction = to === 'anhydrite'
    ? 1 - crystal._ca_so4_solid_volume_ratio
    : 0;
  crystal._ca_so4_pseudomorphic_envelope_preserved = true;

  const record: CaSO4PhaseTransitionRecord = {
    step,
    from,
    to,
    driver: crystal.phase_transition_driver,
    waterTransferMmolKg,
    formulaAmountMmolKg,
    boundaryC: evaluation.phase.boundaryC,
    uncertaintyC: evaluation.phase.uncertaintyC,
    waterActivity: evaluation.phase.waterActivity.value,
    sourceSI: from === 'selenite' ? evaluation.gypsumSI : evaluation.anhydriteSI,
    productSI: to === 'selenite' ? evaluation.gypsumSI : evaluation.anhydriteSI,
    caBeforePpm,
    caAfterPpm: Math.max(0, Number(fluid?.Ca) || 0),
    sulfateBeforePpm,
    sulfateAfterPpm: typeof sulfateAvailablePpm === 'function'
      ? sulfateAvailablePpm(fluid, temperatureC)
      : Math.max(0, Number(fluid?.S) || 0),
  };
  (crystal.phase_transition_history ||= []).push(record);
  return record;
}

// ============================================================
// BIRNESSITE -> TODOROKITE Mg-EXCHANGE / TUNNEL TRANSFORMATION
// ============================================================

const MN_ATOMIC_MASS_G_MOL = 54.938044;
const MG_ATOMIC_MASS_G_MOL = 24.305;
const TODOROKITE_MG_MASS_PER_MN_MASS = MG_ATOMIC_MASS_G_MOL / (6 * MN_ATOMIC_MASS_G_MOL);

function applyBirnessiteTodorokiteTransition(
  crystal: any,
  fluid: any,
  temperatureC: number,
  step: number | null,
): any | null {
  if (!crystal?.active || crystal.dissolved || crystal.mineral !== 'birnessite') return null;
  if (!(Number(crystal.total_growth_um) > 0)) return null;
  if (temperatureC < MINERAL_GATES_todorokite.T_min!
      || temperatureC > MINERAL_GATES_todorokite.T_max!) return null;

  // Framework Mn is already in the accepted solid ledger. Preserve it rather
  // than spending the fluid for a second crystal; only exchanged structural
  // Mg is newly booked, at the 1 Mg : 6 Mn formula mass ratio.
  const bookedMnPpm = remainingBookedInventory(crystal, 'Mn');
  if (!(bookedMnPpm > 0)) return null;
  const requiredMgPpm = bookedMnPpm * TODOROKITE_MG_MASS_PER_MN_MASS;
  const mgBeforePpm = Math.max(0, Number(fluid?.Mg) || 0);
  if (mgBeforePpm + 1e-12 < requiredMgPpm) return null;

  for (const zone of (crystal.zones || [])) {
    if (!(zone && Number(zone.thickness_um) > 0)) continue;
    const remaining = Number.isFinite(Number(zone._remaining_solid_um))
      ? Math.max(0, Number(zone._remaining_solid_um))
      : Math.max(0, Number(zone.thickness_um) || 0);
    if (!(remaining > 0)) continue;
    const mnPerUm = Number(zone._budget_inventory_per_um?.Mn) || 0;
    if (!(mnPerUm > 0)) continue;
    zone._budget_inventory_per_um ||= {};
    zone._budget_inventory_per_um.Mg = (Number(zone._budget_inventory_per_um.Mg) || 0)
      + mnPerUm * TODOROKITE_MG_MASS_PER_MN_MASS;
  }
  fluid.Mg = Math.max(0, mgBeforePpm - requiredMgPpm);

  const from = 'birnessite';
  const to = 'todorokite';
  crystal.mineral = to;
  // Compatibility fields preserve replay and source-cap behavior. This is a
  // solution-mediated layer-to-tunnel transformation, not a paramorph.
  crystal.paramorph_origin = from;
  if (step != null) crystal.paramorph_step = step;
  crystal.phase_transition_origin = from;
  crystal.phase_transition_step = step;
  crystal.phase_transition_driver = 'Mg-exchanged-birnessite-to-todorokite';
  crystal.habit = 'dendritic_mine_coating';
  crystal.vector = 'coating';
  crystal.dominant_forms = [
    'wall-parallel branching mine dendrites',
    '3x3 tunnel oxide after Mg exchange into a booked birnessite precursor',
  ];
  crystal.position = `in-place after birnessite #${crystal.crystal_id} (Mg-exchanged tunnel transformation)`;
  crystal._todorokite_transition_mg_ppm = requiredMgPpm;

  const record = {
    step,
    from,
    to,
    driver: crystal.phase_transition_driver,
    bookedMnPreservedPpm: bookedMnPpm,
    structuralMgBookedPpm: requiredMgPpm,
    mgBeforePpm,
    mgAfterPpm: fluid.Mg,
    temperatureC,
    modelBoundary: 'in-place booked-solid proxy for Mg exchange and layer-to-tunnel reorganization; structural water and Mn(III) ordering are not conserved state variables',
  };
  (crystal.phase_transition_history ||= []).push(record);
  return record;
}

// Replay helper supports repeated sabkha hydration/dehydration cycles. Legacy
// one-shot paramorph/dehydration records continue through the fallback.
function mineralAtReplayStep(crystal: any, replayStep: number | null): string {
  if (replayStep == null) return crystal.mineral;
  const history = Array.isArray(crystal.phase_transition_history)
    ? crystal.phase_transition_history
    : [];
  if (history.length) {
    let mineral = history[0].from;
    for (const transition of history) {
      if (transition.step != null && replayStep >= transition.step) mineral = transition.to;
    }
    return mineral;
  }
  return crystal.paramorph_step != null
    && replayStep < crystal.paramorph_step
    && crystal.paramorph_origin
    ? crystal.paramorph_origin
    : crystal.mineral;
}

// ============================================================
// LIGHT-INDUCED TRANSITIONS
// ============================================================
// v84 (2026-05-19): light-induced isomerization. Distinct from
// PARAMORPH (T-driven) and DEHYDRATION (humidity/heat-driven) — the
// trigger is visible-light exposure (>500 nm) accumulating over time.
//
// First entry: realgar → pararealgar (Bonazzi et al. 1996,
// Mineralogical Magazine 60:401-409; Roberts et al. 1980). The As₄S₄
// cage molecule isomerizes from realgar's D₂d symmetry to pararealgar's
// Cs symmetry under light exposure. The transformation is irreversible
// and accompanied by:
//   * color shift: orange-red → yellow (the famous "museum-drawer
//     yellow powder" that crumbles out of old realgar specimens)
//   * hardness drop: 1.5-2 → 1-1.5 (crystal becomes friable)
//   * specific-gravity drop: 3.56 → 3.52 (slight)
//
// Real-world timescale: weeks to years of room-light exposure. In the
// simulator, threshold=60 steps gives a realgar-nucleated-by-step-140
// crystal exactly the right window to convert before run-end (200
// steps). Geologically authentic: a museum-collection realgar specimen
// shows mixed realgar + pararealgar after a year on a lit shelf.
//
// Gating: opt-out by setting conditions.wall.is_lit = false (sealed
// rock cavities don't see light during formation — the transformation
// only happens AFTER the cavity is excavated and the specimens are
// exposed). Default is_lit = true models surface vugs / hot springs /
// scenarios where rock is open to atmospheric light. Sulphur Bank
// is a surface hot-spring → lit by default.
//
// Format: light_sensitive_mineral → [new_mineral, threshold_steps].
const LIGHT_TRANSITIONS = {
  realgar: ['pararealgar', 60],
};

function applyLightTransitions(crystal, isLit, step) {
  // Convert a light-sensitive mineral in place after sufficient light
  // exposure. Increments crystal.light_exposure_steps each step the
  // cavity is lit; transition fires once the counter reaches threshold.
  // Returns [old, new] pair if a transition fired, null otherwise.
  if (!crystal.active || crystal.dissolved) return null;
  const spec = LIGHT_TRANSITIONS[crystal.mineral];
  if (!spec) return null;
  if (!isLit) return null;
  const [newMineral, thresholdSteps] = spec;
  crystal.light_exposure_steps = (crystal.light_exposure_steps || 0) + 1;
  if (crystal.light_exposure_steps >= thresholdSteps) {
    const old = crystal.mineral;
    crystal.mineral = newMineral;
    crystal.paramorph_origin = old;
    if (step != null) crystal.paramorph_step = step;
    return [old, newMineral];
  }
  return null;
}
