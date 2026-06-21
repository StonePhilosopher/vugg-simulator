// tests-js/saddle-dolomite.test.ts — saddle (baroque) dolomite render premise.
//
// Deformation/shear arc (proposals/RESEARCH-deformation-shear-2026-06-20.md §2):
// the curved-face saddle render (js/99i _makeSaddleRhomb) is gated on the
// 'saddle_rhomb' habit and keyed to growth temperature. The science is that
// saddle curvature is a GROWTH-DEFECT — surface roughening above the ~50–60 °C
// critical roughening temperature (Gregg & Sibley 1984) + Ca-excess — NOT
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

describe('saddle dolomite — render premise (warm = saddle, ambient = planar)', () => {
  it('reactive_wall grows at least one saddle_rhomb dolomite', () => {
    const sim = run('reactive_wall', 42);
    const dols = dolomites(sim);
    expect(dols.length).toBeGreaterThan(0);
    const saddles = dols.filter((c) => (c.habit || '').includes('saddle'));
    expect(saddles.length).toBeGreaterThan(0);
  });

  it('the saddle dolomite formed above the ~50–60 °C roughening band', () => {
    const sim = run('reactive_wall', 42);
    const tByStep = (sim as any)._tByStep;
    const saddles = dolomites(sim).filter((c) => (c.habit || '').includes('saddle'));
    expect(saddles.length).toBeGreaterThan(0);
    for (const c of saddles) {
      // representative growth T = mean temperature over its positive zones
      let tSum = 0, tN = 0;
      for (const z of c.zones || []) {
        if (!(z.thickness_um > 0)) continue;
        const T = isFinite(tByStep[z.step]) ? tByStep[z.step] : z.temperature;
        if (isFinite(T)) { tSum += T; tN++; }
      }
      expect(tN).toBeGreaterThan(0);
      expect(tSum / tN).toBeGreaterThan(CRT);
    }
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
