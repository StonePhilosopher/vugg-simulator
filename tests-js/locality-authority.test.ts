import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

declare const EVENT_REGISTRY: Record<string, Function>;
declare const eventScenarioOwner: any;
declare const assertEventScenarioOwnership: any;
declare const _scenarioPositiveLicenseBlock: any;
declare const _scenarioSpeciesExclusion: any;
declare const SCENARIOS: Record<string, any>;
declare const FluidChemistry: any;
declare const VugConditions: any;
declare const VugSimulator: any;
declare const _nucleateClass_carbonate: (sim: any) => void;
declare const setSeed: (seed: number) => void;
declare const _liveRng: () => { state: number };
declare const _setNucDerivedSeeds: (on: boolean) => boolean;

function hmcEligibleLocality(licensedMinerals: string[]): any {
  const conditions = new VugConditions({
    temperature: 25,
    fluid: new FluidChemistry({
      Ca: 400.78, Mg: 1263.86, CO3: 5000, pH: 8, salinity: 35,
    }),
  });
  conditions._scenario = {
    id: 'hostile_hmc_license_control',
    expects_species: licensedMinerals,
    deterministic_species: [],
    statistical_species: [],
    aspirational_species: [],
  };
  return new VugSimulator(conditions, []);
}

describe('locality authority fails closed', () => {
  it('requires every scenario-grown phase to belong to a positive tier', () => {
    const sim = { conditions: { _scenario: {
      id: 'test_locality',
      expects_species: ['calcite'],
      deterministic_species: [{ mineral: 'barite' }],
      statistical_species: [{ mineral: 'fluorite' }],
      aspirational_species: [{ mineral: 'galena' }],
      excluded_species: { siderite: 'not documented here' },
    } } };
    for (const mineral of ['calcite', 'barite', 'fluorite', 'galena']) {
      expect(_scenarioPositiveLicenseBlock(sim, mineral)).toBeNull();
    }
    expect(_scenarioPositiveLicenseBlock(sim, 'celestine')).toContain('no positive four-tier locality license');
    expect(_scenarioSpeciesExclusion(sim, 'siderite')).toBe('not documented here');
  });

  it('keeps Creative/custom broths unrestricted when no locality is claimed', () => {
    expect(_scenarioPositiveLicenseBlock({ conditions: { _scenario: {} } }, 'celestine')).toBeNull();
  });

  it('routes HMC through the same four-tier production licence as every other nucleator', () => {
    setSeed(42);
    const blocked = hmcEligibleLocality(['calcite']);
    expect(_scenarioPositiveLicenseBlock(blocked, 'HMC'))
      .toContain('no positive four-tier locality license');
    _nucleateClass_carbonate(blocked);
    expect(blocked.crystals.some((crystal: any) => crystal.mineral === 'HMC')).toBe(false);

    setSeed(42);
    const licensed = hmcEligibleLocality(['HMC']);
    expect(_scenarioPositiveLicenseBlock(licensed, 'HMC')).toBeNull();
    _nucleateClass_carbonate(licensed);
    expect(licensed.crystals.some((crystal: any) => crystal.mineral === 'HMC')).toBe(true);
  });

  it('keeps licensed HMC on its isolated per-mineral RNG stream', () => {
    const previous = _setNucDerivedSeeds(true);
    try {
      setSeed(42);
      const licensed = hmcEligibleLocality(['HMC']);
      const sharedStateBefore = _liveRng().state;
      _nucleateClass_carbonate(licensed);
      expect(licensed.crystals.some((crystal: any) => crystal.mineral === 'HMC')).toBe(true);
      expect(_liveRng().state).toBe(sharedStateBefore);

      // Teeth: the legacy shared-stream mode advances the global RNG for the
      // exact same licensed HMC birth. This proves the first assertion detects
      // a return to the former direct-call exception rather than passing on an
      // engine that happened not to draw.
      _setNucDerivedSeeds(false);
      setSeed(42);
      const legacy = hmcEligibleLocality(['HMC']);
      const legacyStateBefore = _liveRng().state;
      _nucleateClass_carbonate(legacy);
      expect(legacy.crystals.some((crystal: any) => crystal.mineral === 'HMC')).toBe(true);
      expect(_liveRng().state).not.toBe(legacyStateBefore);
    } finally {
      _setNucDerivedSeeds(previous);
    }
  });
});

describe('locality-specific event ownership', () => {
  it('binds the Elmwood Sr event to Elmwood and rejects direct cross-scenario reuse', () => {
    expect(eventScenarioOwner('elmwood_diagenetic_sr')).toBe('elmwood');
    expect(() => assertEventScenarioOwnership('elmwood_diagenetic_sr', 'mvt')).toThrow(/belongs to scenario 'elmwood'/);
    const wrong = { _scenario_id: 'mvt', fluid: { Sr: 0 } };
    expect(() => EVENT_REGISTRY.elmwood_diagenetic_sr(wrong)).toThrow(/not 'mvt'/);

    const right = { _scenario_id: 'elmwood', fluid: { Sr: 10 } };
    EVENT_REGISTRY.elmwood_diagenetic_sr(right);
    expect(right.fluid.Sr).toBe(30);
  });

  it('leaves only explicitly reusable event families unowned', () => {
    const reusable = new Set([
      'cooling_pulse', 'film_coat', 'fluid_pulse', 'tectonic_shock',
    ]);
    for (const [scenarioId, makeScenario] of Object.entries(SCENARIOS)) {
      for (const event of makeScenario._json5_spec?.events || []) {
        const owner = eventScenarioOwner(event.type);
        if (reusable.has(event.type)) expect(owner, event.type).toBeNull();
        else expect(owner, `${scenarioId}/${event.type}`).toBe(scenarioId);
      }
    }
  });

  it('binds every material-bearing fluid-mixing recipe to its authored locality', () => {
    expect(eventScenarioOwner('mvt_fluid_mixing')).toBe('mvt');
    expect(eventScenarioOwner('elmwood_fluid_mixing')).toBe('elmwood');
    expect(eventScenarioOwner('reactivated_vein_fluid_mixing')).toBe('reactivated_fluorite_vein');

    const payload = SCENARIOS.elmwood._json5_spec.events
      .find((event: any) => event.type === 'elmwood_fluid_mixing');
    const wrong = SCENARIOS.mvt().conditions;
    expect(() => EVENT_REGISTRY.elmwood_fluid_mixing(wrong, payload))
      .toThrow(/belongs to scenario 'elmwood'/);
  });

  it('keeps the canonical Tri-State catalog exactly aligned with its authored event reservoirs', () => {
    const locality = JSON.parse(fs.readFileSync(
      path.resolve(process.cwd(), 'data/locality_chemistry.json'), 'utf8',
    ));
    const triState = locality.localities.tri_state;
    expect(triState).toBeDefined();

    const event = SCENARIOS.mvt._json5_spec.events
      .find((candidate: any) => candidate.type === 'mvt_fluid_mixing');
    const projection = {
      step: 20,
      fluid_transform: {
        add: { Zn: 150, Ca: 100, F: 40, Pb: 25, Fe: 30 },
        flow_rate: 4,
      },
      sulfur_boundary: {
        kind: 'addition',
        pools: { sulfide: 90, sulfate: 30 },
      },
      temperature_delta_C: -20,
      material_authority: event.material_authority,
    };
    expect(event).toMatchObject(projection);
    expect(triState.authored_material_events.mvt_fluid_mixing).toEqual(projection);

    const canonicalText = JSON.stringify(triState);
    expect(canonicalText).toContain('mvt_fluid_mixing');
    expect(canonicalText).toContain('90 ppm sulfide sulfur');
    expect(canonicalText).toContain('30 ppm sulfate sulfur');
    expect(canonicalText).not.toContain('event_fluid_mixing');
    expect(canonicalText).not.toContain('S=120');
  });
});
