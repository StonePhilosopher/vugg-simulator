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

  it('requires explicit sulfur valence and applies the Elmwood endmember atomically', () => {
    const scenario = (globalThis as any).SCENARIOS.elmwood;
    const payload = scenario._json5_spec.events
      .find((event: any) => event.type === 'elmwood_fluid_mixing');
    const conditions = scenario().conditions;
    const before = structuredClone(conditions.fluid);
    EVENT_REGISTRY.elmwood_fluid_mixing(conditions, payload);
    expect(conditions.fluid.Zn).toBe(before.Zn + 110);
    expect(conditions.fluid.S_sulfide).toBeCloseTo(95, 12);
    expect(conditions.fluid.S_sulfate).toBeCloseTo(25, 12);
    expect(conditions.fluid.S).toBeCloseTo(120, 12);

    const invalid = scenario().conditions;
    const snapshot = {
      temperature: invalid.temperature,
      fluid: structuredClone(invalid.fluid),
      flow_rate: invalid.flow_rate,
    };
    expect(() => EVENT_REGISTRY.elmwood_fluid_mixing(invalid, {
      ...payload,
      sulfur_boundary: { kind: 'addition', pools: { combined: 120 } },
    })).toThrow(/invalid sulfur-boundary pool/);
    expect(invalid.temperature).toBe(snapshot.temperature);
    expect(invalid.fluid).toEqual(snapshot.fluid);
    expect(invalid.flow_rate).toBe(snapshot.flow_rate);
  });

  it('books the Elmwood barite pulse into sulfate only and fails closed without its authority', () => {
    const scenario = (globalThis as any).SCENARIOS.elmwood;
    const mixing = scenario._json5_spec.events
      .find((event: any) => event.type === 'elmwood_fluid_mixing');
    const stage = scenario._json5_spec.events
      .find((event: any) => event.type === 'elmwood_barite_stage');
    const conditions = scenario().conditions;
    EVENT_REGISTRY.elmwood_fluid_mixing(conditions, mixing);
    expect(conditions.fluid.S_sulfide).toBeCloseTo(95, 12);
    expect(conditions.fluid.S_sulfate).toBeCloseTo(25, 12);

    EVENT_REGISTRY.elmwood_barite_stage(conditions, stage);
    expect(conditions.fluid.Ba).toBe(28);
    expect(conditions.fluid.S_sulfide).toBeCloseTo(95, 12);
    expect(conditions.fluid.S_sulfate).toBeCloseTo(106, 12);
    expect(conditions.fluid.S).toBeCloseTo(201, 12);
    expect(conditions._pending_sulfur_boundary_declarations.at(-1)).toMatchObject({
      kind: 'addition', pool: 'sulfate', amountPpmPerFluid: 81,
    });

    const hiatus = scenario._json5_spec.events
      .find((event: any) => event.type === 'elmwood_interpulse_film');
    EVENT_REGISTRY.elmwood_interpulse_film(conditions, hiatus);
    expect(conditions.fluid.Ba).toBe(4);
    expect(conditions.fluid.S_sulfide).toBeCloseTo(95, 12);
    expect(conditions.fluid.S_sulfate).toBeCloseTo(106, 12);
    expect(conditions._pending_fluid_boundary_declarations.at(-1)).toMatchObject({
      kind: 'replacement', fields: { Ba: 4 },
    });
    expect(conditions._pending_fluid_replace_fields).toContain('Ba');

    EVENT_REGISTRY.elmwood_barite_stage(conditions, stage);
    expect(conditions.fluid.Ba).toBe(28);
    expect(conditions._pending_fluid_boundary_declarations.at(-1)).toMatchObject({
      kind: 'addition', fields: { Ba: 24 },
    });

    const invalid = scenario().conditions;
    const before = structuredClone(invalid.fluid);
    expect(() => EVENT_REGISTRY.elmwood_barite_stage(invalid, {
      ...stage,
      material_authority: '',
    })).toThrow(/sulfate_floor_ppm and material_authority/);
    expect(invalid.fluid).toEqual(before);

    const wrongValence = scenario().conditions;
    EVENT_REGISTRY.elmwood_fluid_mixing(wrongValence, mixing);
    wrongValence.fluid.S_sulfide = 1_000_000;
    wrongValence.fluid.S_sulfate = 0;
    wrongValence.fluid.S = 1_000_000;
    EVENT_REGISTRY.elmwood_barite_stage(wrongValence, stage);
    expect(wrongValence.fluid.S_sulfide).toBe(1_000_000);
    expect(wrongValence.fluid.S_sulfate).toBe(106);
  });

  it('fails closed on player-facing Elmwood film claims unless every event discloses the hypothesis boundary', () => {
    const events = (globalThis as any).SCENARIOS.elmwood._json5_spec.events
      .filter((event: any) => event.type === 'elmwood_interpulse_film');
    expect(events.map((event: any) => event.step)).toEqual([40, 60, 78]);
    for (const event of events) {
      expect(event.description).toMatch(/model hypothesis/i);
      expect(event.description).toMatch(/not documented/i);
      expect(event.material_authority).toMatch(/do not document.*coatings/i);
      expect(event.material_authority).toMatch(/Grigor'ev 1965/i);
      expect(event.material_authority).toMatch(/Sunagawa 2005/i);
      expect(event.material_authority).toMatch(/simulator hypothesis/i);

      const conditions = (globalThis as any).SCENARIOS.elmwood().conditions;
      const narration = EVENT_REGISTRY.elmwood_interpulse_film(conditions, event);
      expect(narration).toMatch(/^MODEL HYPOTHESIS:/);
      expect(narration).toMatch(/locality limitation/i);
    }
  });
});
