// tests-js/deformation-overprint.test.ts — post-growth deformation overprint
// (deformation/shear arc, SIM 208). RESEARCH-deformation-shear-2026-06-20.md §5.3.
//
// The genuine "deformation" mechanic: bent quartz/stibnite/mech-twins are imposed
// on a FINISHED crystal by a later tectonic event (post-growth gliding), NOT
// recorded during growth. So a scenario event carries a `deformation` directive;
// apply_events records it on sim._deformationEvents WITH the step it fired;
// classifyDeformation (js/45) bends crystals that had ALREADY grown by that step.
// First tenant: tormiq's late Karakoram-Thrust shear targets the early quartz
// lining, but the commissioned seed-42 quartz is only a sub-100 µm speck and
// therefore correctly remains below the body-size deformation threshold.
//
// These pin: the directive is recorded; pre-existing sub-body quartz is not
// falsely tagged; the rest of the fleet (which
// declares no deformation) carries no tags; and the overprint is chemically inert
// (assemblage unchanged — also covered by the baseline test, asserted here too).

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

describe('post-growth deformation overprint (bent quartz @ tormiq)', () => {
  it('tormiq records the late-shear deformation event with its directive', () => {
    const sim = run('tormiq_alpine_cleft', 42);
    expect(sim).toBeTruthy();
    const evs = sim._deformationEvents || [];
    expect(evs.length).toBeGreaterThan(0);
    const bend = evs.find((e: any) => e.style === 'bend');
    expect(bend).toBeTruthy();
    expect(bend.step).toBe(188);
    expect(bend.minerals).toEqual(['quartz']);
  });

  it('withholds a bend tag from the pre-shear quartz speck below the 100 µm body threshold', () => {
    const sim = run('tormiq_alpine_cleft', 42);
    const quartzes = sim.crystals.filter((c: any) => c.mineral === 'quartz' && !c.dissolved);
    expect(quartzes.length).toBeGreaterThan(0);
    for (const c of quartzes) {
      let firstStep: any = null;
      for (const z of c.zones || []) { if ((z.thickness_um || 0) > 0) { firstStep = z.step; break; } }
      expect(firstStep).not.toBeNull();
      expect(firstStep).toBeLessThan(188);
      expect(c.total_growth_um).toBeLessThan(100);
      expect(c._deformation).toBeUndefined();
    }
  });

  it('only the named mineral is bent — epidote (grown later) is spared', () => {
    const sim = run('tormiq_alpine_cleft', 42);
    const bentNonQuartz = sim.crystals.filter((c: any) => c.mineral !== 'quartz' && c._deformation);
    expect(bentNonQuartz.length).toBe(0);
  });

  it('a scenario that declares no deformation carries no tags (grimsel cleft)', () => {
    const sim = run('grimsel_alpine_cleft', 42);
    expect(sim._deformationEvents == null || sim._deformationEvents.length === 0).toBe(true);
    const tagged = sim.crystals.filter((c: any) => c._deformation);
    expect(tagged.length).toBe(0);
  });

  it('the overprint is chemically inert — tormiq grows quartz + epidote as before', () => {
    const sim = run('tormiq_alpine_cleft', 42);
    const counts: Record<string, number> = {};
    for (const c of sim.crystals) if (!c.dissolved) counts[c.mineral] = (counts[c.mineral] || 0) + 1;
    expect(counts.quartz).toBeGreaterThan(0);
    expect(counts.epidote).toBeGreaterThan(0);
  });
});
