// tests-js/pyrite-morphology.test.ts — pyrite morphology contracts
// (morphology-generalization arc, FIFTH tenant, 2026-06-12 —
// sim-neutral striation overlay; form stays T-driven).
//
// Striations on pyrite faces ARE bunched growth steps (Murowchick &
// Barnes 1987) — the regime ladder names the intensity. Contracts:
//   1. registry shape + survey band placement
//   2. the zoned fleet picture (continuous σ → mixed crystals)
//   3. the overlay composes with the T-form dispatch (striated_ keeps
//      the parent form; framboids untouched)
//   4. aspect firewall + chip (the new 'sulfide' legend group)

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const Crystal: any;
declare const GrowthZone: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const MORPH_TH: any;
declare const morphRegime: any;
declare const classifyMorphologyStep: any;
declare const StripRecorder: any;
declare const stripSerialize: any;
declare const stripDeserialize: any;
declare const buildCrystalRecord: any;
declare const morphDisplayLabel: any;
declare const _habitAspectRatio: any;
declare const _habitGeomToken: any;
declare const _HELIX_CHEM_PARAMS: any;

function runScenario(name: string, seed = 42, steps?: number) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  const n = steps ?? defaultSteps ?? 120;
  for (let i = 0; i < n; i++) sim.run_step();
  return sim;
}

const REGIMES = new Set([
  'spiral_smooth', 'stepped_mild', 'stepped_macro',
  'hopper_skeletal', 'dendritic',
]);

function pyriteTestimony(sim: any) {
  const mass: Record<string, number> = {};
  let total = 0;
  let tagged = 0;
  const rows: any[] = [];
  for (const c of sim.crystals) {
    if (!c || c.mineral !== 'pyrite') continue;
    for (const z of c.zones || []) {
      if (!(z.thickness_um > 0)) continue;
      rows.push({ crystal: c, zone: z });
      total += z.thickness_um;
      expect(z.morphology_status, `pyrite step ${z.step}: explicit morphology status`)
        .toBe('classified');
      expect(z.morph_unavailable_reason).toBeNull();
      expect(['post-step', 'post-step-terminal-depleted'], `pyrite step ${z.step}: sample basis`)
        .toContain(z.morph_sigma_basis);
      expect(Number.isFinite(z.morph_post_step_sigma), `pyrite step ${z.step}: finite terminal sigma`)
        .toBe(true);
      expect(Number.isFinite(z.morph_surf_sigma), `pyrite step ${z.step}: finite surface sigma`)
        .toBe(true);
      expect(REGIMES.has(z.morph_regime), `pyrite step ${z.step}: known regime`).toBe(true);
      expect(typeof z.morph_form === 'string' && z.morph_form.length > 0,
        `pyrite step ${z.step}: explicit form`).toBe(true);
      expect(z.morph_regime, `pyrite step ${z.step}: recomputed regime`)
        .toBe(morphRegime(MORPH_TH.pyrite, z.morph_surf_sigma));
      expect(z.morph_sigma_basis === 'post-step-terminal-depleted',
        `pyrite step ${z.step}: depleted-basis truth`).toBe(z.morph_post_step_sigma < 1);
      mass[z.morph_regime] = (mass[z.morph_regime] || 0) + z.thickness_um;
      tagged += z.thickness_um;
    }
  }
  expect(rows.length).toBeGreaterThan(0);
  expect(tagged).toBeCloseTo(total, 12);
  return { mass, total, tagged, rows };
}

function classifySyntheticPyrite(postStepSigma: number, thicknesses = [10], priorMorphology: any = null) {
  const crystal = new Crystal({ mineral: 'pyrite', crystal_id: 1 });
  for (const thickness_um of thicknesses) {
    crystal.add_zone(new GrowthZone({
      step: 1,
      temperature: 150,
      thickness_um,
      growth_rate: thickness_um,
    }));
  }
  if (priorMorphology) crystal._morphology = { ...priorMorphology };
  const sim = {
    step: 1,
    crystals: [crystal],
    wall_state: null,
    conditions: {
      fluid: {},
      temperature: 150,
      supersaturation_pyrite: () => postStepSigma,
    },
  };
  classifyMorphologyStep(sim);
  return { crystal, zones: crystal.zones };
}

describe('pyrite morphology registry (fifth tenant)', () => {

  it('has a complete ordered Sunagawa ladder independent of scenario plateaus', () => {
    const th = MORPH_TH.pyrite;
    expect(th).toBeTruthy();
    expect(th.SPIRAL_MAX).toBeLessThan(th.STEP_MILD_MAX);
    expect(th.STEP_MILD_MAX).toBeLessThan(th.STEP_MACRO_MAX);
    expect(th.STEP_MACRO_MAX).toBeLessThan(th.HOPPER_MAX);
    expect(th.SIZE_HALF_UM).toBe(Infinity);
    const epsilon = 1e-9;
    expect(morphRegime(th, th.SPIRAL_MAX - epsilon)).toBe('spiral_smooth');
    expect(morphRegime(th, (th.SPIRAL_MAX + th.STEP_MILD_MAX) / 2)).toBe('stepped_mild');
    expect(morphRegime(th, (th.STEP_MILD_MAX + th.STEP_MACRO_MAX) / 2)).toBe('stepped_macro');
    expect(morphRegime(th, (th.STEP_MACRO_MAX + th.HOPPER_MAX) / 2)).toBe('hopper_skeletal');
    expect(morphRegime(th, th.HOPPER_MAX)).toBe('dendritic');
  });

  it('records finite terminal depletion instead of silently dropping a positive layer', () => {
    const { zones: [zone] } = classifySyntheticPyrite(0.75);
    expect(zone).toMatchObject({
      morphology_status: 'classified',
      morph_sigma_basis: 'post-step-terminal-depleted',
      morph_post_step_sigma: 0.75,
      morph_regime: 'spiral_smooth',
      morph_form: 'cubo-pyritohedral',
    });
    expect(zone.morph_surf_sigma).toBeCloseTo(0.75, 12);
  });

  it('fails closed with explicit unavailable testimony when the terminal sample is non-finite', () => {
    const prior = {
      status: 'classified',
      sigma_basis: 'post-step',
      post_step_sigma: 8,
      regime: 'dendritic',
      form: 'cube',
      surf_sigma: 8,
    };
    const { crystal, zones: [zone] } = classifySyntheticPyrite(Number.NaN, [10], prior);
    expect(zone).toMatchObject({
      morphology_status: 'unavailable-nonfinite-post-step',
      morph_unavailable_reason: 'nonfinite-post-step-sigma',
      morph_sigma_basis: 'post-step-unavailable',
      morph_post_step_sigma: null,
      morph_regime: null,
      morph_form: null,
      morph_surf_sigma: null,
    });
    expect(crystal._morphology).toEqual({
      status: 'unavailable-nonfinite-post-step',
      unavailable_reason: 'nonfinite-post-step-sigma',
      sigma_basis: 'post-step-unavailable',
      post_step_sigma: null,
      regime: null,
      form: null,
      surf_sigma: null,
    });
  });

  it('classifies every same-step positive shell before a later etch and in a multi-shell stack', () => {
    const etched = classifySyntheticPyrite(1.25, [10, -1]);
    expect(etched.zones[0]).toMatchObject({
      morphology_status: 'classified',
      morph_sigma_basis: 'post-step',
      morph_regime: 'spiral_smooth',
    });
    expect(etched.zones[1].morphology_status).toBeUndefined();

    const doubled = classifySyntheticPyrite(2, [4, 6]);
    expect(doubled.zones).toHaveLength(2);
    expect(doubled.zones.every((zone: any) =>
      zone.morphology_status === 'classified'
      && zone.morph_regime === 'stepped_mild')).toBe(true);

    const dissolved = classifySyntheticPyrite(1.25, [10, -10]);
    expect(dissolved.crystal.dissolved).toBe(true);
    expect(dissolved.zones[0]).toMatchObject({
      morphology_status: 'unavailable-no-surviving-interface',
      morph_unavailable_reason: 'no-surviving-interface-after-same-step-dissolution',
      morph_sigma_basis: 'post-step-no-solid-interface',
      morph_post_step_sigma: null,
      morph_regime: null,
      morph_form: null,
      morph_surf_sigma: null,
    });
    expect(dissolved.crystal._morphology).toBeNull();
  });

  it('clears a prior live interface when a later negative-only step fully dissolves the crystal', () => {
    const crystal = new Crystal({ mineral: 'pyrite', crystal_id: 2 });
    const core = new GrowthZone({ step: 0, temperature: 150, thickness_um: 10, growth_rate: 10 });
    crystal.add_zone(core);
    crystal._morphology = {
      status: 'classified', unavailable_reason: null, sigma_basis: 'post-step',
      post_step_sigma: 1.2, regime: 'spiral_smooth', form: 'cubic', surf_sigma: 1.2,
    };
    crystal.add_zone(new GrowthZone({
      step: 1,
      temperature: 150,
      thickness_um: -10,
      growth_rate: -10,
    }));
    expect(crystal.dissolved).toBe(true);
    classifyMorphologyStep({
      step: 1,
      crystals: [crystal],
      wall_state: null,
      conditions: { fluid: {}, temperature: 150, supersaturation_pyrite: () => 1.2 },
    });
    expect(crystal._morphology).toBeNull();
  });

  it('uses each shell prefix size for a finite-damping morphology tenant', () => {
    const crystal = new Crystal({ mineral: 'calcite', crystal_id: 3 });
    crystal.growth_environment = 'subaqueous';
    crystal.add_zone(new GrowthZone({ step: 1, temperature: 25, thickness_um: 4, growth_rate: 4 }));
    crystal.add_zone(new GrowthZone({ step: 1, temperature: 25, thickness_um: 6, growth_rate: 6 }));
    classifyMorphologyStep({
      step: 1,
      crystals: [crystal],
      wall_state: null,
      conditions: {
        fluid: { Mg: 0, Ca: 100 },
        temperature: 25,
        supersaturation_calcite: () => 9,
      },
    });
    const [first, second] = crystal.zones;
    const expectedFirst = 9;
    const expectedSecond = 1 + (9 - 1) /
      (1 + first.thickness_um / MORPH_TH.calcite.SIZE_HALF_UM);
    expect(first.morph_surf_sigma).toBeCloseTo(expectedFirst, 12);
    expect(second.morph_surf_sigma).toBeCloseTo(expectedSecond, 12);
    expect(second.morph_surf_sigma).toBeLessThan(first.morph_surf_sigma);
  });

  it('turns non-finite derived classifier state into explicit unavailable testimony', () => {
    const original = MORPH_TH.pyrite.effSigmaMult;
    MORPH_TH.pyrite.effSigmaMult = () => Number.NaN;
    try {
      const { crystal, zones: [zone] } = classifySyntheticPyrite(2);
      expect(zone).toMatchObject({
        morphology_status: 'unavailable-derived-morphology',
        morph_unavailable_reason: 'nonfinite-effective-sigma-multiplier',
        morph_sigma_basis: 'post-step',
        morph_post_step_sigma: 2,
        morph_regime: null,
        morph_form: null,
        morph_surf_sigma: null,
      });
      expect(crystal._morphology).toMatchObject({
        status: 'unavailable-derived-morphology',
        unavailable_reason: 'nonfinite-effective-sigma-multiplier',
        regime: null,
        form: null,
        surf_sigma: null,
      });
    } finally {
      if (original === undefined) delete MORPH_TH.pyrite.effSigmaMult;
      else MORPH_TH.pyrite.effSigmaMult = original;
    }
  });

  it('preserves unavailable null sigma through recorder, binary codec, and collection JSON', async () => {
    setSeed(42);
    const scenario = SCENARIOS.mvt();
    const sim = new VugSimulator(scenario.conditions, scenario.events);
    const crystal = new Crystal({ mineral: 'pyrite', crystal_id: 999 });
    const zone = new GrowthZone({ step: sim.step, temperature: 150, thickness_um: 10, growth_rate: 1 });
    crystal.add_zone(zone);
    Object.assign(zone, {
      morphology_status: 'unavailable-nonfinite-post-step',
      morph_unavailable_reason: 'nonfinite-post-step-sigma',
      morph_sigma_basis: 'post-step-unavailable',
      morph_post_step_sigma: null,
      morph_regime: null,
      morph_form: null,
      morph_surf_sigma: null,
    });
    sim.crystals.push(crystal);

    const recorder = new StripRecorder(sim, { duration_steps: 1, angular_indices: 1 });
    recorder.captureStep(sim);
    const dataset = recorder.finalize();
    const row = dataset.layer_growth_testimony.find((candidate: any) =>
      candidate.crystal_id === 999 && candidate.zone_index === 0);
    expect(row.morphology).toEqual({
      status: 'unavailable-nonfinite-post-step',
      unavailable_reason: 'nonfinite-post-step-sigma',
      sigma_basis: 'post-step-unavailable',
      post_step_sigma: null,
      regime: null,
      form: null,
      surface_sigma: null,
    });
    const decoded = await stripDeserialize(await stripSerialize(dataset, false));
    const decodedRow = decoded.layer_growth_testimony.find((candidate: any) =>
      candidate.crystal_id === 999 && candidate.zone_index === 0);
    expect(decodedRow.morphology).toEqual(row.morphology);

    const collected = JSON.parse(JSON.stringify(buildCrystalRecord(crystal, {
      mode: 'test', scenario: 'mvt', seed: 42,
    })));
    expect(collected.zones[0]).toMatchObject({
      morphology_status: 'unavailable-nonfinite-post-step',
      morph_unavailable_reason: 'nonfinite-post-step-sigma',
      morph_sigma_basis: 'post-step-unavailable',
      morph_post_step_sigma: null,
      morph_regime: null,
      morph_form: null,
      morph_surf_sigma: null,
    });
  });

  it('authored Sulphur Bank is completely smooth while Sunnyside is completely finely striated', () => {
    const sb = pyriteTestimony(runScenario('sulphur_bank'));
    expect(sb.total).toBeGreaterThan(0);
    expect(Object.keys(sb.mass)).toEqual(['spiral_smooth']);
    expect((sb.mass.spiral_smooth || 0) / sb.total).toBeCloseTo(1, 12);
    const sun = pyriteTestimony(runScenario('sunnyside_american_tunnel'));
    expect(sun.total).toBeGreaterThan(0);
    expect(Object.keys(sun.mass)).toEqual(['stepped_mild']);
    expect((sun.mass.stepped_mild || 0) / sun.total).toBeCloseTo(1, 12);
  });

  it('mvt pyrite is completely testified smooth-to-finely-striated, without an invented macro rind', () => {
    const { mass, total, rows } = pyriteTestimony(runScenario('mvt'));
    expect(total).toBeGreaterThan(0);
    expect(mass.spiral_smooth || 0).toBeGreaterThan(0);
    expect(mass.stepped_mild || 0).toBeGreaterThan(0);
    expect(Object.keys(mass).sort()).toEqual(['spiral_smooth', 'stepped_mild']);
    const depleted = rows.filter(({ zone }: any) =>
      zone.morph_sigma_basis === 'post-step-terminal-depleted');
    expect(depleted.length).toBeGreaterThan(0);
    const step40 = rows.find(({ zone }: any) => zone.step === 40)?.zone;
    expect(step40).toBeTruthy();
    expect(step40).toMatchObject({
      morphology_status: 'classified',
      morph_sigma_basis: 'post-step-terminal-depleted',
      morph_regime: 'spiral_smooth',
    });
    expect(step40.morph_post_step_sigma).toBeLessThan(1);
  });

  it('the overlay composes: striated habits keep parent forms and smooth Sulphur Bank remains cubic', () => {
    const sim = runScenario('sunnyside_american_tunnel');
    for (const c of sim.crystals) {
      if (c.mineral !== 'pyrite' || c.dissolved || !(c.total_growth_um > 0)) continue;
      expect(['pyritohedral', 'cubo-pyritohedral', 'cubic', 'framboidal',
              'striated_pyritohedral', 'striated_cubo_pyritohedral', 'striated_cubic'])
        .toContain(c.habit);
    }
    const sb = runScenario('sulphur_bank');
    const habits = new Set(sb.crystals.filter((c: any) => c.mineral === 'pyrite' && !c.dissolved && c.total_growth_um > 0).map((c: any) => c.habit));
    // With the former uncited universal acid/material pulses removed, the
    // commissioned crystal nucleates in the smooth cubic regime. The zone
    // ledger and exposed habit must tell the same story.
    expect(habits.has('cubic')).toBe(true);
    const sbMass = pyriteTestimony(sb);
    expect((sbMass.mass.hopper_skeletal || 0) + (sbMass.mass.dendritic || 0)).toBe(0);
  });

  it('aspect firewall: striated forms carry the parent default 0.5', () => {
    for (const h of ['striated_cubic', 'striated_pyritohedral', 'striated_cubo_pyritohedral', 'cubic', 'pyritohedral']) {
      expect(_habitAspectRatio(h)).toBe(0.5);
    }
  });

  it('pyritohedral family routes to the dodecahedron 3D token (hex-prism wart fixed)', () => {
    // Pre-fix, every string here fell through _habitGeomToken's default
    // and pyritohedra rendered as HEX PRISMS in the topo view. The 2D
    // path (99c PRIM_PYRITOHEDRON) was always right; this pins the 3D
    // token to the matching primitive. striated_cubic stays on the cube
    // token — that's the grooved-ziggurat terrace path, not a wart.
    for (const h of ['pyritohedral', 'cubo-pyritohedral', 'cubic_or_pyritohedral',
                     'striated_pyritohedral', 'striated_cubo_pyritohedral']) {
      expect(_habitGeomToken(h)).toBe('dodecahedron');
    }
    expect(_habitGeomToken('striated_cubic')).toBe('cube');
  });

  it('pyrite_morph chip opens the sulfide legend group; display speaks pyrite', () => {
    const p = _HELIX_CHEM_PARAMS.find((x: any) => x.id === 'pyrite_morph');
    expect(p).toBeTruthy();
    expect(p.system).toBe('sulfide');
    expect(morphDisplayLabel('pyrite', 'stepped_mild')).toBe('finely striated');
    expect(morphDisplayLabel('pyrite', 'spiral_smooth')).toBe('smooth euhedral (Navajún glass)');
  });
});
