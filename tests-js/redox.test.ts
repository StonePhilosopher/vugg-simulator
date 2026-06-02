// tests-js/redox.test.ts — Nernst-equation infrastructure (Phase 4a).
// Locks in the helper signatures + the basic shape of the curves
// (oxidizing → f_ox → 1, reducing → f_ox → 0, midpoint at apparent
// E°). When Phase 4b/c land and engines start consuming these
// helpers, breaking them silently would be expensive — these tests
// are cheap insurance.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
declare const oxideRedoxAvailable: any;
declare const oxideRedoxFactor: any;
declare const oxideRedoxAnoxic: any;
declare const oxideRedoxAnoxicFactor: any;
declare const oxideRedoxWindow: any;
declare const oxideRedoxTent: any;
declare const arsenateRedoxAvailable: any;
declare const arsenateRedoxFactor: any;
declare const carbonateRedoxAvailable: any;
declare const carbonateRedoxFactor: any;
declare const carbonateRedoxAnoxic: any;
declare const carbonateRedoxPenalty: any;
declare const sulfideRedoxAnoxic: any;
declare const sulfideRedoxLinearFactor: any;
declare const sulfideRedoxTent: any;
declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const setEhDynamicEnabled: any;
declare const snapshotEhDynamicFlag: any;   // live read of the bundle's let (the exported EH_DYNAMIC_ENABLED is a frozen load-time snapshot)

describe('redox infrastructure (Phase 4a)', () => {
  it('flag is ON by default (Phase 4c.2 landed 2026-06-02) — engines consume Eh', () => {
    // Was false through Phase 4a/4b (the migration wired helpers but kept
    // the legacy O2 path live). Phase 4c.2 flipped it: every redox engine
    // now derives its O2 from fluid.Eh via o2FromEh, with _syncRedoxEh (85c)
    // keeping Eh = ehFromO2(O2) just before the engines read each step. The
    // flag-OFF passthrough is still exercised by the parity blocks below,
    // which wrap their bodies in setEhDynamicEnabled(false).
    expect(EH_DYNAMIC_ENABLED).toBe(true);
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
  // Phase 4c.2: the flag now defaults ON, so force the legacy flag-OFF
  // passthrough for this parity block and restore after each test.
  beforeEach(() => setEhDynamicEnabled(false));
  afterEach(() => setEhDynamicEnabled(true));
  // Flag-OFF parity is the contract: with EH_DYNAMIC_ENABLED=false the
  // helpers must produce values that, when slotted into the engine
  // sites, give byte-identical seed-42 output. The legacy form is
  // strict-less-than (`fluid.O2 < X`) used as an early-exit gate; the
  // helper is `>=` queried with negation (`!sulfateRedoxAvailable(f, X)`),
  // so the boundary case (O2 == X) maps the same way.

  it('sulfateRedoxAvailable matches `fluid.O2 >= threshold` with flag off', () => {
    expect(snapshotEhDynamicFlag()).toBe(false);   // beforeEach forced flag OFF for this parity block
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
    expect(snapshotEhDynamicFlag()).toBe(false);   // beforeEach forced flag OFF for this parity block
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
  beforeEach(() => setEhDynamicEnabled(false));
  afterEach(() => setEhDynamicEnabled(true));
  // Same flag-OFF passthrough contract as sulfate; named separately so
  // Phase 4c can bind hydroxide to the Fe couple while sulfate stays
  // on the S couple. Until then the implementations are identical
  // and parity tests mirror the sulfate suite.

  it('hydroxideRedoxAvailable matches `fluid.O2 >= threshold` with flag off', () => {
    expect(snapshotEhDynamicFlag()).toBe(false);   // beforeEach forced flag OFF for this parity block
    for (const { O2, X } of [
      { O2: 0.3, X: 0.4 }, { O2: 0.4, X: 0.4 }, { O2: 0.5, X: 0.4 },
      { O2: 0.79, X: 0.8 }, { O2: 0.8, X: 0.8 }, { O2: 1.5, X: 0.8 },
    ]) {
      const f = new FluidChemistry({ O2 });
      expect(hydroxideRedoxAvailable(f, X)).toBe(f.O2 >= X);
    }
  });

  it('hydroxideRedoxFactor matches goethite + lepidocrocite legacy expressions', () => {
    expect(snapshotEhDynamicFlag()).toBe(false);   // beforeEach forced flag OFF for this parity block
    // goethite: o_f = O2 / 1.0 (no cap)
    // lepidocrocite: o_f = Math.min(O2 / 1.5, 1.5)
    for (const O2 of [0.0, 0.4, 0.8, 1.0, 1.5, 3.0, 10.0]) {
      const f = new FluidChemistry({ O2 });
      expect(hydroxideRedoxFactor(f, 1.0)).toBeCloseTo(O2 / 1.0, 6);
      expect(hydroxideRedoxFactor(f, 1.5, 1.5)).toBeCloseTo(Math.min(O2 / 1.5, 1.5), 6);
    }
  });
});

describe('Phase 4b oxide redox helpers', () => {
  beforeEach(() => setEhDynamicEnabled(false));
  afterEach(() => setEhDynamicEnabled(true));
  // Three semantic shapes: standard oxidized-side (hematite),
  // reduced-side (uraninite), windowed (magnetite + cuprite).

  it('oxideRedoxAvailable matches hematite legacy gate', () => {
    for (const O2 of [0.4, 0.49, 0.5, 0.51, 1.0]) {
      const f = new FluidChemistry({ O2 });
      expect(oxideRedoxAvailable(f, 0.5)).toBe(O2 >= 0.5);
    }
  });

  it('oxideRedoxFactor matches hematite legacy multiplier', () => {
    // hematite: o_f = O2 / 1.0 (no cap)
    for (const O2 of [0.5, 1.0, 1.5, 3.0]) {
      const f = new FluidChemistry({ O2 });
      expect(oxideRedoxFactor(f, 1.0)).toBeCloseTo(O2 / 1.0, 6);
    }
  });

  it('oxideRedoxAnoxic matches uraninite legacy reverse gate', () => {
    // legacy: `if (O2 > 0.3) return 0` — anoxic helper returns
    // false (i.e., gate exits) when O2 > 0.3
    for (const O2 of [0.0, 0.2, 0.3, 0.4, 1.0]) {
      const f = new FluidChemistry({ O2 });
      expect(oxideRedoxAnoxic(f, 0.3)).toBe(O2 <= 0.3);
    }
  });

  it('oxideRedoxAnoxicFactor matches uraninite legacy (0.5 - O2)', () => {
    // After the gate at 0.3, O2 stays in [0, 0.3]; factor in [0.2, 0.5].
    for (const O2 of [0.0, 0.1, 0.2, 0.3]) {
      const f = new FluidChemistry({ O2 });
      expect(oxideRedoxAnoxicFactor(f, 0.5)).toBeCloseTo(0.5 - O2, 6);
    }
  });

  it('oxideRedoxWindow matches magnetite (0.1, 1.0) and cuprite (0.3, 1.2) legacy', () => {
    for (const O2 of [0.0, 0.1, 0.5, 1.0, 1.1, 1.2, 1.5]) {
      const f = new FluidChemistry({ O2 });
      expect(oxideRedoxWindow(f, 0.1, 1.0)).toBe(O2 >= 0.1 && O2 <= 1.0);
      expect(oxideRedoxWindow(f, 0.3, 1.2)).toBe(O2 >= 0.3 && O2 <= 1.2);
    }
  });

  it('oxideRedoxTent matches magnetite (peak 0.4, slope 1.5, floor 0.4) and cuprite (peak 0.7, slope 1.4, floor 0.3)', () => {
    for (const O2 of [0.0, 0.4, 0.7, 1.0]) {
      const f = new FluidChemistry({ O2 });
      const magLegacy = Math.max(0.4, 1.0 - Math.abs(O2 - 0.4) * 1.5);
      const cupLegacy = Math.max(0.3, 1.0 - Math.abs(O2 - 0.7) * 1.4);
      expect(oxideRedoxTent(f, 0.4, 1.5, 0.4)).toBeCloseTo(magLegacy, 6);
      expect(oxideRedoxTent(f, 0.7, 1.4, 0.3)).toBeCloseTo(cupLegacy, 6);
    }
  });
});

describe('Phase 4b arsenate redox helpers', () => {
  beforeEach(() => setEhDynamicEnabled(false));
  afterEach(() => setEhDynamicEnabled(true));
  it('arsenateRedoxAvailable / Factor parity with legacy form', () => {
    expect(snapshotEhDynamicFlag()).toBe(false);   // beforeEach forced flag OFF for this parity block
    for (const O2 of [0.0, 0.2, 0.3, 0.5, 1.0, 2.0]) {
      const f = new FluidChemistry({ O2 });
      // gates at 0.3 (most arsenates) and 0.5 (olivenite)
      expect(arsenateRedoxAvailable(f, 0.3)).toBe(O2 >= 0.3);
      expect(arsenateRedoxAvailable(f, 0.5)).toBe(O2 >= 0.5);
      // multipliers: /1.0 uncapped (most), /1.0 cap 2.0 (olivenite)
      expect(arsenateRedoxFactor(f, 1.0)).toBeCloseTo(O2 / 1.0, 6);
      expect(arsenateRedoxFactor(f, 1.0, 2.0)).toBeCloseTo(Math.min(O2 / 1.0, 2.0), 6);
    }
  });
});

describe('Phase 4b carbonate redox helpers', () => {
  beforeEach(() => setEhDynamicEnabled(false));
  afterEach(() => setEhDynamicEnabled(true));
  // Standard pair (oxidized side) parity is the same shape as
  // sulfate's — covered in spirit. Focus tests on the new shapes:
  // anoxic gate + soft penalty.

  it('carbonateRedoxAnoxic matches siderite + rhodochrosite hard reverse gates', () => {
    expect(snapshotEhDynamicFlag()).toBe(false);   // beforeEach forced flag OFF for this parity block
    for (const O2 of [0.0, 0.5, 0.8, 0.81, 1.5, 1.51]) {
      const f = new FluidChemistry({ O2 });
      expect(carbonateRedoxAnoxic(f, 0.8)).toBe(O2 <= 0.8);
      expect(carbonateRedoxAnoxic(f, 1.5)).toBe(O2 <= 1.5);
    }
  });

  it('carbonateRedoxPenalty matches siderite legacy (smooth join, peak=1.0)', () => {
    // siderite legacy: if (O2 > 0.3) sigma *= max(0.2, 1.0 - (O2 - 0.3) * 1.5)
    for (const O2 of [0.0, 0.3, 0.31, 0.5, 0.8, 1.0, 1.5]) {
      const f = new FluidChemistry({ O2 });
      const expected = O2 <= 0.3 ? 1.0 : Math.max(0.2, 1.0 - (O2 - 0.3) * 1.5);
      expect(carbonateRedoxPenalty(f, 0.3, 1.0, 1.5, 0.2)).toBeCloseTo(expected, 6);
    }
  });

  it('carbonateRedoxPenalty matches rhodochrosite legacy (step at 0.8, peak=0.7)', () => {
    // rhodochrosite legacy: if (O2 > 0.8) sigma *= max(0.3, 1.5 - O2)
    // The 1.5 - O2 form has peakValueAtStart = 0.7 (hence the step
    // discontinuity from 1.0 below threshold to 0.7 just above).
    for (const O2 of [0.0, 0.5, 0.8, 0.81, 1.0, 1.2, 1.5, 2.0]) {
      const f = new FluidChemistry({ O2 });
      const expected = O2 <= 0.8 ? 1.0 : Math.max(0.3, 1.5 - O2);
      expect(carbonateRedoxPenalty(f, 0.8, 0.7, 1.0, 0.3)).toBeCloseTo(expected, 6);
    }
  });
});

describe('Phase 4b sulfide redox helpers', () => {
  beforeEach(() => setEhDynamicEnabled(false));
  afterEach(() => setEhDynamicEnabled(true));
  // Sulfide is the largest class — 34 sites, 4 shapes folded into
  // 3 helpers. Test each call pattern against its legacy form.

  it('sulfideRedoxAnoxic matches the 18 hard reverse gates', () => {
    expect(snapshotEhDynamicFlag()).toBe(false);   // beforeEach forced flag OFF for this parity block
    // Sample of thresholds used: 0.5 (acanthite), 0.6 (nickeline),
    // 0.8 (arsenopyrite), 1.0 (stibnite), 1.2 (molybdenite),
    // 1.5 (most), 1.8 (bornite), 1.9 (chalcocite), 2.0 (covellite)
    for (const X of [0.5, 0.8, 1.2, 1.5, 1.9]) {
      for (const O2 of [0.0, X - 0.01, X, X + 0.01, 5.0]) {
        const f = new FluidChemistry({ O2 });
        expect(sulfideRedoxAnoxic(f, X)).toBe(O2 <= X);
      }
    }
  });

  it('sulfideRedoxLinearFactor: no-clamp linear (pyrite/galena/etc., 8 sites)', () => {
    // Legacy: `(1.5 - O2)` raw. With slope=1, floor=-Infinity.
    for (const O2 of [0.0, 0.5, 1.0, 1.4, 1.5, 1.6]) {
      const f = new FluidChemistry({ O2 });
      expect(sulfideRedoxLinearFactor(f, 1.5)).toBeCloseTo(1.5 - O2, 6);
    }
  });

  it('sulfideRedoxLinearFactor: floored offset (stibnite/bornite/etc., 4 sites)', () => {
    // stibnite: max(0.5, 1.3 - O2)
    // bornite:  max(0.3, 1.5 - O2)
    // chalcocite: max(0.3, 1.4 - O2)
    for (const O2 of [0.0, 0.8, 1.0, 1.2, 1.5, 2.0]) {
      const f = new FluidChemistry({ O2 });
      expect(sulfideRedoxLinearFactor(f, 1.3, 1.0, 0.5)).toBeCloseTo(Math.max(0.5, 1.3 - O2), 6);
      expect(sulfideRedoxLinearFactor(f, 1.5, 1.0, 0.3)).toBeCloseTo(Math.max(0.3, 1.5 - O2), 6);
      expect(sulfideRedoxLinearFactor(f, 1.4, 1.0, 0.3)).toBeCloseTo(Math.max(0.3, 1.4 - O2), 6);
    }
  });

  it('sulfideRedoxLinearFactor: slope variant (nickeline/millerite/cobaltite, 3 sites)', () => {
    // Legacy: max(0.4, 1.0 - O2 × 1.5). Maps to intercept=1.0, slope=1.5, floor=0.4.
    for (const O2 of [0.0, 0.2, 0.4, 0.5, 1.0, 2.0]) {
      const f = new FluidChemistry({ O2 });
      expect(sulfideRedoxLinearFactor(f, 1.0, 1.5, 0.4))
        .toBeCloseTo(Math.max(0.4, 1.0 - O2 * 1.5), 6);
    }
  });

  it('sulfideRedoxTent matches covellite legacy (peak 0.8, value 1.3, slope 1.0, floor 0.3)', () => {
    // Legacy: max(0.3, 1.3 - Math.abs(O2 - 0.8))
    for (const O2 of [0.0, 0.5, 0.8, 1.0, 1.5, 2.0]) {
      const f = new FluidChemistry({ O2 });
      const expected = Math.max(0.3, 1.3 - Math.abs(O2 - 0.8));
      expect(sulfideRedoxTent(f, 0.8, 1.3, 1.0, 0.3)).toBeCloseTo(expected, 6);
    }
  });
});

describe('Phase 4c.1 — fluid.Eh tracks O2 every step (observer sync)', () => {
  // Until 4c.1, fluid.Eh was written once at init and FROZEN, so the
  // strip's Eh chip showed a dead flat line at +200 while O2 (the
  // variable the engines actually read) moved underneath it. _syncRedoxEh
  // (85c, called at the end of run_step) now derives Eh = ehFromO2(O2) on
  // every fluid container. Observer-only while EH_DYNAMIC_ENABLED is off:
  // nothing reads Eh in flag-OFF mode, so seed-42 crystal output is
  // byte-identical (locked by calibration.test.ts) — this only makes the
  // recorded/displayed Eh correct. These tests are the tripwire against a
  // future change silently re-freezing Eh, and they pin the exact
  // invariant the 4c.2 flag-flip relies on.

  it('the bulk Eh equals ehFromO2(O2) at the end of every step, and is no longer pinned at +200', () => {
    // The sync runs regardless of the flag; the Eh-tracks-O2 invariant is
    // what 4c.2's consumed path relies on (engines read o2FromEh(Eh)=O2).
    setSeed(42);
    const { conditions, events } = SCENARIOS.supergene_oxidation();
    const sim = new VugSimulator(conditions, events);
    const ehs: number[] = [];
    for (let s = 0; s < 40; s++) {
      sim.run_step();
      const f = sim.conditions.fluid;
      // _syncRedoxEh is the last fluid mutation in run_step → exact.
      expect(f.Eh).toBeCloseTo(ehFromO2(f.O2), 6);
      ehs.push(f.Eh);
    }
    // O2 swings in supergene → Eh moved off the frozen +200 default.
    expect(new Set(ehs.map((x) => Math.round(x))).size).toBeGreaterThan(1);
    expect(ehs.some((x) => Math.abs(x - 200) > 1)).toBe(true);
  });

  it('a flat-O2 scenario pins Eh at ehFromO2(O2) — correct, not the init +200', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.cooling();
    const sim = new VugSimulator(conditions, events);
    for (let s = 0; s < 20; s++) sim.run_step();
    const f = sim.conditions.fluid;
    expect(f.Eh).toBeCloseTo(ehFromO2(f.O2), 6);
    expect(f.Eh).toBeLessThan(0);   // cooling O2≈0.1 → Eh≈-75, not +200
  });

  it('the sync reaches per-cell fluids (a wall voxel\'s Eh matches its own O2)', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.supergene_oxidation();
    const sim = new VugSimulator(conditions, events);
    for (let s = 0; s < 30; s++) sim.run_step();
    const equator = Math.floor(sim.wall_state.ring_count / 2);
    const cell = typeof sim.fluidAtVoxel === 'function'
      ? sim.fluidAtVoxel(equator, 0, 0) : null;
    if (cell && typeof cell.O2 === 'number') {
      expect(cell.Eh).toBeCloseTo(ehFromO2(cell.O2), 6);
    }
  });
});

describe('Phase 4c.2 — engines CONSUME Eh (flag ON by default)', () => {
  // With the flag on, the per-class helpers derive their O2 from fluid.Eh
  // (o2FromEh), so Eh — not the raw O2 field — is what gates a mineral.
  // These pin (a) that the consumed path actually follows Eh, and (b) the
  // bridge identity the seed-42 byte-equivalence rests on: when Eh is the
  // ehFromO2 image of O2 (which _syncRedoxEh guarantees each step), the
  // helper reproduces the legacy O2-form result.

  it('the flag is ON, so the helper follows Eh even when raw O2 disagrees', () => {
    expect(EH_DYNAMIC_ENABLED).toBe(true);
    // Raw O2 says "anoxic" (0) but Eh says strongly oxidizing (+600). The
    // consumed path reads Eh → o2FromEh(+600) ≈ oxic → gate passes, despite
    // O2=0. (Flag-OFF this would be false: 0 >= 0.1 is false.)
    const f = new FluidChemistry({ O2: 0, Eh: 600 });
    expect(sulfateRedoxAvailable(f, 0.1)).toBe(true);
    // And the converse: oxic O2 but reducing Eh → gate fails on Eh.
    const g = new FluidChemistry({ O2: 5, Eh: -200 });
    expect(sulfateRedoxAvailable(g, 0.1)).toBe(false);
  });

  it('bridge identity: with Eh = ehFromO2(O2), the consumed path == the legacy O2 form', () => {
    // This is why the flag flip is byte-equivalent: _syncRedoxEh sets
    // Eh = ehFromO2(O2) before the engines read, so o2FromEh(Eh) round-trips
    // back to O2 (exact for O2 ∈ [0.05,5]) and the gate decision is unchanged.
    for (const O2 of [0.05, 0.1, 0.3, 0.5, 0.8, 1.0, 1.5, 2.0]) {
      const f = new FluidChemistry({ O2, Eh: ehFromO2(O2) });
      for (const X of [0.1, 0.3, 0.5, 0.8]) {
        expect(sulfateRedoxAvailable(f, X)).toBe(O2 >= X);
      }
    }
  });
});

describe('Phase 4c.3a — Eh-CANONICAL: a movement driving Eh makes O2 follow', () => {
  // "Follow the science": Eh is the master redox variable. By default the sync
  // is O2→Eh (Eh is a derived view). But when a movement drives fluid.Eh,
  // run_step flips to Eh→O2 so the movement's Eh is the source of truth and
  // isn't clobbered before the engines (which read o2FromEh(Eh)) see it. This
  // is the mechanism the mvt Eh-movement pilot rides on. Sim-neutral until a
  // scenario opts in (no scenario declares movements yet → byte-identical,
  // locked by calibration.test.ts).

  it('an injected fluid.Eh movement drives O2 = o2FromEh(Eh), overriding the O2→Eh default', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.cooling();   // closed, O2≈0.1 (reducing)
    const sim = new VugSimulator(conditions, events);
    // Inject (runtime only) a movement holding Eh at +400 mV (oxidizing) — far
    // from what cooling's O2≈0.1 would imply (ehFromO2(0.1) ≈ −75).
    if (!sim.conditions._scenario) sim.conditions._scenario = {};
    sim.conditions._scenario.movements = [
      { field: 'fluid.Eh', startStep: 0, endStep: 20, base: 400, ops: [{ kind: 'trend', amp: 0 }] },
    ];
    for (let s = 0; s < 10; s++) sim.run_step();
    const f = sim.conditions.fluid;
    // Eh is the movement's setpoint, NOT the O2→Eh derivation.
    expect(f.Eh).toBeGreaterThan(300);
    // O2 was reverse-derived from the movement's Eh (Eh-canonical direction) —
    // i.e. the engines (o2FromEh(Eh)) now see the movement, not the stale O2.
    expect(f.O2).toBeCloseTo(o2FromEh(f.Eh), 6);
    expect(f.O2).toBeGreaterThan(1);   // +400 mV → oxidizing O2, well above the initial 0.1
  });
});
