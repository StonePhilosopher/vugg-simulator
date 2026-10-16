import { describe, expect, it } from 'vitest';

declare const THREE: any;
declare const Crystal: any;
declare const WallState: any;
declare const classifySurfaceGrowth: any;
declare const _addCrystalParentRepresentation: any;
declare const _emitSurfaceGrowthSwath: any;
declare const _surfaceGrowthPreventFolds: any;
declare const _topoSnapshotWall: any;
declare const _topoCrystalsSignature: any;
declare const _topoSyncCrystalMeshes: any;

function makeAggregate(wall: any, id: number, mineral = 'malachite', habit = 'botryoidal') {
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
  it('inherits the latest matching contact and reconstructs the same mesh after disposal', () => {
    const surface = { sig: 'bounded-contact', positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]) };
    const triangle = { ia: 0, ib: 1, ic: 2, triangle_index: 0, area_mm2: 0.5,
      weight_mm2: 0.5, void_normal: [0, 0, -1] };
    const wall = { rings: [[]], surfaceForCrystal: () => surface,
      surfaceAnchorDirection: () => [0, 0, 1],
      surfacePatchForCrystal: () => ({ source_signature: surface.sig, area_mm2: 0.5,
        triangle_indices: [0], triangles: [triangle] }) };
    const crystal = Object.freeze({ crystal_id: 1, mineral: 'chalcedony', c_length_mm: 1,
      _surfaceGrowth: Object.freeze({ regime: 'laminated_lining', coverage_fraction: 0.9,
        mean_thickness_um: 2 }) });
    const input = JSON.stringify(crystal), originalSurface = Array.from(surface.positions);
    const layer = (height: number, signature = surface.sig) => ({
      source_signature: signature, triangle_keys: new Set([signature + ':0']),
      partitions: new Map([[0, [[
        { uv: [0, 0], top: [0, 0, -height] },
        { uv: [1, 0], top: [1, 0, -height] },
        { uv: [0, 1], top: [0, 1, -height] },
      ]]]]),
    });
    const build = () => emit({ crystals: new THREE.Group(), geomCache: new Map(), clipUniforms: {} },
      crystal, wall, {}, [layer(0.1), layer(0.4), layer(7, 'other-surface'),
        { triangle_keys: new Set([surface.sig + ':0']) }]);
    const first = build();
    expect(first.userData.unresolved_folds).toBe(0);
    expect(first.userData.top_vertex_count).toBe(3);
    for (let vertex = 0; vertex < 3; vertex++) {
      expect(first.geometry.attributes.position.getZ(vertex)).toBeCloseTo(-0.402, 7);
    }
    const positions = first.geometry.attributes.position.array.slice();
    const normals = first.geometry.attributes.normal.array.slice();
    const indices = first.geometry.index.array.slice();
    first.geometry.dispose(); first.material.dispose();
    const rebuilt = build();
    expect(rebuilt.geometry.attributes.position.array).toEqual(positions);
    expect(rebuilt.geometry.attributes.normal.array).toEqual(normals);
    expect(rebuilt.geometry.index.array).toEqual(indices);
    expect(JSON.stringify(crystal)).toBe(input);
    expect(Array.from(surface.positions)).toEqual(originalSurface);
    rebuilt.geometry.dispose(); rebuilt.material.dispose();
  });

  it('draws a continuous, raycastable lining at physical thickness, invariant across viewport LOD', () => {
    const wall = new WallState({ cells_per_ring: 48, ring_count: 12, vug_diameter_mm: 70, shape_seed: 5150 });
    const crystal = makeAggregate(wall, 500, 'chalcedony', 'banded_agate');
    const sim = { step: 900, wall_state: wall, crystals: [crystal] };
    classifySurfaceGrowth(sim);
    const testimony = JSON.stringify(crystal._surfaceGrowth);
    const source = wall.surfaceForCrystal(crystal, sim);
    const sourcePositions = Array.from(source.positions);
    const run = (width: number, layers: any[] = []) => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      const state = renderState(wall);
      return { state, mesh: emit(state, crystal, wall, sim, layers), layers };
    };
    const desktop = run(1200), mobile = run(600);
    const mesh = desktop.mesh;
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.isInstancedMesh).not.toBe(true);
    expect(desktop.state.crystals.children).toEqual([mesh]);
    expect(mesh.userData.representation).toBe('wall-conformal-lining');
    expect(mesh.geometry.attributes.position.array).toEqual(mobile.mesh.geometry.attributes.position.array);
    expect(mesh.userData.target_mean_thickness_mm).toBeCloseTo(crystal._surfaceGrowth.mean_thickness_um / 1000, 12);
    expect(mesh.userData.target_mean_thickness_mm).toBeLessThan(0.06);
    const patch = wall.surfacePatchForCrystal(crystal, mesh.userData.coverage_fraction, sim);
    expect(mesh.userData.represented_area_mm2).toBeCloseTo(patch.area_mm2, 8);
    expect(mesh.userData.top_triangle_count).toBeGreaterThanOrEqual(patch.triangles.length);
    expect(Array.from(mesh.geometry.attributes.position.array).every(Number.isFinite)).toBe(true);
    const t = patch.triangles[0];
    const first = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, 0);
    const original = new THREE.Vector3(...mesh.userData.source_points[0]);
    expect(first.distanceTo(original)).toBeCloseTo(mesh.userData.target_mean_thickness_mm, 5);
    const target = new THREE.Vector3();
    for (let i = 0; i < 3; i++) target.add(new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i));
    target.multiplyScalar(1 / 3);
    const normal = new THREE.Vector3(...t.void_normal);
    mesh.updateMatrixWorld(true);
    const hits = new THREE.Raycaster(target.clone().addScaledVector(normal, 1), normal.clone().negate(), 0, 2)
      .intersectObject(mesh, false);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].object.userData.crystal_id).toBe(crystal.crystal_id);
    const top = run(1200, desktop.layers).mesh;
    const topVertex = new THREE.Vector3().fromBufferAttribute(top.geometry.attributes.position, 0);
    expect(topVertex.distanceTo(first)).toBeCloseTo(mesh.userData.target_mean_thickness_mm, 5);
    const wrongSource = run(1200, [{ triangle_keys: new Set(patch.triangle_indices.map((i: number) => `wrong:${i}`)), representative_relief_mm: 7 }]).mesh;
    expect(wrongSource.geometry.attributes.position.array).toEqual(mesh.geometry.attributes.position.array);
    expect(Array.from(source.positions)).toEqual(sourcePositions);
    expect(JSON.stringify(crystal._surfaceGrowth)).toBe(testimony);

    // Dynamic shell geometry must not accumulate in the shared primitive cache.
    let disposed = false;
    mesh.geometry.addEventListener('dispose', () => { disposed = true; });
    _topoSyncCrystalMeshes(desktop.state, { ...sim, crystals: [] }, wall);
    expect(disposed).toBe(true);
  });

  it('clips the final lining triangle to its booked area and rejects a mismatched surface', () => {
    const surface = { sig: 'plane', positions: new Float32Array([0, 0, 0, 2, 0, 0, 0, 2, 0]), normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]) };
    const patch = { source_signature: 'plane', area_mm2: 0.5, triangle_indices: [0], triangles: [{ ia: 0, ib: 1, ic: 2, triangle_index: 0, area_mm2: 2, weight_mm2: 0.5, void_normal: [0, 0, -1] }] };
    const wall = { rings: [[]], surfacePatchForCrystal: () => patch, surfaceForCrystal: () => surface, surfaceAnchorDirection: () => [0, 0, 1] };
    const crystal = { crystal_id: 1, mineral: 'chalcedony', c_length_mm: 1, _surfaceGrowth: { regime: 'laminated_lining', coverage_fraction: 0.25, mean_thickness_um: 2 } };
    const state = { crystals: new THREE.Group(), geomCache: new Map(), clipUniforms: {} };
    const mesh = emit(state, crystal, wall, {}, []);
    let area = 0;
    for (let i = 0; i < mesh.userData.top_triangle_count * 3; i += 3) {
      const points = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, mesh.geometry.index.array[i + k]));
      area += points[1].sub(points[0]).cross(points[2].sub(points[0])).length() / 2;
    }
    // Render positions are Float32, including newly clipped edge intersections.
    expect(area).toBeCloseTo(0.5, 7);
    surface.sig = 'other';
    expect(emit(state, crystal, wall, {}, [])).toBeNull();
  });

  it('emits one connected, raycastable crust and follows actual troughs and partial contact through two thin coats', () => {
    const surface = { sig: 'contact-plane', positions: new Float32Array([0, 0, 0, 8, 0, 0, 0, 8, 0]), normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]) };
    const triangle = { ia: 0, ib: 1, ic: 2, triangle_index: 0, area_mm2: 32, void_normal: [0, 0, -1] };
    const wall = { rings: [[]], surfaceForCrystal: () => surface, surfaceAnchorDirection: () => [0, 0, 1],
      surfacePatchForCrystal: (c: any) => ({ source_signature: surface.sig, area_mm2: c.crystal_id === 1 ? 16 : 32, triangle_indices: [0], triangles: [{ ...triangle, weight_mm2: c.crystal_id === 1 ? 16 : 32 }] }),
      sampleSurfacePatchForCrystal: () => ({ source_signature: surface.sig, samples: [[2, 1], [4, 1], [3, 2]].map(([x, y]) => ({ x, y, z: 0, nx: 0, ny: 0, nz: -1, triangle_index: 0 })) }),
    };
    const first = { crystal_id: 1, mineral: 'malachite', c_length_mm: 1, _surfaceGrowth: { regime: 'botryoidal_crust', coverage_fraction: 0.5, mean_thickness_um: 300 } };
    const state = { crystals: new THREE.Group(), geomCache: new Map(), clipUniforms: {} }, layers: any[] = [];
    expect(_addCrystalParentRepresentation(state, first, new THREE.Mesh())).toBe(false);
    const crust = emit(state, first, wall, {}, layers);
    expect(crust.isInstancedMesh).not.toBe(true);
    expect(crust.userData.representation).toBe('connected-botryoidal-crust');
    expect(state.crystals.children).toEqual([crust]);
    expect(Array.from(crust.geometry.attributes.position.array).every(Number.isFinite)).toBe(true);
    const makeFilm = (id: number) => ({ ...first, crystal_id: id, _surfaceGrowth: { regime: 'laminated_lining', coverage_fraction: 0.9, mean_thickness_um: 2 } });
    const film = emit(state, makeFilm(2), wall, {}, layers);
    const secondFilm = emit(state, makeFilm(3), wall, {}, layers);
    const height = (mesh: any, x: number, y: number) => {
      mesh.updateMatrixWorld(true);
      const hits = new THREE.Raycaster(new THREE.Vector3(x, y, -10), new THREE.Vector3(0, 0, 1), 0, 20).intersectObject(mesh, false);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].object.userData.crystal_id).toBe(mesh.userData.crystal_id);
      return -hits[0].point.z;
    };
    // A crest, a trough near the feathered edge, and a point outside the earlier
    // partially booked footprint but inside the later lining's same source triangle.
    const crest = height(crust, 3, 1.25), trough = height(crust, 2.5, 0.15);
    expect(crest).toBeGreaterThan(trough + 0.1);
    for (const [x, y] of [[3, 1.25], [2.5, 0.15]]) {
      expect(height(film, x, y) - height(crust, x, y)).toBeCloseTo(0.002, 5);
      expect(height(secondFilm, x, y) - height(film, x, y)).toBeCloseTo(0.002, 5);
    }
    expect(height(film, 0.5, 5)).toBeCloseTo(0.002, 6);
    expect(height(secondFilm, 0.5, 5)).toBeCloseTo(0.004, 6);
    // Top-face graph must be one connected component, not detached ellipsoids.
    const reached = new Set<number>([0]), faces = crust.geometry.index.array;
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < crust.userData.top_triangle_count * 3; i += 3) {
        const ids = [faces[i], faces[i + 1], faces[i + 2]];
        if (ids.some(id => reached.has(id))) for (const id of ids) if (!reached.has(id)) { reached.add(id); changed = true; }
      }
    }
    expect(reached.size).toBe(crust.userData.top_vertex_count);
  });

  it('keeps converging-normal crusts unfolded and reduces rejected displacement uniformly', () => {
    const bases = [[0, 0, 0], [1, 0, 0], [0, 1, 0]], candidate = [0, 0, 1, -1, 0, 1, 0, 1, 1];
    const guard = _surfaceGrowthPreventFolds(candidate, bases, bases, [0, 1, 2]);
    expect(guard.limited_vertices).toBe(3);
    expect(guard.unresolved).toBe(0);
    expect(guard.relief_scale).toBeGreaterThan(0);
    expect(guard.relief_scale).toBeLessThan(0.5);
    expect(candidate[2]).toBe(candidate[5]);
    expect(candidate[5]).toBe(candidate[8]);
    expect(candidate[3]).toBeGreaterThan(0);
    const surface = { sig: 'curvature-plane', positions: new Float32Array([0, 0, 0, 2, 0, 0, 0, 2, 0]), normals: new Float32Array([-0.8, -0.3, 0.5, 0.8, -0.3, 0.5, 0, 0.85, 0.5]) };
    const wall = { rings: [[]], surfaceForCrystal: () => surface, surfaceAnchorDirection: () => [0, 0, 1],
      surfacePatchForCrystal: () => ({ source_signature: surface.sig, area_mm2: 2, triangle_indices: [0], triangles: [{ ia: 0, ib: 1, ic: 2, triangle_index: 0, area_mm2: 2, weight_mm2: 2, void_normal: [0, 0, -1] }] }),
      sampleSurfacePatchForCrystal: () => ({ source_signature: surface.sig, samples: [{ x: 0.6, y: 0.6, z: 0, nx: 0, ny: 0, nz: -1 }] }),
    };
    const crystal = { crystal_id: 5, mineral: 'malachite', c_length_mm: 1, _surfaceGrowth: { regime: 'botryoidal_crust', coverage_fraction: 0.9, mean_thickness_um: 3000 } };
    const testimony = JSON.stringify(crystal._surfaceGrowth), state = { crystals: new THREE.Group(), geomCache: new Map(), clipUniforms: {} }, layers: any[] = [];
    const crust = emit(state, crystal, wall, {}, layers);
    expect(crust.userData.curvature_min_relief_scale).toBeGreaterThan(0);
    expect(crust.userData.unresolved_folds).toBe(0);
    const film = emit(state, { ...crystal, crystal_id: 6, _surfaceGrowth: { regime: 'laminated_lining', coverage_fraction: 0.9, mean_thickness_um: 2 } }, wall, {}, layers);
    for (const mesh of [crust, film]) {
      for (let i = 0; i < mesh.userData.top_triangle_count * 3; i += 3) {
        const points = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, mesh.geometry.index.array[i + k]));
        // Face winding points into the void: its projected signed area stays negative.
        expect(points[1].sub(points[0]).cross(points[2].sub(points[0])).z).toBeLessThanOrEqual(1e-8);
      }
    }
    expect(JSON.stringify(crystal._surfaceGrowth)).toBe(testimony);
  });

  it('keeps a shared source edge closed after an earlier partial footprint subdivides only one side', () => {
    const surface = { sig: 'seam-plane', positions: new Float32Array([0, 0, 0, 8, 0, 0, 0, 8, 0, 8, 8, 0]), normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]) };
    const triangles = [
      { ia: 0, ib: 1, ic: 2, triangle_index: 0, area_mm2: 32, weight_mm2: 32, void_normal: [0, 0, -1] },
      { ia: 1, ib: 3, ic: 2, triangle_index: 1, area_mm2: 32, weight_mm2: 32, void_normal: [0, 0, -1] },
    ];
    const wall = { rings: [[]], surfaceForCrystal: () => surface, surfaceAnchorDirection: () => [0, 0, 1],
      surfacePatchForCrystal: (c: any) => ({ source_signature: surface.sig, area_mm2: c.crystal_id === 1 ? 16 : 64, triangle_indices: c.crystal_id === 1 ? [0] : [0, 1], triangles: c.crystal_id === 1 ? [{ ...triangles[0], weight_mm2: 16 }] : triangles }),
      sampleSurfacePatchForCrystal: (c: any) => ({ source_signature: surface.sig, samples: (c.crystal_id === 1 ? [[2, 1], [3, 2]] : [[4, 4], [3, 5], [5, 3]]).map(([x, y]) => ({ x, y, z: 0, nx: 0, ny: 0, nz: -1 })) }),
    };
    const first = { crystal_id: 1, mineral: 'malachite', c_length_mm: 1, _surfaceGrowth: { regime: 'botryoidal_crust', coverage_fraction: 0.5, mean_thickness_um: 300 } };
    const state = { crystals: new THREE.Group(), geomCache: new Map(), clipUniforms: {} }, layers: any[] = [];
    emit(state, first, wall, {}, layers);
    const top = emit(state, { ...first, crystal_id: 2 }, wall, {}, layers);
    top.updateMatrixWorld(true);
    const height = (x: number, y: number) => {
      const hits = new THREE.Raycaster(new THREE.Vector3(x, y, -10), new THREE.Vector3(0, 0, 1), 0, 20).intersectObject(top, false);
      expect(hits.length).toBeGreaterThan(0);
      return hits[0].point.z;
    };
    for (const fraction of [0.17, 1 / 3, 0.49, 0.6, 0.73]) {
      const x = fraction * 8, y = 8 - x;
      expect(Math.abs(height(x - 1e-5, y - 1e-5) - height(x + 1e-5, y + 1e-5))).toBeLessThan(0.0001);
    }
  });

  it('keeps obliquely displaced shared edges coincident after high-relief curvature limiting', () => {
    const surface = { sig: 'curved-shared-edge', positions: new Float32Array([0, 0, 0, 2, 0, 0, 0, 2, 0, 2, 2, 0]),
      normals: new Float32Array([-0.85, -0.85, 0.3, 0.85, -0.85, 0.3, -0.85, 0.85, 0.3, 0.85, 0.85, 0.3]) };
    const triangles = [
      { ia: 0, ib: 1, ic: 2, triangle_index: 0, area_mm2: 2, weight_mm2: 2, void_normal: [0, 0, -1] },
      { ia: 1, ib: 3, ic: 2, triangle_index: 1, area_mm2: 2, weight_mm2: 2, void_normal: [0, 0, -1] },
    ];
    const wall = { rings: [[]], surfaceForCrystal: () => surface, surfaceAnchorDirection: () => [0, 0, 1],
      surfacePatchForCrystal: (c: any) => ({ source_signature: surface.sig, area_mm2: c.crystal_id === 1 ? 1 : 4,
        triangle_indices: c.crystal_id === 1 ? [0] : [0, 1], triangles: c.crystal_id === 1 ? [{ ...triangles[0], weight_mm2: 1 }] : triangles }),
      sampleSurfacePatchForCrystal: () => ({ source_signature: surface.sig,
        samples: [[0.8, 0.8], [1.2, 1.2], [0.8, 1.2]].map(([x, y]) => ({ x, y, z: 0, nx: 0, ny: 0, nz: -1 })) }),
    };
    const crystal = { crystal_id: 1, mineral: 'malachite', c_length_mm: 1,
      _surfaceGrowth: { regime: 'botryoidal_crust', coverage_fraction: 0.5, mean_thickness_um: 3000 } };
    const state = { crystals: new THREE.Group(), geomCache: new Map(), clipUniforms: {} }, layers: any[] = [];
    emit(state, crystal, wall, {}, layers);
    const top = emit(state, { ...crystal, crystal_id: 2 }, wall, {}, layers);
    const film = emit(state, { ...crystal, crystal_id: 3,
      _surfaceGrowth: { regime: 'laminated_lining', coverage_fraction: 0.9, mean_thickness_um: 2 } }, wall, {}, layers);
    expect(top.userData.curvature_limited_vertices).toBeGreaterThan(0);
    for (const mesh of [top, film]) {
      expect(mesh.userData.unresolved_folds).toBe(0);
      const source = mesh.userData.source_points, index = mesh.geometry.index.array;
      const sides: any[][] = [[], []];
      for (let i = 0; i < mesh.userData.top_triangle_count * 3; i += 3) {
        const ids = [index[i], index[i + 1], index[i + 2]];
        const side = ids.reduce((sum, id) => sum + source[id][0] + source[id][1] - 2, 0) < 0 ? 0 : 1;
        for (let j = 0; j < 3; j++) {
          const a = ids[j], b = ids[(j + 1) % 3];
          if ([a, b].every(id => Math.abs(source[id][0] + source[id][1] - 2) < 1e-7)) sides[side].push([a, b]);
        }
      }
      // Compare the actual edge segments at a common SOURCE coordinate. A ray
      // at that coordinate would be wrong once normals displace vertices sideways.
      const at = (edges: any[], x: number) => {
        const edge = edges.find(([a, b]) => x >= Math.min(source[a][0], source[b][0]) - 1e-8
          && x <= Math.max(source[a][0], source[b][0]) + 1e-8 && Math.abs(source[a][0] - source[b][0]) > 1e-8);
        expect(edge).toBeDefined();
        const [a, b] = edge, fraction = (x - source[a][0]) / (source[b][0] - source[a][0]);
        return new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, a)
          .lerp(new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, b), fraction);
      };
      for (const x of [0.17, 0.49, 0.73, 1.01, 1.43, 1.81]) expect(at(sides[0], x).distanceTo(at(sides[1], x))).toBeLessThan(1e-5);
    }
  });

  it('closes a two-micron inherited film step with owned, pickable crust bridges at unchanged footprint', () => {
    const surface = { sig: 'film-step-plane', positions: new Float32Array([0, 0, 0, 8, 0, 0, 0, 8, 0]), normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]) };
    const triangle = { ia: 0, ib: 1, ic: 2, triangle_index: 0, area_mm2: 32, void_normal: [0, 0, -1] };
    const wall = { rings: [[]], surfaceForCrystal: () => surface, surfaceAnchorDirection: () => [0, 0, 1],
      surfacePatchForCrystal: (c: any) => ({ source_signature: surface.sig, area_mm2: c.crystal_id === 1 ? 16 : 32,
        triangle_indices: [0], triangles: [{ ...triangle, weight_mm2: c.crystal_id === 1 ? 16 : 32 }] }),
      sampleSurfacePatchForCrystal: () => ({ source_signature: surface.sig,
        samples: [[2, 1], [3, 2], [2, 4]].map(([x, y]) => ({ x, y, z: 0, nx: 0, ny: 0, nz: -1 })) }),
    };
    const film = { crystal_id: 1, mineral: 'chalcedony', c_length_mm: 1,
      _surfaceGrowth: { regime: 'laminated_lining', coverage_fraction: 0.5, mean_thickness_um: 2 } };
    const crustRecord = { ...film, crystal_id: 2, mineral: 'malachite',
      _surfaceGrowth: { regime: 'botryoidal_crust', coverage_fraction: 0.9, mean_thickness_um: 300 } };
    const testimony = JSON.stringify([film, crustRecord]);
    const state = { crystals: new THREE.Group(), geomCache: new Map(), clipUniforms: {} }, layers: any[] = [];
    emit(state, film, wall, {}, layers);
    const mesh = emit(state, crustRecord, wall, {}, layers);
    const count = mesh.userData.contact_step_bridges;
    expect(count).toBeGreaterThan(0);
    expect(mesh.userData.represented_area_mm2).toBe(32);
    expect(mesh.userData.ownsGeometry).toBe(true);
    expect(state.crystals.children).toHaveLength(2);
    const vertices = mesh.geometry.attributes.position;
    const first = vertices.count - count * 4;
    for (let i = first; i < vertices.count; i += 4) {
      const a = new THREE.Vector3().fromBufferAttribute(vertices, i), b = new THREE.Vector3().fromBufferAttribute(vertices, i + 1);
      const c = new THREE.Vector3().fromBufferAttribute(vertices, i + 2), d = new THREE.Vector3().fromBufferAttribute(vertices, i + 3);
      // Bridges use actual high/low top profiles; they neither stretch the
      // footprint nor replace the recorded two-micron step with a display floor.
      expect(a.x).toBeCloseTo(c.x, 6); expect(a.y).toBeCloseTo(c.y, 6);
      expect(b.x).toBeCloseTo(d.x, 6); expect(b.y).toBeCloseTo(d.y, 6);
      expect(Math.abs(a.z - c.z)).toBeCloseTo(0.002, 6);
      expect(Math.abs(b.z - d.z)).toBeCloseTo(0.002, 6);
    }
    const a = new THREE.Vector3().fromBufferAttribute(vertices, first);
    const b = new THREE.Vector3().fromBufferAttribute(vertices, first + 1);
    const c = new THREE.Vector3().fromBufferAttribute(vertices, first + 2);
    const target = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    mesh.updateMatrixWorld(true);
    const hits = new THREE.Raycaster(target.clone().addScaledVector(normal, 0.0002), normal.clone().negate(), 0, 0.0004).intersectObject(mesh, false);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].object.userData.crystal_id).toBe(2);
    let disposed = false;
    mesh.geometry.addEventListener('dispose', () => { disposed = true; });
    _topoSyncCrystalMeshes(state, { crystals: [] }, wall);
    expect(disposed).toBe(true);
    expect(JSON.stringify([film, crustRecord])).toBe(testimony);
  });

  it('keeps physical relief invariant across mobile LOD and executes flattened dendrite matrices', () => {
    const wall = new WallState({
      cells_per_ring: 48, ring_count: 12, vug_diameter_mm: 70,
      primary_bubbles: 3, secondary_bubbles: 7, shape_seed: 6161,
    });
    const crystal = makeAggregate(wall, 601);
    const sim = { step: 900, wall_state: wall, crystals: [crystal] };
    classifySurfaceGrowth(sim);
    crystal._surfaceGrowth = { ...crystal._surfaceGrowth, mean_thickness_um: 300 };

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
    expect(desktop.swath.geometry.attributes.position.array).toEqual(mobile.swath.geometry.attributes.position.array);
    expect(desktop.swath.geometry.index.array).toEqual(mobile.swath.geometry.index.array);
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

  it('does not apply renderer underburden from the same triangle number on another surface', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
    const wall = new WallState({
      cells_per_ring: 48, ring_count: 12, vug_diameter_mm: 70, shape_seed: 42,
    });
    const crystal = makeAggregate(wall, 650);
    const sim = { step: 900, wall_state: wall, crystals: [crystal] };
    classifySurfaceGrowth(sim);
    crystal._surfaceGrowth = { ...crystal._surfaceGrowth, mean_thickness_um: 300 };

    const referenceState = renderState(wall);
    const reference = emit(referenceState, crystal, wall, sim, []);
    const wrongSourceLayers = [{ triangle_keys: new Set(['different-authenticated-surface:0']), representative_relief_mm: 7 }];
    const candidate = emit(renderState(wall), crystal, wall, sim, wrongSourceLayers);
    expect(candidate.geometry.attributes.position.array).toEqual(reference.geometry.attributes.position.array);
  });

  it('replaces micron crust coins with one continuous skin at the recorded thickness', () => {
    const wall = new WallState({ cells_per_ring: 48, ring_count: 12, vug_diameter_mm: 70, shape_seed: 42 });
    const crystal = makeAggregate(wall, 680);
    const sim = { step: 900, wall_state: wall, crystals: [crystal] };
    classifySurfaceGrowth(sim);
    crystal._surfaceGrowth = { ...crystal._surfaceGrowth, mean_thickness_um: 2 };
    const testimony = JSON.stringify(crystal._surfaceGrowth);
    const state = renderState(wall), layers: any[] = [];
    const skin = emit(state, crystal, wall, sim, layers);
    expect(state.crystals.children).toEqual([skin]);
    expect(skin.isInstancedMesh).not.toBe(true);
    expect(skin.userData.representation).toBe('wall-conformal-crust-skin');
    expect(skin.userData.target_mean_thickness_mm).toBe(0.002);
    expect(layers[0].representative_relief_mm).toBeCloseTo(0.002, 5);
    expect(JSON.stringify(crystal._surfaceGrowth)).toBe(testimony);
    let disposed = false;
    skin.geometry.addEventListener('dispose', () => { disposed = true; });
    _topoSyncCrystalMeshes(state, { ...sim, crystals: [] }, wall);
    expect(disposed).toBe(true);
  });

  it('bounds a repeatable lobe size tail and replay relief without changing the scientific record', () => {
    const wall = new WallState({ cells_per_ring: 48, ring_count: 12, vug_diameter_mm: 70, shape_seed: 42 });
    const crystal = makeAggregate(wall, 681);
    const sim = { step: 900, wall_state: wall, crystals: [crystal] };
    classifySurfaceGrowth(sim);
    crystal._surfaceGrowth = { ...crystal._surfaceGrowth, mean_thickness_um: 300 };
    const testimony = JSON.stringify(crystal._surfaceGrowth);
    const run = (width: number, maturity = 1) => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
      const state = renderState(wall);
      const direction = wall.surfaceAnchorDirection(crystal);
      return _emitSurfaceGrowthSwath(state, crystal, new THREE.MeshStandardMaterial(),
        ...direction, wall, wall.ring_count, wall.cells_per_ring, wall.initial_radius_mm,
        crystal.c_length_mm * maturity, sim, []);
    };
    const full = run(1200), again = run(1200), mobile = run(600), replay = run(1200, 0.02);
    expect(full.geometry.attributes.position.array).toEqual(again.geometry.attributes.position.array);
    expect(full.geometry.attributes.position.array).toEqual(mobile.geometry.attributes.position.array);
    expect(full.userData.max_lobe_diameter_mm).toBeLessThanOrEqual(5);
    expect(full.userData.representative_relief_mm).toBeLessThanOrEqual(0.900001);
    expect(full.userData.target_basal_skin_mm).toBeGreaterThan(0);
    const heights: number[] = [];
    for (let i = 0; i < full.userData.top_vertex_count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(full.geometry.attributes.position, i);
      const height = v.distanceTo(new THREE.Vector3(...full.userData.source_points[i]));
      heights.push(height);
      expect(height).toBeLessThanOrEqual(0.90001);
    }
    expect(Math.max(...heights)).toBeGreaterThan(0.1);
    expect(new Set(heights.map(x => x.toFixed(4))).size).toBeGreaterThan(20);
    expect(replay.userData.max_lobe_relief_mm).toBeLessThanOrEqual(0.018001);
    expect(replay.userData.representative_relief_mm).toBeLessThanOrEqual(0.018001);
    expect(JSON.stringify(crystal._surfaceGrowth)).toBe(testimony);
  });

  it('invalidates the crystal renderer signature when wall evolution remaps a birth anchor', () => {
    const wall = new WallState({
      cells_per_ring: 48, ring_count: 12, vug_diameter_mm: 70, shape_seed: 42,
    });
    const crystal = new Crystal({
      mineral: 'quartz', habit: 'prismatic', vector: 'projecting',
      crystal_id: 675, wall_anchor: wall._anchorFromRingCell(6, 12),
    });
    crystal.c_length_mm = 1.2;
    const sim = { step: 4, wall_state: wall, crystals: [crystal] };
    const before = _topoCrystalsSignature(sim, wall);
    wall.rings[6][12].wall_depth += 0.25;
    wall.meshFor(sim);
    const after = _topoCrystalsSignature(sim, wall);
    expect(after).not.toBe(before);
    expect(crystal.wall_anchor.source.signature).not.toBe(
      wall._resolveAnchor(crystal).source.signature,
    );

    const state = renderState(wall);
    state.crystalsSig = null;
    _topoSyncCrystalMeshes(state, sim, wall);
    const firstMesh = state.crystals.children.find(
      (child: any) => child.userData?.crystal_id === crystal.crystal_id,
    );
    expect(firstMesh).toBeTruthy();
    const firstPosition = firstMesh.position.clone();
    for (const ring of wall.rings) for (const cell of ring) cell.wall_depth += 0.25;
    wall.meshFor(sim);
    _topoSyncCrystalMeshes(state, sim, wall);
    const secondMesh = state.crystals.children.find(
      (child: any) => child.userData?.crystal_id === crystal.crystal_id,
    );
    expect(secondMesh).toBeTruthy();
    expect(secondMesh).not.toBe(firstMesh);
    expect(secondMesh.position.distanceTo(firstPosition)).toBeGreaterThan(0.05);
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
