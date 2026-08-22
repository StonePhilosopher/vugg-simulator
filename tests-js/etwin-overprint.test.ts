// tests-js/etwin-overprint.test.ts — calcite mechanical e-twin overprint (deformation
// arc §5.3 tenant, the calcite sibling of the v208 bent-quartz overprint). Calcite
// e-twins {01-12} are POST-growth crystal-plastic glide lamellae imposed on a FINISHED
// lattice by later tectonic strain — the textbook calcite paleostress/temperature gauge
// (Ferrill et al. 2004 Type I-IV; Burkhard 1993; Turner 1953). It ships on the EXISTING
// deformation-directive plumbing: a scenario event carries deformation {style:'etwin',...};
// classifyDeformation (js/45) tags surviving crystals that grew before the strain step
// with _deformation.kind='etwin'; js/99i _makeTwinnedCalcite bakes the parallel lamellae.
// CHEMICALLY INERT: this test follows the commissioned SIM 272 locality result
// rather than requiring an unrelated ruby merely to exercise deformation.
//
// Pins: marble_contact_metamorphism's step-165 directive twins a qualifying free calcite;
// the tag is well-formed (kind, atStep=165, amount); ONLY calcite is eligible (ruby is
// spared); the canonical SIM 272 run remains dormant because its calcite is the marble
// wall, not an invented aqueous crystal, and ruby is honestly aspirational at 0/3
// commissioned seeds; a scenario with no directive tags nothing.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const classifyDeformation: any;

function run(scenarioName: string, seed = 42) {
  setSeed(seed);
  const scen = SCENARIOS[scenarioName];
  if (!scen) return null;
  const { conditions, events, defaultSteps } = scen();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 200;
  for (let i = 0; i < steps; i++) sim.run_step();
  return sim;
}

const etwinned = (sim: any) =>
  sim.crystals.filter((c: any) => c._deformation && c._deformation.kind === 'etwin' && !c.dissolved);

describe('calcite mechanical e-twin overprint (Mogok marble orogenic strain)', () => {
  it('the authored step-165 directive twins only pre-existing free calcite', () => {
    const { events } = SCENARIOS.marble_contact_metamorphism();
    const authored = events.find((e: any) => e.step === 165);
    expect(authored.deformation).toEqual({
      style: 'etwin', magnitude: 0.7, minerals: ['calcite'],
    });

    const calcite: any = {
      mineral: 'calcite', dissolved: false, total_growth_um: 1000,
      zones: [{ step: 40, thickness_um: 1000 }],
    };
    const ruby: any = {
      mineral: 'ruby', dissolved: false, total_growth_um: 1000,
      zones: [{ step: 40, thickness_um: 1000 }],
    };
    const sim: any = {
      crystals: [calcite, ruby],
      _deformationEvents: [{ step: authored.step, ...authored.deformation }],
    };
    classifyDeformation(sim);

    expect(calcite._deformation).toEqual({ kind: 'etwin', amount: 0.7, atStep: 165 });
    expect(ruby._deformation).toBeUndefined();
  });

  it('canonical Mogok keeps calcite in the marble wall, so the free-crystal directive is dormant', () => {
    const sim = run('marble_contact_metamorphism', 42);
    expect(sim).toBeTruthy();
    expect(sim.crystals.some((c: any) => c.mineral === 'calcite')).toBe(false);
    expect(etwinned(sim)).toEqual([]);
    expect(sim.crystals.some((c: any) => c.mineral === 'ruby' && !c.dissolved)).toBe(false);
  });

  it('a scenario with no etwin directive tags nothing (no-op → byte-identical)', () => {
    const sim = run('naica_geothermal', 42);                // grows calcite, no strain event
    expect(sim).toBeTruthy();
    expect(etwinned(sim).length).toBe(0);
  });
});
