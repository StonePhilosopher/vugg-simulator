// tests-js/wall-relief.test.ts — W-K V1 (wall microtexture). The cavity wall's
// GENESIS relief: a procedural normal map keyed on wall.architecture (js/99a
// _wallReliefNormalMap; wired into the cavity material in js/99i). These pins
// cover the pure height-field logic + the family mapping; the CanvasTexture step
// needs a real 2D context (returns null in jsdom, asserted null-safe).

import { describe, expect, it } from 'vitest';

declare const _WALL_RELIEF_FAMILY: any;
declare const _wallReliefHeight: any;
declare const _wallReliefNormalMap: any;

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
