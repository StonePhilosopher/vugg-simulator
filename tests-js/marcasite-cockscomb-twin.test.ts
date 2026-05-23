// tests-js/marcasite-cockscomb-twin.test.ts — sixth iconic twin
//
// v134 (2026-05-22) ships PRIM_MARCASITE_COCKSCOMB_TWIN — two thin
// needle-like blades joined on a {110} contact at the base, opening
// in a 40° V. The canonical morphology distinguishing marcasite
// from its dimorph pyrite (Ramdohr 1980; Dana 8th ed.). v133 sets
// cyclic cockscomb at p=0.55 per nucleation; ~52% net frequency
// after the spearhead twin (p=0.05) checks first.

import { describe, expect, it } from 'vitest';

declare const PRIM_MARCASITE_COCKSCOMB_TWIN: any;
declare const _lookupCrystalPrimitive: any;

describe('marcasite-cockscomb-twin — primitive geometry', () => {
  it('PRIM_MARCASITE_COCKSCOMB_TWIN is defined', () => {
    expect(PRIM_MARCASITE_COCKSCOMB_TWIN).toBeTruthy();
    expect(PRIM_MARCASITE_COCKSCOMB_TWIN.name).toBe('marcasite_cockscomb_twin');
  });

  it('has 16 vertices (8 per blade)', () => {
    expect(PRIM_MARCASITE_COCKSCOMB_TWIN.vertices).toHaveLength(16);
  });

  it('has 24 edges (12 per blade)', () => {
    expect(PRIM_MARCASITE_COCKSCOMB_TWIN.edges).toHaveLength(24);
  });

  it('contact-base corners coincide at (0, -0.1, ±b) between the two blades', () => {
    // Same convention as swallowtail: blade A indices 4, 5 (xl=0, yl=0)
    // coincide with blade B indices 8, 9.
    const v4 = PRIM_MARCASITE_COCKSCOMB_TWIN.vertices[4];
    const v5 = PRIM_MARCASITE_COCKSCOMB_TWIN.vertices[5];
    const v8 = PRIM_MARCASITE_COCKSCOMB_TWIN.vertices[8];
    const v9 = PRIM_MARCASITE_COCKSCOMB_TWIN.vertices[9];
    expect(v4[0]).toBeCloseTo(v8[0], 4);
    expect(v4[1]).toBeCloseTo(v8[1], 4);
    expect(v4[2]).toBeCloseTo(v8[2], 4);
    expect(v5[0]).toBeCloseTo(v9[0], 4);
    expect(v4[0]).toBeCloseTo(0, 4);
    expect(v4[1]).toBeCloseTo(-0.1, 4);
  });

  it('the V opening angle is 40° (20° per blade from vertical)', () => {
    // Tighter than swallowtail's 60° — the diagnostic narrower V of
    // marcasite cockscomb vs gypsum swallowtail.
    const v4 = PRIM_MARCASITE_COCKSCOMB_TWIN.vertices[4];
    const v6 = PRIM_MARCASITE_COCKSCOMB_TWIN.vertices[6];
    const dx = v6[0] - v4[0];
    const dy = v6[1] - v4[1];
    const angleFromVertical = Math.atan2(Math.abs(dx), dy);
    expect(angleFromVertical).toBeCloseTo(Math.PI / 9, 4);  // 20°
  });

  it('blades fan in opposite X directions at the contact-top (V silhouette)', () => {
    const v6 = PRIM_MARCASITE_COCKSCOMB_TWIN.vertices[6];
    const v10 = PRIM_MARCASITE_COCKSCOMB_TWIN.vertices[10];
    expect(v6[0]).toBeLessThan(0);
    expect(v10[0]).toBeGreaterThan(0);
    expect(v6[0]).toBeCloseTo(-v10[0], 4);
  });

  it('thinner than swallowtail — blade thickness 2a = 0.08 (vs swallowtail 0.16)', () => {
    // Each blade's outermost base corner is at xl = -2a = -0.08
    // (before rotation). After rotation by 20°, the world X of that
    // corner is -2a · cos(20°) ≈ -0.0752. Confirms the blade is
    // genuinely thinner than swallowtail.
    const v0 = PRIM_MARCASITE_COCKSCOMB_TWIN.vertices[0];
    const expectedX = -2 * 0.04 * Math.cos(Math.PI / 9);
    expect(v0[0]).toBeCloseTo(expectedX, 4);
    expect(Math.abs(v0[0])).toBeLessThan(0.1);  // distinctly thinner than 0.16 envelope
  });

  it('per-blade edge sets are disjoint (no cross-blade edges)', () => {
    const bladeA = PRIM_MARCASITE_COCKSCOMB_TWIN.edges.filter((e: number[]) => e[0] < 8 && e[1] < 8);
    const bladeB = PRIM_MARCASITE_COCKSCOMB_TWIN.edges.filter((e: number[]) => e[0] >= 8 && e[1] >= 8);
    expect(bladeA).toHaveLength(12);
    expect(bladeB).toHaveLength(12);
  });

  it('blade lengths preserved (rigid rotation)', () => {
    const dist = (a: number[], b: number[]) => Math.sqrt(
      (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2,
    );
    const v4 = PRIM_MARCASITE_COCKSCOMB_TWIN.vertices[4];
    const v6 = PRIM_MARCASITE_COCKSCOMB_TWIN.vertices[6];
    const v8 = PRIM_MARCASITE_COCKSCOMB_TWIN.vertices[8];
    const v10 = PRIM_MARCASITE_COCKSCOMB_TWIN.vertices[10];
    expect(dist(v4, v6)).toBeCloseTo(1.1, 4);
    expect(dist(v8, v10)).toBeCloseTo(1.1, 4);
  });
});

describe('marcasite-cockscomb-twin — dispatch precedence', () => {
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

  it('twinned marcasite + cockscomb → cockscomb twin primitive', () => {
    const c = mkMarcasite({ twinned: true, twin_law: 'cockscomb' });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_MARCASITE_COCKSCOMB_TWIN);
  });

  it('untwinned marcasite → canonical (NOT cockscomb twin)', () => {
    const c = mkMarcasite({ twinned: false });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_MARCASITE_COCKSCOMB_TWIN);
  });

  it('twinned marcasite with "spearhead" twin_law → NOT cockscomb (separate law)', () => {
    // Marcasite has TWO twin laws in v133's data: spearhead {101}
    // (p=0.05) and cockscomb {110} (p=0.55). The cockscomb dispatch
    // is law-scoped — spearhead falls through to canonical (or could
    // hit a future PRIM_MARCASITE_SPEARHEAD_TWIN, currently deferred).
    const c = mkMarcasite({ twinned: true, twin_law: 'spearhead' });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_MARCASITE_COCKSCOMB_TWIN);
  });

  it('twinned marcasite with empty twin_law → canonical', () => {
    const c = mkMarcasite({ twinned: true, twin_law: '' });
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_MARCASITE_COCKSCOMB_TWIN);
  });

  it('twinned pyrite with cockscomb law → NOT marcasite twin (mineral-scoped)', () => {
    // Pyrite is FeS2 dimorph of marcasite — but the cockscomb morphology
    // is marcasite-specific. Even if a pyrite somehow had this twin
    // law tag, the dispatch is mineral-scoped.
    const c = { ...mkMarcasite({ twinned: true, twin_law: 'cockscomb' }), mineral: 'pyrite' };
    expect(_lookupCrystalPrimitive(c)).not.toBe(PRIM_MARCASITE_COCKSCOMB_TWIN);
  });

  it('twinned marcasite in air-mode → cockscomb twin (beats dripstone)', () => {
    const c = mkMarcasite({
      twinned: true, twin_law: 'cockscomb',
      growth_environment: 'air',
    });
    expect(_lookupCrystalPrimitive(c)).toBe(PRIM_MARCASITE_COCKSCOMB_TWIN);
  });
});
