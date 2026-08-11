# PROPOSAL: Marching-Cubes Cavity Surfaces

> **Status:** Tranches 0 and 1 implemented locally as a default-off shadow
> renderer; reviewed promotion gates remain open. No gameplay, chemistry,
> anchor, clipping, or save-format authority has moved to the Cartesian field.
> The AI “Dr. Michael Wise” hostile-review role returned `SATISFIED` after four
> correction rounds; this is not a claim of review by the real scientist.
> **Authored:** 2026-08-10 after reviewing the current `WallState`, `WallMesh`,
> `CavityVoxelGrid`, and Three.js cavity-clip paths.
> **Primary goal:** Let Vugg Simulator represent genuinely three-dimensional
> cavity walls—undercuts, throats, joined chambers, re-entrant dissolution, and
> local erosion—without replacing the explicit crystallographic meshes.
> **First safe deliverable:** A renderer-only, feature-flagged comparison that
> extracts a cavity mesh from the existing `wall.bubbles` field and leaves all
> simulation state and calibration untouched.

---

## 1. Executive decision

Use Marching Cubes for the **cavity/matrix surface and massive deposits**, not
for individual euhedral crystals.

The current cavity starts from a real 3D union of spheres in
`js/22-geometry-wall.ts::_buildProfile3D`, but that union is reduced to one
radius per `(ring, cell)` direction. `WallMesh` then triangulates those radial
samples as a lat-long shell. This is compact and works well for star-shaped
vugs, but it cannot retain a surface that crosses one ray more than once.

Marching Cubes should instead extract the zero set of a Cartesian scalar field
that directly describes the void/rock boundary. This adds topology, not just
polygon density:

- overhangs and undercuts;
- narrow necks between joined pockets;
- branching or fracture-fed voids;
- re-entrant dissolution pockets;
- internal pillars and isolated components;
- locally accumulated erosion and massive mineral fill.

Keep the hand-built quartz, calcite, fluorite, twin, Wulff, and other habit
geometries in `js/99i-renderer-three.ts`. Marching Cubes would round their
crystallographic faces and erase the exact morphology that the simulator has
worked to preserve.

---

## 2. Current architecture and the actual seam to use

### Geometry

- `js/22-geometry-wall.ts`
  - `WallState._buildProfile3D()` creates the central, secondary, and tertiary
    cavity spheres.
  - `wall.bubbles` retains the rescaled sphere set as `[cx, cy, cz, radius]`.
  - The builder raycasts each `(ring, cell)` direction through the union and
    stores only `base_radius_mm`.
- `js/23-geometry-wall-mesh.ts`
  - `WallMesh.fromWallState()` creates the current lat-long topology.
  - `WallMesh.recompute()` emits `positions`, `colors`, `normals`, `uvs`, and
    `indices` consumed by the renderer.
  - `mesh.cells[]` is live simulation/chemistry storage. It must not silently
    be replaced by a different vertex count in the first tranche.
- `js/99i-renderer-three.ts`
  - `_topoBuildCavityGeometry()` turns the engine-side buffers into a
    `THREE.BufferGeometry`.
  - `_applyCavityClip()` clips crystals against a polar 2D radius texture.

### Chemistry volume

- `js/24-geometry-voxel-grid.ts::CavityVoxelGrid` is a spherical
  `(ring, cell, depth)` chemistry/temperature store.
- It has four radial depth slabs and is deliberately aligned to wall cells.
- It is **not** a Cartesian geometry volume and cannot be passed directly to
  standard Marching Cubes.

The safest seam is therefore a new geometry-only scalar volume alongside the
existing chemistry grid. Do not make the chemistry grid Cartesian as part of
the first implementation.

---

## 3. Proposed data model

Add two script-mode TypeScript modules after `23-geometry-wall-mesh.ts` and
before the existing `24-*` modules:

```text
js/23a-geometry-cavity-field.ts
js/23b-geometry-marching-cubes.ts
```

Suggested interfaces:

```ts
interface CavitySurfaceBuffers {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint16Array | Uint32Array;
  // Optional in the first tranche. Prefer triplanar wall textures later.
  uvs?: Float32Array;
  sig: string;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
}

class CavityScalarField {
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  spacingMm: number;
  origin: [number, number, number];
  values: Float32Array;
  sig: string;

  static fromWallState(wall: any): CavityScalarField;
  index(x: number, y: number, z: number): number;
  worldPosition(x: number, y: number, z: number): [number, number, number];
  sampleWorld(x: number, y: number, z: number): number;
  gradientWorld(x: number, y: number, z: number): [number, number, number];
  extract(isovalue?: number): CavitySurfaceBuffers;
}
```

`WallState` may eventually own a lazy cached accessor, parallel to `meshFor()`
and `voxelGridFor()`:

```ts
cavityFieldFor(sim?)
cavitySurfaceFor(sim?)
```

Cache against inputs the field actually samples: field resolution, base
geometry/architecture parameters, and—when implemented—the scalar primitive
ledger revision. Keep polar `wall_depth` invalidation separate while it is not
part of the scalar oracle. Cache rejected extraction signatures as well as
successful surfaces; never retry either every animation frame.

---

## 4. Scalar-field convention

Use one sign convention everywhere:

```text
field > 0  => open cavity / fluid space
field = 0  => cavity wall
field < 0  => host rock
```

For the existing bubble union:

```ts
function sphereVoidField(
  x: number, y: number, z: number,
  cx: number, cy: number, cz: number,
  radius: number,
): number {
  const dx = x - cx;
  const dy = y - cy;
  const dz = z - cz;
  return radius - Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function bubbleUnionField(wall: any, x: number, y: number, z: number): number {
  let value = -Infinity;
  for (const [cx, cy, cz, radius] of wall.bubbles) {
    value = Math.max(value, sphereVoidField(x, y, z, cx, cy, cz, radius));
  }
  return value;
}
```

That exact maximum reproduces the mathematical union. A polynomial smooth
maximum may be offered as an authored presentation/geology control:

```ts
function smoothMax(a: number, b: number, blendMm: number): number {
  if (!(blendMm > 0)) return Math.max(a, b);
  const h = Math.max(blendMm - Math.abs(a - b), 0) / blendMm;
  return Math.max(a, b) + h * h * blendMm * 0.25;
}
```

Keep exact union as the initial/default behavior so the prototype has a clear
oracle. Do not add a Creative-mode smoothing slider in the first tranche.

Architecture masks can be composed later using positive-inside constructive
solid geometry:

- union of voids: `max(a, b)`;
- intersection: `min(a, b)`;
- subtract a solid/deposit from void: `min(voidField, -depositField)`;
- expand by a dissolution stamp: `max(voidField, erosionField)`.

For example, a cleft can intersect the bubble union with a positive-inside
slab field. A feeder channel can union a capsule/cylinder field into the void.

---

## 5. Extraction requirements

The Marching Cubes implementation should:

1. Sample scalar values at Cartesian grid corners.
2. Build the standard 8-bit cube case from the `field > isovalue` test.
3. Interpolate edge crossings using the actual values:

   ```ts
   t = (isovalue - valueA) / (valueB - valueA)
   p = pA + t * (pB - pA)
   ```

4. Deduplicate vertices by a canonical **global grid-edge key**. Do not emit
   three unrelated vertices per triangle; the renderer, normals, wireframe,
   and memory footprint all benefit from indexed geometry.
5. Produce deterministic buffers for a given field and isovalue.
6. Select `Uint16Array` or `Uint32Array` from the final vertex count.
7. Use a consistent ambiguity policy. Classic lookup tables are acceptable
   for the first exact-union prototype, but ambiguous faces must not create
   cracks. An asymptotic decider or MC33-style resolution is the production
   target if topology tests expose inconsistent connections.
8. Reject non-finite samples and degenerate zero-area triangles.

### Normals

Derive smooth normals from central differences in the scalar field, not only
from triangle averaging:

```ts
gradient = [
  F(x + h, y, z) - F(x - h, y, z),
  F(x, y + h, z) - F(x, y - h, z),
  F(x, y, z + h) - F(x, y, z - h),
];
```

With the positive-inside convention, `gradient` points toward increasing void
values—generally inward. The host-rock-facing normal is therefore
`-normalize(gradient)`. Verify winding once against the renderer's current
`THREE.BackSide` cavity material; do not compensate independently in both the
extractor and renderer.

### Textures

Arbitrary re-entrant surfaces do not have a clean lat-long UV map. For the
prototype, spherical UVs are acceptable because the existing cases remain
near-radial. Before enabling non-star-shaped topology by default, migrate the
matrix skin and relief textures to world-space triplanar mapping or another
seam-resistant projection.

Do not block the geometry prototype on the final texture projection.

---

## 6. Resolution and bounds

Start with a cubic `48^3` field behind a feature flag. Also test `64^3`, but do
not make it the default without measurements.

Derive bounds from the bubble union, not just `initial_radius_mm`:

```text
minAxis = min(centerAxis - radius)
maxAxis = max(centerAxis + radius)
padding = max(2 * spacingMm, 0.05 * largestExtent)
```

The outermost grid layer must remain rock-negative on every face; otherwise
Marching Cubes can emit an open surface at the volume boundary.

The user-authored physical size ranges from millimeter vugs to meter caves, so
resolution needs two meanings:

- **prototype/render fidelity:** fixed samples per largest dimension;
- **future physical erosion fidelity:** authored or derived `spacingMm` with a
  hard memory/triangle cap.

Do not silently allocate a millimeter-resolution grid for a three-meter cave.

Suggested first performance budgets, to be replaced by measurements:

- no work on frames where the field signature is unchanged;
- one scalar-field build plus extraction should remain interactive on a normal
  desktop at `48^3`;
- cached field storage should be one `Float32Array`;
- later live erosion should dirty/rebuild chunks rather than the whole volume.

Run extraction on the main thread initially. A Web Worker is justified only
after a measured pause, because the current script concatenation/build system
and deterministic test harness are simpler without worker synchronization.

---

## 7. Migration tranches

### Tranche 0 — tests and field math only

Add `CavityScalarField.fromWallState()` plus sampling tests. No renderer or
simulation changes.

Acceptance:

- the center of the primary bubble is positive;
- a point beyond every bubble is negative;
- every authored bubble center is positive;
- exact-union values match a direct oracle;
- bounds have a complete negative border;
- the same wall seed produces byte-identical field values.

### Tranche 1 — renderer-only shadow surface

Extract an MC surface from the existing `wall.bubbles` field. Keep:

- `WallMesh.cells[]` as the canonical chemistry/wall-cell store;
- all `(ringIdx, cellIdx)` anchors;
- all simulation behavior;
- the current cavity mesh as the default.

Add a development flag that lets `_topoBuildCavityGeometry()` choose the MC
surface buffers. This flag must default off and must not appear as a geological
Creative-mode control.

This tranche exists to compare silhouette, normals, pole behavior, UVs,
triangle count, and performance. It is not authorization to regenerate science
or calibration baselines.

### Tranche 2 — production surface adapter

Once the visual comparison passes, define one renderer-facing buffer contract
so `_topoBuildCavityGeometry()` does not care whether the source is current
lat-long `WallMesh` or an extracted field.

Preserve color semantics:

- floor/wall/ceiling matrix palette;
- submerged/vadose tint;
- wall relief family and lithology skin;
- sharp/smooth render mode.

The simulation mesh and render surface may coexist temporarily, but name them
explicitly to prevent accidental use of render vertices as chemistry cells.

### Tranche 3 — exact scalar-field crystal clipping

The current shader clips against `uVugCellRadii`, a 2D polar radius texture.
That representation cannot describe an undercut. Replace or supplement it with
the same 3D scalar field used for extraction:

```glsl
if (sampleCavityField(vCavityWorldPos) < 0.0) discard;
```

The vendored Three.js build includes `Data3DTexture` and the renderer requires
WebGL2, so a 3D texture is available in principle. Verify float or half-float
sampling support and filtering behavior in the actual browser path before
committing to the final format. An `UnsignedByte` normalized signed-distance
encoding is a fallback if float filtering is problematic.

The CPU field and GPU texture must share bounds, axis order, sign, isovalue,
and normalization. Add a single transform helper; do not duplicate the mapping
in ad hoc JavaScript and GLSL formulas.

Only after this tranche may production shapes rely on non-star-shaped regions,
because the visible wall and clipped crystals will finally agree everywhere.

### Tranche 4 — topology-independent anchors

Current `{ringIdx, cellIdx}` anchors cannot identify an arbitrary overhang.
Introduce a new anchor representation while keeping a compatibility mapping:

```ts
interface SurfaceAnchor {
  position: [number, number, number];
  normal: [number, number, number];
  triangleIndex: number;
  barycentric: [number, number, number];
  // Optional source-field cell for stable remapping after re-extraction.
  fieldCell?: [number, number, number];
}
```

Prefer position plus source-field identity as truth. Triangle indices alone are
not stable when the field changes and the surface is re-extracted.

Required consumers include:

- crystal nucleation placement;
- `paintCrystal`/local occupancy;
- surface orientation and habit bias;
- hit testing and tooltips;
- crystal mesh transforms;
- replay snapshots;
- local chemistry lookup.

This is the largest behavioral migration. It should have its own proposal or
explicitly extend `PROPOSAL-CAVITY-MESH.md`; do not hide it inside a rendering
commit.

### Tranche 5 — evolving geology

With rendering, clipping, and anchors sharing one field, add geological field
mutations one mechanism at a time:

- localized acid dissolution stamps;
- feeder-channel/capsule erosion;
- dissolution enlarged by wall reactivity/porosity and local fluid state;
- massive or botryoidal deposits that reduce void space;
- flowstone/film offsets;
- connected-cavity and throat archetypes.

Each mechanism needs mass/chemistry bookkeeping independent from the visual
field operation. A positive erosion stamp is not by itself proof of conserved
wall loss or ion release.

---

## 8. Relationship to existing dissolution and chemistry

The initial Marching Cubes work is render-only. It must not alter:

- `VugWall.dissolve()` rates or released species;
- `WallCell.wall_depth` calibration;
- `CavityVoxelGrid` diffusion;
- per-cell supersaturation and growth budgets;
- scenario baselines or RNG consumption.

When localized erosion becomes simulation-active, define a ledger such as:

```text
field volume changed
  -> host-rock volume removed
  -> mass/formula extent removed
  -> Ca/Mg/CO3/etc. released according to wall composition
  -> affected geometry revision incremented
```

The scalar-field volume change can be estimated from changed cell occupancy or
a narrow-band fraction, but its units must be calibrated against physical mm
and the existing wall-loss ledger. Do not debit ions from triangle count or
visual surface area.

The current spherical chemistry grid can survive the renderer migration. For
fully non-star-shaped cavities, a later decision is required:

1. retain it as a coarse transport parameterization and map surface anchors to
   nearest chemistry voxels; or
2. migrate chemistry to a Cartesian/adaptive volume aligned with the cavity
   field.

Option 2 is a separate science/performance project and is not required to prove
the visual/geometry value of Marching Cubes.

---

## 9. What Marching Cubes should and should not generate

### Good candidates

- host-rock cavity wall;
- dissolution scallops when they exceed shader-only microrelief scale;
- connected voids and fracture channels;
- massive, earthy, amorphous, or botryoidal fill;
- wall films, flowstone, clay, and crust envelopes;
- volume-derived debug views such as supersaturation or temperature
  isosurfaces.

### Bad candidates

- quartz prisms and terminations;
- fluorite cubes/octahedra;
- calcite rhombs/scalenohedra;
- cyclic/contact/penetration twins;
- Wulff or facet-energy geometries;
- any habit whose diagnostic value lies in planar faces and exact edges.

Use the field to clip or embed those crystal meshes, not to replace them.

---

## 10. Tests

Add focused tests rather than immediately running every mineral calibration
suite during early extractor work.

Suggested files:

```text
tests-js/cavity-scalar-field.test.ts
tests-js/marching-cubes.test.ts
tests-js/marching-cubes-cavity-integration.test.ts
tests-js/cavity-field-clip-contract.test.ts
```

### Scalar-field tests

- sign convention at known sphere points;
- exact union of two overlapping spheres;
- deterministic seed/field output;
- negative volume border;
- bounds and world/grid round trip;
- non-finite inputs fail closed.

### Extractor tests

- empty/full cube emits no triangles;
- single-corner cases interpolate the correct edges;
- sphere mesh is closed: every undirected edge has exactly two incident faces;
- no NaNs, infinities, or zero-area triangles;
- all indices are in range;
- deterministic position/index buffers;
- normals are finite, normalized, and consistently oriented;
- two separated spheres yield two connected components;
- a deliberately ambiguous saddle case does not crack across its shared face.
- unresolved interior ambiguity fails closed rather than emitting a
  non-manifold surface;
- a tangent-sphere scalar critical point is rejected rather than emitting a
  zero-length normal.

### Integration tests

- MC feature flag off preserves current cavity buffers/signatures;
- enabling renderer-only MC does not mutate `wall.rings`, `mesh.cells`, fluids,
  crystal anchors, RNG state, or simulation output;
- the extracted surface lies near field zero within interpolation tolerance;
- bubble-field rebuild occurs only when sampled bubble geometry or resolution
  changes; polar-only `wall_depth` changes refresh the clip signature without
  rebuilding identical field/surface bytes;
- field-to-texture sampling agrees with CPU sampling at corners and centers;
- a crystal point in void survives clipping and a point in rock is discarded
  by the shared sign oracle.

### Visual checks

Use at least:

- a near-spherical vug;
- an irregular/pocket bubble union;
- a tabular or cleft cavity;
- a basin/cave case;
- a deliberately joined two-chamber fixture;
- a high-dissolution reactive-wall case.

Inspect poles, silhouette, near-wall crystals, texture seams, translucent wall
depth, sharp/smooth material mode, and inside-out flythrough.

---

## 11. Definition of done for the first implementation

The first implementation is complete when all of the following are true:

- A deterministic Cartesian `CavityScalarField` is built from existing
  `wall.bubbles` without consuming RNG.
- A tested indexed Marching Cubes extractor emits closed, finite geometry or
  fails closed when its first-tranche ambiguity policy cannot guarantee it.
- The Three.js renderer can display it behind a default-off development flag.
- Feature flag off is behaviorally and visually unchanged.
- Feature flag on does not mutate chemistry, crystals, wall cells, snapshots,
  or calibration output.
- Extraction is cached and keyed to geometry changes.
- Triangle count, field build time, extraction time, and memory are measured at
  `48^3` and `64^3` and recorded in this document.
- Known gaps—polar clipping mismatch, UV projection, and ring/cell anchors—are
  visible in code comments and keep non-star-shaped production archetypes
  disabled until their corresponding tranches land.

This definition intentionally stops before live erosion, anchor migration, or
chemistry-grid replacement. It proves the geometry foundation without turning
one renderer experiment into a simulation-wide rewrite.

---

## 12. Implementation cautions

- `index.html` is generated. Edit `js/**/*.ts`, then use the normal build
  pipeline; do not hand-edit bundled runtime code.
- Script load order is filename order. Update `js/README.md` when new modules
  land.
- Preserve unrelated working-tree changes.
- Do not consume the simulation RNG while sampling the field or extracting the
  surface. Geometry must derive entirely from already-authored state.
- Do not call `computeVertexNormals()` over gradient normals unless the visual
  choice is explicit; it will overwrite the field-derived normals.
- Avoid unconstrained Laplacian mesh smoothing. It shrinks cavities and erases
  geological shape. If smoothing is needed, smooth the scalar field narrowly
  and quantify the volume change.
- A decimated render mesh must not become simulation truth unless anchors,
  chemistry, and replay all have a stable remapping contract.
- Multiple connected components are valid output. Production policy must say
  whether to render all components, retain only the component connected to the
  primary cavity, or expose separate chambers.
- Keep isovalue and units explicit. A silent isovalue shift is a physical
  cavity-size change.

---

## 13. Recommended first coding sequence

1. Implement `CavityScalarField` and exact bubble-union sampling.
2. Add field sign/bounds/determinism tests.
3. Implement indexed Marching Cubes with a conventional case table.
4. Add closed-sphere, manifold-edge, interpolation, and determinism tests.
5. Add a development-only surface accessor/cache on `WallState`.
6. Add the default-off renderer switch at `_topoBuildCavityGeometry()`.
7. Compare `48^3` and `64^3` on representative authored scenarios.
8. Record timings, triangle counts, screenshots, and topology findings here.
9. Decide whether to promote Tranche 2 or revise the field/extractor first.

Do not begin 3D texture clipping or anchor migration until the renderer-only
comparison demonstrates a material improvement over the current cavity shell.

---

## 14. Open decisions for the implementing agent

Record decisions here rather than burying them in a commit message:

- [ ] Exact union or smooth union as the long-term default?
- [ ] `48^3`, `64^3`, or size-adaptive first production resolution?
- [ ] Classic table plus asymptotic decider, MC33, or another ambiguity-safe
      implementation?
- [ ] Spherical UV as a temporary bridge or immediate triplanar material?
- [ ] All connected components or only the primary connected void?
- [ ] Float, half-float, or encoded unsigned-byte 3D clip texture?
- [ ] When does the MC render surface replace, rather than accompany, the
      current lat-long surface?
- [ ] Does active dissolution mutate a persistent scalar field or rebuild it
      from a deterministic ledger of primitives?

The recommended answer to the final question is a deterministic ledger of
base bubbles plus erosion/deposition primitives. It makes save/replay compact,
keeps geometry reproducible, and allows the scalar volume to remain a cache
rather than an opaque second source of truth.

---

## 15. Tranches 0/1 implementation record — 2026-08-10

The first safe deliverable now exists in the local working tree:

- `js/23a-geometry-cavity-field.ts` builds a deterministic Cartesian
  `Float32Array` volume from the exact union of `wall.bubbles` using the
  documented positive-void/negative-rock convention. SIM 262 extends the same
  oracle through the immutable authored elongation, flatten/collapse, harmonic,
  and twist transforms used by `WallMesh`.
- `js/23b-geometry-marching-cubes.ts` extracts deterministic indexed buffers,
  deduplicates vertices by global grid edge, uses scalar gradients for normals,
  and resolves shared ambiguous faces with a bilinear asymptotic decider.
- `js/22-geometry-wall.ts` owns lazy field/surface caches keyed only by the
  sampled bubble geometry, effective construction-time shape descriptor, and
  resolution. Live `wall_depth` revisions still refresh the renderer's
  separate canonical clip signature.
- `js/99i-renderer-three.ts` exposes the shadow renderer only through
  `?mc_cavity=1` (optionally `?mc_resolution=64`) or a debug override. The
  default remains the canonical `WallMesh`.
- Focused Vitest files cover scalar-field math, extraction, integration,
  canonical mesh parity, and the repeatable scenario benchmark. They use test
  seed 42 while preserving
  every scenario's authored `shape_seed`.
- The complete local `npm test` workflow subsequently passed all 211 test files
  and 2,834 tests in 43 sequential memory-bounded batches. This includes the 25
  focused tests above inside the same regression run as the existing science,
  scenario, replay, rendering, and narrative contracts.

### Measured benchmark receipt

Warm local Vitest run on the same Windows machine, seven authored scenarios,
default test seed 42. Times are diagnostic wall-clock measurements, not a
cross-machine performance guarantee. Memory columns are typed-buffer payloads;
they exclude transient arrays and JavaScript object overhead.

| Scenario (`shape_seed`) | Grid | Field ms | Extract ms | Vertices | Triangles | Field KiB | Surface KiB |
|---|---:|---:|---:|---:|---:|---:|---:|
| `amethyst_geode` (7) | 48³ | 16.80 | 111.45 | 5,856 | 11,708 | 432 | 320 |
| `amethyst_geode` (7) | 64³ | 8.71 | 126.77 | 10,536 | 21,068 | 1,024 | 576 |
| `mvt` (3) | 48³ | 5.05 | 72.91 | 7,718 | 15,432 | 432 | 422 |
| `mvt` (3) | 64³ | 11.67 | 156.91 | 13,956 | 27,908 | 1,024 | 763 |
| `reactivated_fluorite_vein` (1850) | 48³ | 30.69 | 24.03 | 2,070 | 4,136 | 432 | 113 |
| `reactivated_fluorite_vein` (1850) | 64³ | 46.10 | 55.89 | 3,772 | 7,540 | 1,024 | 206 |
| `great_salt_plains` (1930) | 48³ | 27.62 | 22.58 | 1,874 | 3,744 | 432 | 102 |
| `great_salt_plains` (1930) | 64³ | 54.84 | 43.14 | 3,374 | 6,744 | 1,024 | 184 |
| `tormiq_alpine_cleft` (1990) | 48³ | 25.30 | 19.47 | 1,136 | 2,268 | 432 | 62 |
| `tormiq_alpine_cleft` (1990) | 64³ | 50.40 | 37.71 | 2,090 | 4,176 | 1,024 | 114 |
| `zoned_dripstone_cave` (24) | 48³ | 8.86 | 62.25 | 6,976 | 13,948 | 432 | 381 |
| `zoned_dripstone_cave` (24) | 64³ | 20.77 | 121.92 | 12,558 | 25,112 | 1,024 | 687 |
| `reactive_wall` (5) | 48³ | 21.24 | 83.03 | 5,562 | 11,120 | 432 | 304 |
| `reactive_wall` (5) | 64³ | 33.61 | 92.98 | 10,074 | 20,144 | 1,024 | 551 |

At 48³, build plus extraction measured 45–128 ms, 2,268–15,432
triangles, and roughly 0.48–0.83 MiB of retained field plus surface buffers.
All seven 64³ cases measured 88–169 ms, 4,176–27,908 triangles, and roughly
1.11–1.75 MiB. The earlier `great_salt_plains` rejection disappears when its
authored basin collapse is sampled instead of incorrectly extracting the raw
bubble union. The original sub-33-ms extraction target was not met, so 64³ is
not a production default; profiling and optimization remain gates before any
always-on promotion.

### Visual comparison and promotion gates

Local browser comparisons found that the pocket case preserves the useful
gross multi-lobe silhouette and that both renderer modes load without console
warnings or errors. They also exposed the exact limits the shadow path was
meant to reveal:

- **Closed in SIM 262:** one frozen construction-time shape descriptor now
  drives both paths. Exhaustive canonical-vertex tests pin zero/inside/outside
  parity for authored tabular, cleft, and basin cavities, including analytic
  pole caps. The elongation quadrupole is pole-regularized with `sin²(φ)` so a
  single Cartesian point cannot acquire a longitude-dependent radius.
- Per-cell `wall_depth` is not reconstructible from the base bubbles. It does
  not invalidate the byte-identical field cache; the canonical clip signature
  still refreshes until a replayable, mass-balanced erosion ledger exists.
- The visible MC wall and crystal clip disagree because clipping still samples
  the polar `WallMesh` radius texture. This prevents correct undercuts, throats,
  separated chambers, and re-entrant surfaces.
- Temporary spherical UVs do not preserve the canonical matrix skin, wall
  relief, or water-tint appearance; the comparison wall is visibly darker and
  smoother.
- Historical replay snapshots contain per-cell `wall_depth`, not a Cartesian
  primitive ledger, so replay deliberately falls back to `WallMesh`.

The remaining items are promotion blockers, not reasons to remove the
foundation. The flag stays default-off while Tranche 2 adds deterministic,
mass-balanced wall evolution. Tranches 3 and 4 must then make clipping and
anchors consume that same oracle before non-star-shaped geometry can become
simulation authority.

### Decisions recorded

- [x] Exact union is the shadow-path default; smooth union is deferred until a
      geological process justifies and volume-calibrates it.
- [x] 48³ is the measured comparison default; 64³ remains an explicit option,
      not a production choice.
- [x] The prototype uses table-free face contours plus a shared asymptotic face
      decider. It validates closed-input edge incidence and fails closed on an
      unresolved interior ambiguity. MC33-style handling remains a production
      gate.
- [x] Spherical UV is temporary; triplanar/material-space mapping is required
      before promotion.
- [x] All connected components are emitted so the extractor does not silently
      erase valid chambers.
- [ ] The 3D clip texture representation remains a Tranche 3 measurement.
- [x] MC accompanies rather than replaces `WallMesh` until dissolution,
      clipping, anchors, replay, and appearance share one field. Authored masks
      joined the shared oracle in SIM 262.
- [x] Active evolution should rebuild a cache from a deterministic,
      mass-balanced ledger of erosion/deposition primitives rather than mutate
      an opaque authoritative volume.

### First-deliverable checklist

- [x] Deterministic bubble-union field; no RNG consumption.
- [x] Indexed, finite, closed-sphere-tested extraction with shared-edge
      deduplication and deterministic buffers.
- [x] Default-off Three.js shadow flag; off-path buffer parity is tested.
- [x] Simulation state, wall cells, anchors, chemistry, and RNG remain unchanged.
- [x] Sampled-input, polar-clip, and rejected-extraction cache behavior is tested.
- [x] 48³/64³ time, triangle, and typed-buffer memory receipts are recorded.
- [x] Known gaps are explicit in runtime comments and tests.
- [ ] Production promotion. This is intentionally blocked by the gates above.

### AI Dr. Michael Wise hostile review

The first hostile review returned **NOT SATISFIED** with four reproducible
findings. The correction pass now:

1. validates every edge of a closed-input result and rejects unresolved
   non-manifold interior ambiguity (including the two-sphere reproducer);
2. rejects tangent-sphere critical points instead of storing zero normals;
3. removes ignored `wall_depth` revisions from the bubble-field cache key while
   retaining a separate canonical clip invalidation; and
4. validates the debug resolution before atomically changing either override.

The second hostile review found that a rejected surface was retried on every
render. Rejections are now cached by field/isovalue signature; the adapter
falls back immediately on subsequent calls and emits only one warning. The
regression pins two adapter calls to one extraction attempt and one warning.

The third hostile review found a locally flipped triangle that passed the
undirected manifold count and would be culled as a visible hole. Extraction now
propagates a consistent directed winding through each connected component,
orients the completed component against scalar-gradient normals, and rejects a
contradictory/non-orientable component. The fourth review showed that this made
the exact reproducer edge-consistent but did not repair its folded fan. Every
triangle is therefore now checked against scale-aware field samples on both
sides of its centroid; the reproducer is pinned as an unresolved-interior-
ambiguity rejection rather than accepted as an 812-triangle surface.

Each reproducer is pinned in the focused tests. After the per-face scalar
validation pass, the AI “Dr. Michael Wise” hostile-review role returned
`SATISFIED`. This verdict covers the default-off Tranches 0/1 foundation and
its explicit limitations; it does not approve production promotion or claim
review by the real scientist or Smithsonian.

### SIM 262 authored-mask reconciliation — 2026-08-11

The next hostile-review gate closed four defects before rebaking evidence:

1. The inverse radial transform originally rescaled the field magnitude and
   made the origin longitude-dependent. The scalar now retains the exact
   bubble-union value after inverse mapping, preserving continuity and sign.
2. Mutable public mask inputs could let the scalar cache diverge from the
   already-built `WallMesh`. `WallState` now freezes one non-enumerable semantic
   shape descriptor and exposes its compatibility fields as read-only values.
3. Canonical latitude meshes approximated pole caps from their nearest rings,
   placing the cap inside the analytic zero set. Both pole radii are now exact
   bubble-union raycasts with the shared authored transform.
4. Coverage omitted a tabular performance case. The repeatable receipt now
   includes `reactivated_fluorite_vein` at both 48³ and 64³, while exhaustive
   canonical-vertex parity covers tabular, cleft, and basin masks.

The geometry change is versioned as SIM 262 because pole regularization and
analytic caps alter canonical surface area, even though the Marching Cubes
renderer remains default-off. The Node-only science workflow rebakes and
verifies the versioned fleet receipt before this gate may be committed.

The completed SIM 262 evidence gate passed all 211 test files / 2,834 tests in
43 memory-bounded batches, the deterministic 170-module build check, and the
Node-only science rebake for all 41 scenarios at evidence seeds 1, 2, and 42.
The rebake produced 41 strips and 41 claim cards with 235 manifest citations,
zero unclassified products, and zero locality-contract violations. Local
browser comparison at seed 42 covered ellipsoidal, tabular, basin, and cleft
cavities at the measured 48-cube resolution; the shadow and canonical geode
silhouettes matched, an orbited cleft remained closed, and no browser warning
or error was emitted. At a 390 by 844 phone viewport, document and body widths
remained equal to their client widths and the 3D canvas stayed inside the
viewport. After reviewing these receipts and the bounded SIM 261 to SIM 262
science drift, the AI “Dr. Michael Wise” hostile-review role returned the exact
verdict `SATISFIED`. This is approval of the authored-mask/default-off shadow
gate only, not production promotion and not review by the real scientist or
Smithsonian.
