// tests-js/voxel-grid.test.ts — PROPOSAL-CAVITY-INTERIOR-VOXELS Phase 1
// (v158) data model + accessor tests.
//
// Scope: pure data-model verification. v158 is an infra commit — no
// engine wiring, no event wiring, no behavior change. These tests pin
// the structural contract so Phase 2 can build on a verified base.
//
// Specifically pins:
//   - Grid allocates with correct dimensions (16 × 120 × 4 = 7,680 voxels)
//   - d=0 voxels share fluid object identity with wall mesh cells ([FIRM] B)
//   - d≥1 voxels are independent clones of the bulk fluid
//   - Per-voxel temperature initialized to bulk T ([FIRM] E)
//   - Index lookup is O(1) and correctly bounded
//   - sampleFluid linear interpolation: integer depths match stored values
//   - sampleFluid linear interpolation: midpoint averages adjacent slices
//   - sampleFluid clamps fractional depth to [0, depth_count - 1]
//   - voxelGrid.diffuse delegates to wall.mesh.diffuse in v158 (byte-identity)
//   - sim-level accessors (sim.voxelAt, sim.boundaryVoxel, etc.) work
//
// Replay path (snap-time): not tested here — snap doesn't bind a voxel
// grid in v158 ([FIRM] F defers to v160).

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const CavityVoxelGrid: any;

function makeSim(scenarioName = 'mvt') {
  setSeed(42);
  const scn = SCENARIOS[scenarioName];
  if (!scn) throw new Error(`scenario ${scenarioName} not found`);
  const { conditions, events } = scn();
  return new VugSimulator(conditions, events);
}

describe('CavityVoxelGrid — Phase 1 (v158) data model', () => {
  describe('allocation', () => {
    it('grid exists on wall_state after sim construction', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      expect(grid).toBeTruthy();
      expect(grid).toBeInstanceOf(CavityVoxelGrid);
    });

    it('grid dimensions match wall mesh (16 rings × 120 cells × 4 depths)', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      expect(grid.ring_count).toBe(16);
      expect(grid.cells_per_ring).toBe(120);
      expect(grid.depth_count).toBe(4);
      expect(grid.voxels.length).toBe(16 * 120 * 4);
    });

    it('every voxel has a fluid object + temperature', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      for (let i = 0; i < grid.voxels.length; i++) {
        expect(grid.voxels[i]).toBeTruthy();
        expect(grid.voxels[i].fluid).toBeTruthy();
        expect(typeof grid.voxels[i].temperature).toBe('number');
      }
    });

    it('per-voxel temperature initialized to bulk T (per [FIRM] E)', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      const bulkT = sim.conditions.temperature;
      for (let r = 0; r < grid.ring_count; r++) {
        for (let c = 0; c < grid.cells_per_ring; c++) {
          for (let d = 0; d < grid.depth_count; d++) {
            expect(grid.voxelAt(r, c, d).temperature).toBe(bulkT);
          }
        }
      }
    });
  });

  describe('[FIRM] B alias — d=0 voxels share fluid identity with wall mesh cells', () => {
    it('voxelAt(r, c, 0).fluid === mesh.cells[r*N+c].fluid', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      const mesh = sim.wall_state.meshFor(sim);
      const N = grid.cells_per_ring;
      // Spot-check several (r, c) positions.
      for (const [r, c] of [[0, 0], [8, 60], [15, 119], [3, 30], [12, 100]]) {
        const voxelFluid = grid.voxelAt(r, c, 0).fluid;
        const meshFluid = mesh.cells[r * N + c].fluid;
        expect(voxelFluid).toBe(meshFluid);
      }
    });

    it('writing through wall mesh cell is visible through d=0 voxel', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      const mesh = sim.wall_state.meshFor(sim);
      const r = 5, c = 40;
      const N = grid.cells_per_ring;
      mesh.cells[r * N + c].fluid.Ca = 12345;
      expect(grid.voxelAt(r, c, 0).fluid.Ca).toBe(12345);
    });

    it('writing through d=0 voxel is visible through wall mesh cell', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      const mesh = sim.wall_state.meshFor(sim);
      const r = 9, c = 70;
      const N = grid.cells_per_ring;
      grid.voxelAt(r, c, 0).fluid.Mg = 6789;
      expect(mesh.cells[r * N + c].fluid.Mg).toBe(6789);
    });
  });

  describe('interior voxels (d≥1) are independent clones', () => {
    it('voxelAt(r, c, 1) is NOT the same object as voxelAt(r, c, 0)', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      for (const [r, c] of [[0, 0], [8, 60], [15, 119]]) {
        const d0 = grid.voxelAt(r, c, 0).fluid;
        const d1 = grid.voxelAt(r, c, 1).fluid;
        expect(d0).not.toBe(d1);
      }
    });

    it('writing to a d=1 voxel does NOT affect the d=0 voxel', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      const r = 4, c = 50;
      const d0Before = grid.voxelAt(r, c, 0).fluid.Ca;
      grid.voxelAt(r, c, 1).fluid.Ca = 99999;
      expect(grid.voxelAt(r, c, 0).fluid.Ca).toBe(d0Before);
      expect(grid.voxelAt(r, c, 1).fluid.Ca).toBe(99999);
    });

    it('d=2 and d=3 are independent of each other', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      grid.voxelAt(7, 80, 2).fluid.Fe = 111;
      grid.voxelAt(7, 80, 3).fluid.Fe = 222;
      expect(grid.voxelAt(7, 80, 2).fluid.Fe).toBe(111);
      expect(grid.voxelAt(7, 80, 3).fluid.Fe).toBe(222);
    });

    it('interior voxels start with the same field values as bulk fluid', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      const bulk = sim.conditions.fluid;
      // Sample several interior voxels and check their fields match bulk.
      // (Wall cells may have zone_chemistry overrides at d=0; the bulk
      // alias case means d=0 won't always equal bulk. But d≥1 always start
      // as a clone of bulk.)
      for (const [r, c] of [[3, 10], [11, 90]]) {
        for (let d = 1; d < grid.depth_count; d++) {
          const v = grid.voxelAt(r, c, d).fluid;
          expect(v.Ca).toBe(bulk.Ca);
          expect(v.Mg).toBe(bulk.Mg);
          expect(v.CO3).toBe(bulk.CO3);
          expect(v.pH).toBe(bulk.pH);
        }
      }
    });
  });

  describe('accessor bounds', () => {
    it('voxelAt returns null for out-of-range indices', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      expect(grid.voxelAt(-1, 0, 0)).toBeNull();
      expect(grid.voxelAt(16, 0, 0)).toBeNull();
      expect(grid.voxelAt(0, -1, 0)).toBeNull();
      expect(grid.voxelAt(0, 120, 0)).toBeNull();
      expect(grid.voxelAt(0, 0, -1)).toBeNull();
      expect(grid.voxelAt(0, 0, 4)).toBeNull();
    });

    it('boundaryVoxel === voxelAt(..., 0)', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      for (const [r, c] of [[0, 0], [8, 60], [15, 119]]) {
        expect(grid.boundaryVoxel(r, c)).toBe(grid.voxelAt(r, c, 0));
      }
    });

    it('fluidAt returns the voxel.fluid', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      expect(grid.fluidAt(5, 50, 2)).toBe(grid.voxelAt(5, 50, 2).fluid);
    });
  });

  describe('sampleFluid — linear interpolation (per [FIRM] A average-on-demand)', () => {
    it('integer depths return the stored value exactly', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      // Pin specific values into each depth so interpolation is testable.
      grid.voxelAt(4, 40, 0).fluid.Ca = 100;
      grid.voxelAt(4, 40, 1).fluid.Ca = 200;
      grid.voxelAt(4, 40, 2).fluid.Ca = 300;
      grid.voxelAt(4, 40, 3).fluid.Ca = 400;
      expect(grid.sampleFluid(4, 40, 0, 'Ca')).toBe(100);
      expect(grid.sampleFluid(4, 40, 1, 'Ca')).toBe(200);
      expect(grid.sampleFluid(4, 40, 2, 'Ca')).toBe(300);
      expect(grid.sampleFluid(4, 40, 3, 'Ca')).toBe(400);
    });

    it('midpoint averages adjacent stored slices', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      grid.voxelAt(4, 40, 0).fluid.Mg = 0;
      grid.voxelAt(4, 40, 1).fluid.Mg = 100;
      grid.voxelAt(4, 40, 2).fluid.Mg = 200;
      grid.voxelAt(4, 40, 3).fluid.Mg = 300;
      // depth=0.5 → halfway between d=0 and d=1
      expect(grid.sampleFluid(4, 40, 0.5, 'Mg')).toBe(50);
      // depth=1.5 → halfway between d=1 and d=2
      expect(grid.sampleFluid(4, 40, 1.5, 'Mg')).toBe(150);
      // depth=2.5 → halfway between d=2 and d=3
      expect(grid.sampleFluid(4, 40, 2.5, 'Mg')).toBe(250);
    });

    it('off-cardinal fractional depth interpolates correctly', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      grid.voxelAt(4, 40, 1).fluid.Fe = 100;
      grid.voxelAt(4, 40, 2).fluid.Fe = 200;
      // depth=1.25 → 0.75·100 + 0.25·200 = 125
      expect(grid.sampleFluid(4, 40, 1.25, 'Fe')).toBeCloseTo(125, 6);
      // depth=1.75 → 0.25·100 + 0.75·200 = 175
      expect(grid.sampleFluid(4, 40, 1.75, 'Fe')).toBeCloseTo(175, 6);
    });

    it('clamps depth below 0 to 0', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      grid.voxelAt(4, 40, 0).fluid.Mn = 42;
      expect(grid.sampleFluid(4, 40, -1.0, 'Mn')).toBe(42);
      expect(grid.sampleFluid(4, 40, -100, 'Mn')).toBe(42);
    });

    it('clamps depth above max to depth_count - 1', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      grid.voxelAt(4, 40, 3).fluid.Mn = 99;
      expect(grid.sampleFluid(4, 40, 4.0, 'Mn')).toBe(99);
      expect(grid.sampleFluid(4, 40, 100, 'Mn')).toBe(99);
    });

    it('returns NaN for non-finite depth (NaN, ±Infinity)', () => {
      // Implementation choice: non-finite depth signals caller error;
      // returns NaN rather than guessing what was meant. Numerical
      // clamping is for finite-but-out-of-range values only.
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      expect(grid.sampleFluid(4, 40, NaN, 'Ca')).toBeNaN();
      expect(grid.sampleFluid(4, 40, Infinity, 'Ca')).toBeNaN();
      expect(grid.sampleFluid(4, 40, -Infinity, 'Ca')).toBeNaN();
    });
  });

  describe('diffuse — v158 delegates to wall mesh diffuse (preserves byte-identity)', () => {
    it('voxelGrid.diffuse runs without error', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      expect(() => {
        grid.diffuse(0.05, ['Ca', 'CO3', 'pH'], sim.ring_temperatures);
      }).not.toThrow();
    });

    it('voxelGrid.diffuse no-ops on rate <= 0', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      // Snapshot a couple of fluid values, run with rate 0, verify unchanged.
      const before = grid.voxelAt(8, 60, 0).fluid.Ca;
      grid.diffuse(0, ['Ca'], sim.ring_temperatures);
      expect(grid.voxelAt(8, 60, 0).fluid.Ca).toBe(before);
    });

    it('interior voxels (d≥1) stay uniform after diffuse on a uniform grid (Laplacian of a constant is zero)', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      // Run a few diffusion passes on a fresh (uniform) grid. v160's
      // _diffuseFull is a real 3D Laplacian, but the Laplacian of a
      // uniform field is zero — and the per-field variance skip short-
      // circuits the whole pass — so a freshly-allocated grid (every
      // voxel at the bulk broth) stays put. (Once engine mass-balance
      // creates a gradient, diffusion DOES move the interior — see the
      // v160 radial-replenishment test below.)
      for (let i = 0; i < 5; i++) {
        grid.diffuse(0.05, sim._fluidFieldNames, sim.ring_temperatures);
      }
      const bulkCa = sim.conditions.fluid.Ca;
      for (const [r, c] of [[2, 20], [9, 70], [14, 110]]) {
        expect(grid.voxelAt(r, c, 2).fluid.Ca).toBe(bulkCa);
      }
    });
  });

  describe('diffuse — v160 real 3D Laplacian (_diffuseFull)', () => {
    it('radial diffusion replenishes a depleted wall cell from the interior reservoir', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      const r = 8, c = 60;
      const reservoir = grid.voxelAt(r, c, 1).fluid.Ca;  // d=1 near-wall buffer (= bulk)
      // Simulate mass-balance consumption: deplete the d=0 wall cell.
      grid.voxelAt(r, c, 0).fluid.Ca = reservoir * 0.1;
      const before = grid.voxelAt(r, c, 0).fluid.Ca;
      for (let i = 0; i < 4; i++) grid.diffuse(0.1, ['Ca'], sim.ring_temperatures);
      const after = grid.voxelAt(r, c, 0).fluid.Ca;
      // The wall cell is pulled back up — laterally from neighbor d=0
      // cells AND radially from the d=1 reservoir — but not all the way
      // (the gradient relaxes, it doesn't snap).
      expect(after).toBeGreaterThan(before);
      expect(after).toBeLessThan(reservoir);
    });

    it('conserves total mass across a diffuse step (Neumann boundaries everywhere)', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      grid.voxelAt(5, 50, 0).fluid.Ca = 9999;  // perturb one cell
      const sumCa = () => grid.voxels.reduce((s: number, v: any) => s + (v.fluid ? v.fluid.Ca : 0), 0);
      const before = sumCa();
      grid.diffuse(0.1, ['Ca'], sim.ring_temperatures);
      const after = sumCa();
      // Discrete Laplacian with symmetric adjacency + matched degree
      // conserves the sum exactly (modulo float round-off).
      expect(Math.abs(after - before)).toBeLessThan(1e-6 * before);
    });

    it('asymmetric stepping: the deep reservoir (d=2) updates only on deep steps (every 4th)', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      const r = 8, c = 60;
      // Enrich the near-wall buffer (d=1) so there's a d=1↔d=2 gradient.
      grid.voxelAt(r, c, 1).fluid.Cl = 100;
      const d2 = () => grid.voxelAt(r, c, 2).fluid.Cl;
      const v0 = d2();
      // Call 1 (_diffStep 0 → DEEP): d=2 moves toward d=1.
      grid.diffuse(0.1, ['Cl'], sim.ring_temperatures);
      const v1 = d2();
      expect(v1).not.toBe(v0);
      // Calls 2-4 (_diffStep 1,2,3 → SHALLOW): d=2 frozen (no flux d1↔d2).
      grid.diffuse(0.1, ['Cl'], sim.ring_temperatures);
      grid.diffuse(0.1, ['Cl'], sim.ring_temperatures);
      grid.diffuse(0.1, ['Cl'], sim.ring_temperatures);
      expect(d2()).toBe(v1);
      // Call 5 (_diffStep 4 → DEEP): d=2 moves again.
      grid.diffuse(0.1, ['Cl'], sim.ring_temperatures);
      expect(d2()).not.toBe(v1);
    });
  });

  describe('strangulation gate — v160 _wallStrangledFor (Putnis 2009 boundary-layer depletion)', () => {
    it('returns false when the mineral is not supersaturated in bulk (wrong ingredients — byte-neutral)', () => {
      const sim = makeSim();
      // mvt broth has no Cu → bulk σ_malachite is 0 → the gate must NOT
      // engage (it would otherwise skip the engine's substrate-pick RNG
      // and desync every scenario). This is the byte-identity guarantee.
      expect(sim._wallStrangledFor('malachite')).toBe(false);
    });

    it('returns true when bulk favors the mineral but every wall cell is depleted; false once one cell clears', () => {
      const sim = makeSim();
      const cond = sim.conditions;
      // Force the BULK view strongly calcite-supersaturated.
      cond.fluid.Ca = 5000;
      cond.fluid.CO3 = 5000;
      cond.fluid.pH = 8.5;
      const crit = (globalThis as any).MINERAL_GATES_REGISTRY?.calcite?.sigma_crit;
      const bulkSigma = cond.supersaturation_calcite();
      // Guard: this constructed test only means something if the bulk is
      // above threshold. (It is, for this chemistry — assert so a future
      // engine change that breaks the premise fails loudly here.)
      expect(bulkSigma).toBeGreaterThan(crit);
      // Deplete EVERY wall cell below threshold (Ca/CO3 → 0).
      const mesh = sim.wall_state.meshFor(sim);
      for (const cell of mesh.cells) {
        if (cell && cell.fluid) { cell.fluid.Ca = 0; cell.fluid.CO3 = 0; }
      }
      expect(sim._wallStrangledFor('calcite')).toBe(true);
      // Un-deplete a single cell → that cell clears → no longer strangled.
      mesh.cells[0].fluid.Ca = 5000;
      mesh.cells[0].fluid.CO3 = 5000;
      mesh.cells[0].fluid.pH = 8.5;
      expect(sim._wallStrangledFor('calcite')).toBe(false);
    });
  });

  describe('sim-level accessors', () => {
    it('sim.voxelAt delegates to grid.voxelAt', () => {
      const sim = makeSim();
      const grid = sim.wall_state.voxelGridFor(sim);
      expect(sim.voxelAt(5, 50, 2)).toBe(grid.voxelAt(5, 50, 2));
    });

    it('sim.boundaryVoxel returns d=0 voxel', () => {
      const sim = makeSim();
      expect(sim.boundaryVoxel(5, 50)).toBe(sim.voxelAt(5, 50, 0));
    });

    it('sim.fluidAtVoxel returns voxel.fluid', () => {
      const sim = makeSim();
      expect(sim.fluidAtVoxel(5, 50, 2)).toBe(sim.voxelAt(5, 50, 2).fluid);
    });

    it('sim.sampleVoxelFluid interpolates across stored slices', () => {
      const sim = makeSim();
      sim.voxelAt(5, 50, 1).fluid.Cl = 10;
      sim.voxelAt(5, 50, 2).fluid.Cl = 20;
      expect(sim.sampleVoxelFluid(5, 50, 1.5, 'Cl')).toBe(15);
    });
  });

  describe('integration: v158 ships with byte-identical baseline', () => {
    // Smoke test — running a scenario for 50 steps with the voxel grid
    // allocated should produce the same crystals as it did pre-v158.
    // Full byte-equivalence is verified by tests-js/calibration.test.ts
    // against tests-js/baselines/seed42_v158.json (which should match
    // seed42_v157.json byte-for-byte). This test just verifies the
    // happy path doesn't throw or produce obviously wrong output.
    it('runs mvt for 50 steps without errors', () => {
      const sim = makeSim('mvt');
      expect(() => {
        for (let i = 0; i < 50; i++) sim.run_step();
      }).not.toThrow();
      expect(sim.crystals.length).toBeGreaterThan(0);
    });
  });
});
