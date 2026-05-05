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
const DEHYDRATION_TRANSITIONS = {
  borax: ['tincalconite', 25, 1.5, 75.0],
  mirabilite: ['thenardite', 30, 1.5, 32.4],
};

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
  const isHot = T >= Tmax;
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
      return [old, newMineral];
    }
  }
  return null;
}
