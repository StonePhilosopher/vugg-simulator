// tests-js/aragonite-pseudohex-twin-three.test.ts — 99i Three.js
// parity for the aragonite cyclic-sextet pseudo-hex twin.
//
// Mirrors tests-js/aragonite-pseudohex-twin.test.ts on the 99i side.
// Pins _resolveCrystalGeomToken dispatch + _buildHabitGeom geometry
// for the 'aragonite_pseudohex_twin' token.
//
// Geometry: three tabular boxes at 60° rotation around y-axis.
// Each box: half-thickness a=0.10, half-width b=0.30, half-length
// L=0.5 (centered at origin per the 99i convention). 6 box faces ×
// 2 triangles per face × 3 prisms = 36 triangles, 108 vertex triples.

import { describe, expect, it } from 'vitest';

declare const _resolveCrystalGeomToken: any;
declare const _buildHabitGeom: any;

describe('aragonite-pseudohex-twin (99i) — geometry builder', () => {
  it('_buildHabitGeom("aragonite_pseudohex_twin") returns a BufferGeometry', () => {
    const geom = _buildHabitGeom('aragonite_pseudohex_twin');
    expect(geom).toBeTruthy();
    expect(geom.attributes).toBeTruthy();
    expect(geom.attributes.position).toBeTruthy();
  });

  it('has 108 vertex triples (36 triangles × 3): 3 prisms × 12 triangles × 3', () => {
    // 6 box faces × 2 triangles per face = 12 triangles per prism.
    // 3 prisms = 36 triangles total. Each triangle has 3 (x, y, z)
    // vertex triples → 108 triples = 324 floats in the position
    // attribute.
    const geom = _buildHabitGeom('aragonite_pseudohex_twin');
    const positions = geom.attributes.position.array;
    expect(positions.length).toBe(324);
    expect(geom.attributes.position.count).toBe(108);
  });

  it('vertex Y coordinates span [-L, +L] (the c-axis half-length range)', () => {
    // 99i convention: geometry centered at origin. The prism's
    // bottom face at yl=-L=-0.5 and top face at yl=+L=+0.5. All
    // vertices should fall in that Y range (within float tolerance).
    const geom = _buildHabitGeom('aragonite_pseudohex_twin');
    const p = geom.attributes.position.array;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < p.length; i += 3) {
      if (p[i] < minY) minY = p[i];
      if (p[i] > maxY) maxY = p[i];
    }
    expect(minY).toBeCloseTo(-0.5, 4);
    expect(maxY).toBeCloseTo(0.5, 4);
  });

  it('XZ cross-section is bounded by the radius √(a² + b²) ≈ 0.316', () => {
    // The furthest XZ corner of each prism is at (±a, ±b) → radius
    // √(0.01 + 0.09) ≈ 0.316. All rotated prism instances share that
    // radius (rotation is rigid).
    const geom = _buildHabitGeom('aragonite_pseudohex_twin');
    const p = geom.attributes.position.array;
    const rMax = Math.sqrt(0.10 * 0.10 + 0.30 * 0.30) + 1e-4;
    for (let i = 0; i < p.length; i += 3) {
      const r = Math.sqrt(p[i] * p[i] + p[i + 2] * p[i + 2]);
      expect(r).toBeLessThanOrEqual(rMax);
    }
  });

  it('has 3-fold rotational symmetry around the y-axis', () => {
    // For every vertex (x, y, z), there should be another vertex at
    // the same y, rotated 120° around y. This is a structural pin
    // that the trilling is actually cyclic-symmetric.
    const geom = _buildHabitGeom('aragonite_pseudohex_twin');
    const p = geom.attributes.position.array;
    const c120 = Math.cos(2 * Math.PI / 3);
    const s120 = Math.sin(2 * Math.PI / 3);
    // For each vertex, compute its 120°-rotated image and check that
    // some vertex in the geometry is close to that image position.
    // (Using a small sample for speed: every 9th vertex = every 3rd
    // triangle.)
    let matches = 0;
    let checked = 0;
    for (let i = 0; i < p.length; i += 27) {
      const x = p[i], y = p[i + 1], z = p[i + 2];
      const xr = x * c120 - z * s120;
      const zr = x * s120 + z * c120;
      // Search for matching vertex.
      let found = false;
      for (let j = 0; j < p.length; j += 3) {
        if (Math.abs(p[j] - xr) < 1e-4 && Math.abs(p[j + 1] - y) < 1e-4 && Math.abs(p[j + 2] - zr) < 1e-4) {
          found = true;
          break;
        }
      }
      if (found) matches++;
      checked++;
    }
    expect(matches).toBe(checked);
  });
});

describe('aragonite-pseudohex-twin (99i) — _resolveCrystalGeomToken dispatch', () => {
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

  it('twinned aragonite + cyclic_sextet → "aragonite_pseudohex_twin"', () => {
    const c = mkAragonite({ twinned: true, twin_law: 'cyclic_sextet' });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('aragonite_pseudohex_twin');
  });

  it('untwinned aragonite → canonical token (NOT twin)', () => {
    const c = mkAragonite({ twinned: false });
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('aragonite_pseudohex_twin');
  });

  it('twinned aragonite with empty twin_law → canonical', () => {
    const c = mkAragonite({ twinned: true, twin_law: '' });
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('aragonite_pseudohex_twin');
  });

  it('twinned aragonite with "contact" twin_law → canonical (different twin geometry)', () => {
    const c = mkAragonite({ twinned: true, twin_law: 'contact' });
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('aragonite_pseudohex_twin');
  });

  it('twinned cerussite with cyclic_sextet → NOT aragonite twin (mineral-scoped)', () => {
    const c = { ...mkAragonite({ twinned: true, twin_law: 'cyclic_sextet' }), mineral: 'cerussite' };
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('aragonite_pseudohex_twin');
  });

  // MODEL GAP — the test below currently encodes geologically wrong
  // behavior. Real cave aragonite is acicular frostwork regardless of
  // twin structure (Hill & Forti 1997 §10; Frisia et al. 2002). The
  // expected token here should be 'aragonite_frostwork', not
  // 'aragonite_pseudohex_twin'. v156 deferred the fix because extending
  // the override to twinned crystals requires parallel wireframe
  // renderer changes + a parallel test update on the wireframe side.
  // Full fix sequence + reasoning: BUG-aragonite-twin-cave-morphology.md
  it('twinned aragonite in air-mode cavity → twin token (CURRENT WRONG behavior; see BUG-aragonite-twin-cave-morphology.md)', () => {
    const c = mkAragonite({
      twinned: true, twin_law: 'cyclic_sextet',
      growth_environment: 'air',
    });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('aragonite_pseudohex_twin');
  });

  it('twinned aragonite with acicular habit still resolves to twin', () => {
    const c = mkAragonite({ twinned: true, twin_law: 'cyclic_sextet', habit: 'acicular_needle' });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('aragonite_pseudohex_twin');
  });

  it('NON-twinned air-mode aragonite → frostwork (v156)', () => {
    const c = mkAragonite({
      twinned: false,
      growth_environment: 'air',
      habit: 'acicular_needle',
    });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('aragonite_frostwork');
  });
});
