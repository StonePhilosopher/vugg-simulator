import { beforeAll, describe, expect, it } from 'vitest';

declare const Crystal: any;
declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const grow_celestine: any;
declare const _runEngineFluidTransaction: any;
declare const _applyAcceptedCrystalMutations: any;
declare const recordCelestineGrowthStep: any;
declare const celestineGrowthHistoryAtStep: any;
declare const celestinePresentation: any;
declare const _topoHistoricalCrystalSize: any;
declare const _topoCrystalsSignature: any;
declare const _topoCelestineNotice: any;
declare const simulationStateProjection: any;
declare const THREE: any;
declare const WallState: any;
declare const _topoSyncCrystalMeshes: any;
declare const StripRecorder: any;
declare const buildCrystalRecord: any;
declare const reconstructCrystalFromRecord: any;
declare const assertCrystalCollectionRecord: any;
declare const _inventoryHistoricalView: any;

const copy = (v: any) => JSON.parse(JSON.stringify(v));
const conditions = () => ({
  fluid: { S: 400, Ba: 28, Sr: 30, Mn: 0, Fe: 0, pH: 6.5, salinity: 21 },
  wall: { composition: 'dolomite' }, temperature: 75,
  supersaturation_celestine: () => 3,
});
function accept(c: any, env: any, step: number) {
  const z = _runEngineFluidTransaction(grow_celestine, c, env, step);
  _applyAcceptedCrystalMutations(c, z);
  c.add_zone(z);
  recordCelestineGrowthStep({ crystals: [c], step });
  return z;
}

describe('celestine lineage authority', () => {
  it('records accepted local fluid evidence without claiming solid Ba incorporation', () => {
    setSeed(42);
    const c = new Crystal({ mineral: 'celestine', crystal_id: 1, nucleation_step: 1 });
    const env = conditions();
    const z = accept(c, env, 1);
    const history = copy(z.celestine_history);
    env.fluid.Ba = 4;
    accept(c, env, 2);
    expect(z.celestine_history).toEqual(history);
    expect(Object.isFrozen(z.celestine_history.fluid)).toBe(true);
    expect(z.celestine_history.fluid.Ba_ppm).toBe(28);
    expect(z.celestine_history.morphology).toMatchObject({
      status: 'procedural-approximation', display_habit: 'fibrous_blanket',
      solid_Ba_mole_fraction: null, solid_Ba_status: 'incorporation-not-modeled',
    });
    expect(c.zones[1].celestine_history.morphology).toMatchObject({
      status: 'unresolved', legacy_classifier_habit: 'nodular', display_habit: 'fibrous_blanket',
    });
    expect(c.zones[1].note).not.toMatch(/Madagascar|Ba-substituted|Ba-bearing/);
    expect(c.habit).toBe('nodular'); // unchanged, explicitly legacy accounting
    expect(celestinePresentation(c).habit).toBe('fibrous_blanket');
    expect(celestinePresentation(c).c_length_mm).toBe(history.end_of_step.c_length_mm);
    expect(c.c_length_mm).toBeGreaterThan(history.end_of_step.c_length_mm);
    env.fluid.Ba = 28;
    accept(c, env, 3);
    expect(c.zones[2].celestine_history.morphology.status).toBe('unresolved');
    expect(celestinePresentation(c).celestine_presentation_step).toBe(1);
  });

  it('does not record rejected growth or mutate lineage during a dry run', () => {
    const c = new Crystal({ mineral: 'celestine', crystal_id: 2 });
    const before = JSON.stringify(c);
    const z = _runEngineFluidTransaction(grow_celestine, c, conditions(), 1);
    expect(JSON.stringify(c)).toBe(before);
    z.thickness_um = 0;
    _applyAcceptedCrystalMutations(c, z);
    recordCelestineGrowthStep({ crystals: [c], step: 1 });
    expect(JSON.stringify(c)).toBe(before);
    expect(z.celestine_history).toBeUndefined();
  });

  it('keeps old records explicit about missing history and does not invent it', () => {
    const c = new Crystal({ mineral: 'celestine', habit: 'nodular' });
    c.zones.push({ step: 1, thickness_um: 1000 });
    const before = JSON.stringify(c);
    expect(celestineGrowthHistoryAtStep(c, 1)).toBeNull();
    expect(celestinePresentation(c, 1).celestine_disclosure).toContain('historical form unavailable');
    expect(JSON.stringify(c)).toBe(before);
  });

  it('preserves receipts through JSON export and ignores later habit/split state in replay', () => {
    const c = new Crystal({ mineral: 'celestine', crystal_id: 1 });
    accept(c, conditions(), 1);
    const firstSize = { c_length_mm: c.c_length_mm, a_width_mm: c.a_width_mm };
    c._split = { index: 1, rung: 'spherulite' };
    const env = conditions(); env.fluid.Ba = 4;
    accept(c, env, 2);
    const restored = copy(c);
    restored.habit = 'tabular'; restored._split.index = 0.7;
    expect(_topoHistoricalCrystalSize(restored, 1)).toEqual(firstSize);
    expect(celestinePresentation(restored, 1)._split).toBeNull();
    expect(celestinePresentation(restored).celestine_disclosure).toContain('later morphology unresolved');
    expect(_topoHistoricalCrystalSize(restored, -1)).toBeNull();
  });

  it('shows uncertainty beside the specimen and clears it for a different specimen', () => {
    const panel = document.createElement('div'); document.body.appendChild(panel);
    // setup.ts substitutes proxies for absent UI IDs; install a real notice.
    const notice = document.createElement('div'); notice.id = 'topo-celestine-notice';
    panel.appendChild(notice);
    const c = new Crystal({ mineral: 'celestine' });
    accept(c, conditions(), 1);
    const env = conditions(); env.fluid.Ba = 4; accept(c, env, 2);
    _topoCelestineNotice(panel, { crystals: [celestinePresentation(c)] });
    expect(notice.textContent).toContain('Growth continues');
    expect(notice.hidden).toBe(false);
    _topoCelestineNotice(panel, { crystals: [] });
    expect(notice.hidden).toBe(true);
    panel.remove();
  });

  it('rebuilds historical Three.js geometry after disposal without final habit or split leakage', () => {
    const wall = new WallState({ cells_per_ring: 48, ring_count: 12, vug_diameter_mm: 70, shape_seed: 42 });
    const c = new Crystal({ mineral: 'celestine', crystal_id: 12, nucleation_step: 1,
      wall_anchor: wall._anchorFromRingCell(6, 12) });
    const env = conditions(); accept(c, env, 1);
    const sim = { crystals: [c], wall_state: wall, step: 1 };
    const state = { crystals: new THREE.Group(), geomCache: new Map(), crystalsSig: null,
      clipUniforms: { uVugRadius: { value: 35 } } };
    const meshBytes = () => state.crystals.children.map((mesh: any) => ({
      positions: Array.from(mesh.geometry.attributes.position.array),
      scale: mesh.scale.toArray(), position: mesh.position.toArray(),
      rotation: mesh.quaternion.toArray(),
    }));
    try {
      _topoSyncCrystalMeshes(state, sim, wall, 1);
      const before = meshBytes();
      expect(before.length).toBeGreaterThan(0);
      env.fluid.Ba = 4; c._split = { index: 1, rung: 'spherulite' };
      accept(c, env, 2); sim.step = 2;
      const solid = JSON.stringify(c);
      _topoSyncCrystalMeshes(state, { ...sim, crystals: [] }, wall);
      for (const geometry of state.geomCache.values()) geometry.dispose();
      state.geomCache.clear();
      _topoSyncCrystalMeshes(state, sim, wall, 1);
      expect(meshBytes()).toEqual(before);
      expect(JSON.stringify(c)).toBe(solid);
    } finally {
      _topoSyncCrystalMeshes(state, { ...sim, crystals: [] }, wall);
      for (const geometry of state.geomCache.values()) geometry.dispose();
    }
  });
});

describe('Elmwood seed 42 temporal regression', () => {
  let sim: any;
  let at77: any[];
  let origins: any[];
  beforeAll(() => {
    setSeed(42);
    const { conditions: env, events } = SCENARIOS.elmwood();
    sim = new VugSimulator(env, events);
    for (let i = 0; i < 200; i++) {
      sim.run_step();
      if (sim.step === 77) {
        at77 = sim.crystals.filter((c: any) => c.mineral === 'celestine').map((c: any) => ({
          id: c.crystal_id, zones: copy(c.zones),
          c_length_mm: c.c_length_mm, a_width_mm: c.a_width_mm,
        }));
        origins = sim.crystals.filter((c: any) => c.mineral === 'celestine').map((c: any) => copy(c.celestine_origin));
      }
    }
  }, 120000);

  it('retains all six origins and pre-78 zones exactly through step 200', () => {
    const cs = sim.crystals.filter((c: any) => c.mineral === 'celestine');
    expect(cs).toHaveLength(6);
    expect(cs.map((c: any) => c.celestine_origin)).toEqual(origins);
    for (const old of at77) {
      const c = cs.find((v: any) => v.crystal_id === old.id);
      expect(c.zones.slice(0, old.zones.length)).toEqual(old.zones);
      expect(_topoHistoricalCrystalSize(c, 77)).toEqual({ c_length_mm: old.c_length_mm, a_width_mm: old.a_width_mm });
      expect(c.zones.find((z: any) => z.step === 78).celestine_history.morphology.status).toBe('unresolved');
      expect(c.zones.at(-1).celestine_history.morphology.status).toBe('unresolved');
    }
  });

  it('matches the original fab4f8cd diagnosis for growth dimensions and volumes', () => {
    // Independent pre-fix seed-42 observations, not newly blessed output.
    const expected = [
      [10, 4.765529410551013, 4.7742783614429065, 56.875502909111894],
      [11, 4.778627737880193, 4.786407457663294, 57.32197626697524],
      [12, 4.308554139287043, 4.316546268712144, 42.034218521396724],
      [13, 4.6092701362946755, 4.615069236031276, 51.40285315207942],
      [14, 4.297441029896581, 4.301201793571428, 41.62825293773554],
      [15, 1.3490853505412683, 0.8741395771020424, 0.5397586561323083],
    ];
    const cs = sim.crystals.filter((c: any) => c.mineral === 'celestine');
    expect(cs.map((c: any) => [c.crystal_id, c.c_length_mm, c.a_width_mm, c._volume_mm3])).toEqual(expected);
    const zs = cs.flatMap((c: any) => c.zones);
    expect(zs).toHaveLength(930);
    expect(zs.every((z: any) => z.celestine_history.morphology.solid_Ba_mole_fraction === null)).toBe(true);
    expect(zs.every((z: any) => !z._budget_inventory_per_um?.Ba)).toBe(true);
    expect(zs.every((z: any) => !z.solid_solution && !z.formula_stoichiometry)).toBe(true);
  });

  it('reports unresolved growth and makes presentation independent of future mutable fields', () => {
    expect(sim.format_summary().join('\n')).not.toContain('Madagascar');
    expect(sim.format_summary().join('\n')).toContain('later morphology unresolved');
    const before = JSON.stringify(simulationStateProjection(sim));
    const first = _topoCrystalsSignature(sim, sim.wall_state, 77);
    for (const c of sim.crystals) {
      if (c.mineral !== 'celestine') continue;
      for (const step of [31, 76, 77, 78, 200]) celestinePresentation(c, step);
    }
    expect(_topoCrystalsSignature(sim, sim.wall_state, 77)).toBe(first);
    expect(JSON.stringify(simulationStateProjection(sim))).toBe(before);
  });

  it('exports the full zone receipts alongside explicitly qualified numerical habits', () => {
    const recorder = new StripRecorder(sim, { duration_steps: 1, notes: 'lineage export witness' });
    recorder.captureStep(sim);
    const exported = recorder.finalize();
    const layers = exported.layer_growth_testimony.filter((z: any) => z.mineral === 'celestine');
    expect(layers).toHaveLength(930);
    expect(layers.every((z: any) => z.celestine_history?.step === z.step)).toBe(true);
    for (const row of exported.habit_morphology_testimony.filter((c: any) => c.mineral === 'celestine')) {
      expect(row.habit_authority).toBe('legacy-numerical-classifier-not-lineage-identity');
      expect(row.celestine_origin.nucleation_step).toBeLessThan(78);
      expect(row.celestine_morphology.status).toBe('unresolved');
      expect(row.celestine_disclosure).not.toContain('Madagascar');
    }
  });

  it('retains lineage through Library collection and historical inventory inspection', () => {
    const c = sim.crystals.find((v: any) => v.mineral === 'celestine');
    const record = buildCrystalRecord(c, { mode: 'simulation', scenario: 'elmwood', seed: 42 });
    expect(assertCrystalCollectionRecord(record)).toBe(true);
    expect(record.habit).toBe('fibrous_blanket');
    expect(record.celestine_legacy_accounting_habit).toBe('nodular');
    expect(record.celestine_origin).toEqual(c.celestine_origin);
    const restored = reconstructCrystalFromRecord(copy(record));
    expect(restored.zones.map((z: any) => z.celestine_history)).toEqual(c.zones.map((z: any) => z.celestine_history));
    expect(Object.isFrozen(restored.zones[0].celestine_history)).toBe(true);
    expect(restored.describe_morphology()).toContain('later morphology unresolved');
    const historical = _inventoryHistoricalView(restored, 77);
    expect(historical.c_length_mm).toBe(at77[0].c_length_mm);
    expect(historical.a_width_mm).toBe(at77[0].a_width_mm);
    expect(historical.habit).toBe('fibrous_blanket');
    expect(historical.zones.every((z: any) => z.step <= 77)).toBe(true);
    expect(_inventoryHistoricalView(c).c_length_mm).toBe(c.c_length_mm);
    const corrupt = copy(record);
    corrupt.zones[0].celestine_history.end_of_step.a_width_mm = 'invented';
    expect(() => reconstructCrystalFromRecord(corrupt)).toThrow('invalid celestine history');
    const inventedBa = copy(record);
    inventedBa.zones[0].celestine_history.morphology.solid_Ba_mole_fraction = 0.25;
    expect(() => assertCrystalCollectionRecord(inventedBa)).toThrow('invalid celestine history');
  });
});
