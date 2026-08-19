import { describe, expect, it } from 'vitest';

declare const CavityScalarField: any;
declare const MarchingCubesExtractor: any;
declare const WallState: any;

function fixtureField(size: number, sampler: (x: number, y: number, z: number) => number) {
  const values = new Float32Array(size * size * size);
  let offset = 0;
  for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    values[offset++] = sampler(x, y, z);
  }
  return new CavityScalarField({
    sizeX: size, sizeY: size, sizeZ: size,
    spacingMm: 1, origin: [0, 0, 0], values,
    sig: `fixture:${size}`,
  });
}

function edgeIncidence(surface: any) {
  const counts = new Map<string, number>();
  for (let i = 0; i < surface.indices.length; i += 3) {
    const tri = [surface.indices[i], surface.indices[i + 1], surface.indices[i + 2]];
    for (const [a, b] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]]) {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return counts;
}

function directedEdgeUses(surface: any) {
  const uses = new Map<string, number[]>();
  for (let i = 0; i < surface.indices.length; i += 3) {
    const tri = [surface.indices[i], surface.indices[i + 1], surface.indices[i + 2]];
    for (const [a, b] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]]) {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const directions = uses.get(key) || [];
      directions.push(a < b ? 1 : -1);
      uses.set(key, directions);
    }
  }
  return uses;
}

function componentCount(surface: any) {
  const neighbors = new Map<number, Set<number>>();
  for (let i = 0; i < surface.indices.length; i += 3) {
    const tri = [surface.indices[i], surface.indices[i + 1], surface.indices[i + 2]];
    for (const [a, b] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]]) {
      if (!neighbors.has(a)) neighbors.set(a, new Set());
      if (!neighbors.has(b)) neighbors.set(b, new Set());
      neighbors.get(a)!.add(b);
      neighbors.get(b)!.add(a);
    }
  }
  let components = 0;
  const visited = new Set<number>();
  for (const start of neighbors.keys()) {
    if (visited.has(start)) continue;
    components++;
    const queue = [start];
    while (queue.length) {
      const current = queue.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const next of neighbors.get(current) || []) if (!visited.has(next)) queue.push(next);
    }
  }
  return components;
}

describe('MarchingCubesExtractor — indexed deterministic topology', () => {
  it('resolves the starter-fluid seed-41 symmetric saddle deterministically', () => {
    const wall = new WallState({
      vug_diameter_mm: 50,
      ring_count: 16,
      cells_per_ring: 120,
      primary_bubbles: 3,
      secondary_bubbles: 5,
      shape_seed: 41,
      architecture: 'pocket',
    });
    wall.initializeCavityEvolutionLedger();
    const enabled = wall.enableProductionCavityAuthority();
    expect(enabled.contract.baseline_volume_convergence.reference_surface_buffer_digest)
      .toBeTruthy();
    expect(enabled.provider.kind).toBe('cavity-field');
    expect(Array.from(wall.activeCavitySurfaceAnchorProvider().surface.normals)
      .every(Number.isFinite)).toBe(true);
  });

  it('emits no triangles for empty or full cubes', () => {
    expect(MarchingCubesExtractor.extract(fixtureField(2, () => -1)).indices.length).toBe(0);
    expect(MarchingCubesExtractor.extract(fixtureField(2, () => +1)).indices.length).toBe(0);
  });

  it('resolves a single-positive-corner case through the exact tetrahedral zero set', () => {
    const field = fixtureField(2, (x, y, z) => (x === 0 && y === 0 && z === 0 ? 1 : -1));
    const surface = field.extract(0);
    expect(surface.indices.length).toBe(18);
    expect(surface.positions.length).toBe(21);
    const points = [];
    for (let i = 0; i < surface.positions.length; i += 3) {
      points.push(Array.from(surface.positions.slice(i, i + 3)).map((v: number) => Number(v.toFixed(6))).join(','));
    }
    expect(points).toContain('0.5,0,0');
    expect(points).toContain('0,0.5,0');
    expect(points).toContain('0,0,0.5');
    for (let index = 0; index < surface.positions.length; index += 3) {
      expect(Math.abs(field.sampleWorld(
        surface.positions[index], surface.positions[index + 1], surface.positions[index + 2],
      ))).toBeLessThan(1e-7);
    }
  });

  it('extracts a closed finite sphere with normalized outward normals', () => {
    const field = CavityScalarField.fromBubbles([[0, 0, 0, 10]], { resolution: 24, sig: 'sphere' });
    const surface = field.extract();
    expect(surface.indices.length).toBeGreaterThan(0);
    expect(Array.from(edgeIncidence(surface).values()).every((count) => count === 2)).toBe(true);
    expect(Array.from(directedEdgeUses(surface).values())
      .every((uses) => uses.length === 2 && uses[0] === -uses[1])).toBe(true);
    for (const value of [...surface.positions, ...surface.normals]) expect(Number.isFinite(value)).toBe(true);
    for (let i = 0; i < surface.normals.length; i += 3) {
      const nx = surface.normals[i], ny = surface.normals[i + 1], nz = surface.normals[i + 2];
      expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 5);
      const px = surface.positions[i], py = surface.positions[i + 1], pz = surface.positions[i + 2];
      expect(px * nx + py * ny + pz * nz).toBeGreaterThan(0);
    }
    for (let i = 0; i < surface.indices.length; i++) {
      expect(surface.indices[i]).toBeLessThan(surface.positions.length / 3);
    }
  });

  it('produces byte-identical position/index buffers for the same field', () => {
    const field = CavityScalarField.fromBubbles([[0, 0, 0, 8], [6, 1, -2, 4]], { resolution: 24, sig: 'determinism' });
    const a = field.extract();
    const b = field.extract();
    expect(Array.from(new Uint8Array(a.positions.buffer))).toEqual(Array.from(new Uint8Array(b.positions.buffer)));
    expect(Array.from(new Uint8Array(a.indices.buffer))).toEqual(Array.from(new Uint8Array(b.indices.buffer)));
  });

  it('retains two disconnected sphere components', () => {
    const field = CavityScalarField.fromBubbles([[-8, 0, 0, 4], [8, 0, 0, 4]], { resolution: 32, sig: 'two-spheres' });
    const surface = field.extract();
    expect(componentCount(surface)).toBe(2);
    expect(MarchingCubesExtractor.closedVolumeForField(field, 0))
      .toBeCloseTo(MarchingCubesExtractor.closedVolumeMm3(surface), 9);
  });

  it('closes a deliberately ambiguous shared-face saddle without cracks', () => {
    // Two diagonal positive interior samples make the x=2 face alternating
    // (+ - + -). Every volume boundary sample remains negative.
    const field = fixtureField(4, (x, y, z) =>
      (x === 2 && ((y === 1 && z === 1) || (y === 2 && z === 2))) ? 1 : -1);
    const surface = field.extract();
    expect(surface.indices.length).toBeGreaterThan(0);
    expect(Array.from(edgeIncidence(surface).values()).every((count) => count === 2)).toBe(true);
  });

  it('keeps exact-zero simulation-of-simplicity on the authenticated CPU/GPU zero set', () => {
    const field = fixtureField(5, (x, y, z) =>
      1 - (Math.abs(x - 2) + Math.abs(y - 2) + Math.abs(z - 2)));
    const surface = field.extract();
    expect(Array.from(edgeIncidence(surface).values()).every(count => count === 2)).toBe(true);
    let exactZeroVertices = 0;
    for (let index = 0; index < surface.positions.length; index += 3) {
      const value = field.sampleWorld(
        surface.positions[index], surface.positions[index + 1], surface.positions[index + 2],
      );
      expect(Math.abs(value)).toBeLessThanOrEqual(field.spacingMm * 3e-4);
      if (value === 0) exactZeroVertices++;
    }
    // Ordinary edge interpolation may still land exactly on the analytic zero
    // set; the metric below proves exact-zero *grid endpoints* took the bounded
    // simulation-of-simplicity path instead of collapsing to one vertex.
    expect(exactZeroVertices).toBeGreaterThan(0);
    expect(surface.metrics.near_zero_regularized_vertex_count).toBeGreaterThan(0);
    expect(surface.metrics.near_zero_scalar_floor_fraction).toBe(1 / 4096);
    const agreement = MarchingCubesExtractor.measureImplicitAgreement(field, surface, 2);
    expect(agreement.unresolved_sample_count).toBe(0);
    expect(agreement.max_normal_root_distance_voxels).toBeLessThan(1e-3);
    expect(MarchingCubesExtractor.closedVolumeForField(field, 0))
      .toBeCloseTo(MarchingCubesExtractor.closedVolumeMm3(surface), 9);
  });

  it('resolves the former trilinear interior ambiguity as a closed tetrahedral surface', () => {
    const field = CavityScalarField.fromBubbles(
      [[0, 0, 0, 3], [5, -3, 5, 4]],
      { resolution: 16, sig: 'adversarial-interior-ambiguity' },
    );
    const surface = field.extract();
    expect(surface.indices.length).toBeGreaterThan(0);
    expect(Array.from(edgeIncidence(surface).values()).every((count) => count === 2)).toBe(true);
  });

  it('rejects a tangent critical point with no unique physical surface normal', () => {
    const field = CavityScalarField.fromBubbles(
      [[-4, 0, 0, 4], [4, 0, 0, 4]],
      { resolution: 17, sig: 'tangent-critical-point' },
    );
    expect(() => field.extract()).toThrow(/undefined.*normal|critical point|non-manifold.*disconnected/i);
  });

  it('rejects unequal tangent components whose shared vertex has two disconnected links', () => {
    const field = CavityScalarField.fromBubbles(
      [[-4, 0, 0, 4], [2, 0, 0, 2]],
      {
        resolution: 21,
        sig: 'unequal-tangent-disconnected-vertex-link',
        frame: {
          origin_mm: [-10, -10, -10],
          spacing_mm: 1,
          dimensions: [21, 21, 21],
        },
      },
    );
    expect(() => field.extract()).toThrow(/critical point|non-manifold.*vertex.*disconnected link/i);
  });

  it('resolves the former locally folded face against the shared tetrahedral field', () => {
    const field = CavityScalarField.fromBubbles(
      [[-3, 4, 4, 6], [5, 0, -1, 4]],
      { resolution: 17, sig: 'adversarial-winding' },
    );
    const surface = field.extract();
    expect(Array.from(edgeIncidence(surface).values()).every((count) => count === 2)).toBe(true);
    const agreement = MarchingCubesExtractor.measureImplicitAgreement(field, surface, 2);
    expect(agreement.unresolved_sample_count).toBe(0);
    expect(agreement.max_normal_root_distance_voxels).toBeLessThan(1e-4);
  });

  it('emits no non-finite or zero-area triangles', () => {
    const field = CavityScalarField.fromBubbles([[0, 0, 0, 6], [3, 3, 0, 4]], { resolution: 24, sig: 'quality' });
    const surface = field.extract();
    for (let i = 0; i < surface.indices.length; i += 3) {
      const ia = surface.indices[i] * 3, ib = surface.indices[i + 1] * 3, ic = surface.indices[i + 2] * 3;
      const ab = [surface.positions[ib] - surface.positions[ia], surface.positions[ib + 1] - surface.positions[ia + 1], surface.positions[ib + 2] - surface.positions[ia + 2]];
      const ac = [surface.positions[ic] - surface.positions[ia], surface.positions[ic + 1] - surface.positions[ia + 1], surface.positions[ic + 2] - surface.positions[ia + 2]];
      const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
      expect(Math.hypot(cross[0], cross[1], cross[2])).toBeGreaterThan(0);
    }
  });
});
