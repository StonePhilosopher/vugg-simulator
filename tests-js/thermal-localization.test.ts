// SIM 256 — localized LTE temperature transport and engine consumption.

import { describe, expect, it } from 'vitest';

declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const GrowthZone: any;
declare const setSeed: any;
declare const makeSimulationStartCommand: any;
declare const makeSimulationAdvanceCommand: any;
declare const makeSimulationThermalSourceCommand: any;
declare const makeSimulationThermalFieldCommand: any;
declare const startSimulationCommandRuntime: any;
declare const applySimulationCommand: any;
declare const createSimulationCheckpoint: any;
declare const restoreSimulationCommandRuntime: any;
declare const simulationStateFingerprint: any;
declare const _nuc_quartz: any;
declare const _nuc_barite: any;
declare const _buildMineralFormationExplanation: any;
declare const classifyMorphologyStep: any;
declare const classifyWulffForm: any;
declare const selectHabitVariant: any;

function makeSim(name = 'mvt') {
  setSeed(42);
  const { conditions, events } = SCENARIOS[name]();
  return new VugSimulator(conditions, events);
}

describe('localized thermal field', () => {
  it('keeps a uniform source-free field exactly unchanged', () => {
    const sim = makeSim();
    const grid = sim.wall_state.voxelGridFor(sim);
    const before = grid.voxels.map((voxel: any) => voxel.temperature);
    const mean = grid.temperatureMean();
    grid.advanceTemperatureField({
      step: 0,
      conduction_fraction_per_step: 1 / 6,
      sources: [],
    });
    expect(grid.voxels.map((voxel: any) => voxel.temperature)).toEqual(before);
    expect(grid.temperatureMean()).toBe(mean);
  });

  it('uses unequal geometry-aware volumes and conserves their weighted thermal proxy', () => {
    const sim = makeSim();
    const grid = sim.wall_state.voxelGridFor(sim);
    const weights = grid.controlVolumeWeights();
    expect(Array.from(weights).reduce((sum: number, value: any) => sum + value, 0))
      .toBeCloseTo(1, 12);
    expect(grid.controlVolumeWeightAt(8, 60, 0))
      .toBeGreaterThan(grid.controlVolumeWeightAt(8, 60, 3));
    const polarRingWeight = Array.from(weights).reduce((sum: number, value: any, index: number) => {
      return sum + (grid.voxels[index].ringIdx === 0 ? Number(value) : 0);
    }, 0);
    const equatorRingWeight = Array.from(weights).reduce((sum: number, value: any, index: number) => {
      return sum + (grid.voxels[index].ringIdx === 8 ? Number(value) : 0);
    }, 0);
    expect(equatorRingWeight).toBeGreaterThan(polarRingWeight);
    const baseline = grid.temperatureMean();
    grid.voxelAt(8, 60, 1).temperature = baseline + 500;
    const before = grid.temperatureMean();
    const receipt = grid.advanceTemperatureField({
      step: 1,
      conduction_fraction_per_step: 0.1,
      sources: [],
    });
    const after = grid.temperatureMean();
    expect(after).toBeCloseTo(before, 8);
    expect(Math.abs(receipt.conductionControlVolumeResidualC)).toBeLessThan(1e-8);
    expect(grid.voxelAt(8, 60, 1).temperature).toBeLessThan(baseline + 500);
    expect(grid.voxelAt(8, 60, 2).temperature).toBeGreaterThan(baseline);
  });

  it('forms a bounded gradient downstream of an explicit heat boundary', () => {
    const sim = makeSim();
    const grid = sim.wall_state.voxelGridFor(sim);
    const baseline = grid.temperatureMean();
    sim.conditions._scenario.thermal_field = {
      conduction_fraction_per_step: 0,
      wall_coupling_fraction_per_step: 0,
    };
    const source = sim.setThermalSource({
      id: 'vent-a',
      temperature_C: 500,
      ringIdx: 8,
      cellIdx: 60,
      depthIdx: 0,
      coupling_fraction_per_step: 1,
      advection_fraction_per_step: 0.5,
      flow_direction: 'toward_center',
      provenance: 'test boundary',
    });
    expect(source.id).toBe('vent-a');
    let receipt;
    for (let i = 0; i < 3; i++) receipt = sim._advanceThermalField();
    const column = [0, 1, 2, 3].map((d) => grid.temperatureAt(8, 60, d));
    expect(column[0]).toBe(500);
    expect(column[1]).toBeGreaterThan(column[2]);
    expect(column[2]).toBeGreaterThan(column[3]);
    expect(column[3]).toBeGreaterThan(baseline);
    expect(grid.temperatureAt(8, 61, 0)).toBeCloseTo(baseline, 10);
    expect(receipt.sources[0]).toMatchObject({
      id: 'vent-a', flowDirection: 'toward_center', pathCells: 3,
    });
    expect(receipt.sources[0].controlVolumeDeltaC).toBeCloseTo(
      receipt.sources[0].sourceCouplingControlVolumeDeltaC
        + receipt.sources[0].advectionControlVolumeDeltaC,
      10,
    );
    expect(receipt.unitsDisclosure).toContain('not joules');
  });

  it('keeps stored heat and conservatively relaxes it after a source is removed', () => {
    const sim = makeSim();
    const grid = sim.wall_state.voxelGridFor(sim);
    sim.conditions._scenario.thermal_field = {
      conduction_fraction_per_step: 0.1,
      wall_coupling_fraction_per_step: 0,
    };
    sim.setThermalSource({
      id: 'transient', temperature_C: 500, ringIdx: 8, cellIdx: 60, depthIdx: 0,
      coupling_fraction_per_step: 1, advection_fraction_per_step: 0,
      flow_direction: 'none',
    });
    sim._advanceThermalField();
    const hotBeforeRemoval = grid.temperatureAt(8, 60, 0);
    expect(sim.removeThermalSource('transient')).toBe(1);
    const meanBefore = grid.temperatureMean();
    const receipt = sim._advanceThermalField();
    const meanAfter = grid.temperatureMean();
    expect(receipt.sources).toEqual([]);
    expect(grid.temperatureAt(8, 60, 0)).toBeLessThan(hotBeforeRemoval);
    expect(grid.temperatureAt(8, 60, 1)).toBeGreaterThan(grid.voxels[0].temperature);
    expect(meanAfter).toBeCloseTo(meanBefore, 8);
  });

  it('distinguishes an authored 0°C rock boundary from a missing regional boundary', () => {
    const sim = makeSim();
    const grid = sim.wall_state.voxelGridFor(sim);
    const baseline = grid.temperatureMean();
    sim.conditions._scenario.thermal_field = {
      conduction_fraction_per_step: 0,
      wall_coupling_fraction_per_step: 1,
    };
    sim.conditions._scenario.wall_rock_thermal_buffer_C = { floor: 0 };
    sim._thermalFieldActivated = true;
    const receipt = sim._advanceThermalField();
    expect(grid.temperatureAt(0, 0, 0)).toBe(0);
    expect(grid.temperatureAt(8, 0, 0)).toBeCloseTo(baseline, 10);
    expect(receipt.rockControlVolumeDeltaC).toBeLessThan(0);
  });

  it('never applies a bulk cooling delta through an already-cold local voxel', () => {
    const sim = makeSim();
    const grid = sim.wall_state.voxelGridFor(sim);
    sim.conditions.wall.ambient_temperature_C = 25;
    sim.conditions.wall.thermal_pulses = false;
    const cold = grid.voxelAt(0, 0, 0);
    const warm = grid.voxelAt(8, 60, 0);
    cold.temperature = 0;
    warm.temperature = 100;
    const snap = sim._snapshotGlobal();
    sim.ambient_cooling(20);
    sim._propagateGlobalDelta(snap, { ambientThermalStep: sim._lastAmbientThermalStep });
    expect(cold.temperature).toBe(0);
    expect(warm.temperature).toBeGreaterThanOrEqual(25);
    expect(warm.temperature).toBeLessThan(100);
    expect(sim.conditions.temperature).toBeCloseTo(grid.temperatureMean(), 12);
    expect(sim.ring_temperatures[0]).toBeCloseTo(grid.boundaryTemperatureMeans()[0], 12);
  });

  it('normalizes source bounds and unsupported directions deterministically', () => {
    const sim = makeSim();
    const N = sim.wall_state.cells_per_ring;
    const source = sim.setThermalSource({
      id: 'bounded', temperature_C: -999, ringIdx: 999, cellIdx: -1, depthIdx: 999,
      coupling_fraction_per_step: 9, advection_fraction_per_step: -4,
      flow_direction: 'teleport', start_step: null, end_step: '',
    });
    expect(source).toMatchObject({
      id: 'bounded', temperature_C: -273.15,
      ringIdx: sim.wall_state.ring_count - 1, cellIdx: N - 1,
      depthIdx: 3, coupling_fraction_per_step: 1,
      advection_fraction_per_step: 0, flow_direction: 'toward_center',
    });
    expect(source).not.toHaveProperty('start_step');
    expect(source).not.toHaveProperty('end_step');
    expect(sim.configureThermalField({
      conduction_fraction_per_step: 9,
      wall_coupling_fraction_per_step: -2,
      wall_rock_thermal_buffer_C: 9999,
    })).toEqual({
      enabled: true,
      conduction_fraction_per_step: 1 / 6,
      wall_coupling_fraction_per_step: 0,
      wall_rock_thermal_buffer_C: 2000,
    });
  });

  it('lets a production quartz gate nucleate only at a locally viable hot cell', () => {
    const sim = makeSim();
    const grid = sim.wall_state.voxelGridFor(sim);
    const mesh = sim.wall_state.meshFor(sim);
    const hot = { ringIdx: 8, cellIdx: 60 };
    for (let r = 0; r < sim.wall_state.ring_count; r++) {
      for (let c = 0; c < sim.wall_state.cells_per_ring; c++) {
        grid.boundaryVoxel(r, c).temperature = 50;
        const fluid = mesh.cells[r * sim.wall_state.cells_per_ring + c].fluid;
        fluid.SiO2 = 5000;
        fluid.pH = 7;
        fluid.Ca = 0;
        fluid.Mg = 0;
        fluid.CO3 = 0;
      }
    }
    grid.boundaryVoxel(hot.ringIdx, hot.cellIdx).temperature = 250;
    sim._thermalFieldActivated = true;
    const restore = sim._installLocalizedNucleationEnvelope();
    expect(restore).toEqual(expect.any(Function));
    try {
      _nuc_quartz(sim);
    } finally {
      restore();
    }
    const quartz = sim.crystals.find((crystal: any) => crystal.mineral === 'quartz');
    expect(quartz).toBeTruthy();
    expect(quartz.wall_anchor).toMatchObject(hot);
    expect(quartz.nucleation_temp).toBe(250);
    expect(sim._localizedNucleationPeaks.quartz).toMatchObject({
      ...hot, temperatureC: 250,
    });
  });

  it('feeds the exact boundary-voxel temperature into growth and its zone record', () => {
    const sim = makeSim();
    const crystal = sim.nucleate('calcite', 'vug wall', 2);
    const anchor = crystal.wall_anchor;
    const grid = sim.wall_state.voxelGridFor(sim);
    grid.boundaryVoxel(anchor.ringIdx, anchor.cellIdx).temperature = 333.25;
    sim.ring_temperatures[anchor.ringIdx] = 111;
    const engine = (_crystal: any, conditions: any, step: number) => new GrowthZone({
      step,
      temperature: conditions.temperature,
      thickness_um: 1,
      growth_rate: 1,
      note: 'thermal localization probe',
    });
    const zone = sim._runEngineForCrystal(engine, crystal);
    expect(zone.temperature).toBe(333.25);
    expect(sim.conditions.temperature).not.toBe(333.25);
  });

  it('records a nucleation site temperature rather than the cavity mean', () => {
    const sim = makeSim();
    const ring = 2, cell = 5;
    sim.wall_state.voxelGridFor(sim).boundaryVoxel(ring, cell).temperature = 444;
    sim._assignWallCell = () => cell;
    sim._assignWallRing = () => ring;
    const crystal = sim.nucleate('quartz', 'vug wall', 2);
    expect(crystal.wall_anchor).toMatchObject({ ringIdx: ring, cellIdx: cell });
    expect(crystal.nucleation_temp).toBe(444);
  });

  it('chooses the birth habit from the sampled cell sigma, not the envelope maximum', () => {
    const sim = makeSim();
    const ring = 2, cell = 5;
    sim._assignWallCell = () => cell;
    sim._assignWallRing = () => ring;
    const mesh = sim.wall_state.meshFor(sim);
    const localFluid = mesh.cells[ring * sim.wall_state.cells_per_ring + cell].fluid;
    localFluid.SiO2 = 1.25;
    sim.conditions.supersaturation_quartz = function () { return this.fluid.SiO2; };
    setSeed(1142);
    const expected = selectHabitVariant(
      'quartz', 1.25, sim.temperatureAtVoxel(ring, cell, 0),
      sim._spaceIsCrowded(), sim._currentVugFill,
    );
    setSeed(1142);
    const crystal = sim.nucleate('quartz', 'vug wall', 5);
    expect(crystal.nucleation_sigma).toBe(1.25);
    expect(crystal.habit).toBe(expected.name);
    expect(crystal.vector).toBe(expected.vector);
  });

  it('replays immutable thermal-source commands with the same fingerprint', () => {
    const runtime = startSimulationCommandRuntime(makeSimulationStartCommand('mvt', 42));
    const command = makeSimulationThermalSourceCommand('set', {
      id: 'command-vent', temperature_C: 420, cell: 960, depthIdx: 0,
      coupling_fraction_per_step: 0.4, advection_fraction_per_step: 0.2,
      flow_direction: 'toward_center', provenance: 'command replay test',
    });
    expect(Object.isFrozen(command)).toBe(true);
    applySimulationCommand(runtime, command);
    applySimulationCommand(runtime, makeSimulationAdvanceCommand(2));
    const fingerprint = simulationStateFingerprint(runtime);
    const restored = restoreSimulationCommandRuntime(createSimulationCheckpoint(runtime));
    expect(restored.sim._thermalSources).toEqual(runtime.sim._thermalSources);
    expect(simulationStateFingerprint(restored)).toBe(fingerprint);
  });

  it('combines overlapping sources independently of their metadata IDs', () => {
    const first = makeSim(), second = makeSim();
    const specs = [
      { temperature_C: 500, ringIdx: 8, cellIdx: 60, depthIdx: 0,
        coupling_fraction_per_step: 0.8, advection_fraction_per_step: 0.4,
        flow_direction: 'toward_center' },
      { temperature_C: 100, ringIdx: 8, cellIdx: 60, depthIdx: 0,
        coupling_fraction_per_step: 0.7, advection_fraction_per_step: 0.3,
        flow_direction: 'toward_center' },
    ];
    first.configureThermalField({ conduction_fraction_per_step: 0, wall_coupling_fraction_per_step: 0 });
    second.configureThermalField({ conduction_fraction_per_step: 0, wall_coupling_fraction_per_step: 0 });
    first.setThermalSource({ id: 'a', ...specs[0] });
    first.setThermalSource({ id: 'z', ...specs[1] });
    second.setThermalSource({ id: 'z', ...specs[0] });
    second.setThermalSource({ id: 'a', ...specs[1] });
    first._advanceThermalField();
    second._advanceThermalField();
    expect(first.wall_state.voxelGridFor(first).voxels.map((v: any) => v.temperature))
      .toEqual(second.wall_state.voxelGridFor(second).voxels.map((v: any) => v.temperature));
  });

  it('uses monotonic collision-free fallback source IDs', () => {
    const sim = makeSim();
    const source = { temperature_C: 300, cell: 0, flow_direction: 'none' };
    expect(sim.setThermalSource(source).id).toBe('thermal-1');
    expect(sim.setThermalSource(source).id).toBe('thermal-2');
    sim.removeThermalSource('thermal-1');
    expect(sim.setThermalSource(source).id).toBe('thermal-3');
  });

  it('propagates direct Creative temperature edits to the canonical field', () => {
    const sim = makeSim();
    const grid = sim.wall_state.voxelGridFor(sim);
    grid.voxelAt(2, 3, 1).temperature += 40;
    const before = grid.voxels.map((v: any) => v.temperature);
    const beforeMean = grid.temperatureMean();
    const priorBulk = sim.conditions.temperature;
    sim.setGlobalTemperature(priorBulk + 25);
    expect(grid.voxels.map((v: any) => v.temperature))
      .toEqual(before.map((v: number) => v + 25));
    sim.configureThermalField({ enabled: true, conduction_fraction_per_step: 0.1,
      wall_coupling_fraction_per_step: 0 });
    sim._advanceThermalField();
    expect(sim.conditions.temperature).toBeCloseTo(beforeMean + 25, 10);
  });

  it('replays transport configuration and honors a paused field', () => {
    const runtime = startSimulationCommandRuntime(makeSimulationStartCommand('mvt', 42));
    applySimulationCommand(runtime, makeSimulationThermalSourceCommand('set', {
      temperature_C: 500, cell: 0, coupling_fraction_per_step: 1,
      advection_fraction_per_step: 0, flow_direction: 'none',
    }));
    const paused = makeSimulationThermalFieldCommand({ enabled: false,
      conduction_fraction_per_step: 0.1, wall_coupling_fraction_per_step: 0,
      wall_rock_thermal_buffer_C: 20 });
    expect(Object.isFrozen(paused)).toBe(true);
    applySimulationCommand(runtime, paused);
    const before = runtime.sim.wall_state.voxelGridFor(runtime.sim).temperatureMean();
    expect(runtime.sim._advanceThermalField()).toBeNull();
    expect(runtime.sim.wall_state.voxelGridFor(runtime.sim).temperatureMean()).toBe(before);
    const restored = restoreSimulationCommandRuntime(createSimulationCheckpoint(runtime));
    expect(restored.sim.conditions._scenario.thermal_field.enabled).toBe(false);
    expect(simulationStateFingerprint(restored)).toBe(simulationStateFingerprint(runtime));
  });

  it('makes pause/source command order invariant and fingerprints the paused state', () => {
    const source = makeSimulationThermalSourceCommand('set', {
      temperature_C: 500, cell: 0, coupling_fraction_per_step: 1,
      advection_fraction_per_step: 0, flow_direction: 'none',
    });
    const pause = makeSimulationThermalFieldCommand({
      enabled: false, conduction_fraction_per_step: 0.1,
      wall_coupling_fraction_per_step: 0,
    });
    const first = startSimulationCommandRuntime(makeSimulationStartCommand('mvt', 42));
    const second = startSimulationCommandRuntime(makeSimulationStartCommand('mvt', 42));
    applySimulationCommand(first, source);
    applySimulationCommand(first, pause);
    applySimulationCommand(second, pause);
    applySimulationCommand(second, source);
    expect(first.sim._thermalFieldActivated).toBe(true);
    expect(second.sim._thermalFieldActivated).toBe(true);
    expect(first.sim.conditions._scenario.thermal_field.enabled).toBe(false);
    expect(second.sim.conditions._scenario.thermal_field.enabled).toBe(false);
    expect(first.sim._advanceThermalField()).toBeNull();
    expect(second.sim._advanceThermalField()).toBeNull();
    expect(simulationStateFingerprint(first)).toBe(simulationStateFingerprint(second));
  });

  it('scans per-vertex chemistry even when every boundary temperature is uniform', () => {
    const sim = makeSim();
    const grid = sim.wall_state.voxelGridFor(sim), mesh = sim.wall_state.meshFor(sim);
    const target = { ringIdx: 3, cellIdx: 7 };
    for (let i = 0; i < mesh.cells.length; i++) {
      mesh.cells[i].fluid.SiO2 = 0;
      mesh.cells[i].fluid.pH = 7;
      grid.boundaryVoxel(Math.floor(i / sim.wall_state.cells_per_ring),
        i % sim.wall_state.cells_per_ring).temperature = 250;
    }
    mesh.cells[target.ringIdx * sim.wall_state.cells_per_ring + target.cellIdx].fluid.SiO2 = 5000;
    sim.conditions.fluid.SiO2 = 0;
    sim.wall_state.per_vertex_nucleation = true;
    sim._thermalFieldActivated = false;
    const restore = sim._installLocalizedNucleationEnvelope();
    expect(restore).toEqual(expect.any(Function));
    try { _nuc_quartz(sim); } finally { restore(); }
    expect(sim.crystals.find((c: any) => c.mineral === 'quartz')?.wall_anchor)
      .toMatchObject(target);
  });

  it('never lets a high bulk barite state substitute for locally impossible wall cells', () => {
    const sim = makeSim();
    const mesh = sim.wall_state.meshFor(sim);
    Object.assign(sim.conditions.fluid, {
      Ba: 1000, S: 1000, pH: 7, O2: 1, sulfateInherited: true,
    });
    expect(sim.conditions.supersaturation_barite()).toBeGreaterThan(1);
    for (const cell of mesh.cells) {
      Object.assign(cell.fluid, { Ba: 0, S: 0, sulfateInherited: true });
      expect(sim.conditions.supersaturation_barite.call({
        ...sim.conditions, fluid: cell.fluid,
      })).toBe(0);
    }
    sim.wall_state.per_vertex_nucleation = true;
    sim._thermalFieldActivated = false;
    setSeed(7);
    const restore = sim._installLocalizedNucleationEnvelope();
    expect(sim.conditions.supersaturation_barite()).toBe(0);
    try { _nuc_barite(sim); } finally { restore(); }
    expect(sim.crystals.some((crystal: any) => crystal.mineral === 'barite')).toBe(false);
  });

  it('includes median-temperature chemistry in the exact local maximum', () => {
    const sim = makeSim();
    const grid = sim.wall_state.voxelGridFor(sim), mesh = sim.wall_state.meshFor(sim);
    const target = { ringIdx: 3, cellIdx: 7 };
    for (let i = 0; i < mesh.cells.length; i++) {
      mesh.cells[i].fluid.SiO2 = 0;
      mesh.cells[i].fluid.pH = 7;
      grid.boundaryVoxel(Math.floor(i / sim.wall_state.cells_per_ring),
        i % sim.wall_state.cells_per_ring).temperature = 250;
    }
    mesh.cells[target.ringIdx * sim.wall_state.cells_per_ring + target.cellIdx].fluid.SiO2 = 5000;
    grid.boundaryVoxel(0, 0).temperature = 251; // activates localization; chemistry target remains median-T
    sim.conditions.fluid.SiO2 = 0;
    sim._thermalFieldActivated = true;
    const restore = sim._installLocalizedNucleationEnvelope();
    try { _nuc_quartz(sim); } finally { restore(); }
    expect(sim.crystals.find((c: any) => c.mineral === 'quartz')?.wall_anchor)
      .toMatchObject(target);
  });

  it('does not commit a hot-site decision to a chemically ineligible remote host', () => {
    const sim = makeSim();
    const grid = sim.wall_state.voxelGridFor(sim), mesh = sim.wall_state.meshFor(sim);
    const originalCell = sim._assignWallCell, originalRing = sim._assignWallRing;
    sim._assignWallCell = () => 1;
    sim._assignWallRing = () => 1;
    const host = sim.nucleate('chalcedony', 'vug wall', 2);
    sim._assignWallCell = originalCell;
    sim._assignWallRing = originalRing;
    const viable = { ringIdx: 8, cellIdx: 60 };
    for (let i = 0; i < mesh.cells.length; i++) {
      mesh.cells[i].fluid.SiO2 = 0;
      mesh.cells[i].fluid.pH = 7;
      grid.boundaryVoxel(Math.floor(i / sim.wall_state.cells_per_ring),
        i % sim.wall_state.cells_per_ring).temperature = 50;
    }
    mesh.cells[viable.ringIdx * sim.wall_state.cells_per_ring + viable.cellIdx].fluid.SiO2 = 5000;
    grid.boundaryVoxel(viable.ringIdx, viable.cellIdx).temperature = 250;
    sim._thermalFieldActivated = true;
    const restore = sim._installLocalizedNucleationEnvelope();
    try { _nuc_quartz(sim); } finally { restore(); }
    const quartz = sim.crystals.find((c: any) => c.mineral === 'quartz');
    expect(quartz.wall_anchor).toMatchObject(viable);
    expect(quartz.position).toContain('proposed remote substrate ineligible');
    expect(quartz.wall_anchor).not.toMatchObject(host.wall_anchor);
  });

  it('explains the exact local maximum and its temperature on Creative hover', () => {
    const sim = makeSim();
    const grid = sim.wall_state.voxelGridFor(sim), mesh = sim.wall_state.meshFor(sim);
    const local = { ringIdx: 4, cellIdx: 9 };
    for (let i = 0; i < mesh.cells.length; i++) mesh.cells[i].fluid.SiO2 = 0;
    mesh.cells[local.ringIdx * sim.wall_state.cells_per_ring + local.cellIdx].fluid.SiO2 = 5000;
    grid.boundaryVoxel(local.ringIdx, local.cellIdx).temperature = 222;
    sim._thermalFieldActivated = true;
    const why = _buildMineralFormationExplanation('quartz', sim.conditions, sim);
    const spatial = why.groups.find((group: any) => group.label === 'Local formation site');
    expect(spatial.chips[0].text).toContain(`ring ${local.ringIdx}, cell ${local.cellIdx}`);
    expect(spatial.chips[0].text).toContain('222°C');
    expect(why.sigma).toBeGreaterThan(why.sigmaCrit);
  });

  it('classifies a new growth zone from its crystal-site state, not the bulk view', () => {
    const sim = makeSim();
    const crystal = sim.nucleate('calcite', 'vug wall', 2);
    const zone = new GrowthZone({
      step: sim.step, temperature: 25, thickness_um: 10, growth_rate: 10,
    });
    crystal.add_zone(zone);
    const anchor = crystal.wall_anchor;
    const mesh = sim.wall_state.meshFor(sim), grid = sim.wall_state.voxelGridFor(sim);
    const local = mesh.cells[anchor.ringIdx * sim.wall_state.cells_per_ring + anchor.cellIdx].fluid;
    Object.assign(local, { Ca: 5000, CO3: 5000, pH: 8 });
    grid.boundaryVoxel(anchor.ringIdx, anchor.cellIdx).temperature = 25;
    Object.assign(sim.conditions.fluid, { Ca: 0, CO3: 0 });
    classifyMorphologyStep(sim);
    expect(zone.morph_regime).toBeTruthy();
  });

  it('integrates calcite Wulff chemistry from the crystal site, not the bulk view', () => {
    const sim = makeSim();
    sim.conditions.wall.wulff_calcite = true;
    const crystal = sim.nucleate('calcite', 'vug wall', 2);
    crystal.total_growth_um = 40;
    crystal.zones = [{ step: sim.step, thickness_um: 40 }];
    const anchor = crystal.wall_anchor;
    const mesh = sim.wall_state.meshFor(sim);
    const local = mesh.cells[anchor.ringIdx * sim.wall_state.cells_per_ring + anchor.cellIdx].fluid;
    Object.assign(local, { Ca: 5000, CO3: 5000, pH: 8 });
    Object.assign(sim.conditions.fluid, { Ca: 0, CO3: 0 });
    const expected = sim._localNucleationEvaluationAtAnchor('calcite', anchor).sigma;
    expect(expected).toBeGreaterThan(0);
    classifyWulffForm(sim);
    expect(crystal._wulffCalInt.G).toBe(40);
    expect(crystal._wulffCalInt.oG / crystal._wulffCalInt.G).toBeCloseTo(expected, 10);
  });
});
