// tests-js/andalusite-chiastolite.test.ts — andalusite (Al₂SiO₅) + the chiastolite
// sector-zoning cross (crystal-face realism arc 2026-06-21).
//
// Andalusite is the LOW-PRESSURE Al₂SiO₅ polymorph, the silica-saturated complement
// of corundum. It grows in the new chiastolite_hornfels contact-metamorphic
// scenario; a peraluminous + alkali-poor gate keeps it out of every other scenario
// (so the fleet baseline stays byte-identical — covered by the baseline test). In a
// graphitic host (wall.graphitic) classifySectorZoning tags it _sectorZoned kind
// 'cross' → the renderer draws the carbon cross (js/99i _makeChiastolitePrism).
//
// Pins: andalusite fires in chiastolite_hornfels; it is tagged chiastolite + cross;
// it does NOT fire in a pegmatite (the alkali gate); a non-graphitic peraluminous
// run would not get the cross tag (gate logic).

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
  const steps = defaultSteps ?? 120;
  for (let i = 0; i < steps; i++) sim.run_step();
  return sim;
}

describe('andalusite + chiastolite cross', () => {
  it('andalusite fires in chiastolite_hornfels and grows a real body', () => {
    const sim = run('chiastolite_hornfels', 42);
    expect(sim).toBeTruthy();
    const and = sim.crystals.filter((c: any) => c.mineral === 'andalusite' && !c.dissolved);
    expect(and.length).toBeGreaterThan(0);
    expect(Math.max(...and.map((c: any) => c.total_growth_um))).toBeGreaterThan(100);
  });

  it('the graphitic host tags chiastolite habit + the cross sector kind', () => {
    const sim = run('chiastolite_hornfels', 42);
    expect(sim.conditions.wall.graphitic).toBe(true);
    const and = sim.crystals.filter((c: any) => c.mineral === 'andalusite' && !c.dissolved);
    const chia = and.filter((c: any) => c.habit === 'chiastolite_prism');
    expect(chia.length).toBeGreaterThan(0);
    const crossed = and.filter((c: any) => c._sectorZoned && c._sectorZoned.kind === 'cross');
    expect(crossed.length).toBeGreaterThan(0);
  });

  it('andalusite does NOT fire in a pegmatite — the peraluminous alkali gate', () => {
    const sim = run('gem_pegmatite', 42);
    const and = sim.crystals.filter((c: any) => c.mineral === 'andalusite');
    expect(and.length).toBe(0);
  });

  it('a scenario without a graphitic host carries no chiastolite cross tag', () => {
    // grimsel (alpine cleft) has no andalusite and no graphitic flag → no cross tags
    const sim = run('grimsel_alpine_cleft', 42);
    const crossed = sim.crystals.filter((c: any) => c._sectorZoned && c._sectorZoned.kind === 'cross');
    expect(crossed.length).toBe(0);
  });
});
