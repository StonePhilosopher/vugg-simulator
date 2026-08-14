// ============================================================
// js/23c-geometry-surface-anchor.ts — topology-independent anchors
// ============================================================
// A crystal is attached to a physical point and local substrate normal, not
// to a latitude/longitude address or a transient triangle number. See
// proposals/PROPOSAL-CAVITY-SURFACE-ANCHORS-2026-08-12.md.

interface CavitySurfaceAnchorV1 {
  schema: 'cavity-surface-anchor-v1';
  position: [number, number, number];
  normal: [number, number, number];
  triangleIndex: number;
  barycentric: [number, number, number];
  fieldCell?: [number, number, number];
  source: {
    kind: 'wall-mesh' | 'cavity-field';
    signature: string;
    fieldSignature?: string;
    snapshotDigest?: string;
    bufferDigest?: string;
    isovalue?: number;
  };
  chemistry: {
    vertexIndex: number;
    ringIdx: number;
    cellIdx: number;
    meshSignature: string;
    mapping: 'nearest-wall-mesh-vertex-v1';
  };
  // Non-enumerable read-only compatibility aliases installed at runtime.
  // They are not serialized and never participate in surface identity.
  readonly phi?: number;
  readonly theta?: number;
  readonly ringIdx?: number;
  readonly cellIdx?: number;
}

// Routing, spatial indices, and path/cache state are simulation authority.
// Keep them behind a lexical capability instead of exposing a mutable static
// WeakMap or returning the live cache through the diagnostic API.
const CAVITY_SURFACE_TOPOLOGY_ACCESS = Object.freeze({});
const CAVITY_SURFACE_TOPOLOGY_CACHE: WeakMap<object, any> = new WeakMap();
const CAVITY_SURFACE_VALIDATION_ACCESS = Object.freeze({});
const CAVITY_SURFACE_VALIDATION_CACHE: WeakMap<object, Set<string>> = new WeakMap();
let cavitySurfaceTopologyInternal: (surface: any) => any;
let cavitySurfaceValidationKeyInternal: (
  anchor: any, surface: any, mesh: any, field: any, allowStaleChemistry: boolean,
) => string;

class CavitySurfaceAnchors {
  static readonly SCHEMA = 'cavity-surface-anchor-v1';
  static readonly MAPPING = 'nearest-wall-mesh-vertex-v1';
  // Cache repeated morphology/renderer reads without allowing a long run of
  // changing coverages to retain an unbounded number of triangle objects.
  static readonly PATCH_CACHE_TRIANGLE_BUDGET = 100000;
  static readonly SURFACE_PATH_CACHE_LIMIT = 32;
  static _validationKeyInternal(anchor: any, surface: any, mesh: any, field: any,
                                allowStaleChemistry: boolean, access: any): string {
    if (access !== CAVITY_SURFACE_VALIDATION_ACCESS) {
      throw new Error('surface-anchor validation cache authority is private');
    }
    return [
      anchor?.source?.kind, anchor?.source?.signature, anchor?.source?.fieldSignature,
      anchor?.source?.snapshotDigest, anchor?.source?.bufferDigest, anchor?.source?.isovalue,
      anchor?.triangleIndex, ...(anchor?.position || []), ...(anchor?.normal || []),
      ...(anchor?.barycentric || []), ...(anchor?.fieldCell || []),
      anchor?.chemistry?.vertexIndex, anchor?.chemistry?.ringIdx, anchor?.chemistry?.cellIdx,
      anchor?.chemistry?.meshSignature, anchor?.chemistry?.mapping,
      CavitySurfaceAnchors._surfaceSignature(surface),
      CavitySurfaceAnchors._geometrySignature(mesh), field?.sig, field?.snapshotDigest,
      allowStaleChemistry ? 'stale-chemistry-ok' : 'complete',
    ].join('|');
  }

  static _tuple3(value: any, label: string): [number, number, number] {
    if (!Array.isArray(value) || value.length !== 3) {
      throw new TypeError(`${label} must contain exactly three coordinates`);
    }
    const out: [number, number, number] = [Number(value[0]), Number(value[1]), Number(value[2])];
    if (!out.every(Number.isFinite)) throw new TypeError(`${label} must contain finite coordinates`);
    return out;
  }

  static _unit(value: any, label: string): [number, number, number] {
    const out = CavitySurfaceAnchors._tuple3(value, label);
    const length = Math.hypot(out[0], out[1], out[2]);
    if (!(length > 1e-12) || !Number.isFinite(length)) {
      throw new RangeError(`${label} must have a finite non-zero length`);
    }
    return [out[0] / length, out[1] / length, out[2] / length];
  }

  static _barycentric(value: any): [number, number, number] {
    const bary = CavitySurfaceAnchors._tuple3(value, 'surface anchor barycentric coordinates');
    const tolerance = 1e-7;
    if (bary.some(component => component < -tolerance || component > 1 + tolerance)
        || Math.abs(bary[0] + bary[1] + bary[2] - 1) > tolerance) {
      throw new RangeError('surface anchor barycentric coordinates must be non-negative and sum to one');
    }
    const clamped: [number, number, number] = [
      Math.max(0, Math.min(1, bary[0])),
      Math.max(0, Math.min(1, bary[1])),
      Math.max(0, Math.min(1, bary[2])),
    ];
    const sum = clamped[0] + clamped[1] + clamped[2];
    return [clamped[0] / sum, clamped[1] / sum, clamped[2] / sum];
  }

  static _geometrySignature(mesh: any): string {
    return String(mesh?.geometry_sig || mesh?.sig || 'wall-mesh:unversioned');
  }

  static _triangle(surface: any, triangleIndex: number): any {
    if (!Number.isInteger(triangleIndex) || triangleIndex < 0) {
      throw new RangeError('surface anchor triangleIndex must be a non-negative integer');
    }
    const indices = surface?.indices;
    const positions = surface?.positions;
    const offset = triangleIndex * 3;
    if (!indices || !positions || offset + 2 >= indices.length) {
      throw new RangeError('surface anchor triangleIndex is outside the source surface');
    }
    return {
      ia: Number(indices[offset]),
      ib: Number(indices[offset + 1]),
      ic: Number(indices[offset + 2]),
    };
  }

  static _point(surface: any, triangleIndex: number, barycentric: any): [number, number, number] {
    const t = CavitySurfaceAnchors._triangle(surface, triangleIndex);
    const bary = CavitySurfaceAnchors._barycentric(barycentric);
    const p = surface.positions;
    return [
      bary[0] * p[t.ia * 3] + bary[1] * p[t.ib * 3] + bary[2] * p[t.ic * 3],
      bary[0] * p[t.ia * 3 + 1] + bary[1] * p[t.ib * 3 + 1] + bary[2] * p[t.ic * 3 + 1],
      bary[0] * p[t.ia * 3 + 2] + bary[1] * p[t.ib * 3 + 2] + bary[2] * p[t.ic * 3 + 2],
    ];
  }

  static _voidNormal(surface: any, triangleIndex: number, barycentric: any): [number, number, number] {
    const t = CavitySurfaceAnchors._triangle(surface, triangleIndex);
    const bary = CavitySurfaceAnchors._barycentric(barycentric);
    const normals = surface.normals;
    if (normals && normals.length >= surface.positions.length) {
      return CavitySurfaceAnchors._unit([
        -(bary[0] * normals[t.ia * 3] + bary[1] * normals[t.ib * 3] + bary[2] * normals[t.ic * 3]),
        -(bary[0] * normals[t.ia * 3 + 1] + bary[1] * normals[t.ib * 3 + 1] + bary[2] * normals[t.ic * 3 + 1]),
        -(bary[0] * normals[t.ia * 3 + 2] + bary[1] * normals[t.ib * 3 + 2] + bary[2] * normals[t.ic * 3 + 2]),
      ], 'surface anchor normal');
    }
    const p = surface.positions;
    const ax = p[t.ia * 3], ay = p[t.ia * 3 + 1], az = p[t.ia * 3 + 2];
    const abx = p[t.ib * 3] - ax, aby = p[t.ib * 3 + 1] - ay, abz = p[t.ib * 3 + 2] - az;
    const acx = p[t.ic * 3] - ax, acy = p[t.ic * 3 + 1] - ay, acz = p[t.ic * 3 + 2] - az;
    return CavitySurfaceAnchors._unit([
      -(aby * acz - abz * acy),
      -(abz * acx - abx * acz),
      -(abx * acy - aby * acx),
    ], 'surface anchor normal');
  }

  static _nearestChemistryVertex(mesh: any, position: any): number {
    if (!mesh?.positions || !(mesh.numInterior > 0)) {
      throw new RangeError('surface anchor chemistry projection requires a populated WallMesh');
    }
    const point = CavitySurfaceAnchors._tuple3(position, 'surface anchor position');
    let best = -1;
    let bestDistance2 = Infinity;
    for (let index = 0; index < mesh.numInterior; index++) {
      const base = index * 3;
      const dx = Number(mesh.positions[base]) - point[0];
      const dy = Number(mesh.positions[base + 1]) - point[1];
      const dz = Number(mesh.positions[base + 2]) - point[2];
      const distance2 = dx * dx + dy * dy + dz * dz;
      // Strictly-less plus ascending scan makes exact ties choose the lowest
      // vertex index without a floating epsilon that could reorder near-ties.
      if (distance2 < bestDistance2) {
        bestDistance2 = distance2;
        best = index;
      }
    }
    if (best < 0 || !Number.isFinite(bestDistance2)) {
      throw new RangeError('surface anchor chemistry projection failed');
    }
    return best;
  }

  static _chemistry(mesh: any, vertexIndex: number): any {
    if (!Number.isInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= mesh.numInterior) {
      throw new RangeError('surface anchor chemistry vertex is outside WallMesh');
    }
    const vertex = mesh.vertices?.[vertexIndex];
    const N = Number(mesh.cellsPerRing) || 0;
    const ringIdx = vertex && Number.isInteger(vertex.ringIdx)
      ? vertex.ringIdx : Math.floor(vertexIndex / N);
    const cellIdx = vertex && Number.isInteger(vertex.cellIdx)
      ? vertex.cellIdx : vertexIndex % N;
    return {
      vertexIndex,
      ringIdx,
      cellIdx,
      meshSignature: CavitySurfaceAnchors._geometrySignature(mesh),
      mapping: CavitySurfaceAnchors.MAPPING,
    };
  }

  static _decorateCompatibility(anchor: any, mesh?: any): any {
    if (!anchor || anchor.schema !== CavitySurfaceAnchors.SCHEMA) return anchor;
    const chemistry = anchor.chemistry;
    const vertex = mesh?.vertices?.[chemistry.vertexIndex];
    const aliases: any = {
      ringIdx: chemistry.ringIdx,
      cellIdx: chemistry.cellIdx,
      phi: vertex && Number.isFinite(vertex.phi) ? vertex.phi : undefined,
      theta: vertex && Number.isFinite(vertex.theta) ? vertex.theta : undefined,
    };
    for (const key of Object.keys(aliases)) {
      if (Object.prototype.hasOwnProperty.call(anchor, key)) continue;
      Object.defineProperty(anchor, key, {
        configurable: true,
        enumerable: false,
        get: () => aliases[key],
      });
    }
    return anchor;
  }

  static seal(anchor: any, mesh?: any): any {
    CavitySurfaceAnchors._decorateCompatibility(anchor, mesh);
    for (const key of ['position', 'normal', 'barycentric', 'fieldCell']) {
      if (Array.isArray(anchor?.[key]) && !Object.isFrozen(anchor[key])) Object.freeze(anchor[key]);
    }
    if (anchor?.source && !Object.isFrozen(anchor.source)) Object.freeze(anchor.source);
    if (anchor?.chemistry && !Object.isFrozen(anchor.chemistry)) Object.freeze(anchor.chemistry);
    return Object.isFrozen(anchor) ? anchor : Object.freeze(anchor);
  }

  static fromWallMeshTriangle(mesh: any, triangleIndex: number, barycentric: any,
                              chemistryVertex?: number): CavitySurfaceAnchorV1 {
    const bary = CavitySurfaceAnchors._barycentric(barycentric);
    const position = CavitySurfaceAnchors._point(mesh, triangleIndex, bary);
    const vertexIndex = chemistryVertex == null
      ? CavitySurfaceAnchors._nearestChemistryVertex(mesh, position)
      : Number(chemistryVertex);
    const anchor: any = {
      schema: CavitySurfaceAnchors.SCHEMA,
      position,
      normal: CavitySurfaceAnchors._voidNormal(mesh, triangleIndex, bary),
      triangleIndex,
      barycentric: bary,
      source: {
        kind: 'wall-mesh',
        signature: CavitySurfaceAnchors._geometrySignature(mesh),
      },
      chemistry: CavitySurfaceAnchors._chemistry(mesh, vertexIndex),
    };
    const triangle = CavitySurfaceAnchors._triangle(mesh, triangleIndex);
    const oneHotVertex = bary[0] > 1 - 1e-9 ? triangle.ia
      : bary[1] > 1 - 1e-9 ? triangle.ib
      : bary[2] > 1 - 1e-9 ? triangle.ic : -1;
    const averaged = oneHotVertex >= 0 ? mesh.voidNormalAtVertex?.(oneHotVertex) : null;
    if (averaged) anchor.normal = CavitySurfaceAnchors._unit(
      averaged, 'WallMesh vertex normal',
    );
    CavitySurfaceAnchors.validate(anchor, mesh, mesh);
    return CavitySurfaceAnchors.seal(anchor, mesh);
  }

  static fromWallMeshVertex(mesh: any, vertexIndex: number): CavitySurfaceAnchorV1 {
    if (!Number.isInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= mesh?.numInterior) {
      throw new RangeError('WallMesh surface anchor requires an interior vertex');
    }
    const incident = mesh.incidentTriangleForVertex?.(vertexIndex);
    if (!incident) throw new RangeError('WallMesh vertex has no incident surface triangle');
    return CavitySurfaceAnchors.fromWallMeshTriangle(
      mesh, incident.triangleIndex, incident.barycentric, vertexIndex,
    );
  }

  static fromMarchingCubes(field: any, surface: any, mesh: any,
                           triangleIndex: number, barycentric: any): CavitySurfaceAnchorV1 {
    if (!field || !surface || !mesh) throw new TypeError('Marching Cubes anchor requires field, surface, and WallMesh');
    if (surface.source_field_signature !== field.sig
        || surface.source_field_snapshot_digest !== field.snapshotDigest
        || surface.sig !== field.surfaceSignature(surface.isovalue)) {
      throw new Error('Marching Cubes anchor requires an authenticated field/surface pair');
    }
    MarchingCubesExtractor.verifyBuffers(surface);
    const bary = CavitySurfaceAnchors._barycentric(barycentric);
    const position = CavitySurfaceAnchors._point(surface, triangleIndex, bary);
    const fieldCell: [number, number, number] = [
      Math.max(0, Math.min(field.sizeX - 2, Math.floor((position[0] - field.origin[0]) / field.spacingMm))),
      Math.max(0, Math.min(field.sizeY - 2, Math.floor((position[1] - field.origin[1]) / field.spacingMm))),
      Math.max(0, Math.min(field.sizeZ - 2, Math.floor((position[2] - field.origin[2]) / field.spacingMm))),
    ];
    const chemistryVertex = CavitySurfaceAnchors._nearestChemistryVertex(mesh, position);
    const anchor: any = {
      schema: CavitySurfaceAnchors.SCHEMA,
      position,
      normal: CavitySurfaceAnchors._voidNormal(surface, triangleIndex, bary),
      triangleIndex,
      barycentric: bary,
      fieldCell,
      source: {
        kind: 'cavity-field',
        signature: String(surface.sig),
        fieldSignature: String(field.sig),
        snapshotDigest: String(field.snapshotDigest),
        bufferDigest: String(surface.buffer_digest),
        isovalue: Number(surface.isovalue),
      },
      chemistry: CavitySurfaceAnchors._chemistry(mesh, chemistryVertex),
    };
    CavitySurfaceAnchors.validate(anchor, surface, mesh, field);
    return CavitySurfaceAnchors.seal(anchor, mesh);
  }

  static chemistryAddress(anchor: any): any {
    if (!anchor) return null;
    if (anchor.schema === CavitySurfaceAnchors.SCHEMA && anchor.chemistry) {
      const c = anchor.chemistry;
      if (Number.isInteger(c.vertexIndex) && Number.isInteger(c.ringIdx) && Number.isInteger(c.cellIdx)) {
        return { vertexIndex: c.vertexIndex, ringIdx: c.ringIdx, cellIdx: c.cellIdx };
      }
    }
    if (Number.isInteger(anchor.ringIdx) && Number.isInteger(anchor.cellIdx)) {
      return { vertexIndex: null, ringIdx: anchor.ringIdx, cellIdx: anchor.cellIdx };
    }
    return null;
  }

  static upgradeLegacy(anchor: any, mesh: any): CavitySurfaceAnchorV1 | null {
    const address = CavitySurfaceAnchors.chemistryAddress(anchor);
    if (!address || !(mesh?.cellsPerRing > 0)) return null;
    const vertexIndex = address.vertexIndex == null
      ? address.ringIdx * mesh.cellsPerRing + address.cellIdx
      : address.vertexIndex;
    if (vertexIndex < 0 || vertexIndex >= mesh.numInterior) return null;
    return CavitySurfaceAnchors.fromWallMeshVertex(mesh, vertexIndex);
  }

  static _closestPointOnTriangle(point: number[], a: number[], b: number[], c: number[]): any {
    // Ericson, Real-Time Collision Detection, closest point on triangle.
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const ap = [point[0] - a[0], point[1] - a[1], point[2] - a[2]];
    const dot = (u: number[], v: number[]) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const d1 = dot(ab, ap), d2 = dot(ac, ap);
    if (d1 <= 0 && d2 <= 0) return { point: a, barycentric: [1, 0, 0] };
    const bp = [point[0] - b[0], point[1] - b[1], point[2] - b[2]];
    const d3 = dot(ab, bp), d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) return { point: b, barycentric: [0, 1, 0] };
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) {
      const v = d1 / (d1 - d3);
      return { point: [a[0] + v * ab[0], a[1] + v * ab[1], a[2] + v * ab[2]], barycentric: [1 - v, v, 0] };
    }
    const cp = [point[0] - c[0], point[1] - c[1], point[2] - c[2]];
    const d5 = dot(ab, cp), d6 = dot(ac, cp);
    if (d6 >= 0 && d5 <= d6) return { point: c, barycentric: [0, 0, 1] };
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
      const w = d2 / (d2 - d6);
      return { point: [a[0] + w * ac[0], a[1] + w * ac[1], a[2] + w * ac[2]], barycentric: [1 - w, 0, w] };
    }
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
      const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
      return {
        point: [b[0] + w * (c[0] - b[0]), b[1] + w * (c[1] - b[1]), b[2] + w * (c[2] - b[2])],
        barycentric: [0, 1 - w, w],
      };
    }
    const denominator = 1 / (va + vb + vc);
    const v = vb * denominator, w = vc * denominator;
    return {
      point: [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w],
      barycentric: [1 - v - w, v, w],
    };
  }

  static closestTriangle(surface: any, position: any, triangleIndices?: number[]): any {
    const point = CavitySurfaceAnchors._tuple3(position, 'surface remap position');
    let best: any = null;
    const candidates = triangleIndices || Array.from(
      { length: surface.indices.length / 3 }, (_, index) => index,
    );
    for (const triangleIndex of candidates) {
      const t = CavitySurfaceAnchors._triangle(surface, triangleIndex);
      const p = surface.positions;
      const candidate = CavitySurfaceAnchors._closestPointOnTriangle(point,
        [p[t.ia * 3], p[t.ia * 3 + 1], p[t.ia * 3 + 2]],
        [p[t.ib * 3], p[t.ib * 3 + 1], p[t.ib * 3 + 2]],
        [p[t.ic * 3], p[t.ic * 3 + 1], p[t.ic * 3 + 2]]);
      const dx = candidate.point[0] - point[0];
      const dy = candidate.point[1] - point[1];
      const dz = candidate.point[2] - point[2];
      const distance2 = dx * dx + dy * dy + dz * dz;
      if (!best || distance2 < best.distance2
          || (distance2 === best.distance2 && triangleIndex < best.triangleIndex)) {
        best = { triangleIndex, barycentric: candidate.barycentric, point: candidate.point, distance2 };
      }
    }
    if (!best) throw new RangeError('cannot remap anchor to an empty surface');
    return best;
  }

  static _fieldNeighborhoodTriangles(anchor: any, field: any, surface: any): number[] {
    if (!field?.origin || !(field.spacingMm > 0)) return [];
    // `position` is authoritative across regridding. An old integer fieldCell
    // belongs to the old origin/spacing/resolution and must never be applied to
    // a new grid merely because the tuple remains in bounds.
    const fieldCell = CavitySurfaceAnchors._fieldCellForPosition(field, anchor?.position);
    const spacing = Number(field.spacingMm);
    const min = fieldCell.map((value: number, axis: number) =>
      Number(field.origin[axis]) + Math.max(0, value - 1) * spacing);
    const dims = [field.sizeX, field.sizeY, field.sizeZ];
    const max = fieldCell.map((value: number, axis: number) =>
      Number(field.origin[axis]) + Math.min(dims[axis] - 1, value + 2) * spacing);
    if (!surface?.positions || !surface?.indices) return [];
    const topology = cavitySurfaceTopologyInternal(surface);
    const frameKey = [field.sig || field.snapshotDigest || 'field',
      ...field.origin, field.spacingMm, field.sizeX, field.sizeY, field.sizeZ].join(':');
    let spatial = topology.fieldSpatialIndices.get(frameKey);
    if (!spatial) {
      const cellSizeX = field.sizeX - 1;
      const cellSizeY = field.sizeY - 1;
      const cellSizeZ = field.sizeZ - 1;
      const bins = new Map<number, number[]>();
      const clampCell = (value: number, size: number) =>
        Math.max(0, Math.min(size - 1, value));
      for (const triangle of topology.triangles) {
        const lower = triangle.bounds_min.map((value: number, axis: number) =>
          clampCell(Math.ceil((value - Number(field.origin[axis])) / spacing - 1),
            [cellSizeX, cellSizeY, cellSizeZ][axis]));
        const upper = triangle.bounds_max.map((value: number, axis: number) =>
          clampCell(Math.floor((value - Number(field.origin[axis])) / spacing),
            [cellSizeX, cellSizeY, cellSizeZ][axis]));
        for (let z = lower[2]; z <= upper[2]; z++) {
          for (let y = lower[1]; y <= upper[1]; y++) {
            for (let x = lower[0]; x <= upper[0]; x++) {
              const key = x + cellSizeX * (y + cellSizeY * z);
              const bin = bins.get(key);
              if (bin) bin.push(triangle.triangle_index);
              else bins.set(key, [triangle.triangle_index]);
            }
          }
        }
      }
      spatial = { bins, cellSizeX, cellSizeY, cellSizeZ };
      // A surface is authenticated to one field frame in production. Keep the
      // map for explicit historical/regrid callers, but bound stale frames.
      topology.fieldSpatialIndices.set(frameKey, spatial);
      while (topology.fieldSpatialIndices.size > 3) {
        topology.fieldSpatialIndices.delete(topology.fieldSpatialIndices.keys().next().value);
      }
    }
    const clampCell = (value: number, size: number) =>
      Math.max(0, Math.min(size - 1, value));
    const lower = min.map((value: number, axis: number) =>
      clampCell(Math.ceil((value - Number(field.origin[axis])) / spacing - 1),
        [spatial.cellSizeX, spatial.cellSizeY, spatial.cellSizeZ][axis]));
    const upper = max.map((value: number, axis: number) =>
      clampCell(Math.floor((value - Number(field.origin[axis])) / spacing),
        [spatial.cellSizeX, spatial.cellSizeY, spatial.cellSizeZ][axis]));
    const candidateSet = new Set<number>();
    for (let z = lower[2]; z <= upper[2]; z++) {
      for (let y = lower[1]; y <= upper[1]; y++) {
        for (let x = lower[0]; x <= upper[0]; x++) {
          const key = x + spatial.cellSizeX * (y + spatial.cellSizeY * z);
          for (const triangleIndex of spatial.bins.get(key) || []) candidateSet.add(triangleIndex);
        }
      }
    }
    // Preserve the exact old AABB definition and global lowest-index tie rule;
    // the index changes only how candidates are discovered.
    return Array.from(candidateSet).sort((a, b) => a - b).filter((triangleIndex) => {
      const triangle = topology.byIndex.get(triangleIndex);
      return triangle && triangle.bounds_min.every((lo: number, axis: number) =>
        triangle.bounds_max[axis] >= min[axis] && lo <= max[axis]);
    });
  }

  static _fieldCellForPosition(field: any, position: any): [number, number, number] {
    if (!field?.origin || !(field.spacingMm > 0)
        || !(field.sizeX > 1) || !(field.sizeY > 1) || !(field.sizeZ > 1)) {
      throw new TypeError('surface anchor field cell requires a valid scalar grid');
    }
    const point = CavitySurfaceAnchors._tuple3(position, 'surface anchor position');
    return [field.sizeX, field.sizeY, field.sizeZ].map((size: number, axis: number) =>
      Math.max(0, Math.min(size - 2,
        Math.floor((point[axis] - Number(field.origin[axis])) / Number(field.spacingMm))))) as [number, number, number];
  }

  static remapToMarchingCubes(anchor: any, field: any, surface: any, mesh: any): CavitySurfaceAnchorV1 {
    if (anchor?.schema === CavitySurfaceAnchors.SCHEMA
        && anchor.source?.kind === 'cavity-field'
        && anchor.source.signature === surface?.sig) {
      CavitySurfaceAnchors.validate(anchor, surface, mesh, field);
      return CavitySurfaceAnchors.seal(anchor, mesh);
    }
    const source = CavitySurfaceAnchors._tuple3(anchor?.position, 'surface remap position');
    const localCandidates = CavitySurfaceAnchors._fieldNeighborhoodTriangles(anchor, field, surface);
    let closest = localCandidates.length
      ? CavitySurfaceAnchors.closestTriangle(surface, source, localCandidates)
      : CavitySurfaceAnchors.closestTriangle(surface, source);
    // The expanded neighborhood boundary is at least one cell spacing from a
    // point in the central cell. If the local surface is farther away, an
    // outside triangle may be closer and correctness requires the full scan.
    if (localCandidates.length && closest.distance2 >= field.spacingMm * field.spacingMm) {
      closest = CavitySurfaceAnchors.closestTriangle(surface, source);
    }
    return CavitySurfaceAnchors.fromMarchingCubes(
      field, surface, mesh, closest.triangleIndex, closest.barycentric,
    );
  }

  static remapToWallMesh(anchor: any, mesh: any): CavitySurfaceAnchorV1 {
    // Physical position is authoritative. The chemistry vertex is only a
    // transport projection and must never become a geometric remap shortcut.
    const closest = CavitySurfaceAnchors.closestTriangle(mesh, anchor?.position);
    return CavitySurfaceAnchors.fromWallMeshTriangle(
      mesh, closest.triangleIndex, closest.barycentric,
    );
  }

  static validate(anchor: any, surface?: any, mesh?: any, field?: any,
                  opts: any = {}): boolean {
    if (!anchor || anchor.schema !== CavitySurfaceAnchors.SCHEMA) {
      throw new TypeError('surface anchor schema is unsupported');
    }
    // Authenticate MC buffer ownership before consulting the anchor cache.
    // Extractor-owned buffers are private read-only proxies with O(1) identity
    // verification; externally supplied surfaces still pay a complete digest.
    if (anchor.source?.kind === 'cavity-field' && surface) {
      MarchingCubesExtractor.verifyBuffers(surface);
    }
    const validationKey = cavitySurfaceValidationKeyInternal(
      anchor, surface, mesh, field, !!opts.allowStaleChemistry,
    );
    const cachedValidations = CAVITY_SURFACE_VALIDATION_CACHE.get(anchor);
    if (cachedValidations?.has(validationKey)) return true;
    const position = CavitySurfaceAnchors._tuple3(anchor.position, 'surface anchor position');
    const normal = CavitySurfaceAnchors._unit(anchor.normal, 'surface anchor normal');
    if (Math.abs(Math.hypot(anchor.normal[0], anchor.normal[1], anchor.normal[2]) - 1) > 1e-6) {
      throw new RangeError('surface anchor normal must already be unit length');
    }
    const bary = CavitySurfaceAnchors._barycentric(anchor.barycentric);
    if (!Number.isInteger(anchor.triangleIndex) || anchor.triangleIndex < 0) {
      throw new RangeError('surface anchor triangleIndex must be a non-negative integer');
    }
    if (!anchor.source || (anchor.source.kind !== 'wall-mesh' && anchor.source.kind !== 'cavity-field')
        || typeof anchor.source.signature !== 'string' || !anchor.source.signature) {
      throw new TypeError('surface anchor source receipt is incomplete');
    }
    if (anchor.source.kind === 'cavity-field'
        && (typeof anchor.source.fieldSignature !== 'string' || !anchor.source.fieldSignature
          || typeof anchor.source.snapshotDigest !== 'string' || !anchor.source.snapshotDigest
          || typeof anchor.source.bufferDigest !== 'string' || !anchor.source.bufferDigest
          || !Number.isFinite(anchor.source.isovalue))) {
      throw new TypeError('surface anchor cavity-field receipt is incomplete');
    }
    const c = anchor.chemistry;
    if (!c || !Number.isInteger(c.vertexIndex) || c.vertexIndex < 0
        || !Number.isInteger(c.ringIdx) || c.ringIdx < 0
        || !Number.isInteger(c.cellIdx) || c.cellIdx < 0
        || c.mapping !== CavitySurfaceAnchors.MAPPING) {
      throw new TypeError('surface anchor chemistry projection is incomplete');
    }
    if (!opts.allowStaleChemistry) {
      if (!mesh || CavitySurfaceAnchors._geometrySignature(mesh) !== c.meshSignature
          || c.vertexIndex >= mesh.numInterior) {
        throw new Error('surface anchor chemistry projection does not match its WallMesh');
      }
      const expectedChemistry = CavitySurfaceAnchors._chemistry(mesh, c.vertexIndex);
      if (expectedChemistry.ringIdx !== c.ringIdx || expectedChemistry.cellIdx !== c.cellIdx) {
        throw new Error('surface anchor chemistry address disagrees with its WallMesh vertex');
      }
      if (CavitySurfaceAnchors._nearestChemistryVertex(mesh, position) !== c.vertexIndex) {
        throw new Error('surface anchor chemistry projection is not the nearest WallMesh vertex');
      }
    }
    if (anchor.fieldCell != null && (!Array.isArray(anchor.fieldCell)
        || anchor.fieldCell.length !== 3
        || anchor.fieldCell.some((value: any) => !Number.isInteger(value) || value < 0))) {
      throw new TypeError('surface anchor fieldCell must contain three non-negative integers');
    }
    if (field && anchor.fieldCell && anchor.fieldCell.some(
      (value: number, axis: number) => value >= [field.sizeX - 1, field.sizeY - 1, field.sizeZ - 1][axis],
    )) {
      throw new RangeError('surface anchor fieldCell is outside its scalar field');
    }
    if (field && anchor.fieldCell) {
      const expectedFieldCell = CavitySurfaceAnchors._fieldCellForPosition(field, position);
      if (anchor.fieldCell.some((value: number, axis: number) => value !== expectedFieldCell[axis])) {
        throw new Error('surface anchor fieldCell disagrees with its physical position');
      }
    }
    if (surface) {
      if (anchor.source.kind === 'wall-mesh') {
        if (surface !== mesh
            || anchor.source.signature !== CavitySurfaceAnchors._geometrySignature(surface)) {
          throw new Error('surface anchor WallMesh source signature is stale or unauthenticated');
        }
      } else {
        if (anchor.source.signature !== surface.sig
            || anchor.source.fieldSignature !== surface.source_field_signature
            || anchor.source.snapshotDigest !== surface.source_field_snapshot_digest
            || anchor.source.bufferDigest !== surface.buffer_digest
            || Number(anchor.source.isovalue) !== Number(surface.isovalue)) {
          throw new Error('surface anchor cavity-field source receipt is stale or unauthenticated');
        }
        if (field && (field.sig !== anchor.source.fieldSignature
            || field.snapshotDigest !== anchor.source.snapshotDigest
            || field.surfaceSignature(surface.isovalue) !== anchor.source.signature)) {
          throw new Error('surface anchor field snapshot does not authenticate its extracted surface');
        }
      }
      const reconstructed = CavitySurfaceAnchors._point(surface, anchor.triangleIndex, bary);
      const scale = Math.max(1, Math.hypot(position[0], position[1], position[2]));
      if (Math.hypot(
        reconstructed[0] - position[0],
        reconstructed[1] - position[1],
        reconstructed[2] - position[2],
      ) > scale * 2e-6) {
        throw new Error('surface anchor position disagrees with its triangle/barycentric receipt');
      }
      const expected = CavitySurfaceAnchors._voidNormal(surface, anchor.triangleIndex, bary);
      let authenticated = expected;
      if (anchor.source.kind === 'wall-mesh') {
        const oneHotVertex = bary[0] > 1 - 1e-9 ? CavitySurfaceAnchors._triangle(surface, anchor.triangleIndex).ia
          : bary[1] > 1 - 1e-9 ? CavitySurfaceAnchors._triangle(surface, anchor.triangleIndex).ib
          : bary[2] > 1 - 1e-9 ? CavitySurfaceAnchors._triangle(surface, anchor.triangleIndex).ic : -1;
        const averaged = oneHotVertex >= 0 ? mesh.voidNormalAtVertex?.(oneHotVertex) : null;
        if (averaged) authenticated = CavitySurfaceAnchors._unit(averaged, 'WallMesh vertex normal');
      }
      if (Math.hypot(
        normal[0] - authenticated[0], normal[1] - authenticated[1], normal[2] - authenticated[2],
      ) > 2e-6) {
        throw new Error('surface anchor normal disagrees with its authenticated surface');
      }
    }
    const validations = cachedValidations || new Set<string>();
    validations.add(validationKey);
    CAVITY_SURFACE_VALIDATION_CACHE.set(anchor, validations);
    return true;
  }

  static _surfaceSignature(surface: any): string {
    return String(surface?.source_field_signature ? surface?.sig
      : CavitySurfaceAnchors._geometrySignature(surface));
  }

  static _surfaceTopologyInternal(surface: any, access: any): any {
    if (access !== CAVITY_SURFACE_TOPOLOGY_ACCESS) {
      throw new Error('surface topology authority is private');
    }
    if (!surface?.positions || !surface?.indices) {
      throw new TypeError('surface patch requires indexed position buffers');
    }
    const signature = CavitySurfaceAnchors._surfaceSignature(surface);
    const cached = CAVITY_SURFACE_TOPOLOGY_CACHE.get(surface);
    if (cached?.signature === signature) return cached;
    const extractorTopology = surface.source_field_signature
      ? cavitySurfaceAnchorTopologyInternal(surface)
      : null;
    const positionBuffer = extractorTopology?.positions || surface.positions;
    const indexBuffer = extractorTopology?.indices || surface.indices;
    const triangles: any[] = [];
    const edgeOwners = extractorTopology ? null : new Map<string, number[]>();
    let totalArea = 0;
    for (let triangleIndex = 0; triangleIndex < indexBuffer.length / 3; triangleIndex++) {
      const offset = triangleIndex * 3;
      const t = { ia: indexBuffer[offset], ib: indexBuffer[offset + 1], ic: indexBuffer[offset + 2] };
      const p = positionBuffer;
      const ax = p[t.ia * 3], ay = p[t.ia * 3 + 1], az = p[t.ia * 3 + 2];
      const bx = p[t.ib * 3], by = p[t.ib * 3 + 1], bz = p[t.ib * 3 + 2];
      const cx = p[t.ic * 3], cy = p[t.ic * 3 + 1], cz = p[t.ic * 3 + 2];
      const abx = bx - ax, aby = by - ay, abz = bz - az;
      const acx = cx - ax, acy = cy - ay, acz = cz - az;
      const cross = [aby * acz - abz * acy, abz * acx - abx * acz, abx * acy - aby * acx];
      const length = Math.hypot(cross[0], cross[1], cross[2]);
      if (!(length > 0) || !Number.isFinite(length)) continue;
      const normals = surface.normals;
      if (normals && normals.length >= surface.positions.length) {
        const rockNormal = [
          normals[t.ia * 3] + normals[t.ib * 3] + normals[t.ic * 3],
          normals[t.ia * 3 + 1] + normals[t.ib * 3 + 1] + normals[t.ic * 3 + 1],
          normals[t.ia * 3 + 2] + normals[t.ib * 3 + 2] + normals[t.ic * 3 + 2],
        ];
        if (cross[0] * rockNormal[0] + cross[1] * rockNormal[1]
            + cross[2] * rockNormal[2] < 0) {
          cross[0] = -cross[0]; cross[1] = -cross[1]; cross[2] = -cross[2];
        }
      }
      const triangle = {
        triangle_index: triangleIndex, ia: t.ia, ib: t.ib, ic: t.ic,
        area_mm2: length / 2,
        centroid: [(ax + bx + cx) / 3, (ay + by + cy) / 3, (az + bz + cz) / 3],
        bounds_min: [Math.min(ax, bx, cx), Math.min(ay, by, cy), Math.min(az, bz, cz)],
        bounds_max: [Math.max(ax, bx, cx), Math.max(ay, by, cy), Math.max(az, bz, cz)],
        void_normal: [-cross[0] / length, -cross[1] / length, -cross[2] / length],
        neighbor_indices: [] as number[],
      };
      triangles.push(triangle);
      totalArea += triangle.area_mm2;
      if (edgeOwners) {
        for (const [u, v] of [[t.ia, t.ib], [t.ib, t.ic], [t.ic, t.ia]]) {
          const key = u < v ? `${u}:${v}` : `${v}:${u}`;
          const owners = edgeOwners.get(key);
          if (owners) owners.push(triangleIndex); else edgeOwners.set(key, [triangleIndex]);
        }
      }
    }
    const byIndex = new Map(triangles.map(triangle => [triangle.triangle_index, triangle]));
    if (extractorTopology) {
      for (const triangle of triangles) {
        const count = extractorTopology.neighbor_counts[triangle.triangle_index];
        for (let slot = 0; slot < count; slot++) {
          triangle.neighbor_indices.push(
            extractorTopology.neighbor_triangles[triangle.triangle_index * 3 + slot],
          );
        }
      }
    } else if (edgeOwners) {
      for (const owners of edgeOwners.values()) {
        for (let i = 0; i < owners.length; i++) for (let j = i + 1; j < owners.length; j++) {
          byIndex.get(owners[i])?.neighbor_indices.push(owners[j]);
          byIndex.get(owners[j])?.neighbor_indices.push(owners[i]);
        }
      }
    }
    const triangleCapacity = indexBuffer.length / 3;
    const edgeMidpoints = new Float64Array(triangleCapacity * 9);
    const edgeCrossings = new Float64Array(triangleCapacity * 3);
    for (const triangle of triangles) {
      triangle.neighbor_indices = Array.from(
        new Set<number>(triangle.neighbor_indices as number[]),
      ).sort((a: number, b: number) => a - b);
      for (let slot = 0; slot < triangle.neighbor_indices.length; slot++) {
        const index = triangle.neighbor_indices[slot];
        const neighbor = byIndex.get(index);
        let first = -1, second = -1;
        for (const vertex of [triangle.ia, triangle.ib, triangle.ic]) {
          if (vertex === neighbor.ia || vertex === neighbor.ib || vertex === neighbor.ic) {
            if (first < 0) first = vertex;
            else second = vertex;
          }
        }
        if (first < 0 || second < 0) {
          throw new Error('surface topology neighbors must share one edge');
        }
        const edgeOffset = triangle.triangle_index * 9 + slot * 3;
        const mx = (positionBuffer[first * 3] + positionBuffer[second * 3]) / 2;
        const my = (positionBuffer[first * 3 + 1] + positionBuffer[second * 3 + 1]) / 2;
        const mz = (positionBuffer[first * 3 + 2] + positionBuffer[second * 3 + 2]) / 2;
        edgeMidpoints[edgeOffset] = mx;
        edgeMidpoints[edgeOffset + 1] = my;
        edgeMidpoints[edgeOffset + 2] = mz;
        edgeCrossings[triangle.triangle_index * 3 + slot] = Math.hypot(
          triangle.centroid[0] - mx, triangle.centroid[1] - my, triangle.centroid[2] - mz,
        ) + Math.hypot(
          neighbor.centroid[0] - mx, neighbor.centroid[1] - my, neighbor.centroid[2] - mz,
        );
      }
    }
    const topology = {
      signature, triangles, byIndex, totalArea,
      triangleCapacity,
      edgeMidpoints,
      edgeCrossings,
      fieldSpatialIndices: new Map<string, any>(),
      patchCache: new Map<string, any>(),
      patchCacheTriangleWeight: 0,
      pathCache: new Map<string, any>(),
    };
    CAVITY_SURFACE_TOPOLOGY_CACHE.set(surface, topology);
    return topology;
  }

  // Tests and diagnostics may inspect an immutable value snapshot, never the
  // maps, typed buffers, adjacency arrays, or path/cache objects used to route
  // physical surface growth.
  static _surfaceTopology(surface: any): any {
    const topology = cavitySurfaceTopologyInternal(surface);
    const triangles = topology.triangles.map((triangle: any) => Object.freeze({
      triangle_index: triangle.triangle_index,
      ia: triangle.ia, ib: triangle.ib, ic: triangle.ic,
      area_mm2: triangle.area_mm2,
      centroid: Object.freeze(triangle.centroid.slice()),
      bounds_min: Object.freeze(triangle.bounds_min.slice()),
      bounds_max: Object.freeze(triangle.bounds_max.slice()),
      void_normal: Object.freeze(triangle.void_normal.slice()),
      neighbor_indices: Object.freeze(triangle.neighbor_indices.slice()),
    }));
    const immutableTriangles = Object.freeze(triangles);
    const publicByIndex = new Map<number, any>(
      triangles.map((triangle: any) => [triangle.triangle_index, triangle]),
    );
    return Object.freeze({
      signature: topology.signature,
      triangles: immutableTriangles,
      byIndex: Object.freeze({
        size: publicByIndex.size,
        get: (index: number) => publicByIndex.get(index),
      }),
      totalArea: topology.totalArea,
      triangleCapacity: topology.triangleCapacity,
      fieldSpatialIndices: Object.freeze({ size: topology.fieldSpatialIndices.size }),
      patchCache: Object.freeze({ size: topology.patchCache.size }),
      patchCacheTriangleWeight: topology.patchCacheTriangleWeight,
      pathCache: Object.freeze({ size: topology.pathCache.size }),
    });
  }

  static surfaceAreaMm2(surface: any): number {
    return cavitySurfaceTopologyInternal(surface).totalArea;
  }

  static _patchCacheRead(topology: any, key: string): any {
    const entry = topology.patchCache.get(key);
    if (!entry) return null;
    topology.patchCache.delete(key);
    topology.patchCache.set(key, entry);
    return entry.patch;
  }

  static _patchCacheWrite(topology: any, key: string, patch: any): any {
    const weight = patch.triangles.length;
    const prior = topology.patchCache.get(key);
    if (prior) {
      topology.patchCacheTriangleWeight -= prior.weight;
      topology.patchCache.delete(key);
    }
    topology.patchCache.set(key, { patch, weight });
    topology.patchCacheTriangleWeight += weight;
    while (topology.patchCache.size > 1
        && topology.patchCacheTriangleWeight > CavitySurfaceAnchors.PATCH_CACHE_TRIANGLE_BUDGET) {
      const oldestKey = topology.patchCache.keys().next().value;
      const oldest = topology.patchCache.get(oldestKey);
      topology.patchCache.delete(oldestKey);
      topology.patchCacheTriangleWeight -= oldest.weight;
    }
    return patch;
  }

  static _frontierLess(a: any, b: any): boolean {
    return a.distance_mm < b.distance_mm
      || (a.distance_mm === b.distance_mm
        && a.triangle.triangle_index < b.triangle.triangle_index);
  }

  static _frontierPush(heap: any[], entry: any): void {
    let index = heap.length;
    heap.push(entry);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!CavitySurfaceAnchors._frontierLess(heap[index], heap[parent])) break;
      [heap[index], heap[parent]] = [heap[parent], heap[index]];
      index = parent;
    }
  }

  static _frontierPop(heap: any[]): any {
    const first = heap[0];
    const last = heap.pop();
    if (heap.length && last) {
      heap[0] = last;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let next = index;
        if (left < heap.length && CavitySurfaceAnchors._frontierLess(heap[left], heap[next])) next = left;
        if (right < heap.length && CavitySurfaceAnchors._frontierLess(heap[right], heap[next])) next = right;
        if (next === index) break;
        [heap[index], heap[next]] = [heap[next], heap[index]];
        index = next;
      }
    }
    return first;
  }

  static _surfacePathState(topology: any, pathKey: string, start: any, point: number[]): any {
    let state = topology.pathCache.get(pathKey);
    if (state) {
      topology.pathCache.delete(pathKey);
      topology.pathCache.set(pathKey, state);
      return state;
    }
    const bestDistance = new Float64Array(topology.triangleCapacity);
    bestDistance.fill(Infinity);
    bestDistance[start.triangle_index] = 0;
    state = {
      start_triangle_index: start.triangle_index,
      point: point.slice(),
      visited: new Uint8Array(topology.triangleCapacity),
      bestDistance,
      frontier: [] as any[],
      order: [] as any[],
      cumulativeArea: [] as number[],
      area_mm2: 0,
    };
    CavitySurfaceAnchors._frontierPush(state.frontier, {
      triangle: start, distance_mm: 0,
    });
    topology.pathCache.set(pathKey, state);
    while (topology.pathCache.size > CavitySurfaceAnchors.SURFACE_PATH_CACHE_LIMIT) {
      topology.pathCache.delete(topology.pathCache.keys().next().value);
    }
    return state;
  }

  static surfacePatch(anchor: any, surface: any, targetCoverage: number): any {
    const topology = cavitySurfaceTopologyInternal(surface);
    const coverage = Math.max(0, Math.min(1, Number(targetCoverage) || 0));
    const targetArea = topology.totalArea * coverage;
    const start = topology.byIndex.get(anchor?.triangleIndex);
    const point = CavitySurfaceAnchors._tuple3(
      anchor.position, 'surface patch anchor position',
    );
    const cacheKey = [start?.triangle_index ?? 'missing', coverage.toPrecision(17),
      ...point.map((value: number) => value.toPrecision(17))].join(':');
    const pathKey = [start?.triangle_index ?? 'missing',
      ...point.map((value: number) => value.toPrecision(17))].join(':');
    const cached = CavitySurfaceAnchors._patchCacheRead(topology, cacheKey);
    if (cached) return cached;
    if (!start || !(targetArea > 0)) {
      return CavitySurfaceAnchors._patchCacheWrite(topology, cacheKey, Object.freeze({
        source_signature: topology.signature,
        coverage_fraction: coverage,
        area_mm2: 0,
        triangles: Object.freeze([]),
        triangle_indices: Object.freeze([]),
      }));
    }
    const path = CavitySurfaceAnchors._surfacePathState(topology, pathKey, start, point);
    while (path.area_mm2 < targetArea - 1e-12 && path.frontier.length) {
      const current = CavitySurfaceAnchors._frontierPop(path.frontier);
      const triangle = current.triangle;
      if (path.visited[triangle.triangle_index]) continue;
      const authoritativeDistance = path.bestDistance[triangle.triangle_index];
      if (current.distance_mm > authoritativeDistance + 1e-12) continue;
      path.visited[triangle.triangle_index] = 1;
      path.order.push({ triangle, distance_mm: current.distance_mm });
      path.area_mm2 += triangle.area_mm2;
      path.cumulativeArea.push(path.area_mm2);
      for (let slot = 0; slot < triangle.neighbor_indices.length; slot++) {
        const index = triangle.neighbor_indices[slot];
        if (path.visited[index]) continue;
        const neighbor = topology.byIndex.get(index);
        if (!neighbor) continue;
        // The first crossing begins at the authoritative barycentric birth
        // point, not at the source triangle centroid. Later crossings route
        // through each shared edge, so folded-near Euclidean triangles cannot
        // shortcut the surface graph.
        const edgeOffset = triangle.triangle_index * 9 + slot * 3;
        const mx = topology.edgeMidpoints[edgeOffset];
        const my = topology.edgeMidpoints[edgeOffset + 1];
        const mz = topology.edgeMidpoints[edgeOffset + 2];
        const candidateDistance = current.distance_mm
          + (triangle.triangle_index === start.triangle_index
            ? Math.hypot(
              point[0] - mx, point[1] - my, point[2] - mz,
            ) + Math.hypot(
              neighbor.centroid[0] - mx,
              neighbor.centroid[1] - my,
              neighbor.centroid[2] - mz,
            )
            : topology.edgeCrossings[triangle.triangle_index * 3 + slot]);
        const priorDistance = path.bestDistance[index];
        if (candidateDistance >= priorDistance - 1e-12) continue;
        path.bestDistance[index] = candidateDistance;
        // Lazy duplicates avoid O(frontier) decrease-key scans. Stale entries
        // are discarded against bestDistance when popped.
        CavitySurfaceAnchors._frontierPush(path.frontier, {
          triangle: neighbor, distance_mm: candidateDistance,
        });
      }
    }
    let selectedCount = 0;
    if (path.cumulativeArea.length) {
      let low = 0, high = path.cumulativeArea.length - 1;
      while (low < high) {
        const middle = (low + high) >> 1;
        if (path.cumulativeArea[middle] < targetArea - 1e-12) low = middle + 1;
        else high = middle;
      }
      selectedCount = low + 1;
    }
    const selected: any[] = new Array(selectedCount);
    let remaining = targetArea;
    for (let index = 0; index < selectedCount; index++) {
      const entry = path.order[index];
      const weight = Math.min(entry.triangle.area_mm2, Math.max(0, remaining));
      // Never expose the mutable internal triangle as a prototype. Every
      // nested value in a public patch is an immutable copy.
      selected[index] = Object.freeze({
        triangle_index: entry.triangle.triangle_index,
        ia: entry.triangle.ia, ib: entry.triangle.ib, ic: entry.triangle.ic,
        area_mm2: entry.triangle.area_mm2,
        centroid: Object.freeze(entry.triangle.centroid.slice()),
        bounds_min: Object.freeze(entry.triangle.bounds_min.slice()),
        bounds_max: Object.freeze(entry.triangle.bounds_max.slice()),
        void_normal: Object.freeze(entry.triangle.void_normal.slice()),
        neighbor_indices: Object.freeze(entry.triangle.neighbor_indices.slice()),
        weight_mm2: weight,
        surface_distance_mm: entry.distance_mm,
      });
      remaining -= weight;
    }
    const triangleIndices = selected.map(triangle => triangle.triangle_index);
    return CavitySurfaceAnchors._patchCacheWrite(topology, cacheKey, Object.freeze({
      source_signature: topology.signature,
      coverage_fraction: coverage,
      area_mm2: targetArea - Math.max(0, remaining),
      triangles: Object.freeze(selected),
      triangle_indices: Object.freeze(triangleIndices),
    }));
  }

  static _sampleUnit(seed: number, index: number, channel: number): number {
    let x = ((Number(seed) | 0) ^ Math.imul((index + 1) | 0, 0x9e3779b1)
      ^ Math.imul((channel + 11) | 0, 0x85ebca6b)) >>> 0;
    x ^= x >>> 16; x = Math.imul(x, 0x7feb352d) >>> 0;
    x ^= x >>> 15; x = Math.imul(x, 0x846ca68b) >>> 0; x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }

  static sampleSurfacePatch(anchor: any, surface: any, count: number,
                            targetCoverage: number, seed: number): any {
    const patch = CavitySurfaceAnchors.surfacePatch(anchor, surface, targetCoverage);
    const n = Math.max(0, Number(count) | 0), samples: any[] = [];
    if (!n || !(patch.area_mm2 > 0) || !patch.triangles.length) {
      return { ...patch, samples, triangle_indices: [] };
    }
    const cumulative: number[] = [];
    let total = 0;
    for (const triangle of patch.triangles) { total += triangle.weight_mm2; cumulative.push(total); }
    const phase = CavitySurfaceAnchors._sampleUnit(seed, 0, 97), golden = 0.6180339887498949;
    for (let i = 0; i < n; i++) {
      const target = (((i + 0.5) * golden + phase) % 1) * total;
      let lo = 0, hi = cumulative.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cumulative[mid] < target) lo = mid + 1; else hi = mid; }
      const triangle = patch.triangles[lo];
      const u = CavitySurfaceAnchors._sampleUnit(seed, i, 1);
      const v = CavitySurfaceAnchors._sampleUnit(seed, i, 2);
      const su = Math.sqrt(u), wa = 1 - su, wb = su * (1 - v), wc = su * v;
      const p = surface.positions;
      samples.push({
        x: wa * p[triangle.ia * 3] + wb * p[triangle.ib * 3] + wc * p[triangle.ic * 3],
        y: wa * p[triangle.ia * 3 + 1] + wb * p[triangle.ib * 3 + 1] + wc * p[triangle.ic * 3 + 1],
        z: wa * p[triangle.ia * 3 + 2] + wb * p[triangle.ib * 3 + 2] + wc * p[triangle.ic * 3 + 2],
        nx: triangle.void_normal[0], ny: triangle.void_normal[1], nz: triangle.void_normal[2],
        triangle_index: triangle.triangle_index,
      });
    }
    return { ...patch, samples, triangle_indices: patch.triangles.map((triangle: any) => triangle.triangle_index) };
  }

  static key(anchor: any): string {
    if (!anchor) return 'unanchored';
    if (anchor.schema !== CavitySurfaceAnchors.SCHEMA) {
      const c = CavitySurfaceAnchors.chemistryAddress(anchor);
      return c ? `legacy:${c.ringIdx}:${c.cellIdx}` : 'unanchored';
    }
    const f = (value: number) => Number(value).toPrecision(12);
    return [
      anchor.schema,
      anchor.source.kind,
      anchor.source.signature,
      `p:${anchor.position.map(f).join(',')}`,
      `n:${anchor.normal.map(f).join(',')}`,
      `t:${anchor.triangleIndex}`,
      `b:${anchor.barycentric.map(f).join(',')}`,
      `c:${anchor.chemistry.vertexIndex}`,
    ].join('|');
  }

  // Capture the two authority-bearing implementations into lexical closures
  // during class initialization, before the class can be observed, then erase
  // their temporary bootstrap properties. Authorized calls never cross a
  // writable/replaceable public method and cannot leak either capability.
  static {
    const topologyImplementation = this._surfaceTopologyInternal;
    const validationKeyImplementation = this._validationKeyInternal;
    cavitySurfaceTopologyInternal = (surface: any) => topologyImplementation.call(
      this, surface, CAVITY_SURFACE_TOPOLOGY_ACCESS,
    );
    cavitySurfaceValidationKeyInternal = (
      anchor: any, surface: any, mesh: any, field: any, allowStaleChemistry: boolean,
    ) => validationKeyImplementation.call(
      this, anchor, surface, mesh, field, allowStaleChemistry,
      CAVITY_SURFACE_VALIDATION_ACCESS,
    );
    delete (this as any)._surfaceTopologyInternal;
    delete (this as any)._validationKeyInternal;
  }
}
