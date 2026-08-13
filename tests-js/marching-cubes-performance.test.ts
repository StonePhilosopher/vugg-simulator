import { describe, expect, it } from 'vitest';

declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const setSeed: any;

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
      }
    }
    expect(observedRejections).toEqual(EXPECTED_REJECTIONS);
    console.log(`[mc-benchmark] ${JSON.stringify(receipt)}`);
  });
});
