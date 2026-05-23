// tests-js/cerussite-sixling-twin-three.test.ts — 99i parity for the
// cerussite stellate-sixling twin (v134, fifth iconic twin).

import { describe, expect, it } from 'vitest';

declare const _resolveCrystalGeomToken: any;
declare const _buildHabitGeom: any;

describe('cerussite-sixling-twin (99i) — geometry builder', () => {
  it('_buildHabitGeom("cerussite_sixling_twin") returns a BufferGeometry', () => {
    const geom = _buildHabitGeom('cerussite_sixling_twin');
    expect(geom).toBeTruthy();
    expect(geom.attributes.position).toBeTruthy();
  });

  it('has 108 vertex triples (36 triangles × 3): 3 blades × 12 triangles × 3', () => {
    const geom = _buildHabitGeom('cerussite_sixling_twin');
    expect(geom.attributes.position.array.length).toBe(324);
    expect(geom.attributes.position.count).toBe(108);
  });

  it('flat — Y range is tightly bounded (|y| ≤ 0.05) per the thin convention', () => {
    // 99i centered convention: thin_y=0.05, so all vertices fall in
    // [-0.05, 0.05] on Y. This distinguishes the stellate twin from
    // the aragonite vertical column (which spans [-0.5, 0.5] on Y).
    const geom = _buildHabitGeom('cerussite_sixling_twin');
    const p = geom.attributes.position.array;
    for (let i = 1; i < p.length; i += 3) {
      expect(Math.abs(p[i])).toBeLessThanOrEqual(0.05 + 1e-6);
    }
  });

  it('XZ extent is large (radius ≈ 0.5) vs Y extent (≤ 0.05)', () => {
    // The stellate aspect — wide in XZ, thin in Y. Confirms the
    // primitive is anchored against the wall, not pointing into the
    // cavity.
    const geom = _buildHabitGeom('cerussite_sixling_twin');
    const p = geom.attributes.position.array;
    let maxXZ = 0;
    for (let i = 0; i < p.length; i += 3) {
      const r = Math.sqrt(p[i] * p[i] + p[i + 2] * p[i + 2]);
      if (r > maxXZ) maxXZ = r;
    }
    expect(maxXZ).toBeGreaterThan(0.45);  // approaches c_long=0.5
    expect(maxXZ).toBeLessThan(0.55);     // bounded by sqrt(c_long² + b_tan²)
  });

  it('has 3-fold rotational symmetry around the y-axis', () => {
    // For every vertex, a 120°-rotated image should exist among other vertices.
    const geom = _buildHabitGeom('cerussite_sixling_twin');
    const p = geom.attributes.position.array;
    const c120 = Math.cos(2 * Math.PI / 3);
    const s120 = Math.sin(2 * Math.PI / 3);
    let matches = 0, checked = 0;
    for (let i = 0; i < p.length; i += 27) {
      const x = p[i], y = p[i + 1], z = p[i + 2];
      const xr = x * c120 - z * s120;
      const zr = x * s120 + z * c120;
      let found = false;
      for (let j = 0; j < p.length; j += 3) {
        if (Math.abs(p[j] - xr) < 1e-4 && Math.abs(p[j + 1] - y) < 1e-4 && Math.abs(p[j + 2] - zr) < 1e-4) {
          found = true; break;
        }
      }
      if (found) matches++;
      checked++;
    }
    expect(matches).toBe(checked);
  });
});

describe('cerussite-sixling-twin (99i) — _resolveCrystalGeomToken dispatch', () => {
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

  it('twinned cerussite + cyclic_sixling → "cerussite_sixling_twin"', () => {
    const c = mkCerussite({ twinned: true, twin_law: 'cyclic_sixling' });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('cerussite_sixling_twin');
  });

  it('untwinned cerussite → canonical token (NOT twin)', () => {
    const c = mkCerussite({ twinned: false });
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('cerussite_sixling_twin');
  });

  it('twinned cerussite with empty twin_law → canonical', () => {
    const c = mkCerussite({ twinned: true, twin_law: '' });
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('cerussite_sixling_twin');
  });

  it('twinned cerussite with a different twin_law → canonical', () => {
    const c = mkCerussite({ twinned: true, twin_law: 'hypothetical_other' });
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('cerussite_sixling_twin');
  });

  it('twinned aragonite with cyclic_sixling → NOT cerussite twin (mineral-scoped)', () => {
    const c = { ...mkCerussite({ twinned: true, twin_law: 'cyclic_sixling' }), mineral: 'aragonite' };
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('cerussite_sixling_twin');
  });

  it('twinned cerussite in air-mode → twin token (beats dripstone)', () => {
    const c = mkCerussite({
      twinned: true, twin_law: 'cyclic_sixling',
      growth_environment: 'air',
    });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('cerussite_sixling_twin');
  });
});
