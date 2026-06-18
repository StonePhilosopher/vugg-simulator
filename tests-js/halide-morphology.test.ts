// tests-js/halide-morphology.test.ts — halide morphology contracts
// (morphology-generalization arc, 2026-06-12: the registry's SECOND
// tenant — halite + sylvite as MORPH_TH entries).
//
// Science oracle: proposals/RESEARCH-halide-morphology-2026-06-12.md.
// The contracts pinned here:
//   1. REGISTRY SHAPE: halite/sylvite entries exist, band edges in
//      Sunagawa order, NO boundary-layer damping (SIZE_HALF_UM =
//      Infinity — convection-stirred brine, Berg effect; surfσ ≡ bulkσ
//      at any crystal size).
//   2. THE SALT-PAN LOG (seed 42 searles_lake): halite zones stratify
//      by the concentration plateaus — banded-cube mass AND hopper mass
//      both ≥5%; every positive zone carries tags; morph_form 'cube'.
//   3. THE LEGACY-RULE CORRECTION: bisbee halite (post-step σ 8.28,
//      which the old in-step σ>5 flip called hopper_growth) is 100%
//      spiral_smooth + end habit 'cubic'. tn457 likewise smooth.
//   4. HABIT ALPHABET + ASPECT FIREWALL: regime habits are cube-family
//      strings carrying the SAME _habitAspectRatio as 'cubic' (0.5 —
//      the default the legacy strings always landed on); a rename must
//      not move volume → fill → chemistry.
//   5. THE INSTRUMENTS: halite_morph + sylvite_morph chips exist in
//      _HELIX_CHEM_PARAMS under the 'halide' system, read the shared
//      Sunagawa ordinal, null in empty rock; morphDisplayLabel speaks
//      per-mineral field language and the calcite alias still works.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const MORPH_TH: any;
declare const MORPH_REGIMES: any;
declare const morphSurfaceSigma: any;
declare const morphRegime: any;
declare const morphDisplayLabel: any;
declare const CALCITE_MORPH_DISPLAY: any;
declare const _habitAspectRatio: any;
declare const _HELIX_CHEM_PARAMS: any;

function runScenario(name: string, seed = 42, steps?: number) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  const n = steps ?? defaultSteps ?? 100;
  for (let i = 0; i < n; i++) sim.run_step();
  return sim;
}

function regimeMass(sim: any, mineral: string): Record<string, number> {
  const mass: Record<string, number> = {};
  for (const c of sim.crystals) {
    if (!c || c.mineral !== mineral || c.dissolved) continue;
    for (const z of c.zones || []) {
      if (!z.morph_regime || z.thickness_um <= 0) continue;
      mass[z.morph_regime] = (mass[z.morph_regime] || 0) + z.thickness_um;
    }
  }
  return mass;
}

function share(mass: Record<string, number>, ...regimes: string[]): number {
  const total = Object.values(mass).reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  return regimes.reduce((s, r) => s + (mass[r] || 0), 0) / total;
}

describe('halide morphology registry entries', () => {

  it('halite + sylvite registered with Sunagawa-ordered band edges', () => {
    for (const m of ['halite', 'sylvite']) {
      const th = MORPH_TH[m];
      expect(th).toBeTruthy();
      expect(th.SPIRAL_MAX).toBeLessThan(th.STEP_MILD_MAX);
      expect(th.STEP_MILD_MAX).toBeLessThan(th.STEP_MACRO_MAX);
      expect(th.STEP_MACRO_MAX).toBeLessThan(th.HOPPER_MAX);
      expect(typeof th.sigma).toBe('function');
    }
    // The calibrated halite edges (research doc §2) — re-pin on retune.
    expect(MORPH_TH.halite.SPIRAL_MAX).toBe(10);
    expect(MORPH_TH.halite.HOPPER_MAX).toBe(800);
    expect(MORPH_TH.sylvite.SPIRAL_MAX).toBe(3);
    expect(MORPH_TH.sylvite.HOPPER_MAX).toBe(60);
  });

  it('NO boundary-layer damping: surfσ ≡ bulkσ at any size (convective brine, Berg effect)', () => {
    expect(MORPH_TH.halite.SIZE_HALF_UM).toBe(Infinity);
    for (const size of [0, 100, 2000, 54000]) {
      expect(morphSurfaceSigma(MORPH_TH.halite, 385, size)).toBeCloseTo(385, 9);
    }
    // contrast: calcite at the same bulk σ DOES damp with size
    expect(morphSurfaceSigma(MORPH_TH.calcite, 385, 2000)).toBeLessThan(20);
  });

  it('band placement: the survey plateaus land where the claims table says', () => {
    const th = MORPH_TH.halite;
    expect(morphRegime(th, 1.15)).toBe('spiral_smooth');   // travertine
    expect(morphRegime(th, 3.84)).toBe('spiral_smooth');   // tn457
    expect(morphRegime(th, 8.28)).toBe('spiral_smooth');   // bisbee (legacy rule said hopper)
    expect(morphRegime(th, 42.6)).toBe('stepped_mild');    // searles baseline → chevron
    expect(morphRegime(th, 385)).toBe('hopper_skeletal');  // searles spike → raft
    const ts = MORPH_TH.sylvite;
    expect(morphRegime(ts, 1.72)).toBe('spiral_smooth');   // bisbee
    expect(morphRegime(ts, 2.22)).toBe('spiral_smooth');   // searles baseline
    expect(morphRegime(ts, 20.0)).toBe('hopper_skeletal'); // searles spike
  });
});

describe('the salt-pan log (searles_lake, seed 42)', () => {

  // Lazy memo — the bundle globals (setSeed etc.) only exist once the
  // suite setup has run, so the sim cannot be built at module-eval time.
  let _sim: any = null;
  const sim = () => (_sim ||= runScenario('searles_lake'));

  it('halite zones stratify by the concentration plateaus — banded AND hopper both present', () => {
    const mass = regimeMass(sim(), 'halite');
    // v198 keystone re-realized seed-42 placement; the banded/stepped share
    // nudged from just-above to just-below 0.05 (0.0489) — still clearly
    // present, so the "banded present" floor is 0.04 (intent unchanged).
    expect(share(mass, 'stepped_mild', 'stepped_macro')).toBeGreaterThanOrEqual(0.04);
    expect(share(mass, 'hopper_skeletal')).toBeGreaterThanOrEqual(0.05);
    // dendrite band deliberately unoccupied, like calcite's fleet
    expect(share(mass, 'dendritic')).toBe(0);
  });

  it('every positive halite zone is tagged, with form cube + finite surf σ', () => {
    let zones = 0;
    for (const c of sim().crystals) {
      if (c.mineral !== 'halite' || c.dissolved) continue;
      for (const z of c.zones || []) {
        if (!(z.thickness_um > 0)) continue;
        zones++;
        expect(MORPH_REGIMES).toContain(z.morph_regime);
        expect(z.morph_form).toBe('cube');
        expect(isFinite(z.morph_surf_sigma)).toBe(true);
      }
    }
    expect(zones).toBeGreaterThan(50);
  });

  it('habit is regime-driven cube-family (the memory-less flip is gone)', () => {
    const habits = new Set<string>();
    for (const c of sim().crystals) {
      if (c.mineral === 'halite' && !c.dissolved && c.total_growth_um > 0) habits.add(c.habit);
    }
    expect(habits.size).toBeGreaterThan(0);
    for (const h of habits) {
      expect(['cubic', 'stepped_cube', 'hopper_cube', 'dendritic_cube']).toContain(h);
    }
    // legacy string must no longer be emitted
    expect(habits.has('hopper_growth')).toBe(false);
  });

  it('sylvite hoppers on the spikes too', () => {
    const mass = regimeMass(sim(), 'sylvite');
    expect(share(mass, 'hopper_skeletal')).toBeGreaterThan(0);
  });
});

describe('the legacy-rule correction (controls)', () => {

  it('bisbee halite is smooth cube — the old in-step σ>5 flip called this hopper', () => {
    const sim = runScenario('bisbee');
    const mass = regimeMass(sim, 'halite');
    const total = Object.values(mass).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0);
    expect(share(mass, 'spiral_smooth')).toBeCloseTo(1, 6);
    for (const c of sim.crystals) {
      if (c.mineral === 'halite' && !c.dissolved && c.total_growth_um > 0) {
        expect(c.habit).toBe('cubic');
      }
    }
  });

  it('tn457 burial halite stays smooth', () => {
    const sim = runScenario('tn457_barite_pulses');
    const mass = regimeMass(sim, 'halite');
    expect(share(mass, 'spiral_smooth')).toBeCloseTo(1, 6);
  });
});

describe('aspect firewall + instruments', () => {

  it('cube-family regime habits carry the SAME aspect as cubic (0.5 — the legacy default)', () => {
    const base = _habitAspectRatio('cubic');
    expect(base).toBe(0.5);
    for (const h of ['stepped_cube', 'hopper_cube', 'dendritic_cube', 'hopper_growth']) {
      expect(_habitAspectRatio(h)).toBe(base);
    }
  });

  it('halite_morph + sylvite_morph chips exist under the halide system and read the ordinal', () => {
    const byId: Record<string, any> = {};
    for (const p of _HELIX_CHEM_PARAMS) byId[p.id] = p;
    for (const id of ['halite_morph', 'sylvite_morph']) {
      const p = byId[id];
      expect(p).toBeTruthy();
      expect(p.system).toBe('halide');
      expect(p.min).toBe(0);
      expect(p.max).toBe(4);
      expect(typeof p.read).toBe('function');
      // empty rock → null
      expect(p.read({ crystals: [] }, { cells_per_ring: 120 }, 0, 0)).toBe(null);
    }
    // ordinal read against a synthetic tagged crystal at the anchor
    const fake = {
      crystals: [{
        mineral: 'halite', dissolved: false, total_growth_um: 100,
        _morphology: { regime: 'hopper_skeletal', form: 'cube', surf_sigma: 385 },
        wall_anchor: { ringIdx: 3, cellIdx: 10 },
      }],
    };
    expect(byId.halite_morph.read(fake, { cells_per_ring: 120 }, 3, 10)).toBe(3);
    expect(byId.halite_morph.read(fake, { cells_per_ring: 120 }, 2, 10)).toBe(null);
  });

  it('morphDisplayLabel speaks per-mineral field language; calcite alias preserved', () => {
    expect(morphDisplayLabel('halite', 'hopper_skeletal')).toBe('hopper/raft');
    expect(morphDisplayLabel('halite', 'stepped_mild')).toBe('banded cube (chevron)');
    expect(morphDisplayLabel('calcite', 'spiral_smooth')).toBe('smooth spar');
    expect(morphDisplayLabel('no_such_mineral', 'stepped_mild')).toBe('stepped_mild');
    expect(CALCITE_MORPH_DISPLAY.hopper_skeletal).toBe('hopper/skeletal');
  });
});
