import { describe, expect, it } from 'vitest';

declare const THREE: any;
declare const _applyWallReliefAO: any;
declare const _topoConfigureCavityWallMaterial: any;
declare const _topoTriplanarPerturbObjectNormal: any;
declare const _topoReplayRenderDecision: any;
declare const CavityEvolutionLedger: any;
declare const FluidChemistry: any;
declare const VugConditions: any;
declare const VugSimulator: any;
declare const VugWall: any;
declare const SCENARIOS: any;
declare const setSeed: any;

function materialWithUniforms() {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
  material.userData.reliefAO = {
    uReliefAO: { value: null },
    uReliefAORepeat: { value: new THREE.Vector2(5, 5) },
    uReliefAOAmt: { value: 0.6 },
    uWallMaterialSpaceEnabled: { value: 0 },
    uWallMatrixScale: { value: new THREE.Vector2(0.05, 0.05) },
    uWallReliefScale: { value: new THREE.Vector2(0.1, 0.1) },
  };
  _applyWallReliefAO(material);
  return material;
}

describe('Cartesian cavity material-space mapping', () => {
  it('injects one seam-blended triplanar path for matrix, relief AO, and normals', () => {
    const material = materialWithUniforms();
    const shader: any = {
      uniforms: {},
      vertexShader: '#include <common>\nvoid main(){\n#include <begin_vertex>\n}',
      fragmentShader: '#include <common>\nvoid main(){\n#include <map_fragment>\n#include <normal_fragment_maps>\n}',
    };
    material.onBeforeCompile(shader);
    expect(shader.vertexShader).toContain('vWallMaterialPos = position');
    expect(shader.vertexShader).toContain('vWallMaterialNormal = normal');
    expect(shader.vertexShader).toContain('vWallNormalBasisX = normalMatrix');
    expect(shader.fragmentShader).toContain('vec3 wallTriplanarWeights');
    expect(shader.fragmentShader).toContain('vec4 wallTriplanarSample');
    expect(shader.fragmentShader).toContain('wallTriplanarSample(map, vWallMaterialPos');
    expect(shader.fragmentShader).toContain('wallTriplanarSample(uReliefAO, vWallMaterialPos');
    expect(shader.fragmentShader).toContain('perturbX * weights.x');
    expect(shader.fragmentShader).toContain('normal + mappedViewPerturbation');
    expect(shader.fragmentShader).not.toContain('normalMatrix * normalize');
    expect(shader.fragmentShader).toContain('#ifdef FLAT_SHADED');
    expect(shader.fragmentShader).toContain('cross(\n        dFdx(vWallMaterialPos)');
    expect(shader.fragmentShader).toContain('uWallMaterialSpaceEnabled > 0.5');
    expect(shader.uniforms.uWallMaterialSpaceEnabled)
      .toBe(material.userData.reliefAO.uWallMaterialSpaceEnabled);
  });

  it('uses fixed millimetre scales for Cartesian surfaces and preserves legacy UV walls', () => {
    const material = materialWithUniforms();
    const state: any = {
      cavity: { material },
      _matrixLitho: 'limestone',
    };
    const wall = {
      matrix: 'limestone', composition: 'limestone',
      architecture: 'cleft', genesis: 'cleft', paleo_flow: 3,
    };
    const surface = { buffer_digest: 'surface-a' };
    const cartesian = _topoConfigureCavityWallMaterial(
      state, { mode: 'marching-cubes', buffers: surface }, wall,
    );
    expect(cartesian).toMatchObject({
      schema: 'cavity-material-space-v1',
      mapping: 'triplanar-object-millimetres',
      blend_exponent: 4,
      matrix_scale_uv_per_mm: [0.05, 0.05],
      relief_scale_uv_per_mm: [0.1, 0.1],
      lithology: 'limestone',
      relief_family: 'cleft',
      source_surface_digest: 'surface-a',
    });
    expect(material.userData.reliefAO.uWallMaterialSpaceEnabled.value).toBe(1);

    const legacy = _topoConfigureCavityWallMaterial(
      state, { mode: 'wall-mesh', buffers: { sig: 'legacy-a' } }, wall,
    );
    expect(legacy.mapping).toBe('legacy-spherical-uv');
    expect(legacy.blend_exponent).toBeNull();
    expect(material.userData.reliefAO.uWallMaterialSpaceEnabled.value).toBe(0);
  });

  it('keeps physical texture scale invariant across geometry resolution and size', () => {
    const material = materialWithUniforms();
    const state: any = { cavity: { material }, _matrixLitho: 'granite' };
    const small = _topoConfigureCavityWallMaterial(
      state,
      { mode: 'marching-cubes', buffers: { buffer_digest: '24-grid' } },
      { matrix: 'granite', architecture: 'pocket', genesis: 'pocket', vug_diameter_mm: 25 },
    );
    const large = _topoConfigureCavityWallMaterial(
      state,
      { mode: 'marching-cubes', buffers: { buffer_digest: '64-grid' } },
      { matrix: 'granite', architecture: 'pocket', genesis: 'pocket', vug_diameter_mm: 250 },
    );
    expect(large.matrix_scale_uv_per_mm).toEqual(small.matrix_scale_uv_per_mm);
    expect(large.relief_scale_uv_per_mm).toEqual(small.relief_scale_uv_per_mm);
    expect(large.source_surface_digest).not.toBe(small.source_surface_digest);
  });

  it('preserves every geometric normal exactly for a flat normal-map texel', () => {
    const flat = { x: [0, 0], y: [0, 0], z: [0, 0] };
    for (const normal of [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0],
      [0.8, 0.6, 0], [-0.3, 0.4, -0.8660254037844386],
    ]) {
      const length = Math.hypot(...normal);
      const expected = normal.map(value => value / length);
      const actual = _topoTriplanarPerturbObjectNormal(normal, flat, [2, 2]);
      actual.forEach((value: number, axis: number) =>
        expect(value).toBeCloseTo(expected[axis], 14));
    }
  });

  it('mirrors tangent orientation across opposite projection axes', () => {
    const maps = { x: [0.2, 0.3], y: [0, 0], z: [0, 0] };
    const positive = _topoTriplanarPerturbObjectNormal([1, 0, 0], maps);
    const negative = _topoTriplanarPerturbObjectNormal([-1, 0, 0], maps);
    expect(negative[0]).toBeCloseTo(-positive[0], 14);
    expect(negative[1]).toBeCloseTo(positive[1], 14);
    expect(negative[2]).toBeCloseTo(-positive[2], 14);
  });

  it('replays authenticated historical paleo-flow and rejects receipt forgery', () => {
    const c = new VugConditions({
      temperature: 25,
      pressure: 0.001,
      fluid: new FluidChemistry({ pH: 7 }),
      wall: new VugWall({
        vug_diameter_mm: 50,
        architecture: 'spherical',
        genesis: 'dissolution',
        primary_bubbles: 1,
        secondary_bubbles: 0,
        shape_seed: 42,
      }),
    });
    const sim = new VugSimulator(c, []);
    sim.wall_state.paleo_flow = 0.1;
    sim.step = 1;
    sim._repaintWallState();
    const snapshot = sim.wall_state_history.at(-1);
    expect(snapshot.cavity_material_state.paleo_flow).toBe(0.1);
    expect(snapshot.cavity_material_history_cursor).toBe(1);

    sim.wall_state.paleo_flow = 5;
    const replay = _topoReplayRenderDecision(sim.wall_state, snapshot);
    expect(replay.mode).toBe('wall-mesh');
    expect(replay.wall.paleo_flow).toBe(0.1);
    expect(replay.materialState.relief_repeat).toEqual([3, 3]);

    const forged = JSON.parse(JSON.stringify(snapshot));
    forged.cavity_material_state.paleo_flow = 5;
    const payload = { ...forged.cavity_material_state };
    delete payload.material_state_digest;
    forged.cavity_material_state.material_state_digest = CavityEvolutionLedger.digest(payload);
    expect(_topoReplayRenderDecision(sim.wall_state, forged).mode).toBe('corrupt');

    const missing = JSON.parse(JSON.stringify(snapshot));
    delete missing.cavity_material_state;
    expect(_topoReplayRenderDecision(sim.wall_state, missing).mode).toBe('corrupt');
  });

  it('records stagnant-fluid wall dissolution as valid zero paleo-flow', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.reactive_wall();
    conditions.fluid.pH = 4;
    conditions.flow_rate = 0;
    const sim = new VugSimulator(conditions, events);
    sim.dissolve_wall();
    expect(sim.wall_state.cavityEvolutionLedger().cursor).toBe(1);
    expect(sim.wall_state.paleo_flow).toBe(0);
    sim.step = 1;
    sim._repaintWallState();
    const snapshot = sim.wall_state_history.at(-1);
    expect(snapshot.cavity_material_state.paleo_flow).toBe(0);
    expect(snapshot.cavity_material_state.relief_repeat).toEqual([5, 5]);
    const replay = _topoReplayRenderDecision(sim.wall_state, snapshot);
    expect(replay.mode).toBe('wall-mesh');
    expect(replay.materialState.paleo_flow).toBe(0);
  });
});
