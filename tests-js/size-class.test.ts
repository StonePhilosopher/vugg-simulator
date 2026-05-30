// tests-js/size-class.test.ts — boss-vision size-class cascade.
//
// Pins the three-tier vug/pocket/cave cascade introduced in 2026-05.
// Each tier maps to a literature-anchored vug_diameter_mm range; this
// suite asserts that:
//   * The three tiers exist with the expected ranges (anchored to the
//     boss's "inches/feet/meters" mental model — 25mm and 300mm
//     boundaries).
//   * VugWall.size_class is null by default (backward-compat).
//   * Explicit vug_diameter_mm always wins over size_class.
//   * size_class alone (no vug_diameter_mm) maps to the range midpoint
//     for deterministic callers.
//   * size_class + a custom _size_rng draws within the range
//     (random-mode hook).
//   * WallState mirrors size_class so UI can read sim.wall_state.size_class.
//   * The size_class field surfaces in scenario JSON without forcing a
//     vug_diameter_mm change (existing scenarios stay byte-identical).
//
// What this is NOT testing:
//   * The random-mode UI selector itself (DOM integration is jsdom-tested
//     via the bundle's getElementById stub but the actual <select>
//     element is in index.html, which is hand-written outside the bundle).
//   * That a size_class change in a scenario produces the "right" number
//     of crystals or geological aesthetic — that's calibration territory.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const VugConditions: any;
declare const VugWall: any;
declare const FluidChemistry: any;
declare const setSeed: any;

function makeBareConditions(wallOpts: any = {}) {
  return new VugConditions({
    fluid: new FluidChemistry({ pH: 7, concentration: 1.0 }),
    wall: new VugWall(wallOpts),
    temperature: 25,
    pressure_bars: 1,
  });
}

describe('size-class cascade (boss vision, 2026-05)', () => {
  describe('VugWall.size_class default + opt-in', () => {
    it('size_class is null by default (no opt-in)', () => {
      const wall = new VugWall();
      expect(wall.size_class).toBeNull();
    });

    it('explicit vug_diameter_mm wins over default — preserves every shipped scenario', () => {
      // Many scenarios set vug_diameter_mm explicitly (sabkha sets 60 at v148,
      // stalactite_demo sets 60, etc); if a scenario ALSO sets size_class,
      // the explicit diameter still wins.
      const wall = new VugWall({ vug_diameter_mm: 30, size_class: 'cave' });
      expect(wall.vug_diameter_mm).toBe(30);
      expect(wall.size_class).toBe('cave');
    });

    it('size_class alone maps to range midpoint (deterministic)', () => {
      // Vug midpoint: (5 + 25) / 2 = 15
      const vug = new VugWall({ size_class: 'vug' });
      expect(vug.vug_diameter_mm).toBe(15);
      // Pocket midpoint: (25 + 300) / 2 = 162.5
      const pocket = new VugWall({ size_class: 'pocket' });
      expect(pocket.vug_diameter_mm).toBeCloseTo(162.5, 1);
      // Cave midpoint: (300 + 3000) / 2 = 1650
      const cave = new VugWall({ size_class: 'cave' });
      expect(cave.vug_diameter_mm).toBe(1650);
    });

    it('size_class + _size_rng draws within the literature range', () => {
      // Vug range: 5-25mm. Draw 100 samples; every one should be in
      // [5, 25], min should approach 5, max should approach 25.
      let min = Infinity, max = -Infinity;
      for (let i = 0; i < 100; i++) {
        const r = i / 99;  // 0 to 1
        const wall = new VugWall({ size_class: 'vug', _size_rng: () => r });
        expect(wall.vug_diameter_mm).toBeGreaterThanOrEqual(5);
        expect(wall.vug_diameter_mm).toBeLessThanOrEqual(25);
        if (wall.vug_diameter_mm < min) min = wall.vug_diameter_mm;
        if (wall.vug_diameter_mm > max) max = wall.vug_diameter_mm;
      }
      expect(min).toBeCloseTo(5, 1);
      expect(max).toBeCloseTo(25, 1);
    });

    it('cave tier yields multi-meter cavities (boss vision: feet to meters)', () => {
      const small = new VugWall({ size_class: 'cave', _size_rng: () => 0 });
      const large = new VugWall({ size_class: 'cave', _size_rng: () => 1 });
      expect(small.vug_diameter_mm).toBeCloseTo(300, 1);   // 1 foot
      expect(large.vug_diameter_mm).toBeCloseTo(3000, 1);  // 3 m
    });

    it('unknown size_class falls back to legacy 50mm default', () => {
      const wall = new VugWall({ size_class: 'massive' as any });
      // Not in SIZE_CLASS_RANGES → resolver returns the legacy default.
      expect(wall.vug_diameter_mm).toBe(50);
      // But the tag is still stored (so a future runtime upgrade can
      // honor the value without losing player intent).
      expect(wall.size_class).toBe('massive');
    });
  });

  describe('WallState mirrors size_class for UI consumers', () => {
    it('sim.wall_state.size_class reflects the scenario / VugWall setting', () => {
      setSeed(42);
      const sim = new VugSimulator(
        makeBareConditions({ size_class: 'pocket' }),
        [],
      );
      expect(sim.wall_state.size_class).toBe('pocket');
    });

    it('null when no size_class is set (legacy scenarios)', () => {
      setSeed(42);
      const sim = new VugSimulator(makeBareConditions(), []);
      expect(sim.wall_state.size_class).toBeNull();
    });
  });

  describe('boundaries match boss mental model (inches / feet / meters)', () => {
    // The literature-anchored boundaries are 25mm (1 inch) and 300mm (1 foot).
    // These constants are referenced in the proposal doc + commit body;
    // the tests pin them so a casual range-edit gets caught.
    it('vug upper bound is 1 inch (25mm)', () => {
      const wall = new VugWall({ size_class: 'vug', _size_rng: () => 1 });
      expect(wall.vug_diameter_mm).toBeCloseTo(25, 1);
    });

    it('pocket lower bound is 1 inch (25mm)', () => {
      const wall = new VugWall({ size_class: 'pocket', _size_rng: () => 0 });
      expect(wall.vug_diameter_mm).toBeCloseTo(25, 1);
    });

    it('pocket upper bound is 1 foot (300mm)', () => {
      const wall = new VugWall({ size_class: 'pocket', _size_rng: () => 1 });
      expect(wall.vug_diameter_mm).toBeCloseTo(300, 1);
    });

    it('cave lower bound is 1 foot (300mm)', () => {
      const wall = new VugWall({ size_class: 'cave', _size_rng: () => 0 });
      expect(wall.vug_diameter_mm).toBeCloseTo(300, 1);
    });

    it('cave upper bound is 3 meters (3000mm)', () => {
      const wall = new VugWall({ size_class: 'cave', _size_rng: () => 1 });
      expect(wall.vug_diameter_mm).toBeCloseTo(3000, 1);
    });
  });

  describe('existing scenarios stay byte-identical', () => {
    // Every shipped scenario sets vug_diameter_mm explicitly. Tagging
    // them with size_class metadata (if/when that lands) must not
    // change their effective diameter.
    it('explicit vug_diameter_mm: 30 + size_class: vug → diameter stays 30 (not 15)', () => {
      const wall = new VugWall({ vug_diameter_mm: 30, size_class: 'vug' });
      expect(wall.vug_diameter_mm).toBe(30);
    });

    it('explicit vug_diameter_mm: 50 + no size_class → diameter stays 50', () => {
      const wall = new VugWall({ vug_diameter_mm: 50 });
      expect(wall.vug_diameter_mm).toBe(50);
      expect(wall.size_class).toBeNull();
    });
  });
});
