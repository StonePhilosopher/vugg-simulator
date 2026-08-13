import { describe, expect, it } from 'vitest';

declare const CavityEvolutionLedger: any;
declare const CavityScalarField: any;
declare const FluidChemistry: any;
declare const FluidSpotField: any;
declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const VugWall: any;
declare const WallState: any;
declare const cavityFormulaExtentVolumeMm3PerKg: any;
declare const cavityMolarVolume: any;
declare const setSeed: any;
declare const simulationStateFingerprint: any;
declare const _topoSnapshotWall: any;
declare const _topoReplayRenderDecision: any;
declare const _topoRenderThree: any;
declare const _topoThreeRenderAuthorityDecision: any;

function fixture(composition = 'limestone') {
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
  const mesh = wallState.meshFor();
  const ledger = wallState.initializeCavityEvolutionLedger();
  const wall = new VugWall({ composition, thickness_mm: 100, vug_diameter_mm: 50 });
  wall.initializeCavityCapacity(mesh.closedVolumeMm3(), 'canonical_closed_wallmesh');
  wallState.updateCapacity(wall.cavity_capacity_volume_mm3, wall.vug_diameter_mm);
  const fluid = new FluidChemistry({ Ca: 10, Mg: 20, CO3: 30, Fe: 1, Mn: 2, pH: 4 });
  return { wallState, mesh, ledger, wall, fluid };
}

function exposureReceipt(mesh: any) {
  return {
    digest: CavityEvolutionLedger.digest({ fixture: true, vertices: mesh.numInterior }),
    total_surface_area_mm2: mesh.surface_area_mm2,
    exposed_surface_area_mm2: mesh.surface_area_mm2,
    exposed_area_fraction: 1,
    fully_blocked_cells: 0,
    partially_covered_cells: 0,
    total_cells: mesh.numInterior,
    diffuse_fluid_pathway: true,
    feeder_model: 'none',
    local_pH_basis: 'fixture pre-attack bulk fallback',
    overlap_model: 'fractional footprint union',
  };
}

function previewAndPlan(f: any, rate = 0.5) {
  const preview = f.wall.previewDissolve(1.5, f.fluid, {
    attempted_rate_mm: rate,
    accepted_rate_mm: rate,
    temperature_C: 25,
    pressure_kbar: 0.001,
  });
  const weights = new Float64Array(f.mesh.numInterior);
  weights.fill(1);
  const plan = f.ledger.previewErosion(f.wallState, f.mesh, {
    target_volume_delta_mm3_per_kg: preview.target_volume_delta_mm3_per_kg,
    vertex_weights: weights,
  });
  return { preview, plan };
}

describe('mass-balanced cavity evolution authority', () => {
  it('converts formula extent to the cited standard-state crystalline volume', () => {
    const calcite = cavityMolarVolume('calcite', 140, 1.2, 'limestone');
    const dolomite = cavityMolarVolume('dolomite', 140, 1.2, 'dolomite');
    expect(calcite.value_cm3_mol).toBe(36.934);
    expect(dolomite.value_cm3_mol).toBe(64.341);
    expect(cavityFormulaExtentVolumeMm3PerKg(0.75, calcite)).toBeCloseTo(27.7005, 12);
    expect(calcite).toMatchObject({
      approximation: 'standard_state_crystalline',
      reference_temperature_C: 26,
      reference_pressure_bar: 1,
      uncertainty_cm3_mol: 0.015,
      requested_temperature_C: 140,
      requested_pressure_kbar: 1.2,
    });
    expect(dolomite.uncertainty_cm3_mol).toBe(0.029);
  });

  it('allocates surface areas exactly and solves against the closed rendered mesh volume', () => {
    const f = fixture();
    const areas = f.mesh.cellSurfaceAreasMm2();
    expect(Array.from(areas).reduce((sum: number, value: any) => sum + Number(value), 0))
      .toBeCloseTo(f.mesh.surface_area_mm2, 8);
    const { preview, plan } = previewAndPlan(f);
    expect(Math.abs(plan.volume_residual_mm3_per_kg))
      .toBeLessThanOrEqual(plan.volume_tolerance_mm3_per_kg);
    expect(plan.vertex_deltas).toHaveLength(f.mesh.numInterior);
    expect(new Set(plan.vertex_deltas.map((d: any) => Math.floor(d.vertex_index / 24))).size)
      .toBe(6);
  });

  it('commits geometry, chemistry, capacity, diameter, and immutable paired ledgers together', () => {
    const f = fixture('dolomite');
    const { preview, plan } = previewAndPlan(f);
    const oldVolume = f.wall.cavity_capacity_volume_mm3;
    const result = f.wall.commitDissolvePreview(preview, f.fluid, {
      wall_state: f.wallState,
      geometry_plan: plan,
      exposure_receipt: exposureReceipt(f.mesh),
      step: 7,
    });
    expect(f.ledger.cursor).toBe(1);
    expect(f.ledger.assertProjection(f.wallState)).toBe(true);
    expect(f.wall.cavity_capacity_volume_mm3 - oldVolume)
      .toBeCloseTo(plan.achieved_volume_delta_mm3_per_kg, 7);
    expect(f.wall.vug_diameter_mm).toBeCloseTo(
      VugWall.diameterForCapacityMm3(f.wall.cavity_capacity_volume_mm3), 12,
    );
    expect(result.host_transaction.transaction_id)
      .toBe(result.cavity_evolution_entry.chemistry_transaction_id);
    expect(result.cavity_evolution_entry.scientific_scope.not_closed)
      .toContain('actual cavity fluid mass');
    expect(Object.isFrozen(result.cavity_evolution_entry)).toBe(true);
    expect(Object.isFrozen(result.cavity_evolution_entry.vertex_deltas)).toBe(true);
    expect(() => { result.cavity_evolution_entry.step = 99; }).toThrow();
  });

  it('rolls back every authority if a post-geometry commit write fails', () => {
    const f = fixture();
    const { preview, plan } = previewAndPlan(f);
    const before = {
      fluid: { Ca: f.fluid.Ca, Mg: f.fluid.Mg, CO3: f.fluid.CO3, pH: f.fluid.pH },
      thickness: f.wall.thickness_mm,
      capacity: f.wall.cavity_capacity_volume_mm3,
      depths: f.ledger.materialize(),
    };
    f.wall.host_release_ledger.push = () => { throw new Error('injected commit failure'); };
    expect(() => f.wall.commitDissolvePreview(preview, f.fluid, {
      wall_state: f.wallState,
      geometry_plan: plan,
      exposure_receipt: exposureReceipt(f.mesh),
      step: 1,
    })).toThrow('injected commit failure');
    expect(f.ledger.cursor).toBe(0);
    expect(f.ledger.assertProjection(f.wallState)).toBe(true);
    expect(Array.from(f.ledger.materialize())).toEqual(Array.from(before.depths));
    expect(f.wall.thickness_mm).toBe(before.thickness);
    expect(f.wall.cavity_capacity_volume_mm3).toBe(before.capacity);
    expect({ Ca: f.fluid.Ca, Mg: f.fluid.Mg, CO3: f.fluid.CO3, pH: f.fluid.pH })
      .toEqual(before.fluid);
  });

  it('round-trips and re-freezes a valid ledger while rejecting broken chains', () => {
    const f = fixture();
    const { preview, plan } = previewAndPlan(f);
    f.wall.commitDissolvePreview(preview, f.fluid, {
      wall_state: f.wallState,
      geometry_plan: plan,
      exposure_receipt: exposureReceipt(f.mesh),
      step: 3,
    });
    const payload = f.ledger.toJSON();
    const loaded = CavityEvolutionLedger.fromJSON(payload);
    expect(loaded.signature).toBe(f.ledger.signature);
    expect(Array.from(loaded.materialize())).toEqual(Array.from(f.ledger.materialize()));
    expect(Object.isFrozen(loaded.entries[0].fluid_receipt)).toBe(true);
    expect(Object.isFrozen(loaded.entries)).toBe(true);
    expect(() => loaded.entries.push({ fabricated: true })).toThrow();
    const digestTamper = f.ledger.toJSON();
    digestTamper.entries[0].fluid_receipt.after.Ca += 1;
    expect(() => CavityEvolutionLedger.fromJSON(digestTamper)).toThrow('entry digest mismatch');
    payload.entries[0].vertex_deltas[0].old_depth_mm = 123;
    payload.entries[0].vertex_deltas[0].new_depth_mm =
      123 + payload.entries[0].vertex_deltas[0].delta_mm;
    payload.entries[0].entry_digest = CavityEvolutionLedger.digest(payload.entries[0]);
    expect(() => CavityEvolutionLedger.fromJSON(payload)).toThrow('broken depth chain');

    const closureTamper = (mutate: (entry: any) => void, message: string) => {
      const broken = f.ledger.toJSON();
      mutate(broken.entries[0]);
      broken.entries[0].entry_digest = CavityEvolutionLedger.digest(broken.entries[0]);
      expect(() => CavityEvolutionLedger.fromJSON(broken)).toThrow(message);
    };
    closureTamper(entry => { entry.target_volume_delta_mm3_per_kg += 1; },
      'formula extent and molar volume');
    closureTamper(entry => { entry.volume_residual_mm3_per_kg += 1e-4; },
      'achieved minus target volume');
    closureTamper(entry => { entry.new_capacity_volume_mm3 += 1; },
      'capacity does not close');
    closureTamper(entry => { entry.new_equivalent_diameter_mm += 1; },
      'diameter is not derived');
  });

  it('imports legacy geometry without fabricating a chemistry history', () => {
    const f = fixture();
    const imported = CavityEvolutionLedger.forWall(f.wallState, {
      legacy_import: true,
      baseline_disclosure: 'Fixture import: geometry only; chemistry history unavailable.',
    });
    expect(imported.baseline_kind).toBe('legacy_import');
    expect(imported.baseline_disclosure).toContain('chemistry history unavailable');
    expect(imported.cursor).toBe(0);
    expect(imported.entries).toHaveLength(0);
  });

  it('projects ledger depths into a continuous star-shaped scalar oracle', () => {
    const f = fixture();
    const before = f.wallState.cavityFieldFor({ resolution: 20 });
    const { preview, plan } = previewAndPlan(f);
    f.wall.commitDissolvePreview(preview, f.fluid, {
      wall_state: f.wallState,
      geometry_plan: plan,
      exposure_receipt: exposureReceipt(f.mesh),
      step: 1,
    });
    const after = f.wallState.cavityFieldFor({ resolution: 20 });
    expect(after.sig).not.toBe(before.sig);
    const liveMesh = f.wallState.meshFor();
    const p = [liveMesh.positions[0], liveMesh.positions[1], liveMesh.positions[2]];
    expect(Math.abs(after.sampleAnalyticWorld(p[0], p[1], p[2])))
      .toBeLessThan(1e-5);
    expect(after.sig).toContain('cavity-field:v3');
  });

  it('uses full-surface geodesic feeder flux instead of longitude stripes', () => {
    const f = fixture();
    const source = 3 * 24 + 5;
    const spots = new FluidSpotField([
      { cell: source, kind: 'crack', open: true, supply: 1, decayBonus: 1.6 },
    ]);
    const flux = spots.erosionFluxField(f.mesh);
    expect(flux[source]).toBeCloseTo(1.6, 12);
    expect(flux[3 * 24 + 17]).toBeLessThan(flux[source]);
    expect(flux[0 * 24 + 5]).toBeLessThan(flux[source]);
    spots.sealSpots();
    expect(spots.erosionFluxField(f.mesh)).toBeNull();
  });

  it('releases nothing when resistant growth covers the entire reactive surface', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.reactive_wall();
    conditions.fluid.pH = 4;
    const sim = new VugSimulator(conditions, events);
    sim.crystals = [{
      crystal_id: 999,
      mineral: 'quartz',
      dissolved: false,
      total_growth_um: 1e9,
      wall_spread: 1,
      wall_anchor: { ringIdx: 8, cellIdx: 60 },
    }];
    const beforeFluid = { Ca: sim.conditions.fluid.Ca, CO3: sim.conditions.fluid.CO3 };
    const beforeCursor = sim.wall_state.cavityEvolutionLedger().cursor;
    const attack = sim._wallSurfaceAttackState();
    expect(attack.acceptedRate).toBe(0);
    sim.dissolve_wall();
    expect(sim.wall_state.cavityEvolutionLedger().cursor).toBe(beforeCursor);
    expect({ Ca: sim.conditions.fluid.Ca, CO3: sim.conditions.fluid.CO3 }).toEqual(beforeFluid);
  });

  it('includes wall depths and the evolution ledger in deterministic fingerprints', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.reactive_wall();
    conditions.fluid.pH = 4;
    const sim = new VugSimulator(conditions, events);
    const before = simulationStateFingerprint(sim);
    sim.dissolve_wall();
    const after = simulationStateFingerprint(sim);
    expect(after).not.toBe(before);
    expect(sim.wall_state.cavityEvolutionLedger().cursor).toBe(1);
  });

  it('replays an authenticated ledger prefix and fails closed on a bad cursor signature', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.reactive_wall();
    conditions.fluid.pH = 4;
    const sim = new VugSimulator(conditions, events);
    sim.dissolve_wall();
    sim.step = 1;
    sim._repaintWallState();
    const first = sim.wall_state_history[sim.wall_state_history.length - 1];
    expect(first.cavity_surface_provider).toEqual({ kind: 'wall-mesh' });
    sim.wall_state.activateCavitySurfaceAnchorProvider({ resolution: 20, isovalue: 0 });
    sim.dissolve_wall();
    sim.step = 2;
    sim._repaintWallState();
    const second = sim.wall_state_history[sim.wall_state_history.length - 1];
    expect(second.cavity_surface_provider.kind).toBe('cavity-field');
    const ledger = sim.wall_state.cavityEvolutionLedger();

    // Make the live authority deliberately differ from both frames. Replay
    // must follow each snapshot's recorded command, never today's wall.
    sim.wall_state.deactivateCavitySurfaceAnchorProvider();

    expect(first.cavity_evolution_cursor).toBe(1);
    expect(first.cavity_evolution_signature).toBe(ledger.signatureAt(1));
    const replayWall = _topoSnapshotWall(sim.wall_state, first);
    expect(replayWall._disableMarchingCubesCavity, replayWall._replayAuthenticationFailure)
      .toBe(false);
    expect(replayWall._cavityEvolutionCursor).toBe(1);
    expect(replayWall._cavitySurfaceAnchorProvider).toEqual({ kind: 'wall-mesh' });
    expect(replayWall._activeCavitySurfaceAnchorProvider).toBeNull();
    expect(ledger.assertProjection(replayWall, 1)).toBe(true);
    expect(replayWall.cavityFieldFor({ resolution: 20 }).sig)
      .toContain(ledger.signatureAt(1));
    const historicalNoCursorReceipt = replayWall.activateCavitySurfaceAnchorProvider({
      resolution: 20,
      isovalue: 0,
    });
    expect(historicalNoCursorReceipt.field_signature).toContain(ledger.signatureAt(1));
    expect(historicalNoCursorReceipt.cavity_evolution_signature).toBe(ledger.signatureAt(1));
    expect(replayWall.activeCavitySurfaceAnchorProvider().receipt)
      .toEqual(historicalNoCursorReceipt);

    // The public helper options must authenticate field + surface against one
    // requested historical prefix even while the live wall default is head 2.
    const explicitCursorWall = _topoSnapshotWall(sim.wall_state, first);
    explicitCursorWall._cavityEvolutionCursor = null;
    const historicalHelperAnchor = explicitCursorWall.surfaceAnchorFromMarchingCubes(
      0, [0.2, 0.3, 0.5], { resolution: 20, ledgerCursor: 1 },
    );
    expect(historicalHelperAnchor.source.fieldSignature).toContain(ledger.signatureAt(1));
    expect(historicalHelperAnchor.source.fieldSignature).not.toContain(ledger.signatureAt(2));
    const historicalRemap = explicitCursorWall.remapSurfaceAnchorToMarchingCubes(
      explicitCursorWall._anchorFromRingCell(4, 11), { resolution: 20, ledgerCursor: 1 },
    );
    expect(historicalRemap.source.fieldSignature).toContain(ledger.signatureAt(1));

    const exactReplayWall = _topoSnapshotWall(sim.wall_state, second);
    const exactReplayProvider = exactReplayWall.activeCavitySurfaceAnchorProvider();
    expect(exactReplayProvider.receipt).toEqual(second.cavity_surface_provider);
    expect(exactReplayProvider.receipt.cavity_evolution_signature)
      .toBe(ledger.signatureAt(2));
    expect(sim.wall_state.cavitySurfaceAnchorProviderReceipt()).toEqual({ kind: 'wall-mesh' });

    const providerTampered = JSON.parse(JSON.stringify(second));
    providerTampered.cavity_surface_provider.field_signature = 'tampered';
    const providerFallback = _topoSnapshotWall(sim.wall_state, providerTampered);
    expect(providerFallback._disableMarchingCubesCavity).toBe(true);
    expect(providerFallback._activeCavitySurfaceAnchorProvider).toBeNull();
    expect(providerFallback._cavitySurfaceAnchorProvider).toEqual({ kind: 'wall-mesh' });
    expect(_topoReplayRenderDecision(sim.wall_state, providerTampered).mode).toBe('corrupt');

    const tampered = { ...first, cavity_evolution_signature: 'tampered' };
    const fallbackWall = _topoSnapshotWall(sim.wall_state, tampered);
    expect(fallbackWall._disableMarchingCubesCavity).toBe(true);
    expect(fallbackWall._cavityEvolutionCursor).toBeUndefined();
    expect(_topoReplayRenderDecision(sim.wall_state, tampered).mode).toBe('corrupt');

    const depthTampered = JSON.parse(JSON.stringify(first));
    depthTampered.rings[0][0].wall_depth += 1;
    const depthFallback = _topoSnapshotWall(sim.wall_state, depthTampered);
    expect(depthFallback._disableMarchingCubesCavity).toBe(true);
    expect(depthFallback._cavityEvolutionLedger).toBeNull();
    expect(depthFallback._cavityEvolutionCursor).toBeUndefined();
    expect(_topoReplayRenderDecision(sim.wall_state, depthTampered).mode).toBe('corrupt');

    const radiusTampered = JSON.parse(JSON.stringify(first));
    radiusTampered.rings[0][0].base_radius_mm += 1;
    const radiusFallback = _topoSnapshotWall(sim.wall_state, radiusTampered);
    expect(radiusFallback._replayAuthenticationFailure).toContain('shape or tessellation');
    expect(_topoReplayRenderDecision(sim.wall_state, radiusTampered)).toMatchObject({
      mode: 'corrupt',
      message: expect.stringContaining('Replay frame withheld'),
    });

    expect(_topoReplayRenderDecision(sim.wall_state, first).mode).toBe('wall-mesh');
    expect(_topoReplayRenderDecision(sim.wall_state, second).mode).toBe('cavity-field');

    for (const malformed of [{ step: 1 }, { step: 1, rings: null }, { rings: {} }]) {
      const decision = _topoReplayRenderDecision(sim.wall_state, malformed);
      expect(decision.mode).toBe('corrupt');
      expect(decision.message).toContain('Replay frame withheld');
      expect(decision.wall).not.toBe(sim.wall_state);
      // Direct Three entry authenticates before canvas/WebGL availability and
      // cannot substitute the live wall for the malformed historical frame.
      expect(_topoRenderThree(sim, sim.wall_state, malformed, 1)).toBe(false);
    }

    const shortRings = JSON.parse(JSON.stringify(first));
    shortRings.rings.pop();
    const longRings = JSON.parse(JSON.stringify(first));
    longRings.rings.push(JSON.parse(JSON.stringify(longRings.rings[0])));
    const shortCells = JSON.parse(JSON.stringify(first));
    shortCells.rings[0].pop();
    const longCells = JSON.parse(JSON.stringify(first));
    longCells.rings[0].push(JSON.parse(JSON.stringify(longCells.rings[0][0])));
    const sparseRings = JSON.parse(JSON.stringify(first));
    delete sparseRings.rings[1];
    const sparseCells = JSON.parse(JSON.stringify(first));
    delete sparseCells.rings[0][1];
    for (const wrongDimensions of [
      shortRings, longRings, shortCells, longCells, sparseRings, sparseCells,
    ]) {
      expect(_topoReplayRenderDecision(sim.wall_state, wrongDimensions)).toMatchObject({
        mode: 'corrupt',
        message: expect.stringContaining('dimensions'),
      });
    }

    // The render authority binder has no injection parameter. Even an extra
    // live-wall argument is ignored by JavaScript; the authenticated cursor-1
    // wall remains the only wall returned to Three.
    const bound = _topoThreeRenderAuthorityDecision(
      sim.wall_state, first, sim.wall_state,
    );
    expect(_topoThreeRenderAuthorityDecision.length).toBe(2);
    expect(bound.wall).not.toBe(sim.wall_state);
    expect(bound.wall._cavityEvolutionCursor).toBe(1);
    expect(bound.mode).toBe('wall-mesh');
  });
});
