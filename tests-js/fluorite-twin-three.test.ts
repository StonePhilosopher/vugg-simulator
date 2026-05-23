// tests-js/fluorite-twin-three.test.ts — 99i Three.js parity for the
// fluorite penetration twin.
//
// v134 (2026-05-22) shipped PRIM_FLUORITE_PENETRATION_TWIN in
// js/99c-renderer-primitives.ts + wireframe dispatch in 99d (commit
// 57a9108). This file pins the Three.js (99i-renderer-three.ts) side:
//   - _resolveCrystalGeomToken dispatches 'fluorite_penetration_twin'
//     when mineral='fluorite' + twinned=true + twin_law='penetration'
//   - _buildHabitGeom('fluorite_penetration_twin') returns a
//     BufferGeometry with 72 vertex triples (24 triangles × 3 = two
//     interpenetrating cubes, 6 faces × 2 triangles each per cube)
//   - The twin token beats the air-mode dripstone override (consistent
//     with the wireframe — cubes don't drip into icicles)
//   - The dispatch is mineral-scoped + law-scoped (galena with the
//     same flags or fluorite with a different law fall through)
//
// Cross-renderer parity rule: PROPOSAL-HABIT-BIAS.md §11. Both renderers
// must agree on which geometry a crystal renders as. The wireframe pins
// live in tests-js/fluorite-twin.test.ts; this file is the 99i mirror.

import { describe, expect, it } from 'vitest';

declare const _resolveCrystalGeomToken: any;
declare const _buildHabitGeom: any;

describe('fluorite-twin (99i) — geometry builder', () => {
  it('_buildHabitGeom("fluorite_penetration_twin") returns a BufferGeometry', () => {
    const geom = _buildHabitGeom('fluorite_penetration_twin');
    expect(geom).toBeTruthy();
    expect(geom.attributes).toBeTruthy();
    expect(geom.attributes.position).toBeTruthy();
  });

  it('has 72 vertex triples (24 triangles × 3): two cubes × 6 faces × 2 triangles × 3 verts', () => {
    // Non-indexed flat-shaded geometry — each face triangle gets its own
    // 3 vertex triples (no shared verts between faces). Two cubes, each
    // with 6 faces split into 2 triangles, = 24 triangles total = 72
    // (x, y, z) triples = 216 floats in the position attribute.
    const geom = _buildHabitGeom('fluorite_penetration_twin');
    const positions = geom.attributes.position.array;
    expect(positions.length).toBe(216);  // 72 verts × 3 floats
    expect(geom.attributes.position.count).toBe(72);
  });

  it('all vertices lie within the cube envelope |x|,|y|,|z| ≤ ~0.4 × √(rotation factors)', () => {
    // The rotation by R = (1/3) × [[2,2,-1],[-1,2,2],[2,-1,2]] maps
    // a cube corner (±0.4, ±0.4, ±0.4) to another point at the same
    // distance from origin. Max |coord| under R for a ±0.4 cube: a
    // corner like (0.4, 0.4, -0.4) maps to ((2*0.4 + 2*0.4 - (-0.4))/3,
    // ...) = (5*0.4/3, ...) ≈ (0.667, ...). So the envelope can grow
    // slightly past 0.4 along individual axes when rotated. Cap is the
    // norm 0.4 × √3 ≈ 0.693 (any rotated cube corner stays within that
    // sphere from origin).
    const geom = _buildHabitGeom('fluorite_penetration_twin');
    const p = geom.attributes.position.array;
    const cap = 0.4 * Math.sqrt(3) + 1e-6;
    for (let i = 0; i < p.length; i += 3) {
      const r = Math.sqrt(p[i] * p[i] + p[i + 1] * p[i + 1] + p[i + 2] * p[i + 2]);
      expect(r).toBeLessThanOrEqual(cap);
    }
  });

  it('rotation preserves distances from origin (proper rotation, not skew)', () => {
    // The first 36 vertex triples are cube A; the next 36 are cube B.
    // For each cube the multiset of {distance-from-origin per vertex}
    // should be identical, because cube B is just cube A rotated by a
    // proper rotation around the body diagonal (which passes through
    // origin), and rotations preserve length.
    const geom = _buildHabitGeom('fluorite_penetration_twin');
    const p = geom.attributes.position.array;
    const distsA: number[] = [];
    const distsB: number[] = [];
    for (let i = 0; i < 36; i++) {
      const o = i * 3;
      distsA.push(Math.sqrt(p[o] * p[o] + p[o + 1] * p[o + 1] + p[o + 2] * p[o + 2]));
    }
    for (let i = 36; i < 72; i++) {
      const o = i * 3;
      distsB.push(Math.sqrt(p[o] * p[o] + p[o + 1] * p[o + 1] + p[o + 2] * p[o + 2]));
    }
    distsA.sort();
    distsB.sort();
    for (let i = 0; i < 36; i++) {
      expect(distsB[i]).toBeCloseTo(distsA[i], 5);
    }
  });

  it('cube B is NOT identical to cube A (the rotation actually moves vertices)', () => {
    // Sanity: if the rotation degenerated to identity, the two cube
    // position blocks would be byte-identical. They must differ.
    const geom = _buildHabitGeom('fluorite_penetration_twin');
    const p = geom.attributes.position.array;
    let differs = false;
    for (let i = 0; i < 108; i++) {
      if (Math.abs(p[i] - p[i + 108]) > 1e-4) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
  });
});

describe('fluorite-twin (99i) — _resolveCrystalGeomToken dispatch', () => {
  function mkFluorite(opts: Record<string, any> = {}) {
    return {
      crystal_id: 1,
      mineral: 'fluorite',
      habit: 'cubic',
      c_length_mm: 5,
      a_width_mm: 5,
      growth_environment: 'fluid',
      twinned: false,
      twin_law: '',
      ...opts,
    };
  }

  it('twinned fluorite + penetration law → "fluorite_penetration_twin"', () => {
    const c = mkFluorite({ twinned: true, twin_law: 'penetration' });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('fluorite_penetration_twin');
  });

  it('untwinned fluorite → "cube" (no twin token)', () => {
    const c = mkFluorite({ twinned: false });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('cube');
  });

  it('twinned fluorite with empty twin_law → "cube" (defensive)', () => {
    // _rollSpontaneousTwin only sets twin_law to a non-empty string when
    // a roll succeeds. Defensive: if twinned is set but twin_law is
    // empty (shouldn't happen, but cheap to handle), fall through to
    // the canonical cube — not the twin primitive.
    const c = mkFluorite({ twinned: true, twin_law: '' });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('cube');
  });

  it('twinned fluorite with a different twin_law → "cube"', () => {
    // A hypothetical future fluorite twin (e.g. {110} cyclic) shouldn't
    // be dispatched to the penetration-twin primitive. Only the exact
    // 'penetration' law name triggers this token.
    const c = mkFluorite({ twinned: true, twin_law: 'hypothetical_other_twin' });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('cube');
  });

  it('twinned galena with penetration law → galena\'s canonical token, NOT the fluorite twin', () => {
    // The dispatch is mineral-specific. Even if a galena crystal somehow
    // ended up with twin_law='penetration', it should NOT route to the
    // fluorite twin primitive — only fluorite does that.
    const c = { ...mkFluorite({ twinned: true, twin_law: 'penetration' }), mineral: 'galena' };
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('cube');
  });

  it('twinned fluorite in air-mode cavity → twin token (twin beats dripstone)', () => {
    // Mirrors the wireframe rule: twins win over the air-mode
    // dripstone override. A fluorite cube in a drained cavity is still
    // a twin, not a stalactite — real cubes don't drip into icicles.
    const c = mkFluorite({
      twinned: true, twin_law: 'penetration',
      growth_environment: 'air',
    });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('fluorite_penetration_twin');
  });

  it('untwinned fluorite in air-mode cavity → "cube" (cube is not dripstone-eligible)', () => {
    // Sanity that the dispatch ordering doesn't accidentally route
    // fluorite to dripstone. The cube token isn't in
    // _DRIPSTONE_ELIGIBLE_TOKENS, so even in air-mode it stays a cube.
    const c = mkFluorite({
      twinned: false,
      growth_environment: 'air',
    });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('cube');
  });

  it('twinned fluorite with prismatic habit still resolves to twin (habit is overridden)', () => {
    // The twin override fires on mineral+twinned+law alone, ignoring
    // the habit string. A fluorite that somehow had habit='prismatic'
    // but was a penetration twin still renders as the twin geometry.
    // (In practice fluorite is always cubic-family, but the guarantee
    // is useful: twin dispatch is mineral-scoped, not habit-scoped.)
    const c = mkFluorite({ twinned: true, twin_law: 'penetration', habit: 'prismatic' });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('fluorite_penetration_twin');
  });
});
