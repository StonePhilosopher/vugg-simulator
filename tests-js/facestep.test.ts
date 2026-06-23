// tests-js/facestep.test.ts — DIRECTIONAL stepped growth, central-distance arc
// (2026-06-22; proposals/PROPOSAL-DIRECTIONAL-GROWTH-2026-06-22.md).
//
// Phase 0 laid the rails: a crystal-level _faceStep render tag (js/45 classifyFaceStep)
// marking macrostep relief that belongs to ONE face-set (calcite {104} obtuse/acute
// anisotropy — calcite is centrosymmetric so this is ENVIRONMENTAL + surface-step
// anisotropy, NOT polarity). Phase 1 opts elmwood in (wall.directional_steps) and the
// renderer (js/99i _makeDirectionalTerracedCalciteGeom) carves the stepped face-set,
// leaving the opposite set smooth.
//
// The tag is GATED on wall.directional_steps. Only elmwood sets it (Phase 1), so every
// OTHER scenario stays dormant → byte-identical (cold-ci's calibration baseline is the
// hard byte-identity gate; _faceStep never touches counts/sizes/chemistry). Pins:
//   (1) dormancy — a calcite scenario that did NOT opt in (marble) tags nothing;
//   (2) the tag is absent (undefined) on untagged crystals (no serialized output widens);
//   (3) Phase 1 — elmwood (real opt-in) tags its stepped calcite with steppedFaceSet:'up';
//   (4) only calcite is ever tagged.

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

const faceStepped = (sim: any) =>
  sim.crystals.filter((c: any) => c._faceStep && !c.dissolved);

const steppedCalcite = (sim: any) =>
  sim.crystals.filter((c: any) =>
    c.mineral === 'calcite' && !c.dissolved && (c.total_growth_um || 0) >= 100 &&
    (c.zones || []).some((z: any) => z.morph_regime === 'stepped_macro'));

describe('directional face-step tag (central-distance arc)', () => {
  it('DORMANT for scenarios that did not opt in — a non-opted calcite scenario tags nothing', () => {
    const sim = run('marble_contact_metamorphism');   // grows calcite, no directional_steps flag
    expect(sim).toBeTruthy();
    expect(faceStepped(sim).length).toBe(0);
  });

  it('the tag is ABSENT (undefined) on untagged crystals — no serialized output widens', () => {
    const sim = run('marble_contact_metamorphism');
    expect(sim).toBeTruthy();
    for (const c of sim.crystals) expect(c._faceStep).toBeUndefined();
  });

  it('Phase 1: elmwood (wall.directional_steps) tags its stepped calcite, steppedFaceSet up', () => {
    const sim = run('elmwood');
    expect(sim).toBeTruthy();
    const tagged = faceStepped(sim);
    expect(tagged.length).toBeGreaterThan(0);          // the golden scalenohedral calcite
    for (const c of tagged) {
      expect(c.mineral).toBe('calcite');               // only calcite is tagged
      expect(c._faceStep.steppedFaceSet).toBe('up');
      expect(c._faceStep.atStep).toBe(c.nucleation_step);
    }
    // every tagged crystal is genuinely a stepped-macro calcite (the relief is real)
    const stepped = steppedCalcite(sim);
    for (const c of tagged) expect(stepped.indexOf(c) >= 0).toBe(true);
  });
});
