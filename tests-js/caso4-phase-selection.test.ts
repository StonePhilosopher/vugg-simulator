import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;
declare const Crystal: any;
declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const setSeed: any;
declare function waterActivityAssessment(fluid: any, temperatureC: number): any;
declare function gypsumAnhydritePhaseAssessment(fluid: any, temperatureC: number, pressureKbar: number): any;
declare function evaluateCaSO4System(fluid: any, temperatureC: number, pressureKbar: number): any;
declare function applyCaSO4PhaseTransition(crystal: any, fluid: any, temperatureC: number, pressureKbar: number, step: number): any;
declare function sulfateSaturationIndex(mineral: string, fluid: any, temperatureC: number): number;

function oxidizedCaSO4Fluid(overrides: Record<string, any> = {}) {
  return new FluidChemistry({
    Ca: 1000, S: 1000, O2: 2, pH: 7, salinity: 0,
    ...overrides,
  });
}

describe('authoritative CaSO4 phase selector', () => {
  it('reproduces the Hardie measured a_w points and pure-water reversal', () => {
    const cases = [
      { salinity: 65, aw: 0.960, boundary: 55 },
      { salinity: 195, aw: 0.845, boundary: 39 },
      { salinity: 252.5, aw: 0.770, boundary: 23 },
      { salinity: 0, aw: 1.000, boundary: 58 },
    ];
    for (const row of cases) {
      const fluid = oxidizedCaSO4Fluid({ salinity: row.salinity });
      expect(waterActivityAssessment(fluid, 25).value).toBeCloseTo(row.aw, 3);
      const assessment = gypsumAnhydritePhaseAssessment(fluid, row.boundary, 0.001);
      expect(assessment.boundaryC).toBeCloseTo(row.boundary + 0.0147, 1);
    }
  });

  it('applies fluid pressure to the boundary without conflating it with kinetics', () => {
    const fluid = oxidizedCaSO4Fluid();
    const surface = gypsumAnhydritePhaseAssessment(fluid, 70, 0.001);
    const oneKbar = gypsumAnhydritePhaseAssessment(fluid, 70, 1);
    expect(oneKbar.boundaryC - surface.boundaryC).toBeCloseTo(14.6853, 3);
    expect(surface.nominalPhase).toBe('anhydrite');
    expect(oneKbar.nominalPhase).toBe('gypsum');
  });

  it('separates SI, equilibrium phase, and direct-nucleation kinetics', () => {
    const brine = oxidizedCaSO4Fluid({ salinity: 250 });
    const lowT = evaluateCaSO4System(brine, 32, 0.05);
    expect(lowT.gypsumSI).toBeGreaterThan(0);
    expect(lowT.anhydriteSI).toBeGreaterThan(0);
    expect(lowT.phase.phase).toBe('anhydrite');
    expect(lowT.gypsumPrimaryAdmissible).toBe(true);
    expect(lowT.anhydritePrimaryAdmissible).toBe(false);
    expect(lowT.gypsumToAnhydriteAdmissible).toBe(true);

    const hot = evaluateCaSO4System(brine, 120, 0.05);
    expect(hot.anhydritePrimaryAdmissible).toBe(true);
    expect(hot.gypsumPrimaryAdmissible).toBe(false);
  });

  it('hard-blocks production when authoritative SI is non-positive', () => {
    const fluid = oxidizedCaSO4Fluid({ Ca: 5, S: 5 });
    const conditions = new VugConditions({ temperature: 25, pressure: 0.05, fluid });
    expect(sulfateSaturationIndex('selenite', fluid, 25)).toBeLessThan(0);
    expect(conditions.supersaturation_selenite()).toBe(0);
  });

  it('keeps measured Naica cave brine in the gypsum field with positive SI', () => {
    const { conditions } = SCENARIOS.naica_geothermal();
    const evaluation = evaluateCaSO4System(
      conditions.fluid,
      conditions.temperature,
      conditions.pressure,
    );
    expect(evaluation.phase.phase).toBe('gypsum');
    expect(evaluation.gypsumSI).toBeGreaterThan(0);
    expect(evaluation.anhydriteSI).toBeLessThan(evaluation.gypsumSI);
    expect(evaluation.gypsumPrimaryAdmissible).toBe(true);
  });

  it('makes Great Salt Plains wet/dry cycling cross the authoritative gypsum SI', () => {
    const { conditions, events } = SCENARIOS.great_salt_plains();
    const initial = evaluateCaSO4System(
      conditions.fluid,
      conditions.temperature,
      conditions.pressure,
    );
    expect(initial.phase.phase).toBe('gypsum');
    expect(initial.gypsumSI).toBeGreaterThan(0);

    events.find((event: any) => event.name === 'Spring Rain #1').apply_fn(conditions);
    const wet = evaluateCaSO4System(
      conditions.fluid,
      conditions.temperature,
      conditions.pressure,
    );
    expect(wet.gypsumSI).toBeLessThanOrEqual(0);

    events.find((event: any) => event.name === 'Dry Season #1').apply_fn(conditions);
    const dry = evaluateCaSO4System(
      conditions.fluid,
      conditions.temperature,
      conditions.pressure,
    );
    expect(dry.phase.phase).toBe('gypsum');
    expect(dry.gypsumSI).toBeGreaterThan(0);
    expect(dry.gypsumPrimaryAdmissible).toBe(true);
  });
});

describe('mass-balanced CaSO4 replacement', () => {
  it('conserves booked Ca and sulfate while recording two structural waters', () => {
    const brine = oxidizedCaSO4Fluid({ salinity: 250 });
    const crystal = new Crystal({ mineral: 'selenite', crystal_id: 1 });
    crystal.total_growth_um = 100;
    crystal.c_length_mm = 0.1;
    const caBefore = brine.Ca;
    const sulfateBefore = brine.S;

    const forward = applyCaSO4PhaseTransition(crystal, brine, 32, 0.05, 10);
    expect(forward).not.toBeNull();
    expect(crystal.mineral).toBe('anhydrite');
    expect(brine.Ca).toBe(caBefore);
    expect(brine.S).toBe(sulfateBefore);
    expect(forward.caAfterPpm).toBe(forward.caBeforePpm);
    expect(forward.sulfateAfterPpm).toBe(forward.sulfateBeforePpm);
    expect(forward.waterTransferMmolKg).toBeCloseTo(2 * forward.formulaAmountMmolKg, 12);
    expect(crystal._ca_so4_solid_volume_ratio).toBeCloseTo(46.1 / 73.9, 8);
    expect(crystal._ca_so4_pseudomorphic_envelope_preserved).toBe(true);

    brine.salinity = 0;
    const reverse = applyCaSO4PhaseTransition(crystal, brine, 25, 0.05, 11);
    expect(reverse).not.toBeNull();
    expect(crystal.mineral).toBe('selenite');
    expect(reverse.waterTransferMmolKg).toBeCloseTo(-2 * reverse.formulaAmountMmolKg, 12);
    expect(crystal._ca_so4_hydration_water_mmolkg).toBeCloseTo(0, 12);
    expect(crystal.phase_transition_history).toHaveLength(2);
  });

  it('does not transform inside the propagated boundary uncertainty band', () => {
    const fluid = oxidizedCaSO4Fluid();
    const crystal = new Crystal({ mineral: 'selenite', crystal_id: 2 });
    crystal.total_growth_um = 100;
    const assessment = gypsumAnhydritePhaseAssessment(fluid, 58, 0.001);
    expect(assessment.phase).toBe('uncertain');
    expect(applyCaSO4PhaseTransition(crystal, fluid, 58, 0.001, 1)).toBeNull();
  });

  it('makes sabkha anhydrite only from a recorded gypsum precursor', () => {
    setSeed(42);
    const { conditions, events, defaultSteps } = SCENARIOS.sabkha_dolomitization();
    const sim = new VugSimulator(conditions, events);
    for (let i = 0; i < defaultSteps; i++) sim.run_step();
    const anhydrites = sim.crystals.filter((crystal: any) => crystal.mineral === 'anhydrite');
    expect(anhydrites.length).toBeGreaterThan(0);
    expect(anhydrites.every((crystal: any) =>
      Array.isArray(crystal.phase_transition_history)
      && crystal.phase_transition_history.some((row: any) =>
        row.from === 'selenite' && row.to === 'anhydrite'))).toBe(true);
    expect(anhydrites.every((crystal: any) => crystal.nucleation_temp < 100)).toBe(true);
  });
});
