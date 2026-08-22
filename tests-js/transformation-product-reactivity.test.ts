import { describe, expect, it } from 'vitest';

declare const Crystal: any;
declare const GrowthZone: any;
declare const FluidChemistry: any;
declare const MINERAL_ENGINES: Record<string, Function>;
declare const applyStoichiometricGrowthBudget: any;

const cases = [
  ['haidingerite', 4.5, { Ca: 1, As: 1 }],
  ['meta-autunite', 4.5, { Ca: 1, U: 2, P: 2 }],
  ['metatorbernite', 5.0, { Cu: 1, U: 2, P: 2 }],
  ['metazeunerite', 5.0, { Cu: 1, U: 2, As: 2 }],
] as const;

describe('transformation-only products retain chemical reactivity', () => {
  for (const [mineral, threshold, formula] of cases) {
    it(`${mineral} cannot grow but acid etches and returns its exact booked layer`, () => {
      const engine = MINERAL_ENGINES[mineral];
      expect(typeof engine).toBe('function');
      const crystal = new Crystal({ mineral, crystal_id: 1 });
      const fluid = new FluidChemistry({
        pH: 7, Ca: 100, Cu: 100, U: 100, P: 100, As: 100,
      });
      const conditions = { fluid, temperature: 25 };
      const shell = new GrowthZone({
        step: 0, temperature: 25, thickness_um: 10, growth_rate: 10,
        formula_stoichiometry: formula,
      });
      shell._time_scaled = true;
      applyStoichiometricGrowthBudget(crystal, shell, conditions);
      crystal.add_zone(shell);
      const before = Object.fromEntries(Object.keys(formula).map(sp => [sp, fluid[sp]]));

      // There is deliberately no positive-growth branch above the acid gate.
      expect(engine(crystal, conditions, 1)).toBeNull();
      fluid.pH = threshold - 0.1;
      const etch = engine(crystal, conditions, 2);
      expect(etch.thickness_um).toBeLessThan(0);
      expect(etch.dissolutionMode).toBe('acid');
      expect(etch.transformation_reactivity.inventory_authority).toBe('booked-layer-lifo');
      expect(etch.transformation_reactivity.positive_growth_allowed).toBe(false);
      etch._time_scaled = true;
      applyStoichiometricGrowthBudget(crystal, etch, conditions);
      crystal.add_zone(etch);

      const removed = -etch.thickness_um;
      for (const sp of Object.keys(formula)) {
        const bookedPerUm = shell._budget_inventory_per_um[sp];
        expect(fluid[sp] - before[sp]).toBeCloseTo(bookedPerUm * removed, 12);
      }
      expect(crystal.total_growth_um).toBeCloseTo(10 - removed, 12);
      expect(crystal.dissolved).toBe(false);
    });
  }
});
