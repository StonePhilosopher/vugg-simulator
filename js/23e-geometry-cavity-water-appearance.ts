// ============================================================
// js/23e-geometry-cavity-water-appearance.ts
// ============================================================
// One physical water datum shared by chemistry projection, wall appearance,
// the field-clipped water interface, and replay. A water level is a height in
// millimetres above the current authenticated cavity floor. Ring numbers are
// accepted only through VugConditions' explicit legacy conversion.

const CAVITY_WATER_APPEARANCE_SCHEMA = 'cavity-water-appearance-v1';
const CAVITY_WATER_HISTORY_SCHEMA = 'cavity-water-history-v1';

class CavityWaterAppearance {
  static _boundsCache = new WeakMap<object, any>();
  static _geometryDigestCache = new WeakMap<object, any>();
  static _ringStateCache = new WeakMap<object, any>();

  static _finiteHeight(conditions: any, wall: any): number | null {
    if (!conditions) return null;
    const suppliedHeight = conditions.fluid_surface_height_mm;
    if (suppliedHeight == null) return null;
    const height = Number(suppliedHeight);
    if (!Number.isFinite(height) || height < 0) {
      throw new RangeError('cavity water-surface height must be finite and non-negative');
    }
    return height;
  }

  static _surfaceBounds(surface: any): any {
    const positions = surface?.positions;
    if (!positions || positions.length < 9 || positions.length % 3 !== 0) {
      throw new RangeError('cavity water appearance requires a populated surface');
    }
    const identity = String(surface.buffer_digest || surface.sig || '');
    const cached = CavityWaterAppearance._boundsCache.get(surface);
    if (cached?.identity === identity) return cached.bounds;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let offset = 0; offset < positions.length; offset += 3) {
      for (let axis = 0; axis < 3; axis++) {
        const value = Number(positions[offset + axis]);
        if (!Number.isFinite(value)) {
          throw new RangeError('cavity water appearance received non-finite geometry');
        }
        if (value < min[axis]) min[axis] = value;
        if (value > max[axis]) max[axis] = value;
      }
    }
    if (!(max[1] > min[1])) throw new RangeError('cavity water datum has no vertical span');
    const bounds = Object.freeze({ min: Object.freeze(min), max: Object.freeze(max) });
    CavityWaterAppearance._boundsCache.set(surface, { identity, bounds });
    return bounds;
  }

  static _geometryDigest(surface: any, providerReceipt: any): string {
    if (providerReceipt?.kind === 'cavity-field') {
      return String(providerReceipt.surface_buffer_digest || '');
    }
    const identity = String(surface?.sig || '');
    const cached = CavityWaterAppearance._geometryDigestCache.get(surface);
    if (cached?.identity === identity) return cached.digest;
    const digest = `wall-mesh-buffer:v1:${CavityEvolutionLedger.digest({
      positions: Array.from(surface.positions, Number),
      indices: Array.from(surface.indices || [], Number),
    })}`;
    CavityWaterAppearance._geometryDigestCache.set(surface, { identity, digest });
    return digest;
  }

  static verticalSpanForWall(wall: any): number {
    if (!wall) throw new TypeError('cavity water span requires a wall');
    const active = wall._cavityProductionAuthorityContract
      ? wall._requireProductionCavitySurfaceProvider?.()
      : wall.activeCavitySurfaceAnchorProvider?.();
    if (wall._cavityProductionAuthorityContract
        && active?.receipt?.kind !== 'cavity-field') {
      throw new Error('production cavity water span lacks authenticated surface authority');
    }
    const surface = active?.surface || wall.meshFor?.();
    const bounds = CavityWaterAppearance._surfaceBounds(surface);
    return bounds.max[1] - bounds.min[1];
  }

  static create(wall: any, conditions: any, opts: any = {}): any {
    if (!wall) throw new TypeError('cavity water appearance requires a wall');
    let active = opts.activeProvider || null;
    if (!active && !opts.surface && wall.activeCavitySurfaceAnchorProvider) {
      active = wall.activeCavitySurfaceAnchorProvider();
    }
    const providerReceipt = opts.providerReceipt
      || active?.receipt || wall.cavitySurfaceAnchorProviderReceipt?.()
      || Object.freeze({ kind: 'wall-mesh' });
    const surface = opts.surface || active?.surface || wall.meshFor?.(opts.sim);
    const bounds = CavityWaterAppearance._surfaceBounds(surface);
    const requestedHeight = CavityWaterAppearance._finiteHeight(conditions, wall);
    const span = bounds.max[1] - bounds.min[1];
    const explicit = requestedHeight != null;
    const effectiveHeight = explicit ? Math.min(Math.max(requestedHeight, 0), span) : span;
    const planeY = bounds.min[1] + effectiveHeight;
    const epsilon = Math.max(span * 1e-9, 1e-9);
    const geometryDigest = CavityWaterAppearance._geometryDigest(surface, providerReceipt);
    if (typeof geometryDigest !== 'string' || !geometryDigest) {
      throw new RangeError('cavity water appearance lacks geometry identity');
    }
    const payload: any = {
      schema: CAVITY_WATER_APPEARANCE_SCHEMA,
      condition_basis: 'millimetres-above-authenticated-current-cavity-floor-v1',
      requested_height_mm: requestedHeight,
      effective_height_mm: effectiveHeight,
      floor_elevation_mm: bounds.min[1],
      ceiling_elevation_mm: bounds.max[1],
      water_plane_y_mm: planeY,
      explicit_surface: explicit,
      fully_submerged: !explicit || effectiveHeight >= span - epsilon,
      fully_drained: explicit && effectiveHeight <= epsilon,
      submerged_half_space: 'world_y<=water_plane_y_mm',
      source_geometry_digest: geometryDigest,
      source_provider_kind: providerReceipt?.kind || 'wall-mesh',
      source_evolution_signature: providerReceipt?.cavity_evolution_signature ?? null,
      bounds_min_mm: bounds.min.slice(),
      bounds_max_mm: bounds.max.slice(),
    };
    payload.appearance_digest = CavityEvolutionLedger.digest(payload);
    CavityEvolutionLedger._deepFreeze(payload);
    return Object.freeze({ receipt: payload, surface, providerReceipt });
  }

  static assertReceipt(wall: any, conditions: any, stored: any, opts: any = {}): any {
    if (!stored || stored.schema !== CAVITY_WATER_APPEARANCE_SCHEMA) {
      throw new RangeError('missing or unsupported cavity water appearance receipt');
    }
    const payload = CavityEvolutionLedger._clone(stored);
    const suppliedDigest = payload.appearance_digest;
    delete payload.appearance_digest;
    if (suppliedDigest !== CavityEvolutionLedger.digest(payload)) {
      throw new RangeError('cavity water appearance receipt digest mismatch');
    }
    const fresh = CavityWaterAppearance.create(wall, conditions, opts);
    if (fresh.receipt.appearance_digest !== suppliedDigest) {
      throw new RangeError('cavity water appearance differs from authenticated replay conditions');
    }
    return fresh;
  }

  static colorsForSurface(surface: any, receipt: any): Float32Array {
    const positions = surface?.positions;
    const base = surface?.colors;
    if (!positions || !base || positions.length !== base.length) {
      throw new RangeError('cavity water tint requires paired position/color buffers');
    }
    const colors = new Float32Array(base);
    // A floor-clamped water plane encloses no fluid.  Tinting the coincident
    // pole vertex would interpolate a false wet patch across adjacent faces.
    if (!receipt?.explicit_surface || receipt.fully_drained === true) return colors;
    const water = [0.43, 0.74, 0.96];
    const plane = Number(receipt.water_plane_y_mm);
    for (let offset = 0; offset < positions.length; offset += 3) {
      if (positions[offset + 1] > plane) continue;
      colors[offset] = colors[offset] * 0.65 + water[0] * 0.35;
      colors[offset + 1] = colors[offset + 1] * 0.65 + water[1] * 0.35;
      colors[offset + 2] = colors[offset + 2] * 0.65 + water[2] * 0.35;
    }
    return colors;
  }

  static ringWaterState(conditions: any, ringIdx: number, ringCount: number): string {
    const height = conditions?.fluid_surface_height_mm;
    if (height == null) return 'submerged';
    if (!Number.isInteger(ringIdx) || ringIdx < 0 || ringIdx >= ringCount || ringCount < 1) {
      throw new RangeError('cavity water-state ring address is invalid');
    }
    const wall = conditions._cavityWaterGeometry;
    if (wall?.meshFor && wall.ring_count === ringCount) {
      const active = wall._cavityProductionAuthorityContract
        ? wall._requireProductionCavitySurfaceProvider?.()
        : wall.activeCavitySurfaceAnchorProvider?.();
      if (wall._cavityProductionAuthorityContract
          && active?.receipt?.kind !== 'cavity-field') {
        throw new Error('production cavity water state lacks authenticated surface authority');
      }
      const authoritySurface = active?.surface || wall.meshFor();
      const chemistrySurface = wall.meshFor();
      const bounds = CavityWaterAppearance._surfaceBounds(authoritySurface);
      const span = bounds.max[1] - bounds.min[1];
      const effectiveHeight = Math.min(Math.max(Number(height), 0), span);
      const plane = bounds.min[1] + effectiveHeight;
      const authorityIdentity = active?.receipt?.surface_buffer_digest
        || String(authoritySurface.sig || '');
      const key = `${authorityIdentity}|chem:${String(chemistrySurface.sig || '')}`
        + `|height:${effectiveHeight}|rings:${ringCount}`;
      let cached = CavityWaterAppearance._ringStateCache.get(wall);
      if (cached?.key !== key) {
        const states = new Array(ringCount);
        const positions = chemistrySurface.positions;
        const cellsPerRing = wall.cells_per_ring;
        const epsilon = Math.max(span * 1e-9, 1e-9);
        for (let ring = 0; ring < ringCount; ring++) {
          let ringMin = Infinity;
          let ringMax = -Infinity;
          for (let cell = 0; cell < cellsPerRing; cell++) {
            const y = Number(positions[(ring * cellsPerRing + cell) * 3 + 1]);
            ringMin = Math.min(ringMin, y);
            ringMax = Math.max(ringMax, y);
          }
          // A plane clamped exactly to the cavity floor contains zero water
          // volume.  Do not let the degenerate south-pole ring count as
          // submerged merely because all of its coincident vertices equal the
          // plane; drainage-to-floor events mean the entire cavity is vadose.
          states[ring] = effectiveHeight <= epsilon ? 'vadose'
            : ringMax <= plane + epsilon ? 'submerged'
            : ringMin >= plane - epsilon ? 'vadose' : 'meniscus';
        }
        cached = { key, states: Object.freeze(states) };
        CavityWaterAppearance._ringStateCache.set(wall, cached);
      }
      return cached.states[ringIdx];
    }

    // Standalone conditions (before VugSimulator binds WallState) retain a
    // deterministic spherical fallback for event/unit-test compatibility.
    const span = Math.max(Number(conditions?.wall?.vug_diameter_mm) || ringCount, 1e-12);
    const plane = Math.min(Math.max(Number(height), 0), span);
    const phi0 = Math.PI * ringIdx / ringCount;
    const phi1 = Math.PI * (ringIdx + 1) / ringCount;
    const lower = span * (1 - Math.cos(phi0)) * 0.5;
    const upper = span * (1 - Math.cos(phi1)) * 0.5;
    if (upper <= plane) return 'submerged';
    if (lower >= plane) return 'vadose';
    return 'meniscus';
  }

  static replayConditions(snapshotConditions: any, wall: any): any {
    if (!snapshotConditions || typeof snapshotConditions !== 'object') {
      throw new RangeError('replay cavity appearance lacks historical conditions');
    }
    const view: any = { ...snapshotConditions, _cavityWaterGeometry: wall };
    view.ringWaterState = (ringIdx: number, ringCount: number) =>
      CavityWaterAppearance.ringWaterState(view, ringIdx, ringCount);
    return Object.freeze(view);
  }

  static planeSegments(surface: any, planeY: number): readonly any[] {
    const positions = surface?.positions;
    const indices = surface?.indices;
    if (!positions || !indices || !Number.isFinite(Number(planeY))) {
      throw new RangeError('cavity water plane intersection requires surface buffers and height');
    }
    const segments: any[] = [];
    const epsilon = 1e-9;
    const point = (index: number) => [
      Number(positions[index * 3]),
      Number(positions[index * 3 + 1]),
      Number(positions[index * 3 + 2]),
    ];
    for (let offset = 0; offset < indices.length; offset += 3) {
      const vertices = [point(indices[offset]), point(indices[offset + 1]), point(indices[offset + 2])];
      const cuts: number[][] = [];
      for (const [aIndex, bIndex] of [[0, 1], [1, 2], [2, 0]]) {
        const a = vertices[aIndex], b = vertices[bIndex];
        const da = a[1] - planeY, db = b[1] - planeY;
        if (Math.abs(da) <= epsilon && Math.abs(db) <= epsilon) continue;
        if ((da < -epsilon && db < -epsilon) || (da > epsilon && db > epsilon)) continue;
        const denominator = b[1] - a[1];
        const t = Math.abs(denominator) <= epsilon ? 0 : (planeY - a[1]) / denominator;
        if (t < -epsilon || t > 1 + epsilon) continue;
        const cut = [
          a[0] + (b[0] - a[0]) * t,
          planeY,
          a[2] + (b[2] - a[2]) * t,
        ];
        if (!cuts.some(existing => Math.hypot(
          existing[0] - cut[0], existing[1] - cut[1], existing[2] - cut[2],
        ) <= epsilon)) cuts.push(cut);
      }
      if (cuts.length === 2) segments.push(Object.freeze([
        Object.freeze(cuts[0]), Object.freeze(cuts[1]),
      ]));
    }
    return Object.freeze(segments);
  }
}

class CavityWaterAppearanceLedger {
  [key: string]: any;
  constructor(wall: any) {
    const identity = CavityEvolutionLedger.identityForWall(wall);
    this.schema = CAVITY_WATER_HISTORY_SCHEMA;
    this.shape_identity = identity.shape;
    this.tessellation_identity = identity.tessellation;
    this._entries = [];
    this._signatures = [`cavity-water-history:v1:${CavityEvolutionLedger.digest({
      shape_identity: this.shape_identity,
      tessellation_identity: this.tessellation_identity,
    })}`];
  }

  get cursor(): number { return this._entries.length; }
  get signature(): string { return this._signatures[this._signatures.length - 1]; }
  get entries(): readonly any[] { return Object.freeze(this._entries.slice()); }

  signatureAt(cursor: number): string {
    if (!Number.isInteger(cursor) || cursor < 0 || cursor > this.cursor) {
      throw new RangeError('cavity water history cursor is invalid');
    }
    return this._signatures[cursor];
  }

  append(step: number, wall: any, conditions: any, appearanceReceipt: any): any {
    const identity = CavityEvolutionLedger.identityForWall(wall);
    if (identity.shape !== this.shape_identity
        || identity.tessellation !== this.tessellation_identity) {
      throw new RangeError('cavity water history geometry identity changed');
    }
    if (!Number.isInteger(step) || step < 0
        || (this.cursor && step < this._entries[this.cursor - 1].step)) {
      throw new RangeError('cavity water history step is invalid');
    }
    const evolution = wall.cavityEvolutionLedger?.();
    const payload: any = {
      schema: CAVITY_WATER_HISTORY_SCHEMA,
      event_id: this.cursor + 1,
      step,
      pre_state_signature: this.signature,
      cavity_evolution_cursor: evolution?.cursor ?? null,
      cavity_evolution_signature: evolution?.signature ?? null,
      canonical_height_mm: conditions?.fluid_surface_height_mm == null
        ? null : Number(conditions.fluid_surface_height_mm),
      appearance_digest: appearanceReceipt?.appearance_digest || null,
      source_geometry_digest: appearanceReceipt?.source_geometry_digest || null,
    };
    if ((payload.canonical_height_mm != null
          && (!Number.isFinite(payload.canonical_height_mm) || payload.canonical_height_mm < 0))
        || typeof payload.appearance_digest !== 'string' || !payload.appearance_digest
        || typeof payload.source_geometry_digest !== 'string' || !payload.source_geometry_digest) {
      throw new RangeError('cavity water history entry is incomplete');
    }
    payload.entry_digest = CavityEvolutionLedger.digest(payload);
    CavityEvolutionLedger._deepFreeze(payload);
    this._entries.push(payload);
    this._signatures.push(`cavity-water-history:v1:${CavityEvolutionLedger.digest({
      prior: this.signatureAt(this.cursor - 1), entry: payload.entry_digest,
    })}`);
    return payload;
  }

  assertSnapshot(wall: any, snapshot: any): any {
    const identity = CavityEvolutionLedger.identityForWall(wall);
    const cursor = snapshot?.cavity_water_history_cursor;
    if (identity.shape !== this.shape_identity
        || identity.tessellation !== this.tessellation_identity
        || !Number.isInteger(cursor) || cursor < 1 || cursor > this.cursor
        || this.signatureAt(cursor) !== snapshot.cavity_water_history_signature) {
      throw new RangeError('cavity water history identity or cursor mismatch');
    }
    const entry = this._entries[cursor - 1];
    const height = snapshot.conditions?.fluid_surface_height_mm == null
      ? null : Number(snapshot.conditions.fluid_surface_height_mm);
    if (entry.entry_digest !== snapshot.cavity_water_history_entry_digest
        || entry.step !== snapshot.step
        || entry.cavity_evolution_cursor !== snapshot.cavity_evolution_cursor
        || entry.cavity_evolution_signature !== snapshot.cavity_evolution_signature
        || entry.canonical_height_mm !== height
        || entry.appearance_digest !== snapshot.cavity_appearance?.appearance_digest
        || entry.source_geometry_digest !== snapshot.cavity_appearance?.source_geometry_digest) {
      throw new RangeError('cavity water snapshot differs from append-only history');
    }
    return entry;
  }
}
