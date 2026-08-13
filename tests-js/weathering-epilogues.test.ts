import { describe, expect, it } from 'vitest';

declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const VugConditions: any;
declare const FluidChemistry: any;
declare const VugWall: any;
declare const setSeed: any;
declare const aragoniteCoSelector: any;
declare const aragoniteCoPartitioning: any;
declare const remainingBookedInventory: any;
declare const validateWeatheringEpilogueConfig: any;
declare const activateWeatheringEpilogueIfDue: any;
declare const weatheringEpilogueActive: any;
declare const weatheringLightAtCrystal: any;
declare const weatheringNucleationContext: any;
declare const _nuc_erythrite: any;

function runScenario(name: string, steps?: number) {
  setSeed(42);
  const built = SCENARIOS[name]();
  const sim = new VugSimulator(built.conditions, built.events);
  for (let i = 0; i < (steps ?? built.defaultSteps); i++) sim.run_step();
  return sim;
}

describe('executed weathering/vadose epilogues', () => {
  let wittichenSim: any;
  let naicaSim: any;
  const wittichen = () => (wittichenSim ||= runScenario('wittichen'));
  const naica = () => (naicaSim ||= runScenario('naica_geothermal'));

  it('declares all four environmental boundaries instead of a final-state label', () => {
    for (const name of ['wittichen', 'naica_geothermal']) {
      const cfg = SCENARIOS[name]._json5_spec.weathering_epilogue;
      expect(validateWeatheringEpilogueConfig(cfg)).toMatchObject({
        valid: true,
        errors: [],
      });
      expect(cfg.start_step).toBeGreaterThan(0);
      expect(cfg.drainage.mode).toBeTruthy();
      expect(cfg.oxygen.mode).toBeTruthy();
      expect(cfg.co2.mode).toBeTruthy();
      expect(cfg.light.mode).toBeTruthy();
      expect(typeof cfg.light.exposed).toBe('boolean');
    }
  });

  it('semantically rejects empty, nonfinite, negative, and incoherent declarations', () => {
    const valid = SCENARIOS.wittichen._json5_spec.weathering_epilogue;
    const cases = [
      { ...valid, drainage: {} },
      { ...valid, oxygen: { mode: 'air', target_residual_ppm: Number.NaN } },
      { ...valid, co2: { mode: 'closed', imported_carbonate_ppm: -1 } },
      { ...valid, light: { mode: '', exposed: 'false' } },
      { ...valid, start_step: 171, end_step: 170 },
      { ...valid, drainage: { ...valid.drainage, concentration_factor: 0 } },
      { ...valid, require_released_species: { erythrite: 'Co' } },
      { ...valid, parent_minerals: { erythrite: [''] } },
      { ...valid, tracked_products: 'erythrite' },
      { ...valid, excluded_outcome: { status: 'excluded', mineralization: [], reason: 7 } },
    ];
    for (const cfg of cases) {
      const result = validateWeatheringEpilogueConfig(cfg);
      expect(result.valid, JSON.stringify(result.errors)).toBe(false);
      expect(result.normalized).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('malformed authored boundaries cannot partially mutate the vadose path', () => {
    const build = (weathering_epilogue?: any) => {
      const conditions = new VugConditions({
        temperature: 25,
        pressure: 0.001,
        fluid_surface_height_mm: 2,
        fluid: new FluidChemistry({ S: 100, O2: 0.1, concentration: 1 }),
        wall: new VugWall({ composition: 'limestone', shape_seed: 9010 }),
      });
      if (weathering_epilogue) {
        conditions._scenario = { id: 'malformed-weathering-test', weathering_epilogue };
      }
      const sim = new VugSimulator(conditions, []);
      if (weathering_epilogue) activateWeatheringEpilogueIfDue(sim);
      sim._applyVadoseOxidationOverride();
      return sim;
    };
    const malformed = build({
      kind: 'invalid partial declaration',
      start_step: 0,
      end_step: -1,
      localized_nucleation: true,
      drainage: { mode: '', concentration_factor: 9 },
      oxygen: { mode: 'raw value must not leak', target_residual_ppm: 99 },
      co2: { mode: 'invalid negative import', imported_carbonate_ppm: -1 },
      light: { mode: 'wrong type', exposed: 'yes' },
    });
    const control = build();
    expect(malformed._weatheringEpilogueState.valid).toBe(false);
    expect(malformed._weatheringEpilogueState.config).toBeNull();
    expect(malformed.wall_state.per_vertex_nucleation)
      .toBe(control.wall_state.per_vertex_nucleation);
    const fluidReceipt = (sim: any) => sim._vadoseExposureTransactions[0];
    expect(fluidReceipt(malformed).targetResidualO2Ppm).toBe(1.8);
    expect(fluidReceipt(malformed).concentrationFactor).toBe(3);
    expect(fluidReceipt(malformed)).toEqual(fluidReceipt(control));
    const voxelState = (sim: any) => sim.wall_state.voxelGridFor(sim).voxels
      .map((v: any) => [v.fluid.O2, v.fluid.concentration, v.fluid.S]);
    expect(voxelState(malformed)).toEqual(voxelState(control));
  });

  it('blocks declared products when an optional precursor structure is malformed', () => {
    const valid = SCENARIOS.wittichen._json5_spec.weathering_epilogue;
    const conditions = new VugConditions({
      temperature: 25,
      pressure: 0.001,
      fluid_surface_height_mm: 2,
      fluid: new FluidChemistry({
        Co: 500, As: 500, Ca: 500, CO3: 300, O2: 2, pH: 7, concentration: 1,
      }),
      wall: new VugWall({ composition: 'limestone', shape_seed: 9011 }),
    });
    conditions._scenario = {
      id: 'malformed-precursor-test',
      weathering_epilogue: {
        ...valid,
        start_step: 0,
        end_step: 10,
        require_released_species: { erythrite: 'Co' },
      },
    };
    const sim = new VugSimulator(conditions, []);
    // The context must fail closed even before the normal run-step activation
    // phase. Production nucleators are callable on a newly built simulator.
    expect(sim._weatheringEpilogueState).toBeUndefined();
    expect(weatheringNucleationContext(sim, 'erythrite')).toMatchObject({
      required: true,
      eligible: false,
      reason: 'invalid-weathering-declaration',
    });
    _nuc_erythrite(sim);
    expect(sim.crystals.filter((c: any) => c.mineral === 'erythrite')).toHaveLength(0);

    activateWeatheringEpilogueIfDue(sim);
    expect(sim._weatheringEpilogueState.valid).toBe(false);
    expect(sim._weatheringEpilogueState.blockedProducts).toContain('erythrite');
    expect(weatheringNucleationContext(sim, 'erythrite')).toMatchObject({
      required: true,
      eligible: false,
      reason: 'invalid-weathering-declaration',
    });
    _nuc_erythrite(sim);
    expect(sim.crystals.filter((c: any) => c.mineral === 'erythrite')).toHaveLength(0);
  });

  it('uses one inclusive active window and blocks restricted products after end_step', () => {
    const valid = SCENARIOS.wittichen._json5_spec.weathering_epilogue;
    const conditions = new VugConditions({
      temperature: 25,
      pressure: 0.001,
      fluid_surface_height_mm: 2,
      fluid: new FluidChemistry({
        Co: 500, As: 500, Ca: 500, CO3: 300, O2: 2, pH: 7, concentration: 1,
      }),
      wall: new VugWall({ composition: 'limestone', shape_seed: 9012 }),
    });
    conditions._scenario = {
      id: 'finite-weathering-window-test',
      weathering_epilogue: { ...valid, start_step: 0, end_step: 1 },
    };
    const sim = new VugSimulator(conditions, []);
    activateWeatheringEpilogueIfDue(sim);
    expect(weatheringEpilogueActive(sim)).toBe(true);
    expect(weatheringLightAtCrystal(sim, null, true)).toBe(false);

    sim.step = 2;
    expect(weatheringEpilogueActive(sim)).toBe(false);
    expect(weatheringLightAtCrystal(sim, null, true)).toBe(true);
    expect(weatheringNucleationContext(sim, 'erythrite')).toMatchObject({
      required: true,
      eligible: false,
      reason: 'outside-weathering-window',
    });
    // Scenario-restricted products remain blocked outside their declared
    // interval rather than silently reverting to ordinary bulk nucleation.
    _nuc_erythrite(sim);
    expect(sim.crystals.filter((c: any) => c.mineral === 'erythrite')).toHaveLength(0);
  });

  it('applies drying to every 3-D vadose voxel while preserving sulfur mass', () => {
    const conditions = new VugConditions({
      temperature: 25,
      pressure: 0.001,
      fluid_surface_height_mm: 2,
      fluid: new FluidChemistry({ S: 100, O2: 0.1, concentration: 1 }),
      wall: new VugWall({ composition: 'limestone', shape_seed: 9001 }),
    });
    const sim = new VugSimulator(conditions, []);
    const grid = sim.wall_state.voxelGridFor(sim);
    const beforeS = grid.voxels.reduce((sum: number, v: any) => sum + v.fluid.S, 0);
    const becameVadose = sim._applyVadoseOxidationOverride();
    const afterS = grid.voxels.reduce((sum: number, v: any) => sum + v.fluid.S, 0);
    expect(afterS).toBe(beforeS);
    expect(becameVadose).toEqual(Array.from(
      { length: sim.wall_state.ring_count - 2 }, (_, i) => i + 2,
    ));
    for (const voxel of grid.voxels) {
      if (voxel.ringIdx >= 2) {
        expect(voxel.fluid.O2).toBeGreaterThanOrEqual(1.8);
        expect(voxel.fluid.concentration).toBe(3);
      } else {
        expect(voxel.fluid.O2).toBe(0.1);
        expect(voxel.fluid.concentration).toBe(1);
      }
    }
    expect(sim._vadoseExposureTransactions[0].closed).toBe(true);
    expect(sim._vadoseExposureTransactions[0].schema).toBe('vadose-boundary-receipt-v2');
    expect(sim._vadoseExposureTransactions[0].oxygenAccounting)
      .toMatch(/canonical voxel ppm-equivalents/);
  });

  it('fails an unknown spatial propagation target closed', () => {
    const conditions = new VugConditions({
      fluid: new FluidChemistry({ Co: 10 }),
      wall: new VugWall({ composition: 'limestone', shape_seed: 9002 }),
    });
    const sim = new VugSimulator(conditions, []);
    const grid = sim.wall_state.voxelGridFor(sim);
    const before = grid.voxels.map((v: any) => v.fluid.Co);
    const pre = new FluidChemistry({ Co: 10 });
    const post = new FluidChemistry({ Co: 50 });
    grid.propagateEventDelta(pre, ['Co'], post, 'vadsoe-typo');
    expect(grid.voxels.map((v: any) => v.fluid.Co)).toEqual(before);
  });

  it('keeps the Co selector inside its measured ambient concentration domain', () => {
    const base = { Ca: 410, CO3: 140, pH: 7.4 };
    expect(aragoniteCoSelector({ ...base, Co: 29.0 }, 25).present).toBe(false);
    expect(aragoniteCoSelector({ ...base, Co: 35.0 }, 25).present).toBe(true);
    expect(aragoniteCoSelector({ ...base, Co: 35.0 }, 80).present).toBe(false);
    expect(aragoniteCoSelector({ ...base, Co: 600.0 }, 25).present).toBe(false);
    const partition = aragoniteCoPartitioning({ ...base, Co: 35.0 }, 25);
    expect(partition.distributionCoefficient).toBe(0.1);
    expect(partition.effectiveBookedDistributionCoefficient).toBeCloseTo(0.1, 12);
    expect(partition.formulaCoefficientCo).toBeGreaterThan(0);

    // Near the supported Co/Ca<0.6 ceiling, the full declared DCo must still
    // be what is actually booked. A former silent 0.05 formula cap made the
    // effective coefficient smaller while the receipt continued to say 0.1.
    const upper = aragoniteCoPartitioning({ ...base, Co: 355 }, 25);
    expect(upper.present).toBe(true);
    expect(upper.aqueousCoCaMolarRatio).toBeGreaterThan(0.5);
    expect(upper.aqueousCoCaMolarRatio).toBeLessThan(0.6);
    expect(upper.formulaCoefficientCo).toBeGreaterThan(0.05);
    expect(upper.formulaCoefficientCo)
      .toBeCloseTo(0.1 * upper.aqueousCoCaMolarRatio, 12);
    expect(upper.effectiveBookedDistributionCoefficient).toBeCloseTo(0.1, 12);
  });

  it('Wittichen earns both secondary products from same-site booked dissolution', () => {
    const sim = wittichen();
    const state = sim._weatheringEpilogueState;
    expect(state.valid).toBe(true);
    expect(state.activation).toMatchObject({
      step: 170,
      temperatureC: 25,
      pressureKbar: 0.001,
      fluidSurfaceHeightMm: 2,
      co2ImportedPpm: 0,
      lightExposed: false,
    });
    const receipt = sim._vadoseExposureTransactions.find((tx: any) => tx.step === 170);
    expect(receipt.closed).toBe(true);
    expect(receipt.becameVadose).toContain(3);
    expect(receipt.becameVadose).not.toContain(2);
    expect(sim.conditions.ringWaterState(2, sim.wall_state.ring_count)).toBe('meniscus');
    expect(sim.conditions.wall.thermal_pulses).toBe(false);
    expect(state.timeline.every((row: any) => row.temperatureC >= 20
      && row.temperatureC <= 30)).toBe(true);
    expect(state.timeline.every((row: any) => row.localTemperatureRangeC
      && row.localTemperatureRangeC.min >= 20
      && row.localTemperatureRangeC.max <= 30)).toBe(true);

    for (const mineral of ['erythrite', 'aragonite']) {
      const product = sim.crystals.find((c: any) => c.mineral === mineral
        && c.weathering_precursor_receipt && c.total_growth_um > 0 && !c.dissolved);
      expect(product, mineral).toBeTruthy();
      expect(product.nucleation_step).toBeGreaterThanOrEqual(171);
      expect(product.position).toMatch(/on weathering (skutterudite|safflorite|cobaltite) #/);
      const parent = sim.crystals.find((c: any) =>
        c.crystal_id === product.weathering_precursor_receipt.parentCrystalId);
      expect(parent).toBeTruthy();
      const local = sim._localNucleationEvaluationAtAnchor(
        mineral, sim.wall_state._resolveAnchor(parent),
      );
      expect(local.temperatureC).toBeGreaterThanOrEqual(20);
      expect(local.temperatureC).toBeLessThanOrEqual(30);
      expect(parent.zones.some((z: any) => z.step >= 170
        && z.thickness_um < 0
        && Number(z._returned_budget_inventory?.Co) > 0)).toBe(true);
    }

    const cobaltAragonite = sim.crystals.find((c: any) => c.mineral === 'aragonite'
      && c.weathering_precursor_receipt && !c.dissolved);
    expect(cobaltAragonite.zones.some((z: any) =>
      z.co_partition?.distributionCoefficient === 0.1
      && Number(z._budget_inventory_per_um?.Co) > 0)).toBe(true);
    expect(remainingBookedInventory(cobaltAragonite, 'Co')).toBeGreaterThan(0);
    expect(sim._carbonLedgerHistory.at(-1).closed).toBe(true);
  });

  it('Naica records drainage/recharge without inventing the Las Velas oxide facies', () => {
    const sim = naica();
    const state = sim._weatheringEpilogueState;
    expect(state.valid).toBe(true);
    expect(state.activation).toMatchObject({
      step: 260,
      temperatureC: 35,
      pressureKbar: 0.08,
      fluidSurfaceHeightMm: 0,
      co2ImportedPpm: 0,
      lightExposed: false,
    });
    const drain = sim._vadoseExposureTransactions.find((tx: any) => tx.step === 260);
    const recharge = sim._vadoseExposureTransactions.find((tx: any) => tx.step === 290);
    expect(drain.concentrationFactor).toBe(1);
    expect(drain.closed).toBe(true);
    expect(recharge.rewetted).toHaveLength(sim.wall_state.ring_count);
    expect(sim.crystals.some((c: any) => c.mineral === 'thenardite'
      && !c.dissolved && c.total_growth_um > 0)).toBe(false);
    expect(sim.crystals.some((c: any) => c.mineral === 'selenite'
      && !c.dissolved && c.total_growth_um > 0)).toBe(true);
    expect(state.timeline.at(-1).excludedOutcome.reason).toMatch(/Cueva de las Velas/);
  });
});
