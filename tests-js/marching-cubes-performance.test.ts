import { describe, expect, it } from 'vitest';

declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const setSeed: any;
declare const CavitySurfaceAnchors: any;

const CASES = [
  'amethyst_geode',
  'mvt',
  'reactivated_fluorite_vein',
  'great_salt_plains',
  'tormiq_alpine_cleft',
  'zoned_dripstone_cave',
  'reactive_wall',
];

const EXPECTED_TRIANGLES: Record<string, Record<number, number>> = {
  amethyst_geode: { 48: 35504, 64: 63788 },
  mvt: { 48: 44368, 64: 80196 },
  reactivated_fluorite_vein: { 48: 12640, 64: 23100 },
  great_salt_plains: { 48: 11144, 64: 20204 },
  tormiq_alpine_cleft: { 48: 7404, 64: 13536 },
  zoned_dripstone_cave: { 48: 41648, 64: 74960 },
  reactive_wall: { 48: 33352, 64: 60408 },
};

// Every current authored benchmark case must extract; this exact set makes any
// newly rejected topology a deliberate, reviewed receipt change.
const EXPECTED_REJECTIONS = new Set<string>();

// Transaction work happens only when a scenario starts or an erosion step is
// committed; cached renderer work has its own frame budget below. These broad
// local-CI ceilings are intentionally enforceable, unlike the former finite-
// number assertion, while retaining headroom for a cold JIT and loaded laptop.
const TRANSACTION_BUDGET_MS = { 48: 150, 64: 250 } as const;
const STEADY_48_TRANSACTION_BUDGET_MS = 70;
const CACHED_PATCH_FRAME_BUDGET_MS = 5;
const EVOLVING_PATCH_STEP_BUDGET_MS = 100;
const INDEXED_REMAP_STEP_BUDGET_MS = 120;
const COLD_PATCH_BUILD_BUDGET_MS = 800;

describe('Marching Cubes cavity measured budgets', () => {
  it('records 48^3 and 64^3 costs on authored shape seeds', () => {
    const characterize = process.env.MC_BENCHMARK_CHARACTERIZE === '1';
    const receipt: any[] = [];
    const observedRejections = new Set<string>();
    for (const scenarioName of CASES) {
      setSeed(42); // simulation test seed; each scenario retains its authored shape_seed
      const { conditions, events } = SCENARIOS[scenarioName]();
      const sim = new VugSimulator(conditions, events);
      for (const resolution of [48, 64]) {
        const field = sim.wall_state.cavityFieldFor({ resolution });
        let surface;
        try {
          surface = sim.wall_state.cavitySurfaceFor({ resolution, throwOnFailure: true });
        } catch (error: any) {
          const key = `${scenarioName}@${resolution}`;
          expect(EXPECTED_REJECTIONS.has(key)).toBe(true);
          expect(error.message).toMatch(/non-manifold/i);
          observedRejections.add(key);
          receipt.push({
            scenario: scenarioName,
            architecture: sim.wall_state.architecture,
            shape_seed: sim.wall_state.shape_seed,
            resolution,
            rejected: error.message,
          });
          continue;
        }
        expect(EXPECTED_REJECTIONS.has(`${scenarioName}@${resolution}`)).toBe(false);
        const row = {
          scenario: scenarioName,
          architecture: sim.wall_state.architecture,
          shape_seed: sim.wall_state.shape_seed,
          resolution,
          field_ms: Number(surface.metrics.field_build_ms.toFixed(2)),
          extract_ms: Number(surface.metrics.extraction_ms.toFixed(2)),
          polygonize_ms: Number(surface.metrics.polygonize_ms.toFixed(2)),
          manifold_ms: Number(surface.metrics.manifold_ms.toFixed(2)),
          normal_material_ms: Number(surface.metrics.normal_material_ms.toFixed(2)),
          packing_authentication_ms: Number(
            surface.metrics.packing_authentication_ms.toFixed(2),
          ),
          packing_ms: Number(surface.metrics.packing_ms.toFixed(2)),
          buffer_authentication_ms: Number(
            surface.metrics.buffer_authentication_ms.toFixed(2),
          ),
          transaction_ms: Number(
            (surface.metrics.field_build_ms + surface.metrics.extraction_ms).toFixed(2),
          ),
          transaction_budget_ms: TRANSACTION_BUDGET_MS[resolution as 48 | 64],
          vertices: surface.metrics.vertex_count,
          triangles: surface.metrics.triangle_count,
          field_kib: Math.round(surface.metrics.field_bytes / 1024),
          surface_kib: Math.round(surface.metrics.surface_bytes / 1024),
        };
        receipt.push(row);
        expect(row.shape_seed).toBe(conditions.wall.shape_seed);
        expect(row.triangles).toBeGreaterThan(0);
        if (!characterize) {
          expect(row.triangles).toBe(EXPECTED_TRIANGLES[scenarioName][resolution]);
        }
        expect(row.vertices).toBeGreaterThan(0);
        expect(row.field_kib).toBe(Math.round(resolution ** 3 * 4 / 1024));
        expect(row.surface_kib).toBeLessThan(4096);
        expect(Number.isFinite(row.field_ms + row.extract_ms)).toBe(true);
        expect(row.transaction_ms).toBeLessThanOrEqual(row.transaction_budget_ms);
        if (resolution === 48 && scenarioName !== CASES[0]) {
          expect(row.transaction_ms).toBeLessThanOrEqual(STEADY_48_TRANSACTION_BUDGET_MS);
        }
      }
    }
    expect(observedRejections).toEqual(EXPECTED_REJECTIONS);
    console.log(`[mc-benchmark] ${JSON.stringify(receipt)}`);
  });

  it('measures the active surface-patch and remap consumers', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.amethyst_geode();
    const sim = new VugSimulator(conditions, events);
    const field = sim.wall_state.cavityFieldFor({ resolution: 48 });
    const surface = sim.wall_state.cavitySurfaceFor({ resolution: 48, throwOnFailure: true });
    const mesh = sim.wall_state.meshFor(sim);
    const triangleCount = surface.indices.length / 3;
    const anchors = Array.from({ length: 8 }, (_, index) =>
      CavitySurfaceAnchors.fromMarchingCubes(
        field, surface, mesh, Math.floor(index * triangleCount / 8), [1 / 3, 1 / 3, 1 / 3],
      ));
    const coldStarted = performance.now();
    const coldPatches = anchors.map(anchor =>
      CavitySurfaceAnchors.surfacePatch(anchor, surface, 0.12));
    const coldPatchMs = performance.now() - coldStarted;
    const cachedStarted = performance.now();
    const cachedPatches = anchors.map(anchor =>
      CavitySurfaceAnchors.surfacePatch(anchor, surface, 0.12));
    const cachedPatchMs = performance.now() - cachedStarted;
    expect(cachedPatches).toEqual(coldPatches);
    for (let index = 0; index < anchors.length; index++) {
      expect(cachedPatches[index]).toBe(coldPatches[index]);
    }
    const evolvingStarted = performance.now();
    const evolvingPatches = anchors.map(anchor =>
      CavitySurfaceAnchors.surfacePatch(anchor, surface, 0.121));
    const evolvingPatchMs = performance.now() - evolvingStarted;
    expect(evolvingPatches.every((patch: any, index: number) =>
      patch.triangles.length >= coldPatches[index].triangles.length)).toBe(true);

    const wallAnchors = [[1, 3], [4, 11], [7, 23], [10, 31]]
      .map(([ringIdx, cellIdx]) => sim.wall_state._anchorFromRingCell(ringIdx, cellIdx));
    const remapStarted = performance.now();
    const remapped = wallAnchors.map(anchor =>
      CavitySurfaceAnchors.remapToMarchingCubes(anchor, field, surface, mesh));
    const indexedRemapMs = performance.now() - remapStarted;
    expect(remapped.every(anchor => anchor.source.signature === surface.sig)).toBe(true);
    const topology = CavitySurfaceAnchors._surfaceTopology(surface);
    const receipt = {
      scenario: 'amethyst_geode', shape_seed: conditions.wall.shape_seed,
      resolution: 48, anchors: anchors.length,
      patch_coverage: 0.12,
      selected_triangles: coldPatches.reduce(
        (sum: number, patch: any) => sum + patch.triangles.length, 0),
      cold_patch_ms: Number(coldPatchMs.toFixed(2)),
      cached_patch_ms: Number(cachedPatchMs.toFixed(2)),
      evolving_patch_ms: Number(evolvingPatchMs.toFixed(2)),
      indexed_remap_ms: Number(indexedRemapMs.toFixed(2)),
      cold_patch_budget_ms: COLD_PATCH_BUILD_BUDGET_MS,
      cached_patch_frame_budget_ms: CACHED_PATCH_FRAME_BUDGET_MS,
      evolving_patch_step_budget_ms: EVOLVING_PATCH_STEP_BUDGET_MS,
      indexed_remap_step_budget_ms: INDEXED_REMAP_STEP_BUDGET_MS,
      cached_patch_triangle_weight: topology.patchCacheTriangleWeight,
      cached_paths: topology.pathCache.size,
      cached_field_frames: topology.fieldSpatialIndices.size,
    };
    expect(Number.isFinite(
      coldPatchMs + cachedPatchMs + evolvingPatchMs + indexedRemapMs,
    )).toBe(true);
    expect(coldPatchMs).toBeLessThanOrEqual(COLD_PATCH_BUILD_BUDGET_MS);
    expect(cachedPatchMs).toBeLessThanOrEqual(CACHED_PATCH_FRAME_BUDGET_MS);
    expect(evolvingPatchMs).toBeLessThanOrEqual(EVOLVING_PATCH_STEP_BUDGET_MS);
    expect(indexedRemapMs).toBeLessThanOrEqual(INDEXED_REMAP_STEP_BUDGET_MS);
    expect(topology.patchCacheTriangleWeight)
      .toBeLessThanOrEqual(CavitySurfaceAnchors.PATCH_CACHE_TRIANGLE_BUDGET);
    expect(topology.pathCache.size)
      .toBeLessThanOrEqual(CavitySurfaceAnchors.SURFACE_PATH_CACHE_LIMIT);
    expect(topology.fieldSpatialIndices.size).toBeLessThanOrEqual(3);
    console.log(`[mc-consumer-benchmark] ${JSON.stringify(receipt)}`);
  });

  it('bounds a nonzero authenticated erosion-prefix rebuild', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.reactive_wall();
    conditions.fluid.pH = 4;
    conditions.flow_rate = 0.4;
    const sim = new VugSimulator(conditions, events);
    sim.dissolve_wall();
    expect(sim.wall_state.cavityEvolutionLedger().cursor).toBe(1);
    const field = sim.wall_state.cavityFieldFor({ resolution: 48 });
    const surface = sim.wall_state.cavitySurfaceFor({ resolution: 48, throwOnFailure: true });
    const transactionMs = field.metrics.field_build_ms + surface.metrics.extraction_ms;
    const receipt = {
      scenario: 'reactive_wall', shape_seed: conditions.wall.shape_seed,
      resolution: 48, evolution_cursor: 1,
      field_ms: Number(field.metrics.field_build_ms.toFixed(2)),
      extract_ms: Number(surface.metrics.extraction_ms.toFixed(2)),
      transaction_ms: Number(transactionMs.toFixed(2)),
      transaction_budget_ms: TRANSACTION_BUDGET_MS[48],
      triangles: surface.metrics.triangle_count,
    };
    expect(transactionMs).toBeLessThanOrEqual(TRANSACTION_BUDGET_MS[48]);
    expect(surface.source_field_snapshot_digest).toBe(field.snapshotDigest);
    console.log(`[mc-evolution-benchmark] ${JSON.stringify(receipt)}`);
  });
});
