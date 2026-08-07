import { describe, expect, it } from 'vitest';

declare const SCENARIOS: any;
declare const VugSimulator: any;
declare function setSeed(seed: number): void;
declare function assessProductionNucleationDecision(
  name: string, sim: any, sigma: number, sigmaCrit: number,
): any;

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
    const scolecite = firstStep(sim, 'scolecite');
    const mesolite = firstStep(sim, 'mesolite');
    const stilbite = firstStep(sim, 'stilbite');
    const heulandite = firstStep(sim, 'heulandite');
    const apophyllite = firstStep(sim, 'apophyllite');

    // The simulator increments to the authored step, applies that step's event,
    // then nucleates. Event, window, crystal and UI step numbers must agree.
    expect(chalcedony).toBeGreaterThanOrEqual(20);
    expect(chalcedony).toBeLessThan(hematite);
    expect(hematite).toBeGreaterThanOrEqual(35);
    expect(quartz).toBeGreaterThanOrEqual(55);
    expect(quartz).toBeGreaterThan(chalcedony);
    expect(calcite).toBeGreaterThanOrEqual(70);
    for (const [name, step] of Object.entries({ scolecite, mesolite, stilbite, heulandite, apophyllite })) {
      const diagnostic = `; final Ca=${sim.conditions.fluid.Ca.toFixed(2)}, `
        + `Na=${sim.conditions.fluid.Na.toFixed(2)}, Al=${sim.conditions.fluid.Al.toFixed(2)}, `
        + `Si=${sim.conditions.fluid.SiO2.toFixed(2)}, T=${sim.conditions.temperature.toFixed(2)}`;
      expect(Number.isFinite(step), `${name} must form at seed ${seed}${diagnostic}`).toBe(true);
    }
    // Sukheswala et al. (1974): scolecite+mesolite are the first zeolites in
    // this cavity sequence, followed by heulandite+stilbite. Ottens et al.
    // (2019): the apophyllite-bearing hydrothermal stage is later still.
    // Assert exact pairwise group boundaries across every release seed; no
    // ordering is invented within either coeval pair.
    expect(scolecite).toBeGreaterThanOrEqual(70);
    expect(mesolite).toBeGreaterThanOrEqual(70);
    expect(stilbite).toBeGreaterThanOrEqual(90);
    expect(heulandite).toBeGreaterThanOrEqual(90);
    expect(Math.max(scolecite, mesolite)).toBeLessThan(Math.min(stilbite, heulandite));
    expect(Math.max(stilbite, heulandite)).toBeLessThan(apophyllite);
    expect(apophyllite).toBeGreaterThanOrEqual(110);
    expect(firstStep(sim, 'thomsonite')).toBe(Infinity);
    expect(firstStep(sim, 'chabazite')).toBe(Infinity);
    expect(firstStep(sim, 'opal')).toBe(Infinity);
  }, 30_000);

  it('reports authored scenario windows in the live formation diagnosis', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.deccan_zeolite();
    const sim = new VugSimulator(conditions, events);
    for (let i = 0; i < 89; i++) sim.run_step();
    const beforePulse = assessProductionNucleationDecision(
      'heulandite', sim, sim.conditions.supersaturation_heulandite(), 1,
    );
    expect(beforePulse).toMatchObject({ available: true, eligible: false });
    expect(beforePulse.blockers.join(' ')).toContain('authored paragenesis opens at step 90 (current step 89)');
    sim.run_step();
    const atPulse = assessProductionNucleationDecision(
      'heulandite', sim, sim.conditions.supersaturation_heulandite(), 1,
    );
    expect(atPulse.blockers.join(' ')).not.toContain('authored paragenesis');
  });
});
