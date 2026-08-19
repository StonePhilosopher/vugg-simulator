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

// PROPOSAL-GEOLOGICAL-ACCURACY Phase 1 — calibrated stoichiometric
// axial-growth budget. When enabled, every accepted axial-growth increment
// debits the fluid (and dissolution returns the booked inventory) according
// to the per-mineral formula coefficients in MINERAL_STOICHIOMETRY (see
// 19-mineral-stoichiometry.ts). Phase 1c (May 2026): flag flipped ON;
// SIM_VERSION 18 → 19. Calibration deltas are documented in 15-version.ts.
const STOICHIOMETRIC_GROWTH_BUDGET_ENABLED = true;

// Formula amount booked per ACCEPTED micrometre of c-axis growth, expressed
// as mmol formula / kg solvent / µm. Fluid fields are mg solute per kg
// solvent, so the budget converts this amount to ppm separately for every
// species using coefficient × molar mass. A formula coefficient is a mole
// ratio, never a mass ratio.
//
// IMPORTANT MODEL BOUNDARY: this is a calibrated axial-growth proxy, not a
// physical solid-mass or solid-volume calculation. Equal axial increments
// book equal formula amounts even when grain size, habit, density, or rendered
// shell volume differ. It preserves formula mole ratios and exact closure of
// the inventory that the proxy booked; it does not claim extensive mass
// conservation. A physical ledger needs mineral density, formula mass,
// rendered shell volume, and a defined fluid-mass basis.
//
// 0.00008 mmol/kg/µm is the mole-correct successor to the historical 0.004
// ppm/coefficient/µm calibration: a representative 50 g/mol species still
// debits 0.004 mg/kg/µm, while light and heavy species now preserve the
// mineral formula in moles.
//
// Calibration history:
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
//   Accepted-zone finalization (v239): that 0.02 coefficient was applied to
//     the engine candidate BEFORE the default 5× geological clock expanded
//     the stored solid zone. Its calibrated accepted-thickness equivalent is
//     therefore 0.02 / 5 = 0.004 ppm per µm. Keeping 0.02 after moving the
//     ledger behind time scaling would silently quintuple depletion in every
//     default scenario. 0.004 preserves the calibrated 5× inventory while a
//     1× run now (correctly) grows and consumes one fifth as much per step.
const STOICHIOMETRIC_GROWTH_BUDGET_FORMULA_MMOL_PER_KG_PER_UM = 0.00008;

// Canonical disclosure consumed by the Creative UI, formation diagnosis,
// claim cards, and tests. Keep player-facing explanations derived from this
// object so the proxy cannot silently be promoted into a physical claim.
const STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE = Object.freeze({
  kind: 'calibrated stoichiometric axial-growth budget proxy',
  basis: '0.00008 mmol formula/kg solvent per accepted axial micrometre',
  preserves: 'formula mole ratios and exact closure of booked inventory on dissolution',
  limitation: 'not physical solid mass or volume; demand is independent of crystal size, habit, density, and rendered shell volume',
  is_physical_mass_conservation: false,
});

// Depletion narration threshold (ppm). When a species crosses below
// this value via growth-budget debit, _runEngineForCrystal emits a
// "Fe²⁺ depleted in ring 4 — Pyrite #5 growth halts" log line. 1 ppm
// is the order of magnitude where further precipitation is no longer
// meaningful — saturation has cratered. Single-shot per crossing:
// previous > 1 && proposed ≤ 1 fires the narrative once, not on
// every subsequent step where the species already sits below the
// threshold.
const STOICHIOMETRIC_GROWTH_BUDGET_DEPLETION_THRESHOLD = 1.0;

// Numerical solid-resolution floor. Several legacy dissolution laws taper as
// a percentage of the remaining radius and stop invoking below 5 µm. Without
// an explicit floor that leaves immortal sub-resolution remnants: the model
// says oxidation destroyed the grain, while occupancy/rendering still sees a
// positive crystal. When an accepted dissolution zone would leave no more
// than this thickness, the finalizer consumes the exact remainder and the
// growth budget returns that exact booked inventory.
const MIN_RESOLVABLE_SOLID_THICKNESS_UM = 5.0;

