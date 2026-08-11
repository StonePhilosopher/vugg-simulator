// ============================================================
// js/23a-geometry-cavity-field.ts — Cartesian cavity scalar field
// ============================================================
// Renderer-side geometry substrate for the Marching Cubes migration.
//
// Sign convention (one source of truth):
//   field > 0  => open cavity / fluid
//   field = 0  => cavity wall
//   field < 0  => host rock
//
// The base field is the exact union of WallState.bubbles. An inverse radial
// map then composes the same authored elongation, polar flatten/collapse, and
// latitude twist used by WallMesh. It does not read or mutate chemistry,
// crystals, wall cells, or the simulation RNG.
// IMPORTANT PROMOTION GATE: per-cell wall_depth still has no mass-balanced
// Cartesian primitive ledger. Until that evolution path exists, this field is
// a default-off renderer comparison rather than simulation authority.

interface CavitySurfaceBuffers {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint16Array | Uint32Array;
  uvs?: Float32Array;
  sig: string;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
  metrics?: {
    field_build_ms?: number;
    extraction_ms: number;
    triangle_count: number;
    vertex_count: number;
    field_bytes: number;
    surface_bytes: number;
  };
}

interface CavityShapeDescriptor {
  elongation: number;
  polar_flatten: number;
  polar_collapse: number;
  polar_amplitudes: number[];
  polar_phases: number[];
  twist_amplitudes: number[];
  twist_phases: number[];
}

class CavityScalarField {
  [key: string]: any;

  constructor(opts: any) {
    const sizeX = Number(opts && opts.sizeX);
    const sizeY = Number(opts && opts.sizeY);
    const sizeZ = Number(opts && opts.sizeZ);
    const spacingMm = Number(opts && opts.spacingMm);
    const origin = opts && opts.origin;
    const values = opts && opts.values;
    if (!Number.isInteger(sizeX) || !Number.isInteger(sizeY) || !Number.isInteger(sizeZ)
        || sizeX < 2 || sizeY < 2 || sizeZ < 2) {
      throw new RangeError('CavityScalarField dimensions must be integers >= 2');
    }
    if (!(spacingMm > 0) || !Number.isFinite(spacingMm)) {
      throw new RangeError('CavityScalarField spacingMm must be positive and finite');
    }
    if (!Array.isArray(origin) || origin.length !== 3 || !origin.every(Number.isFinite)) {
      throw new TypeError('CavityScalarField origin must contain three finite coordinates');
    }
    if (!(values instanceof Float32Array) || values.length !== sizeX * sizeY * sizeZ) {
      throw new RangeError('CavityScalarField values length does not match its dimensions');
    }
    for (let i = 0; i < values.length; i++) {
      if (!Number.isFinite(values[i])) {
        throw new TypeError(`CavityScalarField contains a non-finite sample at index ${i}`);
      }
    }

    this.sizeX = sizeX;
    this.sizeY = sizeY;
    this.sizeZ = sizeZ;
    this.spacingMm = spacingMm;
    this.origin = [origin[0], origin[1], origin[2]];
    this.values = values;
    this.sig = String(opts.sig || 'cavity-field:fixture');
    this.sourceBubbles = Array.isArray(opts.sourceBubbles)
      ? opts.sourceBubbles.map((b) => b.slice())
      : [];
    this.sourceShape = CavityScalarField._validatedShape(opts.sourceShape || {});
    this.bounds = {
      min: [origin[0], origin[1], origin[2]],
      max: [
        origin[0] + spacingMm * (sizeX - 1),
        origin[1] + spacingMm * (sizeY - 1),
        origin[2] + spacingMm * (sizeZ - 1),
      ],
    };
    this.metrics = Object.assign({
      field_build_ms: 0,
      field_bytes: values.byteLength,
    }, opts.metrics || {});
  }

  static _nowMs(): number {
    return (typeof performance !== 'undefined' && performance && performance.now)
      ? performance.now()
      : Date.now();
  }

  static _resolution(value: any): number {
    const n = Math.round(Number(value == null ? 48 : value));
    if (!Number.isFinite(n) || n < 8 || n > 128) {
      throw new RangeError('cavity field resolution must be an integer from 8 through 128');
    }
    return n;
  }

  static _validatedBubbles(input: any): number[][] {
    if (!Array.isArray(input) || input.length === 0) {
      throw new TypeError('WallState.bubbles must contain at least one 3D sphere');
    }
    return input.map((bubble, index) => {
      if (!Array.isArray(bubble) || bubble.length < 4) {
        throw new TypeError(`cavity bubble ${index} must be [cx, cy, cz, radius]`);
      }
      const out = [Number(bubble[0]), Number(bubble[1]), Number(bubble[2]), Number(bubble[3])];
      if (!out.every(Number.isFinite) || !(out[3] > 0)) {
        throw new TypeError(`cavity bubble ${index} must contain finite coordinates and a positive radius`);
      }
      return out;
    });
  }

  static _validatedShape(input: any): CavityShapeDescriptor {
    const shape = input || {};
    const finite = (value: any, fallback: number, label: string): number => {
      if (value == null) return fallback;
      const number = Number(value);
      if (!Number.isFinite(number)) throw new TypeError(`cavity ${label} must be finite`);
      return number;
    };
    const harmonics = (amplitudeKey: string, phaseKey: string): [number[], number[]] => {
      const amplitudeInput = shape[amplitudeKey] == null ? [] : shape[amplitudeKey];
      const phaseInput = shape[phaseKey] == null ? [] : shape[phaseKey];
      if (!Array.isArray(amplitudeInput) || !Array.isArray(phaseInput)
          || amplitudeInput.length !== phaseInput.length) {
        throw new TypeError(`cavity ${amplitudeKey}/${phaseKey} must be equal-length arrays`);
      }
      const amplitudes: number[] = [];
      const phases: number[] = [];
      for (let index = 0; index < amplitudeInput.length; index++) {
        const amplitude = finite(amplitudeInput[index], 0, `${amplitudeKey}[${index}]`);
        const phase = finite(phaseInput[index], 0, `${phaseKey}[${index}]`);
        // Preserve array position because it is the harmonic order (n + 1).
        // A zero-amplitude term still occupies that order, but its phase is
        // normalized away because the field does not sample it.
        amplitudes.push(amplitude === 0 ? 0 : amplitude);
        phases.push(amplitude === 0 ? 0 : phase);
      }
      // Trailing zero orders do not affect any later harmonic index and are
      // therefore not sampled inputs. Interior/leading zeros remain so the
      // frequency of every active term stays unchanged.
      while (amplitudes.length && amplitudes[amplitudes.length - 1] === 0) {
        amplitudes.pop();
        phases.pop();
      }
      return [amplitudes, phases];
    };

    const elongation = Math.max(0, Math.min(0.85,
      finite(shape.elongation, 0, 'elongation')));
    const flattenRaw = finite(shape.polar_flatten, 0, 'polar_flatten');
    const polarFlatten = flattenRaw > 0
      ? Math.max(0.05, Math.min(1, flattenRaw)) : 0;
    const collapseRaw = finite(shape.polar_collapse, 0, 'polar_collapse');
    if (collapseRaw > 1) {
      throw new RangeError('cavity polar_collapse must not exceed 1');
    }
    // The canonical polar oracle gives flattening precedence over collapse.
    // Normalize the ignored input away so the cache mirrors sampled inputs.
    const polarCollapse = polarFlatten > 0 ? 0 : Math.max(0, collapseRaw);
    const [polarAmplitudes, polarPhases] = harmonics('polar_amplitudes', 'polar_phases');
    const [twistAmplitudes, twistPhases] = harmonics('twist_amplitudes', 'twist_phases');
    return {
      elongation,
      polar_flatten: polarFlatten,
      polar_collapse: polarCollapse,
      polar_amplitudes: polarAmplitudes,
      polar_phases: polarPhases,
      twist_amplitudes: twistAmplitudes,
      twist_phases: twistPhases,
    };
  }

  static shapeFor(wall: any): CavityShapeDescriptor {
    if (!wall) throw new TypeError('cavity shape requires a wall');
    return CavityScalarField._validatedShape(wall._cavity_shape || wall);
  }

  static _shapeNumbers(shape: CavityShapeDescriptor): number[] {
    return [
      shape.elongation,
      shape.polar_flatten,
      shape.polar_collapse,
      shape.polar_amplitudes.length,
      ...shape.polar_amplitudes,
      ...shape.polar_phases,
      shape.twist_amplitudes.length,
      ...shape.twist_amplitudes,
      ...shape.twist_phases,
    ];
  }

  static _isIdentityShape(shape: CavityShapeDescriptor): boolean {
    return shape.elongation === 0
      && shape.polar_flatten === 0
      && shape.polar_collapse === 0
      && shape.polar_amplitudes.every((amplitude) => amplitude === 0)
      && shape.twist_amplitudes.every((amplitude) => amplitude === 0);
  }

  static _maxRadialScale(shape: CavityShapeDescriptor): number {
    const fourierMax = 1 + shape.polar_amplitudes
      .reduce((sum, amplitude) => sum + Math.abs(amplitude), 0);
    const polarMax = Math.max(0.5, fourierMax);
    const scale = (1 + shape.elongation) * polarMax;
    if (!(scale > 0) || !Number.isFinite(scale)) {
      throw new RangeError('cavity authored radial scale must be positive and finite');
    }
    return scale;
  }

  static bubbleUnionValue(bubbles: number[][], x: number, y: number, z: number): number {
    if (![x, y, z].every(Number.isFinite)) {
      throw new TypeError('cavity field sample coordinates must be finite');
    }
    let value = -Infinity;
    for (const bubble of bubbles) {
      const dx = x - bubble[0];
      const dy = y - bubble[1];
      const dz = z - bubble[2];
      const sphere = bubble[3] - Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (sphere > value) value = sphere;
    }
    return value;
  }

  static authoredShapeValue(bubbles: number[][], shapeInput: any,
                            x: number, y: number, z: number): number {
    if (![x, y, z].every(Number.isFinite)) {
      throw new TypeError('cavity field sample coordinates must be finite');
    }
    const shape = CavityScalarField._validatedShape(shapeInput);
    return CavityScalarField._authoredShapeValueValidated(bubbles, shape, x, y, z);
  }

  static _authoredShapeValueValidated(bubbles: number[][], shape: CavityShapeDescriptor,
                                      x: number, y: number, z: number): number {
    if (CavityScalarField._isIdentityShape(shape)) {
      return CavityScalarField.bubbleUnionValue(bubbles, x, y, z);
    }
    const worldRadius = Math.hypot(x, y, z);
    if (worldRadius <= Number.EPSILON) {
      return CavityScalarField.bubbleUnionValue(bubbles, x, y, z);
    }
    const phi = Math.acos(Math.max(-1, Math.min(1, -y / worldRadius)));
    const worldTheta = Math.atan2(z, x);
    const sourceTheta = worldTheta - _cavityTwistRadians(shape, phi);
    const radialScale = _cavityRadialScale(shape, phi, sourceTheta);
    if (!(radialScale > 0) || !Number.isFinite(radialScale)) {
      throw new RangeError('cavity authored radial scale must be positive and finite');
    }
    const sourceRadius = worldRadius / radialScale;
    const sinPhi = Math.sin(phi);
    const sourceX = sourceRadius * sinPhi * Math.cos(sourceTheta);
    const sourceY = -sourceRadius * Math.cos(phi);
    const sourceZ = sourceRadius * sinPhi * Math.sin(sourceTheta);
    // Do not multiply by the direction-dependent radial scale. Although that
    // would retain approximate world-distance magnitudes at the wall, it makes
    // a positive value at the cavity origin depend on the direction of
    // approach. The inverse-mapped base field is continuous there and retains
    // the same exact zero set and sign convention.
    return CavityScalarField.bubbleUnionValue(bubbles, sourceX, sourceY, sourceZ);
  }

  static _sourceHash(bubbles: number[][]): string {
    let hashA = 0x811c9dc5;
    let hashB = 0x9e3779b9;
    const scratch = new DataView(new ArrayBuffer(8));
    for (const bubble of bubbles) {
      for (const number of bubble) {
        scratch.setFloat64(0, number, true);
        for (let byte = 0; byte < 8; byte++) {
          const value = scratch.getUint8(byte);
          hashA = Math.imul(hashA ^ value, 0x01000193) >>> 0;
          hashB = (Math.imul(hashB ^ value, 0x85ebca6b) + 0x27d4eb2f) >>> 0;
        }
      }
    }
    return `${hashA.toString(16).padStart(8, '0')}${hashB.toString(16).padStart(8, '0')}`;
  }

  static signatureFor(wall: any, resolution = 48): string {
    const bubbles = CavityScalarField._validatedBubbles(wall && wall.bubbles);
    const shape = CavityScalarField.shapeFor(wall);
    const n = CavityScalarField._resolution(resolution);
    // Only hash inputs that v2 actually samples. wall._geometry_revision also
    // changes for per-cell wall_depth, which this authored base-shape field
    // explicitly does not represent; including it would trigger expensive
    // byte-identical rebuilds during dissolution.
    const shapeHash = CavityScalarField._sourceHash([
      CavityScalarField._shapeNumbers(shape),
    ]);
    return `cavity-field:v2|${n}^3|b:${CavityScalarField._sourceHash(bubbles)}|s:${shapeHash}`;
  }

  static fromWallState(wall: any, opts: any = {}): CavityScalarField {
    if (!wall) throw new TypeError('CavityScalarField.fromWallState requires a wall');
    const resolution = CavityScalarField._resolution(opts.resolution);
    const bubbles = CavityScalarField._validatedBubbles(wall.bubbles);
    const shape = CavityScalarField.shapeFor(wall);
    const sig = CavityScalarField.signatureFor(wall, resolution);
    return CavityScalarField.fromBubbles(bubbles, { resolution, sig, shape });
  }

  static fromBubbles(input: any, opts: any = {}): CavityScalarField {
    const started = CavityScalarField._nowMs();
    const bubbles = CavityScalarField._validatedBubbles(input);
    const shape = CavityScalarField._validatedShape(opts.shape || {});
    const resolution = CavityScalarField._resolution(opts.resolution);

    const rawMin = [Infinity, Infinity, Infinity];
    const rawMax = [-Infinity, -Infinity, -Infinity];
    for (const [cx, cy, cz, radius] of bubbles) {
      rawMin[0] = Math.min(rawMin[0], cx - radius);
      rawMin[1] = Math.min(rawMin[1], cy - radius);
      rawMin[2] = Math.min(rawMin[2], cz - radius);
      rawMax[0] = Math.max(rawMax[0], cx + radius);
      rawMax[1] = Math.max(rawMax[1], cy + radius);
      rawMax[2] = Math.max(rawMax[2], cz + radius);
    }
    let fieldMin = rawMin.slice();
    let fieldMax = rawMax.slice();
    if (!CavityScalarField._isIdentityShape(shape)) {
      // Radial deformation is centered at the authored cavity origin. A
      // sphere's farthest possible source point is |center| + radius; multiply
      // that by the analytic maximum deformation to get a conservative cubic
      // envelope. It is intentionally conservative so twist, flattening, and
      // future nonzero Fourier profiles can never clip the zero set.
      let maxSourceRadius = 0;
      for (const [cx, cy, cz, radius] of bubbles) {
        maxSourceRadius = Math.max(maxSourceRadius, Math.hypot(cx, cy, cz) + radius);
      }
      const deformedRadius = maxSourceRadius * CavityScalarField._maxRadialScale(shape);
      fieldMin = [-deformedRadius, -deformedRadius, -deformedRadius];
      fieldMax = [deformedRadius, deformedRadius, deformedRadius];
    }
    const extent = [
      fieldMax[0] - fieldMin[0],
      fieldMax[1] - fieldMin[1],
      fieldMax[2] - fieldMin[2],
    ];
    const largestExtent = Math.max(extent[0], extent[1], extent[2]);
    if (!(largestExtent > 0) || !Number.isFinite(largestExtent)) {
      throw new RangeError('cavity bubble bounds must have positive finite extent');
    }

    // Cubic physical bounds make spacingMm one honest value on every axis.
    // Iterate the padding/spacing relation because the required padding is
    // max(2*spacing, 5% of the largest bubble-union extent).
    let padding = 0.05 * largestExtent;
    let spacingMm = (largestExtent + 2 * padding) / (resolution - 1);
    for (let i = 0; i < 4; i++) {
      padding = Math.max(2 * spacingMm, 0.05 * largestExtent);
      spacingMm = (largestExtent + 2 * padding) / (resolution - 1);
    }
    const center = [
      (fieldMin[0] + fieldMax[0]) * 0.5,
      (fieldMin[1] + fieldMax[1]) * 0.5,
      (fieldMin[2] + fieldMax[2]) * 0.5,
    ];
    const half = spacingMm * (resolution - 1) * 0.5;
    const origin: [number, number, number] = [center[0] - half, center[1] - half, center[2] - half];
    const values = new Float32Array(resolution * resolution * resolution);
    let offset = 0;
    for (let z = 0; z < resolution; z++) {
      const wz = origin[2] + z * spacingMm;
      for (let y = 0; y < resolution; y++) {
        const wy = origin[1] + y * spacingMm;
        for (let x = 0; x < resolution; x++) {
          const wx = origin[0] + x * spacingMm;
          const value = CavityScalarField._authoredShapeValueValidated(bubbles, shape, wx, wy, wz);
          if (!Number.isFinite(value)) {
            throw new TypeError(`non-finite cavity field sample at (${x}, ${y}, ${z})`);
          }
          values[offset++] = value;
        }
      }
    }
    const field = new CavityScalarField({
      sizeX: resolution,
      sizeY: resolution,
      sizeZ: resolution,
      spacingMm,
      origin,
      values,
      sourceBubbles: bubbles,
      sourceShape: shape,
      sig: opts.sig || `cavity-field:v2|${resolution}^3|b:${CavityScalarField._sourceHash(bubbles)}|s:${CavityScalarField._sourceHash([CavityScalarField._shapeNumbers(shape)])}`,
    });
    field.metrics.field_build_ms = CavityScalarField._nowMs() - started;
    if (!field.hasNegativeBorder(0)) {
      throw new RangeError('cavity scalar field bounds do not retain a complete rock-negative border');
    }
    return field;
  }

  index(x: number, y: number, z: number): number {
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)
        || x < 0 || y < 0 || z < 0
        || x >= this.sizeX || y >= this.sizeY || z >= this.sizeZ) {
      throw new RangeError(`cavity field index out of range: (${x}, ${y}, ${z})`);
    }
    return (z * this.sizeY + y) * this.sizeX + x;
  }

  worldPosition(x: number, y: number, z: number): [number, number, number] {
    this.index(x, y, z);
    return [
      this.origin[0] + x * this.spacingMm,
      this.origin[1] + y * this.spacingMm,
      this.origin[2] + z * this.spacingMm,
    ];
  }

  valueAt(x: number, y: number, z: number): number {
    return this.values[this.index(x, y, z)];
  }

  sampleAnalyticWorld(x: number, y: number, z: number): number {
    if (!this.sourceBubbles.length) return this.sampleWorld(x, y, z);
    return CavityScalarField._authoredShapeValueValidated(
      this.sourceBubbles, this.sourceShape, x, y, z,
    );
  }

  sampleWorld(x: number, y: number, z: number): number {
    if (![x, y, z].every(Number.isFinite)) {
      throw new TypeError('cavity field sample coordinates must be finite');
    }
    const gx = (x - this.origin[0]) / this.spacingMm;
    const gy = (y - this.origin[1]) / this.spacingMm;
    const gz = (z - this.origin[2]) / this.spacingMm;
    if (gx < 0 || gy < 0 || gz < 0
        || gx > this.sizeX - 1 || gy > this.sizeY - 1 || gz > this.sizeZ - 1) {
      if (this.sourceBubbles.length) {
        return CavityScalarField._authoredShapeValueValidated(
          this.sourceBubbles, this.sourceShape, x, y, z,
        );
      }
      return -Infinity;
    }
    const x0 = Math.min(this.sizeX - 2, Math.floor(gx));
    const y0 = Math.min(this.sizeY - 2, Math.floor(gy));
    const z0 = Math.min(this.sizeZ - 2, Math.floor(gz));
    const tx = gx - x0;
    const ty = gy - y0;
    const tz = gz - z0;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const c000 = this.valueAt(x0, y0, z0);
    const c100 = this.valueAt(x0 + 1, y0, z0);
    const c010 = this.valueAt(x0, y0 + 1, z0);
    const c110 = this.valueAt(x0 + 1, y0 + 1, z0);
    const c001 = this.valueAt(x0, y0, z0 + 1);
    const c101 = this.valueAt(x0 + 1, y0, z0 + 1);
    const c011 = this.valueAt(x0, y0 + 1, z0 + 1);
    const c111 = this.valueAt(x0 + 1, y0 + 1, z0 + 1);
    const z0Value = lerp(lerp(c000, c100, tx), lerp(c010, c110, tx), ty);
    const z1Value = lerp(lerp(c001, c101, tx), lerp(c011, c111, tx), ty);
    return lerp(z0Value, z1Value, tz);
  }

  gradientWorld(x: number, y: number, z: number): [number, number, number] {
    const h = this.spacingMm * 0.5;
    const derivative = (axis: number): number => {
      const point = [x, y, z];
      const minus = Math.max(this.bounds.min[axis], point[axis] - h);
      const plus = Math.min(this.bounds.max[axis], point[axis] + h);
      if (!(plus > minus)) return 0;
      const a = point.slice();
      const b = point.slice();
      a[axis] = minus;
      b[axis] = plus;
      return (this.sampleWorld(b[0], b[1], b[2]) - this.sampleWorld(a[0], a[1], a[2]))
        / (plus - minus);
    };
    return [derivative(0), derivative(1), derivative(2)];
  }

  hasNegativeBorder(isovalue = 0): boolean {
    for (let z = 0; z < this.sizeZ; z++) {
      for (let y = 0; y < this.sizeY; y++) {
        for (let x = 0; x < this.sizeX; x++) {
          if (x !== 0 && y !== 0 && z !== 0
              && x !== this.sizeX - 1 && y !== this.sizeY - 1 && z !== this.sizeZ - 1) continue;
          if (!(this.valueAt(x, y, z) < isovalue)) return false;
        }
      }
    }
    return true;
  }

  extract(isovalue = 0): CavitySurfaceBuffers {
    if (!Number.isFinite(isovalue)) throw new TypeError('cavity surface isovalue must be finite');
    const extractor: any = (typeof MarchingCubesExtractor !== 'undefined') ? MarchingCubesExtractor : null;
    if (!extractor) throw new Error('MarchingCubesExtractor is unavailable');
    return extractor.extract(this, isovalue);
  }
}
