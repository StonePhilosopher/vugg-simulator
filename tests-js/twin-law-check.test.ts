// tests-js/twin-law-check.test.ts
//
// Unit tests for tools/twin-law-check.mjs — the Tier 1 structural sanity
// check for twin_laws data. The tool's pure functions are exported from
// the .mjs and imported here for isolation testing.
//
// The most important high-level test is the v142 back-test: feeding the
// fabricated v139 adamite { miller_indices: "{101}" } entry through
// checkTwinLaw with adamite's real structural data (pseudo-tet Pnnm a≈b)
// must return verdict='FLAG' — this proves the tool would have caught
// the fabrication that motivated the whole proposal.

import { describe, it, expect } from 'vitest';
import {
  parseMiller,
  canonicalize,
  sameFamily,
  fmtMiller,
  generateCandidates,
  checkTwinLaw,
  getDeclaredPlane,
} from '../tools/twin-law-check.mjs';

describe('parseMiller', () => {
  it('parses 3-index forms with and without braces', () => {
    expect(parseMiller('{110}')).toEqual([1, 1, 0]);
    expect(parseMiller('110')).toEqual([1, 1, 0]);
    expect(parseMiller('{111}')).toEqual([1, 1, 1]);
  });

  it('parses 4-index Bravais forms with explicit negative signs', () => {
    expect(parseMiller('{10-12}')).toEqual([1, 0, -1, 2]);
    expect(parseMiller('{11-20}')).toEqual([1, 1, -2, 0]);
    expect(parseMiller('{11-22}')).toEqual([1, 1, -2, 2]);
  });

  it('parses 4-index forms with no dashes (legacy schema)', () => {
    expect(parseMiller('{1011}')).toEqual([1, 0, 1, 1]);
    expect(parseMiller('{1121}')).toEqual([1, 1, 2, 1]);
  });

  it('strips schema annotations like _penetration', () => {
    expect(parseMiller('{010}_penetration')).toEqual([0, 1, 0]);
  });

  it('returns null on non-parseable strings used in the data', () => {
    expect(parseMiller('b_axis')).toBeNull();
    expect(parseMiller('{various}')).toBeNull();
    expect(parseMiller('undefined')).toBeNull();
    expect(parseMiller('')).toBeNull();
  });

  it('returns null on non-string input', () => {
    expect(parseMiller(undefined as any)).toBeNull();
    expect(parseMiller(null as any)).toBeNull();
    expect(parseMiller(110 as any)).toBeNull();
  });
});

describe('canonicalize', () => {
  it('cubic permutes all three indices', () => {
    expect(canonicalize([1, 1, 0], 'cubic')).toEqual([0, 1, 1]);
    expect(canonicalize([0, 1, 1], 'cubic')).toEqual([0, 1, 1]);
    expect(canonicalize([1, 0, 1], 'cubic')).toEqual([0, 1, 1]);
    expect(canonicalize([-1, 1, 0], 'cubic')).toEqual([0, 1, 1]);
  });

  it('tetragonal permutes a-b but not c', () => {
    expect(canonicalize([1, 0, 1], 'tetragonal')).toEqual([0, 1, 1]);
    expect(canonicalize([0, 1, 1], 'tetragonal')).toEqual([0, 1, 1]);
    // {110} (l=0) is NOT same family as {101} (l=1) in tetragonal
    expect(canonicalize([1, 1, 0], 'tetragonal')).toEqual([1, 1, 0]);
  });

  it('orthorhombic preserves axis order — no permutation', () => {
    expect(canonicalize([1, 1, 0], 'orthorhombic')).toEqual([1, 1, 0]);
    expect(canonicalize([1, 0, 1], 'orthorhombic')).toEqual([1, 0, 1]);
    expect(canonicalize([0, 1, 1], 'orthorhombic')).toEqual([0, 1, 1]);
    // signs ok
    expect(canonicalize([-1, 1, 0], 'orthorhombic')).toEqual([1, 1, 0]);
  });

  it('trigonal/hexagonal converts 3-index to 4-index implicitly', () => {
    // {001} 3-index → [0,0,0,1] 4-index → canonical [0,0,0,1]
    expect(canonicalize([0, 0, 1], 'trigonal')).toEqual([0, 0, 0, 1]);
    expect(canonicalize([0, 0, 0, 1], 'trigonal')).toEqual([0, 0, 0, 1]);
  });

  it('trigonal/hexagonal cyclically permutes (h,k,i) but keeps l', () => {
    // {11-20} and {-2110} are the same hex family
    expect(canonicalize([1, 1, -2, 0], 'trigonal'))
      .toEqual(canonicalize([-2, 1, 1, 0], 'trigonal'));
    // {11-20} and {10-12} are NOT the same family — different |l|
    expect(canonicalize([1, 1, -2, 0], 'trigonal'))
      .not.toEqual(canonicalize([1, 0, -1, 2], 'trigonal'));
  });
});

describe('sameFamily', () => {
  it('cubic recognizes {110} ~ {011} ~ {-1,1,0}', () => {
    expect(sameFamily([1, 1, 0], [0, 1, 1], 'cubic')).toBe(true);
    expect(sameFamily([1, 1, 0], [-1, 1, 0], 'cubic')).toBe(true);
    expect(sameFamily([1, 1, 0], [1, 0, 1], 'cubic')).toBe(true);
  });

  it('cubic distinguishes {110} from {111}', () => {
    expect(sameFamily([1, 1, 0], [1, 1, 1], 'cubic')).toBe(false);
  });

  it('orthorhombic does NOT permute — {110} ≠ {101}', () => {
    expect(sameFamily([1, 1, 0], [1, 0, 1], 'orthorhombic')).toBe(false);
    expect(sameFamily([1, 1, 0], [0, 1, 1], 'orthorhombic')).toBe(false);
  });

  it('orthorhombic allows sign changes', () => {
    expect(sameFamily([1, 1, 0], [-1, 1, 0], 'orthorhombic')).toBe(true);
    expect(sameFamily([1, 1, 0], [-1, -1, 0], 'orthorhombic')).toBe(true);
  });

  it('tetragonal allows a↔b but not a↔c', () => {
    expect(sameFamily([1, 0, 1], [0, 1, 1], 'tetragonal')).toBe(true);
    expect(sameFamily([1, 0, 1], [1, 1, 0], 'tetragonal')).toBe(false);
  });

  it('trigonal distinguishes {11-20} from {10-11} — the original quartz bug', () => {
    // The original sameFamily was permutation-invariant and incorrectly
    // treated quartz {11-20} as the same family as {10-11}. This regression
    // test pins the fix.
    const a = parseMiller('{11-20}');
    const b = parseMiller('{10-11}');
    expect(sameFamily(a!, b!, 'trigonal')).toBe(false);
  });

  it('trigonal: {001} 3-index ~ {0001} 4-index — same basal plane', () => {
    expect(sameFamily([0, 0, 1], [0, 0, 0, 1], 'trigonal')).toBe(true);
  });

  it('trigonal: {11-22} ~ {-2,1,1,2}', () => {
    expect(sameFamily([1, 1, -2, 2], [-2, 1, 1, 2], 'trigonal')).toBe(true);
  });
});

describe('fmtMiller', () => {
  it('formats positive and negative indices', () => {
    expect(fmtMiller([1, 1, 1])).toBe('{111}');
    expect(fmtMiller([1, 0, -1, 2])).toBe('{10-12}');
    expect(fmtMiller([0, 0, 0, 1])).toBe('{0001}');
  });
});

describe('generateCandidates', () => {
  it('cubic produces Σ3 {111} as strong', () => {
    const cands = generateCandidates({ system: 'cubic', lattice: { a: 5.4 } });
    expect(cands).toHaveLength(1);
    expect(cands[0].indices).toEqual([1, 1, 1]);
    expect(cands[0].strength).toBe('strong');
  });

  it('orthorhombic with b/a ≈ √3 emits pseudo-hex {110}', () => {
    // aragonite: a=4.96, b=7.96 — b/a = 1.606, deviation from √3 ≈ 7%
    const cands = generateCandidates({
      system: 'orthorhombic',
      lattice: { a: 4.9598, b: 7.9641, c: 5.7379 },
    });
    expect(cands.length).toBeGreaterThan(0);
    expect(cands[0].indices).toEqual([1, 1, 0]);
    expect(cands[0].strength).toBe('strong');
    expect(cands[0].reason).toMatch(/pseudo-hex/);
  });

  it('orthorhombic with a ≈ b emits pseudo-tet {110}', () => {
    // adamite: a=8.30, b=8.51 — 2.5% deviation
    const cands = generateCandidates({
      system: 'orthorhombic',
      lattice: { a: 8.30, b: 8.51, c: 6.04 },
    });
    expect(cands.length).toBeGreaterThan(0);
    expect(cands[0].indices).toEqual([1, 1, 0]);
    expect(cands[0].reason).toMatch(/pseudo-tet/);
  });

  it('orthorhombic with no pseudo-symmetry emits NO candidates', () => {
    // marcasite: a=4.443, b=5.424, c=3.387 — b/a=1.221, a≠b
    const cands = generateCandidates({
      system: 'orthorhombic',
      lattice: { a: 4.443, b: 5.424, c: 3.387 },
    });
    expect(cands).toHaveLength(0);
  });

  it('tetragonal emits {101}, {011} elbow + {001} scheelite-class + {112} chalcopyrite-class', () => {
    const cands = generateCandidates({
      system: 'tetragonal',
      lattice: { a: 4.74, c: 3.19 },
    });
    const millers = cands.map(c => c.indices);
    expect(millers).toContainEqual([1, 0, 1]);
    expect(millers).toContainEqual([0, 1, 1]);
    expect(millers).toContainEqual([0, 0, 1]);
    expect(millers).toContainEqual([1, 1, 2]);
  });

  it('scheelite {001} basal — PASS via tetragonal scheelite-class candidate', () => {
    const struct = { system: 'tetragonal', lattice: { a: 5.243, c: 11.376 } };
    const result = checkTwinLaw(
      { miller_indices: '{001}', name: 'basal' },
      generateCandidates(struct),
      struct.system,
    );
    expect(result.verdict).toBe('PASS');
    expect(result.reason).toMatch(/scheelite/);
  });

  it('trigonal/hex emits the standard family ({0001}, {10-12}, {11-20}, etc.)', () => {
    const cands = generateCandidates({
      system: 'trigonal',
      lattice: { a: 4.99, c: 17.06 },
    });
    const millers = cands.map(c => c.indices);
    expect(millers).toContainEqual([0, 0, 0, 1]);
    expect(millers).toContainEqual([1, 0, -1, 2]);
    expect(millers).toContainEqual([1, 1, -2, 0]);
  });
});

describe('getDeclaredPlane', () => {
  it('reads miller_indices field', () => {
    expect(getDeclaredPlane({ miller_indices: '{110}' })).toBe('{110}');
  });

  it('falls back to composition_plane field (legacy schema)', () => {
    expect(getDeclaredPlane({ composition_plane: '{011}' })).toBe('{011}');
  });

  it('prefers miller_indices when both are present', () => {
    expect(getDeclaredPlane({ miller_indices: '{110}', composition_plane: '{101}' }))
      .toBe('{110}');
  });

  it('returns undefined for raw-string entries (corundum/ruby/sapphire schema break)', () => {
    expect(getDeclaredPlane('0001 basal' as any)).toBeUndefined();
    expect(getDeclaredPlane(null as any)).toBeUndefined();
  });
});

describe('checkTwinLaw — high-level structural verdicts', () => {
  it('aragonite {110} cyclic — PASS via pseudo-hex (the proof case #1)', () => {
    const struct = {
      system: 'orthorhombic',
      lattice: { a: 4.9598, b: 7.9641, c: 5.7379 },
    };
    const cands = generateCandidates(struct);
    const result = checkTwinLaw(
      { miller_indices: '{110}', name: 'cyclic_sextet' },
      cands,
      struct.system,
    );
    expect(result.verdict).toBe('PASS');
    expect(result.reason).toMatch(/pseudo-hex/);
  });

  it('spinel {111} — PASS via Σ3 cubic (the proof case #2)', () => {
    const struct = { system: 'cubic', lattice: { a: 8.09 } };
    const result = checkTwinLaw(
      { miller_indices: '{111}', name: 'spinel_law' },
      generateCandidates(struct),
      struct.system,
    );
    expect(result.verdict).toBe('PASS');
    expect(result.reason).toMatch(/Σ3/);
  });

  it('quartz {11-20} ≠ {10-11} — regression for the trigonal axis-permutation bug', () => {
    const struct = { system: 'trigonal', lattice: { a: 4.913, c: 5.405 } };
    const cands = generateCandidates(struct);
    const result = checkTwinLaw(
      { miller_indices: '{11-20}', name: 'brazil' },
      cands,
      struct.system,
    );
    // {11-20} IS in the candidate list for trigonal — should pass
    expect(result.verdict).toBe('PASS');
    expect(result.reason).toMatch(/11-20|Brazil/);
  });

  it('cassiterite composition_plane {011} — PASS via tetragonal elbow', () => {
    // Tests the schema-fallback to composition_plane
    const struct = { system: 'tetragonal', lattice: { a: 4.737, c: 3.186 } };
    const result = checkTwinLaw(
      { composition_plane: '{011}', name: 'cassiterite_011_elbow' },
      generateCandidates(struct),
      struct.system,
    );
    expect(result.verdict).toBe('PASS');
  });

  it('adamite {101} v139 fabrication — FLAG (THE BACK-TEST)', () => {
    // The whole reason for this tool: would it have caught v139?
    // Adamite is pseudo-tetragonal (a≈b), which predicts {110} as a twin
    // candidate. The fabricated {101} entry is NOT predicted by structure.
    // This test pins the back-test from THEORY-TEST-3-MINERALS-MANUAL.md.
    const struct = {
      system: 'orthorhombic',
      lattice: { a: 8.30, b: 8.51, c: 6.04 },
    };
    const cands = generateCandidates(struct);
    const result = checkTwinLaw(
      {
        name: 'heart_twin_101',
        miller_indices: '{101}',
        probability: 0.05,
        _source: 'Frondel 1948 (American Mineralogist 33:545) [FABRICATED]',
      },
      cands,
      struct.system,
    );
    expect(result.verdict).toBe('FLAG');
    expect(result.reason).toMatch(/no specific structural prediction/);
    expect(result.suggested).toMatch(/\{110\}/);
    expect(result.suggested).toMatch(/pseudo-tet/);
  });

  it('axis-defined twin (pericline-law) — AXIS verdict, not PARSE', () => {
    // The albite pericline-law twin has twin_axis [010] and a composition plane
    // that is the non-Miller "rhombic section" (Al/Si-order-dependent). This is
    // a legitimate real twin that isn't checkable by lattice CSL at Tier 1 —
    // not a data bug. The tool should distinguish AXIS from PARSE.
    const struct = { system: 'triclinic', lattice: { a: 8.14, b: 12.79, c: 7.16 } };
    const result = checkTwinLaw(
      {
        name: 'pericline',
        twin_axis: '[010]',
        composition_plane: 'rhombic_section',
        probability: 0.05,
      },
      generateCandidates(struct),
      struct.system,
    );
    expect(result.verdict).toBe('AXIS');
    expect(result.reason).toMatch(/axis-defined/);
  });

  it('twin_axis-only entry (no plane field at all) — AXIS verdict', () => {
    const struct = { system: 'orthorhombic', lattice: { a: 6.03, b: 9.12, c: 6.87 } };
    const result = checkTwinLaw(
      { name: 'axis_only', twin_axis: '[544]', probability: 0.1 },
      generateCandidates(struct),
      struct.system,
    );
    expect(result.verdict).toBe('AXIS');
    expect(result.reason).toMatch(/\[544\]/);
  });

  it('non-object law entry (corundum string format) — PARSE error', () => {
    const struct = { system: 'trigonal', lattice: { a: 4.76, c: 12.99 } };
    const result = checkTwinLaw(
      '0001 basal (polysynthetic)' as any,
      generateCandidates(struct),
      struct.system,
    );
    expect(result.verdict).toBe('PARSE');
  });

  it('unparseable miller_indices string — PARSE error', () => {
    const struct = { system: 'monoclinic', lattice: { a: 1, b: 1, c: 1, beta: 90 } };
    const result = checkTwinLaw(
      { miller_indices: 'b_axis', name: 'weird' },
      generateCandidates(struct),
      struct.system,
    );
    expect(result.verdict).toBe('PARSE');
  });
});
