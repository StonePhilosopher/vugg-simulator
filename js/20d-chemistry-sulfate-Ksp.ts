// ============================================================
// js/20d-chemistry-sulfate-Ksp.ts — Ksp(T) lookups for sulfates
// ============================================================
// 2026-05-30 strip-survey follow-up. Mirror of 20c (the carbonate Ksp
// engine) for the SULFATE family: gypsum (engine name 'selenite'),
// anhydrite, barite, celestine. Phase 1 / observer-only — the
// existing 40-supersat-sulfate.ts σ-driver functions remain the
// nucleation gates; this module exists so the strip's sulfate SI
// chips can read true log Ω (IAP/Ksp) instead of the capped σ.
//
// Exposes:
//   - getSulfateLogKsp(mineralId, T_celsius)  → log10(Ksp) at T
//   - getSulfateKsp(mineralId, T_celsius)     → Ksp itself
//   - getSulfateData(mineralId)               → full record (audit / UI)
//   - sulfateThermoTemperatureAssessment(...) → explicit fit-domain receipt
//   - getSulfateThermoTier(mineralId)         → 'A' | 'B' | 'C' | 'D' | 'conflict' | 'unknown'
//   - listSulfatesAtTier(tier)                → array of mineralIds
//   - sulfatesReady(cb)                       → notify when fetch completes
//   - sulfateThermoCoverage()                 → tier counts (for thermo-coverage-check)
//
// T-dependence uses PHREEQC's cited five-coefficient analytical form:
//   logKsp(T) = A1 + A2·TK + A3/TK + A4·log10(TK) + A5/TK²
// The constant-ΔH van't Hoff form is retained only as an explicit fallback
// for future entries that do not publish analytical coefficients.  The four
// production/observer sulfate records below all carry the exact wateq4f.dat
// coefficients, because the approximation is not valid over the simulator's
// hydrothermal temperature range.
//
// All four canonical values verified 2026-05-30 against the publicly
// distributed PHREEQC wateq4f.dat (USGS, github.com/usgs-coupled/
// phreeqc3). Notable: BARITE is endothermic (+26.6 kJ/mol) — my
// initial memory was wrong (caught by the verification step).

// Use sulfate-prefixed constants to avoid redeclaring the carbonate
// module's identifiers in the shared bundle scope.
const _SULFATE_GAS_CONSTANT_kJ_mol_K = 8.31446e-3;
const _SULFATE_T_REF_K = 298.15;
const _SULFATE_LN10 = Math.LN10;

type SulfateThermoTier = 'A' | 'B' | 'C' | 'D' | 'conflict' | 'unknown';

type ThermoSulfateEntry = {
  formula: string,
  thermodynamics: {
    logKsp_25C?: number,
    logKsp_fit?: {
      form?: string,
      analytic?: [number, number, number, number, number],
      deltaH_diss_kJ_mol?: number,
      _notes_fit?: string,
    },
    valid_T_range_C?: [number, number],
    sources?: string[],
    databases_agree?: string[],
    confidence_tier?: SulfateThermoTier,
    notes?: string,
  },
  metastability?: any,
  habit_polymorph_notes?: string,
};

type ThermoSulfatesDoc = {
  _meta?: any,
  [mineralId: string]: ThermoSulfateEntry | any,
};

// Fallback so callers that ask before the JSON fetch lands still get a
// sensible Ksp. Values match the JSON; documented sources are in the
// JSON file's _meta._sourcing_note.
const THERMO_SULFATES_FALLBACK: ThermoSulfatesDoc = {
  selenite: {
    formula: 'CaSO4·2H2O',
    thermodynamics: {
      logKsp_25C: -4.58,
      logKsp_fit: { form: 'analytic', analytic: [68.2401, 0, -3221.51, -25.0627, 0], deltaH_diss_kJ_mol: -0.456 },
      valid_T_range_C: [0, 60],
      confidence_tier: 'A',
    },
  },
  anhydrite: {
    formula: 'CaSO4',
    thermodynamics: {
      logKsp_25C: -4.36,
      logKsp_fit: { form: 'analytic', analytic: [197.52, 0, -8669.8, -69.835, 0], deltaH_diss_kJ_mol: -7.155 },
      valid_T_range_C: [0, 300],
      confidence_tier: 'A',
    },
  },
  barite: {
    formula: 'BaSO4',
    thermodynamics: {
      logKsp_25C: -9.97,
      logKsp_fit: { form: 'analytic', analytic: [136.035, 0, -7680.41, -48.595, 0], deltaH_diss_kJ_mol: 26.57 },
      valid_T_range_C: [0, 300],
      confidence_tier: 'A',
    },
  },
  celestine: {
    formula: 'SrSO4',
    thermodynamics: {
      logKsp_25C: -6.63,
      logKsp_fit: { form: 'analytic', analytic: [-14805.9622, -2.4660924, 756968.533, 5436.3588, -40553604], deltaH_diss_kJ_mol: -4.339 },
      valid_T_range_C: [0, 200],
      confidence_tier: 'A',
    },
  },
};

let THERMO_SULFATES: ThermoSulfatesDoc = THERMO_SULFATES_FALLBACK;
let THERMO_SULFATES_READY = false;
const _sulfateListeners: Array<(doc: ThermoSulfatesDoc) => void> = [];

function sulfatesReady(cb: (doc: ThermoSulfatesDoc) => void) {
  if (THERMO_SULFATES_READY) cb(THERMO_SULFATES);
  else _sulfateListeners.push(cb);
}

// Same multi-path fetch pattern as 20c / 00-mineral-spec.
async function _loadThermoSulfates(paths: string[]): Promise<{ doc: ThermoSulfatesDoc, path: string }> {
  for (const p of paths) {
    try {
      const r = await fetch(p, { cache: 'no-store' });
      if (r.ok) return { doc: await r.json(), path: p };
    } catch (e) { /* try next */ }
  }
  throw new Error('all thermo-sulfates paths failed');
}

_loadThermoSulfates([
  './data/thermo-sulfates.json',
  '../data/thermo-sulfates.json',
  '/data/thermo-sulfates.json',
])
  .then(({ doc, path }) => {
    THERMO_SULFATES = doc;
    THERMO_SULFATES_READY = true;
    const n = Object.keys(doc).filter(k => !k.startsWith('_')).length;
    console.info(`[thermo] loaded ${n} sulfate entries from ${path}`);
    _sulfateListeners.splice(0).forEach(cb => { try { cb(THERMO_SULFATES); } catch (e) { console.error(e); } });
  })
  .catch(err => {
    console.warn('[thermo] sulfate fetch failed; using fallback', err);
    THERMO_SULFATES_READY = true;
    _sulfateListeners.splice(0).forEach(cb => { try { cb(THERMO_SULFATES); } catch (e) { console.error(e); } });
  });

// ---- Lookup helpers ---------------------------------------------------

function getSulfateData(mineralId: string): ThermoSulfateEntry | null {
  const entry = THERMO_SULFATES[mineralId];
  if (!entry || typeof entry !== 'object' || mineralId.startsWith('_')) return null;
  return entry as ThermoSulfateEntry;
}

function getSulfateThermoTier(mineralId: string): SulfateThermoTier {
  const entry = getSulfateData(mineralId);
  if (!entry || !entry.thermodynamics) return 'unknown';
  return (entry.thermodynamics.confidence_tier as SulfateThermoTier) || 'unknown';
}

type SulfateThermoTemperatureAssessment = {
  mineral: string;
  temperatureC: number;
  validTemperatureC: readonly [number, number] | null;
  supported: boolean;
  status: 'inside-fit-envelope' | 'outside-fit-envelope' | 'invalid-input' | 'missing-thermodynamics';
  note: string;
};

function sulfateThermoTemperatureAssessment(
  mineralId: string,
  T_celsius: number,
): SulfateThermoTemperatureAssessment {
  const mineral = mineralId === 'gypsum' ? 'selenite' : mineralId;
  const temperatureC = Number(T_celsius);
  const entry = getSulfateData(mineral);
  const range = entry?.thermodynamics?.valid_T_range_C || null;
  if (!entry || !entry.thermodynamics || !range) {
    return {
      mineral, temperatureC, validTemperatureC: null, supported: false,
      status: 'missing-thermodynamics',
      note: 'No declared sulfate thermodynamic temperature envelope is available.',
    };
  }
  if (!Number.isFinite(temperatureC)) {
    return {
      mineral, temperatureC, validTemperatureC: range, supported: false,
      status: 'invalid-input', note: 'Temperature must be finite.',
    };
  }
  const inside = temperatureC >= range[0] && temperatureC <= range[1];
  return {
    mineral, temperatureC, validTemperatureC: range, supported: inside,
    status: inside ? 'inside-fit-envelope' : 'outside-fit-envelope',
    note: inside
      ? `Temperature lies inside the declared ${range[0]}-${range[1]} C sulfate K(T) envelope.`
      : `Temperature lies outside the declared ${range[0]}-${range[1]} C sulfate K(T) envelope; SI and phase admission fail closed rather than extrapolating the analytical expression.`,
  };
}

// log10(Ksp) at temperature T (°C). Returns NaN if mineral missing or
// thermodynamics not parseable. In practice the four canonical sulfates
// (selenite/anhydrite/barite/celestine) always return a real number
// even pre-fetch (fallback covers them).
function getSulfateLogKsp(mineralId: string, T_celsius: number): number {
  const mineral = mineralId === 'gypsum' ? 'selenite' : mineralId;
  const validity = sulfateThermoTemperatureAssessment(mineral, T_celsius);
  if (!validity.supported) return NaN;
  const entry = getSulfateData(mineral);
  if (!entry || !entry.thermodynamics) return NaN;
  const thermo = entry.thermodynamics;
  if (typeof thermo.logKsp_25C !== 'number') return NaN;
  const logKsp_25C = thermo.logKsp_25C;

  // Exact PHREEQC analytical expression.  Do not replace this with a
  // constant-ΔH approximation: anhydrite and celestine curvature is large
  // enough to reverse archived saturation classifications at high T.
  const fit = thermo.logKsp_fit;
  if (fit && fit.form === 'analytic' && Array.isArray(fit.analytic) && fit.analytic.length === 5) {
    const T_K = T_celsius + 273.15;
    if (!(T_K > 0) || !fit.analytic.every(Number.isFinite)) return NaN;
    const [A1, A2, A3, A4, A5] = fit.analytic;
    return A1 + A2 * T_K + A3 / T_K + A4 * Math.log10(T_K) + A5 / (T_K * T_K);
  }

  // Explicit fallback for a future entry that has no analytical fit.
  if (fit && fit.form === 'vanthoff' && typeof fit.deltaH_diss_kJ_mol === 'number') {
    const T_K = T_celsius + 273.15;
    if (T_K <= 0) return logKsp_25C;
    const exponent =
      -(fit.deltaH_diss_kJ_mol / (_SULFATE_LN10 * _SULFATE_GAS_CONSTANT_kJ_mol_K)) *
      (1 / T_K - 1 / _SULFATE_T_REF_K);
    return logKsp_25C + exponent;
  }
  return logKsp_25C;
}

// Convenience: Ksp itself. Note barite's Ksp is ~10^-10 at 25°C; that's
// fine in float64 (no underflow risk like azurite at 10^-45).
function getSulfateKsp(mineralId: string, T_celsius: number): number {
  const log = getSulfateLogKsp(mineralId, T_celsius);
  if (!isFinite(log)) return NaN;
  return Math.pow(10, log);
}

function listSulfatesAtTier(tier: SulfateThermoTier): string[] {
  const out: string[] = [];
  for (const id in THERMO_SULFATES) {
    if (id.startsWith('_')) continue;
    if (getSulfateThermoTier(id) === tier) out.push(id);
  }
  return out.sort();
}

// Tier-count coverage report; mirrors carbonateThermoCoverage but
// without the kinetic axis (no sulfate kinetic engine planned).
function sulfateThermoCoverage(): { thermo: Record<string, number>, total: number } {
  const thermo: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, conflict: 0, unknown: 0 };
  let total = 0;
  for (const id in THERMO_SULFATES) {
    if (id.startsWith('_')) continue;
    total++;
    const t = getSulfateThermoTier(id);
    thermo[t] = (thermo[t] || 0) + 1;
  }
  return { thermo, total };
}
