// ============================================================
// js/78-preferences.ts — Orientation + water-state nucleation preferences
// ============================================================
// ORIENTATION_PREFERENCE (mineral → preferred wall ring), WATER_STATE_PREFERENCE (mineral → meniscus/submerged/vadose bias). Read by VugSimulator._assignWallRing during nucleation.
//
// Phase B9 of PROPOSAL-MODULAR-REFACTOR. SCRIPT-mode TS — top-level decls
// stay global so call sites in 99-legacy-bundle.ts keep working.

// ============================================================
// SIMULATION ENGINE
// ============================================================

// Phase D v2: per-mineral nucleation orientation preference. Mirrors
// vugg.py's ORIENTATION_PREFERENCE — see SIM_VERSION 23 comment there
// for the geological reasoning + per-mineral citations. Most species
// are spatially neutral and stay out of this table; the area-weighted
// fallback in _assignWallRing handles them. Format: mineral name →
// [preferred_orientation, strength_factor]. Strength 3.0 = strong
// (Naica selenite tier), 1.5 = weak (most entries).
const ORIENTATION_PREFERENCE = {
  // Floor (strong) — Naica-style subaqueous pool growth.
  selenite:      ['floor', 3.0],
  // Floor (weak) — density / micro-cluster settling, supergene fluid pooling.
  galena:        ['floor', 1.5],
  malachite:     ['floor', 1.5],
  azurite:       ['floor', 1.5],
  barite:        ['floor', 1.5],
  celestine:     ['floor', 1.5],
  goethite:      ['floor', 1.5],
  native_gold:   ['floor', 1.5],
  native_silver: ['floor', 1.5],
  smithsonite:   ['floor', 1.5],
  // Ceiling (weak) — iron-rose specular rosettes from convective Fe transport.
  hematite:      ['ceiling', 1.5],
  // Wall (weak) — acicular sprays grow perpendicular to lateral substrate.
  stibnite:      ['wall', 1.5],
  bismuthinite:  ['wall', 1.5],
};

// v27 water-state nucleation preference for evaporite minerals.
// Bathtub-ring deposits cluster at the meniscus. Mirror of
// WATER_STATE_PREFERENCE in vugg.py.
const WATER_STATE_PREFERENCE = {
  halite:     ['meniscus', 4.0],
  selenite:   ['meniscus', 2.5],
  anhydrite:  ['meniscus', 2.0],
  borax:      ['meniscus', 3.0],
  mirabilite: ['meniscus', 3.0],
  thenardite: ['meniscus', 3.0],
};
