// tests-js/carbonate-week10-promotion.test.ts — Week 10 validation.
//
// PROPOSAL-CARBONATE-GEOCHEM Phase 1 Week 10 — dolomite engine promotion.
//
// Same template as Week 9 calcite. Pins:
//   - The dolomite per-mineral flag is on
//   - supersaturation_dolomite dispatches to the SI engine (returns omega)
//   - grow_dolomite uses PWP via dolomiteRate (with Kim f_ord gate baked in)
//   - The Kim cycle counter detects crossings of the ordered-dolomite
//     stability threshold (omega = 100), not the trivial thermodynamic
//     equilibrium (omega = 1) — sabkha's 12 scheduled cycles count cleanly
//   - Each dolomite-firing scenario still nucleates dolomite at v145
//   - dolomite_rate has Arrhenius T-dependence (geological direction)
//   - dolomite rate is suppressed at low f_ord (Kim mechanism is the
//     real kinetic barrier)
//
// DRIFT: 4 of 4 dolomite-firing scenarios drifted. sabkha + cave
// scenarios shrank because PWP at alkaline cold conditions is slower
// than the empirical engine claimed — geologically correct (the
// "dolomite problem" itself), but pedagogically less impressive.
// Phase 1c scenario re-anchoring candidates.
//
// See js/15-version.ts v145 history block for the full drift table.

import { describe, expect, it } from 'vitest';

declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const setSeed: any;
declare const FluidChemistry: any;
declare const VugConditions: any;

declare const CARBONATE_KSP_ACTIVE_PER_MINERAL: Record<string, boolean>;
declare const kspSupersatActiveFor: (mineralId: string) => boolean;
declare const carbonateOmega: (m: string, f: any, T: number) => number;
declare const dolomiteRate: (f: any, T: number, f_ord: number) => number;
declare const pwpRateToSimMicronsPerStep: (m: string, mol: number) => number;

describe('PROPOSAL-CARBONATE-GEOCHEM Week 10 — dolomite engine promotion (v145)', () => {
  it('dolomite per-mineral flag is true', () => {
    expect(CARBONATE_KSP_ACTIVE_PER_MINERAL.dolomite).toBe(true);
    expect(kspSupersatActiveFor('dolomite')).toBe(true);
  });

  it('supersaturation_dolomite returns omega (textbook IAP/Ksp)', () => {
    // Mg-rich brine — dolomite IAP a(Ca)·a(Mg)·a(CO3)² gives huge omegas
    // when CO3 activity is high (i.e. alkaline conditions).
    const f = new FluidChemistry({ Ca: 400, Mg: 800, CO3: 300, pH: 8.5 });
    const cond = new VugConditions({ temperature: 25, fluid: f });
    const sigma = cond.supersaturation_dolomite();
    const omega = carbonateOmega('dolomite', f, 25);
    expect(Number.isFinite(sigma)).toBe(true);
    expect(Number.isFinite(omega)).toBe(true);
    expect(sigma).toBeCloseTo(omega, 5);
    // Mg-rich alkaline brine should give omega >> 1 — geologically the
    // explanation for "the dolomite problem" (thermodynamics says GO,
    // kinetics says NO).
    expect(omega).toBeGreaterThan(10);
  });

  it('hard gates still fire — dolomite returns 0 outside mg_ratio window with flag on', () => {
    // Mg/Ca = 0.05 — outside the 0.3-30 dolomite window. SI engine
    // would happily compute omega; the empirical gate prevents.
    const f = new FluidChemistry({ Ca: 1000, Mg: 50, CO3: 200, pH: 7.5 });
    const cond = new VugConditions({ temperature: 25, fluid: f });
    expect(cond.supersaturation_dolomite()).toBe(0);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 10 — PWP dolomite rate sanity', () => {
  it('dolomiteRate is positive when omega > 1 with sufficient f_ord', () => {
    const f = new FluidChemistry({ Ca: 200, Mg: 400, CO3: 150, pH: 8.0 });
    // f_ord 0 → rate at 30% gate (Kim mechanism suppresses without cycling)
    const r0 = dolomiteRate(f, 25, 0);
    // f_ord 1 → rate at 100% gate
    const r1 = dolomiteRate(f, 25, 1);
    expect(r0).toBeGreaterThan(0);
    expect(r1).toBeGreaterThan(r0);
    // Gate ratio: r1/r0 should be ~1/0.30 = 3.33 (linear scaling of
    // (0.30 + 0.70 × f_ord)).
    const ratio = r1 / r0;
    expect(ratio).toBeCloseTo(1.0 / 0.30, 0);  // ±0.5 looseness for activity-coefficient drift
  });

  it('dolomite PWP is T-dependent (Arrhenius)', () => {
    const f = new FluidChemistry({ Ca: 200, Mg: 400, CO3: 150, pH: 8.0 });
    const r_cool = dolomiteRate(f, 25, 0.5);
    const r_warm = dolomiteRate(f, 80, 0.5);
    expect(r_warm).toBeGreaterThan(r_cool);
  });

  it('pwpRateToSimMicronsPerStep for dolomite lands typical growth at 0.1-5 µm/step', () => {
    // Sanity check on the calibration factor for dolomite specifically.
    const f = new FluidChemistry({ Ca: 200, Mg: 400, CO3: 150, pH: 8.0 });
    const mol_rate = dolomiteRate(f, 50, 0.7);
    const um_per_step = pwpRateToSimMicronsPerStep('dolomite', mol_rate);
    expect(um_per_step).toBeGreaterThan(0.01);
    expect(um_per_step).toBeLessThan(50);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 10 — Kim cycle counter on SI omega threshold', () => {
  it('sabkha still counts 12 flood/evap cycles under SI engine', () => {
    // Critical regression: v145 changed the cycle threshold from omega=1
    // (thermodynamic equilibrium for any dolomite phase) to omega=100
    // — engineering-calibrated from the sim's own Ksp differential
    // between ordered dolomite (Ksp ~10^-17) and disordered HMC
    // precursor (Ksp ~10^-5.5 at x=0.30 per data/thermo-carbonates.json).
    // omega=100 approximates the boundary where IAP is enough above
    // dolomite equilibrium to overcome the HMC competitor — the
    // condition Kim 2023 shows is required for ordering. Sabkha's
    // evap state has omega ~6.5 (well above 1.0 — would never cross
    // under the old threshold; below 100 — counts cleanly under the
    // new threshold).
    const scn = SCENARIOS && SCENARIOS.sabkha_dolomitization;
    if (!scn) return;
    setSeed(42);
    const { conditions, events, defaultSteps } = scn();
    const sim = new VugSimulator(conditions, events);
    const total = defaultSteps ?? 260;
    for (let i = 0; i < total; i++) sim.run_step();
    const finalCycles = conditions._dol_cycle_count;
    expect(finalCycles).toBeGreaterThanOrEqual(9);  // proposal threshold for f_ord > 0.7
    expect(finalCycles).toBeLessThanOrEqual(15);    // 12 scheduled + slack
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 10 — scenario-level firing pins', () => {
  function runScenario(name: string): any {
    const scn = SCENARIOS && SCENARIOS[name];
    if (!scn) return null;
    setSeed(42);
    const { conditions, events, defaultSteps } = scn();
    const sim = new VugSimulator(conditions, events);
    const total = defaultSteps ?? 100;
    for (let i = 0; i < total; i++) sim.run_step();
    return sim;
  }

  function dolomiteCount(sim: any): { active: number; total: number; max_um: number } {
    if (!sim || !sim.crystals) return { active: 0, total: 0, max_um: 0 };
    let active = 0, total = 0, max_um = 0;
    for (const c of sim.crystals) {
      if (c.mineral !== 'dolomite') continue;
      total++;
      if (!c.dissolved) active++;
      if (c.total_growth_um > max_um) max_um = c.total_growth_um;
    }
    return { active, total, max_um };
  }

  it('sabkha_dolomitization still nucleates dolomite (mineralogy preserved)', () => {
    // v145 PWP at sabkha alkaline cold conditions is slow (0.2 µm/step
    // at f_ord=0), so the cabinet-cavity fills with selenite before
    // dolomite can grow much. Result: microcrystalline dolomicrite
    // (2.5 µm) instead of v144's empirical-engine 49 µm. Kim mechanism
    // still fires (12/12 cycles, f_ord 0.82); just the mass is small.
    // Phase 1c sabkha-tune target.
    const sim = runScenario('sabkha_dolomitization');
    if (!sim) return;
    const { total } = dolomiteCount(sim);
    expect(total).toBeGreaterThan(0);
  });

  it('zoned_dripstone_cave still nucleates dolomite (Mg cave waters)', () => {
    // Same cold-PWP story as the W9 cave calcite drift. Crystal
    // shrank ~14x; mineralogy preserved.
    const sim = runScenario('zoned_dripstone_cave');
    if (!sim) return;
    const { total } = dolomiteCount(sim);
    expect(total).toBeGreaterThan(0);
  });

  it('jeffrey_mine still fires dolomite (ultramafic skarn)', () => {
    const sim = runScenario('jeffrey_mine');
    if (!sim) return;
    const { total, max_um } = dolomiteCount(sim);
    expect(total).toBeGreaterThan(0);
    expect(max_um).toBeGreaterThan(100);
  });

  it('ultramafic_supergene fires dolomite (multiple small dustings expected)', () => {
    const sim = runScenario('ultramafic_supergene');
    if (!sim) return;
    const { total } = dolomiteCount(sim);
    expect(total).toBeGreaterThan(0);
  });

  it('reactive_wall now produces dissolution-cycle dolomite (v145 — acid pulses)', () => {
    // Cascade gain from W9 calcite arc + W10 dolomite SI engine: acid
    // pulses now dissolve transient dolomite (real Sweetwater MVT
    // documents acid-into-dolomite-gangue dissolution as the
    // characteristic stage I event).
    const sim = runScenario('reactive_wall');
    if (!sim) return;
    const { total } = dolomiteCount(sim);
    expect(total).toBeGreaterThanOrEqual(1);
  });
});
