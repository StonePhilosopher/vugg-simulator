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
  diffuse(rate, fieldNames, ringTemps) {
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
    // Temperature stays per-ring for Tranche 4a (each cell carries a
    // temperature_ring index that points into the sim's
    // ring_temperatures[] array). Tranche 4b can migrate temperature
    // to per-vertex storage if a future scenario needs it; the
    // chemistry side is the load-bearing change for Path C.
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
  propagateDelta(preFluid, fieldNames, _equatorFluid) {
    if (!this.cells || !this.cells.length) return;
    if (!preFluid || !fieldNames || !fieldNames.length) return;
    // Pre-compute the per-field delta once; ignore unchanged fields.
    const deltas: number[] = [];
    const dirty: number[] = [];
    for (let k = 0; k < fieldNames.length; k++) {
      // _equatorFluid is the post-event value (aliased to
      // conditions.fluid); subtract preFluid to get the delta.
      const delta = (_equatorFluid ? _equatorFluid[fieldNames[k]] : 0)
                  - (preFluid ? preFluid[fieldNames[k]] : 0);
      if (delta !== 0) {
        deltas.push(delta);
        dirty.push(k);
      }
    }
    if (!dirty.length) return;
    for (let i = 0; i < this.numInterior; i++) {
      const fluid = this.cells[i].fluid;
      if (!fluid) continue;
      for (let d = 0; d < dirty.length; d++) {
        const fname = fieldNames[dirty[d]];
        const next = fluid[fname] + deltas[d];
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
    const anchor = (wall && wall._resolveAnchor)
      ? wall._resolveAnchor(crystal)
      : null;
    if (!anchor || anchor.ringIdx == null || anchor.cellIdx == null) return null;
    const cellsPerRing = wall.cells_per_ring || 0;
    if (cellsPerRing <= 0) return null;
    const idx = anchor.ringIdx * cellsPerRing + anchor.cellIdx;
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

  // ---- Cache fingerprint ----
  //
  // Match the legacy _topoCavitySignature in 99i so the renderer's
  // cache-hit/miss timing doesn't change. The signature folds in
  // ring count, cells per ring, a sampled wall_depth checksum (8
  // cells per ring), and the current fluid-surface ring. Cheap to
  // compute; busts whenever a dissolution event or fluid-level
  // change shifts the cavity.
  static _signature(wall, sim) {
    if (!wall || !wall.rings || !wall.rings.length) return '';
    const ring0 = wall.rings[0];
    const N = ring0 ? ring0.length : 0;
    let depthSum = 0;
    for (let r = 0; r < wall.rings.length; r++) {
      const ring = wall.rings[r];
      if (!ring) continue;
      const stride = Math.max(1, Math.floor(N / 8));
      for (let c = 0; c < N; c += stride) {
        const cell = ring[c];
        if (!cell) continue;
        depthSum += (cell.base_radius_mm + cell.wall_depth) * (r * 31 + c);
      }
    }
    const surf = sim && sim.conditions ? sim.conditions.fluid_surface_ring : null;
    return `${wall.ring_count}|${N}|${depthSum.toFixed(2)}|${surf}`;
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
    const submergedTint = [0.43, 0.74, 0.96];
    const mix = (a, b, t) => [
      a[0] * (1 - t) + b[0] * t,
      a[1] * (1 - t) + b[1] * t,
      a[2] * (1 - t) + b[2] * t,
    ];

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
      const wstate = (sim && sim.conditions && sim.conditions.ringWaterState)
        ? sim.conditions.ringWaterState(r, ringCount)
        : 'submerged';
      const isSubmerged = wstate === 'submerged'
        && sim && sim.conditions && sim.conditions.fluid_surface_ring != null;
      const tinted = isSubmerged ? mix(baseColor, submergedTint, 0.35) : baseColor;
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
        colors[idx * 3 + 0] = tinted[0];
        colors[idx * 3 + 1] = tinted[1];
        colors[idx * 3 + 2] = tinted[2];
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
    const southR = meanRingRadius(0) * Math.cos(Math.PI / (2 * ringCount)) * southPolar;
    const northR = meanRingRadius(ringCount - 1) * Math.cos(Math.PI / (2 * ringCount)) * northPolar;
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
    this.sig = WallMesh._signature(wall, sim);
  }
}
