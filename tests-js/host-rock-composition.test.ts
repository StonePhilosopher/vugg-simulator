import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugWall: any;
declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

describe('declared host-rock composition and carbonate dissolution', () => {
  it('requires every shipped scenario to declare its wall composition', () => {
    const missing = Object.entries(SCENARIOS)
      .filter(([, callable]: any) => !callable._json5_spec?.initial?.wall?.composition)
      .map(([id]) => id);
    expect(missing).toEqual([]);
  });

  it('declares the Tsumeb gossan host as dolomite', () => {
    const { conditions } = SCENARIOS.supergene_oxidation();
    expect(conditions.wall.composition).toBe('dolomite');
    expect(conditions.wall.matrix).toBe('dolomite');
  });

  it('dissolves dolomite as Ca:Mg:carbonate = 1:1:2 and closes the wall ledger', () => {
    const wall = new VugWall({
      composition: 'dolomite', thickness_mm: 100, reactivity: 1,
    });
    const fluid = new FluidChemistry({ Ca: 10, Mg: 20, CO3: 30, pH: 4 });
    const result = wall.dissolve(1.5, fluid);

    expect(result.dissolved).toBe(true);
    expect(result.formula).toBe('CaMg(CO3)2');
    expect(result.ca_released / 40.078).toBeCloseTo(result.formula_extent_mmolkg, 12);
    expect(result.mg_released / 24.305).toBeCloseTo(result.formula_extent_mmolkg, 12);
    expect(result.co3_released / 60.009).toBeCloseTo(2 * result.formula_extent_mmolkg, 12);
    for (const species of ['Ca', 'Mg', 'CO3']) {
      expect(result.host_transaction.fluid_delta_ppm[species])
        .toBeCloseTo(result.host_transaction.expected_ppm[species], 12);
    }
    expect(result.host_transaction.closed).toBe(true);
    expect(result.host_transaction.inventory_error_mmolkg).toBeCloseTo(0, 12);
  });

  it('keeps limestone on the distinct CaCO3 1:1 path', () => {
    const wall = new VugWall({ composition: 'limestone', thickness_mm: 100 });
    const fluid = new FluidChemistry({ Ca: 10, Mg: 20, CO3: 30, pH: 4 });
    const result = wall.dissolve(1.5, fluid);

    expect(result.formula).toBe('CaCO3');
    expect(result.mg_released).toBe(0);
    expect(result.ca_released / 40.078).toBeCloseTo(result.formula_extent_mmolkg, 12);
    expect(result.co3_released / 60.009).toBeCloseTo(result.formula_extent_mmolkg, 12);
    expect(result.host_transaction.closed).toBe(true);
  });

  it('records closed dolomite-to-fluid transactions during the Tsumeb run', () => {
    setSeed(42);
    const { conditions, events, defaultSteps } = SCENARIOS.supergene_oxidation();
    const initialMg = conditions.fluid.Mg;
    const sim = new VugSimulator(conditions, events);
    for (let i = 0; i < (defaultSteps ?? 200); i++) sim.run_step();

    const ledger = sim.conditions.wall.host_release_ledger;
    expect(ledger.length).toBeGreaterThan(0);
    expect(ledger.every((entry: any) => entry.formula === 'CaMg(CO3)2' && entry.closed)).toBe(true);
    expect(sim.conditions.wall.host_release_totals.Mg).toBeGreaterThan(0);
    expect(sim.conditions.fluid.Mg).toBeGreaterThan(initialMg);
  });
});
