// tests-js/o5-split.test.ts — W-F O5 SPLITTING, the ladder EARNED (S-b live).
//
// S-a recorded the two-route cumulative-misorientation index unread; S-b flips
// O5_SPLITTING_ENABLED and lets it drive the sim (an axial-growth throttle) + the
// render (js/99i reads _split.rung → sheaf/spherulite geometry). These pins are on
// the accrual model as CALIBRATED in S-b (per-route abilities, per-mineral σ-crit
// anchoring, the structural-radial floor) + the throttle.
//
// The load-bearing science (boss §9a + "follow the science"): (1) TWO routes,
// MECHANISM-SPECIFIC per mineral — gypsum autodeforms (A), zeolites spherulite (B),
// and the scalar model that let high-σ gypsum spherulite was WRONG; (2) the B onset
// is per-mineral (× σ_crit) because the sim's σ scale is mineral-specific; (3)
// intrinsically-radial chain silicates express by STRUCTURE, growth-ramped, not σ;
// (4) splitAbility 0 (quartz/feldspar) never splits at any σ.

import { beforeEach, describe, expect, it } from 'vitest';

declare const accrueSplitIndex: any;
declare const splitAbilityA: any;
declare const splitAbilityB: any;
declare const splitAbleFor: any;
declare const sigmaCritFor: any;
declare const sigmaSpheruliteFor: any;
declare const splitRung: any;
declare const splitImpurityFactor: any;
declare const splitGrowthMult: any;
declare const setSplitKA: any;
declare const setSplitKB: any;
declare const setSplitSpheruliteFactor: any;
declare const setSplitAxialFloor: any;
declare const O5_SPLITTING_ENABLED: any;

// Reset the calibration constants to their shipped S-b defaults so numeric pins
// are stable regardless of any later rebind.
beforeEach(() => {
  setSplitKA(0.8); setSplitKB(0.8); setSplitSpheruliteFactor(2.5); setSplitAxialFloor(0.7);
});

const mkCrystal = (mineral: string, over: any = {}) => ({
  crystal_id: over.id ?? 1, mineral,
  _film: over._film ?? null,
  total_growth_um: over.total_growth_um ?? 1000,   // 1 mm — past the radial ramp by default
});
const mkCond = (mineral: string, sigma: number, wall: any = {}) => ({
  ['supersaturation_' + mineral]: () => sigma,
  wall,
});

describe('W-F O5 SPLITTING — splitAbility per-route gate (§9a #3 + #5)', () => {
  it('quartz + feldspar are {0,0} on BOTH routes ("else high σ is a nonsense wand")', () => {
    for (const m of ['quartz', 'feldspar', 'albite', 'fluorite']) {
      expect(splitAbilityA(m)).toBe(0);
      expect(splitAbilityB(m)).toBe(0);
      expect(splitAbleFor(m)).toBe(0);
    }
  });
  it('the boss exclusions are {0,0} — cerussite (twinning), malachite (aggregation)', () => {
    expect(splitAbleFor('cerussite')).toBe(0);
    expect(splitAbleFor('malachite')).toBe(0);
  });
  it('unlisted minerals default to {0,0}', () => {
    expect(splitAbleFor('pyrite')).toBe(0);
    expect(splitAbleFor('not_a_mineral')).toBe(0);
  });
  it('gypsum (selenite) is A-DOMINANT (autodeformation), NOT a spherulite former', () => {
    expect(splitAbilityA('selenite')).toBeGreaterThan(0.5);
    expect(splitAbilityB('selenite')).toBeLessThan(0.2);   // the scalar-model bug fix
  });
  it('zeolites are B-DOMINANT (spherulitic sheaf/sphere)', () => {
    expect(splitAbilityB('stilbite')).toBeGreaterThan(0.5);
    expect(splitAbilityB('scolecite')).toBeGreaterThan(0.5);
    expect(splitAbilityA('stilbite')).toBeLessThan(0.3);
  });
  it('saddle dolomite is A-dominant (Mg-excess autodeformation)', () => {
    expect(splitAbilityA('dolomite')).toBeGreaterThan(0.5);
  });
});

describe('W-F O5 SPLITTING — per-mineral B onset (σ scale is mineral-specific)', () => {
  it('σ_spherulite* = FACTOR × the mineral\'s own σ_crit', () => {
    setSplitSpheruliteFactor(2.5);
    // dolomite σ_crit = 10 (very insoluble) → onset 25; calcite σ_crit = 1.5 → 3.75.
    expect(sigmaSpheruliteFor('dolomite')).toBeCloseTo(2.5 * sigmaCritFor('dolomite'), 6);
    expect(sigmaSpheruliteFor('dolomite')).toBeGreaterThan(sigmaSpheruliteFor('calcite'));
  });
});

describe('W-F O5 SPLITTING — splitRung bands + growth throttle', () => {
  it('bands index → ladder rung', () => {
    expect(splitRung(0)).toBe('none');
    expect(splitRung(0.08)).toBe('curved');
    expect(splitRung(0.3)).toBe('split');
    expect(splitRung(0.6)).toBe('sheaf');
    expect(splitRung(0.9)).toBe('spherulite');
  });
  it('splitGrowthMult: 1 at index 0, floor at index 1, monotone decreasing', () => {
    setSplitAxialFloor(0.7);
    expect(splitGrowthMult(0)).toBe(1);
    expect(splitGrowthMult(1)).toBeCloseTo(0.7, 6);
    expect(splitGrowthMult(0.5)).toBeCloseTo(0.85, 6);
    expect(splitGrowthMult(0.9)).toBeLessThan(splitGrowthMult(0.3));   // more split → more compact
  });
});

describe('W-F O5 SPLITTING — impurity_factor = max(film φ, trace, mineral hint)', () => {
  it('reads _film φ (the masking half — ties the two O5 halves)', () => {
    const c = mkCrystal('calcite', { _film: { phi_term: 0.2, phi_prism: 0.7, step: 1 } });
    expect(splitImpurityFactor(c, mkCond('calcite', 0))).toBe(0.7);
  });
  it('reads the intrinsic dolomite Mg hint with no film', () => {
    expect(splitImpurityFactor(mkCrystal('dolomite'), mkCond('dolomite', 0))).toBeCloseTo(0.3, 6);
  });
  it('is 0 for a clean, hint-less crystal', () => {
    expect(splitImpurityFactor(mkCrystal('calcite'), mkCond('calcite', 0))).toBe(0);
  });
});

describe('W-F O5 SPLITTING — accrual: the two mechanism-specific routes', () => {
  it('quartz writes NOTHING even at huge σ + heavy film (the hard structure gate)', () => {
    const c: any = mkCrystal('quartz', { _film: { phi_term: 0.9, phi_prism: 0.9, step: 1 } });
    accrueSplitIndex(c, mkCond('quartz', 9999), 1000);
    expect(c._split).toBeUndefined();
  });

  it('A-route: dolomite accrues at LOW σ (below its onset) via its Mg hint', () => {
    const c: any = mkCrystal('dolomite');                 // hint 0.3; σ_crit 10 → onset 25
    accrueSplitIndex(c, mkCond('dolomite', 5), 1000);     // σ 5 ≪ 25 → B silent
    expect(c._split).toBeTruthy();
    expect(c._split.index).toBeGreaterThan(0);
    expect(c._split.route).toBe('A');
    expect(c._split.sumB).toBe(0);
  });

  it('B-route (σ): a clean calcite spherulites only ABOVE its per-mineral onset', () => {
    const onset = sigmaSpheruliteFor('calcite');
    const lo: any = mkCrystal('calcite');
    accrueSplitIndex(lo, mkCond('calcite', onset * 0.5), 1000);   // below → nothing (calcite no radial floor)
    expect(lo._split).toBeUndefined();

    const hi: any = mkCrystal('calcite');
    accrueSplitIndex(hi, mkCond('calcite', onset * 3), 1000);     // well above → B fires
    expect(hi._split).toBeTruthy();
    expect(hi._split.route).toBe('B');
    expect(hi._split.sumA).toBe(0);
  });

  it('B-route (structural): a GROWN zeolite expresses its radial rung even at low σ', () => {
    const c: any = mkCrystal('scolecite', { total_growth_um: 1000 });   // 1 mm, past the ramp
    accrueSplitIndex(c, mkCond('scolecite', 0.1), 1000);               // low σ — structure carries it
    expect(c._split).toBeTruthy();
    expect(c._split.route).toBe('B');
    expect(['sheaf', 'spherulite']).toContain(c._split.rung);          // floored to its structural rung
  });

  it('the structural floor RAMPS with size — a speck is not yet a sphere', () => {
    const speck: any = mkCrystal('scolecite', { total_growth_um: 7 });   // 7 µm nucleus
    accrueSplitIndex(speck, mkCond('scolecite', 0.1), 7);
    // below the 0.3 mm ramp → floor is scaled to near-nothing → still 'none'
    expect(speck._split ? speck._split.rung : 'none').toBe('none');
  });

  it('does not accrue on dissolution / zero growth', () => {
    const c: any = mkCrystal('dolomite');
    accrueSplitIndex(c, mkCond('dolomite', 5), 0);
    expect(c._split).toBeUndefined();
    accrueSplitIndex(c, mkCond('dolomite', 5), -800);
    expect(c._split).toBeUndefined();
  });

  it('clamps the cumulative index into [0,1]', () => {
    const c: any = mkCrystal('dolomite');
    accrueSplitIndex(c, mkCond('dolomite', 9999), 1e9);
    expect(c._split.index).toBe(1);
  });

  it('is deterministic (no RNG) and mutates ONLY crystal._split', () => {
    const a: any = mkCrystal('dolomite');
    const b: any = mkCrystal('dolomite');
    accrueSplitIndex(a, mkCond('dolomite', 5), 400);
    accrueSplitIndex(b, mkCond('dolomite', 5), 400);
    expect(a._split.index).toBe(b._split.index);
    expect(a.total_growth_um).toBe(1000);
    expect(a.mineral).toBe('dolomite');
  });

  it('route provenance is ALWAYS one of A / B / both (§9a #1 — required)', () => {
    const c: any = mkCrystal('dolomite');
    accrueSplitIndex(c, mkCond('dolomite', 5), 500);
    expect(['A', 'B', 'both']).toContain(c._split.route);
  });
});

describe('W-F O5 SPLITTING — the flag (S-b live)', () => {
  it('O5_SPLITTING_ENABLED is TRUE — the ladder drives the sim + render as of S-b', () => {
    expect(O5_SPLITTING_ENABLED).toBe(true);
  });
});
