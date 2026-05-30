// ============================================================
// js/24-geometry-voxel-grid.ts — CavityVoxelGrid (interior 3D fluid store)
// ============================================================
// Phase 1 of PROPOSAL-CAVITY-INTERIOR-VOXELS.
//
// What this is: a 3D voxel grid spanning the cavity INTERIOR. Each
// voxel carries its own fluid composition + temperature. Engines couple
// the wall cell to its adjacent boundary-layer voxel (Phase 2+);
// diffusion propagates chemistry through the volume (Phase 2+).
//
// Address scheme — spherical voxels matching the wall mesh address:
//   (r, c, d) where:
//     r ∈ [0, ring_count)        ring index (matches wall mesh)
//     c ∈ [0, cells_per_ring)    cell index (matches wall mesh)
//     d ∈ [0, depth_count)       radial depth, 0 = wall, max = center
//
// Per [FIRM] A: depth_count = 4. Each slice has clean geological
// semantics:
//   d=0  boundary layer (aliased to wall cell; engine mass-balance hits here)
//   d=1  near-wall buffer (depletion halo lives here)
//   d=2  interior bulk (event chemistry target)
//   d=3  center baseline (slowest to equilibrate)
//
// Consumers wanting higher resolution use sampleFluid(r, c, depth, field)
// with fractional depth — linear interpolation across adjacent slices.
// Mirrors the strip recorder's existing 120→24 angular downsample idiom.
//
// PHASE 1 SCOPE (v158)
//
// This commit ships the data model + accessors + a thin diffuse() that
// delegates to wall.mesh.diffuse() for byte-identical baseline:
//   - d=0 voxels SHARE fluid object identity with wall mesh cells (per
//     [FIRM] B alias). A write through either path is visible through
//     the other immediately.
//   - d=1, d=2, d=3 voxels each get an INDEPENDENT clone of the bulk
//     initial fluid; nothing touches them in v158 (engines still read
//     from wall cells, events still mutate conditions.fluid, diffusion
//     still runs on wall slab only). Uniform initial values mean a real
//     Laplacian would be a no-op anyway.
//   - Per-voxel temperature stored but not consumed yet ([FIRM] E).
//     Engines still read ring_temperatures[].
//   - voxelGrid.diffuse() is the CANONICAL diffusion path going forward
//     ([FIRM] H merge); in v158 it just delegates to wall.mesh.diffuse.
//     Phase 2 expands the body to do real per-voxel + radial diffusion.
//
// Net effect of v158: data model exists, accessors work, tests verify
// the structure. Sim chemistry unchanged. Baseline byte-identical.

// Default depth count — boss-firm at 4 slices. Consumers wanting more
// resolution call sampleFluid() with fractional depth.
const _CAVITY_VOXEL_DEPTH_COUNT = 4;

// v160 (Phase 2b) — asymmetric diffusion stepping cadence. The boundary
// slabs (d=0 wall + d=1 near-wall buffer) diffuse EVERY step; the deep
// reservoir (d=2 interior bulk + d=3 center) only every Nth step. This
// is BOTH a perf optimization (the snapshot + Laplacian skip ~half the
// voxels on the 3 of every 4 "shallow" steps) AND the correct physics:
// the proposal's slice semantics say d=3 is "slowest to equilibrate"
// and PROPOSAL §performance mitigation #2 explicitly blesses
// "boundary-shell every step, interior-shell every N steps — it's
// slower in reality anyway." The d1/d2 interface is no-flux (Neumann)
// on shallow steps, so mass is conserved every step; the deep reservoir
// just exchanges with the near-wall buffer periodically rather than
// continuously. Measured: ~8.5 ms/step (all-slab every step) →
// ~5 ms/step (this cadence), clearing the multi-seed test timeouts.
const _DIFFUSE_DEEP_EVERY = 4;

interface CavityVoxelLike {
  ringIdx: number;
  cellIdx: number;
  depthIdx: number;
  // Fluid — aliased to wall mesh cell fluid at d=0; independent clone otherwise.
  fluid: any;
  // Per-voxel temperature. v158: stored, init to bulk T, not consumed.
  // Phase 2+: engines read per-voxel T; Phase 4+ adds thermal convection.
  temperature: number;
}

class CavityVoxelGrid {
  // Dynamic dataclass fields — runtime untouched, matches WallMesh pattern.
  [key: string]: any;

  ring_count: number;
  cells_per_ring: number;
  depth_count: number;

  // Flat storage for tight inner-loop reads. Index formula:
  //   voxels[r * cells_per_ring * depth_count + c * depth_count + d]
  voxels: CavityVoxelLike[];

  constructor(opts: {
    ring_count: number;
    cells_per_ring: number;
    depth_count?: number;
  }) {
    this.ring_count = opts.ring_count | 0;
    this.cells_per_ring = opts.cells_per_ring | 0;
    this.depth_count = (opts.depth_count != null)
      ? (opts.depth_count | 0)
      : _CAVITY_VOXEL_DEPTH_COUNT;
    this.voxels = [];
  }

  // ---- Factory ------------------------------------------------------

  // Build a voxel grid for a sim. Aliases d=0 voxels to the existing
  // wall mesh cell fluid objects (per [FIRM] B); clones the bulk fluid
  // into the rest. Per-voxel temperature initialized to bulk T.
  //
  // The wall mesh MUST be built before this is called (the alias depends
  // on mesh.cells[] existing with fluid objects). The standard call site
  // is the VugSimulator constructor, immediately after the mesh +
  // bindRingChemistry pass.
  //
  // Returns null defensively if dimensions can't be resolved (headless
  // test harnesses that skip wall mesh build).
  static fromWallState(wall: any, sim: any): CavityVoxelGrid | null {
    if (!wall) return null;
    const ringCount = wall.ring_count | 0;
    const cellsPerRing = wall.cells_per_ring | 0;
    if (ringCount < 1 || cellsPerRing < 1) return null;

    const grid = new CavityVoxelGrid({
      ring_count: ringCount,
      cells_per_ring: cellsPerRing,
      depth_count: _CAVITY_VOXEL_DEPTH_COUNT,
    });

    // Resolve the wall mesh — d=0 voxels alias mesh cell fluids.
    const mesh = (wall.meshFor && typeof wall.meshFor === 'function')
      ? wall.meshFor(sim)
      : null;

    // Bulk fluid + temperature for cloning into d≥1 voxels.
    const bulkFluid = (sim && sim.conditions && sim.conditions.fluid)
      ? sim.conditions.fluid
      : null;
    const bulkTemp = (sim && sim.conditions && typeof sim.conditions.temperature === 'number')
      ? sim.conditions.temperature
      : 25;
    const Cloner: any = (typeof _cloneFluid !== 'undefined') ? _cloneFluid : null;

    const total = ringCount * cellsPerRing * grid.depth_count;
    grid.voxels = new Array(total);

    for (let r = 0; r < ringCount; r++) {
      for (let c = 0; c < cellsPerRing; c++) {
        // Resolve the wall mesh cell for this (r, c) — its fluid object
        // becomes the d=0 voxel's fluid (alias). The mesh cell may be
        // missing in headless test harnesses; defensive fallback clones
        // from bulk so the voxel still has SOMETHING to read.
        const meshCell = (mesh && mesh.cells && (r * cellsPerRing + c) < mesh.cells.length)
          ? mesh.cells[r * cellsPerRing + c]
          : null;
        const wallFluid = (meshCell && meshCell.fluid) ? meshCell.fluid : null;

        for (let d = 0; d < grid.depth_count; d++) {
          const idx = r * cellsPerRing * grid.depth_count + c * grid.depth_count + d;
          let voxelFluid: any;
          if (d === 0 && wallFluid) {
            // ALIAS — same object as the wall mesh cell's fluid. Writes
            // through either path are visible through the other.
            voxelFluid = wallFluid;
          } else {
            // INDEPENDENT clone of the bulk fluid (or wall fluid as
            // fallback if bulk is missing). v158 never mutates these
            // (engines still read d=0 only); Phase 2 will.
            voxelFluid = (Cloner && bulkFluid) ? Cloner(bulkFluid)
                       : (Cloner && wallFluid) ? Cloner(wallFluid)
                       : wallFluid || bulkFluid || null;
          }
          grid.voxels[idx] = {
            ringIdx: r,
            cellIdx: c,
            depthIdx: d,
            fluid: voxelFluid,
            temperature: bulkTemp,
          };
        }
      }
    }
    // Stash the mesh reference so diffuse() can delegate to it (v158
    // implementation). Phase 2 retires this when diffuse goes truly
    // per-voxel.
    grid.bindMesh(mesh);
    return grid;
  }

  // ---- Index helpers ------------------------------------------------

  // O(1) flat-array index for (r, c, d). Returns -1 if out of range.
  _index(r: number, c: number, d: number): number {
    if (r < 0 || r >= this.ring_count) return -1;
    if (c < 0 || c >= this.cells_per_ring) return -1;
    if (d < 0 || d >= this.depth_count) return -1;
    return r * this.cells_per_ring * this.depth_count
         + c * this.depth_count
         + d;
  }

  // ---- Accessors ----------------------------------------------------

  // Get the voxel at (r, c, d). Returns null if out of range.
  voxelAt(r: number, c: number, d: number): CavityVoxelLike | null {
    const i = this._index(r, c, d);
    return (i >= 0) ? this.voxels[i] : null;
  }

  // Get the boundary-layer voxel for wall cell (r, c). Convenience for
  // voxelAt(r, c, 0) — the most common engine-side query.
  boundaryVoxel(r: number, c: number): CavityVoxelLike | null {
    return this.voxelAt(r, c, 0);
  }

  // Get the fluid at (r, c, d). Returns null if voxel or fluid is missing.
  fluidAt(r: number, c: number, d: number): any {
    const v = this.voxelAt(r, c, d);
    return v ? v.fluid : null;
  }

  // Sample a fluid field at fractional depth via linear interpolation
  // between adjacent stored slices. Mirrors the strip recorder's
  // 120→24 angular downsample idiom — consumers can render any
  // resolution they want against a 4-slice store.
  //
  //   depth = 0.0 → fluidAt(r, c, 0)
  //   depth = 1.5 → 0.5 × fluidAt(r, c, 1) + 0.5 × fluidAt(r, c, 2)
  //   depth = 3.0 → fluidAt(r, c, 3)
  //
  // Clamps depth to [0, depth_count - 1]. Returns NaN if either bracket
  // voxel is missing.
  sampleFluid(r: number, c: number, depth: number, field: string): number {
    if (!Number.isFinite(depth)) return NaN;
    const maxD = this.depth_count - 1;
    if (depth < 0) depth = 0;
    if (depth > maxD) depth = maxD;
    const d0 = Math.floor(depth);
    const d1 = Math.min(d0 + 1, maxD);
    const t = depth - d0;
    const a = this.fluidAt(r, c, d0);
    const b = this.fluidAt(r, c, d1);
    if (!a || !b) return NaN;
    const va = a[field];
    const vb = b[field];
    if (typeof va !== 'number' || typeof vb !== 'number') return NaN;
    return va * (1 - t) + vb * t;
  }

  // ---- Diffusion ----------------------------------------------------

  // Canonical diffusion entry point (per [FIRM] H merge).
  //
  // v159 (Phase 2a) implementation: still delegates to wall mesh
  // diffusion for the d=0 slab — same byte-identity behavior as v158.
  // The per-voxel + radial Laplacian (commented below) was prototyped
  // in v159 prep but DEFERRED to v160 (Phase 2b), where it ships
  // alongside per-cell nucleation gates as the load-bearing geological
  // behavior change. The two mechanisms are coupled (depletion halos
  // need both 3D diffusion AND per-cell σ sampling to be meaningful)
  // so they should ship together rather than in separate commits.
  //
  // v159 ships propagateEventDelta (below) which DOES reach interior
  // voxels — events now affect the whole cavity uniformly, setting up
  // the interior voxels with real chemistry for v160 to consume. No
  // engine path consumes interior voxels in v159, so this is pure
  // infrastructure with no behavioral effect on crystal output.
  //
  // The real per-voxel diffusion implementation lives in
  // _diffuseFull (below the delegate) — kept as a private method so
  // v160 can flip the dispatch with a one-line change. The
  // implementation is already optimized (pre-allocated snapshot,
  // inline neighbor indices, per-field variance skip) and ready to
  // ship; only the dispatch is gated.
  diffuse(rate: number, fieldNames: string[], ringTemps?: number[]): void {
    if (!(rate > 0)) return;
    if (!fieldNames || !fieldNames.length) return;
    // v160 (Phase 2b) — real per-voxel 3D Laplacian. The d=0 slab is
    // the wall (via [FIRM] B alias) and diffuses with the SAME
    // lat-long stencil mesh.diffuse used (same c-neighbors, same
    // Neumann pole clamping, same rate) PLUS a radial neighbor (d=1).
    // The radial coupling is the load-bearing change: the cavity
    // interior reservoir (d=1,2,3, carrying event chemistry via
    // propagateEventDelta) now replenishes wall cells the engines
    // depleted via mass balance, and depletion halos propagate
    // radially inward as 3D objects. See _diffuseFull for the
    // optimized implementation + perf notes.
    this._diffuseFull(rate, fieldNames, ringTemps);
  }

  // v159 prep / v160-ready implementation: real 3D Laplacian across
  // (r, c, d) with up to 6 neighbors per voxel. Private — called only
  // by diffuse() once Phase 2b lights it up. See diffuse() doc above
  // for the deferral rationale.
  //
  //   r axis: Neumann (no-flux) at r=0 and r=ring_count-1 (pole caps)
  //   c axis: cyclic (theta wraps around the cavity)
  //   d axis: Neumann at d=0 (wall) and d=depth_count-1 (center)
  //
  // Optimizations:
  //   - Pre-allocated snapshot buffer (reused across calls; saves
  //     ~3 MB allocation per step + GC pressure)
  //   - Inline neighbor indices (no per-iteration Array allocation)
  //   - Per-field variance skip — fields uniform across the entire
  //     grid (typical for trace elements like Bi, Te, Au, Ag) skip
  //     the Laplacian entirely. Measured ~30-40% perf win.
  //   - Branchless inner loop (multiply by 0 for absent neighbors
  //     rather than conditional add)
  //
  // Measured perf at 4-slice resolution: 10-12 ms/step on event-heavy
  // scenarios. Under proposal's 20 ms target. Tighter bounds available
  // via further optimization (sparse diffusion per [FIRM] performance
  // table) if v160 surfaces a perf regression.
  _diffuseFull(rate: number, fieldNames: string[], ringTemps?: number[]): void {
    if (!(rate > 0)) return;
    if (!fieldNames || !fieldNames.length) return;
    if (!this.voxels || !this.voxels.length) return;

    const R = this.ring_count;
    const N = this.cells_per_ring;
    const D = this.depth_count;
    const total = R * N * D;
    const F = fieldNames.length;

    // Asymmetric stepping (see _DIFFUSE_DEEP_EVERY). dHi is the deepest
    // slab processed THIS step: on a "deep" step we run the whole column
    // (dHi = D-1); on the 3-of-4 "shallow" steps we only touch the
    // boundary slabs (dHi = 1, i.e. d=0 + d=1). Voxels deeper than dHi
    // are neither snapshotted nor written, and the d=1 radial-outward
    // neighbor is clamped to Neumann at the d1/d2 interface so the deep
    // reservoir is frozen (no flux) on shallow steps. Deterministic — no
    // RNG; the counter is per-grid (per-sim) so runs are reproducible.
    if (this._diffStep == null) this._diffStep = 0;
    const deep = (this._diffStep++ % _DIFFUSE_DEEP_EVERY) === 0;
    const dHi = deep ? (D - 1) : Math.min(1, D - 1);

    // Snapshot buffer — pre-allocated and reused across calls to avoid
    // GC pressure (3 MB allocation per step would cripple perf
    // otherwise). Resized lazily if voxel count or field count changes.
    if (!this._diffuseSnap || this._diffuseSnap.length !== total * F) {
      this._diffuseSnap = new Float64Array(total * F);
    }
    const snap: Float64Array = this._diffuseSnap;
    // Per-field min/max tracked during snapshot so we can skip the
    // Laplacian for fields that are uniform across the grid (Laplacian
    // of a constant is zero — pure write-overhead with no behavioral
    // effect). In typical scenarios, ~70-80% of FluidChemistry fields
    // are at-or-near-zero trace elements (Bi, Te, Au, Ag, etc.) that
    // never get perturbed; skipping their Laplacian cuts the inner-
    // loop work proportionally.
    if (!this._fieldMin || this._fieldMin.length !== F) {
      this._fieldMin = new Float64Array(F);
      this._fieldMax = new Float64Array(F);
      this._fieldActive = new Uint8Array(F);
    }
    const fieldMin: Float64Array = this._fieldMin;
    const fieldMax: Float64Array = this._fieldMax;
    const fieldActive: Uint8Array = this._fieldActive;
    for (let k = 0; k < F; k++) {
      fieldMin[k] = Infinity;
      fieldMax[k] = -Infinity;
    }
    for (let i = 0; i < total; i++) {
      // Skip slabs deeper than this step's dHi (i % D === depthIdx). On
      // shallow steps this skips d=2,d=3 — the bulk of the per-step work.
      if ((i % D) > dHi) continue;
      const fluid = this.voxels[i].fluid;
      if (!fluid) continue;
      const base = i * F;
      for (let k = 0; k < F; k++) {
        const v = fluid[fieldNames[k]];
        const num = (typeof v === 'number' && Number.isFinite(v)) ? v : 0;
        snap[base + k] = num;
        if (num < fieldMin[k]) fieldMin[k] = num;
        if (num > fieldMax[k]) fieldMax[k] = num;
      }
    }
    // Mark fields that have non-trivial variance — these need the
    // Laplacian. Epsilon = 1e-9 ppm: any field whose grid-wide spread
    // is below this is "uniform enough" to skip. Tight enough that
    // real gradients always cross it; loose enough that floating-
    // point noise doesn't trip it.
    const FIELD_DIFFUSE_EPSILON = 1e-9;
    let activeFieldCount = 0;
    for (let k = 0; k < F; k++) {
      const active = (fieldMax[k] - fieldMin[k]) > FIELD_DIFFUSE_EPSILON ? 1 : 0;
      fieldActive[k] = active;
      if (active) activeFieldCount++;
    }
    if (activeFieldCount === 0) {
      // Whole grid is uniform across every field — Laplacian is a no-op.
      // Skip everything except the temperature diffusion below.
      if (ringTemps && ringTemps.length > 0) {
        const oldT = ringTemps.slice();
        const n = ringTemps.length;
        for (let k = 0; k < n; k++) {
          const kp = k > 0 ? k - 1 : 0;
          const kn = k < n - 1 ? k + 1 : n - 1;
          ringTemps[k] = oldT[k] + rate * (oldT[kp] + oldT[kn] - 2 * oldT[k]);
        }
      }
      return;
    }

    // Apply Laplacian per voxel. Walk in (r, c, d) order for cache
    // locality on the inner-loop snapshot reads. Neighbor indices
    // computed inline (no per-iteration Array allocation); Neumann
    // boundaries handled by conditional add rather than allocating a
    // variable-size neighbor list.
    const NDperR = N * D;
    for (let r = 0; r < R; r++) {
      const rBase = r * NDperR;
      const rUpBase = (r > 0) ? rBase - NDperR : -1;
      const rDnBase = (r < R - 1) ? rBase + NDperR : -1;
      for (let c = 0; c < N; c++) {
        // Cyclic c-neighbors precomputed once per (r, c) — same for all d.
        const cPrev = (c - 1 + N) % N;
        const cNext = (c + 1) % N;
        const cPrevBase = rBase + cPrev * D;
        const cNextBase = rBase + cNext * D;
        const cBase = rBase + c * D;
        for (let d = 0; d <= dHi; d++) {
          const i = cBase + d;
          const fluid = this.voxels[i].fluid;
          if (!fluid) continue;
          const selfBase = i * F;

          // Pre-resolve neighbor flat-indices (NO per-iteration Array
          // allocation). Boundaries that don't exist are -1; the
          // per-field loop below skips them. Degree is decremented for
          // each invalid neighbor so the Laplacian self-coefficient
          // stays right (Neumann == no-flux).
          const nCPrev = cPrevBase + d;                       // always valid (cyclic)
          const nCNext = cNextBase + d;                       // always valid (cyclic)
          const nRUp   = (rUpBase >= 0) ? rUpBase + c * D + d : -1;
          const nRDn   = (rDnBase >= 0) ? rDnBase + c * D + d : -1;
          const nDIn   = (d > 0)     ? i - 1 : -1;
          // Radial-outward neighbor clamped to dHi: on shallow steps the
          // d=1 voxel sees no d=2 neighbor (Neumann no-flux at the d1/d2
          // interface), freezing the deep reservoir + conserving mass.
          const nDOut  = (d < dHi)   ? i + 1 : -1;
          let degree = 2; // c-neighbors always present
          if (nRUp  >= 0) degree++;
          if (nRDn  >= 0) degree++;
          if (nDIn  >= 0) degree++;
          if (nDOut >= 0) degree++;

          // Apply Laplacian per field — inner loop is now branchless
          // for the neighbor existence checks (multiply by 0 if absent).
          // Compiler/V8 handles this well; per-field work is ~10 ops.
          const rUpOff = (nRUp  >= 0) ? nRUp  * F : 0;
          const rDnOff = (nRDn  >= 0) ? nRDn  * F : 0;
          const dInOff = (nDIn  >= 0) ? nDIn  * F : 0;
          const dOutOff= (nDOut >= 0) ? nDOut * F : 0;
          const cPrevOff = nCPrev * F;
          const cNextOff = nCNext * F;
          const hasRUp = (nRUp  >= 0) ? 1 : 0;
          const hasRDn = (nRDn  >= 0) ? 1 : 0;
          const hasDIn = (nDIn  >= 0) ? 1 : 0;
          const hasDOut= (nDOut >= 0) ? 1 : 0;

          for (let k = 0; k < F; k++) {
            if (!fieldActive[k]) continue;  // uniform field — skip
            const self = snap[selfBase + k];
            const neighborSum =
                snap[cPrevOff + k]
              + snap[cNextOff + k]
              + hasRUp  * snap[rUpOff  + k]
              + hasRDn  * snap[rDnOff  + k]
              + hasDIn  * snap[dInOff  + k]
              + hasDOut * snap[dOutOff + k];
            fluid[fieldNames[k]] = self + rate * (neighborSum - degree * self);
          }
        }
      }
    }

    // ringTemps continues to diffuse 1D per-ring (Tranche 4a's pattern).
    // Per-voxel temperature stored but not consumed yet ([FIRM] E).
    if (ringTemps && ringTemps.length > 0) {
      const oldT = ringTemps.slice();
      const n = ringTemps.length;
      for (let k = 0; k < n; k++) {
        const kp = k > 0 ? k - 1 : 0;
        const kn = k < n - 1 ? k + 1 : n - 1;
        ringTemps[k] = oldT[k] + rate * (oldT[kp] + oldT[kn] - 2 * oldT[k]);
      }
    }
  }

  // PROPOSAL-CAVITY-INTERIOR-VOXELS Phase 2a (v159) — propagate an
  // event-driven chemistry delta to every voxel in the grid.
  //
  // Replaces the pre-v159 mesh.propagateDelta path. Events mutate
  // conditions.fluid (= ring_fluids[equator] via the legacy alias),
  // and conditions.fluid is also aliased to a specific wall cell's
  // fluid via [FIRM] B. Calling propagateEventDelta after an event
  // applies the same (postFluid − preFluid) delta to every other
  // voxel — wall cells (d=0) AND interior voxels (d=1, 2, 3) — so
  // that events affect the whole cavity uniformly (default 'all'
  // target).
  //
  // Without this, post-v158 events would only update d=0 voxels (via
  // the mesh.propagateDelta path); interior voxels would stay at
  // pre-event chemistry, and the new radial diffusion (above) would
  // STEAL the event effect from the wall by mixing it with stale
  // interior fluid. Spreading the delta everywhere preserves the
  // pre-v158 bulk-view semantics for events.
  //
  // Phase 2b+ can introduce spatial event targeting via the optional
  // `target` parameter (e.g. 'top', 'bottom', 'vadose', 'boundary',
  // or a specific (r, c, d) cell). For v159 the default 'all' covers
  // every event handler in the catalog; opting in to spatial
  // targeting is a per-scenario activation that doesn't drift other
  // baselines.
  //
  // The equator wall cell (where conditions.fluid is aliased) is NOT
  // skipped — its fluid object is shared with conditions.fluid only
  // through the ring_fluids[equator] alias, NOT through any wall cell
  // (mesh.cells fluids are independent per-cell clones, Tranche 4a).
  // So all wall cells need the delta applied.
  //
  // Mirrors mesh.propagateDelta's signature for drop-in replacement.
  propagateEventDelta(preFluid: any, fieldNames: string[], postFluid: any, target: string = 'all'): void {
    if (!this.voxels || !this.voxels.length) return;
    if (!preFluid || !fieldNames || !fieldNames.length) return;

    // Pre-compute per-field deltas; ignore unchanged fields.
    const deltas: number[] = [];
    const dirty: string[] = [];
    for (let k = 0; k < fieldNames.length; k++) {
      const fname = fieldNames[k];
      const pre = (typeof preFluid[fname] === 'number') ? preFluid[fname] : 0;
      const post = (postFluid && typeof postFluid[fname] === 'number') ? postFluid[fname] : 0;
      const delta = post - pre;
      if (delta !== 0) {
        deltas.push(delta);
        dirty.push(fname);
      }
    }
    if (!dirty.length) return;

    // Resolve which voxels receive the delta based on target. Default
    // 'all' touches every voxel — preserves pre-v158 bulk-view event
    // semantics. Other targets are stubbed in v159 (boundary, top,
    // bottom, vadose); fully populated when scenario-level spatial
    // targeting lands in Phase 2b.
    const total = this.voxels.length;
    const R = this.ring_count;
    const D = this.depth_count;
    const N = this.cells_per_ring;
    for (let i = 0; i < total; i++) {
      const v = this.voxels[i];
      if (!v || !v.fluid) continue;
      let hit = false;
      switch (target) {
        case 'all':
          hit = true;
          break;
        case 'boundary':
          hit = (v.depthIdx === 0);
          break;
        case 'top':
          hit = (v.ringIdx === R - 1);
          break;
        case 'bottom':
          hit = (v.ringIdx === 0);
          break;
        default:
          // Unrecognized target — fall through to 'all' for safety.
          hit = true;
          break;
      }
      if (!hit) continue;
      const fluid = v.fluid;
      for (let d = 0; d < dirty.length; d++) {
        fluid[dirty[d]] = fluid[dirty[d]] + deltas[d];
      }
    }
  }

  // Back-reference to the wall mesh — retained from v158 as a
  // diagnostic accessor (the v158 delegate path is gone in v159, but
  // tests and probes occasionally need the underlying mesh handle).
  // Set once at construction by fromWallState.
  bindMesh(mesh: any): void {
    this._mesh = mesh;
  }
}
