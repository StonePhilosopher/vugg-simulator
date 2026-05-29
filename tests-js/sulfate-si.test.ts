// tests-js/sulfate-si.test.ts — v164 sulfate SI engine pins.
//
// Mirrors the carbonate-ksp.test.ts structure for the new
// sulfateSaturationIndex / sulfateOmega engine (js/40b) reading
// thermo-sulfates.json via js/20d's getSulfateLogKsp.
//
// What this locks in:
//   - The 4 canonical sulfates dispatch (selenite, anhydrite, barite,
//     celestine) + the 'gypsum' alias for selenite
//   - SI math signs at known under-, equilibrium, and super-saturated fluids
//   - Barite ENDOTHERMIC dissolution (SI at constant fluid DROPS as T rises)
//   - Gypsum / anhydrite / celestine RETROGRADE dissolution (SI rises with T)
//   - Naica + Sicily + MVT geological reference points
//   - All four sulfates are tier-A confidence (PHREEQC wateq4f.dat)
//   - NaN for missing cation / missing S
//
// Phase 1 / observer-only — no engine call sites consume these yet
// (next bump wires the strip chips). Pure-math tests.

import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;

declare const sulfateSaturationIndex: (mineralId: string, fluid: any, T_C: number) => number;
declare const sulfateOmega: (mineralId: string, fluid: any, T_C: number) => number;
declare const getSulfateLogKsp: (mineralId: string, T_C: number) => number;
declare const getSulfateKsp: (mineralId: string, T_C: number) => number;
declare const getSulfateThermoTier: (mineralId: string) => string;
declare const listSulfatesAtTier: (tier: string) => string[];

describe('v164 sulfate Ksp — thermo data tier coverage', () => {
  it('all four canonical simple sulfates are tier-A (PHREEQC wateq4f.dat verified)', () => {
    expect(getSulfateThermoTier('selenite')).toBe('A');
    expect(getSulfateThermoTier('anhydrite')).toBe('A');
    expect(getSulfateThermoTier('barite')).toBe('A');
    expect(getSulfateThermoTier('celestine')).toBe('A');
  });

  it('listSulfatesAtTier(A) returns exactly the four canonical sulfates', () => {
    const tierA = listSulfatesAtTier('A');
    expect(new Set(tierA)).toEqual(new Set(['selenite', 'anhydrite', 'barite', 'celestine']));
  });

  it('logKsp_25C matches PHREEQC wateq4f.dat exactly', () => {
    // These four numbers ARE the test — they come from the publicly
    // distributed wateq4f.dat (USGS) and must not drift without an
    // accompanying note in the JSON's _sourcing block.
    expect(getSulfateLogKsp('selenite', 25)).toBeCloseTo(-4.58, 5);
    expect(getSulfateLogKsp('anhydrite', 25)).toBeCloseTo(-4.36, 5);
    expect(getSulfateLogKsp('barite', 25)).toBeCloseTo(-9.97, 5);
    expect(getSulfateLogKsp('celestine', 25)).toBeCloseTo(-6.63, 5);
  });
});

describe('v164 sulfate Ksp — van\'t Hoff T-dependence signs', () => {
  it('BARITE is endothermic (prograde) — logKsp RISES with T', () => {
    // This is the critical sign-check. My initial memory had barite ΔH
    // negative (retrograde like the other three); verifying against
    // wateq4f.dat caught it as +26.57 kJ/mol. K rises ~5× over 25-100°C,
    // ~50× over 25-200°C. If a future edit accidentally negates the
    // sign, this test catches it.
    const k25 = getSulfateLogKsp('barite', 25);
    const k100 = getSulfateLogKsp('barite', 100);
    const k200 = getSulfateLogKsp('barite', 200);
    expect(k100).toBeGreaterThan(k25);   // rises 25→100
    expect(k200).toBeGreaterThan(k100);  // rises 100→200
    // Quantitative pin: ~0.94 log units rise 25→100 per wateq4f van't Hoff
    expect(k100 - k25).toBeGreaterThan(0.5);
    expect(k100 - k25).toBeLessThan(1.5);
  });

  it('gypsum / selenite is essentially T-independent in its stability field', () => {
    // ΔH = -0.456 kJ/mol → very slight retrograde. logKsp moves <0.02
    // across 0-60°C, matching the textbook "gypsum solubility is flat
    // in its stability field" story (anhydrite takes over above).
    const k10 = getSulfateLogKsp('selenite', 10);
    const k50 = getSulfateLogKsp('selenite', 50);
    expect(Math.abs(k50 - k10)).toBeLessThan(0.05);
  });

  it('anhydrite + celestine are retrograde (mildly negative ΔH)', () => {
    // ΔH negative → logKsp DROPS as T rises (less soluble at higher T).
    expect(getSulfateLogKsp('anhydrite', 100)).toBeLessThan(getSulfateLogKsp('anhydrite', 25));
    expect(getSulfateLogKsp('celestine', 100)).toBeLessThan(getSulfateLogKsp('celestine', 25));
  });
});

describe('v164 sulfate SI — math signs', () => {
  it('SI < 0 for dilute Ca-SO4 fluid (rainwater-like)', () => {
    const f = new FluidChemistry({ Ca: 5, S: 5 });
    const SI = sulfateSaturationIndex('selenite', f, 25);
    expect(Number.isFinite(SI)).toBe(true);
    expect(SI).toBeLessThan(-2);
  });

  it('SI > 0 for evaporative brine (sabkha-like Ca + S)', () => {
    // sabkha-survey-observed: Ca ~800, S ~2700. Should be deeply supersat.
    const f = new FluidChemistry({ Ca: 800, S: 2700, salinity: 100 });
    const SI = sulfateSaturationIndex('selenite', f, 30);
    expect(Number.isFinite(SI)).toBe(true);
    expect(SI).toBeGreaterThan(0.5);
  });

  it('gypsum and selenite return identical SI (alias)', () => {
    const f = new FluidChemistry({ Ca: 200, S: 200 });
    expect(sulfateSaturationIndex('gypsum', f, 25))
      .toBeCloseTo(sulfateSaturationIndex('selenite', f, 25), 6);
  });

  it('omega = 10^SI (identity)', () => {
    const f = new FluidChemistry({ Ca: 320, S: 300 });
    const SI = sulfateSaturationIndex('selenite', f, 45);
    const omega = sulfateOmega('selenite', f, 45);
    expect(omega).toBeCloseTo(Math.pow(10, SI), 6);
  });
});

describe('v164 sulfate SI — geological reference points', () => {
  it('Naica selenite chamber sits at marginal saturation (slow giant-crystal growth)', () => {
    // Ca/S from survey-observed naica broth mid-run, T=45°C (chamber
    // cooled from ~54°C). The giant-crystal regime IS the marginal-
    // saturation regime — Van Driessche et al. 2011: chamber sat at
    // SI ≈ 0 ± 0.3 for tens of millennia. With Davies activity, our
    // engine gives SI_selenite ≈ -0.18 at the survey broth — within
    // that geological band.
    const naica = { Ca: 320, S: 300, Mg: 30, Na: 90, Cl: 180, K: 8, salinity: 4 };
    const SI = sulfateSaturationIndex('selenite', new FluidChemistry(naica), 45);
    expect(Number.isFinite(SI)).toBe(true);
    expect(Math.abs(SI)).toBeLessThan(0.6);
  });

  it('Sicilian solfifera broth is strongly celestine-supersaturated', () => {
    // sicily_solfifera survey mid-run: Sr=45, S=940, T~27°C. The
    // Sr-brine + sulfate (from bacterial reduction of gypsum) is the
    // mechanism. Predicts strong celestine precipitation, which is
    // the textbook Sicilian assemblage.
    const sicily = { Sr: 45, S: 940, Ca: 1200, Mg: 50, Na: 400, Cl: 600, salinity: 5 };
    const SI = sulfateSaturationIndex('celestine', new FluidChemistry(sicily), 27);
    expect(Number.isFinite(SI)).toBe(true);
    expect(SI).toBeGreaterThan(0.3);
  });

  it('MVT hot brine drives strong barite supersaturation despite barite\'s prograde solubility', () => {
    // Tri-State / Sweetwater MVT-style brine: Ba ~180, S ~60, T ~100°C.
    // Even though barite is *more* soluble at 100°C than 25°C, the high
    // Ba activity still pushes SI strongly positive — the diagnostic
    // MVT-gangue regime.
    const mvt = { Ba: 180, S: 60, Ca: 100, Na: 1000, Cl: 1500, salinity: 80 };
    const SI = sulfateSaturationIndex('barite', new FluidChemistry(mvt), 100);
    expect(Number.isFinite(SI)).toBe(true);
    expect(SI).toBeGreaterThan(1.5);
  });
});

describe('v164 sulfate SI — defensive returns', () => {
  it('returns NaN for missing cation (barite needs Ba)', () => {
    const f = new FluidChemistry({ Ca: 100, S: 100, Ba: 0 });
    expect(Number.isNaN(sulfateSaturationIndex('barite', f, 25))).toBe(true);
  });

  it('returns NaN for missing S (selenite needs S)', () => {
    const f = new FluidChemistry({ Ca: 100, S: 0 });
    expect(Number.isNaN(sulfateSaturationIndex('selenite', f, 25))).toBe(true);
  });

  it('returns NaN for an unknown mineral', () => {
    const f = new FluidChemistry({ Ca: 100, S: 100 });
    expect(Number.isNaN(sulfateSaturationIndex('gibberish', f, 25))).toBe(true);
  });

  it('omega returns 0 (not NaN) for missing data, per carbonate-engine convention', () => {
    const f = new FluidChemistry({ Ca: 100, S: 0 });
    expect(sulfateOmega('selenite', f, 25)).toBe(0);
  });
});
