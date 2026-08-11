import { describe, expect, it } from 'vitest';

declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const setSeed: any;

const CASES = [
  'amethyst_geode',
  'mvt',
  'great_salt_plains',
  'tormiq_alpine_cleft',
  'zoned_dripstone_cave',
  'reactive_wall',
];

const EXPECTED_TRIANGLES: Record<string, Record<number, number>> = {
  amethyst_geode: { 48: 11708, 64: 21068 },
  mvt: { 48: 15432, 64: 27908 },
  great_salt_plains: { 48: 12236, 64: 22106 },
  tormiq_alpine_cleft: { 48: 13656, 64: 24588 },
  zoned_dripstone_cave: { 48: 13948, 64: 25112 },
  reactive_wall: { 48: 11120, 64: 20144 },
};

// The face-decider prototype deliberately rejects this known 64^3 interior
// ambiguity. The renderer falls back to WallMesh; MC33 is the promotion gate.
const EXPECTED_REJECTIONS = new Set(['great_salt_plains@64']);

describe('Marching Cubes cavity measured budgets', () => {
  it('records 48^3 and 64^3 costs on authored shape seeds', () => {
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
        expect(row.triangles).toBe(EXPECTED_TRIANGLES[scenarioName][resolution]);
        expect(row.vertices).toBeGreaterThan(0);
        expect(row.field_kib).toBe(Math.round(resolution ** 3 * 4 / 1024));
        expect(row.surface_kib).toBeLessThan(1024);
        expect(Number.isFinite(row.field_ms + row.extract_ms)).toBe(true);
      }
    }
    expect(observedRejections).toEqual(EXPECTED_REJECTIONS);
    console.log(`[mc-benchmark] ${JSON.stringify(receipt)}`);
  });
});
