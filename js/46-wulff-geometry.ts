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
const WULFF_FORM_GEOMETRY: any = {
  // First tenant (rung 4a.1) — the textbook cube↔octahedron mineral. R_111 > R_100
  // means the octahedron faces advance faster (shrink in area), so the default
  // habit is the cube; an REE/Y bias raises R_100:R_111 toward octahedral (the
  // existing octahedral_REE token dispatch, made geometrically true).
  fluorite: { system: 'cubic', forms: [
    { hkl: [1, 0, 0], R: 1.0 },
    { hkl: [1, 1, 1], R: 1.7 },
  ] },
  // Worked cubic sibling (galena cube ± octahedron) — ready, not yet dispatched.
  galena: { system: 'cubic', forms: [
    { hkl: [1, 0, 0], R: 1.0 },
    { hkl: [1, 1, 1], R: 1.5 },
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
  if (!reg || reg.system !== 'cubic') return null;
  const g = Math.max(0.05, Math.min(1.0, growthFrac || 0.5));
  // rng-free per-crystal jitter on the relative-rate spread (±12%, clamped).
  const hsh = (((crystalId || 0) * 0.6180339887498949) % 1 + 1) % 1;
  const jitter = 1.0 + (hsh - 0.5) * 0.24;
  const faces: any[] = [];
  for (const form of reg.forms) {
    let R = form.R;
    // biasC (≥1) slows {100} relative to {111} → cubic; (≤1) → octahedral.
    const isCube = (Math.abs(form.hkl[0]) + Math.abs(form.hkl[1]) + Math.abs(form.hkl[2])) === 1;
    if (isCube && biasC) R = R / biasC;
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
    for (const n of wulffCubicNormals(form.hkl)) faces.push({ n, d });
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
