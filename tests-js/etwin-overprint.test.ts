// tests-js/etwin-overprint.test.ts — calcite mechanical e-twin overprint (deformation
// arc §5.3 tenant, the calcite sibling of the v208 bent-quartz overprint). Calcite
// e-twins {01-12} are POST-growth crystal-plastic glide lamellae imposed on a FINISHED
// lattice by later tectonic strain — the textbook calcite paleostress/temperature gauge
// (Ferrill et al. 2004 Type I-IV; Burkhard 1993; Turner 1953). It ships on the EXISTING
// deformation-directive plumbing: a scenario event carries deformation {style:'etwin',...};
// classifyDeformation (js/45) tags surviving crystals that grew before the strain step
// with _deformation.kind='etwin'; js/99i _makeTwinnedCalcite bakes the parallel lamellae.
// CHEMICALLY INERT → byte-identical fleet (the v208 precedent).
//
// Pins: marble_contact_metamorphism's step-165 orogenic strain twins the grown calcite;
// the tag is well-formed (kind, atStep=165, amount); ONLY calcite is twinned (the ruby is
// spared); a scenario with no etwin directive tags nothing (no-op).

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

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
  it('the step-165 strain twins the already-grown marble calcite — tagged + well-formed', () => {
    const sim = run('marble_contact_metamorphism', 42);
    expect(sim).toBeTruthy();
    const tw = etwinned(sim);
    expect(tw.length).toBeGreaterThan(0);
    expect(tw.every((c: any) => c.mineral === 'calcite')).toBe(true);
    for (const c of tw) {
      expect(c._deformation.atStep).toBe(165);             // the orogenic-strain step
      expect(c._deformation.amount).toBeGreaterThan(0);
      expect(c._deformation.amount).toBeLessThanOrEqual(1);
    }
  });

  it('only calcite is twinned — the ruby (twin-resistant corundum) is spared', () => {
    const sim = run('marble_contact_metamorphism', 42);
    const nonCalciteTwinned = sim.crystals.filter(
      (c: any) => c._deformation && c._deformation.kind === 'etwin' && c.mineral !== 'calcite');
    expect(nonCalciteTwinned.length).toBe(0);
    // ruby specifically must never carry the etwin tag
    const ruby = sim.crystals.filter((c: any) => c.mineral === 'ruby');
    for (const c of ruby) expect(c._deformation && c._deformation.kind === 'etwin').toBeFalsy();
  });

  it('twinned calcite grew BEFORE the strain step (it existed to be twinned)', () => {
    const sim = run('marble_contact_metamorphism', 42);
    for (const c of etwinned(sim)) {
      let firstStep: any = null;
      for (const z of (c.zones || [])) { if ((z.thickness_um || 0) > 0) { firstStep = z.step; break; } }
      expect(firstStep).not.toBeNull();
      expect(firstStep).toBeLessThan(165);
    }
  });

  it('a scenario with no etwin directive tags nothing (no-op → byte-identical)', () => {
    const sim = run('naica_geothermal', 42);                // grows calcite, no strain event
    expect(sim).toBeTruthy();
    expect(etwinned(sim).length).toBe(0);
  });
});
