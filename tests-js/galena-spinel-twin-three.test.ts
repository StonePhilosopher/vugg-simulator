// tests-js/galena-spinel-twin-three.test.ts — 99i Three.js parity for
// the galena spinel-law octahedron twin (v134, third iconic twin).
//
// Mirrors tests-js/galena-spinel-twin.test.ts on the Three.js side.
// Pins _resolveCrystalGeomToken dispatch + _buildHabitGeom geometry
// for the 'galena_octahedron_twin' token.
//
// Geometry: two octahedra sharing the {111} contact face. Each
// octahedron contributes 7 visible faces (the contact face is skipped
// for both — it's hidden inside the twin and would otherwise produce
// a zero-thickness sheet with opposing normals). 7 faces × 2 = 14
// triangles, 42 vertex triples in the position attribute.

import { describe, expect, it } from 'vitest';

declare const _resolveCrystalGeomToken: any;
declare const _buildHabitGeom: any;

describe('galena-spinel-twin (99i) — geometry builder', () => {
  it('_buildHabitGeom("galena_octahedron_twin") returns a BufferGeometry', () => {
    const geom = _buildHabitGeom('galena_octahedron_twin');
    expect(geom).toBeTruthy();
    expect(geom.attributes).toBeTruthy();
    expect(geom.attributes.position).toBeTruthy();
  });

  it('has 42 vertex triples (14 triangles × 3): 7 visible faces per octahedron × 2 × 3', () => {
    // 8 octahedron faces minus 1 contact face = 7 visible faces per
    // octahedron, × 2 octahedra = 14 triangles, × 3 vertex triples
    // per triangle = 42 triples in the position attribute (126 floats).
    const geom = _buildHabitGeom('galena_octahedron_twin');
    const positions = geom.attributes.position.array;
    expect(positions.length).toBe(126);  // 42 × 3 floats
    expect(geom.attributes.position.count).toBe(42);
  });

  it('all vertices lie within a generous twin envelope (≤ 2·c radius)', () => {
    // Reflection across plane x+y+z=c maps bottom apex (0, -c, 0) to
    // (4c/3, c/3, 4c/3) — radius c·√(33/9) ≈ 1.91·c, the largest
    // distance from origin of any vertex in the twin. Cap at 2·c is
    // a clean loose envelope.
    const geom = _buildHabitGeom('galena_octahedron_twin');
    const p = geom.attributes.position.array;
    const cap = 2 * 0.55 + 1e-6;
    for (let i = 0; i < p.length; i += 3) {
      const r = Math.sqrt(p[i]*p[i] + p[i+1]*p[i+1] + p[i+2]*p[i+2]);
      expect(r).toBeLessThanOrEqual(cap);
    }
  });

  it('the twin extends asymmetrically — second octahedron pushes into +X+Y+Z', () => {
    // Without the twin, an octahedron at origin has min/max bounds
    // symmetric around 0 on each axis. With the twin's reflection
    // across x+y+z=c, the new vertices land in the +X+Y+Z octant,
    // so maxX, maxY, maxZ should all exceed c, while minX/minY/minZ
    // stay at -c (from the first octahedron's untouched negative-side
    // vertices). The bipyramidal axis goes along (1,1,1).
    const geom = _buildHabitGeom('galena_octahedron_twin');
    const p = geom.attributes.position.array;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] < minX) minX = p[i];
      if (p[i+1] < minY) minY = p[i+1];
      if (p[i+2] < minZ) minZ = p[i+2];
      if (p[i] > maxX) maxX = p[i];
      if (p[i+1] > maxY) maxY = p[i+1];
      if (p[i+2] > maxZ) maxZ = p[i+2];
    }
    const c = 0.55;
    // Min bounds: -c (from first octahedron's -x, -y, -z apices).
    expect(minX).toBeCloseTo(-c, 3);
    expect(minY).toBeCloseTo(-c, 3);
    expect(minZ).toBeCloseTo(-c, 3);
    // Max bounds: > c (reflected vertices push past c on each axis).
    expect(maxX).toBeGreaterThan(c);
    expect(maxY).toBeGreaterThan(c);
    expect(maxZ).toBeGreaterThan(c);
    // The asymmetry should be roughly equal on all three +axes (the
    // reflection is symmetric in (x, y, z) by construction).
    expect(maxX).toBeCloseTo(maxY, 3);
    expect(maxY).toBeCloseTo(maxZ, 3);
  });

  it('contact-face triangles are NOT emitted (no zero-thickness contact sheet)', () => {
    // The shared {111} face has vertices at (c, 0, 0), (0, c, 0),
    // (0, 0, c). If we accidentally emitted this face twice with
    // opposing normals, the contact-face vertex set would appear 6
    // times in the position array (twice per vertex, once per side
    // of the sheet). We skip it, so each contact-face vertex appears
    // ONCE PER OCTAHEDRON, and only as part of the non-contact faces
    // that include it.
    //
    // Count appearances of vertex (c, 0, 0) in the position array.
    // The east vertex appears in faces: {+,+,-}, {+,-,+}, {+,-,-}
    // for oct1 (3 of the 7 non-contact faces touch it) — same for
    // oct2 since the contact face is the same {0,2,4} skipped. So
    // total = 3 + 3 = 6 appearances.
    const geom = _buildHabitGeom('galena_octahedron_twin');
    const p = geom.attributes.position.array;
    const c = 0.55;
    let east_count = 0;
    for (let i = 0; i < p.length; i += 3) {
      if (Math.abs(p[i] - c) < 1e-4 && Math.abs(p[i+1]) < 1e-4 && Math.abs(p[i+2]) < 1e-4) {
        east_count++;
      }
    }
    // 3 from each octahedron's non-contact faces that include east.
    expect(east_count).toBe(6);
  });
});

describe('galena-spinel-twin (99i) — _resolveCrystalGeomToken dispatch', () => {
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

  it('twinned galena + spinel_law → "galena_octahedron_twin"', () => {
    const c = mkGalena({ twinned: true, twin_law: 'spinel_law' });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('galena_octahedron_twin');
  });

  it('untwinned galena → canonical token (NOT the twin)', () => {
    const c = mkGalena({ twinned: false });
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('galena_octahedron_twin');
  });

  it('twinned galena with empty twin_law → canonical', () => {
    const c = mkGalena({ twinned: true, twin_law: '' });
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('galena_octahedron_twin');
  });

  it('twinned galena with a different twin_law → canonical', () => {
    const c = mkGalena({ twinned: true, twin_law: 'hypothetical_law' });
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('galena_octahedron_twin');
  });

  it('twinned fluorite with spinel_law → NOT the galena twin', () => {
    const c = { ...mkGalena({ twinned: true, twin_law: 'spinel_law' }), mineral: 'fluorite' };
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('galena_octahedron_twin');
  });

  it('twinned galena in air-mode cavity → twin token (beats dripstone)', () => {
    const c = mkGalena({
      twinned: true, twin_law: 'spinel_law',
      growth_environment: 'air',
    });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('galena_octahedron_twin');
  });

  it('twinned galena with cubic habit still resolves to twin (habit overridden)', () => {
    // A galena with habit='cubic' (the dominant non-twin habit) but
    // twinned=true + spinel_law should still route to the twin. The
    // override is mineral+law-scoped, ignores habit.
    const c = mkGalena({ twinned: true, twin_law: 'spinel_law', habit: 'cubic' });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('galena_octahedron_twin');
  });
});
