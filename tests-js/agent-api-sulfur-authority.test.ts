import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const agent = require(path.resolve(process.cwd(), 'agent-api/vugg-agent.js'));

const {
  FluidChemistry,
  VugConditions,
  event_mvt_fluid_mixing,
  FLUID_PRESETS,
} = agent;

function sulfideConditions(overrides: Record<string, number>) {
  return new VugConditions({
    temperature: 200,
    fluid: new FluidChemistry({
      Zn: 150,
      Fe: 80,
      Cu: 120,
      Pb: 80,
      Mo: 50,
      O2: 0.2,
      pH: 6.5,
      ...overrides,
    }),
  });
}

describe('headless agent sulfur-valence authority', () => {
  it('rejects the ambiguous legacy combined-S input', () => {
    expect(() => new FluidChemistry({ S: 120 })).toThrow(/Ambiguous fluid\.S/);
  });

  it('does not admit or inflate any mirrored sulfide with the wrong-valence pool', () => {
    const methods = [
      'supersaturation_sphalerite',
      'supersaturation_pyrite',
      'supersaturation_chalcopyrite',
      'supersaturation_galena',
      'supersaturation_molybdenite',
    ];
    const wrongOnly = sulfideConditions({ S_sulfide: 0, S_sulfate: 100000 });
    const correctOnly = sulfideConditions({ S_sulfide: 100, S_sulfate: 0 });
    const correctPlusWrong = sulfideConditions({ S_sulfide: 100, S_sulfate: 100000 });
    for (const method of methods) {
      expect(wrongOnly[method](), method).toBe(0);
      expect(correctOnly[method](), method).toBeGreaterThan(0);
      expect(correctPlusWrong[method](), method).toBeCloseTo(correctOnly[method](), 12);
    }
  });

  it('does not admit or inflate selenite with sulfide sulfur', () => {
    const make = (S_sulfide: number, S_sulfate: number) => new VugConditions({
      temperature: 25,
      fluid: new FluidChemistry({ Ca: 100, O2: 1, pH: 7, S_sulfide, S_sulfate }),
    });
    expect(make(100000, 0).supersaturation_selenite()).toBe(0);
    const correct = make(0, 100).supersaturation_selenite();
    expect(correct).toBeGreaterThan(0);
    expect(make(100000, 100).supersaturation_selenite()).toBeCloseTo(correct, 12);
  });

  it('mirrors the locality-owned Tri-State 90/30 mixing boundary exactly', () => {
    const conditions = new VugConditions({
      temperature: 180,
      scenario_id: 'mvt',
      fluid: new FluidChemistry({
        Zn: 0,
        Ca: 300,
        F: 5,
        Pb: 40,
        Fe: 15,
        S_sulfide: 0,
        S_sulfate: 0,
      }),
    });
    event_mvt_fluid_mixing(conditions);
    expect(conditions.temperature).toBe(160);
    expect(conditions.flow_rate).toBe(4);
    expect(conditions.fluid).toMatchObject({
      Zn: 150,
      Ca: 400,
      F: 45,
      Pb: 65,
      Fe: 45,
      S_sulfide: 90,
      S_sulfate: 30,
      S_elemental: 0,
    });
    expect(agent.event_fluid_mixing).toBeUndefined();
    expect(FLUID_PRESETS.mvt.fluid).toMatchObject({ S_sulfide: 90, S_sulfate: 30 });
    expect(FLUID_PRESETS.mvt.fluid).not.toHaveProperty('S');
  });

  it('rejects direct reuse of the Tri-State event by another or unclaimed locality', () => {
    for (const scenario_id of ['elmwood', null]) {
      const wrong = new VugConditions({
        temperature: 180,
        scenario_id,
        fluid: new FluidChemistry({ Zn: 0, S_sulfide: 0, S_sulfate: 0 }),
      });
      expect(() => event_mvt_fluid_mixing(wrong)).toThrow(/belongs to scenario 'mvt'/);
      expect(wrong.fluid).toMatchObject({ Zn: 0, S_sulfide: 0, S_sulfate: 0 });
      expect(wrong.temperature).toBe(180);
    }
  });
});
