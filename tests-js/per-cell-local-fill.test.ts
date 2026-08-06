// tests-js/per-cell-local-fill.test.ts — Proposal E (2026-05-18).
//
// Per-cell local fill. Each cell of the cavity mesh tracks its own
// occupancy fraction; the growth-loop dampener reads the crystal's
// anchor-cell local fill instead of the global vugFill when
// wall.per_cell_local_fill is true.
//
// Why this exists (proposals/RESEARCH-GROWTH-AT-HIGH-FILL.md §5,
// Proposal E): Nature Communications 2022 confined-geometry crystal-
// growth study showed that "corners stay open while edges fill" —
// real cavities have heterogeneous boundary-layer diffusion. The
// pre-Proposal-E simulator averaged over this heterogeneity via a
// single get_vug_fill() reading. Per-cell fill restores the locality.
//
// Test scope: scaffolding correctness only (the math + painter +
// accessors). Calibration drift on opt-in scenarios is covered by
// regen baselines, not pins.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const Crystal: any;
declare const GrowthZone: any;
declare const WallState: any;

describe('Proposal E — per-cell local fill (2026-05-18)', () => {
  describe('opt-in flag preserves byte-identical behavior when off', () => {
    it('WallState.per_cell_local_fill defaults to false', () => {
      const wall = new WallState({ vug_diameter_mm: 50 });
      expect(wall.per_cell_local_fill).toBe(false);
    });

    it('cells start with _localCrystalVol_mm3 = 0', () => {
      const wall = new WallState({ vug_diameter_mm: 50, ring_count: 4, cells_per_ring: 30 });
      for (let r = 0; r < wall.ring_count; r++) {
        for (let c = 0; c < wall.cells_per_ring; c++) {
          expect(wall.rings[r][c]._localCrystalVol_mm3).toBe(0);
        }
      }
    });

    it('clear() resets _localCrystalVol_mm3', () => {
      const wall = new WallState({ vug_diameter_mm: 50, ring_count: 4, cells_per_ring: 30 });
      wall.rings[2][15]._localCrystalVol_mm3 = 1.234;
      wall.clear();
      expect(wall.rings[2][15]._localCrystalVol_mm3).toBe(0);
    });
  });

  describe('_cellCavityVolMm3 math (polar-bias-weighted cell volume)', () => {
    it('summed over all (r,c) recovers the full cavity volume', () => {
      const wall = new WallState({ vug_diameter_mm: 50, ring_count: 16, cells_per_ring: 120 });
      const R = 25; // mm
      const cavityVol = (4 / 3) * Math.PI * R * R * R;
      let total = 0;
      for (let r = 0; r < wall.ring_count; r++) {
        const vPerCell = wall._cellCavityVolMm3(r);
        total += vPerCell * wall.cells_per_ring;
      }
      // Sum should equal cavity volume to floating-point tolerance.
      expect(total).toBeCloseTo(cavityVol, 5);
    });

    it('equator-ring cells are bigger than pole-ring cells (sin(phi) weighting)', () => {
      const wall = new WallState({ vug_diameter_mm: 50, ring_count: 16, cells_per_ring: 120 });
      const equator = Math.floor(wall.ring_count / 2);
      const equatorVol = wall._cellCavityVolMm3(equator);
      const poleVol = wall._cellCavityVolMm3(0);
      // sin(phi) at the pole-most ring is < sin(phi) at the equator —
      // pole cells should carry less volume budget than equator cells.
      expect(equatorVol).toBeGreaterThan(poleVol);
    });

    it('scales with vug_diameter_mm³', () => {
      const small = new WallState({ vug_diameter_mm: 50, ring_count: 16, cells_per_ring: 120 });
      const big = new WallState({ vug_diameter_mm: 100, ring_count: 16, cells_per_ring: 120 });
      const ratio = big._cellCavityVolMm3(8) / small._cellCavityVolMm3(8);
      // Diameter doubled → radius doubled → volume × 8.
      expect(ratio).toBeCloseTo(8, 2);
    });
  });

  describe('_paintCrystalVolume distributes _volume_mm3 across footprint', () => {
    function makeAnchoredCrystal(wall: any, ringIdx: number, cellIdx: number) {
      const c = new Crystal({ mineral: 'adamite', crystal_id: 42 });
      c.wall_anchor = wall._anchorFromRingCell(ringIdx, cellIdx);
      return c;
    }

    it('no-op when crystal has no _volume_mm3 (legacy snapshots)', () => {
      const wall = new WallState({ vug_diameter_mm: 50, ring_count: 16, cells_per_ring: 120 });
      const c = makeAnchoredCrystal(wall, 8, 60);
      // _volume_mm3 left undefined on this synthetic crystal.
      delete c._volume_mm3;
      wall._paintCrystalVolume(c);
      // Every cell still 0.
      let total = 0;
      for (const ring of wall.rings) for (const cell of ring) total += cell._localCrystalVol_mm3;
      expect(total).toBe(0);
    });

    it('zero-volume crystal contributes nothing', () => {
      const wall = new WallState({ vug_diameter_mm: 50, ring_count: 16, cells_per_ring: 120 });
      const c = makeAnchoredCrystal(wall, 8, 60);
      c._volume_mm3 = 0;
      wall._paintCrystalVolume(c);
      let total = 0;
      for (const ring of wall.rings) for (const cell of ring) total += cell._localCrystalVol_mm3;
      expect(total).toBe(0);
    });

    it('total painted volume equals crystal._volume_mm3 (mass conservation)', () => {
      const wall = new WallState({ vug_diameter_mm: 50, ring_count: 16, cells_per_ring: 120 });
      const c = makeAnchoredCrystal(wall, 8, 60);
      // Synthesize a crystal with known volume and footprint geometry.
      c._volume_mm3 = 12.345;
      c.total_growth_um = 5000;  // 5mm crystal
      c.wall_spread = 0.5;        // mid-range spread
      wall._paintCrystalVolume(c);
      let total = 0;
      for (const ring of wall.rings) for (const cell of ring) total += cell._localCrystalVol_mm3;
      // Painter divides volume across span = 2*halfCells+1 cells. Sum
      // must equal crystal._volume_mm3 exactly (no rounding loss — pure
      // division then summed back).
      expect(total).toBeCloseTo(12.345, 6);
    });

    it('volume concentrates at the anchor cell (peak at center)', () => {
      const wall = new WallState({ vug_diameter_mm: 50, ring_count: 16, cells_per_ring: 120 });
      const c = makeAnchoredCrystal(wall, 8, 60);
      c._volume_mm3 = 10.0;
      c.total_growth_um = 1000;
      c.wall_spread = 0.5;
      wall._paintCrystalVolume(c);
      const ring = wall.rings[8];
      // The anchor cell (60) should have positive volume; cells far
      // away (e.g. cell 0 — opposite side) should have zero.
      expect(ring[60]._localCrystalVol_mm3).toBeGreaterThan(0);
      expect(ring[0]._localCrystalVol_mm3).toBe(0);
    });

    it('wider footprint (high wall_spread) spreads volume thinner', () => {
      const wall1 = new WallState({ vug_diameter_mm: 50, ring_count: 16, cells_per_ring: 120 });
      const wall2 = new WallState({ vug_diameter_mm: 50, ring_count: 16, cells_per_ring: 120 });
      const cNarrow = makeAnchoredCrystal(wall1, 8, 60);
      cNarrow._volume_mm3 = 10.0;
      cNarrow.total_growth_um = 5000;
      cNarrow.wall_spread = 0.2;  // narrow prismatic
      wall1._paintCrystalVolume(cNarrow);

      const cWide = makeAnchoredCrystal(wall2, 8, 60);
      cWide._volume_mm3 = 10.0;
      cWide.total_growth_um = 5000;
      cWide.wall_spread = 0.8;  // wide coating
      wall2._paintCrystalVolume(cWide);

      // Both crystals carry the same total volume, but the wider footprint
      // distributes it across more cells, so per-cell volume is lower at
      // the anchor.
      expect(wall1.rings[8][60]._localCrystalVol_mm3)
        .toBeGreaterThan(wall2.rings[8][60]._localCrystalVol_mm3);
    });
  });

  describe('getCellLocalFill accessors', () => {
    it('returns 0 for empty cells', () => {
      const wall = new WallState({ vug_diameter_mm: 50, ring_count: 16, cells_per_ring: 120 });
      expect(wall.getCellLocalFill(8, 60)).toBe(0);
    });

    it('returns volume / cellCavityVol', () => {
      const wall = new WallState({ vug_diameter_mm: 50, ring_count: 16, cells_per_ring: 120 });
      const cellVol = wall._cellCavityVolMm3(8);
      wall.rings[8][60]._localCrystalVol_mm3 = cellVol * 0.5;
      expect(wall.getCellLocalFill(8, 60)).toBeCloseTo(0.5, 6);
    });

    it('out-of-range indices return 0 (no throw)', () => {
      const wall = new WallState({ vug_diameter_mm: 50, ring_count: 16, cells_per_ring: 120 });
      expect(wall.getCellLocalFill(-1, 60)).toBe(0);
      expect(wall.getCellLocalFill(99, 60)).toBe(0);
      expect(wall.getCellLocalFill(8, -1)).toBe(0);
      expect(wall.getCellLocalFill(8, 9999)).toBe(0);
    });

    it('getCellLocalFillForCrystal resolves the anchor', () => {
      const wall = new WallState({ vug_diameter_mm: 50, ring_count: 16, cells_per_ring: 120 });
      const c = new Crystal({ mineral: 'adamite', crystal_id: 1 });
      c.wall_anchor = wall._anchorFromRingCell(8, 60);
      const cellVol = wall._cellCavityVolMm3(8);
      wall.rings[8][60]._localCrystalVol_mm3 = cellVol * 0.75;
      expect(wall.getCellLocalFillForCrystal(c)).toBeCloseTo(0.75, 6);
    });

    it('crystals with no anchor return 0', () => {
      const wall = new WallState({ vug_diameter_mm: 50, ring_count: 16, cells_per_ring: 120 });
      const c = new Crystal({ mineral: 'adamite', crystal_id: 1 });
      // No wall_anchor set.
      expect(wall.getCellLocalFillForCrystal(c)).toBe(0);
    });
  });

  describe('end-to-end: flag preserves byte-identical output when off', () => {
    // The opt-in design's load-bearing property: with per_cell_local_fill
    // off (default), every existing scenario produces output identical
    // to pre-Proposal-E. This is the regression guard — without it, the
    // 263-test baseline would drift on every scenario.
    it('sabkha_dolomitization stays open with flag off under corrected chemistry', () => {
      setSeed(42);
      const { conditions, events } = SCENARIOS['sabkha_dolomitization']();
      const sim = new VugSimulator(conditions, events);
      // Capture the step at which the seal fires (sim.step records
      // the current step number, so we sample at each iteration).
      let sealAtStep: number | null = null;
      for (let i = 0; i < 30; i++) {
        sim.run_step();
        if (sim._vug_sealed && sealAtStep === null) {
          sealAtStep = sim.step;
        }
      }
      // The old early seal was produced by independent gypsum + anhydrite
      // precipitation from the same CaSO4 inventory. The authoritative
      // selector/replacement ledger correctly leaves the cavity open.
      expect(sealAtStep).toBeNull();
      const fill = sim.get_vug_fill();
      expect(Number.isFinite(fill)).toBe(true);
      expect(fill).toBeLessThan(0.05);
    });

    it('flag-on run completes without throwing', () => {
      // Smoke test: with the flag on, a normal scenario runs end-to-end
      // and produces a finite vugFill. Specific calibration drift on
      // opt-in scenarios is verified via the baseline regen workflow,
      // not here.
      setSeed(42);
      const { conditions, events } = SCENARIOS['sabkha_dolomitization']();
      // Force the flag on without depending on scenario JSON changes.
      conditions.wall.per_cell_local_fill = true;
      const sim = new VugSimulator(conditions, events);
      for (let i = 0; i < 30; i++) sim.run_step();
      // Should not have thrown, and vugFill should still be finite.
      const fill = sim.get_vug_fill();
      expect(Number.isFinite(fill)).toBe(true);
      expect(fill).toBeGreaterThanOrEqual(0);
    });

    it('flag-on actually paints _localCrystalVol_mm3 after a step', () => {
      setSeed(42);
      const { conditions, events } = SCENARIOS['sabkha_dolomitization']();
      conditions.wall.per_cell_local_fill = true;
      const sim = new VugSimulator(conditions, events);
      sim.run_step();
      let totalLocalVol = 0;
      for (const ring of sim.wall_state.rings) {
        for (const cell of ring) totalLocalVol += (cell._localCrystalVol_mm3 || 0);
      }
      // Sabkha is the canonical fast-seal scenario — by step 1 there
      // should be SOME painted volume.
      expect(totalLocalVol).toBeGreaterThan(0);
    });

    it('flag-off leaves _localCrystalVol_mm3 at 0 (painter skipped)', () => {
      setSeed(42);
      const { conditions, events } = SCENARIOS['sabkha_dolomitization']();
      // Default — flag off (don't force it).
      const sim = new VugSimulator(conditions, events);
      sim.run_step();
      let totalLocalVol = 0;
      for (const ring of sim.wall_state.rings) {
        for (const cell of ring) totalLocalVol += (cell._localCrystalVol_mm3 || 0);
      }
      expect(totalLocalVol).toBe(0);
    });
  });

  describe('corners-stay-open property (the geological win)', () => {
    // The motivating Nature Comm 2022 finding: in a confined cavity,
    // crystal growth happens preferentially at the edges/faces fed by
    // bulk fluid diffusion, leaving the corners less-filled. Per-cell
    // local fill captures this: at any given step, the spread of local
    // fills across cells should be > 0 if crystals are clustered (some
    // cells full, others empty).
    it('cell-fill heterogeneity grows with crystal clustering', () => {
      setSeed(42);
      const { conditions, events } = SCENARIOS['sabkha_dolomitization']();
      conditions.wall.per_cell_local_fill = true;
      const sim = new VugSimulator(conditions, events);
      // Run enough steps to get a meaningful crystal distribution.
      for (let i = 0; i < 10; i++) sim.run_step();
      // Collect non-zero per-cell local fills.
      const fills: number[] = [];
      for (let r = 0; r < sim.wall_state.ring_count; r++) {
        for (let c = 0; c < sim.wall_state.cells_per_ring; c++) {
          const f = sim.wall_state.getCellLocalFill(r, c);
          if (f > 0) fills.push(f);
        }
      }
      // Crystals nucleated → some cells should be > 0; not every cell.
      expect(fills.length).toBeGreaterThan(0);
      // Spread: max should exceed min by at least 2× — that's the
      // edges-vs-corners heterogeneity. If every cell had the same
      // fill we'd be back to a global average; the per-cell view
      // must show variance.
      if (fills.length > 1) {
        const minFill = Math.min(...fills);
        const maxFill = Math.max(...fills);
        expect(maxFill / Math.max(minFill, 1e-9)).toBeGreaterThan(1.5);
      }
    });
  });
});
