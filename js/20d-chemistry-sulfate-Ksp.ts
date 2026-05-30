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
//   - getSulfateThermoTier(mineralId)         → 'A' | 'B' | 'C' | 'D' | 'conflict' | 'unknown'
//   - listSulfatesAtTier(tier)                → array of mineralIds
//   - sulfatesReady(cb)                       → notify when fetch completes
//   - sulfateThermoCoverage()                 → tier counts (for thermo-coverage-check)
//
// T-dependence uses the same van't Hoff form as 20c:
//   logKsp(T) = logKsp_25C − (ΔH_diss/(2.303·R))·(1/T_K − 1/298.15)
// where R = 8.31446e-3 kJ/(mol·K). Sign convention matches 20c —
// ΔH_diss positive = endothermic dissolution (K rises with T;
// barite!), negative = retrograde (anhydrite, celestine, gypsum).
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
    logKsp_fit?: { form?: string, deltaH_diss_kJ_mol?: number, _notes_fit?: string },
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
      logKsp_fit: { form: 'vanthoff', deltaH_diss_kJ_mol: -0.456 },
      confidence_tier: 'A',
    },
  },
  anhydrite: {
    formula: 'CaSO4',
    thermodynamics: {
      logKsp_25C: -4.36,
      logKsp_fit: { form: 'vanthoff', deltaH_diss_kJ_mol: -7.155 },
      confidence_tier: 'A',
    },
  },
  barite: {
    formula: 'BaSO4',
    thermodynamics: {
      logKsp_25C: -9.97,
      logKsp_fit: { form: 'vanthoff', deltaH_diss_kJ_mol: 26.57 },
      confidence_tier: 'A',
    },
  },
  celestine: {
    formula: 'SrSO4',
    thermodynamics: {
      logKsp_25C: -6.63,
      logKsp_fit: { form: 'vanthoff', deltaH_diss_kJ_mol: -4.339 },
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

// log10(Ksp) at temperature T (°C). Returns NaN if mineral missing or
// thermodynamics not parseable. In practice the four canonical sulfates
// (selenite/anhydrite/barite/celestine) always return a real number
// even pre-fetch (fallback covers them).
function getSulfateLogKsp(mineralId: string, T_celsius: number): number {
  const entry = getSulfateData(mineralId);
  if (!entry || !entry.thermodynamics) return NaN;
  const thermo = entry.thermodynamics;
  if (typeof thermo.logKsp_25C !== 'number') return NaN;
  const logKsp_25C = thermo.logKsp_25C;

  // T-correction via van't Hoff. Same form + sign convention as 20c.
  const fit = thermo.logKsp_fit;
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
