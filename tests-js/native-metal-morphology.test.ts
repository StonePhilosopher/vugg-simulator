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
//   3. THE COPPER STORY: bisbee's copper grows on the pulse, records
//      stepped mass, and preserves a smooth terminal shell; any later cast
//      claim must be earned by an actual dissolution/enclosure receipt
//   4. chips under the native group

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const MORPH_TH: any;
declare const morphRegime: any;
declare const morphDisplayLabel: any;
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

  it('the Bisbee pulse grows stepped copper and wanes to a smooth, still-exposed termination', () => {
    const cu = bisbee().crystals.filter((c: any) => c.mineral === 'native_copper' && c.total_growth_um > 0);
    expect(cu.length).toBeGreaterThanOrEqual(1);
    // SIM 272 preserves the positive Cu core but records neither a negative
    // dissolution shell nor an enclosing child at seed 42. Do not narrate a
    // cast until those physical receipts actually exist.
    expect(cu.every((c: any) => !c.dissolved)).toBe(true);
    expect(cu.every((c: any) => c.enclosed_by == null)).toBe(true);
    expect(cu.every((c: any) => c.zones.every((z: any) => z.thickness_um >= 0))).toBe(true);
    let stepped = 0, tot = 0;
    for (const c of cu) for (const z of c.zones || []) {
      if (z.thickness_um > 0 && z.morph_regime) {
        tot += z.thickness_um;
        if (z.morph_regime === 'stepped_mild' || z.morph_regime === 'stepped_macro') stepped += z.thickness_um;
      }
    }
    expect(tot).toBeGreaterThan(0);
    expect(stepped / tot).toBeGreaterThan(0.8);
    for (const c of cu) {
      const positive = c.zones.filter((z: any) => z.thickness_um > 0);
      expect(positive.at(-1)?.morph_regime).toBe('spiral_smooth');
      // `habit` describes the exposed terminal form; the zone ledger above
      // retains the much larger stepped/arborescent pulse beneath it.
      expect(c.habit).toBe('cubic_dodecahedral');
    }
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

  it('porphyry gold remains aspirational while its low-saturation habit stays octahedral', () => {
    const sim = runScenario('porphyry');
    const au = sim.crystals.filter((c: any) => c.mineral === 'native_gold' && !c.dissolved && c.total_growth_um > 0);
    // Bingham gold is documented, but the canonical path does not yet build
    // the required bornite-bearing substrate after its copper pulse.  Do not
    // turn that aspirational locality claim into a deterministic test fixture.
    expect(au).toHaveLength(0);
    expect(
      SCENARIOS.porphyry._json5_spec.aspirational_species
        .some((entry: any) => entry.mineral === 'native_gold'),
    ).toBe(true);

    // Keep the independent morphology contract: if a future causal path
    // produces native gold at Bingham's measured low-saturation band, the
    // shared morphology registry identifies a rare octahedral crystal.
    const regime = morphRegime(MORPH_TH.native_gold, 1.35);
    expect(regime).toBe('spiral_smooth');
    expect(morphDisplayLabel('native_gold', regime)).toBe('octahedral (rare crystal)');
  });

  it('copper_morph + gold_morph chips complete the native legend group', () => {
    for (const id of ['copper_morph', 'gold_morph']) {
      const p = _HELIX_CHEM_PARAMS.find((x: any) => x.id === id);
      expect(p).toBeTruthy();
      expect(p.system).toBe('native');
    }
  });
});
