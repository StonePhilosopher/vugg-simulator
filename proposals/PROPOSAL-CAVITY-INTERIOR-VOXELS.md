# PROPOSAL: Cavity Interior Voxels — 3D fluid tracing inside the vug

**Author:** Claude Opus 4.7 (1M context)
**Date:** 2026-05-27 (updated 2026-05-28)
**Status:** IN PROGRESS — living document. Section markers `[FIRM]` / `[OPEN]` indicate which decisions are settled vs. up for revision.
**Anchor commit:** cabf8ee (v157 — chip reads → mesh.cells)

**Shipping log:**
- **v158** (Phase 1) — data model + accessors + `diffuse()` delegate. Byte-identical.
- **v159** (Phase 2a) — `propagateEventDelta` (events reach interior voxels). Byte-identical.
- **v160** (Phase 2b) — **real per-voxel 3D diffusion** (`_diffuseFull` live, asymmetric stepping per mitigation #2) **+ per-cell nucleation strangulation gate** (`_wallStrangledFor`, Putnis boundary-layer depletion). The coupled geological-behavior change. Baselines drift (regen seed42_v160); growth-side local competition + 3D depletion halos now load-bearing globally; nucleation-side strangulation fires in 4 Pb/Mn-competition scenarios. See js/15-version.ts v160 block for the full drift verification.
- **Phase 3** (visualization — strip-view radial sub-strips, helicoid depth trails) → now **v161+** (the version numbers shifted because Phase 2 split into 2a/2b).
- **Phase 4+** (per-scenario re-tune, density-driven settling, per-voxel-T engine reads) → later.
**Related proposals:** PROPOSAL-CAVITY-MESH.md (wall-side analogue — this is the interior counterpart)
**Skill compatibility:** none yet. Once Phase 1 lands, the `vugg-tune-scenario` skill will likely need updates to teach future agents about voxel-tunable scenarios.

---

## TL;DR

The cavity wall is currently discretized as a mesh of cells (`wall_state.rings[r][c]`, 16×120 per the standard scenario). Each wall cell carries its own fluid composition, mass-balance-debited by engines, diffused locally via `mesh.diffuse`. v157 made this per-cell chemistry visible to chip reads.

**The cavity INTERIOR is not discretized.** It's a single bulk-view fluid (`conditions.fluid`, aliased to `ring_fluids[equator]`). Events mutate this bulk view. The "wall mesh's mesh.cells receive event chemistry uniformly" property we verified in v157 is itself partially aspirational — what's actually happening is the equator wall cells receive event chemistry directly, and inter-cell diffusion propagates it through the wall, but the OPEN SPACE inside the cavity has no spatial chemistry at all.

This proposal voxelizes the interior. Each voxel is a `(ring, cell, depth)` triple matching the wall-mesh address scheme + a radial dimension. Each voxel carries its own fluid composition. Engines couple the wall cell to its adjacent boundary-layer voxel; events optionally target specific spatial zones; diffusion propagates chemistry through the volume.

Three-phase shipping: infra (data model + diffusion, no behavior change) → engine coupling (boundary layer reads + mass balance; baselines drift) → visualization (radial sub-strips, 3D voxel cloud, helicoid depth profiles).

---

## Why now

Three independent conversations recently converged on the same architectural gap:

1. **Multi-condition nucleation envelopes** (boss, 2026-05-27). Per the Clapeyron-slope intuition recorded in HANDOFF-CARBONATE-PHASE-1-COMPLETE.md — nucleation should be a function over (P, T, X) stability fields. To meaningfully vary X across the cavity, the cavity has to HAVE spatial X.

2. **Local competition between crystals** (boss, 2026-05-27). "If there is a big calcite somewhere would it draw other smaller calcites near it or would it strangle competition by sucking out the local chemistry?" Both mechanisms exist in real geology; vugg models the attraction side (heterogeneous nucleation discount via `_pickSubstrate`, CGS via `enclosed_by`) but not the strangulation side (depletion halo). The halo is fundamentally a 3D volume of fluid that's persistently below sigma_crit — and there's no volume to be 3D in until the interior is discretized.

3. **Per-vertex chip selectors** (handoff, original boss request). Strip view's load-bearing prerequisite is "the localized data those accessors return needs to be EXPANDED to reflect how real vuggs work" — fluid stratification, wall-rock diffusion, boundary layers, thermal gradients, pH/redox gradients, evaporation gradients. All of these are 3D phenomena inside the cavity.

All three are blocked on the same missing infrastructure. Building it once unlocks all three.

---

## What's broken without it

The simulator today cannot honestly model:

| Phenomenon | Geological context | Currently |
|---|---|---|
| **Fluid stratification** | Sabkha (hypersaline floor + meteoric ceiling), Coorong-style brines, anoxic basinal stratification | Bulk-view fluid — no vertical chemistry differentiation |
| **Drip plumes** | Cave dripstone (concentrated Ca dripping from ceiling, descending plume of supersaturated fluid) | `zone_chemistry` can pre-load ceiling vs. floor chemistry but it's static — no transport |
| **Thermal convection cells** | Hydrothermal systems, MVT brines, heated pegmatites | Bulk temperature only (`conditions.temperature`); per-ring T exists but no per-voxel T |
| **Boundary-layer depletion** | Every slow-flow vug (most of the catalog) | Mass balance hits the wall cell directly; no boundary-layer fluid to deplete |
| **3D depletion halos** | Single dominant crystals with exclusion zones around them — classic "alpha crystal" textures | Crystals deplete their own wall cell only; no volumetric halo, no strangulation of nearby nucleation |
| **Wallrock chemistry diffusion** | Mg leaching from dolomite host into the cavity, Si enrichment near silicate walls | No mechanism — wall composition is currently a single tag, not a chemistry source |
| **Vertical T gradients (geothermal)** | Cooling-from-above scenarios, geothermal-flux-from-below scenarios | Per-ring T exists but doesn't diffuse vertically |
| **Drip-source point loads** | A ceiling drip locally enriching the floor catchment | No spatial chemistry transport from one cavity location to another |

The strip view's "expand 24 angular sub-strips" feature renders 24 nearly-identical sub-strips today because all 24 angular slots at a given height share the same wall ring chemistry. Until interior voxels exist, the angular dimension is structurally barren of real variation.

---

## The proposal

### [FIRM] Address scheme: spherical voxels matching the wall mesh

Each interior voxel is identified by `(r, c, d)` where:

- `r` ∈ [0, ring_count) — ring index (matches wall mesh)
- `c` ∈ [0, cells_per_ring) — cell index (matches wall mesh)
- `d` ∈ [0, depth_count) — radial depth, where 0 is the wall and depth_count-1 is the cavity center

The voxel at `(r, c, 0)` is the volume IMMEDIATELY ADJACENT to wall cell `(r, c)` — the boundary-layer voxel. The voxel at `(r, c, depth_count-1)` is at the cavity center along the radial line through `(r, c)`.

**Why match the wall mesh address scheme:** the engine path already resolves crystals to (ringIdx, cellIdx) via `wall_state._resolveAnchor`. Adding `d=0` for the adjacent voxel is a single integer lookup. The "boundary layer fluid" becomes `voxels[r][c][0]` with no new resolver needed.

**Voxel geometry:** the (r, c) coordinates pin the angular position on the unit sphere; `d` is the radial offset from the wall inward. Voxel volume scales with `cavity_radius³ × cos(latitude) × depth_factor`. Voxels near the equator are larger than those near the poles, but diffusion math handles this naturally (the Laplacian stencil is volume-weighted).

**Center degeneracy:** all (r, c, depth_count-1) voxels converge on the cavity center. Two options:
  - (a) Treat them as separate voxels with shared boundary (slight redundancy, simple addressing)
  - (b) Collapse the innermost shell to a single "center voxel" (cleaner geometrically, more code)

Phase 1 ships (a) — simpler. Phase 2+ can revisit if it matters.

### [FIRM] Data model: `CavityVoxelGrid`

```typescript
class CavityVoxelGrid {
  ring_count: number;        // matches wall_state.ring_count
  cells_per_ring: number;    // matches wall_state.cells_per_ring
  depth_count: number;       // see [OPEN] below for resolution choice

  // Flat storage: voxels[r * cells_per_ring * depth_count + c * depth_count + d]
  voxels: CavityVoxel[];

  // O(1) lookup
  voxelAt(r: number, c: number, d: number): CavityVoxel;

  // Boundary-layer accessor — the voxel adjacent to wall cell (r, c)
  boundaryVoxel(r: number, c: number): CavityVoxel;

  // Laplacian diffusion across the volume; one step per call
  diffuse(rate: number, fieldNames: string[]): void;

  // Optional: density-driven settling (see [OPEN] D below)
  applyGravitySettling(field: string, settlingRate: number): void;
}

interface CavityVoxel {
  ringIdx: number;
  cellIdx: number;
  depthIdx: number;
  fluid: FluidChemistry;        // mutable, one per voxel
  temperature: number;          // per-voxel T (enables thermal convection)
  volume_mm3: number;           // precomputed at init; used for diffusion weighting
}
```

Storage allocation at sim startup: clone the initial broth into every voxel. Total memory at 16×120×4 (per [FIRM] A) = 7,680 voxels × ~50 fluid fields × 8 bytes = ~3 MB. Negligible.

**Naming the 4 slices (boss-blessed mental model):**

```
   wall                                                       center
    │                                                            │
    ▼                                                            ▼
    ┌────────────┬────────────┬────────────┬────────────────────┐
    │   d=0      │   d=1      │   d=2      │   d=3              │
    │ boundary   │ near-wall  │ interior   │ center             │
    │ layer      │ buffer     │ bulk       │ baseline           │
    └────────────┴────────────┴────────────┴────────────────────┘
   ↑ aliased to wall cell                                       ↑ slowest to equilibrate;
   ↑ engines deposit + deplete here                              "what the cavity was"
```

Consumers wanting finer resolution sample fractional depth `d ∈ [0, 3]` via linear interpolation across adjacent stored slices. See [FIRM] A.

### [FIRM] Diffusion: 6-neighbor Laplacian

Each voxel has up to 6 neighbors:
- Radial: `(r, c, d-1)` and `(r, c, d+1)`
- Latitudinal: `(r-1, c, d)` and `(r+1, c, d)`
- Longitudinal: `(r, c-1, d)` and `(r, c+1, d)` (wraps cyclically in c)

Boundary conditions:
- Radial: Neumann (no flux) at d=0 (wall) and d=depth_count-1 (center)
- Latitudinal: Neumann at r=0 (north pole) and r=ring_count-1 (south pole)
- Longitudinal: cyclic at c=0 ↔ c=cells_per_ring-1

Standard discrete Laplacian: `new[v] = old[v] + rate × sum_over_neighbors(old[n] - old[v])`. Snapshot the old values before any writes (same pattern as `wall_state.mesh.diffuse`).

**Coupling to wall mesh diffusion:** the wall cell `(r, c)` shares chemistry with the boundary voxel `(r, c, 0)`. Two options:

- (a) **Aliased fluid object**: `wall.cells[r*N+c].fluid === voxels[r*N*D + c*D + 0].fluid`. Reads and writes naturally synchronize.
- (b) **Periodic sync**: separate fluid objects, sync at end-of-step.

(a) is cleaner and avoids drift. Ship (a) in Phase 1.

### [FIRM] Engine coupling (Phase 2)

`_runEngineForCrystal` currently swaps `conditions.fluid` to the wall cell's fluid. Post-Phase-2, it would swap to a "boundary fluid view" — either the boundary voxel directly, OR a thin wrapper that averages the wall cell + the boundary voxel.

Mass balance hits the boundary voxel (the fluid that's actually being consumed), which via aliasing is also the wall cell. Diffusion then propagates the depletion radially inward through the voxel column.

**Two open semantic questions** (see [OPEN] section):
- Should the wall cell + boundary voxel be the SAME object (alias) or different objects with periodic sync?
- Should engines see only the boundary voxel, or an averaged "near-wall" view (e.g., boundary + first interior shell)?

### [FIRM] Event coupling (Phase 2)

Events today mutate `conditions.fluid` (= `ring_fluids[equator]`, the bulk view). Post-voxelization, events need to declare their spatial targeting:

| Event type | Default target |
|---|---|
| Bulk thermal pulse (cooling, heating) | All voxels uniformly |
| Bulk chemistry shift (CO2 degas, salinity drop) | All voxels uniformly |
| Drip event (concentrated Ca from above) | Top ring voxels only |
| Evaporation pulse | Vadose-zone voxels (above water level) |
| Wallrock dissolution flush | Boundary voxels only |
| Sealed-cavity diagenesis | All voxels uniformly |

The simplest API: event handlers accept an optional `target: 'all' | 'top' | 'bottom' | 'vadose' | 'boundary' | { r: int, c: int, d: int }` parameter; default `'all'` preserves current behavior. Existing event handlers stay unchanged; new ones can opt into spatial targeting.

---

## Performance budget

### Diffusion cost per step

| Resolution | Voxels | Ops per chip per step | 50 chips | Wall-clock per step (~100M ops/sec) |
|---|---|---|---|---|
| 16 × 120 × 16 | 30,720 | 184k | 9.2M | ~92 ms |
| 16 × 120 × 8 | 15,360 | 92k | 4.6M | ~46 ms |
| **16 × 120 × 4 (chosen — see [FIRM] A below)** | **7,680** | **46k** | **2.3M** | **~23 ms** |
| 8 × 60 × 4 (coarse if 4-slice is still too slow) | 1,920 | 12k | 580k | ~6 ms |

**Decision (2026-05-27):** ship Phase 1 at 4 radial slices. Boss direction: *"a coarser radial axis is perfect. if you want steps in the middle they can just average."* The 4-tier slice scheme (boundary / near-wall / interior / center) has clean geological semantics; consumers that need higher resolution average between adjacent slices on the read path (mirrors the strip recorder's 120→24 angular downsample pattern). See [FIRM] A in the open-questions section for the full rationale.

**Target: under 20 ms per step.** Roughly the existing per-step cost budget; doubling it is acceptable but going much higher would slow scenario runs noticeably (200-step run goes from ~6s to ~10s+). The 4-slice resolution lands ~23 ms naive — just over target. Two mitigations available if that's still too slow:

1. **Sparse diffusion.** Maintain a "dirty voxel" set; only diffuse voxels adjacent to a recently-changed voxel. Most voxels in most scenarios sit at equilibrium most of the time — sparse diffusion would only touch ~5-15% of voxels per step in typical runs. Cuts cost to ~3-5 ms in steady state.

2. **Asymmetric stepping.** Boundary-shell diffusion every step (where engines hit); interior-shell diffusion every N steps (it's slower in reality anyway). E.g., d=0,1 diffuse every step; d=2,3 every 5 steps. Cuts cost to ~10 ms.

**Recommendation:** ship Phase 1 with naive Laplacian + 4 slices. If `npm test` slows past comfort, add sparse diffusion as a second-pass optimization.

### Memory

At 30,720 voxels × ~50 chips × 8 bytes = ~12 MB. Negligible by modern standards. Memory is not a constraint.

---

## Phasing

### Phase 1 — Voxel store + diffusion infra (v158)

**What ships:**
- `js/24-geometry-voxel-grid.ts` — new `CavityVoxelGrid` class + `CavityVoxel` interface
- VugSimulator constructor allocates the grid, aliases wall cells to depth=0 voxels
- New per-step diffusion call: `voxelGrid.diffuse(rate, fieldNames)` runs after wall diffusion
- New accessors: `sim.voxelAt(r, c, d)`, `sim.boundaryVoxel(r, c)`, `sim.fluidAtVoxel(r, c, d)`
- Tests: data model integrity, diffusion symmetry, alias correctness, cycle/Neumann boundary correctness

**What does NOT ship:**
- No engine reads from voxels (engines still read from wall cells, which ARE the boundary voxels via aliasing — so this works without changes)
- No event-targeting semantics (events still mutate bulk view)
- No visualization changes
- No baseline drift (because the alias means wall reads return the same fluid objects as before — same chemistry, same crystal results)

**Risk:** very low. Pure infra commit. Tests verify the data model; sim baselines byte-identical to v157.

**SIM_VERSION bump:** v158. Baseline regen produces byte-identical output.

### Phase 2 — Engine + event coupling (v159+)

**What ships:**
- Engine path updated: `_runEngineForCrystal` debits both the wall cell AND propagates the depletion radially via mass balance + diffusion
- Event-targeting API: event handlers can declare `target` spatial scope
- A few canonical scenarios updated to use spatial targeting (cave drip → top ring voxels, sabkha evap → vadose voxels, etc.)
- Per-mineral nucleation gates rewired to sample the boundary voxel (NOT the bulk view) — this is the "local competition / depletion halo strangulation" mechanism becoming load-bearing

**What does NOT ship:**
- Full scenario re-tune. Each scenario will need a calibration pass against the new spatial physics; that's a follow-up arc per scenario.

**Risk:** medium-high. Engine path changes; baselines drift across most scenarios. Each drift needs verification that it's geologically defensible (the W9–W12 carbonate-promotion pattern: drift is OK if it's toward the science, not away).

**SIM_VERSION bump:** v159 (engine coupling). Baseline drift expected across all event-heavy scenarios. Mineral firings will shift; some currently-firing minerals may no longer fire (strangulation suppresses them); some currently-not-firing minerals may start (stratification puts them in the right local chemistry).

### Phase 3 — Visualization (v160+)

**What ships:**
- Strip view: radial sub-strip expansion (parallels the existing angular sub-strip expansion). Each (time, angle, height) cell expands into N radial sub-strips on click.
- Helicoid trails: optional "depth profile" overlay — instead of one trail per chip at the wall, render N trails at evenly-spaced depths.
- 3D voxel-cloud rendering option in the main 3D view (small Three.js voxel mesh colored by a selected chip value, optional toggle).
- `_HELIX_CHEM_PARAMS` chip reads extended to take an optional `depth` arg (default 0 = wall, matches current behavior).

**Risk:** low. Renderer-only; chemistry unchanged. Baseline byte-identical.

**SIM_VERSION bump:** v160. Renderer-only; baseline byte-identical to v159.

### Phase 4+ — Scenario re-tune (v161+, ongoing)

Each scenario re-anchored against the spatial physics. Per-scenario commits. Phase 1c-style: pick the highest-leverage scenario first, work through the catalog. Some Phase 1c rejections may need to be revisited under the new model.

---

## What this enables

Direct unlocks once Phase 2 ships:

- **Local competition / depletion halos** — fast-growing crystals carve out 3D volumes of fluid below sigma_crit, suppressing nearby nucleation. Strangulation mechanism becomes load-bearing.
- **Fluid stratification** — events that target floor / vadose voxels can establish persistent gradients without `zone_chemistry` boilerplate.
- **Drip plumes** — top-ring events seed downward propagation via diffusion + (eventually) gravity-driven advection.
- **Thermal convection** — per-voxel T enables Rayleigh-Bénard-style cells if a buoyancy term is added (Phase 4+).
- **Geologically-honest per-vertex chip selectors** — strip view's 24 angular sub-strips × 16 heights become spatially meaningful because the underlying chemistry actually varies across them.

Indirect unlocks (Phase 3+):

- **3D crystal-cavity rendering with chemistry overlays** — see at a glance where the depletion halo around a crystal sits.
- **Strip view radial sub-strips** — full 4D recording (time × ring × angle × depth × chips).
- **Multi-condition nucleation envelopes** — the (P, T, X) stability-field architecture (per the handoff) becomes implementable because X actually varies across the cavity.
- **Helicoid-as-recorder 4D potential** — the boss's "tower of math" framing becomes literal: 3D space × 1D time = 4D dataset.

Compatibility with existing arcs:

- **Crystal cipher** (`PROPOSAL-CRYSTAL-CIPHER.md`) — recipe URLs gain a depth coordinate. The strip view corpus expands from (steps × angles × heights) to (steps × angles × heights × depths) — same procedural-compression argument, more data per recipe.
- **Real crystal lattices arc** — per-voxel chemistry feeds into per-crystal lattice substitution decisions naturally.
- **Pitzer-HMW84 activity model** (Phase 2 carbonate refinement) — per-voxel activity calculations become possible, enabling true spatial activity gradients in high-I brines.

---

## What this does NOT solve

Explicit scope boundaries:

- **Not full Navier-Stokes.** No momentum equations, no pressure-velocity coupling. Just diffusion + (optional, Phase 4+) gravity-driven settling + (optional, Phase 4+) thermal buoyancy. The cavity is "stirred" only insofar as Laplacian diffusion + bulk events do the work.
- **Not non-Newtonian flow.** No particle entrainment, no slurries, no debris transport.
- **Not wall erosion as a function of fluid velocity.** Wall dissolution stays governed by chemistry (existing engine path), not by hydrodynamics.
- **Not advection of dissolved chemistry by bulk flow.** If a scenario wants "fluid flushed through the cavity," that's still modeled as an event (replace fluid composition over time) rather than as fluid-velocity-driven transport.

These are all addable later if a scenario demands them. None are foundational; this proposal lays the groundwork that future flow physics could build on.

---

## Open questions

### [FIRM] A. Radial resolution — 4 slices, average on demand

**Decision (2026-05-27, boss):** ship Phase 1 with **4 radial slices**. Consumers that need finer resolution average from adjacent slices.

**Why 4 specifically:** each slice has a clean physical interpretation that maps to a real fluid regime:

| Slice | Physical interpretation | What happens here |
|---|---|---|
| `d=0` | **Boundary layer** | Where crystals deposit + deplete mass directly. Aliased to the wall cell. |
| `d=1` | **Near-wall** | Diffusion buffer between wall-driven chemistry and the cavity interior. The depletion halo lives mostly here. |
| `d=2` | **Interior** | Bulk cavity volume. Receives event chemistry; sources fresh fluid back toward the wall via diffusion. |
| `d=3` | **Center** | Gradient-far from any wall. Slowest to equilibrate; baseline reference for "what is the cavity fluid still saturated with." |

This is a 4-tier mental model that maps cleanly to how geologists think about cavity-fluid spatial structure (boundary layer / mass-transfer zone / bulk fluid / unaffected core).

**Averaging-on-demand pattern (for consumers that want finer resolution):** parallels the strip recorder's existing 120→24 cell downsampling. Any consumer that needs N > 4 slices linearly interpolates between adjacent stored slices:

```typescript
// Sample at any fractional depth d ∈ [0, 3] by linear interpolation
function sampleVoxelFluid(r: number, c: number, depth: number, field: string): number {
  const d0 = Math.floor(depth);
  const d1 = Math.min(d0 + 1, 3);
  const t = depth - d0;
  const a = voxelAt(r, c, d0).fluid[field];
  const b = voxelAt(r, c, d1).fluid[field];
  return a * (1 - t) + b * t;
}
```

This means strip view's hypothetical "expand 8 radial sub-strips" works against a 4-slice store by sampling at d = 0, 0.43, 0.86, 1.29, ..., 3.0. Visualization-only consumers can fake any resolution they want. Engines + diffusion only deal with the 4 stored slices.

**Performance after this decision (4 slices):**

| Stage | Cost per step |
|---|---|
| Voxel count | 16 × 120 × 4 = 7,680 |
| Diffusion ops per chip | ~46k |
| Diffusion ops × 50 chips | ~2.3M |
| Wall-clock (~100M ops/sec naive) | ~23 ms |

Well under the 20-ms-ish target if we want it; comfortably under any reasonable budget. Sparse diffusion (mitigation #2 in the performance section) would drop it further if scenarios get pathological.

**Memory after this decision:** 7,680 voxels × ~50 fields × 8 bytes = ~3 MB. Negligible.

### [FIRM] B. Wall cell ↔ boundary voxel: ALIAS

**Decision (2026-05-27, boss):** alias. `wall.cells[r*N+c].fluid === voxelGrid.voxelAt(r, c, 0).fluid` — same object, two access paths. Matches the existing `ring_fluids[equator] === conditions.fluid` pattern; no drift between stores. Phase 1 constructor handles the aliasing at voxel-grid allocation time (wall mesh built first, voxel grid reuses the existing wall cell fluid objects for the d=0 slab).

### [FIRM] C. Engine boundary-layer view: SINGLE VOXEL (d=0)

**Decision (2026-05-27, boss):** engines see only the boundary voxel `(r, c, 0)`. Simpler, most physically correct for thin boundary layers. v159 ships with this; revisit only if specific scenarios surface pathological behavior. Consumers wanting a near-wall average can compose via `sampleVoxelFluid(r, c, 0.5, field)` per the averaging-on-demand pattern.

### [FIRM] D. Density-driven settling: DEFER to v162+

**Decision (2026-05-27, boss):** defer. Phase 1 (v158) ships data model + diffusion. Phase 2 (v159) ships engine + event coupling, diffusion-only. Phase 3 (v160) ships visualization. Phase 4 (v161+) re-tunes scenarios. Density-driven settling is a v162-ish enhancement once the basic infrastructure is proven and we have a concrete scenario that needs emergent stratification rather than event-targeted stratification. Until then, scenarios that want stratification use the Phase 2 event-targeting API (`target: 'bottom'` for floor-loaded events, etc.).

### [FIRM] E. Per-voxel temperature: YES from v158

**Decision (2026-05-27, boss):** per-voxel temperature in Phase 1. Small additional storage (~1 float per voxel × 7,680 voxels × 8 bytes = ~60 KB). Initial value = bulk temperature. v158 stores it but doesn't consume it (engines still read `ring_temperatures[]` for now). Phase 2 wires engines to read per-voxel T. Phase 4 (v161+) adds thermal convection on top without architectural surgery — the per-voxel T storage is already there.

### [FIRM] F. Replay snapshot capture: v160 (visualization phase)

**Decision (2026-05-27, boss):** defer to Phase 3 visualization. Phase 1 + 2 ship without voxel snapshot capture; replay shows wall-cell chemistry only via the existing snap path. When per-voxel rendering lands in v160, extend the snapshot schema to capture voxel chemistry too. At 4 radial slices, the snapshot growth is only 4× (modest); lossy options (lower temporal resolution, fewer chips, decimated radial axis) available if needed.

### [FIRM] G. `zone_chemistry` semantics: KEEP PER-RING

**Decision (2026-05-27, boss):** keep per-ring. Boundary voxels at that ring inherit the override (via alias); interior voxels (d=1,2,3) at that ring start at bulk. Per-voxel zone overrides are deferred to Phase 4+ if a scenario explicitly needs them (e.g., "inner shell at the top is meteoric, outer shell at the top is connate" — niche but possible). Existing `zoned_dripstone_cave` semantics preserved.

### [FIRM] H. `_diffuseRingState` → voxel diffusion: MERGE

**Decision (2026-05-27, boss):** merge. Voxel diffusion becomes the canonical path. Phase 1 introduces `voxelGrid.diffuse(rate, fieldNames)` which covers ALL slabs including d=0 (which IS the wall via aliasing); `_diffuseRingState` gets refactored to call voxel diffusion instead of `mesh.diffuse`. For v158 byte-identity: radial-coupling rate is 0 in v158 (each slab diffuses 2D in its own plane; d=0 produces identical wall-cell deltas to today's mesh.diffuse; d=1,2,3 stay uniform so their Laplacians are zero). Phase 2 turns on radial coupling at the same time it wires events/engines into the interior slabs.

---

## Geological motivations (the "follow the science" anchor)

Real cavity fluid behavior the simulator currently can't reach:

**Sabkha-style hypersaline stratification** (Borch 1979 Coorong; Raudsepp et al. 2022). Hypersaline brine (density ~1.2 g/cm³) settles on the floor; meteoric overpour (density ~1.0) floats on top. The mixing zone in between is where Mg-rich + Ca-rich fluids meet and dolomite precipitates. Post-voxelization, this stratification is emergent from density-driven settling (Phase 4) OR explicit event-targeted writes (Phase 2).

**Cave dripstone drip plumes** (Hill & Forti 1997 Cave Minerals of the World, §3.1). A drop hitting the floor delivers a localized punch of supersaturated Ca; the descending plume from drip-source ceiling is concentrated relative to the cavity atmosphere. Speleothem texture variations (smooth flowstone vs. ropy cave-popcorn vs. stalactite-stalagmite pairs) are spatial-chemistry signatures. Post-voxelization, the drip event targets the top ring voxels; diffusion propagates the Ca pulse downward through the column.

**MVT brine mixing** (Leach et al. 2010, Treatise on Geochemistry; Garven 1985 Am. J. Sci.). Basinal brines (saline, hot, reducing) mix with meteoric water (dilute, cool, oxidized) at the cavity margin. The mixing zone is where SO₄ + H₂S meet and barite + galena precipitate. Spatial heterogeneity at the cavity scale is the geological diagnostic. Post-voxelization, the mixing happens naturally as one fluid source enters from one direction and another from another.

**Hydrothermal convection cells** (Hayba & Ingebritsen 1997, USGS Bulletin 2155). Heated cavities develop Rayleigh-Bénard convection — fluid rises in the center, falls along the cooler walls. Mineral zonation around a hot intrusion is the spatial signature. Post-voxelization with Phase 4 buoyancy, this is emergent.

**Boundary-layer depletion around dominant crystals** (Putnis 2009 Reviews in Mineralogy v70, §5). Fast-growing crystals develop a stagnant boundary layer where local σ drops below the threshold for new nucleation. Single-crystal druzes with bare exclusion zones around the dominant crystal are this signature. Post-voxelization, this is automatic — depleting the boundary voxel propagates to nearby voxels via diffusion, lowering nucleation rate in the volumetric halo.

**Competitive Growth Selection at the crystal-aggregate scale** (Bryan 1957 Acta Crystallographica; Buchwald 1977 Handbook of Iron Meteorites). Vugg already models CGS via the `enclosed_by` mechanism (geometric pinning). Post-voxelization, the chemistry side of CGS (the favored crystals get more local chemistry because they're the closest to fresh fluid) becomes naturally modeled too.

---

## Citation hygiene flag

Per the v141+ pastiche-detection discipline, before any citation in this proposal lands in production code:

- **Borch 1979 / Raudsepp 2022** — already cited in HANDOFF-CARBONATE-PHASE-1-COMPLETE.md for Coorong dolomite. Treat as verified.
- **Hill & Forti 1997** — cited in BUG-aragonite-twin-cave-morphology.md. The §3.1 / §5.3.4 / §10 section references in that BUG doc were flagged as confident-from-past-reading-but-not-freshly-verified. Same flag applies here; verify before any code commit cites them.
- **Leach et al. 2010 Treatise** — real publication on MVT formation; I have linked memory of it being a Treatise on Geochemistry chapter but should verify volume + chapter before citing in production.
- **Garven 1985** — real Am. J. Sci. paper on basinal brine flow; chapter on Pine Point MVT. Confident-but-verify.
- **Hayba & Ingebritsen 1997** — real USGS Bulletin on hydrothermal modeling. Confident-but-verify volume.
- **Putnis 2009 Reviews in Mineralogy v70** — real monograph "Mineral Replacement Reactions." Confident; §5 on heterogeneous nucleation barriers is well-established crystallization-theory chapter.
- **Bryan 1957 Acta Crystallographica** — real CGS paper on geometric selection in cavity-fill druses. Confident.
- **Buchwald 1977 Handbook of Iron Meteorites** — real reference work covering CGS in metallurgical contexts. Confident.

All of these need full verification (volume, page, exact title) before being cited in source-code comments or commit messages.

---

## Sequencing relative to other arcs

| Arc | Where this proposal sits |
|---|---|
| **Phase 1c carbonate cleanup** | Aragonite wireframe parity (only real item left) is independent and orthogonal — can ship before or after Phase 1 voxels. |
| **Pitzer-HMW84 activity model** (Phase 2 carbonate) | Independent of voxels but composes well — Pitzer per-voxel activity gives true spatial activity gradients. Probably wants voxels in place before Pitzer lands. |
| **Real crystal lattices arc** | Independent of voxels. Composes naturally (per-voxel chemistry feeds per-crystal lattice substitution decisions). |
| **Multi-condition nucleation envelopes** | DEPENDS on voxels. Without spatial X, the (P, T, X) stability fields can't vary across the cavity. |
| **Local competition / depletion halos** | DEPENDS on voxels. Halo is a 3D object. |
| **Strip view per-vertex spatial chemistry** | DEPENDS on voxels. Without them, all 24 angular sub-strips at a height share the same chemistry. |
| **Crystal cipher Phase 0** (recipe URL infra) | Independent. Compose naturally — voxel addressing extends the recipe URL scheme. |
| **Helicoid-as-recorder 4D potential** | Independent until Phase 3 voxel visualization. |

**Suggested sequencing:** finish Phase 1c (aragonite wireframe parity) → Phase 1 voxels (infra) → choose Phase 2 voxels OR Pitzer based on which feels more pressing. Phase 3 voxels (visualization) is a natural sibling to any of the helicoid / strip view enhancements.

---

## The conversation that produced this proposal

Recording the dialogue lineage so a future agent can reconstruct the reasoning:

1. **v157 chip rewire** revealed that per-cell chemistry was being computed but invisible to the strip view. Boss saw the equator-pyramid artifact and asked "what's going on in the middle of this graph?" — the question that launched the rewire.

2. **Local competition discussion** (post-v157). Boss asked: "if there is a big calcite somewhere would it draw other smaller calcites near it or would it strangle competition by sucking out the local chemistry?" Discussion of attraction (heterogeneous nucleation + CGS) vs. strangulation (depletion halo). Surfaced that vugg models attraction today but not strangulation — and that strangulation needs the halo to be a 3D volume, which needs interior voxels.

3. **The boss's pivot** to this proposal: "can we get something like the per cell subdivision for the open space of the vugg? that seems like the first step for tracing fluids in the vugg." Recognized as the load-bearing architectural unlock that connects multiple pending arcs.

4. **Proposal framing**: "start with the proposal, its a living document that makes handoff easier." Boss's explicit endorsement of the proposal-doc workflow as a hand-off artifact rather than a planning ritual.

The throughline: the boss kept noticing the same architectural gap from different angles (multi-condition envelopes → local competition → per-vertex chips → fluid tracing). Building the interior voxel infrastructure resolves all four in a single foundational arc.

---

## Next steps

1. **Read this proposal end-to-end + react.** Sections marked [OPEN] are explicit questions for the boss — answer them or flag deferrals.
2. **Pick Phase 1 resolution.** Default recommendation: 8 radial slices. Open to changing based on perf intuition or geological need.
3. **Implementation begins with `js/24-geometry-voxel-grid.ts`** (new file) — pure data structure + diffusion + tests. No engine wiring. Should land as v158 with a byte-identical baseline.
4. **Iterate on this doc.** Living document — when implementation surfaces something the proposal got wrong, edit the proposal in the same commit that fixes the code. The doc + the code stay in sync.

— Claude Opus 4.7
