// tests-js/marcasite-cockscomb-twin-three.test.ts — 99i parity for
// the marcasite cockscomb twin (v134, sixth iconic twin).

import { describe, expect, it } from 'vitest';

declare const _resolveCrystalGeomToken: any;
declare const _buildHabitGeom: any;

describe('marcasite-cockscomb-twin (99i) — geometry builder', () => {
  it('_buildHabitGeom("marcasite_cockscomb_twin") returns a BufferGeometry', () => {
    const geom = _buildHabitGeom('marcasite_cockscomb_twin');
    expect(geom).toBeTruthy();
    expect(geom.attributes.position).toBeTruthy();
  });

  it('has 72 vertex triples (matches swallowtail count — same box-pair topology)', () => {
    const geom = _buildHabitGeom('marcasite_cockscomb_twin');
    expect(geom.attributes.position.count).toBe(72);
    expect(geom.attributes.position.array.length).toBe(216);
  });

  it('V opens upward — top above the contact base', () => {
    const geom = _buildHabitGeom('marcasite_cockscomb_twin');
    const p = geom.attributes.position.array;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < p.length; i += 3) {
      if (p[i] < minY) minY = p[i];
      if (p[i] > maxY) maxY = p[i];
    }
    expect(maxY).toBeGreaterThan(0.5);  // top well above origin
    expect(minY).toBeLessThan(0);       // outer base corners below origin
  });

  it('blades fan in opposite X directions — symmetric envelope', () => {
    const geom = _buildHabitGeom('marcasite_cockscomb_twin');
    const p = geom.attributes.position.array;
    let minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] < minX) minX = p[i];
      if (p[i] > maxX) maxX = p[i];
    }
    expect(Math.abs(minX + maxX)).toBeLessThan(0.01);  // symmetric
  });

  it('XZ extent is narrower than swallowtail (thinner blade dimensions)', () => {
    // Marcasite cockscomb a=0.025, b=0.08 (vs swallowtail a=0.05, b=0.15).
    // X extent max ≈ 2a·cos(20°) + L·sin(20°) ≈ 0.04 + 0.325 = 0.365.
    // (Swallowtail's: 2·0.05·cos30° + 0.95·sin30° ≈ 0.087 + 0.475 = 0.562.)
    const geom = _buildHabitGeom('marcasite_cockscomb_twin');
    const p = geom.attributes.position.array;
    let maxAbsX = 0, maxAbsZ = 0;
    for (let i = 0; i < p.length; i += 3) {
      if (Math.abs(p[i]) > maxAbsX) maxAbsX = Math.abs(p[i]);
      if (Math.abs(p[i + 2]) > maxAbsZ) maxAbsZ = Math.abs(p[i + 2]);
    }
    expect(maxAbsX).toBeLessThan(0.4);  // narrower X envelope than swallowtail
    expect(maxAbsZ).toBeLessThan(0.1);  // narrower Z (thin tangential)
  });
});

describe('marcasite-cockscomb-twin (99i) — _resolveCrystalGeomToken dispatch', () => {
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

  it('twinned marcasite + cockscomb → "marcasite_cockscomb_twin"', () => {
    const c = mkMarcasite({ twinned: true, twin_law: 'cockscomb' });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('marcasite_cockscomb_twin');
  });

  it('untwinned marcasite → canonical (NOT twin)', () => {
    const c = mkMarcasite({ twinned: false });
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('marcasite_cockscomb_twin');
  });

  it('twinned marcasite with "spearhead" law → canonical (separate law)', () => {
    const c = mkMarcasite({ twinned: true, twin_law: 'spearhead' });
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('marcasite_cockscomb_twin');
  });

  it('twinned marcasite with empty twin_law → canonical', () => {
    const c = mkMarcasite({ twinned: true, twin_law: '' });
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('marcasite_cockscomb_twin');
  });

  it('twinned pyrite with cockscomb law → NOT marcasite twin (mineral-scoped)', () => {
    const c = { ...mkMarcasite({ twinned: true, twin_law: 'cockscomb' }), mineral: 'pyrite' };
    expect(_resolveCrystalGeomToken(c, c.habit)).not.toBe('marcasite_cockscomb_twin');
  });

  it('twinned marcasite in air-mode → twin token (beats dripstone)', () => {
    const c = mkMarcasite({
      twinned: true, twin_law: 'cockscomb',
      growth_environment: 'air',
    });
    expect(_resolveCrystalGeomToken(c, c.habit)).toBe('marcasite_cockscomb_twin');
  });
});
