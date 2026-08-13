import { describe, expect, it } from 'vitest';

declare const CavityEvolutionLedger: any;
declare const CavityProductionAuthority: any;
declare const FluidChemistry: any;
declare const MarchingCubesExtractor: any;
declare const VugWall: any;
declare const WallState: any;
declare const cavityMolarVolume: any;
declare const _topoReplayRenderDecision: any;

function fixture() {
  const wallState = new WallState({
    vug_diameter_mm: 50,
    initial_radius_mm: 25,
    ring_count: 6,
    cells_per_ring: 24,
    primary_bubbles: 1,
    secondary_bubbles: 0,
    shape_seed: 42,
    architecture: 'spherical',
  });
  const wall = new VugWall({ composition: 'limestone', thickness_mm: 100, vug_diameter_mm: 50 });
  const fluid = new FluidChemistry({ Ca: 10, Mg: 20, CO3: 30, Fe: 1, Mn: 2, pH: 4 });
  wallState.initializeCavityEvolutionLedger();
  const enabled = wallState.enableProductionCavityAuthority();
  const diameter = wall.initializeCavityCapacity(
    enabled.initial_volume_mm3, 'cartesian-field-freudenthal-volume-v1',
  );
  wallState.updateCapacity(enabled.initial_volume_mm3, diameter);
  return { wallState, wall, fluid, enabled };
}

function preview(f: any, target = 18, suppliedWeights?: Float64Array) {
  const molarVolume = cavityMolarVolume('calcite', 25, 0.001, 'limestone');
  const formulaExtent = target / molarVolume.value_cm3_mol;
  const chemical = Object.freeze({
    dissolved: true,
    composition: 'limestone',
    formula: 'CaCO3',
    mineral: 'calcite',
    attempted_rate_mm: formulaExtent / (15 / 40.078),
    rate_mm: formulaExtent / (15 / 40.078),
    attempted_formula_extent_mmolkg: formulaExtent,
    formula_extent_mmolkg: formulaExtent,
    molar_volume: molarVolume,
    target_volume_delta_mm3_per_kg: target,
    ca_released: formulaExtent * 40.078,
    mg_released: 0,
    co3_released: formulaExtent * 60.009,
    fe_released: 0,
    mn_released: 0,
    ph_before: f.fluid.pH,
    ph_after: Math.min(8.5, f.fluid.pH + 0.1),
  });
  const weights = suppliedWeights
    || new Float64Array(f.wallState.ring_count * f.wallState.cells_per_ring).fill(1);
  const plan = f.wallState.cavityEvolutionLedger().previewErosion(
    f.wallState, f.wallState.meshFor(), {
      target_volume_delta_mm3_per_kg: target,
      vertex_weights: weights,
    },
  );
  return { chemical, plan };
}

function exposure(f: any) {
  const mesh = f.wallState.meshFor();
  return {
    digest: CavityEvolutionLedger.digest({ test: 'production-cavity', cells: mesh.numInterior }),
    total_surface_area_mm2: mesh.surface_area_mm2,
    exposed_surface_area_mm2: mesh.surface_area_mm2,
    exposed_area_fraction: 1,
    fully_blocked_cells: 0,
    partially_covered_cells: 0,
    total_cells: mesh.numInterior,
    diffuse_fluid_pathway: true,
    feeder_model: 'none',
    local_pH_basis: 'test fixture',
    overlap_model: 'none',
  };
}

describe('Cartesian cavity production authority', () => {
  it('pins one immutable zero-isovalue 48-cubed world frame and authenticates its volume', () => {
    const f = fixture();
    const contract = f.enabled.contract;
    expect(contract).toMatchObject({
      schema: 'cavity-production-authority-v1',
      volume_model: 'cartesian-field-freudenthal-volume-v1',
      scientific_resolution: 48,
      isovalue: 0,
      authority_scope: expect.stringContaining('star-shaped'),
    });
    expect(contract.frame.dimensions).toEqual([48, 48, 48]);
    expect(contract.baseline_volume_convergence).toMatchObject({
      production_resolution: 48,
      reference_resolution: 64,
      maximum_allowed_fraction: 0.02,
    });
    expect(contract.baseline_volume_convergence.relative_difference).toBeLessThanOrEqual(0.02);
    expect(Object.isFrozen(contract)).toBe(true);
    expect(Object.isFrozen(contract.frame.origin_mm)).toBe(true);
    expect(f.enabled.provider.production_contract_digest).toBe(contract.contract_digest);
    expect(f.enabled.provider.authoritative_volume_mm3)
      .toBeCloseTo(contract.baseline_volume_mm3, 8);
    expect(f.wall.cavity_capacity_volume_mm3).toBeCloseTo(contract.baseline_volume_mm3, 8);
    expect(f.wallState.cavityEvolutionLedger().model)
      .toBe('cartesian-field-freudenthal-volume-v1');
  });

  it('rejects presentation-quality resolution and isovalue changes once production is selected', () => {
    const f = fixture();
    expect(() => f.wallState.cavityFieldFor({ resolution: 64 }))
      .toThrow(/resolution is pinned/i);
    expect(() => f.wallState.cavitySurfaceFor({ isovalue: 0.05 }))
      .toThrow(/isovalue is pinned/i);
    expect(() => f.wallState.deactivateCavitySurfaceAnchorProvider())
      .toThrow(/cannot switch topology/i);
  });

  it('preflights and commits chemistry against the exact extracted-volume delta', () => {
    const f = fixture();
    const { chemical, plan } = preview(f);
    expect(plan.authority_receipt.production_contract_digest)
      .toBe(f.enabled.contract.contract_digest);
    expect(plan.authority_receipt.volume_convergence.relative_difference).toBeLessThanOrEqual(0.02);
    expect(Math.abs(plan.volume_residual_mm3_per_kg))
      .toBeLessThanOrEqual(plan.volume_tolerance_mm3_per_kg);
    const result = f.wall.commitDissolvePreview(chemical, f.fluid, {
      wall_state: f.wallState,
      geometry_plan: plan,
      exposure_receipt: exposure(f),
      step: 1,
    });
    expect(result.cavity_evolution_entry.geometry_authority.receipt_digest)
      .toBe(plan.authority_receipt.receipt_digest);
    expect(f.wall.cavity_capacity_volume_mm3)
      .toBeCloseTo(plan.authority_receipt.new_volume_mm3, 7);
    const active = f.wallState.activeCavitySurfaceAnchorProvider();
    expect(MarchingCubesExtractor.closedVolumeMm3(active.surface))
      .toBeCloseTo(f.wall.cavity_capacity_volume_mm3, 6);
  });

  it('keeps the run-wide lattice fixed and leaves samples outside local erosion support unchanged', () => {
    const f = fixture();
    const contract = f.enabled.contract;
    const before = f.wallState.cavityFieldFor();
    const weights = new Float64Array(f.wallState.ring_count * f.wallState.cells_per_ring);
    weights[3 * f.wallState.cells_per_ring] = 1;
    const plan = CavityProductionAuthority.previewErosion(f.wallState, weights, {
      target_volume_delta_mm3_per_kg: 4,
      contract,
    });
    const ledger = f.wallState.cavityEvolutionLedger();
    const prior = ledger.materialize();
    const candidateDepths = new Float64Array(prior);
    for (const delta of plan.vertex_deltas) {
      candidateDepths[delta.vertex_index] = delta.new_depth_mm;
    }
    const after = CavityProductionAuthority._surfaceState(f.wallState, candidateDepths, {
      resolution: contract.scientific_resolution,
      isovalue: contract.isovalue,
      frame: contract.frame,
    }).field;
    expect(after.origin).toEqual(before.origin);
    expect(after.spacingMm).toBe(before.spacingMm);
    const radius = f.wallState.initial_radius_mm * 0.75;
    expect(after.sampleWorld(-radius, 0, 0)).toBe(before.sampleWorld(-radius, 0, 0));
  });

  it('keeps mass, capacity, convergence, topology, and frame closed across erosion prefixes', () => {
    const f = fixture();
    const frame = JSON.stringify(f.enabled.contract.frame);
    const count = f.wallState.ring_count * f.wallState.cells_per_ring;
    const patterns = [
      new Float64Array(count).fill(1),
      Float64Array.from({ length: count }, (_, index) => index % 3 === 0 ? 1 : 0.2),
      Float64Array.from({ length: count }, (_, index) => index < count / 3 ? 1 : 0),
    ];
    let expectedCapacity = f.wall.cavity_capacity_volume_mm3;
    for (let prefix = 0; prefix < patterns.length; prefix++) {
      const { chemical, plan } = preview(f, 4 + prefix * 2, patterns[prefix]);
      expect(plan.authority_receipt.volume_convergence.relative_difference).toBeLessThanOrEqual(0.02);
      expect(plan.authority_receipt.agreement.unresolved_sample_count).toBe(0);
      expect(plan.authority_receipt.agreement.max_normal_root_distance_voxels).toBe(0);
      expect(plan.authority_receipt.agreement.numerical_zero_tolerance).toBeGreaterThan(0);
      const committed = f.wall.commitDissolvePreview(chemical, f.fluid, {
        wall_state: f.wallState,
        geometry_plan: plan,
        exposure_receipt: exposure(f),
        step: prefix + 1,
      });
      expectedCapacity += plan.achieved_volume_delta_mm3_per_kg;
      expect(f.wall.cavity_capacity_volume_mm3).toBeCloseTo(expectedCapacity, 6);
      expect(committed.cavity_evolution_entry.geometry_authority.receipt_digest)
        .toBe(plan.authority_receipt.receipt_digest);
      const active = f.wallState.activeCavitySurfaceAnchorProvider();
      expect(MarchingCubesExtractor.closedVolumeMm3(active.surface))
        .toBeCloseTo(expectedCapacity, 6);
      expect(JSON.stringify(f.enabled.contract.frame)).toBe(frame);
    }
    expect(f.wallState.cavityEvolutionLedger().cursor).toBe(patterns.length);
  });

  it('rolls every authority back if post-commit Cartesian verification fails', () => {
    const f = fixture();
    const { chemical, plan } = preview(f, 18);
    const ledger = f.wallState.cavityEvolutionLedger();
    const beforeDepths = Array.from(ledger.materialize());
    const beforeCapacity = f.wall.cavity_capacity_volume_mm3;
    const beforeFluid = { Ca: f.fluid.Ca, CO3: f.fluid.CO3, pH: f.fluid.pH };
    const verify = CavityProductionAuthority.verifyCommitted;
    CavityProductionAuthority.verifyCommitted = () => {
      throw new Error('injected Cartesian verification failure');
    };
    try {
      expect(() => f.wall.commitDissolvePreview(chemical, f.fluid, {
        wall_state: f.wallState,
        geometry_plan: plan,
        exposure_receipt: exposure(f),
        step: 1,
      })).toThrow('injected Cartesian verification failure');
    } finally {
      CavityProductionAuthority.verifyCommitted = verify;
    }
    expect(ledger.cursor).toBe(0);
    expect(Array.from(ledger.materialize())).toEqual(beforeDepths);
    expect(f.wall.cavity_capacity_volume_mm3).toBe(beforeCapacity);
    expect({ Ca: f.fluid.Ca, CO3: f.fluid.CO3, pH: f.fluid.pH }).toEqual(beforeFluid);
  });

  it('withholds every physical consumer instead of falling back to WallMesh after authority failure', () => {
    const f = fixture();
    const birth = f.wallState._anchorFromRingCell(2, 5);
    const active = f.wallState._activeCavitySurfaceAnchorProvider;
    f.wallState._activeCavitySurfaceAnchorProvider = {
      ...active,
      receipt: { ...active.receipt, field_signature: 'forced-authentication-mismatch' },
    };
    const authenticate = CavityProductionAuthority.authenticateSurface;
    CavityProductionAuthority.authenticateSurface = () => {
      throw new Error('injected production provider rejection');
    };
    try {
      const crystal = { wall_anchor: birth };
      expect(() => f.wallState._anchorFromRingCell(2, 5)).toThrow(/production cavity surface authority/i);
      expect(() => f.wallState.surfacePointForCrystal(crystal)).toThrow(/production cavity surface authority/i);
      expect(() => f.wallState.chemistryAddressForCrystal(crystal)).toThrow(/production cavity surface authority/i);
      expect(() => f.wallState.remapSurfaceAnchorToMarchingCubes(birth))
        .toThrow(/production cavity surface authority/i);
      expect(() => f.wallState.remapSurfaceAnchorToWallMesh(birth))
        .toThrow(/cannot switch to WallMesh/i);
      expect(() => f.wallState.cavitySurfaceAnchorProviderReceipt())
        .toThrow(/production cavity surface authority is unavailable/i);
      expect(() => f.wallState.enableProductionCavityAuthority())
        .toThrow(/production cavity surface authority is unavailable/i);
      expect(_topoReplayRenderDecision(f.wallState, undefined)).toMatchObject({
        mode: 'corrupt', wall: f.wallState,
      });
    } finally {
      CavityProductionAuthority.authenticateSurface = authenticate;
    }
  });

  it('rejects recomputed-digest imports with forged production receipt semantics', () => {
    const f = fixture();
    const { chemical, plan } = preview(f, 8);
    f.wall.commitDissolvePreview(chemical, f.fluid, {
      wall_state: f.wallState,
      geometry_plan: plan,
      exposure_receipt: exposure(f),
      step: 1,
    });
    const canonical = f.wallState.cavityEvolutionLedger().toJSON();
    const attacks = [
      (authority: any) => { authority.resolution = 47; },
      (authority: any) => { authority.isovalue = 0.1; },
      (authority: any) => {
        authority.agreement.maximum_allowed_voxels = 99;
        authority.agreement.max_normal_root_distance_voxels = 2;
      },
      (authority: any) => { authority.old_depth_projection_digest = 'forged-depth'; },
      (authority: any) => {
        authority.target_volume_delta_mm3_per_kg += 1;
        authority.volume_residual_mm3_per_kg = authority.achieved_volume_delta_mm3_per_kg
          - authority.target_volume_delta_mm3_per_kg;
        authority.volume_tolerance_mm3_per_kg = Math.abs(authority.volume_residual_mm3_per_kg) + 1;
      },
    ];
    for (const attack of attacks) {
      const payload = JSON.parse(JSON.stringify(canonical));
      const entry = payload.entries[0];
      const authority = entry.geometry_authority;
      attack(authority);
      delete authority.receipt_digest;
      authority.receipt_digest = CavityEvolutionLedger.digest(authority);
      delete entry.entry_digest;
      entry.entry_digest = CavityEvolutionLedger.digest(entry);
      expect(() => CavityEvolutionLedger.fromJSON(payload)).toThrow(/Cartesian cavity/i);
    }
  });

  it('independently rejects self-consistent forged convergence evidence at wall binding', () => {
    const f = fixture();
    const { chemical, plan } = preview(f, 8);
    f.wall.commitDissolvePreview(chemical, f.fluid, {
      wall_state: f.wallState,
      geometry_plan: plan,
      exposure_receipt: exposure(f),
      step: 1,
    });
    const active = f.wallState.activeCavitySurfaceAnchorProvider();
    const payload = f.wallState.cavityEvolutionLedger().toJSON();
    const entry = payload.entries[0];
    const authority = entry.geometry_authority;
    authority.volume_convergence.reference_volume_mm3
      = authority.volume_convergence.production_volume_mm3;
    authority.volume_convergence.relative_difference = 0;
    authority.volume_convergence.reference_field_snapshot_digest = 'forged-reference-field';
    authority.volume_convergence.reference_surface_buffer_digest = 'forged-reference-surface';
    delete authority.receipt_digest;
    authority.receipt_digest = CavityEvolutionLedger.digest(authority);
    delete entry.entry_digest;
    entry.entry_digest = CavityEvolutionLedger.digest(entry);

    // Pure deserialization can prove internal chain semantics but has no wall
    // from which to reconstruct the independent 64^3 surface.  Binding that
    // chain to physical geometry must repeat the measurement and fail closed.
    const forgedLedger = CavityEvolutionLedger.fromJSON(payload);
    f.wallState._cavityEvolutionLedger = forgedLedger;
    expect(() => CavityProductionAuthority.authenticateSurface(
      f.wallState, active.field, active.surface, f.enabled.contract, 1,
    )).toThrow(/convergence evidence was not reproduced/i);
    expect(() => CavityProductionAuthority.verifyCommitted(
      f.wallState, forgedLedger.entries[0].geometry_authority, f.enabled.contract,
    )).toThrow(/convergence evidence was not reproduced/i);
  });
});
