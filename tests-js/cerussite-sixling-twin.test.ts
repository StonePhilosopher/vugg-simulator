// tests-js/cerussite-sixling-twin.test.ts — fifth iconic twin
//
// v134 (2026-05-22) ships PRIM_CERUSSITE_SIXLING_TWIN — three thin
// blades lying flat in the wall plane (XZ), each rotated 60° around
// the wall normal (+Y). Each blade extends through origin in both
// radial directions, so 3 blades × 2 arms = 6 arms — the canonical
// stellate "sixling" morphology documented in Dana 8th ed. PbCO3
// section and Heinrich & Vian 1967 (American Mineralogist v.52,
// p.1747) for MVT cerussite. v133 has cyclic_sixling at p=0.40.
//
// Distinction from aragonite cyclic-sextet:
//   Aragonite (vertical column): blade long-axis = +Y
//   Cerussite (flat star):       blade long-axis lies in XZ plane

import { describe, expect, it } from 'vitest';

declare const PRIM_CERUSSITE_SIXLING_TWIN: any;
declare const _lookupCrystalPrimitive: any;

describe('cerussite-sixling-twin — primitive geometry', () => {
  it('PRIM_CERUSSITE_SIXLING_TWIN is defined', () => {
    expect(PRIM_CERUSSITE_SIXLING_TWIN).toBeTruthy();
    expect(PRIM_CERUSSITE_SIXLING_TWIN.name).toBe('cerussite_sixling_twin');
  });

  it('has 24 vertices (8 per blade × 3 blades)', () => {
    expect(PRIM_CERUSSITE_SIXLING_TWIN.vertices).toHaveLength(24);
  });

  it('has 36 edges (12 per blade × 3 blades)', () => {
    expect(PRIM_CERUSSITE_SIXLING_TWIN.edges).toHaveLength(36);
  });

  it('vertices are flat against the wall — y range is [-0.1, 0.0]', () => {
    // The stellate twin's "thin" dimension is Y. yMin=-0.1 (at the
    // wall, PRIM_CUBE convention) and yMax=0.0 (slightly above wall).
    // Total Y thickness is 0.1 — much less than the radial extent.
    for (const v of PRIM_CERUSSITE_SIXLING_TWIN.vertices) {
      expect(v[1]).toBeGreaterThanOrEqual(-0.1 - 1e-6);
      expect(v[1]).toBeLessThanOrEqual(0.0 + 1e-6);
      // Exactly one of {-0.1, 0.0} per loop ordering.
      const isMinY = Math.abs(v[1] - (-0.1)) < 1e-6;
      const isMaxY = Math.abs(v[1] - 0.0) < 1e-6;
      expect(isMinY || isMaxY).toBe(true);
    }
  });

  it('the 6 arm tips lie in the XZ plane at radius c_long=0.55', () => {
    // The arm tips are the corners at xl = ±c_long, zl = small ±b_tan
    // (negligible tangential offset). For an arm at angle θ, the tip
    // is at world (c_long·cosθ, _, c_long·sinθ) roughly. Six arms at
    // 0°, 60°, 120°, 180°, 240°, 300°.
    //
    // Per loop ordering: vertex indices (0..7) per blade have xl as
    // outer loop. So indices 0..3 are at xl=-c_long, indices 4..7 at
    // xl=+c_long. The "arm tip" vertices are the 8 outer corners.
    // Their distance from y-axis (sqrt(x² + z²)) should be ≈ sqrt(c_long² + b_tan²) ≈ 0.556.
    const expectedR = Math.sqrt(0.55 * 0.55 + 0.08 * 0.08);
    for (let k = 0; k < 3; k++) {
      const off = k * 8;
      for (let i = 0; i < 8; i++) {
        const v = PRIM_CERUSSITE_SIXLING_TWIN.vertices[off + i];
        const r = Math.sqrt(v[0] * v[0] + v[2] * v[2]);
        expect(r).toBeCloseTo(expectedR, 4);
      }
    }
  });

  it('blade 1 (offset 8) is rotated 60° from blade 0', () => {
    // Vertex 0 of blade 0: (xl, yl, zl) = (-c_long, yMin, -b_tan) =
    // (-0.55, -0.1, -0.08). Vertex 8 = same local coords rotated 60°.
    const v0 = PRIM_CERUSSITE_SIXLING_TWIN.vertices[0];
    const v8 = PRIM_CERUSSITE_SIXLING_TWIN.vertices[8];
    const cT = Math.cos(Math.PI / 3);
    const sT = Math.sin(Math.PI / 3);
    expect(v8[0]).toBeCloseTo(-0.55 * cT - (-0.08) * sT, 4);
    expect(v8[2]).toBeCloseTo(-0.55 * sT + (-0.08) * cT, 4);
    expect(v8[1]).toBeCloseTo(v0[1], 4);  // Y unchanged by rotation around Y
  });

  it('blade 2 (offset 16) is rotated 120° from blade 0', () => {
    const v0 = PRIM_CERUSSITE_SIXLING_TWIN.vertices[0];
    const v16 = PRIM_CERUSSITE_SIXLING_TWIN.vertices[16];
    const cT = Math.cos(2 * Math.PI / 3);
    const sT = Math.sin(2 * Math.PI / 3);
    expect(v16[0]).toBeCloseTo(v0[0] * cT - v0[2] * sT, 4);
    expect(v16[2]).toBeCloseTo(v0[0] * sT + v0[2] * cT, 4);
    expect(v16[1]).toBeCloseTo(v0[1], 4);
  });

  it('flat — Y extent (0.1) is much smaller than XZ extent (1.1)', () => {
    // Sanity check that this primitive is genuinely flat against the
    // wall, not a cube-like equant block. The xMax - xMin range should
    // be much larger than yMax - yMin.
    let minY = Infinity, maxY = -Infinity;
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const v of PRIM_CERUSSITE_SIXLING_TWIN.vertices) {
      if (v[0] < minX) minX = v[0];
      if (v[0] > maxX) maxX = v[0];
      if (v[1] < minY) minY = v[1];
      if (v[1] > maxY) maxY = v[1];
      if (v[2] < minZ) minZ = v[2];
      if (v[2] > maxZ) maxZ = v[2];
    }
    expect(maxY - minY).toBeLessThan(0.15);
    expect(maxX - minX).toBeGreaterThan(1.0);
    expect(maxZ - minZ).toBeGreaterThan(1.0);
  });

  it('per-blade edge sets are disjoint (no cross-blade edges)', () => {
    const b0 = PRIM_CERUSSITE_SIXLING_TWIN.edges.filter((e: number[]) => e[0] < 8 && e[1] < 8);
    const b1 = PRIM_CERUSSITE_SIXLING_TWIN.edges.filter((e: number[]) => e[0] >= 8 && e[0] < 16 && e[1] >= 8 && e[1] < 16);
    const b2 = PRIM_CERUSSITE_SIXLING_TWIN.edges.filter((e: number[]) => e[0] >= 16 && e[1] >= 16);
    expect(b0).toHaveLength(12);
    expect(b1).toHaveLength(12);
    expect(b2).toHaveLength(12);
  });
});

describe('cerussite-sixling-twin — dispatch precedence', () => {
  function mkCerussite(opts: Record<string, any> = {}) {
    return {
      crystal_id: 1,
      mineral: 'cerussite',
      habit: 'tabular_single',
      c_length_mm: 6,
      a_width_mm: 3,
      growth_environment: 'fluid',
      twinned: false,
      twin_law: '',
      ...opts,
    };
  }

  it('twinned cerussite + cyclic_sixling → sixling twin primitive', () => {
    const c = mkCerussite({ twinned: true, twin_law: 'cyclic_sixling' });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_CERUSSITE_SIXLING_TWIN);
  });

  it('untwinned cerussite → canonical (NOT sixling twin)', () => {
    const c = mkCerussite({ twinned: false });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_CERUSSITE_SIXLING_TWIN);
  });

  it('twinned cerussite with empty twin_law → canonical', () => {
    const c = mkCerussite({ twinned: true, twin_law: '' });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_CERUSSITE_SIXLING_TWIN);
  });

  it('twinned cerussite with a different twin_law → canonical', () => {
    const c = mkCerussite({ twinned: true, twin_law: 'hypothetical_other' });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_CERUSSITE_SIXLING_TWIN);
  });

  it('twinned aragonite with cyclic_sixling → NOT cerussite twin (mineral-scoped)', () => {
    // Aragonite has 'cyclic_sextet' (vertical column), not 'cyclic_sixling'.
    // The mineral-scoping ensures even if aragonite somehow had this law,
    // it would route to its own twin or fall through, not to cerussite's.
    const c = { ...mkCerussite({ twinned: true, twin_law: 'cyclic_sixling' }), mineral: 'aragonite' };
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_CERUSSITE_SIXLING_TWIN);
  });

  it('twinned cerussite in air-mode cavity → sixling twin (beats dripstone)', () => {
    const c = mkCerussite({
      twinned: true, twin_law: 'cyclic_sixling',
      growth_environment: 'air',
    });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_CERUSSITE_SIXLING_TWIN);
  });

  it('twinned cerussite with acicular_needles habit still resolves to sixling twin', () => {
    const c = mkCerussite({ twinned: true, twin_law: 'cyclic_sixling', habit: 'acicular_needles' });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_CERUSSITE_SIXLING_TWIN);
  });
});
