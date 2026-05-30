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
// T-dependence uses van't Hoff:
//   logKsp(T) = logKsp_25C - (deltaH_diss / (2.303·R))·(1/T_K - 1/298.15)
// where R = 8.31446e-3 kJ/(mol·K). Exact within ~0.1 log units across
// 0-100°C for most carbonates. Falls back to the 25°C value if data
// for the mineral is missing — never throws, always returns a number,
// so consumers don't have to defensive-code around incomplete data.
//
// HMC is special: its logKsp_25C is mg_content-dependent, not a
// constant. Callers pass mg_content as a second argument; the formula
// `logKsp(x) = logKsp_at_x0 + delta_logKsp_per_mol_pct_Mg · x · 100`
// applies before T-correction.

const _THERMO_GAS_CONSTANT_kJ_mol_K = 8.31446e-3;  // R
const _THERMO_T_REF_K = 298.15;                     // 25°C reference
const _THERMO_LN10 = Math.LN10;                     // for 2.303 conversion

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
      logKsp_fit: { form: 'vanthoff', deltaH_diss_kJ_mol: -10.5 },
      confidence_tier: 'A',
    },
  },
  aragonite: {
    formula: 'CaCO3',
    thermodynamics: {
      logKsp_25C: -8.336,
      logKsp_fit: { form: 'vanthoff', deltaH_diss_kJ_mol: -10.0 },
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

  // T-correction via van't Hoff
  const fit = thermo.logKsp_fit;
  if (fit && fit.form === 'vanthoff' && typeof fit.deltaH_diss_kJ_mol === 'number') {
    const T_K = T_celsius + 273.15;
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
