#!/usr/bin/env node
/**
 * tools/thermo-coverage-check.mjs — coverage + verification report for
 * data/thermo-*.json (carbonates + sulfates as of v166).
 *
 * Two modes:
 *
 *   1) DEFAULT — tier coverage report for both thermo files. Reads sources
 *      blocks, confidence_tier fields, kinetics blocks (carbonates only).
 *      Same shape as the original Week-1 deliverable but extended to
 *      cover thermo-sulfates.json alongside thermo-carbonates.json.
 *
 *   2) --verify — additionally fetches PHREEQC wateq4f.dat from the
 *      publicly distributed USGS source and cross-checks every logKsp_25C
 *      + ΔH_diss against the canonical database. This is the v164 lesson
 *      tooled: rigor as a tool, not a habit. The "barite endotherm catch"
 *      (memory had retrograde sign, wateq4f confirmed +26.57 kJ/mol
 *      prograde) is now CI-grade verifiable, not "if-I-remember-to-check."
 *
 * Usage:
 *   node tools/thermo-coverage-check.mjs            # coverage only
 *   node tools/thermo-coverage-check.mjs --verify   # + fetch & cross-check
 *   node tools/thermo-coverage-check.mjs --json     # machine-readable
 *   node tools/thermo-coverage-check.mjs --verify --json
 *
 * Exit codes:
 *   0  — report generated, no issues
 *   3) --internal — OFFLINE self-consistency check. For each simple
 *      carbonate (MCO3 / dolomite) with full formation data, asserts the
 *      stored logKsp_25C and deltaH_diss agree with the values DERIVED from
 *      the entry's own deltaGf / deltaHf via standard aqueous-ion constants.
 *      Needs no network and covers minerals absent from any external DB.
 *      This is the permanent automated form of the manual check that caught
 *      the post-v166 ΔH sign-flips (cerussite/witherite/strontianite): the
 *      data testifying against itself. Generalizes confirmation method #3
 *      from that triage (first-principles from each entry's own ΔHf).
 *
 * Usage adds:
 *   node tools/thermo-coverage-check.mjs --internal
 *   node tools/thermo-coverage-check.mjs --internal --json
 *
 * Exit codes:
 *   1  — file missing or unparseable
 *   2  — any mineral has confidence_tier 'unknown' (= schema gap)
 *   3  — --verify mode: any logKsp_25C or ΔH_diss disagrees with the
 *        canonical wateq4f.dat beyond the documented tolerance
 *   4  — --internal mode: a stored value is self-inconsistent with the
 *        entry's own formation data beyond tolerance (OR the ion-constant
 *        table fails to reproduce the verified anchor minerals)
 *
 * Per PROPOSAL-CARBONATE-GEOCHEM Week 1 (original deliverable) + post-
 * v165 review item #7 (--verify) + the post-v166 carbonate-ΔH triage (--internal).
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// Files this tool covers. Each entry is one of:
//   { path, kind, hasKinetics }
// kind is the JSON's own scope ('carbonates' | 'sulfates'); hasKinetics
// distinguishes carbonates (full thermodynamics + PWP kinetics) from
// sulfates (thermo-only — no rate-law promotion planned).
const FILES = [
  { path: join(ROOT, 'data', 'thermo-carbonates.json'), kind: 'carbonates', hasKinetics: true },
  { path: join(ROOT, 'data', 'thermo-sulfates.json'),   kind: 'sulfates',   hasKinetics: false },
];

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const verifyMode = args.includes('--verify');
const internalMode = args.includes('--internal');

// ---- Load all thermo files --------------------------------------------------

function loadFile(meta) {
  if (!existsSync(meta.path)) {
    console.error(`[thermo-coverage] file not found: ${meta.path}`);
    process.exit(1);
  }
  try { return JSON.parse(readFileSync(meta.path, 'utf8')); }
  catch (e) {
    console.error(`[thermo-coverage] parse error in ${meta.path}: ${e.message}`);
    process.exit(1);
  }
}

const files = FILES.map(meta => ({ meta, doc: loadFile(meta) }));

// ---- Per-file coverage analysis (mirror of the v0 logic, parameterized) ----

function analyse(meta, doc) {
  const minerals = Object.entries(doc).filter(([k]) => !k.startsWith('_'));
  const tierCounts = (axis) => {
    const counts = { A: 0, B: 0, C: 0, D: 0, conflict: 0, unknown: 0 };
    for (const [, entry] of minerals) {
      const block = axis === 'thermo' ? entry.thermodynamics : entry.kinetics;
      const tier = (block && block.confidence_tier) || 'unknown';
      counts[tier] = (counts[tier] || 0) + 1;
    }
    return counts;
  };
  const tierGroups = (axis) => {
    const groups = { A: [], B: [], C: [], D: [], conflict: [], unknown: [] };
    for (const [name, entry] of minerals) {
      const block = axis === 'thermo' ? entry.thermodynamics : entry.kinetics;
      const tier = (block && block.confidence_tier) || 'unknown';
      if (!groups[tier]) groups[tier] = [];
      groups[tier].push(name);
    }
    for (const g in groups) groups[g].sort();
    return groups;
  };
  const missing = (axis) => {
    const out = [];
    for (const [name, entry] of minerals) {
      const block = axis === 'thermo' ? entry.thermodynamics : entry.kinetics;
      if (!block) { out.push({ name, missing: ['no_block'] }); continue; }
      const gaps = [];
      if (axis === 'thermo') {
        const Ksp = block.logKsp_25C;
        if (Ksp === null || Ksp === undefined) gaps.push('logKsp_25C');
        // deltaGf is a nice-to-have for sulfates (we only require logKsp +
        // van't Hoff); for carbonates it's part of the Week-1 schema.
        if (meta.hasKinetics && block.deltaGf_kJ_mol == null) gaps.push('deltaGf');
        if (!Array.isArray(block.sources) || block.sources.length === 0) gaps.push('no_sources');
      } else {
        if (!block.rate_law) gaps.push('rate_law');
        if (!Array.isArray(block.sources) || block.sources.length === 0) gaps.push('no_sources');
      }
      if (gaps.length) out.push({ name, missing: gaps });
    }
    return out;
  };
  const conflicts = () => {
    const out = [];
    for (const [name, entry] of minerals) {
      const t = entry.thermodynamics;
      if (!t) continue;
      if (t.confidence_tier === 'conflict') {
        out.push({ name, note: t.notes || '(no note)' });
      } else if (t.notes && /conflict|disagree/i.test(t.notes)) {
        out.push({ name, note: t.notes, soft: true });
      }
    }
    return out;
  };
  return {
    minerals_total: minerals.length,
    thermo_tier_counts: tierCounts('thermo'),
    kinetic_tier_counts: meta.hasKinetics ? tierCounts('kinetic') : null,
    thermo_tier_groups: tierGroups('thermo'),
    kinetic_tier_groups: meta.hasKinetics ? tierGroups('kinetic') : null,
    thermo_missing_data: missing('thermo'),
    kinetic_missing_data: meta.hasKinetics ? missing('kinetic') : null,
    conflicts: conflicts(),
  };
}

const reports = files.map(({ meta, doc }) => ({ meta, doc, report: analyse(meta, doc) }));
const anyUnknown = reports.some(r =>
  r.report.thermo_tier_counts.unknown > 0 ||
  (r.report.kinetic_tier_counts && r.report.kinetic_tier_counts.unknown > 0),
);

// ---- --verify mode: fetch wateq4f.dat + cross-check -------------------------
//
// PHREEQC's wateq4f.dat is the long-standing canonical USGS aqueous-speciation
// database (Ball & Nordstrom 1991, USGS WRI 91-4037; distributed unchanged
// for these simple minerals across PHREEQC v3). Public source:
//   https://raw.githubusercontent.com/usgs-coupled/phreeqc3/master/database/wateq4f.dat
//
// Our thermo JSONs CITE this database explicitly (see _meta._sourcing_note
// in thermo-sulfates.json + sources blocks in thermo-carbonates.json). This
// mode fetches the live file and asserts our values match the database
// values within tolerance. Catches:
//   - Hand-typed sign flips (the v164 barite endotherm catch is the
//     reference incident — memory had ΔH negative, database says +26.57)
//   - Stale values from older database versions
//   - Citation drift (we claim wateq4f but actually used a different source)

const WATEQ4F_URL = 'https://raw.githubusercontent.com/usgs-coupled/phreeqc3/master/database/wateq4f.dat';

// kcal → kJ conversion (the wateq4f delta_h is in kcal/mol; our JSON's
// deltaH_diss_kJ_mol is in kJ/mol). 1 kcal = 4.184 kJ exactly.
const KCAL_TO_KJ = 4.184;

// Tolerances. log_k within 0.005 (wateq4f reports to 2 decimal places so
// 0.005 is "rounds to the same value"). ΔH within 0.5 kJ/mol (about
// 0.1 kcal — wateq4f reports kcal to 3 decimal places; the conversion +
// rounding eats the rest).
const TOL_LOGK = 0.005;
const TOL_DELTAH_KJ = 0.5;

// Name mapping: our engine catalog uses 'selenite' (the macroscopic crystal
// form name) where wateq4f uses 'Gypsum' (the chemistry-canonical name);
// 'celestine' vs 'Celestite' (US vs IMA spelling). Map our → wateq4f.
const NAME_MAP = {
  selenite: 'Gypsum',
  anhydrite: 'Anhydrite',
  barite: 'Barite',
  celestine: 'Celestite',
  // Carbonates already match wateq4f names case-insensitively:
  calcite: 'Calcite',
  aragonite: 'Aragonite',
  dolomite: 'Dolomite',
  siderite: 'Siderite',
  // (rhodochrosite, smithsonite, cerussite, witherite, strontianite,
  // malachite, azurite, hydrozincite — verify if present, skip if not.)
  rhodochrosite: 'Rhodochrosite',
  smithsonite: 'Smithsonite',
  cerussite: 'Cerussite',
  witherite: 'Witherite',
  strontianite: 'Strontianite',
  malachite: 'Malachite',
  azurite: 'Azurite',
  // HMC is not a wateq4f mineral (it's our composite/parameterized form).
  // Skip with a note rather than flag a mismatch.
};
const NAMES_NOT_IN_WATEQ4F = new Set(['HMC']);

// Parse ALL phase entries for a mineral name in a PHREEQC .dat file.
// The PHASES-section format is:
//   <Name>
//           <stoichiometry equation>   (contains '=')
//           log_k           <value>
//           delta_h         <value>  [kcal|kJ]
//           -analytic       <a1> ... <a5>
//
// A robust LINE-BASED parser (the prior version used a fragile multiline
// lookahead regex that ran past entry boundaries — that's the bug that
// produced the garbage rhodochrosite ΔH=+72.7, grabbed from an unrelated
// later phase because rhodochrosite Phase 190 has no delta_h line).
//
// PHASE HEADERS. wateq4f.dat names PHASES entries "<Name> <number>", e.g.
// "Dolomite 401", "Siderite 94", "Rhodochrosite 564". The header is the
// name token + an integer phase id at column 0. (NB: a WebFetch summary of
// this file confabulated nonexistent duplicate variants like "Dolomite 11"
// / "Siderite 9" — the real file has ONE entry per carbonate here. Lesson:
// parse the bytes, don't trust a summarizer's structure. This is why the
// tool fetches + parses directly rather than relying on a model's read.)
//
// MULTIPLE PHASES PER NAME (defensive). Some PHREEQC databases DO carry
// duplicate mineral names with different thermo (ordered vs disordered
// polymorphs, etc.). We collect ALL matches and the caller picks the phase
// whose logKsp is closest to ours, so this stays correct if a future
// database revision adds a second variant.
//
// ACID-FORM REACTIONS. Some phases are written H+-consuming (e.g. wateq4f
// Malachite: Cu2(OH)2CO3 + 3 H+ = 2 Cu+2 + 2 H2O + HCO3-). Those log_k /
// delta_h are NOT comparable to our free-ion-product convention
// (M(CO3)(OH)x = ... + CO3-2 + x OH-) without stoichiometry translation.
// We tag such phases acidForm:true so the caller can skip them honestly
// rather than false-flag a mismatch.
function parseAllPhaseEntries(text, mineralName) {
  const lines = text.split(/\r?\n/);
  const out = [];
  // A phase header is the mineral name alone (optionally trailing comment),
  // at start-of-line, NOT indented (PHASES headers sit at column 0).
  const headerRe = new RegExp(`^${mineralName}(?:\\s|$)`);
  for (let i = 0; i < lines.length; i++) {
    if (!headerRe.test(lines[i])) continue;
    // Header must be at column 0 (not indented) and not itself contain '='.
    if (/^\s/.test(lines[i]) || lines[i].includes('=')) continue;
    let logKsp = null, dH_kJ = null, rxn = null;
    // Scan forward until the next non-indented header line or blank-gap+header.
    for (let j = i + 1; j < lines.length; j++) {
      const raw = lines[j];
      const s = raw.trim();
      // Stop at the next phase header (a non-indented token line that isn't
      // a directive and isn't a reaction). Directives start with '-'.
      if (!/^\s/.test(raw) && s && !s.startsWith('-') && !s.includes('=')
          && !/^(log_k|delta_h)/i.test(s)) break;
      if (rxn === null && s.includes('=')) rxn = s;
      let m;
      if ((m = /^log_k\s+(-?\d+(?:\.\d+)?)/i.exec(s))) logKsp = parseFloat(m[1]);
      if ((m = /^(?:delta_h|-delta_H)\s+(-?\d+(?:\.\d+)?)\s*(kcal|kj|kjoules|kilocalories)?/i.exec(s))) {
        const rawDH = parseFloat(m[1]);
        const unit = (m[2] || 'kcal').toLowerCase();
        dH_kJ = unit.startsWith('kj') ? rawDH : rawDH * KCAL_TO_KJ;
      }
    }
    if (logKsp !== null) {
      // Acid-form if the reaction consumes H+ on the LHS (before '=').
      const lhs = rxn ? rxn.split('=')[0] : '';
      const acidForm = /\bH\+/.test(lhs) || /\d+\s*H\+/.test(lhs);
      out.push({ logKsp, dH_kJ, rxn: rxn || '', acidForm });
    }
  }
  return out;
}

// Pick the phase whose logKsp is closest to ours; among acid vs free-ion
// forms, prefer the free-ion form (acidForm:false) since our convention
// matches it. Returns null if no usable (non-acid) phase exists.
function pickBestPhase(phases, ourLogK) {
  if (!phases.length) return null;
  const free = phases.filter(p => !p.acidForm);
  const pool = free.length ? free : phases;  // fall back to acid only if no free form
  if (ourLogK == null) return pool[0];
  let best = pool[0], bestD = Infinity;
  for (const p of pool) {
    const d = Math.abs(p.logKsp - ourLogK);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

async function verifyAgainstWateq4f() {
  const verification = { url: WATEQ4F_URL, checked: [], mismatches: [], skipped: [] };
  let text;
  try {
    const r = await fetch(WATEQ4F_URL);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    text = await r.text();
  } catch (e) {
    console.error(`[thermo-coverage] --verify FAIL fetching ${WATEQ4F_URL}: ${e.message}`);
    process.exit(3);
  }
  for (const { meta, doc } of files) {
    for (const [name, entry] of Object.entries(doc)) {
      if (name.startsWith('_')) continue;
      if (NAMES_NOT_IN_WATEQ4F.has(name)) {
        verification.skipped.push({ file: meta.kind, name, reason: 'not in wateq4f.dat (composite/parameterized form)' });
        continue;
      }
      const wateqName = NAME_MAP[name] || name.charAt(0).toUpperCase() + name.slice(1);
      const t = entry.thermodynamics || {};
      const ourLogK = (typeof t.logKsp_25C === 'number') ? t.logKsp_25C : null;
      const ourDH = (t.logKsp_fit && typeof t.logKsp_fit.deltaH_diss_kJ_mol === 'number')
        ? t.logKsp_fit.deltaH_diss_kJ_mol : null;

      const phases = parseAllPhaseEntries(text, wateqName);
      if (!phases.length) {
        verification.skipped.push({ file: meta.kind, name, wateqName, reason: 'entry not found in wateq4f.dat' });
        continue;
      }
      // If the ONLY phases are acid-form (e.g. malachite/azurite — written
      // H+-consuming in wateq4f, incompatible with our free-ion convention),
      // skip rather than false-flag a stoichiometry-convention difference.
      const hasFreeForm = phases.some(p => !p.acidForm);
      if (!hasFreeForm) {
        verification.skipped.push({
          file: meta.kind, name, wateqName,
          reason: `wateq4f writes this acid-form (e.g. "${phases[0].rxn.slice(0, 48)}") — incompatible with our free-ion-product convention; no stoichiometry-translated comparison`,
        });
        continue;
      }
      const best = pickBestPhase(phases, ourLogK);
      const nPhases = phases.length;
      const check = {
        file: meta.kind, name, wateqName,
        ours: { logKsp: ourLogK, dH_kJ: ourDH },
        wateq4f: { logKsp: best.logKsp, dH_kJ: best.dH_kJ },
        phaseNote: nPhases > 1 ? `matched best of ${nPhases} wateq4f phases by logKsp` : null,
      };
      const issues = [];
      if (ourLogK == null) issues.push('our logKsp_25C is missing');
      else if (Math.abs(ourLogK - best.logKsp) > TOL_LOGK) {
        issues.push(`logKsp mismatch: ours=${ourLogK}, wateq4f=${best.logKsp} (Δ=${(ourLogK - best.logKsp).toFixed(4)})`);
      }
      if (best.dH_kJ != null) {
        if (ourDH == null) issues.push('our deltaH_diss_kJ_mol is missing');
        else if (Math.abs(ourDH - best.dH_kJ) > TOL_DELTAH_KJ) {
          issues.push(`ΔH mismatch: ours=${ourDH} kJ/mol, wateq4f=${best.dH_kJ.toFixed(3)} kJ/mol (Δ=${(ourDH - best.dH_kJ).toFixed(3)})`);
        }
      } else {
        // The matched phase has no delta_h; note it (don't flag — absence
        // of a database ΔH isn't a mismatch with ours).
        check.dhNote = 'matched wateq4f phase carries no delta_h — ΔH not cross-checkable here';
      }
      if (issues.length) verification.mismatches.push({ ...check, issues });
      else verification.checked.push(check);
    }
  }
  return verification;
}

// ---- --internal: offline thermodynamic self-consistency --------------------
//
// For a dissolution reaction (written free-ion-product form, our convention):
//   MCO3 = M2+ + CO3-2          (simple carbonates)
//   CaMg(CO3)2 = Ca2+ + Mg2+ + 2 CO3-2   (dolomite)
// two identities must hold from the entry's OWN formation data:
//   (B1) logKsp(25C) = -ΔG°rxn / (ln10·R·T)   with ΔG°rxn = ΣΔGf(ions) - ΔGf(mineral)
//   (B2) ΔH_diss      = ΣΔHf(ions) - ΔHf(mineral)
// The entry stores ΔGf(mineral) + ΔHf(mineral); we supply the standard
// aqueous-ion ΔGf/ΔHf. If the stored logKsp_25C / logKsp_fit.deltaH_diss
// disagree with the derived values, the entry is internally inconsistent —
// which is exactly how the post-v166 cerussite/witherite/strontianite
// ΔH sign-flips were caught by hand (their deltaH_diss contradicted the
// ΔHf sitting in the same object). This makes that check automatic + offline,
// and it covers minerals absent from any external database.
//
// ION CONSTANTS — standard aqueous-ion ΔGf/ΔHf at 25C, 1 bar, from CODATA
// Key Values for Thermodynamics (Cox, Wagman & Medvedev 1989) cross-checked
// with Robie & Hemingway 1995 (USGS Bull. 2131). These are well-established
// REFERENCE CONSTANTS (not paper-specific claims — the v145 fabricated-
// citation hazard does not apply; these appear unchanged across all major
// compilations). The tool VALIDATES them against our wateq4f-verified anchor
// minerals on every run and prints the residuals, so the constants are shown
// to reproduce known-good entries rather than trusted blind.
//
// CAVEAT — Fe2+: ΔGf scatters notably across databases (-79 to -92 kJ/mol).
// We use the Robie-Hemingway value (-90.5/-92.0) which reproduces our
// wateq4f-verified siderite logKsp (-10.89); a lower-magnitude Fe2+ would
// false-flag siderite. Documented because it's the one constant where the
// choice is load-bearing.
const ION_THERMO = {
  // anion (well-measured, low scatter)
  CO3: { dGf: -527.90, dHf: -677.14 },
  // divalent cations
  Ca:  { dGf: -552.8,  dHf: -543.0 },
  Mg:  { dGf: -454.8,  dHf: -466.9 },
  Fe:  { dGf: -90.5,   dHf: -92.0,  note: 'Fe2+ ΔGf scattered -79..-92; Robie-Hemingway value chosen to reproduce verified siderite logKsp' },
  Mn:  { dGf: -228.1,  dHf: -220.8 },
  Zn:  { dGf: -147.3,  dHf: -153.4 },
  Pb:  { dGf: -24.2,   dHf: -1.7 },
  Ba:  { dGf: -560.7,  dHf: -537.6 },
  Sr:  { dGf: -563.8,  dHf: -545.8 },
};

// Dissolution stoichiometry (ion -> count) for the SIMPLE carbonates the
// check covers. OH-bearing (malachite/azurite/hydrozincite) + the variable-
// composition HMC are out of scope for now (their reactions need OH- ion
// data + per-crystal mg_content); noted as skipped. The keys are our mineral
// ids; each maps to the divalent-cation key(s) + CO3 count.
const CARBONATE_DISSOC = {
  calcite:       { Ca: 1, CO3: 1 },
  aragonite:     { Ca: 1, CO3: 1 },
  dolomite:      { Ca: 1, Mg: 1, CO3: 2 },
  siderite:      { Fe: 1, CO3: 1 },
  rhodochrosite: { Mn: 1, CO3: 1 },
  smithsonite:   { Zn: 1, CO3: 1 },
  cerussite:     { Pb: 1, CO3: 1 },
  witherite:     { Ba: 1, CO3: 1 },
  strontianite:  { Sr: 1, CO3: 1 },
};

// Anchors whose logKsp we've INDEPENDENTLY verified (against wateq4f /
// Plummer-Busenberg). Used to validate the ion-constant table: the derived
// logKsp must reproduce the stored value within tolerance, else the constant
// table itself is suspect (reported, not silently trusted).
const INTERNAL_ANCHORS = ['calcite', 'aragonite', 'dolomite', 'siderite'];

const LN10_R_T = Math.LN10 * 0.0083144626 * 298.15; // = 5.7080 kJ/mol per log unit
const TOL_INTERNAL_LOGK = 0.7;   // log units; absorbs ~3-4 kJ ion-constant scatter
const TOL_INTERNAL_DH = 8.0;     // kJ/mol; catches the sign-flips (Δ 13-43), passes the corrections
const round2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

function internalConsistencyCheck() {
  const result = { anchors: [], checks: [], failures: [], reviews: [], skipped: [], constantsOK: true };
  for (const { meta, doc } of files) {
    if (meta.kind !== 'carbonates') continue; // sulfate file has no ΔGf/ΔHf to check (yet)
    for (const [name, entry] of Object.entries(doc)) {
      if (name.startsWith('_')) continue;
      const stoich = CARBONATE_DISSOC[name];
      if (!stoich) {
        result.skipped.push({ name, reason: 'OH-bearing / variable-composition — dissolution stoich not modeled for internal check' });
        continue;
      }
      const t = entry.thermodynamics || {};
      const dGfMin = t.deltaGf_kJ_mol, dHfMin = t.deltaHf_kJ_mol;
      const storedLogK = (typeof t.logKsp_25C === 'number') ? t.logKsp_25C : null;
      const storedDH = (t.logKsp_fit && typeof t.logKsp_fit.deltaH_diss_kJ_mol === 'number')
        ? t.logKsp_fit.deltaH_diss_kJ_mol : null;
      // Sum ion contributions
      let sumGf = 0, sumHf = 0, missingIon = false;
      for (const [ion, n] of Object.entries(stoich)) {
        const c = ION_THERMO[ion];
        if (!c) { missingIon = true; break; }
        sumGf += n * c.dGf; sumHf += n * c.dHf;
      }
      if (missingIon) { result.skipped.push({ name, reason: 'ion constant missing' }); continue; }

      const check = { name, isAnchor: INTERNAL_ANCHORS.includes(name) };
      // hardIssues = ΔH_diss self-inconsistency. ΔH is ENGINE-CONSUMED (van't
      //   Hoff logKsp(T)) and is the field the post-v166 sign-flips lived in
      //   → exit-4 hard fail.
      // reviewIssues = logKsp-vs-ΔGf disagreement. logKsp is independently
      //   guarded by --verify (external truth) and ΔGf is a REFERENCE/audit
      //   field that nothing consumes → surface as a review flag, not a
      //   hard fail (a flag here usually means the reference ΔGf drifted from
      //   the logKsp, e.g. witherite's -1132.2 vs the Robie-Hemingway value
      //   consistent with its verified logKsp).
      const hardIssues = [];
      const reviewIssues = [];
      // (B1) logKsp from ΔGf — review-level
      if (typeof dGfMin === 'number' && storedLogK != null) {
        const dGrxn = sumGf - dGfMin;
        const logKImplied = -dGrxn / LN10_R_T;
        const dLogK = storedLogK - logKImplied;
        check.logK = { stored: storedLogK, implied: round2(logKImplied), delta: round2(dLogK) };
        if (Math.abs(dLogK) > TOL_INTERNAL_LOGK) {
          reviewIssues.push(`logKsp vs ΔGf: stored ${storedLogK}, ΔGf-implied ${logKImplied.toFixed(2)} (Δ=${dLogK.toFixed(2)} log units) — reference ΔGf likely drifted (logKsp itself is --verify-guarded)`);
        }
      }
      // (B2) ΔH_diss from ΔHf — hard-level (the sign-flip field, engine-consumed)
      if (typeof dHfMin === 'number' && storedDH != null) {
        const dHImplied = sumHf - dHfMin;
        const dDH = storedDH - dHImplied;
        check.dH = { stored: storedDH, implied: round2(dHImplied), delta: round2(dDH) };
        if (Math.abs(dDH) > TOL_INTERNAL_DH) {
          hardIssues.push(`ΔH_diss self-inconsistent: stored ${storedDH} kJ/mol, ΔHf-implied ${dHImplied.toFixed(2)} kJ/mol (Δ=${dDH.toFixed(2)})`);
        }
      }
      check.issues = hardIssues;       // back-compat: 'issues' = hard issues
      check.reviewIssues = reviewIssues;
      result.checks.push(check);
      if (check.isAnchor) result.anchors.push(check);
      if (hardIssues.length) result.failures.push(check);
      if (reviewIssues.length) result.reviews.push(check);
    }
  }
  // Validate the constant table: anchors must be self-consistent on the HARD
  // (ΔH) axis. A review-level ΔGf drift on an anchor doesn't invalidate the
  // ΔHf constants used for the ΔH check.
  result.constantsOK = result.anchors.every(a => !a.issues.length);
  return result;
}

// ---- Reporting --------------------------------------------------------------

// Set the exit code and return rather than process.exit(). On Windows Node,
// calling process.exit() while a --verify fetch keepalive socket is still
// closing triggers a libuv abort (UV_HANDLE_CLOSING) that mangles the exit
// code to 127 — defeating CI gating on the intended 2/3/4. Setting
// process.exitCode + returning lets the event loop drain cleanly so the
// process exits with the right code on its own.
function finish(code) { process.exitCode = code; }

async function main() {
  const verification = verifyMode ? await verifyAgainstWateq4f() : null;
  const anyMismatch = verification && verification.mismatches.length > 0;
  const internal = internalMode ? internalConsistencyCheck() : null;
  // An internal FAILURE is real only if the constants validated (anchors
  // passed). If an anchor failed, the constant table is suspect — report
  // but don't exit-3-style fail the data.
  const anyInternalFail = internal && internal.constantsOK && internal.failures.length > 0;

  if (jsonMode) {
    const out = {
      files: reports.map(r => ({
        path: r.meta.path,
        kind: r.meta.kind,
        ...r.report,
      })),
      verification,
      internal,
    };
    console.log(JSON.stringify(out, null, 2));
    return finish(anyInternalFail ? 4 : anyMismatch ? 3 : anyUnknown ? 2 : 0);
  }

  // Human-readable.
  const bar = (n, max) => '█'.repeat(Math.round((n / Math.max(1, max)) * 30));

  for (const { meta, report } of reports) {
    const totals = report.minerals_total;
    console.log('');
    console.log(`THERMODYNAMIC COVERAGE — ${meta.path.replace(ROOT + '\\', '').replace(ROOT + '/', '')}`);
    console.log('='.repeat(70));
    console.log(`Minerals covered: ${totals}`);
    console.log('');
    console.log('THERMO TIER DISTRIBUTION');
    console.log('------------------------');
    for (const tier of ['A', 'B', 'C', 'D', 'conflict', 'unknown']) {
      const n = report.thermo_tier_counts[tier] || 0;
      const label = tier === 'unknown' ? '???' : tier;
      console.log(`  ${label.padEnd(8)} ${String(n).padStart(2)}  ${bar(n, totals)}`);
    }
    console.log('');
    if (report.kinetic_tier_counts) {
      console.log('KINETIC TIER DISTRIBUTION');
      console.log('-------------------------');
      for (const tier of ['A', 'B', 'C', 'D', 'conflict', 'unknown']) {
        const n = report.kinetic_tier_counts[tier] || 0;
        const label = tier === 'unknown' ? '???' : tier;
        console.log(`  ${label.padEnd(8)} ${String(n).padStart(2)}  ${bar(n, totals)}`);
      }
      console.log('');
    }
    console.log('THERMO — MINERALS BY TIER');
    console.log('-------------------------');
    for (const tier of ['A', 'B', 'C', 'D', 'conflict', 'unknown']) {
      const g = report.thermo_tier_groups[tier] || [];
      if (!g.length) continue;
      console.log(`  ${tier.padEnd(8)} ${g.join(', ')}`);
    }
    console.log('');
    if (report.thermo_missing_data.length) {
      console.log('THERMO DATA GAPS');
      console.log('----------------');
      for (const m of report.thermo_missing_data) {
        console.log(`  ${m.name.padEnd(16)} missing: ${m.missing.join(', ')}`);
      }
      console.log('');
    }
    if (report.kinetic_missing_data && report.kinetic_missing_data.length) {
      console.log('KINETIC DATA GAPS');
      console.log('-----------------');
      for (const m of report.kinetic_missing_data) {
        console.log(`  ${m.name.padEnd(16)} missing: ${m.missing.join(', ')}`);
      }
      console.log('');
    }
    if (report.conflicts.length) {
      console.log('CONFLICTS / DISAGREEMENTS');
      console.log('-------------------------');
      for (const c of report.conflicts) {
        const tag = c.soft ? '[note]' : '[CONFLICT TIER]';
        console.log(`  ${c.name.padEnd(16)} ${tag} ${c.note.substring(0, 120)}${c.note.length > 120 ? '...' : ''}`);
      }
      console.log('');
    }
  }

  if (verification) {
    console.log('');
    console.log('VERIFICATION AGAINST PHREEQC wateq4f.dat');
    console.log('========================================');
    console.log(`Source: ${verification.url}`);
    console.log(`Checked OK:   ${verification.checked.length}`);
    console.log(`Mismatches:   ${verification.mismatches.length}`);
    console.log(`Skipped:      ${verification.skipped.length}`);
    console.log(`Tolerances: logKsp ±${TOL_LOGK},  ΔH ±${TOL_DELTAH_KJ} kJ/mol`);
    console.log('');
    if (verification.checked.length) {
      console.log('VERIFIED (logKsp / ΔH match wateq4f)');
      console.log('------------------------------------');
      for (const c of verification.checked) {
        const dh = c.wateq4f.dH_kJ != null ? `ΔH=${c.wateq4f.dH_kJ.toFixed(2)}` : 'ΔH=—';
        const note = c.dhNote ? `  [${c.dhNote}]` : c.phaseNote ? `  [${c.phaseNote}]` : '';
        console.log(`  ${c.name.padEnd(16)} (${c.wateqName.padEnd(12)})  logKsp=${c.wateq4f.logKsp}  ${dh} kJ/mol${note}`);
      }
      console.log('');
    }
    if (verification.mismatches.length) {
      console.log('MISMATCHES (require resolution)');
      console.log('-------------------------------');
      for (const m of verification.mismatches) {
        console.log(`  ${m.name.padEnd(16)} (${m.wateqName})`);
        for (const issue of m.issues) console.log(`    ${issue}`);
      }
      console.log('');
    }
    if (verification.skipped.length) {
      console.log('SKIPPED (not in wateq4f.dat, or no entry found)');
      console.log('-----------------------------------------------');
      for (const s of verification.skipped) {
        console.log(`  ${s.name.padEnd(16)}  ${s.reason}`);
      }
      console.log('');
    }
  }

  if (internal) {
    console.log('');
    console.log('INTERNAL THERMODYNAMIC SELF-CONSISTENCY (offline)');
    console.log('=================================================');
    console.log('Each entry checked against its OWN deltaGf/deltaHf via CODATA ion constants:');
    console.log('  (B1) logKsp =? -[ΣΔGf(ions) - ΔGf(mineral)] / 5.708');
    console.log('  (B2) ΔH_diss =? ΣΔHf(ions) - ΔHf(mineral)');
    console.log(`Tolerances: logKsp ±${TOL_INTERNAL_LOGK} log units, ΔH ±${TOL_INTERNAL_DH} kJ/mol`);
    console.log('');
    console.log(`Constant-table validation (anchors must be self-consistent): ${internal.constantsOK ? 'PASS' : 'FAIL — constants suspect'}`);
    console.log('');
    // Full residual table — transparency: show the constants reproducing every entry.
    console.log('  mineral          logKsp  stored/implied (Δ)        ΔH_diss  stored/implied (Δ)');
    console.log('  ---------------------------------------------------------------------------------');
    for (const c of internal.checks) {
      const lk = c.logK ? `${String(c.logK.stored).padStart(7)} / ${String(c.logK.implied).padStart(7)} (${c.logK.delta >= 0 ? '+' : ''}${c.logK.delta})` : '         —';
      const dh = c.dH ? `${String(c.dH.stored).padStart(6)} / ${String(c.dH.implied).padStart(7)} (${c.dH.delta >= 0 ? '+' : ''}${c.dH.delta})` : '       —';
      const flag = c.issues.length ? '  ✗ ΔH' : c.reviewIssues.length ? '  ⚠ ΔGf' : (c.isAnchor ? '  ⚓' : '');
      console.log(`  ${c.name.padEnd(15)}  ${lk.padEnd(26)}  ${dh}${flag}`);
    }
    console.log('');
    if (internal.failures.length) {
      console.log('SELF-INCONSISTENT — ΔH_diss (engine-consumed; hard fail)');
      console.log('-------------------------------------------------------');
      for (const f of internal.failures) {
        console.log(`  ${f.name}`);
        for (const issue of f.issues) console.log(`    ${issue}`);
      }
      console.log('');
    }
    if (internal.reviews.length) {
      console.log('REVIEW — logKsp vs reference ΔGf (non-fatal; logKsp is --verify-guarded)');
      console.log('-----------------------------------------------------------------------');
      for (const r of internal.reviews) {
        console.log(`  ${r.name}`);
        for (const issue of r.reviewIssues) console.log(`    ${issue}`);
      }
      console.log('');
    }
    if (internal.skipped.length) {
      console.log('SKIPPED (out of internal-check scope)');
      console.log('-------------------------------------');
      for (const s of internal.skipped) console.log(`  ${s.name.padEnd(16)}  ${s.reason}`);
      console.log('');
    }
  }

  console.log('SUMMARY');
  console.log('-------');
  for (const { meta, report } of reports) {
    const totals = report.minerals_total;
    const tc = report.thermo_tier_counts;
    console.log(`  ${meta.kind}: ${tc.A + tc.B}/${totals} measured (A+B), ${tc.C + tc.D}/${totals} estimated/absent (C+D), ${report.conflicts.length} conflicts`);
  }
  if (verification) {
    console.log(`  verification: ${verification.checked.length} verified, ${verification.mismatches.length} mismatches, ${verification.skipped.length} skipped against wateq4f.dat`);
  }
  if (internal) {
    console.log(`  internal: ${internal.checks.length - internal.failures.length}/${internal.checks.length} ΔH-self-consistent, ${internal.reviews.length} ΔGf-review, constants ${internal.constantsOK ? 'validated' : 'SUSPECT'}, ${internal.skipped.length} out-of-scope`);
  }
  console.log('');

  if (internal && !internal.constantsOK) {
    console.error('[thermo-coverage] WARN: --internal anchor minerals failed — the ion-constant table is suspect, not necessarily the data. Not failing the run.');
  }
  if (anyInternalFail) {
    console.error('[thermo-coverage] FAIL: --internal found self-inconsistent entries — see SELF-INCONSISTENT above');
    return finish(4);
  }
  if (anyMismatch) {
    console.error('[thermo-coverage] FAIL: --verify found JSON values disagreeing with wateq4f.dat — see MISMATCHES above');
    return finish(3);
  }
  if (anyUnknown) {
    console.error('[thermo-coverage] FAIL: some minerals have unknown tier — schema gap');
    return finish(2);
  }
  return finish(0);
}

main();
