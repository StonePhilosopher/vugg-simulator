// tests-js/wall-relief.test.ts — W-K V1 (wall microtexture). The cavity wall's
// GENESIS relief: a procedural normal map keyed on wall.architecture (js/99a
// _wallReliefNormalMap; wired into the cavity material in js/99i). These pins
// cover the pure height-field logic + the family mapping; the CanvasTexture step
// needs a real 2D context (returns null in jsdom, asserted null-safe).

import { describe, expect, it } from 'vitest';

declare const _WALL_RELIEF_FAMILY: any;
declare const _wallReliefHeight: any;
declare const _wallReliefNormalMap: any;
declare const _wallReliefRepeat: any;   // V1b: shared tiling helper
declare const _wallReliefAOMap: any;    // V1b: albedo ambient-occlusion map

function stats(fam: string) {
  let mn = 9, mx = -9;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const h = _wallReliefHeight(fam, x / 32, y / 32);
    mn = Math.min(mn, h); mx = Math.max(mx, h);
  }
  return { mn, mx };
}

describe('V1 — architecture → relief family mapping', () => {
  it('the 4 dissolution archetypes map to scallops', () => {
    for (const a of ['pocket', 'spherical', 'irregular', 'tabular']) expect(_WALL_RELIEF_FAMILY[a]).toBe('scallops');
  });
  it('cleft → cleft striations, basin → basin rind', () => {
    expect(_WALL_RELIEF_FAMILY.cleft).toBe('cleft');
    expect(_WALL_RELIEF_FAMILY.basin).toBe('basin');
  });
});

describe('V1 — height field is real relief (not flat) and in gamut', () => {
  for (const fam of ['scallops', 'cleft', 'basin']) {
    it(`${fam}: has variance and stays within [0,1]`, () => {
      const s = stats(fam);
      expect(s.mx - s.mn).toBeGreaterThan(0.3);   // real relief, not a constant plane
      expect(s.mn).toBeGreaterThanOrEqual(0);
      expect(s.mx).toBeLessThanOrEqual(1);
    });
  }
  it('is deterministic (RNG-free) — same coord → same height', () => {
    expect(_wallReliefHeight('scallops', 0.33, 0.66)).toBe(_wallReliefHeight('scallops', 0.33, 0.66));
  });
  it('scallops tile seamlessly — the two vertical edges match (toroidal)', () => {
    for (const yf of [0.1, 0.5, 0.9]) {
      // x=0 and x=1 are the same seam under RepeatWrapping
      expect(Math.abs(_wallReliefHeight('scallops', 0, yf) - _wallReliefHeight('scallops', 1, yf))).toBeLessThan(1e-9);
    }
  });
});

describe('V1 — normal-map generator is null-safe', () => {
  it('unknown architecture falls back to scallops family without throwing', () => {
    // no 2D canvas context in jsdom → returns null, but must NOT throw
    expect(() => _wallReliefNormalMap('nonsense_arch')).not.toThrow();
    expect(() => _wallReliefNormalMap('cleft')).not.toThrow();
  });
});

// ── W-K V1b (wall depth THROUGH translucency) ────────────────────────────────
// The genesis relief re-baked as an ALBEDO ambient-occlusion map (js/99a
// _wallReliefAOMap), multiplied into the cavity's diffuseColor by a shader hook
// (js/99i _applyWallReliefAO) so it reads through the 0.18–0.40 translucent wall
// where V1's lighting-only normal map washes out. The CanvasTexture needs a real
// 2D context (null in jsdom), so these pin the tiling contract + null-safety + the
// height-field signal the albedo shade rides on.

describe('V1b — AO map shares the normal map tiling (drift guard)', () => {
  it('basin bands tile [1,6]; scallops/cleft tile [5,5]', () => {
    expect(_wallReliefRepeat('basin')).toEqual([1, 6]);
    expect(_wallReliefRepeat('scallops')).toEqual([5, 5]);
    expect(_wallReliefRepeat('cleft')).toEqual([5, 5]);
  });
});

describe('V1b — albedo AO generator is null-safe', () => {
  it('every family + unknown returns without throwing (null in jsdom — no 2D ctx)', () => {
    for (const a of ['pocket', 'cleft', 'basin', 'nonsense_arch']) {
      expect(() => _wallReliefAOMap(a)).not.toThrow();
    }
  });
});

describe('V1b — AO darkening has a real recess↔rim signal per family', () => {
  // The AO stores gray = height·255; the shader darkens by (1 − amt·(1−gray)), so a
  // deeper recess (lower height) darkens more. Pin that each family's height field
  // actually spans dark recess → bright rim, i.e. the shade has something to ride on.
  for (const fam of ['scallops', 'cleft', 'basin']) {
    it(`${fam}: a genuine dark recess and a genuine bright rim exist`, () => {
      const s = stats(fam);
      expect(s.mn).toBeLessThan(0.35);    // a recess dark enough to shade
      expect(s.mx).toBeGreaterThan(0.65); // a rim left ~unshaded for contrast
    });
  }
});
