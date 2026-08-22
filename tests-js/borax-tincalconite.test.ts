import { describe, expect, it } from 'vitest';

declare const Crystal: any;
declare const DEHYDRATION_TRANSITIONS: any;
declare const applyDehydrationTransitions: any;
declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

describe('borax–tincalconite saline phase boundary', () => {
  it('keeps the measured pure-system transition at 60.8 °C', () => {
    expect(DEHYDRATION_TRANSITIONS.borax)
      .toEqual(['tincalconite', 25, 1.5, 60.8]);
  });

  it('does not convert submerged borax at 45 °C in a dilute fluid', () => {
    setSeed(42);
    for (let i = 0; i < 50; i++) {
      const crystal = new Crystal({ mineral: 'borax', active: true });
      const transition = applyDehydrationTransitions(
        crystal,
        { salinity: 35, concentration: 1 },
        'submerged',
        45,
        i,
      );
      expect(transition).toBeNull();
      expect(crystal.mineral).toBe('borax');
    }
  });

  it('uses the measured 39.6 °C boundary in halite-saturated NaCl–borate brine', () => {
    setSeed(42);
    let converted = 0;
    for (let i = 0; i < 50; i++) {
      const crystal = new Crystal({ mineral: 'borax', active: true });
      crystal.total_growth_um = 250;
      const transition = applyDehydrationTransitions(
        crystal,
        { salinity: 371, concentration: 1 }, // 10.6× seawater
        'submerged',
        45,
        i,
      );
      if (!transition) continue;
      converted++;
      expect(crystal.mineral).toBe('tincalconite');
      expect(crystal.dehydration_driver).toBe('temperature');
      expect(crystal.dehydration_threshold_C).toBe(39.6);
      expect(crystal.dehydration_receipt).toMatchObject({
        schema: 'dehydration-transformation-v1',
        from: 'borax',
        to: 'tincalconite',
        driver: 'temperature',
        temperature_C: 45,
        temperature_threshold_C: 39.6,
        water_state: 'submerged',
        hydration_water_per_formula: 5,
        water_accounting: 'structural-transfer-testimony; no conserved bulk H2O inventory',
      });
      expect(crystal.dehydration_receipt.formula_amount_mmol_kg).toBeGreaterThan(0);
      expect(crystal.dehydration_receipt.hydration_water_released_mmol_kg)
        .toBeCloseTo(crystal.dehydration_receipt.formula_amount_mmol_kg * 5, 12);
    }
    expect(converted).toBeGreaterThan(30);
  });

  it('produces surviving tincalconite in the canonical Searles seasonal cycle', () => {
    setSeed(42);
    const { conditions, events, defaultSteps } = SCENARIOS.searles_lake();
    const sim = new VugSimulator(conditions, events);
    for (let step = 0; step < defaultSteps; step++) sim.run_step();

    const products = sim.crystals.filter((c: any) =>
      c.mineral === 'tincalconite' && !c.dissolved && c.total_growth_um > 0);
    expect(products.length).toBeGreaterThan(0);
    expect(products.some((c: any) =>
      c.dehydration_driver === 'temperature' || c.dehydration_driver === 'dry-exposure'))
      .toBe(true);
  // A canonical Searles seed takes about 317 s on the commissioning host
  // after SIM 264's exact surface-anchor work. Keep a finite hang detector,
  // but do not make the test ceiling shorter than the measured valid run.
  }, 900_000);
});
