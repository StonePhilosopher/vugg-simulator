import { describe, expect, it } from 'vitest';

declare const EVENT_REGISTRY: Record<string, Function>;
declare const eventScenarioOwner: any;
declare const assertEventScenarioOwnership: any;
declare const _scenarioPositiveLicenseBlock: any;
declare const _scenarioSpeciesExclusion: any;
declare const SCENARIOS: Record<string, any>;

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
      'cooling_pulse', 'film_coat', 'fluid_mixing', 'fluid_pulse', 'tectonic_shock',
    ]);
    for (const [scenarioId, makeScenario] of Object.entries(SCENARIOS)) {
      for (const event of makeScenario._json5_spec?.events || []) {
        const owner = eventScenarioOwner(event.type);
        if (reusable.has(event.type)) expect(owner, event.type).toBeNull();
        else expect(owner, `${scenarioId}/${event.type}`).toBe(scenarioId);
      }
    }
  });
});
