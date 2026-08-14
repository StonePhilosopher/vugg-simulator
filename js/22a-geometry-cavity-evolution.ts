// ============================================================
// js/22a-geometry-cavity-evolution.ts — cavity evolution authority
// ============================================================
//
// Dissolution-only first tranche. A transaction closes one deliberately
// limited relationship:
//
//   carbonate-host formula extent (mmol/kg solvent reference)
//     <-> crystalline standard-state solid volume (mm3/kg solvent reference)
//     <-> exact enclosed-volume change of the selected immutable geometry
//         authority (legacy closed WallMesh or preflighted Cartesian surface)
//
// This is not a sealed-cavity fluid-mass claim and not full chemistry closure.
// It does not yet close pressure/temperature-dependent mineral volume,
// limestone phase fraction/porosity, Fe/Mn inventories, charge, energy, or
// spatial solute transport. Deposition is intentionally absent until a named
// solid phase and an aqueous-withdrawal transaction exist.

const CAVITY_EVOLUTION_SCHEMA = 1;

// Append-only ledgers admit one immutable depth projection per cursor. Keep
// those canonical arrays behind a lexical WeakMap so stable authentication can
// compare against them without allocating and replaying the complete history.
// Public `materialize()` still returns a defensive copy.
const CAVITY_LEDGER_DEPTH_PROJECTIONS = new WeakMap<object, Float64Array[]>();
const CAVITY_LEDGER_PRIVATE_STATE = new WeakMap<object, {
  entries: any[];
  signatures: string[];
  signature: string;
  generation: number;
}>();

function _cavityLedgerPrivateState(ledger: any): any {
  const state = CAVITY_LEDGER_PRIVATE_STATE.get(ledger);
  if (!state) throw new TypeError('unrecognized cavity evolution ledger');
  return state;
}

// Exact internal head used by production geometry seals and transactions.
// Returning a fresh frozen scalar receipt cannot expose the mutable arrays.
function _cavityLedgerAuthorityHead(ledger: any, cursor?: number): any {
  const state = _cavityLedgerPrivateState(ledger);
  const effectiveCursor = cursor == null ? state.entries.length : Number(cursor);
  if (!Number.isInteger(effectiveCursor) || effectiveCursor < 0
      || effectiveCursor > state.entries.length) {
    throw new RangeError('cavity evolution cursor is out of range');
  }
  return Object.freeze({
    cursor: effectiveCursor,
    head_cursor: state.entries.length,
    signature: state.signatures[effectiveCursor],
    generation: state.generation,
  });
}

function _cavityLedgerDepthProjection(ledger: any, cursor: number): Float64Array {
  const state = _cavityLedgerPrivateState(ledger);
  if (!Number.isInteger(cursor) || cursor < 0 || cursor > state.entries.length) {
    throw new RangeError('cavity evolution cursor is out of range');
  }
  let projections = CAVITY_LEDGER_DEPTH_PROJECTIONS.get(ledger);
  if (!projections) {
    projections = [new Float64Array(ledger.baseline_depths_mm)];
    CAVITY_LEDGER_DEPTH_PROJECTIONS.set(ledger, projections);
  }
  for (let eventIndex = projections.length - 1; eventIndex < cursor; eventIndex++) {
    const depths = new Float64Array(projections[eventIndex]);
    for (const delta of state.entries[eventIndex].vertex_deltas) {
      const current = depths[delta.vertex_index];
      if (Math.abs(current - delta.old_depth_mm) > 1e-10) {
        throw new RangeError('cavity evolution ledger has a broken depth chain');
      }
      depths[delta.vertex_index] = delta.new_depth_mm;
    }
    projections.push(depths);
  }
  return projections[cursor];
}

interface CavityMolarVolumeReceipt {
  mineral: string;
  formula: string;
  value_cm3_mol: number;
  approximation: 'standard_state_crystalline';
  reference_temperature_C: number;
  reference_pressure_bar: number;
  requested_temperature_C: number | null;
  requested_pressure_kbar: number | null;
  source: string;
  source_table: string;
  uncertainty_cm3_mol: number;
  uncertainty: string;
}

// Future-proof API boundary: callers provide T/P/composition now even though
// this tranche deliberately returns a disclosed standard-state approximation.
function cavityMolarVolume(mineral: string, temperatureC?: number | null,
                           pressureKbar?: number | null, _composition?: any): CavityMolarVolumeReceipt {
  const key = String(mineral || '').toLowerCase();
  const record = key === 'dolomite'
    ? { mineral: 'dolomite', formula: 'CaMg(CO3)2', value: 64.341, uncertainty: 0.029 }
    : key === 'calcite'
      ? { mineral: 'calcite', formula: 'CaCO3', value: 36.934, uncertainty: 0.015 }
      : null;
  if (!record) throw new RangeError('no cavity molar-volume model for mineral: ' + mineral);
  const requestedTemperature = temperatureC == null ? null : Number(temperatureC);
  const requestedPressure = pressureKbar == null ? null : Number(pressureKbar);
  if (requestedTemperature != null && !Number.isFinite(requestedTemperature)) {
    throw new TypeError('requested molar-volume temperature must be finite');
  }
  if (requestedPressure != null && !Number.isFinite(requestedPressure)) {
    throw new TypeError('requested molar-volume pressure must be finite');
  }
  return Object.freeze({
    mineral: record.mineral,
    formula: record.formula,
    value_cm3_mol: record.value,
    approximation: 'standard_state_crystalline' as const,
    reference_temperature_C: 26,
    reference_pressure_bar: 1,
    requested_temperature_C: requestedTemperature,
    requested_pressure_kbar: requestedPressure,
    source: 'https://pubs.usgs.gov/bul/1248/report.pdf',
    source_table: 'USGS Bulletin 1248, Molar Volumes and Densities of Minerals, carbonates and nitrates table',
    uncertainty_cm3_mol: record.uncertainty,
    uncertainty: `USGS table reports ±${record.uncertainty.toFixed(3)} cm³/mol at 26 °C; P-T and bulk-rock uncertainty beyond that reference state is not quantified in this tranche`,
  });
}

function cavityFormulaExtentVolumeMm3PerKg(formulaExtentMmolKg: number,
                                           molarVolume: CavityMolarVolumeReceipt): number {
  const extent = Number(formulaExtentMmolKg);
  if (!(extent >= 0) || !Number.isFinite(extent)) {
    throw new RangeError('formula extent must be finite and non-negative');
  }
  if (!molarVolume || !(molarVolume.value_cm3_mol > 0)) {
    throw new RangeError('molar-volume receipt must be positive');
  }
  // mmol/kg * cm3/mol is numerically mm3/kg.
  return extent * molarVolume.value_cm3_mol;
}

class CavityEvolutionLedger {
  [key: string]: any;

  constructor(opts: any = {}) {
    this.schema = CAVITY_EVOLUTION_SCHEMA;
    this.model = opts.model === CAVITY_PRODUCTION_VOLUME_MODEL
      ? CAVITY_PRODUCTION_VOLUME_MODEL : 'canonical-wallmesh-volume-v1';
    this.shape_identity = String(opts.shape_identity || 'unidentified-shape');
    this.tessellation_identity = String(opts.tessellation_identity || 'unidentified-tessellation');
    this.baseline_kind = opts.baseline_kind === 'legacy_import' ? 'legacy_import' : 'authored_initial';
    this.baseline_disclosure = this.baseline_kind === 'legacy_import'
      ? String(opts.baseline_disclosure || 'Imported geometric depths have no fabricated chemistry receipt.')
      : 'Authored initial closed-mesh geometry before live wall evolution.';
    const baseline = Array.from(opts.baseline_depths_mm || [], Number);
    if (!baseline.length || baseline.some(value => !Number.isFinite(value))) {
      throw new RangeError('cavity evolution baseline depths must be a finite non-empty array');
    }
    this.baseline_depths_mm = Object.freeze(baseline.slice());
    this.base_state_digest = 'cavity-evolution-base:' + CavityEvolutionLedger.digest({
      schema: this.schema,
      model: this.model,
      shape_identity: this.shape_identity,
      tessellation_identity: this.tessellation_identity,
      baseline_kind: this.baseline_kind,
      baseline_depths_mm: baseline,
    });
    CAVITY_LEDGER_PRIVATE_STATE.set(this, {
      entries: [],
      signatures: [this.base_state_digest],
      signature: this.base_state_digest,
      generation: 0,
    });
    for (const entry of (opts.entries || [])) this.append(entry);
    // All evolving state lives in the lexical WeakMap. Freezing the public
    // shell prevents shadow properties from intercepting authority methods or
    // changing the immutable shape/tessellation identity.
    Object.freeze(this);
  }

  static _canonical(value: any): any {
    if (Array.isArray(value)) return value.map(item => CavityEvolutionLedger._canonical(item));
    if (value && typeof value === 'object') {
      const out: any = {};
      for (const key of Object.keys(value).sort()) {
        if (key === 'entry_digest') continue;
        out[key] = CavityEvolutionLedger._canonical(value[key]);
      }
      return out;
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new TypeError('cavity evolution data contains a non-finite number');
    }
    return value;
  }

  static digest(value: any): string {
    const text = JSON.stringify(CavityEvolutionLedger._canonical(value));
    let a = 0x811c9dc5;
    let b = 0x9e3779b9;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      a = Math.imul(a ^ (code & 255), 0x01000193) >>> 0;
      a = Math.imul(a ^ (code >>> 8), 0x01000193) >>> 0;
      b = (Math.imul(b ^ code, 0x85ebca6b) + 0x27d4eb2f) >>> 0;
    }
    return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
  }

  static _clone(value: any): any {
    return JSON.parse(JSON.stringify(value));
  }

  static _deepFreeze(value: any): any {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    for (const key of Object.keys(value)) CavityEvolutionLedger._deepFreeze(value[key]);
    return Object.freeze(value);
  }

  static identityForWall(wall: any): { shape: string; tessellation: string } {
    if (!wall || !Array.isArray(wall.rings) || !wall.rings.length) {
      throw new TypeError('cavity evolution identity requires a populated WallState');
    }
    const base = [];
    for (const ring of wall.rings) {
      for (const cell of ring) base.push(Number(cell.base_radius_mm) || 0);
    }
    const shape = 'wall-shape:' + CavityEvolutionLedger.digest({
      shape_seed: Number(wall.shape_seed) || 0,
      architecture: wall.architecture || null,
      authored_shape: wall._cavity_shape || null,
      bubbles: wall.bubbles || [],
      base_radius_mm: base,
    });
    const tessellation = 'latlong-wallmesh-v1:' + wall.ring_count + 'x' + wall.cells_per_ring;
    return { shape, tessellation };
  }

  static forWall(wall: any, opts: any = {}): CavityEvolutionLedger {
    const identity = CavityEvolutionLedger.identityForWall(wall);
    const depths: number[] = [];
    for (const ring of wall.rings) {
      for (const cell of ring) depths.push(Number(cell.wall_depth) || 0);
    }
    return new CavityEvolutionLedger({
      shape_identity: identity.shape,
      tessellation_identity: identity.tessellation,
      baseline_depths_mm: depths,
      baseline_kind: opts.legacy_import ? 'legacy_import' : 'authored_initial',
      baseline_disclosure: opts.baseline_disclosure,
      model: opts.model,
      entries: opts.entries || [],
    });
  }

  static fromJSON(payload: any): CavityEvolutionLedger {
    if (!payload || payload.schema !== CAVITY_EVOLUTION_SCHEMA) {
      throw new RangeError('unsupported cavity evolution ledger schema');
    }
    const ledger = new CavityEvolutionLedger(payload);
    // Loading is an authority boundary, not a lazy promise to validate later.
    // Force the complete chain once before any caller can receive the object.
    ledger.materialize();
    return ledger;
  }

  // Consumers receive a frozen snapshot so the append-only chain cannot be
  // mutated by pushing, popping, or replacing an entry outside this authority.
  get entries(): readonly any[] {
    return Object.freeze(_cavityLedgerPrivateState(this).entries.slice());
  }
  get signature(): string { return _cavityLedgerPrivateState(this).signature; }
  get cursor(): number { return _cavityLedgerPrivateState(this).entries.length; }

  signatureAt(cursor: number): string {
    return _cavityLedgerAuthorityHead(this, cursor).signature;
  }

  _depthProjectionDigest(depths: ArrayLike<number>): string {
    return 'cavity-depth-projection:v1:' + CavityEvolutionLedger.digest({
      model: CAVITY_PRODUCTION_VOLUME_MODEL,
      identity: {
        shape: this.shape_identity,
        tessellation: this.tessellation_identity,
      },
      depths_mm: Array.from(depths, Number),
    });
  }

  _validateEntry(entry: any): any {
    const state = _cavityLedgerPrivateState(this);
    const copy = CavityEvolutionLedger._clone(entry);
    if (copy.schema !== CAVITY_EVOLUTION_SCHEMA
        || copy.model !== this.model
        || copy.transaction_type !== 'carbonate_host_dissolution') {
      throw new RangeError('unsupported cavity evolution entry identity');
    }
    if (copy.shape_identity !== this.shape_identity
        || copy.tessellation_identity !== this.tessellation_identity) {
      throw new RangeError('cavity evolution entry belongs to another shape or tessellation');
    }
    if (copy.event_id !== state.entries.length + 1 || !Number.isInteger(copy.event_id)) {
      throw new RangeError('cavity evolution event_id must be monotonic');
    }
    if (copy.pre_state_digest !== state.signature) {
      throw new RangeError('cavity evolution pre-state digest mismatch');
    }
    if (!Number.isInteger(copy.step) || copy.step < 0 || !copy.chemistry_transaction_id) {
      throw new RangeError('cavity evolution step/chemistry transaction identity is invalid');
    }
    const finiteKeys = [
      'attempted_formula_extent_mmolkg', 'accepted_formula_extent_mmolkg',
      'target_volume_delta_mm3_per_kg', 'achieved_volume_delta_mm3_per_kg',
      'volume_residual_mm3_per_kg', 'volume_tolerance_mm3_per_kg', 'old_capacity_volume_mm3',
      'new_capacity_volume_mm3', 'old_equivalent_diameter_mm',
      'new_equivalent_diameter_mm',
    ];
    for (const key of finiteKeys) {
      if (!Number.isFinite(Number(copy[key]))) throw new TypeError('non-finite cavity entry field: ' + key);
    }
    if (copy.accepted_formula_extent_mmolkg < 0
        || copy.accepted_formula_extent_mmolkg > copy.attempted_formula_extent_mmolkg + 1e-12
        || copy.target_volume_delta_mm3_per_kg < 0
        || copy.achieved_volume_delta_mm3_per_kg < 0) {
      throw new RangeError('cavity evolution accepted extent/volume is out of bounds');
    }
    if (Math.abs(copy.volume_residual_mm3_per_kg) > copy.volume_tolerance_mm3_per_kg) {
      throw new RangeError('cavity evolution volume residual exceeds its disclosed tolerance');
    }
    if (!copy.molar_volume || copy.molar_volume.approximation !== 'standard_state_crystalline'
        || !Number.isFinite(Number(copy.molar_volume.value_cm3_mol))
        || !(Number(copy.molar_volume.value_cm3_mol) > 0)
        || !Number.isFinite(Number(copy.molar_volume.uncertainty_cm3_mol))
        || !(Number(copy.molar_volume.uncertainty_cm3_mol) > 0)
        || Number(copy.molar_volume.reference_temperature_C) !== 26) {
      throw new RangeError('cavity evolution entry lacks standard-state molar-volume provenance');
    }
    const closes = (actual: number, expected: number, scale = 1): boolean => {
      const tolerance = Math.max(1e-10, Math.abs(scale) * 1e-10);
      return Math.abs(actual - expected) <= tolerance;
    };
    const expectedTarget = Number(copy.accepted_formula_extent_mmolkg)
      * Number(copy.molar_volume.value_cm3_mol);
    if (!closes(Number(copy.target_volume_delta_mm3_per_kg), expectedTarget, expectedTarget)) {
      throw new RangeError('cavity evolution target does not close against formula extent and molar volume');
    }
    const expectedResidual = Number(copy.achieved_volume_delta_mm3_per_kg)
      - Number(copy.target_volume_delta_mm3_per_kg);
    if (!closes(Number(copy.volume_residual_mm3_per_kg), expectedResidual,
      Number(copy.target_volume_delta_mm3_per_kg))) {
      throw new RangeError('cavity evolution residual does not close against achieved minus target volume');
    }
    const expectedCapacity = Number(copy.old_capacity_volume_mm3)
      + Number(copy.achieved_volume_delta_mm3_per_kg);
    if (!closes(Number(copy.new_capacity_volume_mm3), expectedCapacity, expectedCapacity)) {
      throw new RangeError('cavity evolution capacity does not close against achieved volume');
    }
    const diameterForCapacity = (volume: number): number => 2 * Math.cbrt((3 * volume) / (4 * Math.PI));
    const expectedOldDiameter = diameterForCapacity(Number(copy.old_capacity_volume_mm3));
    const expectedNewDiameter = diameterForCapacity(Number(copy.new_capacity_volume_mm3));
    if (!closes(Number(copy.old_equivalent_diameter_mm), expectedOldDiameter, expectedOldDiameter)
        || !closes(Number(copy.new_equivalent_diameter_mm), expectedNewDiameter, expectedNewDiameter)) {
      throw new RangeError('cavity evolution equivalent diameter is not derived from capacity');
    }
    if (!Array.isArray(copy.vertex_deltas) || !copy.vertex_deltas.length) {
      throw new RangeError('cavity evolution entry requires ordered vertex deltas');
    }
    const priorDepths = this.materialize();
    const nextDepths = new Float64Array(priorDepths);
    let priorIndex = -1;
    for (const delta of copy.vertex_deltas) {
      if (!Number.isInteger(delta.vertex_index) || delta.vertex_index <= priorIndex
          || delta.vertex_index >= this.baseline_depths_mm.length) {
        throw new RangeError('cavity evolution vertex deltas must be unique and ordered');
      }
      priorIndex = delta.vertex_index;
      for (const key of ['old_depth_mm', 'new_depth_mm', 'delta_mm']) {
        if (!Number.isFinite(Number(delta[key]))) throw new TypeError('non-finite cavity vertex delta');
      }
      if (Math.abs((delta.old_depth_mm + delta.delta_mm) - delta.new_depth_mm) > 1e-10
          || !(delta.delta_mm > 0)) {
        throw new RangeError('cavity erosion vertex delta does not close');
      }
      if (Math.abs(priorDepths[delta.vertex_index] - delta.old_depth_mm) > 1e-10) {
        throw new RangeError('cavity evolution ledger has a broken depth chain');
      }
      nextDepths[delta.vertex_index] = delta.new_depth_mm;
    }
    if (!copy.exposure || !copy.exposure.digest || !copy.fluid_receipt
        || !copy.host_inventory_receipt || !copy.scientific_scope) {
      throw new RangeError('cavity evolution entry is missing authority receipts');
    }
    if (this.model === CAVITY_PRODUCTION_VOLUME_MODEL) {
      const authority = copy.geometry_authority;
      if (!authority) {
        throw new RangeError('Cartesian cavity evolution entry is missing its geometry authority receipt');
      }
      CavityProductionAuthority.validateAuthorityReceipt(authority, {
        entry: copy,
        previousAuthority: state.entries.length
          ? state.entries[state.entries.length - 1].geometry_authority : null,
        expectedOldDepthDigest: this._depthProjectionDigest(priorDepths),
        expectedNewDepthDigest: this._depthProjectionDigest(nextDepths),
      });
    } else if (copy.geometry_authority != null) {
      throw new RangeError('WallMesh evolution entry cannot claim Cartesian geometry authority');
    }
    return copy;
  }

  append(entry: any): any {
    const state = _cavityLedgerPrivateState(this);
    const copy = this._validateEntry(entry);
    const suppliedDigest = copy.entry_digest == null ? null : String(copy.entry_digest);
    const computedDigest = CavityEvolutionLedger.digest(copy);
    if (suppliedDigest != null && suppliedDigest !== computedDigest) {
      throw new RangeError('cavity evolution entry digest mismatch');
    }
    copy.entry_digest = computedDigest;
    const frozen = CavityEvolutionLedger._deepFreeze(copy);
    state.entries.push(frozen);
    state.signature = 'cavity-evolution:v1:' + CavityEvolutionLedger.digest({
      prior: state.signature,
      entry: copy.entry_digest,
    });
    state.signatures.push(state.signature);
    state.generation++;
    return frozen;
  }

  materialize(cursor = _cavityLedgerPrivateState(this).entries.length): Float64Array {
    return new Float64Array(_cavityLedgerDepthProjection(this, cursor));
  }

  assertProjection(wall: any, cursor = _cavityLedgerPrivateState(this).entries.length): true {
    const expected = _cavityLedgerDepthProjection(this, cursor);
    let index = 0;
    for (const ring of wall.rings || []) {
      for (const cell of ring) {
        if (Math.abs((Number(cell.wall_depth) || 0) - expected[index]) > 1e-10) {
          throw new RangeError('WallState wall_depth diverged from the cavity evolution ledger at vertex ' + index);
        }
        index++;
      }
    }
    if (index !== expected.length) throw new RangeError('WallState tessellation diverged from its cavity evolution ledger');
    return true;
  }

  previewErosion(wall: any, mesh: any, opts: any): any {
    const target = Number(opts && opts.target_volume_delta_mm3_per_kg);
    const weightsInput = opts && opts.vertex_weights;
    if (!(target > 0) || !Number.isFinite(target)) {
      throw new RangeError('cavity erosion target volume must be positive and finite');
    }
    if (!mesh || typeof mesh.closedVolumeWithDepthDeltasMm3 !== 'function'
        || !weightsInput || weightsInput.length !== mesh.numInterior) {
      throw new RangeError('cavity erosion requires canonical mesh-sized vertex weights');
    }
    this.assertProjection(wall);
    if (this.model === CAVITY_PRODUCTION_VOLUME_MODEL) {
      return CavityProductionAuthority.previewErosion(wall, weightsInput, {
        target_volume_delta_mm3_per_kg: target,
        contract: wall && wall._cavityProductionAuthorityContract,
      });
    }
    const weights = new Float64Array(mesh.numInterior);
    let maxWeight = 0;
    for (let i = 0; i < weights.length; i++) {
      const value = Number(weightsInput[i]);
      if (!(value >= 0) || !Number.isFinite(value)) throw new TypeError('cavity erosion weight is invalid');
      weights[i] = value;
      if (value > maxWeight) maxWeight = value;
    }
    if (!(maxWeight > 0)) throw new RangeError('cavity erosion has no exposed reactive surface');
    for (let i = 0; i < weights.length; i++) weights[i] /= maxWeight;

    const oldVolume = mesh.closedVolumeMm3();
    const desiredVolume = oldVolume + target;
    const candidate = (lambda: number): { volume: number; deltas: Float64Array } => {
      const deltas = new Float64Array(weights.length);
      for (let i = 0; i < weights.length; i++) deltas[i] = lambda * weights[i];
      return { volume: mesh.closedVolumeWithDepthDeltasMm3(wall, deltas), deltas };
    };
    const surfaceArea = Math.max(_wallMeshSurfaceAreaInternal(mesh), 1e-12);
    // Every candidate vertex is p + lambda*q. The oriented tetrahedron
    // volume is therefore exactly cubic in lambda. Four full-mesh samples
    // identify that polynomial; the remaining root iterations are scalar and
    // deterministic. One final mesh sample verifies the solved transaction.
    const h = Math.max(target / surfaceArea, 1e-9);
    const y0 = oldVolume;
    const y1 = candidate(h).volume;
    const y2 = candidate(2 * h).volume;
    const y3 = candidate(3 * h).volume;
    const A = y1 - y0;
    const B = y2 - y0;
    const C = y3 - y0;
    const cubic = (C - 3 * B + 3 * A) / 6;
    const quadratic = (B - 2 * A - 6 * cubic) / 2;
    const linear = A - cubic - quadratic;
    const volumeAtT = (t: number) => y0 + linear * t + quadratic * t * t + cubic * t * t * t;
    let loT = 0;
    let hiT = 1;
    for (let guard = 0; volumeAtT(hiT) < desiredVolume && guard < 60; guard++) hiT *= 2;
    let solved: { volume: number; deltas: Float64Array };
    if (volumeAtT(hiT) >= desiredVolume) {
      for (let iteration = 0; iteration < 80; iteration++) {
        const mid = (loT + hiT) * 0.5;
        if (volumeAtT(mid) < desiredVolume) loT = mid;
        else hiT = mid;
      }
      solved = candidate(h * (loT + hiT) * 0.5);
    } else {
      // Float32 quantization can dominate extremely small late-stage targets
      // and make the four sampled values a poor cubic fit. Fall back to a
      // bounded monotonic search against the actual renderer buffer. This is
      // rare; ordinary transactions retain the five-mesh-evaluation path.
      let loLambda = 0;
      let hiLambda = h;
      let high = candidate(hiLambda);
      for (let guard = 0; high.volume < desiredVolume && guard < 60; guard++) {
        hiLambda *= 2;
        high = candidate(hiLambda);
      }
      if (high.volume < desiredVolume) {
        throw new RangeError('cavity erosion renderer geometry could not bracket target volume');
      }
      let low = candidate(loLambda);
      for (let iteration = 0; iteration < 36; iteration++) {
        const mid = (loLambda + hiLambda) * 0.5;
        const value = candidate(mid);
        if (value.volume < desiredVolume) { loLambda = mid; low = value; }
        else { hiLambda = mid; high = value; }
      }
      solved = Math.abs(low.volume - desiredVolume) <= Math.abs(high.volume - desiredVolume)
        ? low : high;
    }
    let achieved = solved.volume - oldVolume;
    let residual = achieved - target;
    const maxRadius = Math.max(Number(mesh.max_radius_mm) || 0, 1e-9);
    const float32UlpMm = Math.pow(2, Math.floor(Math.log2(maxRadius)) - 23);
    // The renderer stores positions in Float32. Its smallest possible radial
    // surface move produces a finite volume quantum; claiming tighter closure
    // would be false precision. Two area*ULP quanta conservatively include
    // irregular incidence and the mean-depth pole caps.
    const rendererQuantizationTolerance = surfaceArea * float32UlpMm * 2;
    const tolerance = Math.max(
      1e-8, target * 1e-8, oldVolume * 1e-12, rendererQuantizationTolerance,
    );
    if (Math.abs(residual) > tolerance) {
      let loLambda = 0;
      let hiLambda = h;
      let low = candidate(loLambda);
      let high = candidate(hiLambda);
      for (let guard = 0; high.volume < desiredVolume && guard < 60; guard++) {
        hiLambda *= 2;
        high = candidate(hiLambda);
      }
      if (high.volume >= desiredVolume) {
        for (let iteration = 0; iteration < 36; iteration++) {
          const mid = (loLambda + hiLambda) * 0.5;
          const value = candidate(mid);
          if (value.volume < desiredVolume) { loLambda = mid; low = value; }
          else { hiLambda = mid; high = value; }
        }
        solved = Math.abs(low.volume - desiredVolume) <= Math.abs(high.volume - desiredVolume)
          ? low : high;
        achieved = solved.volume - oldVolume;
        residual = achieved - target;
      }
    }
    if (Math.abs(residual) > tolerance) {
      throw new RangeError('cavity erosion volume residual ' + residual
        + ' exceeds tolerance ' + tolerance + ' for target ' + target);
    }
    const currentDepths = this.materialize();
    const vertexDeltas: any[] = [];
    for (let i = 0; i < solved.deltas.length; i++) {
      if (!(solved.deltas[i] > 0)) continue;
      vertexDeltas.push({
        vertex_index: i,
        old_depth_mm: currentDepths[i],
        new_depth_mm: currentDepths[i] + solved.deltas[i],
        delta_mm: solved.deltas[i],
      });
    }
    return {
      target_volume_delta_mm3_per_kg: target,
      achieved_volume_delta_mm3_per_kg: achieved,
      volume_residual_mm3_per_kg: residual,
      volume_tolerance_mm3_per_kg: tolerance,
      old_capacity_volume_mm3: oldVolume,
      new_capacity_volume_mm3: solved.volume,
      vertex_deltas: vertexDeltas,
    };
  }

  commitEntry(wall: any, entry: any): any {
    this.assertProjection(wall);
    const state = _cavityLedgerPrivateState(this);
    const frozen = this.append(entry);
    const applied: any[] = [];
    try {
      for (const delta of frozen.vertex_deltas) {
        const ring = Math.floor(delta.vertex_index / wall.cells_per_ring);
        const cell = delta.vertex_index % wall.cells_per_ring;
        const target = wall.rings[ring][cell];
        if (Math.abs((Number(target.wall_depth) || 0) - delta.old_depth_mm) > 1e-10) {
          throw new RangeError('cavity wall changed after transaction preview');
        }
        target.wall_depth = delta.new_depth_mm;
        applied.push({ target, old: delta.old_depth_mm });
      }
      return frozen;
    } catch (error) {
      for (let i = applied.length - 1; i >= 0; i--) applied[i].target.wall_depth = applied[i].old;
      state.entries.pop();
      state.signatures.pop();
      state.signature = state.signatures[state.signatures.length - 1];
      state.generation++;
      const projections = CAVITY_LEDGER_DEPTH_PROJECTIONS.get(this);
      if (projections) projections.length = state.entries.length + 1;
      throw error;
    }
  }

  rollbackLast(wall: any, eventId: number): void {
    const state = _cavityLedgerPrivateState(this);
    const entry = state.entries[state.entries.length - 1];
    if (!entry || entry.event_id !== eventId) throw new RangeError('cannot roll back a non-tail cavity event');
    for (let i = entry.vertex_deltas.length - 1; i >= 0; i--) {
      const delta = entry.vertex_deltas[i];
      const ring = Math.floor(delta.vertex_index / wall.cells_per_ring);
      const cell = delta.vertex_index % wall.cells_per_ring;
      wall.rings[ring][cell].wall_depth = delta.old_depth_mm;
    }
    state.entries.pop();
    state.signatures.pop();
    state.signature = state.signatures[state.signatures.length - 1];
    state.generation++;
    const projections = CAVITY_LEDGER_DEPTH_PROJECTIONS.get(this);
    if (projections) projections.length = state.entries.length + 1;
  }

  toJSON(): any {
    return CavityEvolutionLedger._clone({
      schema: this.schema,
      model: this.model,
      shape_identity: this.shape_identity,
      tessellation_identity: this.tessellation_identity,
      baseline_kind: this.baseline_kind,
      baseline_disclosure: this.baseline_disclosure,
      baseline_depths_mm: this.baseline_depths_mm,
      entries: _cavityLedgerPrivateState(this).entries,
    });
  }
}
