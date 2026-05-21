// tests-js/initiative-scaffold.test.ts — sanity tests for the v127
// initiative scaffold (js/43-initiative.ts).
//
// This module is read-only in v127 — it computes initiative scores but
// does NOT drive growth ordering. The tests therefore assert mechanical
// correctness of the score formulas + modifier combinators, not
// scenario behavior. v128 will add `tests-js/initiative-paragenesis.test.ts`
// for the 5 calibration assertions in proposals/PROPOSAL-INITIATIVE-VARIABLE.md
// §4.1.

import { describe, expect, it } from 'vitest';

declare const baseInitiative: (sigma: number) => number;
declare const temperatureInitiativeModifier: (mineral: string, fluid: any) => any;
declare const edgeOfGateInitiativeModifier: (mineral: string, sigma: number) => any;
declare const surfaceEnergyInitiativeModifier: (mineral: string) => any;
declare const competitionInitiativeModifier: (mineral: string, active: string[]) => any;
declare const cascadeRippleInitiativeModifier: (mineral: string) => any;
declare const computeInitiative: (mineral: string, sigma: number, fluid: any, active: string[]) => any;
declare const rankInitiative: (sigmas: Record<string, number>, fluid: any) => any[];

describe('baseInitiative', () => {
  it('σ ≤ 0 → 0', () => {
    const fn = (globalThis as any).baseInitiative;
    expect(fn(0)).toBe(0);
    expect(fn(-1)).toBe(0);
  });

  // The proposal §3.3 hand-anchors (σ=0.5 → ~8, σ=1.0 → ~10, σ=2.0 → ~15)
  // were directional, not exact — the actual formula log10(σ·100+1)·10
  // yields σ=0.5 → 17.1, σ=1.0 → 20.0, σ=2.0 → 23.0. v129 calibration
  // will retune scaling; for v127 we pin the formula behavior so
  // refactors don't silently shift it.
  it('σ = 0.5 → matches log10(σ·100+1)·10', () => {
    const fn = (globalThis as any).baseInitiative;
    expect(fn(0.5)).toBeCloseTo(Math.log10(0.5 * 100 + 1) * 10, 5);
  });

  it('σ = 1.0 → matches log10(σ·100+1)·10', () => {
    const fn = (globalThis as any).baseInitiative;
    expect(fn(1.0)).toBeCloseTo(Math.log10(1.0 * 100 + 1) * 10, 5);
  });

  it('higher σ produces strictly higher base initiative (monotonic)', () => {
    const fn = (globalThis as any).baseInitiative;
    expect(fn(2.0)).toBeGreaterThan(fn(1.0));
    expect(fn(1.0)).toBeGreaterThan(fn(0.5));
    expect(fn(0.5)).toBeGreaterThan(fn(0.1));
  });
});

describe('surfaceEnergyInitiativeModifier', () => {
  it('opal (very_low γ) gets +2', () => {
    const fn = (globalThis as any).surfaceEnergyInitiativeModifier;
    const m = fn('opal');
    expect(m.value).toBe(+2);
  });

  it('quartz (high γ) gets -1', () => {
    const fn = (globalThis as any).surfaceEnergyInitiativeModifier;
    const m = fn('quartz');
    expect(m.value).toBe(-1);
  });

  it('unknown mineral returns 0', () => {
    const fn = (globalThis as any).surfaceEnergyInitiativeModifier;
    const m = fn('unobtanium');
    expect(m.value).toBe(0);
  });
});

describe('edgeOfGateInitiativeModifier', () => {
  it('σ near σ_crit (ratio 1.0) is fragile → -2', () => {
    const fn = (globalThis as any).edgeOfGateInitiativeModifier;
    const reg = (globalThis as any).MINERAL_GATES_REGISTRY;
    const sCrit = reg.calcite.sigma_crit;
    const m = fn('calcite', sCrit);
    expect(m.value).toBe(-2);
  });

  it('σ well above σ_crit (ratio > 2) is robust → +1', () => {
    const fn = (globalThis as any).edgeOfGateInitiativeModifier;
    const reg = (globalThis as any).MINERAL_GATES_REGISTRY;
    const sCrit = reg.calcite.sigma_crit;
    const m = fn('calcite', sCrit * 3.0);
    expect(m.value).toBe(+1);
  });
});

describe('competitionInitiativeModifier', () => {
  it('no overlapping minerals → 0', () => {
    const fn = (globalThis as any).competitionInitiativeModifier;
    const m = fn('calcite', ['calcite']);
    expect(m.value).toBe(0);
  });

  it('one overlapping mineral (Ca-share) → -1', () => {
    const fn = (globalThis as any).competitionInitiativeModifier;
    // calcite + aragonite both want Ca + CO3
    const m = fn('calcite', ['calcite', 'aragonite']);
    expect(m.value).toBe(-1);
  });

  it('many overlapping minerals → -2 (dense suite)', () => {
    const fn = (globalThis as any).competitionInitiativeModifier;
    // calcite + several Ca-bearers
    const m = fn('calcite', ['calcite', 'aragonite', 'dolomite', 'fluorite']);
    expect(m.value).toBe(-2);
  });
});

describe('cascadeRippleInitiativeModifier', () => {
  it('1-cation mineral (native_sulfur) → 0', () => {
    const fn = (globalThis as any).cascadeRippleInitiativeModifier;
    const m = fn('native_sulfur');
    expect(m.value).toBe(0);
  });

  it('2-cation mineral (calcite) → -1', () => {
    const fn = (globalThis as any).cascadeRippleInitiativeModifier;
    const m = fn('calcite');
    expect(m.value).toBe(-1);
  });

  it('many-cation mineral caps at -2', () => {
    const fn = (globalThis as any).cascadeRippleInitiativeModifier;
    // tourmaline: Na, Al, Fe, B, SiO2 — 5 cations in MINERAL_STOICHIOMETRY
    // (lepidolite would be 5 too, but it's deferred from the stoichiometry
    // table per the v126 batch-probe arc).
    const m = fn('tourmaline');
    expect(m.value).toBe(-2);
  });
});

describe('computeInitiative', () => {
  it('returns a full InitiativeResult with 5 modifiers + base', () => {
    const fn = (globalThis as any).computeInitiative;
    const r = fn('calcite', 1.5, { temperature: 25 }, ['calcite', 'aragonite']);
    expect(r.mineral).toBe('calcite');
    expect(r.sigma).toBe(1.5);
    expect(r.modifiers).toHaveLength(5);
    expect(r.modifiers.map((m: any) => m.source).sort()).toEqual([
      'cascade-ripple',
      'competition',
      'edge-of-gate',
      'surface-energy',
      'temperature',
    ]);
    expect(r.finalInitiative).toBe(
      r.baseInitiative + r.modifiers.reduce((s: number, m: any) => s + m.value, 0),
    );
  });
});

describe('rankInitiative', () => {
  it('returns minerals sorted by finalInitiative descending', () => {
    const fn = (globalThis as any).rankInitiative;
    const results = fn(
      { calcite: 2.0, aragonite: 0.5, quartz: 1.5 },
      { temperature: 25 },
    );
    expect(results.length).toBe(3);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].finalInitiative).toBeGreaterThanOrEqual(results[i].finalInitiative);
    }
  });

  it('skips minerals with σ ≤ 0', () => {
    const fn = (globalThis as any).rankInitiative;
    const results = fn(
      { calcite: 1.0, aragonite: 0, quartz: -0.5 },
      { temperature: 25 },
    );
    expect(results.map((r: any) => r.mineral)).toEqual(['calcite']);
  });
});
