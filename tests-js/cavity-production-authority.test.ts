import { describe, expect, it } from 'vitest';

declare const CavityEvolutionLedger: any;
declare const CavityProductionAuthority: any;
declare const CavityScalarField: any;
declare const CavityWaterAppearance: any;
declare const FluidChemistry: any;
declare const MarchingCubesExtractor: any;
declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const VugWall: any;
declare const WallState: any;
declare const cavityMolarVolume: any;
declare const rng: any;
declare const setSeed: any;
declare const simulationStateFingerprint: any;
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
    enabled.initial_volume_mm3, 'cartesian-field-freudenthal-volume-v2',
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
  it('is the cursor-zero authority before water and chemistry bootstrap', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.cooling();
    conditions.fluid_surface_ring = 3;
    const beforeRng = rng.state;
    const sim = new VugSimulator(conditions, events);
    const contract = sim.wall_state._cavityProductionAuthorityContract;
    const ledger = sim.wall_state.cavityEvolutionLedger();
    const provider = sim.wall_state.activeCavitySurfaceAnchorProvider();
    expect(rng.state).toBe(beforeRng);
    expect(contract).toBeTruthy();
    expect(ledger).toMatchObject({ cursor: 0, model: 'cartesian-field-freudenthal-volume-v2' });
    expect(provider.receipt).toMatchObject({
      kind: 'cavity-field', resolution: 48, isovalue: 0,
      production_contract_digest: contract.contract_digest,
    });
    expect(sim.conditions.wall.cavity_capacity_basis)
      .toBe('cartesian-field-freudenthal-volume-v2');
    expect(sim.conditions.fluid_surface_height_mm).toBeCloseTo(
      CavityWaterAppearance.verticalSpanForWall(sim.wall_state)
        * 3 / sim.wall_state.ring_count,
      10,
    );
    const identity = {
      contract: contract.contract_digest,
      ledger: ledger.signature,
      capacity: sim.conditions.wall.cavity_capacity_volume_mm3,
      diameter: sim.conditions.wall.vug_diameter_mm,
      provider: provider.receipt.surface_buffer_digest,
    };
    sim.wall_state.meshFor(sim).bindRingChemistry(
      sim.ring_fluids, sim.ring_temperatures,
    );
    const lateCompatibility = sim.enableProductionCavityAuthority();
    expect(lateCompatibility.contract).toBe(contract);
    expect({
      contract: sim.wall_state._cavityProductionAuthorityContract.contract_digest,
      ledger: sim.wall_state.cavityEvolutionLedger().signature,
      capacity: sim.conditions.wall.cavity_capacity_volume_mm3,
      diameter: sim.conditions.wall.vug_diameter_mm,
      provider: sim.wall_state.activeCavitySurfaceAnchorProvider().receipt.surface_buffer_digest,
    }).toEqual(identity);
  });

  it('aborts construction if production commissioning fails', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.cooling();
    const createContract = CavityProductionAuthority.createContract;
    CavityProductionAuthority.createContract = () => {
      throw new Error('injected production commissioning failure');
    };
    try {
      expect(() => new VugSimulator(conditions, events))
        .toThrow('injected production commissioning failure');
    } finally {
      CavityProductionAuthority.createContract = createContract;
    }
  });

  it('reauthors Creative diameter as an atomic production transaction', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.cooling();
    const sim = new VugSimulator(conditions, events);
    const oldContract = sim.wall_state._cavityProductionAuthorityContract;
    const oldSpan = CavityWaterAppearance.verticalSpanForWall(sim.wall_state);
    sim.conditions.fluid_surface_height_mm = oldSpan * 0.4;
    const requestedDiameter = 125;
    expect(sim.reauthorInitialCavityEquivalentDiameterMm(requestedDiameter)).toBe(true);
    const contract = sim.wall_state._cavityProductionAuthorityContract;
    const expectedVolume = (4 / 3) * Math.PI * Math.pow(requestedDiameter / 2, 3);
    expect(contract.contract_digest).not.toBe(oldContract.contract_digest);
    expect(contract.baseline_volume_mm3).toBeCloseTo(expectedVolume, 1);
    expect(sim.conditions.wall.cavity_capacity_basis)
      .toBe('cartesian-field-freudenthal-volume-v2');
    expect(sim.wall_state.cavityEvolutionLedger()).toMatchObject({
      cursor: 0, model: 'cartesian-field-freudenthal-volume-v2',
    });
    expect(sim.wall_state.activeCavitySurfaceAnchorProvider().receipt)
      .toMatchObject({ production_contract_digest: contract.contract_digest });
    expect(sim.conditions.fluid_surface_height_mm
      / CavityWaterAppearance.verticalSpanForWall(sim.wall_state)).toBeCloseTo(0.4, 10);
    expect(sim.wall_state.meshFor(sim).cells[0].fluid).toBeTruthy();
    expect(sim._creativeInitialAuthoringTransactions.at(-1)).toMatchObject({
      volume_model: 'cartesian-field-freudenthal-volume-v2',
      production_contract_digest: contract.contract_digest,
    });
  }, 60_000);

  it('rolls back every Creative authority and water field on commissioning failure', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.cooling();
    const sim = new VugSimulator(conditions, events);
    const span = CavityWaterAppearance.verticalSpanForWall(sim.wall_state);
    sim.conditions.fluid_surface_height_mm = span * 0.35;
    const beforeFingerprint = simulationStateFingerprint(sim);
    const beforeContract = sim.wall_state._cavityProductionAuthorityContract;
    const beforeProvider = sim.wall_state.activeCavitySurfaceAnchorProvider();
    const createContract = CavityProductionAuthority.createContract;
    CavityProductionAuthority.createContract = () => {
      throw new Error('injected Creative recommissioning failure');
    };
    try {
      expect(() => sim.reauthorInitialCavityEquivalentDiameterMm(130))
        .toThrow('injected Creative recommissioning failure');
    } finally {
      CavityProductionAuthority.createContract = createContract;
    }
    expect(simulationStateFingerprint(sim)).toBe(beforeFingerprint);
    expect(sim.wall_state._cavityProductionAuthorityContract).toBe(beforeContract);
    expect(sim.wall_state.activeCavitySurfaceAnchorProvider()).toBe(beforeProvider);
    expect(sim.conditions.fluid_surface_height_mm / span).toBeCloseTo(0.35, 10);
  });

  it('restores boundary chemistry aliases after a post-bind Creative failure', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.cooling();
    const sim = new VugSimulator(conditions, events);
    const wallState = sim.wall_state;
    const cells = wallState.rings.flat();
    const oldGrid = wallState.voxelGridFor(sim);
    const beforeFingerprint = simulationStateFingerprint(sim);
    const before = {
      contract: wallState._cavityProductionAuthorityContract,
      provider: wallState.activeCavitySurfaceAnchorProvider(),
      mesh: wallState.meshFor(sim),
      meshSignature: wallState.meshFor(sim).sig,
      grid: oldGrid,
      water: sim.conditions.fluid_surface_height_mm,
      waterLedger: sim._cavityWaterAppearanceLedger,
      materialLedger: sim._cavityWallMaterialHistoryLedger,
      wallHistory: sim.wall_state_history,
      geometryRevision: wallState._geometry_revision,
      cellChemistry: cells.map((cell: any) => ({
        fluid: cell.fluid,
        temperature_ring: cell.temperature_ring,
      })),
      boundaryFluids: cells.map((_cell: any, index: number) => {
        const ring = Math.floor(index / wallState.cells_per_ring);
        const cell = index % wallState.cells_per_ring;
        return oldGrid.boundaryVoxel(ring, cell).fluid;
      }),
    };
    const voxelGridFor = wallState.voxelGridFor;
    let injected = false;
    wallState.voxelGridFor = function (...args: any[]) {
      // onInstalled binds the replacement mesh chemistry immediately before
      // requesting its grid, making this a precise post-bind failure.
      if (!injected) {
        injected = true;
        throw new Error('injected post-bind voxel installation failure');
      }
      return voxelGridFor.apply(this, args);
    };
    try {
      expect(() => sim.reauthorInitialCavityEquivalentDiameterMm(130))
        .toThrow('injected post-bind voxel installation failure');
    } finally {
      wallState.voxelGridFor = voxelGridFor;
    }

    expect(injected).toBe(true);
    expect(simulationStateFingerprint(sim)).toBe(beforeFingerprint);
    expect(wallState._cavityProductionAuthorityContract).toBe(before.contract);
    expect(wallState.activeCavitySurfaceAnchorProvider()).toBe(before.provider);
    expect(wallState.meshFor(sim)).toBe(before.mesh);
    expect(wallState.meshFor(sim).sig).toBe(before.meshSignature);
    expect(wallState.voxelGridFor(sim)).toBe(before.grid);
    expect(wallState._geometry_revision).toBe(before.geometryRevision);
    expect(sim.conditions.fluid_surface_height_mm).toBe(before.water);
    expect(sim._cavityWaterAppearanceLedger).toBe(before.waterLedger);
    expect(sim._cavityWallMaterialHistoryLedger).toBe(before.materialLedger);
    expect(sim.wall_state_history).toBe(before.wallHistory);
    for (let index = 0; index < cells.length; index++) {
      const ring = Math.floor(index / wallState.cells_per_ring);
      const cell = index % wallState.cells_per_ring;
      expect(cells[index].fluid).toBe(before.cellChemistry[index].fluid);
      expect(cells[index].temperature_ring)
        .toBe(before.cellChemistry[index].temperature_ring);
      expect(oldGrid.boundaryVoxel(ring, cell).fluid).toBe(before.boundaryFluids[index]);
      expect(oldGrid.boundaryVoxel(ring, cell).fluid).toBe(cells[index].fluid);
    }
  }, 60_000);

  it('pins one immutable zero-isovalue 48-cubed world frame and authenticates its volume', () => {
    const f = fixture();
    const contract = f.enabled.contract;
    expect(contract).toMatchObject({
      schema: 'cavity-production-authority-v1',
      volume_model: 'cartesian-field-freudenthal-volume-v2',
      scientific_resolution: 48,
      isovalue: 0,
      authority_scope: expect.stringContaining('star-shaped'),
    });
    expect(contract.frame.dimensions).toEqual([48, 48, 48]);
    expect(contract.frame).toEqual({
      dimensions: [48, 48, 48],
      origin_mm: [
        -40.963996000783375,
        -34.2839552668885,
        -34.2839552668885,
      ],
      spacing_mm: 1.4588917134846169,
    });
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
      .toBe('cartesian-field-freudenthal-volume-v2');
  });

  it('reuses an exact immutable contract but extracts a fresh provider per wall', () => {
    const first = fixture();
    const second = fixture();
    const firstActive = first.wallState.activeCavitySurfaceAnchorProvider();
    const secondActive = second.wallState.activeCavitySurfaceAnchorProvider();
    expect(second.enabled.contract).toBe(first.enabled.contract);
    expect(secondActive).not.toBe(firstActive);
    expect(secondActive.field).not.toBe(firstActive.field);
    expect(secondActive.surface).not.toBe(firstActive.surface);
    expect(secondActive.receipt).toEqual(firstActive.receipt);
    expect(secondActive.receipt.production_contract_digest)
      .toBe(first.enabled.contract.contract_digest);
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

  it('keeps stable production-provider reads at constant authenticated cost', () => {
    const f = fixture();
    const birth = f.wallState._anchorFromRingCell(2, 5);
    const crystal = { wall_anchor: birth };
    // Warm the anchor validation and patch caches before observing stable cost.
    f.wallState.surfacePatchForCrystal(crystal, 0.04);
    const originalIdentity = CavityEvolutionLedger.identityForWall;
    const ledgerPrototype = Object.getPrototypeOf(f.wallState.cavityEvolutionLedger());
    const originalMaterialize = ledgerPrototype.materialize;
    const originalLedgerSignature = ledgerPrototype.signatureAt;
    const originalSignature = CavityScalarField.signatureFor;
    const originalExtract = CavityScalarField.prototype.extract;
    const calls = {
      identity: 0, materialize: 0, ledgerSignature: 0, signature: 0, extract: 0,
    };
    CavityEvolutionLedger.identityForWall = (...args: any[]) => {
      calls.identity++;
      return originalIdentity.apply(CavityEvolutionLedger, args);
    };
    ledgerPrototype.materialize = function(...args: any[]) {
      calls.materialize++;
      return originalMaterialize.apply(this, args);
    };
    ledgerPrototype.signatureAt = function(...args: any[]) {
      calls.ledgerSignature++;
      return originalLedgerSignature.apply(this, args);
    };
    CavityScalarField.signatureFor = (...args: any[]) => {
      calls.signature++;
      return originalSignature.apply(CavityScalarField, args);
    };
    CavityScalarField.prototype.extract = function(...args: any[]) {
      calls.extract++;
      return originalExtract.apply(this, args);
    };
    try {
      for (let index = 0; index < 10_000; index++) {
        f.wallState._resolveAnchor(crystal);
        f.wallState.chemistryAddressForCrystal(crystal);
        f.wallState.surfacePatchForCrystal(crystal, 0.04);
      }
      expect(calls).toEqual({
        identity: 0, materialize: 0, ledgerSignature: 0, signature: 0, extract: 0,
      });

      // A direct geometry write invalidates the lexical seal even if a caller
      // attempts to reset the public renderer revision.
      const cell = f.wallState.rings[0][0];
      const depth = cell.wall_depth;
      const publicRevision = f.wallState._geometry_revision;
      cell.wall_depth = depth + 0.1;
      f.wallState._geometry_revision = publicRevision;
      expect(() => f.wallState.cavitySurfaceAnchorProviderReceipt())
        .toThrow(/production cavity surface authority is unavailable/i);
      expect(calls.identity).toBeGreaterThan(0);
      expect(calls.extract).toBe(0);
      cell.wall_depth = depth;
    } finally {
      CavityEvolutionLedger.identityForWall = originalIdentity;
      ledgerPrototype.materialize = originalMaterialize;
      ledgerPrototype.signatureAt = originalLedgerSignature;
      CavityScalarField.signatureFor = originalSignature;
      CavityScalarField.prototype.extract = originalExtract;
    }
  });

  it('makes authored topology immutable and rejects replacement behind a provider seal', () => {
    const nested = fixture();
    const nestedProvider = nested.wallState.activeCavitySurfaceAnchorProvider();
    expect(Object.isFrozen(nested.wallState.bubbles)).toBe(true);
    expect(Object.isFrozen(nested.wallState.bubbles[0])).toBe(true);
    expect(Object.isFrozen(nested.wallState.rings)).toBe(true);
    expect(Object.isFrozen(nested.wallState.rings[0])).toBe(true);
    expect(() => { nested.wallState.bubbles[0][0] += 0.25; }).toThrow();
    expect(() => { nested.wallState.rings[0][0] = { ...nested.wallState.rings[0][0] }; })
      .toThrow();
    expect(nested.wallState.activeCavitySurfaceAnchorProvider()).toBe(nestedProvider);

    const bubbleReplacement = fixture();
    bubbleReplacement.wallState.bubbles = bubbleReplacement.wallState.bubbles.map(
      (bubble: number[], index: number) => index ? bubble : [
        bubble[0] + 0.25, bubble[1], bubble[2], bubble[3],
      ],
    );
    expect(() => bubbleReplacement.wallState.cavitySurfaceAnchorProviderReceipt())
      .toThrow(/production cavity surface authority is unavailable/i);

    const ringReplacement = fixture();
    const rings = ringReplacement.wallState.rings.map((ring: any[]) => ring.slice());
    const original = rings[0][0];
    rings[0][0] = { ...original, wall_depth: Number(original.wall_depth) + 0.25 };
    ringReplacement.wallState.rings = rings;
    expect(() => ringReplacement.wallState.cavitySurfaceAnchorProviderReceipt())
      .toThrow(/production cavity surface authority is unavailable/i);

    const identicalRingClone = fixture();
    identicalRingClone.wallState.rings = identicalRingClone.wallState.rings.map(
      (ring: any[]) => ring.slice(),
    );
    expect(() => identicalRingClone.wallState.cavitySurfaceAnchorProviderReceipt())
      .toThrow(/production cavity surface authority is unavailable/i);

    const fakeChemistryCell = fixture();
    const commissionedMesh = fakeChemistryCell.wallState.meshFor();
    const chemistryRings = fakeChemistryCell.wallState.rings.map(
      (ring: any[]) => ring.slice(),
    );
    chemistryRings[0][0] = {
      ...chemistryRings[0][0],
      fluid: { ...chemistryRings[0][0].fluid, pH: 99 },
    };
    fakeChemistryCell.wallState.rings = chemistryRings;
    expect(() => fakeChemistryCell.wallState.cavitySurfaceAnchorProviderReceipt())
      .toThrow(/production cavity surface authority is unavailable/i);
    expect(fakeChemistryCell.wallState.rings[0][0])
      .not.toBe(commissionedMesh.cells[0]);

    const dimensionReplacement = fixture();
    dimensionReplacement.wallState.cells_per_ring += 1;
    expect(() => dimensionReplacement.wallState.cavitySurfaceAnchorProviderReceipt())
      .toThrow(/production cavity surface authority is unavailable/i);
  });

  it('rejects self-consistent replacement ledgers and production contracts', () => {
    const ledgerReplacement = fixture();
    const { chemical, plan } = preview(ledgerReplacement, 7);
    ledgerReplacement.wall.commitDissolvePreview(chemical, ledgerReplacement.fluid, {
      wall_state: ledgerReplacement.wallState,
      geometry_plan: plan,
      exposure_receipt: exposure(ledgerReplacement),
      step: 1,
    });
    const forgedLedgerPayload = ledgerReplacement.wallState.cavityEvolutionLedger().toJSON();
    forgedLedgerPayload.entries[0].step = 999;
    forgedLedgerPayload.entries[0].entry_digest = CavityEvolutionLedger.digest(
      forgedLedgerPayload.entries[0],
    );
    const forgedLedger = CavityEvolutionLedger.fromJSON(forgedLedgerPayload);
    ledgerReplacement.wallState._cavityEvolutionLedger = forgedLedger;
    expect(() => ledgerReplacement.wallState.cavitySurfaceAnchorProviderReceipt())
      .toThrow(/production cavity surface authority is unavailable/i);
    expect(forgedLedger.entries[0].step).toBe(999);

    const contractReplacement = fixture();
    const forgedContract = JSON.parse(JSON.stringify(
      contractReplacement.wallState._cavityProductionAuthorityContract,
    ));
    forgedContract.agreement_gate.max_normal_root_distance_voxels = 0.5;
    delete forgedContract.contract_digest;
    forgedContract.contract_digest = CavityEvolutionLedger.digest(forgedContract);
    contractReplacement.wallState._cavityProductionAuthorityContract = forgedContract;
    expect(() => contractReplacement.wallState.cavitySurfaceAnchorProviderReceipt())
      .toThrow(/production cavity surface authority is unavailable/i);
  });

  it('builds only the accepted 48 surface and one 64 reference, then installs exact buffers', () => {
    const f = fixture();
    const originalExtract = CavityScalarField.prototype.extract;
    const extracted: number[] = [];
    CavityScalarField.prototype.extract = function(...args: any[]) {
      extracted.push(this.sizeX);
      return originalExtract.apply(this, args);
    };
    try {
      const { chemical, plan } = preview(f, 18);
      expect(extracted).toEqual([48, 64]);
      expect(plan.authority_receipt).toMatchObject({
        field_build_and_extract_evaluations: 2,
        full_surface_extract_evaluations: {
          production_48: 1, reference_64: 1, provider_install: 0,
        },
      });
      expect(plan.authority_receipt.volume_only_field_evaluations)
        .toBeLessThanOrEqual(39);
      expect(() => CavityProductionAuthority.assertPlanReady(
        f.wallState, { ...plan }, f.enabled.contract,
      )).toThrow(/stale, cloned, or foreign/i);
      const finalFieldDigest = plan.authority_receipt.new_field_snapshot_digest;
      const finalSurfaceDigest = plan.authority_receipt.new_surface_buffer_digest;
      f.wall.commitDissolvePreview(chemical, f.fluid, {
        wall_state: f.wallState,
        geometry_plan: plan,
        exposure_receipt: exposure(f),
        step: 1,
      });
      expect(extracted).toEqual([48, 64]);
      const active = f.wallState.activeCavitySurfaceAnchorProvider();
      expect(active.field.snapshotDigest).toBe(finalFieldDigest);
      expect(active.surface.buffer_digest).toBe(finalSurfaceDigest);
    } finally {
      CavityScalarField.prototype.extract = originalExtract;
    }
  });

  it('withholds sub-resolution erosion without changing geometry or chemistry', () => {
    const f = fixture();
    const beforeProvider = f.wallState.activeCavitySurfaceAnchorProvider();
    const beforeLedger = f.wallState.cavityEvolutionLedger().toJSON();
    const beforeFluid = { ...f.fluid };
    const beforeThickness = f.wall.thickness_mm;
    const { chemical, plan } = preview(f, 1e-7);

    expect(plan).toMatchObject({
      accepted: false,
      rejection: 'below_cartesian_volume_resolution',
      target_volume_delta_mm3_per_kg: 1e-7,
      scientific_scope: 'no host or fluid inventory committed',
    });
    expect(plan.minimum_resolvable_volume_delta_mm3_per_kg).toBeGreaterThan(1e-7);
    expect(() => f.wall.commitDissolvePreview(chemical, f.fluid, {
      wall_state: f.wallState,
      geometry_plan: plan,
      exposure_receipt: exposure(f),
      step: 1,
    })).toThrow(/unresolvable Cartesian erosion cannot commit/i);
    expect(f.wallState.activeCavitySurfaceAnchorProvider()).toBe(beforeProvider);
    expect(f.wallState.cavityEvolutionLedger().toJSON()).toEqual(beforeLedger);
    expect({ ...f.fluid }).toEqual(beforeFluid);
    expect(f.wall.thickness_mm).toBe(beforeThickness);
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

  it('rejects self-consistent forged convergence evidence before wall adoption', () => {
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
    // ownership capability. A live wall must reject the replacement ledger
    // before any slow-path measurement could commission it as new authority.
    const forgedLedger = CavityEvolutionLedger.fromJSON(payload);
    f.wallState._cavityEvolutionLedger = forgedLedger;
    expect(() => CavityProductionAuthority.authenticateSurface(
      f.wallState, active.field, active.surface, f.enabled.contract, 1,
    )).toThrow(/production cavity ownership/i);
    expect(() => CavityProductionAuthority.verifyCommitted(
      f.wallState, forgedLedger.entries[0].geometry_authority, f.enabled.contract,
    )).toThrow(/production cavity ownership/i);
  });
});
