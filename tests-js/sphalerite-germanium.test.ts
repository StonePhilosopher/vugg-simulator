import { describe, expect, it } from 'vitest';

declare const VugConditions: any;
declare const VugSimulator: any;
declare const FluidChemistry: any;
declare const Crystal: any;
declare const MINERAL_ENGINES: Record<string, Function>;
declare function applyStoichiometricGrowthBudget(crystal: any, zone: any, conditions: any): string[] | null;
declare function stoichiometricBudgetDebitPpmPerUm(species: string, coefficient: number): number;
declare function setSeed(seed: number): void;

function applyAcceptedZone(crystal: any, zone: any, conditions: any) {
  const sim = new VugSimulator(conditions, []);
  sim._finalizeZoneForApplication(crystal, zone);
  sim._applyZoneGrowthBudget(crystal, zone);
  crystal.add_zone(zone);
  return zone;
}

function oneSphaleriteZone(fluidGePpm: number) {
  setSeed(20260805);
  const fluid = new FluidChemistry({
    Zn: 200, S: 200, Fe: 4, Mn: 1, Cu: 0, Ge: fluidGePpm,
    O2: 0.1, pH: 6.5, salinity: 15,
  });
  const conditions = new VugConditions({ temperature: 200, pressure: 0.5, fluid });
  const crystal = new Crystal({ mineral: 'sphalerite', crystal_id: 1 });
  const beforeGe = fluid.Ge;
  const zone = MINERAL_ENGINES.sphalerite(crystal, conditions, 1);
  expect(zone).toBeTruthy();
  applyAcceptedZone(crystal, zone, conditions);
  return { zone, beforeGe, afterGe: fluid.Ge };
}

describe('sphalerite germanium tracer model', () => {
  it('turns the Creative Ge lever into recorded, mass-accounted uptake', () => {
    const absent = oneSphaleriteZone(0);
    const present = oneSphaleriteZone(5);

    // Same seed and major chemistry: Ge is a trace perturbation, not a hidden
    // growth-rate multiplier. Its causal outputs are zone chemistry + inventory.
    expect(present.zone.thickness_um).toBeCloseTo(absent.zone.thickness_um, 12);
    expect(absent.zone.trace_Ge).toBe(0);
    expect(absent.afterGe).toBe(0);

    expect(present.zone.trace_Ge).toBeCloseTo(8540, 8); // 5 ppm * measured Kd 1708
    expect(present.afterGe).toBeLessThan(present.beforeGe);
    const expectedDebit = stoichiometricBudgetDebitPpmPerUm('Ge', 1)
      * present.zone.thickness_um
      * present.zone.trace_stoichiometry.Ge;
    expect(present.beforeGe - present.afterGe).toBeCloseTo(expectedDebit, 12);
    expect(present.zone.note).toContain('empirical/extrapolated');
  });

  it('caps the display estimate at the demonstrated structural envelope', () => {
    const high = oneSphaleriteZone(50);
    expect(high.zone.trace_Ge).toBe(22000);
    expect(high.afterGe).toBeGreaterThanOrEqual(0);
  });

  it('returns the accounted Ge inventory during oxidative sphalerite dissolution', () => {
    setSeed(20260805);
    const fluid = new FluidChemistry({
      Zn: 200, S: 200, Fe: 4, Mn: 1, Cu: 0, Ge: 5,
      O2: 0.1, pH: 6.5, salinity: 15,
    });
    const conditions = new VugConditions({ temperature: 200, pressure: 0.5, fluid });
    const crystal = new Crystal({ mineral: 'sphalerite', crystal_id: 2 });
    const growth = MINERAL_ENGINES.sphalerite(crystal, conditions, 1);
    expect(growth).toBeTruthy();
    applyAcceptedZone(crystal, growth, conditions);

    // An oxidized, Zn-S-poor replacement fluid makes the existing ZnS shell
    // undersaturated. Both conditions matter: O2 alone is not allowed to
    // dissolve a still-supersaturated fluid fixture.
    fluid.O2 = 4;
    fluid.Zn = 0;
    fluid.S = 0;
    const beforeReturn = fluid.Ge;
    const dissolution = MINERAL_ENGINES.sphalerite(crystal, conditions, 2);
    expect(dissolution).toMatchObject({ dissolutionMode: 'oxidative' });
    expect(dissolution.thickness_um).toBeLessThan(0);
    const sim = new VugSimulator(conditions, []);
    sim._finalizeZoneForApplication(crystal, dissolution);
    sim._applyZoneGrowthBudget(crystal, dissolution);

    const expectedReturn = stoichiometricBudgetDebitPpmPerUm('Ge', 1)
      * (-dissolution.thickness_um)
      * growth.trace_stoichiometry.Ge;
    expect(fluid.Ge - beforeReturn).toBeCloseTo(expectedReturn, 12);
    expect(fluid.Zn).toBeGreaterThan(0);
  });

  it('returns only the outer-shell Ge across partial multi-zone dissolution', () => {
    const fluid = new FluidChemistry({ Zn: 0, S: 0, Ge: 0, pH: 6, O2: 4 });
    const conditions = new VugConditions({ temperature: 25, pressure: 0.1, fluid });
    const crystal = new Crystal({ mineral: 'sphalerite', crystal_id: 3 });
    crystal.zones = [
      { thickness_um: 4, trace_stoichiometry: { Ge: 0.001 } },
      { thickness_um: 2, trace_stoichiometry: { Ge: 0.004 } },
    ];
    crystal.total_growth_um = 6;

    const first = { thickness_um: -1, dissolutionMode: 'oxidative' };
    applyStoichiometricGrowthBudget(crystal, first, conditions);
    expect(fluid.Ge).toBeCloseTo(stoichiometricBudgetDebitPpmPerUm('Ge', 0.004), 12);
    crystal.zones.push(first);

    const beforeSecond = fluid.Ge;
    const second = { thickness_um: -2, dissolutionMode: 'oxidative' };
    applyStoichiometricGrowthBudget(crystal, second, conditions);
    // One remaining micrometre of the Ge-rich outer zone, then one from
    // the lean inner zone: no whole-crystal averaging is allowed.
    expect(fluid.Ge - beforeSecond).toBeCloseTo(
      stoichiometricBudgetDebitPpmPerUm('Ge', 0.004 + 0.001), 12,
    );
  });

  it('reconstructs remaining shells across grow A → dissolve → regrow B → dissolve', () => {
    const fluid = new FluidChemistry({ Zn: 0, S: 0, Ge: 0, pH: 6, O2: 4 });
    const conditions = new VugConditions({ temperature: 25, pressure: 0.1, fluid });
    const crystal = new Crystal({ mineral: 'sphalerite', crystal_id: 4 });
    const shellA = { thickness_um: 4, trace_stoichiometry: { Ge: 0.001 }, _time_scaled: true };
    crystal.add_zone(shellA);

    const etchA = { thickness_um: -2, dissolutionMode: 'oxidative', _time_scaled: true };
    applyStoichiometricGrowthBudget(crystal, etchA, conditions);
    crystal.add_zone(etchA);

    const shellB = { thickness_um: 3, trace_stoichiometry: { Ge: 0.01 }, _time_scaled: true };
    crystal.add_zone(shellB);
    const beforeB = fluid.Ge;
    const etchB = { thickness_um: -1, dissolutionMode: 'oxidative', _time_scaled: true };
    applyStoichiometricGrowthBudget(crystal, etchB, conditions);
    crystal.add_zone(etchB);
    expect(fluid.Ge - beforeB).toBeCloseTo(stoichiometricBudgetDebitPpmPerUm('Ge', 0.01), 12);

    const beforeRemainder = fluid.Ge;
    const etchRemainder = { thickness_um: -4, dissolutionMode: 'oxidative', _time_scaled: true };
    applyStoichiometricGrowthBudget(crystal, etchRemainder, conditions);
    // Two remaining micrometres of B, then the two surviving micrometres of A.
    expect(fluid.Ge - beforeRemainder).toBeCloseTo(
      stoichiometricBudgetDebitPpmPerUm('Ge', 2 * 0.01 + 2 * 0.001),
      12,
    );
  });

  it('keeps a partially etched crystal active until no solid remains', () => {
    const crystal = new Crystal({ mineral: 'sphalerite', crystal_id: 5 });
    crystal.add_zone({ thickness_um: 20, growth_rate: 20, _time_scaled: true });
    crystal.add_zone({ thickness_um: -3, growth_rate: -3, _time_scaled: true });
    expect(crystal.total_growth_um).toBe(17);
    expect(crystal.dissolved).toBe(false);
    expect(crystal.partially_dissolved).toBe(true);
    expect(crystal.active).toBe(true);

    crystal.add_zone({ thickness_um: -17, growth_rate: -17, _time_scaled: true });
    expect(crystal.total_growth_um).toBe(0);
    expect(crystal.dissolved).toBe(true);
    expect(crystal.active).toBe(false);
  });
});
