// tests-js/saddle-dolomite.test.ts — saddle (baroque) dolomite render premise.
//
// Deformation/shear arc (proposals/RESEARCH-deformation-shear-2026-06-20.md §2):
// the curved-face saddle render (js/99i _makeSaddleRhomb) is gated on the
// 'saddle_rhomb' habit and keyed to growth temperature. The science is that
// saddle curvature is a GROWTH-DEFECT — surface roughening above the ~50–60 °C
// critical roughening temperature (Gregg & Sibley 1984) + near-stoichiometric
// Ca-excess — NOT
// external shear. So the engine should tag saddle_rhomb ONLY in warm
// hydrothermal settings, and ambient dolomite (coorong sabkha, dripstone,
// supergene at ~25 °C) must stay planar (massive/coarse), never saddle.
//
// jsdom has no WebGL, so the geometry itself is verified in the preview (a
// 576-vertex bowed rhombohedron, screenshot in the arc handoff). These pins
// lock the ENGINE PREMISE the render reads: which dolomite is saddle, and at
// what temperature — so a future change that drops the warm saddle tag, or
// that starts mis-tagging ambient dolomite as saddle, is caught.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const Crystal: any;
declare const MINERAL_GATES_dolomite: any;
declare function grow_dolomite(crystal: any, conditions: any, step: number): any;

const CRT = 50; // Gregg & Sibley roughening floor

function run(scenarioName: string, seed = 42) {
  setSeed(seed);
  const scen = SCENARIOS[scenarioName];
  if (!scen) return null;
  const { conditions, events, defaultSteps } = scen();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 100;
  const tByStep: Record<number, number> = {};
  for (let i = 0; i < steps; i++) { sim.run_step(); tByStep[sim.step] = sim.conditions.temperature; }
  (sim as any)._tByStep = tByStep;
  return sim;
}

function dolomites(sim: any): any[] {
  return sim ? sim.crystals.filter((c: any) => c.mineral === 'dolomite' && !c.dissolved && c.total_growth_um > 0) : [];
}

describe('dolomite habit premise (temperature plus supersaturation, not temperature alone)', () => {
  it('keeps Sweetwater dolomite documented without claiming an unobserved commissioned crystal', () => {
    const sim = run('reactive_wall', 42);
    expect(dolomites(sim)).toEqual([]);
    expect(SCENARIOS.reactive_wall._json5_spec.aspirational_species).toContainEqual({
      mineral: 'dolomite',
      reason: expect.stringContaining('no discrete dolomite crystal appears in the three SIM 272 commissioned seeds'),
    });
  });

  it('assigns the saddle habit only inside the controlled warm, near-threshold growth regime', () => {
    const { conditions } = SCENARIOS.reactive_wall();
    conditions.temperature = 110;
    conditions._dol_cycle_count = 3;
    conditions.supersaturation_dolomite = () => MINERAL_GATES_dolomite.sigma_crit * 1.5;
    const crystal = new Crystal({ mineral: 'dolomite', crystal_id: 1 });
    const zone = grow_dolomite(crystal, conditions, 1);
    expect(zone).toBeTruthy();
    expect(zone.temperature).toBeGreaterThan(CRT);
    expect(crystal.habit).toBe('saddle_rhomb');

    conditions.temperature = 40;
    const coldCrystal = new Crystal({ mineral: 'dolomite', crystal_id: 2 });
    expect(grow_dolomite(coldCrystal, conditions, 2)).toBeTruthy();
    expect(coldCrystal.habit).toBe('coarse_rhomb');
  });

  it('ambient dolomite scenarios stay planar — never saddle below the roughening T', () => {
    for (const scen of ['sabkha_dolomitization', 'zoned_dripstone_cave', 'ultramafic_supergene']) {
      const sim = run(scen, 42);
      for (const c of dolomites(sim)) {
        expect((c.habit || '').includes('saddle')).toBe(false);
      }
    }
  });
});
