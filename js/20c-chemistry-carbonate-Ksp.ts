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
// HMC is special: its logKsp_25C is mg_content-dependent, not a
// constant. Callers pass mg_content as a second argument; the formula
// `logKsp(x) = logKsp_at_x0 + delta_logKsp_per_mol_pct_Mg · x · 100`
// applies before T-correction.

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
// get sensible numbers for the four carbonate minerals load-bearing on
// the existing scenarios. Values match the JSON; the fallback exists
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

// Get log10(Ksp) at temperature T (°C). For HMC, pass mg_content (mole
// fraction Mg, 0-0.30) as third arg; for non-HMC it's ignored.
//
// Returns NaN only if the mineral is missing AND no fallback applies.
// In practice, calcite/aragonite/dolomite/siderite always return a
// real number even before the fetch lands (fallback covers them).
function getCarbonateLogKsp(mineralId: string, T_celsius: number, mg_content: number = 0): number {
  const entry = getCarbonateData(mineralId);
  if (!entry || !entry.thermodynamics) return NaN;
  const thermo = entry.thermodynamics;

  // Compute logKsp_25C (handles HMC's mg_content-dependent form)
  let logKsp_25C: number;
  if (typeof thermo.logKsp_25C === 'number') {
    logKsp_25C = thermo.logKsp_25C;
  } else if (thermo.logKsp_25C === 'function_of_mg_content' && thermo.logKsp_fit) {
    const fit = thermo.logKsp_fit;
    if (fit.form === 'mg_content_linear' && typeof fit.logKsp_at_x0 === 'number' && typeof fit.delta_logKsp_per_mol_pct_Mg === 'number') {
      const x = Math.max(0, Math.min(0.30, mg_content));
      logKsp_25C = fit.logKsp_at_x0 + fit.delta_logKsp_per_mol_pct_Mg * x * 100;
    } else {
      return NaN;
    }
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
