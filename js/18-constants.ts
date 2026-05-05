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
// stoichiometry.ts). Default OFF: scenarios stay byte-identical to v17.
// Flip ON for the calibration pass once SIM_VERSION 18 is ready
// (recalibration of every scenario is the work — see proposal).
const MASS_BALANCE_ENABLED = false;

// Empirical ppm-per-µm-of-c-axis-growth scale, multiplied into the
// stoichiometry coefficient when the wrapper debits or credits. With
// calcite Ca:1 coefficient and a typical 5 µm/step growth at σ=2,
// each step debits 5 × 0.05 × 1 = 0.25 ppm Ca; an initial 200 ppm Ca
// fluid is depleted in ~800 steps, the right ballpark for a
// many-hundred-step scenario where calcite is the only Ca consumer.
// Calibration pass will tune this against the v17 baseline scenarios.
const MASS_BALANCE_SCALE = 0.05;

