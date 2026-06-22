// tests-js/deformation-overprint.test.ts — post-growth deformation overprint
// (deformation/shear arc, SIM 208). RESEARCH-deformation-shear-2026-06-20.md §5.3.
//
// The genuine "deformation" mechanic: bent quartz/stibnite/mech-twins are imposed
// on a FINISHED crystal by a later tectonic event (post-growth gliding), NOT
// recorded during growth. So a scenario event carries a `deformation` directive;
// apply_events records it on sim._deformationEvents WITH the step it fired;
// classifyDeformation (js/45) bends crystals that had ALREADY grown by that step.
// First tenant: tormiq's late Karakoram-Thrust shear bends the early quartz lining.
//
// These pin: the directive is recorded; ≥1 quartz is tagged bent; the bend only
// hits a crystal that EXISTED before the shear; the rest of the fleet (which
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

  it('at least one quartz is tagged bent, and it existed before the shear', () => {
    const sim = run('tormiq_alpine_cleft', 42);
    const bent = sim.crystals.filter((c: any) => c.mineral === 'quartz' && c._deformation && c._deformation.kind === 'bend');
    expect(bent.length).toBeGreaterThan(0);
    for (const c of bent) {
      // first positive-growth zone must predate the shear step
      let firstStep: any = null;
      for (const z of c.zones || []) { if ((z.thickness_um || 0) > 0) { firstStep = z.step; break; } }
      expect(firstStep).not.toBeNull();
      expect(firstStep).toBeLessThan(c._deformation.atStep);
      expect(c._deformation.atStep).toBe(188);
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
