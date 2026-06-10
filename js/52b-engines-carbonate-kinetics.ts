// ============================================================
// js/52b-engines-carbonate-kinetics.ts — PWP rate law + metastability
// ============================================================
// PROPOSAL-CARBONATE-GEOCHEM Phase 1 Week 6.
//
// Kinetic rate laws for the carbonate engines. Builds on Week 1-2's
// thermodynamic stack:
//
//   data/thermo-carbonates.json     k1/k2/k3 + Ea per mineral
//   js/20c-chemistry-carbonate-Ksp   getCarbonateLogKsp
//   js/20b-chemistry-carbonate-system bjerrumFractions for species split
//   js/32b-supersat-carbonate-Ksp    carbonateSaturationIndex / Omega
//
// Observer-only — callable but not wired into any grow_* function.
// Week 9 promotion: grow_calcite flips through the kspSupersatActiveFor
// dispatcher into the SI engine, AND the kinetic engine here replaces
// the rate-calculation half of grow_calcite. Same flag gate.
//
// THE PLUMMER-WIGLEY-PARKHURST 1978 RATE LAW
//
// Canonical calcite rate law, ~50 years of follow-up confirmation
// (Morse & Arvidson 2002 review confirms it's still the standard).
// Form:
//
//   r_net = k1·a(H⁺) + k2·a(H₂CO₃*) + k3 − k4·a(Ca²⁺)·a(HCO₃⁻)
//
// where k1..k3 are forward rate constants (the three kinetic
// pathways — H⁺-catalyzed dissolution, H₂CO₃-catalyzed dissolution,
// and water/uncatalyzed) and k4 enforces detailed balance against
// Ksp at equilibrium.
//
// k4 isn't a free parameter — it's derived from k1..k3 + Ksp so the
// net rate is exactly zero when the fluid is at calcite equilibrium.
// This module implements the equivalent form:
//
//   r_forward = k1·a(H⁺) + k2·a(H₂CO₃*) + k3
//   r_net     = r_forward · (1 − 1/Ω)
//
// At equilibrium Ω=1, so r_net=0. Above equilibrium (Ω>1), r_net is
// positive (precipitation, by the sim's "rate>0 grows" convention).
// Below (Ω<1), r_net is negative (dissolution). This form is
// equivalent to PWP at equilibrium and a standard simulator-friendly
// approximation across the practical Ω range (Morse 1983; Lasaga 1998).
//
// T-dependence per Arrhenius:  k(T) = k(298)·exp(−Ea/R·(1/T − 1/298))
// Activation energies: Palandri & Kharaka 2004 (USGS OFR 2004-1068)
// three-mechanism calcite refit, paired BY MECHANISM (v178 fix — the
// array previously shipped permuted, acid↔carbonate):
//   Ea[0] → k1 (acid, H+ attack)        14.4 kJ/mol
//   Ea[1] → k2 (carbonate, H2CO3*)      35.4 kJ/mol
//   Ea[2] → k3 (neutral, H2O)           23.5 kJ/mol
//
// UNITS
//
//   k1..k3 in mol/(cm²·s) per data/thermo-carbonates.json
//   activities in mol/kg (molal)
//   r_net in mol/(cm²·s)
//
// For sim consumption, convert mol/(cm²·s) to thickness/s via molar
// volume of calcite (36.93 cm³/mol) → linear growth rate cm/s.
// pwpRateToSimMmPerStep applies the conversion + a calibration scaling
// that converts mol/(cm²·s) into the sim's µm/step convention. The
// factor encodes the "how many real seconds is one sim step"
// implicitly — different scenarios model different time scales
// (cave dripstone ~years per step; hot-spring travertine ~days per
// step), so a single calibration factor is a compromise across
// scenarios, not a perfect match for any one.
//
// METASTABILITY
//
// Aragonite has its own Ksp and rate factor (×3 vs calcite per
// Wollast 1990). Its kinetic favorability over calcite is a separate
// decision: Mg poisoning of calcite step edges (Davis 2000) + warm T
// route precipitation to aragonite. Calcite is the thermodynamic
// winner; aragonite is the kinetic winner under specific conditions.
//
//   aragoniteKineticallyFavoredOver(calcite, fluid, T):
//     true when Mg/Ca > 4.0 AND T > 30°C
//   else calcite wins
//
// Dolomite (Kim 2023): kinetically inhibited unless cyclic-Ω
// modulation provides ordering momentum. Without cycling, the
// dolomite rate is suppressed by ~70%. With sufficient cycling
// (f_ord > 0.7), the rate runs at near-base.
//
// HMC: calcite PWP with Mg-poisoning inhibitor — the same sigmoid
// the empirical engine has shipped since v17 (Davis 2000, Nielsen
// 2013). Rate factor declines smoothly with Mg/Ca ratio.

const _PWP_GAS_CONSTANT_kJ_mol_K = 8.31446e-3;  // R
const _PWP_T_REF_K = 298.15;                     // 25°C reference
const _PWP_MOLAR_VOL_CALCITE_CM3_MOL = 36.93;   // calcite, Robie 1995
const _PWP_MOLAR_VOL_DOLOMITE_CM3_MOL = 64.34;  // dolomite
const _PWP_MOLAR_VOL_ARAGONITE_CM3_MOL = 34.15; // aragonite
const _PWP_MOLAR_VOL_SIDERITE_CM3_MOL = 29.38;  // siderite

// Arrhenius temperature scaling. k(T) = k(T_ref) × exp(-Ea/R·(1/T - 1/T_ref)).
function _arrheniusScale(k_ref: number, Ea_kJ_mol: number, T_celsius: number): number {
  const T_K = T_celsius + 273.15;
  if (T_K <= 0) return k_ref;
  const exponent = -(Ea_kJ_mol / _PWP_GAS_CONSTANT_kJ_mol_K) * (1 / T_K - 1 / _PWP_T_REF_K);
  return k_ref * Math.exp(exponent);
}

// Read the PWP parameters for a mineral from data/thermo-carbonates.json
// (via getCarbonateData in 20c). Falls back to calcite's parameters
// scaled by a factor — siderite/rhodochrosite/smithsonite have no
// dedicated rate law in the literature; family-analog is the standard
// estimation (PHREEQC + LLNL databases do the same).
function _pwpParamsFor(mineralId: string): {
  k1: number, k2: number, k3: number,
  Ea: [number, number, number],
  scale: number,
} {
  // Defaults = calcite values (Plummer-Wigley-Parkhurst 1978).
  let p = {
    k1: 8.91e-5,
    k2: 4.47e-7,
    k3: 1.86e-11,
    // v178: paired by mechanism — [k1 acid 14.4, k2 carbonate 35.4,
    // k3 neutral 23.5] (P&K 2004). Previously permuted (acid↔carbonate).
    Ea: [14.4, 35.4, 23.5] as [number, number, number],
    scale: 1.0,
  };
  if (typeof getCarbonateData !== 'function') return p;
  const data = getCarbonateData(mineralId);
  if (!data || !data.kinetics) return p;
  const kin = data.kinetics;
  const param = kin.parameters || {};
  if (typeof param.k1_25C_mol_cm2_s === 'number') p.k1 = param.k1_25C_mol_cm2_s;
  if (typeof param.k2_25C_mol_cm2_s === 'number') p.k2 = param.k2_25C_mol_cm2_s;
  if (typeof param.k3_25C_mol_cm2_s === 'number') p.k3 = param.k3_25C_mol_cm2_s;
  if (Array.isArray(param.Ea_kJ_mol) && param.Ea_kJ_mol.length === 3) {
    p.Ea = [param.Ea_kJ_mol[0], param.Ea_kJ_mol[1], param.Ea_kJ_mol[2]];
  }
  if (typeof param.rate_factor_vs_calcite === 'number') p.scale = param.rate_factor_vs_calcite;
  return p;
}

// =============================================================
// Activity helpers — undamped, raw Davies
// =============================================================

// Activity of H+ (= 10^-pH; H+ has unit activity coefficient by convention).
function _activityH(fluid: any): number {
  const pH = typeof fluid.pH === 'number' ? fluid.pH : 7.0;
  return Math.pow(10, -pH);
}

// Activity of H2CO3* — total dissolved CO2 + true H2CO3 (negligibly
// small). Molality × bjerrumFractions.H2CO3. H2CO3* is neutral, so no
// activity coefficient correction.
function _activityH2CO3(fluid: any, T_C: number): number {
  if (typeof fluid.CO3 !== 'number' || fluid.CO3 <= 0) return 0;
  const pH = typeof fluid.pH === 'number' ? fluid.pH : 7.0;
  const DIC_molal = fluid.CO3 / (1000 * 60.01);
  const f = bjerrumFractions(pH, T_C);
  return DIC_molal * f.H2CO3;
}

// Ca²⁺ and HCO3⁻ activities aren't needed by the (1 − 1/Ω) reverse-
// rate form: the reverse contribution is encapsulated in Ω, which
// carbonateOmega already computes with proper Davies corrections.
// Kept here as a future hook if the full four-term PWP with explicit
// k4 detailed balance becomes worth implementing.

// =============================================================
// PWP rate law — calcite as the canonical implementation
// =============================================================

// Forward rate of calcite dissolution/precipitation in mol/(cm²·s).
// Three-term PWP sum, T-corrected per Arrhenius. Always non-negative.
function pwpForwardRate(mineralId: string, fluid: any, T_C: number): number {
  if (!fluid) return 0;
  const p = _pwpParamsFor(mineralId);
  const k1_T = _arrheniusScale(p.k1, p.Ea[0], T_C);
  const k2_T = _arrheniusScale(p.k2, p.Ea[1], T_C);
  const k3_T = _arrheniusScale(p.k3, p.Ea[2], T_C);
  const aH = _activityH(fluid);
  const aH2CO3 = _activityH2CO3(fluid, T_C);
  const r = k1_T * aH + k2_T * aH2CO3 + k3_T;
  return p.scale * Math.max(0, r);
}

// Net rate via detailed balance: r_net = r_forward · (1 − 1/Ω).
// At Ω=1 (equilibrium) r_net=0; Ω>1 (supersaturated) r_net>0
// (precipitation); Ω<1 (undersaturated) r_net<0 (dissolution).
// Returns mol/(cm²·s) with sign.
function pwpNetRate(mineralId: string, fluid: any, T_C: number, mg_content: number = 0): number {
  if (!fluid) return 0;
  const r_forward = pwpForwardRate(mineralId, fluid, T_C);
  if (r_forward <= 0) return 0;
  if (typeof carbonateOmega !== 'function') return r_forward;
  const omega = carbonateOmega(mineralId, fluid, T_C, mg_content);
  if (!isFinite(omega) || omega <= 0) {
    // No omega available — return forward rate (assumes far-from-
    // equilibrium dissolution regime, e.g., dropping fresh acid into
    // limestone).
    return r_forward;
  }
  return r_forward * (1 - 1 / omega);
}

// Conversion: mol/(cm²·s) → µm/sim-step.
//   thickness_rate cm/s = mol_rate / (1 mol / molar_volume cm³/mol)
//                       = mol_rate × molar_volume
//   µm/s = thickness cm/s × 1e4
//   µm/step = µm/s × sim_seconds_per_step
//
// v144 (Week 9 calcite promotion): tuned 1.0 → 5.0e+4 empirically
// against the empirical calcite engine's µm/step output across the
// 11 calcite-firing scenarios. The probe (tools/w9_calcite_calibration
// _probe.mjs) found median pwp_um/step at factor=1.0 = 2.9e-5 in the
// moderate-supersaturation regime; factor 5e4 lands typical growth at
// ~1.5 µm/step (matching the empirical engine's ~0.5-15 µm/step band
// for typical scenarios).
//
// Per-scenario drift is expected and geologically positive — PWP
// scales with T (Arrhenius k1..k3) and pH (a(H+) term), so:
//   - Hot acidic fluids (mvt at 150°C) grow MORE calcite than the
//     empirical 5×(σ-1) formula — geologically right
//   - Cool alkaline fluids (cave dripstone at 15°C) grow LESS — also
//     geologically right (real cave calcite grows ~0.01-1 mm/year,
//     orders of magnitude slower than hot-spring travertine)
//
// The single-factor compromise: scenarios that drift unacceptably
// far from their geological intent get re-anchored via the
// vugg-tune-scenario discipline at v144 baseline regen.
// v178: re-anchored 5.0e+4 → 8.1e+3 alongside the Ea mechanism-pairing
// fix. The corrected pairing amplifies the k2 (carbonate) + k3 (neutral)
// terms at high T (~6× on the w9 probe's sigma-1.5-5 median), and the
// global factor's job is absolute scale — so it absorbs the inflation,
// preserving the fleet's growth envelope (w9 p50 ≈ 38 µm/step, the
// pre-fix level the v145+ scenario calibrations are anchored on) while
// the RELATIVE pathway weighting (the actual science) stays corrected.
// Derivation: the naive linear rescale 5.0e4 × (37.92/234.4) ≈ 8.1e3
// OVERSHOT (probe p50 landed 7.95, not 38 — printed-median responds
// super-linearly to the factor because growth feeds back into which
// steps qualify for the sigma-1.5-5 regime). Log-interpolated to 1.9e4
// and accepted on the fleet-level criterion that actually matters:
// seed-42 baseline drift vs v177 (see the v178 entry in 15-version.ts).
// NOTE the w9 probe's "pwp_um(x1)" column predates v144's tuning — it
// calls the LIVE pwpRateToSimMicronsPerStep, so printed values include
// this factor; its "recommended calibration_factor" lines assume raw
// and must be rescaled by the live factor before use.
let _PWP_CALIBRATION_FACTOR = 1.9e+4;
function setPWPCalibrationFactor(factor: number): void {
  if (typeof factor === 'number' && isFinite(factor) && factor > 0) {
    _PWP_CALIBRATION_FACTOR = factor;
  }
}
function pwpRateToSimMicronsPerStep(mineralId: string, mol_per_cm2_s: number): number {
  let Vm = _PWP_MOLAR_VOL_CALCITE_CM3_MOL;
  if (mineralId === 'aragonite') Vm = _PWP_MOLAR_VOL_ARAGONITE_CM3_MOL;
  else if (mineralId === 'dolomite') Vm = _PWP_MOLAR_VOL_DOLOMITE_CM3_MOL;
  else if (mineralId === 'siderite') Vm = _PWP_MOLAR_VOL_SIDERITE_CM3_MOL;
  const cm_per_s = mol_per_cm2_s * Vm;
  const um_per_s = cm_per_s * 1e4;
  return um_per_s * _PWP_CALIBRATION_FACTOR;
}

// =============================================================
// Metastability — aragonite vs calcite
// =============================================================

// Mg poisoning of calcite step edges (Davis 2000): Mg²⁺ stalls
// {10ī4} growth steps. Above Mg/Ca ≈ 2, calcite growth slows
// substantially. Above Mg/Ca ≈ 4, aragonite becomes the kinetic
// winner despite being thermodynamically metastable. Combined with
// T > 30°C (Burton & Walter 1987: thermal preference for the
// orthorhombic structure), aragonite wins.
function aragoniteKineticallyFavoredOver(fluid: any, T_C: number): boolean {
  if (!fluid || typeof fluid.Ca !== 'number' || fluid.Ca <= 0) return false;
  if (typeof fluid.Mg !== 'number') return false;
  const mg_ratio = fluid.Mg / fluid.Ca;
  return mg_ratio > 4.0 && T_C > 30;
}

// Mg poisoning inhibition factor for calcite. 1 = no inhibition;
// 0.15 = 85% inhibition (the cap from the existing engine v17).
// Sigmoid centered on Mg/Ca = 2.
function mgPoisoningFactor(fluid: any): number {
  if (!fluid || typeof fluid.Ca !== 'number' || fluid.Ca <= 0.01) return 1.0;
  const mg = typeof fluid.Mg === 'number' ? fluid.Mg : 0;
  const mg_ratio = mg / fluid.Ca;
  const inhibition = 1.0 / (1.0 + Math.exp(-(mg_ratio - 2.0) / 0.5));
  return Math.max(0.15, 1.0 - 0.85 * inhibition);
}

// =============================================================
// Per-mineral net-rate functions
// =============================================================

// Calcite — full PWP × Mg-poisoning kinetic modifier.
function calciteRate(fluid: any, T_C: number): number {
  const raw = pwpNetRate('calcite', fluid, T_C);
  return raw * mgPoisoningFactor(fluid);
}

// Aragonite — PWP × 3 (Wollast 1990) × metastability gate.
// If aragonite isn't kinetically favored (low Mg/Ca or cool T),
// rate stays available but the supersat path would prefer calcite —
// the polymorph decision is left to the dispatch layer.
function aragoniteRate(fluid: any, T_C: number): number {
  return pwpNetRate('aragonite', fluid, T_C);
}

// Dolomite — Kim 2023 cyclic-Ω modulation gate. Without cycling
// (f_ord ≈ 0) the rate is suppressed to 30% of base. With full
// ordering (f_ord ≈ 1) the rate runs at base. Smooth interpolation:
//   rate = base × (0.30 + 0.70 × f_ord)
// This captures the Kim mechanism: ordered dolomite forms when
// cycling has accumulated enough to build cation-disorder-driven
// step generation.
function dolomiteRate(fluid: any, T_C: number, f_ord: number): number {
  const f = Math.max(0, Math.min(1, f_ord));
  const gate = 0.30 + 0.70 * f;
  return pwpNetRate('dolomite', fluid, T_C) * gate;
}

// HMC — calcite PWP with Mg poisoning already baked in. mg_content
// (per-crystal Mg substitution) flows through to omega via the
// mg_content-dependent Ksp (20c).
function HMCRate(fluid: any, T_C: number, mg_content: number = 0.10): number {
  const raw = pwpNetRate('HMC', fluid, T_C, mg_content);
  return raw * mgPoisoningFactor(fluid);
}

// Siderite + rhodochrosite + smithsonite — family-analog (calcite
// PWP × rate_factor_vs_calcite from data/thermo-carbonates.json).
// Siderite gets an additional redox gate at the GROW layer (not
// here — the kinetic engine focuses on rate magnitude; the redox
// check is geochemical-feasibility and lives in the empirical
// engine's hard gates per Week 2's dispatcher placement).
function familyAnalogRate(mineralId: string, fluid: any, T_C: number): number {
  return pwpNetRate(mineralId, fluid, T_C);
}
function sideriteRate(fluid: any, T_C: number): number { return familyAnalogRate('siderite', fluid, T_C); }
function rhodochrositeRate(fluid: any, T_C: number): number { return familyAnalogRate('rhodochrosite', fluid, T_C); }
function smithsoniteRate(fluid: any, T_C: number): number { return familyAnalogRate('smithsonite', fluid, T_C); }
