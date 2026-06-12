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

// v134 (2026-05-22): galena spinel-law octahedron-twin primitive.
// Two octahedra sharing a {111} triangular face — the classic
// "spinel-law" contact twin documented in Ramdohr 1980, The Ore
// Minerals and Their Intergrowths §4.3.6. Common in MVT deposits
// where galena grows in octahedral habit (5-15% twin frequency per
// Boyle 1968's Cobalt-Ontario silver-galena ores). v133 added the
// twin_law entry to data/minerals.json with probability 0.10 per
// nucleation; this primitive renders when crystal.mineral === 'galena'
// && crystal.twinned && crystal.twin_law === 'spinel_law'.
//
// Geometry: 12 vertices (6 per octahedron; 3 shared on the contact
// face kept as duplicates for indexing simplicity), 24 edges (12 per
// octahedron). Each octahedron uses the same vertex topology as
// PRIM_OCTAHEDRON: 0=top apex, 1=bottom apex (buried at wall), 2-5=
// equator (E, W, N, S).
//
// Contact: the {0, 2, 4} face of the first octahedron = top + east +
// north = the {111} face in the plane x + y + z = 1 (with east at
// (0.55, 0.45, 0), north at (0, 0.45, 0.55), top at (0, 1, 0)).
// The second octahedron is the mirror image across this plane,
// reflecting only the OTHER 3 vertices (bottom apex 1, west 3,
// south 5) — the 3 shared face vertices stay fixed.
//
// Bipyramidal axis: from first octahedron's bottom apex (buried at
// wall) through the contact face centroid to second octahedron's
// mirror-of-bottom-apex. This axis runs along [1, 1, 1] direction,
// so the twin reads as a tilted bipyramid leaning toward +X+Z. Real
// galena spinel-law specimens often show this same tilted-bipyramid
// profile with a visible re-entrant angle along the contact edge.
const PRIM_GALENA_OCTAHEDRON_TWIN = {
  name: 'galena_octahedron_twin',
  vertices: (() => {
    const c = 0.55;          // equatorial radius
    const yTop = 1.0;
    const yEq = 0.45;
    const yBot = -0.1;       // buried at PRIM_CUBE wall y
    // First octahedron — standard PRIM_OCTAHEDRON vertex layout.
    const oct1: number[][] = [
      [0, yTop, 0],          // 0 top apex
      [0, yBot, 0],          // 1 bottom apex (buried)
      [ c, yEq,  0],         // 2 east   (on contact face)
      [-c, yEq,  0],         // 3 west
      [0, yEq,  c],          // 4 north  (on contact face)
      [0, yEq, -c],          // 5 south
    ];
    // Contact plane: passes through vertices 0, 2, 4 — i.e., the
    // points (0, 1, 0), (c, yEq, 0), (0, yEq, c). Plane equation
    // n · x = d where n = (1, 1, 1) and d = 1 (after the y-offset
    // bakes into the eq: 0+1+0 = 1, c + yEq + 0 = 0.55+0.45 = 1,
    // 0+yEq+c = 0.45+0.55 = 1). Reflection of point P across this
    // plane: P' = P - 2*(P.x+P.y+P.z - 1)/3 * (1,1,1).
    const reflect = (p: number[]): number[] => {
      const k = 2 * (p[0] + p[1] + p[2] - 1) / 3;
      return [p[0] - k, p[1] - k, p[2] - k];
    };
    // Second octahedron: mirror of each vertex. Vertices 0, 2, 4 are
    // on the plane and map to themselves (kept as duplicates at 6,
    // 8, 10 for index simplicity); 1, 3, 5 map to new positions.
    const oct2: number[][] = oct1.map(reflect);
    return [...oct1, ...oct2];
  })(),
  edges: (() => {
    // 12 edges per octahedron — same topology as PRIM_OCTAHEDRON.
    // Vertices 0..5 are the first octahedron; 6..11 are the second
    // (with 6≡0, 8≡2, 10≡4 coincident). The 3 contact-face edges
    // get drawn twice (once per octahedron) but coincide visually.
    const octEdges = (off: number) => [
      [off + 0, off + 2], [off + 0, off + 3], [off + 0, off + 4], [off + 0, off + 5],  // top → equator
      [off + 1, off + 2], [off + 1, off + 3], [off + 1, off + 4], [off + 1, off + 5],  // bottom → equator
      [off + 2, off + 4], [off + 4, off + 3], [off + 3, off + 5], [off + 5, off + 2],  // equator
    ];
    return [...octEdges(0), ...octEdges(6)];
  })(),
};

// v134 (2026-05-22): aragonite pseudo-hex sextet primitive. Three
// tabular orthorhombic prisms at 60° spacing around the c-axis,
// interpenetrating to produce a pseudo-hexagonal column (Dana 8th
// ed. CaCO3 section; Strunz 9th ed. 5.AB.15; Speer 1983 "Aragonite"
// in Reviews in Mineralogy v.11). Aragonite's {110} angle is ~116°
// — close enough to 120° that 3 crystals at 60° rotation produce
// a pseudo-hex envelope with subtle edge offsets along the contact
// planes.
//
// Why 3 crystals = "sextet": each tabular crystal contributes 2
// {110}-type faces (one on each side of its broad face), so 3
// crystals × 2 = 6 visible faces around the column. The "sextet"
// (or "sixling") terminology refers to the 6 outer faces, not
// 6 separate crystals.
//
// v133 added the cyclic_sextet twin_law to data/minerals.json with
// probability 0.40 — about 40% of aragonite nucleations get
// crystal.twinned = true + crystal.twin_law = 'cyclic_sextet'.
//
// Geometry: 24 vertices (8 per prism × 3 prisms), 36 edges (12 per
// prism × 3). Each prism is a tabular rectangle: half-thickness
// 'a' (perpendicular to broad face), full length L along the
// vertical c-axis, half-width 'b' (parallel to broad face direction).
// Tabular ratio a:b ≈ 1:3 — broad-faced.
//
// Anchoring: base at y=-0.1 (PRIM_CUBE wall convention), top at
// y=1.0 — gives a tall vertical column with the trilling axis +Y.
const PRIM_ARAGONITE_PSEUDOHEX_TWIN = {
  name: 'aragonite_pseudohex_twin',
  vertices: (() => {
    const a = 0.10;          // half-thickness (perp to broad face)
    const b = 0.30;          // half-width (parallel to broad face dir)
    const yMin = -0.1;
    const yMax = 1.0;
    const vs: number[][] = [];
    // Three prisms at θ = 0°, 60°, 120° around y-axis. Each prism's
    // local frame: xl is the "thin" direction (perpendicular to broad
    // face), zl is the "wide" direction (parallel to broad face).
    // After rotation by θ around y-axis, each prism's broad-face
    // normal lies in the XZ plane at angle θ from +X.
    for (let k = 0; k < 3; k++) {
      const theta = k * Math.PI / 3;  // 60° spacing
      const cT = Math.cos(theta);
      const sT = Math.sin(theta);
      // 8 corners per prism, ordered (xl ∈ {-a, +a}) × (yl ∈ {yMin,
      // yMax}) × (zl ∈ {-b, +b}) to match the cube-edge topology
      // already used by fluorite-twin and swallowtail.
      for (const xl of [-a, a]) {
        for (const yl of [yMin, yMax]) {
          for (const zl of [-b, b]) {
            const wx = xl * cT - zl * sT;
            const wz = xl * sT + zl * cT;
            vs.push([wx, yl, wz]);
          }
        }
      }
    }
    return vs;
  })(),
  edges: (() => {
    // 12 edges per prism, same topology as a box. Three prisms × 12
    // = 36 edges total. No cross-prism edges — the visual contact
    // lines emerge from edge intersections during rendering.
    const prismEdges = (off: number) => [
      // zl-edges (xl, yl fixed; zl varies):
      [off + 0, off + 1], [off + 2, off + 3], [off + 4, off + 5], [off + 6, off + 7],
      // yl-edges (xl, zl fixed; yl varies):
      [off + 0, off + 2], [off + 1, off + 3], [off + 4, off + 6], [off + 5, off + 7],
      // xl-edges (yl, zl fixed; xl varies):
      [off + 0, off + 4], [off + 1, off + 5], [off + 2, off + 6], [off + 3, off + 7],
    ];
    return [...prismEdges(0), ...prismEdges(8), ...prismEdges(16)];
  })(),
};

// v134 (2026-05-22): cerussite stellate-sixling primitive. Same cyclic-
// trilling math as aragonite, but with each blade lying FLAT in the
// wall plane (XZ) rather than standing as a vertical column (along Y).
// The result is a 6-pointed star morphology — 3 horizontal blades
// rotated 60° from each other, each extending through origin in both
// directions so each blade contributes 2 visible arms (3 × 2 = 6
// arms, the "sixling" naming). Documented in Dana 8th ed. PbCO3
// section; Heinrich & Vian 1967 (American Mineralogist v.52, p.1747)
// "Cerussite from MVT districts" report stellate trilling as the
// dominant twin habit. v133 set cyclic_sixling probability to 0.40.
//
// Geometry vs. aragonite pseudo-hex twin:
//   - Aragonite (vertical column):  each blade's long axis = +Y
//   - Cerussite (flat star):        each blade's long axis = XZ plane
//
// Concretely: each blade is a thin elongated box where xl (the local
// "long" axis) becomes the radial direction after rotation around Y,
// yl is the thin wall-perpendicular dimension, and zl is the tangential
// width (also thin). The whole assembly lies in the wall plane (slim
// in Y, broad in XZ).
//
// Anchoring: yl spans [-0.1, 0.0] — just 0.1 thick, sitting flush
// with the PRIM_CUBE wall convention (base at y=-0.1). The radial
// extent c=0.55 matches the wireframe primitive envelope.
const PRIM_CERUSSITE_SIXLING_TWIN = {
  name: 'cerussite_sixling_twin',
  vertices: (() => {
    const c_long = 0.55;     // radial half-length (the blade's long extent)
    const b_tan = 0.08;      // tangential half-width (narrow blade)
    const yMin = -0.1;       // bottom at PRIM_CUBE wall
    const yMax = 0.0;        // top slightly above wall (Y is thin direction)
    const vs: number[][] = [];
    // Three blades at θ_k = k · 60° (k = 0, 1, 2) — 60° spacing makes
    // the 6 visible arms (each blade extends through origin in ±xl,
    // contributing 2 arms 180° apart, so 3 blades × 2 arms = 6 arms).
    // 120° spacing would give a 3-arm propeller; 60° gives the
    // 6-pointed star.
    for (let k = 0; k < 3; k++) {
      const theta = k * Math.PI / 3;
      const cT = Math.cos(theta);
      const sT = Math.sin(theta);
      // 8 corners ordered (xl, yl, zl) — same cube-edge topology as
      // every other twin primitive in this file. xl is the LONG axis
      // (radial after rotation), yl is thin (wall-perpendicular), zl
      // is tangential (also thin).
      for (const xl of [-c_long, c_long]) {
        for (const yl of [yMin, yMax]) {
          for (const zl of [-b_tan, b_tan]) {
            const wx = xl * cT - zl * sT;
            const wz = xl * sT + zl * cT;
            vs.push([wx, yl, wz]);
          }
        }
      }
    }
    return vs;
  })(),
  edges: (() => {
    const bladeEdges = (off: number) => [
      [off + 0, off + 1], [off + 2, off + 3], [off + 4, off + 5], [off + 6, off + 7],
      [off + 0, off + 2], [off + 1, off + 3], [off + 4, off + 6], [off + 5, off + 7],
      [off + 0, off + 4], [off + 1, off + 5], [off + 2, off + 6], [off + 3, off + 7],
    ];
    return [...bladeEdges(0), ...bladeEdges(8), ...bladeEdges(16)];
  })(),
};

// v134 (2026-05-22): marcasite cockscomb-twin primitive. Two thin
// needle-like blades joined on a {110} contact at the base, opening
// in a tight V — the canonical morphology distinguishing marcasite
// from its dimorph pyrite (Ramdohr 1980 FeS2 dimorph section; Dana
// 8th ed. marcasite habit). v133's _retune_note flags this as "the
// visually defining feature of marcasite," reporting 50-70% twin
// frequency at the Joplin / Tri-State MVT district and Folkestone
// (Kent) Cretaceous chalk concretions. Probability set to 0.55 per
// nucleation; combined with the {101} spearhead twin (p=0.05) at
// path-1, ~57% of marcasite ends up twinned in scenarios.
//
// Why "cockscomb": real specimens show a chain of repeated blade-
// pair twins arranged in a serrated row resembling a rooster's
// comb. A single PRIM_* primitive can't capture the multi-pair
// chain directly, but when multiple twin instances cluster on a
// shared substrate (via the existing druzy/cluster dispatch), the
// chain emerges from the spatial arrangement. The primitive itself
// is the unit cell: one {110} blade-pair.
//
// Geometry vs. selenite swallowtail (PRIM_SELENITE_SWALLOWTAIL_TWIN):
//   Swallowtail (gypsum {100}): tabular blades, V opening 60°
//   Cockscomb (marcasite {110}): needle blades, V opening 40°
// Same 16-vertex / 24-edge topology — the tighter V + thinner blade
// dimensions give the arrowhead silhouette that distinguishes it.
const PRIM_MARCASITE_COCKSCOMB_TWIN = {
  name: 'marcasite_cockscomb_twin',
  vertices: (() => {
    const a = 0.04;             // half-thickness (perpendicular to broad face)
    const L = 1.1;              // blade length along c-axis
    const b = 0.10;             // half-width (along contact edge)
    const base_y = -0.1;        // anchor base contact at PRIM_CUBE wall y
    const theta = Math.PI / 9;  // 20° tilt per blade — 40° total V (tighter than swallowtail's 60°)
    const c30 = Math.cos(theta);
    const s30 = Math.sin(theta);
    const vs: number[][] = [];
    // Blade A — same construction as swallowtail (rotate +θ around z
    // through origin, then translate Y by base_y). Local coords with
    // xl ∈ {-2a, 0}, yl ∈ {0, L}, zl ∈ {-b, +b}. Contact face xl=0
    // sits on the z-axis at the base.
    for (const xl of [-2 * a, 0]) {
      for (const yl of [0, L]) {
        for (const zl of [-b, b]) {
          const wx = xl * c30 - yl * s30;
          const wy = xl * s30 + yl * c30 + base_y;
          vs.push([wx, wy, zl]);
        }
      }
    }
    // Blade B — mirror across X=0 (rotate -θ).
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
    // 12 edges per blade — box topology. Same as swallowtail.
    const bladeEdges = (off: number) => [
      [off + 0, off + 1], [off + 2, off + 3], [off + 4, off + 5], [off + 6, off + 7],
      [off + 0, off + 2], [off + 1, off + 3], [off + 4, off + 6], [off + 5, off + 7],
      [off + 0, off + 4], [off + 1, off + 5], [off + 2, off + 6], [off + 3, off + 7],
    ];
    return [...bladeEdges(0), ...bladeEdges(8)];
  })(),
};

// v134 (2026-05-22): pyrite iron-cross twin primitive. Two chiral
// {120} pyritohedra interpenetrating at 90° around the c-axis — the
// canonical pyrite "Iron Cross" / "Eisernes Kreuz" twin documented
// in Ramdohr 1980 §4 (FeS2 section), Dana 8th ed., and Mindat's
// pyrite habit catalog. Common at Elba (Italy), Pyrite Hill (Spain,
// Peru); specimens mined since antiquity for use in jewelry. v133
// retuned the probability from 0.008 → 0.07 to match the field-
// observation 5-10% twin frequency among euhedral pyrite.
//
// THE PYRITOHEDRON
//
//   A {120} pyritohedron (NOT the cube-symmetric approximation used
//   by PRIM_PYRITOHEDRON for non-twin pyrite) has m-3 symmetry —
//   3-fold rotations along [111] and 2-fold along [100], but NO
//   4-fold axis. So a 90° rotation around the c-axis is NOT a
//   symmetry, and the rotated pyritohedron occupies distinct
//   geometric positions from the original.
//
//   20 vertices, 12 pentagonal faces, 30 edges:
//     - 8 "cube corner" vertices at (±a, ±a, ±a) with a = √5/3·s
//     - 12 "edge" vertices in 3 cyclic groups:
//         (0, ±b, ±c) in YZ plane (long axis ±y)
//         (±b, ±c, 0) in XY plane (long axis ±x)
//         (±c, 0, ±b) in ZX plane (long axis ±z)
//       where b = √5/2·s, c = √5/4·s (b:c = 2:1 ratio).
//
//   Scaling: s = 0.55/b_unscaled chosen so max coordinate = 0.55
//   (matches PRIM_CUBE envelope). After scaling: a≈0.367, b=0.55,
//   c≈0.275. Y-shift +0.45 anchors at PRIM_CUBE wall convention
//   (y_min = -0.1, y_max = 1.0, center at y = 0.45).
//
// THE TWIN
//
//   First pyritohedron "+": vertex indices 0-19.
//   Second pyritohedron "-": 90° rotation around y-axis of "+":
//       (x, y, z) → (z, y, -x)
//     Vertex indices 20-39.
//
//   The 90° rotation is NOT a symmetry of "+" (chiral pyritohedron),
//   so "-" lands at distinct positions. The two interpenetrate to
//   produce the cross silhouette visible in real specimens.
//
//   40 vertices total (20 per pyritohedron), 60 edges total (30 per).
//   Some edges may visually coincide between the two pyritohedra at
//   crossing points; the wireframe renderer just draws both.
const PRIM_PYRITE_IRON_CROSS_TWIN = {
  name: 'pyrite_iron_cross_twin',
  vertices: (() => {
    // Unscaled pyritohedron parameters (d=1 units):
    //   a_raw = √5/3, b_raw = √5/2, c_raw = √5/4
    // Scaled so max coord = 0.55:
    const s = 0.55 / (Math.sqrt(5) / 2);  // ≈ 0.4924
    const a = (Math.sqrt(5) / 3) * s;     // cube corner — ≈ 0.367
    const b = 0.55;                       // long edge param (max coord by construction)
    const c = (Math.sqrt(5) / 4) * s;     // short edge param — ≈ 0.275
    const yC = 0.45;                      // y-center (matches PRIM_CUBE anchoring)
    // Build "+" pyritohedron — 20 vertices in centered coords, then
    // y-shift by yC.
    const plus: number[][] = [];
    // 8 cube corners (indices 0-7), ordered by (sx, sy, sz) loops.
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          plus.push([sx * a, sy * a + yC, sz * a]);
        }
      }
    }
    // 12 edge verts in 3 cyclic groups:
    //   indices 8-11: YZ plane (x=0), long along y. (0, sy·b, sz·c).
    //   indices 12-15: XY plane (z=0), long along x. (sx·b, sy·c, 0).
    //   indices 16-19: ZX plane (y=0), long along z. (sx·c, 0, sz·b).
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        plus.push([0, sy * b + yC, sz * c]);
      }
    }
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        plus.push([sx * b, sy * c + yC, 0]);
      }
    }
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        plus.push([sx * c, 0 + yC, sz * b]);
      }
    }
    // Build "-" pyritohedron — "+" rotated 90° around y-axis through
    // y-center. Transform: (x, y, z) → (z, y_C + (y - y_C), -x) =
    // (z, y, -x). For our verts, since y_C is built into y already,
    // we just apply (x, y, z) → (z, y, -x).
    // Actually that's the rotation around y AT THE CENTER (y=yC,
    // x=0, z=0). The rotation is (x - 0, y - yC, z - 0) →
    // ((z - 0), (y - yC), -(x - 0)) → translate back yC. Since y
    // doesn't change and x, z don't get shifted, it's just (z, y, -x).
    const minus: number[][] = plus.map(v => [v[2], v[1], -v[0]]);
    return [...plus, ...minus];
  })(),
  edges: (() => {
    // 30 edges per pyritohedron. Computed from the 12 pentagonal
    // face boundaries (each pentagon has 5 edges; each edge shared
    // by 2 pentagons → 12·5/2 = 30).
    //
    // Cube-corner indices 0-7 connect to edge-vert indices 8-19.
    // Each cube corner has 3 neighbors (one per adjacent face).
    // Each edge vert has 3 neighbors: 2 cube corners (one per
    // adjacent corner of the same face direction) + 1 "partner"
    // edge vert (the one on the same XY/YZ/ZX plane at the opposite
    // short-axis position).
    const pyritEdges = (off: number) => [
      // Cube → edge connections (24 edges):
      [off+0, off+8], [off+0, off+12], [off+0, off+16],   // (-,-,-)
      [off+1, off+9], [off+1, off+12], [off+1, off+17],   // (-,-,+)
      [off+2, off+10], [off+2, off+13], [off+2, off+16],  // (-,+,-)
      [off+3, off+11], [off+3, off+13], [off+3, off+17],  // (-,+,+)
      [off+4, off+8], [off+4, off+14], [off+4, off+18],   // (+,-,-)
      [off+5, off+9], [off+5, off+14], [off+5, off+19],   // (+,-,+)
      [off+6, off+10], [off+6, off+15], [off+6, off+18],  // (+,+,-)
      [off+7, off+11], [off+7, off+15], [off+7, off+19],  // (+,+,+)
      // Edge → edge "partner" connections (6 edges):
      [off+8, off+9],     // YZ verts at sy=-1 (partner on z)
      [off+10, off+11],   // YZ verts at sy=+1
      [off+12, off+13],   // XY verts at sx=-1 (partner on y)
      [off+14, off+15],   // XY verts at sx=+1
      [off+16, off+18],   // ZX verts at sz=-1 (partner on x)
      [off+17, off+19],   // ZX verts at sz=+1
    ];
    return [...pyritEdges(0), ...pyritEdges(20)];
  })(),
};

// v134 (2026-05-22): marcasite spearhead-twin primitive. The {101}
// contact twin of marcasite — visually a single elongated rhombic
// bipyramid (Dana 8th ed. marcasite habit; Mindat marcasite catalog).
// Distinct from PRIM_DIPYRAMID (hex bipyramid) and PRIM_OCTAHEDRON
// (regular octahedron): spearhead is stretched along c and has
// RHOMBIC (not hex, not square) cross-section reflecting marcasite's
// orthorhombic symmetry. v133 set spearhead probability to 0.05
// (per the path-1 retune rationale documented in the marcasite
// twin_laws _retune_note: spearhead rolls first at 5%, then cockscomb
// at 55% if spearhead didn't fire).
//
// Geometry: 6 vertices (2 apexes + 4 equator), 12 edges. Same
// topology as PRIM_OCTAHEDRON, but the equatorial radii differ
// between x and z axes (a > b) to give the rhombic cross-section
// signature of an orthorhombic twin.
//
// Why "spearhead": real marcasite specimens of the {101} twin look
// like a stylized spearhead or arrowhead — pointed apex, broad
// midsection, narrow base. Common at Joplin / Tri-State MVT
// (alongside the more common cockscomb twin), Folkestone Cretaceous
// chalk concretions.
const PRIM_MARCASITE_SPEARHEAD_TWIN = {
  name: 'marcasite_spearhead_twin',
  vertices: [
    [ 0.0,  1.0,  0.0 ],   // 0 top apex (pointed end)
    [ 0.0, -0.1,  0.0 ],   // 1 bottom apex (buried at wall)
    [ 0.18, 0.45,  0.0 ],  // 2 east (broad direction — a-axis, longer)
    [-0.18, 0.45,  0.0 ],  // 3 west
    [ 0.0,  0.45,  0.10 ], // 4 north (narrow direction — b-axis, shorter; rhombic)
    [ 0.0,  0.45, -0.10 ], // 5 south
  ],
  edges: [
    [0, 2], [0, 3], [0, 4], [0, 5],  // top apex → equator
    [1, 2], [1, 3], [1, 4], [1, 5],  // bottom apex → equator
    [2, 4], [4, 3], [3, 5], [5, 2],  // equator ring
  ],
};

// v134 (2026-05-22): aragonite contact-twin primitive. The single
// {110} contact twin variant (v133 has both 'cyclic_sextet' p=0.40
// and 'contact' p=0.05 in aragonite's twin_laws). Two prismatic
// orthorhombic prisms joined at base in a V — distinct from the
// 3-fold cyclic-sextet pseudo-hex column. Documented in Dana 8th ed.
// CaCO3 section + Speer 1983 (Reviews in Mineralogy v.11) as the
// "simple contact twin" variant.
//
// Visual distinction from the other V-twin primitives:
//   selenite swallowtail (gypsum {100}):   tabular blades (a:b = 0.08:0.18),
//                                          60° V opening
//   marcasite cockscomb (marcasite {110}): needle blades (a:b = 0.04:0.10),
//                                          40° V opening
//   aragonite contact (aragonite {110}):   prismatic blades (a:b = 0.10:0.10
//                                          — chunky square cross-section),
//                                          60° V opening
//
// 16 vertices (8 per blade), 24 edges. Same construction pattern as
// the swallowtail / cockscomb V-pair twins, just with square cross-
// section reflecting aragonite's prismatic individual habit.
const PRIM_ARAGONITE_CONTACT_TWIN = {
  name: 'aragonite_contact_twin',
  vertices: (() => {
    const a = 0.10;             // half-thickness (perpendicular to broad face)
    const L = 1.1;              // blade length along c-axis
    const b = 0.10;             // half-width along contact edge — SQUARE cross-section
    const base_y = -0.1;        // anchor base contact at PRIM_CUBE wall y
    const theta = Math.PI / 6;  // 30° tilt per blade — 60° total V
    const cT = Math.cos(theta);
    const sT = Math.sin(theta);
    const vs: number[][] = [];
    // Blade A — local (xl, yl, zl) in {-2a, 0} × {0, L} × {-b, +b}.
    // Contact face (xl=0) sits on the rotation axis; the blade body
    // extends to xl=-2a after rotation by +30° around z (through origin),
    // then translated up by base_y.
    for (const xl of [-2 * a, 0]) {
      for (const yl of [0, L]) {
        for (const zl of [-b, b]) {
          const wx = xl * cT - yl * sT;
          const wy = xl * sT + yl * cT + base_y;
          vs.push([wx, wy, zl]);
        }
      }
    }
    // Blade B — mirror across X=0 (rotate -30°).
    for (const xl of [0, 2 * a]) {
      for (const yl of [0, L]) {
        for (const zl of [-b, b]) {
          const wx = xl * cT + yl * sT;
          const wy = -xl * sT + yl * cT + base_y;
          vs.push([wx, wy, zl]);
        }
      }
    }
    return vs;
  })(),
  edges: (() => {
    const bladeEdges = (off: number) => [
      [off + 0, off + 1], [off + 2, off + 3], [off + 4, off + 5], [off + 6, off + 7],
      [off + 0, off + 2], [off + 1, off + 3], [off + 4, off + 6], [off + 5, off + 7],
      [off + 0, off + 4], [off + 1, off + 5], [off + 2, off + 6], [off + 3, off + 7],
    ];
    return [...bladeEdges(0), ...bladeEdges(8)];
  })(),
};

// Cave-aragonite frostwork — 2D wireframe counterpart of the Three.js
// _makeAragoniteFrostwork geometry (99i). Radiating acicular spray:
// 5 thin needles from a common base nucleus — a central vertical spike
// plus four tilted ~27° in the cardinal directions. Mirrors the same 5
// needle axes the Three.js builder uses ([0,1,0], [±0.45,0.9,0],
// [0,0.9,±0.45]) so the wireframe projection matches the 3D form.
// Hill & Forti 1997 (Cave Minerals of the World §5.3.4, §10); cave
// aragonite manifests as frostwork regardless of twin state (the
// cyclic-sextet pseudo-hex twin shows up as a 6-fold needle cluster, not
// a smooth column — Frisia et al. 2002, Grotte de Clamouse).
// BUG-aragonite-twin-cave-morphology.md.
const PRIM_ARAGONITE_FROSTWORK = {
  name: 'aragonite_frostwork',
  vertices: (() => {
    const baseY = -0.2;          // base nucleus anchor
    const len = 1.1;             // needle length
    const axes: number[][] = [
      [0,     1.00, 0    ],      // central spike (straight up)
      [0.45,  0.90, 0    ],      // tilt +x
      [-0.45, 0.90, 0    ],      // tilt -x
      [0,     0.90, 0.45 ],      // tilt +z
      [0,     0.90, -0.45],      // tilt -z
    ];
    const vs: number[][] = [[0, baseY, 0]];  // 0: base nucleus
    for (const ax of axes) {
      const m = Math.hypot(ax[0], ax[1], ax[2]);
      vs.push([ax[0] / m * len, baseY + ax[1] / m * len, ax[2] / m * len]);
    }
    return vs;
  })(),
  // One edge per needle: base nucleus (0) → each tip (1..5).
  edges: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5]],
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
  // Calcite-morphology arc Phase 2 (2026-06-11): σ-regime habit strings
  // route to their parent-form primitives. EXPLICIT entries are load-
  // bearing for the hopper pair: the 99d fuzzy fallback checks 'hopper'
  // BEFORE 'rhomb'/'scalenohed' and would route calcite hoppers to
  // PRIM_CUBE (cubic skeletal — wrong system for a carbonate).
  'stepped_rhombohedral':           PRIM_RHOMBOHEDRON,
  'stepped_scalenohedral':          PRIM_SCALENOHEDRON,
  'hopper_rhombohedral':            PRIM_RHOMBOHEDRON,
  'hopper_scalenohedral':           PRIM_SCALENOHEDRON,
  'dendritic_rhombohedral':         PRIM_ACICULAR,
  'dendritic_scalenohedral':        PRIM_ACICULAR,
  // Morphology-generalization arc (2026-06-12): the halide cube family
  // (halite/sylvite regime habits). stepped/hopper keep the CUBE parent
  // primitive (here the 99d 'hopper'→cube fuzzy would actually be
  // right, but explicit beats fuzzy); dendritic crusts go acicular like
  // the calcite dendrites.
  'stepped_cube':                   PRIM_CUBE,
  'hopper_cube':                    PRIM_CUBE,
  'dendritic_cube':                 PRIM_ACICULAR,
  // Bismuth regime family (2026-06-12): lath fans + skeletal frames
  // both read as spikes at primitive scale; arborescent_dendritic
  // already routes via the dendritic fuzzy.
  'feathery_bismuth':               PRIM_ACICULAR,
  'skeletal_bismuth':               PRIM_ACICULAR,
  // Pyrite striation overlay (2026-06-12): striated forms keep their
  // parent primitives.
  'striated_cubic':                 PRIM_CUBE,
  'striated_pyritohedral':          PRIM_PYRITOHEDRON,
  'striated_cubo_pyritohedral':     PRIM_PYRITOHEDRON,
  // REE-octahedron regime family (fix-backlog 2026-06-12): explicit
  // beats fuzzy — the fuzzy fallback's 'hopper' check fires before
  // 'octahed' and would route hopper_octahedral_REE to a CUBE.
  // dendritic goes acicular like the other dendritic crusts.
  'octahedral_REE':                 PRIM_OCTAHEDRON,
  'stepped_octahedral_REE':         PRIM_OCTAHEDRON,
  'hopper_octahedral_REE':          PRIM_OCTAHEDRON,
  'dendritic_octahedral_REE':       PRIM_ACICULAR,
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
