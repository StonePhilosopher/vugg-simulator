import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;
declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const oxidizeReducedSulfurToElemental: any;
declare const sulfurSystemTotalPpm: any;
declare const bacterialReduceSulfate: any;
declare const applyStoichiometricGrowthBudget: any;
declare const bookedSolidSulfurPpm: any;
declare const simulatorSulfurLedgerSnapshot: any;
declare const GrowthZone: any;

describe('SIM 243 silica phase identity', () => {
  it('Mammoth travertine does not form silica from 54 ppm at seed 42', () => {
    setSeed(42);
    const { conditions, events, defaultSteps } = SCENARIOS.tutorial_travertine();
    const sim = new VugSimulator(conditions, events);
    for (let i = 0; i < (defaultSteps ?? 200); i++) sim.run_step();
    const silica = sim.crystals.filter((c: any) => c.mineral === 'quartz' || c.mineral === 'opal');
    expect(silica).toHaveLength(0);
  });

  it('selects a real opal phase in a low-temperature silica-rich control', () => {
    const fluid = new FluidChemistry({ SiO2: 400, pH: 8, O2: 0.2 });
    const conditions = new VugConditions({ temperature: 70, fluid });
    expect(conditions.silica_precipitate_phase()).toBe('opal');
    expect(conditions.supersaturation_quartz()).toBe(0);
    expect(conditions.supersaturation_opal()).toBeGreaterThan(0.8);
  });

  it('selects quartz, never a cosmetic chalcedony label, in the crystalline window', () => {
    const fluid = new FluidChemistry({ SiO2: 400, pH: 7, O2: 0.2 });
    const conditions = new VugConditions({ temperature: 150, fluid });
    expect(conditions.silica_precipitate_phase()).toBe('quartz');
    expect(conditions.silica_polymorph()).toBe('alpha-quartz');
    expect(conditions.supersaturation_quartz()).toBeGreaterThan(0);
    expect(conditions.supersaturation_opal()).toBe(0);
  });

  it('keeps thermodynamic quartz equilibrium separate from its kinetic selector', () => {
    const fluid = new FluidChemistry({ SiO2: 100, pH: 7, O2: 0.2 });
    const conditions = new VugConditions({ temperature: 70, fluid });
    expect(conditions.silica_precipitate_phase()).toBe(null);
    expect(conditions.supersaturation_quartz()).toBe(0);
    expect(conditions.quartz_equilibrium_ratio()).toBeGreaterThan(1);
  });
});

describe('SIM 243 explicit sulfur reservoirs', () => {
  it('partial oxidation closes sulfur and oxygen and produces no protons', () => {
    const fluid = new FluidChemistry({
      S: 400, S_sulfide: 400, S_sulfate: 0, S_elemental: 0,
      sulfurPoolsExplicit: true, nativeSulfurPathway: 'oxidative_interface',
      O2: 0.05, pH: 2.5,
    });
    const before = sulfurSystemTotalPpm(fluid);
    const r = oxidizeReducedSulfurToElemental(fluid, 0.25, 0.4);
    expect(r.sulfurAfterPpm).toBeCloseTo(before, 10);
    expect(r.oxygenBeforePpm + r.oxygenImportedPpm - r.oxygenConsumedPpm)
      .toBeCloseTo(r.oxygenAfterPpm, 10);
    expect(r.protonsProducedMmolKg).toBe(0);
    expect(fluid.S_sulfide).toBeCloseTo(300, 10);
    expect(fluid.S_elemental).toBeCloseTo(100, 10);
  });

  it('native sulfur cannot saturate from dissolved reduced sulfur alone', () => {
    const fluid = new FluidChemistry({
      S: 400, S_sulfide: 400, S_sulfate: 0, S_elemental: 0,
      sulfurPoolsExplicit: true, nativeSulfurPathway: 'oxidative_interface',
      O2: 0.4, pH: 2.5,
    });
    const conditions = new VugConditions({ temperature: 75, fluid });
    expect(conditions.supersaturation_native_sulfur()).toBe(0);
  });

  it('BSR transfers sulfate to sulfide without changing total sulfur', () => {
    const fluid = new FluidChemistry({
      S: 300, S_sulfide: 0, S_sulfate: 300, S_elemental: 100,
      sulfurPoolsExplicit: true, nativeSulfurPathway: 'anaerobic_microbial_inherited',
      CO3: 80, O2: 0.02, pH: 6,
    });
    const before = sulfurSystemTotalPpm(fluid);
    const r = bacterialReduceSulfate(fluid, 25, 30);
    expect(r.sulfurAfterPpm).toBeCloseTo(before, 10);
    expect(fluid.S_sulfate).toBeCloseTo(275, 10);
    expect(fluid.S_sulfide).toBeCloseTo(25, 10);
    expect(r.oxygenConsumedPpm).toBe(0);
    expect(r.organicElectronDonorBoundary).toBe(true);
  });

  it('formula ledgers debit sulfide, sulfate, and elemental pools independently', () => {
    const fluid = new FluidChemistry({
      S: 200, S_sulfide: 100, S_sulfate: 100, S_elemental: 100,
      sulfurPoolsExplicit: true, O2: 0.4, pH: 5,
    });
    const conditions = { fluid };
    const before = { sulfide: fluid.S_sulfide, sulfate: fluid.S_sulfate, elemental: fluid.S_elemental };
    applyStoichiometricGrowthBudget(
      { mineral: 'pyrite', zones: [] },
      new GrowthZone({ step: 1, temperature: 100, thickness_um: 1, growth_rate: 1 }),
      conditions,
    );
    expect(fluid.S_sulfide).toBeLessThan(before.sulfide);
    expect(fluid.S_sulfate).toBe(before.sulfate);
    expect(fluid.S_elemental).toBe(before.elemental);

    applyStoichiometricGrowthBudget(
      { mineral: 'selenite', zones: [] },
      new GrowthZone({ step: 2, temperature: 30, thickness_um: 1, growth_rate: 1 }),
      conditions,
    );
    expect(fluid.S_sulfate).toBeLessThan(before.sulfate);
    expect(fluid.S_elemental).toBe(before.elemental);

    applyStoichiometricGrowthBudget(
      { mineral: 'native_sulfur', zones: [] },
      new GrowthZone({ step: 3, temperature: 30, thickness_um: 1, growth_rate: 1 }),
      conditions,
    );
    expect(fluid.S_elemental).toBeLessThan(before.elemental);
  });

  it('oxidative native-sulfur dissolution transfers booked S0 to sulfate with an oxygen ledger', () => {
    const fluid = new FluidChemistry({
      S: 0, S_sulfide: 0, S_sulfate: 0, S_elemental: 100,
      sulfurPoolsExplicit: true, nativeSulfurPathway: 'oxidative_interface',
      O2: 0.4, pH: 2.5,
    });
    const conditions = { fluid };
    const crystal = { mineral: 'native_sulfur', zones: [] };
    const growth = new GrowthZone({
      step: 1, temperature: 50, thickness_um: 2, growth_rate: 2,
    });
    applyStoichiometricGrowthBudget(crystal, growth, conditions);
    crystal.zones.push(growth);
    const beforeSystem = sulfurSystemTotalPpm(fluid) + bookedSolidSulfurPpm([crystal]);
    const sulfateBefore = fluid.S_sulfate;

    const etch = new GrowthZone({
      step: 2, temperature: 50, thickness_um: -1, growth_rate: -1,
      dissolutionMode: 'oxidative_to_sulfate',
    });
    applyStoichiometricGrowthBudget(crystal, etch, conditions);
    crystal.zones.push(etch);

    expect(fluid.S_sulfate).toBeGreaterThan(sulfateBefore);
    expect(etch._sulfur_oxidation.sulfurElementalRemainderPpm).toBeCloseTo(0, 12);
    expect(etch._sulfur_oxidation.oxygenBeforePpm
      + etch._sulfur_oxidation.oxygenImportedPpm
      - etch._sulfur_oxidation.oxygenConsumedPpm)
      .toBeCloseTo(etch._sulfur_oxidation.oxygenAfterPpm, 12);
    expect(sulfurSystemTotalPpm(fluid) + bookedSolidSulfurPpm([crystal]))
      .toBeCloseTo(beforeSystem, 10);
  });

  it('closes the full Sulphur Bank sulfur ledger at every step and grows metacinnabar', () => {
    setSeed(42);
    const { conditions, events, defaultSteps } = SCENARIOS.sulphur_bank();
    const sim = new VugSimulator(conditions, events);
    for (let i = 0; i < (defaultSteps ?? 200); i++) {
      sim.run_step();
      const ledger = simulatorSulfurLedgerSnapshot(sim);
      expect(
        ledger.closed,
        `step ${ledger.step}: sulfur error ${ledger.errorPpm} exceeds ${ledger.tolerancePpm}`,
      ).toBe(true);
    }
    const metacinnabarGrowth = sim.crystals
      .filter((crystal: any) => crystal.mineral === 'metacinnabar')
      .reduce((sum: number, crystal: any) => sum + Math.max(0, crystal.total_growth_um || 0), 0);
    expect(metacinnabarGrowth).toBeGreaterThan(0);
  });
});
