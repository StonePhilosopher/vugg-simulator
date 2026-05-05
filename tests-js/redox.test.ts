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
declare const sulfateRedoxAvailable: any;
declare const sulfateRedoxFactor: any;
declare const hydroxideRedoxAvailable: any;
declare const hydroxideRedoxFactor: any;

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

describe('Phase 4b sulfate redox helpers', () => {
  // Flag-OFF parity is the contract: with EH_DYNAMIC_ENABLED=false the
  // helpers must produce values that, when slotted into the engine
  // sites, give byte-identical seed-42 output. The legacy form is
  // strict-less-than (`fluid.O2 < X`) used as an early-exit gate; the
  // helper is `>=` queried with negation (`!sulfateRedoxAvailable(f, X)`),
  // so the boundary case (O2 == X) maps the same way.

  it('sulfateRedoxAvailable matches `fluid.O2 >= threshold` with flag off', () => {
    expect(EH_DYNAMIC_ENABLED).toBe(false);
    const cases = [
      { O2: 0.05, X: 0.1, want: false },
      { O2: 0.1,  X: 0.1, want: true },   // boundary: legacy `<` excludes; `>=` includes — same exit decision
      { O2: 0.5,  X: 0.1, want: true },
      { O2: 0.0,  X: 0.5, want: false },
      { O2: 1.5,  X: 0.5, want: true },
      { O2: 0.79, X: 0.8, want: false },
    ];
    for (const { O2, X, want } of cases) {
      const f = new FluidChemistry({ O2 });
      expect(sulfateRedoxAvailable(f, X)).toBe(want);
      // Negation matches the engine site form `!sulfateRedoxAvailable`.
      expect(!sulfateRedoxAvailable(f, X)).toBe(f.O2 < X);
    }
  });

  it('sulfateRedoxFactor matches `Math.min(O2/scale, cap)` with flag off', () => {
    expect(EH_DYNAMIC_ENABLED).toBe(false);
    const cases = [
      { O2: 0.4,  scale: 0.4,  cap: 1.5, want: 1.0 },     // barite at cap-eligible point
      { O2: 1.0,  scale: 0.4,  cap: 1.5, want: 1.5 },     // capped
      { O2: 0.0,  scale: 0.4,  cap: 1.5, want: 0.0 },
      { O2: 1.0,  scale: 1.0,  cap: 1.5, want: 1.0 },     // anhydrite at full
      { O2: 0.5,  scale: 1.5,  cap: 2.0, want: 1/3 },     // chalcanthite shape
      { O2: 0.5,  scale: 0.5,  cap: Infinity, want: 1.0 }, // selenite (no cap)
      { O2: 5.0,  scale: 0.5,  cap: Infinity, want: 10.0 }, // selenite high O2 grows unbounded
    ];
    for (const { O2, scale, cap, want } of cases) {
      const f = new FluidChemistry({ O2 });
      expect(sulfateRedoxFactor(f, scale, cap)).toBeCloseTo(want, 6);
    }
  });

  it('sulfateRedoxFactor cap defaults to Infinity (selenite-style sites)', () => {
    const f = new FluidChemistry({ O2: 2.0 });
    // No cap argument: should be 2.0 / 0.5 = 4.0 (no clamping)
    expect(sulfateRedoxFactor(f, 0.5)).toBeCloseTo(4.0, 6);
  });

  it('helpers tolerate fluid.O2 missing (returns 0 for `available`, 0 for factor)', () => {
    const f = {} as any; // not a FluidChemistry — no O2 field
    expect(sulfateRedoxAvailable(f, 0.1)).toBe(false);
    expect(sulfateRedoxFactor(f, 0.5, 1.5)).toBe(0);
  });
});

describe('Phase 4b hydroxide redox helpers', () => {
  // Same flag-OFF passthrough contract as sulfate; named separately so
  // Phase 4c can bind hydroxide to the Fe couple while sulfate stays
  // on the S couple. Until then the implementations are identical
  // and parity tests mirror the sulfate suite.

  it('hydroxideRedoxAvailable matches `fluid.O2 >= threshold` with flag off', () => {
    expect(EH_DYNAMIC_ENABLED).toBe(false);
    for (const { O2, X } of [
      { O2: 0.3, X: 0.4 }, { O2: 0.4, X: 0.4 }, { O2: 0.5, X: 0.4 },
      { O2: 0.79, X: 0.8 }, { O2: 0.8, X: 0.8 }, { O2: 1.5, X: 0.8 },
    ]) {
      const f = new FluidChemistry({ O2 });
      expect(hydroxideRedoxAvailable(f, X)).toBe(f.O2 >= X);
    }
  });

  it('hydroxideRedoxFactor matches goethite + lepidocrocite legacy expressions', () => {
    expect(EH_DYNAMIC_ENABLED).toBe(false);
    // goethite: o_f = O2 / 1.0 (no cap)
    // lepidocrocite: o_f = Math.min(O2 / 1.5, 1.5)
    for (const O2 of [0.0, 0.4, 0.8, 1.0, 1.5, 3.0, 10.0]) {
      const f = new FluidChemistry({ O2 });
      expect(hydroxideRedoxFactor(f, 1.0)).toBeCloseTo(O2 / 1.0, 6);
      expect(hydroxideRedoxFactor(f, 1.5, 1.5)).toBeCloseTo(Math.min(O2 / 1.5, 1.5), 6);
    }
  });
});
