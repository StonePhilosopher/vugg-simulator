import { describe, expect, it } from 'vitest';

declare const EVENT_REGISTRY: Record<string, Function>;
declare const VugSimulator: any;
declare const setSeed: any;

describe('material-bearing generic events require authored locality payloads', () => {
  it('executes an authored replacement as an exact heterogeneous-voxel endmember', () => {
    setSeed(42);
    const scenario = (globalThis as any).SCENARIOS.asbestos_hills_crack_seal();
    const sim = new VugSimulator(scenario.conditions, scenario.events);
    const grid = sim.wall_state.voxelGridFor(sim);
    grid.voxels.at(-1).fluid.O2 = 0.123;
    const before = sim._snapshotGlobal();
    EVENT_REGISTRY.asbestos_hills_crack_seal_oxidation(sim.conditions);
    sim._propagateGlobalDelta(before);

    expect(grid.voxels.every((voxel: any) => voxel.fluid.O2 === 0.78)).toBe(true);
    expect(sim._fluidBoundaryTransactions.at(-1)).toMatchObject({
      schema: 'fluid-boundary-v1',
      step: 0,
      declarations: [{
        kind: 'replacement',
        source: 'Asbestos Hills oxidizing meteoric-water replacement',
        fields: { O2: 0.78 },
      }],
      testimony: [expect.objectContaining({
        field: 'O2',
        declaredReplacementTarget: 0.78,
        spatial: expect.objectContaining({ closed: true }),
        closed: true,
      })],
      closed: true,
    });
  });

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

  it('binds Tsumeb sulfate and Cu boundaries to exact authored event rows', () => {
    const scenario = (globalThis as any).SCENARIOS.supergene_oxidation;
    const acid = scenario._json5_spec.events
      .find((event: any) => event.type === 'supergene_acidification');
    const enrichment = scenario._json5_spec.events
      .find((event: any) => event.type === 'supergene_cu_enrichment');
    const drySeason = scenario._json5_spec.events
      .find((event: any) => event.type === 'supergene_dry_spell');
    const conditions = scenario().conditions;
    Object.assign(conditions.fluid, {
      S_sulfide: 7,
      S_sulfate: 43,
      S_elemental: 0,
      S: 50,
      sulfurPoolsExplicit: true,
      sulfateInherited: false,
      nativeSulfurPathway: null,
    });

    EVENT_REGISTRY.supergene_acidification(conditions, acid);
    expect(conditions.fluid.S_sulfide).toBe(7);
    expect(conditions.fluid.S_sulfate).toBe(63);
    expect(conditions._pending_sulfur_boundary_declarations.at(-1)).toMatchObject({
      kind: 'addition',
      pool: 'sulfate',
      amountPpmPerFluid: 20,
      source: 'Tsumeb upgradient sulfide-oxidation acid front',
    });
    const sulfateAfterAcid = conditions.fluid.S_sulfate;
    const sulfideAfterAcid = conditions.fluid.S_sulfide;
    const sulfurDeclarationCount = conditions._pending_sulfur_boundary_declarations.length;
    const cuBefore = conditions.fluid.Cu;
    const feBefore = conditions.fluid.Fe;

    const narration = EVENT_REGISTRY.supergene_cu_enrichment(conditions, enrichment);
    expect(conditions.fluid.S_sulfate).toBe(sulfateAfterAcid);
    expect(conditions.fluid.S_sulfide).toBe(sulfideAfterAcid);
    expect(conditions.fluid.Cu).toBe(cuBefore + 50);
    expect(conditions.fluid.Fe).toBe(feBefore + 10);
    expect(conditions.fluid.O2).toBe(0.6);
    expect(conditions._pending_sulfur_boundary_declarations).toHaveLength(sulfurDeclarationCount);
    expect(conditions._pending_fluid_boundary_declarations.at(-1)).toEqual({
      kind: 'addition',
      source: 'Tsumeb Cu-bearing oxidized leachate boundary',
      fields: { Cu: 50, Fe: 10 },
    });
    expect(narration).toMatch(/does not yet execute.*parent-solid replacement/i);
    expect(narration).toMatch(/aspirational/i);

    const caBefore = conditions.fluid.Ca;
    EVENT_REGISTRY.supergene_dry_spell(conditions, drySeason);
    expect(conditions.fluid.S_sulfide).toBe(sulfideAfterAcid);
    expect(conditions.fluid.S_sulfate).toBe(sulfateAfterAcid + 350);
    expect(conditions.fluid.Ca).toBe(caBefore + 350);
    expect(conditions.temperature).toBe(50);
    expect(conditions.fluid.O2).toBe(1.5);
    expect(conditions.flow_rate).toBe(0.3);
    expect(conditions.fluid_surface_ring).toBe(8);
    expect(conditions._pending_sulfur_boundary_declarations.at(-1)).toEqual({
      kind: 'addition',
      pool: 'sulfate',
      amountPpmPerFluid: 350,
      source: 'Tsumeb dry-season sulfate recharge',
    });
    expect(conditions._pending_fluid_boundary_declarations.at(-1)).toEqual({
      kind: 'addition',
      source: 'Tsumeb dry-season Ca recharge',
      fields: { Ca: 350 },
    });

    const expectAtomicRejection = (eventType: string, payload: any) => {
      const invalid = scenario().conditions;
      const before = structuredClone({
        temperature: invalid.temperature,
        flow_rate: invalid.flow_rate,
        fluid: invalid.fluid,
        sulfur: invalid._pending_sulfur_boundary_declarations || null,
        generic: invalid._pending_fluid_boundary_declarations || null,
      });
      expect(() => EVENT_REGISTRY[eventType](invalid, payload)).toThrow();
      expect(structuredClone({
        temperature: invalid.temperature,
        flow_rate: invalid.flow_rate,
        fluid: invalid.fluid,
        sulfur: invalid._pending_sulfur_boundary_declarations || null,
        generic: invalid._pending_fluid_boundary_declarations || null,
      })).toEqual(before);
    };

    expectAtomicRejection('supergene_acidification', undefined);
    expectAtomicRejection('supergene_acidification', {
      ...structuredClone(acid),
      sulfur_boundary: {
        ...structuredClone(acid.sulfur_boundary),
        pools: { sulfide: 20 },
      },
    });
    expectAtomicRejection('supergene_acidification', {
      ...structuredClone(acid),
      sulfur_boundary: {
        ...structuredClone(acid.sulfur_boundary),
        pools: { sulfate: 30 },
      },
    });
    const publicSpecPoison = {
      ...structuredClone(acid),
      sulfur_boundary: {
        ...structuredClone(acid.sulfur_boundary),
        pools: { sulfate: 30 },
      },
    };
    scenario._json5_spec.events.push(publicSpecPoison);
    try {
      expectAtomicRejection('supergene_acidification', publicSpecPoison);
    } finally {
      scenario._json5_spec.events.pop();
    }
    expectAtomicRejection('supergene_acidification', {
      ...structuredClone(acid), material_authority: '',
    });
    expectAtomicRejection('supergene_cu_enrichment', {
      ...structuredClone(enrichment),
      sulfur_boundary: { kind: 'addition', pools: { sulfide: 30 }, source: 'forged' },
    });
    expectAtomicRejection('supergene_cu_enrichment', {
      ...structuredClone(enrichment), fluid_transform: { add: { Cu: 0, Fe: 10 } },
    });
    expectAtomicRejection('supergene_cu_enrichment', {
      ...structuredClone(enrichment), model_scope: '',
    });
    expectAtomicRejection('supergene_dry_spell', undefined);
    expectAtomicRejection('supergene_dry_spell', {
      ...structuredClone(drySeason),
      sulfur_boundary: {
        ...structuredClone(drySeason.sulfur_boundary),
        pools: { sulfide: 350 },
      },
    });
    expectAtomicRejection('supergene_dry_spell', {
      ...structuredClone(drySeason),
      fluid_transform: { ...structuredClone(drySeason.fluid_transform), add: { Ca: 351 } },
    });
  });

  it('fails a generic boundary receipt when one canonical voxel misses the event delta', () => {
    const scenario = (globalThis as any).SCENARIOS.supergene_oxidation;
    const enrichment = scenario._json5_spec.events
      .find((event: any) => event.type === 'supergene_cu_enrichment');
    const { conditions } = scenario();
    const sim = new (globalThis as any).VugSimulator(conditions, []);
    const grid = sim.wall_state.voxelGridFor(sim);
    const original = grid.propagateEventDelta.bind(grid);
    grid.propagateEventDelta = (...args: any[]) => {
      original(...args);
      grid.voxels[0].fluid.Cu -= 50;
    };
    const snap = sim._snapshotGlobal({ captureLegacySulfur: true });
    EVENT_REGISTRY.supergene_cu_enrichment(sim.conditions, enrichment);
    sim._propagateGlobalDelta(snap);
    const transaction = sim._fluidBoundaryTransactions.at(-1);
    const copper = transaction.testimony.find((row: any) => row.field === 'Cu');
    expect(copper.spatial).toMatchObject({
      count: grid.voxels.length,
      afterCount: grid.voxels.length,
      beforeFiniteCount: grid.voxels.length,
      afterFiniteCount: grid.voxels.length,
      closed: false,
    });
    expect(copper.spatial.error).toBeCloseTo(-50, 10);
    expect(copper.closed).toBe(false);
    expect(transaction.closed).toBe(false);
    expect(sim._fluidBoundaryViolations.at(-1)).toBe(transaction);
  });

  it('rejects coerced pre-boundary values and a missing canonical voxel fluid', () => {
    const scenario = (globalThis as any).SCENARIOS.supergene_oxidation;
    const enrichment = scenario._json5_spec.events
      .find((event: any) => event.type === 'supergene_cu_enrichment');
    for (const forged of [null, true, '1']) {
      const { conditions } = scenario();
      const sim = new (globalThis as any).VugSimulator(conditions, []);
      const grid = sim.wall_state.voxelGridFor(sim);
      grid.voxels[0].fluid.Cu = forged;
      const snap = sim._snapshotGlobal({ captureLegacySulfur: true });
      EVENT_REGISTRY.supergene_cu_enrichment(sim.conditions, enrichment);
      sim._propagateGlobalDelta(snap);
      const transaction = sim._fluidBoundaryTransactions.at(-1);
      const copper = transaction.testimony.find((row: any) => row.field === 'Cu');
      expect(copper.spatial.beforeFiniteCount).toBe(grid.voxels.length - 1);
      expect(copper.spatial.closed).toBe(false);
      expect(transaction.closed).toBe(false);
    }

    const { conditions } = scenario();
    const sim = new (globalThis as any).VugSimulator(conditions, []);
    const grid = sim.wall_state.voxelGridFor(sim);
    const snap = sim._snapshotGlobal({ captureLegacySulfur: true });
    EVENT_REGISTRY.supergene_cu_enrichment(sim.conditions, enrichment);
    grid.voxels[0].fluid = null;
    expect(() => sim._propagateGlobalDelta(snap)).toThrow(/canonical voxel 0 has no fluid authority/);
    expect(sim._fluidBoundaryTransactions).toEqual([]);
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
