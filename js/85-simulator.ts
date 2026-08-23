// ============================================================
// js/85-simulator.ts — VugSimulator class + small utilities
// ============================================================
// The authoritative TypeScript run-loop class.
//
// Reads from VugConditions / FluidChemistry / WallState, dispatches to
// MINERAL_ENGINES per crystal per step, applies events, runs paramorph
// + dehydration transitions, snapshots wall_state for replay.
//
// Includes the tiny UTILITY block (capitalize) that immediately follows
// the class — too small to warrant its own module yet.
//
// Phase B10 of PROPOSAL-MODULAR-REFACTOR.

class VugSimulator {
  // Dynamic dataclass-style fields — runtime untouched.
  [key: string]: any;
  constructor(conditions, events) {
    // Narrative files are authoritative game data. Synchronous/headless callers
    // cannot construct a partially narrated simulation while preload is pending
    // or after it failed; browser entry points await the same readiness promise.
    assertNarrativesReady();
    this.conditions = conditions;
    this._startTemp = conditions.temperature; // remember initial T for thermal pulse ceiling
    // T-RECONCILIATION (2026-06-10, SIM 181): the ambient drift + thermal-pulse
    // draws in ambient_cooling (85d) come from this DEDICATED stream, not the
    // shared `rng` — so the thermal history no longer displaces the nucleation
    // cascade, and a scenario declaring its own `temperature` movement (85j)
    // can take over T without ambient pulses fighting it. Seeded from
    // rng.state (run-seed lineage, read-only — capturing state consumes no
    // draw); see _makeThermalRng (85j) for the weather-not-geology rationale
    // and the seed-scramble requirement.
    this._thermalRng = _makeThermalRng(rng.state);
    // THE KEYSTONE (2026-06-16, PROPOSAL-PER-MINERAL-NUC-SEEDS): same run-seed
    // lineage capture as _thermalRng (read-only — consumes no draw). _runNuc (85j)
    // derives a private per-(mineral, step) stream off this, so gating one mineral
    // can't displace another's nucleation cascade. Closes LEDGER §A #12.
    this._nucSharedState = rng.state;
    // W-F O3 (2026-07-07, PROPOSAL-ONTOGENY rung O3): the geometric-selection
    // orientation stream. Same run-seed lineage capture (read-only — no draw
    // consumed); drawNucleationTilt (js/44a) pulls each crystal's nucleation
    // tilt off THIS, isolated from the shared cascade. Weather-not-geology
    // (a stochastic per-event orientation), so seeded from the run, not the
    // cavity. See js/44a for the scramble + staging rationale.
    this._orientRng = _makeOrientRng(rng.state);
    this.events = (events || []).slice().sort((a, b) => a.step - b.step);
    this.crystals = [];
    this.crystal_counter = 0;
    this.step = 0;
    this.log = [];
    // Unwrapped topo-map state. v1 uses ring[0] only; the multi-ring
    // structure is in place so future depth-slice rendering doesn't
    // require reshaping storage. initial_radius_mm is frozen at sim
    // start so later per-cell wall_depth reads as "this slice retreated
    // N mm from where it started."
    const d0 = this.conditions.wall.vug_diameter_mm;
    this.wall_state = new WallState({
      vug_diameter_mm: d0,
      initial_radius_mm: d0 / 2,
      // Phase-1 two-stage bubble-merge void shape. Scenarios set these
      // on VugWall; defaults (3 primary, 6 secondary) give a cohesive
      // main cavity with satellite alcoves so scenarios that don't opt
      // in still get an organic dissolution profile.
      primary_bubbles: this.conditions.wall.primary_bubbles,
      secondary_bubbles: this.conditions.wall.secondary_bubbles,
      shape_seed: this.conditions.wall.shape_seed,
      // PROPOSAL-HOST-ROCK Mechanic 5 — cavity archetype (spherical /
      // irregular / tabular / pocket / basin). Drives bubble counts,
      // polar/twist amplitude scaling, and nucleation_bias.
      architecture: this.conditions.wall.architecture,
      // W-K V1c (2026-07-07): cavity-genesis label → the renderer's wall relief family.
      genesis: this.conditions.wall.genesis,
      // Tier 1 C (post-v69): cavity material rendering style. The
      // Three.js renderer reads wall_state.cavity_render. Default
      // 'smooth' preserves pre-toggle look for every existing scenario.
      cavity_render: this.conditions.wall.cavity_render,
      // MATRIX SKIN (2026-07-06): host lithology forwarded for the wall
      // texture (renderer resolves matrix ?? composition). Display-only —
      // WallState physics reads neither; VugWall.composition stays the
      // dissolution gate.
      composition: this.conditions.wall.composition,
      matrix: this.conditions.wall.matrix,
      // Tranche 6 of PROPOSAL-CAVITY-MESH §14: per-vertex nucleation
      // opt-in. _assignWallCell reads wall_state.per_vertex_nucleation
      // to switch into the σ-weighted joint sample. Default false
      // preserves legacy byte-identical RNG path for every existing
      // scenario.
      per_vertex_nucleation: this.conditions.wall.per_vertex_nucleation,
      // Proposal E (2026-05-18): per-cell local fill opt-in. When
      // true, _repaintWallState paints crystal _volume_mm3 into
      // anchor-footprint cells and the growth loop reads each
      // crystal's anchor-cell local fill for the dampener + clamp.
      // Default false preserves legacy global-vugFill behavior.
      per_cell_local_fill: this.conditions.wall.per_cell_local_fill,
      // Explicit geological light boundary. Omission is dark; surface or
      // excavation exposure must be authored by the scenario/player.
      light_exposure: this.conditions.wall.light_exposure,
      is_lit: this.conditions.wall.is_lit,
      // Size-class cascade (2026-05): vug < pocket < cave. Informational
      // tag mirrored from VugWall so the UI (Library Mode panels, the
      // Three.js scale bar) can display the size tier without reaching
      // back to conditions.wall.
      size_class: this.conditions.wall.size_class,
    });
    // The Cartesian zero-isosurface is the production geometry/mass authority
    // from the first observable simulator state. Failure is constructor-fatal:
    // a scientifically unsupported authored shape must never continue under a
    // silent WallMesh capacity fallback.
    const _initialCavityAuthority = this.wall_state.enableProductionCavityAuthority();
    const _initialCavityDiameter = this.conditions.wall.initializeCavityCapacity(
      _initialCavityAuthority.initial_volume_mm3, CAVITY_PRODUCTION_VOLUME_MODEL,
    );
    this.wall_state.updateCapacity(
      _initialCavityAuthority.initial_volume_mm3, _initialCavityDiameter,
    );
    this._cavityProductionStartupReceipt = Object.freeze({
      schema: 'cavity-production-startup-v1',
      production_contract_digest: _initialCavityAuthority.contract.contract_digest,
      shape_identity: _initialCavityAuthority.contract.shape_identity,
      tessellation_identity: _initialCavityAuthority.contract.tessellation_identity,
      baseline_volume_mm3: _initialCavityAuthority.initial_volume_mm3,
      field_snapshot_digest: _initialCavityAuthority.provider.field_snapshot_digest,
      surface_buffer_digest: _initialCavityAuthority.provider.surface_buffer_digest,
      provider_kind: _initialCavityAuthority.provider.kind,
    });
    // Convert any legacy authored ring coordinate into the one canonical
    // physical state: millimetres above the nominal cavity floor.
    this.conditions.bindCavityWaterGeometry?.(this.wall_state);
    // Per-step snapshot of ring[0] for the Replay button. Captured at
    // the end of each step; small (~120 cells × ~4 numbers × 100-200
    // steps), so the memory cost of a whole run is trivial.
    this.wall_state_history = [];

    // Phase C of PROPOSAL-3D-SIMULATION: per-ring fluid + temperature.
    // (Comment trued 2026-06-10 — the Phase C wiring this described has
    // since moved on: the growth loop swaps conditions.fluid to the
    // crystal's CELL fluid (Tranche 4c), diffusion runs on the voxel
    // grid/mesh, and the non-equator ring_fluids slots are a RETIRED
    // store — frozen after init except the vadose/open-atmosphere
    // partial writes, read only by mesh-absent fallbacks; the replay
    // snapshot captures a projection of the cells instead
    // (_ringFluidMeans, review §1.4).
    // What remains load-bearing here: the array allocation, the
    // zone_chemistry init seed below, and the EQUATOR ALIAS — the
    // "equator" ring (index ring_count/2) IS conditions.fluid, so
    // events that mutate conditions.fluid hit the equator slot and
    // the bulk nucleation gate sees them.
    const nRings = this.wall_state.ring_count;
    const equator = Math.floor(nRings / 2);
    this.ring_fluids = [];
    for (let r = 0; r < nRings; r++) {
      this.ring_fluids.push(_cloneFluid(this.conditions.fluid));
    }
    // Alias the equator ring to conditions.fluid so events propagate.
    this.ring_fluids[equator] = this.conditions.fluid;
    this.ring_temperatures = new Array(nRings).fill(this.conditions.temperature);
    // PHASE-3-CAVITY-MESH (PROPOSAL-CAVITY-MESH §7): apply scenario
    // zone-chemistry overrides on top of the uniform-clone broth.
    // Default-null wall.zone_chemistry → no-op (byte-identical to
    // legacy). When present, each ring's fluid gets its
    // wall.zone_chemistry[orientation] field overrides; the equator
    // ring is aliased to conditions.fluid so those overrides also
    // appear on the global handle that events and engines see.
    //
    // Why field-by-field overrides (vs. wholesale fluid replacement):
    // scenarios usually want to tilt one or two species per zone
    // (e.g. Ca-rich floor, Si-rich ceiling) without re-specifying every
    // field. Anything left out of the zone block falls through to the
    // scenario's initial.fluid for that field.
    const zoneChem = this.conditions.wall?.zone_chemistry || null;
    if (zoneChem) {
      for (let r = 0; r < nRings; r++) {
        const orient = this.wall_state.ringOrientation(r);
        const overrides = zoneChem[orient];
        if (!overrides) continue;
        const fluid = this.ring_fluids[r];
        for (const k of Object.keys(overrides)) {
          fluid[k] = overrides[k];
        }
      }
    }
    // PHASE-3-CAVITY-MESH: scenario-controlled diffusion rate.
    // wall.inter_ring_diffusion_rate (in conditions.wall) overrides
    // the global default. null = legacy 0.05; 0 = persistent zones
    // (no homogenization).
    this.inter_ring_diffusion_rate =
      (this.conditions.wall?.inter_ring_diffusion_rate != null)
        ? this.conditions.wall.inter_ring_diffusion_rate
        : DEFAULT_INTER_RING_DIFFUSION_RATE;
    // PROPOSAL-CAVITY-MESH Phase 4 Tranche 4c — bind per-vertex
    // chemistry slots on the mesh from the ring_fluids[] backing
    // store. After this call, mesh.cells[i].fluid is an INDEPENDENT
    // clone of ring_fluids[r] for vertex i in ring r (un-aliased in
    // Tranche 4a) — so the per-cell fluids evolve separately under
    // engines + diffusion and are DECOUPLED from ring_fluids /
    // conditions.fluid (writing one does not update the other; see
    // 85c-simulator-state.ts:152-168). cells[i] is the same WallCell
    // object as wall.rings[r][c], so legacy ring reads see the binding.
    const _initialMesh = this.wall_state.meshFor(this);
    const _productionContract = this.wall_state._cavityProductionAuthorityContract;
    if (_productionContract) {
      CavityProductionAuthority.assertContract(this.wall_state, _productionContract);
      const _productionLedger = this.wall_state.cavityEvolutionLedger();
      if (!_productionLedger || _productionLedger.cursor !== 0
          || _productionLedger.model !== CAVITY_PRODUCTION_VOLUME_MODEL
          || this.conditions.wall.cavity_capacity_basis !== CAVITY_PRODUCTION_VOLUME_MODEL
          || Math.abs(Number(this.conditions.wall.cavity_capacity_volume_mm3)
            - Number(_productionContract.baseline_volume_mm3))
            > Math.max(1e-9, Number(_productionContract.baseline_volume_mm3) * 1e-10)) {
        throw new Error('late chemistry bootstrap cannot alter Cartesian cavity authority');
      }
    } else if (_initialMesh && _initialMesh.closedVolumeMm3) {
      const initialCapacity = _initialMesh.closedVolumeMm3();
      this.wall_state.initializeCavityEvolutionLedger();
      const equivalentDiameter = this.conditions.wall.initializeCavityCapacity(
        initialCapacity, 'canonical_closed_wallmesh',
      );
      this.wall_state.updateCapacity(initialCapacity, equivalentDiameter);
    }
    if (_initialMesh && _initialMesh.bindRingChemistry) {
      _initialMesh.bindRingChemistry(this.ring_fluids, this.ring_temperatures);
    }
    // Replay water state is independently authenticated by an append-only
    // history rather than by the mutable snapshot payload. Keep the ledger on
    // both owners because snapshots are produced by the simulator while replay
    // dispatch receives the WallState directly.
    this._cavityWaterAppearanceLedger = new CavityWaterAppearanceLedger(this.wall_state);
    this.wall_state._cavityWaterAppearanceLedger = this._cavityWaterAppearanceLedger;
    this._cavityWallMaterialHistoryLedger = new CavityWallMaterialHistoryLedger(this.wall_state);
    this.wall_state._cavityWallMaterialHistoryLedger = this._cavityWallMaterialHistoryLedger;
    // PROPOSAL-CAVITY-INTERIOR-VOXELS Phase 1 (v158) — allocate the
    // cavity interior voxel grid now that the mesh is built and
    // chemistry is bound. d=0 voxels alias the mesh.cells[].fluid
    // objects (per [FIRM] B); d=1, d=2, d=3 voxels each get an
    // independent clone of the bulk fluid. Per-voxel temperature is
    // initialized to bulk T and is the canonical local engine temperature.
    // The grid is lazy-cached on wall_state; this call forces the
    // build so the grid is ready when _diffuseRingState first fires.
    this.wall_state.voxelGridFor(this);
    // SIM 256 thermal localization. Sources stay as plain serializable
    // records so scenarios, Creative actions, immutable commands, and replay
    // all share one deterministic representation.
    this._thermalSources = [];
    this._thermalSourceCounter = 0;
    this._thermalFieldReceipts = [];
    const thermalGrid = this.wall_state.voxelGridFor(this);
    const authoredThermalSources = this.conditions?._scenario?.thermal_sources;
    if (thermalGrid && Array.isArray(authoredThermalSources)) {
      for (let i = 0; i < authoredThermalSources.length; i++) {
        const normalized = normalizeThermalSourceSpec(
          authoredThermalSources[i], thermalGrid, `authored-thermal-${i + 1}`,
        );
        if (normalized) this._thermalSources.push(normalized);
      }
    }
    this._thermalFieldActivated = this._thermalSources.length > 0
      || this.conditions?._scenario?.thermal_field != null
      || this.conditions?._scenario?.wall_rock_thermal_buffer_C != null;
    // Whole-sulfur conservation baseline. Canonical voxel fluids are the
    // aqueous inventory even while a legacy one-pool recipe is active;
    // accepted growth zones become the solid inventory. A later explicit-pool
    // activation changes representation without rebasing geological history.
    // _propagateGlobalDelta books only authored boundary declarations and
    // records an unexplained internal residual as a violation.
    const sulfurGrid = this.wall_state.voxelGridFor(this);
    this._sulfurLedgerInitialPpm = sulfurGrid.voxels.reduce(
      (sum, voxel) => sum + sulfurSystemTotalPpm(voxel?.fluid),
      0,
    );
    this._sulfurBoundaryImportsPpm = 0;
    this._sulfurBoundaryExportsPpm = 0;
    this._sulfurBoundaryTransactions = [];
    this._sulfurPropagationViolations = [];
    this._sulfurLedgerHistory = [];
    this._sulfurLedgerActivation = this.conditions.fluid.sulfurPoolsExplicit
      ? {
        step: 0,
        kind: 'constructor_explicit_reservoirs',
        fluidInitialPpm: this._sulfurLedgerInitialPpm,
        solidInitialPpm: 0,
        closed: true,
      }
      : null;
    // Authored scenarios may opt into a strict whole-scenario carbon ledger.
    // Methane-derived carbon, formula-balanced wall release, fluid DIC, and
    // booked carbonate solids remain separate terms. Keep Sicily enabled for
    // save compatibility with specifications predating the generic flag.
    this._carbonLedgerEnabled = this.conditions?._scenario?.carbon_ledger === true
      || this.conditions?._scenario?.id === 'sicily_solfifera';
    this._carbonLedgerInitialPpm = this._carbonLedgerEnabled
      ? sulfurGrid.voxels.reduce(
        (sum, voxel) => sum + Math.max(0, Number(voxel?.fluid?.CO3) || 0),
        0,
      )
      : 0;
    this._carbonMethaneImportsPpm = 0;
    this._carbonWallReleasePpm = 0;
    this._carbonExternalImportsPpm = 0;
    this._carbonExportsPpm = 0;
    this._carbonSourceTransactions = [];
    this._carbonPropagationViolations = [];
    this._carbonLedgerHistory = [];
    this._fluidBoundaryTransactions = [];
    this._fluidBoundaryViolations = [];
    // SIM 275: append-only physical receipts for host-over-guest enclosure.
    // StripRecorder clones newly appended rows into the authenticated archive;
    // live crystal pointers remain presentation state, not the evidence source.
    this._enclosureReceipts = [];
    // Conserved carbonate boundary v1 is explicit opt-in. It lives on both the
    // simulator and conditions because event handlers receive conditions, while
    // the step controller owns equilibration. The state is plain JSON data so a
    // later worker/save snapshot can copy it without class revival.
    const carbonateBoundary = this.conditions?._scenario?.carbonate_boundary;
    this._carbonateBoundaryState = carbonateBoundary
      ? createCarbonateBoundaryState(
        this.conditions.fluid,
        this.conditions.temperature,
        {
          ...carbonateBoundary,
          fluid_pressure_kbar: this.conditions.pressure,
        },
      )
      : null;
    if (this._carbonateBoundaryState) {
      this.conditions._carbonateBoundaryState = this._carbonateBoundaryState;
    }
    // An open gas reservoir without DIC + reduced alkalinity is not a usable
    // scientific state. The retired fallback changed pH at fixed DIC and
    // silently created/destroyed acid-base capacity.
    this._carbonateBoundaryConfigurationError = !!(
      this.conditions?._scenario?.open_to_atmosphere
      && !this._carbonateBoundaryState
    ) ? 'open_CO2_reservoir_requires_conserved_carbonate_boundary' : null;
    // FLUID-SOURCE SPOTS (js/85k, PROPOSAL §10) Phase 2a — seed the spot set off
    // the cavity seed now that the mesh (→ cell count) exists. Uses a DEDICATED
    // _mulberry32(shape_seed ^ SPOTS_SALT) stream, independent of the shared rng,
    // so seeding draws nothing from the nucleation cascade. DARK: stored on the
    // sim but NOTHING reads it yet → sim-neutral, seed-42 byte-identical, no
    // SIM_VERSION bump. Couplings (decay bonus 2b, origin/deposition 2c, open/
    // close events 2d) consume `this._fluidSpots` in later sub-steps.
    this._fluidSpots = _createFluidSpotField(this);
    // Phase 2c.2b — per-scenario DEPOSITION-clustering opt-in. A scenario turns on
    // feeder crystal-clustering with `fluid_spots: { deposition: true }`; absent →
    // false (the validated fleet stays byte-identical). The observer/tests can force
    // it for any sim via the tri-state master override (setFluidSpotsDepositionEnabled).
    this._fluidSpotsDeposition = !!(this.conditions && this.conditions._scenario
      && this.conditions._scenario.fluid_spots && this.conditions._scenario.fluid_spots.deposition);
    // Cache the FluidChemistry numeric field names once for the
    // diffusion loop. Pulled from a fresh instance so any future field
    // additions to FluidChemistry pick up automatically — no separate
    // list to keep in sync. Filtered to numeric fields (the only kind
    // FluidChemistry currently has, but defensive).
    this._fluidFieldNames = Object.keys(new FluidChemistry()).filter(
      k => typeof (new FluidChemistry()[k]) === 'number' && k !== 'concentration'
    );
    // v25 vadose-zone oxidation: track previous fluid_surface_ring so
    // we can detect rings that just transitioned wet → dry. Null at
    // construction means "no surface set yet"; first run_step compares
    // against this and applies the override to whatever rings are
    // currently vadose.
    this._prevFluidSurfaceHeightMm = null;
    this._prevCavityWaterStates = new Array(nRings).fill('submerged');
  }

  canReauthorInitialHostGeometry() {
    const ledger = this.wall_state?.cavityEvolutionLedger?.();
    return this.step === 0
      && this.crystals.length === 0
      && (!ledger || ledger.cursor === 0)
      && this.conditions.wall.total_dissolved_mm === 0
      && this.conditions.wall.host_release_ledger.length === 0;
  }

  enableProductionCavityAuthority() {
    if (this.wall_state?._cavityProductionAuthorityContract) {
      const enabled = this.wall_state.enableProductionCavityAuthority();
      return Object.freeze({
        contract: enabled.contract,
        provider: enabled.provider,
        exact_capacity_volume_mm3: Number(this.conditions.wall.cavity_capacity_volume_mm3),
        exact_equivalent_diameter_mm: Number(this.conditions.wall.vug_diameter_mm),
      });
    }
    if (!this.canReauthorInitialHostGeometry()) {
      throw new RangeError('production cavity authority must be selected before time or crystallization');
    }
    const enabled = this.wall_state.enableProductionCavityAuthority();
    const exactDiameter = this.conditions.wall.initializeCavityCapacity(
      enabled.initial_volume_mm3, CAVITY_PRODUCTION_VOLUME_MODEL,
    );
    this.wall_state.updateCapacity(enabled.initial_volume_mm3, exactDiameter);
    return Object.freeze({
      contract: enabled.contract,
      provider: enabled.provider,
      exact_capacity_volume_mm3: enabled.initial_volume_mm3,
      exact_equivalent_diameter_mm: exactDiameter,
    });
  }

  reauthorInitialCavityEquivalentDiameterMm(value) {
    if (!this.canReauthorInitialHostGeometry()) return false;
    const wall = this.conditions.wall;
    const wallState = this.wall_state;
    const oldSpan = Math.max(CavityWaterAppearance.verticalSpanForWall(wallState), 1e-12);
    const oldWaterHeight = this.conditions.fluid_surface_height_mm;
    const waterFraction = oldWaterHeight == null ? null
      : Math.min(1, Math.max(0, Number(oldWaterHeight) / oldSpan));
    const externalSnapshot = {
      cavity_capacity_volume_mm3: wall.cavity_capacity_volume_mm3,
      initial_cavity_capacity_volume_mm3: wall.initial_cavity_capacity_volume_mm3,
      cavity_capacity_basis: wall.cavity_capacity_basis,
      initial_vug_diameter_mm: wall.initial_vug_diameter_mm,
      vug_diameter_mm: wall.vug_diameter_mm,
      authored_vug_diameter_mm: wall.authored_vug_diameter_mm,
      fluidSurfaceHeightMm: this.conditions._fluidSurfaceHeightMm,
      pendingFluidSurfaceRing: this.conditions._pendingFluidSurfaceRing,
      waterLedger: this._cavityWaterAppearanceLedger,
      materialLedger: this._cavityWallMaterialHistoryLedger,
      wallWaterLedger: wallState._cavityWaterAppearanceLedger,
      wallMaterialLedger: wallState._cavityWallMaterialHistoryLedger,
      wallHistory: this.wall_state_history,
    };
    let receipt;
    try {
      receipt = wallState.reauthorInitialEquivalentDiameterMm(value, this, {
        onInstalled: (installedReceipt) => {
          const exactDiameter = wall.initializeCavityCapacity(
            installedReceipt.exact_capacity_volume_mm3, CAVITY_PRODUCTION_VOLUME_MODEL,
          );
          wall.authored_vug_diameter_mm = Number(value);
          wallState.updateCapacity(installedReceipt.exact_capacity_volume_mm3, exactDiameter);
          if (waterFraction != null) {
            const newSpan = CavityWaterAppearance.verticalSpanForWall(wallState);
            this.conditions.fluid_surface_height_mm = waterFraction * newSpan;
          }
          const mesh = wallState.meshFor(this);
          if (mesh?.bindRingChemistry) {
            mesh.bindRingChemistry(this.ring_fluids, this.ring_temperatures);
          }
          wallState.voxelGridFor(this);
          this._cavityWaterAppearanceLedger = new CavityWaterAppearanceLedger(wallState);
          wallState._cavityWaterAppearanceLedger = this._cavityWaterAppearanceLedger;
          this._cavityWallMaterialHistoryLedger = new CavityWallMaterialHistoryLedger(wallState);
          wallState._cavityWallMaterialHistoryLedger = this._cavityWallMaterialHistoryLedger;
          this.wall_state_history = [];
        },
      });
    } catch (error) {
      wall.cavity_capacity_volume_mm3 = externalSnapshot.cavity_capacity_volume_mm3;
      wall.initial_cavity_capacity_volume_mm3 = externalSnapshot.initial_cavity_capacity_volume_mm3;
      wall.cavity_capacity_basis = externalSnapshot.cavity_capacity_basis;
      wall.initial_vug_diameter_mm = externalSnapshot.initial_vug_diameter_mm;
      wall.vug_diameter_mm = externalSnapshot.vug_diameter_mm;
      wall.authored_vug_diameter_mm = externalSnapshot.authored_vug_diameter_mm;
      this.conditions._fluidSurfaceHeightMm = externalSnapshot.fluidSurfaceHeightMm;
      this.conditions._pendingFluidSurfaceRing = externalSnapshot.pendingFluidSurfaceRing;
      this._cavityWaterAppearanceLedger = externalSnapshot.waterLedger;
      this._cavityWallMaterialHistoryLedger = externalSnapshot.materialLedger;
      wallState._cavityWaterAppearanceLedger = externalSnapshot.wallWaterLedger;
      wallState._cavityWallMaterialHistoryLedger = externalSnapshot.wallMaterialLedger;
      this.wall_state_history = externalSnapshot.wallHistory;
      throw error;
    }
    this._creativeInitialAuthoringTransactions ||= [];
    this._creativeInitialAuthoringTransactions.push(receipt);
    return true;
  }

  reauthorInitialHostThicknessMm(value) {
    if (!this.canReauthorInitialHostGeometry()) return false;
    const receipt = this.conditions.wall.reauthorInitialThicknessMm(value);
    this._creativeInitialAuthoringTransactions ||= [];
    this._creativeInitialAuthoringTransactions.push(receipt);
    return true;
  }

  reauthorInitialHostComposition(value) {
    if (!this.canReauthorInitialHostGeometry()) return false;
    const receipt = this.conditions.wall.reauthorInitialComposition(value);
    this.wall_state.composition = receipt.composition;
    this._creativeInitialAuthoringTransactions ||= [];
    this._creativeInitialAuthoringTransactions.push(receipt);
    return true;
  }

  /**
   * A seal is a geological state transition, not a lifetime latch.  Wall
   * dissolution can restore aggregate open volume after a cavity has filled;
   * use hysteresis so numerical jitter around 100% does not spam seal events,
   * while a materially reopened cavity can later seal and testify again.
   */
  _resetVugSealIfReopened(vugFill: number, openSystem = false) {
    if (!this._vug_sealed) return false;
    if (!openSystem && (!Number.isFinite(vugFill) || vugFill >= 0.95)) return false;
    this._vug_sealed = false;
    return true;
  }

  /** Recompute physical occupancy and immediately re-arm a reopened seal. */
  _refreshVugFillAndSeal(openSystem = false) {
    const fill = openSystem ? 0 : this.get_vug_fill();
    this._resetVugSealIfReopened(fill, openSystem);
    return fill;
  }

  /** Emit one testimony record for each distinct volumetric sealing event. */
  _sealVugIfFilled(vugFill: number) {
    if (!(vugFill >= 1.0) || this._vug_sealed) return false;
    this._vug_sealed = true;
    const mineralVols: Record<string, number> = {};
    for (const crystal of this.crystals) {
      if (!crystal || crystal.dissolved === true) continue;
      const volume = _crystalSolidVolumeMm3(crystal);
      mineralVols[crystal.mineral] = (mineralVols[crystal.mineral] || 0) + volume;
    }
    const sorted = Object.entries(mineralVols).sort((a, b) => b[1] - a[1]);
    const dominant = sorted[0] ? sorted[0][0] : 'mineral';
    let sealMsg = `🪨 VUG SEALED — cavity completely filled after ${this.step} steps`;
    if (sorted.length) {
      sealMsg += ` — dominant: ${dominant}${sorted.length > 1 ? `, with ${sorted.slice(1).map(s => s[0]).join(', ')}` : ''}`;
    }
    this.log.push(sealMsg);
    return true;
  }

  run_step() {
    this.log = [];
    this.step++;
    this.conditions._sim_step = this.step;
    if (this.step === 1 && this._carbonateBoundaryConfigurationError) {
      this.log.push(
        '  ⛔ Carbonate boundary BLOCKED — an open CO₂ reservoir requires conserved DIC, reduced alkalinity, and an explicit gas boundary. No atmospheric chemistry was applied.',
      );
    }
    // Equal-volume, fully mixed carbonate v1 audits the canonical wet voxels
    // before any event sees the bulk handle. This is where explicitly scoped
    // calcite/aragonite/dolomite/HMC transfer is booked; undeclared DIC changes
    // block the boundary rather than being relabelled as a simple carbonate.
    if (this._carbonateBoundaryState) this._prepareCarbonateBoundarySpatialState();
    // Phase C v1: events apply to conditions.fluid (= equator ring
    // fluid via aliasing). Snapshot before and propagate the delta to
    // non-equator rings — otherwise a global event pulse never reaches
    // the rings where crystals are actually growing. Same wrap on
    // dissolve_wall and ambient_cooling.
    // Capture a legacy combined-S spatial baseline at the event boundary. An
    // authored event may commission explicit valence reservoirs mid-run; that
    // transition must retain the exact pre-conversion inventory rather than
    // silently starting its ledger after the event.
    let snap = this._snapshotGlobal({ captureLegacySulfur: true });
    this.apply_events();
    this._propagateGlobalDelta(snap);
    // Some authored events replace the pore fluid rather than mixing a delta
    // into a pre-existing spatial gradient. Apply that exact boundary after
    // ordinary propagation and before any local reaction model reads it.
    this.apply_pending_exact_fluid_replacement();
    // A physical etch must read the event chemistry after it has reached each
    // crystal's local mesh cell, but before ordinary growth/dissolution runs.
    this.apply_pending_physical_etch();
    // Geological MOVEMENTS (js/85j) — persistent master-variable drift between
    // discrete events. DARK in Phase 0: no scenario declares `movements`, so
    // this guard is always false and run_step is byte-identical. When a
    // scenario opts in, movements layer on top of events; snapshot + propagate
    // the global delta to per-ring fluids exactly like apply_events does.
    if (this.conditions._scenario && this.conditions._scenario.movements
        && this.conditions._scenario.movements.length) {
      if (!this._movements) this._movements = _createMovementController(this);
      const mvSnap = this._snapshotGlobal();
      // Pass the sim handle so origin:'cell' movements (Phase 2c) can reach the
      // mesh + seeded fluid-spots. Global movements ignore it. A cell movement
      // injects into one mesh cell (not `conditions`), so the propagate below is
      // a no-op for it — the step-end _diffuseRingState spreads the cell value.
      this._movements.applyStep(this.conditions, this.step, this);
      this._propagateGlobalDelta(mvSnap);
    }
    // An authored weathering epilogue is an executed boundary contract, not a
    // scenario label. Activate it only after same-step events/movements have
    // established T/P/water level and before the vadose transition is applied.
    activateWeatheringEpilogueIfDue(this);
    // v26: continuous drainage from host-rock porosity. Runs before
    // the vadose override so a porosity-driven drift-out gets caught
    // as a transition on the same step it dries.
    this._applyWaterLevelDrift();
    // v25: events may have dropped fluid_surface_ring. Detect rings
    // that just transitioned wet → vadose and force their fluid to
    // oxidizing chemistry. Lets the existing supergene-oxidation
    // engines fire naturally in the air-exposed rings while the floor
    // stays reducing.
    const newlyVadose = this._applyVadoseOxidationOverride();
    if (newlyVadose.length) {
      this.log.push(
        `  ☁ Vadose oxidation: rings ${newlyVadose.join(',')} now exposed `
        + `to air — O₂ rises, sulfides become unstable`);
    }
    // PROPOSAL-CARBONATE-GEOCHEM Phase 1 Week 4b — open-system pH
    // equilibration. No-op when conditions._scenario is absent OR
    // open_to_atmosphere is false (default). When on, the fluid's
    // pH is re-solved so its equilibrium pCO2 matches the local
    // atmospheric value. Runs BEFORE dissolution + nucleation so
    // downstream supersat math sees the equilibrated chemistry.
    if (this.conditions?._scenario?.carbonate_boundary) {
      // Events and persistent movements execute after the start-of-step audit.
      // Re-audit at the actual solver boundary so a same-step, unreceipted DIC
      // mutation cannot be adopted as a new closed-system total.
      this._prepareCarbonateBoundarySpatialState();
      const carbonateSnap = this._snapshotGlobal();
      this._applyOpenAtmosphereEquilibration();
      this._propagateGlobalDelta(carbonateSnap);
    } else {
      this._applyOpenAtmosphereEquilibration();
    }
    // Track dolomite saturation crossings for the Kim 2023 cycle mechanism.
    this.conditions.update_dol_cycles();
    snap = this._snapshotGlobal();
    this.dissolve_wall();
    this._propagateGlobalDelta(snap);

    // Calculate vug fill percentage — stop growth when full.
    // OPEN-SYSTEM (salt plain / evaporite playa, 2026-06-22): an open surface never
    // "fills up and closes" — it is not a sealed pocket. When wall.open_system is set
    // the cavity fill is read as 0 throughout the step, so the plain never seals
    // (below), keeps nucleating fresh blades (check_nucleation), and never hits the
    // fill-halt / high-fill dampener in the growth loop — growth stays rate-limited by
    // chemistry, not by pocket space. Default false → every other scenario unchanged.
    const openSystem = !!(this.conditions.wall && this.conditions.wall.open_system);
    const vugFill = this._refreshVugFillAndSeal(openSystem);

    // A dissolution-opened cavity is physically unsealed again.  Re-arm the
    // transition before the start/end-of-step seal checks so a later refill
    // produces a second truthful seal event.  The 95% threshold supplies
    // hysteresis below the hard 100% closure boundary.
    this._sealVugIfFilled(vugFill);

    // Phase 4c.2/4c.3a — sync Eh⇄O2 BEFORE the engines read it. With
    // EH_DYNAMIC_ENABLED on, the redox helpers derive their O2 from
    // fluid.Eh (o2FromEh), so the two must be consistent at engine-read
    // time. Default direction is O2→Eh (O2 de-facto master). When a
    // movement drives fluid.Eh this step, flip to Eh-canonical (Eh→O2) so
    // the movement's Eh is the source of truth and isn't clobbered. O2 is
    // final by here (events + vadose + dissolve_wall done; dissolve_wall
    // touches only SiO2). The end-of-step sync (after diffusion) repeats this
    // for the strip.
    this._syncRedoxEh(this._movements
      ? this._movements.drivesFieldAt('Eh', this.step) : false);
    // Transport first, then let saturation/nucleation read the resulting local
    // wall temperature during this same step.
    this._advanceThermalField();
    // History-aware Ostwald routing: an exposed stable quartz surface lets
    // later silica attach/grow as quartz instead of restarting a metastable
    // chalcedony generation after cooling or renewed supply.
    this.conditions._stableQuartzExposed = this.crystals.some(
      c => c.mineral === 'quartz' && c.active && !c.dissolved
        && !currentEnclosureAuthority(this, c),
    );
    this.check_nucleation(vugFill);

    // v128 graduated competition: pre-compute per-crystal scaled zones
    // BEFORE the growth loop runs. The pre-computation does a dry-run
    // pass through every active crystal's engine using the per-cell
    // fluid SNAPSHOT, then rations against demand per species.
    //
    // When GRADUATED_COMPETITION_ENABLED is false (v128a/v128b ship
    // state) this is a no-op — the growth loop runs the engine
    // directly via _runEngineForCrystal, exactly as v127 did.
    //
    // When the flag flips on (v128c) the growth loop reads pre-computed
    // zones from this._graduatedZones rather than re-calling the
    // engine. The byte-identical guarantee depends on the flag being
    // false here.
    this._graduatedZones = null;
    if (GRADUATED_COMPETITION_ENABLED) {
      this._graduatedZones = this._computeGraduatedZones();
    }

    // W-F O3b — geometric-selection burial pass. Marks crystals overtaken by a
    // more-normal neighbor's front as arrested (active=false) BEFORE the growth
    // loop, so the buried losers stop this step. Gated inside (no-op + byte-
    // identical when GEOMETRIC_SELECTION_ENABLED is off).
    this._applyGeometricSelection();

    let currentFill = vugFill; // Track fill dynamically during growth loop
    for (const crystal of this.crystals) {
      if (!crystal.active) continue;
      // Proposal A (2026-05): the previous binary `if (currentFill >= 1.0)
      // → growth halts, dissolution only` cliff is replaced by the
      // continuous sigmoid dampener applied to positive zone thickness
      // below. Geological motivation: real growth doesn't snap to zero
      // at a geometric fill threshold; it slows continuously as
      // boundary-layer diffusion takes over (Tenthorey & Cox 1998 JGR;
      // see proposals/RESEARCH-GROWTH-AT-HIGH-FILL.md). Dissolution
      // (negative zones) is NEVER dampened — etching of an existing
      // crystal isn't gated by free pore space.
      //
      // We keep the in-loop currentFill ≥ 1.0 dissolution-only path
      // (below) as belt-and-suspenders against single-step overshoot:
      // when many crystals all nucleate and grow within step 1 (sabkha,
      // gem_pegmatite, radioactive_pegmatite), the step-start dampener
      // is computed at vugFill=0 and lets every crystal grow at full
      // speed. Without the in-loop guard, step 1 alone can push
      // vugFill to 24× cavity volume. Proposal D (interlocking
      // textures) will replace this guard with chemistry-into-density
      // bookkeeping; for Proposal A we preserve the overshoot floor.
      if (currentFill >= 1.0) {
        const engine = MINERAL_ENGINES[crystal.mineral];
        if (!engine) continue;
        // Graduated competition already evaluated this engine exactly once in
        // pass 1. Preserve its null/negative result at full fill just as the
        // normal-fill branch does; a second call would consume RNG twice and
        // bias stochastic dissolution.
        const zone = this._graduatedZones && this._graduatedZones.has(crystal.crystal_id)
          ? this._graduatedZones.get(crystal.crystal_id)
          : this._runEngineForCrystal(engine, crystal);
        if (zone && zone.thickness_um < 0
            && crystal._physicalEtchAppliedStep === this.step) continue;
        if (zone && Number(zone.thickness_um) === 0 && zone.state_overprint) {
          this._finalizeZoneForApplication(crystal, zone);
          this._applyZoneGrowthBudget(crystal, zone);
          crystal.add_zone(zone);
          this.log.push(`  â—† ${capitalize(crystal.mineral)} #${crystal.crystal_id}: REACTION OVERPRINT ${zone.note}`);
          continue;
        }
        // W-F O3b — `_buried` is a growth-front selection state, not an
        // authenticated impermeable shell.  A short, shadowed crystal can no
        // longer win outward growth space, but its remaining exposed solid is
        // still in contact with the pore fluid and must accept mass-balanced
        // acid/redox retreat.  True inclusions are protected separately by
        // `enclosed_by`/inactive lifecycle authority.
        if (zone && zone.thickness_um < 0) {
          this._finalizeZoneForApplication(crystal, zone);
          this._applyZoneGrowthBudget(crystal, zone);
          crystal.add_zone(zone);
          currentFill = this._refreshVugFillAndSeal(openSystem);
          this.log.push(`  ⬇ ${capitalize(crystal.mineral)} #${crystal.crystal_id}: DISSOLUTION ${zone.note}`);
        }
        continue;
      }
      // Audited dimensional cap. Individual crystals and aggregate/coating
      // habits have separate authorities; a null aggregate cap delegates to
      // the exact cavity-capacity ledger instead of inventing a record.
      // Closes the 321,248% runaway growth bug. Uses total_growth_um
      // (the chemistry-truthful uncapped size) rather than c_length_mm,
      // because v59's per-crystal cavity cap (BUG-CRYSTALS-CLIP-VUG-WALL.md)
      // pins c_length_mm at vug_radius for crystals at the cavity wall,
      // which would prevent the world-record cap from ever firing on
      // those crystals and let total_growth_um run unbounded.
      const sizeAuthority = crystalSizeAuthority(crystal);
      const capCm = sizeAuthority.cap_cm;
      const sizeCapped = crystalAtAuthoredSizeCap(crystal);
      if (sizeCapped && !crystal._size_capped) {
        this.log.push(`  ⛔ ${capitalize(crystal.mineral)} #${crystal.crystal_id}: reached ${sizeAuthority.extent_kind} extent cap (${capCm} cm${sizeAuthority.record_cm == null ? '' : ` = 2× ${sizeAuthority.record_cm} cm authority`}) — positive growth halts; dissolution remains possible`);
      }
      crystal._size_capped = sizeCapped;
      const engine = MINERAL_ENGINES[crystal.mineral];
      if (!engine) continue;
      // v128 graduated competition: consume the pre-computed scaled zone
      // when present, applying growth budget against the cell fluid that
      // the dry-run originally read. Otherwise fall through to the
      // single-pass engine call (v127 behavior).
      //
      // The graduated path skips the engine in pass 2 BECAUSE the
      // engine would now see a fluid that's been mutated by prior
      // crystals' rationed growth-budget debits — re-running it would
      // re-introduce the cascade-displacement the algorithm is designed
      // to prevent. Instead, we trust the dry-run zone (computed
      // against a clean snapshot), scaled by the per-crystal allocation.
      let zone: any;
      if (this._graduatedZones && this._graduatedZones.has(crystal.crystal_id)) {
        // The engine was already called once during pass 1 (dry-run).
        // The stored zone may be null (engine returned nothing), zero
        // (no growth), negative (dissolution — un-scaled), or positive
        // (precipitation — already scaled by allocation factor).
        // In all cases, DO NOT re-call the engine — that would
        // double-consume RNG vs v127's once-per-crystal contract.
        zone = this._graduatedZones.get(crystal.crystal_id);
      } else {
        // Crystal had no engine entry, the flag is off, or pass 1 deliberately
        // omitted an RNG-free zero-thickness state overprint so it can be
        // re-evaluated against the actual sequential local reagent reservoir.
        // Ordinary flag-off growth still runs exactly once, matching v127.
        zone = this._runEngineForCrystal(engine, crystal);
      }
      // The duration-integrated physical etch already consumed this
      // crystal's dissolution exposure for the step. Applying the engine's
      // one-step negative candidate as well would count the pulse twice.
      if (zone && zone.thickness_um < 0
          && crystal._physicalEtchAppliedStep === this.step) continue;
      // A world-record cap constrains new precipitation, not the existence or
      // reactivity of the solid. Engines still run so later acid/redox changes
      // can return the capped crystal's booked inventory.
      if (zone && zone.thickness_um > 0 && sizeCapped) continue;
      if (zone) {
        // Texture state is committed only after the formula-pool cap confirms
        // that some positive solid was actually accepted.
        let markLateInterlocking = false;
        // W-F O3b — geometric selection only shadows the outward growth front.
        // Do not turn that morphology tag into a chemical seal: negative zones
        // remain local, booked, and physically accepted.  A genuinely swallowed
        // crystal is instead made inactive by the enclosure lifecycle.
        // Proposal A — apply fill dampener to positive zone thickness
        // (growth). check_nucleation stashed this._fillDampener for the
        // current step; it equals 1.0 below vugFill ~0.7 and tapers
        // toward zero past 1.0.
        //
        // Note: fill_exempt minerals bypass the dampener for NUCLEATION
        // (in _atNucleationCap) but NOT for growth. Geologically,
        // efflorescent crusts can keep nucleating on top of existing
        // crystals (because they don't need fresh wall space), but their
        // growth rate is still mass-transport-limited at high fill — a
        // mirabilite blade growing on a halite floor doesn't get
        // unlimited Na+S delivery. Without this distinction, fill_exempt
        // minerals would blow vugFill past 100x cavity volume in
        // efflorescent-heavy scenarios (searles_lake, sabkha).
        //
        // Dissolution (zone.thickness_um < 0) is left untouched —
        // dissolving an existing crystal isn't a function of free
        // pore space.
        if (zone.thickness_um > 0) {
          // W-F O3b — a geometrically BURIED crystal (overgrown by a more-normal
          // neighbor; _applyGeometricSelection tagged it) grows at a throttled
          // rate, ending a short leaning stub rather than dying. Scales positive
          // growth exactly like the fill dampener below, so growth-budget
          // semantics match the established path. No-op when selection is off
          // (nothing is ever _buried) → byte-identical.
          if (crystal._buried) zone.thickness_um *= O3_BURY_GROWTH_MULT;
          // W-F O5b — the MASKING GATE. A crystal carrying a foreign-matter film
          // (`_film`, set by an event `film:` dusting or an O4b coats_front
          // enclosure) can only grow through it when the fluid supersaturates past
          // the dead-zone barrier σ*(φ) = σ*₀·(1 + k·φ/(1−φ)) — the two-pass-
          // reconciled law (js/44b; σ*₀ = 1.0, the equilibrium growth floor of the
          // ratio-convention σ this sim uses, so an UNfilmed crystal is untouched:
          // the `_film` guard, plus σ*(0)=1, keeps the fleet byte-identical except
          // the pre-registered film-carrying scenarios). φ is the crystal's most-
          // masked axis (scalar v1; per-axis prism/tip asymmetry — the masking
          // sceptre — is the follow-on). Below the barrier the axis STALLS (a
          // hiatus: the crystal is alive and unetched, distinct from O3 burial and
          // from dissolution) and the film persists. When a fresh pulse clears the
          // barrier the crystal grows THROUGH: this first zone is tagged a
          // `masked_horizon` (a POSITIVE-growth phantom — the film is buried in the
          // lattice, the record it leaves) and `_film` clears. No RNG. Gated by
          // O5_MASKING_ENABLED — false through O5a, flipped here for O5b.
          if (O5_MASKING_ENABLED && crystal._film && zone.thickness_um > 0) {
            const film = crystal._film;
            const phi = Math.max(film.phi_term || 0, film.phi_prism || 0);
            let sig = Infinity;   // no σ fn → don't block (can't measure = can't mask)
            const sfn = (this.conditions as any)['supersaturation_' + crystal.mineral];
            if (typeof sfn === 'function') {
              try { const v = sfn.call(this.conditions); if (Number.isFinite(v)) sig = v; }
              catch (_e) { sig = Infinity; }
            }
            const sigmaStar = sigmaStarForCoverage(1.0, phi);
            if (sig <= sigmaStar) {
              // Masked: growth stalls, the film stays. The zone becomes a hiatus.
              zone.thickness_um = 0;
              zone._maskedStall = true;
            } else {
              // Breakthrough: growth resumes through the film — a phantom horizon.
              zone.masked_horizon = true;
              zone.film_mineral = film.mineral;
              // Preserve the depositional hiatus that produced this buried
              // boundary.  The accepted growth step alone says when the film
              // was overgrown; `originating_film_step` says when the foreign
              // material actually settled.  Both are required to distinguish
              // a causal film -> stall -> breakthrough sequence from a label
              // attached after the fact in generated evidence.
              zone.originating_film_step = Number.isFinite(Number(film.step))
                ? Number(film.step) : null;
              // W-F O5 masking SCEPTRE — record which AXIS the film masked. The
              // classifier (js/45 classifyQuartzSceptre) reads this to tell a
              // PRISM-dominant mask (sides frosted, tip renews wider = a sceptre,
              // the Takahashi–Sunagawa ELO route) from a termination / uniform
              // film (just a buried horizon, the elmwood snowball). O4b's
              // coats_front films are termination-only (phi_prism stays 0; js/85c),
              // so prism-dominance reads TRUE only for a deliberate prism `film:`
              // directive — which is why generalizing the classifier is byte-
              // identical for the current fleet (census: tools/sceptre-mask-census.mjs).
              zone.masked_phi_prism = film.phi_prism || 0;
              zone.masked_phi_term = film.phi_term || 0;
              // Commit removal only if a positive zone survives competition,
              // masking, fill damping, and the cavity clamp. A zero-thickness
              // candidate cannot physically bury the film.
              zone._clear_film_on_accept = true;
            }
          }
          // Proposal D (2026-05-18) part 1: per-iteration dampener
          // recomputation. Pre-D this used this._fillDampener — the step-
          // start value stashed by check_nucleation. That single-stash is
          // correct for nucleation (one decision per step) but wrong for
          // the growth loop, where currentFill rises with each crystal's
          // zone. Now: recompute the dampener from the just-updated
          // currentFill so each crystal sees a dampener consistent with
          // the cavity state at the moment of ITS growth. At fill=0.95
          // single-crystal growth gets 12% of nominal rate; at fill=0.99,
          // 6%. Per-iteration recomputation alone drops gem_pegmatite
          // from 7.46 to 5.76 (multi-step overshoot reduction).
          //
          // Proposal E (2026-05-18): when per_cell_local_fill is on,
          // read the crystal's anchor-cell local fill instead of the
          // global currentFill. Geological motivation: the Nature
          // Communications 2022 confinement study showed corners stay
          // open while edges fill — a single crystal sees the LOCAL
          // boundary-layer diffusion limit, not the cavity-averaged
          // one. A crystal at a corner cell where local fill is 0.3
          // continues growing at near-full rate while a crystal at an
          // edge cell at local fill 0.95 dampens to ~12%.
          //
          // Falls back to global currentFill when:
          //   * wall.per_cell_local_fill is off (default — byte-
          //     identical to pre-Proposal-E behavior)
          //   * crystal has no resolvable anchor (rare; mid-construction
          //     in tests)
          //   * local fill is 0 (no other crystal has painted into this
          //     cell yet — fresh nucleation, first step)
          // The global-fill fallback for "local=0" is deliberate: a
          // brand-new crystal with no footprint history should see the
          // cavity-scale dampener so it doesn't grow unboundedly during
          // the step the painter hasn't run for yet (the Proposal D
          // volume clamp is the additional safety net for that case).
          let dampenerFill = currentFill;
          if (this.wall_state.per_cell_local_fill) {
            const localFill = this.wall_state.getCellLocalFillForCrystal(crystal);
            if (localFill > 0) dampenerFill = localFill;
          }
          const dampener = _fillDampenerFor(dampenerFill);
          if (dampener < 1.0) {
            zone.thickness_um *= dampener;
          }

          // Proposal D part 2: volume-aware single-zone clamp. Even with
          // per-iteration dampening, a single crystal growing at
          // currentFill=0 (sabkha step 1's first crystal) sees dampener=1.0
          // → unbounded growth → cavity blows up in one zone. The
          // geological reality: a single zone's volume contribution can't
          // exceed the cavity's remaining capacity. Cap zone.thickness_um
          // so that the resulting projected ellipsoid volume delta stays
          // ≤ (1.0 - currentFill) × cavity_volume.
          //
          // Bookkeeping note: clamping zone.thickness_um reduces BOTH the
          // geometric extension AND the fluid-ion debit. This matches the
          // post-seal geological reality where fluid flux stops anyway
          // (pressure builds up, fractures host rock, or the cavity
          // becomes impermeable). Pure "ions consumed but no geometry"
          // would require a parallel field on Crystal; the simpler
          // single-field clamp captures 90% of the geological story.
          // Future Proposal E (per-cell local fill) can revisit.
          if (zone.thickness_um > 0 && currentFill < 1.0) {
            const vugR = this.conditions.wall.vug_diameter_mm / 2;
            const cavityVol = (4 / 3) * Math.PI * Math.pow(vugR, 3);
            const remainingVol = Math.max(0, (1.0 - currentFill) * cavityVol);
            // Single-source-of-truth helpers (defined in 27-geometry-crystal.ts).
            // The clamp's deltaV calc matches what Crystal.add_zone will
            // increment _volume_mm3 by: shell volume at the habit's aRatio
            // AS-OF-THIS-ZONE. Geologically and mathematically consistent
            // with the post-2026-05-18 zone-integrated bookkeeping.
            const aRatio = _habitAspectRatio(crystal.habit);
            const kVol = _habitVolCoeff(aRatio);
            const cMm_now = crystal.total_growth_um / 1000;
            // Projected growth from this zone: zone.thickness_um is in µm,
            // applied via add_zone() which multiplies by timeScale.
            // Mirror that here so the cap reflects what will actually land.
            const projDelta_mm = (zone.thickness_um * timeScale) / 1000;
            const cMm_proj = cMm_now + projDelta_mm;
            // deltaV = shell volume = kVol × (c_new³ - c_now³). Identical
            // to the increment Crystal.add_zone will apply to _volume_mm3.
            const deltaV = kVol * (Math.pow(cMm_proj, 3) - Math.pow(cMm_now, 3));
            if (deltaV > remainingVol) {
              // Clamp: solve V(c_max) - V(c_now) = remainingVol for c_max
              //        c_max = (c_now³ + remainingVol/kVol)^(1/3)
              const cMm_max = Math.pow(
                Math.pow(cMm_now, 3) + remainingVol / kVol,
                1 / 3,
              );
              const cappedDelta_um = (cMm_max - cMm_now) * 1000 / timeScale;
              zone.thickness_um = Math.max(0, Math.min(zone.thickness_um, cappedDelta_um));
              // Late-interlocking tag: this zone hit the cavity ceiling —
              // additional chemistry that would have happened gets attributed
              // to in-place densification rather than free extension.
              if (zone.thickness_um > 0) markLateInterlocking = true;
              if (zone.note) zone.note = `${zone.note} [interlocking — cavity ceiling reached]`;
              else zone.note = 'interlocking growth at cavity ceiling';
            }
          }

          // Late-interlocking tag (independent of clamp): once we're in
          // the high-fill boundary-layer regime (currentFill ≥ 0.85) AND
          // growth is dampened by Proposal A's sigmoid, this crystal is
          // texturally in the interlocking domain (Tsumeb late-stage
          // interlocking patinas, Naica selenite cluster surfaces).
          // Renderer reads this flag for granular / massive textures.
          if (zone.thickness_um > 0 && currentFill >= 0.85 && dampener < 1.0) {
            markLateInterlocking = true;
          }
        }
        // W-F O5 SPLITTING (S-b) — accrue the two-route cumulative-misorientation
        // index (js/44c) over this zone's growth. NO RNG, no fluid/T mutation;
        // writes only crystal._split. The SIM effect (the axial compaction that
        // gives a split crystal a compact max extent at CONSTANT volume — so fill,
        // and thus every other crystal, is untouched: a census-bounded bump) is
        // applied inside crystal.add_zone, keyed to this same index. The render
        // (js/99i) reads _split.rung for the saddle/sheaf/spherulite geometry, with
        // the deformation-saddle set a separate cause (§9a #4, census-certified).
        // splitAbility 0 (quartz/feldspar) → no _split → untouched everywhere (the
        // structure-specificity invariant).
        this._finalizeZoneForApplication(crystal, zone);
        this._applyZoneGrowthBudget(crystal, zone);
        // A dry formula reservoir accepts no solid. Do not append a zero shell
        // or accrue texture/history from a candidate that never precipitated.
        if (zone._stoichiometric_budget_cap && !(zone.thickness_um > 0)) continue;
        if (zone.thickness_um > 0 && markLateInterlocking) {
          crystal.late_interlocking = true;
        }
        // Accrue split texture from the mass-limited accepted thickness, not the
        // larger candidate that the fluid could not supply.
        accrueSplitIndex(crystal, this.conditions, zone.thickness_um);
        // W-K VOL-NEUTRAL (measurement): when O5_VOLNEUTRAL_ENABLED, a split
        // crystal's axial extent is compacted by splitGrowthMult(index) at
        // CONSTANT volume (add_zone re-derives a_width to conserve _volume_mm3).
        // extentMult 1 for non-split OR when the flag is off → byte-identical.
        const extentMult = (O5_VOLNEUTRAL_ENABLED && crystal._split)
          ? splitGrowthMult(crystal._split.index, _habitAspectRatio(crystal.habit)) : 1;
        crystal.add_zone(zone, extentMult);
        // Re-check fill after each crystal grows to prevent >100% overshoot
        if (zone.thickness_um > 0) {
          currentFill = this._refreshVugFillAndSeal(openSystem);
        }
        if (zone.thickness_um < 0) {
          currentFill = this._refreshVugFillAndSeal(openSystem);
          this.log.push(`  ⬇ ${capitalize(crystal.mineral)} #${crystal.crystal_id}: DISSOLUTION ${zone.note}`);
        } else if (Math.abs(zone.thickness_um) > 0.5) {
          this.log.push(`  ▲ ${capitalize(crystal.mineral)} #${crystal.crystal_id}: ${crystal.describe_latest_zone()}`);
        }
      }
    }

    // CaSO4 phase replacement. Use each crystal's local mesh fluid and
    // temperature; the authoritative evaluator separates SI, equilibrium
    // phase, primary kinetics, and precursor-consuming replacement.
    {
      const nRings = this.wall_state.ring_count;
      const mesh = this.wall_state.meshFor ? this.wall_state.meshFor(this) : null;
      for (const crystal of this.crystals) {
        if (crystal.mineral !== 'selenite' && crystal.mineral !== 'anhydrite') continue;
        const caSO4Target = crystal.mineral === 'selenite' ? 'anhydrite' : 'selenite';
        if (_scenarioSpeciesExclusion(this, caSO4Target)
            || _scenarioPositiveLicenseBlock(this, caSO4Target)) continue;
        const anchor = this.wall_state._resolveAnchor(crystal);
        const chemistry = this.wall_state.chemistryAddressForCrystal(crystal);
        const ringIdx = chemistry ? chemistry.ringIdx : null;
        const validRing = ringIdx != null && ringIdx >= 0 && ringIdx < nRings;
        const cell = validRing && mesh?.cellOf
          ? mesh.cellOf(crystal, this.wall_state)
          : null;
        const localFluid = cell?.fluid || (validRing ? this.ring_fluids[ringIdx] : this.conditions.fluid);
        const vertexIdx = validRing ? chemistry.vertexIndex : -1;
        const localT = vertexIdx >= 0
          ? temperatureAtMeshVertex(this, mesh, vertexIdx) : this.conditions.temperature;
        const transition = applyCaSO4PhaseTransition(
          crystal, localFluid, localT, this.conditions.pressure, this.step,
        );
        if (!transition) continue;
        this._caSO4Transitions ||= [];
        this._caSO4Transitions.push({ crystal_id: crystal.crystal_id, ...transition });
        const waterVerb = transition.waterTransferMmolKg >= 0 ? 'released' : 'consumed';
        this.log.push(
          `  ↻ CaSO4 REPLACEMENT: ${capitalize(transition.from)} #${crystal.crystal_id} → ${transition.to} ` +
          `(a_w=${transition.waterActivity.toFixed(3)}, T=${localT.toFixed(1)}°C, ` +
          `boundary=${transition.boundaryC.toFixed(1)}±${transition.uncertaintyC.toFixed(1)}°C, ` +
          `${Math.abs(transition.waterTransferMmolKg).toFixed(6)} mmol/kg structural water ${waterVerb}; ` +
          `booked Ca and sulfate unchanged; external replacement envelope preserved)`,
        );
      }
    }

    // Paramorph transitions — convert crystals whose host fluid has cooled
    // past their phase-transition T (Round 8a-2: argentite → acanthite at
    // 173°C). Preserves habit + dominant_forms + zones; only crystal.mineral
    // changes. First non-destructive polymorph mechanic in the sim.
    for (const crystal of this.crystals) {
      const paramorphTarget = PARAMORPH_TRANSITIONS[crystal.mineral]?.[0];
      if (paramorphTarget && (_scenarioSpeciesExclusion(this, paramorphTarget)
          || _scenarioPositiveLicenseBlock(this, paramorphTarget))) continue;
      const anchor = this.wall_state._resolveAnchor(crystal);
      const mesh = this.wall_state.meshFor ? this.wall_state.meshFor(this) : null;
      const vertexIdx = anchor
        ? this.wall_state.chemistryVertexForCrystal(crystal) : -1;
      const localT = vertexIdx >= 0
        ? temperatureAtMeshVertex(this, mesh, vertexIdx) : this.conditions.temperature;
      const transition = applyParamorphTransitions(crystal, localT, this.step);
      if (transition) {
        const [oldM, newM] = transition;
        this.log.push(
          `  ↻ PARAMORPH: ${capitalize(oldM)} #${crystal.crystal_id} → ${newM} ` +
          `(local T dropped to ${localT.toFixed(0)}°C, crossed ${oldM}/${newM} ` +
          `phase boundary; cubic external form preserved)`
        );
      }
    }

    // v84 (2026-05-19) — light-induced transitions. The only light-
    // driven mechanism in the simulator. Currently: realgar →
    // pararealgar via As₄S₄ molecular isomerization (D₂d → Cs
    // symmetry) after sufficient visible-light exposure. Per
    // research-meta-minerals-pararealgar.md (Bonazzi et al. 1996
    // Mineralogical Magazine; Roberts et al. 1980).
    //
    // Per-step counter on crystal.light_exposure_steps increments only under
    // an explicit surface/excavation boundary. Threshold = 60 steps for
    // realgar — gives realgar that nucleates by step 140 just
    // enough time to convert by run-end (200 steps), producing the
    // mixed realgar + pararealgar assemblage geologically authentic
    // for museum-collection specimens.
    const lightExposure = this.wall_state.light_exposure;
    const isLit = lightExposure === 'surface' || lightExposure === 'excavated';
    for (const crystal of this.crystals) {
      const lightTarget = LIGHT_TRANSITIONS[crystal.mineral]?.[0];
      if (lightTarget && (_scenarioSpeciesExclusion(this, lightTarget)
          || _scenarioPositiveLicenseBlock(this, lightTarget))) continue;
      const localIsLit = weatheringLightAtCrystal(this, crystal, isLit);
      const transition = applyLightTransitions(
        crystal, localIsLit, this.step, lightExposure,
      );
      if (transition) {
        const [oldM, newM] = transition;
        this.log.push(
          `  ☼ LIGHT-INDUCED: ${capitalize(oldM)} #${crystal.crystal_id} → ${newM} ` +
          `(${crystal.light_exposure_steps} steps of ${lightExposure} light exposure; ` +
          `As₄S₄ molecule isomerized D₂d → Cs symmetry; ` +
          `orange-red shifted to yellow, crystal now friable)`
        );
      }
    }

    // v28: dehydration paramorphs — environment-triggered counterpart
    // to PARAMORPH_TRANSITIONS. Borax left in a vadose ring loses
    // water and pseudomorphs to tincalconite.
    {
      const nRings = this.wall_state.ring_count;
      // PROPOSAL-CAVITY-MESH Phase 4 Tranche 4a — read the crystal's
      // OWN cell.fluid (per-vertex chemistry) for the dehydration check,
      // not a shared ring-level pool. Each crystal sees its local
      // chemistry — if one borax dehydrates at a meniscus cell with
      // low concentration but its neighbor stays wet, only the dry
      // one transitions.
      const _mesh = this.wall_state.meshFor
        ? this.wall_state.meshFor(this)
        : null;
      for (const crystal of this.crystals) {
        const dehydrationSpec = DEHYDRATION_TRANSITIONS[crystal.mineral];
        if (!dehydrationSpec) continue;
        // A scenario-local negative-evidence contract applies to transformation
        // products as well as direct nucleation. The global dehydration engine
        // remains live in documented localities and Creative mode.
        const dehydrationTarget = dehydrationSpec[0];
        if (_scenarioSpeciesExclusion(this, dehydrationTarget)
            || _scenarioPositiveLicenseBlock(this, dehydrationTarget)) continue;
        // PHASE-1-CAVITY-MESH: read ringIdx via _resolveAnchor so this
        // dehydration loop no longer reads wall_ring_index directly.
        const anchor = this.wall_state._resolveAnchor(crystal);
        const chemistry = this.wall_state.chemistryAddressForCrystal(crystal);
        const ringIdx = chemistry ? chemistry.ringIdx : null;
        if (ringIdx == null || ringIdx < 0 || ringIdx >= nRings) continue;
        // Prefer the crystal's own cell.fluid (per-vertex chemistry).
        // Fall back to the ring-level pool only if the mesh isn't built.
        const cell = (_mesh && _mesh.cellOf)
          ? _mesh.cellOf(crystal, this.wall_state)
          : null;
        const ringFluid = (cell && cell.fluid)
          ? cell.fluid
          : this.ring_fluids[ringIdx];
        const ringState = this.conditions.ringWaterState(ringIdx, nRings);
        const vertexIdx = chemistry.vertexIndex;
        const Tlocal = temperatureAtMeshVertex(this, _mesh, vertexIdx);
        const transition = applyDehydrationTransitions(
          crystal, ringFluid, ringState, Tlocal, this.step);
        if (transition) {
          const [oldM, newM] = transition;
          this.log.push(
            `  ☼ DEHYDRATION: ${capitalize(oldM)} #${crystal.crystal_id} → ${newM} ` +
            `(vadose exposure ${crystal.dry_exposure_steps} steps, ring ${ringIdx} ` +
            `concentration=${ringFluid.concentration.toFixed(1)}); external ` +
            `crystal form preserved as a ${newM} pseudomorph`
          );
        }
      }
    }

    // Water-solubility metastability — Round 8e (Apr 2026). Chalcanthite
    // re-dissolves when fluid.salinity < 4 OR fluid.pH > 5. The geological
    // truth: every chalcanthite is a temporary victory over entropy.
    let chalcanthiteVolumeChanged = false;
    const chalcanthiteMesh = this.wall_state.meshFor
      ? this.wall_state.meshFor(this) : null;
    const chalcanthiteRingCount = this.wall_state.ring_count;
    for (const crystal of this.crystals) {
      // Growth-front shadowing, size caps, and a stale display-only `active`
      // flag are not dissolution shields.  Match the shared chemistry boundary:
      // only a reciprocal, receipted, chronological physical enclosure may
      // withhold this unusually soluble phase from its pore fluid.
      if (crystal.mineral !== 'chalcanthite' || crystal.dissolved
          || currentEnclosureAuthority(this, crystal)) continue;
      const chemistry = this.wall_state.chemistryAddressForCrystal(crystal);
      const ringIdx = chemistry ? chemistry.ringIdx : null;
      const validRing = ringIdx != null && ringIdx >= 0
        && ringIdx < chalcanthiteRingCount;
      const cell = validRing && chalcanthiteMesh?.cellOf
        ? chalcanthiteMesh.cellOf(crystal, this.wall_state) : null;
      const localFluid = cell?.fluid
        || (validRing ? this.ring_fluids[ringIdx] : this.conditions.fluid);
      const localSalinity = Number(localFluid?.salinity);
      const localPH = Number(localFluid?.pH);
      const lowSalinityTrigger = localSalinity < 4.0;
      const highPHTrigger = localPH > 5.0;
      if (lowSalinityTrigger || highPHTrigger) {
        const dissolutionMode = lowSalinityTrigger && highPHTrigger
          ? 'water_solubility_low_salinity_high_pH'
          : lowSalinityTrigger
            ? 'water_solubility_low_salinity'
            : 'water_solubility_high_pH';
        // 40%/step decay, with a 0.5-µm absolute floor below which we
        // collapse to full dissolution (asymptotic decay otherwise).
        let dissolved_um = Math.min(5.0, crystal.total_growth_um * 0.4);
        if (crystal.total_growth_um < 0.5) dissolved_um = crystal.total_growth_um;
        if (!(dissolved_um > 0)) continue;
        const decayZone = new GrowthZone({
          step: this.step,
          temperature: this.conditions.temperature,
          thickness_um: -dissolved_um,
          growth_rate: -dissolved_um,
          dissolutionMode,
          note: `water-solubility decay (local salinity ${localSalinity.toFixed(1)}, local pH ${localPH.toFixed(1)})`,
        });
        // dissolved_um is already the accepted per-step loss; do not apply the
        // geological time multiplier a second time.
        decayZone._time_scaled = true;
        this._applyZoneGrowthBudget(crystal, decayZone);
        crystal.add_zone(decayZone);
        chalcanthiteVolumeChanged = true;
        if (crystal.total_growth_um <= 0) {
          crystal.dissolved = true;
          crystal.active = false;
          this.log.push(
            `  💧 RE-DISSOLVED: Chalcanthite #${crystal.crystal_id} ` +
            `completely returned to its local solution (salinity=${localSalinity.toFixed(1)}, ` +
            `pH=${localPH.toFixed(1)}) — Cu²⁺ + SO₄²⁻ back in fluid`
          );
        } else {
          this.log.push(
            `  💧 Chalcanthite #${crystal.crystal_id}: re-dissolving ` +
            `(${dissolved_um.toFixed(1)} µm lost; local salinity=${localSalinity.toFixed(1)}, ` +
            `local pH=${localPH.toFixed(1)})`
          );
        }
      }
    }
    if (chalcanthiteVolumeChanged) {
      currentFill = this._refreshVugFillAndSeal(openSystem);
    }

    // Check for vug seal after growth loop (may cross 1.0 during crystal growth)
    this._sealVugIfFilled(currentFill);
    // ---- Radiation damage processing ----
    const active_uraninite = this.crystals.filter(c => c.mineral === 'uraninite' && c.active);
    if (active_uraninite.length) {
      if (!this.radiation_dose) this.radiation_dose = 0;
      if (!this._smoky_logged) this._smoky_logged = false;
      if (!this._metamict_logged) this._metamict_logged = false;

      for (const u_crystal of active_uraninite) {
        // Use total_growth_um (uncapped) rather than c_length_mm so v59's
        // cavity cap doesn't reduce uraninite's effective Pb/radiation
        // output. Source of small drift (~0.5%) on radioactive_pegmatite
        // and schneeberg in the v58→v59 sweep before this fix.
        const u_size = u_crystal.total_growth_um / 1000;
        // Uraninite produces Pb into fluid via radioactive decay
        this.conditions.fluid.Pb += 0.1 * u_size;
        this.radiation_dose += 0.01 * u_size;

        // Radiation damages all OTHER crystals
        for (const other of this.crystals) {
          if (other === u_crystal || !other.active) continue;
          if (!other.radiation_damage) other.radiation_damage = 0;
          other.radiation_damage += 0.02 * u_size;

          // Smoky quartz check
          if (other.mineral === 'quartz' && other.radiation_damage > 0.3 && !this._smoky_logged) {
            this.log.push(`  ☢️ Quartz #${other.crystal_id} is turning smoky — radiation damage from nearby uraninite is displacing Al³⁺ in the lattice, creating color centers`);
            this._smoky_logged = true;
          }

          // Metamictization check
          if (other.radiation_damage > 0.8 && !this._metamict_logged) {
            this.log.push(`  ☢️ ${capitalize(other.mineral)} #${other.crystal_id} is becoming metamict — alpha radiation is destroying the crystal lattice`);
            this._metamict_logged = true;
          }
        }
      }
    }

    // Enclosure / liberation — bigger crystals swallow adjacent smaller
    // ones; dissolving hosts can free what they held.
    this._check_enclosure();
    this._check_liberation();

    // Refresh the topo-map wall state from the current crystal list.
    this._repaintWallState();

    // Ambient cooling — propagate the temperature drop to all rings
    // so non-equator rings cool too.
    {
      const coolSnap = this._snapshotGlobal();
      this.ambient_cooling();
      this._propagateGlobalDelta(coolSnap, {
        ambientThermalStep: this._lastAmbientThermalStep,
      });
    }

    // Phase C: inter-ring fluid diffusion runs at the
    // very end of the step so chemistry exchanges happen against a
    // stable post-events post-growth state. No-op when all rings
    // carry identical values (Laplacian of a constant is zero) —
    // this preserves byte-equality for default scenarios.
    this._diffuseRingState();

    // PROPOSAL-GEOLOGICAL-ACCURACY Phase 4c.1/4c.3a — re-sync Eh⇄O2 on every
    // container AFTER diffusion settles both, so the pair the strip records
    // below reflects the step's final redox state. Same direction as the
    // pre-nucleation sync: O2→Eh by default, Eh→O2 on steps a movement drives
    // fluid.Eh (so the movement's Eh is what the strip shows).
    this._syncRedoxEh(this._movements
      ? this._movements.drivesFieldAt('Eh', this.step) : false);

    // Morphology classification (registry hoist 2026-06-12; calcite arc
    // Phase 0 originally) — tag this step's zones for every mineral in
    // MORPH_TH from the POST-STEP σ (the calibrated basis; see
    // js/45-morphology.ts for the 18th-catch sampling-basis note).
    // Chemistry/RNG-inert pass: no fluid mutation or random draw. The
    // resulting live interface is nevertheless simulation state because next
    // step's habit dispatch reads it; SIM 276 authenticates the formerly
    // omitted terminal-depleted/unavailable cases accordingly.
    classifyMorphologyStep(this);
    // Quartz sceptre — crystal-level structural classifier (alpine-cleft arc
    // SIM 206). Reads completed zones for the resorption→renewal phantom
    // boundary (gen-1 stem + gen-2 cap). Pure tagging; see js/45.
    classifyQuartzSceptre(this);
    // Quartz gwindel — alpine-cleft slow-continuous twisted column (SIM 207).
    // Runs AFTER the sceptre pass (mutually exclusive). Pure tagging; see js/45.
    classifyQuartzGwindel(this);
    // Post-growth DEFORMATION overprint (deformation arc 2026-06-20) — bends
    // crystals that had ALREADY grown when a scenario event recorded a
    // deformation directive (sim._deformationEvents). Pure tagging; no-op unless
    // a scenario declares one → byte-identical fleet. See js/45.
    classifyDeformation(this);
    // Physical ETCH history classifier. Accepted etches already removed solid
    // and returned booked inventory during the event step; this pass derives
    // the currently exposed/healed surface state for narration and rendering.
    classifyEtch(this);
    // Sector (hourglass) ZONING (crystal-face realism arc 2026-06-21) — tags
    // sector-zoned minerals (tourmaline) so the renderer tints the termination
    // sector apart from the prism body. Pure tagging, no-op unless a sector
    // mineral grew → byte-identical fleet, SIM-neutral. See js/45.
    classifySectorZoning(this);
    // DIRECTIONAL stepped growth (central-distance arc Phase 0, 2026-06-22) — tags
    // calcite whose macrostep relief should carve onto one face-SET ({104}
    // obtuse/acute anisotropy). Pure tagging; gated on wall.directional_steps
    // which NO scenario sets yet → no-op → byte-identical fleet. See js/45.
    classifyFaceStep(this);
    // Intrinsic crystallographic polarity (central-distance arc Phase 3, 2026-06-22) — tags
    // the polar tenants (tourmaline/hemimorphite/wurtzite/greenockite) so the renderer draws
    // a hemimorphic +c-pyramid / -c-pinacoid termination. Pure tagging, always-on for those
    // minerals → byte-identical fleet. See js/45.
    classifyPolarAxis(this);
    // Substrate occlusion (central-distance arc Phase 2, 2026-06-22) — tags wall-nucleated
    // crystals with the buried -c attachment fraction (the UNIVERSAL extrinsic driver of the
    // singly-terminated drusy habit). The renderer sinks that fraction below the wall surface.
    // Pure tagging; gated on wall.occlusion (only mvt opts in) → byte-identical fleet. See js/45.
    classifyOcclusion(this);
    // Area-covering aggregate fabrics (wall linings, botryoidal/earthy crusts,
    // asbestiform mats and true quartz/calcite druse). Records physical coverage,
    // booked volume and mean layer thickness for the renderer; representative
    // instances never create extra mineral inventory. See js/45.
    classifySurfaceGrowth(this);
    // Capture the actual environmental and mass-transfer result after every
    // growth/dissolution and transformation path has had its turn this step.
    // This produces an auditable history with empty rows when a declared
    // weathering interval causes no reaction — absence is evidence too.
    recordWeatheringEpilogueStep(this);
    // Central-distance (Wulff) FORM (central-distance arc Phase 4 rung 4a.1, 2026-06-28) — the
    // arc's destination: tags fluorite with the {100}/{111} central-distance bias so the renderer
    // draws the geometrically-true cube↔cuboctahedron↔octahedron form instead of a fixed primitive.
    // Pure tagging; gated on wall.wulff_fluorite (only sunnyside opts in) → byte-identical fleet,
    // token unchanged so the size scale is untouched (no SIM bump, no rebake). See js/45.
    classifyWulffForm(this);

    // === HELIX-OVERLAY-FORK ADDITION (strip view bedrock, v149+) =====
    // Helicoid-as-recorder hook (Shy's 2026-05-26 design reframe).
    // When a StripRecorder is attached to the sim, capture one step's
    // worth of chip data + nucleation events at end-of-step. Single
    // conditional call with no side effects on sim state — runs without
    // the recorder, baseline identical. Wired by the UI layer at run
    // start; see 99k-strip-view.ts and 94-ui-menu.ts.
    if (this._stripRecorder && typeof this._stripRecorder.captureStep === 'function') {
      try { this._stripRecorder.captureStep(this); } catch (_err) { /* swallow — strip view is non-essential */ }
    }
    // === END HELIX-OVERLAY-FORK ADDITION ==============================

    if (this.conditions.fluid.sulfurPoolsExplicit) {
      this._sulfurLedgerHistory.push(simulatorSulfurLedgerSnapshot(this));
    }
    if (this._carbonLedgerEnabled) {
      this._carbonLedgerHistory.push(simulatorCarbonLedgerSnapshot(this));
    }

    return this.log;
  }

  narrate() {
    if (!this.crystals.length) return 'The vug remained empty. No minerals precipitated under these conditions. The fluid passed through without leaving a trace — still too hot, too undersaturated, or too brief. Given more time, this story might begin differently.';

    const totalGrowth = this.crystals.reduce((sum, c) => sum + c.total_growth_um, 0);
    if (totalGrowth < 5) {
      return `The vug barely began its story. Over ${this.step} steps, conditions shifted but nothing had time to grow beyond a thin film on the cavity wall. This is the very beginning — the fluid is still finding its equilibrium. Run more steps to see what this vug becomes.`;
    }

    const paragraphs = [];
    const first_crystal = this.crystals[0];
    const start_T = first_crystal.nucleation_temp;
    const mineral_names = [...new Set(this.crystals.map(c => c.mineral))];

    let setting;
    if (start_T > 300) setting = 'deep hydrothermal';
    else if (start_T > 150) setting = 'moderate-temperature hydrothermal';
    else setting = 'low-temperature';

    let vug_growth = '';
    if (this.conditions.wall.total_dissolved_mm > 0) {
      const w = this.conditions.wall;
      vug_growth = ` The cavity's equivalent-volume diameter changed from ${w.initial_vug_diameter_mm.toFixed(2)}mm to ${w.vug_diameter_mm.toFixed(2)}mm as acid pulses removed ${w.host_volume_removed_mm3_per_kg.toFixed(2)}mm³ of ${w.composition} per 1kg solvent reference (standard-state crystalline-volume approximation).`;
    }

    const yearsPerStep = timeScale * 10000;
    const totalYears = this.step * yearsPerStep;
    const timeStr = totalYears >= 1e6 ? `${(totalYears / 1e6).toFixed(1)} million years` : `${(totalYears / 1000).toFixed(0)},000 years`;
    paragraphs.push(
      `This vug records a ${setting} crystallization history spanning approximately ${timeStr}, beginning at ${start_T.toFixed(0)}°C. ${this.crystals.length} crystals grew across ${this.step} time steps (~${(yearsPerStep/1000).toFixed(0)},000 years each), producing an assemblage of ${mineral_names.join(', ')}.${vug_growth}`
    );

    const first_step = Math.min(...this.crystals.map(c => c.nucleation_step));
    const first_minerals = this.crystals.filter(c => c.nucleation_step === first_step);

    for (const c of first_minerals) {
      if (c.mineral === 'calcite') {
        paragraphs.push(
          `Calcite was the first mineral to crystallize, nucleating on the vug wall at ${c.nucleation_temp.toFixed(0)}°C. ` + this._narrate_calcite(c)
        );
      } else if (c.mineral === 'quartz') {
        paragraphs.push(
          `Quartz nucleated first at ${c.nucleation_temp.toFixed(0)}°C on the vug wall. ` + this._narrate_quartz(c)
        );
      } else {
        paragraphs.push(`${capitalize(c.mineral)} nucleated at ${c.nucleation_temp.toFixed(0)}°C.`);
      }
    }

    const later_crystals = this.crystals.filter(c => c.nucleation_step > first_step);
    if (later_crystals.length) {
      const triggeringEvent = (step) => {
        for (const e of this.events) {
          if (Math.abs(e.step - step) <= 2) return e;
        }
        return null;
      };

      // Event-triggered batches come out step-by-step. Untriggered
      // nucleations defer and get consolidated per-mineral so a mineral
      // that re-nucleates dozens of times in a stable brine reads as one
      // sentence instead of thirty repeating lines.
      const nuc_steps = [...new Set<number>(later_crystals.map(c => c.nucleation_step))].sort((a, b) => a - b);
      const untriggeredByMineral: Record<string, any[]> = {};
      for (const ns of nuc_steps) {
        const batch = later_crystals.filter(c => c.nucleation_step === ns);
        const batch_names = batch.map(c => c.mineral);
        const triggering_event = triggeringEvent(ns);

        if (triggering_event) {
          const name = triggering_event.name.toLowerCase();
          if (name.includes('mixing')) {
            paragraphs.push(
              `A fluid mixing event at step ${triggering_event.step} transformed the vug's chemistry. ` + this._narrate_mixing_event(batch, triggering_event)
            );
          } else if (name.includes('pulse')) {
            paragraphs.push(
              `A fresh pulse of hydrothermal fluid at step ${triggering_event.step} introduced new chemistry. ${[...new Set(batch_names)].map(capitalize).join(', ')} nucleated in response.`
            );
          } else if (name.includes('tectonic')) {
            paragraphs.push(
              `A tectonic event at step ${triggering_event.step} produced a differential-stress pulse.` + this._narrate_tectonic(batch)
            );
          } else {
            for (const c of batch) (untriggeredByMineral[c.mineral] ||= []).push(c);
          }
        } else {
          for (const c of batch) (untriggeredByMineral[c.mineral] ||= []).push(c);
        }
      }

      const ref_T = first_minerals.length ? first_minerals[0].nucleation_temp : null;

      for (const [mineral, crystals] of Object.entries(untriggeredByMineral)) {
        crystals.sort((a, b) => a.nucleation_step - b.nucleation_step);
        const temps = crystals.map(c => c.nucleation_temp);
        const t_min = Math.min(...temps), t_max = Math.max(...temps);
        const s_min = crystals[0].nucleation_step;
        const s_max = crystals[crystals.length - 1].nucleation_step;
        const mineralCap = capitalize(mineral);

        if (crystals.length === 1) {
          const c = crystals[0];
          if (ref_T !== null && Math.abs(c.nucleation_temp - ref_T) <= 2) {
            paragraphs.push(
              `At ${c.nucleation_temp.toFixed(0)}°C, ${mineral} nucleated at step ${c.nucleation_step} — the brine had held its window long enough for saturation to tip over.`
            );
          } else if (ref_T !== null && c.nucleation_temp < ref_T - 2) {
            paragraphs.push(
              `As temperature continued to fall, ${mineral} nucleated at step ${c.nucleation_step} (${c.nucleation_temp.toFixed(0)}°C).`
            );
          } else {
            paragraphs.push(
              `${mineralCap} nucleated at step ${c.nucleation_step} (${c.nucleation_temp.toFixed(0)}°C).`
            );
          }
          continue;
        }

        if (t_max - t_min <= 4) {
          paragraphs.push(
            `Between step ${s_min} and step ${s_max}, ${mineral} nucleated ${crystals.length} times as conditions held steady around ${t_min.toFixed(0)}°C — the window stayed open.`
          );
        } else {
          const direction = crystals[0].nucleation_temp > crystals[crystals.length - 1].nucleation_temp ? 'cooled' : 'warmed';
          paragraphs.push(
            `${mineralCap} nucleated ${crystals.length} times between step ${s_min} (${crystals[0].nucleation_temp.toFixed(0)}°C) and step ${s_max} (${crystals[crystals.length - 1].nucleation_temp.toFixed(0)}°C) as the fluid ${direction} through its window.`
          );
        }
      }
    }

    // Dispatch via this['_narrate_' + mineral] — spec says every mineral has one.
    const significant = this.crystals.filter(c => c.total_growth_um > 100);
    for (const c of significant) {
      const fn = this[`_narrate_${c.mineral}`];
      const story = typeof fn === 'function' ? fn.call(this, c) : '';
      if (story && !first_minerals.includes(c)) paragraphs.push(story);
    }

    // Phantom growth narrative
    const phantom_crystals = this.crystals.filter(c => c.phantom_count > 0);
    for (const c of phantom_crystals) {
      if (c.phantom_count >= 2) {
        paragraphs.push(
          `${capitalize(c.mineral)} #${c.crystal_id} shows ${c.phantom_count} phantom boundaries — internal surfaces where acid dissolved the crystal before new growth covered the damage. Each phantom preserves the shape of the crystal at the moment the acid arrived. In a polished section, these appear as ghost outlines nested inside the final crystal — the crystal's autobiography, written in dissolution and regrowth.`
        );
      } else if (c.phantom_count === 1) {
        paragraphs.push(
          `${capitalize(c.mineral)} #${c.crystal_id} contains a single phantom surface — a dissolution boundary where the crystal was partially eaten and then regrew over the wound. The phantom preserves the crystal's earlier shape as a ghost outline inside the final form.`
        );
      }
    }

    // Provenance narrative for calcite
    for (const c of this.crystals) {
      if (c.mineral === 'calcite' && c.zones.length) {
        const wall_zones = c.zones.filter(z => z.ca_from_wall > 0.3);
        const fluid_zones = c.zones.filter(z => z.ca_from_wall < 0.1 && z.thickness_um > 0);
        if (wall_zones.length && fluid_zones.length) {
          paragraphs.push(
            `The calcite tells two stories in one crystal. Early growth zones are built from the original fluid — Ca²⁺ that traveled through the basin. Later zones are built from recycled wall rock — limestone that was dissolved by acid and reprecipitated. The trace element signature shifts at the boundary: wall-derived zones carry the host rock's Fe and Mn signature, distinct from the fluid-derived zones. A microprobe traverse across this crystal would show the moment the vug started eating itself to feed its children.`
          );
        }
      }
    }

    // Radiation narrative
    if (this.radiation_dose > 0) {
      const smoky_crystals = this.crystals.filter(c => c.mineral === 'quartz' && c.radiation_damage > 0.3);
      const metamict_crystals = this.crystals.filter(c => c.radiation_damage > 0.8);
      let rad_text = `☢️ Radiation has left its mark on this vug. Total accumulated dose: ${this.radiation_dose.toFixed(2)}.`;
      if (smoky_crystals.length) {
        rad_text += ` ${smoky_crystals.length} quartz crystal${smoky_crystals.length > 1 ? 's have' : ' has'} turned smoky — aluminum impurities in the lattice were knocked loose by alpha particles from nearby uraninite, creating the color centers that give smoky quartz its signature darkness.`;
      }
      if (metamict_crystals.length) {
        rad_text += ` ${metamict_crystals.length} crystal${metamict_crystals.length > 1 ? 's have' : ' has'} become metamict — the crystal structure itself is destroyed by accumulated radiation damage, leaving an amorphous glass where ordered atoms once stood.`;
      }
      const uraninite_crystals = this.crystals.filter(c => c.mineral === 'uraninite');
      const galena_from_decay = this.crystals.filter(c => c.mineral === 'galena');
      if (uraninite_crystals.length && galena_from_decay.length) {
        rad_text += ` The galena in this assemblage crystallized in part from lead produced by uraninite decay — U-238 → Pb-206, the same chain used to date the age of rocks.`;
      }
      paragraphs.push(rad_text);
    }

    paragraphs.push(this._narrate_collectors_view());
    return paragraphs.join('\n\n');
  }

}

// ============================================================
// UTILITY
// ============================================================

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
