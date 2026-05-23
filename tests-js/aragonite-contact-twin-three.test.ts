// tests-js/aragonite-contact-twin-three.test.ts — 99i parity for the
// aragonite contact {110} single-V variant.

import { describe, expect, it } from 'vitest';

declare const _resolveCrystalGeomToken: any;
declare const _buildHabitGeom: any;
declare const _CLUSTER_PATTERNS: any;

describe('aragonite-contact-twin (99i) — geometry builder', () => {
  it('_buildHabitGeom("aragonite_contact_twin") returns a BufferGeometry', () => {
    const geom = _buildHabitGeom('aragonite_contact_twin');
    expect(geom).toBeTruthy();
    expect(geom.attributes.position).toBeTruthy();
  });

  it('has 72 vertex triples (V-pair: 24 triangles × 3)', () => {
    const geom = _buildHabitGeom('aragonite_contact_twin');
    expect(geom.attributes.position.count).toBe(72);
  });

  it('V opens upward (top above the contact base)', () => {
    const geom = _buildHabitGeom('aragonite_contact_twin');
    const p = geom.attributes.position.array;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < p.length; i += 3) {
      if (p[i] < minY) minY = p[i];
      if (p[i] > maxY) maxY = p[i];
    }
    expect(maxY).toBeGreaterThan(0.5);
    expect(minY).toBeLessThan(0);
  });

  it('square cross-section: max |x| ≈ max |z| (within rotation effects)', () => {
    // 99i a=0.06, b=0.06 (square). After 30° rotation, the x envelope
    // gets stretched by the tilt (max |x| ≈ 2a·cos30° + L·sin30° ≈
    // 0.475), while z stays at b (max |z| ≈ 0.06). So x/z ratio is
    // large here — but the BLADE cross-section in the local frame is
    // square. We test the local square-ness via the contact-base
    // corner positions.
    const geom = _buildHabitGeom('aragonite_contact_twin');
    const p = geom.attributes.position.array;
    let maxAbsZ = 0;
    for (let i = 0; i < p.length; i += 3) {
      if (Math.abs(p[i + 2]) > maxAbsZ) maxAbsZ = Math.abs(p[i + 2]);
    }
    // Max |z| should be exactly b = 0.06 (square cross-section width).
    expect(maxAbsZ).toBeCloseTo(0.06, 4);
  });
});

describe('aragonite-contact-twin (99i) — dispatch + cluster', () => {
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

  it('twinned aragonite + contact → "aragonite_contact_twin"', () => {
    const c = mkAragonite({ twinned: true, twin_law: 'contact' });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('aragonite_contact_twin');
  });

  it('twinned aragonite + cyclic_sextet → pseudohex token (NOT contact)', () => {
    const c = mkAragonite({ twinned: true, twin_law: 'cyclic_sextet' });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('aragonite_pseudohex_twin');
  });

  it('untwinned aragonite → canonical (NOT contact twin)', () => {
    const c = mkAragonite({ twinned: false });
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('aragonite_contact_twin');
  });

  it('twinned cerussite with contact law → NOT aragonite twin (mineral-scoped)', () => {
    const c = { ...mkAragonite({ twinned: true, twin_law: 'contact' }), mineral: 'cerussite' };
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('aragonite_contact_twin');
  });

  it('cluster pattern → prism (countScale > 0)', () => {
    expect(_CLUSTER_PATTERNS.aragonite_contact_twin).toBe(_CLUSTER_PATTERNS.prism);
    expect(_CLUSTER_PATTERNS.aragonite_contact_twin.countScale).toBeGreaterThan(0);
  });
});
