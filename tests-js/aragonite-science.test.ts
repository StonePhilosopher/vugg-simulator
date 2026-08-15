import { describe, expect, it } from 'vitest';

declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const FluidChemistry: any;
declare const VugConditions: any;
declare const Crystal: any;
declare const GrowthZone: any;
declare const setSeed: any;
declare const grow_aragonite: (crystal: any, conditions: any, step: number) => any;
declare const applyStoichiometricGrowthBudget: (crystal: any, zone: any, conditions: any) => any;
declare const aragoniteSrPartitioning: (fluid: any) => any;
declare const finalizeAragoniteSrPartitionReceipt: (crystal: any, zone: any) => void;
declare const ARAGONITE_SR_PARTITION_MODEL: any;

describe('aragonite selector evidence domains', () => {
  it('makes absent selectors exactly zero even at very high carbonate omega', () => {
    const fluid = new FluidChemistry({
      Ca: 2500, Mg: 20, CO3: 5000, pH: 8.3, Sr: 0, Pb: 0, Ba: 0,
      salinity: 0.5, O2: 5,
    });
    const conditions = new VugConditions({ temperature: 15, pressure: 0.01, fluid });
    expect(conditions.supersaturation_aragonite()).toBe(0);
  });

  it('admits either documented high molar Mg/Ca or an explicit shallow open-spring window', () => {
    const highMg = new VugConditions({
      temperature: 18,
      pressure: 0.01,
      fluid: new FluidChemistry({ Ca: 800, Mg: 3500, CO3: 2200, pH: 8.4 }),
    });
    const spring = new VugConditions({
      temperature: 60,
      pressure: 0.05,
      fluid: new FluidChemistry({ Ca: 300, Mg: 100, CO3: 400, pH: 7.0 }),
      wall: { open_spring: true },
    });
    expect(highMg.supersaturation_aragonite()).toBeGreaterThan(0);
    expect(spring.supersaturation_aragonite()).toBeGreaterThan(0);
  });

  it('distinguishes sealed and open-spring fluids at identical pressure, temperature, and chemistry', () => {
    const fluid = () => new FluidChemistry({ Ca: 300, Mg: 100, CO3: 400, pH: 7.0 });
    const sealed = new VugConditions({
      temperature: 60, pressure: 0.05, fluid: fluid(), wall: { open_spring: false },
    });
    const open = new VugConditions({
      temperature: 60, pressure: 0.05, fluid: fluid(), wall: { open_spring: true },
    });
    expect(sealed.supersaturation_aragonite()).toBe(0);
    expect(open.supersaturation_aragonite()).toBeGreaterThan(0);
  });
});

describe('authored passive thermal equilibrium', () => {
  it('preserves every authored sub-25 C scenario in the absence of a heat source', () => {
    const expected: Record<string, number> = {
      stalactite_demo: 15,
      zoned_dripstone_cave: 18,
      searles_lake: 18,
      colorado_plateau: 22,
    };
    for (const [name, temperature] of Object.entries(expected)) {
      setSeed(42);
      const { conditions, events } = SCENARIOS[name]();
      const sim = new VugSimulator(conditions, events);
      expect(sim.conditions.wall.ambient_temperature_C).toBe(temperature);
      for (let i = 0; i < 10; i++) sim.ambient_cooling();
      expect(sim.conditions.temperature, name).toBe(temperature);
    }
  });

  it('never turns passive cooling into heating below the boundary', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.stalactite_demo();
    const sim = new VugSimulator(conditions, events);
    sim.conditions.temperature = 10;
    sim.conditions.wall.ambient_temperature_C = 15;
    sim.ambient_cooling();
    expect(sim.conditions.temperature).toBe(10);
  });
});

describe('mass-balanced speleothem aragonite Sr partitioning', () => {
  it('debits and returns Sr using the measured molar distribution coefficient', () => {
    setSeed(42);
    const fluid = new FluidChemistry({
      Ca: 800, Mg: 3500, CO3: 2200, pH: 8.4, Sr: 0.59,
      Ba: 8, salinity: 0.5, O2: 5,
    });
    const conditions = new VugConditions({ temperature: 18, pressure: 0.01, fluid });
    const crystal = new Crystal({ mineral: 'aragonite', crystal_id: 1 });
    const partition = aragoniteSrPartitioning(fluid);
    const expectedSolutionRatio = (0.59 / ARAGONITE_SR_PARTITION_MODEL.srMolarMass)
      / (800 / ARAGONITE_SR_PARTITION_MODEL.caMolarMass);
    expect(partition.solutionMolarSrCa).toBeCloseTo(expectedSolutionRatio, 14);
    expect(partition.formulaCoefficientSr)
      .toBeCloseTo(ARAGONITE_SR_PARTITION_MODEL.distributionCoefficient * expectedSolutionRatio, 14);

    const zone = grow_aragonite(crystal, conditions, 1);
    expect(zone).toBeTruthy();
    // Mirror the production path: finalized accepted thickness is marked
    // before budgeting so Crystal.add_zone cannot apply the geological clock
    // a second time.
    zone._time_scaled = true;
    const caBefore = fluid.Ca;
    const co3Before = fluid.CO3;
    const srBefore = fluid.Sr;
    applyStoichiometricGrowthBudget(crystal, zone, conditions);
    finalizeAragoniteSrPartitionReceipt(crystal, zone);

    const caMolesDebited = (caBefore - fluid.Ca) / ARAGONITE_SR_PARTITION_MODEL.caMolarMass;
    const srMolesDebited = (srBefore - fluid.Sr) / ARAGONITE_SR_PARTITION_MODEL.srMolarMass;
    expect(srMolesDebited / caMolesDebited)
      .toBeCloseTo(ARAGONITE_SR_PARTITION_MODEL.distributionCoefficient * expectedSolutionRatio, 11);
    expect(zone._budget_inventory_per_um.Sr).toBeGreaterThan(0);
    expect(zone.sr_partition.effectiveDistributionCoefficient)
      .toBeCloseTo(ARAGONITE_SR_PARTITION_MODEL.distributionCoefficient, 10);
    expect(zone.sr_partition.inventoryLimited).toBe(false);

    crystal.add_zone(zone);
    const dissolution = new GrowthZone({
      step: 2,
      temperature: 18,
      thickness_um: -zone.thickness_um,
      growth_rate: -zone.thickness_um,
      dissolutionMode: 'acid',
    });
    applyStoichiometricGrowthBudget(crystal, dissolution, conditions);
    expect(fluid.Sr).toBeCloseTo(srBefore, 12);
    expect(fluid.Ca).toBeCloseTo(caBefore, 12);
    expect(fluid.CO3).toBeCloseTo(co3Before, 12);
  });
});
