import { describe, expect, it } from 'vitest';

declare const THREE: any;
declare const Crystal: any;
declare const WallState: any;
declare const classifySurfaceGrowth: any;
declare const _addCrystalParentRepresentation: any;
declare const _emitSurfaceGrowthSwath: any;
declare const _topoSnapshotWall: any;

function makeAggregate(wall: any, id: number, mineral = 'chalcedony', habit = 'banded_agate') {
  const crystal = new Crystal({
    mineral,
    habit,
    vector: 'coating',
    wall_spread: 0.72,
    void_reach: 0.12,
    crystal_id: id,
    nucleation_step: id,
  });
  crystal.total_growth_um = 650;
  crystal.c_length_mm = 1.4;
  crystal.a_width_mm = 0.6;
  crystal._volume_mm3 = 18.5;
  crystal.wall_anchor = wall._anchorFromRingCell(6, 12);
  return crystal;
}

function renderState(wall: any) {
  return {
    geomCache: new Map(),
    crystals: new THREE.Group(),
    clipUniforms: { uVugRadius: { value: wall.meanDiameterMm() / 2 } },
  };
}

function emit(state: any, crystal: any, wall: any, sim: any, layers: any[]) {
  const direction = wall.surfaceAnchorDirection(crystal);
  const material = new THREE.MeshStandardMaterial({
    color: 0x8b7765, roughness: 0.58, metalness: 0,
  });
  return _emitSurfaceGrowthSwath(
    state, crystal, material,
    direction[0], direction[1], direction[2],
    wall, wall.ring_count, wall.cells_per_ring, wall.initial_radius_mm,
    crystal.c_length_mm, sim, layers,
  );
}

describe('SIM 250 executed Three.js surface-fabric contract', () => {
  it('emits one raycastable instanced representation with finite matrices and exact overlap relief', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
    const wall = new WallState({
      cells_per_ring: 48, ring_count: 12, vug_diameter_mm: 70,
      primary_bubbles: 4, secondary_bubbles: 8, shape_seed: 5150,
    });
    const first = makeAggregate(wall, 501);
    const sim = { step: 900, wall_state: wall, crystals: [first] };
    classifySurfaceGrowth(sim);
    const state = renderState(wall);
    const parent = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
    );
    expect(_addCrystalParentRepresentation(state, first, parent)).toBe(false);
    expect(state.crystals.children).toHaveLength(0);

    const layers: any[] = [];
    const swath = emit(state, first, wall, sim, layers);
    expect(swath).toBeInstanceOf(THREE.InstancedMesh);
    expect(state.crystals.children).toEqual([swath]);
    expect(swath.count).toBeGreaterThan(12);
    expect(layers).toHaveLength(1);

    const matrix = new THREE.Matrix4();
    for (let i = 0; i < swath.count; i++) {
      swath.getMatrixAt(i, matrix);
      expect(matrix.elements.every((value: number) => Number.isFinite(value))).toBe(true);
      expect(Math.abs(matrix.determinant())).toBeGreaterThan(1e-9);
    }

    swath.updateMatrixWorld(true);
    swath.getMatrixAt(0, matrix);
    const target = new THREE.Vector3().setFromMatrixPosition(matrix);
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(0, 0, 0), target.clone().normalize(), 0, 200,
    );
    const hits = raycaster.intersectObject(swath, false);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].instanceId).toBeTypeOf('number');

    // Same anchor/seed gives the same exact samples. The second layer must be
    // displaced only by the first layer's canonical, LOD-independent relief.
    const second = makeAggregate(wall, 501);
    second._surfaceGrowth = {
      ...first._surfaceGrowth,
      stratigraphic_index: 1,
      underlying_surface_crystal_ids: [first.crystal_id],
    };
    const secondSwath = emit(state, second, wall, sim, layers);
    const firstMatrix = new THREE.Matrix4();
    const secondMatrix = new THREE.Matrix4();
    swath.getMatrixAt(0, firstMatrix);
    secondSwath.getMatrixAt(0, secondMatrix);
    const firstPosition = new THREE.Vector3().setFromMatrixPosition(firstMatrix);
    const secondPosition = new THREE.Vector3().setFromMatrixPosition(secondMatrix);
    const direction = wall.surfaceAnchorDirection(first);
    const patch = wall.meshFor(sim).sampleSurfacePatch(
      direction, swath.count, first._surfaceGrowth.coverage_fraction, first.crystal_id,
    );
    const normal = new THREE.Vector3(
      patch.samples[0].nx, patch.samples[0].ny, patch.samples[0].nz,
    );
    const offset = secondPosition.clone().sub(firstPosition).dot(normal);
    expect(offset).toBeCloseTo(layers[0].representative_relief_mm, 6);
  });

  it('keeps physical relief invariant across mobile LOD and executes flattened dendrite matrices', () => {
    const wall = new WallState({
      cells_per_ring: 48, ring_count: 12, vug_diameter_mm: 70,
      primary_bubbles: 3, secondary_bubbles: 7, shape_seed: 6161,
    });
    const crystal = makeAggregate(wall, 601);
    const sim = { step: 900, wall_state: wall, crystals: [crystal] };
    classifySurfaceGrowth(sim);

    const runAtWidth = (width: number) => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
      const state = renderState(wall);
      const layers: any[] = [];
      const swath = emit(state, crystal, wall, sim, layers);
      return { swath, relief: layers[0].representative_relief_mm };
    };
    const desktop = runAtWidth(1200);
    const mobile = runAtWidth(600);
    expect(desktop.swath.count).toBeGreaterThan(mobile.swath.count);
    expect(desktop.relief).toBeCloseTo(mobile.relief, 12);
    expect(desktop.swath.userData.physical_mean_thickness_um)
      .toBe(mobile.swath.userData.physical_mean_thickness_um);

    const dendrite = makeAggregate(wall, 602, 'romanechite', 'dendritic_surface_film');
    dendrite._surfaceGrowth = {
      ...crystal._surfaceGrowth,
      regime: 'dendritic_film',
      stratigraphic_index: 0,
    };
    const dendriteState = renderState(wall);
    const dendriteSwath = emit(dendriteState, dendrite, wall, sim, []);
    expect(dendriteSwath.geometry.getAttribute('position').count).toBeGreaterThan(30);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    for (let i = 0; i < dendriteSwath.count; i++) {
      dendriteSwath.getMatrixAt(i, matrix);
      matrix.decompose(position, quaternion, scale);
      expect(scale.z).toBeLessThanOrEqual(0.100001);
      expect(scale.y).toBeGreaterThan(scale.z * 5);
      expect(matrix.elements.every((value: number) => Number.isFinite(value))).toBe(true);
    }
  });

  it('builds replay geometry from each snapshot rather than the live-wall cache', () => {
    const liveWall = new WallState({
      cells_per_ring: 24, ring_count: 8, vug_diameter_mm: 60,
      primary_bubbles: 3, secondary_bubbles: 5, shape_seed: 42,
    });
    const liveMesh = liveWall.meshFor();
    const snapshotA = {
      rings: liveWall.rings.map((ring: any[]) => ring.map((cell: any) => ({
        wall_depth: cell.wall_depth,
        base_radius_mm: cell.base_radius_mm,
      }))),
    };
    const snapshotB = {
      rings: snapshotA.rings.map((ring: any[]) => ring.map((cell: any) => ({ ...cell }))),
    };
    snapshotB.rings[3][1].wall_depth += 4.25;

    const wallA = _topoSnapshotWall(liveWall, snapshotA);
    const wallB = _topoSnapshotWall(liveWall, snapshotB);
    expect(wallA).not.toBe(liveWall);
    expect(wallB).not.toBe(liveWall);
    expect(wallA._geometry_revision).toBeUndefined();
    expect(wallB._geometry_revision).toBeUndefined();
    expect(wallA._mesh).toBeUndefined();
    expect(wallB._mesh).toBeUndefined();

    const meshA = wallA.meshFor();
    const meshB = wallB.meshFor();
    expect(meshA).not.toBe(liveMesh);
    expect(meshB).not.toBe(liveMesh);
    expect(meshA).not.toBe(meshB);
    expect(meshA.sig).not.toBe(meshB.sig);
    const changedVertex = 3 * liveWall.cells_per_ring + 1;
    expect(meshA.positions[changedVertex * 3]).not.toBe(meshB.positions[changedVertex * 3]);
  });
});
