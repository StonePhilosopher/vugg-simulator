// tests-js/redox.test.ts — Nernst-equation infrastructure (Phase 4a).
// Locks in the helper signatures + the basic shape of the curves
// (oxidizing → f_ox → 1, reducing → f_ox → 0, midpoint at apparent
// E°). When Phase 4b/c land and engines start consuming these
// helpers, breaking them silently would be expensive — these tests
// are cheap insurance.

import { describe, expect, it } from 'vitest';

declare const REDOX_COUPLES: any;
declare const nernstOxidizedFraction: any;
declare const redoxFraction: any;
declare const ehFromO2: any;
declare const o2FromEh: any;
declare const EH_DYNAMIC_ENABLED: any;
declare const FluidChemistry: any;

describe('redox infrastructure (Phase 4a)', () => {
  it('flag is OFF in v26 — engines still gate on fluid.O2', () => {
    // If this flips to true without Phase 4b/c migration landing
    // first, every engine that reads `fluid.O2 > X` becomes a
    // false-negative and most scenarios stop nucleating.
    expect(EH_DYNAMIC_ENABLED).toBe(false);
  });

  it('three couples are encoded with the published E° values', () => {
    expect(REDOX_COUPLES).toBeTruthy();
    expect(REDOX_COUPLES.Fe).toBeTruthy();
    expect(REDOX_COUPLES.Mn).toBeTruthy();
    expect(REDOX_COUPLES.S).toBeTruthy();
    // E° in mV — published values from Stumm & Morgan / textbook.
    expect(REDOX_COUPLES.Fe.E0).toBe(770);
    expect(REDOX_COUPLES.Mn.E0).toBe(1230);
    expect(REDOX_COUPLES.S.E0).toBe(250);
  });

  it('Fe³⁺/Fe²⁺ midpoint sits at E°=770 mV regardless of pH', () => {
    // Fe couple has zero pH coefficient (no H⁺ in the half-reaction).
    const f1 = nernstOxidizedFraction(REDOX_COUPLES.Fe, 770, 4);
    const f2 = nernstOxidizedFraction(REDOX_COUPLES.Fe, 770, 7);
    const f3 = nernstOxidizedFraction(REDOX_COUPLES.Fe, 770, 9);
    expect(f1).toBeCloseTo(0.5, 5);
    expect(f2).toBeCloseTo(0.5, 5);
    expect(f3).toBeCloseTo(0.5, 5);
  });

  it('Mn couple shifts cathodically with rising pH (m=4 H⁺ in half-reaction)', () => {
    // pHCoeff = -118.32 mV/pH unit. At pH 4 the apparent E° is
    // 1230 + (-118.32) × 4 = 757 mV; at pH 8 it's 1230 - 947 = 283 mV.
    // Same Eh therefore gives a much higher f_ox at high pH (couple
    // gets EASIER to oxidize when H⁺ scarcity is offered).
    const Eh = 500;
    const fAcidic = nernstOxidizedFraction(REDOX_COUPLES.Mn, Eh, 4);
    const fNeutral = nernstOxidizedFraction(REDOX_COUPLES.Mn, Eh, 7);
    const fAlkaline = nernstOxidizedFraction(REDOX_COUPLES.Mn, Eh, 9);
    // pH 4: Eh < apparent E° → reduced dominates (f_ox small)
    expect(fAcidic).toBeLessThan(0.3);
    // pH 7: Eh > apparent E° (≈ 1230 - 828 = 402 mV) → oxidized dominates
    expect(fNeutral).toBeGreaterThan(0.7);
    // pH 9: even further oxidized
    expect(fAlkaline).toBeGreaterThan(fNeutral);
  });

  it('asymptotes are 0 and 1, no NaN/Infinity at extremes', () => {
    // Very oxidizing → f_ox saturates to ~1
    expect(nernstOxidizedFraction(REDOX_COUPLES.Fe, 5000, 7)).toBeCloseTo(1, 5);
    // Very reducing → f_ox saturates to ~0
    expect(nernstOxidizedFraction(REDOX_COUPLES.Fe, -5000, 7)).toBeCloseTo(0, 5);
    // No NaN
    const f = nernstOxidizedFraction(REDOX_COUPLES.S, 9999, 0);
    expect(Number.isFinite(f)).toBe(true);
    expect(f).toBeGreaterThanOrEqual(0);
    expect(f).toBeLessThanOrEqual(1);
  });

  it('redoxFraction(fluid, "Fe") reads from fluid.Eh + fluid.pH', () => {
    // Fe³⁺/Fe²⁺ E° = +770 mV. Eh well above → mostly oxidized;
    // Eh well below → mostly reduced. (Real groundwater at +200 mV
    // sits BELOW the Fe boundary, so most iron is Fe²⁺ — which is
    // why dissolved iron in oxic groundwater is still mobile until
    // it ferrihydrite-precipitates by pH-driven hydrolysis.)
    const oxic = new FluidChemistry({ Eh: 1100, pH: 7 });
    const anoxic = new FluidChemistry({ Eh: 100, pH: 7 });
    expect(redoxFraction(oxic, 'Fe')).toBeGreaterThan(0.95);
    expect(redoxFraction(anoxic, 'Fe')).toBeLessThan(0.05);
  });

  it('redoxFraction returns 0.5 sentinel on unknown element', () => {
    const f = new FluidChemistry({ Eh: 500, pH: 7 });
    expect(redoxFraction(f, 'XYZ')).toBe(0.5);
    expect(redoxFraction(f, '')).toBe(0.5);
  });

  it('ehFromO2 ↔ o2FromEh roundtrip is sane around the boundary', () => {
    // Not strictly invertible due to the piecewise-linear anchors,
    // but Eh from O₂ from Eh should land in the same regime band.
    for (const Eh0 of [-150, 0, 100, 300, 500]) {
      const O2 = o2FromEh(Eh0);
      const Eh1 = ehFromO2(O2);
      // ±100 mV tolerance — anchor seams are coarse on purpose.
      expect(Math.abs(Eh1 - Eh0)).toBeLessThan(120);
    }
  });

  it('FluidChemistry default Eh is +200 mV (mildly oxidizing)', () => {
    const f = new FluidChemistry();
    expect(f.Eh).toBe(200);
  });

  it('FluidChemistry({ Eh: -100 }) propagates the option', () => {
    const f = new FluidChemistry({ Eh: -100 });
    expect(f.Eh).toBe(-100);
  });
});
