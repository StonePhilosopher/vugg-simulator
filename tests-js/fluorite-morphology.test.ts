// tests-js/fluorite-morphology.test.ts — fluorite morphology contracts
// (morphology-generalization arc, FOURTH tenant, 2026-06-12 —
// sim-neutral: no rng in the habit branch, shared cube alphabet).
//
// Contracts pinned:
//   1. REGISTRY SHAPE: Sunagawa-ordered bands on the survey plateaus
//      (no damping — fluorite's fleet range is 1.25–7.16).
//   2. THE CLAIMS TABLE: mvt 4.96 stays GLASSY (just under the 5.0
//      edge — the Tri-State guard), elmwood pulses 5.94 → banded,
//      reactivated vein 7.15 → composite/stepped.
//   3. THE TWO-MINERAL SHOWCASE (elmwood, seed 42): fluorite carries
//      BOTH smooth and banded zone mass — the same fault-valve beats
//      that step the calcite zone the purple cubes.
//   4. THE REE COMPOSE: sunnyside fluorite keeps octahedral_REE habit
//      + morph_form 'octahedron' (form beats roughness; the v103 Y
//      rule outranks the regime alphabet).
//   5. INSTRUMENTS: fluorite_morph chip ('halide' system), display.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const MORPH_TH: any;
declare const morphRegime: any;
declare const morphDisplayLabel: any;
declare const halideTerraceBands: any;
declare const _HELIX_CHEM_PARAMS: any;

function runScenario(name: string, seed = 42, steps?: number) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  const n = steps ?? defaultSteps ?? 120;
  for (let i = 0; i < n; i++) sim.run_step();
  return sim;
}

function fluoriteMass(sim: any): { mass: Record<string, number>, total: number } {
  const mass: Record<string, number> = {};
  let total = 0;
  for (const c of sim.crystals) {
    if (!c || c.mineral !== 'fluorite' || c.dissolved) continue;
    for (const z of c.zones || []) {
      if (!(z.thickness_um > 0) || !z.morph_regime) continue;
      mass[z.morph_regime] = (mass[z.morph_regime] || 0) + z.thickness_um;
      total += z.thickness_um;
    }
  }
  return { mass, total };
}

describe('fluorite morphology registry (fourth tenant)', () => {

  it('Sunagawa-ordered bands, no damping, survey-plateau placement', () => {
    const th = MORPH_TH.fluorite;
    expect(th).toBeTruthy();
    expect(th.SPIRAL_MAX).toBeLessThan(th.STEP_MILD_MAX);
    expect(th.STEP_MILD_MAX).toBeLessThan(th.STEP_MACRO_MAX);
    expect(th.STEP_MACRO_MAX).toBeLessThan(th.HOPPER_MAX);
    expect(th.SIZE_HALF_UM).toBe(Infinity);
    // the claims table in band form
    expect(morphRegime(th, 4.96)).toBe('spiral_smooth');   // mvt — Tri-State glassy guard
    expect(morphRegime(th, 5.94)).toBe('stepped_mild');    // elmwood fault-valve plateau
    expect(morphRegime(th, 7.15)).toBe('stepped_macro');   // reactivated vein — composite faces
    expect(morphRegime(th, 1.95)).toBe('spiral_smooth');   // sunnyside
  });

  it('mvt fluorite stays glassy (100% smooth at seed 42)', () => {
    const { mass, total } = fluoriteMass(runScenario('mvt'));
    expect(total).toBeGreaterThan(0);
    expect((mass.spiral_smooth || 0) / total).toBeCloseTo(1, 6);
  });

  it('THE TWO-MINERAL SHOWCASE: elmwood fluorite is zoned smooth↔banded by the fault-valve pulses', () => {
    const { mass, total } = fluoriteMass(runScenario('elmwood'));
    expect(total).toBeGreaterThan(0);
    const banded = ((mass.stepped_mild || 0) + (mass.stepped_macro || 0)) / total;
    expect(banded).toBeGreaterThanOrEqual(0.2);
    expect((mass.spiral_smooth || 0) / total).toBeGreaterThanOrEqual(0.2);
  });

  it('reactivated vein fluorite is composite/stepped-dominant', () => {
    const sim = runScenario('reactivated_fluorite_vein');
    const { mass, total } = fluoriteMass(sim);
    expect(total).toBeGreaterThan(0);
    expect((mass.stepped_macro || 0) / total).toBeGreaterThanOrEqual(0.5);
    // and the terrace walk yields render bands for the cube ziggurat
    const fl = sim.crystals.find((c: any) => c.mineral === 'fluorite' && !c.dissolved);
    const terr = halideTerraceBands(fl, null);
    expect(terr).toBeTruthy();
    expect(terr.form).toBe('cube');
    expect(terr.knots.length).toBeGreaterThanOrEqual(1);
  });

  it('THE REE COMPOSE: sunnyside fluorite keeps its octahedron (form beats roughness)', () => {
    const sim = runScenario('sunnyside_american_tunnel');
    const fl = sim.crystals.filter((c: any) => c.mineral === 'fluorite' && !c.dissolved && c.total_growth_um > 0);
    expect(fl.length).toBeGreaterThan(0);
    for (const c of fl) {
      expect(c.habit).toBe('octahedral_REE');
      const tagged = (c.zones || []).find((z: any) => z.morph_form);
      expect(tagged.morph_form).toBe('octahedron');
    }
  });

  it('fluorite_morph chip exists under the halide system; display speaks fluorite', () => {
    const p = _HELIX_CHEM_PARAMS.find((x: any) => x.id === 'fluorite_morph');
    expect(p).toBeTruthy();
    expect(p.system).toBe('halide');
    expect(morphDisplayLabel('fluorite', 'stepped_macro')).toBe('composite/stepped cube');
    expect(morphDisplayLabel('fluorite', 'spiral_smooth')).toBe('glassy cube');
  });
});
