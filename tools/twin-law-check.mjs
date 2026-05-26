#!/usr/bin/env node
/**
 * tools/twin-law-check.mjs — Tier 1 structural sanity check for twin_laws data.
 *
 * Implements Tier 1 of proposals/PROPOSAL-STRUCTURE-AS-FACT-CHECK.md, validated
 * manually in proposals/THEORY-TEST-3-MINERALS-MANUAL.md (3/3 textbook cases
 * + adamite back-test).
 *
 * SEE ALSO: .claude/skills/vugg-add-twin-law/SKILL.md
 *   The skill documents when to run this tool, what each verdict means,
 *   and how to populate data/structural.json when adding a new mineral
 *   whose lattice + space-group data hasn't been entered yet. Every new
 *   twin_laws entry added via that skill should also have a structural.json
 *   entry so the audit coverage grows alongside the twin_laws data.
 *
 * The job: for each declared twin_law in data/minerals.json, check whether the
 * Miller indices match a structurally-predicted twin plane derived from the
 * crystal's unit cell + space group (data/structural.json). Pass-list shows
 * twins with explicit structural support; flag-list shows twins that need
 * citation review or Tier 2 substructure analysis.
 *
 * NOT a probability-calibration tool (that's Tier 2 — needs full atom positions).
 * NOT a CIF fetcher — structural.json is hand-curated with citations. Both are
 * deliberate scope limits for the first commit.
 *
 * The CSL/pseudo-symmetry framework reproduces 3 textbook twin laws (spinel
 * {111}, aragonite {110}, staurolite {031}+{231}) and correctly REJECTS the
 * v139 fabricated adamite {101} (see THEORY-TEST-3-MINERALS-MANUAL.md). This
 * tool automates the same workflow over every mineral in the structural.json
 * coverage.
 *
 * Usage:
 *   node tools/twin-law-check.mjs              # full report, all minerals
 *   node tools/twin-law-check.mjs <mineral>    # single-mineral detail
 *   node tools/twin-law-check.mjs --flagged    # only show FLAG / PARSE entries
 *   node tools/twin-law-check.mjs --json       # machine-readable JSON output
 *
 * Output verdicts:
 *   ✓ PASS    declared plane matches a structural prediction (pseudo-sym or CSL)
 *   ⚠ FLAG    no specific structural prediction; recommend citation review
 *   ? SKIP    structural data not yet populated for this mineral
 *   ⊙ AXIS    axis-defined twin (twin_axis field present, no fixed Miller plane —
 *             e.g., pericline-law in plagioclase, [544] axis-twin in atacamite).
 *             NOT a data bug; just not checkable by lattice CSL at Tier 1.
 *   ✗ PARSE   miller_indices field is malformed / unparseable (genuine data bug)
 *
 * Exit code: 0 always (report tool, not a CI gate). Use --strict to exit 1
 * when any FLAG or PARSE is present.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// ----- Tolerances for pseudo-symmetric metric matches -----

const PS_HEX_TOL = 0.10; // |(b/a) - √3| / √3 < 10% → pseudo-hex orthorhombic
const PS_TET_TOL = 0.05; // |a - b| / mean < 5% → pseudo-tet orthorhombic
const PS_MONO_TOL = 1.5; // |β - 90°| < 1.5° → pseudo-orth monoclinic (degrees)

// ----- Pure functions (exported for tests) -----

/**
 * Parse a Miller-indices string into an index array.
 * Accepts: '{110}', '{10-12}', '{1121}' (no-dash 4-index), '110', '{0001}', etc.
 * Returns null if the string is non-parseable (b_axis, undefined, various, etc).
 */
export function parseMiller(str) {
  if (typeof str !== 'string') return null;
  const trimmed = str.trim();
  // Strip surrounding braces and any annotation like '_penetration'
  const m = trimmed.match(/^\{?([0-9-]+)\}?(?:_.*)?$/);
  if (!m) return null;
  const s = m[1];
  if (!s) return null;
  const indices = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === '-') {
      if (i + 1 >= s.length) return null;
      const v = parseInt(s[i + 1], 10);
      if (!Number.isFinite(v)) return null;
      indices.push(-v);
      i += 2;
    } else {
      const v = parseInt(s[i], 10);
      if (!Number.isFinite(v)) return null;
      indices.push(v);
      i++;
    }
  }
  if (indices.length === 3 || indices.length === 4) return indices;
  return null;
}

/**
 * Normalize 4-index Bravais-Miller (hkil) to 3-index (hkl) for comparison.
 * Constraint h+k+i=0 means i is redundant, so we drop it. Identity for 3-index input.
 */
export function to3index(arr) {
  if (!Array.isArray(arr)) return null;
  if (arr.length === 3) return arr;
  if (arr.length === 4) return [arr[0], arr[1], arr[3]];
  return null;
}

/**
 * Canonicalize a Miller-index array for system-aware family comparison.
 * Different crystal systems have different symmetry operations that map
 * the {hkl} form onto itself — using cubic-style permutation invariance
 * for, say, trigonal would incorrectly equate {110} and {101}.
 *
 *   cubic              — all 3 axes interchangeable + sign → sort |h|,|k|,|l|
 *   tetragonal         — a↔b interchangeable, c fixed     → sort |h|,|k|; |l| fixed
 *   trigonal/hexagonal — convert to 4-index Bravais (h,k,i,l), permute (h,k,i)
 *                        cyclically and sort → canonical (h,k,i) + |l|
 *   orthorhombic       — axes fixed, only sign changes    → |h|, |k|, |l| as-is
 *   monoclinic         — same as orthorhombic at this level (β handled elsewhere)
 *   triclinic          — strict axis-position; only sign changes
 *
 * Returns null on bad input.
 */
export function canonicalize(arr, system) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  if (system === 'cubic') {
    if (arr.length !== 3 && arr.length !== 4) return null;
    return arr.map(Math.abs).slice().sort((x, y) => x - y);
  }
  if (system === 'tetragonal') {
    if (arr.length !== 3) return null;
    const hk = [Math.abs(arr[0]), Math.abs(arr[1])].sort((x, y) => x - y);
    return [...hk, Math.abs(arr[2])];
  }
  if (system === 'trigonal' || system === 'hexagonal') {
    let four;
    if (arr.length === 3) {
      // Treat as (h,k,l) with implicit i = -(h+k)
      four = [arr[0], arr[1], -(arr[0] + arr[1]), arr[2]];
    } else if (arr.length === 4) {
      four = arr.slice();
    } else return null;
    // (h,k,i) triplet — cyclic permutations + sign changes give equivalents.
    // Canonical: sort absolute values of (h,k,i); |l| separately.
    const hki = [Math.abs(four[0]), Math.abs(four[1]), Math.abs(four[2])].sort((x, y) => x - y);
    return [...hki, Math.abs(four[3])];
  }
  // orthorhombic, monoclinic, triclinic
  if (arr.length !== 3) return null;
  return arr.map(Math.abs);
}

/**
 * Compare two Miller index arrays modulo the symmetry operations of the
 * given crystal system. Built on canonicalize() — see that function for
 * the per-system rules.
 *
 * Examples (cubic):       sameFamily([1,1,0],[-1,1,0],'cubic') → true
 *                         sameFamily([1,1,1],[1,1,0],'cubic') → false
 * Examples (trigonal):    sameFamily([1,1,-2,0],[1,0,-1,1],'trigonal') → false
 *                         sameFamily([0,0,1],[0,0,0,1],'trigonal') → true (3- vs 4-index)
 * Examples (orthorhombic):sameFamily([1,1,0],[1,0,1],'orthorhombic') → false
 *                         sameFamily([1,1,0],[-1,-1,0],'orthorhombic') → true (signs ok)
 */
export function sameFamily(a, b, system) {
  const ca = canonicalize(a, system);
  const cb = canonicalize(b, system);
  if (!ca || !cb || ca.length !== cb.length) return false;
  return ca.every((v, i) => v === cb[i]);
}

/**
 * Stringify a Miller index array for display: [1,-1,0] → '{1-10}'; [1,0,-1,2] → '{10-12}'.
 */
export function fmtMiller(arr) {
  if (!arr) return '?';
  return '{' + arr.map(n => (n < 0 ? '-' + (-n) : String(n))).join('') + '}';
}

/**
 * Generate structurally-predicted twin-plane candidates for a mineral
 * given its structural data. Returns an array of
 *   { indices: [h,k,l] or [h,k,i,l], reason: string, strength: 'strong'|'moderate' }.
 *
 * Strictness: only includes planes with a SPECIFIC structural argument.
 * Generic low-index planes are NOT auto-included — the tool's job is to
 * flag entries that lack a structural argument, not rubber-stamp them.
 */
export function generateCandidates(struct) {
  if (!struct || !struct.system) return [];
  const candidates = [];
  const { system, lattice } = struct;

  switch (system) {
    case 'cubic': {
      // Σ3 CSL on FCC sublattice (60° about <111>, equivalent to {111} mirror).
      // The dominant low-Σ boundary in cubic systems generally.
      candidates.push({
        indices: [1, 1, 1],
        reason: 'Σ3 cubic CSL ({111} = lowest-Σ coincidence boundary)',
        strength: 'strong',
      });
      break;
    }

    case 'tetragonal': {
      // {011}/{101} elbow twin: the canonical tetragonal twin for rutile-type
      // structures (rutile, cassiterite). Mirror across {101} maps the c-axis
      // chains in a way that lattice geometry supports.
      candidates.push({
        indices: [1, 0, 1],
        reason: 'tetragonal {101} elbow twin (rutile-type)',
        strength: 'strong',
      });
      candidates.push({
        indices: [0, 1, 1],
        reason: 'tetragonal {011} elbow twin (rutile-type, axis-equivalent to {101})',
        strength: 'strong',
      });
      // {001} basal twin: documented in scheelite-class minerals (scheelite,
      // wulfenite, powellite, stolzite) and other I41/a tetragonal species.
      // Structural basis: the 4-fold screw axis along c is broken by the
      // twin operation (180° rotation about in-plane axis), giving a
      // basal-mirror composition plane.
      candidates.push({
        indices: [0, 0, 1],
        reason: 'tetragonal {001} basal twin (scheelite-class)',
        strength: 'moderate',
      });
      // {112} composition: documented in chalcopyrite (I-42d) and related
      // tetragonal sphalerite-derivatives. Sphalerite-class {111} maps to
      // {112} when the cubic symmetry is broken by the c/a > 1 distortion.
      candidates.push({
        indices: [1, 1, 2],
        reason: 'tetragonal {112} twin (chalcopyrite-class, sphalerite-derivative)',
        strength: 'moderate',
      });
      break;
    }

    case 'orthorhombic': {
      const { a, b, c } = lattice;
      // Pseudo-hex check: b/a (or a/b) ≈ √3 → latent 6-fold pseudo-symmetry
      // about c-axis. The {110}-type planes are related by the latent 60°
      // rotation. Aragonite group canonical case.
      if (a && b) {
        const bOverA = b / a;
        const aOverB = a / b;
        const hexBA = Math.abs(bOverA - Math.sqrt(3)) / Math.sqrt(3);
        const hexAB = Math.abs(aOverB - Math.sqrt(3)) / Math.sqrt(3);
        if (hexBA < PS_HEX_TOL) {
          candidates.push({
            indices: [1, 1, 0],
            reason: `pseudo-hex {110} (b/a = ${bOverA.toFixed(3)} ≈ √3, ${(hexBA * 100).toFixed(1)}% deviation)`,
            strength: 'strong',
          });
        } else if (hexAB < PS_HEX_TOL) {
          candidates.push({
            indices: [1, 1, 0],
            reason: `pseudo-hex {110} (a/b = ${aOverB.toFixed(3)} ≈ √3, ${(hexAB * 100).toFixed(1)}% deviation)`,
            strength: 'strong',
          });
        }
        // Pseudo-tet check: a ≈ b → latent 4-fold pseudo-symmetry about c.
        // Adamite is the back-test case (a=8.30, b=8.51, 2.5% deviation).
        const abDiff = Math.abs(a - b) / ((a + b) / 2);
        if (abDiff < PS_TET_TOL && hexBA >= PS_HEX_TOL && hexAB >= PS_HEX_TOL) {
          candidates.push({
            indices: [1, 1, 0],
            reason: `pseudo-tet {110} (a ≈ b: ${a.toFixed(2)} vs ${b.toFixed(2)}, ${(abDiff * 100).toFixed(1)}% deviation)`,
            strength: 'strong',
          });
        }
      }
      break;
    }

    case 'monoclinic': {
      const beta = lattice && lattice.beta;
      const isPseudoOrth = beta != null && Math.abs(beta - 90) < PS_MONO_TOL;
      // Common monoclinic twin laws — the feldspar family is the canonical
      // reference set:
      //   {010} — Albite-law / Carlsbad-type composition plane (plagioclase + K-feldspar)
      //   {001} — Manebach law
      //   {021} — Baveno law (feldspar)
      //   {100} — Carlsbad-type composition plane (alternate convention)
      //   {201} — also Carlsbad in some conventions
      // Many other monoclinic species share these planes (pyroxenes,
      // amphiboles, micas, gypsum, vivianite-group).
      candidates.push({
        indices: [0, 1, 0],
        reason: 'monoclinic {010} twin (Albite/Carlsbad-type composition plane)',
        strength: 'moderate',
      });
      candidates.push({
        indices: [0, 0, 1],
        reason: 'monoclinic {001} twin (Manebach law)',
        strength: 'moderate',
      });
      candidates.push({
        indices: [1, 0, 0],
        reason: 'monoclinic {100} twin (common composition plane)',
        strength: 'moderate',
      });
      candidates.push({
        indices: [0, 2, 1],
        reason: 'monoclinic {021} twin (Baveno law)',
        strength: 'moderate',
      });
      candidates.push({
        indices: [2, 0, 1],
        reason: 'monoclinic {201} twin (Carlsbad-type)',
        strength: 'moderate',
      });
      if (isPseudoOrth) {
        candidates.push({
          indices: [1, 1, 0],
          reason: `pseudo-orth {110} (β = ${beta}° ≈ 90°; pseudo-orthorhombic)`,
          strength: 'moderate',
        });
      }
      break;
    }

    case 'trigonal':
    case 'hexagonal': {
      // Common trigonal/hex twin laws. Strength varies:
      //   {0001} basal — common (Dauphine-quartz, basal calcite)
      //   {10-12} e-twin — STRONG, classic deformation twin in calcite
      //   {10-11} r-twin — common in carbonates
      //   {11-20} prism — Brazil-quartz, also documented in carbonates
      //   {11-22} — Japan-quartz twin (also documented in other species)
      candidates.push({
        indices: [0, 0, 0, 1],
        reason: `${system} basal {0001} (Dauphine-quartz / basal-type)`,
        strength: 'moderate',
      });
      candidates.push({
        indices: [1, 0, -1, 2],
        reason: `${system} {10-12} e-twin (classic deformation twin)`,
        strength: 'strong',
      });
      candidates.push({
        indices: [1, 0, -1, 1],
        reason: `${system} {10-11} r-twin`,
        strength: 'moderate',
      });
      candidates.push({
        indices: [1, 1, -2, 0],
        reason: `${system} {11-20} prism (Brazil-quartz / m-twin)`,
        strength: 'moderate',
      });
      candidates.push({
        indices: [1, 1, -2, 2],
        reason: `${system} {11-22} (Japan-quartz)`,
        strength: 'moderate',
      });
      break;
    }

    case 'triclinic': {
      // Common triclinic twin laws (mostly plagioclase + pyroxenoid family):
      //   {010} — Albite law (the dominant twin in plagioclase feldspar)
      //   [010] / pericline-direction twins — projects to {001} or {h0l} planes
      //   {001} — Manebach-equivalent in triclinic context
      //   {100} — also common in pyroxenoids (wollastonite, pectolite, bustamite)
      // Triclinic structures generally pseudo-monoclinic; the angles α γ ≈ 90°
      // give a latent monoclinic pseudo-symmetry that the twin operations
      // exploit.
      candidates.push({
        indices: [0, 1, 0],
        reason: 'triclinic {010} twin (Albite law — dominant plagioclase twin)',
        strength: 'moderate',
      });
      candidates.push({
        indices: [0, 0, 1],
        reason: 'triclinic {001} twin (Manebach-equivalent / pericline-related)',
        strength: 'moderate',
      });
      candidates.push({
        indices: [1, 0, 0],
        reason: 'triclinic {100} twin (pyroxenoid family — wollastonite, pectolite)',
        strength: 'moderate',
      });
      break;
    }

    default:
      break;
  }

  return candidates;
}

/**
 * Extract the Miller-indices string from a twin_law entry, accepting either
 * the canonical `miller_indices` field or the alternate `composition_plane`
 * field used by some legacy entries. Returns undefined if neither is present
 * or if the entry isn't even an object (e.g. corundum/ruby/sapphire's
 * raw-string format that doesn't match the schema at all).
 */
export function getDeclaredPlane(law) {
  if (!law || typeof law !== 'object') return undefined;
  if (typeof law.miller_indices === 'string') return law.miller_indices;
  if (typeof law.composition_plane === 'string') return law.composition_plane;
  return undefined;
}

/**
 * Check a declared twin_law against a candidate list under the given
 * crystal system's family-equivalence rules.
 * Returns { verdict, reason, suggested? } where verdict is one of
 * 'PASS' | 'FLAG' | 'PARSE'.
 */
export function checkTwinLaw(law, candidates, system) {
  if (!law || typeof law !== 'object') {
    return {
      verdict: 'PARSE',
      reason: `twin_law entry is not an object (got ${typeof law}: ${JSON.stringify(law).slice(0, 60)})`,
    };
  }
  const plane = getDeclaredPlane(law);
  const hasAxis = typeof law.twin_axis === 'string' && law.twin_axis.length > 0;
  if (plane === undefined) {
    // No plane field. If the entry has a twin_axis declared, it's a legitimate
    // axis-defined twin (pericline-law etc.) — not a data bug. Otherwise it's
    // a real PARSE problem.
    if (hasAxis) {
      return {
        verdict: 'AXIS',
        reason: `axis-defined twin (twin_axis: ${law.twin_axis}); no Miller plane to check at Tier 1`,
      };
    }
    return {
      verdict: 'PARSE',
      reason: 'twin_law has neither miller_indices nor composition_plane field',
    };
  }
  const declared = parseMiller(plane);
  if (!declared) {
    // Plane field is present but unparseable. Recognized non-Miller composition
    // strings ("rhombic_section" for pericline-law, etc.) → AXIS verdict if a
    // twin_axis is also declared. Otherwise PARSE (genuine data bug).
    const nonMillerComposition = /^[a-z_]+$/i.test(plane.trim());
    if (hasAxis && nonMillerComposition) {
      return {
        verdict: 'AXIS',
        reason: `axis-defined twin (composition_plane: "${plane}", twin_axis: ${law.twin_axis}); no Miller plane to check at Tier 1`,
      };
    }
    return {
      verdict: 'PARSE',
      reason: `cannot parse "${plane}"`,
    };
  }
  for (const cand of candidates) {
    if (sameFamily(declared, cand.indices, system)) {
      return {
        verdict: 'PASS',
        reason: cand.reason,
        strength: cand.strength,
      };
    }
  }
  // No match — find the strongest alternative candidate to suggest as the
  // "what the structure WOULD predict" hint, for human review.
  const strong = candidates.find(c => c.strength === 'strong')
    || candidates.find(c => c.strength === 'moderate');
  return {
    verdict: 'FLAG',
    reason: 'no specific structural prediction matches this plane',
    suggested: strong ? `${fmtMiller(strong.indices)} (${strong.reason})` : null,
  };
}

// ----- CLI driver -----

function isCliEntry() {
  try {
    return import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`
      || import.meta.url.endsWith(path.basename(process.argv[1] || ''));
  } catch {
    return false;
  }
}

async function runCli() {
  const args = process.argv.slice(2);
  const flaggedOnly = args.includes('--flagged');
  const jsonOut = args.includes('--json');
  const strict = args.includes('--strict');
  const target = args.find(a => !a.startsWith('--'));

  const MINERALS = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', 'minerals.json'), 'utf8'),
  ).minerals;
  const STRUCTURAL = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', 'structural.json'), 'utf8'),
  );

  const mineralsWithTwins = Object.entries(MINERALS).filter(
    ([, v]) => Array.isArray(v.twin_laws) && v.twin_laws.length > 0,
  );

  const rows = [];
  const summary = { pass: 0, flag: 0, parse: 0, skip: 0 };
  const flaggedMinerals = new Set();

  for (const [name, mineral] of mineralsWithTwins) {
    if (target && name !== target) continue;
    const struct = STRUCTURAL[name];
    if (!struct) {
      for (const law of mineral.twin_laws) {
        rows.push({
          mineral: name,
          declared: getDeclaredPlane(law) || (typeof law === 'string' ? law : '(no plane field)'),
          law_name: (law && typeof law === 'object') ? law.name : null,
          verdict: 'SKIP',
          reason: 'no structural data in data/structural.json',
        });
        summary.skip++;
      }
      continue;
    }
    const candidates = generateCandidates(struct);
    for (const law of mineral.twin_laws) {
      const result = checkTwinLaw(law, candidates, struct.system);
      rows.push({
        mineral: name,
        declared: getDeclaredPlane(law) || (typeof law === 'string' ? law : '(no plane field)'),
        law_name: (law && typeof law === 'object') ? law.name : null,
        verdict: result.verdict,
        reason: result.reason,
        strength: result.strength,
        suggested: result.suggested,
      });
      if (result.verdict === 'PASS') summary.pass++;
      else if (result.verdict === 'FLAG') {
        summary.flag++;
        flaggedMinerals.add(name);
      } else if (result.verdict === 'AXIS') {
        summary.axis = (summary.axis || 0) + 1;
      } else if (result.verdict === 'PARSE') {
        summary.parse++;
        flaggedMinerals.add(name);
      }
    }
  }

  if (jsonOut) {
    process.stdout.write(JSON.stringify({ summary, rows }, null, 2) + '\n');
  } else {
    const filtered = flaggedOnly
      ? rows.filter(r => r.verdict !== 'PASS' && r.verdict !== 'SKIP' && r.verdict !== 'AXIS')
      : rows;

    if (target) {
      console.log(`\ntwin-law-check: mineral '${target}'\n`);
    } else {
      console.log(`\ntwin-law-check: scanning ${mineralsWithTwins.length} minerals with twin_laws against ${Object.keys(STRUCTURAL).filter(k => k[0] !== '_').length} structural entries\n`);
    }

    const cols = {
      mineral: 16,
      declared: 12,
      verdict: 9,
      reason: 60,
    };
    const dash = '-'.repeat(cols.mineral + cols.declared + cols.verdict + cols.reason + 6);
    console.log(
      'mineral'.padEnd(cols.mineral)
      + 'declared'.padEnd(cols.declared)
      + 'verdict'.padEnd(cols.verdict)
      + 'reason',
    );
    console.log(dash);

    const glyph = { PASS: '✓ PASS', FLAG: '⚠ FLAG', SKIP: '? SKIP', AXIS: '⊙ AXIS', PARSE: '✗ PARSE' };
    for (const r of filtered) {
      const line =
        (r.mineral || '').padEnd(cols.mineral)
        + (r.declared || '—').padEnd(cols.declared)
        + (glyph[r.verdict] || r.verdict).padEnd(cols.verdict)
        + (r.reason || '');
      console.log(line);
      if (r.verdict === 'FLAG' && r.suggested) {
        console.log(' '.repeat(cols.mineral + cols.declared + cols.verdict) + `  ↳ suggested: ${r.suggested}`);
      }
    }

    console.log(dash);
    const axisCount = summary.axis || 0;
    console.log(`summary: ${summary.pass} pass, ${summary.flag} flag, ${axisCount} axis-twin, ${summary.parse} parse-error, ${summary.skip} skip (no structural data)`);
    if (summary.flag + summary.parse > 0) {
      console.log(`flagged minerals (${flaggedMinerals.size}): ${[...flaggedMinerals].sort().join(', ')}`);
    }
  }

  if (strict && (summary.flag + summary.parse > 0)) {
    process.exit(1);
  }
}

if (isCliEntry()) {
  runCli().catch(err => {
    console.error(err);
    process.exit(2);
  });
}
