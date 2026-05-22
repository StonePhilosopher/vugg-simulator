// ============================================================
// js/99c-renderer-primitives.ts — Wireframe primitive geometry tables
// ============================================================
// 11 PRIM_* objects (cube/octahedron/tetrahedron/rhombohedron/scalenohedron/hex-prism/dipyramid/pyritohedron/tabular/acicular/dripstone/botryoidal) + HABIT_TO_PRIMITIVE dispatcher + dripstone-eligibility check + canonical-primitive lookup.
//
// Phase B12 of PROPOSAL-MODULAR-REFACTOR — split renderer.

const PRIM_CUBE = {
  name: 'cube',
  vertices: [
    [-0.55, -0.1, -0.55], [ 0.55, -0.1, -0.55], [ 0.55, -0.1,  0.55], [-0.55, -0.1,  0.55],
    [-0.55,  1.0, -0.55], [ 0.55,  1.0, -0.55], [ 0.55,  1.0,  0.55], [-0.55,  1.0,  0.55],
  ],
  edges: [
    [0,1],[1,2],[2,3],[3,0],   // base
    [4,5],[5,6],[6,7],[7,4],   // top
    [0,4],[1,5],[2,6],[3,7],   // verticals
  ],
};

const PRIM_OCTAHEDRON = {
  name: 'octahedron',
  vertices: [
    [ 0.0,  1.0,  0.0],   // 0 top apex
    [ 0.0, -0.1,  0.0],   // 1 bottom apex (buried)
    [ 0.55, 0.45, 0.0],   // 2 east
    [-0.55, 0.45, 0.0],   // 3 west
    [ 0.0,  0.45, 0.55],  // 4 north
    [ 0.0,  0.45,-0.55],  // 5 south
  ],
  edges: [
    [0,2],[0,3],[0,4],[0,5],   // top tip → equator
    [1,2],[1,3],[1,4],[1,5],   // bottom tip → equator
    [2,4],[4,3],[3,5],[5,2],   // equator
  ],
};

const PRIM_TETRAHEDRON = {
  name: 'tetrahedron',
  // 4 vertices: 1 apex + 3-cornered base. Slightly oversized so the
  // base sits below y=0 (buried) and the apex points into the cavity.
  vertices: (() => {
    const r = 0.55;
    return [
      [ 0.0,  1.0, 0.0],  // apex
      [ r * Math.cos(0),            -0.1, r * Math.sin(0)],
      [ r * Math.cos(2*Math.PI/3),  -0.1, r * Math.sin(2*Math.PI/3)],
      [ r * Math.cos(4*Math.PI/3),  -0.1, r * Math.sin(4*Math.PI/3)],
    ];
  })(),
  edges: [
    [0,1],[0,2],[0,3],   // apex → base
    [1,2],[2,3],[3,1],   // base triangle
  ],
};

const PRIM_RHOMBOHEDRON = {
  name: 'rhombohedron',
  // Calcite-style rhomb: parallelepiped where all 6 faces are rhombs.
  // Topologically a cube but with the top face rotated 60° around the
  // c-axis relative to the bottom — gives the canonical "tilted" look.
  vertices: (() => {
    const vs = [];
    const r = 0.55;
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI / 2) + Math.PI / 4;
      vs.push([r * Math.cos(a), -0.1, r * Math.sin(a)]);  // base
    }
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI / 2) + Math.PI / 4 + Math.PI / 3;
      vs.push([r * Math.cos(a),  1.0, r * Math.sin(a)]);  // top, rotated 60°
    }
    return vs;
  })(),
  edges: [
    [0,1],[1,2],[2,3],[3,0],
    [4,5],[5,6],[6,7],[7,4],
    [0,4],[1,5],[2,6],[3,7],
  ],
};

const PRIM_SCALENOHEDRON = {
  name: 'scalenohedron',
  // Calcite "dogtooth": doubly-pointed with a zigzag waist. 8 verts,
  // 12 edges. Three upper-mid vertices alternate with three lower-mid
  // around the equator, giving the characteristic facet zigzag.
  vertices: (() => {
    const vs = [
      [0,  1.0, 0],   // 0 top apex
      [0, -0.1, 0],   // 1 bottom apex (buried)
    ];
    const r = 0.45;
    for (let k = 0; k < 3; k++) {
      const a = k * 2 * Math.PI / 3;
      vs.push([r * Math.cos(a), 0.7, r * Math.sin(a)]);   // 2,3,4 upper-mid
    }
    for (let k = 0; k < 3; k++) {
      const a = k * 2 * Math.PI / 3 + Math.PI / 3;
      vs.push([r * Math.cos(a), 0.2, r * Math.sin(a)]);   // 5,6,7 lower-mid
    }
    return vs;
  })(),
  edges: [
    [0,2],[0,3],[0,4],   // top apex → upper-mid
    [1,5],[1,6],[1,7],   // bot apex → lower-mid
    // zigzag: each upper-mid connects to 2 adjacent lower-mids
    [2,5],[2,7], [3,5],[3,6], [4,6],[4,7],
  ],
};

const PRIM_HEX_PRISM = {
  name: 'hex_prism',
  vertices: (() => {
    const vs = [];
    const r = 0.5;
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3;
      vs.push([r * Math.cos(a), -0.1, r * Math.sin(a)]);   // 0..5 base hex
    }
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3;
      vs.push([r * Math.cos(a),  1.0, r * Math.sin(a)]);   // 6..11 top hex
    }
    return vs;
  })(),
  edges: [
    [0,1],[1,2],[2,3],[3,4],[4,5],[5,0],
    [6,7],[7,8],[8,9],[9,10],[10,11],[11,6],
    [0,6],[1,7],[2,8],[3,9],[4,10],[5,11],
  ],
};

const PRIM_HEX_PRISM_TERMINATED = {
  name: 'hex_prism_terminated',
  // Quartz: hex prism with a 6-faceted pyramidal cap on the free end.
  // 13 vertices (no buried apex — base hex sits at y=-0.1), 24 edges.
  vertices: (() => {
    const vs = [];
    const r = 0.5;
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3;
      vs.push([r * Math.cos(a), -0.1, r * Math.sin(a)]);   // 0..5 base hex
    }
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3;
      vs.push([r * Math.cos(a),  0.8, r * Math.sin(a)]);   // 6..11 shoulder
    }
    vs.push([0, 1.0, 0]);                                  // 12 apex
    return vs;
  })(),
  edges: [
    [0,1],[1,2],[2,3],[3,4],[4,5],[5,0],          // base hex
    [6,7],[7,8],[8,9],[9,10],[10,11],[11,6],      // shoulder hex
    [0,6],[1,7],[2,8],[3,9],[4,10],[5,11],        // verticals
    [12,6],[12,7],[12,8],[12,9],[12,10],[12,11],  // pyramid ridges
  ],
};

const PRIM_DIPYRAMID = {
  name: 'dipyramid',
  // Hex bipyramid (barite, scheelite, anhydrite). Equatorial hex
  // pinching to apex on each end.
  vertices: (() => {
    const vs = [
      [0,  1.0, 0],
      [0, -0.1, 0],
    ];
    const r = 0.5;
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3;
      vs.push([r * Math.cos(a), 0.45, r * Math.sin(a)]);
    }
    return vs;
  })(),
  edges: [
    // top apex → equator
    [0,2],[0,3],[0,4],[0,5],[0,6],[0,7],
    // bot apex → equator
    [1,2],[1,3],[1,4],[1,5],[1,6],[1,7],
    // equator
    [2,3],[3,4],[4,5],[5,6],[6,7],[7,2],
  ],
};

const PRIM_PYRITOHEDRON = {
  name: 'pyritohedron',
  // 12 pentagonal faces (one of pyrite's classic forms). Topology:
  // 14 vertices = 8 cube-corners + 6 face-axis points.
  // Edges: 6 cube-edges of one chosen subset + 24 from corners to face
  // points = 30.
  vertices: (() => {
    const vs = [];
    const c = 0.5;
    // 8 cube corners
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      vs.push([c * sx, 0.45 + c * sy, c * sz]);
    }
    // 6 face-axis "stretch" points (offset inward from each cube face)
    const k = 0.7;  // pseudo-pyritohedral stretch
    vs.push([ c*k, 0.45, 0]);     // 8 +x
    vs.push([-c*k, 0.45, 0]);     // 9 -x
    vs.push([0, 0.45 + c*k, 0]);  // 10 +y
    vs.push([0, 0.45 - c*k, 0]);  // 11 -y
    vs.push([0, 0.45,  c*k]);     // 12 +z
    vs.push([0, 0.45, -c*k]);     // 13 -z
    return vs;
  })(),
  edges: [
    // Six "rib" cube-edges (one per face, alternating) — gives the
    // striated-cube look pyritohedrons read as.
    [0,1],[2,3],[4,5],[6,7],[0,4],[3,7],
    // Each face point connects to its 4 adjacent cube corners.
    // +x face (corners with sx=+1: indices 4,5,6,7)
    [8,4],[8,5],[8,6],[8,7],
    // -x face (sx=-1: 0,1,2,3)
    [9,0],[9,1],[9,2],[9,3],
    // +y face (sy=+1: 2,3,6,7)
    [10,2],[10,3],[10,6],[10,7],
    // -y face (sy=-1: 0,1,4,5)
    [11,0],[11,1],[11,4],[11,5],
    // +z face (sz=+1: 1,3,5,7)
    [12,1],[12,3],[12,5],[12,7],
    // -z face (sz=-1: 0,2,4,6)
    [13,0],[13,2],[13,4],[13,6],
  ],
};

const PRIM_TABULAR = {
  name: 'tabular',
  // Flat plate: half-height in the c-axis direction, full width in
  // the equatorial directions. Selenite / mica / wulfenite look.
  vertices: [
    [-0.55, -0.1, -0.55], [ 0.55, -0.1, -0.55], [ 0.55, -0.1,  0.55], [-0.55, -0.1,  0.55],
    [-0.55,  0.4, -0.55], [ 0.55,  0.4, -0.55], [ 0.55,  0.4,  0.55], [-0.55,  0.4,  0.55],
  ],
  edges: [
    [0,1],[1,2],[2,3],[3,0],
    [4,5],[5,6],[6,7],[7,4],
    [0,4],[1,5],[2,6],[3,7],
  ],
};

const PRIM_ACICULAR = {
  name: 'acicular',
  // Slender needle: hex cross-section, very short equatorial extent
  // relative to c-length. Stibnite, natrolite, mesolite, sword gypsum.
  vertices: (() => {
    const vs = [];
    const r = 0.18;  // slim
    for (let k = 0; k < 3; k++) {
      const a = k * 2 * Math.PI / 3;
      vs.push([r * Math.cos(a), -0.1, r * Math.sin(a)]);
    }
    for (let k = 0; k < 3; k++) {
      const a = k * 2 * Math.PI / 3;
      vs.push([r * Math.cos(a),  0.95, r * Math.sin(a)]);
    }
    vs.push([0, 1.0, 0]);  // 6 apex
    return vs;
  })(),
  edges: [
    [0,1],[1,2],[2,0],
    [3,4],[4,5],[5,3],
    [0,3],[1,4],[2,5],
    [6,3],[6,4],[6,5],
  ],
};

const PRIM_DRIPSTONE = {
  name: 'dripstone',
  // Cave-mode tapered icicle. Hill & Forti 1997 (Cave Minerals of the
  // World): mature stalactites taper from a wide ceiling-anchored base
  // to a narrow drip tip, aspect ratio ~5-10:1, with vertical surface
  // ridges from streaming water down the flanks. Hexagonal cross-section
  // here is mostly a calcite-symmetry nod — natural dripstone is
  // smooth-circular, but the renderer's 6-fold visible ridges read as
  // the streaming-water grooves and align with calcite's underlying
  // crystallographic symmetry.
  //
  // Anchor at the *base* (y = -0.1, slightly buried) so when air-mode
  // c-axis flips put the crystal pointing world-down, the wide base
  // sits at the substrate (ceiling) and the tip points at the floor.
  // Stalagmite case (floor cell) reuses the same primitive flipped via
  // the renderer's existing fluid/air orientation logic — same taper,
  // opposite gravity vector.
  //
  // Geometry: 4 latitude rings × 6 longitudes + 1 apex. Radii taper
  // 0.55 → 0.42 → 0.27 → 0.13 → 0 (apex). Vertical extent normalized
  // to y=[-0.1, 1.0]; the renderer multiplies y by c_length_mm and
  // x/z by a_width_mm, so the natural 5-10:1 aspect ratio falls out
  // of the crystal's own dimensions when the air-mode habit kicks in.
  vertices: (() => {
    const vs = [];
    const NLON = 6;
    // Slim icicle profile. Crystal c_length_mm/a_width_mm already
    // encodes a partial aspect ratio (prismatic crystals land at ~2-3:1
    // in those dimensions); dropping the primitive's max radius from
    // 0.55 to 0.30 multiplies that to a believable 5-10:1 final aspect
    // for cave dripstone. Taper from base (0.30) → tip (0) over four
    // rings, with non-linear shrinkage (more taper near the base, less
    // near the tip) — matches photos of mature cave stalactites where
    // the lower 60% is nearly cylindrical and the apex acts like a
    // separate "drip nozzle".
    const rings = [
      { y: -0.10, r: 0.30 },   // base (ceiling-anchored)
      { y:  0.30, r: 0.22 },   // upper shoulder
      { y:  0.65, r: 0.13 },   // mid-shaft
      { y:  0.90, r: 0.06 },   // sub-tip neck
    ];
    for (const ring of rings) {
      for (let k = 0; k < NLON; k++) {
        const a = (k * 2 * Math.PI) / NLON;
        vs.push([ring.r * Math.cos(a), ring.y, ring.r * Math.sin(a)]);
      }
    }
    vs.push([0, 1.0, 0]);   // 24: apex (drip tip)
    return vs;
  })(),
  edges: (() => {
    const es = [];
    const NLON = 6;
    const NRINGS = 4;
    // Six longitudinal ridges — each spans ring 0..3 → apex (4 segments).
    for (let k = 0; k < NLON; k++) {
      for (let r = 0; r < NRINGS - 1; r++) {
        es.push([r * NLON + k, (r + 1) * NLON + k]);
      }
      // Ring 3 → apex.
      es.push([(NRINGS - 1) * NLON + k, NRINGS * NLON]);
    }
    // Base hex (anchors the silhouette at the substrate).
    for (let k = 0; k < NLON; k++) {
      es.push([k, (k + 1) % NLON]);
    }
    // Mid-shaft hex (ring 2) — mid-band detail so the silhouette
    // doesn't read as a smooth fanned bundle of single ridges.
    for (let k = 0; k < NLON; k++) {
      es.push([2 * NLON + k, 2 * NLON + ((k + 1) % NLON)]);
    }
    return es;
  })(),
};

const PRIM_BOTRYOIDAL = {
  name: 'botryoidal',
  // Spherulite mechanism (Wertheim et al. 2021; Quartz Page chalcedony):
  // each visible "grape" is a single nucleation point with hundreds-to-
  // thousands of acicular fibers radiating over a hemisphere, fiber-to-
  // fiber misorientation 0–22°. We approximate with ~20 representative
  // fibers fanning over the upper hemisphere from a single anchor at
  // the wall. The convex-hull silhouette is a smooth dome (not a multi-
  // bump cluster — those happen when the engine spawns adjacent
  // botryoidal crystals on neighbouring cells, which already happens
  // naturally because the habit's wall_spread is wide).
  vertices: (() => {
    const vs = [];
    vs.push([0, -0.05, 0]);                   // 0 anchor (slightly buried)
    // Hemisphere of fiber tips. 4 latitude bands × 6 longitudes,
    // skewed so more tips cluster near the apex than near the rim
    // (real spherulites have denser fibers near the perpendicular).
    const NLAT = 4, NLON = 6;
    for (let i = 0; i < NLAT; i++) {
      // Latitude angle from substrate (φ=0 = horizon, φ=π/2 = apex).
      // Bias toward the apex with i^0.7 so tips concentrate up-top.
      const t = (i + 1) / NLAT;
      const phi = (t * t * 0.7 + t * 0.3) * Math.PI / 2;
      const r = 0.5 * Math.cos(phi);
      const y = 1.0 * Math.sin(phi);
      for (let j = 0; j < NLON; j++) {
        // Stagger longitudes per band so adjacent latitude rings don't
        // align radially (more spherulite-like).
        const a = (j + 0.5 * (i % 2)) * 2 * Math.PI / NLON;
        vs.push([r * Math.cos(a), y, r * Math.sin(a)]);
      }
    }
    // One apex tip dead-center at y=1.0 to fix the silhouette top.
    vs.push([0, 1.0, 0]);
    return vs;
  })(),
  edges: (() => {
    const es = [];
    const NLAT = 4, NLON = 6;
    // Each fiber tip connects back to the anchor — that's the visible
    // wireframe radial pattern.
    for (let i = 0; i < NLAT; i++) {
      for (let j = 0; j < NLON; j++) {
        es.push([0, 1 + i * NLON + j]);
      }
    }
    es.push([0, 1 + NLAT * NLON]);  // apex fiber
    // Connect adjacent tips in each latitude band → suggests the
    // hemispheric envelope without fully outlining it.
    for (let i = 0; i < NLAT; i++) {
      for (let j = 0; j < NLON; j++) {
        const a = 1 + i * NLON + j;
        const b = 1 + i * NLON + ((j + 1) % NLON);
        es.push([a, b]);
      }
    }
    return es;
  })(),
};

// v134 (2026-05-22): fluorite penetration-twin primitive. Two
// interpenetrating cubes rotated 60° around their shared body diagonal
// [1,1,1]/√3 — the iconic Cumbria / Weardale / Cave-in-Rock fluorite
// habit (Sunagawa 2005 §6.4; Dana 8th ed CaF2 section). v133 set the
// twin probability to 0.12 per nucleation in data/minerals.json; this
// primitive is what _lookupCrystalPrimitive returns when
// crystal.mineral === 'fluorite' && crystal.twinned &&
// crystal.twin_law === 'penetration'.
//
// Geometry: 16 vertices (8 from each cube), 24 edges (12 per cube).
// The body-diagonal endpoints (-c,-c,-c) and (+c,+c,+c) of both cubes
// coincide on the shared rotation axis, but the duplicate vertices are
// kept for edge-array simplicity (per-cube indices stay clean). The
// renderer's convex-hull silhouette fills in the outer envelope; the
// edges trace the 14-pointed star visible in real specimens.
//
// Rotation matrix R = (1/3) * [[2,2,-1],[-1,2,2],[2,-1,2]] is the
// 60° rotation around [1,1,1]/√3 derived from Rodrigues' formula.
// Centered at y=0.45 to match PRIM_CUBE's anchoring (base at y=-0.1,
// top at y=1.0) — vertices are translated to origin before rotation
// then translated back.
const PRIM_FLUORITE_PENETRATION_TWIN = {
  name: 'fluorite_penetration_twin',
  vertices: (() => {
    const c = 0.55;
    const ctr_y = 0.45;  // match PRIM_CUBE's center
    const vs = [];
    // First cube: vertex indices 0..7, ordered by (sx, sy, sz) loops.
    //   0: (-,-,-)  1: (-,-,+)  2: (-,+,-)  3: (-,+,+)
    //   4: (+,-,-)  5: (+,-,+)  6: (+,+,-)  7: (+,+,+)
    // Body-diagonal axis runs from vertex 0 to vertex 7.
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          vs.push([c * sx, c * sy + ctr_y, c * sz]);
        }
      }
    }
    // Second cube: vertex indices 8..15. Each is the corresponding
    // first-cube vertex rotated 60° around [1,1,1]/√3 through the
    // center. Vertices 0 and 7 (body-diagonal endpoints) coincide
    // with 8 and 15 respectively under this rotation.
    for (let i = 0; i < 8; i++) {
      const [x, y, z] = vs[i];
      // Translate to origin (subtract center), rotate, translate back.
      const cx = x, cy = y - ctr_y, cz = z;
      const rx = (2 * cx + 2 * cy - cz) / 3;
      const ry = (-cx + 2 * cy + 2 * cz) / 3;
      const rz = (2 * cx - cy + 2 * cz) / 3;
      vs.push([rx, ry + ctr_y, rz]);
    }
    return vs;
  })(),
  edges: (() => {
    // 12 edges per cube. For both cubes, edges go between vertices
    // that differ in exactly one of (sx, sy, sz). Cube A uses indices
    // 0..7; cube B uses 8..15 with the same topology.
    const cubeEdges = (off) => [
      // z-edges (sx, sy fixed; sz varies):
      [off + 0, off + 1], [off + 2, off + 3], [off + 4, off + 5], [off + 6, off + 7],
      // y-edges (sx, sz fixed; sy varies):
      [off + 0, off + 2], [off + 1, off + 3], [off + 4, off + 6], [off + 5, off + 7],
      // x-edges (sy, sz fixed; sx varies):
      [off + 0, off + 4], [off + 1, off + 5], [off + 2, off + 6], [off + 3, off + 7],
    ];
    return [...cubeEdges(0), ...cubeEdges(8)];
  })(),
};

// v134 (2026-05-22): selenite swallowtail-twin primitive. Two tabular
// gypsum blades joined on a {100} contact plane at the base, opening
// upward in a V — the "fishtail" / "swallowtail" twin (Dana 8th ed.
// CaSO4·2H2O section; Hurlbut & Klein 23rd ed. §13). Iconic in
// Bohemian + Naica + Mojave specimens. v133 set the twin probability
// to 0.18 per selenite nucleation in data/minerals.json (Tier 2 F
// retune — was 0.08, observed 4.5% in baseline, raised to 18% to match
// the ~30-50% rate seen in collection-quality specimens).
//
// Geometry: 16 vertices (8 per blade), 24 edges (12 per blade). Each
// blade is a thin tabular rectangular block — local dimensions before
// tilt: thickness 2a (perpendicular to broad face), length L (along
// the c-axis), width 2b (the side-to-side dimension perpendicular to
// the broad face's long edge). Both blades share the base contact
// edge along the world Z-axis at the wall (X=0, Y=-0.1).
//
// Tilt: each blade rotates ±30° from vertical around the contact
// edge — total V opening angle 60°. Real gypsum {100} twin angle is
// ~36°-105° depending on which axes you measure; 60° gives a clean
// recognizable V silhouette consistent with typical photos.
//
// Anchoring: contact edge sits at Y=-0.1 (PRIM_CUBE convention). The
// outer base corners of each blade (away from contact) bury below
// the wall (Y < -0.1) — this matches how real swallowtails look in
// matrix, where only the V-opening upper portion is visible.
const PRIM_SELENITE_SWALLOWTAIL_TWIN = {
  name: 'selenite_swallowtail_twin',
  vertices: (() => {
    const a = 0.08;             // half-thickness (perpendicular to broad face)
    const L = 1.1;              // blade length along c-axis
    const b = 0.18;             // half-width (along contact edge, Z)
    const base_y = -0.1;        // anchor base contact at PRIM_CUBE wall y
    const theta = Math.PI / 6;  // 30° tilt per blade — 60° total V
    const c30 = Math.cos(theta);
    const s30 = Math.sin(theta);
    const vs: number[][] = [];
    // Blade A — local coords (xl, yl, zl) with xl ∈ {-2a, 0},
    // yl ∈ {0, L}, zl ∈ {-b, +b}. The contact face (broad face on
    // contact plane) is at xl=0; the body of the blade extends to
    // xl=-2a. After rotating by +30° around z-axis through origin
    // and shifting Y by base_y, the contact-base edge (xl=0, yl=0)
    // stays at world (0, base_y, zl); the rest of the blade tilts
    // outward (toward -X) and upward.
    //   Indices 0..7 in (xl, yl, zl) loop order:
    //     0: (-2a, 0, -b)   contact-side opposite, base, -z
    //     1: (-2a, 0, +b)
    //     2: (-2a, L, -b)
    //     3: (-2a, L, +b)
    //     4: (0, 0, -b)     contact-base edge, -z
    //     5: (0, 0, +b)     contact-base edge, +z
    //     6: (0, L, -b)     contact-top edge, -z
    //     7: (0, L, +b)
    for (const xl of [-2 * a, 0]) {
      for (const yl of [0, L]) {
        for (const zl of [-b, b]) {
          const wx = xl * c30 - yl * s30;
          const wy = xl * s30 + yl * c30 + base_y;
          vs.push([wx, wy, zl]);
        }
      }
    }
    // Blade B — mirror of blade A across the X=0 plane (the contact).
    // Local xl ∈ {0, +2a}; rotated by -30° around z. Symmetry: blade
    // B vertex i+8 is the X-reflection of blade A vertex i.
    for (const xl of [0, 2 * a]) {
      for (const yl of [0, L]) {
        for (const zl of [-b, b]) {
          const wx = xl * c30 + yl * s30;
          const wy = -xl * s30 + yl * c30 + base_y;
          vs.push([wx, wy, zl]);
        }
      }
    }
    return vs;
  })(),
  edges: (() => {
    // 12 edges per blade. Same topology as a cube (vertex i connects
    // to vertex j if they differ in exactly one of the 3 axes). Blade
    // A uses indices 0..7; blade B uses 8..15 with identical adjacency.
    const bladeEdges = (off: number) => [
      // zl-edges (xl, yl fixed, zl varies):
      [off + 0, off + 1], [off + 2, off + 3], [off + 4, off + 5], [off + 6, off + 7],
      // yl-edges (xl, zl fixed, yl varies):
      [off + 0, off + 2], [off + 1, off + 3], [off + 4, off + 6], [off + 5, off + 7],
      // xl-edges (yl, zl fixed, xl varies):
      [off + 0, off + 4], [off + 1, off + 5], [off + 2, off + 6], [off + 3, off + 7],
    ];
    return [...bladeEdges(0), ...bladeEdges(8)];
  })(),
};

// Habit string → primitive lookup. Direct hits checked first; the
// fuzzy-substring fallback in _lookupCrystalPrimitive catches the
// many compound forms in data/minerals.json (e.g. "rhombohedral_or_
// botryoidal", "saddle_rhomb_or_massive").
const HABIT_TO_PRIMITIVE = {
  'cubic':                          PRIM_CUBE,
  'pseudocubic':                    PRIM_CUBE,
  'pseudo_cubic':                   PRIM_CUBE,
  'cubo-pyritohedral':              PRIM_PYRITOHEDRON,
  'cubic_or_pyritohedral':          PRIM_PYRITOHEDRON,
  'cubic_or_octahedral':            PRIM_CUBE,
  'pyritohedral':                   PRIM_PYRITOHEDRON,
  'octahedral':                     PRIM_OCTAHEDRON,
  'tetrahedral':                    PRIM_TETRAHEDRON,
  'tetrahedral_or_massive':         PRIM_TETRAHEDRON,
  'rhombohedral':                   PRIM_RHOMBOHEDRON,
  'saddle_rhomb_or_massive':        PRIM_RHOMBOHEDRON,
  'rhombohedral_or_botryoidal':     PRIM_RHOMBOHEDRON,
  'rhombohedral_or_scalenohedral':  PRIM_RHOMBOHEDRON,
  'rhombohedral_or_tabular_or_botryoidal': PRIM_RHOMBOHEDRON,
  'botryoidal_or_rhombohedral':     PRIM_BOTRYOIDAL,
  'scalenohedral':                  PRIM_SCALENOHEDRON,
  'scalenohedral_or_rhombohedral':  PRIM_SCALENOHEDRON,
  'prismatic':                      PRIM_HEX_PRISM_TERMINATED,
  'short_prismatic':                PRIM_HEX_PRISM,
  'striated_prism':                 PRIM_HEX_PRISM_TERMINATED,
  'hex_prism':                      PRIM_HEX_PRISM_TERMINATED,
  'hex_prism_long':                 PRIM_HEX_PRISM_TERMINATED,
  'hexagonal_prism':                PRIM_HEX_PRISM_TERMINATED,
  'hexagonal_prism_or_botryoidal_campylite': PRIM_HEX_PRISM_TERMINATED,
  'prismatic_hex':                  PRIM_HEX_PRISM_TERMINATED,
  'prismatic_or_blocky':            PRIM_HEX_PRISM_TERMINATED,
  'prismatic_orthorhombic':         PRIM_HEX_PRISM_TERMINATED,
  'prismatic_tabular_pseudo_cubic': PRIM_CUBE,
  'prismatic_or_rosette':           PRIM_HEX_PRISM_TERMINATED,
  'tabular_prism':                  PRIM_HEX_PRISM_TERMINATED,
  'tabular':                        PRIM_TABULAR,
  'tabular_square':                 PRIM_TABULAR,
  'tabular_hex':                    PRIM_TABULAR,
  'hex_plate':                      PRIM_TABULAR,
  'hexagonal_platy':                PRIM_TABULAR,
  'tabular_plates':                 PRIM_TABULAR,
  'tabular_monoclinic':             PRIM_TABULAR,
  'tabular_or_prismatic_or_fibrous': PRIM_TABULAR,
  'platy_scales':                   PRIM_TABULAR,
  'micro_plates':                   PRIM_TABULAR,
  'acicular':                       PRIM_ACICULAR,
  'acicular_tuft':                  PRIM_ACICULAR,
  'tufted_spray':                   PRIM_ACICULAR,
  'elongated_blade':                PRIM_ACICULAR,
  'wire':                           PRIM_ACICULAR,
  'capillary':                      PRIM_ACICULAR,
  'columnar_or_cyclic_twinned':     PRIM_HEX_PRISM_TERMINATED,
  'cockscomb_or_spearhead':         PRIM_DIPYRAMID,
  'dipyramidal':                    PRIM_DIPYRAMID,
  'bipyramidal_alpha':              PRIM_DIPYRAMID,
  'disphenoidal_{112}':             PRIM_DIPYRAMID,
  'stellate_sixling':               PRIM_DIPYRAMID,
  'hexagonal_barrel':               PRIM_HEX_PRISM,
  'barrel':                         PRIM_HEX_PRISM,
  'hemimorphic_hexagonal':          PRIM_HEX_PRISM_TERMINATED,
  'deep_blue_prismatic':            PRIM_HEX_PRISM_TERMINATED,
  'botryoidal':                     PRIM_BOTRYOIDAL,
  'reniform':                       PRIM_BOTRYOIDAL,
  'botryoidal_or_acicular':         PRIM_BOTRYOIDAL,
  'botryoidal_or_mammillary_or_fibrous': PRIM_BOTRYOIDAL,
  'botryoidal_cryptocrystalline':   PRIM_BOTRYOIDAL,
  'cobalt_bloom_or_botryoidal':     PRIM_BOTRYOIDAL,
  'nickel_bloom_or_capillary':      PRIM_BOTRYOIDAL,
  'pitchblende_massive':            PRIM_BOTRYOIDAL,
  'massive_granular':               PRIM_BOTRYOIDAL,
  'earthy_crust':                   PRIM_BOTRYOIDAL,
  'stalactitic':                    PRIM_BOTRYOIDAL,
  'arborescent':                    PRIM_ACICULAR,
  'dendritic':                      PRIM_ACICULAR,
  // v26 polish: runtime-set habits from the engine (silica polymorphs,
  // calcite/aragonite habit pickers, supergene-product engines, etc.)
  // that previously fell through to PRIM_RHOMBOHEDRON. Audited against
  // the full list of crystal.habit assignments in this file.
  'tridymite (thin hexagonal plates)': PRIM_TABULAR,
  'β-quartz bipyramidal (paramorphic)': PRIM_DIPYRAMID,
  'scepter overgrowth possible':    PRIM_HEX_PRISM_TERMINATED,
  'chalcedony (microcrystalline)':  PRIM_BOTRYOIDAL,
  'opal (amorphous silica)':        PRIM_BOTRYOIDAL,
  'silica_gel_hemisphere':          PRIM_BOTRYOIDAL,
  'flos_ferri':                     PRIM_ACICULAR,   // aragonite "iron flowers"
  'acicular_needle':                PRIM_ACICULAR,
  'twinned_cyclic':                 PRIM_DIPYRAMID,  // cyclic-sextet twin → stellate
  'columnar':                       PRIM_HEX_PRISM_TERMINATED,
  'radiating_columnar':             PRIM_HEX_PRISM_TERMINATED,
  'coarse_rhomb':                   PRIM_RHOMBOHEDRON,
  'massive':                        PRIM_BOTRYOIDAL,
  'saddle_rhomb':                   PRIM_RHOMBOHEDRON,
  'spherulitic':                    PRIM_BOTRYOIDAL,
  'banding_agate':                  PRIM_BOTRYOIDAL,
  'fibrous_coating':                PRIM_BOTRYOIDAL,  // fibrous mat reads dome-like
  'hemimorphic_crystal':            PRIM_HEX_PRISM_TERMINATED,
  'platy_massive':                  PRIM_TABULAR,
  'micaceous_book':                 PRIM_TABULAR,    // mica = stacked sheets
  'rosette_radiating':              PRIM_BOTRYOIDAL,  // dome-shaped rosette stays dome — chalcedony / smithsonite style
  'rosette_bladed':                 PRIM_TABULAR,    // bladed rosette = thin plates
  // v134 (2026-05-22): plumose/radiating-needle habits re-routed from
  // PRIM_BOTRYOIDAL (single dome, no cluster) to PRIM_ACICULAR (slim
  // needle silhouette + spike cluster pattern from v132's cluster-spec
  // port — produces 8 acicular satellites fanning around the parent
  // anchor at radiusMul=0.55, alpha=1.0, sizeMin/Max=0.35/0.75). The
  // texture system already classified these as 'acicular' (per
  // 99a.HABIT_TO_TEXTURE); the primitive side now matches. Visible
  // effect: stibnite radiating_spray + bismuthinite radiating_cluster
  // + erythrite plumose_rosette render as needle-fans, not domes.
  'plumose_rosette':                PRIM_ACICULAR,
  'radiating_blade':                PRIM_TABULAR,    // bladed = thin plates stay tablet
  'radiating_cluster':              PRIM_ACICULAR,
  'radiating_fibrous':              PRIM_ACICULAR,
  'radiating_spray':                PRIM_ACICULAR,
  'globular':                       PRIM_BOTRYOIDAL,
  'nodular':                        PRIM_BOTRYOIDAL,
  'framboidal':                     PRIM_BOTRYOIDAL, // raspberry-like clusters
  'granular':                       PRIM_BOTRYOIDAL,
  'powdery crust':                  PRIM_BOTRYOIDAL,
  'powdery_aggregate':              PRIM_BOTRYOIDAL,
  'powdery_disseminated':           PRIM_BOTRYOIDAL,
  'sublimation_crust':              PRIM_BOTRYOIDAL,
  'iridescent_coating':             PRIM_BOTRYOIDAL,
  'peacock_iridescent':             PRIM_BOTRYOIDAL,
  'specular':                       PRIM_TABULAR,    // specular hematite = basal pinacoid
  'thorn':                          PRIM_ACICULAR,
  'spearhead':                      PRIM_HEX_PRISM_TERMINATED,
  'reticulated':                    PRIM_HEX_PRISM_TERMINATED,
  'trapiche':                       PRIM_DIPYRAMID,  // star-shaped emerald
  'nugget':                         PRIM_BOTRYOIDAL,
  'hopper_growth':                  PRIM_CUBE,       // cubic skeletal
  'pseudomorph':                    PRIM_RHOMBOHEDRON, // shape inherits host; default
  'pseudomorph_after_azurite':      PRIM_TABULAR,    // azurite was tabular
  'pseudomorph_after_sulfide':      PRIM_RHOMBOHEDRON,
  'olive_hex_barrel':               PRIM_HEX_PRISM,
  'yellow_hex_barrel':              PRIM_HEX_PRISM,
  'goshenite':                      PRIM_HEX_PRISM_TERMINATED, // colorless beryl
  'nickel_bloom':                   PRIM_BOTRYOIDAL,
  'cobalt_bloom':                   PRIM_BOTRYOIDAL,    // erythrite efflorescence
  'cottonball':                     PRIM_BOTRYOIDAL,    // borax cottonball aggregate (Death Valley)

  'cabrerite':                      PRIM_TABULAR,       // Mg-bearing annabergite, fibrous-bladed
  'co_bearing':                     PRIM_BOTRYOIDAL,    // chemistry tag fallback (annabergite/erythrite are typically fibrous-massive)
  'cockscomb':                      PRIM_DIPYRAMID,     // marcasite/pyrite cockscomb aggregate
  'disphenoidal':                   PRIM_TETRAHEDRON,   // distorted tetrahedron (sphalerite/chalcopyrite)
  'banded':                         PRIM_BOTRYOIDAL,    // chalcedony/agate-style banding
  'druzy':                          PRIM_BOTRYOIDAL,    // sparkly carpet of micro-crystals
  'arsenolamprite':                 PRIM_BOTRYOIDAL,    // metallic As polymorph, massive
  'chalcotrichite':                 PRIM_ACICULAR,      // capillary cuprite "hair copper"
  'azurite_sun':                    PRIM_BOTRYOIDAL,    // radiating disc rosette
  'enamel_on_cuprite':              PRIM_BOTRYOIDAL,    // thin conformal film
  'endlichite_yellow':              PRIM_HEX_PRISM_TERMINATED,  // hex apatite-group prism
  'asterated':                      PRIM_DIPYRAMID,     // star-shaped (asterism)
  'default_habit':                  PRIM_RHOMBOHEDRON,
};

// Canonical primitives that map to PRIM_DRIPSTONE under air-mode growth.
// Cube / octahedron / tetrahedron / pyritohedron / tabular / dipyramid
// stay as their canonical form: galena cubes don't form icicles,
// barite tabulars stay tabular, marcasite cockscombs (dipyramid) keep
// their distinctive doubly-pointed silhouette. The air-mode override
// is structural — it answers "could this primitive plausibly be a
