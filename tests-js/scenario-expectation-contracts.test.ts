import { describe, expect, it } from 'vitest';

declare const SCENARIOS: Record<string, any>;
declare const MINERAL_SPEC: Record<string, any>;
declare const EVENT_REGISTRY: Record<string, any>;
declare const VugSimulator: any;
declare const StripRecorder: any;
declare function setSeed(seed: number): void;
declare function assessProductionNucleationDecision(
  name: string, sim: any, sigma: number, sigmaCrit: number,
): any;

function run(name: string, seed = 42, record = false) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  const recorder = record
    ? new StripRecorder(sim, { duration_steps: defaultSteps, angular_indices: 1 })
    : null;
  if (recorder) sim._stripRecorder = recorder;
  let maxSeleniteSigma = -Infinity;
  for (let i = 0; i < defaultSteps; i++) {
    sim.run_step();
    maxSeleniteSigma = Math.max(maxSeleniteSigma, sim.conditions.supersaturation_selenite());
  }
  return { sim, dataset: recorder?.finalize(), maxSeleniteSigma };
}

describe('scenario expectation contracts', () => {
  it('delivers documented Tsumeb promises and blocks unsupported Ca-arsenates', () => {
    const { sim, dataset, maxSeleniteSigma } = run('supergene_oxidation', 42, true);
    const present = new Set(sim.crystals.map((c: any) => c.mineral));
    const spec = SCENARIOS.supergene_oxidation._json5_spec;
    for (const mineral of spec.expects_species) {
      expect(
        present.has(mineral),
        `${mineral} must be present; max selenite Ω=${maxSeleniteSigma}, final Ca=${sim.conditions.fluid.Ca}, S=${sim.conditions.fluid.S}`,
      ).toBe(true);
    }
    for (const mineral of Object.keys(spec.excluded_species)) {
      expect(present.has(mineral), `${mineral} unsupported Tsumeb occurrence`).toBe(false);
    }
    expect(dataset.transformation_event_testimony).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ to: 'haidingerite' }),
    ]));
    const decision = assessProductionNucleationDecision('pharmacolite', sim, 10, 1);
    expect(decision).toMatchObject({ available: true, eligible: false });
    expect(decision.blockers.join(' ')).toContain('locality evidence excludes');
    expect(spec.sources.join('\n')).toContain('TSNB159');
    expect(spec.sources.join('\n')).toContain('Mindat locality record 2428');
  // SIM 264's authenticated surface anchors make this the suite's densest
  // recorder-backed scenario.  The canonical seed-42 run is finite but was
  // measured at 658 s on an otherwise idle reference workstation and over
  // 15 minutes under concurrent desktop load; keep a 30-minute hang detector
  // without weakening or splitting the scientific assertions.
  }, 1_800_000);

  it('enforces the first-zone Tsumeb köttigite exclusion even in a forced pH < 3 fluid', () => {
    setSeed(42);
    const { conditions } = SCENARIOS.supergene_oxidation();
    conditions.temperature = 20;
    Object.assign(conditions.fluid, {
      Zn: 160, As: 50, Co: 0, Ni: 0, O2: 1.0, pH: 2.5,
    });
    const sim = new VugSimulator(conditions, []);

    expect(
      sim.conditions.supersaturation_koettigite(),
      'the counterfactual broth must be chemically favorable before testing locality enforcement',
    ).toBeGreaterThan(MINERAL_SPEC.koettigite.nucleation_sigma);

    const decision = assessProductionNucleationDecision(
      'koettigite', sim, sim.conditions.supersaturation_koettigite(),
      MINERAL_SPEC.koettigite.nucleation_sigma,
    );
    expect(decision).toMatchObject({
      available: true,
      eligible: false,
      source: 'scenario-locality exclusion',
    });
    expect(decision.blockers.join(' ')).toContain('third oxidation zone');

    sim.run_step();
    expect(sim.crystals.some((crystal: any) => crystal.mineral === 'koettigite')).toBe(false);
  });

  it('enforces Sweetwater negative locality evidence without disabling global engines', () => {
    const { sim } = run('reactive_wall');
    const spec = SCENARIOS.reactive_wall._json5_spec;
    const present = new Set(sim.crystals.map((c: any) => c.mineral));
    for (const mineral of spec.expects_species) {
      expect(present.has(mineral), `${mineral} deterministic promise`).toBe(true);
    }
    for (const mineral of Object.keys(spec.excluded_species)) {
      expect(present.has(mineral), `${mineral} locality exclusion`).toBe(false);
    }
    const decision = assessProductionNucleationDecision('barite', sim, 10, 1);
    expect(decision).toMatchObject({ available: true, eligible: false });
    expect(decision.blockers.join(' ')).toContain('locality evidence excludes');
  }, 300_000);

  it('turns Bingham exhumation into a cold, shallow, non-reheating supergene boundary', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.porphyry();
    const uplift = events.find((event: any) => event.step === 85);
    const maturation = events.find((event: any) => event.step === 95);
    expect(uplift.name).toBe('Exhumation + Oxidation');
    expect(maturation.name).toBe('Supergene Maturation');

    uplift.apply_fn(conditions);
    expect(conditions.temperature).toBe(35);
    expect(conditions.pressure).toBeCloseTo(0.001, 9);
    expect(conditions.wall.ambient_temperature_C).toBe(25);
    expect(conditions.wall.thermal_pulses).toBe(false);
    maturation.apply_fn(conditions);
    expect(conditions.temperature).toBe(25);

    const malachite = SCENARIOS.porphyry._json5_spec.deterministic_species
      .find((entry: any) => entry.mineral === 'malachite');
    expect(malachite.first_step_min).toBe(85);
    const exclusions = Object.keys(SCENARIOS.porphyry._json5_spec.excluded_species).sort();
    expect(exclusions).toEqual([
      'atacamite', 'conichalcite', 'lepidocrocite', 'mimetite', 'powellite', 'wulfenite',
    ]);
    const blocked = assessProductionNucleationDecision('powellite', { conditions } as any, 85, 1);
    expect(blocked).toMatchObject({ available: true, eligible: false });
    expect(blocked.blockers.join(' ')).toContain('locality evidence excludes');
  });

  it('keeps Bingham native gold behind the executed copper-stage history', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.porphyry();
    const sim = new VugSimulator(conditions, events);
    sim.step = 25;
    const beforeEvent = assessProductionNucleationDecision(
      'native_gold', sim, sim.conditions.supersaturation_native_gold(),
      MINERAL_SPEC.native_gold.nucleation_sigma,
    );
    expect(beforeEvent).toMatchObject({
      available: true,
      eligible: false,
      source: 'scenario causal paragenesis',
    });
    expect(beforeEvent.blockers.join(' ')).toContain('copper_injection');

    sim.step = 0;
    for (let i = 0; i < 24; i++) sim.run_step();
    expect(sim.crystals.some((crystal: any) => crystal.mineral === 'native_gold')).toBe(false);
    sim.run_step();
    expect(sim.conditions._scenario.executed_event_types).toContain('copper_injection');
    for (let i = 25; i < 120; i++) sim.run_step();
    expect(sim.crystals.some((crystal: any) => crystal.mineral === 'native_gold')).toBe(false);
    expect(
      SCENARIOS.porphyry._json5_spec.aspirational_species
        .some((entry: any) => entry.mineral === 'native_gold'),
    ).toBe(true);
  });

  it('enforces the reconciled Bisbee district exclusions without inventing final-drying salt', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.bisbee();
    const spec = SCENARIOS.bisbee._json5_spec;
    expect(Object.keys(spec.excluded_species).sort()).toEqual([
      'amosite', 'annabergite', 'arsenopyrite', 'erythrite', 'halite',
      'millerite', 'pararealgar', 'realgar',
    ]);
    expect(conditions.fluid.Co).toBe(0);
    expect(conditions.fluid.Ni).toBe(0);

    const drying = events.find((event: any) => event.step === 305);
    const salinity = conditions.fluid.salinity;
    drying.apply_fn(conditions);
    expect(conditions.fluid.salinity).toBe(salinity);

    const sim = new VugSimulator(conditions, []);
    const decision = assessProductionNucleationDecision('halite', sim, 10, 1);
    expect(decision).toMatchObject({ available: true, eligible: false });
    expect(decision.blockers.join(' ')).toContain('locality evidence excludes');
  });

  it('enforces an endmember exclusion inside the shared beryl-family dispatcher', () => {
    setSeed(42);
    const { conditions } = SCENARIOS.gem_pegmatite();
    const sim = new VugSimulator(conditions, []);

    expect(
      sim.conditions.supersaturation_emerald(),
      'the canonical broth must challenge the excluded emerald path',
    ).toBeGreaterThan(MINERAL_SPEC.emerald.nucleation_sigma);
    sim.run_step();

    expect(sim.crystals.some((crystal: any) => crystal.mineral === 'emerald')).toBe(false);
    const decision = assessProductionNucleationDecision(
      'emerald', sim, sim.conditions.supersaturation_emerald(),
      MINERAL_SPEC.emerald.nucleation_sigma,
    );
    expect(decision).toMatchObject({ available: true, eligible: false });
    expect(decision.blockers.join(' ')).toContain('locality evidence excludes');
  });

  it('uses four-tier licences inside both shared gem-family dispatchers', () => {
    const berylFamily = new Set(['beryl', 'emerald', 'aquamarine', 'morganite', 'heliodor']);
    const corundumFamily = new Set(['corundum', 'ruby', 'sapphire']);
    for (const mineral of [...berylFamily, ...corundumFamily]) {
      expect(MINERAL_SPEC[mineral]._requires_scenario_license, `${mineral}: locality-sensitive family`).toBe(true);
    }

    const tierNames = [
      'expects_species', 'deterministic_species', 'statistical_species', 'aspirational_species',
    ];
    const putOnlyInTier = (scenario: any, tier: string, mineral: string) => {
      Object.assign(scenario, {
        expects_species: [],
        deterministic_species: [],
        statistical_species: [],
        aspirational_species: [],
        excluded_species: {},
        nucleation_windows: {},
        nucleation_prerequisites: {},
      });
      scenario[tier] = tier === 'expects_species'
        ? [mineral]
        : [{ mineral, reason: 'Synthetic candidate-boundary licence probe.' }];
    };

    // Exercise the actual production probe at the selected candidate boundary,
    // not merely the metadata-union helper. Each subcase gives a chemically
    // eligible member exactly one of the four positive licences.
    for (const tier of tierNames) {
      setSeed(42);
      const licensedBeryl = SCENARIOS.radioactive_pegmatite();
      putOnlyInTier(licensedBeryl.conditions._scenario, tier, 'morganite');
      licensedBeryl.conditions.supersaturation_morganite = () => 10;
      const berylSim = new VugSimulator(licensedBeryl.conditions, licensedBeryl.events);
      const berylDecision = assessProductionNucleationDecision('morganite', berylSim, 10, 1.4);
      expect(berylDecision.eligible, `beryl dispatcher: ${tier}`).toBe(true);
      expect(berylDecision.source).toBe('_nuc_spodumene');

      setSeed(42);
      const licensedCorundum = SCENARIOS.marble_contact_metamorphism();
      putOnlyInTier(licensedCorundum.conditions._scenario, tier, 'ruby');
      licensedCorundum.conditions.supersaturation_ruby = () => 10;
      const corundumSim = new VugSimulator(licensedCorundum.conditions, licensedCorundum.events);
      const corundumDecision = assessProductionNucleationDecision('ruby', corundumSim, 10, 1.3);
      expect(corundumDecision.eligible, `corundum dispatcher: ${tier}`).toBe(true);
      // Both family loops currently share the historical `_nuc_spodumene`
      // production function; eligibility proves the ruby candidate itself
      // reached nucleate(), rather than inferring permission from its wrapper.
      expect(corundumDecision.source).toBe('_nuc_spodumene');
    }

    setSeed(42);
    const blockedBeryl = SCENARIOS.radioactive_pegmatite();
    Object.assign(blockedBeryl.conditions._scenario, {
      id: 'unlicensed_beryl_probe', expects_species: [], statistical_species: [], aspirational_species: [],
      deterministic_species: [],
    });
    const blockedBerylSim = new VugSimulator(blockedBeryl.conditions, blockedBeryl.events);
    blockedBerylSim.run_step();
    expect(blockedBerylSim.crystals.some((crystal: any) => berylFamily.has(crystal.mineral))).toBe(false);

    setSeed(42);
    const blockedCorundum = SCENARIOS.marble_contact_metamorphism();
    Object.assign(blockedCorundum.conditions._scenario, {
      id: 'unlicensed_corundum_probe', expects_species: [], statistical_species: [], aspirational_species: [],
      deterministic_species: [],
    });
    const blockedCorundumSim = new VugSimulator(blockedCorundum.conditions, blockedCorundum.events);
    for (let i = 0; i < 25; i++) blockedCorundumSim.run_step();
    expect(blockedCorundumSim.crystals.some((crystal: any) => corundumFamily.has(crystal.mineral))).toBe(false);
  });

  it('keeps deterministic and aspirational promises structurally disjoint', () => {
    const advertisedExclusions: string[] = [];
    for (const [name, factory] of Object.entries(SCENARIOS)) {
      const spec = factory._json5_spec;
      const deterministic = new Set(spec.expects_species || []);
      for (const entry of spec.deterministic_species || []) {
        const mineral = typeof entry === 'string' ? entry : entry.mineral;
        expect(deterministic.has(mineral), `${name}:${mineral} deterministic tier overlap`).toBe(false);
        expect(entry.reason, `${name}:${mineral} deterministic rationale`).toMatch(/\S/);
        deterministic.add(mineral);
      }
      const statistical = new Set((spec.statistical_species || []).map((entry: any) => (
        typeof entry === 'string' ? entry : entry.mineral
      )));
      const aspirational = new Set((spec.aspirational_species || []).map((entry: any) => (
        typeof entry === 'string' ? entry : entry.mineral
      )));
      for (const entry of spec.statistical_species || []) {
        const mineral = typeof entry === 'string' ? entry : entry.mineral;
        expect(deterministic.has(mineral), `${name}:${mineral} deterministic/statistical overlap`).toBe(false);
        expect(entry.reason, `${name}:${mineral} statistical rationale`).toMatch(/\S/);
      }
      for (const entry of spec.aspirational_species || []) {
        expect(deterministic.has(entry.mineral), `${name}:${entry.mineral}`).toBe(false);
        expect(statistical.has(entry.mineral), `${name}:${entry.mineral} statistical/aspirational overlap`).toBe(false);
        expect(entry.reason, `${name}:${entry.mineral} rationale`).toMatch(/\S/);
      }
      for (const mineral of Object.keys(spec.excluded_species || {})) {
        if ((MINERAL_SPEC[mineral]?.scenarios || []).includes(name)) {
          advertisedExclusions.push(`${name}:${mineral}`);
        }
      }
    }
    expect(
      advertisedExclusions,
      'library metadata must not advertise species that the authored scenario excludes',
    ).toEqual([]);
  });

  it('keeps authored nucleation windows finite, ordered, and tied to promises', () => {
    for (const [name, factory] of Object.entries(SCENARIOS)) {
      const spec = factory._json5_spec;
      const deterministic = new Set(spec.expects_species || []);
      for (const entry of spec.deterministic_species || []) {
        deterministic.add(typeof entry === 'string' ? entry : entry.mineral);
      }
      const statistical = new Set((spec.statistical_species || []).map((entry: any) => (
        typeof entry === 'string' ? entry : entry.mineral
      )));
      const aspirational = new Set((spec.aspirational_species || []).map((entry: any) => (
        typeof entry === 'string' ? entry : entry.mineral
      )));
      const excluded = new Set(Object.keys(spec.excluded_species || {}));
      for (const [mineral, window] of Object.entries(spec.nucleation_windows || {}) as any) {
        expect(
          deterministic.has(mineral) || statistical.has(mineral) || aspirational.has(mineral),
          `${name}:${mineral} window must govern a positive-tier promise`,
        ).toBe(true);
        expect(excluded.has(mineral), `${name}:${mineral} cannot be both windowed and excluded`).toBe(false);
        expect(Number.isInteger(window.start_step), `${name}:${mineral} start_step`).toBe(true);
        expect(window.start_step, `${name}:${mineral} positive start_step`).toBeGreaterThanOrEqual(1);
        if (window.end_step != null) {
          expect(Number.isInteger(window.end_step), `${name}:${mineral} end_step`).toBe(true);
          expect(window.end_step, `${name}:${mineral} ordered window`).toBeGreaterThanOrEqual(window.start_step);
        }
      }
      for (const [mineral, prerequisite] of Object.entries(spec.nucleation_prerequisites || {}) as any) {
        expect(
          deterministic.has(mineral) || statistical.has(mineral) || aspirational.has(mineral),
          `${name}:${mineral} prerequisite must govern a positive-tier promise`,
        ).toBe(true);
        expect(Array.isArray(prerequisite.event_types), `${name}:${mineral} event_types`).toBe(true);
        expect(prerequisite.event_types.length, `${name}:${mineral} event_types nonempty`).toBeGreaterThan(0);
        for (const eventType of prerequisite.event_types) {
          expect(typeof EVENT_REGISTRY[eventType], `${name}:${mineral}:${eventType}`).toBe('function');
          expect((spec.events || []).some((event: any) => event.type === eventType), `${name}:${mineral}:${eventType} authored`).toBe(true);
        }
      }
    }
  });
});
