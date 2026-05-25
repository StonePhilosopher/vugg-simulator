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

Object.assign(VugSimulator.prototype, {
  // Phase C v1: snapshot conditions.fluid + temperature before a
// global-mutating block (events, wall dissolution, ambient cooling).
// Pair with _propagateGlobalDelta to apply the same delta to all
// non-equator rings. Mirrors VugSimulator._snapshot_global in vugg.py.
_snapshotGlobal() {
  return [_cloneFluid(this.conditions.fluid), this.conditions.temperature];
},

  // Phase C v1: apply the delta between current conditions and the
// pre-block snapshot to all non-equator ring_fluids and
// ring_temperatures. The equator ring is aliased to conditions.fluid
// so it already reflects the new value — skip it.
_propagateGlobalDelta(snap) {
  const [preFluid, preTemp] = snap;
  const equator = Math.floor(this.wall_state.ring_count / 2);
  const equatorFluid = this.ring_fluids[equator];  // = conditions.fluid (aliased)
  // PROPOSAL-CAVITY-MESH Phase 4 Tranche 4c — mesh is a constructor
  // invariant; the legacy ring_fluids[] direct-propagation path is
  // unreachable in normal flow and dropped from the wrapper. The
  // mesh.propagateDelta call is the canonical chemistry-mutation
  // propagation now.
  const mesh = this.wall_state.meshFor(this);
  mesh.propagateDelta(preFluid, this._fluidFieldNames, equatorFluid);
  const deltaT = this.conditions.temperature - preTemp;
  if (deltaT !== 0) {
    for (let k = 0; k < this.ring_temperatures.length; k++) {
      if (k === equator) {
        this.ring_temperatures[k] = this.conditions.temperature;
      } else {
        this.ring_temperatures[k] += deltaT;
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
// Mirror of VugSimulator._apply_water_level_drift in vugg.py.
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
// Mirror of VugSimulator._apply_vadose_oxidation_override in vugg.py.
_applyVadoseOxidationOverride() {
  const n = this.wall_state.ring_count;
  const newSurface = this.conditions.fluid_surface_ring;
  const oldSurface = this._prevFluidSurfaceRing;
  this._prevFluidSurfaceRing = newSurface;
  if (newSurface === null || newSurface === undefined) return [];
  if (oldSurface !== null && oldSurface !== undefined && newSurface >= oldSurface) {
    return [];
  }
  // PROPOSAL-CAVITY-MESH Phase 4 Tranche 4a — apply the vadose override
  // to EVERY cell in a transitioning ring, not just the ring-level
  // pool. Post-un-aliasing each cell has its own fluid; the
  // oxidation-+-evaporation-boost has to hit all of them or only
  // the first vertex of each ring would oxidize while the rest stay
  // reducing — clearly wrong.
  const mesh = this.wall_state.meshFor
    ? this.wall_state.meshFor(this)
    : null;
  const cellsPerRing = this.wall_state.cells_per_ring || 0;
  const becameVadose = [];
  for (let r = 0; r < n; r++) {
    const was = VugConditions._classifyWaterState(oldSurface, r, n);
    const now = VugConditions._classifyWaterState(newSurface, r, n);
    if (now === 'vadose' && was !== 'vadose') {
      // Apply oxidation override to every cell in this ring.
      if (mesh && mesh.cells && cellsPerRing > 0) {
        for (let c = 0; c < cellsPerRing; c++) {
          const cell = mesh.cells[r * cellsPerRing + c];
          if (!cell || !cell.fluid) continue;
          if (cell.fluid.O2 < 1.8) cell.fluid.O2 = 1.8;
          cell.fluid.S *= 0.3;
          // v27 evaporative concentration boost (mirror of vugg.py).
          cell.fluid.concentration *= EVAPORATIVE_CONCENTRATION_FACTOR;
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
      if (rf) {
        if (rf.O2 < 1.8) rf.O2 = 1.8;
        rf.S *= 0.3;
        rf.concentration *= EVAPORATIVE_CONCENTRATION_FACTOR;
      }
      becameVadose.push(r);
    }
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
  // PROPOSAL-CAVITY-MESH Phase 4 Tranche 4c — mesh is a constructor
  // invariant; the legacy ring-Laplacian fallback path is unreachable
  // in normal flow and dropped. mesh.diffuse is the canonical
  // diffusion implementation. Post-Tranche-4a it operates truly per-
  // vertex (cells are un-aliased); Path C in full.
  const mesh = this.wall_state.meshFor(this);
  mesh.diffuse(rate, this._fluidFieldNames, this.ring_temperatures);
},

  _repaintWallState() {
  // Rebuild ring-0 occupancy from the crystal list. Cheap (~120 × ~20)
  // and keeps per-cell thickness consistent with dissolution / enclosure.
  this.wall_state.updateDiameter(this.conditions.wall.vug_diameter_mm);
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
  const snap: any = {
    step: this.step,
    rings: new Array(ringCount),
    conditions: {
      temperature: cnd.temperature,
      pressure: cnd.pressure,
      pH: cnd.fluid.pH,
      flow_rate: cnd.flow_rate,
      vug_diameter_mm: cnd.wall.vug_diameter_mm,
      total_dissolved_mm: cnd.wall.total_dissolved_mm,
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
    ring_fluids: this.ring_fluids ? this.ring_fluids.map((f: any) => _cloneFluid(f)) : null,
    ring_temperatures: this.ring_temperatures ? this.ring_temperatures.slice() : null,
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

  _wallCellsBlockedByCrystals() {
  // Which ring-0 cells are shielded from wall dissolution. A cell
  // blocks when it holds a non-dissolved crystal whose mineral is
  // stable at the current pH — either permanently acid-stable
  // (acid_dissolution == null, e.g. uraninite/molybdenite) or the
  // current pH is above its threshold.
  const ph = this.conditions.fluid.pH;
  const byId = new Map<number, any>(this.crystals.map(c => [c.crystal_id, c]));
  const blocked = new Set();
  const ring0 = this.wall_state.rings[0];
  for (let i = 0; i < ring0.length; i++) {
    const cell = ring0[i];
    if (cell.crystal_id == null) continue;
    const crystal = byId.get(cell.crystal_id);
    if (!crystal || crystal.dissolved) continue;
    const acid = MINERAL_SPEC[crystal.mineral]?.acid_dissolution;
    if (acid == null) { blocked.add(i); continue; }
    const threshold = acid.pH_threshold;
    if (threshold == null || ph >= threshold) blocked.add(i);
  }
  return blocked;
},

  get_vug_fill() {
  const vugR = this.conditions.wall.vug_diameter_mm / 2;
  const vugVol = (4 / 3) * Math.PI * Math.pow(vugR, 3);
  if (vugVol <= 0) return 0;
  let crystalVol = 0;
  for (const c of this.crystals) {
    if (!c.active) continue;
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
    if (typeof c._volume_mm3 === 'number') {
      crystalVol += c._volume_mm3;
      continue;
    }
    const cMm = c.total_growth_um / 1000;
    let aMm;
    if (c.habit === 'prismatic') aMm = cMm * 0.4;
    else if (c.habit === 'tabular') aMm = cMm * 1.5;
    else if (c.habit === 'acicular') aMm = cMm * 0.15;
    else if (c.habit === 'rhombohedral') aMm = cMm * 0.8;
    else if (c.habit === 'snowball') aMm = cMm;
    else aMm = cMm * 0.5;
    const a = cMm / 2;
    const b = aMm / 2;
    crystalVol += (4 / 3) * Math.PI * a * b * b;
  }
  return crystalVol / vugVol;
},

  // When a big crystal grows past an adjacent smaller one that's stopped
// growing, the smaller crystal becomes an inclusion inside the bigger
// one. Classic "Sweetwater mechanism" — pyrite first, then calcite
// grows around it. Ports check_enclosure from vugg.py 1:1.
_check_enclosure() {
  for (const grower of this.crystals) {
    if (!grower.active || grower.c_length_mm < 0.5) continue;
    if (grower.enclosed_by != null) continue;
    // Size-ratio uses the chemistry-truthful uncapped c_length
    // (total_growth_um / 1000) rather than the rendered/capped value.
    // v59's cavity cap pins c_length at vug_radius for big crystals,
    // which would shrink their grower-vs-candidate size ratio and
    // suppress enclosures that should fire — cause of gem_pegmatite
    // baseline drift before this fix.
    const growerSize = grower.total_growth_um / 1000;
    for (const candidate of this.crystals) {
      if (candidate.crystal_id === grower.crystal_id) continue;
      if (candidate.enclosed_by != null) continue;
      if (grower.enclosed_crystals.includes(candidate.crystal_id)) continue;

      const candidateSize = candidate.total_growth_um / 1000;
      const sizeRatio = growerSize / Math.max(candidateSize, 0.001);
      const adjacent = (
        candidate.position === grower.position
        || candidate.position.includes(`#${grower.crystal_id}`)
      );
      // Require the candidate to have actually lived a bit before it
      // can be swallowed. Without this, a just-nucleated crystal with
      // zero zones qualifies on step 1 and gets enveloped before it
      // grows a single face — 600 inclusions pile up in a loop of
      // nucleate-then-instantly-enclose. Real Sweetwater-style
      // pyrite needs time to exhaust its chemistry and stop growing
      // before the calcite takes it.
      if (!candidate.zones || candidate.zones.length < 3) continue;
      const recent = candidate.zones.slice(-3).reduce((s, z) => s + z.thickness_um, 0);
      const slowing = recent < 3.0;
      if (sizeRatio > 3.0 && adjacent && slowing) {
        grower.enclosed_crystals.push(candidate.crystal_id);
        grower.enclosed_at_step.push(this.step);
        candidate.enclosed_by = grower.crystal_id;
        candidate.active = false;
        this.log.push(
          `  💎 ENCLOSURE: ${capitalize(grower.mineral)} #${grower.crystal_id} ` +
          `(${grower.c_length_mm.toFixed(1)}mm) has grown around ` +
          `${candidate.mineral} #${candidate.crystal_id} (${candidate.c_length_mm.toFixed(2)}mm). ` +
          `The ${candidate.mineral} is now an inclusion inside the ${grower.mineral}.`
        );
      }
    }
  }
},

  // When the host crystal is dissolving back past the point it enclosed
// a neighbor, the neighbor is freed. Ports check_liberation from
// vugg.py 1:1.
_check_liberation() {
  for (const host of this.crystals) {
    if (!host.enclosed_crystals.length) continue;
    if (!host.dissolved) continue;
    const freed = [];
    for (let i = 0; i < host.enclosed_crystals.length; i++) {
      const encId = host.enclosed_crystals[i];
      const encStep = host.enclosed_at_step[i];
      const enc = this.crystals.find(c => c.crystal_id === encId);
      if (!enc) continue;
      let hostSizeAtEnc = 0;
      for (const z of host.zones) if (z.step <= encStep) hostSizeAtEnc += z.thickness_um;
      if (host.total_growth_um < hostSizeAtEnc * 0.7) {
        freed.push(i);
        enc.enclosed_by = null;
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
});
