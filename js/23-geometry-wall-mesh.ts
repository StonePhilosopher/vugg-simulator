// ============================================================
// js/23-geometry-wall-mesh.ts — WallMesh (cavity surface mesh)
// ============================================================
// Phase 2 of PROPOSAL-CAVITY-MESH.
//
// What this is: an engine-side, renderer-agnostic representation of the
// cavity surface as a triangulated mesh. One vertex per surface anchor,
// plus two pole caps; positions, vertex colors, and outward normals are
// recomputed from the underlying WallState whenever the cavity changes
// (dissolution, fluid-level shift, scenario reload).
//
// Why now: the Three.js renderer used to compute these vertices inline
// from `wall.rings[r][c]`. That coupled the renderer to the ring-grid
// model, which Phase 4 of the proposal will retire. Moving the math
// here means Phase 2.5+ can swap in icosphere / geodesic / irregular
// tessellations without touching the renderer at all.
//
// Phase 2 (this file) keeps the default tessellation byte-identical to
// the legacy ring grid: `numInterior = ring_count × cells_per_ring`
// vertices laid out in lat-long order, plus south/north pole caps.
// Per-vertex coloring matches `_topoBuildCavityGeometry`'s palette
// (floor / wall / ceiling × submerged tint). Phase 2.5 will subclass
// the factory to emit different tessellations under archetype control.
//
// Phase 3 will move per-vertex state (wall_depth, crystal_id,
// mineral, thickness_um) off `WallCell` and onto `WallMesh.cells[]`
// indexed by vertex. For Phase 2 the mesh is READ-ONLY: it pulls from
// rings[r][c] each rebuild. The engine still writes to ring cells.

class WallMesh {
  // Dynamic dataclass-style fields — runtime untouched, matches the
  // pattern of WallState / Crystal / WallCell.
  [key: string]: any;

  constructor() {
    // ---- Structure (immutable after construction for a given mesh) ----
    // One entry per non-pole vertex, in row-major (ringIdx, cellIdx)
    // order so the legacy index formula `r * cells_per_ring + c`
    // resolves to the same vertex the renderer used to compute inline.
    // phi/theta are spherical coordinates: phi ∈ [0, π] (south pole
    // 0, north pole π), theta ∈ [0, 2π). orientation is one of
    // 'floor' | 'wall' | 'ceiling' from WallState.ringOrientation —
    // baked into the vertex so future tessellations that don't have a
    // ring concept can still resolve orientation per-vertex.
    this.vertices = [];
    // Total interior vertex count (numInterior); pole vertices live at
    // indices numInterior (south) and numInterior+1 (north).
    this.numInterior = 0;
    this.ringCount = 0;
    this.cellsPerRing = 0;
    this.southIdx = 0;
    this.northIdx = 0;
    // PROPOSAL-CAVITY-MESH Phase 4 / Path C — per-vertex state.
    // One entry per interior vertex (pole vertices have no cell;
    // they're just for triangulation closure).
    //
    // Tranche 1 (Slice 4A): cells carry `fluid` (object reference,
    // alias to ring_fluids[ringIdxOf(i)]) — same storage, new
    // accessor surface. `temperature_ring` is the index into the
    // sim's ring_temperatures[] array for lazy temperature lookup
    // (numbers can't be aliased like objects can).
    //
    // Future tranches add: wall_depth, crystal_id, mineral,
    // thickness_um (Tranche 4 migrates the painter); per-vertex
    // fluid clones (later, when zone+Laplacian land).
    //
    // Shape: { fluid: FluidChemistry | null, temperature_ring: number }.
    // Initialized by bindRingChemistry() after VugSimulator constructs
    // ring_fluids[] — fromWallState() can't populate them because
    // chemistry lives on the sim, not the wall.
    this.cells = [];
    // Triangle indices: south-cap fan + inter-ring quads + north-cap
    // fan. Plain number[] so the renderer can decide between Uint16
    // and Uint32 BufferAttribute based on vertex count.
    this.indices = [];

    // ---- Dynamic geometry (recomputed when wall + sim change) ----
    // Flat Float32Arrays — same buffer shape the renderer hands to
    // THREE.BufferAttribute, so the wire-up is a one-shot reference
    // pass with no intermediate copy.
    this.positions = null;  // Float32Array(numVerts * 3)
    this.colors = null;     // Float32Array(numVerts * 3)
    this.normals = null;    // Float32Array(numVerts * 3)  (radial fallback;
                            // renderer calls computeVertexNormals to override)
    this.uvs = null;        // Float32Array(numVerts * 2)  (STATIC lat-long
                            // texture coords for the matrix skin — filled once
                            // in fromWallState, never recomputed)

    // Cavity-state fingerprint. The renderer keys its cache off this,
    // matching the legacy _topoCavitySignature() so cache-hit semantics
    // don't shift.
    this.sig = '';
    // Geometry-only identity used by surface anchors. Unlike `sig`, this does
    // not change when the water level recolors otherwise identical vertices.
    this.geometry_sig = '';

    // Conservative monotonic radius reference — populated during
    // recompute, mirrors WallState.max_seen_radius_mm so the renderer's
    // clip uniforms have a single source of truth as we migrate.
    this.max_radius_mm = 0;
    // Per-ring max vertex radius — drives the per-fragment clip-radius
    // interpolation in the Three.js shader (so a crystal at a polar
    // latitude is clipped against the hull at THAT latitude, not the
    // equatorial max). One slot per ring; the renderer reads ringCount
    // slots into its uVugRadiiByRing uniform array.
    this.maxRadiusByRing = null;
    // Exact area of the tessellated cavity surface. Surface-growth
    // aggregates use this same triangle ledger for physical thickness and
    // representative placement, so an irregular vug is not silently
    // replaced by a mean-diameter sphere.
    this.surface_area_mm2 = 0;
    this._surfaceTriangles = [];
    this._voidNormalsByVertex = null;
  }

  // ---- Factory ----
  //
  // Build a WallMesh from the current WallState. Default tessellation
  // is the legacy lat-long grid: ring_count × cells_per_ring interior
  // vertices + south/north pole caps. The vertex *positions* depend
  // on the wall's current dissolution + the sim's water state (for
  // submerged-tint coloring), which is why this factory takes both.
  //
  // Sim is optional — engine-only consumers (tests, snapshot writers)
  // can pass undefined and get default-dry colors.
  static fromWallState(wall, sim?) {
    const mesh = new WallMesh();
    if (!wall || !wall.rings || !wall.rings.length) return mesh;
    const ringCount = wall.ring_count;
    const ring0 = wall.rings[0];
    const N = ring0 ? ring0.length : 0;
    if (!N || ringCount < 1) return mesh;

    // Build the vertex structure once. phi / theta / ringIdx / cellIdx
    // / orientation are immutable for this tessellation; only the
    // dynamic (x,y,z, color) values recompute later.
    mesh.numInterior = ringCount * N;
    mesh.ringCount = ringCount;
    mesh.cellsPerRing = N;
    mesh.southIdx = mesh.numInterior;
    mesh.northIdx = mesh.numInterior + 1;
    const numVerts = mesh.numInterior + 2;
    mesh.vertices = new Array(numVerts);
    for (let r = 0; r < ringCount; r++) {
      const phi = Math.PI * (r + 0.5) / ringCount;
      const orient = wall.ringOrientation ? wall.ringOrientation(r) : 'wall';
      for (let c = 0; c < N; c++) {
        const idx = r * N + c;
        mesh.vertices[idx] = {
          phi,
          theta: 2 * Math.PI * c / N,
          ringIdx: r,
          cellIdx: c,
          orientation: orient,
          isPole: false,
        };
      }
    }
    mesh.vertices[mesh.southIdx] = {
      phi: 0, theta: 0,
      ringIdx: -1, cellIdx: -1,
      orientation: wall.ringOrientation ? wall.ringOrientation(0) : 'floor',
      isPole: true,
    };
    mesh.vertices[mesh.northIdx] = {
      phi: Math.PI, theta: 0,
      ringIdx: -1, cellIdx: -1,
      orientation: wall.ringOrientation ? wall.ringOrientation(ringCount - 1) : 'ceiling',
      isPole: true,
    };

    // Build the index buffer — south cap fan + inter-ring quads +
    // north cap fan. Same winding the legacy renderer used so
    // outward-facing normals stay outward after migration.
    mesh._buildIndices(ringCount, N);

    // Allocate dynamic buffers + run the first geometry pass.
    mesh.positions = new Float32Array(numVerts * 3);
    mesh.colors = new Float32Array(numVerts * 3);
    mesh.normals = new Float32Array(numVerts * 3);
    mesh.maxRadiusByRing = new Float32Array(ringCount);
    // MATRIX SKIN (2026-07-06): static texture coordinates — the lat-long
    // parameterization the vertex structure already is (u = theta/2π = c/N,
    // v = phi/π = (r+0.5)/ringCount; poles at v 0/1, u centered). Immutable
    // for the tessellation, so filled once here, never in recompute. The
    // theta wrap (c = N−1 → 0) smears one 3°-wide column at the default 120
    // cells — invisible under the low-contrast matrix skins by design.
    mesh.uvs = new Float32Array(numVerts * 2);
    for (let r = 0; r < ringCount; r++) {
      for (let c = 0; c < N; c++) {
        const idx = r * N + c;
        mesh.uvs[idx * 2 + 0] = c / N;
        mesh.uvs[idx * 2 + 1] = (r + 0.5) / ringCount;
      }
    }
    mesh.uvs[mesh.southIdx * 2 + 0] = 0.5;
    mesh.uvs[mesh.southIdx * 2 + 1] = 0.0;
    mesh.uvs[mesh.northIdx * 2 + 0] = 0.5;
    mesh.uvs[mesh.northIdx * 2 + 1] = 1.0;
    mesh.recompute(wall, sim);
    // PROPOSAL-CAVITY-MESH Phase 4 Tranche 4c — cells[i] is now a
    // direct REFERENCE to wall.rings[r][c] (the WallCell object).
    // Same storage, two access patterns: wall.rings[r][c].fluid and
    // mesh.cells[r * N + c].fluid hit the same WallCell. This
    // unifies the per-vertex chemistry storage (Tranche 1-4a was
    // on a separate `cells` array of {fluid, temperature_ring}) with
    // the legacy per-cell geometry/occupancy storage that's lived on
    // WallCell since v17.
    //
    // The "retirement" of wall.rings the proposal originally called
    // for is realized as data-model unification rather than deletion:
    // 99b's 2D-strip renderer + the snapshot writer still iterate
    // wall.rings[r][c]; the mesh-edge Laplacian + per-crystal growth
    // swap iterate mesh.cells. Both see the same cells. Deletion of
    // wall.rings as a top-level field can land as a polish pass once
    // every reader is comfortable with the mesh-flat shape.
    mesh.cells = new Array(mesh.numInterior);
    for (let r = 0; r < ringCount; r++) {
      const ring = wall.rings ? wall.rings[r] : null;
      for (let c = 0; c < N; c++) {
        const cellRef = ring ? ring[c] : null;
        mesh.cells[r * N + c] = cellRef
          ? cellRef                                  // shared reference
          : { fluid: null, temperature_ring: r };    // headless-test fallback
      }
    }
    return mesh;
  }

  // PROPOSAL-CAVITY-MESH Phase 4 Tranche 4a — per-vertex chemistry
  // becomes the canonical storage. cells[i].fluid is now an
  // INDEPENDENT clone of ring_fluids[ringIdxOf(i)] at bind time, not
  // an alias. Each vertex evolves its own chemistry under engine
  // growth, mesh diffusion, propagated event deltas, and vadose
  // oxidation.
  //
  // Why un-alias: Path C ("foundation based on the science"). Real
  // cavity walls have continuous chemistry that varies with local
  // fluid flow, drip points, vent proximity. Per-ring storage forced
  // every crystal in the same ring to share one pool — geologically
  // wrong at the grain of the simulator's resolution. Un-aliasing
  // gives the simulator the same per-position freedom real cavities
  // have.
  //
  // Calibration baseline regenerates: the same seed produces slightly
  // different output because crystals no longer share local Ca/Si
  // pools with co-ring siblings. This is the deliberate behavior
  // shift Tranche 4a's commit documents.
  bindRingChemistry(ringFluids, _ringTemps) {
    if (!ringFluids || !this.cells.length) return;
    // PROPOSAL-CAVITY-MESH Phase 4 Tranche 4c — cells[i] is now the
    // SAME object as wall.rings[r][c] (a WallCell). Writing
    // cells[i].fluid sets the field on the WallCell directly, so
    // legacy code that reads wall.rings[r][c].fluid sees the same
    // value. Each cell still gets an INDEPENDENT clone (Tranche 4a
    // un-aliasing invariant) — per-vertex chemistry intact.
    for (let i = 0; i < this.numInterior; i++) {
      const vertex = this.vertices[i];
      const r = vertex ? vertex.ringIdx : 0;
      if (r >= 0 && r < ringFluids.length) {
        const src = ringFluids[r];
        const Cloner: any = (typeof _cloneFluid !== 'undefined')
          ? _cloneFluid
          : null;
        this.cells[i].fluid = Cloner ? Cloner(src) : src;
        this.cells[i].temperature_ring = r;
      }
    }
  }

  // PROPOSAL-CAVITY-MESH Phase 4 Tranche 2 — build the adjacency
  // map for the current tessellation (default: lat-long grid of
  // ring_count × cells_per_ring). For each interior vertex, returns
  // the list of neighbor vertex indices: 4 for typical interior
  // vertices (two same-ring left/right with theta-wrap, two
  // adjacent-ring up/down with pole-clamp); 3 for vertices on the
  // top/bottom ring (one of up/down clamps to itself, deduplicated).
  //
  // Computed lazily on first call; cached on the instance. If a
  // future Phase 2.5 swaps the default tessellation for an icosphere
  // or geodesic, replace this body with an index-buffer scan that
  // derives adjacency from the triangulation directly. The
  // signature is stable.
  _buildAdjacency(ringCount, cellsPerRing) {
    if (this._adjacency && this._adjacencyKey === `${ringCount}|${cellsPerRing}`) {
      return this._adjacency;
    }
    const adj = new Array(this.numInterior);
    for (let r = 0; r < ringCount; r++) {
      for (let c = 0; c < cellsPerRing; c++) {
        const i = r * cellsPerRing + c;
        const neighbors: number[] = [];
        // Same-ring left / right with theta-wrap.
        neighbors.push(r * cellsPerRing + ((c - 1 + cellsPerRing) % cellsPerRing));
        neighbors.push(r * cellsPerRing + ((c + 1) % cellsPerRing));
        // Adjacent-ring up / down with pole-clamp (Neumann boundary —
        // top ring's "up" is itself, bottom ring's "down" is itself).
        const rUp = (r > 0) ? r - 1 : 0;
        const rDn = (r < ringCount - 1) ? r + 1 : ringCount - 1;
        if (rUp !== r) neighbors.push(rUp * cellsPerRing + c);
        if (rDn !== r) neighbors.push(rDn * cellsPerRing + c);
        adj[i] = neighbors;
      }
    }
    this._adjacency = adj;
    this._adjacencyKey = `${ringCount}|${cellsPerRing}`;
    return adj;
  }

  // PROPOSAL-CAVITY-MESH Phase 4 Tranche 4a — true per-vertex
  // Laplacian diffusion over the mesh. Each vertex has its own fluid
  // (un-aliased in bindRingChemistry); the Laplacian relaxes each
  // cell toward its mesh neighbors independently.
  //
  // Tranches 1-2 had dedup-by-fluid-identity because aliased cells
  // shared a fluid object per ring; the dedup recovered legacy ring-
  // Laplacian behavior. Tranche 4a removes the alias, so every cell
  // gets its own update — the Laplacian now operates as a true 2D
  // mesh diffusion over the cavity surface. Same-ring vertices
  // relax toward each other (and toward adjacent rings), instead of
  // being locked to a single ring-averaged pool.
  //
  // Math: for vertex i with neighbors {j₁, j₂, …}, the update is
  //   cells[i].fluid[f] += rate * (Σⱼ cells[j].fluid[f] - degree·cells[i].fluid[f]).
  // Snapshot first so each vertex reads pre-step neighbor values.
  diffuse(rate, fieldNames) {
    if (!(rate > 0)) return;
    if (!this.cells || !this.cells.length) return;
    if (!fieldNames || !fieldNames.length) return;
    const ringCount = this.maxRadiusByRing
      ? this.maxRadiusByRing.length
      : 1;
    const cellsPerRing = ringCount > 0
      ? this.numInterior / ringCount
      : 0;
    if (cellsPerRing <= 0) return;
    const adj = this._buildAdjacency(ringCount, cellsPerRing);
    // Snapshot every cell's pre-step field values so neighbors read
    // pre-update state. Use a flat Float64Array indexed by
    // (cellIdx * fieldCount + fieldOffset) for tight inner-loop reads.
    const F = fieldNames.length;
    const snap = new Float64Array(this.numInterior * F);
    for (let i = 0; i < this.numInterior; i++) {
      const fluid = this.cells[i].fluid;
      if (!fluid) continue;
      const base = i * F;
      for (let k = 0; k < F; k++) snap[base + k] = fluid[fieldNames[k]];
    }
    // Apply Laplacian per-vertex.
    for (let i = 0; i < this.numInterior; i++) {
      const fluid = this.cells[i].fluid;
      if (!fluid) continue;
      const neighbors = adj[i];
      const degree = neighbors.length;
      if (degree === 0) continue;
      const selfBase = i * F;
      for (let k = 0; k < F; k++) {
        let neighborSum = 0;
        for (let nIdx = 0; nIdx < degree; nIdx++) {
          neighborSum += snap[neighbors[nIdx] * F + k];
        }
        fluid[fieldNames[k]] = snap[selfBase + k]
          + rate * (neighborSum - degree * snap[selfBase + k]);
      }
    }
  }

  // PROPOSAL-CAVITY-MESH Phase 4 Tranche 4a — propagate a global
  // chemistry delta (from an event that mutated conditions.fluid)
  // to every cell. Post-un-aliasing each cell has its own fluid
  // object; events that affect "the global broth" need to apply to
  // every cell (the per-vertex equivalent of "all rings see the
  // delta"). The equatorFluid skip from Tranche 2 is dropped — no
  // cell is aliased to conditions.fluid anymore, so all cells take
  // the delta.
  //
  // Events still mutate conditions.fluid via the legacy
  // ring_fluids[equator] === conditions.fluid alias, so conditions.fluid
  // and ring_fluids[equator] reflect the new value. propagateDelta
  // then applies the same delta to every cell's independent storage.
  propagateDelta(preFluid, fieldNames, _equatorFluid, replaceFields: string[] = []) {
    if (!this.cells || !this.cells.length) return;
    if (!preFluid || !fieldNames || !fieldNames.length) return;
    // Pre-compute the per-field delta once; ignore unchanged fields.
    const deltas: number[] = [];
    const dirty: number[] = [];
    const replace = new Set(replaceFields || []);
    for (let k = 0; k < fieldNames.length; k++) {
      // _equatorFluid is the post-event value (aliased to
      // conditions.fluid); subtract preFluid to get the delta.
      const delta = (_equatorFluid ? _equatorFluid[fieldNames[k]] : 0)
                  - (preFluid ? preFluid[fieldNames[k]] : 0);
      if (delta !== 0 || replace.has(fieldNames[k])) {
        deltas.push(delta);
        dirty.push(k);
      }
    }
    if (!dirty.length) return;
    for (let i = 0; i < this.numInterior; i++) {
      const fluid = this.cells[i].fluid;
      if (!fluid) continue;
      const explicitSulfurHandled = propagateExplicitSulfurPoolDelta(
        fluid,
        preFluid,
        _equatorFluid,
        replaceFields,
      );
      for (let d = 0; d < dirty.length; d++) {
        const fname = fieldNames[dirty[d]];
        if (explicitSulfurHandled && (fname === 'S' || fname === 'S_sulfide'
            || fname === 'S_sulfate' || fname === 'S_elemental')) continue;
        const next = replace.has(fname) ? _equatorFluid[fname] : fluid[fname] + deltas[d];
        // SIM 220 — concentrations floor at 0 (mirror of the canonical
        // voxel-grid clamp in js/24 propagateEventDelta; this is the
        // mesh-only fallback path). pH/Eh are signed — unclamped.
        fluid[fname] = (next < 0 && fname !== 'pH' && fname !== 'Eh') ? 0 : next;
      }
    }
  }

  // PROPOSAL-CAVITY-MESH Phase 4 Tranche 1 — resolve a crystal's
  // anchor to its mesh cell. Returns the cell object directly so
  // callers can read .fluid / .temperature_ring. Returns null for
  // unanchored crystals or out-of-range anchors.
  //
  // Vertex layout invariant: cells[r * cellsPerRing + c] is the cell
  // for ring r, cell c (the lat-long row-major order from
  // fromWallState). Phase 4 Tranche 4+ swaps this to a kd-tree over
  // (phi, theta) but the call signature is stable.
  cellOf(crystal, wall) {
    if (!crystal || !this.cells || !this.cells.length) return null;
    const idx = wall && wall.chemistryVertexForCrystal
      ? wall.chemistryVertexForCrystal(crystal) : -1;
    if (idx < 0 || idx >= this.cells.length) return null;
    return this.cells[idx];
  }

  // Index-buffer build. Pulled out so subclasses with alternate
  // tessellations can override _buildIndices in isolation while
  // reusing the rest of the structure pass.
  _buildIndices(ringCount, N) {
    const indices: number[] = [];
    // South cap: fan from south pole to ring 0.
    for (let c = 0; c < N; c++) {
      const cNext = (c + 1) % N;
      indices.push(this.southIdx, cNext, c);  // wind outward
    }
    // Inter-ring quads.
    for (let k = 0; k < ringCount - 1; k++) {
      for (let c = 0; c < N; c++) {
        const cNext = (c + 1) % N;
        const a = k * N + c;
        const b = k * N + cNext;
        const c2 = (k + 1) * N + c;
        const d = (k + 1) * N + cNext;
        indices.push(a, b, c2);
        indices.push(b, d, c2);
      }
    }
    // North cap: fan from ring N-1 to north pole.
    for (let c = 0; c < N; c++) {
      const cNext = (c + 1) % N;
      indices.push(this.northIdx, (ringCount - 1) * N + c, (ringCount - 1) * N + cNext);
    }
    this.indices = indices;
  }

  // Rebuild triangle areas, centroids and outward normals from the exact
  // position/index buffers consumed by the renderer. A triangle can be
  // fractionally weighted at a patch boundary; this lets covered area close
  // exactly to target coverage without pretending that a coarse boundary
  // triangle is either wholly bare or wholly coated.
  _recomputeSurfaceMetrics() {
    const positions = this.positions;
    const indices = this.indices;
    const triangles: any[] = [];
    const incidentTriangleByVertex: any[] = new Array(this.numInterior);
    let totalArea = 0;
    if (!positions || !indices) {
      this.surface_area_mm2 = 0;
      this._surfaceTriangles = triangles;
      return;
    }
    for (let offset = 0; offset + 2 < indices.length; offset += 3) {
      const ia = indices[offset], ib = indices[offset + 1], ic = indices[offset + 2];
      const ax = positions[ia * 3], ay = positions[ia * 3 + 1], az = positions[ia * 3 + 2];
      const bx = positions[ib * 3], by = positions[ib * 3 + 1], bz = positions[ib * 3 + 2];
      const cx = positions[ic * 3], cy = positions[ic * 3 + 1], cz = positions[ic * 3 + 2];
      const abx = bx - ax, aby = by - ay, abz = bz - az;
      const acx = cx - ax, acy = cy - ay, acz = cz - az;
      let nx = aby * acz - abz * acy;
      let ny = abz * acx - abx * acz;
      let nz = abx * acy - aby * acx;
      const crossLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const area = crossLen * 0.5;
      if (!(area > 1e-12)) continue;
      nx /= crossLen; ny /= crossLen; nz /= crossLen;
      let mx = (ax + bx + cx) / 3;
      let my = (ay + by + cy) / 3;
      let mz = (az + bz + cz) / 3;
      const ml = Math.sqrt(mx * mx + my * my + mz * mz) || 1;
      // Indices should wind away from the cavity centre. Defensively make
      // that convention explicit so the returned growth normal can always
      // be the opposite, cavity-facing direction.
      if (nx * mx + ny * my + nz * mz < 0) {
        nx = -nx; ny = -ny; nz = -nz;
      }
      mx /= ml; my /= ml; mz /= ml;
      triangles.push({
        triangle_index: offset / 3,
        ia, ib, ic, area_mm2: area,
        centroid_dir: [mx, my, mz],
        outward_normal: [nx, ny, nz],
      });
      totalArea += area;
      const triangleIndex = offset / 3;
      if (ia < this.numInterior && !incidentTriangleByVertex[ia]) {
        incidentTriangleByVertex[ia] = { triangleIndex, barycentric: [1, 0, 0] };
      }
      if (ib < this.numInterior && !incidentTriangleByVertex[ib]) {
        incidentTriangleByVertex[ib] = { triangleIndex, barycentric: [0, 1, 0] };
      }
      if (ic < this.numInterior && !incidentTriangleByVertex[ic]) {
        incidentTriangleByVertex[ic] = { triangleIndex, barycentric: [0, 0, 1] };
      }
    }
    // Build edge adjacency once with the geometry. Surface fabrics then grow
    // out from their anchor as one edge-connected swath instead of selecting
    // merely nearby, but potentially disconnected, triangles on an irregular
    // multi-lobed cavity.
    const edgeOwners = new Map<string, any[]>();
    for (const triangle of triangles) {
      triangle.neighbor_indices = [];
      const edges = [[triangle.ia, triangle.ib], [triangle.ib, triangle.ic], [triangle.ic, triangle.ia]];
      for (const edge of edges) {
        const lo = Math.min(edge[0], edge[1]);
        const hi = Math.max(edge[0], edge[1]);
        const key = `${lo}:${hi}`;
        const owners = edgeOwners.get(key) || [];
        owners.push(triangle);
        edgeOwners.set(key, owners);
      }
    }
    edgeOwners.forEach((owners) => {
      if (owners.length < 2) return;
      for (const a of owners) {
        for (const b of owners) {
          if (a !== b && !a.neighbor_indices.includes(b.triangle_index)) {
            a.neighbor_indices.push(b.triangle_index);
          }
        }
        a.neighbor_indices.sort((x, y) => x - y);
      }
    });
    this.surface_area_mm2 = totalArea;
    this._surfaceTriangles = triangles;
    const voidNormals = new Float32Array(this.numInterior * 3);
    for (const triangle of triangles) {
      for (const vertexIndex of [triangle.ia, triangle.ib, triangle.ic]) {
        if (vertexIndex >= this.numInterior) continue;
        const base = vertexIndex * 3;
        voidNormals[base] -= triangle.outward_normal[0] * triangle.area_mm2;
        voidNormals[base + 1] -= triangle.outward_normal[1] * triangle.area_mm2;
        voidNormals[base + 2] -= triangle.outward_normal[2] * triangle.area_mm2;
      }
    }
    for (let vertexIndex = 0; vertexIndex < this.numInterior; vertexIndex++) {
      const base = vertexIndex * 3;
      const length = Math.hypot(
        voidNormals[base], voidNormals[base + 1], voidNormals[base + 2],
      );
      if (!(length > 1e-12)) throw new RangeError('WallMesh vertex has no defined void normal');
      voidNormals[base] /= length;
      voidNormals[base + 1] /= length;
      voidNormals[base + 2] /= length;
    }
    this._voidNormalsByVertex = voidNormals;
    this._incidentTriangleByVertex = incidentTriangleByVertex;
    this._cellSurfaceAreasSig = null;
    this._cellSurfaceAreas = null;
    this._geodesicCache = new Map();
    this._geodesicAdjacency = null;
  }

  // Exact enclosed volume of the closed triangle surface consumed by the
  // renderer. The absolute oriented-tetrahedron sum is the geometry authority
  // for mass-balanced wall evolution; it deliberately does not approximate the
  // surface as independent spherical wedges.
  closedVolumeMm3(positionsOverride?: Float32Array | Float64Array): number {
    const positions = positionsOverride || this.positions;
    if (!positions || !this.indices) return 0;
    let signedSixVolume = 0;
    for (let offset = 0; offset + 2 < this.indices.length; offset += 3) {
      const ia = this.indices[offset] * 3;
      const ib = this.indices[offset + 1] * 3;
      const ic = this.indices[offset + 2] * 3;
      const ax = positions[ia], ay = positions[ia + 1], az = positions[ia + 2];
      const bx = positions[ib], by = positions[ib + 1], bz = positions[ib + 2];
      const cx = positions[ic], cy = positions[ic + 1], cz = positions[ic + 2];
      signedSixVolume += ax * (by * cz - bz * cy)
        + ay * (bz * cx - bx * cz)
        + az * (bx * cy - by * cx);
    }
    const volume = Math.abs(signedSixVolume) / 6;
    if (!Number.isFinite(volume)) throw new RangeError('wall mesh volume is non-finite');
    return volume;
  }

  // Allocate every triangle's area to mutable wall cells. A normal vertex gets
  // one third of an incident triangle. Pole vertices have no WallCell, so their
  // one-third share is split equally between the two adjacent cap vertices.
  // The returned areas therefore sum exactly to surface_area_mm2.
  cellSurfaceAreasMm2(): Float64Array {
    if (this._cellSurfaceAreas && this._cellSurfaceAreasSig === this.sig) {
    return new Float64Array(this._cellSurfaceAreas);
  }

    const areas = new Float64Array(this.numInterior);
    const p = this.positions;
    for (let offset = 0; offset + 2 < this.indices.length; offset += 3) {
      const ids = [this.indices[offset], this.indices[offset + 1], this.indices[offset + 2]];
      const a = ids[0] * 3, b = ids[1] * 3, c = ids[2] * 3;
      const abx = p[b] - p[a], aby = p[b + 1] - p[a + 1], abz = p[b + 2] - p[a + 2];
      const acx = p[c] - p[a], acy = p[c + 1] - p[a + 1], acz = p[c + 2] - p[a + 2];
      const nx = aby * acz - abz * acy;
      const ny = abz * acx - abx * acz;
      const nz = abx * acy - aby * acx;
      const area = 0.5 * Math.hypot(nx, ny, nz);
      if (!(area > 0) || !Number.isFinite(area)) continue;
      const interior = ids.filter((id) => id < this.numInterior);
      for (const id of interior) areas[id] += area / 3;
      const poleCount = 3 - interior.length;
      if (poleCount && interior.length) {
        const share = (area / 3) * poleCount / interior.length;
        for (const id of interior) areas[id] += share;
      }
    }
    const sum = areas.reduce((acc, value) => acc + value, 0);
    const tolerance = Math.max(1e-9, Math.abs(this.surface_area_mm2) * 1e-10);
    if (Math.abs(sum - this.surface_area_mm2) > tolerance) {
      throw new RangeError('wall-cell surface areas do not close to the rendered mesh area');
    }
    this._cellSurfaceAreas = new Float64Array(areas);
    this._cellSurfaceAreasSig = this.sig;
    return areas;
  }

  // Hot-path scalar accessor. The bulk method above intentionally returns a
  // defensive copy; growth/local-fill code that needs one vertex must not
  // allocate and copy all ~1,920 areas for every crystal on every step.
  cellSurfaceAreaAtVertexMm2(vertexIndex: number): number {
    if (!Number.isInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= this.numInterior) {
      return 0;
    }
    if (!this._cellSurfaceAreas || this._cellSurfaceAreasSig !== this.sig) {
      this.cellSurfaceAreasMm2();
    }
    return Number(this._cellSurfaceAreas?.[vertexIndex]) || 0;
  }

  incidentTriangleForVertex(vertexIndex: number): any {
    if (!Number.isInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= this.numInterior) {
      return null;
    }
    const receipt = this._incidentTriangleByVertex?.[vertexIndex];
    return receipt ? {
      triangleIndex: receipt.triangleIndex,
      barycentric: receipt.barycentric.slice(),
    } : null;
  }

  // Candidate geometry for a sparse/dense set of raw WallCell depth deltas.
  // Each interior vertex moves along its already-rendered ray by delta times
  // the same polar factor used by recompute(). Pole movement follows the
  // renderer's nearest-ring mean-depth rule exactly.
  positionsWithDepthDeltas(wall: any, depthDeltas: ArrayLike<number>): Float32Array {
    if (!wall || !depthDeltas || depthDeltas.length !== this.numInterior) {
      throw new RangeError('candidate wall-depth deltas must match the mesh interior vertex count');
    }
    // Match the renderer-facing buffer type exactly. Quantizing during preview
    // prevents the ledger from conserving a double-precision surface that the
    // actual BufferGeometry cannot reproduce on the next recompute.
    const out = new Float32Array(this.positions.length);
    const N = wall.cells_per_ring;
    const R = wall.ring_count;
    for (let index = 0; index < this.numInterior; index++) {
      const delta = Number(depthDeltas[index]);
      if (!Number.isFinite(delta)) throw new TypeError('candidate wall-depth delta is non-finite');
      const ringIdx = Math.floor(index / N);
      const cellIdx = index % N;
      const phi = Math.PI * (ringIdx + 0.5) / R;
      const polar = wall.polarProfileFactor ? wall.polarProfileFactor(phi) : 1;
      const twist = wall.ringTwistRadians ? wall.ringTwistRadians(phi) : 0;
      const cell = wall.rings[ringIdx][cellIdx];
      const baseRadius = cell && cell.base_radius_mm > 0
        ? cell.base_radius_mm : wall.initial_radius_mm;
      const radius = (baseRadius + (Number(cell.wall_depth) || 0) + delta) * polar;
      if (!(radius > 0) || !Number.isFinite(radius)) {
        throw new RangeError('candidate wall-depth delta collapses or invalidates a vertex');
      }
      const theta = 2 * Math.PI * cellIdx / N + twist;
      const sinPhi = Math.sin(phi);
      const base = index * 3;
      out[base] = radius * sinPhi * Math.cos(theta);
      out[base + 1] = -radius * Math.cos(phi);
      out[base + 2] = radius * sinPhi * Math.sin(theta);
    }
    const shiftPole = (vertexIndex: number, ringIdx: number, phi: number, sign: number) => {
      let meanDepth = 0;
      for (let c = 0; c < N; c++) {
        meanDepth += (Number(wall.rings[ringIdx][c].wall_depth) || 0)
          + Number(depthDeltas[ringIdx * N + c]);
      }
      meanDepth /= N;
      const polar = wall.polarProfileFactor ? wall.polarProfileFactor(phi) : 1;
      const sourceRadius = Array.isArray(wall.bubbles) && wall.bubbles.length
        ? _raycastUnion3D(wall.bubbles, 0, sign, 0) : wall.initial_radius_mm;
      const shape = wall._cavity_shape || wall;
      const baseRadius = sourceRadius * _cavityRadialScale(shape, phi, 0);
      out[vertexIndex * 3] = 0;
      out[vertexIndex * 3 + 1] = sign * (baseRadius + meanDepth * polar);
      out[vertexIndex * 3 + 2] = 0;
    };
    shiftPole(this.southIdx, 0, 0, -1);
    shiftPole(this.northIdx, R - 1, Math.PI, 1);
    return out;
  }

  closedVolumeWithDepthDeltasMm3(wall: any, depthDeltas: ArrayLike<number>): number {
    return this.closedVolumeMm3(this.positionsWithDepthDeltas(wall, depthDeltas));
  }

  // Shortest paths along the actual triangle edges provide a physical
  // surface-distance metric for shielding footprints and feeder flux. Cached
  // by geometry signature and source vertex; erosion invalidates the cache via
  // _recomputeSurfaceMetrics().
  geodesicDistancesFrom(sourceVertex: number): Float64Array {
    return new Float64Array(this._geodesicDistancesFromInternal(sourceVertex));
  }

  _geodesicDistancesFromInternal(sourceVertex: number): Float64Array {
    if (!Number.isInteger(sourceVertex) || sourceVertex < 0 || sourceVertex >= this.numInterior) {
      throw new RangeError('geodesic source must be an interior wall vertex');
    }
    if (!this._geodesicCache) this._geodesicCache = new Map();
    const cached = this._geodesicCache.get(sourceVertex);
    if (cached) return cached;
    const vertexCount = this.numInterior + 2;
    if (!this._geodesicAdjacency) {
      const adjacency: Array<Map<number, number>> = Array.from(
        { length: vertexCount }, () => new Map<number, number>(),
      );
      const addEdge = (a: number, b: number) => {
        if (a === b) return;
        const ai = a * 3, bi = b * 3;
        const length = Math.hypot(
          this.positions[ai] - this.positions[bi],
          this.positions[ai + 1] - this.positions[bi + 1],
          this.positions[ai + 2] - this.positions[bi + 2],
        );
        const prior = adjacency[a].get(b);
        if (prior == null || length < prior) {
          adjacency[a].set(b, length);
          adjacency[b].set(a, length);
        }
      };
      for (let offset = 0; offset + 2 < this.indices.length; offset += 3) {
        const a = this.indices[offset], b = this.indices[offset + 1], c = this.indices[offset + 2];
        addEdge(a, b); addEdge(b, c); addEdge(c, a);
      }
      this._geodesicAdjacency = adjacency.map(edges => Array.from(edges.entries()));
    }
    const distances = new Float64Array(vertexCount);
    distances.fill(Infinity);
    distances[sourceVertex] = 0;
    const heap: Array<[number, number]> = [[0, sourceVertex]];
    const push = (item: [number, number]) => {
      let index = heap.length;
      heap.push(item);
      while (index > 0) {
        const parent = (index - 1) >> 1;
        if (heap[parent][0] <= item[0]) break;
        heap[index] = heap[parent];
        index = parent;
      }
      heap[index] = item;
    };
    const pop = (): [number, number] | null => {
      if (!heap.length) return null;
      const root = heap[0];
      const tail = heap.pop();
      if (heap.length && tail) {
        let index = 0;
        while (true) {
          const left = index * 2 + 1;
          const right = left + 1;
          if (left >= heap.length) break;
          const child = right < heap.length && heap[right][0] < heap[left][0] ? right : left;
          if (heap[child][0] >= tail[0]) break;
          heap[index] = heap[child];
          index = child;
        }
        heap[index] = tail;
      }
      return root;
    };
    while (heap.length) {
      const item = pop();
      if (!item) break;
      const distance = item[0], current = item[1];
      if (distance !== distances[current]) continue;
      for (const [neighbor, length] of this._geodesicAdjacency[current]) {
        const candidate = distance + length;
        if (candidate < distances[neighbor]) {
          distances[neighbor] = candidate;
          push([candidate, neighbor]);
        }
      }
    }
    const interior = distances.slice(0, this.numInterior);
    if (Array.from(interior).some(value => !Number.isFinite(value))) {
      throw new RangeError('wall mesh geodesic graph is disconnected');
    }
    this._geodesicCache.set(sourceVertex, new Float64Array(interior));
    return this._geodesicCache.get(sourceVertex);
  }

  verticesWithinGeodesicRadius(sourceVertex: number, radiusMm: number): number[] {
    const radius = Number(radiusMm);
    if (!(radius >= 0) || !Number.isFinite(radius)) {
      throw new RangeError('geodesic radius must be finite and non-negative');
    }
    const distances = this._geodesicDistancesFromInternal(sourceVertex);
    const vertices: number[] = [];
    for (let index = 0; index < distances.length; index++) {
      if (distances[index] <= radius + 1e-10) vertices.push(index);
    }
    return vertices;
  }

  geodesicDistanceBetween(sourceVertex: number, targetVertex: number): number {
    if (!Number.isInteger(targetVertex) || targetVertex < 0 || targetVertex >= this.numInterior) {
      throw new RangeError('geodesic target must be an interior wall vertex');
    }
    return this._geodesicDistancesFromInternal(sourceVertex)[targetVertex];
  }

  surfaceAreaMm2() {
    return Number(this.surface_area_mm2) || 0;
  }

  voidNormalAtVertex(vertexIndex: number): [number, number, number] | null {
    if (!Number.isInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= this.numInterior
        || !this._voidNormalsByVertex) return null;
    const base = vertexIndex * 3;
    return [
      this._voidNormalsByVertex[base],
      this._voidNormalsByVertex[base + 1],
      this._voidNormalsByVertex[base + 2],
    ];
  }

  // Select the closest triangle swath around an anchor direction until its
  // area equals the requested fraction of the exact wall area. The final
  // triangle carries a fractional physical weight when necessary.
  surfacePatch(anchorDirection, targetCoverage) {
    const raw = Array.isArray(anchorDirection) ? anchorDirection : [0, 1, 0];
    const al = Math.sqrt(raw[0] * raw[0] + raw[1] * raw[1] + raw[2] * raw[2]) || 1;
    const anchor = [raw[0] / al, raw[1] / al, raw[2] / al];
    const coverage = Math.max(0, Math.min(1, Number(targetCoverage) || 0));
    const targetArea = this.surfaceAreaMm2() * coverage;
    if (!(targetArea > 0) || !this._surfaceTriangles.length) {
      return { anchor, coverage_fraction: coverage, area_mm2: 0, triangles: [] };
    }
    const ranked = this._surfaceTriangles.map((t) => ({
      triangle: t,
      score: t.centroid_dir[0] * anchor[0]
        + t.centroid_dir[1] * anchor[1]
        + t.centroid_dir[2] * anchor[2],
    }));
    ranked.sort((a, b) => (b.score - a.score)
      || (a.triangle.triangle_index - b.triangle.triangle_index));
    const selected: any[] = [];
    const rankedByIndex = new Map(ranked.map((item) => [item.triangle.triangle_index, item]));
    const visited = new Set<number>();
    const queued = new Set<number>();
    const frontier: any[] = [];
    const enqueue = (item: any) => {
      if (!item) return;
      const index = item.triangle.triangle_index;
      if (visited.has(index) || queued.has(index)) return;
      frontier.push(item);
      queued.add(index);
    };
    enqueue(ranked[0]);
    let remaining = targetArea;
    while (remaining > 1e-12 && selected.length < ranked.length) {
      // Highest anchor affinity among triangles touching the existing patch.
      // The triangle index tie-break makes the patch replay-deterministic.
      frontier.sort((a, b) => (b.score - a.score)
        || (a.triangle.triangle_index - b.triangle.triangle_index));
      let item = frontier.shift();
      if (!item) {
        // Defensive recovery for a malformed/disconnected mesh. Production
        // WallMesh tessellations are closed and connected, so this branch is
        // not used by a valid cavity.
        item = ranked.find((candidate) => !visited.has(candidate.triangle.triangle_index));
        if (!item) break;
      }
      const index = item.triangle.triangle_index;
      queued.delete(index);
      if (visited.has(index)) continue;
      visited.add(index);
      const weight = Math.min(item.triangle.area_mm2, remaining);
      selected.push({ ...item.triangle, weight_mm2: weight });
      remaining -= weight;
      for (const neighborIndex of item.triangle.neighbor_indices || []) {
        enqueue(rankedByIndex.get(neighborIndex));
      }
    }
    return {
      anchor,
      coverage_fraction: coverage,
      area_mm2: targetArea - Math.max(0, remaining),
      triangles: selected,
    };
  }

  _surfaceSampleUnit(seed, index, channel) {
    let x = ((Number(seed) | 0) ^ Math.imul((index + 1) | 0, 0x9e3779b1)
      ^ Math.imul((channel + 11) | 0, 0x85ebca6b)) >>> 0;
    x ^= x >>> 16;
    x = Math.imul(x, 0x7feb352d) >>> 0;
    x ^= x >>> 15;
    x = Math.imul(x, 0x846ca68b) >>> 0;
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }

  // Deterministic, area-weighted points on the exact triangle patch. The
  // returned normals face into the cavity, which is the mineral-growth
  // direction. Desktop/mobile can request different counts without changing
  // the patch, area, mass, or layer identity.
  sampleSurfacePatch(anchorDirection, count, targetCoverage, seed) {
    const patch = this.surfacePatch(anchorDirection, targetCoverage);
    const n = Math.max(0, Number(count) | 0);
    const samples: any[] = [];
    if (!n || !(patch.area_mm2 > 0) || !patch.triangles.length || !this.positions) {
      return { ...patch, samples, triangle_indices: [] };
    }
    const cumulative: number[] = [];
    let sum = 0;
    for (const t of patch.triangles) {
      sum += t.weight_mm2;
      cumulative.push(sum);
    }
    const phase = this._surfaceSampleUnit(seed, 0, 97);
    const golden = 0.6180339887498949;
    for (let i = 0; i < n; i++) {
      const target = (((i + 0.5) * golden + phase) % 1) * sum;
      let lo = 0, hi = cumulative.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cumulative[mid] < target) lo = mid + 1;
        else hi = mid;
      }
      const t = patch.triangles[lo];
      const u = this._surfaceSampleUnit(seed, i, 1);
      const v = this._surfaceSampleUnit(seed, i, 2);
      const su = Math.sqrt(u);
      const wa = 1 - su, wb = su * (1 - v), wc = su * v;
      const p = this.positions;
      samples.push({
        x: wa * p[t.ia * 3] + wb * p[t.ib * 3] + wc * p[t.ic * 3],
        y: wa * p[t.ia * 3 + 1] + wb * p[t.ib * 3 + 1] + wc * p[t.ic * 3 + 1],
        z: wa * p[t.ia * 3 + 2] + wb * p[t.ib * 3 + 2] + wc * p[t.ic * 3 + 2],
        nx: -t.outward_normal[0],
        ny: -t.outward_normal[1],
        nz: -t.outward_normal[2],
        triangle_index: t.triangle_index,
      });
    }
    return {
      ...patch,
      samples,
      triangle_indices: patch.triangles.map((t) => t.triangle_index),
    };
  }

  // ---- Cache fingerprint ----
  //
  // Exact invalidation fingerprint shared with the renderer. Production
  // WallState cells advance a monotonic revision from their wall_depth and
  // base_radius_mm setters, so every position-affecting write is represented
  // and cache reads stay O(1). Plain snapshot/test walls have no revision; for
  // those, every cell radius participates in the exact fallback hash. Sampling
  // a few cells is never sufficient once surface area and coating thickness
  // are scientific state.
  static _signature(wall, sim) {
    if (!wall || !wall.rings || !wall.rings.length) return '';
    const ring0 = wall.rings[0];
    const N = ring0 ? ring0.length : 0;
    if (Number.isSafeInteger(wall._geometry_revision)) {
      return `${wall.ring_count}|${N}|rev:${wall._geometry_revision}`;
    }
    let hashA = 0x811c9dc5;
    let hashB = 0x9e3779b9;
    const scratch = new DataView(new ArrayBuffer(8));
    for (let r = 0; r < wall.rings.length; r++) {
      const ring = wall.rings[r];
      if (!ring) continue;
      for (let c = 0; c < N; c++) {
        const cell = ring[c];
        if (!cell) continue;
        const radius = (Number(cell.base_radius_mm) || 0) + (Number(cell.wall_depth) || 0);
        scratch.setFloat64(0, radius, true);
        for (let byte = 0; byte < 8; byte++) {
          const value = scratch.getUint8(byte);
          hashA = Math.imul(hashA ^ value, 0x01000193) >>> 0;
          hashB = (Math.imul(hashB ^ value, 0x85ebca6b) + 0x27d4eb2f) >>> 0;
        }
      }
    }
    return `${wall.ring_count}|${N}|${hashA.toString(16).padStart(8, '0')}${hashB.toString(16).padStart(8, '0')}`;
  }

  // ---- Recompute (cheap when stale, no-op when fresh) ----
  recomputeIfStale(wall, sim?) {
    const sig = WallMesh._signature(wall, sim);
    if (sig === this.sig) return false;
    this.recompute(wall, sim);
    return true;
  }

  // Per-vertex (x, y, z) + per-vertex color, computed from the wall's
  // current state. Math mirrors _topoBuildCavityGeometry from
  // 99i-renderer-three.ts verbatim so the byte-identical claim is
  // line-for-line auditable.
  recompute(wall, sim?) {
    if (!wall || !wall.rings || !wall.rings.length) return;
    const ringCount = wall.ring_count;
    const ring0 = wall.rings[0];
    const N = ring0 ? ring0.length : 0;
    if (!N || ringCount < 1) return;
    const initR = wall.initial_radius_mm || 25;

    // Color palette — must match the renderer's palette exactly.
    const hexToRgb = (hex) => [
      ((hex >> 16) & 0xff) / 255,
      ((hex >> 8) & 0xff) / 255,
      (hex & 0xff) / 255,
    ];
    const wallColors = {
      floor:   hexToRgb(0xA85820),
      wall:    hexToRgb(0xD2691E),
      ceiling: hexToRgb(0xE8782C),
    };
    const positions = this.positions;
    const colors = this.colors;
    const normals = this.normals;
    let maxR2 = 0;
    if (this.maxRadiusByRing && this.maxRadiusByRing.length !== ringCount) {
      this.maxRadiusByRing = new Float32Array(ringCount);
    } else if (this.maxRadiusByRing) {
      this.maxRadiusByRing.fill(0);
    }

    // Place interior ring × cell vertices.
    for (let r = 0; r < ringCount; r++) {
      const phi = Math.PI * (r + 0.5) / ringCount;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const polar = wall.polarProfileFactor ? wall.polarProfileFactor(phi) : 1.0;
      const twist = wall.ringTwistRadians ? wall.ringTwistRadians(phi) : 0.0;
      const ring = wall.rings[r];
      const orient = wall.ringOrientation ? wall.ringOrientation(r) : 'wall';
      const baseColor = wallColors[orient] || wallColors.wall;
      let ringMaxR2 = 0;
      for (let c = 0; c < N; c++) {
        const cell = ring && ring[c];
        const baseR = cell && cell.base_radius_mm > 0 ? cell.base_radius_mm : initR;
        const depth = cell ? cell.wall_depth : 0;
        const radiusMm = (baseR + depth) * polar;
        const theta = (2 * Math.PI * c) / N + twist;
        const x = radiusMm * sinPhi * Math.cos(theta);
        const y = -radiusMm * cosPhi;  // south at -y, north at +y
        const z = radiusMm * sinPhi * Math.sin(theta);
        const idx = r * N + c;
        positions[idx * 3 + 0] = x;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = z;
        colors[idx * 3 + 0] = baseColor[0];
        colors[idx * 3 + 1] = baseColor[1];
        colors[idx * 3 + 2] = baseColor[2];
        const len = Math.sqrt(x * x + y * y + z * z) || 1;
        normals[idx * 3 + 0] = x / len;
        normals[idx * 3 + 1] = y / len;
        normals[idx * 3 + 2] = z / len;
        const r2 = x * x + y * y + z * z;
        if (r2 > maxR2) maxR2 = r2;
        if (r2 > ringMaxR2) ringMaxR2 = r2;
      }
      if (this.maxRadiusByRing) this.maxRadiusByRing[r] = Math.sqrt(ringMaxR2);
    }

    // Pole caps — average ring radius at nearest ring, projected to
    // the pole axis. Color borrows the nearest ring's orientation
    // tint directly (close enough at the cap; cheaper than averaging
    // the per-cell colors).
    const meanRingRadius = (rIdx) => {
      const ring = wall.rings[rIdx];
      if (!ring) return initR;
      let sum = 0;
      for (let c = 0; c < N; c++) {
        const cell = ring[c];
        sum += (cell && cell.base_radius_mm > 0 ? cell.base_radius_mm : initR)
               + (cell ? cell.wall_depth : 0);
      }
      return sum / N;
    };
    const meanRingDepth = (rIdx) => {
      const ring = wall.rings[rIdx];
      if (!ring) return 0;
      let sum = 0;
      for (let c = 0; c < N; c++) sum += ring[c] ? ring[c].wall_depth : 0;
      return sum / N;
    };
    // W-K V0 fix (2026-07-03): the caps must honor the polar profile like
    // every ring vertex does (line ~519), or a flattened/collapsed cavity
    // grows a full-radius NEEDLE at each pole: the cleft lens (polar factor
    // q ≈ 0.22 at the poles) would spike through both flat faces, and the
    // basin archetype has quietly carried the same wart at its pinched
    // north pole (sigmoid ≈ 0.05 at φ=π, cap at ~full mean radius). For
    // every legacy scenario the 3D builder zeroes the Fourier amplitudes,
    // so polarProfileFactor(0) = polarProfileFactor(π) = 1.0 — caps
    // byte-identical.
    const southPolar = wall.polarProfileFactor ? wall.polarProfileFactor(0) : 1.0;
    const northPolar = wall.polarProfileFactor ? wall.polarProfileFactor(Math.PI) : 1.0;
    const poleBaseRadius = (dy, phi, fallback) => {
      if (!Array.isArray(wall.bubbles) || !wall.bubbles.length) return fallback;
      const sourceRadius = _raycastUnion3D(wall.bubbles, 0, dy, 0);
      if (!(sourceRadius > 0)) return fallback;
      const shape = wall._cavity_shape || wall;
      return sourceRadius * _cavityRadialScale(shape, phi, 0);
    };
    // Put the authored base cap on the same analytic zero set as the Cartesian
    // field. The legacy mean-ring*cos(half-step) approximation sat measurably
    // inside even a sphere. Live wall_depth has no pole cell, so retain the
    // prior nearest-ring mean as its explicitly approximate contribution.
    const southDepth = meanRingDepth(0);
    const northDepth = meanRingDepth(ringCount - 1);
    const southFallback = (meanRingRadius(0) - southDepth)
      * Math.cos(Math.PI / (2 * ringCount)) * southPolar;
    const northFallback = (meanRingRadius(ringCount - 1) - northDepth)
      * Math.cos(Math.PI / (2 * ringCount)) * northPolar;
    const southR = poleBaseRadius(-1, 0, southFallback) + southDepth * southPolar;
    const northR = poleBaseRadius(+1, Math.PI, northFallback)
      + northDepth * northPolar;
    positions[this.southIdx * 3 + 0] = 0;
    positions[this.southIdx * 3 + 1] = -southR;
    positions[this.southIdx * 3 + 2] = 0;
    positions[this.northIdx * 3 + 0] = 0;
    positions[this.northIdx * 3 + 1] = +northR;
    positions[this.northIdx * 3 + 2] = 0;
    const southOrient = wall.ringOrientation ? wall.ringOrientation(0) : 'floor';
    const northOrient = wall.ringOrientation ? wall.ringOrientation(ringCount - 1) : 'ceiling';
    const southCol = wallColors[southOrient] || wallColors.floor;
    const northCol = wallColors[northOrient] || wallColors.ceiling;
    colors.set(southCol, this.southIdx * 3);
    colors.set(northCol, this.northIdx * 3);
    normals.set([0, -1, 0], this.southIdx * 3);
    normals.set([0, +1, 0], this.northIdx * 3);
    const southR2 = southR * southR, northR2 = northR * northR;
    if (southR2 > maxR2) maxR2 = southR2;
    if (northR2 > maxR2) maxR2 = northR2;

    this.max_radius_mm = Math.sqrt(maxR2);
    this._recomputeSurfaceMetrics();
    this.geometry_sig = WallMesh._signature(wall, null);
    this.sig = WallMesh._signature(wall, sim);
  }
}
