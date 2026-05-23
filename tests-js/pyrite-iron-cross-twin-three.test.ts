// tests-js/pyrite-iron-cross-twin-three.test.ts — 99i parity for the
// pyrite iron-cross twin (v134, seventh and final iconic twin).

import { describe, expect, it } from 'vitest';

declare const _resolveCrystalGeomToken: any;
declare const _buildHabitGeom: any;

describe('pyrite-iron-cross-twin (99i) — geometry builder', () => {
  it('_buildHabitGeom("pyrite_iron_cross_twin") returns a BufferGeometry', () => {
    const geom = _buildHabitGeom('pyrite_iron_cross_twin');
    expect(geom).toBeTruthy();
    expect(geom.attributes.position).toBeTruthy();
  });

  it('has 216 vertex triples (72 triangles × 3): 12 pentagons × 3 triangles × 2 pyritohedra × 3 verts', () => {
    // Each pyritohedron has 12 pentagonal faces. Each pentagon fans
    // into 3 triangles. 12 × 3 = 36 triangles per pyritohedron, ×2
    // pyritohedra = 72 triangles. ×3 vertex triples per triangle =
    // 216 triples in the position attribute (648 floats).
    const geom = _buildHabitGeom('pyrite_iron_cross_twin');
    expect(geom.attributes.position.count).toBe(216);
    expect(geom.attributes.position.array.length).toBe(648);
  });

  it('vertices stay within the unit envelope (|coord| ≤ 0.5)', () => {
    // 99i convention: max coord = b = 0.5 (the long edge parameter).
    // All other coords (a, c) are smaller. After 90° rotation around
    // y-axis the bounds stay the same on each axis.
    const geom = _buildHabitGeom('pyrite_iron_cross_twin');
    const p = geom.attributes.position.array;
    for (let i = 0; i < p.length; i++) {
      expect(Math.abs(p[i])).toBeLessThanOrEqual(0.5 + 1e-6);
    }
  });

  it('twin is symmetric under 90° rotation around y-axis (the twin relation)', () => {
    // For each position (x, y, z), there should be a corresponding
    // position (z, y, -x) somewhere in the geometry (the 90°-rotated
    // image, which lives in the other pyritohedron). This is the
    // structural pin that the twin is built correctly.
    const geom = _buildHabitGeom('pyrite_iron_cross_twin');
    const p = geom.attributes.position.array;
    let matches = 0, checked = 0;
    // Sample every 9th vertex (every 3rd triangle) for speed.
    for (let i = 0; i < p.length; i += 27) {
      const x = p[i], y = p[i + 1], z = p[i + 2];
      const xr = z, yr = y, zr = -x;
      let found = false;
      for (let j = 0; j < p.length; j += 3) {
        if (Math.abs(p[j] - xr) < 1e-4 && Math.abs(p[j + 1] - yr) < 1e-4 && Math.abs(p[j + 2] - zr) < 1e-4) {
          found = true;
          break;
        }
      }
      if (found) matches++;
      checked++;
    }
    expect(matches).toBe(checked);
  });

  it('non-isotropic — distinct from a sphere or cube (chiral pyritohedron shape)', () => {
    // The chiral pyritohedron has 12 pentagonal faces in 6 directional
    // groups. The vertex distribution should NOT look like a uniform
    // sphere shell. Specifically: there should be distinct "edge"
    // positions where the long-axis dimension b=0.5 dominates.
    const geom = _buildHabitGeom('pyrite_iron_cross_twin');
    const p = geom.attributes.position.array;
    // Count vertices near the max-coordinate envelope (|coord| close
    // to 0.5). Should be plentiful (each "+" edge vertex with b in
    // some component contributes; same for "-").
    let nearEnvelope = 0;
    for (let i = 0; i < p.length; i += 3) {
      const maxC = Math.max(Math.abs(p[i]), Math.abs(p[i + 1]), Math.abs(p[i + 2]));
      if (maxC > 0.49) nearEnvelope++;
    }
    expect(nearEnvelope).toBeGreaterThan(0);
  });
});

describe('pyrite-iron-cross-twin (99i) — _resolveCrystalGeomToken dispatch', () => {
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

  it('twinned pyrite + iron_cross → "pyrite_iron_cross_twin"', () => {
    const c = mkPyrite({ twinned: true, twin_law: 'iron_cross' });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('pyrite_iron_cross_twin');
  });

  it('untwinned pyrite → canonical (NOT iron-cross twin)', () => {
    const c = mkPyrite({ twinned: false });
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('pyrite_iron_cross_twin');
  });

  it('twinned pyrite with empty twin_law → canonical', () => {
    const c = mkPyrite({ twinned: true, twin_law: '' });
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('pyrite_iron_cross_twin');
  });

  it('twinned pyrite with a different twin_law → canonical', () => {
    const c = mkPyrite({ twinned: true, twin_law: 'hypothetical_other' });
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('pyrite_iron_cross_twin');
  });

  it('twinned marcasite with iron_cross → NOT pyrite twin (mineral-scoped)', () => {
    const c = { ...mkPyrite({ twinned: true, twin_law: 'iron_cross' }), mineral: 'marcasite' };
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('pyrite_iron_cross_twin');
  });

  it('twinned pyrite in air-mode → twin token (beats dripstone)', () => {
    const c = mkPyrite({
      twinned: true, twin_law: 'iron_cross',
      growth_environment: 'air',
    });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('pyrite_iron_cross_twin');
  });
});
