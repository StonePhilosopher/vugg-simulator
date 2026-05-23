// tests-js/marcasite-spearhead-twin-three.test.ts — 99i parity for the
// marcasite spearhead {101} twin (v134 secondary, post-iconic-7).

import { describe, expect, it } from 'vitest';

declare const _resolveCrystalGeomToken: any;
declare const _buildHabitGeom: any;
declare const _CLUSTER_PATTERNS: any;

describe('marcasite-spearhead-twin (99i) — geometry builder', () => {
  it('_buildHabitGeom("marcasite_spearhead_twin") returns a BufferGeometry', () => {
    const geom = _buildHabitGeom('marcasite_spearhead_twin');
    expect(geom).toBeTruthy();
    expect(geom.attributes.position).toBeTruthy();
  });

  it('has 24 vertex triples (8 triangles × 3): octahedron-like with rhombic equator', () => {
    const geom = _buildHabitGeom('marcasite_spearhead_twin');
    expect(geom.attributes.position.count).toBe(24);
    expect(geom.attributes.position.array.length).toBe(72);
  });

  it('elongated along y — max |y| > max |x|, |z|', () => {
    // Bipyramidal aspect: c-axis half-length L=0.5 is the longest
    // dimension. Equatorial radii a=0.18, b=0.10 are both smaller.
    const geom = _buildHabitGeom('marcasite_spearhead_twin');
    const p = geom.attributes.position.array;
    let maxAbsY = 0, maxAbsX = 0, maxAbsZ = 0;
    for (let i = 0; i < p.length; i += 3) {
      if (Math.abs(p[i]) > maxAbsX) maxAbsX = Math.abs(p[i]);
      if (Math.abs(p[i + 1]) > maxAbsY) maxAbsY = Math.abs(p[i + 1]);
      if (Math.abs(p[i + 2]) > maxAbsZ) maxAbsZ = Math.abs(p[i + 2]);
    }
    expect(maxAbsY).toBeGreaterThan(maxAbsX);
    expect(maxAbsY).toBeGreaterThan(maxAbsZ);
    expect(maxAbsY).toBeCloseTo(0.5, 4);
  });

  it('rhombic cross-section — max |x| (a=0.18) > max |z| (b=0.10)', () => {
    const geom = _buildHabitGeom('marcasite_spearhead_twin');
    const p = geom.attributes.position.array;
    let maxAbsX = 0, maxAbsZ = 0;
    for (let i = 0; i < p.length; i += 3) {
      if (Math.abs(p[i]) > maxAbsX) maxAbsX = Math.abs(p[i]);
      if (Math.abs(p[i + 2]) > maxAbsZ) maxAbsZ = Math.abs(p[i + 2]);
    }
    expect(maxAbsX).toBeCloseTo(0.18, 4);
    expect(maxAbsZ).toBeCloseTo(0.10, 4);
    expect(maxAbsX).toBeGreaterThan(maxAbsZ);
  });
});

describe('marcasite-spearhead-twin (99i) — _resolveCrystalGeomToken + cluster', () => {
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

  it('twinned marcasite + spearhead → "marcasite_spearhead_twin"', () => {
    const c = mkMarcasite({ twinned: true, twin_law: 'spearhead' });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('marcasite_spearhead_twin');
  });

  it('twinned marcasite + cockscomb → cockscomb token (NOT spearhead)', () => {
    const c = mkMarcasite({ twinned: true, twin_law: 'cockscomb' });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('marcasite_cockscomb_twin');
  });

  it('untwinned marcasite → canonical (NOT spearhead)', () => {
    const c = mkMarcasite({ twinned: false });
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('marcasite_spearhead_twin');
  });

  it('twinned pyrite with spearhead law → NOT marcasite spearhead (mineral-scoped)', () => {
    const c = { ...mkMarcasite({ twinned: true, twin_law: 'spearhead' }), mineral: 'pyrite' };
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('marcasite_spearhead_twin');
  });

  it('cluster pattern → spike (countScale > 0)', () => {
    expect(_CLUSTER_PATTERNS.marcasite_spearhead_twin).toBe(_CLUSTER_PATTERNS.spike);
    expect(_CLUSTER_PATTERNS.marcasite_spearhead_twin.countScale).toBeGreaterThan(0);
  });
});
