import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

declare const SCENARIOS: any;
declare const MINERAL_ENGINES: any;
declare const MINERAL_GATES_REGISTRY: any;
declare const MINERAL_STOICHIOMETRY: any;
declare const STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE: any;
declare const VugSimulator: any;
declare const VugConditions: any;
declare const FluidChemistry: any;
declare const Crystal: any;
declare const GrowthZone: any;
declare const applyStoichiometricGrowthBudget: any;
declare const setSeed: any;
declare const crystalDisplayName: any;
declare const _buildMineralFormationExplanation: any;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function runScenario(name: string, seed = 42) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < defaultSteps; i++) sim.run_step();
  return sim;
}

function diagnosticGroup(why: any, label: string) {
  return why.groups.find((g: any) => g.label === label);
}

describe('SIM 246 first-class chalcedony phase', () => {
  it('implements the published Fournier equilibria rather than a fixed ppm threshold', () => {
    const c = new VugConditions({
      temperature: 25,
      fluid: new FluidChemistry({ SiO2: 200, pH: 7 }),
    });
    expect(c.chalcedony_equilibrium(25)).toBeCloseTo(16.9, 0);
    expect(c.chalcedony_equilibrium(100)).toBeCloseTo(83.9, 0);
    expect(c.chalcedony_equilibrium(200)).toBeCloseTo(322.76, 1);
    expect(c.opal_equilibrium(25)).toBeCloseTo(117.01, 1);
    expect(c.opal_equilibrium(100)).toBeCloseTo(363.92, 1);
  });

  it('steps opal -> chalcedony -> quartz as the higher-solubility phases fall below equilibrium', () => {
    const opal = new VugConditions({
      temperature: 60,
      fluid: new FluidChemistry({ SiO2: 350, pH: 8 }),
    });
    expect(opal.silica_precipitate_phase()).toBe('opal');
    expect(opal.supersaturation_opal()).toBeGreaterThan(MINERAL_GATES_REGISTRY.opal.sigma_crit);
    expect(opal.supersaturation_chalcedony()).toBe(0);
    expect(opal.supersaturation_quartz()).toBe(0);

    const chalcedony = new VugConditions({
      temperature: 150,
      fluid: new FluidChemistry({ SiO2: 400, pH: 7 }),
    });
    expect(chalcedony.silica_precipitate_phase()).toBe('chalcedony');
    expect(chalcedony.supersaturation_chalcedony()).toBeGreaterThan(MINERAL_GATES_REGISTRY.chalcedony.sigma_crit);
    expect(chalcedony.supersaturation_quartz()).toBe(0);

    const quartz = new VugConditions({
      temperature: 150,
      fluid: new FluidChemistry({ SiO2: 160, pH: 7 }),
    });
    expect(quartz.chalcedony_equilibrium_ratio()).toBeLessThan(1);
    expect(quartz.quartz_equilibrium_ratio()).toBeGreaterThan(1.2);
    expect(quartz.silica_precipitate_phase()).toBe('quartz');
    expect(quartz.supersaturation_chalcedony()).toBe(0);
    expect(quartz.supersaturation_quartz()).toBeGreaterThan(1.2);
  });

  it('does not let subcritical chalcedony suppress burial-temperature quartz', () => {
    const herkimer = new VugConditions({
      temperature: 175,
      fluid: new FluidChemistry({ SiO2: 260, pH: 6.8 }),
    });
    expect(herkimer.chalcedony_equilibrium_ratio()).toBeGreaterThan(1);
    expect(herkimer.chalcedony_equilibrium_ratio()).toBeLessThanOrEqual(
      MINERAL_GATES_REGISTRY.chalcedony.sigma_crit,
    );
    expect(herkimer.silica_precipitate_phase()).toBe('quartz');
    expect(herkimer.supersaturation_quartz()).toBeGreaterThan(
      MINERAL_GATES_REGISTRY.quartz.sigma_crit,
    );
  });

  it('registers a production gate, engine, formula ledger, and live Creative explanation', () => {
    expect(typeof MINERAL_ENGINES.chalcedony).toBe('function');
    expect(MINERAL_GATES_REGISTRY.chalcedony).toMatchObject({
      sigma_crit: 1.12,
      T_min: 0,
      T_max: 200,
      pH_min: 3,
      pH_max: 10,
    });
    expect(MINERAL_STOICHIOMETRY.chalcedony).toEqual({ SiO2: 1 });

    const conditions = new VugConditions({
      temperature: 150,
      fluid: new FluidChemistry({ SiO2: 400, pH: 7, O2: 0.2 }),
    });
    const sim = new VugSimulator(conditions, []);
    const why = _buildMineralFormationExplanation(
      'chalcedony', conditions, sim, conditions.supersaturation_chalcedony(),
    );
    expect(why.state).toBe('eligible');
    expect(diagnosticGroup(why, 'Saturation').chips[0].text).toContain('1.12');
    expect(diagnosticGroup(why, 'Production nucleator').chips[0].text).toContain('_nuc_chalcedony');
    expect(diagnosticGroup(why, 'Calibrated growth budget').chips[0].text).toContain('SiO2');
    expect(STOICHIOMETRIC_GROWTH_BUDGET_DISCLOSURE.limitation).toContain('not physical');
  });

  it('returns exact booked SiO2 during high-temperature solution-mediated maturation', () => {
    const conditions = new VugConditions({
      temperature: 150,
      fluid: new FluidChemistry({ SiO2: 1200, pH: 7, O2: 0.2 }),
    });
    const crystal = new Crystal({ mineral: 'chalcedony', crystal_id: 1 });
    crystal.active = true;
    const positive = new GrowthZone({
      step: 1, temperature: 150, thickness_um: 20, growth_rate: 20,
      note: 'test accepted chalcedony shell',
    });
    positive._time_scaled = true;
    const initial = conditions.fluid.SiO2;
    applyStoichiometricGrowthBudget(crystal, positive, conditions);
    crystal.add_zone(positive);
    const afterGrowth = conditions.fluid.SiO2;
    expect(afterGrowth).toBeLessThan(initial);

    conditions.temperature = 250;
    const transition = MINERAL_ENGINES.chalcedony(crystal, conditions, 2);
    expect(transition.thickness_um).toBeLessThan(0);
    expect(transition._silica_transition).toMatchObject({
      from: 'chalcedony', to: 'quartz', pathway: 'solution_mediated',
    });
    transition._time_scaled = true;
    applyStoichiometricGrowthBudget(crystal, transition, conditions);
    const returned = transition._returned_budget_inventory.SiO2;
    crystal.add_zone(transition);
    expect(returned).toBeGreaterThan(0);
    expect(conditions.fluid.SiO2).toBeCloseTo(afterGrowth + returned, 10);
    expect(crystal.total_growth_um).toBeCloseTo(20 + transition.thickness_um, 10);
  });

  it('conserves inert particulate silica while precipitation and dissolution book only the reactive pool', () => {
    const fluid = new FluidChemistry({ SiO2: 100, reactiveSilicaFraction: 0.5, pH: 7 });
    const conditions = new VugConditions({ temperature: 150, fluid });
    const crystal = new Crystal({ mineral: 'chalcedony', crystal_id: 7 });
    const zone = new GrowthZone({
      step: 1, temperature: 150, thickness_um: 10, growth_rate: 10,
      note: 'reactive silica inventory test',
    });
    zone._time_scaled = true;
    const inertBefore = fluid.SiO2 - fluid.reactiveSilicaPpm();
    applyStoichiometricGrowthBudget(crystal, zone, conditions);
    crystal.add_zone(zone);
    expect(fluid.SiO2 - fluid.reactiveSilicaPpm()).toBeCloseTo(inertBefore, 10);
    const afterGrowth = fluid.reactiveSilicaPpm();

    const dissolve = new GrowthZone({
      step: 2, temperature: 250, thickness_um: -zone.thickness_um,
      growth_rate: -zone.thickness_um, note: 'return booked silica',
    });
    dissolve._time_scaled = true;
    applyStoichiometricGrowthBudget(crystal, dissolve, conditions);
    expect(fluid.reactiveSilicaPpm()).toBeGreaterThan(afterGrowth);
    expect(fluid.SiO2 - fluid.reactiveSilicaPpm()).toBeCloseTo(inertBefore, 10);
  });

  it('does not nucleate new chalcedony after stable quartz is already exposed', () => {
    const cooling = runScenario('cooling', 42);
    const genericSilica = cooling.crystals.filter((c: any) =>
      ['opal', 'chalcedony', 'quartz'].includes(c.mineral) && c.total_growth_um > 0,
    );
    expect(genericSilica.length).toBeGreaterThan(0);
    expect(genericSilica.every((c: any) => c.mineral === 'quartz')).toBe(true);
  });

  it('keeps Great Salt Plains suspended silt out of every authigenic silica phase', () => {
    const gsp = runScenario('great_salt_plains', 42);
    expect(gsp.conditions.fluid.reactiveSilicaFraction).toBe(0);
    expect(gsp.conditions.fluid.reactiveSilicaPpm()).toBe(0);
    expect(gsp.crystals.filter((c: any) =>
      ['opal', 'chalcedony', 'quartz'].includes(c.mineral),
    )).toEqual([]);
  });

  it.each(['searles_lake'])(
    'does not spend particulate scenario SiO2 as dissolved silica in %s',
    (scenario) => {
      const sim = runScenario(scenario, 42);
      expect(sim.conditions.fluid.reactiveSilicaFraction).toBe(0);
      expect(sim.conditions.fluid.reactiveSilicaPpm()).toBe(0);
      expect(sim.crystals.filter((c: any) =>
        ['opal', 'chalcedony', 'quartz'].includes(c.mineral),
      )).toEqual([]);
    },
  );

  it('removes the unauthored TN457 silica phases while retaining its barite experiment', () => {
    const sim = runScenario('tn457_barite_pulses', 42);
    expect(sim.crystals.some((c: any) => c.mineral === 'barite' && c.total_growth_um > 0)).toBe(true);
    expect(sim.crystals.filter((c: any) =>
      ['opal', 'chalcedony', 'quartz'].includes(c.mineral),
    )).toEqual([]);
  });

  it('executes Deccan and Ametista do Sul claims as real paragenetic phases', () => {
    const deccan = runScenario('deccan_zeolite', 42);
    const deccanChalcedony = deccan.crystals.filter((c: any) => c.mineral === 'chalcedony' && c.total_growth_um > 0);
    const deccanQuartz = deccan.crystals.filter((c: any) => c.mineral === 'quartz' && c.total_growth_um > 0);
    expect(deccanChalcedony.length).toBeGreaterThan(0);
    expect(deccanChalcedony.some((c: any) => c.habit === 'banded_agate')).toBe(true);
    expect(deccanQuartz.length).toBeGreaterThan(0);
    expect(Math.min(...deccanChalcedony.map((c: any) => c.nucleation_step)))
      .toBeLessThan(Math.min(...deccanQuartz.map((c: any) => c.nucleation_step)));
    expect(deccanChalcedony.some((c: any) => c._silica_oscillation_reversals >= 1)).toBe(true);

    const amethyst = runScenario('amethyst_geode', 42);
    const agate = amethyst.crystals.find((c: any) => c.mineral === 'chalcedony' && c.total_growth_um > 0);
    const quartz = amethyst.crystals.find((c: any) => c.mineral === 'quartz' && c.total_growth_um > 0);
    expect(agate).toBeTruthy();
    expect(agate.habit).toBe('banded_agate');
    expect(quartz).toBeTruthy();
    expect(agate.nucleation_step).toBeLessThan(quartz.nucleation_step);
    expect(crystalDisplayName(quartz)).toBe('quartz (amethyst)');
  }, 30_000);

  it('keeps Tutorial 1 thermodynamically honest: quartz grows, then hot water dissolves it', () => {
    const tutorial = runScenario('tutorial_first_crystal', 42);
    const genericSilica = tutorial.crystals.filter((c: any) =>
      ['opal', 'chalcedony', 'quartz'].includes(c.mineral),
    );
    expect(genericSilica.map((c: any) => c.mineral)).toEqual(['quartz']);
    expect(tutorial.crystals.filter((c: any) => c.mineral !== 'quartz')).toEqual([]);
    expect(genericSilica[0].zones.some((z: any) => z.thickness_um > 0)).toBe(true);
    expect(genericSilica[0].zones.some((z: any) => z.thickness_um < 0)).toBe(true);
  });

  it('uses one executable chalcedony substrate route in production and hover', () => {
    const conditions = new VugConditions({
      temperature: 150,
      fluid: new FluidChemistry({ SiO2: 160, pH: 7 }),
    });
    const sim = new VugSimulator(conditions, []);
    const host = sim.nucleate('chalcedony', 'vug wall', 1.5);
    host.active = true;
    host.dissolved = false;
    const why = _buildMineralFormationExplanation(
      'quartz', conditions, sim, conditions.supersaturation_quartz(),
    );
    const substrate = diagnosticGroup(why, 'Substrate');
    expect(substrate.chips.some((chip: any) =>
      chip.text.includes('chalcedony') && chip.text.includes('σcrit ×1.00'),
    )).toBe(true);
  });

  it('does not retain the cosmetic quartz-fill agate shortcut', () => {
    const renderer = fs.readFileSync(path.join(ROOT, 'js', '99h-renderer-idle-chart.ts'), 'utf8');
    const simulator = fs.readFileSync(path.join(ROOT, 'js', '85-simulator.ts'), 'utf8');
    expect(renderer).toContain("c.mineral === 'chalcedony'");
    expect(renderer).toContain("c.habit === 'banded_agate'");
    expect(renderer).not.toContain('vug filled with quartz');
    expect(simulator).not.toContain('AGATE (>80% quartz)');
  });
});
