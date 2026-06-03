// tests-js/strip-view-bedrock.test.ts — strip view bedrock validation.
//
// THE HELICOID-AS-RECORDER REFRAME (Shy's framing, 2026-05-26)
//
// Validates:
//   - stripQuantize / stripDequantize round-trip within precision
//   - stripDataIndex bounds and ordering
//   - stripSerialize / stripDeserialize round-trip (raw, no gzip — the
//     gzip path uses browser CompressionStream which isn't always
//     available in node/jsdom; ungzipped path proves the format)
//   - StripRecorder captures one step's data + nucleation events
//   - Integration with VugSimulator (recorder attached + run_step ticks)
//
// Storage layer (85h) is NOT tested here — it depends on IndexedDB,
// which jsdom doesn't ship. End-to-end IDB validation is manual in
// browser (run a Random scenario, open the strip view tab, see the
// dataset appear).
//
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import './setup';

declare const stripQuantize: any;
declare const stripDequantize: any;
declare const stripDequantizeNormalized: any;
declare const stripDataIndex: any;
declare const stripAllocateData: any;
declare const stripSerialize: any;
declare const stripDeserialize: any;
declare const StripRecorder: any;
declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const setSeed: any;
declare const SIM_VERSION: number;

describe('strip dataset — quantization', () => {
  it('quantizes a mid-range value to ~half the byte range', () => {
    const byte = stripQuantize(50, 0, 100);
    expect(byte).toBeGreaterThan(120);
    expect(byte).toBeLessThan(135);
  });

  it('quantizes min to 0 and max to 254', () => {
    expect(stripQuantize(0, 0, 100)).toBe(0);
    expect(stripQuantize(100, 0, 100)).toBe(254);
  });

  it('quantizes null / undefined / NaN / non-finite to 255 (null marker)', () => {
    expect(stripQuantize(null, 0, 100)).toBe(255);
    expect(stripQuantize(undefined, 0, 100)).toBe(255);
    expect(stripQuantize(NaN, 0, 100)).toBe(255);
    expect(stripQuantize(Infinity, 0, 100)).toBe(255);
  });

  it('clamps out-of-range values', () => {
    expect(stripQuantize(-50, 0, 100)).toBe(0);
    expect(stripQuantize(200, 0, 100)).toBe(254);
  });

  it('round-trips within precision (< 1%)', () => {
    const min = 0, max = 100;
    for (const v of [0, 10, 25, 50, 75, 90, 100]) {
      const b = stripQuantize(v, min, max);
      const r = stripDequantize(b, min, max);
      expect(Math.abs((r as number) - v)).toBeLessThan((max - min) * 0.005);
    }
  });

  it('dequantizes null marker to null', () => {
    expect(stripDequantize(255, 0, 100)).toBeNull();
    expect(stripDequantizeNormalized(255)).toBeNull();
  });
});

describe('strip dataset — tensor indexing', () => {
  const axes = { steps: 3, angular_indices: 2, height_positions: 4, };
  const chipCount = 5;

  it('returns -1 for out-of-bounds indices', () => {
    expect(stripDataIndex(-1, 0, 0, 0, axes, chipCount)).toBe(-1);
    expect(stripDataIndex(0, -1, 0, 0, axes, chipCount)).toBe(-1);
    expect(stripDataIndex(0, 0, -1, 0, axes, chipCount)).toBe(-1);
    expect(stripDataIndex(0, 0, 0, -1, axes, chipCount)).toBe(-1);
    expect(stripDataIndex(axes.steps, 0, 0, 0, axes, chipCount)).toBe(-1);
    expect(stripDataIndex(0, axes.angular_indices, 0, 0, axes, chipCount)).toBe(-1);
  });

  it('is row-major: step varies slowest, chip varies fastest', () => {
    const i_00 = stripDataIndex(0, 0, 0, 0, axes, chipCount);
    const i_01 = stripDataIndex(0, 0, 0, 1, axes, chipCount);
    const i_h1 = stripDataIndex(0, 0, 1, 0, axes, chipCount);
    const i_a1 = stripDataIndex(0, 1, 0, 0, axes, chipCount);
    const i_s1 = stripDataIndex(1, 0, 0, 0, axes, chipCount);
    expect(i_01 - i_00).toBe(1);                                          // chip stride = 1
    expect(i_h1 - i_00).toBe(chipCount);                                  // height stride
    expect(i_a1 - i_00).toBe(axes.height_positions * chipCount);          // angle stride
    expect(i_s1 - i_00).toBe(axes.angular_indices * axes.height_positions * chipCount); // step stride
  });

  it('allocates a zero-filled tensor of the right size', () => {
    const data = stripAllocateData(axes, chipCount);
    expect(data.length).toBe(axes.steps * axes.angular_indices * axes.height_positions * chipCount);
    for (let i = 0; i < data.length; i++) expect(data[i]).toBe(0);
  });
});

describe('strip dataset — radial depth axis (format_version 2)', () => {
  // 4D axes: depth_positions = 3 (so strides differ from the 3D case).
  const axes4 = { steps: 3, angular_indices: 2, height_positions: 4, depth_positions: 3 };
  const chipCount = 5;

  it('is row-major with depth between height and chip', () => {
    const i_000 = stripDataIndex(0, 0, 0, 0, axes4, chipCount, 0);
    const i_chip = stripDataIndex(0, 0, 0, 1, axes4, chipCount, 0);
    const i_depth = stripDataIndex(0, 0, 0, 0, axes4, chipCount, 1);
    const i_height = stripDataIndex(0, 0, 1, 0, axes4, chipCount, 0);
    const i_angle = stripDataIndex(0, 1, 0, 0, axes4, chipCount, 0);
    const i_step = stripDataIndex(1, 0, 0, 0, axes4, chipCount, 0);
    const D = axes4.depth_positions;
    expect(i_chip - i_000).toBe(1);                                   // chip stride = 1
    expect(i_depth - i_000).toBe(chipCount);                          // depth stride = chipCount
    expect(i_height - i_000).toBe(D * chipCount);                     // height stride = D*chipCount
    expect(i_angle - i_000).toBe(axes4.height_positions * D * chipCount);
    expect(i_step - i_000).toBe(axes4.angular_indices * axes4.height_positions * D * chipCount);
  });

  it('rejects out-of-range depth', () => {
    expect(stripDataIndex(0, 0, 0, 0, axes4, chipCount, -1)).toBe(-1);
    expect(stripDataIndex(0, 0, 0, 0, axes4, chipCount, axes4.depth_positions)).toBe(-1);
  });

  it('allocates depth_positions × the 3D size', () => {
    const data = stripAllocateData(axes4, chipCount);
    expect(data.length).toBe(
      axes4.steps * axes4.angular_indices * axes4.height_positions * axes4.depth_positions * chipCount,
    );
  });

  it('backward-compat: a v1 (no depth_positions) axes collapses to the 3D layout', () => {
    const axesV1 = { steps: 3, angular_indices: 2, height_positions: 4 };
    // depth 0 indexes identically to the pre-depth formula...
    expect(stripDataIndex(1, 1, 2, 3, axesV1 as any, chipCount, 0))
      .toBe(stripDataIndex(1, 1, 2, 3, axesV1 as any, chipCount));
    // ...and any depth > 0 is out of range (degenerate single slice).
    expect(stripDataIndex(0, 0, 0, 0, axesV1 as any, chipCount, 1)).toBe(-1);
    // allocation matches the 3D size (D treated as 1).
    expect(stripAllocateData(axesV1 as any, chipCount).length)
      .toBe(axesV1.steps * axesV1.angular_indices * axesV1.height_positions * chipCount);
  });
});

describe('strip dataset — serialization round-trip', () => {
  it('serializes and deserializes without gzip', async () => {
    const manifest = {
      format_version: 1, sim_version: 148, scenario_id: 'test', seed: 42,
      recorded_at: 1234567890, duration_steps: 2,
      axes: { steps: 2, angular_indices: 3, height_positions: 2 },
      chips: [
        { id: 'pH', label: 'pH', system: 'special', range: [4, 11] as [number, number], units: '', color: 0x9966ee },
        { id: 'Ca', label: 'Ca', system: 'ion', range: [0, 500] as [number, number], units: 'ppm', color: 0xff5544 },
      ],
    };
    const chipCount = manifest.chips.length;
    const total = 2 * 3 * 2 * chipCount;
    const data = new Uint8Array(total);
    for (let i = 0; i < total; i++) data[i] = (i * 17) & 0xff;
    const events = [
      { step: 0, ring: 0, cell: 5, mineral: 'calcite' },
      { step: 1, ring: 1, cell: 17, mineral: 'aragonite' },
    ];
    const ds = { manifest, chip_data: data, nucleation_events: events };

    const blob = await stripSerialize(ds, false);
    expect(blob).toBeInstanceOf(Uint8Array);
    expect(blob.length).toBeGreaterThan(total);

    const reload = await stripDeserialize(blob);
    expect(reload.manifest.scenario_id).toBe('test');
    expect(reload.manifest.chips.length).toBe(2);
    expect(reload.manifest.chips[1].id).toBe('Ca');
    expect(reload.chip_data.length).toBe(total);
    for (let i = 0; i < total; i++) expect(reload.chip_data[i]).toBe((i * 17) & 0xff);
    expect(reload.nucleation_events.length).toBe(2);
    expect(reload.nucleation_events[0].mineral).toBe('calcite');
    expect(reload.nucleation_events[1].cell).toBe(17);
  });

  it('round-trips the format_version-3 depletion-floor channel', async () => {
    const manifest = {
      format_version: 3, sim_version: 175, scenario_id: 'floor', seed: 42,
      recorded_at: 7, duration_steps: 2,
      axes: { steps: 2, angular_indices: 3, height_positions: 2 },
      chips: [{ id: 'Ag', label: 'Ag', system: 'ion', range: [0, 10] as [number, number], units: 'ppm', color: 0xcccccc }],
    };
    const total = 2 * 3 * 2 * 1;
    const chip_data = new Uint8Array(total);
    const floor_data = new Uint8Array(total);
    for (let i = 0; i < total; i++) { chip_data[i] = 200; floor_data[i] = 150 + (i % 10); } // floor < level
    const ds = { manifest, chip_data, nucleation_events: [], floor_data };

    const reload = await stripDeserialize(await stripSerialize(ds, false));
    expect(reload.floor_data).toBeInstanceOf(Uint8Array);
    expect(reload.floor_data.length).toBe(total);
    for (let i = 0; i < total; i++) {
      expect(reload.chip_data[i]).toBe(200);
      expect(reload.floor_data[i]).toBe(150 + (i % 10));
    }
  });

  it('a v3 dataset with no floor_data, and a v2 dataset, both deserialize without a floor channel', async () => {
    const base = {
      sim_version: 175, scenario_id: 'nofloor', seed: 42, recorded_at: 8, duration_steps: 1,
      axes: { steps: 1, angular_indices: 2, height_positions: 1 },
      chips: [{ id: 'Ca', label: 'Ca', system: 'ion', range: [0, 500] as [number, number], units: 'ppm', color: 0xff5544 }],
    };
    const chip_data = new Uint8Array(2); chip_data[0] = 10; chip_data[1] = 20;
    // v3 but floor_data absent → writes length 0 → deserializes with no floor.
    const v3 = await stripDeserialize(await stripSerialize({ manifest: { ...base, format_version: 3 }, chip_data, nucleation_events: [] }, false));
    expect(v3.floor_data).toBeUndefined();
    expect(Array.from(v3.chip_data)).toEqual([10, 20]);
    // legacy v2 (never wrote a floor section) → unchanged round-trip.
    const v2 = await stripDeserialize(await stripSerialize({ manifest: { ...base, format_version: 2 }, chip_data, nucleation_events: [] }, false));
    expect(v2.floor_data).toBeUndefined();
    expect(Array.from(v2.chip_data)).toEqual([10, 20]);
  });
});

describe('strip recorder — instrumentation', () => {
  let scen: any, sim: any, recorder: any;
  beforeAll(() => {
    setSeed(42);
    scen = SCENARIOS.cooling();
    sim = new VugSimulator(scen.conditions, scen.events);
    recorder = new StripRecorder(sim, { duration_steps: 5, notes: 'unit test' });
    sim._stripRecorder = recorder;
  });

  it('builds a manifest with all helicoid chips', () => {
    const m = recorder.getManifest();
    expect(m.format_version).toBe(3);  // v2 added the depth axis; v3 added the depletion-floor channel
    expect(m.axes.steps).toBe(5);
    expect(m.axes.angular_indices).toBe(24);
    expect(m.axes.height_positions).toBe(16);
    // Phase 3: depth axis pulled from the cavity voxel grid (4 slices).
    expect(m.axes.depth_positions).toBe(4);
    expect(m.chips.length).toBeGreaterThan(40); // v165: 1 wall + 6 special (+ concentration v161) + 11 carbonate + 4 sulfate + 41 ions = 63
    // System groupings should be populated
    const systems = new Set(m.chips.map((c: any) => c.system));
    expect(systems.has('wall')).toBe(true);
    expect(systems.has('special')).toBe(true);
    expect(systems.has('carbonate')).toBe(true);
    // v165: sulfate SI chips (SI_selenite/anhydrite/barite/celestine)
    // route to their own 'sulfate' group via _classifyChipSystem. Gap
    // I introduced when adding them — guarded now.
    expect(systems.has('sulfate')).toBe(true);
    expect(systems.has('ion')).toBe(true);
  });

  it('captures one step worth of chip data per run_step()', () => {
    expect(recorder.capturedStepCount()).toBe(0);
    sim.run_step();
    expect(recorder.capturedStepCount()).toBe(1);
    sim.run_step();
    expect(recorder.capturedStepCount()).toBe(2);
  });

  it('finalizes with the correct duration when stopped early', () => {
    const ds = recorder.finalize();
    expect(ds.manifest.duration_steps).toBe(2);
    expect(ds.manifest.axes.steps).toBe(2);
    // v2: the tensor now carries the depth axis — [step][angle][height][depth][chip].
    const D = ds.manifest.axes.depth_positions || 1;
    const expectedSize = 2 * 24 * 16 * D * ds.manifest.chips.length;
    expect(ds.chip_data.length).toBe(expectedSize);
  });

  it('does not break sim behavior when attached (sealed gate still fires)', () => {
    setSeed(42);
    const scen2 = SCENARIOS.cooling();
    const sim2 = new VugSimulator(scen2.conditions, scen2.events);
    const rec2 = new StripRecorder(sim2, { duration_steps: 3 });
    sim2._stripRecorder = rec2;
    for (let s = 0; s < 3; s++) sim2.run_step();
    expect(sim2.step).toBe(3);
    expect(rec2.capturedStepCount()).toBe(3);
  });

  // v154 (2026-05-26): Fortress / Zen sessions can outrun the initial
  // duration_steps allocation. The recorder grows capacity on overflow
  // instead of dropping data.
  it('grows capacity dynamically when interactive session exceeds initial allocation', () => {
    setSeed(42);
    const scen3 = SCENARIOS.cooling();
    const sim3 = new VugSimulator(scen3.conditions, scen3.events);
    const rec3 = new StripRecorder(sim3, { duration_steps: 2 });
    sim3._stripRecorder = rec3;
    expect(rec3.getManifest().axes.steps).toBe(2);
    // Run 5 steps — capacity should double at step 3 (to 4), then again
    // at step 5 (to 8). All 5 steps captured, no data dropped.
    for (let s = 0; s < 5; s++) sim3.run_step();
    expect(rec3.capturedStepCount()).toBe(5);
    expect(rec3.getManifest().axes.steps).toBeGreaterThanOrEqual(5);
    expect(rec3.isActive()).toBe(true); // no longer auto-deactivates on capacity
    // finalize trims to the actual captured count
    const ds = rec3.finalize();
    expect(ds.manifest.duration_steps).toBe(5);
    expect(ds.manifest.axes.steps).toBe(5);
  });

  // Phase 3: the recorder samples each radial depth slice via the ambient
  // _setStripChipReadDepth selector → _chipFluid → sim.fluidAtVoxel. Prove
  // the chain end-to-end: a wall/center Ca contrast must survive into the
  // recorded tensor at the right depth indices.
  it('records distinct chemistry across radial depth slices (Phase 3 voxel sampling)', () => {
    setSeed(42);
    const scen = SCENARIOS.mvt();
    const simR = new VugSimulator(scen.conditions, scen.events);
    const grid = simR.wall_state.voxelGridFor(simR);
    expect(grid).toBeTruthy();
    const ring = 8;
    const N = simR.wall_state.cells_per_ring;
    // Make the wall slab (d=0) Ca-poor and the center slab (d=3) Ca-rich
    // across the whole ring, so whichever cell each angle bin samples
    // sees the same contrast.
    for (let c = 0; c < N; c++) {
      grid.voxelAt(ring, c, 0).fluid.Ca = 50;
      grid.voxelAt(ring, c, 3).fluid.Ca = 5000;
    }
    const rec = new StripRecorder(simR, { duration_steps: 1 });
    rec.captureStep(simR);
    const ds = rec.finalize();
    const axes = ds.manifest.axes;
    const chipCount = ds.manifest.chips.length;
    const kCa = ds.manifest.chips.findIndex((c: any) => c.id === 'Ca');
    expect(kCa).toBeGreaterThanOrEqual(0);
    const wallByte = ds.chip_data[stripDataIndex(0, 0, ring, kCa, axes, chipCount, 0)];
    const centerByte = ds.chip_data[stripDataIndex(0, 0, ring, kCa, axes, chipCount, 3)];
    // Center (Ca=5000) quantizes strictly higher than wall (Ca=50).
    expect(centerByte).toBeGreaterThan(wallByte);
  });

  // format_version 3: the depletion-FLOOR channel. The level is the midpoint
  // cell; the floor is the per-bin MIN for ion chips — it catches a one-cell
  // halo the midpoint sample would miss.
  it('records a depletion floor (floor ≤ level everywhere; a depleted cell shows in the floor)', () => {
    setSeed(42);
    const scen = SCENARIOS.mvt();
    const simF = new VugSimulator(scen.conditions, scen.events);
    const grid = simF.wall_state.voxelGridFor(simF);
    expect(grid).toBeTruthy();
    const ring = 8;
    const N = simF.wall_state.cells_per_ring;
    // Uniform Ca at the wall slab, EXCEPT cell 0 drawn down — a one-cell
    // depletion halo inside angular bin 0 (cells 0..4, midpoint cell 2).
    for (let c = 0; c < N; c++) grid.voxelAt(ring, c, 0).fluid.Ca = 400;
    grid.voxelAt(ring, 0, 0).fluid.Ca = 40;
    const rec = new StripRecorder(simF, { duration_steps: 1 });
    rec.captureStep(simF);
    const ds = rec.finalize();

    expect(ds.floor_data).toBeInstanceOf(Uint8Array);
    expect(ds.floor_data.length).toBe(ds.chip_data.length);
    // Invariant: per-bin min ≤ midpoint level everywhere real data exists.
    for (let i = 0; i < ds.chip_data.length; i++) {
      if (ds.chip_data[i] === 255 || ds.floor_data[i] === 255) continue;
      expect(ds.floor_data[i]).toBeLessThanOrEqual(ds.chip_data[i]);
    }
    // Bin 0 at ring 8: LEVEL samples midpoint cell 2 (Ca=400); FLOOR is the
    // min over cells 0..4 → catches cell 0 (Ca=40). So floor < level here.
    const axes = ds.manifest.axes, chipCount = ds.manifest.chips.length;
    const kCa = ds.manifest.chips.findIndex((c: any) => c.id === 'Ca');
    expect(kCa).toBeGreaterThanOrEqual(0);
    const idx = stripDataIndex(0, 0, ring, kCa, axes, chipCount, 0);
    expect(ds.floor_data[idx]).toBeLessThan(ds.chip_data[idx]);
  });
});
