import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import './setup';

declare const FluidChemistry: any;
declare const VugConditions: any;
declare const GrowthZone: any;
declare const Crystal: any;
declare const applyStoichiometricGrowthBudget: any;
declare const simulatorSulfurLedgerSnapshot: any;
declare const sulfurSystemTotalPpm: any;
declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const StripRecorder: any;
declare const setSeed: any;
declare const _buildMineralFormationExplanation: any;

function explicitSulfurFluid(overrides: any): any {
  return new FluidChemistry({
    Cu: 200, Zn: 200, Fe: 100, O2: 0.01, pH: 5, salinity: 20,
    S_sulfide: 0, S_sulfate: 0, S_elemental: 0,
    sulfurPoolsExplicit: true,
    ...overrides,
  });
}

describe('valence-specific sulfur supersaturation authority', () => {
  it('contains no direct combined-S read in sulfate or sulfide supersaturation engines', () => {
    // Sulfur also appears as a competing ligand/reservoir in carbonate,
    // halide, native, and silicate engines. Those sites are part of the same
    // admission authority and must not regress to the combined compatibility
    // shell either.
    for (const path of [
      'js/32-supersat-carbonate.ts',
      'js/33-supersat-halide.ts',
      'js/36-supersat-native.ts',
      'js/39-supersat-silicate.ts',
      'js/40-supersat-sulfate.ts',
      'js/41-supersat-sulfide.ts',
    ]) {
      const source = readFileSync(path, 'utf8');
      expect(source).not.toMatch(/this\.fluid\.S\b/);
    }
  });

  it('does not admit or inflate brochantite from a huge sulfide pool', () => {
    const wrongOnly = new VugConditions({
      temperature: 30,
      fluid: explicitSulfurFluid({ O2: 2, pH: 5, S_sulfide: 10_000, S_sulfate: 0 }),
    });
    const correctOnly = new VugConditions({
      temperature: 30,
      fluid: explicitSulfurFluid({ O2: 2, pH: 5, S_sulfide: 0, S_sulfate: 100 }),
    });
    const correctPlusWrong = new VugConditions({
      temperature: 30,
      fluid: explicitSulfurFluid({ O2: 2, pH: 5, S_sulfide: 10_000, S_sulfate: 100 }),
    });

    expect(wrongOnly.supersaturation_brochantite()).toBe(0);
    expect(correctOnly.supersaturation_brochantite()).toBeGreaterThan(1);
    expect(correctPlusWrong.supersaturation_brochantite())
      .toBeLessThanOrEqual(correctOnly.supersaturation_brochantite());
  });

  it('shows the same sulfate reservoir in the live formation diagnosis', () => {
    const conditions = new VugConditions({
      temperature: 30,
      fluid: explicitSulfurFluid({ O2: 2, pH: 5, S_sulfide: 10_000, S_sulfate: 0 }),
    });
    const why = _buildMineralFormationExplanation(
      'brochantite', conditions, { conditions, crystals: [] }, 0,
    );
    const floors = why.groups.find((group: any) => group.label === 'Nucleation floors').chips;
    const budget = why.groups.find((group: any) => group.label === 'Calibrated growth budget').chips;
    const sulfurFloor = floors.find((chip: any) => chip.text.startsWith('S '));

    expect(sulfurFloor.met).toBe(false);
    expect(sulfurFloor.text).toContain('S 0.00 / 15.0 ppm');
    expect(budget.some((chip: any) => chip.text.startsWith('S_sulfate books 0'))).toBe(true);
  });

  it('does not admit or inflate sphalerite from a huge sulfate pool', () => {
    const wrongOnly = new VugConditions({
      temperature: 100,
      fluid: explicitSulfurFluid({ O2: 0.01, pH: 5, S_sulfide: 0, S_sulfate: 10_000 }),
    });
    const correctOnly = new VugConditions({
      temperature: 100,
      fluid: explicitSulfurFluid({ O2: 0.01, pH: 5, S_sulfide: 100, S_sulfate: 0 }),
    });
    const correctPlusWrong = new VugConditions({
      temperature: 100,
      fluid: explicitSulfurFluid({ O2: 0.01, pH: 5, S_sulfide: 100, S_sulfate: 10_000 }),
    });

    expect(wrongOnly.supersaturation_sphalerite()).toBe(0);
    expect(correctOnly.supersaturation_sphalerite()).toBeGreaterThan(1);
    expect(correctPlusWrong.supersaturation_sphalerite())
      .toBeLessThanOrEqual(correctOnly.supersaturation_sphalerite());
  });

  it('does not reinterpret a declared inherited-sulfate legacy pulse as sulfide', () => {
    const fluid = new FluidChemistry({
      Zn: 200, S: 10_000, sulfateInherited: true, O2: 0.01, pH: 5,
    });
    const conditions = new VugConditions({ temperature: 100, fluid });
    expect(conditions.supersaturation_sphalerite()).toBe(0);
  });

  it('generates phase-resolved sulfur testimony while the total ledger closes', () => {
    const fluid = explicitSulfurFluid({ S_sulfide: 200, S_sulfate: 200 });
    const initial = sulfurSystemTotalPpm(fluid);
    const conditions = { fluid };
    const pyrite = new Crystal({ mineral: 'pyrite', crystal_id: 1 });
    const selenite = new Crystal({ mineral: 'selenite', crystal_id: 2 });
    const pyriteZone = new GrowthZone({ step: 1, temperature: 100, thickness_um: 1, growth_rate: 1 });
    const seleniteZone = new GrowthZone({ step: 1, temperature: 100, thickness_um: 1, growth_rate: 1 });
    applyStoichiometricGrowthBudget(pyrite, pyriteZone, conditions);
    applyStoichiometricGrowthBudget(selenite, seleniteZone, conditions);
    pyrite.add_zone(pyriteZone);
    selenite.add_zone(seleniteZone);

    const ledger = simulatorSulfurLedgerSnapshot({
      step: 1,
      conditions,
      crystals: [pyrite, selenite],
      _sulfurLedgerInitialPpm: initial,
      _sulfurBoundaryImportsPpm: 0,
      _sulfurBoundaryExportsPpm: 0,
      _sulfurPropagationViolations: [],
    });
    expect(ledger.closed).toBe(true);
    expect(ledger.testimonyClosed).toBe(true);
    expect(ledger.testimonyErrorPpm).toBeCloseTo(0, 12);
    expect(ledger.fluidReservoirPpm).toMatchObject({ sulfide: expect.any(Number), sulfate: expect.any(Number) });
    expect(ledger.phaseIdentity).toEqual(expect.arrayContaining([
      expect.objectContaining({ mineral: 'pyrite', reservoir: 'sulfide' }),
      expect.objectContaining({ mineral: 'selenite', reservoir: 'sulfate' }),
    ]));
    expect(ledger.solidReservoirPpm.sulfide).toBeGreaterThan(0);
    expect(ledger.solidReservoirPpm.sulfate).toBeGreaterThan(0);
  });

  it('persists generated sulfur testimony in the strip product', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.sulphur_bank();
    const sim = new VugSimulator(conditions, events);
    const recorder = new StripRecorder(sim, { duration_steps: 1 });
    sim._stripRecorder = recorder;
    sim.run_step();
    const testimony = recorder.finalize().sulfur_ledger_testimony;
    expect(testimony).toHaveLength(1);
    expect(testimony[0]).toMatchObject({ step: 1, sample_index: 0, closed: true });
    expect(testimony[0].fluidReservoirPpm).toMatchObject({
      sulfide: expect.any(Number),
      sulfate: expect.any(Number),
      elemental: expect.any(Number),
    });
  });
});
