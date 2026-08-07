import { describe, expect, it } from 'vitest';

declare const SCENARIOS: any;
declare const VugSimulator: any;
declare function setSeed(seed: number): void;

function run(seed: number) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS.deccan_zeolite();
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < defaultSteps; i++) sim.run_step();
  return sim;
}

function firstStep(sim: any, mineral: string): number {
  const steps = sim.crystals
    .filter((c: any) => c.mineral === mineral && c.total_growth_um > 0)
    .map((c: any) => c.nucleation_step);
  return steps.length ? Math.min(...steps) : Infinity;
}

describe('Deccan authored paragenesis is executable testimony', () => {
  it.each([42, 4242, 5740371])('keeps every generation behind its authored pulse (seed %s)', (seed) => {
    const sim = run(seed);
    const chalcedony = firstStep(sim, 'chalcedony');
    const hematite = firstStep(sim, 'hematite');
    const quartz = firstStep(sim, 'quartz');
    const calcite = firstStep(sim, 'calcite');
    const stageIINames = ['thomsonite', 'scolecite', 'mesolite', 'stilbite', 'heulandite', 'chabazite'];
    const stageII = stageIINames.map((name) => firstStep(sim, name));
    const apophyllite = firstStep(sim, 'apophyllite');

    // Scenario events fire before the simulator increments its zero-based
    // clock, so an authored step N is recorded as nucleation_step N-1.
    expect(chalcedony).toBeGreaterThanOrEqual(19);
    expect(chalcedony).toBeLessThan(hematite);
    expect(hematite).toBeGreaterThanOrEqual(34);
    expect(quartz).toBeGreaterThanOrEqual(54);
    expect(quartz).toBeGreaterThan(chalcedony);
    expect(calcite).toBeGreaterThanOrEqual(69);
    for (let i = 0; i < stageII.length; i++) {
      const diagnostic = stageIINames[i] === 'mesolite'
        ? `; final sigma=${sim.conditions.supersaturation_mesolite().toFixed(3)}, `
          + `Ca=${sim.conditions.fluid.Ca.toFixed(2)}, Na=${sim.conditions.fluid.Na.toFixed(2)}, `
          + `Al=${sim.conditions.fluid.Al.toFixed(2)}, Si=${sim.conditions.fluid.SiO2.toFixed(2)}, `
          + `T=${sim.conditions.temperature.toFixed(2)}`
        : '';
      expect(Number.isFinite(stageII[i]), `${stageIINames[i]} must form at seed ${seed}${diagnostic}`).toBe(true);
    }
    expect(Math.min(...stageII)).toBeGreaterThanOrEqual(69);
    expect(apophyllite).toBeGreaterThanOrEqual(109);
    expect(apophyllite).toBeGreaterThan(Math.min(...stageII));
    expect(firstStep(sim, 'opal')).toBe(Infinity);
  }, 30_000);
});
