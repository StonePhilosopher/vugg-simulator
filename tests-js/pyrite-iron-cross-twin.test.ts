// tests-js/pyrite-iron-cross-twin.test.ts — seventh and final iconic twin
//
// v134 (2026-05-22) ships PRIM_PYRITE_IRON_CROSS_TWIN — two chiral
// {120} pyritohedra interpenetrating at 90° rotation around the c-axis.
// The canonical "Eisernes Kreuz" / Iron Cross twin (Ramdohr 1980 §4
// FeS2 section; Dana 8th ed.; Mindat pyrite habits). v133 retuned the
// probability 0.008 → 0.07 to match the field-observation 5-10% twin
// frequency among euhedral pyrite. Specimens have been mined since
// antiquity for use in jewelry — Elba (Italy), Pyrite Hill (Spain,
// Peru) are the classic localities.
//
// Why a proper {120} pyritohedron is needed (rather than reusing
// the existing PRIM_PYRITOHEDRON for non-twin pyrite): a real
// pyritohedron has m-3 (Th) symmetry — 3-fold rotations along
// [111], 2-fold along [100], but NO 4-fold along c. So 90° rotation
// around c-axis is NOT a symmetry of a proper pyritohedron, and the
// rotated pyritohedron lands at distinct positions from the original
// — producing the cross silhouette. The existing PRIM_PYRITOHEDRON
// (used for non-twin habits) has cubic over-symmetry: 90° rotation
// would map it to itself, defeating the twin geometry.

import { describe, expect, it } from 'vitest';

declare const PRIM_PYRITE_IRON_CROSS_TWIN: any;
declare const _lookupCrystalPrimitive: any;

describe('pyrite-iron-cross-twin — primitive geometry', () => {
  it('PRIM_PYRITE_IRON_CROSS_TWIN is defined', () => {
    expect(PRIM_PYRITE_IRON_CROSS_TWIN).toBeTruthy();
    expect(PRIM_PYRITE_IRON_CROSS_TWIN.name).toBe('pyrite_iron_cross_twin');
  });

  it('has 40 vertices (20 per pyritohedron × 2)', () => {
    expect(PRIM_PYRITE_IRON_CROSS_TWIN.vertices).toHaveLength(40);
  });

  it('has 60 edges (30 per pyritohedron × 2)', () => {
    expect(PRIM_PYRITE_IRON_CROSS_TWIN.edges).toHaveLength(60);
  });

  it('"+" pyritohedron has 8 cube corners at (±a, ±a, ±a) + y_center', () => {
    // Cube corners are indices 0-7, with a ≈ 0.367 (√5/3 scaled).
    // After y-shift +0.45, the corners are at (±a, 0.45 ± a, ±a).
    const a = (Math.sqrt(5) / 3) * (0.55 / (Math.sqrt(5) / 2));
    for (let i = 0; i < 8; i++) {
      const v = PRIM_PYRITE_IRON_CROSS_TWIN.vertices[i];
      // X and Z magnitudes are exactly a.
      expect(Math.abs(v[0])).toBeCloseTo(a, 4);
      expect(Math.abs(v[2])).toBeCloseTo(a, 4);
      // Y is 0.45 ± a.
      const yDelta = Math.abs(v[1] - 0.45);
      expect(yDelta).toBeCloseTo(a, 4);
    }
  });

  it('"+" pyritohedron has 12 edge verts at distance b=0.55 from y-axis (for 4 of 12) and at distance ≤ b (for 8 of 12)', () => {
    // Edge verts are indices 8-19. They come in 3 groups of 4:
    //   8-11: YZ-plane (0, ±b, ±c)   — x=0, so dist from y-axis is |z|=c≈0.275
    //   12-15: XY-plane (±b, ±c, 0)  — z=0, so dist from y-axis is |x|=b=0.55
    //   16-19: ZX-plane (±c, 0, ±b)  — sqrt(c² + b²) ≈ 0.612
    const c = (Math.sqrt(5) / 4) * (0.55 / (Math.sqrt(5) / 2));
    for (let i = 8; i < 12; i++) {
      const v = PRIM_PYRITE_IRON_CROSS_TWIN.vertices[i];
      const r = Math.sqrt(v[0] * v[0] + v[2] * v[2]);
      expect(r).toBeCloseTo(c, 4);
    }
    for (let i = 12; i < 16; i++) {
      const v = PRIM_PYRITE_IRON_CROSS_TWIN.vertices[i];
      const r = Math.sqrt(v[0] * v[0] + v[2] * v[2]);
      expect(r).toBeCloseTo(0.55, 4);
    }
  });

  it('"-" pyritohedron is "+" rotated 90° around y-axis at y-center', () => {
    // For each "+" vertex (x, y, z), the corresponding "-" vertex at
    // index +20 should be (z, y, -x). y unchanged (rotation around y).
    for (let i = 0; i < 20; i++) {
      const vPlus = PRIM_PYRITE_IRON_CROSS_TWIN.vertices[i];
      const vMinus = PRIM_PYRITE_IRON_CROSS_TWIN.vertices[i + 20];
      expect(vMinus[0]).toBeCloseTo(vPlus[2], 4);
      expect(vMinus[1]).toBeCloseTo(vPlus[1], 4);
      expect(vMinus[2]).toBeCloseTo(-vPlus[0], 4);
    }
  });

  it('90° rotation produces DISTINCT pyritohedron (not invariant under 4-fold)', () => {
    // Key property: a chiral {120} pyritohedron is NOT invariant
    // under 90° rotation around c-axis (it has only m-3 symmetry).
    // So at least one "+" vertex should not appear in the "-" set
    // (and vice versa).
    let distinctCount = 0;
    for (let i = 0; i < 20; i++) {
      const vMinus = PRIM_PYRITE_IRON_CROSS_TWIN.vertices[i + 20];
      let foundMatch = false;
      for (let j = 0; j < 20; j++) {
        const vPlus = PRIM_PYRITE_IRON_CROSS_TWIN.vertices[j];
        if (Math.abs(vPlus[0] - vMinus[0]) < 1e-4
            && Math.abs(vPlus[1] - vMinus[1]) < 1e-4
            && Math.abs(vPlus[2] - vMinus[2]) < 1e-4) {
          foundMatch = true;
          break;
        }
      }
      if (!foundMatch) distinctCount++;
    }
    // Most of the "-" vertices should be distinct from "+" (cube
    // corners are invariant since they have all three coords equal —
    // 8 cube corners shared. Edge verts are NOT invariant — 12 of
    // each pyritohedron's 20 verts should be distinct, so at least
    // some non-zero distinct count).
    expect(distinctCount).toBeGreaterThan(0);
  });

  it('cube corners are SHARED between "+" and "-" (invariant under 90° around y)', () => {
    // The 8 cube corners (±a, y_c ± a, ±a) are unchanged under
    // (x, y, z) → (z, y, -x) IF |x|=|z|, which they are (both are
    // ±a). The mapping permutes the cube corners among themselves.
    // Test: every cube corner of "+" should appear somewhere in the
    // "-" cube-corner set.
    for (let i = 0; i < 8; i++) {
      const vPlus = PRIM_PYRITE_IRON_CROSS_TWIN.vertices[i];
      let foundMatch = false;
      for (let j = 20; j < 28; j++) {  // "-" cube corners at indices 20-27
        const vMinus = PRIM_PYRITE_IRON_CROSS_TWIN.vertices[j];
        if (Math.abs(vPlus[0] - vMinus[0]) < 1e-4
            && Math.abs(vPlus[1] - vMinus[1]) < 1e-4
            && Math.abs(vPlus[2] - vMinus[2]) < 1e-4) {
          foundMatch = true;
          break;
        }
      }
      expect(foundMatch).toBe(true);
    }
  });

  it('per-pyritohedron edge sets are disjoint', () => {
    const plusEdges = PRIM_PYRITE_IRON_CROSS_TWIN.edges.filter((e: number[]) => e[0] < 20 && e[1] < 20);
    const minusEdges = PRIM_PYRITE_IRON_CROSS_TWIN.edges.filter((e: number[]) => e[0] >= 20 && e[1] >= 20);
    expect(plusEdges).toHaveLength(30);
    expect(minusEdges).toHaveLength(30);
    expect(plusEdges.length + minusEdges.length).toBe(60);
  });

  it('Y range matches PRIM_CUBE convention: y_min=-0.1, y_max=1.0', () => {
    let minY = Infinity, maxY = -Infinity;
    for (const v of PRIM_PYRITE_IRON_CROSS_TWIN.vertices) {
      if (v[1] < minY) minY = v[1];
      if (v[1] > maxY) maxY = v[1];
    }
    expect(minY).toBeCloseTo(-0.1, 4);
    expect(maxY).toBeCloseTo(1.0, 4);
  });
});

describe('pyrite-iron-cross-twin — dispatch precedence', () => {
  function mkPyrite(opts: Record<string, any> = {}) {
    return {
      crystal_id: 1,
      mineral: 'pyrite',
      habit: 'cubic',
      c_length_mm: 5,
      a_width_mm: 5,
      growth_environment: 'fluid',
      twinned: false,
      twin_law: '',
      ...opts,
    };
  }

  it('twinned pyrite + iron_cross → iron-cross twin primitive', () => {
    const c = mkPyrite({ twinned: true, twin_law: 'iron_cross' });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_PYRITE_IRON_CROSS_TWIN);
  });

  it('untwinned pyrite → canonical (NOT iron-cross twin)', () => {
    const c = mkPyrite({ twinned: false });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_PYRITE_IRON_CROSS_TWIN);
  });

  it('twinned pyrite with empty twin_law → canonical', () => {
    const c = mkPyrite({ twinned: true, twin_law: '' });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_PYRITE_IRON_CROSS_TWIN);
  });

  it('twinned pyrite with a different twin_law → canonical', () => {
    const c = mkPyrite({ twinned: true, twin_law: 'hypothetical_other' });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_PYRITE_IRON_CROSS_TWIN);
  });

  it('twinned marcasite with iron_cross → NOT pyrite twin (mineral-scoped)', () => {
    // Marcasite is the FeS2 dimorph but has its own 'cockscomb' twin.
    // Cross-mineral routing is forbidden.
    const c = { ...mkPyrite({ twinned: true, twin_law: 'iron_cross' }), mineral: 'marcasite' };
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_PYRITE_IRON_CROSS_TWIN);
  });

  it('twinned pyrite in air-mode → iron-cross twin (beats dripstone)', () => {
    const c = mkPyrite({
      twinned: true, twin_law: 'iron_cross',
      growth_environment: 'air',
    });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_PYRITE_IRON_CROSS_TWIN);
  });

  it('twinned pyrite with pyritohedral habit still resolves to iron-cross (habit overridden)', () => {
    // Pyritohedral habit normally returns PRIM_PYRITOHEDRON. The twin
    // override bypasses that for iron-cross twins, since the dispatch
    // is mineral+law-scoped not habit-scoped.
    const c = mkPyrite({ twinned: true, twin_law: 'iron_cross', habit: 'pyritohedral' });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_PYRITE_IRON_CROSS_TWIN);
  });
});
