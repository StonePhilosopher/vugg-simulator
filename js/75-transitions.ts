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
const DEHYDRATION_TRANSITIONS = {
  borax: ['tincalconite', 25, 1.5, 75.0],
  mirabilite: ['thenardite', 30, 1.5, 32.4],
  autunite: ['meta-autunite', 40, 1.0, 80.0],
  torbernite: ['metatorbernite', 40, 1.0, 75.0],
  zeunerite: ['metazeunerite', 40, 1.0, 75.0],
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
