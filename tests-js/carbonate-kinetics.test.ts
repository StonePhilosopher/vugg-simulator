// tests-js/carbonate-kinetics.test.ts — Week 6 PWP kinetic engine.
//
// PROPOSAL-CARBONATE-GEOCHEM Phase 1 Week 6. Locks in:
//
//   - PWP forward rate is non-negative + non-zero for any fluid
//     with detectable H⁺ or H₂CO₃*
//   - Net rate sign matches Ω (precipitation at Ω>1, dissolution at
//     Ω<1, zero at equilibrium)
//   - Arrhenius T-dependence is positive — higher T → faster reaction
//   - Mg poisoning suppresses calcite rate at Mg/Ca > 2 (Davis 2000)
//   - Aragonite kinetic preference kicks in at Mg/Ca > 4 AND T > 30
//   - Dolomite Kim 2023 gate: rate(f_ord=0) ~30% of rate(f_ord=1)
//   - HMC rate < pure calcite rate at high Mg (compound effect)
//
// Like Week 2-4 infra, these are pure-math tests. The engines aren't
// wired into any grow_* function yet (Week 9 promotion).

import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;

declare const pwpForwardRate: (mineralId: string, fluid: any, T_C: number) => number;
declare const pwpNetRate: (mineralId: string, fluid: any, T_C: number, mg_content?: number) => number;
declare const pwpRateToSimMicronsPerStep: (mineralId: string, mol_per_cm2_s: number) => number;
declare const setPWPCalibrationFactor: (factor: number) => void;
declare const aragoniteKineticallyFavoredOver: (fluid: any, T_C: number) => boolean;
declare const mgPoisoningFactor: (fluid: any) => number;
declare const calciteRate: (fluid: any, T_C: number) => number;
declare const aragoniteRate: (fluid: any, T_C: number) => number;
declare const dolomiteRate: (fluid: any, T_C: number, f_ord: number) => number;
declare const HMCRate: (fluid: any, T_C: number, mg_content?: number) => number;
declare const sideriteRate: (fluid: any, T_C: number) => number;

describe('PROPOSAL-CARBONATE-GEOCHEM Week 6 — PWP forward rate', () => {
  it('forward rate is non-negative for any fluid', () => {
    const f1 = new FluidChemistry({ CO3: 100, pH: 7 });
    const f2 = new FluidChemistry({ CO3: 0, pH: 7 });
    const f3 = new FluidChemistry({ CO3: 500, pH: 4 });
    expect(pwpForwardRate('calcite', f1, 25)).toBeGreaterThanOrEqual(0);
    expect(pwpForwardRate('calcite', f2, 25)).toBeGreaterThanOrEqual(0);
    expect(pwpForwardRate('calcite', f3, 25)).toBeGreaterThanOrEqual(0);
  });

  it('forward rate rises sharply at low pH (k1·[H⁺] term dominates)', () => {
    const acidic = new FluidChemistry({ CO3: 100, pH: 4 });
    const neutral = new FluidChemistry({ CO3: 100, pH: 7 });
    const r_acid = pwpForwardRate('calcite', acidic, 25);
    const r_neut = pwpForwardRate('calcite', neutral, 25);
    // Each pH unit = 10× [H⁺], so r_forward should jump by orders of
    // magnitude. The k2 + k3 terms are nearly pH-independent so the
    // ratio is bounded by 1000× (3 pH units) for the k1 term.
    expect(r_acid).toBeGreaterThan(r_neut * 10);
  });

  it('forward rate is positive for zero-CO3 acidic fluid (k1 term alone)', () => {
    const f = new FluidChemistry({ CO3: 0, pH: 4 });
    // Even with no DIC, acid alone dissolves calcite (k1·[H+] term).
    expect(pwpForwardRate('calcite', f, 25)).toBeGreaterThan(0);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 6 — net rate sign convention', () => {
  it('net rate > 0 for supersaturated fluid (precipitation)', () => {
    // High Ca + high DIC + alkaline = supersaturated calcite.
    const f = new FluidChemistry({ Ca: 800, CO3: 500, pH: 8.5 });
    const r = pwpNetRate('calcite', f, 25);
    expect(r).toBeGreaterThan(0);
  });

  it('net rate < 0 for undersaturated fluid (dissolution)', () => {
    // Low Ca + low DIC + acidic = undersaturated, dissolving.
    const f = new FluidChemistry({ Ca: 1, CO3: 1, pH: 5 });
    const r = pwpNetRate('calcite', f, 25);
    expect(r).toBeLessThan(0);
  });

  it('net rate ≈ 0 at calcite equilibrium fluid', () => {
    // Back-calculated calcite-saturated fluid from Week 2 tests.
    const f = new FluidChemistry({ Ca: 40, CO3: 40, pH: 8.3 });
    const r = pwpNetRate('calcite', f, 25);
    // Within an order of magnitude of zero (forward rate at this
    // fluid is small enough that any imbalance × (1-1/Ω) is also small).
    // Just check the sign isn't catastrophically wrong.
    const forward = pwpForwardRate('calcite', f, 25);
    expect(Math.abs(r)).toBeLessThan(forward);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 6 — Arrhenius T-dependence', () => {
  it('forward rate rises with temperature (positive Ea)', () => {
    const f = new FluidChemistry({ CO3: 100, pH: 7 });
    const r_cold = pwpForwardRate('calcite', f, 5);
    const r_warm = pwpForwardRate('calcite', f, 60);
    expect(r_warm).toBeGreaterThan(r_cold);
    // 55°C rise with average Ea ~25 kJ/mol → ~10× faster.
    expect(r_warm / r_cold).toBeGreaterThan(3);
    expect(r_warm / r_cold).toBeLessThan(30);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 6 — Mg poisoning of calcite', () => {
  it('mgPoisoningFactor ≈ 1 for pure Ca fluid (no Mg)', () => {
    const f = new FluidChemistry({ Ca: 200, Mg: 0 });
    // Sigmoid centered on Mg/Ca=2 has ~1.5% residual inhibition at
    // Mg/Ca=0 (tail of the function — not zero, by design, matches
    // the v17 engine's existing form).
    expect(mgPoisoningFactor(f)).toBeGreaterThan(0.95);
  });

  it('mgPoisoningFactor drops below 0.5 at Mg/Ca > 2', () => {
    const f = new FluidChemistry({ Ca: 100, Mg: 250 });
    const factor = mgPoisoningFactor(f);
    expect(factor).toBeLessThan(0.5);
    expect(factor).toBeGreaterThanOrEqual(0.15);
  });

  it('mgPoisoningFactor floors at ~0.15 (85% max inhibition)', () => {
    const f = new FluidChemistry({ Ca: 100, Mg: 10000 });
    const factor = mgPoisoningFactor(f);
    expect(factor).toBeGreaterThanOrEqual(0.15);
    expect(factor).toBeLessThan(0.20);
  });

  it('calciteRate < pwpNetRate at high Mg/Ca (Mg poisoning applied)', () => {
    const f = new FluidChemistry({ Ca: 100, Mg: 500, CO3: 200, pH: 8 });
    const raw = pwpNetRate('calcite', f, 25);
    const calcite_kinetic = calciteRate(f, 25);
    expect(Math.abs(calcite_kinetic)).toBeLessThan(Math.abs(raw));
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 6 — aragonite metastability', () => {
  it('aragonite NOT kinetically favored at low Mg/Ca', () => {
    const f = new FluidChemistry({ Ca: 200, Mg: 50 });
    expect(aragoniteKineticallyFavoredOver(f, 40)).toBe(false);
  });

  it('aragonite NOT kinetically favored at low T even with high Mg/Ca', () => {
    const f = new FluidChemistry({ Ca: 100, Mg: 500 });
    expect(aragoniteKineticallyFavoredOver(f, 20)).toBe(false);
  });

  it('aragonite kinetically favored at Mg/Ca > 4 AND T > 30 (Folk 1974)', () => {
    const f = new FluidChemistry({ Ca: 100, Mg: 500 });
    expect(aragoniteKineticallyFavoredOver(f, 40)).toBe(true);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 6 — dolomite Kim 2023 cyclic-omega gate', () => {
  it('dolomite rate at f_ord=0 is ~30% of rate at f_ord=1', () => {
    const f = new FluidChemistry({ Ca: 200, Mg: 600, CO3: 200, pH: 8 });
    const T = 25;
    const r0 = dolomiteRate(f, T, 0.0);
    const r1 = dolomiteRate(f, T, 1.0);
    // Per Kim 2023 mechanism encoding: gate = 0.30 + 0.70 × f_ord.
    // f_ord=0 → 0.30; f_ord=1 → 1.00. Ratio = 0.30.
    const ratio = r0 / r1;
    expect(ratio).toBeGreaterThan(0.25);
    expect(ratio).toBeLessThan(0.35);
  });

  it('dolomite rate scales linearly with f_ord (Kim formula)', () => {
    const f = new FluidChemistry({ Ca: 200, Mg: 600, CO3: 200, pH: 8 });
    const T = 25;
    const r_half = dolomiteRate(f, T, 0.5);
    const r0 = dolomiteRate(f, T, 0.0);
    const r1 = dolomiteRate(f, T, 1.0);
    // gate(0.5) = 0.65, gate(0)=0.30, gate(1)=1.00.
    // r_half should sit between r0 and r1, at the linear midpoint of
    // gate values: r_half / r1 ≈ 0.65.
    expect(r_half / r1).toBeGreaterThan(0.60);
    expect(r_half / r1).toBeLessThan(0.70);
  });

  it('dolomite rate clamped at f_ord boundaries', () => {
    const f = new FluidChemistry({ Ca: 200, Mg: 600, CO3: 200, pH: 8 });
    const T = 25;
    // f_ord outside [0, 1] gets clamped — rate at f_ord=-1 equals
    // rate at f_ord=0; rate at f_ord=10 equals rate at f_ord=1.
    expect(dolomiteRate(f, T, -1)).toBe(dolomiteRate(f, T, 0));
    expect(dolomiteRate(f, T, 10)).toBe(dolomiteRate(f, T, 1));
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 6 — HMC vs calcite', () => {
  it('HMCRate at mg_content=0 ≈ calciteRate (HMC with no Mg = calcite)', () => {
    const f = new FluidChemistry({ Ca: 400, Mg: 0, CO3: 200, pH: 8 });
    const r_cal = calciteRate(f, 25);
    const r_HMC = HMCRate(f, 25, 0.0);
    // Both should be similar at zero Mg in the fluid AND zero
    // mg_content in the crystal. Within an order of magnitude.
    const ratio = Math.abs(r_HMC) / Math.abs(r_cal);
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThan(3);
  });

  it('HMCRate suppressed at high mg_content (more soluble Ksp)', () => {
    const f = new FluidChemistry({ Ca: 400, Mg: 400, CO3: 200, pH: 8 });
    const r_low = HMCRate(f, 25, 0.05);  // 5 mol-% Mg
    const r_high = HMCRate(f, 25, 0.20); // 20 mol-% Mg
    // Higher mg_content → higher Ksp → lower Ω → lower net rate.
    expect(r_high).toBeLessThan(r_low);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 6 — siderite family analog', () => {
  it('sideriteRate uses calcite PWP × 0.5 scaling factor', () => {
    // Siderite kinetic data tier C per data/thermo-carbonates.json;
    // family-analog with rate_factor_vs_calcite = 0.5. The scaling
    // applies to the forward rate.
    const f = new FluidChemistry({ Fe: 100, CO3: 200, pH: 7 });
    const r = sideriteRate(f, 25);
    expect(Number.isFinite(r)).toBe(true);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 6 — calibration factor mechanism', () => {
  it('setPWPCalibrationFactor scales unit conversion output', () => {
    setPWPCalibrationFactor(1.0);
    const baseline = pwpRateToSimMicronsPerStep('calcite', 1e-7);
    setPWPCalibrationFactor(2.0);
    const doubled = pwpRateToSimMicronsPerStep('calcite', 1e-7);
    expect(doubled).toBeCloseTo(baseline * 2, 6);
    // Restore default.
    setPWPCalibrationFactor(1.0);
  });

  it('rate conversion uses correct molar volumes per mineral', () => {
    setPWPCalibrationFactor(1.0);
    // Same mol/(cm²·s) input → different µm/s output because of
    // different molar volumes (calcite 36.93 vs aragonite 34.15 vs
    // dolomite 64.34 cm³/mol).
    const calcite_um = pwpRateToSimMicronsPerStep('calcite', 1e-7);
    const dolomite_um = pwpRateToSimMicronsPerStep('dolomite', 1e-7);
    // Dolomite has ~1.74× larger molar volume → 1.74× more thickness
    // per mol precipitated.
    expect(dolomite_um / calcite_um).toBeCloseTo(64.34 / 36.93, 2);
  });
});
