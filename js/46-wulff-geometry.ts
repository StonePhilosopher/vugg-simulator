// ============================================================
// js/46-wulff-geometry.ts — the central-distance (Wulff-body) crystal kernel
// ============================================================
// Phase 4 of the central-distance / directional-growth arc
// (proposals/PROPOSAL-DIRECTIONAL-GROWTH-2026-06-22.md §1.1 + §2.3;
//  design pass: proposals/DESIGN-WULFF-PHASE-4-2026-06-28.md).
//
// WHAT THIS IS
// A crystal's external shape as a bounded convex polyhedron
//     P = ⋂ᵢ { x : nᵢ·x ≤ dᵢ }
// one oriented plane per crystallographic form face: outward unit normal nᵢ
// (FIXED by the point group acting on the form indices {hkl} — Steno's law of
// constancy of interfacial angles) and a central distance dᵢ (DYNAMIC, advances
// with growth). Habit emerges from the RELATIVE rates {Rᵢ} ("slow faces win"):
// equal d → cuboctahedron, shrink {111} → cube, shrink {100} → octahedron — a
// real distance-driven habit transition the (c_length, a_width, habit-string)
// triple cannot express.
//
// WHY IT'S HERE AND NOT IN THE ENGINE
// This is RENDER-ONLY (design pass D5, Phase 4a): the face set drives the
// visible mesh; engine math (add_zone / _volume_mm3 / get_vug_fill / chemistry)
// keeps reading the unchanged c_length_mm / a_width_mm scalars. So tagging a
// crystal with a face set never moves the seed-42 baseline — byte-identical, no
// SIM bump, no rebake (the same layer-1 discipline as Phases 0–3). Engine-
// coupled accurate-volume Wulff (Phase 4b) is a separate later per-scenario step.
//
// RENDERING METHOD (design pass D2)
// Direct triple-plane half-space intersection — NO ConvexGeometry / new Three.js
// dependency (none exists in the bundle; every solid here is hand-rolled). For
// the ≤~24 faces a crystal has this is trivially correct and cheap: solve every
// triple of planes for its common point, keep it only if it satisfies all the
// other half-spaces, group survivors by face, angle-sort, fan-triangulate. A
// grown-out face contributes no vertices automatically — no special-casing.
// Degenerate / empty polyhedra (inconsistent distances → <4 vertices) clamp to
// null so the renderer falls back to the symmetric primitive (never crashes).
//
// DETERMINISM (design pass D4)
// Fully rng-free. dᵢ(g) = dᵢ⁰ + g·Rᵢ with FIXED Rᵢ (BFDH seed) and g = the
// already-tracked total_growth_um; per-crystal variation is a golden-ratio hash
// of crystal_id (the classifyOcclusion pattern). Zero rng draws → zero cascade
// risk → trivially byte-identical.
//
// 4a.0 STATUS: this kernel + its fixture test ship as pure infra. Nothing
// dispatches it yet (no scenario/mineral opts in) — that's rung 4a.1, gated on
// the boss's aesthetic look at the first tenant (fluorite). Until then every
// render path is byte-for-byte the existing primitive scale.

// ------------------------------------------------------------
// Form registry — per-tenant point group + forms {hkl} with BFDH-seed rates.
// Mirrors the CALCITE_MORPH_TH / MINERAL_GATES per-tenant pattern: we encode the
// forms we actually use, not a universal 32-point-group engine. R is the RELATIVE
// face advance rate; only ratios matter (slow faces win). BFDH seed: R ∝ 1/d_hkl
// (cubic d_hkl = a/√(h²+k²+l²) → d_100=a > d_111=a/√3, so {100} is the slower,
// more important form — which is why fluorite/galena default to cubes). Real
// values are hand-tuned per tenant against the specimen record, BFDH-seeded.
// ------------------------------------------------------------
// Each form: { hkl, R (relative advance rate; only ratios matter), bias? }. The
// optional `bias: true` flag marks the form whose rate biasC divides (R/biasC) —
// the habit knob: biasC>1 slows that form so it dominates, biasC<1 speeds it so it
// recedes and its competitor takes over. (Generalizes the old cubic-only isCube
// test so trigonal tenants get the same knob.) `cell` carries the metric a lower-
// symmetry system needs to turn {hkl} into a real-space normal.
const WULFF_FORM_GEOMETRY: any = {
  // rung 4a.1 — the textbook cube↔octahedron mineral. R_111 > R_100 means the
  // octahedron faces advance faster (shrink in area), so the default habit is the
  // cube; biasC<1 raises R_100 toward octahedral (the existing octahedral_REE token
  // dispatch, made geometrically true). bias flag on {100}.
  fluorite: { system: 'cubic', forms: [
    { hkl: [1, 0, 0], R: 1.0, bias: true },
    { hkl: [1, 1, 1], R: 1.7 },
  ] },
  // Worked cubic sibling (galena cube ± octahedron) — ready, not yet dispatched.
  galena: { system: 'cubic', forms: [
    { hkl: [1, 0, 0], R: 1.0, bias: true },
    { hkl: [1, 1, 1], R: 1.5 },
  ] },
  // rung 4a.2 — the FIRST non-cubic tenant: calcite, trigonal R-3c, point group -3m
  // (hexagonal cell a=4.99 c=17.06 from data/structural.json). Forms: the cleavage
  // rhombohedron r {10-14}=(104) and the dogtooth scalenohedron v {21-31}=(211).
  // BFDH (R ∝ 1/d_hkl): d_104=3.03Å > d_211=1.63Å ⇒ R_211≈1.87·R_104, so the
  // rhombohedron (nailhead) is the default; biasC<1 slows the scalenohedron's
  // competitor and the dogtooth takes over (the kinetic high-σ / Mg habit). bias on
  // the rhombohedron {104}. This is the proof the central-distance model is a GENERAL
  // framework, not a cubic special case — a second crystal system from one equation.
  calcite: { system: 'trigonalR', cell: { a: 4.99, c: 17.06 }, forms: [
    { hkl: [1, 0, 4], R: 1.0, bias: true },
    { hkl: [2, 1, 1], R: 1.87 },
  ] },
  // rung 4a.3 — the THIRD crystal system: wulfenite, tetragonal I4₁/a (scheelite-type), Laue class
  // 4/m (C4h, order 8 — NOT the higher 4/mmm; the reduced symmetry, no vertical mirrors, is the
  // real reason wulfenite crystals look pyramidal/asymmetric). a=5.4347 c=12.110 (data/structural.
  // json). Forms: the basal pinacoid c{001} (the flat plate faces) and the tetragonal bipyramid
  // {101} (the bevelled edge). BFDH (R ∝ 1/d_hkl): d_001=c=12.11Å ≫ d_101=4.96Å ⇒ R_101≈2.44·R_001,
  // so {001} is by far the slowest form ⇒ TABULAR by default — exactly wulfenite's nature, no knob
  // needed. bias on {001}: biasC>1 slows the pinacoid further → thinner plate; biasC<1 speeds it →
  // the {101} bipyramid takes over (pyramidal → pseudo-octahedral). One equation, three crystal
  // systems. rung 4a.7 (2026-07-01): this tenant's biasC is now the Pb:Mo EARNED-FORM lever —
  // derived from the crystal's growth-weighted fluid ratio, not the id-hash (js/45 WULFENITE_PBMO).
  wulfenite: { system: 'tetragonal', cell: { a: 5.4347, c: 12.110 }, forms: [
    { hkl: [0, 0, 1], R: 1.0, bias: true },
    { hkl: [1, 0, 1], R: 2.44 },
  ] },
  // rung 4a.4 — the FOURTH crystal system: barite, orthorhombic Pnma (barite-group BaSO4), point
  // group mmm (D2h, order 8). a=8.879 b=5.450 c=7.152 (data/structural.json) — the FIRST cell with
  // THREE UNEQUAL axes (a≠b≠c), so the c{001} tabular plate is RECTANGULAR (a≠b), not square like
  // wulfenite's — a habit NO cubic/trigonal/tetragonal cell can express. Forms: the basal pinacoid
  // c{001} (the flat tabular face), the prism m{210} (the perfect-cleavage side faces) and the dome
  // o{011} (a minor bevel) — the textbook barite c/m/o triple. {001} slowest (bias, tabular), then
  // m{210} < o{011}.
  //   FACE-RATE ORDERING — {210}>{011} corrected 2026-07-01 (verified attachment-energy pass). The
  //   original BFDH seeding had it BACKWARDS: BFDH (R ∝ 1/d_hkl) ranks by d-spacing alone, and
  //   d_210=3.44Å < d_011=4.34Å made {210} the FASTEST, most-minor face (R=2.08) — but m{210} is a
  //   PERFECT CLEAVAGE and a low-energy F-face, so it must OUT-RANK the o{011} dome, not sit below it.
  //   Bittarello, Bruno & Aquilano 2018 (Cryst. Growth Des. 18:4084, DOI 10.1021/acs.cgd.8b00460)
  //   ab-initio B3LYP surface energies give the order (210)≈(001) < (211) < (101) < (010) < (011) < …,
  //   and Hartman & Strom 1989 (J. Cryst. Growth 97:502) F/S/K analysis finds {210} an F form and {011}
  //   a kinked (fast) form. So R_210=1.65 (dominant prism), R_011=2.08 (minor dome), R_001=1.0.
  //   NB these stay ORDERING-informed BFDH-class values, NOT measured growth rates: the ab-initio σ are
  //   0 K EQUILIBRIUM energies while barite's tabular habit is a GROWTH form — plugging σ in directly
  //   (R_210≈1.0) collapses the tabular habit (equant + the dome self-eliminates, proto-verified), so
  //   only the {210}>{011} ORDERING is taken from the literature, not the magnitudes. bias on {001}:
  //   biasC>1 slows the pinacoid → thinner plate/blade; biasC<1 speeds it → prism/dome take over
  //   (prismatic). The a-vs-b elongation of the plate is LOCALITY-DEPENDENT (varies by formation
  //   conditions) and was never verified against ground truth — the original BFDH guessed longer-along-a;
  //   the corrected ordering renders longer-along-b. Only the rectangular-ness (a≠b) is a real invariant.
  //   The barite group (celestine a=8.359 c=6.866, anglesite a=8.482 c=6.959) is isostructural — a
  //   one-line clone away from those siblings. One equation, four crystal systems.
  barite: { system: 'orthorhombic', cell: { a: 8.879, b: 5.450, c: 7.152 }, forms: [
    { hkl: [0, 0, 1], R: 1.0, bias: true },   // c{001} basal pinacoid — slowest, the tabular plate face
    { hkl: [0, 1, 1], R: 2.08 },              // o{011} dome — high-E minor fast bevel (was R=1.65, see note)
    { hkl: [2, 1, 0], R: 1.65 },              // m{210} prism — perfect cleavage + low-E F-face, dominant edge (was R=2.08)
  ] },
  // rung 4a.6 — the FIFTH crystal system: titanite (sphene) CaTiSiO₅, monoclinic 2/m (space group
  // P2₁/a, point group C2h, order 4 — HALF of orthorhombic mmm). a=7.057 b=8.707 c=6.555 β=113.81°
  // (data/structural.json) — the FIRST OBLIQUE cell (β≠90°), so the reciprocal vector needs the metric-
  // tensor cross-term (an h↔l coupling), NOT the trivial (h/a,k/b,l/c) the four orthogonal-cell systems
  // shared. The genuinely-new capability: a{100} and c{001} meet at 180−β = 66.19° — the FIRST non-
  // perpendicular face pair in the kernel, which IS the oblique titanite WEDGE (the "sphene" sphenoid).
  // Unique axis b on the renderer Y (the 2-fold ∥ Y), a on X, c in the X-Z plane at β from a. Forms:
  // a{100} the flattening pinacoid, c{001} the bevel that opens the 66° wedge, m{110} prism, u{011}
  // clinodome, and the negative pyramid {-111} capping the wedge end. BFDH (R ∝ 1/d): d_100=6.456 >
  // d_001=5.997 > d_110=5.186 > d_011=4.939 > d_-111=4.760 ⇒ R_001=1.08, R_110=1.25, R_011=1.31,
  // R_-111=1.36 vs R_100=1.0, so a{100} is the slowest ⇒ flattened wedge by default. bias on a{100}:
  // higher biasC flattens the wedge further on {100} (the β-lean lives in the FACES, invariant of biasC).
  // The fifth crystal system from the same one equation — and the first that is not box-orthogonal.
  titanite: { system: 'monoclinic', cell: { a: 7.057, b: 8.707, c: 6.555, beta: 113.81 }, forms: [
    { hkl: [1, 0, 0], R: 1.0, bias: true },
    { hkl: [0, 0, 1], R: 1.08 },
    { hkl: [1, 1, 0], R: 1.25 },
    { hkl: [0, 1, 1], R: 1.31 },
    { hkl: [-1, 1, 1], R: 1.36 },
  ] },
};

// ------------------------------------------------------------
// Vector helpers (uniquely named so the single concatenated bundle scope can't
// collide with another module's dot/cross/norm).
// ------------------------------------------------------------
function _wulffDot(a: any, b: any): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function _wulffCross(a: any, b: any): any {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function _wulffNorm(a: any): any {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

// Solve [nᵢ; nⱼ; nₖ]·v = [dᵢ; dⱼ; dₖ] by Cramer's rule. null if near-singular
// (the three planes don't meet in a single point).
function _wulffSolve3(fi: any, fj: any, fk: any): any {
  const a = fi.n, b = fj.n, c = fk.n;
  const det =
      a[0] * (b[1] * c[2] - b[2] * c[1])
    - a[1] * (b[0] * c[2] - b[2] * c[0])
    + a[2] * (b[0] * c[1] - b[1] * c[0]);
  if (Math.abs(det) < 1e-9) return null;
  const d0 = fi.d, d1 = fj.d, d2 = fk.d;
  const detX =
      d0 * (b[1] * c[2] - b[2] * c[1])
    - a[1] * (d1 * c[2] - b[2] * d2)
    + a[2] * (d1 * c[1] - b[1] * d2);
  const detY =
      a[0] * (d1 * c[2] - b[2] * d2)
    - d0 * (b[0] * c[2] - b[2] * c[0])
    + a[2] * (b[0] * d2 - d1 * c[0]);
  const detZ =
      a[0] * (b[1] * d2 - d1 * c[1])
    - a[1] * (b[0] * d2 - d1 * c[0])
    + d0 * (b[0] * c[1] - b[1] * c[0]);
  return [detX / det, detY / det, detZ / det];
}

// ------------------------------------------------------------
// Symmetry expansion — a form {hkl} → all crystallographically equivalent face
// normals. Cubic (m3m) is isotropic, so the {hkl} index IS the real-space
// direction: the orbit is every sign × permutation variant, deduped, unit-length.
// (Lower-symmetry systems — e.g. calcite's hexagonal-R — need the reciprocal-
// lattice metric from data/structural.json; added with the calcite rung 4a.2.)
// ------------------------------------------------------------
function wulffCubicNormals(hkl: any): any {
  const h = hkl[0], k = hkl[1], l = hkl[2];
  const perms = [[h, k, l], [h, l, k], [k, h, l], [k, l, h], [l, h, k], [l, k, h]];
  const out: any[] = [];
  const seen: any = {};
  for (const p of perms) {
    for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
      const u = _wulffNorm([p[0] * sx, p[1] * sy, p[2] * sz]);
      const key = u.map((x: number) => (Math.abs(x) < 1e-12 ? 0 : x).toFixed(6)).join(',');
      if (seen[key]) continue;
      seen[key] = true;
      out.push(u);
    }
  }
  return out;
}

// ------------------------------------------------------------
// Trigonal / hexagonal-R symmetry expansion (calcite -3m, rung 4a.2). Unlike cubic,
// {hkl} is NOT the real-space direction — the face normal is the RECIPROCAL vector
// g = h·a* + k·b* + l·c*. We put the crystallographic c-axis (the 3-fold) on the
// renderer's Y (its c-axis convention: mesh.scale.set(aWid, cLen, aWid)), so the
// basal plane lies in X-Z. The hexagonal reciprocal metric in that frame gives
// a*=(1/a, 0, 1/(a√3)), b*=(0, 0, 2/(a√3)), c*=(0, 1/c, 0), so
//   g(h,k,l) = ( h/a , l/c , (h+2k)/(a√3) )   [3-index Miller; i = -(h+k) dropped].
// The orbit is the point group -3m (D3d, order 12) acting on g — built once by
// closure of its generators { C3(y), C2(x), inversion } (validated: 12 ops;
// {104}→6 rhombohedron faces, {21-31}→12 scalenohedron faces with Y the long axis —
// the dogtooth stands on c). a-axis C2 ⇒ -3m1, the calcite setting.
// ------------------------------------------------------------
function _wulffMatVec(M: any, v: any): any {
  return [
    M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
    M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
    M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
  ];
}
function _wulffMatMul(A: any, B: any): any {
  const R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let s = 0; for (let k = 0; k < 3; k++) s += A[i][k] * B[k][j]; R[i][j] = s;
  }
  return R;
}
function _wulffMatKey(M: any): string {
  return [].concat(...M).map((x: number) => (Math.abs(x) < 1e-9 ? 0 : x).toFixed(5)).join(',');
}
// Build a point group by closure over its generator matrices (BFS to fixpoint).
function _wulffBuildGroup(gens: any[]): any[] {
  const I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const mats = [I]; const seen: any = { [_wulffMatKey(I)]: true };
  let added = true;
  while (added) {
    added = false;
    for (const M of mats.slice()) for (const G of gens) {
      const P = _wulffMatMul(M, G); const key = _wulffMatKey(P);
      if (!seen[key]) { seen[key] = true; mats.push(P); added = true; }
    }
  }
  return mats;
}
const _WULFF_S3 = Math.sqrt(3) / 2;
// -3m1 generators (Cartesian; c-axis on Y so the 3-fold is along Y, 2-fold along a1=x):
const _WULFF_TRIGONAL_GROUP = _wulffBuildGroup([
  [[-0.5, 0, _WULFF_S3], [0, 1, 0], [-_WULFF_S3, 0, -0.5]],    // C3 about y (120°)
  [[1, 0, 0], [0, -1, 0], [0, 0, -1]],                         // C2 about x (a1 axis)
  [[-1, 0, 0], [0, -1, 0], [0, 0, -1]],                        // inversion centre
]);
function wulffTrigonalNormals(hkl: any, a: number, c: number): any {
  const h = hkl[0], k = hkl[1], l = hkl[2];
  const seed = _wulffNorm([h / a, l / c, (h + 2 * k) / (a * Math.sqrt(3))]);
  const out: any[] = [];
  const found: any = {};
  for (const M of _WULFF_TRIGONAL_GROUP) {
    const u = _wulffMatVec(M, seed);
    const key = u.map((x: number) => (Math.abs(x) < 1e-12 ? 0 : x).toFixed(6)).join(',');
    if (found[key]) continue;
    found[key] = true;
    out.push(u);
  }
  return out;
}

// ------------------------------------------------------------
// Tetragonal symmetry expansion (wulfenite, rung 4a.3). Scheelite-type I4₁/a → Laue class 4/m
// (C4h, order 8). Like calcite the face normal is the RECIPROCAL vector g = h·a* + k·b* + l·c*, but
// the tetragonal cell is ORTHOGONAL (a*=b*=1/a, c*=1/c), so with the crystallographic c-axis (the
// 4-fold) on the renderer's Y:
//   g(h,k,l) = ( h/a , l/c , k/a ).
// The orbit is the point group 4/m acting on g — built once by closure of its generators
// { C4(y), σh(⊥y), inversion } (8 ops; validated: {001}→2 pinacoid, {100}→4 prism, {101}→8
// bipyramid, with Y the SHORT axis so a thin plate lies FLAT — the tabular plate stands on c).
// 4/m and NOT 4/mmm: the lower symmetry IS wulfenite's true point group (the absent vertical
// mirrors are why {hkl}≠{khl} there); for the {001}+{101} forms used here both groups give the
// same faces, but the honest group leaves room for a future skew form without a silent error.
// ------------------------------------------------------------
const _WULFF_TETRAGONAL_GROUP = _wulffBuildGroup([
  [[0, 0, 1], [0, 1, 0], [-1, 0, 0]],    // C4 about y (+90°)
  [[1, 0, 0], [0, -1, 0], [0, 0, 1]],    // σh — mirror perpendicular to the 4-fold (y → -y)
  [[-1, 0, 0], [0, -1, 0], [0, 0, -1]],  // inversion centre
]);
function wulffTetragonalNormals(hkl: any, a: number, c: number): any {
  const h = hkl[0], k = hkl[1], l = hkl[2];
  const seed = _wulffNorm([h / a, l / c, k / a]);   // g = (h/a, l/c, k/a) — c on Y
  const out: any[] = [];
  const found: any = {};
  for (const M of _WULFF_TETRAGONAL_GROUP) {
    const u = _wulffMatVec(M, seed);
    const key = u.map((x: number) => (Math.abs(x) < 1e-12 ? 0 : x).toFixed(6)).join(',');
    if (found[key]) continue;
    found[key] = true;
    out.push(u);
  }
  return out;
}

// ------------------------------------------------------------
// Orthorhombic symmetry expansion (barite, rung 4a.4). Barite-group Pnma → point group mmm
// (D2h, order 8). Like calcite/wulfenite the face normal is the RECIPROCAL vector g, and like
// tetragonal the cell is ORTHOGONAL — but with THREE UNEQUAL axes (a*=1/a, b*=1/b, c*=1/c all
// distinct). With the crystallographic c-axis (the {001} flattening axis) on the renderer's Y:
//   g(h,k,l) = ( h/a , l/c , k/b ).
// The orbit is the point group mmm acting on g — built once by closure of its three mirrors
// { m⊥a, m⊥c, m⊥b } (8 ops; validated: {001}→2 pinacoid, {011}→4 dome, {210}→4 prism, {111}→8
// bipyramid confirms the order-8 group). Because a≠b the in-plane extents differ — X is governed by a,
// Z by b — so the tabular plate is RECTANGULAR, the new capability this fourth crystal system brings.
// (The *rendered* plate ratio is ~1.25:1, NOT the bare cell ratio a/b=1.63: the o{011} dome and m{210}
// prism rim cut both the X and Z extents, so the lozenge is gentler than the raw axial ratio. Swap a↔b
// and the ratio inverts — that's the proof X tracks a and Z tracks b.) Unlike cubic (m3m) there are NO
// axis permutations here: the three axes are inequivalent, so the orbit is sign-flips only (the 8
// diagonal ±1 matrices), deduped — zeros in g collapse a form to a 2- or 4-face pinacoid/prism, a
// general {hkl} opens to the full 8.
// ------------------------------------------------------------
const _WULFF_ORTHORHOMBIC_GROUP = _wulffBuildGroup([
  [[-1, 0, 0], [0, 1, 0], [0, 0, 1]],    // m⊥X — mirror perpendicular to renderer-X (crystal a-axis)
  [[1, 0, 0], [0, -1, 0], [0, 0, 1]],    // m⊥Y — mirror perpendicular to renderer-Y (crystal c, the flattening axis)
  [[1, 0, 0], [0, 1, 0], [0, 0, -1]],    // m⊥Z — mirror perpendicular to renderer-Z (crystal b-axis)
]);
function wulffOrthorhombicNormals(hkl: any, a: number, b: number, c: number): any {
  const h = hkl[0], k = hkl[1], l = hkl[2];
  const seed = _wulffNorm([h / a, l / c, k / b]);   // g = (h/a, l/c, k/b) — c on Y, a on X, b on Z
  const out: any[] = [];
  const found: any = {};
  for (const M of _WULFF_ORTHORHOMBIC_GROUP) {
    const u = _wulffMatVec(M, seed);
    const key = u.map((x: number) => (Math.abs(x) < 1e-12 ? 0 : x).toFixed(6)).join(',');
    if (found[key]) continue;
    found[key] = true;
    out.push(u);
  }
  return out;
}

// ------------------------------------------------------------
// Monoclinic symmetry expansion (titanite, rung 4a.6 — the FIFTH crystal system, 2/m / C2h order 4).
// The FIRST OBLIQUE cell: β≠90°, so the reciprocal vector needs the full metric tensor — an h↔l cross-
// term — not the trivial (h/a,k/b,l/c) the four orthogonal-cell systems used. With the unique axis b
// (the 2-fold) on the renderer Y, a on X, and c in the X-Z plane at β from a, the b-unique reciprocal
// basis a*=(1/a,0,−cosβ/(a·sinβ)), b*=(0,1/b,0), c*=(0,0,1/(c·sinβ)) gives
//   g(h,k,l) = ( h/a , k/b , (l/c − h·cosβ/a)/sinβ ).
// The orbit is the point group 2/m acting on g — built once by closure of { C2(y), inversion } (the
// mirror m⊥b falls out as C2·i). 4 ops (validated in scratchpad/wulff-monoclinic-proto.mjs): the
// pinacoids {100}/{010}/{001}→2, the prism/dome/general {110}/{011}/{-111}→4. The signature the four
// orthogonal systems CANNOT produce: {100}∧{001} = 180−β ≠ 90° — the oblique wedge, the whole reason
// monoclinic looks different. (The renderer scales this body isotropically-by-diameter like wulfenite/
// barite, so the b-on-Y internal frame never has to agree with a token's c-on-Y convention.)
// ------------------------------------------------------------
const _WULFF_MONOCLINIC_GROUP = _wulffBuildGroup([
  [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],   // C2 about Y — the unique 2-fold (crystal b-axis)
  [[-1, 0, 0], [0, -1, 0], [0, 0, -1]],  // inversion centre (closure yields m⊥b = C2·i)
]);
function wulffMonoclinicNormals(hkl: any, a: number, b: number, c: number, betaDeg: number): any {
  const h = hkl[0], k = hkl[1], l = hkl[2];
  const beta = betaDeg * Math.PI / 180;
  const cosB = Math.cos(beta), sinB = Math.sin(beta);
  // monoclinic reciprocal vector (b-unique, b on Y); the h↔l cross-term is the oblique-cell signature
  const seed = _wulffNorm([h / a, k / b, (l / c - h * cosB / a) / sinB]);
  const out: any[] = [];
  const found: any = {};
  for (const M of _WULFF_MONOCLINIC_GROUP) {
    const u = _wulffMatVec(M, seed);
    const key = u.map((x: number) => (Math.abs(x) < 1e-12 ? 0 : x).toFixed(6)).join(',');
    if (found[key]) continue;
    found[key] = true;
    out.push(u);
  }
  return out;
}

// ------------------------------------------------------------
// Build the dynamic face set for a registry mineral at a given scalar growth.
//   dᵢ(g) = SEED + SPAN·g·Rᵢ_effective   (proposal §1.2, normalized units)
// growthFrac ∈ [0,1] is how developed the crystal is (maps the engine's growth
// scalar into a unit envelope — absolute distance is normalized away in
// _makeWulffGeom's ±0.5 envelope). biasC>1 slows {100} → cube; biasC<1 →
// octahedral (the REE/Y bias); a golden-ratio hash of crystalId adds rng-free
// per-crystal variation. Returns [{n,d}] ready for wulffPolyhedron.
// ------------------------------------------------------------
function wulffFaceSetForMineral(mineral: string, growthFrac: number, crystalId: number, biasC: number): any {
  const reg = WULFF_FORM_GEOMETRY[mineral];
  if (!reg) return null;
  const g = Math.max(0.05, Math.min(1.0, growthFrac || 0.5));
  // rng-free per-crystal jitter on the relative-rate spread (±12%, clamped).
  const hsh = (((crystalId || 0) * 0.6180339887498949) % 1 + 1) % 1;
  const jitter = 1.0 + (hsh - 0.5) * 0.24;
  const faces: any[] = [];
  for (const form of reg.forms) {
    let R = form.R;
    // biasC divides the bias-flagged form's rate: biasC>1 slows it so it dominates,
    // biasC<1 speeds it so it recedes and its competitor wins. Fluorite: bias on
    // {100} → biasC>1 cube, biasC<1 octahedron. Calcite: bias on the rhombohedron
    // {104} → biasC>1 nailhead, biasC<1 dogtooth scalenohedron.
    if (form.bias && biasC) R = R / biasC;
    R *= jitter;
    // central distance advances dᵢ(g) = SEED + SPAN·g·Rᵢ (proposal §1.2): a FAST
    // face (large R) recedes outward and is cut off by its slower neighbours
    // (self-elimination — "slow faces win"); a SLOW face stays close and dominates
    // the habit. So {100} R=1.0 < {111} R=1.7 ⇒ {100} dominates ⇒ cube default.
    // SEED (0.05) is the tiny nucleus; SPAN (1.0) lets the RATE RATIO — not the
    // seed — drive the form, so the full cube↔cuboctahedron↔octahedron range is
    // reachable across the biasC the tenants emit (rung 4a.1 swept the topology to
    // place its ranges: a 0.30 seed pinned everything to cuboctahedron). Absolute
    // scale is normalized away in _makeWulffGeom (±0.5 envelope).
    const d = 0.05 + 1.0 * g * R;
    const normals = reg.system === 'cubic' ? wulffCubicNormals(form.hkl)
      : reg.system === 'trigonalR' ? wulffTrigonalNormals(form.hkl, reg.cell.a, reg.cell.c)
      : reg.system === 'tetragonal' ? wulffTetragonalNormals(form.hkl, reg.cell.a, reg.cell.c)
      : reg.system === 'orthorhombic' ? wulffOrthorhombicNormals(form.hkl, reg.cell.a, reg.cell.b, reg.cell.c)
      : reg.system === 'monoclinic' ? wulffMonoclinicNormals(form.hkl, reg.cell.a, reg.cell.b, reg.cell.c, reg.cell.beta)
      : null;
    if (!normals) return null;          // unknown crystal system — no Wulff path
    for (const n of normals) faces.push({ n, d });
  }
  return faces;
}

// ------------------------------------------------------------
// Core: faces [{n (unit), d}] → convex polyhedron {vertices:[[x,y,z]], faces:[{plane, verts:[idx]}]}.
// Direct triple-plane intersection (design pass D2). Vertices kept only if they
// satisfy every half-space; deduped (a corner where m>3 planes meet is produced
// by C(m,3) coincident triples); grouped onto each face and angle-sorted CCW
// about the face normal for fan-triangulation.
// ------------------------------------------------------------
function wulffPolyhedron(faces: any): any {
  const n = faces.length;
  const raw: any[] = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++) {
        const v = _wulffSolve3(faces[i], faces[j], faces[k]);
        if (!v) continue;
        let inside = true;
        for (let l = 0; l < n; l++) {
          if (_wulffDot(faces[l].n, v) > faces[l].d + 1e-6) { inside = false; break; }
        }
        if (inside) raw.push(v);
      }
  // dedup coincident vertices
  const verts: any[] = [];
  for (const v of raw) {
    let dup = false;
    for (const u of verts) {
      if (Math.abs(u[0] - v[0]) < 1e-6 && Math.abs(u[1] - v[1]) < 1e-6 && Math.abs(u[2] - v[2]) < 1e-6) { dup = true; break; }
    }
    if (!dup) verts.push(v);
  }
  // group surviving vertices onto each face plane; keep faces with ≥3
  const polyFaces: any[] = [];
  for (let i = 0; i < n; i++) {
    const f = faces[i];
    const onface: number[] = [];
    for (let vi = 0; vi < verts.length; vi++) {
      if (Math.abs(_wulffDot(f.n, verts[vi]) - f.d) < 1e-6) onface.push(vi);
    }
    if (onface.length >= 3) polyFaces.push({ plane: i, verts: _wulffAngleSort(onface, verts, f.n) });
  }
  return { vertices: verts, faces: polyFaces };
}

// angle-sort vertex indices CCW around the face normal (for clean fan-triangulation)
function _wulffAngleSort(idxs: number[], verts: any, normal: any): number[] {
  const c = [0, 0, 0];
  for (const vi of idxs) { c[0] += verts[vi][0]; c[1] += verts[vi][1]; c[2] += verts[vi][2]; }
  c[0] /= idxs.length; c[1] /= idxs.length; c[2] /= idxs.length;
  const ref = Math.abs(normal[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = _wulffNorm(_wulffCross(normal, ref));
  const w = _wulffNorm(_wulffCross(normal, u));
  return idxs.slice().sort((p, q) => {
    const dp = [verts[p][0] - c[0], verts[p][1] - c[1], verts[p][2] - c[2]];
    const dq = [verts[q][0] - c[0], verts[q][1] - c[1], verts[q][2] - c[2]];
    return Math.atan2(_wulffDot(dp, w), _wulffDot(dp, u)) - Math.atan2(_wulffDot(dq, w), _wulffDot(dq, u));
  });
}

// ------------------------------------------------------------
// Faces → Three.js BufferGeometry (normalized into a ~unit envelope so it drops
// into the existing mesh.scale.set(aWid, cLen, aWid) path like every other
// primitive). Returns null on a degenerate / empty polyhedron (< 4 vertices or
// no faces) so the renderer falls back to the symmetric primitive (design pass
// D2 robustness clamp). THREE is the ambient global (browser: index.html; tests:
// setup.ts installThreeGlobal).
// ------------------------------------------------------------
function _makeWulffGeom(faces: any): any {
  const poly = wulffPolyhedron(faces);
  if (!poly || poly.vertices.length < 4 || poly.faces.length === 0) return null;
  // normalize to half-extent 0.5 (max |coord| → 0.5), matching the other builders'
  // ±0.5 normalized primitives so downstream scaling behaves identically.
  let maxAbs = 0;
  for (const v of poly.vertices) maxAbs = Math.max(maxAbs, Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]));
  const s = maxAbs > 1e-9 ? 0.5 / maxAbs : 1;
  return _wulffPolyToGeom(poly, s);
}

// Shared emission tail of the Wulff geometry builders: polyhedron + scale →
// BufferGeometry (fan-triangulated, vertex normals). Split out of
// _makeWulffGeom so the O0 half-form builder can emit with the FULL form's
// normalization scale rather than its own.
function _wulffPolyToGeom(poly: any, s: number): any {
  const positions: number[] = [];
  for (const f of poly.faces) {
    const vs = f.verts;
    // fan-triangulate the (convex, angle-sorted) face polygon
    for (let t = 1; t < vs.length - 1; t++) {
      const a = poly.vertices[vs[0]], b = poly.vertices[vs[t]], c = poly.vertices[vs[t + 1]];
      positions.push(a[0] * s, a[1] * s, a[2] * s, b[0] * s, b[1] * s, b[2] * s, c[0] * s, c[1] * s, c[2] * s);
    }
  }
  if (positions.length < 9) return null;
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

// ------------------------------------------------------------
// W-F O0 — attached-crystal truth (ontogeny arc, 2026-07-03). A wall-nucleated
// crystal is euhedral only toward open space; the substrate side is an anhedral
// scar, and the buried fraction of the ideal form NEVER EXISTED (Grigor'ev's
// half-form). Build the polyhedron with ONE MORE half-space — the attachment
// plane, perpendicular to the growth axis (kernel Y), at the attachFrac
// quantile of the full form's Y-extent. The kernel then does everything:
// vertices below the plane are culled and the plane's own polygon emerges as a
// real face — the scar cap — angle-sorted and triangulated like any crystal
// face. This is the exact mechanism O2 (induction surfaces) extends to
// NEIGHBOR half-spaces; O0 is deliberately its one-plane special case so the
// representation is proven before the aggregate layer consumes it.
//
// Steno pin: the crystal faces' normals are untouched — the clip adds a plane,
// never tilts one (asserted in tests-js/cleft-halfform.test.ts).
//
// Normalization uses the FULL form's maxAbs, so the surviving half is
// geometrically identical to the corresponding region of _makeWulffGeom's
// body — the renderer's occlusion sink (offset cLen·(0.5−occF)) then puts the
// scar cap at the anchor, flush with the wall. Returns null when the clip
// degenerates (attachFrac ~1, vanishing form) — callers fall back to the full
// polyhedron, then to the primitive (the D2 robustness ladder).
// ------------------------------------------------------------
function _makeWulffHalfFormGeom(faces: any, attachFrac: number): any {
  if (!faces || !faces.length) return null;
  const full = wulffPolyhedron(faces);
  if (!full || full.vertices.length < 4 || full.faces.length === 0) return null;
  let maxAbs = 0, ymin = Infinity, ymax = -Infinity;
  for (const v of full.vertices) {
    maxAbs = Math.max(maxAbs, Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]));
    if (v[1] < ymin) ymin = v[1];
    if (v[1] > ymax) ymax = v[1];
  }
  if (!(ymax > ymin) || maxAbs <= 1e-9) return null;
  const f = Math.max(0.05, Math.min(0.95, attachFrac || 0.5));
  const yCut = ymin + f * (ymax - ymin);
  // keep y ≥ yCut: with n = [0,−1,0], n·v ≤ d ⇔ −y ≤ d, so d = −yCut.
  const clipped = wulffPolyhedron(faces.concat([{ n: [0, -1, 0], d: -yCut }]));
  if (!clipped || clipped.vertices.length < 4 || clipped.faces.length === 0) return null;
  const s = 0.5 / maxAbs;   // FULL-form scale — see header comment
  return _wulffPolyToGeom(clipped, s);
}
