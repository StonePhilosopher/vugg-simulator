import { describe, expect, it, vi } from 'vitest';

declare const WallState: any;
declare const Crystal: any;
declare const CavitySurfaceAnchors: any;
declare const MarchingCubesExtractor: any;

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

describe('Marching Cubes Tranche 4 — topology-independent surface anchors', () => {
  it('emits a complete WallMesh surface receipt with non-enumerable compatibility aliases', () => {
    const wall = makeWall();
    const mesh = wall.meshFor();
    const anchor = wall._anchorFromRingCell(5, 7);
    expect(anchor.schema).toBe('cavity-surface-anchor-v1');
    expect(anchor.source).toEqual({ kind: 'wall-mesh', signature: mesh.geometry_sig });
    expect(anchor.position).toHaveLength(3);
    expect(anchor.normal).toHaveLength(3);
    expect(Math.hypot(...anchor.normal)).toBeCloseTo(1, 10);
    expect(anchor.barycentric.reduce((a: number, b: number) => a + b, 0)).toBeCloseTo(1, 12);
    expect(anchor.chemistry).toMatchObject({
      vertexIndex: 5 * 32 + 7,
      ringIdx: 5,
      cellIdx: 7,
      mapping: 'nearest-wall-mesh-vertex-v1',
    });
    expect(anchor.ringIdx).toBe(5);
    expect(anchor.cellIdx).toBe(7);
    expect(Object.keys(anchor)).not.toContain('ringIdx');
    expect(CavitySurfaceAnchors.validate(anchor, mesh, mesh)).toBe(true);
  });

  it('uses allocation-free scalar and geodesic hot paths without exposing mutable caches', () => {
    const wall = makeWall();
    const mesh = wall.meshFor();
    const vertex = 5 * 32 + 7;
    const areas = mesh.cellSurfaceAreasMm2();
    const exactArea = areas[vertex];
    expect(mesh.cellSurfaceAreaAtVertexMm2(vertex)).toBe(exactArea);
    areas[vertex] = 0;
    expect(mesh.cellSurfaceAreaAtVertexMm2(vertex)).toBe(exactArea);

    const distances = mesh.geodesicDistancesFrom(vertex);
    const target = vertex + 1;
    const exactDistance = distances[target];
    distances[target] = -1;
    expect(mesh.geodesicDistanceBetween(vertex, target)).toBe(exactDistance);
    expect(mesh.verticesWithinGeodesicRadius(vertex, exactDistance)).toContain(target);

    const incident = mesh.incidentTriangleForVertex(vertex);
    const candidateTriangles: number[] = [];
    for (let offset = 0; offset < mesh.indices.length; offset += 3) {
      if (mesh.indices[offset] === vertex || mesh.indices[offset + 1] === vertex
          || mesh.indices[offset + 2] === vertex) candidateTriangles.push(offset / 3);
    }
    expect(incident.triangleIndex).toBe(Math.min(...candidateTriangles));
    incident.barycentric[0] = 99;
    expect(mesh.incidentTriangleForVertex(vertex).barycentric).not.toContain(99);
  });

  it('upgrades a legacy ring/cell fixture at the WallState boundary', () => {
    const wall = makeWall();
    const crystal = new Crystal({
      mineral: 'calcite', crystal_id: 1, wall_anchor: { ringIdx: 3, cellIdx: 9 },
    });
    const resolved = wall._resolveAnchor(crystal);
    expect(resolved.schema).toBe('cavity-surface-anchor-v1');
    expect(resolved.chemistry).toMatchObject({ ringIdx: 3, cellIdx: 9, vertexIndex: 105 });
    expect(crystal.wall_anchor).toEqual({ ringIdx: 3, cellIdx: 9 });
  });

  it('constructs an authenticated MC anchor and records the source field cell', () => {
    const wall = makeWall();
    const field = wall.cavityFieldFor({ resolution: 20 });
    const surface = wall.cavitySurfaceFor({ resolution: 20, throwOnFailure: true });
    const anchor = wall.surfaceAnchorFromMarchingCubes(0, [0.2, 0.3, 0.5], { resolution: 20 });
    expect(anchor.source).toMatchObject({
      kind: 'cavity-field',
      signature: surface.sig,
      fieldSignature: field.sig,
      snapshotDigest: field.snapshotDigest,
      bufferDigest: surface.buffer_digest,
      isovalue: 0,
    });
    expect(anchor.fieldCell).toHaveLength(3);
    expect(anchor.fieldCell.every((v: number) => Number.isInteger(v) && v >= 0)).toBe(true);
    expect(CavitySurfaceAnchors.validate(anchor, surface, wall.meshFor(), field)).toBe(true);
    expect(anchor.chemistry.vertexIndex).toBeGreaterThanOrEqual(0);
    expect(anchor.chemistry.vertexIndex).toBeLessThan(wall.meshFor().numInterior);
    expect(Object.isFrozen(anchor)).toBe(true);
    expect(Object.isFrozen(anchor.position)).toBe(true);
    expect(Object.isFrozen(anchor.normal)).toBe(true);
    expect(Object.isFrozen(anchor.barycentric)).toBe(true);
    expect(Object.isFrozen(anchor.source)).toBe(true);
    expect(Object.isFrozen(anchor.chemistry)).toBe(true);
    expect(() => { anchor.position[0] += 1; }).toThrow();
  });

  it('hashes an MC surface once per extraction revision, not once per crystal resolution', () => {
    const digest = vi.spyOn(MarchingCubesExtractor, '_bufferDigest');
    const wall = makeWall();
    const field = wall.cavityFieldFor({ resolution: 20 });
    const surface = wall.cavitySurfaceFor({ resolution: 20, throwOnFailure: true });
    wall.activateCavitySurfaceAnchorProvider({ resolution: 20 });
    const anchor = wall.surfaceAnchorFromMarchingCubes(
      0, [0.2, 0.3, 0.5], { resolution: 20 },
    );
    const crystal = new Crystal({ mineral: 'quartz', crystal_id: 77, wall_anchor: anchor });
    for (let i = 0; i < 8; i++) {
      expect(CavitySurfaceAnchors.validate(anchor, surface, wall.meshFor(), field)).toBe(true);
      expect(wall._resolveAnchor(crystal)).toBe(anchor);
      expect(wall.surfaceAnchorKey(crystal)).toContain(surface.sig);
    }
    expect(digest).toHaveBeenCalledTimes(1);
    digest.mockRestore();
  });

  it('deterministically remaps a WallMesh birth point to MC and back', () => {
    const wall = makeWall();
    const birth = wall._anchorFromRingCell(4, 11);
    const mcA = wall.remapSurfaceAnchorToMarchingCubes(birth, { resolution: 20 });
    const mcB = wall.remapSurfaceAnchorToMarchingCubes(birth, { resolution: 20 });
    expect(mcA).toEqual(mcB);
    expect(mcA.source.kind).toBe('cavity-field');
    const back = wall.remapSurfaceAnchorToWallMesh(mcA);
    expect(back.source.kind).toBe('wall-mesh');
    const closest = CavitySurfaceAnchors.closestTriangle(wall.meshFor(), mcA.position);
    expect(back.triangleIndex).toBe(closest.triangleIndex);
    expect(back.position[0]).toBeCloseTo(closest.point[0], 12);
    expect(back.position[1]).toBeCloseTo(closest.point[1], 12);
    expect(back.position[2]).toBeCloseTo(closest.point[2], 12);
  });

  it('derives the destination field cell from physical position when a field is regridded', () => {
    const wall = makeWall();
    const oldAnchor = wall.surfaceAnchorFromMarchingCubes(
      0, [0.2, 0.3, 0.5], { resolution: 20 },
    );
    const newField = wall.cavityFieldFor({ resolution: 28 });
    const newSurface = wall.cavitySurfaceFor({ resolution: 28, throwOnFailure: true });
    // Poison the historical address with a tuple which is valid in the new
    // grid but belongs to a remote physical region. Position remains the
    // authoritative cross-topology identity.
    const poisoned = { ...oldAnchor, fieldCell: [0, 0, 0] };
    const remapped = CavitySurfaceAnchors.remapToMarchingCubes(
      poisoned, newField, newSurface, wall.meshFor(),
    );
    const fullSearch = CavitySurfaceAnchors.closestTriangle(newSurface, oldAnchor.position);
    expect(remapped.triangleIndex).toBe(fullSearch.triangleIndex);
    expect(remapped.position[0]).toBeCloseTo(fullSearch.point[0], 12);
    expect(remapped.position[1]).toBeCloseTo(fullSearch.point[1], 12);
    expect(remapped.position[2]).toBeCloseTo(fullSearch.point[2], 12);

    const wrongButInBounds = remapped.fieldCell.slice();
    wrongButInBounds[0] = wrongButInBounds[0] === 0 ? 1 : 0;
    expect(() => CavitySurfaceAnchors.validate({
      ...remapped, fieldCell: wrongButInBounds,
    }, newSurface, wall.meshFor(), newField)).toThrow(/fieldCell.*physical position/i);
  });

  it('full-scans a local-neighborhood boundary tie to preserve the global index tie-break', () => {
    const neighborhood = vi.spyOn(CavitySurfaceAnchors, '_fieldNeighborhoodTriangles')
      .mockReturnValue([7]);
    const closest = vi.spyOn(CavitySurfaceAnchors, 'closestTriangle')
      .mockImplementation((_surface: any, _position: any, indices?: number[]) => ({
        triangleIndex: indices ? 7 : 3,
        barycentric: [1, 0, 0],
        distance2: 4,
      }));
    const construct = vi.spyOn(CavitySurfaceAnchors, 'fromMarchingCubes')
      .mockImplementation((_field: any, _surface: any, _mesh: any, triangleIndex: number) => ({
        triangleIndex,
      }));
    try {
      const remapped = CavitySurfaceAnchors.remapToMarchingCubes(
        { position: [0, 0, 0] }, { spacingMm: 2 }, {}, {},
      );
      expect(remapped.triangleIndex).toBe(3);
      expect(closest).toHaveBeenCalledTimes(2);
    } finally {
      neighborhood.mockRestore();
      closest.mockRestore();
      construct.mockRestore();
    }
  });

  it('keeps diagnostic extraction separate from explicit anchor-provider activation', () => {
    const wall = makeWall();
    const birth = wall._anchorFromRingCell(4, 11);
    const crystal = new Crystal({ mineral: 'quartz', crystal_id: 79, wall_anchor: birth });
    wall.cavitySurfaceFor({ resolution: 20, throwOnFailure: true });
    expect(wall._cavitySurfaceAnchorProvider).toEqual({ kind: 'wall-mesh' });
    expect(wall._resolveAnchor(crystal)).toBe(birth);
    expect(wall.surfaceAnchorKey(crystal)).toBe(CavitySurfaceAnchors.key(birth));

    const receipt = wall.activateCavitySurfaceAnchorProvider({ resolution: 20 });
    const promoted = wall._resolveAnchor(crystal);
    expect(receipt.kind).toBe('cavity-field');
    expect(promoted.source.kind).toBe('cavity-field');
    expect(promoted.source.signature).toBe(receipt.surface_signature);
    expect(crystal.wall_anchor).toBe(birth);

    // A later diagnostic at another resolution cannot replace the activated
    // authority. Only another explicit activation may do that.
    wall.cavitySurfaceFor({ resolution: 28, throwOnFailure: true });
    expect(wall._resolveAnchor(crystal).source.signature).toBe(receipt.surface_signature);
    expect(wall._cavitySurfaceAnchorProvider).toBe(receipt);

    wall.deactivateCavitySurfaceAnchorProvider();
    const deactivated = wall._resolveAnchor({ wall_anchor: promoted });
    expect(deactivated.source.kind).toBe('wall-mesh');
    expect(wall._cavitySurfaceAnchorProvider).toEqual({ kind: 'wall-mesh' });
  });

  it('refuses to activate empty or open scalar surfaces atomically', () => {
    const wall = makeWall();
    const before = wall._cavitySurfaceAnchorProvider;
    expect(() => wall.activateCavitySurfaceAnchorProvider({
      resolution: 20, isovalue: 1e9,
    })).toThrow(/empty|open|unauthenticated/i);
    expect(wall._cavitySurfaceAnchorProvider).toBe(before);
    expect(wall._activeCavitySurfaceAnchorProvider).toBeNull();
    expect(() => wall.activateCavitySurfaceAnchorProvider({
      resolution: 20, isovalue: -1e9,
    })).toThrow(/empty|open|unauthenticated/i);
    expect(wall._cavitySurfaceAnchorProvider).toBe(before);
  });

  it('refreshes explicit MC authority after authenticated cavity evolution', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.reactive_wall();
    conditions.fluid.pH = 4;
    const sim = new VugSimulator(conditions, events);
    const wall = sim.wall_state;
    const firstReceipt = wall.activateCavitySurfaceAnchorProvider({ resolution: 20 });
    const crystal = new Crystal({
      mineral: 'quartz', crystal_id: 82, wall_anchor: wall._anchorFromRingCell(4, 11),
    });
    const firstAnchor = wall._resolveAnchor(crystal);
    sim.dissolve_wall();
    expect(wall.cavityEvolutionLedger().cursor).toBe(1);
    const secondAnchor = wall._resolveAnchor(crystal);
    const secondReceipt = wall.cavitySurfaceAnchorProviderReceipt();
    expect(secondReceipt.kind).toBe('cavity-field');
    expect(secondReceipt.field_signature).not.toBe(firstReceipt.field_signature);
    expect(secondReceipt.cavity_evolution_signature)
      .toBe(wall.cavityEvolutionLedger().signature);
    expect(secondAnchor.source.signature).toBe(secondReceipt.surface_signature);
    expect(secondAnchor.source.signature).not.toBe(firstAnchor.source.signature);
  });

  it('remaps an MC birth anchor across production field re-extraction revisions', () => {
    const wall = makeWall();
    const oldAnchor = wall.surfaceAnchorFromMarchingCubes(
      0, [0.2, 0.3, 0.5], { resolution: 20 },
    );
    const crystal = new Crystal({ mineral: 'quartz', crystal_id: 80, wall_anchor: oldAnchor });
    const next = wall.activateCavitySurfaceAnchorProvider({ resolution: 28 });
    const resolved = wall._resolveAnchor(crystal);
    const surface = wall.cavitySurfaceFor({ resolution: 28, throwOnFailure: true });
    const fullSearch = CavitySurfaceAnchors.closestTriangle(surface, oldAnchor.position);
    expect(resolved.source.kind).toBe('cavity-field');
    expect(resolved.source.signature).toBe(next.surface_signature);
    expect(resolved.source.signature).not.toBe(oldAnchor.source.signature);
    expect(resolved.triangleIndex).toBe(fullSearch.triangleIndex);
    expect(crystal.wall_anchor).toBe(oldAnchor);
  });

  it('orders connected fabric coverage by cumulative surface distance', () => {
    const wall = makeWall();
    const mesh = wall.meshFor();
    const anchor = wall._anchorFromRingCell(4, 11);
    const patch = CavitySurfaceAnchors.surfacePatch(anchor, mesh, 0.12);
    expect(patch.triangles.length).toBeGreaterThan(4);
    const distances = patch.triangles.map((triangle: any) => triangle.surface_distance_mm);
    expect(distances[0]).toBe(0);
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1] - 1e-12);
    }
    const sourceTriangle = CavitySurfaceAnchors._surfaceTopology(mesh)
      .byIndex.get(anchor.triangleIndex);
    const firstNeighbor = patch.triangles[1];
    const shared = [sourceTriangle.ia, sourceTriangle.ib, sourceTriangle.ic]
      .filter((vertex: number) => new Set([
        firstNeighbor.ia, firstNeighbor.ib, firstNeighbor.ic,
      ]).has(vertex));
    expect(shared).toHaveLength(2);
    const midpoint = [0, 1, 2].map(axis =>
      (mesh.positions[shared[0] * 3 + axis] + mesh.positions[shared[1] * 3 + axis]) / 2);
    const expectedFirst = Math.hypot(
      anchor.position[0] - midpoint[0], anchor.position[1] - midpoint[1],
      anchor.position[2] - midpoint[2],
    ) + Math.hypot(
      firstNeighbor.centroid[0] - midpoint[0], firstNeighbor.centroid[1] - midpoint[1],
      firstNeighbor.centroid[2] - midpoint[2],
    );
    expect(firstNeighbor.surface_distance_mm).toBeCloseTo(expectedFirst, 10);

    const triangleIndex = CavitySurfaceAnchors._surfaceTopology(mesh).triangles
      .find((triangle: any) => triangle.neighbor_indices.length === 3).triangle_index;
    const nearA = CavitySurfaceAnchors.fromWallMeshTriangle(
      mesh, triangleIndex, [0.98, 0.01, 0.01],
    );
    const nearB = CavitySurfaceAnchors.fromWallMeshTriangle(
      mesh, triangleIndex, [0.01, 0.98, 0.01],
    );
    const orderA = CavitySurfaceAnchors.surfacePatch(nearA, mesh, 0.02)
      .triangles.slice(1, 5).map((triangle: any) => triangle.triangle_index);
    const orderB = CavitySurfaceAnchors.surfacePatch(nearB, mesh, 0.02)
      .triangles.slice(1, 5).map((triangle: any) => triangle.triangle_index);
    expect(orderA).not.toEqual(orderB);
  });

  it('caches a topology remap against immutable history and the live geometry signature', () => {
    const wall = makeWall();
    const historical = wall._anchorFromRingCell(4, 11);
    const crystal = new Crystal({
      mineral: 'calcite', crystal_id: 91, wall_anchor: historical,
    });
    wall.rings[4][11].wall_depth += 0.125;
    const liveMesh = wall.meshFor();
    expect(historical.source.signature).not.toBe(liveMesh.geometry_sig);

    const first = wall._resolveAnchor(crystal);
    expect(() => { historical.position[0] += 4; }).toThrow();
    expect(() => { historical.source.signature = 'mutated-after-cache-hit'; }).toThrow();
    const second = wall._resolveAnchor(crystal);
    expect(second).toBe(first);
    expect(first.source.signature).toBe(liveMesh.geometry_sig);
    expect(crystal.wall_anchor).toBe(historical);
  });

  it('rejects a tampered barycentric or void-normal receipt', () => {
    const wall = makeWall();
    const mesh = wall.meshFor();
    const anchor = wall._anchorFromRingCell(2, 3);
    expect(() => CavitySurfaceAnchors.validate({
      ...anchor, barycentric: [0.5, 0.5, 0.5],
    }, mesh, mesh)).toThrow(/barycentric/i);
    expect(() => CavitySurfaceAnchors.validate({
      ...anchor, normal: anchor.normal.map((value: number) => -value),
    }, mesh, mesh)).toThrow(/normal.*(void|authenticated)/i);
  });

  it('rejects tampered source and chemistry receipts instead of executing them', () => {
    const wall = makeWall();
    const mesh = wall.meshFor();
    const anchor = wall._anchorFromRingCell(2, 3);
    expect(() => CavitySurfaceAnchors.validate({
      ...anchor, source: { ...anchor.source, signature: 'stale-mesh' },
    }, mesh, mesh)).toThrow(/signature.*stale|stale.*signature/i);
    expect(() => CavitySurfaceAnchors.validate({
      ...anchor, chemistry: { ...anchor.chemistry, ringIdx: 9 },
    }, mesh, mesh)).toThrow(/chemistry address/i);
    const alternateVertex = (anchor.chemistry.vertexIndex + 1) % mesh.numInterior;
    expect(() => CavitySurfaceAnchors.validate({
      ...anchor, chemistry: CavitySurfaceAnchors._chemistry(mesh, alternateVertex),
    }, mesh, mesh)).toThrow(/not the nearest/i);
    expect(() => CavitySurfaceAnchors.validate({
      ...anchor, normal: [anchor.normal[1], -anchor.normal[0], anchor.normal[2]],
    }, mesh, mesh)).toThrow(/normal/i);

    const field = wall.cavityFieldFor({ resolution: 20 });
    const surface = wall.cavitySurfaceFor({ resolution: 20, throwOnFailure: true });
    const mc = wall.surfaceAnchorFromMarchingCubes(0, [0.2, 0.3, 0.5], { resolution: 20 });
    expect(() => CavitySurfaceAnchors.validate({
      ...mc, source: { ...mc.source, bufferDigest: 'tampered' },
    }, surface, mesh, field)).toThrow(/stale|unauthenticated/i);
  });

  it('uses exact physical barycentric state instead of the chemistry vertex', () => {
    const wall = makeWall();
    const mesh = wall.meshFor();
    const anchor = CavitySurfaceAnchors.fromWallMeshTriangle(mesh, 10, [0.2, 0.3, 0.5]);
    const crystal = new Crystal({ mineral: 'quartz', crystal_id: 8, wall_anchor: anchor });
    const chemistryBase = anchor.chemistry.vertexIndex * 3;
    const chemistryPoint = Array.from(mesh.positions.slice(chemistryBase, chemistryBase + 3));
    expect(wall.surfacePointForCrystal(crystal)).toEqual(anchor.position);
    expect(anchor.position).not.toEqual(chemistryPoint);
    expect(wall.surfaceNormalForCrystal(crystal)).toEqual(anchor.normal);
  });

  it('starts fabric patches from authenticated source triangles, not origin rays', () => {
    const wall = makeWall();
    const mesh = wall.meshFor();
    const first = CavitySurfaceAnchors.fromWallMeshTriangle(mesh, 8, [1 / 3, 1 / 3, 1 / 3]);
    const second = { ...first, triangleIndex: 9,
      position: CavitySurfaceAnchors._point(mesh, 9, [1 / 3, 1 / 3, 1 / 3]),
      normal: CavitySurfaceAnchors._voidNormal(mesh, 9, [1 / 3, 1 / 3, 1 / 3]),
      barycentric: [1 / 3, 1 / 3, 1 / 3] };
    const patchA = CavitySurfaceAnchors.surfacePatch(first, mesh, 0.001);
    const patchB = CavitySurfaceAnchors.surfacePatch(second, mesh, 0.001);
    expect(patchA.triangles[0].triangle_index).toBe(8);
    expect(patchB.triangles[0].triangle_index).toBe(9);
  });

  it('uses the same chemistry projection for local storage while retaining a distinct surface identity', () => {
    const wall = makeWall();
    wall.activateCavitySurfaceAnchorProvider({ resolution: 20 });
    const anchor = wall.surfaceAnchorFromMarchingCubes(2, [1 / 3, 1 / 3, 1 / 3], { resolution: 20 });
    const crystal = new Crystal({ mineral: 'quartz', crystal_id: 7, wall_anchor: anchor });
    expect(wall.chemistryVertexForCrystal(crystal)).toBe(anchor.chemistry.vertexIndex);
    expect(wall.meshFor().cellOf(crystal, wall)).toBe(
      wall.meshFor().cells[anchor.chemistry.vertexIndex],
    );
    expect(wall.surfacePointForCrystal(crystal)).toEqual(anchor.position);
    expect(wall.surfaceAnchorKey(crystal)).toContain(anchor.source.signature);
  });
});
