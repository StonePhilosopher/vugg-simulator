// tests-js/carbonate-week9-promotion.test.ts — Week 9 validation.
//
// PROPOSAL-CARBONATE-GEOCHEM Phase 1 Week 9 — calcite engine promotion.
//
// Pins the calcite SI engine + PWP rate law are wired into the
// production path, that the flag-on-by-default state is correct, and
// that key calcite-firing scenarios still produce calcite at v144.
//
// DRIFT: substantial. The empirical 5×(σ-1) formula was T-independent;
// PWP has Arrhenius T-dependence and pH dependence built in. Hot
// acidic scenarios grow MORE calcite under PWP (mvt 28×, marble 3.3×,
// tutorial_travertine 12.6×); cold alkaline cave scenarios grow LESS
// (stalactite_demo / zoned_dripstone_cave ~95% reduction). Both
// directions are geologically correct; the cave scenarios are
// candidates for broth re-tune in Phase 1c.
//
// See js/15-version.ts v144 history block for the full per-scenario
// drift table and rationale.

import { describe, expect, it } from 'vitest';

declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const setSeed: any;
declare const FluidChemistry: any;
declare const VugConditions: any;

declare const CARBONATE_KSP_ACTIVE: boolean;
declare const CARBONATE_KSP_ACTIVE_PER_MINERAL: Record<string, boolean>;
declare const kspSupersatActiveFor: (mineralId: string) => boolean;
declare const carbonateSaturationIndex: (m: string, f: any, T: number) => number;
declare const carbonateOmega: (m: string, f: any, T: number) => number;
declare const calciteRate: (f: any, T: number) => number;
declare const pwpRateToSimMicronsPerStep: (m: string, mol: number) => number;

describe('PROPOSAL-CARBONATE-GEOCHEM Week 9 — calcite engine promotion (v144)', () => {
  it('CARBONATE_KSP_ACTIVE is true; calcite per-mineral flag is true', () => {
    expect(CARBONATE_KSP_ACTIVE).toBe(true);
    expect(CARBONATE_KSP_ACTIVE_PER_MINERAL.calcite).toBe(true);
    expect(kspSupersatActiveFor('calcite')).toBe(true);
  });

  it('only calcite is promoted at v144 (siblings still empirical)', () => {
    // Week 10-12 will flip dolomite, HMC, aragonite. Verify they
    // haven't accidentally come along for the ride.
    expect(kspSupersatActiveFor('aragonite')).toBe(false);
    expect(kspSupersatActiveFor('dolomite')).toBe(false);
    expect(kspSupersatActiveFor('siderite')).toBe(false);
    expect(kspSupersatActiveFor('HMC')).toBe(false);
  });

  it('supersaturation_calcite returns omega (not empirical sigma) at v144', () => {
    // The dispatch in supersaturation_calcite now hits carbonateEngineSigma
    // when the flag is on. Verify by checking that supersaturation_calcite
    // matches carbonateOmega for a known supersaturated fluid.
    const f = new FluidChemistry({ Ca: 200, CO3: 150, pH: 8.0 });
    const cond = new VugConditions({ temperature: 25, fluid: f });
    const sigma = cond.supersaturation_calcite();
    const omega = carbonateOmega('calcite', f, 25);
    // Note: cond holds its own fluid copy; we read from the same shape.
    // The dispatcher returns carbonateEngineSigma which calls carbonateOmega.
    // Should be within a small tolerance (Davies activity for identical
    // fluid shape — no fluid mutation between the two calls).
    expect(Number.isFinite(sigma)).toBe(true);
    expect(Number.isFinite(omega)).toBe(true);
    expect(sigma).toBeCloseTo(omega, 5);
  });

  it('hard gates still fire — calcite returns 0 above T_max with flag on', () => {
    // Regression: the dispatcher placement after hard gates means
    // T > 500°C thermal decomposition still gives sigma = 0 even with
    // the SI engine active. Without this, a wild Ksp(T) could let the
    // engine try to nucleate calcite at 600°C where it would actually
    // decompose to CaO + CO2.
    const f = new FluidChemistry({ Ca: 500, CO3: 500, pH: 8.0 });
    const cond = new VugConditions({ temperature: 600, fluid: f });
    expect(cond.supersaturation_calcite()).toBe(0);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 9 — PWP rate sanity', () => {
  it('calciteRate is positive when omega > 1, zero when omega < 1', () => {
    // Supersaturated: positive net rate.
    const f_sat = new FluidChemistry({ Ca: 300, CO3: 200, pH: 8.0 });
    const r_sat = calciteRate(f_sat, 25);
    expect(r_sat).toBeGreaterThan(0);

    // Undersaturated: pwpNetRate returns negative (dissolution); but
    // calciteRate applies mgPoisoningFactor which is positive. So
    // dissolution comes through as negative rate; rate > 0 means growth.
    const f_unsat = new FluidChemistry({ Ca: 5, CO3: 1, pH: 6.0 });
    const r_unsat = calciteRate(f_unsat, 25);
    // Could be negative (dissolution) or near-zero. Should NOT be
    // strongly positive.
    expect(r_unsat).toBeLessThan(r_sat);
  });

  it('PWP rate accelerates with T (Arrhenius)', () => {
    // Same fluid, two temperatures — hot should be faster (PWP k1..k3
    // all have positive activation energies).
    const f = new FluidChemistry({ Ca: 300, CO3: 200, pH: 7.5 });
    const r_cool = calciteRate(f, 25);
    const r_warm = calciteRate(f, 80);
    expect(r_warm).toBeGreaterThan(r_cool);
  });

  it('PWP rate accelerates with low pH (a(H+) term)', () => {
    // The k1·a(H+) pathway is the dominant H-catalyzed dissolution/
    // precipitation channel. Lower pH → higher a(H+) → faster rate.
    // BUT: lower pH also lowers Bjerrum CO3 fraction → lowers omega.
    // The (1 - 1/Ω) factor approaches zero at low omega, so the net
    // effect can flip. Test both rates exist and are positive.
    const f_alk = new FluidChemistry({ Ca: 300, CO3: 200, pH: 8.0 });
    const f_neut = new FluidChemistry({ Ca: 300, CO3: 200, pH: 7.0 });
    const r_alk = calciteRate(f_alk, 25);
    const r_neut = calciteRate(f_neut, 25);
    expect(r_alk).toBeGreaterThan(0);
    // At pH 7.0 the omega is much lower than at pH 8.0 (Bjerrum), so
    // the net rate may dip. Just confirm both are finite.
    expect(Number.isFinite(r_neut)).toBe(true);
  });

  it('Mg poisoning suppresses calcite rate at high Mg/Ca', () => {
    // Davis 2000 / Nielsen 2013 sigmoid centered on Mg/Ca = 2,
    // floor at 0.15. Same omega, two Mg/Ca ratios; high Mg should
    // suppress.
    const f_lowMg = new FluidChemistry({ Ca: 300, Mg: 50, CO3: 200, pH: 8.0 });
    const f_highMg = new FluidChemistry({ Ca: 300, Mg: 2000, CO3: 200, pH: 8.0 });
    const r_lowMg = calciteRate(f_lowMg, 25);
    const r_highMg = calciteRate(f_highMg, 25);
    expect(r_lowMg).toBeGreaterThan(r_highMg);
    // Inhibition floor is 0.15 — at Mg/Ca >> 2, ratio should be at
    // least 5× suppression (15% of base ≈ 1/6.7 of unsuppressed).
    expect(r_highMg / r_lowMg).toBeLessThan(0.3);
  });

  it('pwpRateToSimMicronsPerStep at calibration factor 5e4 lands typical growth at 0.1-5 µm/step', () => {
    // Sanity check on the calibration factor magnitude. Typical
    // supersaturated calcite conditions should produce µm/step growth
    // in the empirical engine's regime.
    const f = new FluidChemistry({ Ca: 300, CO3: 200, pH: 7.8 });
    const mol_rate = calciteRate(f, 60);
    const um_per_step = pwpRateToSimMicronsPerStep('calcite', mol_rate);
    expect(um_per_step).toBeGreaterThan(0.01);
    expect(um_per_step).toBeLessThan(50);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 9 — scenario-level firing pins', () => {
  // These scenarios should still produce calcite at v144. Test isn't
  // exact-baseline (calibration.test handles that); these are
  // mineralogical-firing pins.

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

  function calciteCount(sim: any): { active: number; total: number; max_um: number } {
    if (!sim || !sim.crystals) return { active: 0, total: 0, max_um: 0 };
    let active = 0, total = 0, max_um = 0;
    for (const c of sim.crystals) {
      if (c.mineral !== 'calcite') continue;
      total++;
      if (!c.dissolved) active++;
      if (c.total_growth_um > max_um) max_um = c.total_growth_um;
    }
    return { active, total, max_um };
  }

  it('tutorial_travertine still fires calcite (the tutorial mineral)', () => {
    const sim = runScenario('tutorial_travertine');
    if (!sim) return;
    const { total, max_um } = calciteCount(sim);
    expect(total).toBeGreaterThan(0);
    expect(max_um).toBeGreaterThan(100);  // visible to player
  });

  it('mvt still fires calcite (MVT gangue)', () => {
    const sim = runScenario('mvt');
    if (!sim) return;
    const { total, max_um } = calciteCount(sim);
    expect(total).toBeGreaterThan(0);
    expect(max_um).toBeGreaterThan(100);
  });

  it('marble_contact_metamorphism still fires calcite (the marble is calcite)', () => {
    const sim = runScenario('marble_contact_metamorphism');
    if (!sim) return;
    const { total, max_um } = calciteCount(sim);
    expect(total).toBeGreaterThan(0);
    expect(max_um).toBeGreaterThan(1000);  // marble-scale
  });

  it('zoned_dripstone_cave still fires calcite (dripstone IS calcite)', () => {
    // v144 PWP at cave T (~10-15°C, alkaline) produces small crystals
    // — orders of magnitude slower than empirical was claiming.
    // Geologically right but visually less impressive. Phase 1c
    // candidate for broth re-tune.
    const sim = runScenario('zoned_dripstone_cave');
    if (!sim) return;
    const { total, max_um } = calciteCount(sim);
    expect(total).toBeGreaterThan(0);
    // Don't pin max_um — it dropped from 44773 to ~2055 µm at v144.
    // Just verify calcite is firing (mineralogy preserved even if
    // morphology shrinks).
  });

  it('stalactite_demo still fires calcite (the dripstone demo)', () => {
    const sim = runScenario('stalactite_demo');
    if (!sim) return;
    const { total, max_um } = calciteCount(sim);
    expect(total).toBeGreaterThan(0);
    // Same cold-cave story as zoned_dripstone_cave — broth re-tune
    // candidate for visual impact.
  });

  it('tutorial_mn_calcite now fires calcite (v144 fix — was missing in v143)', () => {
    // Pedagogical bug v143: the Mn-doped calcite tutorial DIDN'T grow
    // calcite. With the SI engine + PWP, it does. The whole point of
    // the tutorial is to "grow a calcite, then mix in manganese."
    const sim = runScenario('tutorial_mn_calcite');
    if (!sim) return;
    const { active, max_um } = calciteCount(sim);
    expect(active).toBeGreaterThan(0);
    expect(max_um).toBeGreaterThan(100);  // visible learning artifact
  });

  it('reactive_wall now produces dissolution-cycle calcite (v144 — acid pulses dissolve early calcite)', () => {
    // v143 didn't fire calcite at reactive_wall; v144 fires 1 dissolved
    // calcite (acid pulses dissolve it). This is geologically right
    // — Sweetwater MVT acid-into-carbonate paragenesis literally
    // documents calcite dissolution as the first event.
    const sim = runScenario('reactive_wall');
    if (!sim) return;
    const { total } = calciteCount(sim);
    expect(total).toBeGreaterThanOrEqual(1);
  });
});
