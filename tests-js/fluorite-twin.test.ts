// tests-js/fluorite-twin.test.ts — first iconic twin primitive
//
// v134 (2026-05-22) ships PRIM_FLUORITE_PENETRATION_TWIN — two
// interpenetrating cubes rotated 60° around their shared body diagonal
// [1,1,1]/√3, the canonical Weardale Cumbria / Cave-in-Rock fluorite
// signature (Sunagawa 2005 §6.4; Dana 8th ed CaF2 section). The
// _rollSpontaneousTwin function in 85b-simulator-nucleate.ts sets
// crystal.twinned = true and crystal.twin_law = 'penetration' on ~12%
// of fluorite nucleations (per v133's twin_laws[].probability bump).
// This primitive is what _lookupCrystalPrimitive returns when that
// flag combination is set.
//
// Dispatch precedence (in _lookupCrystalPrimitive):
//   1. Twin override (this commit)        — runs first
//   2. Air-mode dripstone override         — runs only if twin override didn't fire
//   3. Canonical primitive (habit-string)  — fallback
//
// Twins win over air-mode because real twinned fluorite in a drained
// cavity is still a twin (cubes don't drip into stalactites just because
// the cavity drained).

import { describe, expect, it } from 'vitest';

declare const PRIM_FLUORITE_PENETRATION_TWIN: any;
declare const PRIM_CUBE: any;
declare const _lookupCrystalPrimitive: any;

describe('fluorite-twin — primitive geometry', () => {
  it('PRIM_FLUORITE_PENETRATION_TWIN is defined', () => {
    expect(PRIM_FLUORITE_PENETRATION_TWIN).toBeTruthy();
    expect(PRIM_FLUORITE_PENETRATION_TWIN.name).toBe('fluorite_penetration_twin');
  });

  it('has 16 vertices (8 per cube, kept as 16 for edge-index simplicity)', () => {
    expect(PRIM_FLUORITE_PENETRATION_TWIN.vertices).toHaveLength(16);
  });

  it('has 24 edges (12 per cube)', () => {
    expect(PRIM_FLUORITE_PENETRATION_TWIN.edges).toHaveLength(24);
  });

  it('body-diagonal endpoints coincide between the two cubes (rotation axis)', () => {
    // Vertex 0 of cube A and vertex 8 of cube B both sit on the
    // body-diagonal rotation axis at the (-,-,-) corner. Same for 7
    // and 15 at (+,+,+). After 60° rotation around [1,1,1]/√3,
    // points on the axis are invariant.
    const v0 = PRIM_FLUORITE_PENETRATION_TWIN.vertices[0];
    const v8 = PRIM_FLUORITE_PENETRATION_TWIN.vertices[8];
    expect(v8[0]).toBeCloseTo(v0[0], 4);
    expect(v8[1]).toBeCloseTo(v0[1], 4);
    expect(v8[2]).toBeCloseTo(v0[2], 4);
    const v7 = PRIM_FLUORITE_PENETRATION_TWIN.vertices[7];
    const v15 = PRIM_FLUORITE_PENETRATION_TWIN.vertices[15];
    expect(v15[0]).toBeCloseTo(v7[0], 4);
    expect(v15[1]).toBeCloseTo(v7[1], 4);
    expect(v15[2]).toBeCloseTo(v7[2], 4);
  });

  it('non-axis vertices DO move under the 60° rotation', () => {
    // A vertex not on the body diagonal (e.g. vertex 1, the (-,-,+)
    // corner) should be at a different position in cube B.
    const v1 = PRIM_FLUORITE_PENETRATION_TWIN.vertices[1];
    const v9 = PRIM_FLUORITE_PENETRATION_TWIN.vertices[9];
    // At least one coordinate should differ meaningfully.
    const dx = Math.abs(v9[0] - v1[0]);
    const dy = Math.abs(v9[1] - v1[1]);
    const dz = Math.abs(v9[2] - v1[2]);
    expect(Math.max(dx, dy, dz)).toBeGreaterThan(0.1);
  });

  it('rotation preserves vertex length from center (proper rotation, not skew)', () => {
    // Each rotated vertex should be the same distance from the rotation
    // center (y=0.45) as its pre-rotation counterpart. Tests that R is
    // a real rotation matrix.
    const ctrY = 0.45;
    const dist = (v: number[]) => Math.sqrt(v[0]*v[0] + (v[1]-ctrY)*(v[1]-ctrY) + v[2]*v[2]);
    for (let i = 0; i < 8; i++) {
      const orig = PRIM_FLUORITE_PENETRATION_TWIN.vertices[i];
      const rot = PRIM_FLUORITE_PENETRATION_TWIN.vertices[i + 8];
      expect(dist(rot)).toBeCloseTo(dist(orig), 4);
    }
  });

  it('cube A has 12 edges; cube B has 12 edges; no cross-cube edges', () => {
    // All cube-A edges have both endpoints in [0, 7].
    // All cube-B edges have both endpoints in [8, 15].
    const cubeA = PRIM_FLUORITE_PENETRATION_TWIN.edges.filter((e: number[]) => e[0] < 8 && e[1] < 8);
    const cubeB = PRIM_FLUORITE_PENETRATION_TWIN.edges.filter((e: number[]) => e[0] >= 8 && e[1] >= 8);
    expect(cubeA).toHaveLength(12);
    expect(cubeB).toHaveLength(12);
    expect(cubeA.length + cubeB.length).toBe(24);  // no edges crossing between the cubes
  });
});

describe('fluorite-twin — dispatch precedence in _lookupCrystalPrimitive', () => {
  function mkFluorite(opts: Record<string, any> = {}) {
    return {
      crystal_id: 1,
      mineral: 'fluorite',
      habit: 'cubic',
      c_length_mm: 5,
      a_width_mm: 5,
      growth_environment: 'fluid',
      twinned: false,
      twin_law: '',
      ...opts,
    };
  }

  it('twinned fluorite + penetration law → twin primitive', () => {
    const c = mkFluorite({ twinned: true, twin_law: 'penetration' });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_FLUORITE_PENETRATION_TWIN);
  });

  it('untwinned fluorite → regular cube (no twin geometry)', () => {
    const c = mkFluorite({ twinned: false });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_CUBE);
  });

  it('twinned fluorite with empty twin_law → regular cube (defensive)', () => {
    // _rollSpontaneousTwin only sets twin_law to a non-empty string when
    // a roll succeeds, but defensive code in the renderer should still
    // do the right thing if twin_law happens to be empty.
    const c = mkFluorite({ twinned: true, twin_law: '' });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_CUBE);
  });

  it('twinned fluorite with a different twin_law → regular cube', () => {
    // A hypothetical future fluorite twin (e.g. {110} cyclic) shouldn't
    // be dispatched to the penetration-twin primitive. Only the exact
    // 'penetration' law name triggers this primitive.
    const c = mkFluorite({ twinned: true, twin_law: 'hypothetical_other_twin' });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_CUBE);
  });

  it('twinned galena with penetration law → NOT the fluorite twin', () => {
    // The dispatch is mineral-specific. Galena's spinel-law twin is
    // {111} contact (not penetration), but even if a galena crystal
    // somehow ended up with twin_law='penetration' the dispatch would
    // route it to galena's PRIM_CUBE, not to the fluorite twin.
    const c = { ...mkFluorite({ twinned: true, twin_law: 'penetration' }), mineral: 'galena' };
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_CUBE);
  });

  it('twinned fluorite in air-mode cavity → twin primitive (twin beats dripstone)', () => {
    // Twins win over the air-mode dripstone override. A fluorite cube
    // in a drained cavity is still a twin, not a stalactite — real
    // cubes don't drip into icicles.
    const c = mkFluorite({
      twinned: true, twin_law: 'penetration',
      growth_environment: 'air',
    });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_FLUORITE_PENETRATION_TWIN);
  });

  it('untwinned fluorite in air-mode cavity → dripstone (default path still works)', () => {
    // Sanity: when the twin override doesn't fire, the air-mode
    // dispatch still applies. But fluorite (cubic) is NOT
    // dripstone-eligible, so it stays a cube. Confirming the dispatch
    // order is correct.
    const c = mkFluorite({
      twinned: false,
      growth_environment: 'air',
    });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_CUBE);
  });
});
