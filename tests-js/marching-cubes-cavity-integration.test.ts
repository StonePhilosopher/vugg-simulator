import { describe, expect, it, vi } from 'vitest';

declare const WallState: any;
declare const MarchingCubesExtractor: any;
declare const THREE: any;
declare const setSeed: any;
declare const _liveRng: any;
declare const _topoSetMarchingCubesCavity: any;
declare const _topoCavitySurfaceSource: any;
declare const _topoMarchingCubesCavityEnabled: any;
declare const _topoMarchingCubesResolution: any;
declare const _applyCavityClip: any;
declare const _topoCavityClipCapabilityReceipt: any;
declare const _topoBuildCavityGeometry: any;
declare const _topoSelectVisibleCavityHit: any;
declare const _topoCavityShaderProgramsRunnable: any;
declare const _topoRenderPreparedCavityScene: any;
declare const _topoHandleCavityContextLost: any;
declare const _topoResetCavityFieldFailures: any;
declare const _topoThreeRendererEffective: any;
declare const _topoAttemptEffectiveThree: any;
declare const _topoSyncThreeCanvasVisibility: any;
declare const _CAVITY_R32F_PROBE_CACHE: any;

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

  it('selects cached MC buffers and the exact paired scalar clip field', () => {
    const wall = makeWall();
    const mesh = wall.meshFor();
    const a = _topoCavitySurfaceSource(wall, undefined, true, 24);
    const b = _topoCavitySurfaceSource(wall, undefined, true, 24);
    expect(a.mode).toBe('marching-cubes');
    expect(a.clipMesh).toBe(mesh);
    expect(a.clipField).toBe(wall.cavityFieldFor({ resolution: 24 }));
    expect(a.clipField.snapshotDigest).toBe(a.buffers.source_field_snapshot_digest);
    expect(a.buffers).toBe(b.buffers);
    expect(a.buffers.positions.length).toBeGreaterThan(0);
    expect(a.sig).toContain('24^3');
  });

  it('renders the exact active provider despite an off shadow flag or different defaults', () => {
    const wall = makeWall();
    const receipt = wall.activateCavitySurfaceAnchorProvider({ resolution: 20, isovalue: 0.05 });
    const active = wall.activeCavitySurfaceAnchorProvider();
    const source = _topoCavitySurfaceSource(wall, undefined, false, 48);
    expect(source.mode).toBe('marching-cubes');
    expect(source.providerAuthority).toBe(true);
    expect(source.buffers).toBe(active.surface);
    expect(source.clipField).toBe(active.field);
    expect(source.buffers.sig).toBe(receipt.surface_signature);
    expect(source.buffers.isovalue).toBe(0.05);
    expect(source.clipField.sizeX).toBe(20);
  });

  it('injects world position after batching/instancing and field clip before polar fallback', () => {
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const clipUniforms = {
      uVugRadius: { value: 10 }, uVugCenter: { value: new THREE.Vector3() },
      uVugRingCount: { value: 0 }, uVugRadiiByRing: { value: new Float32Array(32) },
      uVugCellRadii: { value: null }, uVugCellTexW: { value: 0 }, uVugCellTexH: { value: 0 },
      uCavityClipMode: { value: 1 }, uCavityField: { value: null },
      uCavityFieldDimensions: { value: new THREE.Vector3(48, 48, 48) },
      uCavityFieldWorldScale: { value: new THREE.Vector3(1, 1, 1) },
      uCavityFieldWorldBias: { value: new THREE.Vector3() }, uCavityFieldIsovalue: { value: 0 },
      uHelixEnabled: { value: 0 }, uHelixSweep: { value: 0 }, uHelixYCenter: { value: 0 },
      uHelixYSpan: { value: 1 }, uHelixNTurns: { value: 1 }, uHelixFade: { value: 1 },
    };
    _applyCavityClip(material, clipUniforms);
    const shader: any = {
      uniforms: {},
      vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n#include <project_vertex>\n}',
      fragmentShader: '#include <common>\nvoid main() {\n#include <dithering_fragment>\n}',
    };
    material.onBeforeCompile(shader);
    const project = shader.vertexShader.indexOf('#include <project_vertex>');
    const instance = shader.vertexShader.indexOf('_cavityClipWorld = instanceMatrix');
    const world = shader.vertexShader.indexOf('vCavityWorldPos =');
    expect(project).toBeGreaterThan(-1);
    expect(instance).toBeGreaterThan(project);
    expect(world).toBeGreaterThan(instance);
    expect(shader.fragmentShader).toContain('uniform sampler3D uCavityField');
    expect(shader.fragmentShader).toContain('lessThan(_cavityGridPosition, vec3(0.0))');
    expect(shader.fragmentShader).toContain('cavityFreudenthalValue(_cavityGridPosition)');
    expect(shader.fragmentShader).toContain('cavityFieldGridValue');
    expect(shader.fragmentShader).not.toContain('cavityHullRadiusAt');
    expect(material.customProgramCacheKey()).toBe('vugg-cavity-clip:field-r32f-freudenthal-v2');

    const polarMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    clipUniforms.uCavityClipMode.value = 0;
    _applyCavityClip(polarMaterial, clipUniforms);
    const polarShader: any = {
      uniforms: {},
      vertexShader: '#include <common>\nvoid main() {\n#include <project_vertex>\n}',
      fragmentShader: '#include <common>\nvoid main() {\n#include <dithering_fragment>\n}',
    };
    polarMaterial.onBeforeCompile(polarShader);
    expect(polarShader.fragmentShader).toContain('cavityHullRadiusAt(vCavityWorldPos)');
    expect(polarShader.fragmentShader).not.toContain('sampler3D');
    expect(polarShader.fragmentShader).not.toContain('texture(uCavityField');
    expect(polarShader.uniforms.uCavityField).toBeUndefined();
    expect(polarMaterial.customProgramCacheKey()).toBe('vugg-cavity-clip:polar-r32f-free-v1');
    expect(polarMaterial.customProgramCacheKey()).not.toBe(material.customProgramCacheKey());
  });

  it('withholds an active exact field view without mutating authority when WebGL rejects it', () => {
    const wall = makeWall();
    const disposed: any[] = [];
    let capabilityChecks = 0;
    const state: any = {
      renderer: { getContext: () => { capabilityChecks++; return null; } },
      cavity: {
        geometry: new THREE.BufferGeometry(),
        material: new THREE.MeshStandardMaterial(),
      },
      cavitySig: '',
      clipUniforms: {
        uVugRadius: { value: 1e6 }, uVugCenter: { value: new THREE.Vector3() },
        uVugRingCount: { value: 0 }, uVugRadiiByRing: { value: new Float32Array(32) },
        uVugCellRadii: { value: null }, uVugCellTexW: { value: 0 }, uVugCellTexH: { value: 0 },
        uCavityClipMode: { value: 0 }, uCavityField: { value: null },
        uCavityFieldWorldScale: { value: new THREE.Vector3() },
        uCavityFieldWorldBias: { value: new THREE.Vector3() }, uCavityFieldIsovalue: { value: 0 },
      },
    };
    state.cavity.geometry.dispose = () => disposed.push(true);
    try {
      _topoSetMarchingCubesCavity(false, 48);
      wall.activateCavitySurfaceAnchorProvider({ resolution: 20, isovalue: 0.05 });
      const receipt = wall._cavitySurfaceAnchorProvider;
      expect(_topoBuildCavityGeometry(state, wall, undefined)).toBe(false);
      expect(wall._cavitySurfaceAnchorProvider).toBe(receipt);
      expect(wall._activeCavitySurfaceAnchorProvider).not.toBeNull();
      expect(state.cavityAuthorityUnrenderable).toBe(true);
      expect(state.cavity.visible).toBe(false);
      expect(state.clipUniforms.uCavityClipMode.value).toBe(0);
      expect(state.clipUniforms.uCavityField.value).toBeNull();
      expect(state.cavity.geometry.getAttribute('position')).toBeUndefined();
      expect(_topoCavityClipCapabilityReceipt(state).available).toBe(false);
      expect(state.cavityFieldContract).toBeNull();
      expect(state.cavityFieldUploadReceipt).toBeNull();
      expect(state.cavityFieldFallbackReason).toBe('webgl-context-unavailable');
      const checksAfterReceipt = capabilityChecks;
      expect(checksAfterReceipt).toBeGreaterThan(0);
      expect(_topoBuildCavityGeometry(state, wall, undefined)).toBe(false);
      expect(capabilityChecks).toBe(checksAfterReceipt); // rejected digest is not retried each frame
    } finally {
      _topoSetMarchingCubesCavity(false, 48);
    }
  });

  it('filters CPU ray hits with the same positive-void and equality rule as the shader', () => {
    const rejected = { point: { x: 2, y: 0, z: 0 }, name: 'rock-front' };
    const equality = { point: { x: 0, y: 0, z: 0 }, name: 'wall-equality' };
    const visible = { point: { x: -2, y: 0, z: 0 }, name: 'void-back' };
    const samples = new Map([[2, -0.1], [0, 0], [-2, 0.1]]);
    const field = { sampleTextureWorld: (x: number) => samples.get(x) };
    expect(_topoSelectVisibleCavityHit([rejected, equality, visible], field, 0)).toBe(equality);
    expect(_topoSelectVisibleCavityHit([rejected, visible], field, 0)).toBe(visible);
    expect(_topoSelectVisibleCavityHit([rejected], field, 0)).toBeNull();
    expect(_topoSelectVisibleCavityHit([rejected, visible], null, 0)).toBe(rejected);
  });

  it('fails the field path when an actual linked Three program is not runnable', () => {
    expect(_topoCavityShaderProgramsRunnable([
      { diagnostics: { runnable: true } },
    ])).toBe(true);
    expect(_topoCavityShaderProgramsRunnable([
      { diagnostics: { runnable: false } },
    ])).toBe(false);
    // Some successful programs intentionally carry no diagnostics.
    expect(_topoCavityShaderProgramsRunnable([{}])).toBe(true);
  });

  it('never issues a mode-1 draw when the actual scene clip program fails to link', () => {
    const drawnModes: number[] = [];
    const fieldProgram: any = {
      getUniforms: () => {}, diagnostics: { runnable: false },
    };
    const polarProgram: any = {
      getUniforms: () => {}, diagnostics: { runnable: true },
    };
    const fieldMaterial: any = {
      userData: { vuggCavityClipVariant: 'field-r32f-v1' },
    };
    const polarMaterial: any = {
      userData: { vuggCavityClipVariant: 'polar-r32f-free-v1' },
    };
    const materialPrograms = new Map<any, any>([[fieldMaterial, fieldProgram]]);
    const state: any = {
      clipUniforms: { uCavityClipMode: { value: 1 }, uCavityField: { value: null } },
      scene: {}, camera: {},
      cavity: { visible: true }, crystals: { visible: true },
      renderer: {
        compile: () => new Set(materialPrograms.keys()),
        properties: { get: (material: any) => ({ currentProgram: materialPrograms.get(material) }) },
        // An unrelated stale failure must not influence the prepared materials.
        info: { programs: [{ diagnostics: { runnable: false } }] },
        render: () => drawnModes.push(state.clipUniforms.uCavityClipMode.value),
      },
    };
    let fallbackInstalled = false;
    _topoRenderPreparedCavityScene(state, () => {
      fallbackInstalled = true;
      state.clipUniforms.uCavityClipMode.value = 0;
      materialPrograms.clear();
      materialPrograms.set(polarMaterial, polarProgram);
      state.cavity.visible = true;
      state.crystals.visible = true;
    });
    expect(fallbackInstalled).toBe(true);
    expect(drawnModes).toEqual([0]);
    expect(state.threeShaderUnusable).toBe(false);
  });

  it('does not draw and asks for canvas fallback when the distinct polar program also fails', () => {
    const material: any = { userData: { vuggCavityClipVariant: 'polar-r32f-free-v1' } };
    const state: any = {
      clipUniforms: { uCavityClipMode: { value: 0 } }, scene: {}, camera: {},
      renderer: {
        compile: () => new Set([material]),
        properties: { get: () => ({ currentProgram: {
          getUniforms: () => {}, diagnostics: { runnable: false },
        } }) },
        render: vi.fn(),
      },
    };
    expect(_topoRenderPreparedCavityScene(state, vi.fn())).toBe(false);
    expect(state.renderer.render).not.toHaveBeenCalled();
    expect(state.threeShaderUnusable).toBe(true);
    expect(state.cavityFieldFallbackReason).toBe('polar-cavity-shader-link-failed');
  });

  it('makes terminal shader failure visibly activate canvas until explicit retry', () => {
    document.body.innerHTML = `
      <canvas id="topo-canvas" style="visibility:hidden"></canvas>
      <canvas id="topo-canvas-three" style="display:block"></canvas>`;
    const state: any = { threeShaderUnusable: true };
    const attempt = vi.fn(() => true);
    try {
      expect(_topoThreeRendererEffective(state)).toBe(false);
      expect(_topoAttemptEffectiveThree(state, attempt)).toBe(false);
      expect(attempt).not.toHaveBeenCalled();
      _topoSyncThreeCanvasVisibility(state);
      expect((document.getElementById('topo-canvas-three') as HTMLElement).style.display)
        .toBe('none');
      expect((document.getElementById('topo-canvas') as HTMLElement).style.visibility)
        .toBe('');
      _topoResetCavityFieldFailures(state);
      expect(_topoThreeRendererEffective(state)).toBe(true);
      expect(_topoAttemptEffectiveThree(state, attempt)).toBe(true);
      expect(attempt).toHaveBeenCalledOnce();
    } finally {
      document.body.innerHTML = '';
    }
  });

  it('publishes a cleared fail-closed receipt immediately on context loss', () => {
    const dataset: any = {};
    const texture = { dispose: vi.fn() };
    const state: any = {
      renderer: { domElement: { dataset } },
      clipUniforms: {
        uCavityClipMode: { value: 1 }, uCavityField: { value: texture },
      },
      cavityFieldContract: { snapshot_digest: 'old', dimensions: [48, 48, 48] },
      cavityFieldUploadReceipt: { verified_after_upload: true },
      cavityFieldCapabilityReceipt: { available: true },
      cavity: { visible: true }, crystals: { visible: true },
    };
    _topoHandleCavityContextLost(state);
    const receipt = JSON.parse(dataset.cavityClipReceipt);
    expect(texture.dispose).toHaveBeenCalledOnce();
    expect(receipt.available).toBe(false);
    expect(receipt.reason).toBe('webgl-context-lost');
    expect(receipt.active_clip_mode).toBe(0);
    expect(receipt.upload_receipt).toBeNull();
    expect(receipt.field_snapshot_digest).toBeNull();
  });

  it('evicts a transient cached R32F probe during explicit retry', () => {
    const gl = {};
    _CAVITY_R32F_PROBE_CACHE.set(gl, Object.freeze({ passed: false, reason: 'transient' }));
    const state: any = {
      renderer: { getContext: () => gl },
      cavityFieldFailedDigests: new Set(['digest']),
      cavityFieldFailedReasons: new Map([['digest', 'transient']]),
    };
    _topoResetCavityFieldFailures(state);
    expect(_CAVITY_R32F_PROBE_CACHE.has(gl)).toBe(false);
    expect(state.cavityFieldFailedDigests.size).toBe(0);
    expect(state.cavityFieldFailedReasons.size).toBe(0);
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

  it('does not let an unledgered ring mutation split the paired MC wall and clip snapshot', () => {
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
    // Direct ring edits bypass the authenticated evolution ledger. Neither the
    // Cartesian field nor the paired wall may pretend that edit was consumed.
    expect(secondField).toBe(firstField);
    expect(secondSurface).toBe(firstSurface);
    expect(secondSource.sig).toBe(firstSource.sig);
    expect(secondSource.buffers).toBe(firstSource.buffers);

    expect(() => { wall.elongation = 0.2; }).toThrow(TypeError);
    expect(wall.cavityFieldFor({ resolution: 24 })).toBe(secondField);
    expect(wall.cavitySurfaceFor({ resolution: 24 })).toBe(secondSurface);

    const shapedWall = new WallState({
      cells_per_ring: 32,
      ring_count: 12,
      vug_diameter_mm: 50,
      primary_bubbles: 3,
      secondary_bubbles: 6,
      shape_seed: 42,
      architecture: 'tabular',
    });
    expect(shapedWall.cavityFieldFor({ resolution: 24 }).sig).not.toBe(secondField.sig);
    expect(shapedWall.cavitySurfaceFor({ resolution: 24 })).not.toBeNull();
  });

  it('prevents mutation of authenticated cached MC buffers and exposed ArrayBuffers', () => {
    const wall = makeWall();
    const source = _topoCavitySurfaceSource(wall, undefined, true, 24);
    const protectedValue = source.buffers.positions[7];
    expect(() => { source.buffers.positions[7] += 1; }).toThrow(/immutable/i);
    expect(() => source.buffers.positions.fill(0)).toThrow(/immutable/i);
    const escaped = source.buffers.positions.valueOf();
    expect(escaped).toBe(source.buffers.positions);
    expect(() => { escaped[7] += 1; }).toThrow(/immutable/i);
    let callbackReceiver: any = null;
    source.buffers.positions.forEach((_value: number, _index: number, receiver: any) => {
      if (!callbackReceiver) callbackReceiver = receiver;
    });
    expect(callbackReceiver).not.toBe(source.buffers.positions);
    callbackReceiver[7] += 50;
    const alias = new Float32Array(source.buffers.positions.buffer);
    alias[7] += 100;
    expect(source.buffers.positions[7]).toBe(protectedValue);
    expect(() => MarchingCubesExtractor.verifyBuffers(source.buffers)).not.toThrow();
    expect(_topoCavitySurfaceSource(wall, undefined, true, 24).mode).toBe('marching-cubes');
  });

  it('does not expose authoritative bytes through caller-controlled prototype getters', () => {
    const source = _topoCavitySurfaceSource(makeWall(), undefined, true, 24);
    const positions: any = source.buffers.positions;
    const prototype = Object.getPrototypeOf(new Float32Array());
    Object.defineProperty(prototype, '__vuggRawBufferEscape', {
      configurable: true,
      get() { return this.buffer; },
    });
    try {
      expect(positions.__vuggRawBufferEscape).toBeUndefined();
      expect(() => Object.setPrototypeOf(positions, {})).toThrow(/immutable/i);
      expect(() => MarchingCubesExtractor.verifyBuffers(source.buffers)).not.toThrow();
    } finally {
      delete prototype.__vuggRawBufferEscape;
    }
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

  it('keeps the ambiguity-safe shadow surface for the former non-manifold case', () => {
    const wall = makeWall();
    wall.bubbles = [[0, 0, 0, 3], [5, -3, 5, 4]];
    const extraction = vi.spyOn(MarchingCubesExtractor, 'extract');
    try {
      const first = _topoCavitySurfaceSource(wall, undefined, true, 16);
      const second = _topoCavitySurfaceSource(wall, undefined, true, 16);
      expect(first.mode).toBe('marching-cubes');
      expect(second.mode).toBe('marching-cubes');
      expect(first.buffers).not.toBe(wall.meshFor());
      expect(second.buffers).toBe(first.buffers);
      expect(extraction).toHaveBeenCalledTimes(1);
      expect(first.buffers.topology.closed_two_manifold).toBe(true);
    } finally {
      extraction.mockRestore();
    }
  });
});
