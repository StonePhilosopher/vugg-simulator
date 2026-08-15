import { describe, expect, it } from 'vitest';

declare const CavityProductionAuthority: any;
declare const CavityWaterAppearance: any;
declare const MarchingCubesExtractor: any;
declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const WallState: any;
declare const rng: any;
declare const setSeed: any;

const strata = [
  { architecture: 'spherical', primary: 1, secondary: 0, seed: 0, diameter: 5 },
  { architecture: 'irregular', primary: 2, secondary: 20, seed: 1, diameter: 5000 },
  { architecture: 'tabular', primary: 3, secondary: 2, seed: 42, diameter: 25 },
  { architecture: 'pocket', primary: 4, secondary: 18, seed: 255, diameter: 250 },
  { architecture: 'basin', primary: 5, secondary: 4, seed: 256, diameter: 1000 },
  { architecture: 'cleft', primary: 6, secondary: 16, seed: 1024, diameter: 50 },
  { architecture: 'spherical', primary: 7, secondary: 6, seed: 32767, diameter: 100 },
  { architecture: 'irregular', primary: 8, secondary: 14, seed: 32768, diameter: 500 },
  { architecture: 'tabular', primary: 9, secondary: 8, seed: 65534, diameter: 2500 },
  { architecture: 'cleft', primary: 10, secondary: 20, seed: 65535, diameter: 5000 },
];

describe('Cartesian production authority across the Creative shape domain', () => {
  it('matches the packed authoritative volume for every authored scenario at 48 and 64', () => {
    const failures: string[] = [];
    for (const name of Object.keys(SCENARIOS).sort()) {
      try {
        setSeed(42);
        const { conditions, events } = SCENARIOS[name]();
        const authoredShapeSeed = conditions.wall.shape_seed;
        const sim = new VugSimulator(conditions, events);
        expect(sim.conditions.wall.shape_seed).toBe(authoredShapeSeed);
        const wall = sim.wall_state;
        const active = wall.activeCavitySurfaceAnchorProvider();
        const exact48 = MarchingCubesExtractor.closedVolumeMm3(active.surface);
        const lean48 = MarchingCubesExtractor.closedVolumeForField(active.field, 0);
        expect(Math.abs(lean48 - exact48))
          .toBeLessThanOrEqual(Math.max(1e-8, exact48 * 1e-12));

        const contract = wall._cavityProductionAuthorityContract;
        const depths = CavityProductionAuthority._depthsFromWall(wall);
        const referenceFrame = CavityProductionAuthority._referenceFrame(contract.frame);
        const field64 = CavityProductionAuthority._fieldForDepths(wall, depths, {
          resolution: 64, frame: referenceFrame,
        });
        const lean64 = MarchingCubesExtractor.closedVolumeForField(field64, 0);
        const exact64 = contract.baseline_volume_convergence.reference_volume_mm3;
        expect(Math.abs(lean64 - exact64))
          .toBeLessThanOrEqual(Math.max(1e-8, exact64 * 1e-12));
      } catch (error: any) {
        failures.push(`${name}: ${error?.message || String(error)}`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
    expect(Object.keys(SCENARIOS)).toHaveLength(41);
  }, 180_000);

  it('commissions a closed exact provider for deterministic domain strata', () => {
    const failures: string[] = [];
    for (const row of strata) {
      try {
        const wall = new WallState({
          vug_diameter_mm: row.diameter,
          initial_radius_mm: row.diameter / 2,
          architecture: row.architecture,
          primary_bubbles: row.primary,
          secondary_bubbles: row.secondary,
          shape_seed: row.seed,
        });
        const enabled = wall.enableProductionCavityAuthority();
        CavityProductionAuthority.assertContract(wall, enabled.contract);
        expect(enabled.contract.tessellation_identity).toBeTruthy();
        expect(enabled.contract.baseline_volume_convergence.relative_difference)
          .toBeLessThanOrEqual(0.02);
        expect(enabled.provider).toMatchObject({
          kind: 'cavity-field', resolution: 48, isovalue: 0,
          production_contract_digest: enabled.contract.contract_digest,
        });
        const active = wall.activeCavitySurfaceAnchorProvider();
        expect(active.surface.topology).toMatchObject({
          negative_border: true, nonempty: true, closed_two_manifold: true,
        });
        expect(MarchingCubesExtractor.closedVolumeMm3(active.surface))
          .toBeCloseTo(enabled.initial_volume_mm3, 6);
        expect(MarchingCubesExtractor.closedVolumeForField(active.field, 0))
          .toBeCloseTo(MarchingCubesExtractor.closedVolumeMm3(active.surface), 9);
      } catch (error: any) {
        failures.push(`${JSON.stringify(row)}: ${error?.message || String(error)}`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
    expect(new Set(strata.map(row => row.architecture)).size).toBe(6);
    expect(strata.map(row => row.primary).sort((a, b) => a - b))
      .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(Math.min(...strata.map(row => row.secondary))).toBe(0);
    expect(Math.max(...strata.map(row => row.secondary))).toBe(20);
    expect(Math.min(...strata.map(row => row.seed))).toBe(0);
    expect(Math.max(...strata.map(row => row.seed))).toBe(65535);
    expect(Math.min(...strata.map(row => row.diameter))).toBe(5);
    expect(Math.max(...strata.map(row => row.diameter))).toBe(5000);
  }, 180_000);

  it('bounds startup work, retained provider bytes, and repeated-start RNG behavior', () => {
    const elapsed: number[] = [];
    let retainedBytes = 0;
    for (let index = 0; index < 3; index++) {
      setSeed(42);
      const beforeRng = rng.state;
      const { conditions, events } = SCENARIOS.tutorial_travertine();
      const started = performance.now();
      const sim = new VugSimulator(conditions, events);
      elapsed.push(performance.now() - started);
      expect(rng.state).toBe(beforeRng);
      const active = sim.wall_state.activeCavitySurfaceAnchorProvider();
      retainedBytes = active.field.sampleByteLength()
        + Number(active.surface.metrics.surface_bytes || 0);
      expect(active.receipt.production_contract_digest)
        .toBe(sim.wall_state._cavityProductionAuthorityContract.contract_digest);
      expect(CavityWaterAppearance.verticalSpanForWall(sim.wall_state)).toBeGreaterThan(0);
    }
    // Generous CI ceilings, but unlike the old finite-only benchmark these are
    // enforced. A repeated scenario reuses only its immutable contract proof;
    // each simulator still owns an authenticated live provider extraction.
    expect(elapsed[0]).toBeLessThan(4000);
    expect(Math.max(...elapsed.slice(1))).toBeLessThan(1500);
    expect(retainedBytes).toBeLessThan(8 * 1024 * 1024);
  }, 30_000);
});
