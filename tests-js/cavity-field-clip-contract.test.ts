import { describe, expect, it } from 'vitest';

declare const CavityScalarField: any;
declare const MarchingCubesExtractor: any;

function asymmetricField() {
  const sizeX = 3;
  const sizeY = 4;
  const sizeZ = 5;
  const values = new Float32Array(sizeX * sizeY * sizeZ);
  for (let z = 0; z < sizeZ; z++) for (let y = 0; y < sizeY; y++) for (let x = 0; x < sizeX; x++) {
    values[(z * sizeY + y) * sizeX + x] = x + 10 * y + 100 * z;
  }
  return new CavityScalarField({
    sizeX, sizeY, sizeZ,
    spacingMm: 2,
    origin: [-3, 7, 11],
    values,
    sig: 'asymmetric-axis-landmarks',
  });
}

describe('cavity field clipping contract', () => {
  it('maps x-fastest asymmetric grid landmarks to normalized texel centres', () => {
    const field = asymmetricField();
    const contract = field.textureContract();
    expect(contract.dimensions).toEqual([3, 4, 5]);
    expect(contract.schema).toBe('cavity-field-texture-contract-v2');
    expect(contract.data_order).toBe('x-fastest, then y, then z');
    expect(contract.interpolation).toBe('freudenthal-piecewise-linear-v1');
    expect(contract.sign_convention).toBe('positive-void, zero-wall, negative-rock');

    for (const grid of [[0, 0, 0], [2, 1, 3], [1, 3, 4]]) {
      const world = field.worldPosition(grid[0], grid[1], grid[2]);
      const texture = field.textureCoordinateWorld(world[0], world[1], world[2]);
      expect(texture[0]).toBeCloseTo((grid[0] + 0.5) / 3, 12);
      expect(texture[1]).toBeCloseTo((grid[1] + 0.5) / 4, 12);
      expect(texture[2]).toBeCloseTo((grid[2] + 0.5) / 5, 12);
      expect(field.valueAt(grid[0], grid[1], grid[2]))
        .toBe(grid[0] + 10 * grid[1] + 100 * grid[2]);
    }
  });

  it('uses the same Freudenthal tetrahedron weights advertised to the GPU', () => {
    const field = new CavityScalarField({
      sizeX: 2, sizeY: 2, sizeZ: 2,
      spacingMm: 1, origin: [0, 0, 0],
      values: new Float32Array([0, 1, 2, 4, 8, 16, 32, 64]),
      sig: 'non-affine-freudenthal-landmarks',
    });
    // t=(0.75,0.25,0.5) lies in x>=z>=y: corners 000,100,101,111.
    // Weights are 0.25,0.25,0.25,0.25 respectively.
    expect(field.sampleWorld(0.75, 0.25, 0.5)).toBe((0 + 1 + 16 + 64) / 4);
    expect(field.textureContract().interpolation).toBe('freudenthal-piecewise-linear-v1');
  });

  it('treats every point outside the uploaded field bounds as rock', () => {
    const field = asymmetricField();
    const { min, max } = field.bounds;
    expect(field.sampleTextureWorld(min[0] - 1e-9, min[1], min[2])).toBe(-Infinity);
    expect(field.sampleTextureWorld(max[0] + 1e-9, max[1], max[2])).toBe(-Infinity);
    expect(field.sampleTextureWorld(min[0], min[1] - 1, min[2])).toBe(-Infinity);
    expect(field.sampleTextureWorld(max[0], max[1], max[2] + 1)).toBe(-Infinity);
    expect(field.sampleTextureWorld(min[0], min[1], min[2])).toBe(field.valueAt(0, 0, 0));
    expect(() => field.sampleTextureWorld(Number.NaN, 0, 0)).toThrow(/finite/i);
  });

  it('keeps canonical samples immutable and verifies the exact lazily uploaded bytes', () => {
    const source = new Float32Array(27).map((_, index) => index - 13);
    const field = new CavityScalarField({
      sizeX: 3, sizeY: 3, sizeZ: 3,
      spacingMm: 1, origin: [0, 0, 0], values: source,
      sig: 'immutable-snapshot',
    });
    const original = field.valueAt(1, 1, 1);
    source[13] = 999;
    const publicCopy = field.values;
    publicCopy[13] = 888;
    const tamperedUpload = field.createTextureUpload();
    let tamperedBytes: Float32Array | null = null;
    tamperedUpload.consume((values: Float32Array) => { tamperedBytes = values; });
    tamperedBytes![13] = 777;
    expect(() => tamperedUpload.verifyAfterUpload()).toThrow(/changed before GPU upload/i);

    const upload = field.createTextureUpload();
    let uploadedBytes: Float32Array | null = null;
    upload.consume((values: Float32Array) => { uploadedBytes = values; });
    const receipt = upload.verifyAfterUpload();

    expect(field.valueAt(1, 1, 1)).toBe(original);
    expect(uploadedBytes![13]).toBe(original);
    expect(upload.contract.snapshot_digest).toBe(field.snapshotDigest);
    expect(upload.contract.field_signature).toBe(field.sig);
    expect(receipt.snapshot_digest).toBe(field.snapshotDigest);
    expect(receipt.verified_after_upload).toBe(true);
    expect(Object.isFrozen(upload.contract)).toBe(true);
    expect(() => { field.sig = 'tampered'; }).toThrow(TypeError);
    expect(() => { field.snapshotDigest = 'tampered'; }).toThrow(TypeError);
    expect(() => { field.origin[0] = 99; }).toThrow(TypeError);
    expect(() => { field.bounds.min[0] = 99; }).toThrow(TypeError);
  });

  it('binds the extracted wall and clip upload to one field identity and isovalue', () => {
    const field = CavityScalarField.fromBubbles([[0, 0, 0, 10]], {
      resolution: 24,
      sig: 'paired-sphere',
    });
    const surface = field.extract(0);
    const upload = field.createTextureUpload(0);
    expect(surface.source_field_signature).toBe(upload.contract.field_signature);
    expect(surface.source_field_snapshot_digest).toBe(upload.contract.snapshot_digest);
    expect(surface.isovalue).toBe(upload.contract.isovalue);
    expect(surface.sig).toContain(field.snapshotDigest);
    expect(Object.isFrozen(surface)).toBe(true);
    expect(Object.isFrozen(surface.bounds)).toBe(true);
    expect(() => { surface.isovalue = 1; }).toThrow(TypeError);
  });

  it('reports sampled extracted-vs-implicit displacement without calling it exact Hausdorff error', () => {
    const field = CavityScalarField.fromBubbles([[0, 0, 0, 10]], {
      resolution: 24,
      sig: 'agreement-sphere',
    });
    const surface = field.extract(0);
    const receipt = MarchingCubesExtractor.measureImplicitAgreement(field, surface, 4);
    expect(receipt.schema).toBe('cavity-surface-agreement-v1');
    expect(receipt.sample_count).toBeGreaterThan(surface.indices.length);
    expect(receipt.unresolved_sample_count).toBe(0);
    expect(receipt.max_normal_root_distance_voxels).toBeLessThanOrEqual(0.25);
    expect(receipt.max_field_residual).toBeGreaterThanOrEqual(0);
  });

  it('rejects an agreement receipt for a surface from a different field snapshot', () => {
    const a = CavityScalarField.fromBubbles([[0, 0, 0, 5]], { resolution: 16, sig: 'same-label' });
    const b = CavityScalarField.fromBubbles([[1, 0, 0, 5]], { resolution: 16, sig: 'same-label' });
    expect(a.valueDigest).toBe(b.valueDigest);
    expect(a.snapshotDigest).not.toBe(b.snapshotDigest);
    expect(() => MarchingCubesExtractor.measureImplicitAgreement(b, a.extract(), 2))
      .toThrow(/same field snapshot/i);
  });
});
