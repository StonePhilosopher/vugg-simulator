// ============================================================
// js/23d-geometry-cavity-production-authority.ts
// ============================================================
// Mass/geometry preflight and immutable production contract for the Cartesian
// cavity. Since v266 every simulator selects this authority before water,
// chemistry, or nucleation can observe geometry. Its core rule is:
// chemistry may commit only after the exact extracted surface for the proposed
// wall depths exists, is a closed two-manifold, and encloses the booked volume.

const CAVITY_PRODUCTION_AUTHORITY_SCHEMA = 'cavity-production-authority-v1';
const CAVITY_PRODUCTION_VOLUME_MODEL = 'cartesian-field-freudenthal-volume-v2';
const CAVITY_PRODUCTION_SCIENTIFIC_RESOLUTION = 48;
const CAVITY_PRODUCTION_REFERENCE_RESOLUTION = 64;
const CAVITY_PRODUCTION_ISOVALUE = 0;
// Presentation hardware never changes these scientific geometry parameters.
// Kept as an executed runtime value so release receipts cannot substitute a
// prose-only claim about player quality controls.
const CAVITY_PRODUCTION_PLAYER_QUALITY_CONTROL = false;
const CAVITY_PRODUCTION_MAX_AGREEMENT_VOXELS = 0.75;
const CAVITY_PRODUCTION_MAX_VOLUME_CONVERGENCE_FRACTION = 0.02;
const CAVITY_PRODUCTION_CONTRACT_CACHE_LIMIT = 128;
// Exact scientific contracts are immutable and depend only on the authenticated
// authored geometry/depth identity plus the model constants above. Reusing one
// avoids repeating the 48^3/64^3 commissioning proof when a scenario is replayed
// with another game seed; the live field is still independently extracted and
// byte-authenticated before it becomes that WallState's provider.
const CAVITY_PRODUCTION_CONTRACT_CACHE = new Map<string, any>();
// An erosion plan is an in-process capability, not merely a digest-bearing
// JSON object. Only the exact frozen plan returned by preview may reuse its
// measured 48^3 surface and 64^3 convergence proof at commit time.
const CAVITY_PRODUCTION_EROSION_PLANS = new WeakMap<object, any>();

class CavityProductionAuthority {
  static _closes(actual: any, expected: any, scale: any = 1): boolean {
    const a = Number(actual), e = Number(expected), s = Number(scale);
    return Number.isFinite(a) && Number.isFinite(e) && Number.isFinite(s)
      && Math.abs(a - e) <= Math.max(1e-10, Math.abs(s) * 1e-10);
  }

  static validateAuthorityReceipt(receipt: any, opts: any = {}): true {
    if (!receipt || receipt.schema !== CAVITY_PRODUCTION_AUTHORITY_SCHEMA
        || receipt.volume_model !== CAVITY_PRODUCTION_VOLUME_MODEL
        || receipt.resolution !== CAVITY_PRODUCTION_SCIENTIFIC_RESOLUTION
        || receipt.isovalue !== CAVITY_PRODUCTION_ISOVALUE
        || typeof receipt.production_contract_digest !== 'string'
        || !receipt.production_contract_digest) {
      throw new RangeError('invalid Cartesian cavity geometry authority identity');
    }
    const payload = CavityEvolutionLedger._clone(receipt);
    const suppliedDigest = payload.receipt_digest;
    delete payload.receipt_digest;
    if (typeof suppliedDigest !== 'string'
        || suppliedDigest !== CavityEvolutionLedger.digest(payload)) {
      throw new RangeError('Cartesian cavity geometry authority receipt digest mismatch');
    }
    const provenanceKeys = [
      'old_depth_projection_digest', 'new_depth_projection_digest',
      'old_field_snapshot_digest', 'new_field_snapshot_digest',
      'old_surface_buffer_digest', 'new_surface_buffer_digest',
    ];
    if (provenanceKeys.some(key => typeof receipt[key] !== 'string' || !receipt[key])) {
      throw new RangeError('Cartesian cavity geometry authority lacks field/depth provenance');
    }
    const finiteKeys = [
      'old_volume_mm3', 'new_volume_mm3', 'target_volume_delta_mm3_per_kg',
      'achieved_volume_delta_mm3_per_kg', 'volume_residual_mm3_per_kg',
      'volume_tolerance_mm3_per_kg',
    ];
    if (finiteKeys.some(key => !Number.isFinite(Number(receipt[key])))
        || !(Number(receipt.old_volume_mm3) > 0)
        || !(Number(receipt.new_volume_mm3) > 0)
        || !(Number(receipt.target_volume_delta_mm3_per_kg) > 0)
        || !(Number(receipt.achieved_volume_delta_mm3_per_kg) > 0)
        || !(Number(receipt.volume_tolerance_mm3_per_kg) >= 0)
        || !CavityProductionAuthority._closes(
          Number(receipt.new_volume_mm3) - Number(receipt.old_volume_mm3),
          receipt.achieved_volume_delta_mm3_per_kg,
          receipt.achieved_volume_delta_mm3_per_kg,
        )
        || !CavityProductionAuthority._closes(
          Number(receipt.achieved_volume_delta_mm3_per_kg)
            - Number(receipt.target_volume_delta_mm3_per_kg),
          receipt.volume_residual_mm3_per_kg,
          receipt.target_volume_delta_mm3_per_kg,
        )
        || Math.abs(Number(receipt.volume_residual_mm3_per_kg))
          > Number(receipt.volume_tolerance_mm3_per_kg)) {
      throw new RangeError('Cartesian cavity geometry authority volume semantics do not close');
    }
    if (!Number.isInteger(receipt.field_build_and_extract_evaluations)
        || receipt.field_build_and_extract_evaluations !== 2
        || !Number.isInteger(receipt.volume_only_field_evaluations)
        || receipt.volume_only_field_evaluations < 1
        || receipt.full_surface_extract_evaluations?.production_48 !== 1
        || receipt.full_surface_extract_evaluations?.reference_64 !== 1
        || receipt.full_surface_extract_evaluations?.provider_install !== 0) {
      throw new RangeError('Cartesian cavity geometry authority evaluation count is invalid');
    }
    const agreement = receipt.agreement;
    if (!agreement || agreement.schema !== 'cavity-surface-agreement-v1'
        || !Number.isInteger(agreement.barycentric_subdivisions)
        || agreement.barycentric_subdivisions < 1
        || !(Number(agreement.numerical_zero_tolerance) > 0)
        || agreement.unresolved_sample_count !== 0
        || !(Number(agreement.max_field_residual) >= 0)
        || Number(agreement.max_field_residual)
          > Number(agreement.numerical_zero_tolerance)
        || !(Number(agreement.max_normal_root_distance_voxels) >= 0)
        || Number(agreement.max_normal_root_distance_voxels)
          > CAVITY_PRODUCTION_MAX_AGREEMENT_VOXELS
        || agreement.maximum_allowed_voxels !== CAVITY_PRODUCTION_MAX_AGREEMENT_VOXELS) {
      throw new RangeError('Cartesian cavity geometry authority agreement gate is invalid');
    }
    const convergence = receipt.volume_convergence;
    const boundsValid = (values: any) => Array.isArray(values) && values.length === 3
      && values.every(Number.isFinite);
    if (!convergence || convergence.schema !== 'cavity-volume-convergence-v1'
        || convergence.production_resolution !== CAVITY_PRODUCTION_SCIENTIFIC_RESOLUTION
        || convergence.reference_resolution !== CAVITY_PRODUCTION_REFERENCE_RESOLUTION
        || convergence.maximum_allowed_fraction
          !== CAVITY_PRODUCTION_MAX_VOLUME_CONVERGENCE_FRACTION
        || !(Number(convergence.production_volume_mm3) > 0)
        || !(Number(convergence.reference_volume_mm3) > 0)
        || !CavityProductionAuthority._closes(
          convergence.production_volume_mm3, receipt.new_volume_mm3, receipt.new_volume_mm3)
        || !CavityProductionAuthority._closes(
          convergence.relative_difference,
          Math.abs(Number(convergence.production_volume_mm3)
            - Number(convergence.reference_volume_mm3))
            / Number(convergence.reference_volume_mm3),
          1,
        )
        || Number(convergence.relative_difference)
          > CAVITY_PRODUCTION_MAX_VOLUME_CONVERGENCE_FRACTION
        || !boundsValid(convergence.shared_bounds_min_mm)
        || !boundsValid(convergence.shared_bounds_max_mm)
        || typeof convergence.reference_field_snapshot_digest !== 'string'
        || !convergence.reference_field_snapshot_digest
        || typeof convergence.reference_surface_buffer_digest !== 'string'
        || !convergence.reference_surface_buffer_digest) {
      throw new RangeError('Cartesian cavity geometry authority convergence gate is invalid');
    }
    const entry = opts.entry;
    if (entry) {
      for (const key of [
        'target_volume_delta_mm3_per_kg', 'achieved_volume_delta_mm3_per_kg',
        'volume_residual_mm3_per_kg', 'volume_tolerance_mm3_per_kg',
      ]) {
        if (!CavityProductionAuthority._closes(receipt[key], entry[key], entry[key] || 1)) {
          throw new RangeError(`Cartesian cavity geometry authority diverges from entry ${key}`);
        }
      }
      if (!CavityProductionAuthority._closes(
        receipt.old_volume_mm3, entry.old_capacity_volume_mm3, entry.old_capacity_volume_mm3)
          || !CavityProductionAuthority._closes(
            receipt.new_volume_mm3, entry.new_capacity_volume_mm3, entry.new_capacity_volume_mm3)) {
        throw new RangeError('Cartesian cavity geometry authority diverges from entry capacity');
      }
    }
    const previous = opts.previousAuthority;
    if (previous && (receipt.production_contract_digest !== previous.production_contract_digest
        || receipt.old_depth_projection_digest !== previous.new_depth_projection_digest
        || receipt.old_field_snapshot_digest !== previous.new_field_snapshot_digest
        || receipt.old_surface_buffer_digest !== previous.new_surface_buffer_digest
        || !CavityProductionAuthority._closes(
          receipt.old_volume_mm3, previous.new_volume_mm3, previous.new_volume_mm3))) {
      throw new RangeError('Cartesian cavity geometry authority provenance chain is broken');
    }
    if (opts.expectedOldDepthDigest
        && receipt.old_depth_projection_digest !== opts.expectedOldDepthDigest) {
      throw new RangeError('Cartesian cavity geometry authority old depth provenance is invalid');
    }
    if (opts.expectedNewDepthDigest
        && receipt.new_depth_projection_digest !== opts.expectedNewDepthDigest) {
      throw new RangeError('Cartesian cavity geometry authority new depth provenance is invalid');
    }
    const contract = opts.contract;
    if (contract) {
      CavityProductionAuthority.assertContract(opts.wall, contract);
      if (receipt.production_contract_digest !== contract.contract_digest
          || receipt.resolution !== contract.scientific_resolution
          || receipt.isovalue !== contract.isovalue) {
        throw new RangeError('Cartesian cavity geometry authority differs from production contract');
      }
      if (!previous && (receipt.old_depth_projection_digest
          !== contract.baseline_depth_projection_digest
          || receipt.old_field_snapshot_digest !== contract.baseline_field_snapshot_digest
          || receipt.old_surface_buffer_digest !== contract.baseline_surface_buffer_digest
          || !CavityProductionAuthority._closes(
            receipt.old_volume_mm3, contract.baseline_volume_mm3,
            contract.baseline_volume_mm3))) {
        throw new RangeError('Cartesian cavity geometry authority does not start at contract baseline');
      }
    }
    return true;
  }

  static _depthsFromWall(wall: any): Float64Array {
    if (!wall || !Array.isArray(wall.rings) || !wall.rings.length) {
      throw new TypeError('Cartesian cavity authority requires a populated WallState');
    }
    const depths = new Float64Array(wall.ring_count * wall.cells_per_ring);
    let index = 0;
    for (const ring of wall.rings) {
      if (!Array.isArray(ring) || ring.length !== wall.cells_per_ring) {
        throw new RangeError('Cartesian cavity authority requires a dense chemistry projection');
      }
      for (const cell of ring) {
        const depth = Number(cell && cell.wall_depth);
        if (!(depth >= 0) || !Number.isFinite(depth)) {
          throw new RangeError('Cartesian cavity authority received an invalid wall depth');
        }
        depths[index++] = depth;
      }
    }
    if (index !== depths.length) {
      throw new RangeError('Cartesian cavity authority tessellation size mismatch');
    }
    return depths;
  }

  static _depthDigest(wall: any, depths: ArrayLike<number>): string {
    if (!depths || depths.length !== wall.ring_count * wall.cells_per_ring) {
      throw new RangeError('Cartesian cavity authority depth projection size mismatch');
    }
    const normalized = Array.from(depths, (value: any) => {
      const number = Number(value);
      if (!(number >= 0) || !Number.isFinite(number)) {
        throw new RangeError('Cartesian cavity authority depth projection is invalid');
      }
      return number;
    });
    return 'cavity-depth-projection:v1:' + CavityEvolutionLedger.digest({
      model: CAVITY_PRODUCTION_VOLUME_MODEL,
      identity: CavityEvolutionLedger.identityForWall(wall),
      depths_mm: normalized,
    });
  }

  static _fieldForDepths(wall: any, depths: ArrayLike<number>, opts: any = {}): any {
    const resolution = CavityScalarField._resolution(
      opts.resolution == null ? CAVITY_PRODUCTION_SCIENTIFIC_RESOLUTION : opts.resolution,
    );
    const bubbles = CavityScalarField._validatedBubbles(wall.bubbles);
    const shape = CavityScalarField.shapeFor(wall);
    const depthDigest = CavityProductionAuthority._depthDigest(wall, depths);
    const evolution = {
      ring_count: wall.ring_count,
      cells_per_ring: wall.cells_per_ring,
      depths_mm: new Float64Array(Array.from(depths, Number)),
      signature: depthDigest,
    };
    return CavityScalarField.fromBubbles(bubbles, {
      resolution,
      shape,
      evolution,
      frame: opts.frame || null,
      sig: `cavity-field-preflight:v2|${resolution}^3|${depthDigest}|f:${CavityScalarField._frameSignature(opts.frame, resolution)}`,
    });
  }

  static _surfaceState(wall: any, depths: ArrayLike<number>, opts: any = {}): any {
    const resolution = CavityScalarField._resolution(
      opts.resolution == null ? CAVITY_PRODUCTION_SCIENTIFIC_RESOLUTION : opts.resolution,
    );
    const isovalue = opts.isovalue == null ? CAVITY_PRODUCTION_ISOVALUE : Number(opts.isovalue);
    if (!Number.isFinite(isovalue)) throw new TypeError('Cartesian cavity isovalue must be finite');
    const field = opts.field || CavityProductionAuthority._fieldForDepths(wall, depths, {
      resolution, frame: opts.frame || null,
    });
    if (!(field instanceof CavityScalarField) || field.sizeX !== resolution
        || field.sizeY !== resolution || field.sizeZ !== resolution) {
      throw new RangeError('Cartesian cavity surface state received a foreign field');
    }
    const surface = field.extract(isovalue);
    MarchingCubesExtractor.verifyBuffers(surface);
    if (!field.hasNegativeBorder(isovalue)
        || surface.topology?.negative_border !== true
        || surface.topology?.nonempty !== true
        || surface.topology?.closed_two_manifold !== true) {
      throw new RangeError('Cartesian cavity preflight did not produce a closed two-manifold');
    }
    const agreement = opts.measureAgreement
      ? MarchingCubesExtractor.measureImplicitAgreement(field, surface, 2) : null;
    if (agreement && (agreement.unresolved_sample_count !== 0
        || agreement.max_field_residual > agreement.numerical_zero_tolerance
        || agreement.max_normal_root_distance_voxels
          > CAVITY_PRODUCTION_MAX_AGREEMENT_VOXELS)) {
      throw new RangeError(`Cartesian cavity surface exceeds the field-agreement tolerance: ${JSON.stringify({
        unresolved_sample_count: agreement.unresolved_sample_count,
        max_field_residual: agreement.max_field_residual,
        max_normal_root_distance_voxels: agreement.max_normal_root_distance_voxels,
        maximum_allowed_voxels: CAVITY_PRODUCTION_MAX_AGREEMENT_VOXELS,
      })}`);
    }
    return Object.freeze({
      field,
      surface,
      volume_mm3: MarchingCubesExtractor.closedVolumeMm3(surface),
      surface_area_mm2: MarchingCubesExtractor.surfaceAreaMm2(surface),
      depth_projection_digest: CavityProductionAuthority._depthDigest(wall, depths),
      agreement,
    });
  }

  static _contractPayload(contract: any): any {
    const payload = JSON.parse(JSON.stringify(contract));
    delete payload.contract_digest;
    return payload;
  }

  static _referenceFrame(frame: any): any {
    const base = CavityScalarField._validatedFrame(
      frame, CAVITY_PRODUCTION_SCIENTIFIC_RESOLUTION,
    );
    return Object.freeze({
      dimensions: Object.freeze([
        CAVITY_PRODUCTION_REFERENCE_RESOLUTION,
        CAVITY_PRODUCTION_REFERENCE_RESOLUTION,
        CAVITY_PRODUCTION_REFERENCE_RESOLUTION,
      ]),
      origin_mm: Object.freeze(base.origin_mm.slice()),
      spacing_mm: base.spacing_mm
        * (CAVITY_PRODUCTION_SCIENTIFIC_RESOLUTION - 1)
        / (CAVITY_PRODUCTION_REFERENCE_RESOLUTION - 1),
    });
  }

  static _convergenceReceipt(wall: any, depths: ArrayLike<number>,
                             productionState: any, frame: any): any {
    const referenceFrame = CavityProductionAuthority._referenceFrame(frame);
    const reference = CavityProductionAuthority._surfaceState(wall, depths, {
      resolution: CAVITY_PRODUCTION_REFERENCE_RESOLUTION,
      isovalue: CAVITY_PRODUCTION_ISOVALUE,
      frame: referenceFrame,
    });
    const relativeDifference = Math.abs(
      productionState.volume_mm3 - reference.volume_mm3,
    ) / Math.max(reference.volume_mm3, 1e-12);
    if (!Number.isFinite(relativeDifference)
        || relativeDifference > CAVITY_PRODUCTION_MAX_VOLUME_CONVERGENCE_FRACTION) {
      throw new RangeError('Cartesian cavity 48-to-64 volume convergence gate failed');
    }
    return Object.freeze({
      schema: 'cavity-volume-convergence-v1',
      production_resolution: CAVITY_PRODUCTION_SCIENTIFIC_RESOLUTION,
      reference_resolution: CAVITY_PRODUCTION_REFERENCE_RESOLUTION,
      shared_bounds_min_mm: Object.freeze(productionState.field.bounds.min.slice()),
      shared_bounds_max_mm: Object.freeze(productionState.field.bounds.max.slice()),
      production_volume_mm3: productionState.volume_mm3,
      reference_volume_mm3: reference.volume_mm3,
      relative_difference: relativeDifference,
      maximum_allowed_fraction: CAVITY_PRODUCTION_MAX_VOLUME_CONVERGENCE_FRACTION,
      reference_field_snapshot_digest: reference.field.snapshotDigest,
      reference_surface_buffer_digest: reference.surface.buffer_digest,
    });
  }

  static _assertMeasuredEvidence(wall: any, depths: ArrayLike<number>, state: any,
                                 expectedAgreement: any, expectedConvergence: any,
                                 frame: any): any {
    const agreement = state.agreement
      || MarchingCubesExtractor.measureImplicitAgreement(state.field, state.surface, 2);
    const expectedAgreementSchema = expectedAgreement?.schema
      || expectedAgreement?.metric_schema;
    if (!expectedAgreement
        || expectedAgreementSchema !== agreement.schema
        || expectedAgreement.barycentric_subdivisions
          !== agreement.barycentric_subdivisions
        || !CavityProductionAuthority._closes(
          expectedAgreement.numerical_zero_tolerance,
          agreement.numerical_zero_tolerance,
          agreement.numerical_zero_tolerance,
        )
        || expectedAgreement.unresolved_sample_count
          !== agreement.unresolved_sample_count
        || !CavityProductionAuthority._closes(
          expectedAgreement.max_field_residual,
          agreement.max_field_residual,
          Math.max(agreement.numerical_zero_tolerance, 1e-12),
        )
        || !CavityProductionAuthority._closes(
          expectedAgreement.max_normal_root_distance_voxels,
          agreement.max_normal_root_distance_voxels,
          1,
        )
        || expectedAgreement.maximum_allowed_voxels
          !== CAVITY_PRODUCTION_MAX_AGREEMENT_VOXELS
        || agreement.unresolved_sample_count !== 0
        || agreement.max_field_residual > agreement.numerical_zero_tolerance
        || agreement.max_normal_root_distance_voxels
          > CAVITY_PRODUCTION_MAX_AGREEMENT_VOXELS) {
      throw new RangeError('Cartesian cavity field-agreement evidence was not reproduced');
    }

    // A receipt digest proves only that a record is internally intact.  The
    // independently extracted 64^3 reference is repeated at every binding
    // boundary so a self-consistent forged convergence record cannot become
    // geometry authority merely by recomputing its digest.
    const convergence = CavityProductionAuthority._convergenceReceipt(
      wall, depths, state, frame,
    );
    const vectorCloses = (actual: any, expected: any) => Array.isArray(actual)
      && Array.isArray(expected) && actual.length === 3 && expected.length === 3
      && actual.every((value: any, index: number) => CavityProductionAuthority._closes(
        value, expected[index], Math.max(Math.abs(Number(expected[index])) || 0, 1),
      ));
    if (!expectedConvergence
        || expectedConvergence.schema !== convergence.schema
        || expectedConvergence.production_resolution !== convergence.production_resolution
        || expectedConvergence.reference_resolution !== convergence.reference_resolution
        || expectedConvergence.maximum_allowed_fraction
          !== convergence.maximum_allowed_fraction
        || !vectorCloses(
          expectedConvergence.shared_bounds_min_mm, convergence.shared_bounds_min_mm)
        || !vectorCloses(
          expectedConvergence.shared_bounds_max_mm, convergence.shared_bounds_max_mm)
        || !CavityProductionAuthority._closes(
          expectedConvergence.production_volume_mm3,
          convergence.production_volume_mm3,
          convergence.production_volume_mm3,
        )
        || !CavityProductionAuthority._closes(
          expectedConvergence.reference_volume_mm3,
          convergence.reference_volume_mm3,
          convergence.reference_volume_mm3,
        )
        || !CavityProductionAuthority._closes(
          expectedConvergence.relative_difference,
          convergence.relative_difference,
          1,
        )
        || expectedConvergence.reference_field_snapshot_digest
          !== convergence.reference_field_snapshot_digest
        || expectedConvergence.reference_surface_buffer_digest
          !== convergence.reference_surface_buffer_digest) {
      throw new RangeError('Cartesian cavity volume-convergence evidence was not reproduced');
    }
    return Object.freeze({ agreement, convergence });
  }

  static assertContract(wall: any, contract: any): true {
    _assertWallProductionAuthorityOwnership(wall, contract);
    const identity = CavityEvolutionLedger.identityForWall(wall);
    if (!contract || contract.schema !== CAVITY_PRODUCTION_AUTHORITY_SCHEMA
        || contract.volume_model !== CAVITY_PRODUCTION_VOLUME_MODEL
        || contract.scientific_resolution !== CAVITY_PRODUCTION_SCIENTIFIC_RESOLUTION
        || contract.isovalue !== CAVITY_PRODUCTION_ISOVALUE
        || !(contract.baseline_volume_convergence?.relative_difference
          <= CAVITY_PRODUCTION_MAX_VOLUME_CONVERGENCE_FRACTION)
        || contract.shape_identity !== identity.shape
        || contract.tessellation_identity !== identity.tessellation
        || contract.contract_digest
          !== CavityEvolutionLedger.digest(CavityProductionAuthority._contractPayload(contract))) {
      throw new RangeError('invalid or foreign Cartesian cavity production contract');
    }
    CavityScalarField._validatedFrame(contract.frame, CAVITY_PRODUCTION_SCIENTIFIC_RESOLUTION);
    return true;
  }

  static createContract(wall: any): any {
    const depths = CavityProductionAuthority._depthsFromWall(wall);
    const identity = CavityEvolutionLedger.identityForWall(wall);
    const depthDigest = CavityProductionAuthority._depthDigest(wall, depths);
    const cacheKey = CavityEvolutionLedger.digest({
      schema: CAVITY_PRODUCTION_AUTHORITY_SCHEMA,
      volume_model: CAVITY_PRODUCTION_VOLUME_MODEL,
      scientific_resolution: CAVITY_PRODUCTION_SCIENTIFIC_RESOLUTION,
      reference_resolution: CAVITY_PRODUCTION_REFERENCE_RESOLUTION,
      isovalue: CAVITY_PRODUCTION_ISOVALUE,
      max_agreement_voxels: CAVITY_PRODUCTION_MAX_AGREEMENT_VOXELS,
      max_volume_convergence_fraction: CAVITY_PRODUCTION_MAX_VOLUME_CONVERGENCE_FRACTION,
      shape_identity: identity.shape,
      tessellation_identity: identity.tessellation,
      depth_projection_digest: depthDigest,
    });
    const cached = CAVITY_PRODUCTION_CONTRACT_CACHE.get(cacheKey);
    if (cached) {
      // Refresh insertion order so the bounded cache is deterministic LRU.
      CAVITY_PRODUCTION_CONTRACT_CACHE.delete(cacheKey);
      CAVITY_PRODUCTION_CONTRACT_CACHE.set(cacheKey, cached);
      CavityProductionAuthority.assertContract(wall, cached);
      return cached;
    }
    const evolution = {
      ring_count: wall.ring_count,
      cells_per_ring: wall.cells_per_ring,
      depths_mm: depths,
      signature: depthDigest,
    };
    const frame = CavityScalarField.frameForBubbles(wall.bubbles, {
      resolution: CAVITY_PRODUCTION_SCIENTIFIC_RESOLUTION,
      shape: CavityScalarField.shapeFor(wall),
      evolution,
    });
    const initial = CavityProductionAuthority._surfaceState(wall, depths, {
      resolution: CAVITY_PRODUCTION_SCIENTIFIC_RESOLUTION,
      isovalue: CAVITY_PRODUCTION_ISOVALUE,
      frame,
      measureAgreement: true,
    });
    const convergence = CavityProductionAuthority._convergenceReceipt(
      wall, depths, initial, frame,
    );
    const payload: any = {
      schema: CAVITY_PRODUCTION_AUTHORITY_SCHEMA,
      volume_model: CAVITY_PRODUCTION_VOLUME_MODEL,
      scientific_resolution: CAVITY_PRODUCTION_SCIENTIFIC_RESOLUTION,
      isovalue: CAVITY_PRODUCTION_ISOVALUE,
      frame,
      frame_policy: 'immutable run-wide world-space lattice; erosion outside its negative border fails before commit',
      shape_identity: identity.shape,
      tessellation_identity: identity.tessellation,
      baseline_depth_projection_digest: initial.depth_projection_digest,
      baseline_field_snapshot_digest: initial.field.snapshotDigest,
      baseline_surface_buffer_digest: initial.surface.buffer_digest,
      baseline_volume_mm3: initial.volume_mm3,
      baseline_surface_area_mm2: initial.surface_area_mm2,
      baseline_volume_convergence: convergence,
      agreement_gate: Object.freeze({
        metric_schema: initial.agreement.schema,
        barycentric_subdivisions: initial.agreement.barycentric_subdivisions,
        numerical_zero_tolerance: initial.agreement.numerical_zero_tolerance,
        unresolved_sample_count: initial.agreement.unresolved_sample_count,
        max_field_residual: initial.agreement.max_field_residual,
        max_normal_root_distance_voxels: initial.agreement.max_normal_root_distance_voxels,
        maximum_allowed_voxels: CAVITY_PRODUCTION_MAX_AGREEMENT_VOXELS,
      }),
      authority_scope: 'connected star-shaped radial erosion bridge; no disconnected chambers, re-entrant transport, or deposition claim',
      quality_policy: 'scientific resolution and zero isovalue are model state, never renderer or hardware quality knobs',
      commissioning_evaluations: Object.freeze({
        production_field_build_and_extract: 1,
        reference_field_build_and_extract: 1,
      }),
    };
    payload.contract_digest = CavityEvolutionLedger.digest(payload);
    CavityEvolutionLedger._deepFreeze(payload);
    CavityProductionAuthority.assertContract(wall, payload);
    CAVITY_PRODUCTION_CONTRACT_CACHE.set(cacheKey, payload);
    while (CAVITY_PRODUCTION_CONTRACT_CACHE.size > CAVITY_PRODUCTION_CONTRACT_CACHE_LIMIT) {
      const oldest = CAVITY_PRODUCTION_CONTRACT_CACHE.keys().next().value;
      CAVITY_PRODUCTION_CONTRACT_CACHE.delete(oldest);
    }
    return payload;
  }

  static initialState(wall: any, contract: any): any {
    CavityProductionAuthority.assertContract(wall, contract);
    return CavityProductionAuthority._surfaceState(
      wall, CavityProductionAuthority._depthsFromWall(wall), {
        resolution: contract.scientific_resolution,
        isovalue: contract.isovalue,
        frame: contract.frame,
        measureAgreement: true,
      },
    );
  }

  static authenticateSurface(wall: any, field: any, surface: any,
                             contract: any, ledgerCursor?: number): any {
    CavityProductionAuthority.assertContract(wall, contract);
    MarchingCubesExtractor.verifyBuffers(surface);
    const ledger = wall.cavityEvolutionLedger?.();
    if (!ledger || ledger.model !== CAVITY_PRODUCTION_VOLUME_MODEL) {
      throw new RangeError('Cartesian surface is not backed by its production evolution ledger');
    }
    const ledgerHead = _cavityLedgerAuthorityHead(ledger);
    const cursor = ledgerCursor == null ? ledgerHead.head_cursor : Number(ledgerCursor);
    if (!Number.isInteger(cursor) || cursor < 0 || cursor > ledgerHead.head_cursor) {
      throw new RangeError('Cartesian surface production cursor is invalid');
    }
    const authority = cursor === 0 ? {
      new_field_snapshot_digest: contract.baseline_field_snapshot_digest,
      new_surface_buffer_digest: contract.baseline_surface_buffer_digest,
      new_volume_mm3: contract.baseline_volume_mm3,
      volume_tolerance_mm3_per_kg: 0,
      production_contract_digest: contract.contract_digest,
    } : ledger.entries[cursor - 1]?.geometry_authority;
    if (cursor > 0) {
      CavityProductionAuthority.validateAuthorityReceipt(authority, {
        entry: ledger.entries[cursor - 1],
        previousAuthority: cursor > 1 ? ledger.entries[cursor - 2]?.geometry_authority : null,
        contract,
        wall,
      });
    }
    if (!authority
        || authority.production_contract_digest !== contract.contract_digest
        || field.snapshotDigest !== authority.new_field_snapshot_digest
        || surface.buffer_digest !== authority.new_surface_buffer_digest) {
      throw new RangeError('Cartesian surface differs from its mass-authority receipt');
    }
    const volume = MarchingCubesExtractor.closedVolumeMm3(surface);
    const tolerance = Math.max(1e-9, Number(authority.volume_tolerance_mm3_per_kg) || 0);
    if (Math.abs(volume - Number(authority.new_volume_mm3)) > tolerance) {
      throw new RangeError('Cartesian surface volume differs from its mass-authority receipt');
    }
    if (cursor === 0) {
      // Exact snapshot, extracted-buffer, and closed-volume equality above bind
      // this live provider to the immutable commissioning evidence. Repeating
      // the 64^3 extraction here would prove the same bytes a second time and
      // made every scenario construction pay reference-resolution cost twice.
      return Object.freeze({
        volume_mm3: volume,
        agreement: Object.freeze({
          schema: contract.agreement_gate.metric_schema,
          barycentric_subdivisions: contract.agreement_gate.barycentric_subdivisions,
          numerical_zero_tolerance: contract.agreement_gate.numerical_zero_tolerance,
          unresolved_sample_count: contract.agreement_gate.unresolved_sample_count,
          max_field_residual: contract.agreement_gate.max_field_residual,
          max_normal_root_distance_voxels:
            contract.agreement_gate.max_normal_root_distance_voxels,
          maximum_allowed_voxels: contract.agreement_gate.maximum_allowed_voxels,
        }),
      });
    }
    const depths = new Float64Array(_cavityLedgerDepthProjection(ledger, cursor));
    const evidence = CavityProductionAuthority._assertMeasuredEvidence(
      wall,
      depths,
      { field, surface, volume_mm3: volume },
      cursor === 0 ? contract.agreement_gate : authority.agreement,
      cursor === 0 ? contract.baseline_volume_convergence : authority.volume_convergence,
      contract.frame,
    );
    return Object.freeze({ volume_mm3: volume, agreement: evidence.agreement });
  }

  static previewErosion(wall: any, weightsInput: ArrayLike<number>, opts: any = {}): any {
    const target = Number(opts.target_volume_delta_mm3_per_kg);
    const contract = opts.contract;
    CavityProductionAuthority.assertContract(wall, contract);
    const resolution = contract.scientific_resolution;
    const isovalue = contract.isovalue;
    const frame = contract.frame;
    const currentDepths = CavityProductionAuthority._depthsFromWall(wall);
    if (!(target > 0) || !Number.isFinite(target)) {
      throw new RangeError('Cartesian cavity erosion target volume must be positive and finite');
    }
    if (!weightsInput || weightsInput.length !== currentDepths.length) {
      throw new RangeError('Cartesian cavity erosion weights must match the chemistry projection');
    }
    const weights = new Float64Array(currentDepths.length);
    let maxWeight = 0;
    for (let index = 0; index < weights.length; index++) {
      const weight = Number(weightsInput[index]);
      if (!(weight >= 0) || !Number.isFinite(weight)) {
        throw new TypeError('Cartesian cavity erosion weight is invalid');
      }
      weights[index] = weight;
      if (weight > maxWeight) maxWeight = weight;
    }
    if (!(maxWeight > 0)) throw new RangeError('Cartesian cavity erosion has no exposed surface');
    for (let index = 0; index < weights.length; index++) weights[index] /= maxWeight;

    const ledger = wall.cavityEvolutionLedger?.();
    const active = wall.activeCavitySurfaceAnchorProvider?.();
    if (!ledger || !active || active.receipt?.kind !== 'cavity-field') {
      throw new Error('Cartesian erosion requires the sealed live production provider');
    }
    const oldState = Object.freeze({
      field: active.field,
      surface: active.surface,
      volume_mm3: MarchingCubesExtractor.closedVolumeMm3(active.surface),
      surface_area_mm2: MarchingCubesExtractor.surfaceAreaMm2(active.surface),
      depth_projection_digest: CavityProductionAuthority._depthDigest(wall, currentDepths),
      agreement: null,
    });
    const desiredVolume = oldState.volume_mm3 + target;
    const maxCoordinate = Math.max(
      ...oldState.surface.bounds.min.map(Math.abs),
      ...oldState.surface.bounds.max.map(Math.abs),
      1e-9,
    );
    const float32UlpMm = Math.pow(2, Math.floor(Math.log2(maxCoordinate)) - 23);
    const tolerance = Math.max(
      1e-6,
      target * 1e-6,
      oldState.volume_mm3 * 1e-10,
      oldState.surface_area_mm2 * float32UlpMm * 8,
    );
    let volumeOnlyEvaluations = 0;
    const candidate = (lambda: number): any => {
      const depths = new Float64Array(currentDepths.length);
      for (let index = 0; index < depths.length; index++) {
        depths[index] = currentDepths[index] + lambda * weights[index];
      }
      const field = CavityProductionAuthority._fieldForDepths(
        wall, depths, { resolution, frame },
      );
      const volumeEvidence = cavityFieldVolumeInternal(field, isovalue);
      const state = Object.freeze({
        field,
        volume_mm3: volumeEvidence.volume_mm3,
        triangle_count: volumeEvidence.triangle_count,
        depth_projection_digest: CavityProductionAuthority._depthDigest(wall, depths),
      });
      volumeOnlyEvaluations++;
      return { lambda, depths, state };
    };

    let low = { lambda: 0, depths: currentDepths, state: oldState };
    let high = candidate(Math.max(target / oldState.surface_area_mm2, 1e-9));
    for (let guard = 0; high.state.volume_mm3 < desiredVolume && guard < 24; guard++) {
      low = high;
      high = candidate(high.lambda * 2);
    }
    if (high.state.volume_mm3 < desiredVolume) {
      throw new RangeError('Cartesian cavity erosion could not bracket the target volume');
    }

    let solved = Math.abs(low.state.volume_mm3 - desiredVolume)
      <= Math.abs(high.state.volume_mm3 - desiredVolume) ? low : high;
    for (let iteration = 0; iteration < 14; iteration++) {
      if (Math.abs(solved.state.volume_mm3 - desiredVolume) <= tolerance) break;
      const denominator = high.state.volume_mm3 - low.state.volume_mm3;
      let nextLambda = denominator > 0
        ? low.lambda + (desiredVolume - low.state.volume_mm3)
          * (high.lambda - low.lambda) / denominator
        : (low.lambda + high.lambda) * 0.5;
      if (!(nextLambda > low.lambda && nextLambda < high.lambda)) {
        nextLambda = (low.lambda + high.lambda) * 0.5;
      }
      const next = candidate(nextLambda);
      if (next.state.volume_mm3 < desiredVolume) low = next;
      else high = next;
      solved = Math.abs(low.state.volume_mm3 - desiredVolume)
        <= Math.abs(high.state.volume_mm3 - desiredVolume) ? low : high;
    }

    const achieved = solved.state.volume_mm3 - oldState.volume_mm3;
    const residual = achieved - target;
    if (Math.abs(residual) > tolerance) {
      throw new RangeError('Cartesian cavity erosion volume residual ' + residual
        + ' exceeds tolerance ' + tolerance + ' for target ' + target);
    }
    const finalState = CavityProductionAuthority._surfaceState(
      wall, solved.depths, {
        resolution, isovalue, frame, measureAgreement: true, field: solved.state.field,
      },
    );
    if (finalState.field !== solved.state.field
        || Math.abs(finalState.volume_mm3 - solved.state.volume_mm3)
          > Math.max(1e-9, Math.abs(finalState.volume_mm3) * 1e-12)) {
      throw new RangeError('Cartesian cavity volume-only evaluator differs from final surface');
    }
    const convergence = CavityProductionAuthority._convergenceReceipt(
      wall, solved.depths, finalState, frame,
    );
    const vertexDeltas: any[] = [];
    for (let index = 0; index < solved.depths.length; index++) {
      const delta = solved.depths[index] - currentDepths[index];
      if (!(delta > 0)) continue;
      vertexDeltas.push({
        vertex_index: index,
        old_depth_mm: currentDepths[index],
        new_depth_mm: solved.depths[index],
        delta_mm: delta,
      });
    }
    const receipt: any = {
      schema: CAVITY_PRODUCTION_AUTHORITY_SCHEMA,
      volume_model: CAVITY_PRODUCTION_VOLUME_MODEL,
      production_contract_digest: contract.contract_digest,
      resolution,
      isovalue,
      old_depth_projection_digest: oldState.depth_projection_digest,
      new_depth_projection_digest: solved.state.depth_projection_digest,
      old_field_snapshot_digest: oldState.field.snapshotDigest,
      new_field_snapshot_digest: solved.state.field.snapshotDigest,
      old_surface_buffer_digest: oldState.surface.buffer_digest,
      new_surface_buffer_digest: finalState.surface.buffer_digest,
      old_volume_mm3: oldState.volume_mm3,
      new_volume_mm3: solved.state.volume_mm3,
      target_volume_delta_mm3_per_kg: target,
      achieved_volume_delta_mm3_per_kg: achieved,
      volume_residual_mm3_per_kg: residual,
      volume_tolerance_mm3_per_kg: tolerance,
      field_build_and_extract_evaluations: 2,
      volume_only_field_evaluations: volumeOnlyEvaluations,
      full_surface_extract_evaluations: {
        production_48: 1,
        reference_64: 1,
        provider_install: 0,
      },
      agreement: {
        schema: finalState.agreement.schema,
        barycentric_subdivisions: finalState.agreement.barycentric_subdivisions,
        numerical_zero_tolerance: finalState.agreement.numerical_zero_tolerance,
        unresolved_sample_count: finalState.agreement.unresolved_sample_count,
        max_field_residual: finalState.agreement.max_field_residual,
        max_normal_root_distance_voxels: finalState.agreement.max_normal_root_distance_voxels,
        maximum_allowed_voxels: CAVITY_PRODUCTION_MAX_AGREEMENT_VOXELS,
      },
      volume_convergence: convergence,
      topology: 'negative-border closed orientable Freudenthal two-manifold; signed near-zero samples use a deterministic spacing/4096 scalar floor; exact-zero zero-gradient critical contacts fail closed',
    };
    receipt.receipt_digest = CavityEvolutionLedger.digest(receipt);
    CavityEvolutionLedger._deepFreeze(receipt);
    CavityProductionAuthority.validateAuthorityReceipt(receipt, {
      previousAuthority: _cavityLedgerAuthorityHead(ledger).head_cursor
        ? ledger.entries[_cavityLedgerAuthorityHead(ledger).head_cursor - 1]?.geometry_authority
        : null,
      expectedOldDepthDigest: oldState.depth_projection_digest,
      expectedNewDepthDigest: solved.state.depth_projection_digest,
      contract,
      wall,
    });
    const plan = Object.freeze({
      target_volume_delta_mm3_per_kg: target,
      achieved_volume_delta_mm3_per_kg: achieved,
      volume_residual_mm3_per_kg: residual,
      volume_tolerance_mm3_per_kg: tolerance,
      old_capacity_volume_mm3: oldState.volume_mm3,
      new_capacity_volume_mm3: solved.state.volume_mm3,
      vertex_deltas: Object.freeze(vertexDeltas.map(delta => Object.freeze(delta))),
      authority_receipt: receipt,
    });
    const priorHead = _cavityLedgerAuthorityHead(ledger);
    const oldAgreement = priorHead.head_cursor === 0 ? {
      max_normal_root_distance_voxels:
        contract.agreement_gate.max_normal_root_distance_voxels,
    } : ledger.entries[priorHead.head_cursor - 1].geometry_authority.agreement;
    CAVITY_PRODUCTION_EROSION_PLANS.set(plan, Object.freeze({
      wall,
      contract,
      ledger,
      prior_cursor: priorHead.head_cursor,
      prior_signature: priorHead.signature,
      prior_ledger_generation: priorHead.generation,
      prior_generation: _wallPrivateGeometryGeneration(wall),
      old_state: oldState,
      old_agreement: oldAgreement,
      final_state: finalState,
      final_depths: new Float64Array(solved.depths),
      receipt,
    }));
    return plan;
  }

  static assertPlanReady(wall: any, plan: any, contract: any): true {
    const capability = CAVITY_PRODUCTION_EROSION_PLANS.get(plan);
    const ledger = wall?.cavityEvolutionLedger?.();
    const active = wall?.activeCavitySurfaceAnchorProvider?.();
    const ledgerHead = ledger ? _cavityLedgerAuthorityHead(ledger) : null;
    if (!capability || capability.wall !== wall || capability.contract !== contract
        || capability.ledger !== ledger || capability.receipt !== plan?.authority_receipt
        || ledgerHead?.head_cursor !== capability.prior_cursor
        || ledgerHead?.signature !== capability.prior_signature
        || ledgerHead?.generation !== capability.prior_ledger_generation
        || _wallPrivateGeometryGeneration(wall) !== capability.prior_generation
        || active?.field !== capability.old_state.field
        || active?.surface !== capability.old_state.surface
        || CavityProductionAuthority._depthDigest(
          wall, CavityProductionAuthority._depthsFromWall(wall),
        ) !== capability.receipt.old_depth_projection_digest) {
      throw new RangeError('Cartesian cavity erosion plan is stale, cloned, or foreign');
    }
    return true;
  }

  static verifyCommitted(wall: any, planOrReceipt: any, contract: any): any {
    CavityProductionAuthority.assertContract(wall, contract);
    const ledger = wall.cavityEvolutionLedger?.();
    const ledgerHead = ledger ? _cavityLedgerAuthorityHead(ledger) : null;
    const cursor = ledgerHead?.head_cursor || 0;
    const entry = cursor ? ledger.entries[cursor - 1] : null;
    const capability = CAVITY_PRODUCTION_EROSION_PLANS.get(planOrReceipt);
    const receipt = capability ? capability.receipt : planOrReceipt;
    CavityProductionAuthority.validateAuthorityReceipt(receipt, {
      entry,
      previousAuthority: cursor > 1 ? ledger.entries[cursor - 2]?.geometry_authority : null,
      contract,
      wall,
    });
    const suppliedDigest = receipt.receipt_digest;
    const depths = CavityProductionAuthority._depthsFromWall(wall);
    if (CavityProductionAuthority._depthDigest(wall, depths)
        !== receipt.new_depth_projection_digest) {
      throw new RangeError('committed wall depths differ from the Cartesian cavity preflight');
    }
    if (capability) {
      if (capability.wall !== wall || capability.contract !== contract
          || capability.ledger !== ledger || cursor !== capability.prior_cursor + 1
          || entry?.geometry_authority?.receipt_digest !== receipt.receipt_digest
          || _wallPrivateGeometryGeneration(wall)
            !== capability.prior_generation + planOrReceipt.vertex_deltas.length
          || CavityProductionAuthority._depthDigest(wall, capability.final_depths)
            !== receipt.new_depth_projection_digest) {
        throw new RangeError('committed Cartesian cavity differs from its exact erosion plan');
      }
      MarchingCubesExtractor.verifyBuffers(capability.final_state.surface);
      const volume = MarchingCubesExtractor.closedVolumeMm3(capability.final_state.surface);
      const tolerance = Math.max(1e-9, Number(receipt.volume_tolerance_mm3_per_kg) || 0);
      if (capability.final_state.field.snapshotDigest !== receipt.new_field_snapshot_digest
          || capability.final_state.surface.buffer_digest !== receipt.new_surface_buffer_digest
          || Math.abs(volume - Number(receipt.new_volume_mm3)) > tolerance) {
        throw new RangeError('preflighted Cartesian provider bytes changed before installation');
      }
      const active = _installPreauthenticatedWallProductionProvider(
        wall, capability.final_state,
        { volume_mm3: volume, agreement: receipt.agreement }, cursor,
      );
      return Object.freeze({
        field: active.field,
        surface: active.surface,
        verified_receipt_digest: receipt.receipt_digest,
      });
    }
    const state = CavityProductionAuthority._surfaceState(wall, depths, {
      resolution: contract.scientific_resolution,
      isovalue: contract.isovalue,
      frame: contract.frame,
      measureAgreement: true,
    });
    const tolerance = Math.max(1e-9, Number(receipt.volume_tolerance_mm3_per_kg) || 0);
    if (state.field.snapshotDigest !== receipt.new_field_snapshot_digest
        || state.surface.buffer_digest !== receipt.new_surface_buffer_digest
        || Math.abs(state.volume_mm3 - Number(receipt.new_volume_mm3)) > tolerance) {
      throw new RangeError('committed Cartesian cavity does not match its preflighted surface');
    }
    CavityProductionAuthority._assertMeasuredEvidence(
      wall, depths, state, receipt.agreement, receipt.volume_convergence, contract.frame,
    );
    return Object.freeze({
      field: state.field,
      surface: state.surface,
      verified_receipt_digest: suppliedDigest,
    });
  }

  static rollbackCommitted(wall: any, plan: any, contract: any): void {
    const capability = CAVITY_PRODUCTION_EROSION_PLANS.get(plan);
    const ledger = wall?.cavityEvolutionLedger?.();
    const ledgerHead = ledger ? _cavityLedgerAuthorityHead(ledger) : null;
    if (!capability || capability.wall !== wall || capability.contract !== contract
        || capability.ledger !== ledger || ledgerHead?.head_cursor !== capability.prior_cursor
        || ledgerHead?.signature !== capability.prior_signature
        || CavityProductionAuthority._depthDigest(
          wall, CavityProductionAuthority._depthsFromWall(wall),
        ) !== capability.receipt.old_depth_projection_digest) {
      throw new RangeError('cannot restore a foreign Cartesian cavity erosion plan');
    }
    _installPreauthenticatedWallProductionProvider(
      wall, capability.old_state,
      { volume_mm3: capability.old_state.volume_mm3,
        agreement: capability.old_agreement }, ledgerHead.head_cursor,
    );
  }
}
