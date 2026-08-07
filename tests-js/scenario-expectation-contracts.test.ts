import { describe, expect, it } from 'vitest';

declare const SCENARIOS: Record<string, any>;
declare const MINERAL_SPEC: Record<string, any>;
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
  }, 120_000);

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
  }, 30_000);

  it('keeps deterministic and aspirational promises structurally disjoint', () => {
    const advertisedExclusions: string[] = [];
    for (const [name, factory] of Object.entries(SCENARIOS)) {
      const spec = factory._json5_spec;
      const deterministic = new Set(spec.expects_species || []);
      for (const entry of spec.aspirational_species || []) {
        expect(deterministic.has(entry.mineral), `${name}:${entry.mineral}`).toBe(false);
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
      const excluded = new Set(Object.keys(spec.excluded_species || {}));
      for (const [mineral, window] of Object.entries(spec.nucleation_windows || {}) as any) {
        expect(deterministic.has(mineral), `${name}:${mineral} window must govern a deterministic promise`).toBe(true);
        expect(excluded.has(mineral), `${name}:${mineral} cannot be both windowed and excluded`).toBe(false);
        expect(Number.isInteger(window.start_step), `${name}:${mineral} start_step`).toBe(true);
        expect(window.start_step, `${name}:${mineral} positive start_step`).toBeGreaterThanOrEqual(1);
        if (window.end_step != null) {
          expect(Number.isInteger(window.end_step), `${name}:${mineral} end_step`).toBe(true);
          expect(window.end_step, `${name}:${mineral} ordered window`).toBeGreaterThanOrEqual(window.start_step);
        }
      }
    }
  });
});
