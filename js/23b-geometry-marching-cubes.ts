// ============================================================
// js/23b-geometry-marching-cubes.ts — indexed cavity extraction
// ============================================================
// A deterministic, indexed Cartesian isosurface extractor. Every cube uses the
// same Freudenthal/Kuhn six-tetrahedron decomposition around its 0->6 body
// diagonal. The induced diagonal on each shared cube face is therefore exactly
// the same in both neighboring cubes. Tetrahedra have no face or interior
// topology ambiguity, so this construction is closed and crack-free without a
// 256-row case table or the unresolved MC33 cases in the former prototype.

const CAVITY_SURFACE_ANCHOR_ACCESS = Object.freeze({});
let cavitySurfaceAnchorTopologyInternal: (surface: CavitySurfaceBuffers) => any;

class MarchingCubesExtractor {
  // TypedArray payloads cannot be frozen in JavaScript. Keep their owned targets
  // private and expose read-only proxies: numeric writes and mutating methods
  // throw, while `.buffer` returns a copy rather than a writable alias. The one
  // complete digest is therefore authenticated at the immutable extraction
  // boundary; later verification is O(1) object identity.
  static #verifiedBuffers: WeakMap<object, any> = new WeakMap();
  static #readonlyTargets: WeakMap<object, any> = new WeakMap();
  static #readonlyProxies: WeakMap<object, any> = new WeakMap();
  static #anchorTopology: WeakMap<object, any> = new WeakMap();
  static #typedArrayPrototype: any = Object.getPrototypeOf(Float32Array.prototype);
  static #typedArraySlice: any = MarchingCubesExtractor.#typedArrayPrototype.slice;
  static #callbackMethods: Map<string, any> = new Map(
    ['every', 'filter', 'find', 'findIndex', 'findLast', 'findLastIndex', 'forEach',
      'map', 'reduce', 'reduceRight', 'some'].map(name =>
      [name, MarchingCubesExtractor.#typedArrayPrototype[name]]),
  );
  static #iteratorMethods: Map<PropertyKey, any> = new Map<PropertyKey, any>([
    [Symbol.iterator, MarchingCubesExtractor.#typedArrayPrototype.values],
    ['entries', MarchingCubesExtractor.#typedArrayPrototype.entries],
    ['keys', MarchingCubesExtractor.#typedArrayPrototype.keys],
    ['values', MarchingCubesExtractor.#typedArrayPrototype.values],
  ]);
  static #copyMethods: Map<string, any> = new Map(
    ['at', 'includes', 'indexOf', 'lastIndexOf', 'join', 'toLocaleString', 'toString']
      .map(name => [name, MarchingCubesExtractor.#typedArrayPrototype[name]]),
  );

  static #rawBuffer(values: any): any {
    return MarchingCubesExtractor.#readonlyTargets.get(values) || values;
  }

  static #readonlyBuffer(values: any): any {
    const existing = MarchingCubesExtractor.#readonlyProxies.get(values);
    if (existing) return existing;
    const mutators = new Set(['copyWithin', 'fill', 'reverse', 'set', 'sort']);
    const typedArrayConstructor = values.constructor;
    const copy = (start?: number, end?: number) => Reflect.apply(
      MarchingCubesExtractor.#typedArraySlice, values,
      start == null ? [] : end == null ? [start] : [start, end],
    );
    let proxy: any;
    proxy = new Proxy(values, {
      get(target, property) {
        if (typeof property === 'string' && /^(0|[1-9]\d*)$/.test(property)) {
          return target[Number(property)];
        }
        if (property === 'buffer') {
          return target.buffer.slice(target.byteOffset, target.byteOffset + target.byteLength);
        }
        if (property === 'byteOffset') return 0;
        if (property === 'byteLength' || property === 'length') return target[property];
        if (property === Symbol.toStringTag) return target.constructor.name;
        if (property === 'valueOf') return () => proxy;
        if (property === 'constructor') return typedArrayConstructor;
        if (property === 'subarray') return (start?: number, end?: number) =>
          MarchingCubesExtractor.#readonlyBuffer(copy(start, end));
        if (mutators.has(String(property))) return () => {
          throw new TypeError('Marching Cubes surface buffers are immutable');
        };
        const iteratorMethod = MarchingCubesExtractor.#iteratorMethods.get(property);
        if (iteratorMethod) {
          return (...args: any[]) => Reflect.apply(iteratorMethod, target, args);
        }
        // Callback-bearing TypedArray methods pass their receiver as an
        // argument. Execute them on a copy so callbacks cannot capture the
        // private authoritative target through that argument.
        const callbackMethod = MarchingCubesExtractor.#callbackMethods.get(String(property));
        if (callbackMethod) {
          return (...args: any[]) => Reflect.apply(callbackMethod, copy(), args);
        }
        if (property === 'slice') return copy;
        const copyMethod = MarchingCubesExtractor.#copyMethods.get(String(property));
        if (copyMethod) {
          return (...args: any[]) => Reflect.apply(copyMethod, copy(), args);
        }
        // Do not Reflect.get arbitrary properties with the authoritative typed
        // array as receiver. A caller-controlled prototype getter could return
        // `this.buffer` and escape the raw storage without crossing a proxy trap.
        return undefined;
      },
      set() { throw new TypeError('Marching Cubes surface buffers are immutable'); },
      defineProperty() { throw new TypeError('Marching Cubes surface buffers are immutable'); },
      deleteProperty() { throw new TypeError('Marching Cubes surface buffers are immutable'); },
      setPrototypeOf() { throw new TypeError('Marching Cubes surface buffers are immutable'); },
      preventExtensions() { throw new TypeError('Marching Cubes surface buffers are immutable'); },
    });
    MarchingCubesExtractor.#readonlyTargets.set(proxy, values);
    MarchingCubesExtractor.#readonlyProxies.set(values, proxy);
    return proxy;
  }

  static _bufferDigest(surface: any): string {
    const arrays = [surface && surface.positions, surface && surface.normals,
      surface && surface.colors, surface && surface.uvs, surface && surface.indices];
    let joined = 'cavity-surface-buffers-v2|';
    for (const values of arrays) {
      const raw = MarchingCubesExtractor.#rawBuffer(values);
      if (!raw || !ArrayBuffer.isView(raw)) throw new TypeError('surface buffer is unavailable');
      const bytes = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
      let hashA = 0x811c9dc5;
      let hashB = 0x9e3779b9;
      let offset = 0;
      for (; offset + 4 <= bytes.length; offset += 4) {
        const word = (bytes[offset]
          | (bytes[offset + 1] << 8)
          | (bytes[offset + 2] << 16)
          | (bytes[offset + 3] << 24)) >>> 0;
        hashA = Math.imul(hashA ^ word, 0x01000193) >>> 0;
        hashB = (Math.imul(hashB ^ word, 0x85ebca6b) + 0x27d4eb2f) >>> 0;
      }
      let tail = 0;
      for (let shift = 0; offset < bytes.length; offset++, shift += 8) {
        tail |= bytes[offset] << shift;
      }
      if (bytes.length & 3) {
        hashA = Math.imul(hashA ^ tail, 0x01000193) >>> 0;
        hashB = (Math.imul(hashB ^ tail, 0x85ebca6b) + 0x27d4eb2f) >>> 0;
      }
      joined += `${raw.constructor.name}:${raw.byteLength}:`
        + `${hashA.toString(16).padStart(8, '0')}${hashB.toString(16).padStart(8, '0')}|`;
    }
    return joined;
  }

  static verifyBuffers(surface: CavitySurfaceBuffers): void {
    if (!surface) throw new Error('Marching Cubes surface buffers changed after extraction');
    const trusted = MarchingCubesExtractor.#verifiedBuffers.get(surface as any);
    const buffers = [surface.positions, surface.normals, surface.colors, surface.uvs, surface.indices];
    const immutableOwned = buffers.every((values: any) =>
      MarchingCubesExtractor.#readonlyTargets.has(values));
    if (trusted && immutableOwned && trusted.digest === surface.buffer_digest
        && buffers.every((values: any, index: number) => values === trusted.buffers[index])) return;
    if (MarchingCubesExtractor._bufferDigest(surface) !== surface.buffer_digest) {
      throw new Error('Marching Cubes surface buffers changed after extraction');
    }
    if (immutableOwned) {
      MarchingCubesExtractor.#verifiedBuffers.set(surface as any, {
        digest: surface.buffer_digest,
        buffers,
      });
    }
  }

  static _anchorTopologyData(surface: CavitySurfaceBuffers, access: any): any {
    if (access !== CAVITY_SURFACE_ANCHOR_ACCESS) {
      throw new TypeError('Cartesian surface adjacency is private to authenticated anchors');
    }
    MarchingCubesExtractor.verifyBuffers(surface);
    const topology = MarchingCubesExtractor.#anchorTopology.get(surface as any);
    if (!topology) throw new Error('Cartesian surface adjacency is unavailable');
    return topology;
  }

  // Exact enclosed volume of the authenticated indexed surface.  This is the
  // same oriented-tetrahedron integral used by WallMesh, applied to the actual
  // Cartesian extraction that clipping, anchors, replay, and rendering consume.
  // Keeping the calculation here prevents a future promotion from conserving a
  // different shell than the one shown to the player.
  static closedVolumeMm3(surface: CavitySurfaceBuffers): number {
    MarchingCubesExtractor.verifyBuffers(surface);
    const positions = surface.positions;
    const indices = surface.indices;
    let signedSixVolume = 0;
    for (let offset = 0; offset + 2 < indices.length; offset += 3) {
      const ia = indices[offset] * 3;
      const ib = indices[offset + 1] * 3;
      const ic = indices[offset + 2] * 3;
      const ax = positions[ia], ay = positions[ia + 1], az = positions[ia + 2];
      const bx = positions[ib], by = positions[ib + 1], bz = positions[ib + 2];
      const cx = positions[ic], cy = positions[ic + 1], cz = positions[ic + 2];
      signedSixVolume += ax * (by * cz - bz * cy)
        + ay * (bz * cx - bx * cz)
        + az * (bx * cy - by * cx);
    }
    const volume = Math.abs(signedSixVolume) / 6;
    if (!(volume > 0) || !Number.isFinite(volume)) {
      throw new RangeError('Marching Cubes surface volume is non-positive or non-finite');
    }
    return volume;
  }

  static surfaceAreaMm2(surface: CavitySurfaceBuffers): number {
    MarchingCubesExtractor.verifyBuffers(surface);
    const positions = surface.positions;
    const indices = surface.indices;
    let area = 0;
    for (let offset = 0; offset + 2 < indices.length; offset += 3) {
      const ia = indices[offset] * 3;
      const ib = indices[offset + 1] * 3;
      const ic = indices[offset + 2] * 3;
      const abx = positions[ib] - positions[ia];
      const aby = positions[ib + 1] - positions[ia + 1];
      const abz = positions[ib + 2] - positions[ia + 2];
      const acx = positions[ic] - positions[ia];
      const acy = positions[ic + 1] - positions[ia + 1];
      const acz = positions[ic + 2] - positions[ia + 2];
      area += 0.5 * Math.hypot(
        aby * acz - abz * acy,
        abz * acx - abx * acz,
        abx * acy - aby * acx,
      );
    }
    if (!(area > 0) || !Number.isFinite(area)) {
      throw new RangeError('Marching Cubes surface area is non-positive or non-finite');
    }
    return area;
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

  // Globally compatible Freudenthal triangulation of a Cartesian cube. The
  // ordering is cyclic around the 0->6 body diagonal; neighboring cubes induce
  // identical diagonals on their common x, y, and z faces.
  static readonly TETRAHEDRA = [
    [0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6],
    [0, 7, 4, 6], [0, 4, 5, 6], [0, 5, 1, 6],
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

  // Quantifies the geometric discrepancy between each planar extracted
  // triangle and the same Freudenthal piecewise-linear field used for clipping.
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
    // Positions are intentionally Float32 because these exact bytes feed the
    // renderer, replay, and receipts. Re-sampling rounded world coordinates can
    // leave a few scalar micrometres of residual even when the unrounded
    // tetrahedral point is algebraically on the zero plane.
    const zeroTolerance = Math.max(1e-6, field.spacingMm * 2e-5);
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
      numerical_zero_tolerance: zeroTolerance,
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
    const gridVertexCount = field.sizeX * field.sizeY * field.sizeZ;
    let positions = new Float64Array(gridVertexCount);
    let uvs = new Float32Array(gridVertexCount);
    let indices = new Uint32Array(gridVertexCount);
    let positionLength = 0;
    let uvLength = 0;
    let indexLength = 0;
    const growFloat64 = (values: any, required: number): any => {
      if (required <= values.length) return values;
      const grown = new Float64Array(Math.max(required, values.length * 2));
      grown.set(values);
      return grown;
    };
    const growFloat32 = (values: any, required: number): any => {
      if (required <= values.length) return values;
      const grown = new Float32Array(Math.max(required, values.length * 2));
      grown.set(values);
      return grown;
    };
    const growUint32 = (values: any, required: number): any => {
      if (required <= values.length) return values;
      const grown = new Uint32Array(Math.max(required, values.length * 2));
      grown.set(values);
      return grown;
    };
    const vertexByGridEdge = new Map<number, number>();
    const fieldValues = cavityFieldExtractorValuesInternal(field);
    const strideY = field.sizeX;
    const strideZ = field.sizeX * field.sizeY;
    // Reused scratch removes millions of tiny arrays/closures from a 64^3
    // extraction while preserving the exact tetrahedron and corner order.
    const cornerValues = new Float64Array(8);
    const insideCorners = new Int8Array(4);
    const outsideCorners = new Int8Array(4);
    const boundsCenter = [
      (field.bounds.min[0] + field.bounds.max[0]) * 0.5,
      (field.bounds.min[1] + field.bounds.max[1]) * 0.5,
      (field.bounds.min[2] + field.bounds.max[2]) * 0.5,
    ];

    const vertexForSegment = (cellX: number, cellY: number, cellZ: number,
                              cornerA: number, cornerB: number,
                              cornerValues: number[]): number => {
      const ca = MarchingCubesExtractor.CORNERS[cornerA];
      const cb = MarchingCubesExtractor.CORNERS[cornerB];
      const ax = cellX + ca[0], ay = cellY + ca[1], az = cellZ + ca[2];
      const bx = cellX + cb[0], by = cellY + cb[1], bz = cellZ + cb[2];
      const gridA = field.index(ax, ay, az);
      const gridB = field.index(bx, by, bz);
      const valueA = cornerValues[cornerA];
      const valueB = cornerValues[cornerB];
      // A root exactly on a grid sample belongs to every incident segment.
      // Canonicalize that endpoint as one vertex rather than minting duplicate
      // segment vertices that would make an otherwise closed surface non-manifold.
      const endpointRoot = valueA === isovalue ? gridA : valueB === isovalue ? gridB : -1;
      const lowGrid = Math.min(gridA, gridB);
      const highGrid = Math.max(gridA, gridB);
      const key = endpointRoot >= 0 ? endpointRoot
        : gridVertexCount + lowGrid * gridVertexCount + highGrid;
      const cached = vertexByGridEdge.get(key);
      if (cached != null) return cached;
      const denominator = valueB - valueA;
      if (!Number.isFinite(denominator) || denominator === 0) {
        throw new Error(`invalid Cartesian isosurface interpolation on ${key}`);
      }
      const t = endpointRoot === gridA ? 0 : endpointRoot === gridB ? 1
        : Math.max(0, Math.min(1, (isovalue - valueA) / denominator));
      // Every segment is an edge of one Freudenthal tetrahedron. The field is
      // linear on that tetrahedron, so this secant is the authoritative root.
      const gx = cellX + ca[0] + (cb[0] - ca[0]) * t;
      const gy = cellY + ca[1] + (cb[1] - ca[1]) * t;
      const gz = cellZ + ca[2] + (cb[2] - ca[2]) * t;
      const wx = field.origin[0] + gx * field.spacingMm;
      const wy = field.origin[1] + gy * field.spacingMm;
      const wz = field.origin[2] + gz * field.spacingMm;
      if (![wx, wy, wz].every(Number.isFinite)) {
        throw new Error(`non-finite Cartesian isosurface vertex on ${key}`);
      }
      const dx = wx - boundsCenter[0], dy = wy - boundsCenter[1], dz = wz - boundsCenter[2];
      const radius = Math.hypot(dx, dy, dz) || 1;
      let u = Math.atan2(dz, dx) / (2 * Math.PI);
      if (u < 0) u += 1;
      const v = Math.acos(Math.max(-1, Math.min(1, -dy / radius))) / Math.PI;
      const index = positionLength / 3;
      positions = growFloat64(positions, positionLength + 3);
      positions[positionLength++] = wx;
      positions[positionLength++] = wy;
      positions[positionLength++] = wz;
      uvs = growFloat32(uvs, uvLength + 2);
      uvs[uvLength++] = u;
      uvs[uvLength++] = v;
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
      // Very small triangles near a symbolically perturbed zero-grid sample
      // remain topologically necessary. An absolute 1e-12/relative 1e-10 cut
      // opened pinholes at large world scales. Reject only facets that are
      // indistinguishable from zero at double precision; Float32 collapse is
      // independently caught by the final face and manifold verification.
      if (!(area2 > Number.EPSILON * field.spacingMm * field.spacingMm * 64)) return;
      indices = growUint32(indices, indexLength + 3);
      indices[indexLength++] = a;
      indices[indexLength++] = b;
      indices[indexLength++] = c;
    };

    for (let z = 0; z < field.sizeZ - 1; z++) {
      const zBase = z * strideZ;
      for (let y = 0; y < field.sizeY - 1; y++) {
        let base = zBase + y * strideY;
        for (let x = 0; x < field.sizeX - 1; x++, base++) {
          cornerValues[0] = fieldValues[base];
          cornerValues[1] = fieldValues[base + 1];
          cornerValues[2] = fieldValues[base + strideY + 1];
          cornerValues[3] = fieldValues[base + strideY];
          cornerValues[4] = fieldValues[base + strideZ];
          cornerValues[5] = fieldValues[base + strideZ + 1];
          cornerValues[6] = fieldValues[base + strideZ + strideY + 1];
          cornerValues[7] = fieldValues[base + strideZ + strideY];
          // Simulation of simplicity classifies an exact isovalue sample as
          // positive in every incident tetrahedron. Geometry still uses the
          // original canonical Float32 value below.
          let cubeMask = 0;
          for (let corner = 0; corner < 8; corner++) {
            if (cornerValues[corner] >= isovalue) cubeMask |= 1 << corner;
          }
          if (cubeMask === 0 || cubeMask === 255) continue;

          for (let tetraIndex = 0; tetraIndex < MarchingCubesExtractor.TETRAHEDRA.length;
              tetraIndex++) {
            const tetrahedron = MarchingCubesExtractor.TETRAHEDRA[tetraIndex];
            let insideCount = 0;
            let outsideCount = 0;
            for (let tetraCorner = 0; tetraCorner < 4; tetraCorner++) {
              const corner = tetrahedron[tetraCorner];
              if (cubeMask & (1 << corner)) insideCorners[insideCount++] = corner;
              else outsideCorners[outsideCount++] = corner;
            }
            if (insideCount === 0 || insideCount === 4) continue;
            if (insideCount === 1) {
              const center = insideCorners[0];
              addTriangle(
                vertexForSegment(x, y, z, center, outsideCorners[0], cornerValues as any),
                vertexForSegment(x, y, z, center, outsideCorners[1], cornerValues as any),
                vertexForSegment(x, y, z, center, outsideCorners[2], cornerValues as any),
              );
            } else if (insideCount === 3) {
              const center = outsideCorners[0];
              addTriangle(
                vertexForSegment(x, y, z, center, insideCorners[0], cornerValues as any),
                vertexForSegment(x, y, z, center, insideCorners[1], cornerValues as any),
                vertexForSegment(x, y, z, center, insideCorners[2], cornerValues as any),
              );
            } else {
              // The four cut edges form the cycle a-b-d-c. They are coplanar in
              // the shared piecewise-linear field; stable a-d splitting is
              // deterministic and requires no scalar or gradient probe.
              const a = vertexForSegment(
                x, y, z, insideCorners[0], outsideCorners[0], cornerValues as any,
              );
              const b = vertexForSegment(
                x, y, z, insideCorners[0], outsideCorners[1], cornerValues as any,
              );
              const c = vertexForSegment(
                x, y, z, insideCorners[1], outsideCorners[0], cornerValues as any,
              );
              const d = vertexForSegment(
                x, y, z, insideCorners[1], outsideCorners[1], cornerValues as any,
              );
              addTriangle(a, b, d);
              addTriangle(a, d, c);
            }
          }
        }
      }
    }
    const polygonizeMs = CavityScalarField._nowMs() - started;
    const manifoldStarted = CavityScalarField._nowMs();
    let authenticatedNeighborTriangles: Int32Array | null = null;
    let authenticatedNeighborCounts: Uint8Array | null = null;

    // A complete rock-negative border promises a closed cavity surface. Verify
    // the promise independently of the extractor construction and fail closed
    // on any future regression in face compatibility or tetra triangulation.
    if (field.hasNegativeBorder(isovalue)) {
      const triangleCount = indexLength / 3;
      const vertexCount = positionLength / 3;
      if (vertexCount * vertexCount > Number.MAX_SAFE_INTEGER) {
        throw new RangeError('Cartesian surface is too large for exact numeric edge authentication');
      }
      // First edge use is encoded as signed (triangle+1); zero means the edge
      // already received its required second use. Every manifold triangle has
      // exactly three fixed neighbor slots, avoiding per-edge strings, arrays,
      // and objects in this hot verification pass.
      const edgeUses = new Map<number, number>();
      const neighborTriangles = new Int32Array(triangleCount * 3);
      neighborTriangles.fill(-1);
      const neighborInverts = new Uint8Array(triangleCount * 3);
      const neighborCounts = new Uint8Array(triangleCount);
      const connect = (a: number, b: number, invert: boolean): void => {
        const aSlot = neighborCounts[a]++;
        const bSlot = neighborCounts[b]++;
        if (aSlot >= 3 || bSlot >= 3) {
          throw new Error('non-manifold Cartesian surface triangle has more than three neighbors');
        }
        neighborTriangles[a * 3 + aSlot] = b;
        neighborTriangles[b * 3 + bSlot] = a;
        neighborInverts[a * 3 + aSlot] = invert ? 1 : 0;
        neighborInverts[b * 3 + bSlot] = invert ? 1 : 0;
      };
      for (let i = 0; i < indexLength; i += 3) {
        const triangle = i / 3;
        for (let edge = 0; edge < 3; edge++) {
          const a = indices[i + edge];
          const b = indices[i + ((edge + 1) % 3)];
          const low = Math.min(a, b), high = Math.max(a, b);
          const key = low * vertexCount + high;
          const direction = a < b ? 1 : -1;
          const prior = edgeUses.get(key);
          if (prior == null) {
            edgeUses.set(key, direction * (triangle + 1));
          } else if (prior === 0) {
            throw new Error(`non-manifold Cartesian surface edge ${low}:${high} has more than two incident triangles`);
          } else {
            const priorTriangle = Math.abs(prior) - 1;
            const priorDirection = prior > 0 ? 1 : -1;
            connect(priorTriangle, triangle, priorDirection === direction);
            edgeUses.set(key, 0);
          }
        }
      }
      for (const [key, use] of edgeUses) {
        if (use !== 0) {
          const low = Math.floor(key / vertexCount), high = key % vertexCount;
          throw new Error(`non-manifold Cartesian surface edge ${low}:${high} has one incident triangle`);
        }
      }

      // Propagate one consistent winding across each connected component.
      // A shared edge must be traversed in opposite directions by its two
      // triangles. Then choose the component's global direction from its signed
      // enclosed volume so THREE.BackSide renders the void-facing side.
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
          const base = triangle * 3;
          for (let slot = 0; slot < neighborCounts[triangle]; slot++) {
            const neighbor = neighborTriangles[base + slot];
            const required = flips[triangle] ^ neighborInverts[base + slot];
            if (flips[neighbor] === -1) {
              flips[neighbor] = required;
              queue.push(neighbor);
            } else if (flips[neighbor] !== required) {
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
        let signedSixVolume = 0;
        for (const triangle of component) {
          const offset = triangle * 3;
          const a = indices[offset], b = indices[offset + 1], c = indices[offset + 2];
          const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
          const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2];
          const cx = positions[c * 3], cy = positions[c * 3 + 1], cz = positions[c * 3 + 2];
          signedSixVolume += ax * (by * cz - bz * cy)
            + ay * (bz * cx - bx * cz)
            + az * (bx * cy - by * cx);
        }
        if (!Number.isFinite(signedSixVolume) || Math.abs(signedSixVolume) <= 1e-12) {
          throw new Error('undefined Marching Cubes component orientation');
        }
        if (signedSixVolume < 0) {
          for (const triangle of component) flipTriangle(triangle);
        }
      }
      authenticatedNeighborTriangles = neighborTriangles;
      authenticatedNeighborCounts = neighborCounts;
    }
    const manifoldMs = CavityScalarField._nowMs() - manifoldStarted;
    const normalMaterialStarted = CavityScalarField._nowMs();

    // One topology-derived smooth-normal pass after final winding. This is
    // equivalent to standard indexed-mesh normal generation and avoids six
    // scalar samples per vertex plus multiple field probes per triangle.
    const normals = new Float64Array(positionLength);
    const colors = new Float64Array(positionLength);
    for (let offset = 0; offset < indexLength; offset += 3) {
      const a = indices[offset], b = indices[offset + 1], c = indices[offset + 2];
      const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
      const abx = positions[b * 3] - ax;
      const aby = positions[b * 3 + 1] - ay;
      const abz = positions[b * 3 + 2] - az;
      const acx = positions[c * 3] - ax;
      const acy = positions[c * 3 + 1] - ay;
      const acz = positions[c * 3 + 2] - az;
      const nx = aby * acz - abz * acy;
      const ny = abz * acx - abx * acz;
      const nz = abx * acy - aby * acx;
      for (const vertex of [a, b, c]) {
        normals[vertex * 3] += nx;
        normals[vertex * 3 + 1] += ny;
        normals[vertex * 3 + 2] += nz;
      }
    }
    for (let vertex = 0; vertex < positionLength / 3; vertex++) {
      const offset = vertex * 3;
      const length = Math.hypot(normals[offset], normals[offset + 1], normals[offset + 2]);
      if (!(length > 1e-12) || !Number.isFinite(length)) {
        throw new Error(`undefined Cartesian isosurface normal at vertex ${vertex}`);
      }
      normals[offset] /= length;
      normals[offset + 1] /= length;
      normals[offset + 2] /= length;
      const color = MarchingCubesExtractor._surfaceColor(normals[offset + 1]);
      colors[offset] = color[0]; colors[offset + 1] = color[1]; colors[offset + 2] = color[2];
    }
    const normalMaterialMs = CavityScalarField._nowMs() - normalMaterialStarted;
    const packingAuthenticationStarted = CavityScalarField._nowMs();

    const positionBuffer = new Float32Array(positions.subarray(0, positionLength));
    const normalBuffer = new Float32Array(normals);
    const colorBuffer = new Float32Array(colors);
    const uvBuffer = uvs.slice(0, uvLength);
    const indexBuffer = positionBuffer.length / 3 > 65535
      ? indices.slice(0, indexLength)
      : new Uint16Array(indices.subarray(0, indexLength));
    const packingMs = CavityScalarField._nowMs() - packingAuthenticationStarted;
    const bufferAuthenticationStarted = CavityScalarField._nowMs();
    const surfaceBytes = positionBuffer.byteLength + normalBuffer.byteLength
      + colorBuffer.byteLength + uvBuffer.byteLength + indexBuffer.byteLength;
    const readonlyBuffers = {
      positions: MarchingCubesExtractor.#readonlyBuffer(positionBuffer),
      normals: MarchingCubesExtractor.#readonlyBuffer(normalBuffer),
      colors: MarchingCubesExtractor.#readonlyBuffer(colorBuffer),
      indices: MarchingCubesExtractor.#readonlyBuffer(indexBuffer),
      uvs: MarchingCubesExtractor.#readonlyBuffer(uvBuffer),
    };
    const bufferDigest = MarchingCubesExtractor._bufferDigest(readonlyBuffers);
    const bufferAuthenticationMs = CavityScalarField._nowMs() - bufferAuthenticationStarted;
    const packingAuthenticationMs = CavityScalarField._nowMs() - packingAuthenticationStarted;
    const extractionMs = CavityScalarField._nowMs() - started;
    const result: any = {
      ...readonlyBuffers,
      sig: field.surfaceSignature(isovalue),
      source_field_signature: field.sig,
      source_field_snapshot_digest: field.snapshotDigest,
      buffer_digest: bufferDigest,
      isovalue,
      bounds: Object.freeze({
        min: Object.freeze(field.bounds.min.slice()) as any,
        max: Object.freeze(field.bounds.max.slice()) as any,
      }),
      metrics: Object.freeze({
        field_build_ms: field.metrics.field_build_ms || 0,
        extraction_ms: extractionMs,
        polygonize_ms: polygonizeMs,
        manifold_ms: manifoldMs,
        normal_material_ms: normalMaterialMs,
        packing_authentication_ms: packingAuthenticationMs,
        packing_ms: packingMs,
        buffer_authentication_ms: bufferAuthenticationMs,
        triangle_count: indexBuffer.length / 3,
        vertex_count: positionBuffer.length / 3,
        field_bytes: field.sampleByteLength(),
        surface_bytes: surfaceBytes,
      }),
      topology: Object.freeze({
        negative_border: field.hasNegativeBorder(isovalue),
        nonempty: indexBuffer.length >= 3 && positionBuffer.length >= 9,
        closed_two_manifold: field.hasNegativeBorder(isovalue) && indexBuffer.length >= 3,
      }),
    };
    MarchingCubesExtractor.#verifiedBuffers.set(result, {
      digest: result.buffer_digest,
      buffers: [result.positions, result.normals, result.colors, result.uvs, result.indices],
    });
    if (authenticatedNeighborTriangles && authenticatedNeighborCounts) {
      MarchingCubesExtractor.#anchorTopology.set(result, {
        neighbor_triangles: authenticatedNeighborTriangles,
        neighbor_counts: authenticatedNeighborCounts,
        positions: MarchingCubesExtractor.#rawBuffer(result.positions),
        indices: MarchingCubesExtractor.#rawBuffer(result.indices),
      });
    }
    return Object.freeze(result);
  }

  // Capture and erase the raw adjacency/buffer bridge before the class is
  // observable. Surface anchors call only the lexical closure, never a
  // replaceable static method carrying the capability.
  static {
    const anchorTopologyImplementation = this._anchorTopologyData;
    cavitySurfaceAnchorTopologyInternal = (surface: CavitySurfaceBuffers) =>
      anchorTopologyImplementation.call(this, surface, CAVITY_SURFACE_ANCHOR_ACCESS);
    delete (this as any)._anchorTopologyData;
  }
}
