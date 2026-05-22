// tests-js/galena-spinel-twin.test.ts — third iconic twin primitive
//
// v134 (2026-05-22) ships PRIM_GALENA_OCTAHEDRON_TWIN — two octahedra
// sharing a {111} triangular face. The "spinel-law" contact twin
// documented in Ramdohr 1980 §4.3.6 (The Ore Minerals and Their
// Intergrowths) and Boyle 1968 (Cobalt-Ontario silver-galena ores).
// v133 set the twin_law probability to 0.10 per nucleation, so ~10%
// of galena crystals across all scenarios render with this primitive.
//
// Dispatch precedence (in _lookupCrystalPrimitive):
//   1. fluorite penetration check
//   2. selenite swallowtail check
//   3. galena spinel-law check (this test)
//   4. air-mode dripstone override
//   5. canonical primitive (habit-string)
//
// Galena's canonical primitive is PRIM_CUBE (it's isometric, both
// cubic and octahedral habits dispatch to cube in the existing
// table). The twin override bypasses that for spinel-law twins.

import { describe, expect, it } from 'vitest';

declare const PRIM_GALENA_OCTAHEDRON_TWIN: any;
declare const PRIM_CUBE: any;
declare const _lookupCrystalPrimitive: any;

describe('galena-spinel-twin — primitive geometry', () => {
  it('PRIM_GALENA_OCTAHEDRON_TWIN is defined', () => {
    expect(PRIM_GALENA_OCTAHEDRON_TWIN).toBeTruthy();
    expect(PRIM_GALENA_OCTAHEDRON_TWIN.name).toBe('galena_octahedron_twin');
  });

  it('has 12 vertices (6 per octahedron)', () => {
    expect(PRIM_GALENA_OCTAHEDRON_TWIN.vertices).toHaveLength(12);
  });

  it('has 24 edges (12 per octahedron)', () => {
    expect(PRIM_GALENA_OCTAHEDRON_TWIN.edges).toHaveLength(24);
  });

  it('the 3 contact-face vertices coincide between the two octahedra', () => {
    // The {0, 2, 4} face — top apex + east + north — is the {111}
    // contact plane. These 3 vertices are invariant under the
    // reflection that produces the second octahedron, so indices 6
    // (mirror of 0), 8 (mirror of 2), 10 (mirror of 4) should be
    // coincident with their counterparts.
    const v0 = PRIM_GALENA_OCTAHEDRON_TWIN.vertices[0];
    const v6 = PRIM_GALENA_OCTAHEDRON_TWIN.vertices[6];
    const v2 = PRIM_GALENA_OCTAHEDRON_TWIN.vertices[2];
    const v8 = PRIM_GALENA_OCTAHEDRON_TWIN.vertices[8];
    const v4 = PRIM_GALENA_OCTAHEDRON_TWIN.vertices[4];
    const v10 = PRIM_GALENA_OCTAHEDRON_TWIN.vertices[10];
    expect(v6[0]).toBeCloseTo(v0[0], 4);
    expect(v6[1]).toBeCloseTo(v0[1], 4);
    expect(v6[2]).toBeCloseTo(v0[2], 4);
    expect(v8[0]).toBeCloseTo(v2[0], 4);
    expect(v8[1]).toBeCloseTo(v2[1], 4);
    expect(v8[2]).toBeCloseTo(v2[2], 4);
    expect(v10[0]).toBeCloseTo(v4[0], 4);
    expect(v10[1]).toBeCloseTo(v4[1], 4);
    expect(v10[2]).toBeCloseTo(v4[2], 4);
  });

  it('contact-face vertices satisfy the plane equation x+y+z = 1', () => {
    // The contact plane passes through top (0, 1, 0), east (0.55,
    // 0.45, 0), and north (0, 0.45, 0.55). All satisfy x+y+z = 1.
    const v0 = PRIM_GALENA_OCTAHEDRON_TWIN.vertices[0];  // top
    const v2 = PRIM_GALENA_OCTAHEDRON_TWIN.vertices[2];  // east
    const v4 = PRIM_GALENA_OCTAHEDRON_TWIN.vertices[4];  // north
    expect(v0[0] + v0[1] + v0[2]).toBeCloseTo(1.0, 4);
    expect(v2[0] + v2[1] + v2[2]).toBeCloseTo(1.0, 4);
    expect(v4[0] + v4[1] + v4[2]).toBeCloseTo(1.0, 4);
  });

  it('second-octahedron NEW vertices are on the +x+y+z side of contact', () => {
    // The reflected counterparts of 1 (bottom apex), 3 (west), 5
    // (south) — indices 7, 9, 11 — should satisfy x+y+z > 1 because
    // their originals satisfied x+y+z < 1 and reflection across
    // x+y+z=1 swaps signs.
    const v7 = PRIM_GALENA_OCTAHEDRON_TWIN.vertices[7];
    const v9 = PRIM_GALENA_OCTAHEDRON_TWIN.vertices[9];
    const v11 = PRIM_GALENA_OCTAHEDRON_TWIN.vertices[11];
    expect(v7[0] + v7[1] + v7[2]).toBeGreaterThan(1.0);
    expect(v9[0] + v9[1] + v9[2]).toBeGreaterThan(1.0);
    expect(v11[0] + v11[1] + v11[2]).toBeGreaterThan(1.0);
  });

  it('bottom apex (vertex 1) is buried at y=-0.1, mirror (vertex 7) is in cavity', () => {
    // The first octahedron's bottom apex is anchored at the wall
    // (y=-0.1, the PRIM_CUBE convention). Its mirror across the
    // {111} contact plane lifts it out into the cavity along the
    // (1,1,1) direction — should land at roughly y > 0.4.
    const v1 = PRIM_GALENA_OCTAHEDRON_TWIN.vertices[1];
    const v7 = PRIM_GALENA_OCTAHEDRON_TWIN.vertices[7];
    expect(v1[1]).toBeCloseTo(-0.1, 4);
    expect(v7[1]).toBeGreaterThan(0.4);  // lifted well into cavity
    // The bipyramidal axis (from v1 to v7) runs along [1, 1, 1].
    // After normalization, the direction components should be equal.
    const dx = v7[0] - v1[0];
    const dy = v7[1] - v1[1];
    const dz = v7[2] - v1[2];
    expect(dx).toBeCloseTo(dy, 3);
    expect(dy).toBeCloseTo(dz, 3);
  });

  it('per-octahedron edge sets are disjoint (no cross-octahedron edges)', () => {
    const oct1 = PRIM_GALENA_OCTAHEDRON_TWIN.edges.filter((e: number[]) => e[0] < 6 && e[1] < 6);
    const oct2 = PRIM_GALENA_OCTAHEDRON_TWIN.edges.filter((e: number[]) => e[0] >= 6 && e[1] >= 6);
    expect(oct1).toHaveLength(12);
    expect(oct2).toHaveLength(12);
    expect(oct1.length + oct2.length).toBe(24);
  });

  it('reflection is an isometry — preserves pairwise distances within an octahedron', () => {
    // The reflection across the {111} plane is an isometry (preserves
    // distances between any pair of points). Reflection across an
    // off-origin plane does NOT preserve distance-from-origin, so we
    // can't test that. But pairwise distances between vertices of the
    // first octahedron should equal the corresponding pairwise
    // distances in the second.
    const dist = (a: number[], b: number[]) => Math.sqrt(
      (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2,
    );
    for (let i = 0; i < 6; i++) {
      for (let j = i + 1; j < 6; j++) {
        const a1 = PRIM_GALENA_OCTAHEDRON_TWIN.vertices[i];
        const b1 = PRIM_GALENA_OCTAHEDRON_TWIN.vertices[j];
        const a2 = PRIM_GALENA_OCTAHEDRON_TWIN.vertices[i + 6];
        const b2 = PRIM_GALENA_OCTAHEDRON_TWIN.vertices[j + 6];
        expect(dist(a2, b2)).toBeCloseTo(dist(a1, b1), 4);
      }
    }
  });
});

describe('galena-spinel-twin — dispatch precedence in _lookupCrystalPrimitive', () => {
  function mkGalena(opts: Record<string, any> = {}) {
    return {
      crystal_id: 1,
      mineral: 'galena',
      habit: 'octahedral',
      c_length_mm: 5,
      a_width_mm: 5,
      growth_environment: 'fluid',
      twinned: false,
      twin_law: '',
      ...opts,
    };
  }

  it('twinned galena + spinel_law → spinel twin primitive', () => {
    const c = mkGalena({ twinned: true, twin_law: 'spinel_law' });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_GALENA_OCTAHEDRON_TWIN);
  });

  it('untwinned galena → canonical (NOT the twin)', () => {
    // Galena's canonical primitive depends on habit: 'cubic' → PRIM_CUBE,
    // 'octahedral' → PRIM_OCTAHEDRON. We only assert that the twin
    // override doesn't fire here.
    const c = mkGalena({ twinned: false });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_GALENA_OCTAHEDRON_TWIN);
  });

  it('cubic galena defaults to PRIM_CUBE when untwinned', () => {
    // Sanity that the cubic-habit fallback is what dispatch returns
    // for an untwinned cubic-habit galena.
    const c = mkGalena({ twinned: false, habit: 'cubic' });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_CUBE);
  });

  it('twinned galena with empty twin_law → canonical (NOT twin)', () => {
    const c = mkGalena({ twinned: true, twin_law: '' });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_GALENA_OCTAHEDRON_TWIN);
  });

  it('twinned galena with a different twin_law → canonical (NOT twin)', () => {
    const c = mkGalena({ twinned: true, twin_law: 'hypothetical_law' });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_GALENA_OCTAHEDRON_TWIN);
  });

  it('twinned fluorite with spinel_law → NOT the galena twin', () => {
    // Mineral-scoped check: spinel_law on a different mineral falls
    // through (or could hit a future check, but not this one).
    const c = { ...mkGalena({ twinned: true, twin_law: 'spinel_law' }), mineral: 'fluorite' };
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_GALENA_OCTAHEDRON_TWIN);
  });

  it('twinned galena in air-mode cavity → spinel twin (beats dripstone)', () => {
    const c = mkGalena({
      twinned: true, twin_law: 'spinel_law',
      growth_environment: 'air',
    });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_GALENA_OCTAHEDRON_TWIN);
  });

  it('untwinned galena in air-mode → NOT twin (defensive)', () => {
    // Cube + octahedron are both NOT dripstone-eligible, so air-mode
    // also falls through to canonical. Confirm twin doesn't fire
    // either way.
    const c = mkGalena({
      twinned: false,
      growth_environment: 'air',
    });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_GALENA_OCTAHEDRON_TWIN);
  });
});
