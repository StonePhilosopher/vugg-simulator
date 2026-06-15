// tests-js/carbonate-ksp-analytic.test.ts — v194 carbonate Ksp(T)
// analytic upgrade (the pK(T) debt's sibling).
//
// js/20c's constant-ΔH van't Hoff logKsp(T) → the PHREEQC analytic
// expression (wateq4f.dat verbatim) for the carbonates the database
// ships one for: calcite, aragonite, strontianite, witherite. Held to
// the PB82 fit validity (~90°C) and frozen flat above, so the hot-band
// curvature can't run away (the [0,250] first attempt over-grew calcite
// and reanimated the metastable hot aragonite v192 retired).

import { describe, expect, it } from 'vitest';

declare const getCarbonateLogKsp: (mineralId: string, T_C: number, mg?: number) => number;

describe('v194 — carbonate Ksp(T) analytic reproduces the 25°C anchors', () => {
  it('calcite analytic hits logKsp_25C = -8.48', () => {
    expect(getCarbonateLogKsp('calcite', 25)).toBeCloseTo(-8.48, 2);
  });
  it('aragonite analytic hits logKsp_25C = -8.336', () => {
    expect(getCarbonateLogKsp('aragonite', 25)).toBeCloseTo(-8.336, 2);
  });
  it('strontianite + witherite analytics hit their anchors', () => {
    expect(getCarbonateLogKsp('strontianite', 25)).toBeCloseTo(-9.271, 2);
    expect(getCarbonateLogKsp('witherite', 25)).toBeCloseTo(-8.562, 2);
  });
});

describe('v194 — the retrograde curvature is present (the seam the pK fix exposed)', () => {
  it('calcite is LESS soluble (more-negative logKsp) at higher T within the fit band', () => {
    const k25 = getCarbonateLogKsp('calcite', 25);
    const k60 = getCarbonateLogKsp('calcite', 60);
    const k90 = getCarbonateLogKsp('calcite', 90);
    expect(k60).toBeLessThan(k25);   // retrograde
    expect(k90).toBeLessThan(k60);
    // The analytic bends harder than the old constant-ΔH van't Hoff:
    // at 90°C the analytic gives ≈ -9.12 vs van't Hoff's ≈ -8.81.
    expect(k90).toBeLessThan(-9.0);
  });
});

describe('v194 — the analytic is CLAMPED to its fit validity (~90°C) and frozen flat above', () => {
  it('calcite logKsp is constant above the 90°C clamp (no hot extrapolation runaway)', () => {
    const k90 = getCarbonateLogKsp('calcite', 90);
    const k158 = getCarbonateLogKsp('calcite', 158);
    const k250 = getCarbonateLogKsp('calcite', 250);
    const k700 = getCarbonateLogKsp('calcite', 700);
    expect(k158).toBeCloseTo(k90, 6);
    expect(k250).toBeCloseTo(k90, 6);
    expect(k700).toBeCloseTo(k90, 6);
  });
  it('aragonite is likewise frozen above 90°C', () => {
    expect(getCarbonateLogKsp('aragonite', 300)).toBeCloseTo(getCarbonateLogKsp('aragonite', 90), 6);
  });
});

describe('v194 — minerals with no wateq4f analytic stay van’t Hoff (honest mixed fidelity)', () => {
  it('dolomite has no analytic line → keeps van’t Hoff, T-dependent past 90°C', () => {
    // dolomite carries no -analytical in wateq4f; it stays van't Hoff,
    // which IS T-dependent above 90°C (so it must NOT be flat there —
    // proving it didn't accidentally pick up the analytic clamp).
    const k90 = getCarbonateLogKsp('dolomite', 90);
    const k200 = getCarbonateLogKsp('dolomite', 200);
    expect(k200).not.toBeCloseTo(k90, 2);
    expect(k200).toBeLessThan(k90);  // retrograde van't Hoff too
    // 25°C anchor still exact.
    expect(getCarbonateLogKsp('dolomite', 25)).toBeCloseTo(-17.09, 2);
  });
});
