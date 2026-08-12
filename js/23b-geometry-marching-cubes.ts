// ============================================================
// js/23b-geometry-marching-cubes.ts — indexed cavity extraction
// ============================================================
// A deterministic, indexed Marching Cubes extractor. Instead of a classic
// 256-row triangle table, each 8-bit cube case is assembled from its six
// Marching-Squares face contours. Ambiguous four-crossing faces use the
// bilinear asymptotic decider, shared by both cells touching that face; this
// prevents face cracks while keeping global grid-edge vertices deduplicated.
// MC33-style interior ambiguity resolution remains a later production gate.

class MarchingCubesExtractor {
  static _bufferDigest(surface: any): string {
    const arrays = [surface && surface.positions, surface && surface.normals,
      surface && surface.colors, surface && surface.uvs, surface && surface.indices];
    let joined = '';
    for (const values of arrays) {
      if (!values || !ArrayBuffer.isView(values)) throw new TypeError('surface buffer is unavailable');
      const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
      let hash = 0x811c9dc5;
      for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i], 0x01000193) >>> 0;
      joined += `${values.constructor.name}:${values.byteLength}:${hash.toString(16).padStart(8, '0')}|`;
    }
    return joined;
  }

  static verifyBuffers(surface: CavitySurfaceBuffers): void {
    if (!surface || MarchingCubesExtractor._bufferDigest(surface) !== surface.buffer_digest) {
      throw new Error('Marching Cubes surface buffers changed after extraction');
    }
  }

  static readonly CORNERS = [
    [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
  ];

  static readonly EDGES = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];

  // Corners and perimeter edges are both ordered around each face.
  static readonly FACES = [
    { corners: [0, 1, 2, 3], edges: [0, 1, 2, 3] },
    { corners: [4, 5, 6, 7], edges: [4, 5, 6, 7] },
    { corners: [0, 1, 5, 4], edges: [0, 9, 4, 8] },
    { corners: [3, 2, 6, 7], edges: [2, 10, 6, 11] },
    { corners: [0, 4, 7, 3], edges: [8, 7, 11, 3] },
    { corners: [1, 2, 6, 5], edges: [1, 10, 5, 9] },
  ];

  static _edgeKey(cellX: number, cellY: number, cellZ: number, edgeIndex: number): string {
    const pair = MarchingCubesExtractor.EDGES[edgeIndex];
    const a = MarchingCubesExtractor.CORNERS[pair[0]];
    const b = MarchingCubesExtractor.CORNERS[pair[1]];
    const x = cellX + Math.min(a[0], b[0]);
    const y = cellY + Math.min(a[1], b[1]);
    const z = cellZ + Math.min(a[2], b[2]);
    const axis = a[0] !== b[0] ? 'x' : (a[1] !== b[1] ? 'y' : 'z');
    return `${axis}:${x}:${y}:${z}`;
  }

  static _connect(adjacency: Map<number, number[]>, a: number, b: number): void {
    const aa = adjacency.get(a) || [];
    const bb = adjacency.get(b) || [];
    if (!aa.includes(b)) aa.push(b);
    if (!bb.includes(a)) bb.push(a);
    adjacency.set(a, aa);
    adjacency.set(b, bb);
  }

  static _facePairs(face: any, values: number[], isovalue: number): number[][] {
    const crossed = face.edges.filter((edgeIndex: number) => {
      const pair = MarchingCubesExtractor.EDGES[edgeIndex];
      return (values[pair[0]] > isovalue) !== (values[pair[1]] > isovalue);
    });
    if (crossed.length === 0) return [];
    if (crossed.length === 2) return [[crossed[0], crossed[1]]];
    if (crossed.length !== 4) {
      throw new Error(`invalid Marching Cubes face crossing count: ${crossed.length}`);
    }

    const c = face.corners;
    const f0 = values[c[0]] - isovalue;
    const f1 = values[c[1]] - isovalue;
    const f2 = values[c[2]] - isovalue;
    const f3 = values[c[3]] - isovalue;
    const q = f0 * f2 - f1 * f3;
    // q > 0 means the c0/c2 sign owns the bilinear saddle center, so
    // isolate the opposite c1/c3 corners. Exact ties use the same first
    // pairing on both cells and are therefore deterministic/crack-free.
    if (q >= 0) {
      return [[face.edges[0], face.edges[1]], [face.edges[2], face.edges[3]]];
    }
    return [[face.edges[0], face.edges[3]], [face.edges[1], face.edges[2]]];
  }

  static _surfaceColor(normalY: number): [number, number, number] {
    if (normalY < -Math.SQRT1_2) return [0xA8 / 255, 0x58 / 255, 0x20 / 255];
    if (normalY > Math.SQRT1_2) return [0xE8 / 255, 0x78 / 255, 0x2C / 255];
    return [0xD2 / 255, 0x69 / 255, 0x1E / 255];
  }

  // Quantifies the geometric discrepancy between each planar MC triangle and
  // the trilinearly interpolated field that a 3-D clip texture will sample.
  // This is deliberately named a sampled normal-distance metric, not an exact
  // Hausdorff distance: a finite barycentric lattice cannot certify extrema it
  // did not sample. The receipt records its density so evidence cannot silently
  // overstate what was measured.
  static measureImplicitAgreement(field: CavityScalarField, surface: CavitySurfaceBuffers,
                                  subdivisions = 4): CavitySurfaceAgreementMetrics {
    if (!(field instanceof CavityScalarField)) {
      throw new TypeError('surface agreement requires a CavityScalarField');
    }
    MarchingCubesExtractor.verifyBuffers(surface);
    if (!surface || surface.source_field_signature !== field.sig
        || surface.source_field_snapshot_digest !== field.snapshotDigest
        || surface.sig !== field.surfaceSignature(surface.isovalue)) {
      throw new Error('surface agreement requires a surface extracted from the same field snapshot');
    }
    if (!Number.isInteger(subdivisions) || subdivisions < 1 || subdivisions > 16) {
      throw new RangeError('surface agreement subdivisions must be an integer from 1 through 16');
    }
    const isovalue = Number(surface.isovalue);
    if (!Number.isFinite(isovalue)) throw new TypeError('surface agreement isovalue must be finite');
    const positions = surface.positions;
    const indices = surface.indices;
    const zeroTolerance = Math.max(1e-8, field.spacingMm * 1e-7);
    const maxSearchDistance = field.spacingMm * 1.5;
    const searchSteps = 24;
    let sampleCount = 0;
    let unresolvedSampleCount = 0;
    let maxFieldResidual = 0;
    let maxNormalRootDistanceMm = 0;

    const valueAt = (point: number[]): number =>
      field.sampleWorld(point[0], point[1], point[2]) - isovalue;
    const rootDistance = (point: number[], normal: number[], initialValue: number,
                          direction: number): number => {
      if (Math.abs(initialValue) <= zeroTolerance) return 0;
      let previousDistance = 0;
      let previousValue = initialValue;
      for (let step = 1; step <= searchSteps; step++) {
        const distance = maxSearchDistance * step / searchSteps;
        const probe = [
          point[0] + normal[0] * distance * direction,
          point[1] + normal[1] * distance * direction,
          point[2] + normal[2] * distance * direction,
        ];
        const value = valueAt(probe);
        if (Math.abs(value) <= zeroTolerance) return distance;
        if ((previousValue > 0) !== (value > 0)) {
          let low = previousDistance;
          let high = distance;
          let lowValue = previousValue;
          for (let iteration = 0; iteration < 28; iteration++) {
            const middle = (low + high) * 0.5;
            const middleValue = valueAt([
              point[0] + normal[0] * middle * direction,
              point[1] + normal[1] * middle * direction,
              point[2] + normal[2] * middle * direction,
            ]);
            if (Math.abs(middleValue) <= zeroTolerance) return middle;
            if ((lowValue > 0) === (middleValue > 0)) {
              low = middle;
              lowValue = middleValue;
            } else {
              high = middle;
            }
          }
          return (low + high) * 0.5;
        }
        previousDistance = distance;
        previousValue = value;
      }
      return Infinity;
    };

    for (let offset = 0; offset < indices.length; offset += 3) {
      const ia = indices[offset] * 3;
      const ib = indices[offset + 1] * 3;
      const ic = indices[offset + 2] * 3;
      const a = [positions[ia], positions[ia + 1], positions[ia + 2]];
      const b = [positions[ib], positions[ib + 1], positions[ib + 2]];
      const c = [positions[ic], positions[ic + 1], positions[ic + 2]];
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const normal = [
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0],
      ];
      const length = Math.hypot(normal[0], normal[1], normal[2]);
      if (!(length > 0) || !Number.isFinite(length)) {
        throw new Error(`surface agreement encountered degenerate triangle ${offset / 3}`);
      }
      normal[0] /= length; normal[1] /= length; normal[2] /= length;
      for (let i = 0; i <= subdivisions; i++) {
        for (let j = 0; j <= subdivisions - i; j++) {
          const wa = i / subdivisions;
          const wb = j / subdivisions;
          const wc = 1 - wa - wb;
          const point = [
            a[0] * wa + b[0] * wb + c[0] * wc,
            a[1] * wa + b[1] * wb + c[1] * wc,
            a[2] * wa + b[2] * wb + c[2] * wc,
          ];
          const fieldValue = valueAt(point);
          maxFieldResidual = Math.max(maxFieldResidual, Math.abs(fieldValue));
          const forward = rootDistance(point, normal, fieldValue, 1);
          const backward = rootDistance(point, normal, fieldValue, -1);
          const distance = Math.min(forward, backward);
          sampleCount++;
          if (!Number.isFinite(distance)) {
            unresolvedSampleCount++;
          } else {
            maxNormalRootDistanceMm = Math.max(maxNormalRootDistanceMm, distance);
          }
        }
      }
    }
    return Object.freeze({
      schema: 'cavity-surface-agreement-v1',
      field_signature: field.sig,
      snapshot_digest: field.snapshotDigest,
      surface_signature: surface.sig,
      isovalue,
      barycentric_subdivisions: subdivisions,
      sample_count: sampleCount,
      unresolved_sample_count: unresolvedSampleCount,
      max_field_residual: maxFieldResidual,
      max_normal_root_distance_mm: maxNormalRootDistanceMm,
      max_normal_root_distance_voxels: maxNormalRootDistanceMm / field.spacingMm,
    });
  }

  static extract(field: CavityScalarField, isovalue = 0): CavitySurfaceBuffers {
    if (!(field instanceof CavityScalarField)) {
      throw new TypeError('MarchingCubesExtractor.extract requires a CavityScalarField');
    }
    if (!Number.isFinite(isovalue)) throw new TypeError('Marching Cubes isovalue must be finite');
    const started = CavityScalarField._nowMs();
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const vertexByGridEdge = new Map<string, number>();
    const boundsCenter = [
      (field.bounds.min[0] + field.bounds.max[0]) * 0.5,
      (field.bounds.min[1] + field.bounds.max[1]) * 0.5,
      (field.bounds.min[2] + field.bounds.max[2]) * 0.5,
    ];

    const vertexForEdge = (cellX: number, cellY: number, cellZ: number,
                           edgeIndex: number, cornerValues: number[]): number => {
      const key = MarchingCubesExtractor._edgeKey(cellX, cellY, cellZ, edgeIndex);
      const cached = vertexByGridEdge.get(key);
      if (cached != null) return cached;
      const pair = MarchingCubesExtractor.EDGES[edgeIndex];
      const ca = MarchingCubesExtractor.CORNERS[pair[0]];
      const cb = MarchingCubesExtractor.CORNERS[pair[1]];
      const valueA = cornerValues[pair[0]];
      const valueB = cornerValues[pair[1]];
      const denominator = valueB - valueA;
      if (!Number.isFinite(denominator) || denominator === 0) {
        throw new Error(`invalid Marching Cubes edge interpolation on ${key}`);
      }
      const t = Math.max(0, Math.min(1, (isovalue - valueA) / denominator));
      const gx = cellX + ca[0] + (cb[0] - ca[0]) * t;
      const gy = cellY + ca[1] + (cb[1] - ca[1]) * t;
      const gz = cellZ + ca[2] + (cb[2] - ca[2]) * t;
      const wx = field.origin[0] + gx * field.spacingMm;
      const wy = field.origin[1] + gy * field.spacingMm;
      const wz = field.origin[2] + gz * field.spacingMm;
      if (![wx, wy, wz].every(Number.isFinite)) {
        throw new Error(`non-finite Marching Cubes vertex on ${key}`);
      }
      const gradient = field.gradientWorld(wx, wy, wz);
      let nx = -gradient[0], ny = -gradient[1], nz = -gradient[2];
      const length = Math.hypot(nx, ny, nz);
      // A scalar critical point has no uniquely defined surface normal (for
      // example, the touching point of two tangent equal spheres). Do not use
      // a radial guess: reject this shadow surface until an ambiguity-aware
      // production extractor handles it.
      if (!(length > 1e-12) || !Number.isFinite(length)) {
        throw new Error(`undefined Marching Cubes normal at scalar critical point on ${key}`);
      }
      nx /= length; ny /= length; nz /= length;
      const color = MarchingCubesExtractor._surfaceColor(ny);
      const dx = wx - boundsCenter[0], dy = wy - boundsCenter[1], dz = wz - boundsCenter[2];
      const radius = Math.hypot(dx, dy, dz) || 1;
      let u = Math.atan2(dz, dx) / (2 * Math.PI);
      if (u < 0) u += 1;
      const v = Math.acos(Math.max(-1, Math.min(1, -dy / radius))) / Math.PI;
      const index = positions.length / 3;
      positions.push(wx, wy, wz);
      normals.push(nx, ny, nz);
      colors.push(color[0], color[1], color[2]);
      uvs.push(u, v);
      vertexByGridEdge.set(key, index);
      return index;
    };

    const addTriangle = (a: number, b: number, c: number): void => {
      if (a === b || b === c || c === a) return;
      const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
      const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2];
      const cx = positions[c * 3], cy = positions[c * 3 + 1], cz = positions[c * 3 + 2];
      const abx = bx - ax, aby = by - ay, abz = bz - az;
      const acx = cx - ax, acy = cy - ay, acz = cz - az;
      const crossX = aby * acz - abz * acy;
      const crossY = abz * acx - abx * acz;
      const crossZ = abx * acy - aby * acx;
      const area2 = Math.hypot(crossX, crossY, crossZ);
      if (!(area2 > Math.max(1e-12, field.spacingMm * field.spacingMm * 1e-10))) return;
      const nx = normals[a * 3] + normals[b * 3] + normals[c * 3];
      const ny = normals[a * 3 + 1] + normals[b * 3 + 1] + normals[c * 3 + 1];
      const nz = normals[a * 3 + 2] + normals[b * 3 + 2] + normals[c * 3 + 2];
      if (crossX * nx + crossY * ny + crossZ * nz < 0) indices.push(a, c, b);
      else indices.push(a, b, c);
    };

    for (let z = 0; z < field.sizeZ - 1; z++) {
      for (let y = 0; y < field.sizeY - 1; y++) {
        for (let x = 0; x < field.sizeX - 1; x++) {
          const cornerValues = MarchingCubesExtractor.CORNERS.map((corner) =>
            field.valueAt(x + corner[0], y + corner[1], z + corner[2]));
          let cubeCase = 0;
          for (let corner = 0; corner < 8; corner++) {
            if (cornerValues[corner] > isovalue) cubeCase |= (1 << corner);
          }
          if (cubeCase === 0 || cubeCase === 255) continue;

          const adjacency = new Map<number, number[]>();
          for (const face of MarchingCubesExtractor.FACES) {
            for (const pair of MarchingCubesExtractor._facePairs(face, cornerValues, isovalue)) {
              MarchingCubesExtractor._connect(adjacency, pair[0], pair[1]);
            }
          }
          for (const [edge, neighbors] of adjacency) {
            if (neighbors.length !== 2) {
              throw new Error(`Marching Cubes case ${cubeCase} produced degree ${neighbors.length} at edge ${edge}`);
            }
          }

          const visited = new Set<number>();
          const starts = Array.from(adjacency.keys()).sort((a, b) => a - b);
          for (const start of starts) {
            if (visited.has(start)) continue;
            const loop: number[] = [];
            let previous = -1;
            let current = start;
            for (let guard = 0; guard < 13; guard++) {
              if (current === start && loop.length > 0) break;
              if (visited.has(current)) {
                throw new Error(`Marching Cubes case ${cubeCase} contains a non-cyclic contour`);
              }
              visited.add(current);
              loop.push(current);
              const neighbors = adjacency.get(current)!;
              const next = neighbors[0] === previous ? neighbors[1] : neighbors[0];
              previous = current;
              current = next;
            }
            if (current !== start || loop.length < 3) {
              throw new Error(`Marching Cubes case ${cubeCase} failed to close a face contour`);
            }
            const polygon = loop.map((edge) => vertexForEdge(x, y, z, edge, cornerValues));
            for (let i = 1; i < polygon.length - 1; i++) {
              addTriangle(polygon[0], polygon[i], polygon[i + 1]);
            }
          }
        }
      }
    }

    // A complete rock-negative border promises a closed cavity surface. The
    // face decider prevents inter-cell cracks, but it does not solve every
    // trilinear interior ambiguity. Fail closed if fan triangulation creates
    // a non-2-manifold edge; MC33 remains the promotion path for such cases.
    if (field.hasNegativeBorder(isovalue)) {
      const triangleCount = indices.length / 3;
      const edgeUses = new Map<string, { triangle: number; direction: number }[]>();
      for (let i = 0; i < indices.length; i += 3) {
        const triangle = i / 3;
        const triangleEdges = [
          [indices[i], indices[i + 1]],
          [indices[i + 1], indices[i + 2]],
          [indices[i + 2], indices[i]],
        ];
        for (const [a, b] of triangleEdges) {
          const key = a < b ? `${a}:${b}` : `${b}:${a}`;
          const uses = edgeUses.get(key) || [];
          uses.push({ triangle, direction: a < b ? 1 : -1 });
          edgeUses.set(key, uses);
        }
      }
      const neighbors: { triangle: number; invert: boolean }[][] =
        Array.from({ length: triangleCount }, () => []);
      for (const [key, uses] of edgeUses) {
        if (uses.length !== 2) {
          throw new Error(`non-manifold Marching Cubes surface edge ${key} has ${uses.length} incident triangles`);
        }
        const invert = uses[0].direction === uses[1].direction;
        neighbors[uses[0].triangle].push({ triangle: uses[1].triangle, invert });
        neighbors[uses[1].triangle].push({ triangle: uses[0].triangle, invert });
      }

      // Propagate one consistent winding across each connected component.
      // A shared edge must be traversed in opposite directions by its two
      // triangles. Then choose the component's global direction from the
      // scalar-gradient normals so THREE.BackSide renders the void-facing side.
      const flips = new Int8Array(triangleCount);
      flips.fill(-1);
      const components: number[][] = [];
      for (let start = 0; start < triangleCount; start++) {
        if (flips[start] !== -1) continue;
        flips[start] = 0;
        const component: number[] = [];
        const queue = [start];
        while (queue.length) {
          const triangle = queue.pop()!;
          component.push(triangle);
          for (const neighbor of neighbors[triangle]) {
            const required = flips[triangle] ^ (neighbor.invert ? 1 : 0);
            if (flips[neighbor.triangle] === -1) {
              flips[neighbor.triangle] = required;
              queue.push(neighbor.triangle);
            } else if (flips[neighbor.triangle] !== required) {
              throw new Error('non-orientable Marching Cubes surface component');
            }
          }
        }
        components.push(component);
      }
      const flipTriangle = (triangle: number): void => {
        const offset = triangle * 3;
        const swap = indices[offset + 1];
        indices[offset + 1] = indices[offset + 2];
        indices[offset + 2] = swap;
      };
      for (let triangle = 0; triangle < triangleCount; triangle++) {
        if (flips[triangle] === 1) flipTriangle(triangle);
      }
      for (const component of components) {
        let outwardScore = 0;
        for (const triangle of component) {
          const offset = triangle * 3;
          const a = indices[offset], b = indices[offset + 1], c = indices[offset + 2];
          const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
          const abx = positions[b * 3] - ax;
          const aby = positions[b * 3 + 1] - ay;
          const abz = positions[b * 3 + 2] - az;
          const acx = positions[c * 3] - ax;
          const acy = positions[c * 3 + 1] - ay;
          const acz = positions[c * 3 + 2] - az;
          const crossX = aby * acz - abz * acy;
          const crossY = abz * acx - abx * acz;
          const crossZ = abx * acy - aby * acx;
          const nx = normals[a * 3] + normals[b * 3] + normals[c * 3];
          const ny = normals[a * 3 + 1] + normals[b * 3 + 1] + normals[c * 3 + 1];
          const nz = normals[a * 3 + 2] + normals[b * 3 + 2] + normals[c * 3 + 2];
          outwardScore += crossX * nx + crossY * ny + crossZ * nz;
        }
        if (!Number.isFinite(outwardScore) || Math.abs(outwardScore) <= 1e-12) {
          throw new Error('undefined Marching Cubes component orientation');
        }
        if (outwardScore < 0) {
          for (const triangle of component) flipTriangle(triangle);
        }
      }

      // Edge-consistent winding is necessary but not sufficient: a fan can be
      // geometrically folded across an interior ambiguity. Verify every face
      // against the scalar oracle. With outward winding (void -> rock), a
      // small step along the face normal must decrease the positive-void field
      // relative to the equal step toward the void. If not, the table-free
      // prototype cannot represent this cell safely and the renderer falls
      // back to WallMesh rather than exposing a BackSide-culling hole.
      const probeDistance = field.spacingMm * 0.05;
      const directionTolerance = Math.max(1e-12, field.spacingMm * 1e-9);
      for (let triangle = 0; triangle < triangleCount; triangle++) {
        const offset = triangle * 3;
        const a = indices[offset], b = indices[offset + 1], c = indices[offset + 2];
        const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
        const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2];
        const cx = positions[c * 3], cy = positions[c * 3 + 1], cz = positions[c * 3 + 2];
        const abx = bx - ax, aby = by - ay, abz = bz - az;
        const acx = cx - ax, acy = cy - ay, acz = cz - az;
        let nx = aby * acz - abz * acy;
        let ny = abz * acx - abx * acz;
        let nz = abx * acy - aby * acx;
        const normalLength = Math.hypot(nx, ny, nz);
        if (!(normalLength > 0) || !Number.isFinite(normalLength)) {
          throw new Error(`invalid Marching Cubes face normal at triangle ${triangle}`);
        }
        nx /= normalLength; ny /= normalLength; nz /= normalLength;
        const localNormalDot = nx * (normals[a * 3] + normals[b * 3] + normals[c * 3])
          + ny * (normals[a * 3 + 1] + normals[b * 3 + 1] + normals[c * 3 + 1])
          + nz * (normals[a * 3 + 2] + normals[b * 3 + 2] + normals[c * 3 + 2]);
        if (!Number.isFinite(localNormalDot) || !(localNormalDot > 1e-8)) {
          throw new Error(`unresolved interior ambiguity folds Marching Cubes triangle ${triangle}`);
        }
        const centerX = (ax + bx + cx) / 3;
        const centerY = (ay + by + cy) / 3;
        const centerZ = (az + bz + cz) / 3;
        const rockSide = field.sampleWorld(
          centerX + nx * probeDistance,
          centerY + ny * probeDistance,
          centerZ + nz * probeDistance,
        );
        const voidSide = field.sampleWorld(
          centerX - nx * probeDistance,
          centerY - ny * probeDistance,
          centerZ - nz * probeDistance,
        );
        if (!Number.isFinite(rockSide) || !Number.isFinite(voidSide)
            || !(rockSide < voidSide - directionTolerance)) {
          throw new Error(`unresolved interior ambiguity folds Marching Cubes triangle ${triangle}`);
        }
      }
    }

    const positionBuffer = new Float32Array(positions);
    const normalBuffer = new Float32Array(normals);
    const colorBuffer = new Float32Array(colors);
    const uvBuffer = new Float32Array(uvs);
    const indexBuffer = positionBuffer.length / 3 > 65535
      ? new Uint32Array(indices)
      : new Uint16Array(indices);
    const extractionMs = CavityScalarField._nowMs() - started;
    const surfaceBytes = positionBuffer.byteLength + normalBuffer.byteLength
      + colorBuffer.byteLength + uvBuffer.byteLength + indexBuffer.byteLength;
    const result: any = {
      positions: positionBuffer,
      normals: normalBuffer,
      colors: colorBuffer,
      indices: indexBuffer,
      uvs: uvBuffer,
      sig: field.surfaceSignature(isovalue),
      source_field_signature: field.sig,
      source_field_snapshot_digest: field.snapshotDigest,
      isovalue,
      bounds: Object.freeze({
        min: Object.freeze(field.bounds.min.slice()) as any,
        max: Object.freeze(field.bounds.max.slice()) as any,
      }),
      metrics: Object.freeze({
        field_build_ms: field.metrics.field_build_ms || 0,
        extraction_ms: extractionMs,
        triangle_count: indexBuffer.length / 3,
        vertex_count: positionBuffer.length / 3,
        field_bytes: field.sampleByteLength(),
        surface_bytes: surfaceBytes,
      }),
    };
    result.buffer_digest = MarchingCubesExtractor._bufferDigest(result);
    return Object.freeze(result);
  }
}
