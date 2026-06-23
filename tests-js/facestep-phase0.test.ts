// tests-js/facestep-phase0.test.ts — DIRECTIONAL stepped growth, Phase 0 of the
// central-distance arc (2026-06-22; proposals/PROPOSAL-DIRECTIONAL-GROWTH-2026-06-22.md).
//
// Phase 0 lays the rails for per-face-aware morphology: a crystal-level _faceStep
// render tag (set by js/45 classifyFaceStep) that marks macrostep relief belonging
// to ONE face-set (calcite {104} obtuse/acute anisotropy — calcite is centrosymmetric
// so this is ENVIRONMENTAL + surface-step anisotropy, NOT polarity). Phase 0 ships the
// tag + classifier + cache-sig discriminator only; the one-sided render carve is Phase 1.
//
// The classifier is GATED on wall.directional_steps, which NO scenario sets yet → the
// tag is dormant across the whole fleet → byte-identical, SIM-neutral (the
// saddle-dolomite / sector-zoning precedent; cold-ci's calibration baseline is the
// hard byte-identity gate). These pins assert (1) dormancy — nothing is tagged with no
// opt-in; (2) the field stays absent (undefined) on untagged crystals so no serialized
// output widens; (3) the classifier WORKS when the flag is injected — it tags exactly
// the stepped calcite — so Phase 1 can rely on it.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

function build(scenarioName: string, opts: { directionalSteps?: boolean } = {}, seed = 42) {
  setSeed(seed);
  const scen = SCENARIOS[scenarioName];
  if (!scen) return null;
  const { conditions, events, defaultSteps } = scen();
  const sim = new VugSimulator(conditions, events);
  // Test-only opt-in: flip the wall flag the classifier gates on. No committed
  // scenario sets this in Phase 0 — this proves the gate works both ways.
  if (opts.directionalSteps && sim.conditions && sim.conditions.wall) {
    sim.conditions.wall.directional_steps = true;
  }
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

describe('directional face-step tag — Phase 0 (central-distance arc)', () => {
  it('is DORMANT: no scenario opts in → no crystal is face-step tagged (byte-identical fleet)', () => {
    for (const name of ['elmwood', 'great_salt_plains']) {
      const sim = build(name);
      expect(sim).toBeTruthy();
      expect(faceStepped(sim).length).toBe(0);
    }
  });

  it('the tag is ABSENT (undefined) on untagged crystals — no serialized output widens', () => {
    const sim = build('elmwood');
    expect(sim).toBeTruthy();
    for (const c of sim.crystals) expect(c._faceStep).toBeUndefined();
  });

  it('when opted in, it tags EXACTLY the stepped calcite (proves Phase 1 can rely on it)', () => {
    const sim = build('elmwood', { directionalSteps: true });
    expect(sim).toBeTruthy();
    const stepped = steppedCalcite(sim);
    expect(stepped.length).toBeGreaterThan(0);          // elmwood is the stepped-calcite showcase
    for (const c of stepped) {
      expect(!!c._faceStep).toBe(true);
      expect(c._faceStep.steppedFaceSet).toBe('up');
      expect(c._faceStep.atStep).toBe(c.nucleation_step);
    }
    // nothing that ISN'T calcite gets tagged
    for (const c of faceStepped(sim)) expect(c.mineral).toBe('calcite');
  });
});
