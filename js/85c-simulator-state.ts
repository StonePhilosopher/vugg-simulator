// ============================================================
// js/85c-simulator-state.ts — VugSimulator methods (Object.assign mixin)
// ============================================================
// Methods attached to VugSimulator.prototype after the class is defined
// in 85-simulator.ts, so direct calls and dynamic dispatch keep working.
//
// Methods here (10): _snapshotGlobal, _propagateGlobalDelta, _applyWaterLevelDrift, _applyVadoseOxidationOverride, _diffuseRingState, _repaintWallState, _wallCellsBlockedByCrystals, get_vug_fill, _check_enclosure, _check_liberation.
//
// Phase B20 of PROPOSAL-MODULAR-REFACTOR.

// v67 — replay-history decimation stride for a given step. Densest
// near step 0 (where nucleations + first dissolution events happen)
// and progressively coarser as chemistry stabilizes. Bounds the total
// snapshot count to ≤~100 regardless of run length so a 1000-step run
// stays around 15 MB in-memory instead of 150 MB. See _repaintWallState
// for the breakdown table.
function _replayStride(step: number): number {
  if (step < 30) return 1;
  if (step < 90) return 3;
  if (step < 270) return 9;
  if (step < 810) return 27;
  if (step < 2430) return 81;
  if (step < 7290) return 243;
  return 729;
}

function _canonicalSpatialFluids(sim: any): any[] {
  const grid = sim?.wall_state?.voxelGridFor?.(sim);
  if (grid?.voxels) return grid.voxels.map((voxel: any) => voxel?.fluid).filter(Boolean);
  const mesh = sim?.wall_state?.meshFor?.(sim);
  return (mesh?.cells || []).map((cell: any) => cell?.fluid).filter(Boolean);
}

function _spatialSulfurState(sim: any): any {
  const fluids = _canonicalSpatialFluids(sim);
  const totals = fluids.map((fluid: any) => sulfurSystemTotalPpm(fluid));
  return { count: totals.length, totals, totalPpm: totals.reduce((a: number, b: number) => a + b, 0) };
}

function _spatialCarbonState(sim: any): any {
  const fluids = _canonicalSpatialFluids(sim);
  const totals = fluids.map((fluid: any) => Math.max(0, Number(fluid?.CO3) || 0));
  return { count: totals.length, totals, totalPpm: totals.reduce((a: number, b: number) => a + b, 0) };
}

function _ledgerTolerance(value: number): number {
  return Math.max(1e-7, Math.abs(value) * 1e-9);
}

function _physicalCrystalInventory(crystal: any, throughStep = Infinity): any {
  let positiveCoreUm = 0;
  let lossUm = 0;
  for (const zone of (crystal?.zones || [])) {
    if (!zone || Number(zone.step) > throughStep) continue;
    const thicknessUm = Number(zone.thickness_um);
    if (!Number.isFinite(thicknessUm)) continue;
    if (thicknessUm > 0 && !zone.is_phantom) positiveCoreUm += thicknessUm;
    else if (thicknessUm < 0) lossUm += Math.abs(thicknessUm);
  }
  return {
    positiveCoreUm,
    lossUm,
    remainingUm: Math.max(0, positiveCoreUm - lossUm),
  };
}

Object.assign(VugSimulator.prototype, {
  _replaceFullyMixedCarbonateFluid() {
    if (!this._carbonateBoundaryState) return false;
    const source = this.conditions?.fluid;
    if (!source) return false;
    const fluids = _canonicalSpatialFluids(this);
    for (const fluid of fluids) {
      fluid.CO3 = source.CO3;
      fluid.pH = source.pH;
    }
    for (const fluid of (this.ring_fluids || [])) {
      if (!fluid) continue;
      fluid.CO3 = source.CO3;
      fluid.pH = source.pH;
    }
    this._carbonateBoundaryState.lastDICMolKg = dicPpmToMolKg(source.CO3);
    this._carbonateBoundaryState.lastBulkDICPpm = source.CO3;
    return fluids.length > 0;
  },

  _prepareCarbonateBoundarySpatialState() {
    const state = this._carbonateBoundaryState;
    const config = this.conditions?._scenario?.carbonate_boundary;
    if (!state || !config) return false;
    // Initialization and configuration failures cannot be repaired by a
    // subsequent zero-residual voxel audit. Keep these distinct from the
    // recoverable spatial/receipt blocks below, which a later clean step may
    // legitimately clear.
    if (state.permanentBlocked || state.initializationBlocked || state.configurationBlocked) {
      state.permanentBlocked = true;
      state.blocked = true;
      return false;
    }
    const receipts = Array.isArray(this.conditions._pending_carbonate_boundary_transfers)
      ? this.conditions._pending_carbonate_boundary_transfers.slice() : [];
    delete this.conditions._pending_carbonate_boundary_transfers;
    const pendingViolation = this.conditions._pending_carbonate_boundary_violation || null;
    delete this.conditions._pending_carbonate_boundary_violation;
    let fullyFlooded = false;
    try {
      fullyFlooded = CavityWaterAppearance.create(this.wall_state, this.conditions, {
        sim: this,
      }).receipt.fully_submerged;
    } catch (error) {
      state.blocked = true;
      const tx = {
        ok: false,
        kind: 'spatial_boundary_unsupported',
        step: this.step,
        error: 'cavity_water_authority_unavailable',
        detail: error instanceof Error ? error.message : String(error),
      };
      const prior = state.transactions?.[state.transactions.length - 1];
      if (!prior || prior.kind !== tx.kind || prior.error !== tx.error || prior.step !== tx.step) {
        (state.transactions ||= []).push(tx);
      }
      return false;
    }
    if (!fullyFlooded || config.spatial_model !== 'equal_volume_fully_mixed') {
      state.blocked = true;
      const tx = {
        ok: false,
        kind: 'spatial_boundary_unsupported',
        step: this.step,
        error: fullyFlooded ? 'unsupported_spatial_model' : 'partially_flooded_boundary_deferred',
      };
      const prior = state.transactions?.[state.transactions.length - 1];
      if (!prior || prior.kind !== tx.kind || prior.error !== tx.error || prior.step !== tx.step) {
        (state.transactions ||= []).push(tx);
      }
      return false;
    }
    const fluids = _canonicalSpatialFluids(this);
    if (!fluids.length) {
      state.blocked = true;
      (state.transactions ||= []).push({
        ok: false, kind: 'spatial_boundary_unsupported', step: this.step, error: 'no_canonical_fluids',
      });
      return false;
    }
    // Cavity voxels currently represent equal control volumes. The v1 spatial
    // contract is therefore an unweighted arithmetic mean over every fully wet
    // canonical voxel. Partial wetting is rejected above.
    const meanCO3 = fluids.reduce(
      (sum: number, f: any) => sum + Math.max(0, Number(f.CO3) || 0), 0,
    ) / fluids.length;
    const meanPH = fluids.reduce(
      (sum: number, f: any) => sum + (Number.isFinite(f.pH) ? Number(f.pH) : 7), 0,
    ) / fluids.length;
    const observedDIC = dicPpmToMolKg(meanCO3);
    const previous = Math.max(0, Number(state.lastDICMolKg) || 0);
    const delta = observedDIC - previous;
    const declaredSimpleCarbonates = Array.isArray(config.simple_carbonate_phases)
      ? config.simple_carbonate_phases
      : Array.isArray(config.simple_caco3_phases) ? config.simple_caco3_phases : [];
    const allowed = declaredSimpleCarbonates.filter((mineral: string) =>
      SIMPLE_CARBONATE_TRANSFER_MINERALS.includes(mineral));
    const receiptDelta = receipts.reduce(
      (sum: number, receipt: any) => sum
        + (Number(receipt.localAqueousCarbonDeltaPpm) || 0)
          / (1000 * CARBONATE_SURROGATE_G_MOL * fluids.length),
      0,
    );
    const residual = delta - receiptDelta;
    const expectedBulkDeltaPpm = receipts.reduce(
      (sum: number, receipt: any) => sum + (receipt.touchedBulkFluidHandle
        ? Number(receipt.localAqueousCarbonDeltaPpm) || 0 : 0),
      0,
    );
    const lastBulkPpm = Number.isFinite(state.lastBulkDICPpm)
      ? Number(state.lastBulkDICPpm) : dicMolKgToPpm(previous);
    const observedBulkPpm = Math.max(0, Number(this.conditions.fluid?.CO3) || 0);
    const bulkResidualPpm = observedBulkPpm - lastBulkPpm - expectedBulkDeltaPpm;
    const receiptMineralsSupported = receipts.every((receipt: any) =>
      receipt?.schema === 'accepted-carbonate-transfer-v1'
      && allowed.includes(String(receipt.mineral)),
    );
    const matchTolerance = Math.max(1e-15, Math.abs(previous) * 1e-12, Math.abs(delta) * 1e-10);
    const bulkTolerancePpm = Math.max(1e-7, Math.abs(lastBulkPpm) * 1e-12);
    if (pendingViolation || !receiptMineralsSupported || Math.abs(residual) > matchTolerance
        || Math.abs(bulkResidualPpm) > bulkTolerancePpm) {
      const tx = {
        ok: false,
        kind: 'solid_transfer_unresolved',
        note: `step ${this.step}: observed spatial DIC delta does not match accepted-zone receipts`,
        observedAqueousCarbonDeltaMolKg: delta,
        receiptedAqueousCarbonDeltaMolKg: receiptDelta,
        residualAqueousCarbonDeltaMolKg: residual,
        observedBulkDICPpm: observedBulkPpm,
        receiptedBulkDICDeltaPpm: expectedBulkDeltaPpm,
        residualBulkDICPpm: bulkResidualPpm,
        receipts,
        attemptedKind: pendingViolation?.attemptedKind,
        field: pendingViolation?.field,
        error: pendingViolation?.error || (receiptMineralsSupported
          ? 'unreceipted_DIC_change' : 'unsupported_carbonate_phase_receipt'),
      };
      (state.transactions ||= []).push(tx);
      state.blocked = true;
      return false;
    }
    for (const receipt of receipts) {
      const receiptMolKg = (Number(receipt.localAqueousCarbonDeltaPpm) || 0)
        / (1000 * CARBONATE_SURROGATE_G_MOL * fluids.length);
      recordSimpleCarbonateSolidTransferState(
        state,
        receiptMolKg,
        String(receipt.mineral),
        `step ${this.step}: accepted zone ${receipt.crystalId ?? '?'} (${receipt.acceptedThicknessUm} um)`,
      );
    }
    state.blocked = false;
    this.conditions.fluid.CO3 = meanCO3;
    this.conditions.fluid.pH = meanPH;
    state.lastBulkDICPpm = meanCO3;
    return true;
  },

  // Phase C v1: snapshot conditions.fluid + temperature before a
// global-mutating block (events, wall dissolution, ambient cooling).
// Pair with _propagateGlobalDelta to apply the same delta to all
// non-equator rings.
_snapshotGlobal(options: any = {}) {
  const sulfurState = this.conditions.fluid.sulfurPoolsExplicit
    || options.captureLegacySulfur
    ? _spatialSulfurState(this) : null;
  const carbonState = this._carbonLedgerEnabled ? _spatialCarbonState(this) : null;
  return [_cloneFluid(this.conditions.fluid), this.conditions.temperature, sulfurState, carbonState];
},

  // Phase C v1 (comment trued 2026-06-10): apply the delta between
// current conditions and the pre-block snapshot. FLUID deltas go to
// the voxel grid (all wall + interior voxels — canonical since v159)
// with a mesh.propagateDelta fallback; TEMPERATURE deltas go to all
// non-equator ring_temperatures. The historical per-ring FLUID loop
// is gone — the non-equator ring_fluids slots are a retired store
// (frozen at init + vadose/open-atmosphere partials, read only by
// mesh-absent fallbacks); the replay snapshot, their one live
// consumer, now captures a projection of the cells instead
// (_ringFluidMeans, review §1.4). The equator ring is aliased to
// conditions.fluid so it already reflects the new value.
_propagateGlobalDelta(snap, options: any = {}) {
  const [preFluid, preTemp, preSulfurState, preCarbonState] = snap;
  const sulfurDeclarations = Array.isArray(this.conditions._pending_sulfur_boundary_declarations)
    ? this.conditions._pending_sulfur_boundary_declarations.slice() : [];
  const carbonDeclarations = Array.isArray(this.conditions._pending_carbon_ledger_declarations)
    ? this.conditions._pending_carbon_ledger_declarations.slice() : [];
  const fluidBoundaryDeclarations = Array.isArray(this.conditions._pending_fluid_boundary_declarations)
    ? this.conditions._pending_fluid_boundary_declarations.slice() : [];
  delete this.conditions._pending_sulfur_boundary_declarations;
  delete this.conditions._pending_carbon_ledger_declarations;
  delete this.conditions._pending_fluid_boundary_declarations;
  const replaceFields = Array.isArray(this.conditions._pending_fluid_replace_fields)
    ? this.conditions._pending_fluid_replace_fields.slice()
    : [];
  delete this.conditions._pending_fluid_replace_fields;
  const equator = Math.floor(this.wall_state.ring_count / 2);
  const equatorFluid = this.ring_fluids[equator];  // = conditions.fluid (aliased)
  // PROPOSAL-CAVITY-INTERIOR-VOXELS Phase 2a (v159) — voxel grid is
  // now the canonical event-delta propagation path. Spreads the delta
  // to ALL voxels (wall + interior) so event chemistry affects the
  // whole cavity uniformly, matching pre-v158 bulk-view semantics.
  // Pre-v159 mesh.propagateDelta hit only the d=0 wall slab; combined
  // with the new v159 radial diffusion that would have STOLEN the
  // event effect from the wall by mixing it with stale interior fluid.
  // Spreading to all voxels preserves event reach.
  //
  // Defensive fallback to mesh.propagateDelta when the voxel grid
  // isn't available (headless test harnesses without CavityVoxelGrid).
  const grid = this.wall_state.voxelGridFor(this);
  const mesh = this.wall_state.meshFor(this);
  const explicitSulfurActive = !!(
    preFluid.sulfurPoolsExplicit || this.conditions.fluid.sulfurPoolsExplicit
  );
  const activatingExplicitSulfur = !preFluid.sulfurPoolsExplicit
    && !!this.conditions.fluid.sulfurPoolsExplicit;
  // During first activation, the post-event pools already contain the
  // valence split of the pre-existing legacy `S`.  Project the PRE snapshot
  // through that same split before calculating numeric deltas; otherwise the
  // propagation helper mistakes the inherited inventory for a new import and
  // credits it a second time in every voxel.
  const propagationPreFluid = activatingExplicitSulfur
    ? ensureExplicitSulfurPools(_cloneFluid(preFluid), Number(preTemp) || 25)
    : preFluid;
  if (grid && typeof grid.propagateEventDelta === 'function') {
    grid.propagateEventDelta(propagationPreFluid, this._fluidFieldNames, equatorFluid, 'all', replaceFields);
  } else {
    if (mesh && typeof mesh.propagateDelta === 'function') {
      mesh.propagateDelta(propagationPreFluid, this._fluidFieldNames, equatorFluid, replaceFields);
    }
  }
  // S1 (fluid.S sulfate/sulfide split): sulfateInherited is a LATCHED boolean, not a
  // numeric field, so propagateEventDelta (which diffs _fluidFieldNames) never carries it.
  // The GROWTH path reads per-cell/voxel fluids (js/85b _runEngineForCrystal), so without
  // this broadcast a carved-out barite nucleates on the global flag but starves on growth
  // (the cell fluids still see the split fraction → σ<1). Latch it onto every cell/voxel
  // fluid here. RNG-neutral; skipped entirely (byte-identical) when the flag is unset.
  if (this.conditions.fluid.sulfateInherited) {
    const setFlag = (f) => { if (f) f.sulfateInherited = true; };
    if (grid && grid.voxels) for (let i = 0; i < grid.voxels.length; i++) setFlag(grid.voxels[i] && grid.voxels[i].fluid);
    const meshS = this.wall_state.meshFor(this);
    if (meshS && meshS.cells) for (let i = 0; i < meshS.cells.length; i++) setFlag(meshS.cells[i] && meshS.cells[i].fluid);
  }
  // The explicit sulfur-reservoir mode is also a non-numeric latch. Initial
  // scenario clones already carry it; this broadcast additionally covers a
  // creative/event fluid converted to explicit pools at runtime.
  if (this.conditions.fluid.sulfurPoolsExplicit) {
    const copySulfurFlags = (f) => {
      if (!f) return;
      f.sulfurPoolsExplicit = true;
      f.nativeSulfurPathway = this.conditions.fluid.nativeSulfurPathway;
      syncExplicitSulfurTotal(f);
    };
    if (grid && grid.voxels) for (let i = 0; i < grid.voxels.length; i++) copySulfurFlags(grid.voxels[i] && grid.voxels[i].fluid);
    const meshSulfur = this.wall_state.meshFor(this);
    if (meshSulfur && meshSulfur.cells) for (let i = 0; i < meshSulfur.cells.length; i++) copySulfurFlags(meshSulfur.cells[i] && meshSulfur.cells[i].fluid);
  }
  // Declaration-driven sulfur audit. Internal pool transfers have an expected
  // net boundary flux of exactly zero. Additions and brine replacements are
  // computed from their authored transaction records and the PRE-event spatial
  // state; an unexplained residual is never re-labelled as a boundary source.
  if (explicitSulfurActive) {
    const before = preSulfurState || _spatialSulfurState(this);
    const after = _spatialSulfurState(this);
    let declaredImportsPpm = 0;
    let declaredExportsPpm = 0;
    let declaredBulkNetPpm = 0;
    for (const declaration of sulfurDeclarations) {
      if (declaration.kind === 'addition') {
        const amount = Math.max(0, Number(declaration.amountPpmPerFluid) || 0);
        declaredImportsPpm += amount * before.count;
        declaredBulkNetPpm += amount;
      } else if (declaration.kind === 'replacement') {
        const target = ['S_sulfide', 'S_sulfate', 'S_elemental'].reduce(
          (sum, key) => sum + Math.max(0, Number(declaration.targets?.[key]) || 0),
          0,
        );
        for (const prior of before.totals) {
          const delta = target - prior;
          if (delta >= 0) declaredImportsPpm += delta;
          else declaredExportsPpm -= delta;
        }
        declaredBulkNetPpm += target - sulfurSystemTotalPpm(preFluid);
      }
    }
    const expectedNetPpm = declaredImportsPpm - declaredExportsPpm;
    const actualNetPpm = after.totalPpm - before.totalPpm;
    const bulkNetPpm = sulfurSystemTotalPpm(this.conditions.fluid)
      - sulfurSystemTotalPpm(preFluid);
    const poolChanged = ['S_sulfide', 'S_sulfate', 'S_elemental'].some(
      key => (Number(this.conditions.fluid[key]) || 0) !== (Number(preFluid[key]) || 0),
    );
    const errorPpm = actualNetPpm - expectedNetPpm;
    const bulkDeclarationErrorPpm = bulkNetPpm - declaredBulkNetPpm;
    const tolerancePpm = _ledgerTolerance(Math.max(before.totalPpm, after.totalPpm));
    const hasAuthenticatedActivationBaseline = !activatingExplicitSulfur || !!preSulfurState;
    const closed = hasAuthenticatedActivationBaseline
      && Math.abs(errorPpm) <= tolerancePpm
      && Math.abs(bulkDeclarationErrorPpm) <= _ledgerTolerance(before.count ? before.totalPpm / before.count : 0);
    if (activatingExplicitSulfur) {
      const solidInitialPpm = bookedSolidSulfurPpm(this.crystals || []);
      this._sulfurLedgerInitialPpm = before.totalPpm + solidInitialPpm;
      this._sulfurBoundaryImportsPpm = 0;
      this._sulfurBoundaryExportsPpm = 0;
      this._sulfurBoundaryTransactions = [];
      this._sulfurPropagationViolations = [];
      this._sulfurLedgerActivation = {
        step: Number(this.step) || 0,
        kind: 'legacy_combined_to_explicit_reservoirs',
        fluidInitialPpm: before.totalPpm,
        solidInitialPpm,
        declaredImportsPpm,
        declaredExportsPpm,
        beforeCount: before.count,
        afterCount: after.count,
        propagationErrorPpm: errorPpm,
        bulkDeclarationErrorPpm,
        tolerancePpm,
        closed,
      };
    }
    if (poolChanged || sulfurDeclarations.length) {
      const transaction = {
        step: Number(this.step) || 0,
        declarations: sulfurDeclarations,
        kind: sulfurDeclarations.length ? 'declared_boundary' : 'internal_transfer',
        beforePpm: before.totalPpm,
        afterPpm: after.totalPpm,
        declaredImportsPpm,
        declaredExportsPpm,
        expectedNetPpm,
        actualNetPpm,
        errorPpm,
        bulkDeclarationErrorPpm,
        tolerancePpm,
        activation: activatingExplicitSulfur,
        activationBaselinePresent: hasAuthenticatedActivationBaseline,
        closed,
      };
      (this._sulfurBoundaryTransactions ||= []).push(transaction);
      if (!closed) (this._sulfurPropagationViolations ||= []).push(transaction);
    }
    this._sulfurBoundaryImportsPpm = (this._sulfurBoundaryImportsPpm || 0) + declaredImportsPpm;
    this._sulfurBoundaryExportsPpm = (this._sulfurBoundaryExportsPpm || 0) + declaredExportsPpm;
  }

  // Opt-in scenario carbon audit: methane-derived carbonate, wall release,
  // and external imports are distinct declared sources. Internal pH/
  // speciation changes must leave the total-DIC proxy unchanged.
  if (this._carbonLedgerEnabled && preCarbonState) {
    const after = _spatialCarbonState(this);
    const count = preCarbonState.count;
    let expectedNetPpm = 0;
    let declaredImportsPpm = 0;
    let declaredExportsPpm = 0;
    let declaredBulkNetPpm = 0;
    let replacementImportsPpm = 0;
    for (const declaration of carbonDeclarations) {
      if (declaration.kind === 'addition') {
        const amount = Math.max(0, Number(declaration.carbonatePpmPerFluid) || 0);
        const spatial = amount * count;
        expectedNetPpm += spatial;
        declaredImportsPpm += spatial;
        declaredBulkNetPpm += amount;
        if (declaration.category === 'methane_import') this._carbonMethaneImportsPpm += spatial;
        else if (declaration.category === 'wall_release') this._carbonWallReleasePpm += spatial;
        else this._carbonExternalImportsPpm += spatial;
      } else if (declaration.kind === 'replacement') {
        const target = Math.max(0, Number(declaration.targetCarbonatePpm) || 0);
        for (const prior of preCarbonState.totals) {
          const delta = target - prior;
          if (delta >= 0) {
            declaredImportsPpm += delta;
            replacementImportsPpm += delta;
          }
          else declaredExportsPpm -= delta;
        }
        const replacementNet = (target * count) - preCarbonState.totalPpm;
        expectedNetPpm += replacementNet;
        declaredBulkNetPpm += target - Math.max(0, Number(preFluid.CO3) || 0);
      }
    }
    this._carbonExternalImportsPpm += replacementImportsPpm;
    this._carbonExportsPpm += declaredExportsPpm;
    const actualNetPpm = after.totalPpm - preCarbonState.totalPpm;
    const bulkNetPpm = Math.max(0, Number(this.conditions.fluid.CO3) || 0)
      - Math.max(0, Number(preFluid.CO3) || 0);
    const errorPpm = actualNetPpm - expectedNetPpm;
    const bulkDeclarationErrorPpm = bulkNetPpm - declaredBulkNetPpm;
    const tolerancePpm = _ledgerTolerance(Math.max(preCarbonState.totalPpm, after.totalPpm));
    const closed = Math.abs(errorPpm) <= tolerancePpm
      && Math.abs(bulkDeclarationErrorPpm) <= _ledgerTolerance(count ? preCarbonState.totalPpm / count : 0);
    if (bulkNetPpm !== 0 || carbonDeclarations.length) {
      const transaction = {
        step: Number(this.step) || 0,
        declarations: carbonDeclarations,
        beforePpm: preCarbonState.totalPpm,
        afterPpm: after.totalPpm,
        expectedNetPpm,
        declaredImportsPpm,
        declaredExportsPpm,
        actualNetPpm,
        errorPpm,
        bulkDeclarationErrorPpm,
        tolerancePpm,
        closed,
      };
      this._carbonSourceTransactions.push(transaction);
      if (!closed) this._carbonPropagationViolations.push(transaction);
    }
  }
  if (fluidBoundaryDeclarations.length) {
    const declaredFields = new Set<string>();
    const declaredAdditions: Record<string, number> = {};
    const declaredReplacementTargets: Record<string, number> = {};
    const expectedAfterByField: Record<string, number> = {};
    for (const declaration of fluidBoundaryDeclarations) {
      for (const [field, raw] of Object.entries(declaration.fields || {})) {
        const value = Math.max(0, Number(raw) || 0);
        declaredFields.add(field);
        if (!(field in expectedAfterByField)) {
          expectedAfterByField[field] = Math.max(0, Number(preFluid[field]) || 0);
        }
        if (declaration.kind === 'addition') {
          declaredAdditions[field] = (declaredAdditions[field] || 0) + value;
          expectedAfterByField[field] += value;
        } else if (declaration.kind === 'replacement') {
          declaredReplacementTargets[field] = value;
          expectedAfterByField[field] = value;
        }
      }
    }
    const fields = Array.from(declaredFields).sort();
    const testimony = fields.map(field => {
      const before = Math.max(0, Number(preFluid[field]) || 0);
      const after = Math.max(0, Number(this.conditions.fluid[field]) || 0);
      const declaredAddition = declaredAdditions[field] || 0;
      const declaredReplacementTarget = field in declaredReplacementTargets
        ? declaredReplacementTargets[field] : null;
      const declaredDelta = expectedAfterByField[field] - before;
      const declaredImports = Math.max(0, declaredDelta);
      const declaredExports = Math.max(0, -declaredDelta);
      const actualDelta = after - before;
      const error = actualDelta - declaredDelta;
      const tolerance = _ledgerTolerance(Math.max(before, after));
      return { field, before, after, declaredAddition, declaredReplacementTarget,
        declaredDelta, declaredImports, declaredExports, actualDelta, error, tolerance,
        closed: Math.abs(error) <= tolerance };
    });
    const transaction = {
      step: Number(this.step) || 0,
      declarations: fluidBoundaryDeclarations,
      testimony,
      closed: testimony.every(row => row.closed),
    };
    this._fluidBoundaryTransactions.push(transaction);
    if (!transaction.closed) this._fluidBoundaryViolations.push(transaction);
  }
  const deltaT = this.conditions.temperature - preTemp;
  const ambientStep = options?.ambientThermalStep;
  const hasAmbientThermalDelta = ambientStep
    && ((Number(ambientStep.coolingDeltaC) || 0) !== 0
      || (Number(ambientStep.pulseDeltaC) || 0) !== 0);
  if (deltaT !== 0 || hasAmbientThermalDelta) {
    const localAmbientStep = ambientStep
      && Number.isFinite(Number(ambientStep.ambientTemperatureC))
      && typeof grid?.applyAmbientThermalStep === 'function';
    if (localAmbientStep) {
      grid.applyAmbientThermalStep(
        Number(ambientStep.coolingDeltaC) || 0,
        Number(ambientStep.ambientTemperatureC),
        Number(ambientStep.pulseDeltaC) || 0,
      );
      const boundaryMeans = grid.boundaryTemperatureMeans?.() || [];
      for (let k = 0; k < this.ring_temperatures.length; k++) {
        if (Number.isFinite(boundaryMeans[k])) this.ring_temperatures[k] = boundaryMeans[k];
      }
      const volumeMean = grid.temperatureMean?.();
      if (Number.isFinite(volumeMean)) this.conditions.temperature = volumeMean;
    } else if (grid && typeof grid.propagateTemperatureDelta === 'function') {
      grid.propagateTemperatureDelta(deltaT, 'all');
    }
    if (!localAmbientStep) {
      for (let k = 0; k < this.ring_temperatures.length; k++) {
        if (k === equator) {
          this.ring_temperatures[k] = this.conditions.temperature;
        } else if (ambientStep && Number.isFinite(Number(ambientStep.ambientTemperatureC))) {
          const ambient = Number(ambientStep.ambientTemperatureC);
          const cooling = Math.min(0, Number(ambientStep.coolingDeltaC) || 0);
          const pulse = Math.max(0, Number(ambientStep.pulseDeltaC) || 0);
          const prior = this.ring_temperatures[k];
          const cooled = prior > ambient ? Math.max(ambient, prior + cooling) : prior;
          this.ring_temperatures[k] = cooled + pulse;
        } else {
          this.ring_temperatures[k] += deltaT;
        }
      }
    }
  }
},

  // v26: drain `porosity × WATER_LEVEL_DRAIN_RATE` rings per step
// when the water-level mechanic is active. No-op when
// fluid_surface_ring is null, porosity is 0 (sealed default), or
// surface is already at 0. Asymmetric: porosity is a pure sink, not
// a balance term — refilling stays event-driven. Refill events that
// snap fluid_surface_ring above ring_count get clamped here on the
// next step (so events can write a sentinel like 1e6 to mean
// "fill to ceiling" without needing to know ring_count themselves).
_applyWaterLevelDrift() {
  let s = this.conditions.fluid_surface_ring;
  if (s === null || s === undefined) return 0;
  const n = this.wall_state.ring_count;
  if (s > n) {
    this.conditions.fluid_surface_ring = n;
    s = n;
  }
  const p = this.conditions.porosity;
  if (p <= 0 || s <= 0) return 0;
  const delta = -p * WATER_LEVEL_DRAIN_RATE;
  const newS = Math.max(0, s + delta);
  this.conditions.fluid_surface_ring = newS;
  return newS - s;
},

  // v25: detect rings that just transitioned wet → dry (submerged or
// meniscus → vadose) and force their fluid to oxidizing chemistry.
// Submerged rings keep the scenario's chemistry, so the cavity floor
// stays reducing while the now-exposed ceiling oxidizes — matches
// real-world supergene paragenesis (galena → cerussite, chalcopyrite
// → malachite/azurite, pyrite → limonite, all in the air zone).
_applyVadoseOxidationOverride() {
  const n = this.wall_state.ring_count;
  const oldStates = Array.isArray(this._prevCavityWaterStates)
    && this._prevCavityWaterStates.length === n
    ? this._prevCavityWaterStates.slice()
    : new Array(n).fill('submerged');
  // This deliberately fails closed when production Cartesian authority is
  // unavailable. Chemistry must not continue from a WallMesh substitute.
  const newStates = Array.from(
    { length: n }, (_, ring) => this.conditions.ringWaterState(ring, n),
  );
  this._prevFluidSurfaceHeightMm = this.conditions.fluid_surface_height_mm;
  this._prevCavityWaterStates = newStates;
  // v161: handle BOTH water-level directions in one pass. Drying (wet→vadose)
  // oxidizes + evaporatively concentrates; rewetting (vadose→wet) re-dilutes.
  // Previously this early-returned whenever the surface rose, which made the
  // evaporative `concentration` boost a ONE-WAY RATCHET: searles_lake pinned
  // at the chip clamp after 2-3 dry cycles, and the redissolution half of the
  // evaporite cycle (fresh_pulse's narrated "brine dilutes, salt crusts
  // begin to redissolve") never fired — only the first few dryings did any
  // chemical work. The rewetting branch in the loop below restores it, so a
  // freshwater flood (searles fresh_pulse, naica/aquifer recharge) actually
  // dilutes the brine. A no-transition step (surface unchanged) now falls
  // through the loop as a cheap no-op rather than early-returning.
  // PROPOSAL-CAVITY-MESH Phase 4 Tranche 4a — apply the vadose override
  // to EVERY cell in a transitioning ring, not just the ring-level
  // pool. Post-un-aliasing each cell has its own fluid; the
  // oxidation-+-evaporation-boost has to hit all of them or only
  // the first vertex of each ring would oxidize while the rest stay
  // reducing — clearly wrong.
  const mesh = this.wall_state.meshFor
    ? this.wall_state.meshFor(this)
    : null;
  const grid = this.wall_state.voxelGridFor
    ? this.wall_state.voxelGridFor(this)
    : null;
  const cellsPerRing = this.wall_state.cells_per_ring || 0;
  // Only the normalized config stored by the semantic validator may alter the
  // drying boundary. A malformed declaration therefore falls back to the
  // ordinary vadose behavior; raw authored values never partly activate.
  const weatheringState = this._weatheringEpilogueState;
  const weatheringCfg = weatheringState?.valid ? weatheringState.config : null;
  const weatheringActive = !!weatheringCfg && weatheringEpilogueActive(this);
  const targetResidualO2 = weatheringActive
    ? weatheringCfg.oxygen.target_residual_ppm
    : 1.8;
  const concentrationFactor = weatheringActive
    ? weatheringCfg.drainage.concentration_factor
    : EVAPORATIVE_CONCENTRATION_FACTOR;
  const becameVadose = [];
  const rewetted = [];
  const exposureRows: any[] = [];
  const applyDryingBoundary = (fluid: any) => {
    if (!fluid) return null;
    const oxygenBefore = Math.max(0, Number(fluid.O2) || 0);
    const sulfurBefore = fluid.sulfurPoolsExplicit
      ? sulfurSystemTotalPpm(fluid)
      : Math.max(0, Number(fluid.S) || 0);
    // Open-air exposure supplies dissolved oxygen up to the authored residual.
    // Sulfur is never deleted here. Legacy one-pool fluids retain their total;
    // explicit-pool reactions must use a separately balanced redox transfer.
    fluid.O2 = Math.max(oxygenBefore, targetResidualO2);
    fluid.concentration *= concentrationFactor;
    const sulfurAfter = fluid.sulfurPoolsExplicit
      ? sulfurSystemTotalPpm(fluid)
      : Math.max(0, Number(fluid.S) || 0);
    return {
      oxygenBeforePpm: oxygenBefore,
      oxygenImportedPpm: fluid.O2 - oxygenBefore,
      oxygenAfterPpm: fluid.O2,
      sulfurBeforePpm: sulfurBefore,
      sulfurAfterPpm: sulfurAfter,
      sulfurClosed: Math.abs(sulfurAfter - sulfurBefore) <= _ledgerTolerance(sulfurBefore),
    };
  };
  for (let r = 0; r < n; r++) {
    const was = oldStates[r];
    const now = newStates[r];
    if (now === 'vadose' && was !== 'vadose') {
      // Canonical 3-D path: every depth voxel in the exposed ring receives
      // the same atmospheric boundary. d=0 aliases the wall mesh, so this also
      // updates every visible wall cell without double-applying the factor.
      const canonicalRows: any[] = [];
      if (grid?.voxels?.length) {
        for (const voxel of grid.voxels) {
          if (voxel?.ringIdx !== r || !voxel.fluid) continue;
          const row = applyDryingBoundary(voxel.fluid);
          if (row) canonicalRows.push(row);
        }
      } else if (mesh && mesh.cells && cellsPerRing > 0) {
        for (let c = 0; c < cellsPerRing; c++) {
          const row = applyDryingBoundary(mesh.cells[r * cellsPerRing + c]?.fluid);
          if (row) canonicalRows.push(row);
        }
      }
      // ALSO update ring_fluids[r] so nucleation gates see the vadose
      // transition. Tranche 6 (2026-05) discovery via
      // tools/mineral_coverage_check.mjs: the mesh-only path above
      // boosted per-cell fluids but left ring_fluids[r] alone, so the
      // engine's nucleation gate (which reads conditions.fluid =
      // ring_fluids[equator] via alias) never saw concentration cross
      // the 1.5 threshold. Borax / mirabilite / thenardite stayed
      // stale across the entire searles_lake run despite mesh.cells
      // for vadose rings carrying concentration=3.0+.
      //
      // The cleanest fix: mirror the vadose override to ring_fluids[r]
      // as well so BOTH the engine-level gate (ring-fluid view) and
      // the per-vertex assignment (cell-fluid view) agree about the
      // vadose state. ring_fluids[equator] is conditions.fluid by
      // alias, so updating ring_fluids[equator] also updates
      // conditions.fluid — the engine sees the boost without further
      // plumbing.
      const rf = this.ring_fluids[r];
      const ringRow = applyDryingBoundary(rf);
      const allRows = ringRow ? [...canonicalRows, ringRow] : canonicalRows;
      exposureRows.push({
        ring: r,
        canonicalFluidCount: canonicalRows.length,
        compatibilityMirrorCount: ringRow ? 1 : 0,
        oxygenImportedCanonicalPpmEquivalent: canonicalRows.reduce(
          (sum, row) => sum + row.oxygenImportedPpm, 0,
        ),
        oxygenImportedCompatibilityMirrorPpm: ringRow?.oxygenImportedPpm || 0,
        sulfurBeforePpmEquivalent: allRows.reduce(
          (sum, row) => sum + row.sulfurBeforePpm, 0,
        ),
        sulfurAfterPpmEquivalent: allRows.reduce(
          (sum, row) => sum + row.sulfurAfterPpm, 0,
        ),
        sulfurClosed: allRows.every(row => row.sulfurClosed),
      });
      becameVadose.push(r);
    } else if (was === 'vadose' && now !== 'vadose') {
      // v161 rewetting: a freshwater flood (searles fresh_pulse, naica /
      // aquifer recharge) reflooded this ring. Reset the evaporative
      // `concentration` multiplier to baseline 1.0 — the dissolved load
      // re-dilutes and salt crusts redissolve, exactly as those events
      // narrate. Mirror of the drying boost above (same cells + ring_fluids
      // mirror so engine gate and per-vertex view agree). We deliberately do
      // NOT un-oxidize (O2) or restore S: air-exposure mineral reactions
      // (sulfide→oxide supergene paragenesis) persist through reflooding;
      // only the soluble evaporite load dilutes.
      if (grid?.voxels?.length) {
        for (const voxel of grid.voxels) {
          if (voxel?.ringIdx === r && voxel.fluid) voxel.fluid.concentration = 1.0;
        }
      } else if (mesh && mesh.cells && cellsPerRing > 0) {
        for (let c = 0; c < cellsPerRing; c++) {
          const cell = mesh.cells[r * cellsPerRing + c];
          if (cell?.fluid) cell.fluid.concentration = 1.0;
        }
      }
      const rf = this.ring_fluids[r];
      if (rf) rf.concentration = 1.0;
      rewetted.push(r);
    }
  }
  if (rewetted.length) {
    this.log.push(
      `  💧 Rewetting: rings ${rewetted.join(',')} reflooded — brine dilutes, `
      + `evaporative concentration resets to baseline 1.0×`);
  }
  if (becameVadose.length || rewetted.length) {
    (this._vadoseExposureTransactions ||= []).push({
      schema: 'vadose-boundary-receipt-v2',
      step: this.step,
      becameVadose: [...becameVadose],
      rewetted: [...rewetted],
      targetResidualO2Ppm: targetResidualO2,
      concentrationFactor,
      oxygenAccounting: 'canonical voxel ppm-equivalents; compatibility ring mirrors itemized separately',
      sulfurHandling: 'total-preserved; no implicit redox deletion',
      rings: exposureRows,
      closed: exposureRows.every(row => row.sulfurClosed),
    });
  }
  return becameVadose;
},

  // Phase C inter-ring homogenization. One discrete-Laplacian step per
// fluid component and per temperature, with Neumann (no-flux)
// boundary conditions at the floor and ceiling rings.
//
// Uniform rings → no-op (Laplacian of a constant is zero), which
// preserves byte-equality for default scenarios. Non-uniform rings
// relax the gradient by `rate * (neighbor sum - 2*self)` per step.
//
// Old values are read into a snapshot before any writes so each
// ring's update sees the pre-step state of its neighbors —
// otherwise ring k+1's update would already see ring k's new value
// and the diffusion would be asymmetric.
_diffuseRingState(rate?) {
  if (rate == null) rate = this.inter_ring_diffusion_rate;
  if (!(rate > 0)) return;
  // PROPOSAL-CAVITY-INTERIOR-VOXELS Phase 1 (v158) — voxel grid is
  // now the canonical diffusion entry point per [FIRM] H. In v158 the
  // implementation delegates to mesh.diffuse() for the d=0 (wall) slab
  // — byte-identical to the pre-v158 path because d=0 voxels alias
  // mesh.cells[].fluid via [FIRM] B, and d≥1 slabs are uniform at init
  // and never receive writes in v158. Phase 2 (v159) expands the
  // implementation to do real per-voxel diffusion + radial coupling
  // without changing this call site.
  //
  // Defensive fallback: if the voxel grid can't be resolved (headless
  // harness without CavityVoxelGrid loaded), fall through to direct
  // mesh.diffuse(). Maintains pre-v158 behavior in those paths.
  const grid = this.wall_state.voxelGridFor(this);
  if (grid && typeof grid.diffuse === 'function') {
    grid.diffuse(rate, this._fluidFieldNames);
  } else {
    const mesh = this.wall_state.meshFor(this);
    if (mesh && typeof mesh.diffuse === 'function') {
      mesh.diffuse(rate, this._fluidFieldNames);
    }
  }
},

  // ====================================================================
  // PROPOSAL-CAVITY-INTERIOR-VOXELS Phase 1 (v158) — sim-level voxel
  // accessors. Convenience pass-throughs to wall_state.voxelGridFor.
  //
  // Engines + UI consumers can reach the voxel grid directly via
  // sim.voxelAt(r, c, d) / sim.boundaryVoxel(r, c) / sim.fluidAtVoxel
  // without threading wall_state through every call site. Returns null
  // in headless paths where the grid couldn't be allocated.
  // ====================================================================

  // Get the voxel at (r, c, d). r ∈ [0, ring_count), c ∈ [0, cells_per_ring),
  // d ∈ [0, 3] (per [FIRM] A: 4-slice radial axis).
  voxelAt(r, c, d) {
    const grid = this.wall_state && this.wall_state.voxelGridFor
      ? this.wall_state.voxelGridFor(this)
      : null;
    return grid ? grid.voxelAt(r, c, d) : null;
  },

  // Get the boundary-layer voxel (d=0) for wall cell (r, c). Engine
  // growth-budget lands here in Phase 2+; in v158 the d=0 voxel is
  // aliased to wall.mesh.cells[r*N+c].fluid via [FIRM] B, so reading
  // through this and reading through mesh.cellOf() return the same
  // fluid object.
  boundaryVoxel(r, c) {
    const grid = this.wall_state && this.wall_state.voxelGridFor
      ? this.wall_state.voxelGridFor(this)
      : null;
    return grid ? grid.boundaryVoxel(r, c) : null;
  },

  // Get the fluid object at (r, c, d). Returns null if the voxel or
  // fluid is missing.
  fluidAtVoxel(r, c, d) {
    const grid = this.wall_state && this.wall_state.voxelGridFor
      ? this.wall_state.voxelGridFor(this)
      : null;
    return grid ? grid.fluidAt(r, c, d) : null;
  },

  // Sample a fluid field at fractional depth via linear interpolation
  // (per [FIRM] A: average-on-demand for consumers wanting > 4 slices
  // of resolution). depth is clamped to [0, depth_count-1].
  sampleVoxelFluid(r, c, depth, field) {
    const grid = this.wall_state && this.wall_state.voxelGridFor
      ? this.wall_state.voxelGridFor(this)
      : null;
    return grid ? grid.sampleFluid(r, c, depth, field) : NaN;
  },

  temperatureAtVoxel(r, c, d) {
    const grid = this.wall_state?.voxelGridFor?.(this);
    return grid?.temperatureAt ? grid.temperatureAt(r, c, d) : NaN;
  },

  sampleVoxelTemperature(r, c, depth) {
    const grid = this.wall_state?.voxelGridFor?.(this);
    return grid?.sampleTemperature ? grid.sampleTemperature(r, c, depth) : NaN;
  },

  configureThermalField(spec: any = {}) {
    this.conditions._scenario ||= {};
    const scenario: any = this.conditions._scenario;
    const prior: any = scenario.thermal_field || {};
    const finite = (value, fallback) => value !== null && value !== '' && value !== undefined
      && Number.isFinite(Number(value)) ? Number(value) : fallback;
    scenario.thermal_field = {
      enabled: spec.enabled !== false,
      conduction_fraction_per_step: Math.max(0, Math.min(
        1 / 6,
        finite(spec.conduction_fraction_per_step,
          prior.conduction_fraction_per_step ?? this.inter_ring_diffusion_rate),
      )),
      wall_coupling_fraction_per_step: Math.max(0, Math.min(
        1,
        finite(spec.wall_coupling_fraction_per_step,
          prior.wall_coupling_fraction_per_step ?? 0.02),
      )),
    };
    if (spec.wall_rock_thermal_buffer_C === null || spec.wall_rock_thermal_buffer_C === '') {
      delete scenario.wall_rock_thermal_buffer_C;
    } else if (Number.isFinite(Number(spec.wall_rock_thermal_buffer_C))) {
      scenario.wall_rock_thermal_buffer_C = Math.max(-273.15, Math.min(
        2000, Number(spec.wall_rock_thermal_buffer_C),
      ));
    }
    // Activation records that a canonical spatial field has been configured;
    // enabled/paused is a separate transport switch. Pausing retains the
    // field and its sources without making command order change semantics.
    this._thermalFieldActivated = true;
    return {
      ...scenario.thermal_field,
      wall_rock_thermal_buffer_C: scenario.wall_rock_thermal_buffer_C ?? null,
    };
  },

  setThermalSource(spec) {
    const grid = this.wall_state?.voxelGridFor?.(this);
    this._thermalSources ||= [];
    let fallbackId = String(spec?.id || '');
    if (!fallbackId) {
      do {
        this._thermalSourceCounter = (Number(this._thermalSourceCounter) || 0) + 1;
        fallbackId = `thermal-${this._thermalSourceCounter}`;
      } while (this._thermalSources.some(source => source.id === fallbackId));
    }
    const normalized = normalizeThermalSourceSpec(
      spec, grid, fallbackId,
    );
    if (!normalized) return null;
    const index = this._thermalSources.findIndex(source => source.id === normalized.id);
    if (index >= 0) this._thermalSources[index] = normalized;
    else this._thermalSources.push(normalized);
    this._thermalSources.sort((a, b) => a.id.localeCompare(b.id));
    this._thermalFieldActivated = true;
    return normalized;
  },

  removeThermalSource(id) {
    const before = this._thermalSources?.length || 0;
    this._thermalSources = (this._thermalSources || []).filter(source => source.id !== String(id));
    return before - this._thermalSources.length;
  },

  clearThermalSources() {
    const count = this._thermalSources?.length || 0;
    this._thermalSources = [];
    return count;
  },

  _advanceThermalField() {
    const grid = this.wall_state?.voxelGridFor?.(this);
    if (!grid?.advanceTemperatureField) return null;
    const scenario = this.conditions?._scenario || {};
    const config = scenario.thermal_field || {};
    if (config.enabled === false) return null;
    const hasSources = Array.isArray(this._thermalSources) && this._thermalSources.length > 0;
    const hasRockBoundary = scenario.wall_rock_thermal_buffer_C != null;
    // A source-free uniform field needs no work and remains byte-identical.
    if (!this._thermalFieldActivated && !hasSources && !hasRockBoundary) return null;
    const receipt = grid.advanceTemperatureField({
      step: this.step,
      sources: this._thermalSources,
      scenario,
      mesh: this.wall_state.meshFor(this),
      conduction_fraction_per_step:
        config.conduction_fraction_per_step ?? this.inter_ring_diffusion_rate,
      wall_coupling_fraction_per_step: config.wall_coupling_fraction_per_step ?? 0.02,
    });
    if (!receipt) return null;
    const means = grid.boundaryTemperatureMeans();
    for (let r = 0; r < this.ring_temperatures.length; r++) {
      if (Number.isFinite(means[r])) this.ring_temperatures[r] = means[r];
    }
    const mean = grid.temperatureMean();
    if (Number.isFinite(mean)) this.conditions.temperature = mean;
    this._thermalFieldReceipts ||= [];
    this._thermalFieldReceipts.push(receipt);
    return receipt;
  },

  setGlobalTemperature(valueC) {
    const next = Math.max(-273.15, Math.min(2000, Number(valueC)));
    if (!Number.isFinite(next)) return this.conditions.temperature;
    const prior = Number(this.conditions.temperature);
    const delta = Number.isFinite(prior) ? next - prior : 0;
    this.conditions.temperature = next;
    const grid = this.wall_state?.voxelGridFor?.(this);
    if (grid?.propagateTemperatureDelta && delta !== 0) {
      grid.propagateTemperatureDelta(delta, 'all');
      const means = grid.boundaryTemperatureMeans();
      for (let r = 0; r < this.ring_temperatures.length; r++) {
        if (Number.isFinite(means[r])) this.ring_temperatures[r] = means[r];
      }
    } else if (Array.isArray(this.ring_temperatures)) {
      for (let r = 0; r < this.ring_temperatures.length; r++) {
        this.ring_temperatures[r] = next;
      }
    }
    return next;
  },

  // ====================================================================
  // PROPOSAL-GEOLOGICAL-ACCURACY Phase 4c.1 — keep fluid.Eh in sync with
  // the fluid's redox proxy (fluid.O2) every step.
  //
  // Until 4c.1, fluid.Eh was written once at init (20-chemistry-fluid.ts:
  // `this.Eh = opts.Eh ?? 200`) and then FROZEN, while fluid.O2 — the
  // variable every redox engine actually reads — moved underneath it. So
  // the strip's Eh chip showed a dead flat line at 200 even as the redox
  // state swung. This derives Eh from O2 via the SAME ehFromO2 anchor map
  // the flag-ON redox helpers (20c) invert, so the engines read back the
  // identical O2. (Historical note: the planned 4c.2 clamp for the
  // diverging top saturation segment was never added — deemed unneeded at
  // max observed O2 ≈ 2.2 — and on 2026-06-10 the divergence itself was
  // fixed instead: both functions now saturate at 1000 mV/decade and are
  // exact inverses over the whole representable domain, Eh ≥ -620 mV.)
  //
  // OBSERVER-ONLY while the flag is OFF: nothing in flag-OFF mode reads
  // fluid.Eh (redoxFraction is uncalled; the per-class helpers read O2),
  // so this does NOT touch seed-42 crystal output — it only makes the
  // recorded/displayed Eh correct. Runs at step END (after diffusion, in
  // run_step) so the value the strip records reflects the step's final O2.
  // Walks every container the strip can read: the per-ring fluids
  // (conditions.fluid is the equator alias) + every voxel (d=0 aliases
  // mesh.cells[].fluid; d≥1 are the interior slices), with a mesh.cells
  // fallback for headless paths that have no voxel grid.
  //
  // Phase 4c.3a — Eh-CANONICAL direction. "Follow the science": redox
  // potential (Eh) is the fundamental master variable; dissolved O2 is one
  // expression of it. By DEFAULT (ehCanonical=false) O2 is the de-facto
  // master and Eh is its derived view (the 4c.1/4c.2 behavior, byte-identical).
  // But when a geological MOVEMENT drives fluid.Eh (run_step passes
  // ehCanonical=true for those steps), Eh is the source of truth: we reverse
  // the map and derive O2 = o2FromEh(Eh) so the movement's Eh survives to the
  // engines (which read Eh) AND any O2-reading path follows it. Without this,
  // the default O2→Eh sync would clobber a movement-driven Eh before the
  // engines saw it. NB: a scenario that ALSO drives O2 locally (vadose
  // override) while an Eh movement is active is a per-cell-ownership conflict
  // deferred to Phase 2 (mvt — the pilot — is closed, no vadose, so the coarse
  // whole-cavity flip is exact there). Sim-neutral until a scenario opts in.
  _syncRedoxEh(ehCanonical) {
    const one = ehCanonical
      ? (f) => { if (f && typeof f.Eh === 'number') f.O2 = o2FromEh(f.Eh); }
      : (f) => { if (f && typeof f.O2 === 'number') f.Eh = ehFromO2(f.O2); };
    const rf = this.ring_fluids;
    if (rf) for (let i = 0; i < rf.length; i++) one(rf[i]);
    const grid = this.wall_state && this.wall_state.voxelGridFor
      ? this.wall_state.voxelGridFor(this) : null;
    if (grid && grid.voxels && grid.voxels.length) {
      const vox = grid.voxels;
      for (let i = 0; i < vox.length; i++) one(vox[i] && vox[i].fluid);
    } else {
      // No grid (headless harness) — d=0 wall fluids live on mesh.cells.
      const mesh = this.wall_state && this.wall_state.meshFor
        ? this.wall_state.meshFor(this) : null;
      if (mesh && mesh.cells) {
        for (let i = 0; i < mesh.cells.length; i++) one(mesh.cells[i] && mesh.cells[i].fluid);
      }
    }
  },

  // ====================================================================
  // REVIEW-THREE-METRICS §1.4 resolution (2026-06-10) — ring_fluids is
  // RETIRED as a forward chemistry store. The replay snapshot no longer
  // clones the (frozen) non-equator slots; it captures a PROJECTION of
  // the canonical per-cell chemistry (mesh.cells[].fluid) computed by
  // this helper at snapshot time.
  //
  // History: Phase C gave each ring its own fluid and
  // _propagateGlobalDelta kept them fed with event deltas. The cavity-
  // mesh tranches moved canonical chemistry to per-cell storage and
  // v159 re-pointed event propagation at the voxel grid — after which
  // the documented per-ring loop was gone and the non-equator slots
  // froze at the initial broth for the whole run (review §1.4 probe:
  // vein seed 42, all 15 non-equator rings 100% divergent on Zn).
  // Their one LIVE consumer — the replay snapshot capture
  // (_repaintWallState → snap.ring_fluids), which the helicoid replay
  // chips read — was therefore showing initial-broth chemistry for 15
  // of 16 rings: the replay-mode sibling of the v157 live-chip pyramid
  // artifact.
  //
  // The decision (per the review: "retire the store or restore the
  // loop — not a third partial mirror"): RETIRE. The projection is not
  // a mirror of event writes — it is a total, unidirectional read-time
  // computation canon → snapshot, so it cannot rot the way the partial
  // mirrors did.
  //
  // Why SNAPSHOT-time, not every step (the first cut ran in run_step):
  // measured 1.32 ms/call on roughten_gill (16×120 cells × 45 dynamic-
  // key fields) ≈ 12% of a 10.7 ms step — enough to push the 32-seed
  // integration tests (pharmacolite 150 s, roughten-gill 90 s budgets)
  // over their timeouts under parallel suite load. At snapshot stride
  // (~63 captures per 200-step run) the same work costs ~80 ms per run.
  //
  // The LIVE ring_fluids array is deliberately untouched:
  //   * ring_fluids[equator] === conditions.fluid (the alias) is the
  //     BULK view events and the bulk nucleation gate read — load-
  //     bearing, the Tranche-6 borax lesson.
  //   * The non-equator slots keep their legacy frozen-at-init values
  //     (plus the vadose/open-atmosphere partial writes), so the
  //     mesh-absent fallback readers (_runEngineForCrystal sentinel,
  //     dehydration, 20d) see EXACTLY what they saw before — byte-
  //     identical by construction, not by hope. (Census at seed 42:
  //     tools/cell-resolution-census.mjs measured 0 fallback hits in
  //     8966+ crystal-step reads — but 0-measured ≠ 0-guaranteed, and
  //     frozen is what the calibration was tuned against.)
  //   * `concentration` is carried through from the stored slot, NOT
  //     averaged (same exclusion as diffusion's _fluidFieldNames): it
  //     is per-ring evaporative state owned by the vadose mechanic.
  //
  // Returns an array shaped like ring_fluids (one fluid-like object per
  // ring): equator = clone of conditions.fluid (the bulk view, exactly
  // what the old capture put there via the alias); other rings = clone
  // of the stored slot with every _fluidFieldNames field overwritten by
  // the ring's cell mean. Falls back to plain clones when no mesh is
  // built (headless harness) — the legacy capture, unchanged.
  _ringFluidMeans() {
    const rf = this.ring_fluids;
    if (!rf || !rf.length) return null;
    const out = new Array(rf.length);
    const mesh = this.wall_state && this.wall_state.meshFor
      ? this.wall_state.meshFor(this) : null;
    const perRing = this.wall_state.cells_per_ring || 0;
    const haveCells = !!(mesh && mesh.cells && mesh.cells.length && perRing > 0);
    const equator = Math.floor(this.wall_state.ring_count / 2);
    const fields = this._fluidFieldNames || [];
    const nF = fields.length;
    const sums = new Array(nF);
    const counts = new Array(nF);
    for (let r = 0; r < rf.length; r++) {
      const clone = rf[r] ? _cloneFluid(rf[r]) : null;
      out[r] = clone;
      if (!clone || !haveCells || r === equator) continue;
      sums.fill(0); counts.fill(0);
      for (let c = 0; c < perRing; c++) {
        const cell = mesh.cells[r * perRing + c];
        const f = cell && cell.fluid;
        if (!f) continue;
        for (let i = 0; i < nF; i++) {
          const v = f[fields[i]];
          if (typeof v === 'number' && isFinite(v)) { sums[i] += v; counts[i]++; }
        }
      }
      for (let i = 0; i < nF; i++) {
        if (counts[i] > 0) clone[fields[i]] = sums[i] / counts[i];
      }
    }
    return out;
  },

  _repaintWallState() {
  // Rebuild ring-0 occupancy from the crystal list. Cheap (~120 × ~20)
  // and keeps per-cell thickness consistent with dissolution / enclosure.
  this.wall_state.updateCapacity(
    this.conditions.wall.cavity_capacity_volume_mm3,
    this.conditions.wall.vug_diameter_mm,
  );
  this.wall_state.clear();
  // Paint smallest-first so biggest crystals win overlaps — that's
  // what a viewer would see from outside the vug.
  const sorted = [...this.crystals].sort((a, b) => a.total_growth_um - b.total_growth_um);
  // Proposal E (2026-05-18): per-cell local-fill painter runs alongside
  // the occupancy painter when wall_state.per_cell_local_fill is on.
  // Order doesn't matter (the two painters write disjoint fields:
  // crystal_id/mineral/thickness_um vs _localCrystalVol_mm3) but
  // looping once is cheaper than twice.
  const paintLocalFill = this.wall_state.per_cell_local_fill;
  for (const crystal of sorted) {
    if (crystal.dissolved) continue;
    this.wall_state.paintCrystal(crystal);
    if (paintLocalFill) {
      this.wall_state._paintCrystalVolume(crystal);
    }
  }

  // v67 progressive snapshot decimation. The naive "push every step"
  // policy from v65/v66 grows wall_state_history at ~150 KB per step,
  // so a 1000-step run holds 150 MB in memory. The geological action
  // is densest early (most nucleations + first dissolution events
  // happen in the first ~30 steps), and gets progressively quieter as
  // chemistry stabilizes. So: keep every step early, stride wider as
  // step number grows.
  //
  // Tier breakpoints (chosen so the bound is ≤~100 snapshots regardless
  // of run length, and replay frame_ms stays in [16, 40] ms):
  //   step 0..29:    stride  1   (30 snapshots — full early-growth
  //                              detail)
  //   step 30..89:   stride  3   (20)
  //   step 90..269:  stride  9   (20)
  //   step 270..809: stride 27   (20)
  //   step 810..2429: stride 81  (20)
  //   ... 3× per tier thereafter
  //
  // For a 200-step run total snapshots ~ 63 (vs 200 pre-v67); a
  // 1000-step run ~ 93. Replay timer iterates linearly — frames in
  // older tiers cover multiple sim steps each, but that's actually
  // accurate for "not much happened in those windows" anyway.
  //
  // Trade-off: the LATEST step may be up to (stride-1) steps behind
  // the live sim state when the user clicks Replay. For step 100
  // (stride 9) that means replay ends at step 99 — visually
  // indistinguishable. The live render itself uses sim.crystals
  // directly, not history, so the user always sees the actual current
  // state outside replay.
  const stride = _replayStride(this.step);
  if (this.step % stride !== 0) return;

  // v66 multi-ring snapshot for the Replay button. Shape:
  //   {
  //     step,
  //     rings: [ring0_cells, ring1_cells, ..., ringN_cells],
  //     conditions: {
  //       temperature, pressure, pH, flow_rate,
  //       vug_diameter_mm, total_dissolved_mm, fluid_surface_ring,
  //       fluid: {…full FluidChemistry clone…},
  //     },
  //     radiation_dose,
  //   }
  // Each cell is a shallow clone of its render-relevant fields —
  // including base_radius_mm so the Phase-1 Fourier profile is
  // preserved across replay frames. The `step` field lets the renderer
  // look up historical c_length per crystal (sum zones[k].thickness_um
  // where zones[k].step <= step) so the replay shows growth order, not
  // the live final size on every frame.
  //
  // The `conditions` block is what the fortress-status panel reads
  // during replay so T / pH / pressure / fluid composition all rewind
  // honestly — without this, the panel keeps flashing live values
  // while the cavity geometry replays.
  //
  // Storage cost: ring_count× the v60 schema (16× by default; ~24 KB
  // → ~384 KB for a 200-step run) + ~1 KB conditions per snapshot
  // (~200 KB extra for a 200-step run). Acceptable for in-memory
  // replay. Legacy flat snapshots (Array shape) are still tolerated
  // by topoRender / _topoSnapshotWall on the consumer side — see the
  // shape detection in 99b-renderer-topo-2d.ts and
  // 99i-renderer-three.ts.
  const ringCount = this.wall_state.ring_count;
  const cnd = this.conditions;
  // Provider selection is part of the scientific replay timeline, not a live
  // renderer preference. Capture the exact authenticated receipt at this step
  // so a later replay cannot inherit whichever provider happens to be active.
  const cavitySurfaceProvider = this.wall_state.cavitySurfaceAnchorProviderReceipt
    ? this.wall_state.cavitySurfaceAnchorProviderReceipt()
    : { kind: 'wall-mesh' };
  const cavityAppearance = CavityWaterAppearance.create(this.wall_state, cnd, {
    sim: this,
    providerReceipt: cavitySurfaceProvider,
  });
  const cavityMaterialState = CavityWallMaterialState.create(this.wall_state);
  const waterHistory = this._cavityWaterAppearanceLedger;
  if (!waterHistory || waterHistory !== this.wall_state._cavityWaterAppearanceLedger) {
    throw new Error('cavity water history authority is unavailable');
  }
  const waterHistoryEntry = waterHistory.append(
    this.step, this.wall_state, cnd, cavityAppearance.receipt,
  );
  const materialHistory = this._cavityWallMaterialHistoryLedger;
  if (!materialHistory
      || materialHistory !== this.wall_state._cavityWallMaterialHistoryLedger) {
    throw new Error('cavity wall material history authority is unavailable');
  }
  const materialHistoryEntry = materialHistory.append(
    this.step, this.wall_state, cavityMaterialState,
  );
  const snap: any = {
    sim_version: SIM_VERSION,
    step: this.step,
    cavity_evolution_cursor: this.wall_state.cavityEvolutionLedger
      && this.wall_state.cavityEvolutionLedger()
      ? this.wall_state.cavityEvolutionLedger().cursor : null,
    cavity_evolution_signature: this.wall_state.cavityEvolutionLedger
      && this.wall_state.cavityEvolutionLedger()
      ? this.wall_state.cavityEvolutionLedger().signature : null,
    cavity_surface_provider: { ...cavitySurfaceProvider },
    cavity_appearance: { ...cavityAppearance.receipt },
    cavity_water_history_cursor: waterHistory.cursor,
    cavity_water_history_signature: waterHistory.signature,
    cavity_water_history_entry_digest: waterHistoryEntry.entry_digest,
    cavity_material_state: { ...cavityMaterialState },
    cavity_material_history_cursor: materialHistory.cursor,
    cavity_material_history_signature: materialHistory.signature,
    cavity_material_history_entry_digest: materialHistoryEntry.entry_digest,
    cavity_production_contract_digest:
      this.wall_state._cavityProductionAuthorityContract?.contract_digest ?? null,
    rings: new Array(ringCount),
    conditions: {
      temperature: cnd.temperature,
      pressure: cnd.pressure,
      pH: cnd.fluid.pH,
      flow_rate: cnd.flow_rate,
      vug_diameter_mm: cnd.wall.vug_diameter_mm,
      total_dissolved_mm: cnd.wall.total_dissolved_mm,
      cavity_capacity_volume_mm3: cnd.wall.cavity_capacity_volume_mm3,
      fluid_surface_height_mm: cnd.fluid_surface_height_mm,
      fluid_surface_ring: cnd.fluid_surface_ring,
      // Full fluid clone — fortress-status reads f.Cu / f.Fe / etc.
      // for the per-mineral "needs" hints, and the brief explicitly
      // calls out fluid-state trajectories as deferred-from-v65.
      fluid: _cloneFluid(cnd.fluid),
    },
    radiation_dose: this.radiation_dose,
    // === HELIX-OVERLAY-FORK ADDITION (v15) ============================
    // See proposals/HELIX-OVERLAY-FORK-CHANGES.md for the full
    // breadcrumb. This fork adds per-ring chemistry + temperature
    // to each snap so the helicoid overlay's rate band can source
    // scenario-time Δr (vugg-simulator parent doesn't need this).
    // Storage cost: 16 rings × ~50 fluid fields × 8 B = ~6.4 KB per
    // snap; for a 120-step MVT (stride 9 → ~14 snaps) that's ~90 KB
    // beyond the existing v66 schema. Smaller scenarios cost less;
    // 2400-step pegmatites cost ~190 KB.
    //
    // REVIEW §1.4 (2026-06-10): this used to clone the ring_fluids
    // array directly — whose non-equator slots froze at the initial
    // broth when v159 removed their event feed, so replay chips showed
    // day-zero chemistry for 15 of 16 rings. Now captures the per-ring
    // PROJECTION of the canonical cell chemistry instead; the live
    // store is untouched. See _ringFluidMeans for the full rationale.
    ring_fluids: this._ringFluidMeans ? this._ringFluidMeans() : null,
    ring_temperatures: this.ring_temperatures ? this.ring_temperatures.slice() : null,
    boundary_temperatures: (() => {
      const grid = this.wall_state?.voxelGridFor?.(this);
      if (!grid?.temperatureAt) return null;
      const out = new Array(this.wall_state.ring_count * this.wall_state.cells_per_ring);
      for (let r = 0; r < this.wall_state.ring_count; r++) {
        for (let c = 0; c < this.wall_state.cells_per_ring; c++) {
          out[r * this.wall_state.cells_per_ring + c] = grid.temperatureAt(r, c, 0);
        }
      }
      return out;
    })(),
    // === END HELIX-OVERLAY-FORK ADDITION ==============================
    // === HELIX-OVERLAY-FORK ADDITION (Week 3 carbonate) ===============
    // f_ord chip in the Carbonate System legend section reads cycle
    // count from the snap so replays show the ordering trajectory the
    // scenario actually walked through, not just the final value on
    // the live conditions object. Single scalar (fluid-level on
    // VugConditions per the Kim 2023 mechanism in 25-chemistry-
    // conditions.ts:49) — cheap; ~8 B per snap.
    _dol_cycle_count: (cnd && cnd._dol_cycle_count) || 0,
    // === END HELIX-OVERLAY-FORK ADDITION ==============================
  };
  for (let r = 0; r < ringCount; r++) {
    const ring = this.wall_state.rings[r];
    const N = ring.length;
    const ringSnap = new Array(N);
    for (let i = 0; i < N; i++) {
      const c = ring[i];
      ringSnap[i] = {
        wall_depth: c.wall_depth,
        crystal_id: c.crystal_id,
        mineral: c.mineral,
        thickness_um: c.thickness_um,
        base_radius_mm: c.base_radius_mm,
      };
    }
    snap.rings[r] = ringSnap;
  }
  this.wall_state_history.push(snap);
},

  _wallSurfaceAttackState() {
  const wall = this.conditions.wall;
  const mesh = this.wall_state.meshFor(this);
  if (!mesh) throw new Error('wall attack requires the canonical WallMesh');
  const topology = _wallMeshTopologyInternal(mesh);
  const vertexCount = topology.numInterior;
  if (!(vertexCount > 0)) throw new Error('wall attack requires the canonical WallMesh');
  const areas = _wallMeshCellSurfaceAreasInternal(mesh);
  const coverage = new Float64Array(vertexCount);
  const pHValues = new Float64Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) {
    const local = mesh.cells[i] && mesh.cells[i].fluid;
    pHValues[i] = Number.isFinite(local && local.pH)
      ? Number(local.pH) : Number(this.conditions.fluid.pH);
  }

  // Fractional union of every acid-resistant footprint. Unlike the paint
  // buffer, this does not discard overlapping or smaller crystals. Distances
  // are shortest paths over the live triangle mesh, and stability reads the
  // target cell's pre-attack local pH.
  for (const crystal of this.crystals) {
    if (!crystal || crystal.dissolved) continue;
    const anchor = this.wall_state._resolveAnchor(crystal);
    if (!anchor) continue;
    // The physical anchor was authenticated above; derive its chemistry
    // projection directly instead of resolving the same crystal a second time.
    const source = CavitySurfaceAnchors.chemistryAddress(anchor)?.vertexIndex ?? -1;
    if (source < 0 || source >= vertexCount) continue;
    // This consumer is synchronous and read-only, so use the mesh-private
    // cached distances rather than allocating a defensive 1,920-value copy for
    // every crystal on every wall attack.
    const distances = _wallMeshGeodesicDistancesInternal(mesh, source);
    const footprintRadiusMm = Math.max(0, this.wall_state.footprintArcMm(crystal) / 2);
    const acid = MINERAL_SPEC[crystal.mineral]?.acid_dissolution;
    for (let i = 0; i < vertexCount; i++) {
      const threshold = acid && acid.pH_threshold;
      const resistant = acid == null || threshold == null || pHValues[i] >= threshold;
      if (!resistant) continue;
      const cellRadius = Math.max(1e-9, Math.sqrt(Math.max(0, areas[i]) / Math.PI));
      const fraction = i === source ? 1 : Math.max(0, Math.min(1,
        (footprintRadiusMm + cellRadius - distances[i]) / (2 * cellRadius),
      ));
      if (fraction > 0) coverage[i] = 1 - (1 - coverage[i]) * (1 - fraction);
    }
  }

  const feederFlux = fluidSpotsDecayEnabled() && this._fluidSpots
      && !_fluidSpotIsEmptyInternal(this._fluidSpots)
    ? _fluidSpotErosionFluxInternal(this._fluidSpots, mesh) : null;
  const vertexWeights = new Float64Array(vertexCount);
  const blocked = new Set<number>();
  let totalArea = 0;
  let exposedArea = 0;
  let fluxArea = 0;
  let attemptedWeightedRate = 0;
  let acceptedWeightedRate = 0;
  let partialCells = 0;
  for (let i = 0; i < vertexCount; i++) {
    const area = areas[i];
    const exposure = Math.max(0, Math.min(1, 1 - coverage[i]));
    const flux = feederFlux ? feederFlux[i] : 1;
    const localAcidStrength = Math.max(0, 5.5 - pHValues[i]);
    const localRate = wall.dissolutionRateMm(localAcidStrength);
    vertexWeights[i] = exposure * flux * localRate;
    totalArea += area;
    exposedArea += area * exposure;
    fluxArea += area * flux;
    attemptedWeightedRate += area * flux * localRate;
    acceptedWeightedRate += area * flux * localRate * exposure;
    if (exposure <= 1e-12) blocked.add(i);
    else if (exposure < 1 - 1e-12) partialCells++;
  }
  const attemptedRate = fluxArea > 0 ? attemptedWeightedRate / fluxArea : 0;
  const acceptedRate = fluxArea > 0 ? acceptedWeightedRate / fluxArea : 0;
  const digest = CavityEvolutionLedger.digest({
    areas: Array.from(areas),
    coverage: Array.from(coverage),
    pre_attack_pH: Array.from(pHValues),
    feeder_flux: feederFlux ? Array.from(feederFlux) : null,
    diffuse_fluid_pathway: true,
  });
  return {
    mesh, areas, coverage, pHValues, feederFlux, vertexWeights, blocked,
    attemptedRate, acceptedRate,
    receipt: {
      digest,
      total_surface_area_mm2: totalArea,
      exposed_surface_area_mm2: exposedArea,
      exposed_area_fraction: totalArea > 0 ? exposedArea / totalArea : 0,
      fully_blocked_cells: blocked.size,
      partially_covered_cells: partialCells,
      total_cells: vertexCount,
      diffuse_fluid_pathway: true,
      feeder_model: feederFlux ? 'open-spot geodesic flux halo' : 'none',
      local_pH_basis: 'pre-attack WallCell fluid, bulk fallback',
      overlap_model: 'fractional footprint union',
    },
  };
},

  _wallCellsBlockedByCrystals() {
  return this._wallSurfaceAttackState().blocked;
},

  get_vug_fill() {
  const vugVol = Number(this.conditions.wall.cavity_capacity_volume_mm3);
  if (vugVol <= 0) return 0;
  let crystalVol = 0;
  for (const c of this.crystals) {
    if (c.dissolved === true) continue;
    // 2026-05-18 habit-stability fix: use the crystal's zone-integrated
    // _volume_mm3 (set by Crystal.add_zone per shell at the habit aspect
    // ratio AS-OF-EACH-ZONE). Previously this function recomputed the
    // entire ellipsoid volume from accumulated total_growth_um × current
    // habit's aspect ratio — which oscillated 14× per crystal when a
    // growth engine flipped crystal.habit between e.g. 'tabular'
    // (aRatio=1.5) and 'prismatic' (aRatio=0.4). Same total_growth_um,
    // different volume interpretation. The integrated _volume_mm3 is
    // stable: each zone's contribution is locked in at deposition time
    // and never reinterpreted. See js/27-geometry-crystal.ts header for
    // the full design rationale.
    //
    // Backward-compat fallback: legacy crystals (snapshots, tests) that
    // predate _volume_mm3 fall back to the old ellipsoid calc. The
    // fallback uses total_growth_um (uncapped chemistry-tracked size)
    // because v59 capped c_length_mm at vug_radius and reading it would
    // underreport big crystals (BUG-CRYSTALS-CLIP-VUG-WALL.md Tier-2).
    crystalVol += _crystalSolidVolumeMm3(c);
  }
  return crystalVol / vugVol;
},

  // When a big crystal grows past an adjacent smaller one that's stopped
// growing, the smaller crystal becomes an inclusion inside the bigger
// one. Classic "Sweetwater mechanism" — pyrite first, then calcite
// grows around it.
_check_enclosure() {
  const proposals: any[] = [];
  for (const grower of this.crystals) {
    if (!grower.active) continue;
    if (grower.enclosed_by != null) continue;
    // SIM 275 — an enclosure is a growth event, not a retrospective size
    // comparison.  The old predicate let a large but dormant crystal swallow
    // a newly slowing/dissolving neighbour without depositing any host
    // material: Bisbee's primary chalcopyrite, for example, claimed a
    // supergene native-copper grain at step 150 even though the chalcopyrite
    // recorded no layer from steps 130–156.  Require an accepted physical host
    // layer in this exact step before the footprint/size tests below can mint
    // an enclosure receipt. A later same-step etch must also be honoured: +1
    // then -1 um is no advancing growth front. Positive phantom testimony is
    // non-material, while negative phantom zones are real dissolved material.
    const hostStepZones = Array.isArray(grower.zones)
      ? grower.zones.filter((zone: any) => zone && zone.step === this.step
        && Number.isFinite(Number(zone.thickness_um)))
      : [];
    const hostPositiveGrowthUm = hostStepZones.reduce(
      (sum: number, zone: any) => sum + (
        Number(zone.thickness_um) > 0 && !zone.is_phantom
          ? Number(zone.thickness_um) : 0
      ),
      0,
    );
    const hostNegativeGrowthUm = hostStepZones.reduce(
      (sum: number, zone: any) => sum + (
        Number(zone.thickness_um) < 0 ? Math.abs(Number(zone.thickness_um)) : 0
      ),
      0,
    );
    const hostNetGrowthUm = hostPositiveGrowthUm - hostNegativeGrowthUm;
    if (!(hostPositiveGrowthUm > 0 && hostNetGrowthUm > 0)) continue;
    // Size-ratio uses the chemistry-truthful uncapped c_length
    // (total_growth_um / 1000) rather than the rendered/capped value.
    // v59's cavity cap pins c_length at vug_radius for big crystals,
    // which would shrink their grower-vs-candidate size ratio and
    // suppress enclosures that should fire — cause of gem_pegmatite
    // baseline drift before this fix.
    const growerPhysical = _physicalCrystalInventory(grower);
    if (!(growerPhysical.remainingUm > 0)) continue;
    const growerSize = growerPhysical.remainingUm / 1000;
    for (const candidate of this.crystals) {
      if (candidate.crystal_id === grower.crystal_id) continue;
      if (candidate.enclosed_by != null) continue;
      const candidatePhysical = _physicalCrystalInventory(candidate);
      const candidateRemainingGrowthUm = Number(candidatePhysical.remainingUm);
      if (candidate.dissolved || !Number.isFinite(candidateRemainingGrowthUm)
        || candidateRemainingGrowthUm <= 0) continue;
      // W-F O3b records growth-front shadowing, not a physical inclusion.
      // A shadowed solid therefore remains eligible for a later, independently
      // proven enclosure when a substrate-linked or geometrically adjacent host
      // deposits net-positive material over it.  Excluding `_buried` here was
      // the other half of the old conflation: it both suppressed dissolution
      // and prevented the actual overgrowth event from ever taking authority.
      if (grower.enclosed_crystals.includes(candidate.crystal_id)) continue;

      const candidateSize = candidateRemainingGrowthUm / 1000;
      const sizeRatio = growerSize / Math.max(candidateSize, 0.001);
      // W-F O4b (SIM 221) — GEOMETRIC adjacency. The string test this
      // replaces (position === position || position.includes(`#id`)) was
      // vacuous for free-wall pairs — every free-wall crystal holds the
      // literal 'vug wall', so any two of them "matched" across the cavity:
      // 276 of the fleet's 342 seed-42 enclosures fired at distances the
      // host's footprint never reaches (census: tools/o4b-adjacency-census
      // .mjs; wittichen at 246 mm). It also blocked same-host siblings whose
      // strings differ only by narrative qualifiers, and its substring
      // #-match let grower #1 claim a candidate sitting on host #12.
      // Adjacent now means what the wall already says: substrate-linked
      // (exact-ID via parsePositionHost, either direction), or anchor
      // great-circle distance within the two crystals' painted footprint
      // half-arcs (paintCrystal's own law, js/22 footprintArcMm) + one
      // cell of slack for the tessellation. Anchors are fixed at
      // nucleation; only footprints grow — a host too small to reach a
      // guest today re-qualifies naturally once its footprint arrives
      // (the census's DEFERRED class, 17 fleet-wide, lags 10–111 steps).
      const candHost = parsePositionHost(candidate.position, this.crystals);
      const growerHost = parsePositionHost(grower.position, this.crystals);
      const candOnGrower =
        !!(candHost && candHost.host && candHost.host.crystal_id === grower.crystal_id);
      const growerOnCand =
        !!(growerHost && growerHost.host && growerHost.host.crystal_id === candidate.crystal_id);
      const route = candOnGrower
        ? 'guest-on-host'
        : (growerOnCand ? 'host-on-guest' : 'geometric-overlap');
      // The 0.5-mm floor is a guard against an uncertain lateral footprint
      // claiming a neighbour before it has a resolved macroscopic front. Exact
      // substrate identity already proves contact, and the independent >3x
      // host/guest ratio below proves that the current host front can overtake
      // the guest; applying the lateral floor there wrongly blocked genuine
      // sub-millimetre reaction rims such as chrysocolla growing directly on a
      // retreating native-Cu grain.
      if (route === 'geometric-overlap' && growerSize < 0.5) continue;
      let adjacent = candOnGrower || growerOnCand;
      let anchorDistanceMm: number | null = null;
      let footprintReachMm: number | null = null;
      const aG = this.wall_state._resolveAnchor(grower);
      const aC = this.wall_state._resolveAnchor(candidate);
      if (aG && aC) {
        const cellArc = this.wall_state.cell_arc_mm;
        const halfG = Math.max(
          this.wall_state.footprintArcMm(grower, growerPhysical.remainingUm) / 2,
          cellArc,
        );
        const halfC = Math.max(
          this.wall_state.footprintArcMm(candidate, candidatePhysical.remainingUm) / 2,
          cellArc,
        );
        anchorDistanceMm = this.wall_state.anchorDistanceMm(aG, aC);
        footprintReachMm = halfG + halfC + cellArc;
      }
      if (!adjacent) {
        if (anchorDistanceMm != null && footprintReachMm != null) {
          // Per-crystal half-arcs floor at one cell — the painter's own
          // max(1, …) minimum (a nucleated crystal claims ±1 cell even
          // before its first zone), plus one cell of slack between the
          // patches for the tessellation. Matches the census predicate
          // exactly (the pre-registered blast radius depends on it).
          adjacent = anchorDistanceMm <= footprintReachMm;
        }
      }
      // Require the candidate to have actually lived a bit before it
      // can be swallowed. Without this, a just-nucleated crystal with
      // zero zones qualifies on step 1 and gets enveloped before it
      // grows a single face — 600 inclusions pile up in a loop of
      // nucleate-then-instantly-enclose. Real Sweetwater-style
      // pyrite needs time to exhaust its chemistry and stop growing
      // before the calcite takes it.
      if (!candidate.zones || candidate.zones.length < 3) continue;
      const recent = candidate.zones.slice(-3).reduce((sum: number, zone: any) => {
        const thicknessUm = Number(zone?.thickness_um);
        if (!Number.isFinite(thicknessUm)) return sum;
        if (thicknessUm > 0 && zone?.is_phantom) return sum;
        return sum + thicknessUm;
      }, 0);
      const slowing = recent < 3.0;
      if (sizeRatio > 3.0 && adjacent && slowing) {
        proposals.push({
          grower,
          candidate,
          route,
          candOnGrower,
          anchorDistanceMm,
          footprintReachMm,
          sizeRatio,
          recent,
          hostPositiveGrowthUm,
          hostNegativeGrowthUm,
          hostNetGrowthUm,
          hostPhysicalSizeUm: growerPhysical.remainingUm,
          guestPositiveCoreUm: candidatePhysical.positiveCoreUm,
          guestLossUm: candidatePhysical.lossUm,
          guestPhysicalRemainingUm: candidatePhysical.remainingUm,
        });
      }
    }
  }

  // A guest may be reachable from several advancing hosts. Select one causal
  // authority before mutating any crystal: its exact substrate host outranks a
  // host rooted on the guest, which outranks lateral overlap. Within a route,
  // nearest front, then larger size ratio, then crystal ID is deterministic.
  const routeRank = (route: string) => route === 'guest-on-host' ? 0
    : (route === 'host-on-guest' ? 1 : 2);
  const compareCrystalId = (left: any, right: any) => {
    const a = Number(left);
    const b = Number(right);
    if (Number.isFinite(a) && Number.isFinite(b) && a !== b) return a - b;
    const as = String(left);
    const bs = String(right);
    return as < bs ? -1 : (as > bs ? 1 : 0);
  };
  const compareProposal = (a: any, b: any) => {
    const routeDelta = routeRank(a.route) - routeRank(b.route);
    if (routeDelta) return routeDelta;
    const aDistance = Number.isFinite(a.anchorDistanceMm) ? a.anchorDistanceMm : Infinity;
    const bDistance = Number.isFinite(b.anchorDistanceMm) ? b.anchorDistanceMm : Infinity;
    if (aDistance !== bDistance) return aDistance - bDistance;
    if (a.sizeRatio !== b.sizeRatio) return b.sizeRatio - a.sizeRatio;
    return compareCrystalId(a.grower.crystal_id, b.grower.crystal_id);
  };
  const bestByGuest = new Map<any, any>();
  for (const proposal of proposals) {
    const key = proposal.candidate.crystal_id;
    const prior = bestByGuest.get(key);
    if (!prior || compareProposal(proposal, prior) < 0) bestByGuest.set(key, proposal);
  }
  const selected = Array.from(bestByGuest.values()).sort(
    (a: any, b: any) => compareCrystalId(a.candidate.crystal_id, b.candidate.crystal_id),
  );
  if (!Array.isArray(this._enclosureReceipts)) this._enclosureReceipts = [];
  for (const proposal of selected) {
    const { grower, candidate, candOnGrower } = proposal;
    if (!grower.active || grower.enclosed_by != null || candidate.enclosed_by != null) continue;
    if (grower.enclosed_crystals.includes(candidate.crystal_id)) continue;
    grower.enclosed_crystals.push(candidate.crystal_id);
    grower.enclosed_at_step.push(this.step);
    candidate.enclosed_by = grower.crystal_id;
    const receipt: any = {
      schema: 'enclosure-receipt-v1',
      event: 'enclosed',
      step: Number(this.step),
      host_crystal_id: grower.crystal_id,
      host_mineral: grower.mineral,
      guest_crystal_id: candidate.crystal_id,
      guest_mineral: candidate.mineral,
      route: proposal.route,
      adjacency_authority: proposal.route === 'geometric-overlap'
        ? 'wall-anchor-footprint' : 'exact-substrate-id',
      anchor_distance_mm: proposal.anchorDistanceMm,
      footprint_reach_mm: proposal.footprintReachMm,
      size_ratio: proposal.sizeRatio,
      guest_recent_growth_um: proposal.recent,
      guest_slowing_threshold_um: 3.0,
      host_same_step_positive_growth_um: proposal.hostPositiveGrowthUm,
      host_same_step_negative_growth_um: proposal.hostNegativeGrowthUm,
      host_same_step_net_growth_um: proposal.hostNetGrowthUm,
      host_physical_size_at_enclosure_um: proposal.hostPhysicalSizeUm,
      guest_positive_core_um: proposal.guestPositiveCoreUm,
      guest_loss_um: proposal.guestLossUm,
      guest_remaining_growth_um: proposal.guestPhysicalRemainingUm,
      guest_partially_dissolved: proposal.guestLossUm > 0
        && proposal.guestPhysicalRemainingUm > 0,
    };
    const filmBefore = grower._film ? JSON.parse(JSON.stringify(grower._film)) : null;
    candidate.enclosure_receipt = receipt;
    this._enclosureReceipts.push(receipt);
    // A guest that nucleated on its swallower sits at the active front; a
    // lateral swallow is an embedded, poikilotopic inclusion instead.
    candidate.coats_front = candOnGrower;
    if (candOnGrower) {
      const operationId = `enclosure:${this.step}:${String(grower.crystal_id)}:${String(candidate.crystal_id)}`;
      const beforeTerm = Math.max(0, Number(grower._film?.phi_term) || 0);
      const beforePrism = Math.max(0, Number(grower._film?.phi_prism) || 0);
      grower._film = filmWithOperation(grower._film, {
        kind: 'enclosure-add',
        source_id: operationId,
        mineral: candidate.mineral,
        phi_term: O5_COATS_FRONT_PHI_STEP,
        phi_prism: 0,
        step: this.step,
      });
      const afterTerm = Math.max(0, Number(grower._film?.phi_term) || 0);
      const afterPrism = Math.max(0, Number(grower._film?.phi_prism) || 0);
      receipt.front_film_operation_id = operationId;
      receipt.front_film_nominal_contribution = O5_COATS_FRONT_PHI_STEP;
      receipt.front_film_contribution = Math.max(0, afterTerm - beforeTerm);
      receipt.front_film_prism_contribution = Math.max(0, afterPrism - beforePrism);
      receipt.host_film_before = filmBefore;
      receipt.host_film_after = JSON.parse(JSON.stringify(grower._film));
    } else {
      receipt.front_film_contribution = 0;
      receipt.host_film_before = filmBefore;
      receipt.host_film_after = filmBefore;
    }
    candidate.active = false;
    this.log.push(
      `  💎 ENCLOSURE: ${capitalize(grower.mineral)} #${grower.crystal_id} ` +
      `(${grower.c_length_mm.toFixed(1)}mm) has grown around ` +
      `${candidate.mineral} #${candidate.crystal_id} (${candidate.c_length_mm.toFixed(2)}mm). ` +
      `The ${candidate.mineral} is now an inclusion inside the ${grower.mineral}.`
    );
  }
},

  // When the host crystal is dissolving back past the point it enclosed
// a neighbor, the neighbor is freed.
_check_liberation() {
  for (const host of this.crystals) {
    if (!host.enclosed_crystals.length) continue;
    const freed = [];
    for (let i = 0; i < host.enclosed_crystals.length; i++) {
      const encId = host.enclosed_crystals[i];
      const encStep = host.enclosed_at_step[i];
      const enc = this.crystals.find(c => c.crystal_id === encId);
      if (!enc) continue;
      const originalReceipt = enc.enclosure_receipt || null;
      const receiptedHostSize = Number(originalReceipt?.host_physical_size_at_enclosure_um);
      const hostSizeAtEnc = Number.isFinite(receiptedHostSize) && receiptedHostSize > 0
        ? receiptedHostSize
        : _physicalCrystalInventory(host, Number(encStep)).remainingUm;
      const liberationThresholdUm = hostSizeAtEnc * 0.7;
      const hostCurrentGrowthUm = _physicalCrystalInventory(host).remainingUm;
      if (Number.isFinite(hostCurrentGrowthUm)
        && hostCurrentGrowthUm < liberationThresholdUm) {
        freed.push(i);
        const operationId = String(originalReceipt?.front_film_operation_id || '');
        const removal = operationId
          ? filmWithoutOperation(host._film, operationId)
          : { film: host._film || null, found: false, removed_phi_term: 0, removed_phi_prism: 0 };
        host._film = removal.film;
        if (!Array.isArray(this._enclosureReceipts)) this._enclosureReceipts = [];
        const liberationReceipt = {
          schema: 'liberation-receipt-v1',
          event: 'liberated',
          step: Number(this.step),
          enclosure_step: Number(encStep),
          host_crystal_id: host.crystal_id,
          host_mineral: host.mineral,
          guest_crystal_id: enc.crystal_id,
          guest_mineral: enc.mineral,
          host_size_at_enclosure_um: hostSizeAtEnc,
          liberation_threshold_um: liberationThresholdUm,
          host_current_growth_um: hostCurrentGrowthUm,
          host_still_has_solid: hostCurrentGrowthUm > 0,
          original_enclosure_schema: originalReceipt?.schema || null,
          original_enclosure_route: originalReceipt?.route || null,
          front_film_operation_id: operationId || null,
          front_film_operation_found: removal.found,
          front_film_nominal_contribution: Number(originalReceipt?.front_film_nominal_contribution) || 0,
          front_film_contribution_removed: removal.removed_phi_term,
          front_film_prism_contribution_removed: removal.removed_phi_prism,
        };
        enc.liberation_receipt = liberationReceipt;
        this._enclosureReceipts.push(liberationReceipt);
        enc.enclosed_by = null;
        // O4b — coats_front describes HOW the crystal was enclosed; freed
        // means it isn't, so the classification clears with the enclosure.
        enc.coats_front = null;
        enc.active = true;
        this.log.push(
          `  🔓 LIBERATION: ${enc.mineral} #${encId} freed from ` +
          `dissolving ${host.mineral} #${host.crystal_id}! ` +
          `The inclusion is exposed again and can resume growth.`
        );
      }
    }
    for (const i of freed.sort((a, b) => b - a)) {
      host.enclosed_crystals.splice(i, 1);
      host.enclosed_at_step.splice(i, 1);
    }
  }
},

  // PROPOSAL-CARBONATE-GEOCHEM Phase 1 Week 4b — open-system Henry's-
  // Law pH equilibration.
  //
  // When the scenario flag open_to_atmosphere is true, the fluid is
  // in contact with the local atmosphere and its equilibrium pCO2
  // must match the local atmospheric value. Solves for the pH that
  // satisfies that equilibrium; mutates fluid.pH on the global
  // conditions + every per-ring fluid + every per-vertex mesh cell
  // so subsequent supersat math (which reads fluid.pH) sees the
  // equilibrated chemistry.
  //
  // Granularity for Week 4b is RING-LEVEL (with global + mesh-cell
  // propagation): the scenario flag is uniform; per-vertex
  // selectivity arrives in Phase 1c once basin-style scenarios
  // (open ceiling, sealed floor) actually need it. The resolvers in
  // 20d already accept the polymorphic per-region map form, so when
  // a scenario writes one this loop slots in.
  //
  // No-op when:
  //   - conditions._scenario is absent (legacy in-code scenarios
  //     that never went through _buildScenarioFromSpec)
  //   - open_to_atmosphere is false / absent (default)
  //   - the helpers from 20d aren't loaded (defensive — bundle order
  //     guarantees they are at runtime)
  _applyOpenAtmosphereEquilibration() {
    const scen = this.conditions && this.conditions._scenario;
    if (!scen) return;
    // Conserved boundary v1 is the only atmospheric-carbon path. Reconcile
    // intervening carbonate precipitation/
    // dissolution at the CaCO3 stoichiometric alkalinity ratio, then solve the
    // declared open or closed gas boundary. Only the global concentration is
    // changed here; run_step wraps this call in the canonical event-delta
    // propagation path so every voxel receives the same per-kg transaction.
    if (scen.carbonate_boundary && this._carbonateBoundaryState) {
      const state = this._carbonateBoundaryState;
      if (state.blocked) return;
      const fluid = this.conditions.fluid;
      const T = this.conditions.temperature;
      if (state.mode === 'open') {
        equilibrateOpenCarbonateBoundaryState(
          state,
          fluid,
          T,
          state.targetPCO2Bar,
          `step ${this.step}: continuous open boundary`,
        );
      } else {
        equilibrateClosedCarbonateBoundaryState(
          state,
          fluid,
          T,
          `step ${this.step}: closed aqueous-headspace equilibration`,
        );
      }
      state.uncertainties = carbonateBoundaryUncertainties(
        fluid,
        T,
        this.conditions.pressure,
        Number.isFinite(state.lastSolvedPCO2Bar)
          ? state.lastSolvedPCO2Bar
          : state.targetPCO2Bar,
      );
      // This v1 is a declared fully mixed control volume. Replace, rather than
      // delta-shift, DIC and pH in every equal-volume voxel so a single shared
      // pCO2/alkalinity state is not broadcast over hidden local offsets.
      this.conditions._pending_fluid_replace_fields = Array.from(new Set([
        ...(this.conditions._pending_fluid_replace_fields || []),
        'CO3', 'pH',
      ]));
      return;
    }
    // Fail closed. Standard closed scenarios may omit this controller, but an
    // open reservoir never falls back to the retired fixed-DIC/pH-only path.
    return;
  },
});
