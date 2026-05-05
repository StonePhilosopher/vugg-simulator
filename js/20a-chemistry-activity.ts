// ============================================================
// js/20a-chemistry-activity.ts — ion activities + Davies coefficients
// ============================================================
// PROPOSAL-GEOLOGICAL-ACCURACY Phase 2a: infrastructure for replacing
// concentration-based supersaturation (σ ∝ ppm) with activity-based
// thermodynamic supersaturation (σ = Q/K, where Q = ∏ aᵢ^νᵢ uses
// activities corrected for ionic strength via the Davies equation).
//
// LANDED FLAG-OFF: ACTIVITY_CORRECTED_SUPERSAT defaults false. Nothing
// in this module is invoked from the existing supersat methods. Phase 2b
// will migrate methods one class at a time, verifying each migration
// against the v18 baseline.
//
// What's here:
//   - SPECIES_PROPERTIES: charge + molar mass per fluid species (used
//     to compute molality and ionic strength).
//   - ionicStrength(fluid): I = ½ Σᵢ mᵢ zᵢ² in mol/kg. The driver of
//     activity-coefficient corrections.
//   - daviesLogGamma(z, I): log γ = -A·z²·(√I/(1+√I) - 0.3·I). Standard
//     Davies form, valid to I ≈ 0.5 mol/kg. Reduces to Debye-Hückel at
//     low I; fits experimental seawater activities to within ~10 % of
//     Pitzer in the moderate-salinity regime. For halite-saturated brines
//     (I ≈ 5 mol/kg) the proposal flags Pitzer as a research-mode
//     follow-up.
//   - speciesActivity(fluid, species): activity in mol/kg, ready to
//     feed into Q.
//   - ionActivityProduct(fluid, mineral): proper Q = ∏ aᵢ^νᵢ from the
//     MINERAL_STOICHIOMETRY table — replaces the Math.min Liebig idiom
//     and the empirical product hacks scattered across supersat files.
//
// What's *not* here yet:
//   - K (solubility products) — proposal calls for them to land on
//     data/minerals.json with van't Hoff temperature dependence. That's
//     Phase 2b work, per-mineral.
//   - σ wrapper — the "if (ACTIVITY_CORRECTED_SUPERSAT) return omega();"
//     migration in each supersaturation_<mineral>. Phase 2b.
//
// Conventions / known simplifications:
//   - S is treated as SO₄²⁻ (charge -2) by default; the v17 model
//     conflates sulfide and sulfate into one fluid field. Phase 4 (Eh)
//     splits this. For now, sulfides see the wrong charge for their
//     anion contribution to Q; this is a known calibration handle.
//   - Fe is treated as Fe²⁺ (charge +2). Same Phase 4 reframe — the
//     Fe²⁺/Fe³⁺ couple becomes explicit.
//   - As is treated as AsO₄³⁻ (oxidizing arsenate) by default; reducing
//     arsenide forms (charge varies) wait for Phase 4.
//   - U is the uranyl ion UO₂²⁺ (effective charge +2, mass tracks U).
//   - SiO₂, Sb, B (at neutral pH), Ge are neutral aqueous forms — γ = 1,
//     no ionic-strength correction.
//   - Au is treated as a chloride/bisulfide complex (effective charge -1
//     under most conditions) but is so trace-abundant it barely affects I.
//   - All "trace" species (Cr, Ti, Te, Se) are listed because the
//     simulator carries them; whether their activity actually matters
//     for any supersat is per-mineral.

const ACTIVITY_CORRECTED_SUPERSAT = true;

// Damping coefficient for the Davies correction. The full activity
// correction (factor = γ̄, geometric mean of activity coefficients)
// suppresses σ by ~50% at typical vug-fluid ionic strengths
// (I ≈ 0.03 mol/kg, γ_divalent ≈ 0.5). That's geologically real
// but it shifts every scenario's nucleation threshold simultaneously,
// breaking calibrations that were tuned against concentration-based σ.
// The damping smoothly interpolates between full correction and no
// correction:
//   damped_factor = 1 - ACTIVITY_DAMPING × (1 - raw_factor)
//   ACTIVITY_DAMPING = 1.0 → full Davies correction (research mode)
//   ACTIVITY_DAMPING = 0.5 → half-correction (current shipping default)
//   ACTIVITY_DAMPING = 0.0 → no correction (= flag off)
// Calibrated in Phase 2c (May 2026) against v19 baselines: damping
// = 0.4 brings the sweep-wide RMS delta into the same band as Phase
// 1c (~10-15%), with all 19 scenarios producing nonzero crystals
// and tutorials staying intact.
const ACTIVITY_DAMPING = 0.25;

// Charge & molar mass for each FluidChemistry species. Charge is the
// dominant aqueous form at typical vug pH (5-9) and Eh (oxidizing-to-
// mildly-reducing). Molar mass in g/mol; for oxyanions tracked by
// element (P → PO₄³⁻, V → VO₄³⁻, etc.) the mass is the *element*
// since the simulator's ppm field is element-mass.
const SPECIES_PROPERTIES: Record<string, { charge: number; molarMass: number; note?: string }> = {
  // Major cations
  Ca: { charge: +2, molarMass: 40.08 },
  Mg: { charge: +2, molarMass: 24.31 },
  Na: { charge: +1, molarMass: 22.99 },
  K:  { charge: +1, molarMass: 39.10 },
  Fe: { charge: +2, molarMass: 55.85, note: 'Fe²⁺ default; Phase 4 splits Fe²⁺/Fe³⁺' },
  Mn: { charge: +2, molarMass: 54.94 },
  Al: { charge: +3, molarMass: 26.98 },
  Cu: { charge: +2, molarMass: 63.55 },
  Zn: { charge: +2, molarMass: 65.38 },
  Pb: { charge: +2, molarMass: 207.2 },
  Ba: { charge: +2, molarMass: 137.33 },
  Sr: { charge: +2, molarMass: 87.62 },
  U:  { charge: +2, molarMass: 238.03, note: 'as uranyl UO₂²⁺' },
  Cr: { charge: +3, molarMass: 52.00 },
  Ni: { charge: +2, molarMass: 58.69 },
  Co: { charge: +2, molarMass: 58.93 },
  Ag: { charge: +1, molarMass: 107.87 },
  Bi: { charge: +3, molarMass: 208.98 },
  Be: { charge: +2, molarMass:   9.01 },
  Li: { charge: +1, molarMass:   6.94 },
  Ti: { charge: +2, molarMass:  47.87, note: 'as TiO²⁺' },

  // Major anions
  CO3: { charge: -2, molarMass: 60.01, note: 'CO₃²⁻; Phase 3 splits DIC by Bjerrum' },
  S:   { charge: -2, molarMass: 32.07, note: 'SO₄²⁻ default; Phase 4 splits sulfide/sulfate' },
  F:   { charge: -1, molarMass: 19.00 },
  Cl:  { charge: -1, molarMass: 35.45 },
  P:   { charge: -3, molarMass: 30.97, note: 'as PO₄³⁻; element mass' },
  V:   { charge: -3, molarMass: 50.94, note: 'as VO₄³⁻; element mass' },
  As:  { charge: -3, molarMass: 74.92, note: 'AsO₄³⁻ default; reducing forms vary' },
  Mo:  { charge: -2, molarMass: 95.95, note: 'as MoO₄²⁻; element mass' },
  W:   { charge: -2, molarMass: 183.84, note: 'as WO₄²⁻; element mass' },
  Te:  { charge: -2, molarMass: 127.60, note: 'as TeO₃²⁻ default' },
  Se:  { charge: -2, molarMass: 78.96, note: 'as SeO₄²⁻ default' },
  Au:  { charge: -1, molarMass: 196.97, note: 'as AuCl₄⁻ / Au(HS)₂⁻ complex' },

  // Neutral aqueous forms (γ = 1, no I contribution)
  SiO2: { charge: 0, molarMass: 60.08, note: 'as H₄SiO₄⁰' },
  Sb:   { charge: 0, molarMass: 121.76, note: 'as Sb(OH)₃⁰' },
  B:    { charge: 0, molarMass:  10.81, note: 'as B(OH)₃⁰ at pH<9' },
  Ge:   { charge: 0, molarMass:  72.63, note: 'as Ge(OH)₄⁰' },
};

// Convert ppm (mg solute per kg solvent, dilute approximation) → molality
// (mol per kg solvent). For ppm = 200, MM = 40.08 (Ca):
// m = 200 × 10⁻³ g/kg / 40.08 g/mol = 5.0 × 10⁻³ mol/kg ≈ 5 mmol/kg.
function ppmToMolality(ppm: number, molarMass: number): number {
  return (ppm > 0 ? ppm : 0) / (1000 * molarMass);
}

// Ionic strength I = ½ Σᵢ mᵢ zᵢ². Sums over all charged species in the
// SPECIES_PROPERTIES table. Neutral species contribute zero. Returns
// mol/kg.
function ionicStrength(fluid: any): number {
  let I = 0;
  for (const species in SPECIES_PROPERTIES) {
    const props = SPECIES_PROPERTIES[species];
    if (props.charge === 0) continue;
    const m = ppmToMolality(fluid[species], props.molarMass);
    I += 0.5 * m * props.charge * props.charge;
  }
  return I;
}

// Davies equation: log γ = -A·z²·(√I/(1+√I) - 0.3·I).
// A = 0.509 at 25 °C (mild T-dependence; Phase 4 may add the T-correction
// term once T-dependent Ksp lands). Valid to I ≈ 0.5 mol/kg; for
// halite-saturated brines (I ≈ 5) the proposal flags Pitzer as a
// research-mode follow-up.
//
// Domain safety: above I ≈ 1.7 mol/kg the linear -0.3·I term dominates
// the asymptotically-bounded √I/(1+√I) term, and Davies returns
// log γ > 0 (i.e. γ > 1) — geologically wrong (real ion activity
// coefficients stay ≤ 1 across nearly the entire fluid-chemistry
// regime relevant to vugs). Clamp log γ at 0 so the function fails
// gracefully rather than catastrophically when called outside its
// validity range. The clamp is a known-degraded fallback; Pitzer in
// research-mode-track replaces it with the right physics.
function daviesLogGamma(z: number, I: number): number {
  if (z === 0 || I <= 0) return 0;
  const sqrtI = Math.sqrt(I);
  const A = 0.509;
  const logGamma = -A * z * z * (sqrtI / (1 + sqrtI) - 0.3 * I);
  // Hard cap — Davies misbehaves above I ≈ 1.7 mol/kg. γ ≤ 1 is the
  // qualitatively-correct asymptote across the vug-relevant fluid range.
  return Math.min(0, logGamma);
}

// Activity of a single species, in mol/kg (numerically equivalent to
// γ·m on the molal scale). For neutral species, γ = 1 and activity = m.
// Pass a precomputed I if you'll be calling this many times for the
// same fluid (avoids re-summing).
function speciesActivity(fluid: any, species: string, I?: number): number {
  const props = SPECIES_PROPERTIES[species];
  if (!props) return 0;
  const m = ppmToMolality(fluid[species], props.molarMass);
  if (m <= 0) return 0;
  if (props.charge === 0) return m;
  const I_eff = I !== undefined ? I : ionicStrength(fluid);
  const logGamma = daviesLogGamma(props.charge, I_eff);
  return m * Math.pow(10, logGamma);
}

// Q = ∏ᵢ aᵢ^νᵢ where νᵢ comes from MINERAL_STOICHIOMETRY. Returns Q in
// (mol/kg)^∑νᵢ — the dimensioned form to be compared against a Ksp in
// the same units. Returns null if mineral has no stoichiometry entry,
// 0 if any required species is absent.
//
// This is the "math.min → math.product" upgrade in its general form.
// The carbonate Phase-2 bugfix (commit 568476f) handled the four
// carbonate min-Liebig sites inline with √(M·X); this function lets
// future migrations adopt the proper activity product everywhere with
// one consistent kernel.
function ionActivityProduct(fluid: any, mineral: string): number | null {
  const stoich = MINERAL_STOICHIOMETRY[mineral];
  if (!stoich) return null;
  const I = ionicStrength(fluid);
  let logQ = 0;
  for (const species in stoich) {
    const props = SPECIES_PROPERTIES[species];
    if (!props) continue;
    const m_ppm = fluid[species];
    if (typeof m_ppm !== 'number' || m_ppm <= 0) return 0;
    const m_mol = ppmToMolality(m_ppm, props.molarMass);
    let logA = Math.log10(m_mol);
    if (props.charge !== 0) logA += daviesLogGamma(props.charge, I);
    logQ += stoich[species] * logA;
  }
  return Math.pow(10, logQ);
}

// Geometric-mean activity-coefficient correction for a mineral's
// stoichiometry: factor = (∏ᵢ γᵢ^νᵢ)^(1/N) where N = ∑ᵢ νᵢ.
//
// Why this shape: the existing supersat methods use the geometric-mean
// concentration product (e.g. √(Ca·CO3) for calcite, (Ca·Mg·CO3²)^¼
// for dolomite — see commit 568476f). The activity-corrected version
// is the same shape but with activities aᵢ = γᵢ·mᵢ instead of
// concentrations mᵢ. So:
//
//     σ_activity = (∏ᵢ aᵢ^νᵢ)^(1/N) / eq
//                = (∏ᵢ γᵢ^νᵢ)^(1/N) × (∏ᵢ mᵢ^νᵢ)^(1/N) / eq
//                = activityCorrectionFactor × σ_concentration
//
// Migration drop-in: each migrated supersat method multiplies its
// existing sigma by activityCorrectionFactor(fluid, mineral) when
// ACTIVITY_CORRECTED_SUPERSAT is true. Preserves existing eq calibration.
//
// Behavior:
//   - I = 0 (zero salinity)        → factor = 1.0 (no change)
//   - I = 0.02 (typical vug fluid) → factor ≈ 0.6-0.9 (small drop in σ)
//   - I = 0.5 (concentrated brine) → factor ≈ 0.3-0.5
//   - I > 1.7 (Davies-invalid)     → clamp returns γᵢ ≤ 1 → factor ≤ 1
//
// Returns 1.0 (no correction) for any mineral missing from the
// stoichiometry table, missing fluid species, or zero stoichiometry sum.
function activityCorrectionFactor(fluid: any, mineral: string): number {
  const stoich = MINERAL_STOICHIOMETRY[mineral];
  if (!stoich) return 1.0;
  const I = ionicStrength(fluid);
  if (I <= 0) return 1.0;
  let logProduct = 0;
  let totalNu = 0;
  for (const species in stoich) {
    const props = SPECIES_PROPERTIES[species];
    if (!props) continue;
    totalNu += stoich[species];
    if (props.charge === 0) continue; // neutral species: log γ = 0
    logProduct += stoich[species] * daviesLogGamma(props.charge, I);
  }
  if (totalNu === 0) return 1.0;
  const rawFactor = Math.pow(10, logProduct / totalNu);
  // Apply the ACTIVITY_DAMPING knob: smoothly blend toward 1.0 (no
  // correction) so game-mode scenarios stay within calibration bands.
  return 1.0 - ACTIVITY_DAMPING * (1.0 - rawFactor);
}
