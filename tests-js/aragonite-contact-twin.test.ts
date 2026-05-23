// tests-js/aragonite-contact-twin.test.ts — aragonite contact {110}
// (single-V variant vs cyclic-sextet's 3-fold pseudo-hex column).
//
// v133 has aragonite's twin_laws as: cyclic_sextet (p=0.40) +
// contact (p=0.05). This commit ships the contact variant primitive,
// completing aragonite's twin coverage alongside the cyclic-sextet
// (commit 609be2b).

import { describe, expect, it } from 'vitest';

declare const PRIM_ARAGONITE_CONTACT_TWIN: any;
declare const PRIM_ARAGONITE_PSEUDOHEX_TWIN: any;
declare const _lookupCrystalPrimitive: any;
declare const _clusterPatternKeyForPrim: any;

describe('aragonite-contact-twin — primitive geometry', () => {
  it('PRIM_ARAGONITE_CONTACT_TWIN is defined', () => {
    expect(PRIM_ARAGONITE_CONTACT_TWIN).toBeTruthy();
    expect(PRIM_ARAGONITE_CONTACT_TWIN.name).toBe('aragonite_contact_twin');
  });

  it('has 16 vertices (8 per blade)', () => {
    expect(PRIM_ARAGONITE_CONTACT_TWIN.vertices).toHaveLength(16);
  });

  it('has 24 edges (12 per blade)', () => {
    expect(PRIM_ARAGONITE_CONTACT_TWIN.edges).toHaveLength(24);
  });

  it('blades have SQUARE cross-section: a = b = 0.10', () => {
    // The signature distinguishing aragonite contact from selenite
    // swallowtail (tabular, a≠b) and marcasite cockscomb (needle,
    // small a, small b). Square cross-section reflects aragonite's
    // prismatic individual habit.
    //
    // Vertex 0 of blade A is at (-2a, 0, -b) before rotation. After
    // +30° rotation and +base_y translation, it lands at (-2a·cos30°,
    // -2a·sin30° + base_y, -b). With a=0.10, b=0.10:
    //   wx = -2(0.10)·0.866 = -0.173
    //   wy = -2(0.10)·0.5 - 0.1 = -0.2
    //   wz = -0.10
    const v0 = PRIM_ARAGONITE_CONTACT_TWIN.vertices[0];
    expect(v0[0]).toBeCloseTo(-0.20 * Math.cos(Math.PI / 6), 4);
    expect(v0[2]).toBeCloseTo(-0.10, 4);
    // a = b confirmation: the |x| envelope (from the 2a thickness)
    // should be comparable to the |z| envelope (from the b width).
    // After rotation 2a contributes 2a·cos30° = 0.173 to x; b
    // contributes 0.10 to z. Different by less than 2x (vs
    // swallowtail's 2.25x).
    expect(Math.abs(v0[0]) / Math.abs(v0[2])).toBeLessThan(2.0);
  });

  it('contact-base coincides between blades at (0, -0.1, ±b)', () => {
    const v4 = PRIM_ARAGONITE_CONTACT_TWIN.vertices[4];
    const v5 = PRIM_ARAGONITE_CONTACT_TWIN.vertices[5];
    const v8 = PRIM_ARAGONITE_CONTACT_TWIN.vertices[8];
    const v9 = PRIM_ARAGONITE_CONTACT_TWIN.vertices[9];
    expect(v4[0]).toBeCloseTo(0, 4);
    expect(v4[1]).toBeCloseTo(-0.1, 4);
    expect(v8[0]).toBeCloseTo(v4[0], 4);
    expect(v8[1]).toBeCloseTo(v4[1], 4);
    expect(v8[2]).toBeCloseTo(v4[2], 4);
    expect(v9[0]).toBeCloseTo(v5[0], 4);
    expect(v9[1]).toBeCloseTo(v5[1], 4);
    expect(v9[2]).toBeCloseTo(v5[2], 4);
  });

  it('V opens at 60° (30° per blade from vertical)', () => {
    // Same angle as selenite swallowtail — visually distinguished by
    // the square (vs tabular) cross-section, not the V angle.
    const v4 = PRIM_ARAGONITE_CONTACT_TWIN.vertices[4];
    const v6 = PRIM_ARAGONITE_CONTACT_TWIN.vertices[6];
    const dx = v6[0] - v4[0];
    const dy = v6[1] - v4[1];
    expect(Math.atan2(Math.abs(dx), dy)).toBeCloseTo(Math.PI / 6, 4);
  });

  it('blade tops fan in opposite X directions (V silhouette)', () => {
    const v6 = PRIM_ARAGONITE_CONTACT_TWIN.vertices[6];
    const v10 = PRIM_ARAGONITE_CONTACT_TWIN.vertices[10];
    expect(v6[0]).toBeLessThan(0);
    expect(v10[0]).toBeGreaterThan(0);
    expect(v6[0]).toBeCloseTo(-v10[0], 4);
  });

  it('distinct primitive from aragonite cyclic-sextet (different twin geometry)', () => {
    expect(PRIM_ARAGONITE_CONTACT_TWIN).not.toBe(PRIM_ARAGONITE_PSEUDOHEX_TWIN);
    // Different vertex count: contact has 16 (8+8); pseudohex has 24 (8×3).
    expect(PRIM_ARAGONITE_CONTACT_TWIN.vertices.length).toBe(16);
    expect(PRIM_ARAGONITE_PSEUDOHEX_TWIN.vertices.length).toBe(24);
  });
});

describe('aragonite-contact-twin — dispatch + cluster', () => {
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

  it('twinned aragonite + contact → contact twin primitive', () => {
    const c = mkAragonite({ twinned: true, twin_law: 'contact' });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_ARAGONITE_CONTACT_TWIN);
  });

  it('twinned aragonite + cyclic_sextet → NOT contact (separate law)', () => {
    const c = mkAragonite({ twinned: true, twin_law: 'cyclic_sextet' });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_ARAGONITE_CONTACT_TWIN);
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_ARAGONITE_PSEUDOHEX_TWIN);
  });

  it('untwinned aragonite → canonical (NOT contact twin)', () => {
    const c = mkAragonite({ twinned: false });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_ARAGONITE_CONTACT_TWIN);
  });

  it('twinned cerussite with contact law → NOT aragonite twin (mineral-scoped)', () => {
    const c = { ...mkAragonite({ twinned: true, twin_law: 'contact' }), mineral: 'cerussite' };
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_ARAGONITE_CONTACT_TWIN);
  });

  it('cluster pattern → prism (V of prismatic blades clusters as prism forest)', () => {
    expect(_clusterPatternKeyForPrim(PRIM_ARAGONITE_CONTACT_TWIN)).toBe('prism');
  });
});
