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
declare const Crystal: any;
declare const grow_native_sulfur: any;
declare const _buildMineralFormationExplanation: any;

describe('SIM 246 silica phase identity and Ostwald stepping', () => {
  it('Mammoth travertine does not form silica from 54 ppm at seed 42', () => {
    setSeed(42);
    const { conditions, events, defaultSteps } = SCENARIOS.tutorial_travertine();
    const regime = conditions.silica_depositional_regime();
    expect(regime).toMatchObject({
      phase: 'carbonate-travertine water',
      permitsSilicaPrecipitation: false,
    });
    expect(conditions.silica_precipitate_phase()).toBeNull();
    const before = new VugSimulator(conditions, events);
    const why = _buildMineralFormationExplanation('chalcedony', conditions, before);
    const competition = why.groups.find((g: any) => g.label === 'Competition');
    expect(competition.chips.some((chip: any) =>
      chip.text.includes('carbonate-travertine water') && chip.met === false,
    )).toBe(true);
    const sim = before;
    for (let i = 0; i < (defaultSteps ?? 200); i++) sim.run_step();
    const silica = sim.crystals.filter((c: any) => ['quartz', 'chalcedony', 'opal'].includes(c.mineral));
    expect(silica.map((c: any) => ({
      mineral: c.mineral,
      nucleationStep: c.nucleation_step,
      growthUm: c.total_growth_um,
      finalRegime: sim.conditions.silica_depositional_regime(),
      finalTemperatureC: sim.conditions.temperature,
      finalPressureKbar: sim.conditions.pressure,
      finalSilicaPpm: sim.conditions.fluid.SiO2,
    }))).toEqual([]);
  });

  it('makes carbonate chemistry causal instead of treating host name as competition', () => {
    const noCarbonate = new VugConditions({
      temperature: 70, pressure: 0.05,
      fluid: new FluidChemistry({ SiO2: 54, Ca: 0, CO3: 0, pH: 7 }),
      wall: { composition: 'limestone' },
    });
    expect(noCarbonate.silica_depositional_regime()).toMatchObject({
      carbonateCompetitive: false,
      permitsSilicaPrecipitation: true,
    });

    const carbonateWaterOnSandstone = new VugConditions({
      temperature: 70, pressure: 0.05,
      fluid: new FluidChemistry({ SiO2: 54, Ca: 500, CO3: 500, pH: 7 }),
      wall: { composition: 'sandstone' },
    });
    expect(carbonateWaterOnSandstone.silica_depositional_regime()).toMatchObject({
      carbonateCompetitive: true,
      permitsSilicaPrecipitation: false,
    });
  });

  it('selects a real opal phase in a low-temperature silica-rich control', () => {
    const fluid = new FluidChemistry({ SiO2: 400, pH: 8, O2: 0.2 });
    const conditions = new VugConditions({ temperature: 70, fluid });
    expect(conditions.silica_precipitate_phase()).toBe('opal');
    expect(conditions.supersaturation_quartz()).toBe(0);
    expect(conditions.supersaturation_opal()).toBeGreaterThan(0.8);
  });

  it('selects a real chalcedony phase while its own equilibrium is exceeded', () => {
    const fluid = new FluidChemistry({ SiO2: 400, pH: 7, O2: 0.2 });
    const conditions = new VugConditions({ temperature: 150, fluid });
    expect(conditions.silica_precipitate_phase()).toBe('chalcedony');
    expect(conditions.supersaturation_chalcedony()).toBeGreaterThan(1.12);
    expect(conditions.supersaturation_quartz()).toBe(0);
    expect(conditions.supersaturation_opal()).toBe(0);
  });

  it('routes depleted 150 C fluid from chalcedony to quartz without relabelling', () => {
    const fluid = new FluidChemistry({ SiO2: 160, pH: 7, O2: 0.2 });
    const conditions = new VugConditions({ temperature: 150, fluid });
    expect(conditions.chalcedony_equilibrium_ratio()).toBeLessThan(1);
    expect(conditions.quartz_equilibrium_ratio()).toBeGreaterThan(1);
    expect(conditions.silica_precipitate_phase()).toBe('quartz');
    expect(conditions.supersaturation_chalcedony()).toBe(0);
    expect(conditions.supersaturation_quartz()).toBeGreaterThan(1);
  });

  it('keeps thermodynamic quartz equilibrium separate from the selected low-T chalcedony phase', () => {
    const fluid = new FluidChemistry({ SiO2: 100, pH: 7, O2: 0.2 });
    const conditions = new VugConditions({ temperature: 70, fluid });
    expect(conditions.silica_precipitate_phase()).toBe('chalcedony');
    expect(conditions.supersaturation_chalcedony()).toBeGreaterThan(1);
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

  function productionNativeSulfurOxidation(openBoundary: boolean) {
    const fluid = new FluidChemistry({
      S: 0, S_sulfide: 0, S_sulfate: 0, S_elemental: 400,
      sulfurPoolsExplicit: true,
      nativeSulfurPathway: openBoundary
        ? 'oxidative_interface' : 'anaerobic_microbial_inherited',
      O2: openBoundary ? 0.4 : 0.02,
      pH: openBoundary ? 2.5 : 6.0,
    });
    const conditions = new VugConditions({ temperature: 50, fluid });
    const crystal = new Crystal({ mineral: 'native_sulfur', crystal_id: 1 });
    let step = 1;
    while (crystal.total_growth_um < 35 && step < 30) {
      const growth = grow_native_sulfur(crystal, conditions, step++);
      expect(growth).toBeTruthy();
      growth._time_scaled = true;
      applyStoichiometricGrowthBudget(crystal, growth, conditions);
      crystal.add_zone(growth);
    }
    expect(crystal.total_growth_um).toBeGreaterThanOrEqual(35);
    const beforeSystem = sulfurSystemTotalPpm(fluid) + bookedSolidSulfurPpm([crystal]);
    const sulfateBefore = fluid.S_sulfate;
    const elementalBefore = fluid.S_elemental;
    const solidBefore = bookedSolidSulfurPpm([crystal]);

    // Raise O2 into the oxidative-etch field; the production engine, not the
    // test fixture, must author the dissolution mode.
    if (!openBoundary) fluid.nativeSulfurPathway = 'oxidative_closed_fluid';
    fluid.O2 = openBoundary ? 1.1 : 0.002;
    fluid.pH = 7.0;
    const etch = grow_native_sulfur(crystal, conditions, step);
    expect(etch).toBeTruthy();
    expect(etch.dissolutionMode).toBe('oxidative_to_sulfate');
    etch._time_scaled = true;
    applyStoichiometricGrowthBudget(crystal, etch, conditions);
    crystal.add_zone(etch);

    expect(fluid.S_sulfate).toBeGreaterThan(sulfateBefore);
    expect(bookedSolidSulfurPpm([crystal])).toBeLessThan(solidBefore);
    expect(etch._sulfur_oxidation.oxygenBeforePpm
      + etch._sulfur_oxidation.oxygenImportedPpm
      - etch._sulfur_oxidation.oxygenConsumedPpm)
      .toBeCloseTo(etch._sulfur_oxidation.oxygenAfterPpm, 12);
    expect(sulfurSystemTotalPpm(fluid) + bookedSolidSulfurPpm([crystal]))
      .toBeCloseTo(beforeSystem, 10);
    expect(etch._sulfur_oxidation.protonAccounting)
      .toBe('diagnostic_only_no_conserved_hydrogen_inventory');
    expect(etch._sulfur_oxidation.fluidPhUpdated).toBe(false);
    return { fluid, crystal, etch, elementalBefore };
  }

  it('production native-sulfur etch transfers all returned S0 to sulfate at an open interface', () => {
    const { fluid, etch, elementalBefore } = productionNativeSulfurOxidation(true);
    expect(etch._sulfur_oxidation.openBoundary).toBe(true);
    expect(etch._sulfur_oxidation.oxygenImportedPpm)
      .toBeCloseTo(etch._sulfur_oxidation.oxygenConsumedPpm, 12);
    expect(etch._sulfur_oxidation.sulfurElementalRemainderPpm).toBeCloseTo(0, 12);
    expect(fluid.S_elemental).toBeCloseTo(elementalBefore, 12);
  });

  it('production native-sulfur etch is oxygen-limited in a closed fluid', () => {
    const { fluid, etch, elementalBefore } = productionNativeSulfurOxidation(false);
    expect(etch._sulfur_oxidation.openBoundary).toBe(false);
    expect(etch._sulfur_oxidation.oxygenImportedPpm).toBe(0);
    expect(etch._sulfur_oxidation.sulfurElementalRemainderPpm).toBeGreaterThan(0);
    expect(fluid.S_elemental).toBeGreaterThan(elementalBefore);
    expect(fluid.O2).toBeCloseTo(0, 12);
  });

  it('rejects an undeclared internal sulfur creation instead of booking a boundary import', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.sulphur_bank();
    const sim = new VugSimulator(conditions, events);
    const snap = sim._snapshotGlobal();
    sim.conditions.fluid.S_elemental += 10;
    sim._propagateGlobalDelta(snap);
    const transaction = sim._sulfurBoundaryTransactions.at(-1);
    expect(transaction.kind).toBe('internal_transfer');
    expect(transaction.declaredImportsPpm).toBe(0);
    expect(transaction.actualNetPpm).toBeGreaterThan(0);
    expect(transaction.closed).toBe(false);
    expect(simulatorSulfurLedgerSnapshot(sim).closed).toBe(false);
  });

  it('books H2S recharge from its declaration and oxidation as zero-boundary transfer', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.sulphur_bank();
    const sim = new VugSimulator(conditions, events);
    for (let i = 0; i < 10; i++) sim.run_step();
    const recharge = sim._sulfurBoundaryTransactions.at(-1);
    expect(recharge.declarations[0].source).toContain('H2S recharge');
    expect(recharge.declaredImportsPpm).toBeCloseTo(
      150 * sim.wall_state.voxelGridFor(sim).voxels.length,
      8,
    );
    expect(recharge.actualNetPpm).toBeCloseTo(recharge.expectedNetPpm, 8);
    expect(recharge.closed).toBe(true);

    for (let i = 10; i < 20; i++) sim.run_step();
    const oxidation = sim._sulfurBoundaryTransactions.at(-1);
    expect(oxidation.kind).toBe('internal_transfer');
    expect(oxidation.expectedNetPpm).toBe(0);
    expect(oxidation.actualNetPpm).toBeCloseTo(0, 8);
    expect(oxidation.closed).toBe(true);
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
