// tests-js/carbonate-week11-promotion.test.ts — Week 11 validation.
//
// PROPOSAL-CARBONATE-GEOCHEM Phase 1 Week 11 — HMC mineral add + SI
// engine promotion. HMC (Ca(1-x)Mg(x)CO3, x≈0.05-0.30) is the
// disordered Mg-substituted calcite intermediate that Kim 2023 showed
// is the kinetic precursor to ordered dolomite under cyclic-Ω
// modulation.
//
// W11 unblocks the proposal Week 11 deliverable (which was BLOCKED on
// HMC-as-mineral pre-v146; the engine helpers saturationIndex_HMC and
// HMCRate had been ready since Week 2 + Week 6 but no MINERAL_SPEC
// existed to wire them to). Pin:
//   - HMC is in MINERAL_ENGINES + MINERAL_GATES_REGISTRY
//   - HMC flag is on; supersaturation_HMC returns omega from SI engine
//   - PWP rate via HMCRate (with Davis 2000 Mg-poisoning baked in)
//   - Per-crystal mg_content state is set at nucleation from fluid Mg/Ca
//   - HMC fires in Mg-rich scenarios (sabkha, cave, ultramafic supergene)
//   - HMC does NOT fire in low-Mg scenarios (calcite-only territory)
//
// References (verified during W11 prep):
//   - Bischoff, Mackenzie & Bishop 1987 GCA 51:1413 (solubility scaling)
//   - Davis et al. 2000 Science 290:1134 (Mg poisoning of step edges)
//   - Goldsmith & Graf 1958 Am. Mineral. 43:84 (XRD d104 discriminator)
//   - Kim et al. 2023 Science 382:915 (cyclic-Ω ordering to dolomite)

import { describe, expect, it } from 'vitest';

declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const setSeed: any;
declare const FluidChemistry: any;
declare const VugConditions: any;

declare const CARBONATE_KSP_ACTIVE_PER_MINERAL: Record<string, boolean>;
declare const MINERAL_ENGINES: Record<string, Function>;
declare const MINERAL_GATES_REGISTRY: Record<string, any>;
declare const kspSupersatActiveFor: (mineralId: string) => boolean;
declare const carbonateOmega: (m: string, f: any, T: number, mg_content?: number) => number;
declare const carbonateSaturationIndex: (m: string, f: any, T: number, mg_content?: number) => number;
declare const HMCRate: (f: any, T: number, mg_content: number) => number;
declare const pwpRateToSimMicronsPerStep: (m: string, mol: number) => number;

describe('PROPOSAL-CARBONATE-GEOCHEM Week 11 — HMC mineral add + SI promotion (v146)', () => {
  it('HMC is wired into MINERAL_ENGINES', () => {
    expect(typeof MINERAL_ENGINES.HMC).toBe('function');
  });

  it('HMC is in MINERAL_GATES_REGISTRY with sigma_crit = 2.0', () => {
    expect(MINERAL_GATES_REGISTRY.HMC).toBeDefined();
    expect(MINERAL_GATES_REGISTRY.HMC.sigma_crit).toBeCloseTo(2.0, 1);
  });

  it('HMC per-mineral flag is true; kspSupersatActiveFor returns true', () => {
    expect(CARBONATE_KSP_ACTIVE_PER_MINERAL.HMC).toBe(true);
    expect(kspSupersatActiveFor('HMC')).toBe(true);
  });

  it('siderite + rhodochrosite still empirical (aragonite promoted v147)', () => {
    // v146 had aragonite empirical; v147 (Week 12) promoted aragonite,
    // closing out the CaCO3-system Phase 1 arc.
    expect(kspSupersatActiveFor('aragonite')).toBe(true);  // since v147
    expect(kspSupersatActiveFor('siderite')).toBe(false);
    expect(kspSupersatActiveFor('rhodochrosite')).toBe(false);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 11 — supersaturation_HMC engine', () => {
  it('hard gate fires below Mg/Ca = 0.5 (HMC needs Mg present)', () => {
    // Low-Mg calcite-only fluid — HMC should return 0.
    const f = new FluidChemistry({ Ca: 200, Mg: 10, CO3: 150, pH: 8.0 });
    const cond = new VugConditions({ temperature: 25, fluid: f });
    // Mg/Ca = 0.05, below the 0.5 threshold
    expect(cond.supersaturation_HMC()).toBe(0);
  });

  it('hard gate fires above T_max = 60°C (HMC is a low-T phase)', () => {
    // Above 60°C, ordered dolomite or aragonite kinetically win.
    const f = new FluidChemistry({ Ca: 200, Mg: 400, CO3: 150, pH: 8.0 });
    const cond = new VugConditions({ temperature: 100, fluid: f });
    expect(cond.supersaturation_HMC()).toBe(0);
  });

  it('hard gate fires below pH 7.0 (HMC needs alkaline conditions)', () => {
    const f = new FluidChemistry({ Ca: 200, Mg: 400, CO3: 150, pH: 6.5 });
    const cond = new VugConditions({ temperature: 25, fluid: f });
    expect(cond.supersaturation_HMC()).toBe(0);
  });

  it('returns omega from SI engine when flag is on', () => {
    // Marine-like Mg-rich brine: omega should be moderate-to-high.
    const f = new FluidChemistry({ Ca: 400, Mg: 1200, CO3: 200, pH: 8.2 });
    const cond = new VugConditions({ temperature: 25, fluid: f });
    const sigma = cond.supersaturation_HMC();
    // sigma is omega (numeric value); check it matches the SI engine call
    const omega = carbonateOmega('HMC', f, 25, 0.10);
    expect(sigma).toBeCloseTo(omega, 5);
    expect(sigma).toBeGreaterThan(1.0);  // moderately supersaturated
  });

  it('SI engine HMC omega depends on mg_content (Ksp scales with x)', () => {
    // Same fluid, three mg_content values; omega should DECREASE as
    // x rises (more soluble HMC = lower omega at same IAP).
    const f = new FluidChemistry({ Ca: 400, Mg: 800, CO3: 200, pH: 8.0 });
    const omega_pure = carbonateOmega('HMC', f, 25, 0.0);   // pure calcite
    const omega_5pct = carbonateOmega('HMC', f, 25, 0.05);
    const omega_20pct = carbonateOmega('HMC', f, 25, 0.20);
    expect(omega_pure).toBeGreaterThan(omega_5pct);
    expect(omega_5pct).toBeGreaterThan(omega_20pct);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 11 — HMC PWP rate sanity', () => {
  it('HMCRate is positive when omega > 1', () => {
    const f = new FluidChemistry({ Ca: 400, Mg: 800, CO3: 200, pH: 8.2 });
    const r = HMCRate(f, 25, 0.10);
    expect(r).toBeGreaterThan(0);
  });

  it('HMC rate accelerates with T (Arrhenius)', () => {
    const f = new FluidChemistry({ Ca: 400, Mg: 800, CO3: 200, pH: 8.0 });
    const r_cool = HMCRate(f, 10, 0.10);
    const r_warm = HMCRate(f, 50, 0.10);
    expect(r_warm).toBeGreaterThan(r_cool);
  });

  it('HMC rate is suppressed at high Mg/Ca (Davis 2000 Mg-poisoning baked in)', () => {
    // Same omega-driver, two Mg/Ca ratios.
    const f_lowMg = new FluidChemistry({ Ca: 400, Mg: 200, CO3: 200, pH: 8.0 });
    const f_highMg = new FluidChemistry({ Ca: 400, Mg: 2000, CO3: 200, pH: 8.0 });
    const r_lowMg = HMCRate(f_lowMg, 25, 0.10);
    const r_highMg = HMCRate(f_highMg, 25, 0.10);
    // High Mg poisons calcite-PWP step edges; rate suppressed.
    expect(r_lowMg).toBeGreaterThan(r_highMg);
  });

  it('pwpRateToSimMicronsPerStep for HMC lands typical growth at 0.01-50 µm/step', () => {
    const f = new FluidChemistry({ Ca: 400, Mg: 800, CO3: 200, pH: 8.2 });
    const mol_rate = HMCRate(f, 25, 0.10);
    const um_per_step = pwpRateToSimMicronsPerStep('calcite', mol_rate);
    expect(um_per_step).toBeGreaterThan(0);
    expect(um_per_step).toBeLessThan(50);
  });
});

describe('PROPOSAL-CARBONATE-GEOCHEM Week 11 — scenario firings', () => {
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

  function HMCCount(sim: any): { active: number; total: number; max_um: number } {
    if (!sim || !sim.crystals) return { active: 0, total: 0, max_um: 0 };
    let active = 0, total = 0, max_um = 0;
    for (const c of sim.crystals) {
      if (c.mineral !== 'HMC') continue;
      total++;
      if (!c.dissolved) active++;
      if (c.total_growth_um > max_um) max_um = c.total_growth_um;
    }
    return { active, total, max_um };
  }

  it('sabkha_dolomitization nucleates HMC (the Kim 2023 disordered precursor)', () => {
    // Sabkha is the Kim 2023 headline scenario — HMC is supposed to
    // be the disordered intermediate that progressively orders into
    // dolomite. v146 baseline: 4 HMC crystals @ 0.8 µm (microcrystalline
    // cement / dolomicrite scale, geologically right).
    const sim = runScenario('sabkha_dolomitization');
    if (!sim) return;
    const { active } = HMCCount(sim);
    expect(active).toBeGreaterThan(0);
  });

  it('zoned_dripstone_cave nucleates HMC (Mg-rich cave waters)', () => {
    // Cave dripstone has elevated Mg from limestone wallrock; HMC is
    // a documented cave-cement phase. v146: 4 HMC @ 2097 µm.
    const sim = runScenario('zoned_dripstone_cave');
    if (!sim) return;
    const { active, max_um } = HMCCount(sim);
    expect(active).toBeGreaterThan(0);
    expect(max_um).toBeGreaterThan(100);  // visible cement
  });

  it('ultramafic_supergene nucleates HMC (serpentinization releases Mg)', () => {
    // Serpentinization of olivine/pyroxene releases Mg + Ca; HMC cement
    // is the expected carbonate phase.
    const sim = runScenario('ultramafic_supergene');
    if (!sim) return;
    const { active } = HMCCount(sim);
    expect(active).toBeGreaterThan(0);
  });

  it('low-Mg scenarios do NOT nucleate HMC', () => {
    // Calcite-only scenarios should not fire HMC (Mg/Ca below
    // gate threshold).
    for (const name of ['tutorial_travertine', 'tutorial_mn_calcite', 'cooling']) {
      const sim = runScenario(name);
      if (!sim) continue;
      const { active, total } = HMCCount(sim);
      expect(active).toBe(0);
      expect(total).toBe(0);
    }
  });

  it('HMC crystal carries mg_content state (set from fluid Mg/Ca at nucleation)', () => {
    // The defining feature of the W11 add: per-crystal composition
    // state. Every HMC crystal should have _mg_content set.
    const sim = runScenario('sabkha_dolomitization');
    if (!sim) return;
    const hmcs = sim.crystals.filter((c: any) => c.mineral === 'HMC');
    expect(hmcs.length).toBeGreaterThan(0);
    for (const c of hmcs) {
      expect(typeof c._mg_content).toBe('number');
      expect(c._mg_content).toBeGreaterThanOrEqual(0.04);
      expect(c._mg_content).toBeLessThanOrEqual(0.30);
    }
  });
});
