// tests-js/native-metal-morphology.test.ts — native copper + gold
// morphology contracts (morphology-generalization arc, sixth/seventh
// tenants — the conflation sweep that closes the boss's list,
// 2026-06-12; sim-neutral: no rng in either habit branch).
//
// Contracts:
//   1. registry shapes + the measured band placements (copper bands on
//      bisbee's −400 pulse ramp, peak 2.09; gold on its 2.77 plateau)
//   2. THE CONFLATION FIX: nugget and massive_sheet retired from
//      σ-dispatch (placer/fissure-fill TEXTURES, not growth
//      morphology) — bisbee gold reads spongy/dendritic, the σ-top
//      copper band is the arborescent tree
//   3. THE CAST STORY: bisbee's copper grows on the pulse, records
//      dendritic mass, and dissolves into the azurite era — the
//      Cornish tree survives as a tagged cast
//   4. chips under the native group

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const MORPH_TH: any;
declare const morphRegime: any;
declare const _HELIX_CHEM_PARAMS: any;

function runScenario(name: string, seed = 42, steps?: number) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  const n = steps ?? defaultSteps ?? 320;
  for (let i = 0; i < n; i++) sim.run_step();
  return sim;
}

describe('native copper + gold morphology (the conflation sweep)', () => {

  let _bisbee: any = null;
  const bisbee = () => (_bisbee ||= runScenario('bisbee'));

  it('registries: Sunagawa-ordered bands on the measured trajectories', () => {
    for (const m of ['native_copper', 'native_gold']) {
      const th = MORPH_TH[m];
      expect(th).toBeTruthy();
      expect(th.SPIRAL_MAX).toBeLessThan(th.STEP_MILD_MAX);
      expect(th.STEP_MILD_MAX).toBeLessThan(th.STEP_MACRO_MAX);
      expect(th.STEP_MACRO_MAX).toBeLessThan(th.HOPPER_MAX);
    }
    // copper: the −400 pulse peak (2.09 measured) is the dendrite moment
    expect(morphRegime(MORPH_TH.native_copper, 2.09)).toBe('dendritic');
    expect(morphRegime(MORPH_TH.native_copper, 1.5)).toBe('stepped_mild');   // wire
    // gold: bisbee plateau dendritic/fishbone; porphyry octahedral
    expect(morphRegime(MORPH_TH.native_gold, 2.77)).toBe('stepped_macro');
    expect(morphRegime(MORPH_TH.native_gold, 1.35)).toBe('spiral_smooth');
  });

  it('THE CAST STORY: bisbee copper records dendritic mass on the pulse, then dissolves', () => {
    const cu = bisbee().crystals.filter((c: any) => c.mineral === 'native_copper' && c.total_growth_um > 0);
    expect(cu.length).toBeGreaterThanOrEqual(1);
    // the azurite era eats the trees — they survive as tagged casts
    expect(cu.every((c: any) => c.dissolved)).toBe(true);
    let dendr = 0, tot = 0;
    for (const c of cu) for (const z of c.zones || []) {
      if (z.thickness_um > 0 && z.morph_regime) { tot += z.thickness_um; if (z.morph_regime === 'dendritic' || z.morph_regime === 'hopper_skeletal') dendr += z.thickness_um; }
    }
    expect(tot).toBeGreaterThan(0);
    expect(dendr / tot).toBeGreaterThanOrEqual(0.25);
  });

  it('THE CONFLATION FIX: bisbee gold is spongy/dendritic, never nugget; the legacy texture strings are retired from dispatch', () => {
    const au = bisbee().crystals.filter((c: any) => c.mineral === 'native_gold' && !c.dissolved && c.total_growth_um > 0);
    expect(au.length).toBeGreaterThanOrEqual(1);
    for (const c of au) {
      expect(['dendritic', 'octahedral']).toContain(c.habit);
      expect(c.habit).not.toBe('nugget');
    }
    const cu = bisbee().crystals.filter((c: any) => c.mineral === 'native_copper' && c.total_growth_um > 0);
    for (const c of cu) expect(c.habit).not.toBe('massive_sheet');
  });

  it('porphyry gold stays the rare octahedral inclusion (the correct legacy bottom band, preserved)', () => {
    const sim = runScenario('porphyry');
    const au = sim.crystals.filter((c: any) => c.mineral === 'native_gold' && !c.dissolved && c.total_growth_um > 0);
    expect(au.length).toBeGreaterThanOrEqual(1);
    for (const c of au) expect(c.habit).toBe('octahedral');
  });

  it('copper_morph + gold_morph chips complete the native legend group', () => {
    for (const id of ['copper_morph', 'gold_morph']) {
      const p = _HELIX_CHEM_PARAMS.find((x: any) => x.id === id);
      expect(p).toBeTruthy();
      expect(p.system).toBe('native');
    }
  });
});
