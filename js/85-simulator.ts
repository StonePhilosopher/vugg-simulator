// ============================================================
// js/85-simulator.ts — VugSimulator class + small utilities
// ============================================================
// The run-loop class. Mirror of vugg.VugSimulator (Phase A8 of the
// Python refactor would split this further; for now it lives whole).
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
      // Tier 1 C (post-v69): cavity material rendering style. The
      // Three.js renderer reads wall_state.cavity_render. Default
      // 'smooth' preserves pre-toggle look for every existing scenario.
      cavity_render: this.conditions.wall.cavity_render,
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
      // v84 (2026-05-19): is the cavity exposed to visible light?
      // Drives LIGHT_TRANSITIONS (realgar → pararealgar) in the
      // run_step hook. Default true; sealed/dark-cavity scenarios
      // can set false to preserve light-sensitive minerals.
      is_lit: this.conditions.wall.is_lit,
      // Size-class cascade (2026-05): vug < pocket < cave. Informational
      // tag mirrored from VugWall so the UI (Library Mode panels, the
      // Three.js scale bar) can display the size tier without reaching
      // back to conditions.wall.
      size_class: this.conditions.wall.size_class,
    });
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
    if (_initialMesh && _initialMesh.bindRingChemistry) {
      _initialMesh.bindRingChemistry(this.ring_fluids, this.ring_temperatures);
    }
    // PROPOSAL-CAVITY-INTERIOR-VOXELS Phase 1 (v158) — allocate the
    // cavity interior voxel grid now that the mesh is built and
    // chemistry is bound. d=0 voxels alias the mesh.cells[].fluid
    // objects (per [FIRM] B); d=1, d=2, d=3 voxels each get an
    // independent clone of the bulk fluid. Per-voxel temperature is
    // initialized to bulk T (per [FIRM] E) but not consumed in v158.
    // The grid is lazy-cached on wall_state; this call forces the
    // build so the grid is ready when _diffuseRingState first fires.
    this.wall_state.voxelGridFor(this);
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
    this._prevFluidSurfaceRing = null;
  }

  run_step() {
    this.log = [];
    this.step++;
    // Phase C v1: events apply to conditions.fluid (= equator ring
    // fluid via aliasing). Snapshot before and propagate the delta to
    // non-equator rings — otherwise a global event pulse never reaches
    // the rings where crystals are actually growing. Same wrap on
    // dissolve_wall and ambient_cooling. Mirrors vugg.py.
    let snap = this._snapshotGlobal();
    this.apply_events();
    this._propagateGlobalDelta(snap);
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
    this._applyOpenAtmosphereEquilibration();
    // Track dolomite saturation crossings for the Kim 2023 cycle mechanism.
    this.conditions.update_dol_cycles();
    snap = this._snapshotGlobal();
    this.dissolve_wall();
    this._propagateGlobalDelta(snap);

    // Calculate vug fill percentage — stop growth when full
    const vugFill = this.get_vug_fill();

    if (vugFill >= 1.0 && !this._vug_sealed) {
      this._vug_sealed = true;
      // Determine dominant mineral
      const mineralVols: Record<string, number> = {};
      for (const c of this.crystals) {
        if (!c.active) continue;
        const a = c.c_length_mm / 2, b = c.a_width_mm / 2;
        const v = (4/3) * Math.PI * a * b * b;
        mineralVols[c.mineral] = (mineralVols[c.mineral] || 0) + v;
      }
      const sorted = Object.entries(mineralVols).sort((a,b) => b[1] - a[1]);
      const dominant = sorted[0] ? sorted[0][0] : 'mineral';
      let sealMsg = `🪨 VUG SEALED — cavity completely filled after ${this.step} steps`;
      if (dominant === 'quartz' && sorted[0][1] / Object.values(mineralVols).reduce((a,b)=>a+b,0) > 0.8) {
        sealMsg += ` — AGATE (>80% quartz)`;
      } else if (sorted.length > 1) {
        sealMsg += ` — dominant: ${dominant}, with ${sorted.slice(1).map(s=>s[0]).join(', ')}`;
      }
      this.log.push(sealMsg);
    }

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
        const zone = this._runEngineForCrystal(engine, crystal);
        if (zone && zone.thickness_um < 0) {
          crystal.add_zone(zone);
          currentFill = this.get_vug_fill();
          this.log.push(`  ⬇ ${capitalize(crystal.mineral)} #${crystal.crystal_id}: DISSOLUTION ${zone.note}`);
        }
        continue;
      }
      // Universal max-size cap — 2× world record per MINERAL_SPEC.
      // Closes the 321,248% runaway growth bug. Uses total_growth_um
      // (the chemistry-truthful uncapped size) rather than c_length_mm,
      // because v59's per-crystal cavity cap (BUG-CRYSTALS-CLIP-VUG-WALL.md)
      // pins c_length_mm at vug_radius for crystals at the cavity wall,
      // which would prevent the world-record cap from ever firing on
      // those crystals and let total_growth_um run unbounded.
      const capCm = maxSizeCm(crystal.mineral);
      const cLengthForCap = crystal.total_growth_um / 1000.0;
      if (capCm != null && cLengthForCap / 10.0 >= capCm) {
        crystal.active = false;
        this.log.push(`  ⛔ ${capitalize(crystal.mineral)} #${crystal.crystal_id}: reached size cap (${capCm} cm = 2× world record) — growth halts`);
        continue;
      }
      const engine = MINERAL_ENGINES[crystal.mineral];
      if (!engine) continue;
      // v128 graduated competition: consume the pre-computed scaled zone
      // when present, applying mass balance against the cell fluid that
      // the dry-run originally read. Otherwise fall through to the
      // single-pass engine call (v127 behavior).
      //
      // The graduated path skips the engine in pass 2 BECAUSE the
      // engine would now see a fluid that's been mutated by prior
      // crystals' rationed mass-balance debits — re-running it would
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
        if (zone && typeof zone.thickness_um === 'number' && zone.thickness_um !== 0) {
          this._applyZoneMassBalance(crystal, zone);
        }
      } else {
        // Crystal had no engine entry (skipped at the top of the loop)
        // or wasn't in _graduatedZones (only happens when flag is off,
        // because pass 1 enumerates every active crystal). The flag-off
        // branch runs the engine exactly once via _runEngineForCrystal,
        // matching v127 byte-identically.
        zone = this._runEngineForCrystal(engine, crystal);
      }
      if (zone) {
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
              crystal.late_interlocking = true;
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
          if (currentFill >= 0.85 && dampener < 1.0) {
            crystal.late_interlocking = true;
          }
        }
        crystal.add_zone(zone);
        // Re-check fill after each crystal grows to prevent >100% overshoot
        if (zone.thickness_um > 0) {
          currentFill = this.get_vug_fill();
        }
        if (zone.thickness_um < 0) {
          currentFill = this.get_vug_fill();
          this.log.push(`  ⬇ ${capitalize(crystal.mineral)} #${crystal.crystal_id}: DISSOLUTION ${zone.note}`);
        } else if (Math.abs(zone.thickness_um) > 0.5) {
          this.log.push(`  ▲ ${capitalize(crystal.mineral)} #${crystal.crystal_id}: ${crystal.describe_latest_zone()}`);
        }
      }
    }

    // Paramorph transitions — convert crystals whose host fluid has cooled
    // past their phase-transition T (Round 8a-2: argentite → acanthite at
    // 173°C). Preserves habit + dominant_forms + zones; only crystal.mineral
    // changes. First non-destructive polymorph mechanic in the sim.
    for (const crystal of this.crystals) {
      const transition = applyParamorphTransitions(crystal, this.conditions.temperature, this.step);
      if (transition) {
        const [oldM, newM] = transition;
        this.log.push(
          `  ↻ PARAMORPH: ${capitalize(oldM)} #${crystal.crystal_id} → ${newM} ` +
          `(T dropped to ${this.conditions.temperature.toFixed(0)}°C, crossed ${oldM}/${newM} ` +
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
    // Per-step counter on crystal.light_exposure_steps increments
    // when wall.is_lit (default true; sealed-rock-cavity scenarios
    // can opt out via is_lit: false). Threshold = 60 steps for
    // realgar — gives realgar that nucleates by step 140 just
    // enough time to convert by run-end (200 steps), producing the
    // mixed realgar + pararealgar assemblage geologically authentic
    // for museum-collection specimens.
    const isLit = this.wall_state.is_lit !== false;
    for (const crystal of this.crystals) {
      const transition = applyLightTransitions(crystal, isLit, this.step);
      if (transition) {
        const [oldM, newM] = transition;
        this.log.push(
          `  ☼ LIGHT-INDUCED: ${capitalize(oldM)} #${crystal.crystal_id} → ${newM} ` +
          `(${crystal.light_exposure_steps} steps of light exposure; ` +
          `As₄S₄ molecule isomerized D₂d → Cs symmetry; ` +
          `orange-red shifted to yellow, crystal now friable)`
        );
      }
    }

    // v28: dehydration paramorphs — environment-triggered counterpart
    // to PARAMORPH_TRANSITIONS. Borax left in a vadose ring loses
    // water and pseudomorphs to tincalconite. Mirror of vugg.py.
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
        if (!DEHYDRATION_TRANSITIONS[crystal.mineral]) continue;
        // PHASE-1-CAVITY-MESH: read ringIdx via _resolveAnchor so this
        // dehydration loop no longer reads wall_ring_index directly.
        const anchor = this.wall_state._resolveAnchor(crystal);
        const ringIdx = anchor ? anchor.ringIdx : null;
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
        const Tlocal = this.ring_temperatures[ringIdx];
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
    for (const crystal of this.crystals) {
      if (crystal.mineral !== 'chalcanthite' || crystal.dissolved || !crystal.active) continue;
      if (this.conditions.fluid.salinity < 4.0 || this.conditions.fluid.pH > 5.0) {
        // 40%/step decay, with a 0.5-µm absolute floor below which we
        // collapse to full dissolution (asymptotic decay otherwise).
        let dissolved_um = Math.min(5.0, crystal.total_growth_um * 0.4);
        if (crystal.total_growth_um < 0.5) dissolved_um = crystal.total_growth_um;
        crystal.total_growth_um -= dissolved_um;
        crystal.c_length_mm = Math.max(crystal.total_growth_um / 1000.0, 0);
        this.conditions.fluid.Cu += dissolved_um * 0.5;
        this.conditions.fluid.S += dissolved_um * 0.5;
        if (crystal.total_growth_um <= 0) {
          crystal.dissolved = true;
          crystal.active = false;
          this.log.push(
            `  💧 RE-DISSOLVED: Chalcanthite #${crystal.crystal_id} ` +
            `completely returned to solution (salinity=${this.conditions.fluid.salinity.toFixed(1)}, ` +
            `pH=${this.conditions.fluid.pH.toFixed(1)}) — Cu²⁺ + SO₄²⁻ back in fluid`
          );
        } else {
          this.log.push(
            `  💧 Chalcanthite #${crystal.crystal_id}: re-dissolving ` +
            `(${dissolved_um.toFixed(1)} µm lost; salinity=${this.conditions.fluid.salinity.toFixed(1)}, ` +
            `pH=${this.conditions.fluid.pH.toFixed(1)})`
          );
        }
      }
    }

    // Check for vug seal after growth loop (may cross 1.0 during crystal growth)
    if (currentFill >= 1.0 && !this._vug_sealed) {
      this._vug_sealed = true;
      const mineralVols: Record<string, number> = {};
      for (const c of this.crystals) {
        if (!c.active) continue;
        const a = c.c_length_mm / 2, b = c.a_width_mm / 2;
        const v = (4/3) * Math.PI * a * b * b;
        mineralVols[c.mineral] = (mineralVols[c.mineral] || 0) + v;
      }
      const sorted = Object.entries(mineralVols).sort((a,b) => b[1] - a[1]);
      const dominant = sorted[0] ? sorted[0][0] : 'mineral';
      let sealMsg = `🪨 VUG SEALED — cavity completely filled after ${this.step} steps`;
      if (dominant === 'quartz' && sorted[0][1] / Object.values(mineralVols).reduce((a,b)=>a+b,0) > 0.8) {
        sealMsg += ` — AGATE (>80% quartz)`;
      } else if (sorted.length > 1) {
        sealMsg += ` — dominant: ${dominant}, with ${sorted.slice(1).map(s=>s[0]).join(', ')}`;
      }
      this.log.push(sealMsg);
    }
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
      this._propagateGlobalDelta(coolSnap);
    }

    // Phase C: inter-ring fluid/temperature diffusion runs at the
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
    // Pure metadata pass: no rng, no fluid mutation — byte-identical
    // chemistry.
    classifyMorphologyStep(this);

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
      vug_growth = ` The cavity itself expanded from ${(w.vug_diameter_mm - w.total_dissolved_mm * 2).toFixed(0)}mm to ${w.vug_diameter_mm.toFixed(0)}mm diameter as acid pulses dissolved ${w.total_dissolved_mm.toFixed(1)}mm of the ${w.composition} host rock.`;
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
              `A tectonic event at step ${triggering_event.step} produced a pressure spike.` + this._narrate_tectonic(batch)
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
