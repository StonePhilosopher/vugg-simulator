// tests-js/selenite-swallowtail-three.test.ts — 99i Three.js parity
// for the selenite swallowtail twin.
//
// v134 (2026-05-22) ships the swallowtail twin primitive in both
// renderers in a single commit (per the parity discipline established
// in 5433aea's commit-message notes). This file pins the 99i side:
//   - _resolveCrystalGeomToken dispatches 'selenite_swallowtail_twin'
//     when mineral='selenite' + twinned=true + twin_law='swallowtail'
//   - _buildHabitGeom('selenite_swallowtail_twin') returns a
//     BufferGeometry with 72 vertex triples (24 triangles × 3 — two
//     blades, 6 faces × 2 triangles per blade)
//   - The twin token beats the air-mode dripstone override
//   - Mineral-scoped + law-scoped (gypsum + same law falls through;
//     selenite + a different law falls through)
//
// Wireframe pins live in tests-js/selenite-swallowtail.test.ts.

import { describe, expect, it } from 'vitest';

declare const _resolveCrystalGeomToken: any;
declare const _buildHabitGeom: any;

describe('selenite-swallowtail (99i) — geometry builder', () => {
  it('_buildHabitGeom("selenite_swallowtail_twin") returns a BufferGeometry', () => {
    const geom = _buildHabitGeom('selenite_swallowtail_twin');
    expect(geom).toBeTruthy();
    expect(geom.attributes).toBeTruthy();
    expect(geom.attributes.position).toBeTruthy();
  });

  it('has 72 vertex triples (24 triangles × 3): two blades × 6 faces × 2 triangles × 3 verts', () => {
    const geom = _buildHabitGeom('selenite_swallowtail_twin');
    const positions = geom.attributes.position.array;
    expect(positions.length).toBe(216);
    expect(geom.attributes.position.count).toBe(72);
  });

  it('blades fan in opposite X directions (V opening upward)', () => {
    // The min and max X coords should be roughly symmetric around 0 —
    // blade A leans -X, blade B leans +X. Top of each blade is the
    // furthest-from-X=0 corner.
    const geom = _buildHabitGeom('selenite_swallowtail_twin');
    const p = geom.attributes.position.array;
    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] < minX) minX = p[i];
      if (p[i] > maxX) maxX = p[i];
    }
    // Symmetric envelope (blade B mirrors blade A across X=0).
    expect(Math.abs(minX + maxX)).toBeLessThan(0.01);
    // Some real spread on X — the V is visible.
    expect(maxX - minX).toBeGreaterThan(0.3);
  });

  it('the V opens upward — top of blades is at higher Y than base', () => {
    // The blade pair, even though it's centered at origin, should
    // have its TOP at Y > 0 and its BASE at Y ≤ 0. With 30° tilt and
    // L=0.95, the top is at Y ≈ L*cos(30°) ≈ 0.82 and the outer
    // base corners at Y ≈ -2a*sin(30°) ≈ -0.05.
    const geom = _buildHabitGeom('selenite_swallowtail_twin');
    const p = geom.attributes.position.array;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < p.length; i += 3) {
      if (p[i] < minY) minY = p[i];
      if (p[i] > maxY) maxY = p[i];
    }
    expect(maxY).toBeGreaterThan(0.5);  // top well above origin
    expect(minY).toBeLessThan(0);  // outer base corners below origin
    // Top should be much further from origin than base depth (the
    // blade is long, not chunky).
    expect(maxY).toBeGreaterThan(-minY * 5);
  });

  it('the contact base edge corners coincide between the two blades', () => {
    // Per the wireframe convention, vertex i+8 mirrors vertex i across
    // X=0 for the contact-base corners (indices 4, 5 in blade A's
    // local; 12, 13 in blade B's local). In the flat-shaded triangle
    // expansion, those positions appear at multiple positions in the
    // position array. Easier sanity check: the most-coincident point
    // across both blades should be at X≈0, Y≈0 (where the base meets).
    const geom = _buildHabitGeom('selenite_swallowtail_twin');
    const p = geom.attributes.position.array;
    // Find positions where (X, Y) ≈ (0, 0) — the contact-base edge.
    let count = 0;
    for (let i = 0; i < p.length; i += 3) {
      if (Math.abs(p[i]) < 1e-4 && Math.abs(p[i + 1]) < 1e-4) count++;
    }
    // The contact-base edge corners appear in multiple triangles per
    // blade (each base corner is shared by 3 faces). At least some
    // occurrences should be present from both blades.
    expect(count).toBeGreaterThan(0);
  });
});

describe('selenite-swallowtail (99i) — _resolveCrystalGeomToken dispatch', () => {
  function mkSelenite(opts: Record<string, any> = {}) {
    return {
      crystal_id: 1,
      mineral: 'selenite',
      habit: 'tabular',
      c_length_mm: 10,
      a_width_mm: 3,
      growth_environment: 'fluid',
      twinned: false,
      twin_law: '',
      ...opts,
    };
  }

  it('twinned selenite + swallowtail law → "selenite_swallowtail_twin"', () => {
    const c = mkSelenite({ twinned: true, twin_law: 'swallowtail' });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('selenite_swallowtail_twin');
  });

  it('untwinned selenite → canonical token (NOT the twin)', () => {
    const c = mkSelenite({ twinned: false });
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('selenite_swallowtail_twin');
  });

  it('twinned selenite with empty twin_law → canonical (defensive)', () => {
    const c = mkSelenite({ twinned: true, twin_law: '' });
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('selenite_swallowtail_twin');
  });

  it('twinned selenite with a different twin_law → canonical', () => {
    const c = mkSelenite({ twinned: true, twin_law: 'arrowhead' });
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('selenite_swallowtail_twin');
  });

  it('twinned gypsum (separate mineral) with swallowtail law → NOT the selenite twin', () => {
    const c = { ...mkSelenite({ twinned: true, twin_law: 'swallowtail' }), mineral: 'gypsum' };
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('selenite_swallowtail_twin');
  });

  it('twinned selenite in air-mode cavity → swallowtail token (beats dripstone)', () => {
    const c = mkSelenite({
      twinned: true, twin_law: 'swallowtail',
      growth_environment: 'air',
    });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('selenite_swallowtail_twin');
  });

  it('twinned fluorite with swallowtail law → NOT the selenite twin', () => {
    // Mineral-scoped: fluorite + 'swallowtail' falls through (the
    // fluorite check is for 'penetration', not 'swallowtail').
    const c = { ...mkSelenite({ twinned: true, twin_law: 'swallowtail' }), mineral: 'fluorite' };
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('selenite_swallowtail_twin');
  });

  it('twinned selenite with prismatic habit still resolves to swallowtail', () => {
    // Twin override is mineral+law-scoped, ignores the habit string.
    const c = mkSelenite({ twinned: true, twin_law: 'swallowtail', habit: 'prismatic' });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('selenite_swallowtail_twin');
  });
});
