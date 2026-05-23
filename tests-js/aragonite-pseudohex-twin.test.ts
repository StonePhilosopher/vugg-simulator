// tests-js/aragonite-pseudohex-twin.test.ts — fourth iconic twin
//
// v134 (2026-05-22) ships PRIM_ARAGONITE_PSEUDOHEX_TWIN — three
// tabular orthorhombic prisms at 60° spacing around the c-axis,
// interpenetrating to form a pseudo-hexagonal column (Dana 8th ed.
// CaCO3 section; Speer 1983 "Aragonite" Reviews in Mineralogy v.11).
// v133's data has cyclic_sextet at p=0.40 per nucleation, so about
// 40% of aragonite crystals carry this twin.
//
// "Sextet" naming: each of the 3 tabular crystals contributes 2
// {110}-type broad faces; 3 × 2 = 6 visible faces around the
// column, the "sextet" of the law name.
//
// Dispatch precedence (in _lookupCrystalPrimitive):
//   1. fluorite penetration
//   2. selenite swallowtail
//   3. galena spinel-law
//   4. aragonite cyclic-sextet (this test)
//   5. air-mode dripstone
//   6. canonical habit dispatch
//
// Aragonite also has a 'contact' twin law in data/minerals.json
// (p=0.05, separate from cyclic_sextet). The cyclic_sextet dispatch
// does NOT fire for 'contact' — that's a different twin geometry
// (single contact, not 3-fold cyclic) and would need its own
// primitive (deferred).

import { describe, expect, it } from 'vitest';

declare const PRIM_ARAGONITE_PSEUDOHEX_TWIN: any;
declare const _lookupCrystalPrimitive: any;

describe('aragonite-pseudohex-twin — primitive geometry', () => {
  it('PRIM_ARAGONITE_PSEUDOHEX_TWIN is defined', () => {
    expect(PRIM_ARAGONITE_PSEUDOHEX_TWIN).toBeTruthy();
    expect(PRIM_ARAGONITE_PSEUDOHEX_TWIN.name).toBe('aragonite_pseudohex_twin');
  });

  it('has 24 vertices (8 per prism × 3 prisms)', () => {
    expect(PRIM_ARAGONITE_PSEUDOHEX_TWIN.vertices).toHaveLength(24);
  });

  it('has 36 edges (12 per prism × 3 prisms)', () => {
    expect(PRIM_ARAGONITE_PSEUDOHEX_TWIN.edges).toHaveLength(36);
  });

  it('bottom 12 vertices are anchored at y=-0.1 (wall)', () => {
    // Per the loop ordering (xl, yl, zl), the bottom-y corners of
    // each prism are at yl-index 0 → vertex indices 0, 1, 4, 5 within
    // a prism. With 3 prisms (offsets 0, 8, 16), the "bottom" set is
    // {0, 1, 4, 5, 8, 9, 12, 13, 16, 17, 20, 21}.
    const bottomIdx = [0, 1, 4, 5, 8, 9, 12, 13, 16, 17, 20, 21];
    for (const i of bottomIdx) {
      expect(PRIM_ARAGONITE_PSEUDOHEX_TWIN.vertices[i][1]).toBeCloseTo(-0.1, 4);
    }
  });

  it('top 12 vertices are at y=1.0', () => {
    const topIdx = [2, 3, 6, 7, 10, 11, 14, 15, 18, 19, 22, 23];
    for (const i of topIdx) {
      expect(PRIM_ARAGONITE_PSEUDOHEX_TWIN.vertices[i][1]).toBeCloseTo(1.0, 4);
    }
  });

  it('prism 1 (offset 8) is rotated 60° from prism 0', () => {
    // Vertex 0 of each prism is the local (xl=-a, yl=yMin, zl=-b)
    // corner. Prism 0 has it at world (-a, -0.1, -b) = (-0.10, -0.1,
    // -0.30). Prism 1 rotates that corner by 60° around y:
    //   wx = -a·cos60° - (-b)·sin60° = -0.10·0.5 + 0.30·0.866 = 0.210
    //   wz = -a·sin60° + (-b)·cos60° = -0.10·0.866 + (-0.30)·0.5 = -0.236
    const v0 = PRIM_ARAGONITE_PSEUDOHEX_TWIN.vertices[0];
    const v8 = PRIM_ARAGONITE_PSEUDOHEX_TWIN.vertices[8];
    expect(v0[0]).toBeCloseTo(-0.10, 4);
    expect(v0[2]).toBeCloseTo(-0.30, 4);
    expect(v8[0]).toBeCloseTo(-0.10 * Math.cos(Math.PI / 3) - (-0.30) * Math.sin(Math.PI / 3), 4);
    expect(v8[2]).toBeCloseTo(-0.10 * Math.sin(Math.PI / 3) + (-0.30) * Math.cos(Math.PI / 3), 4);
  });

  it('prism 2 (offset 16) is rotated 120° from prism 0', () => {
    const v0 = PRIM_ARAGONITE_PSEUDOHEX_TWIN.vertices[0];
    const v16 = PRIM_ARAGONITE_PSEUDOHEX_TWIN.vertices[16];
    // Same vertex rotated by 120°.
    expect(v16[0]).toBeCloseTo(v0[0] * Math.cos(2 * Math.PI / 3) - v0[2] * Math.sin(2 * Math.PI / 3), 4);
    expect(v16[2]).toBeCloseTo(v0[0] * Math.sin(2 * Math.PI / 3) + v0[2] * Math.cos(2 * Math.PI / 3), 4);
  });

  it('each prism preserves distance-from-y-axis (rigid rotation)', () => {
    // Rotation around y-axis preserves √(x² + z²) per vertex.
    const distXZ = (v: number[]) => Math.sqrt(v[0] * v[0] + v[2] * v[2]);
    for (let i = 0; i < 8; i++) {
      const v_p0 = PRIM_ARAGONITE_PSEUDOHEX_TWIN.vertices[i];
      const v_p1 = PRIM_ARAGONITE_PSEUDOHEX_TWIN.vertices[i + 8];
      const v_p2 = PRIM_ARAGONITE_PSEUDOHEX_TWIN.vertices[i + 16];
      expect(distXZ(v_p1)).toBeCloseTo(distXZ(v_p0), 4);
      expect(distXZ(v_p2)).toBeCloseTo(distXZ(v_p0), 4);
    }
  });

  it('per-prism edge sets are disjoint (no cross-prism edges)', () => {
    const p0 = PRIM_ARAGONITE_PSEUDOHEX_TWIN.edges.filter((e: number[]) => e[0] < 8 && e[1] < 8);
    const p1 = PRIM_ARAGONITE_PSEUDOHEX_TWIN.edges.filter((e: number[]) => e[0] >= 8 && e[0] < 16 && e[1] >= 8 && e[1] < 16);
    const p2 = PRIM_ARAGONITE_PSEUDOHEX_TWIN.edges.filter((e: number[]) => e[0] >= 16 && e[1] >= 16);
    expect(p0).toHaveLength(12);
    expect(p1).toHaveLength(12);
    expect(p2).toHaveLength(12);
  });

  it('XZ cross-section radius bounded by sqrt(a² + b²) ≈ 0.316', () => {
    // The furthest XZ corner of each prism is at (±a, ±b) → radius
    // √(a²+b²) = √(0.01 + 0.09) = √0.10 ≈ 0.316. All rotated copies
    // sit at the same radius.
    const rMax = Math.sqrt(0.10 * 0.10 + 0.30 * 0.30) + 1e-4;
    for (const v of PRIM_ARAGONITE_PSEUDOHEX_TWIN.vertices) {
      const r = Math.sqrt(v[0] * v[0] + v[2] * v[2]);
      expect(r).toBeLessThanOrEqual(rMax);
    }
  });
});

describe('aragonite-pseudohex-twin — dispatch precedence', () => {
  function mkAragonite(opts: Record<string, any> = {}) {
    return {
      crystal_id: 1,
      mineral: 'aragonite',
      habit: 'columnar',
      c_length_mm: 8,
      a_width_mm: 3,
      growth_environment: 'fluid',
      twinned: false,
      twin_law: '',
      ...opts,
    };
  }

  it('twinned aragonite + cyclic_sextet → pseudohex twin primitive', () => {
    const c = mkAragonite({ twinned: true, twin_law: 'cyclic_sextet' });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_ARAGONITE_PSEUDOHEX_TWIN);
  });

  it('untwinned aragonite → canonical (NOT pseudohex twin)', () => {
    const c = mkAragonite({ twinned: false });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_ARAGONITE_PSEUDOHEX_TWIN);
  });

  it('twinned aragonite with empty twin_law → canonical (defensive)', () => {
    const c = mkAragonite({ twinned: true, twin_law: '' });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_ARAGONITE_PSEUDOHEX_TWIN);
  });

  it('twinned aragonite with "contact" twin_law → NOT pseudohex (different geometry)', () => {
    // The 'contact' twin (p=0.05 in v133's data) is a single-contact
    // twin on {110}, distinct from the cyclic 3-fold sextet. It should
    // fall through to canonical, NOT route to the pseudo-hex primitive.
    // (A future commit could add a separate PRIM_ARAGONITE_CONTACT_TWIN
    // — for now it just gets the canonical habit primitive.)
    const c = mkAragonite({ twinned: true, twin_law: 'contact' });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_ARAGONITE_PSEUDOHEX_TWIN);
  });

  it('twinned cerussite with cyclic_sextet → NOT aragonite twin (mineral-scoped)', () => {
    // Cerussite has its own 'cyclic_sixling' law (similar but stellate
    // morphology, deferred). Even with a hypothetical 'cyclic_sextet'
    // tag, cerussite shouldn't route to aragonite's primitive.
    const c = { ...mkAragonite({ twinned: true, twin_law: 'cyclic_sextet' }), mineral: 'cerussite' };
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_ARAGONITE_PSEUDOHEX_TWIN);
  });

  it('twinned aragonite in air-mode cavity → twin primitive (beats dripstone)', () => {
    const c = mkAragonite({
      twinned: true, twin_law: 'cyclic_sextet',
      growth_environment: 'air',
    });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_ARAGONITE_PSEUDOHEX_TWIN);
  });

  it('twinned aragonite with acicular_needle habit still resolves to twin', () => {
    // Twin override is mineral+law-scoped, ignores habit. Even with
    // acicular habit (which would otherwise go to PRIM_ACICULAR), the
    // twinned crystal renders as the pseudo-hex.
    const c = mkAragonite({ twinned: true, twin_law: 'cyclic_sextet', habit: 'acicular_needle' });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_ARAGONITE_PSEUDOHEX_TWIN);
  });
});
