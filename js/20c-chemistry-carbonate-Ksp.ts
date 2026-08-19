// ============================================================
// js/20c-chemistry-carbonate-Ksp.ts — Ksp(T) lookups for carbonates
// ============================================================
// PROPOSAL-CARBONATE-GEOCHEM Week 1+2: thermodynamic data layer.
// Loads data/thermo-carbonates.json into a module-level lookup and
// exposes:
//
//   - getCarbonateKsp(mineralId, T_celsius)  → numeric Ksp at T
//   - getCarbonateThermoTier(mineralId)      → 'A' | 'B' | 'C' | 'D' | 'conflict'
//   - getCarbonateKineticTier(mineralId)     → same enum
//   - getCarbonateData(mineralId)            → full record (for audit / UI)
//   - listCarbonatesAtTier(tier)             → array of mineralIds (filter UI)
//   - thermoCarbonatesReady(cb)              → notify when fetch completes
//
// T-dependence — TWO forms, picked per-mineral by logKsp_fit.form:
//
//   form 'analytic' (v194, the preferred form where data exists):
//     logKsp(T) = A1 + A2·TK + A3/TK + A4·log10(TK) + A5/TK²
//   the PHREEQC `-analytical_expression`, carried verbatim from
//   canonical wateq4f.dat. This is the FULL retrograde curvature; the
//   analytic gives logKsp(T) directly (logKsp_25C is ignored for the
//   T-curve, only used as a sanity anchor). Available for the carbonates
//   wateq4f ships an -analytical line for: calcite, aragonite,
//   strontianite, witherite.
//
//   form 'vanthoff' (the fallback where wateq4f gives only log_k+ΔH):
//     logKsp(T) = logKsp_25C - (deltaH_diss / (2.303·R))·(1/T_K - 1/298.15)
//   constant-ΔH. Exact within ~0.1 log units across 0-60°C but ~1.3 log
//   too FLAT at 158°C vs the analytic (the seam the pK(T) fix exposed).
//   Kept for dolomite/siderite/rhodochrosite/smithsonite/cerussite +
//   the OH-bearing Cu/Zn carbonates — wateq4f has no -analytical for
//   these, so van't Hoff is the honest best available.
//
// MIXED-FIDELITY, BY DESIGN: analytic where the database provides it,
// van't Hoff where it doesn't. R = 8.31446e-3 kJ/(mol·K). Falls back to
// the 25°C value if data for the mineral is missing — never throws,
// always returns a number, so consumers don't have to defensive-code
// around incomplete data.
//
// T-CLAMP [0, 250] °C matches js/20b's pK(T) clamp exactly: the carbonate
// IAP (pK-driven CO3²⁻) and the carbonate Ksp must share a T-domain so
// SI = logIAP − logKsp has no fidelity seam at the edges. Above 250°C
// both hold their 250°C value (bounded extrapolation, not runaway).
//
// HMC is special: it is a binary nonideal calcite–Ca0.5Mg0.5CO3
// solid solution, not a pure phase with a fitted scalar Ksp. Callers pass
// Mg mole fraction x. The helpers below evaluate the PHREEQC/Glynn
// subregular component activities and their stoichiometric Kss.

const _THERMO_GAS_CONSTANT_kJ_mol_K = 8.31446e-3;  // R
const _THERMO_T_REF_K = 298.15;                     // 25°C reference
const _THERMO_LN10 = Math.LN10;                     // for 2.303 conversion
const _THERMO_T_CLAMP_C: [number, number] = [0, 250]; // van't Hoff clamp — matches js/20b pK(T)

// The PHREEQC carbonate -analytical expressions (PB82 calcite/aragonite,
// the wateq4f strontianite/witherite) are SOLUBILITY fits to roughly
// 0–90 °C. Extrapolating their curvature into the 150–700 °C scenarios
// is NOT physics — it over-steepens the retrograde to +3.4 SI at the
// 250 °C clamp, overwhelms the (old-SI-calibrated) calcite/aragonite
// gates, and reanimates the metastable hot aragonite v192 correctly
// retired. So the analytic is held to its FIT VALIDITY and frozen flat
// above it: full curvature where it's measured (the band carbonates
// dominantly form in + the cooling-pin window's lower edge), a bounded
// constant above. This is the honest "don't extrapolate past the data"
// rule — distinct from the van't Hoff [0,250] clamp because the two
// forms have different validated ranges. Promoting the analytic into
// the >90 °C growth band is its own arc (calcite/aragonite gate
// re-calibration + aragonite metastability hardening — BACKLOG).
const _THERMO_ANALYTIC_CLAMP_C: [number, number] = [0, 90];

// PHREEQC analytic expression: logK(T) = A1 + A2·TK + A3/TK +
// A4·log10(TK) + A5/TK²  (TK in Kelvin). Same form as js/20b's PB82 pK
// fits. T clamped to the analytic's fit-validity range (held flat above).
function _carbonateAnalyticLogK(coef: number[], T_celsius: number): number {
  const Tc = Math.max(_THERMO_ANALYTIC_CLAMP_C[0], Math.min(_THERMO_ANALYTIC_CLAMP_C[1], T_celsius));
  const TK = Tc + 273.15;
  return coef[0] + coef[1] * TK + coef[2] / TK + coef[3] * Math.log10(TK) + (coef[4] || 0) / (TK * TK);
}

type ThermoTier = 'A' | 'B' | 'C' | 'D' | 'conflict' | 'unknown';

type ThermoCarbonateEntry = {
  formula: string,
  thermodynamics: {
    logKsp_25C?: number | string,
    logKsp_fit?: any,
    deltaGf_kJ_mol?: number | string | null,
    deltaHf_kJ_mol?: number | null,
    S_J_mol_K?: number | null,
    valid_T_range_C?: [number, number],
    sources?: string[],
    databases_agree?: string[],
    confidence_tier?: ThermoTier,
    notes?: string,
  },
  kinetics?: {
    rate_law?: string,
    parameters?: any,
    sources?: string[],
    confidence_tier?: ThermoTier,
    notes?: string,
  },
  metastability?: any,
};

type ThermoCarbonatesDoc = {
  _meta?: any,
  [mineralId: string]: ThermoCarbonateEntry | any,
};

// Minimal fallback so consumers that ask before the fetch lands still
// get sensible numbers for load-bearing engine minerals and observer-only
// diagnostics that may render before the fetch resolves. Values match the JSON; the fallback exists
// purely so a fetch failure or pre-fetch call doesn't break callers.
const THERMO_CARBONATES_FALLBACK: ThermoCarbonatesDoc = {
  calcite: {
    formula: 'CaCO3',
    thermodynamics: {
      logKsp_25C: -8.48,
      logKsp_fit: { form: 'analytic', analytic: [-171.9065, -0.077993, 2839.319, 71.595, 0], deltaH_diss_kJ_mol: -10.5 },
      confidence_tier: 'A',
    },
  },
  aragonite: {
    formula: 'CaCO3',
    thermodynamics: {
      logKsp_25C: -8.336,
      logKsp_fit: { form: 'analytic', analytic: [-171.9773, -0.077993, 2903.293, 71.595, 0], deltaH_diss_kJ_mol: -10.0 },
      confidence_tier: 'A',
    },
  },
  dolomite: {
    formula: 'CaMg(CO3)2',
    thermodynamics: {
      logKsp_25C: -17.09,
      logKsp_fit: { form: 'vanthoff', deltaH_diss_kJ_mol: -28.0 },
      confidence_tier: 'A',
    },
  },
  siderite: {
    formula: 'FeCO3',
    thermodynamics: {
      logKsp_25C: -10.89,
      logKsp_fit: { form: 'vanthoff', deltaH_diss_kJ_mol: -20.0 },
      confidence_tier: 'A',
    },
  },
  rosasite: {
    formula: '(Cu,Zn)2(CO3)(OH)2',
    thermodynamics: {
      logKsp_25C: -36.400,
      logKsp_fit: { form: 'constant_25C_only' },
      confidence_tier: 'C',
    },
  },
  aurichalcite: {
    formula: '(Zn,Cu)5(CO3)2(OH)6',
    thermodynamics: {
      logKsp_25C: -76.16,
      logKsp_fit: { form: 'constant_25C_only' },
      confidence_tier: 'C',
    },
  },
};

let THERMO_CARBONATES: ThermoCarbonatesDoc = THERMO_CARBONATES_FALLBACK;
let THERMO_CARBONATES_READY = false;
const _thermoListeners: Array<(doc: ThermoCarbonatesDoc) => void> = [];

function thermoCarbonatesReady(cb: (doc: ThermoCarbonatesDoc) => void) {
  if (THERMO_CARBONATES_READY) cb(THERMO_CARBONATES);
  else _thermoListeners.push(cb);
}

// Same multi-path fetch pattern as 00-mineral-spec.ts. cache:'no-store'
// because the thermo file is under active development.
async function _loadThermoCarbonates(paths: string[]): Promise<{ doc: ThermoCarbonatesDoc, path: string }> {
  for (const p of paths) {
    try {
      const r = await fetch(p, { cache: 'no-store' });
      if (r.ok) return { doc: await r.json(), path: p };
    } catch (e) { /* try next */ }
  }
  throw new Error('all thermo-carbonates paths failed');
}

_loadThermoCarbonates([
  './data/thermo-carbonates.json',
  '../data/thermo-carbonates.json',
  '/data/thermo-carbonates.json',
])
  .then(({ doc, path }) => {
    THERMO_CARBONATES = doc;
    THERMO_CARBONATES_READY = true;
    const n = Object.keys(doc).filter(k => !k.startsWith('_')).length;
    console.info(`[thermo] loaded ${n} carbonate entries from ${path}`);
    _thermoListeners.splice(0).forEach(cb => { try { cb(THERMO_CARBONATES); } catch (e) { console.error(e); } });
  })
  .catch(err => {
    console.warn('[thermo] fetch failed; using fallback', err);
    THERMO_CARBONATES_READY = true;
    _thermoListeners.splice(0).forEach(cb => { try { cb(THERMO_CARBONATES); } catch (e) { console.error(e); } });
  });

// ---- Lookup helpers ---------------------------------------------------

function getCarbonateData(mineralId: string): ThermoCarbonateEntry | null {
  const entry = THERMO_CARBONATES[mineralId];
  if (!entry || typeof entry !== 'object' || mineralId.startsWith('_')) return null;
  return entry as ThermoCarbonateEntry;
}

function getCarbonateThermoTier(mineralId: string): ThermoTier {
  const entry = getCarbonateData(mineralId);
  if (!entry || !entry.thermodynamics) return 'unknown';
  return (entry.thermodynamics.confidence_tier as ThermoTier) || 'unknown';
}

function getCarbonateKineticTier(mineralId: string): ThermoTier {
  const entry = getCarbonateData(mineralId);
  if (!entry || !entry.kinetics) return 'unknown';
  return (entry.kinetics.confidence_tier as ThermoTier) || 'unknown';
}

// Nondefective calcite–dolomite subregular model used by the official PHREEQC
// solid-solution example (Glynn & Reardon 1990; Busenberg & Plummer 1989).
// HMC x is Mg/(Ca+Mg). PHREEQC's second component is Ca0.5Mg0.5CO3,
// therefore its component mole fraction y = 2x over the promoted x <= 0.30
// envelope. Dimensional parameters are converted at the current temperature,
// exactly as PHREEQC documents for -Gugg_kJ.
function hmcSolidSolutionAssessment(mg_content: number, T_celsius: number): any {
  const entry = getCarbonateData('HMC');
  const fit = entry?.thermodynamics?.logKsp_fit || {};
  const x = Math.max(0, Math.min(0.30, Number(mg_content) || 0));
  const yDisorderedDolomite = Math.max(0, Math.min(0.60, 2 * x));
  const yCalcite = 1 - yDisorderedDolomite;
  const gugg = Array.isArray(fit.guggenheim_kJ_mol)
    ? fit.guggenheim_kJ_mol : [12.593, 4.70];
  const T_K = Math.max(273.15, Number(T_celsius) + 273.15);
  const a0 = Number(gugg[0]) / (_THERMO_GAS_CONSTANT_kJ_mol_K * T_K);
  const a1 = Number(gugg[1]) / (_THERMO_GAS_CONSTANT_kJ_mol_K * T_K);
  // PHREEQC equations 39–40. Component 1 = calcite; component 2 =
  // Ca0.5Mg0.5CO3. Activity = mole fraction × activity coefficient.
  const lnGammaCalcite = (
    a0 - a1 * (4 * yCalcite - 1)
  ) * yDisorderedDolomite * yDisorderedDolomite;
  const lnGammaDisorderedDolomite = (
    a0 + a1 * (4 * yDisorderedDolomite - 1)
  ) * yCalcite * yCalcite;
  const gammaCalcite = Math.exp(lnGammaCalcite);
  const gammaDisorderedDolomite = Math.exp(lnGammaDisorderedDolomite);
  const activityCalcite = yCalcite * gammaCalcite;
  const activityDisorderedDolomite = yDisorderedDolomite * gammaDisorderedDolomite;
  const calciteLogK = getCarbonateLogKsp('calcite', T_celsius);
  const halfDolomiteLogK = 0.5 * getCarbonateLogKsp('dolomite', T_celsius);
  const calciteTerm = yCalcite > 0
    ? yCalcite * (calciteLogK + Math.log10(activityCalcite)) : 0;
  const dolomiteTerm = yDisorderedDolomite > 0
    ? yDisorderedDolomite * (halfDolomiteLogK + Math.log10(activityDisorderedDolomite)) : 0;
  const documentedGap = Array.isArray(fit.miscibility_gap_component2_25C)
    ? fit.miscibility_gap_component2_25C : [0.0428, 0.9991];
  const atDocumentedTemperature = Math.abs(Number(T_celsius) - 25) <= 0.25;
  const insideDocumentedGap = atDocumentedTemperature
    && yDisorderedDolomite >= Number(documentedGap[0])
    && yDisorderedDolomite <= Number(documentedGap[1]);
  const phaseStabilityStatus = !atDocumentedTemperature
    ? 'miscibility_not_evaluated_outside_documented_25C'
    : insideDocumentedGap
      ? 'inside_documented_25C_miscibility_gap_metastable_branch'
      : 'outside_documented_25C_miscibility_gap';
  const activityModelTemperatureStatus = atDocumentedTemperature
    ? 'interaction_parameters_calibrated_at_25C'
    : 'dimensional_interaction_parameters_divided_by_RT_bounded_extrapolation';
  return {
    model: 'calcite_disordered_dolomite_subregular_v1',
    mgMoleFraction: x,
    componentMoleFractions: {
      calcite: yCalcite,
      disorderedDolomiteHalfFormula: yDisorderedDolomite,
    },
    guggenheimKJMol: [Number(gugg[0]), Number(gugg[1])],
    guggenheimDimensionless: [a0, a1],
    activityCoefficients: {
      calcite: gammaCalcite,
      disorderedDolomiteHalfFormula: gammaDisorderedDolomite,
    },
    componentActivities: {
      calcite: activityCalcite,
      disorderedDolomiteHalfFormula: activityDisorderedDolomite,
    },
    calciteLogK,
    halfDolomiteLogK,
    stoichiometricLogKsp: calciteTerm + dolomiteTerm,
    fixedCompositionLogK: calciteTerm + dolomiteTerm,
    miscibilityGapComponent2_25C: [Number(documentedGap[0]), Number(documentedGap[1])],
    phaseStabilityStatus,
    activityModelTemperatureStatus,
    insideDocumentedMiscibilityGap: insideDocumentedGap,
    stableEquilibriumClaim: false,
    screenRole: 'metastable_fixed_composition_kinetic_saturation_screen',
    validity: 'nondefective_group_I_metastable_screen; defect density remains kinetic uncertainty; no stable homogeneous-solution claim',
  };
}

// Mucci's seawater overgrowth experiments measured D_Mg =
// (Mg/Ca)_solid/(Mg/Ca)_aqueous at 5, 25, and 40 °C. Interpolate only
// between those anchors inside the measured parent-fluid proxy. Temperatures
// or solution compositions outside the declared domains return unresolved.
function hmcCompositionFromFluid(fluid: any, T_celsius: number): any {
  const T = Number(T_celsius);
  const aqueousCaMolKg = typeof ppmToMolality === 'function'
    ? ppmToMolality(Math.max(0, Number(fluid?.Ca) || 0), 40.078)
    : Math.max(0, Number(fluid?.Ca) || 0) / 40078;
  const aqueousMgMolKg = typeof ppmToMolality === 'function'
    ? ppmToMolality(Math.max(0, Number(fluid?.Mg) || 0), 24.305)
    : Math.max(0, Number(fluid?.Mg) || 0) / 24305;
  const aqueousMgCaMolarRatio = aqueousMgMolKg / Math.max(aqueousCaMolKg, 1e-30);
  const salinityPerMil = Number(fluid?.salinity);
  const standardSeawaterProxy = aqueousMgCaMolarRatio >= 4.5
    && aqueousMgCaMolarRatio <= 6.0
    && Number.isFinite(salinityPerMil)
    && salinityPerMil >= 30
    && salinityPerMil <= 40;
  const standardTemperatureSupported = T >= 5 && T <= 40;
  const highRatioMeasuredRange = aqueousMgCaMolarRatio >= 7.5
    && aqueousMgCaMolarRatio <= 20;
  const highRatioSeawaterMatrix = highRatioMeasuredRange
    && Number.isFinite(salinityPerMil)
    && salinityPerMil >= 30
    && salinityPerMil <= 40;
  const highRatioPlateau25C = highRatioSeawaterMatrix && Math.abs(T - 25) <= 0.25;
  let distributionCoefficient: number | null = null;
  let temperatureStatus = 'unsupported_temperature_or_parent_composition';
  let compositionDomainStatus = 'unsupported_parent_fluid_composition';
  if (standardSeawaterProxy && standardTemperatureSupported) {
    compositionDomainStatus = 'standard_seawater_ratio_salinity_proxy';
    temperatureStatus = 'interpolated_5_to_40C';
    if (T <= 5) {
      distributionCoefficient = 0.0121;
      temperatureStatus = 'measured_5C';
    } else if (T <= 25) {
      distributionCoefficient = 0.0121 + (0.0172 - 0.0121) * ((T - 5) / 20);
      if (T === 25) temperatureStatus = 'measured_25C';
    } else {
      distributionCoefficient = 0.0172 + (0.0271 - 0.0172) * ((T - 25) / 15);
      if (T === 40) temperatureStatus = 'measured_40C';
    }
  } else if (standardSeawaterProxy) {
    compositionDomainStatus = 'standard_seawater_proxy_temperature_outside_5_to_40C';
  } else if (highRatioPlateau25C) {
    distributionCoefficient = 0.0123;
    temperatureStatus = 'measured_25C_high_MgCa_plateau';
    compositionDomainStatus = 'high_MgCa_plateau_Mucci_Morse_1983';
  } else if (aqueousMgCaMolarRatio > 20) {
    compositionDomainStatus = 'MgCa_above_measured_20_unresolved';
  } else if (highRatioMeasuredRange && !highRatioSeawaterMatrix) {
    compositionDomainStatus = 'high_MgCa_nonseawater_solution_matrix_unresolved';
  } else if (highRatioMeasuredRange) {
    compositionDomainStatus = 'high_MgCa_plateau_temperature_unmeasured';
  } else if (aqueousMgCaMolarRatio < 4.5) {
    compositionDomainStatus = 'low_MgCa_composition_dependent_DMg_unresolved';
  } else if (aqueousMgCaMolarRatio > 6.0 && aqueousMgCaMolarRatio < 7.5) {
    compositionDomainStatus = 'transition_between_seawater_series_and_high_ratio_plateau_unresolved';
  } else {
    compositionDomainStatus = 'standard_ratio_but_nonseawater_salinity_unresolved';
  }
  const compositionDomainSupported = distributionCoefficient != null;
  if (!compositionDomainSupported) {
    return {
      model: 'mucci_1987_and_mucci_morse_1983_bounded_partition_v3',
      mgMoleFraction: null,
      unconstrainedMgMoleFraction: null,
      aqueousMgCaMolarRatio,
      aqueousCaMolKg,
      aqueousMgMolKg,
      salinityPerMil,
      distributionCoefficient: null,
      temperatureStatus,
      compositionDomainStatus,
      compositionDomainSupported: false,
      clampedAtPromotedHMCMaximum: false,
      validHMCComposition: null,
      uncertainty: 'No HMC composition or absence verdict: D_Mg depends on unresolved parent-fluid composition in this domain.',
    };
  }
  const solidMgCaRatio = distributionCoefficient * aqueousMgCaMolarRatio;
  const unconstrainedMgMoleFraction = solidMgCaRatio / (1 + solidMgCaRatio);
  const mgMoleFraction = unconstrainedMgMoleFraction;
  return {
    model: 'mucci_1987_and_mucci_morse_1983_bounded_partition_v3',
    mgMoleFraction,
    unconstrainedMgMoleFraction,
    aqueousMgCaMolarRatio,
    aqueousCaMolKg,
    aqueousMgMolKg,
    salinityPerMil,
    distributionCoefficient,
    temperatureStatus,
    compositionDomainStatus,
    compositionDomainSupported: true,
    clampedAtPromotedHMCMaximum: false,
    validHMCComposition: mgMoleFraction >= 0.04 && mgMoleFraction <= 0.30,
    uncertainty: 'transport and defect population remain unresolved; low-ratio parent fluids are excluded rather than extrapolated',
  };
}

// Get log10(Ksp) at temperature T (°C). For HMC, pass mg_content (mole
// fraction Mg, 0-0.30) as third arg; for non-HMC it's ignored.
//
// Returns NaN only if the mineral is missing AND no fallback applies.
// In practice, calcite/aragonite/dolomite/siderite always return a
// real number even before the fetch lands (fallback covers them).
function getCarbonateLogKsp(mineralId: string, T_celsius: number, mg_content: number = 0): number {
  if (mineralId === 'HMC') {
    return hmcSolidSolutionAssessment(mg_content, T_celsius).stoichiometricLogKsp;
  }
  const entry = getCarbonateData(mineralId);
  if (!entry || !entry.thermodynamics) return NaN;
  const thermo = entry.thermodynamics;

  // Compute logKsp_25C for pure/stoichiometric phases.
  let logKsp_25C: number;
  if (typeof thermo.logKsp_25C === 'number') {
    logKsp_25C = thermo.logKsp_25C;
  } else {
    return NaN;
  }

  const fit = thermo.logKsp_fit;

  // T-correction via the PHREEQC analytic expression (v194 — the
  // preferred form). The analytic gives the full logKsp(T) curve
  // directly (the logKsp_25C base computed above is the sanity anchor,
  // not used in the curve). HMC never reaches here — its logKsp_25C is
  // the mg_content-linear string, and it carries no 'analytic' fit, so
  // it falls through to its existing (T-flat) behavior in its valid
  // 0-60°C window where analytic≈van't Hoff anyway.
  if (fit && fit.form === 'analytic' && Array.isArray(fit.analytic) && fit.analytic.length >= 4) {
    return _carbonateAnalyticLogK(fit.analytic, T_celsius);
  }

  // T-correction via van't Hoff (the fallback where wateq4f gives no
  // analytic line). Clamp T to the shared [0,250] domain so the seam
  // with the analytic minerals + the pK side stays closed at the edges.
  if (fit && fit.form === 'vanthoff' && typeof fit.deltaH_diss_kJ_mol === 'number') {
    const Tc = Math.max(_THERMO_T_CLAMP_C[0], Math.min(_THERMO_T_CLAMP_C[1], T_celsius));
    const T_K = Tc + 273.15;
    if (T_K <= 0) return logKsp_25C;
    const exponent = -(fit.deltaH_diss_kJ_mol / (_THERMO_LN10 * _THERMO_GAS_CONSTANT_kJ_mol_K)) * (1 / T_K - 1 / _THERMO_T_REF_K);
    return logKsp_25C + exponent;
  }
  // No T-dependence specified — return 25°C value.
  return logKsp_25C;
}

// Convenience: Ksp itself (= 10^logKsp). Watch out for very small
// values (azurite at 10^-45) underflowing in float64 — call sites
// should prefer logKsp arithmetic.
function getCarbonateKsp(mineralId: string, T_celsius: number, mg_content: number = 0): number {
  const log = getCarbonateLogKsp(mineralId, T_celsius, mg_content);
  if (!isFinite(log)) return NaN;
  return Math.pow(10, log);
}

function listCarbonatesAtTier(tier: ThermoTier, axis: 'thermo' | 'kinetic' = 'thermo'): string[] {
  const out: string[] = [];
  for (const id in THERMO_CARBONATES) {
    if (id.startsWith('_')) continue;
    const t = axis === 'thermo' ? getCarbonateThermoTier(id) : getCarbonateKineticTier(id);
    if (t === tier) out.push(id);
  }
  return out.sort();
}

// Coverage report — for tools/thermo-coverage-check.mjs and library UI.
// Returns counts per tier across both axes. Empty entries (sources: [],
// confidence_tier: 'D') count toward the D bucket.
function carbonateThermoCoverage(): {
  thermo: Record<string, number>,
  kinetic: Record<string, number>,
  total: number,
} {
  const thermo: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, conflict: 0, unknown: 0 };
  const kinetic: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, conflict: 0, unknown: 0 };
  let total = 0;
  for (const id in THERMO_CARBONATES) {
    if (id.startsWith('_')) continue;
    total++;
    const tT = getCarbonateThermoTier(id);
    const tK = getCarbonateKineticTier(id);
    thermo[tT] = (thermo[tT] || 0) + 1;
    kinetic[tK] = (kinetic[tK] || 0) + 1;
  }
  return { thermo, kinetic, total };
}
