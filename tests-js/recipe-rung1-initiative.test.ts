import {describe, expect, it} from 'vitest';
import fs from 'node:fs';
import {initiativeDeltaAudit, changedLeaves, PREVIOUS_TEMPERATURE_FLOORS} from '../tools/recipe-rung1-audit.mjs';

describe('rung 1 temperature corrections — explicit initiative effects', () => {
  it.each(Object.entries(PREVIOUS_TEMPERATURE_FLOORS))('%s loses the contradicted low-T penalty', (mineral, priorFloor) => {
    const api = globalThis as any;
    expect(api.MINERAL_GATES_REGISTRY[mineral].T_min).toBeUndefined();
    expect(api.temperatureInitiativeModifier(mineral, {temperature: priorFloor - 10}).value).toBe(0);
    const old = {...api.MINERAL_GATES_REGISTRY[mineral]};
    try {
      api.MINERAL_GATES_REGISTRY[mineral].T_min = priorFloor;
      expect(api.temperatureInitiativeModifier(mineral, {temperature: priorFloor - 10}).value).toBe(-3);
    } finally { Object.assign(api.MINERAL_GATES_REGISTRY[mineral], old); delete api.MINERAL_GATES_REGISTRY[mineral].T_min; }
  });

  it.each(Object.keys(PREVIOUS_TEMPERATURE_FLOORS))('%s retains its ceiling and exposes the narrowed bonus window', mineral => {
    const api = globalThis as any, g = api.MINERAL_GATES_REGISTRY[mineral];
    const modifier = (T: number) => api.temperatureInitiativeModifier(mineral, {temperature: T}).value;
    expect(modifier(g.T_optimal)).toBe(2);
    expect(modifier(g.T_optimal + 10)).toBe(1);
    expect(modifier(g.T_optimal + 25)).toBe(0);
    expect(modifier(g.T_max + 1)).toBe(-3);
  });

  it('audits both positive and negative deltas and restores the gates', () => {
    const api = globalThis as any;
    const before = JSON.stringify(api.MINERAL_GATES_REGISTRY);
    const rows = initiativeDeltaAudit(api);
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.samples.some(s => s.delta === 3)).toBe(true);
      expect(row.samples.some(s => s.delta < 0)).toBe(true);
      expect(row.corrected_normalization_C).toBe(50);
    }
    expect(JSON.stringify(api.MINERAL_GATES_REGISTRY)).toBe(before);
  });

  it('retains non-target temperature behavior', () => {
    const api = globalThis as any;
    expect(api.temperatureInitiativeModifier('quartz', {temperature: 250}).value).toBe(2);
    expect(api.temperatureInitiativeModifier('unknown', {temperature: 20}).value).toBe(0);
    expect(api.temperatureInitiativeModifier('pyrite', {}).value).toBe(0);
  });
});

describe('rung 1 pure endmembers can clear the admission threshold', () => {
  it.each([
    ['olivenite', {Cu: 800, Zn: 0, As: 150, O2: 1.5, pH: 6.5}],
    ['adamite', {Zn: 400, Cu: 0, As: 100, O2: 1.5, pH: 6.5}],
    ['descloizite', {Pb: 400, Zn: 400, Cu: 0, V: 80, O2: 1.2, pH: 5.5}],
  ])('%s remains finite and eligible with a zero recessive cation', (mineral, fluid) => {
    const api = globalThis as any;
    const c = new api.VugConditions({temperature: 30, fluid: new api.FluidChemistry(fluid)});
    const sigma = c[`supersaturation_${mineral}`]();
    expect(Number.isFinite(sigma)).toBe(true);
    expect(sigma).toBeGreaterThan(api.MINERAL_GATES_REGISTRY[mineral].sigma_crit);
  });
});

describe('audit comparison evidence', () => {
  it('records changed leaves without hiding a small physical change', () => {
    expect(changedLeaves({mass: 1, history: [2]}, {mass: 1.000001, history: [3]})).toEqual({
      count: 2, examples: [{path: 'mass', before: 1, after: 1.000001}, {path: 'history.0', before: 2, after: 3}],
    });
  });
});

describe('rung 1 corrections have a new scientific identity', () => {
  const prior = JSON.parse(fs.readFileSync('archive/strips/v285/cooling.json', 'utf8'));

  it('names the corrected rules instead of reusing SIM 285', () => {
    const api = globalThis as any;
    expect(prior.sim_version).toBe(285);
    expect(typeof prior.model_digest).toBe('string');
    expect(api.SIM_VERSION).toBeGreaterThan(prior.sim_version);
    expect(api.MODEL_DIGEST).not.toBe(prior.model_digest);
    expect(api.MODEL_DIGEST).toContain('CuZn-endmember-admission:olivenite-Zn0+adamite-Cu0+descloizite-Cu0+dominant-fraction-guards-v1');
    expect(api.MODEL_DIGEST).toContain('temperature-initiative:pyrite-chalcopyrite-bornite-native-silver-no-lower-floor+retained-ceilings+50C-bonus-span-v1');
  });

  it.each(['version', 'model', 'both'])('refuses a checksum-valid old %s identity without changing the supplied record', field => {
    const api = globalThis as any;
    const runtime = api.startSimulationCommandRuntime(api.makeSimulationStartCommand('cooling', 42));
    const encoded = JSON.stringify(api.createSimulationCheckpoint(runtime));
    expect(api.simulationStateFingerprint(api.restoreSimulationCommandRuntime(JSON.parse(encoded))))
      .toBe(api.simulationStateFingerprint(runtime));
    const checkpoint = JSON.parse(encoded);
    delete checkpoint.integrityHash;
    if (field !== 'model') checkpoint.simVersion = prior.sim_version;
    if (field !== 'version') checkpoint.modelDigest = prior.model_digest;
    checkpoint.integrityHash = api.sha256HexUtf8(JSON.stringify(checkpoint));
    const retained = JSON.stringify(checkpoint);
    expect(() => api.restoreSimulationCommandRuntime(checkpoint)).toThrow('checkpoint model identity mismatch');
    expect(JSON.stringify(checkpoint)).toBe(retained);
  });
});
