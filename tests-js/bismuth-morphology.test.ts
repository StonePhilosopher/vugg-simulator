// tests-js/bismuth-morphology.test.ts — native bismuth morphology
// contracts (morphology-generalization arc, tenant three, 2026-06-12;
// SIM 188 — the rng-cascade bump commit).
//
// Science oracle: proposals/RESEARCH-bismuth-morphology-2026-06-12.md.
// Contracts pinned:
//   1. REGISTRY SHAPE: Sunagawa-ordered bands inside Bi's structurally
//      capped σ scale (≤~4.5); no damping.
//   2. THE CORRECTED LADDER (anti-Sunagawa regression pin): the old
//      dispatch put massive at TOP σ and dendrite at the BOTTOM. Now:
//      smooth-band → massive default + rare rhombohedral dice-roll;
//      dendrite at the TOP. Each regime branch pinned via direct
//      grow_native_bismuth calls with stub conditions.
//   3. SCHNEEBERG TRUTH (seed 42): Bi nucleates on the reducing
//      plateau, zones tag spiral_smooth (σ ≤ 1.32), and the v185
//      oxidation swing then DESTROYS it — both halves correct geology.
//      Upper bands stay unoccupied until `wittichen` lands.
//   4. ASPECT FIREWALL + INSTRUMENTS: new habit strings carry the
//      legacy default 0.5; bismuth_morph chip under the new 'native'
//      legend group; per-mineral display labels.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const MORPH_TH: any;
declare const MORPH_REGIMES: any;
declare const morphRegime: any;
declare const morphSurfaceSigma: any;
declare const morphDisplayLabel: any;
declare const _habitAspectRatio: any;
declare const _HELIX_CHEM_PARAMS: any;
declare const grow_native_bismuth: any;
declare const Crystal: any;

function runScenario(name: string, seed = 42, steps?: number) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  const n = steps ?? defaultSteps ?? 100;
  for (let i = 0; i < n; i++) sim.run_step();
  return sim;
}

// Minimal conditions stub for direct grow_* calls: the dispatch reads
// supersaturation_native_bismuth(), temperature, and fluid.Bi.
function stubConditions(sigma: number) {
  return {
    temperature: 150,
    fluid: { Bi: 50, S: 0, O2: 0, pH: 6.5 },
    supersaturation_native_bismuth() { return sigma; },
  };
}

describe('bismuth morphology registry (tenant three)', () => {

  it('Sunagawa-ordered bands inside the capped σ scale, no damping', () => {
    const th = MORPH_TH.native_bismuth;
    expect(th).toBeTruthy();
    expect(th.SPIRAL_MAX).toBeLessThan(th.STEP_MILD_MAX);
    expect(th.STEP_MILD_MAX).toBeLessThan(th.STEP_MACRO_MAX);
    expect(th.STEP_MACRO_MAX).toBeLessThan(th.HOPPER_MAX);
    // the whole ladder fits under the structural cap (~4.5, js/36)
    expect(th.HOPPER_MAX).toBeLessThan(4.5);
    expect(th.SIZE_HALF_UM).toBe(Infinity);
    expect(morphSurfaceSigma(th, 4.2, 50000)).toBeCloseTo(4.2, 9);
  });

  it('band placement: fleet truth + the shock band', () => {
    const th = MORPH_TH.native_bismuth;
    expect(morphRegime(th, 1.32)).toBe('spiral_smooth');   // schneeberg plateau max
    expect(morphRegime(th, 2.0)).toBe('stepped_mild');     // feathery
    expect(morphRegime(th, 2.6)).toBe('stepped_macro');    // feather/skeletal
    expect(morphRegime(th, 3.4)).toBe('hopper_skeletal');  // melt territory
    expect(morphRegime(th, 4.2)).toBe('dendritic');        // the reduction shock
  });
});

describe('the corrected ladder (anti-Sunagawa regression pin)', () => {

  it('dendritic regime → arborescent habit (the OLD code put dendrite at the BOTTOM)', () => {
    setSeed(1234);
    const c = new Crystal({ mineral: 'native_bismuth', crystal_id: 9001, habit: 'massive_granular' });
    c._morphology = { regime: 'dendritic', form: 'native', surf_sigma: 4.2 };
    const z = grow_native_bismuth(c, stubConditions(4.2), 10);
    expect(z).toBeTruthy();
    expect(c.habit).toBe('arborescent_dendritic');
  });

  it('stepped regimes → feathery; hopper → skeletal', () => {
    setSeed(1234);
    const c1 = new Crystal({ mineral: 'native_bismuth', crystal_id: 9002 });
    c1._morphology = { regime: 'stepped_mild', form: 'native', surf_sigma: 2.0 };
    grow_native_bismuth(c1, stubConditions(2.0), 10);
    expect(c1.habit).toBe('feathery_bismuth');
    const c2 = new Crystal({ mineral: 'native_bismuth', crystal_id: 9003 });
    c2._morphology = { regime: 'hopper_skeletal', form: 'native', surf_sigma: 3.4 };
    grow_native_bismuth(c2, stubConditions(3.4), 10);
    expect(c2.habit).toBe('skeletal_bismuth');
  });

  it('smooth band → massive default with the rare rhombohedral dice-roll (the OLD code put massive at TOP σ)', () => {
    setSeed(77);
    const habits = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const c = new Crystal({ mineral: 'native_bismuth', crystal_id: 9100 + i });
      c._morphology = { regime: 'spiral_smooth', form: 'native', surf_sigma: 1.2 };
      grow_native_bismuth(c, stubConditions(1.2), 10);
      habits.add(c.habit);
    }
    // both outcomes occur, massive dominant (dice ~10%)
    expect(habits.has('massive_granular')).toBe(true);
    expect(habits.has('rhombohedral_crystal')).toBe(true);
    expect(habits.size).toBe(2);
  });
});

describe('schneeberg truth (seed 42) — grows on the plateau, dies in the swing', () => {

  it('Bi nucleates, tags smooth-band zones, and is destroyed by oxidation', () => {
    const sim = runScenario('schneeberg');
    const bi = sim.crystals.filter((c: any) => c.mineral === 'native_bismuth');
    expect(bi.length).toBeGreaterThan(0);
    // the weathering stage destroys it — correct geology, pinned
    expect(bi.filter((c: any) => !c.dissolved).length).toBe(0);
    // every positive zone that was classified sits in the SMOOTH band
    // (plateau σ ≤ 1.32 — upper bands unoccupied until wittichen)
    for (const c of bi) {
      for (const z of c.zones || []) {
        if (!(z.thickness_um > 0) || !z.morph_regime) continue;
        expect(z.morph_regime).toBe('spiral_smooth');
        expect(z.morph_form).toBe('native');
      }
    }
  });
});

describe('aspect firewall + instruments', () => {

  it('new habit strings carry the legacy default aspect (0.5)', () => {
    for (const h of ['feathery_bismuth', 'skeletal_bismuth', 'massive_granular', 'arborescent_dendritic', 'rhombohedral_crystal']) {
      expect(_habitAspectRatio(h)).toBe(0.5);
    }
  });

  it('bismuth_morph chip exists under the native legend group and reads the ordinal', () => {
    const p = _HELIX_CHEM_PARAMS.find((x: any) => x.id === 'bismuth_morph');
    expect(p).toBeTruthy();
    expect(p.system).toBe('native');
    const fake = {
      crystals: [{
        mineral: 'native_bismuth', dissolved: false, total_growth_um: 100,
        _morphology: { regime: 'dendritic', form: 'native', surf_sigma: 4.2 },
        wall_anchor: { ringIdx: 5, cellIdx: 50 },
      }],
    };
    expect(p.read(fake, { cells_per_ring: 120 }, 5, 50)).toBe(4);
    expect(p.read({ crystals: [] }, { cells_per_ring: 120 }, 0, 0)).toBe(null);
  });

  it('display labels speak bismuth field language', () => {
    expect(morphDisplayLabel('native_bismuth', 'dendritic')).toBe('arborescent dendrite');
    expect(morphDisplayLabel('native_bismuth', 'spiral_smooth')).toBe('massive/foliated');
    expect(morphDisplayLabel('native_bismuth', 'stepped_macro')).toBe('feather bismuth (skeletal)');
  });
});
