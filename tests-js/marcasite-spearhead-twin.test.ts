// tests-js/marcasite-spearhead-twin.test.ts — marcasite spearhead {101}
//
// v134 (2026-05-22) ships PRIM_MARCASITE_SPEARHEAD_TWIN — the {101}
// contact twin of marcasite, an elongated rhombic bipyramid distinct
// from the cockscomb V-pair. Dana 8th ed. + Mindat marcasite catalog.
// v133 set spearhead probability to 0.05 (rolls first at path-1, then
// cockscomb at 0.55 if spearhead didn't fire).
//
// Distinguishes from existing primitives:
//   PRIM_OCTAHEDRON — regular (equal a, b, c equator radii)
//   PRIM_DIPYRAMID — hex cross-section (6-vert equator)
//   PRIM_MARCASITE_SPEARHEAD_TWIN — rhombic (a > b on 4-vert equator)

import { describe, expect, it } from 'vitest';

declare const PRIM_MARCASITE_SPEARHEAD_TWIN: any;
declare const _lookupCrystalPrimitive: any;
declare const _clusterPatternKeyForPrim: any;

describe('marcasite-spearhead-twin — primitive geometry', () => {
  it('PRIM_MARCASITE_SPEARHEAD_TWIN is defined', () => {
    expect(PRIM_MARCASITE_SPEARHEAD_TWIN).toBeTruthy();
    expect(PRIM_MARCASITE_SPEARHEAD_TWIN.name).toBe('marcasite_spearhead_twin');
  });

  it('has 6 vertices (2 apexes + 4 equator)', () => {
    expect(PRIM_MARCASITE_SPEARHEAD_TWIN.vertices).toHaveLength(6);
  });

  it('has 12 edges (octahedron-like topology)', () => {
    expect(PRIM_MARCASITE_SPEARHEAD_TWIN.edges).toHaveLength(12);
  });

  it('top apex at (0, 1.0, 0) and bottom apex at (0, -0.1, 0)', () => {
    const top = PRIM_MARCASITE_SPEARHEAD_TWIN.vertices[0];
    const bottom = PRIM_MARCASITE_SPEARHEAD_TWIN.vertices[1];
    expect(top).toEqual([0, 1.0, 0]);
    expect(bottom).toEqual([0, -0.1, 0]);
  });

  it('rhombic cross-section: a-axis equator (east/west) > b-axis (north/south)', () => {
    // The defining feature: rhombic cross-section reflects marcasite's
    // orthorhombic symmetry. east/west radii (a) > north/south radii (b).
    const east = PRIM_MARCASITE_SPEARHEAD_TWIN.vertices[2];
    const west = PRIM_MARCASITE_SPEARHEAD_TWIN.vertices[3];
    const north = PRIM_MARCASITE_SPEARHEAD_TWIN.vertices[4];
    const south = PRIM_MARCASITE_SPEARHEAD_TWIN.vertices[5];
    expect(Math.abs(east[0])).toBeGreaterThan(Math.abs(north[2]));
    expect(Math.abs(west[0])).toBeGreaterThan(Math.abs(south[2]));
    // Specific values: a = 0.18, b = 0.10.
    expect(Math.abs(east[0])).toBeCloseTo(0.18, 4);
    expect(Math.abs(north[2])).toBeCloseTo(0.10, 4);
  });

  it('all equator vertices share y=0.45 (the midplane)', () => {
    for (let i = 2; i < 6; i++) {
      expect(PRIM_MARCASITE_SPEARHEAD_TWIN.vertices[i][1]).toBeCloseTo(0.45, 4);
    }
  });

  it('distinct from a regular octahedron — rhombic, not square equator', () => {
    // A regular octahedron has equal equator radii on all 4 axes. The
    // spearhead's rhombic cross-section has east/west (a) ≠ north/south (b),
    // which is the signature distinguishing marcasite's orthorhombic
    // bipyramid from a cubic-class octahedral form.
    const east = PRIM_MARCASITE_SPEARHEAD_TWIN.vertices[2];
    const north = PRIM_MARCASITE_SPEARHEAD_TWIN.vertices[4];
    expect(Math.abs(east[0])).not.toBeCloseTo(Math.abs(north[2]), 4);
    // Specifically: a=0.18 ≠ b=0.10.
    expect(Math.abs(Math.abs(east[0]) - Math.abs(north[2]))).toBeGreaterThan(0.05);
  });
});

describe('marcasite-spearhead-twin — dispatch + cluster', () => {
  function mkMarcasite(opts: Record<string, any> = {}) {
    return {
      crystal_id: 1,
      mineral: 'marcasite',
      habit: 'tabular',
      c_length_mm: 8,
      a_width_mm: 2,
      growth_environment: 'fluid',
      twinned: false,
      twin_law: '',
      ...opts,
    };
  }

  it('twinned marcasite + spearhead → spearhead twin primitive', () => {
    const c = mkMarcasite({ twinned: true, twin_law: 'spearhead' });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_MARCASITE_SPEARHEAD_TWIN);
  });

  it('twinned marcasite + cockscomb → NOT spearhead (separate law)', () => {
    const c = mkMarcasite({ twinned: true, twin_law: 'cockscomb' });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_MARCASITE_SPEARHEAD_TWIN);
  });

  it('untwinned marcasite → canonical (NOT spearhead twin)', () => {
    const c = mkMarcasite({ twinned: false });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_MARCASITE_SPEARHEAD_TWIN);
  });

  it('twinned pyrite with spearhead law → NOT marcasite twin (mineral-scoped)', () => {
    const c = { ...mkMarcasite({ twinned: true, twin_law: 'spearhead' }), mineral: 'pyrite' };
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_MARCASITE_SPEARHEAD_TWIN);
  });

  it('cluster pattern → fan (dense chain of sub-parallel arrowheads — same fan as cockscomb)', () => {
    // v134: spearhead re-routed from 'spike' to 'fan' alongside the
    // cockscomb twin. Both are marcasite twin chain morphologies.
    expect(_clusterPatternKeyForPrim(PRIM_MARCASITE_SPEARHEAD_TWIN)).toBe('fan');
  });
});
