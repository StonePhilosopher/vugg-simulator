import { describe, expect, it } from 'vitest';

declare const WallState: any;
declare const CavityScalarField: any;
declare const setSeed: any;
declare const _liveRng: any;

function makeWall(seed = 42) {
  return new WallState({
    cells_per_ring: 32,
    ring_count: 12,
    vug_diameter_mm: 50,
    primary_bubbles: 3,
    secondary_bubbles: 6,
    shape_seed: seed,
  });
}

describe('CavityScalarField — exact renderer-only bubble union', () => {
  it('uses the positive-void / negative-rock sign convention', () => {
    const wall = makeWall();
    const field = CavityScalarField.fromWallState(wall, { resolution: 24 });
    expect(field.sampleAnalyticWorld(0, 0, 0)).toBeGreaterThan(0);
    const far = field.bounds.max.map((value: number) => value + field.spacingMm * 2);
    expect(field.sampleAnalyticWorld(far[0], far[1], far[2])).toBeLessThan(0);
    for (const [x, y, z] of wall.bubbles) {
      expect(field.sampleAnalyticWorld(x, y, z)).toBeGreaterThan(0);
    }
  });

  it('matches the direct exact-union oracle at every sampled grid point', () => {
    const wall = makeWall(2718);
    const field = CavityScalarField.fromWallState(wall, { resolution: 18 });
    for (const z of [0, 3, 9, 17]) for (const y of [0, 5, 12, 17]) for (const x of [0, 4, 13, 17]) {
      const world = field.worldPosition(x, y, z);
      const oracle = CavityScalarField.bubbleUnionValue(wall.bubbles, world[0], world[1], world[2]);
      expect(field.valueAt(x, y, z)).toBeCloseTo(oracle, 5);
    }
  });

  it('keeps a complete rock-negative border and cubic physical spacing', () => {
    const field = CavityScalarField.fromWallState(makeWall(31415), { resolution: 24 });
    expect(field.hasNegativeBorder(0)).toBe(true);
    expect(field.sizeX).toBe(24);
    expect(field.sizeY).toBe(24);
    expect(field.sizeZ).toBe(24);
    const extent = field.bounds.max.map((value: number, axis: number) => value - field.bounds.min[axis]);
    expect(extent[0]).toBeCloseTo(extent[1], 12);
    expect(extent[1]).toBeCloseTo(extent[2], 12);
    expect(extent[0]).toBeCloseTo(field.spacingMm * 23, 12);
  });

  it('round-trips grid corners through world sampling', () => {
    const field = CavityScalarField.fromWallState(makeWall(99), { resolution: 20 });
    for (const point of [[0, 0, 0], [7, 11, 4], [19, 19, 19]]) {
      const world = field.worldPosition(point[0], point[1], point[2]);
      expect(field.sampleWorld(world[0], world[1], world[2]))
        .toBeCloseTo(field.valueAt(point[0], point[1], point[2]), 7);
    }
  });

  it('is byte-deterministic for the same authored shape seed', () => {
    const a = CavityScalarField.fromWallState(makeWall(42), { resolution: 24 });
    const b = CavityScalarField.fromWallState(makeWall(42), { resolution: 24 });
    expect(a.sig).toBe(b.sig);
    expect(Array.from(new Uint8Array(a.values.buffer))).toEqual(Array.from(new Uint8Array(b.values.buffer)));
  });

  it('does not consume the live simulation RNG', () => {
    setSeed(42);
    const before = _liveRng().state;
    CavityScalarField.fromWallState(makeWall(42), { resolution: 24 });
    expect(_liveRng().state).toBe(before);
  });

  it('fails closed on non-finite or malformed bubble inputs', () => {
    expect(() => CavityScalarField.fromBubbles([], { resolution: 16 })).toThrow(/at least one/i);
    expect(() => CavityScalarField.fromBubbles([[0, 0, 0, Infinity]], { resolution: 16 })).toThrow(/finite/i);
    expect(() => CavityScalarField.fromBubbles([[0, 0, 0, -1]], { resolution: 16 })).toThrow(/positive/i);
    expect(() => CavityScalarField.fromBubbles([[0, 0, 1]], { resolution: 16 })).toThrow(/cx, cy, cz/i);
  });
});
