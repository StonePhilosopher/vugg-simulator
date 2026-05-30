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
 *   1  — file missing or unparseable
 *   2  — any mineral has confidence_tier 'unknown' (= schema gap)
 *   3  — --verify mode: any logKsp_25C or ΔH_diss disagrees with the
 *        canonical wateq4f.dat beyond the documented tolerance
 *
 * Per PROPOSAL-CARBONATE-GEOCHEM Week 1 (original deliverable) + post-
 * v165 review item #7 (verification tool extension).
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

// ---- Reporting --------------------------------------------------------------

async function main() {
  const verification = verifyMode ? await verifyAgainstWateq4f() : null;
  const anyMismatch = verification && verification.mismatches.length > 0;

  if (jsonMode) {
    const out = {
      files: reports.map(r => ({
        path: r.meta.path,
        kind: r.meta.kind,
        ...r.report,
      })),
      verification,
    };
    console.log(JSON.stringify(out, null, 2));
    process.exit(anyMismatch ? 3 : anyUnknown ? 2 : 0);
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
  console.log('');

  if (anyMismatch) {
    console.error('[thermo-coverage] FAIL: --verify found JSON values disagreeing with wateq4f.dat — see MISMATCHES above');
    process.exit(3);
  }
  if (anyUnknown) {
    console.error('[thermo-coverage] FAIL: some minerals have unknown tier — schema gap');
    process.exit(2);
  }
  process.exit(0);
}

main();
