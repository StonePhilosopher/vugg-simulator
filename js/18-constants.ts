// ============================================================
// js/18-constants.ts — Engine-wide physical constants
// ============================================================
// DEFAULT_INTER_RING_DIFFUSION_RATE, WATER_LEVEL_DRAIN_RATE, EVAPORATIVE_CONCENTRATION_FACTOR. Read by VugSimulator init + per-ring chemistry plumbing.
//
// Phase B4 of PROPOSAL-MODULAR-REFACTOR. SCRIPT-mode TS — top-level decls
// stay global so call sites in 99-legacy-bundle.ts keep working.


// ============================================================
// PHYSICAL CONSTANTS AND MODELS
// ============================================================

// Phase C of PROPOSAL-3D-SIMULATION: inter-ring diffusion rate. The
// per-step fraction of the difference exchanged between adjacent rings
// — small enough that a vertical gradient survives many steps, large
// enough that uniform broth stays uniform under floating-point
// rounding. Mirrors DEFAULT_INTER_RING_DIFFUSION_RATE in vugg.py.
const DEFAULT_INTER_RING_DIFFUSION_RATE = 0.05;

// v26 water-level drainage rate. Surface drops by porosity × this
// (rings/step). 0.05 means a perfectly-porous host (porosity=1.0)
// drains 16 rings in 320 steps. Mirrors WATER_LEVEL_DRAIN_RATE in
// vugg.py.
const WATER_LEVEL_DRAIN_RATE = 0.05;

// v27 evaporative concentration boost on wet → vadose transition.
// Multiplied into ring_fluids[k].concentration when the ring dries.
// Mirrors EVAPORATIVE_CONCENTRATION_FACTOR in vugg.py.
const EVAPORATIVE_CONCENTRATION_FACTOR = 3.0;

// PROPOSAL-GEOLOGICAL-ACCURACY Phase 1 — fluid mass balance.
// When enabled, every growth zone debits the fluid (and every
// dissolution zone credits the fluid) according to the per-mineral
// formula coefficients in MINERAL_STOICHIOMETRY (see 19-mineral-
// stoichiometry.ts). Phase 1c (May 2026): flag flipped ON;
// SIM_VERSION 18 → 19. Calibration deltas documented in the v19
// note in 15-version.ts.
const MASS_BALANCE_ENABLED = true;

// Empirical ppm-per-µm-of-c-axis-growth scale, multiplied into the
// stoichiometry coefficient when the wrapper debits. Calibration
// history:
//   Phase 1a/1c (08140d1, 1eaaa5a): scale=0.01 — chosen to balance
//     wrapper debits against the engine-internal hand-coded debits
//     that double-counted with the wrapper.
//   Phase 1d (7904894): scale stayed at 0.01 after first cleanup pass
//     (carbonate, silicate, oxide, arsenate, molybdate engines).
//   Phase 1d-followup (this commit): after the second cleanup pass
//     removed ~36 more growth-path debits in sulfate (60) + sulfide
//     (61) engines, the wrapper became the sole grower-side debit
//     across all 12 engine classes. Scale rises to 0.02 — without
//     the double-debit assumption, 0.02 gives the lowest sweep-wide
//     RMS (13%) and produces enough depletion to fire the
//     ⛔-narration line in evaporite scenarios (67 events across
//     19 baselines, mostly searles_lake + reactive_wall).
const MASS_BALANCE_SCALE = 0.02;

// Depletion narration threshold (ppm). When a species crosses below
// this value via mass-balance debit, _runEngineForCrystal emits a
// "Fe²⁺ depleted in ring 4 — Pyrite #5 growth halts" log line. 1 ppm
// is the order of magnitude where further precipitation is no longer
// meaningful — saturation has cratered. Single-shot per crossing:
// previous > 1 && proposed ≤ 1 fires the narrative once, not on
// every subsequent step where the species already sits below the
// threshold.
const MASS_BALANCE_DEPLETION_THRESHOLD = 1.0;

