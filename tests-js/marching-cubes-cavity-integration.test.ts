import { describe, expect, it, vi } from 'vitest';

declare const WallState: any;
declare const MarchingCubesExtractor: any;
declare const setSeed: any;
declare const _liveRng: any;
declare const _topoSetMarchingCubesCavity: any;
declare const _topoCavitySurfaceSource: any;
declare const _topoMarchingCubesCavityEnabled: any;
declare const _topoMarchingCubesResolution: any;

function makeWall() {
  return new WallState({
    cells_per_ring: 32,
    ring_count: 12,
    vug_diameter_mm: 50,
    primary_bubbles: 3,
    secondary_bubbles: 6,
    shape_seed: 42,
  });
}

describe('Marching Cubes cavity renderer shadow integration', () => {
  it('defaults off and the off adapter returns exact canonical WallMesh buffers', () => {
    expect(_topoMarchingCubesCavityEnabled()).toBe(false);
    expect(_topoMarchingCubesResolution()).toBe(48);
    expect(() => _topoSetMarchingCubesCavity(true, 129)).toThrow(/resolution/i);
    expect(_topoMarchingCubesCavityEnabled()).toBe(false);
    expect(_topoMarchingCubesResolution()).toBe(48);
    const wall = makeWall();
    const mesh = wall.meshFor();
    const source = _topoCavitySurfaceSource(wall, undefined, false, 24);
    expect(source.mode).toBe('wall-mesh');
    expect(source.buffers).toBe(mesh);
    expect(source.clipMesh).toBe(mesh);
    expect(source.sig).toBe(`wall-mesh|${mesh.sig}`);
  });

  it('selects cached MC buffers while retaining WallMesh as the clip/chemistry store', () => {
    const wall = makeWall();
    const mesh = wall.meshFor();
    const a = _topoCavitySurfaceSource(wall, undefined, true, 24);
    const b = _topoCavitySurfaceSource(wall, undefined, true, 24);
    expect(a.mode).toBe('marching-cubes');
    expect(a.clipMesh).toBe(mesh);
    expect(a.buffers).toBe(b.buffers);
    expect(a.buffers.positions.length).toBeGreaterThan(0);
    expect(a.sig).toContain('24^3');
  });

  it('does not mutate wall rings, mesh cells, anchors, or RNG state', () => {
    const wall = makeWall();
    const mesh = wall.meshFor();
    const ringsBefore = JSON.stringify(wall.rings);
    const cellsBefore = mesh.cells.slice();
    const anchorBefore = wall._anchorFromRingCell(3, 7);
    setSeed(42);
    const rngBefore = _liveRng().state;
    _topoCavitySurfaceSource(wall, undefined, true, 24);
    expect(JSON.stringify(wall.rings)).toBe(ringsBefore);
    expect(mesh.cells).toEqual(cellsBefore);
    expect(wall._anchorFromRingCell(3, 7)).toEqual(anchorBefore);
    expect(_liveRng().state).toBe(rngBefore);
  });

  it('keys the field cache to sampled bubbles while refreshing the clip signature', () => {
    const wall = makeWall();
    const firstField = wall.cavityFieldFor({ resolution: 24 });
    const firstSurface = wall.cavitySurfaceFor({ resolution: 24 });
    const firstSource = _topoCavitySurfaceSource(wall, undefined, true, 24);
    expect(wall.cavityFieldFor({ resolution: 24 })).toBe(firstField);
    expect(wall.cavitySurfaceFor({ resolution: 24 })).toBe(firstSurface);
    wall.rings[3][1].wall_depth += 1;
    const secondField = wall.cavityFieldFor({ resolution: 24 });
    const secondSurface = wall.cavitySurfaceFor({ resolution: 24 });
    const secondSource = _topoCavitySurfaceSource(wall, undefined, true, 24);
    // Tranche 1 samples base bubbles only, so wall-depth erosion must not cause
    // an expensive byte-identical field/surface rebuild.
    expect(secondField).toBe(firstField);
    expect(secondSurface).toBe(firstSurface);
    // The canonical polar clip does consume wall_depth, so its signature still
    // invalidates the renderer and refreshes clip uniforms.
    expect(secondSource.sig).not.toBe(firstSource.sig);
    expect(secondSource.buffers).toBe(firstSource.buffers);
  });

  it('places every extracted edge vertex on the sampled zero set', () => {
    const wall = makeWall();
    const field = wall.cavityFieldFor({ resolution: 24 });
    const surface = wall.cavitySurfaceFor({ resolution: 24 });
    for (let i = 0; i < surface.positions.length; i += 3) {
      const value = field.sampleWorld(surface.positions[i], surface.positions[i + 1], surface.positions[i + 2]);
      expect(Math.abs(value)).toBeLessThan(field.spacingMm * 2e-5);
    }
  });

  it('shares the CPU sign oracle used by the future 3D clip contract', () => {
    const field = makeWall().cavityFieldFor({ resolution: 24 });
    expect(field.sampleWorld(0, 0, 0)).toBeGreaterThan(0);
    expect(field.sampleWorld(field.bounds.max[0], field.bounds.max[1], field.bounds.max[2])).toBeLessThan(0);
  });

  it('falls back to canonical WallMesh when shadow extraction is non-manifold', () => {
    const wall = makeWall();
    wall.bubbles = [[0, 0, 0, 3], [5, -3, 5, 4]];
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const extraction = vi.spyOn(MarchingCubesExtractor, 'extract');
    try {
      const first = _topoCavitySurfaceSource(wall, undefined, true, 16);
      const second = _topoCavitySurfaceSource(wall, undefined, true, 16);
      expect(first.mode).toBe('wall-mesh');
      expect(second.mode).toBe('wall-mesh');
      expect(first.buffers).toBe(wall.meshFor());
      expect(second.buffers).toBe(first.buffers);
      expect(extraction).toHaveBeenCalledTimes(1);
      expect(warning).toHaveBeenCalledTimes(1);
      expect(warning).toHaveBeenCalledWith(
        expect.stringMatching(/shadow surface rejected/i),
        expect.any(Error),
      );
    } finally {
      extraction.mockRestore();
      warning.mockRestore();
    }
  });
});
