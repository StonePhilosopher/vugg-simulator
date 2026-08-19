import { describe, expect, it } from 'vitest';

declare const WallState: any;
declare const CavityScalarField: any;
declare const setSeed: any;
declare const _liveRng: any;

function makeWall(seed = 42, architecture = 'pocket') {
  return new WallState({
    cells_per_ring: 32,
    ring_count: 12,
    vug_diameter_mm: 50,
    primary_bubbles: 3,
    secondary_bubbles: 6,
    shape_seed: seed,
    architecture,
  });
}

describe('CavityScalarField — authored cavity scalar oracle', () => {
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

  it.each(['tabular', 'cleft', 'basin'])(
    'puts every canonical %s WallMesh vertex, including caps, on the analytic zero set',
    (architecture) => {
      const wall = makeWall(42, architecture);
      const field = CavityScalarField.fromWallState(wall, { resolution: 24 });
      const mesh = wall.meshFor();
      for (let index = 0; index < mesh.positions.length / 3; index++) {
        const x = mesh.positions[index * 3];
        const y = mesh.positions[index * 3 + 1];
        const z = mesh.positions[index * 3 + 2];
        const surfaceValue = field.sampleAnalyticWorld(x, y, z);
        expect(Math.abs(surfaceValue)).toBeLessThan(2e-5);
        expect(field.sampleAnalyticWorld(x * 0.99, y * 0.99, z * 0.99)).toBeGreaterThan(0);
        expect(field.sampleAnalyticWorld(x * 1.01, y * 1.01, z * 1.01)).toBeLessThan(0);
      }
    },
  );

  it('freezes construction-time masks and hashes only effective sampled inputs', () => {
    const wall = makeWall();
    const base = wall.cavityFieldFor({ resolution: 20 });
    expect(() => { wall.elongation = 0.2; }).toThrow(TypeError);
    expect(() => { wall.polar_flatten = 0.22; }).toThrow(TypeError);
    expect(() => { wall.twist_amplitudes[0] = 0.1; }).toThrow(TypeError);
    expect(Object.keys(wall)).not.toContain('_cavity_shape');
    expect(JSON.stringify(wall)).not.toContain('"_cavity_shape"');
    expect(wall.cavityFieldFor({ resolution: 20 })).toBe(base);

    const tabular = CavityScalarField.fromWallState(makeWall(42, 'tabular'), { resolution: 20 });
    expect(tabular.sig).not.toBe(base.sig);

    const bubbles = [[0, 0, 0, 1]];
    const flattened = CavityScalarField.fromBubbles(bubbles, {
      resolution: 16,
      shape: { polar_flatten: 0.22 },
    });
    const collapseIgnored = CavityScalarField.fromBubbles(bubbles, {
      resolution: 16,
      shape: { polar_flatten: 0.22, polar_collapse: 1 },
    });
    expect(collapseIgnored.sig).toBe(flattened.sig);
    expect(Array.from(collapseIgnored.values)).toEqual(Array.from(flattened.values));
  });

  it('preserves sparse harmonic order while ignoring zero-amplitude phases', () => {
    const bubbles = [[0, 0, 0, 1]];
    const shape = {
      polar_amplitudes: [0, 0.2],
      polar_phases: [19, 0],
    };
    // The active term is n=2: south is stretched to 1.2 and the equator
    // contracts to 0.8. Dropping the leading zero would silently turn it into
    // an n=1 harmonic and fail the equatorial zero-set assertion.
    expect(Math.abs(CavityScalarField.authoredShapeValue(bubbles, shape, 0, -1.2, 0)))
      .toBeLessThan(1e-12);
    expect(Math.abs(CavityScalarField.authoredShapeValue(bubbles, shape, 0.8, 0, 0)))
      .toBeLessThan(1e-12);
    const a = CavityScalarField.fromBubbles(bubbles, { resolution: 16, shape });
    const b = CavityScalarField.fromBubbles(bubbles, {
      resolution: 16,
      shape: { ...shape, polar_phases: [-7, 0] },
    });
    expect(a.sig).toBe(b.sig);
    expect(Array.from(a.values)).toEqual(Array.from(b.values));
  });

  it('keeps elongation continuous where longitude becomes undefined at the poles', () => {
    const bubbles = [[0, 0, 0, 1]];
    const shape = { elongation: 0.55 };
    expect(Math.abs(CavityScalarField.authoredShapeValue(bubbles, shape, 1.55, 0, 0)))
      .toBeLessThan(1e-12);
    expect(Math.abs(CavityScalarField.authoredShapeValue(bubbles, shape, 0, 0, 0.45)))
      .toBeLessThan(1e-12);
    expect(Math.abs(CavityScalarField.authoredShapeValue(bubbles, shape, 0, 1, 0)))
      .toBeLessThan(1e-12);
    expect(Math.abs(CavityScalarField.authoredShapeValue(bubbles, shape, 0, -1, 0)))
      .toBeLessThan(1e-12);

    const epsilon = 1e-4;
    const axial = Math.sqrt(1 - epsilon * epsilon);
    const xApproach = CavityScalarField.authoredShapeValue(
      bubbles, shape, epsilon, axial, 0,
    );
    const zApproach = CavityScalarField.authoredShapeValue(
      bubbles, shape, 0, axial, epsilon,
    );
    expect(Math.abs(xApproach)).toBeLessThan(1e-7);
    expect(Math.abs(zApproach)).toBeLessThan(1e-7);
    expect(Math.abs(xApproach - zApproach)).toBeLessThan(2e-8);
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
    expect(() => CavityScalarField.fromBubbles([[0, 0, 0, 1]], {
      resolution: 16,
      shape: { polar_amplitudes: [0.1], polar_phases: [] },
    })).toThrow(/equal-length/i);
    expect(() => CavityScalarField.fromBubbles([[0, 0, 0, 1]], {
      resolution: 16,
      shape: { polar_collapse: 1.1 },
    })).toThrow(/must not exceed 1/i);
    expect(() => CavityScalarField.fromBubbles([[0, 0, 0, 1]], {
      resolution: 16,
      shape: { elongation: Number.NaN },
    })).toThrow(/finite/i);
  });
});
