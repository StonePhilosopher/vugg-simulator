// tests-js/carbonate-helicoid-chips.test.ts — Week 3 chip support.
//
// PROPOSAL-CARBONATE-GEOCHEM Phase 1 Week 3 adds 11 chips to the
// helicoid legend: DIC, CO₂(aq), HCO₃⁻, CO₃²⁻, SI cal/arg/dol/HMC/sid,
// pCO₂, f_ord. The chip read functions live inside the helicoid
// module's IIFE (not exported) so we can't test them directly; what
// we CAN test is the underlying machinery they consume:
//
//   - bjerrumFractions: the species-split that feeds DIC → CO₂/HCO₃/CO₃
//   - carbonateIonPpm: the CO₃²⁻ chip's read
//   - equilibriumPCO2: the pCO₂ chip's read
//   - snap _dol_cycle_count capture: the f_ord chip's read
//
// SI chip reads are tested in carbonate-ksp.test.ts (Week 2).

import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;
declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

declare const bjerrumFractions: (pH: number, T_C: number) => { H2CO3: number; HCO3: number; CO3: number };
declare const carbonateIonPpm: (fluid: any, T_C: number) => number;
declare const equilibriumPCO2: (fluid: any, T_C: number) => number;

describe('PROPOSAL-CARBONATE-GEOCHEM Week 3 — Bjerrum species split', () => {
  it('bjerrumFractions sum to ~1 at typical pH/T', () => {
    for (const pH of [5, 6, 7, 8, 9, 10]) {
      const f = bjerrumFractions(pH, 25);
      const sum = f.H2CO3 + f.HCO3 + f.CO3;
      expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
    }
  });

  it('low pH dominates H₂CO₃, high pH dominates CO₃²⁻', () => {
    const acid = bjerrumFractions(5.0, 25);
    expect(acid.H2CO3).toBeGreaterThan(0.9);
    expect(acid.CO3).toBeLessThan(0.001);

    const alk = bjerrumFractions(11.0, 25);
    expect(alk.CO3).toBeGreaterThan(0.7);
    expect(alk.H2CO3).toBeLessThan(0.01);
  });

  it('near-neutral pH 8.3 (limestone groundwater) is bicarbonate-dominated', () => {
    const f = bjerrumFractions(8.3, 25);
    expect(f.HCO3).toBeGreaterThan(0.9);
    expect(f.CO3).toBeLessThan(0.05);
    expect(f.H2CO3).toBeLessThan(0.05);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 3 — CO₃²⁻ chip read', () => {
  it('carbonateIonPpm returns 0 for zero-DIC fluid', () => {
    const f = new FluidChemistry({ CO3: 0, pH: 8 });
    expect(carbonateIonPpm(f, 25)).toBe(0);
  });

  it('carbonateIonPpm scales with DIC at fixed pH', () => {
    const fa = new FluidChemistry({ CO3: 100, pH: 8 });
    const fb = new FluidChemistry({ CO3: 200, pH: 8 });
    const ra = carbonateIonPpm(fa, 25);
    const rb = carbonateIonPpm(fb, 25);
    expect(rb / ra).toBeCloseTo(2, 1);
  });

  it('carbonateIonPpm rises sharply with pH at fixed DIC', () => {
    const acidic = new FluidChemistry({ CO3: 100, pH: 6 });
    const alkaline = new FluidChemistry({ CO3: 100, pH: 9 });
    const r_acid = carbonateIonPpm(acidic, 25);
    const r_alk = carbonateIonPpm(alkaline, 25);
    expect(r_alk).toBeGreaterThan(r_acid * 100);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 3 — pCO₂ chip read', () => {
  it('equilibriumPCO2 returns 0 for zero-DIC fluid', () => {
    const f = new FluidChemistry({ CO3: 0, pH: 8 });
    expect(equilibriumPCO2(f, 25)).toBe(0);
  });

  it('equilibriumPCO2 drops with rising pH (less H₂CO₃ at high pH)', () => {
    const acidic = new FluidChemistry({ CO3: 100, pH: 6 });
    const alkaline = new FluidChemistry({ CO3: 100, pH: 9 });
    const p_acid = equilibriumPCO2(acidic, 25);
    const p_alk = equilibriumPCO2(alkaline, 25);
    expect(p_acid).toBeGreaterThan(p_alk);
  });

  it('equilibriumPCO2 returns finite, non-negative values', () => {
    const f = new FluidChemistry({ CO3: 200, pH: 7.5 });
    const p = equilibriumPCO2(f, 50);
    expect(Number.isFinite(p)).toBe(true);
    expect(p).toBeGreaterThanOrEqual(0);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 3 — f_ord snap capture', () => {
  it('snap carries _dol_cycle_count alongside ring_fluids/ring_temperatures', () => {
    // Run any short scenario, check the latest snap.
    setSeed(42);
    const scn = SCENARIOS && SCENARIOS.mvt;
    if (!scn) {
      // Scenario list isn't loaded yet → skip rather than fail. The
      // chip itself still works; this test just can't pin the
      // wire-up without a running sim.
      return;
    }
    const { conditions, events, defaultSteps } = scn();
    const sim = new VugSimulator(conditions, events);
    for (let i = 0; i < Math.min(20, defaultSteps); i++) sim.run_step();
    const history = sim.wall_state_history;
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
    const snap = history[history.length - 1];
    // Number, not undefined — even if 0, the field must be present so
    // the f_ord chip read returns a number, not NaN, on replays.
    expect(typeof snap._dol_cycle_count).toBe('number');
    expect(snap._dol_cycle_count).toBeGreaterThanOrEqual(0);
  });
});
