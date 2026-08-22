import { describe, expect, it } from 'vitest';

declare const EVENT_REGISTRY: Record<string, Function>;

describe('material-bearing generic events require authored locality payloads', () => {
  it('fails closed without a material authority', () => {
    const conditions = { fluid: { SiO2: 100, Fe: 10, Mn: 2, pH: 7 }, flow_rate: 1 };
    expect(() => EVENT_REGISTRY.fluid_pulse(conditions, {})).toThrow(/fluid_transform and material_authority/);
    expect(conditions.fluid).toEqual({ SiO2: 100, Fe: 10, Mn: 2, pH: 7 });
  });

  it('applies only the explicitly named reservoirs', () => {
    const conditions = {
      fluid: { SiO2: 100, Fe: 10, Mn: 2, Ni: 5, Mg: 20, pH: 7 }, flow_rate: 1,
    };
    EVENT_REGISTRY.fluid_pulse(conditions, {
      fluid_transform: { add: { Ni: 10, Mg: 30 }, pH_delta: 0.2, flow_rate: 3 },
      material_authority: 'bounded test authority',
    });
    expect(conditions.fluid).toEqual({ SiO2: 100, Fe: 10, Mn: 2, Ni: 15, Mg: 50, pH: 7.2 });
    expect(conditions.flow_rate).toBe(3);
  });

  it('validates the complete transform before mutating any reservoir', () => {
    const conditions = {
      temperature: 200,
      fluid: { SiO2: 100, Fe: 10, pH: 7 },
      flow_rate: 1,
    };
    expect(() => EVENT_REGISTRY.fluid_pulse(conditions, {
      fluid_transform: { multiply: { SiO2: 2 }, add: { imaginary_species: 10 } },
      material_authority: 'invalid test authority',
    })).toThrow(/unsupported addition/);
    expect(conditions).toEqual({
      temperature: 200,
      fluid: { SiO2: 100, Fe: 10, pH: 7 },
      flow_rate: 1,
    });

    expect(() => EVENT_REGISTRY.cooling_pulse(conditions, {
      temperature_delta_C: -50,
      fluid_transform: { multiply: { SiO2: 2 }, pH_delta: 'not-a-number' },
      material_authority: 'invalid cooling authority',
    })).toThrow(/invalid pH_delta/);
    expect(conditions.temperature).toBe(200);
    expect(conditions.fluid.SiO2).toBe(100);
  });

  it('rejects negative inventories and generic sulfur edits atomically', () => {
    for (const fluid_transform of [
      { add: { Fe: -1000 } },
      { add: { S_sulfate: 10 } },
      { pH_delta: 20 },
    ]) {
      const conditions = {
        fluid: { Fe: 10, S: 20, S_sulfate: 20, pH: 7 }, flow_rate: 1,
      };
      const before = structuredClone(conditions);
      expect(() => EVENT_REGISTRY.fluid_pulse(conditions, {
        fluid_transform,
        material_authority: 'negative control',
      })).toThrow();
      expect(conditions).toEqual(before);
    }
  });

  it('allows an authored heat-only cooling event without hidden solute changes', () => {
    const conditions = { temperature: 200, fluid: { SiO2: 100 }, flow_rate: 1 };
    EVENT_REGISTRY.cooling_pulse(conditions, {
      temperature_delta_C: -50,
      material_authority: 'heat-only boundary',
    });
    expect(conditions.temperature).toBe(150);
    expect(conditions.fluid.SiO2).toBe(100);
  });
});
