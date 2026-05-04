# PROPOSAL: Wireframe Crystals in 3D Mode

**Date:** 2026-05-04
**Author:** Stone Philosopher (drafted with Claude)
**Status:** Proposal for builder
**Companion to:** `PROPOSAL-3D-TOPO-VUG.md`, `PROPOSAL-3D-SIMULATION.md`

---

## Overview

Replace the colored wedges currently painted on the cavity wall in 3D mode with stylized wireframe crystals — vector-3D shapes (cube, hex-prism, rhomb, scalenohedron, etc.) that hang off the wall in their mineral's class color. Same retro-vector aesthetic as the cavity outline rings; the crystals just become legible 3D objects rather than colored patches.

This is a **3D-mode-only** change. The 2D topo strip keeps its current wedge representation (post-aggregate-ring fix from commit `89170cd`).

---

## Why

The current 3D rendering paints each crystal as a quadratic-Bezier wedge attached to its anchor cell. The wedge has an outer edge on the sphere shell and an inner edge offset toward the sphere center (Phase D v1's stalactite logic). It reads as a colored patch with depth, not as a crystal.

Real crystals are angular polyhedra with characteristic faces — quartz prisms, calcite scalenohedra, fluorite octahedra, galena cubes. The mineralogical identity is in the geometry. The current wedge representation hides that identity behind a generic blob.

Wireframe crystals also slot naturally into the existing wireframe-vector aesthetic: the cavity is rendered as wireframe rings; crystals attached to the cavity become wireframe polyhedra. The whole vug becomes one consistent vector-3D scene.

---

## Design decisions (locked)

These were resolved during the planning conversation; the proposal doesn't relitigate them.

### 1. Tier 1 — hand-crafted primitives, not algorithmic Wulff shapes

Build a library of ~10 canonical wireframe shapes by hand. Each = vertices + edges + silhouette-index list in normalized coords. A lookup table maps each crystal's `habit` (with `dominant_forms` as tiebreaker) to one primitive.

This is the **symbolic** use of Miller indices: the data already encodes "calcite scalenohedral with dominant_forms `e{104} rhombohedron`", and the lookup table reads that to pick a scalenohedron primitive. The Miller indices inform the pick; they don't drive geometry algorithmically.

A Tier 3 algorithmic Wulff-shape calculator (compute the symmetry-related plane set, intersect halfspaces, extract the polytope) is an honest mineralogical pipeline but multiple sessions of work. Skipping in favor of Tier 1's faster visual win. Hand-crafted primitives chosen to look right at a glance — the eye won't easily distinguish them from algorithmic equilibrium shapes.

### 2. Crystal occlusion: solid silhouette + wireframe edges

Each crystal acts as a *solid* object for occlusion purposes — when it's between the camera and a piece of cavity wireframe (or another crystal), it hides what's behind it. The cavity rings stay wireframe-translucent (you see the back rings through the front ones). Crystals don't.

Implemented via painter's algorithm: all rings AND crystals interleaved, sorted by their post-rotation z, painted back-to-front. For each crystal: fill the silhouette polygon (= 2D convex hull of the projected vertices) first, stroke the edges second. The fill creates a hole in everything painted before it; the front-facing edges paint over the fill.

No explicit hidden-line-removal math — the painter's algorithm handles it.

### 3. Styling: edges in mineral color at full alpha; fill in mineral color at 40% of that alpha

```
edgeAlpha = topoAlphaFor(mineral)        // same as current wedges
fillAlpha = 0.4 * topoAlphaFor(mineral)  // 40% of the edge alpha
edgeColor = topoClassColor(mineral)
fillColor = topoClassColor(mineral)
```

The wireframe edges use the existing `topoAlphaFor` system unchanged — highlighted mineral renders at 100%, others ghost to ~25% the way they do today. The silhouette fill is *additionally* 40% — so a highlighted crystal has a 40%-alpha stained-glass tint inside its wireframe; a ghosted crystal has only ~10%, almost see-through.

The "stained-glass" look:
- Cavity wireframe is faintly visible *through* the crystal (the 60% transparent fill lets the back-side cavity rings tint through)
- Mineral identity is clear (40% mineral color is plenty to read)
- Highlight system becomes a "see through other crystals to find the one I want" mechanic — ghosted crystals' fills drop to 10%, barely occluding anything.

### 4. Crystal orientation

The crystal's c-axis points along the inward sphere normal at its anchor cell. This is the same geological default Phase D v1 already encoded — perpendicular to the substrate. Result:
- Floor-anchored crystals → c-axis pointing up (stalagmite)
- Ceiling-anchored crystals → c-axis pointing down (stalactite)
- Wall-anchored crystals → c-axis pointing horizontally inward

A random rotation around the c-axis, seeded by `crystal_id`, keeps adjacent crystals from visually aligning (and stays reproducible for the same seed). Use the same one-line PRNG seeded from `crystal_id`.

---

## The primitive library

Hand-craft these in a single JS module — `_CRYSTAL_PRIMITIVES` — with normalized coordinates (c-axis = +y, equatorial radius = 1, c-length = 1, scale by the crystal's actual size at render time).

| Name | Vertices | Edges | Used by |
|---|---|---|---|
| `cube` | 8 | 12 | galena, halite, pyrite (cubic), fluorite (cubic habit), native_copper (cubic) |
| `octahedron` | 6 | 12 | fluorite (octahedral habit), magnetite, spinel, diamond |
| `hex_prism` | 12 | 18 | quartz prism (untriminated), beryl, apatite |
| `hex_prism_terminated` | 14 | 24 | quartz with rhombohedral terminations (the canonical "doubly-terminated" look) |
| `rhombohedron` | 8 | 12 | calcite (rhombohedral), dolomite, siderite, rhodochrosite |
| `scalenohedron` | 8 | 12 | calcite (scalenohedral / "dogtooth") |
| `tetrahedron` | 4 | 6 | tetrahedrite, sphalerite (tetrahedral) |
| `pyritohedron` | 14 | 30 | pyrite (pyritohedral / striated cube alternative) |
| `dipyramid` | 6 | 12 | barite, celestine, scheelite, anhydrite (tabular variants get `tabular` instead) |
| `tabular` | 8 | 12 | tabular habits — gypsum (selenite), barite (tabular), mica, wulfenite, molybdenite |
| `acicular` | 6 | 9 | acicular / needle habits — stibnite, natrolite, mesolite, gypsum (sword), aragonite (acicular) |
| `botryoidal` | ~20 | ~30 | botryoidal / reniform — chalcedony, malachite (botryoidal), goethite (reniform). Multi-bump silhouette using a few overlapping hemispheres |

12 primitives total. Each ~5-30 lines of vertex/edge data. The whole library should fit in ~250 lines.

### Primitive data structure

```js
const PRIM_CUBE = {
  name: 'cube',
  // Vertices in normalized coords. c-axis = +y; equatorial extent = ±1.
  vertices: [
    [-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1],
    [-1,  1, -1], [1,  1, -1], [1,  1, 1], [-1,  1, 1],
  ],
  // Edges as vertex-index pairs.
  edges: [
    [0,1], [1,2], [2,3], [3,0],   // bottom face
    [4,5], [5,6], [6,7], [7,4],   // top face
    [0,4], [1,5], [2,6], [3,7],   // verticals
  ],
};
```

The silhouette polygon is computed per-frame from the projected 2D vertices (convex hull) — not stored in the primitive. Storing it would be wrong because the silhouette changes with rotation.

### Habit → primitive lookup

Build incrementally as `_HABIT_TO_PRIMITIVE`:

```js
const HABIT_TO_PRIMITIVE = {
  'cubic':              PRIM_CUBE,
  'pyritohedral':       PRIM_PYRITOHEDRON,
  'cubo-pyritohedral':  PRIM_CUBE,  // start with cube; refine later if needed
  'octahedral':         PRIM_OCTAHEDRON,
  'rhombohedral':       PRIM_RHOMBOHEDRON,
  'scalenohedral':      PRIM_SCALENOHEDRON,
  'prismatic':          PRIM_HEX_PRISM_TERMINATED,
  'tabular':            PRIM_TABULAR,
  'acicular':           PRIM_ACICULAR,
  'botryoidal':         PRIM_BOTRYOIDAL,
  'reniform':           PRIM_BOTRYOIDAL,
  'tetrahedral':        PRIM_TETRAHEDRON,
  'pseudo_cubic':       PRIM_CUBE,
  // ... fill in as needed; default fallback below
};

function _lookupCrystalPrimitive(crystal) {
  if (!crystal) return PRIM_RHOMBOHEDRON;  // sensible default
  const direct = HABIT_TO_PRIMITIVE[crystal.habit];
  if (direct) return direct;
  // Fuzzy fallback by substring (matches what _resolveTexture does today).
  const h = (crystal.habit || '').toLowerCase();
  if (h.includes('cube') || h.includes('cubic')) return PRIM_CUBE;
  if (h.includes('octahed')) return PRIM_OCTAHEDRON;
  if (h.includes('prism')) return PRIM_HEX_PRISM_TERMINATED;
  if (h.includes('tabular') || h.includes('platy')) return PRIM_TABULAR;
  if (h.includes('acicular') || h.includes('needle')) return PRIM_ACICULAR;
  if (h.includes('botryoidal') || h.includes('reniform')) return PRIM_BOTRYOIDAL;
  if (h.includes('rhomb')) return PRIM_RHOMBOHEDRON;
  if (h.includes('scalenohed') || h.includes('dogtooth')) return PRIM_SCALENOHEDRON;
  return PRIM_RHOMBOHEDRON;  // last-resort default
}
```

---

## Per-crystal render pipeline

For each crystal in the painter's-sorted list:

```js
function _renderCrystalWireframe(ctx, crystal, wall, mmToPx, cx, cy, cellWorldPos) {
  const prim = _lookupCrystalPrimitive(crystal);

  // 1. Compute the world-space transform.
  const cLengthPx = Math.max(crystal.c_length_mm, 0.5) * mmToPx;
  const aWidthPx  = Math.max(crystal.a_width_mm, 0.5) * mmToPx;
  // c-axis = inward sphere normal at the anchor cell. cellWorldPos is
  // (wx, wy, wz) on the sphere shell; inward direction is -cellWorldPos
  // normalized.
  const invR = 1 / Math.hypot(cellWorldPos[0], cellWorldPos[1], cellWorldPos[2]);
  const cAxis = cellWorldPos.map(v => -v * invR);
  // Random rotation around c-axis, seeded by crystal_id.
  const cAxisRotRad = (_seededRand(crystal.crystal_id) - 0.5) * 2 * Math.PI;
  // Build a basis: (cAxis, perp1, perp2) — see _orthonormalBasis() helper.
  const [perp1, perp2] = _orthonormalBasis(cAxis, cAxisRotRad);

  // 2. Transform each primitive vertex to world coords.
  // Primitive convention: y = c-axis, x/z = equatorial. Map y→cAxis,
  // x→perp1, z→perp2, scale by (aWidth, cLength, aWidth), translate to
  // the anchor cell's world position.
  const projected = [];
  for (const [px, py, pz] of prim.vertices) {
    const wx = cellWorldPos[0]
             + perp1[0] * px * aWidthPx
             + cAxis[0] * py * cLengthPx
             + perp2[0] * pz * aWidthPx;
    const wy = cellWorldPos[1]
             + perp1[1] * px * aWidthPx
             + cAxis[1] * py * cLengthPx
             + perp2[1] * pz * aWidthPx;
    const wz = cellWorldPos[2]
             + perp1[2] * px * aWidthPx
             + cAxis[2] * py * cLengthPx
             + perp2[2] * pz * aWidthPx;
    // 3. Project to screen.
    const [sx, sy] = _topoProject3D(wx - cx, wy - cy, wz, _topoTiltX, _topoTiltY, F);
    projected.push([cx + sx, cy + sy]);
  }

  // 4. Compute silhouette: 2D convex hull of projected points.
  const hull = _convexHull2D(projected);

  // 5. Fill silhouette.
  const edgeAlpha = topoAlphaFor(crystal.mineral);
  const color = topoClassColor(crystal.mineral);
  ctx.globalAlpha = 0.4 * edgeAlpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(hull[0][0], hull[0][1]);
  for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i][0], hull[i][1]);
  ctx.closePath();
  ctx.fill();

  // 6. Stroke edges.
  ctx.globalAlpha = edgeAlpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const [a, b] of prim.edges) {
    ctx.moveTo(projected[a][0], projected[a][1]);
    ctx.lineTo(projected[b][0], projected[b][1]);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}
```

### Helpers

- `_seededRand(id)`: deterministic float in [0,1) from an integer seed. Mulberry32 or similar; existing `_mulberry32` is reusable.
- `_orthonormalBasis(axis, rotRad)`: given a unit vector `axis` and a rotation angle `rotRad` around it, return two perpendicular unit vectors. Standard cross-product construction; ~10 lines.
- `_convexHull2D(points)`: Graham scan or Andrew's monotone chain on the projected points. ~30 lines. Resulting polygon is the silhouette.
- `cellWorldPos`: the 3D world position of the anchor cell, computed once per crystal from `wall.rings[k][cell_idx].base_radius_mm × sin(phi) × polar_factor × twist`, etc. Reuses the same math the existing wedge renderer uses for outer-edge vertices.

---

## Painter's-order changes in `_topoRenderRings3D`

Currently the function iterates `ringOrder` (sorted by ring's projected z) and within each ring renders wedges then outline. With wireframe crystals:

1. Build a unified `paintItems` list of `{ kind: 'ring', ringIdx, ... }` and `{ kind: 'crystal', crystal, cellWorldPos, ... }` records.
2. Compute each item's representative z:
   - Ring: post-rotation z of the ring center (already computed today as `projZ`).
   - Crystal: post-rotation z of the anchor cell's world position.
3. Sort `paintItems` ascending by representative z. Tie-break by item type then by id (rings by `ringIdx`, crystals by `crystal_id`).
4. Iterate and dispatch:
   - Ring → existing wall-outline code (just the stroke loop, no wedges anymore — those are gone from this function entirely now that crystals are wireframes).
   - Crystal → `_renderCrystalWireframe(...)`.

The wedge-fill block that lives inside today's ring loop comes out — wireframe crystals replace it entirely.

---

## Files impacted

### `index.html`

- New module-level constants: `_CRYSTAL_PRIMITIVES` (the library) and `_HABIT_TO_PRIMITIVE` (lookup table).
- New helpers: `_lookupCrystalPrimitive`, `_seededRand` (or reuse `_mulberry32`), `_orthonormalBasis`, `_convexHull2D`, `_renderCrystalWireframe`.
- `_topoRenderRings3D`: refactor the inner loop into the painter's-order item list. Remove the wedge-fill section; replace with crystal-wireframe dispatch.
- No engine changes. No data-model changes. No JS-side schema additions.

### `vugg.py`

- No changes. The wireframe rendering is JS-only; engine state is consumed read-only.

### Tests

- New `tests/test_wireframe_crystals.py` (or test_multi_ring_wireframe.py if grouping with the multi-ring suite) — covers:
  - The primitive library has the expected ~12 entries with non-empty `vertices` and `edges` arrays.
  - `_lookupCrystalPrimitive` returns a valid primitive for every habit string in `data/minerals.json`.
  - `_lookupCrystalPrimitive` falls back to the substring matcher cleanly on novel habits.
  - Convex hull on a known point set returns the expected polygon (3-4 unit tests on the algorithm itself).
- The Python tests can only verify the lookup-table coverage if the lookup table is in JS; an alternative is to mirror `_HABIT_TO_PRIMITIVE` keys as a JSON manifest that the Python test reads. Choose based on builder preference; coverage tests are nice-to-have.

### `proposals/BACKLOG.md`

Move "Habit textures missing in 3D mode" entry to **resolved-by-this-proposal** (the wireframe replaces the textured wedge entirely; the texture functions stay in the codebase for 2D mode). Note that this proposal supersedes that BACKLOG item for 3D-mode habit fidelity.

---

## Verification

End-to-end checks for the builder:

1. **Lookup coverage** — every mineral in `data/minerals.json` has at least one habit variant that maps to a defined primitive (no fallback hits). Builder runs a small script that walks every mineral and asserts `_lookupCrystalPrimitive` returns a non-default primitive for at least one of its habit strings.
2. **Visual check, single crystal** — Spawn a single calcite crystal in a fresh creative-mode session; switch to 3D mode; rotate. Crystal should appear as a wireframe scalenohedron, c-axis perpendicular to the wall, with 40%-alpha mineral-color stained-glass fill and full-alpha edges.
3. **Visual check, full porphyry run** — Run porphyry to step 100; switch to 3D mode; rotate. Should see ~30 different wireframe crystals scattered across the cavity wall: cubes (galena), octahedra (magnetite), hex-prisms (quartz), pyritohedra (pyrite), tetrahedra (tetrahedrite). The cavity rings should be visible *through* the crystal fills but *not* through the parts of the crystal silhouette where the fill is opaque enough — the painter's algorithm does the depth.
4. **Highlight check** — Hover a mineral in the legend. The highlighted mineral's crystals stay at full alpha; others ghost. Critically: the *fill* alpha drops faster than the edge alpha (40% × 25% = 10%), so ghosted crystals become translucent enough to see through. Verify this matches the design.
5. **Performance** — 50+ crystals at 60fps on the developer's laptop. Likely fine: ~50 crystals × ~20 edges × per-vertex projection = ~2k line segments per frame, comparable to the existing 1920 ring strokes.
6. **2D mode unchanged** — Toggle out of rotate mode; the 2D topo strip should look exactly as it does today (wedges, habit textures, scale bar, hover tooltip working post-aggregate-ring fix).

---

## Out of scope (intentionally)

- **Algorithmic Wulff-shape construction from Miller indices.** Tier 3 work; multi-session pipeline. Hand-crafted primitives are good enough.
- **Lighting / shading on the wireframes.** Tier 2 (Three.js) territory. The retro-vector aesthetic is the explicit design choice; lighting would push toward a different look.
- **Mineral-specific edge variations within a single primitive.** E.g. quartz prisms with subtle striations or twinning lines on the prism faces. Possible later additions to the primitive library; not v0.
- **Habit textures in 3D mode.** The wireframe replaces the textured wedge entirely. The texture functions stay in the codebase for 2D-mode use.
- **2D mode wireframes.** 2D stays as-is. Wireframes are 3D-mode only.
- **Inclusion-dot wireframes.** Inclusion dots in 3D mode were already deferred (see commit `c9932c9`). They stay deferred.
- **Crystal habit transitions during growth.** A scalenohedral calcite that paramorphs into a rhombohedral one would still use only the post-paramorph habit's primitive. No interpolation between primitives.

---

## Open questions for the builder

1. **Where to store the primitive library?** Options:
   a) Inline in `index.html` as a JS const (simple, single-file deployment unchanged).
   b) Separate `data/crystal-primitives.json` file (data-as-truth aligned, but adds a fetch).
   c) Per-primitive functions in a new `tools/crystal_primitives.js` (modular, but the project doesn't otherwise use ES modules).
   Suggestion: (a) inline for v0, with a clear `// === CRYSTAL PRIMITIVES ===` section header. Migrate to (b) if the library grows past 30 primitives or someone wants to author them via a tool.

2. **Convex hull on the projected vertices: which algorithm?** Andrew's monotone chain is ~30 lines of tight JS, O(n log n). For ~30 vertices per crystal, anything works. Pick whichever the builder is comfortable with.

3. **What about crystals smaller than 1 cell of the cavity?** A 0.05mm baby crystal at the start of a scenario would render as a near-invisible wireframe. Today's wedges have a `Math.max(crystal.total_growth_um, 1)` thickness floor. Mirror that for wireframes — clamp the rendered scale to a visual minimum of ~3px in either dimension. Avoids the "did anything spawn?" perception bug.

4. **Crystals that span multiple cells (large `wall_spread`)** — today's wedge paints across multiple cell indices; a single wireframe primitive renders at one anchor point and could overlap neighboring cells, but its silhouette wouldn't span them. Acceptable for v0 (the crystal looks like one unit instead of a streak); flag for a later "streak / cluster" mode if it bothers playtesters.

5. **Z-fighting between crystals at the same anchor cell** (host-substrate overgrowths). Pseudomorphs and overgrowths share a `wall_center_cell` and `wall_ring_index`. Painter's-order tie-breaks them by `crystal_id`, and the more-recent (higher id) crystal paints on top — typically correct, since pseudomorphs are later in the paragenesis. Worth a brief note in the rendering comment but no special handling needed.

---

## Sizing estimate

- **Primitive library**: ~250 lines.
- **Helpers (`_seededRand`, `_orthonormalBasis`, `_convexHull2D`, `_lookupCrystalPrimitive`)**: ~80 lines combined.
- **`_renderCrystalWireframe`**: ~60 lines.
- **`_topoRenderRings3D` refactor (painter's-order item list, dispatch)**: ~60 lines net change.
- **Tests**: ~80 lines.
- **Total**: ~530 lines of new code, ~150 lines of changed code.

**Estimated time**: 4–6 hours of focused work for a builder familiar with the codebase. Most of it is the primitive library — careful vertex-and-edge enumeration, but mechanical. The rendering pipeline change is small.

Independent of any other open work in BACKLOG.md. Doesn't depend on the 3D hit-test fix, the bornite/magnetite chemistry tuning, or Phase D v2 (orientation-preference hints).

---

## Recommendation

Approve and proceed. The visual jump from colored wedges to actual 3D crystal silhouettes is large; the implementation is contained; the design decisions are locked. Builder can execute on this proposal with minimal back-and-forth.

The one judgment call worth deferring to playtest is the styling: the 40%-of-edge-alpha fill is the right starting point, but if it reads as too transparent (crystals get lost in the cavity wireframe) or too opaque (crystals look like solid blobs and lose the wireframe character), tune the 0.4 multiplier up or down. Trivial change once the rendering ships.
