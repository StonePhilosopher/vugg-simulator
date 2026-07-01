// tests-js/wulff-geometry.test.ts — the central-distance (Wulff) geometry kernel
// (Phase 4 rung 4a.0; js/46-wulff-geometry.ts;
//  proposals/DESIGN-WULFF-PHASE-4-2026-06-28.md, PROPOSAL-DIRECTIONAL-GROWTH §2.3).
//
// The canonical validation fixture (proposal §2.3): cube {100} + octahedron {111}
// at point group m3m. Equal-ish central distances → cuboctahedron; push the
// octahedron planes out → cube; push the cube planes out → octahedron. One
// fixture exercises symmetry expansion ({hkl} → face normals), the triple-plane
// half-space intersection, the interior test + dedup, face grouping, and face
// self-elimination (a grown-out face contributes no vertices). Plus the
// degenerate → null clamp, the BufferGeometry assembly, and the rng-free
// determinism of the registry face-set builder.
//
// This kernel is RENDER-ONLY infra that nothing dispatches yet (rung 4a.1 opts
// the first tenant in), so its existence is byte-identical — no baseline moves.

import { describe, expect, it } from 'vitest';

declare const wulffCubicNormals: any;
declare const wulffTrigonalNormals: any;
declare const wulffTetragonalNormals: any;
declare const wulffOrthorhombicNormals: any;
declare const wulffMonoclinicNormals: any;
declare const wulffPolyhedron: any;
declare const wulffFaceSetForMineral: any;
declare const _makeWulffGeom: any;
declare const WULFF_FORM_GEOMETRY: any;

// cube {100} (6 faces) + octahedron {111} (8 faces) at the given central distances
function cubeOct(cubeD: number, octD: number): any {
  const faces: any[] = [];
  for (const n of wulffCubicNormals([1, 0, 0])) faces.push({ n, d: cubeD });
  for (const n of wulffCubicNormals([1, 1, 1])) faces.push({ n, d: octD });
  return faces;
}

// {vertexCount: faceCount} histogram — e.g. cuboctahedron → {3:8, 4:6}
function faceHistogram(poly: any): any {
  const h: any = {};
  for (const f of poly.faces) h[f.verts.length] = (h[f.verts.length] || 0) + 1;
  return h;
}

describe('Wulff geometry kernel — cubic symmetry expansion', () => {
  it('{100} expands to the 6 cube-face normals', () => {
    expect(wulffCubicNormals([1, 0, 0]).length).toBe(6);
  });
  it('{111} expands to the 8 octahedron-face normals', () => {
    expect(wulffCubicNormals([1, 1, 1]).length).toBe(8);
  });
  it('every expanded normal is unit length', () => {
    for (const n of [...wulffCubicNormals([1, 0, 0]), ...wulffCubicNormals([1, 1, 1])]) {
      expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 9);
    }
  });
});

describe('Wulff geometry kernel — the cube+octahedron fixture', () => {
  it('balanced distances → cuboctahedron (12 vertices, 14 faces = 6 squares + 8 triangles)', () => {
    // oct plane through the cube edge midpoints: d_oct = 2/√3 with d_cube = 1
    const poly = wulffPolyhedron(cubeOct(1, 2 / Math.sqrt(3)));
    expect(poly.vertices.length).toBe(12);
    expect(poly.faces.length).toBe(14);
    expect(faceHistogram(poly)).toEqual({ 3: 8, 4: 6 });
  });

  it('octahedron planes inactive → pure cube (8 vertices, 6 square faces)', () => {
    const poly = wulffPolyhedron(cubeOct(1, 10));
    expect(poly.vertices.length).toBe(8);
    expect(poly.faces.length).toBe(6);
    expect(faceHistogram(poly)).toEqual({ 4: 6 });   // the 8 oct faces self-eliminated
  });

  it('cube planes inactive → pure octahedron (6 vertices, 8 triangular faces)', () => {
    const poly = wulffPolyhedron(cubeOct(10, 1));
    expect(poly.vertices.length).toBe(6);
    expect(poly.faces.length).toBe(8);
    expect(faceHistogram(poly)).toEqual({ 3: 8 });   // the 6 cube faces self-eliminated
  });

  it('degenerate (all distances 0) → fewer than 4 vertices → no solid', () => {
    const poly = wulffPolyhedron(cubeOct(0, 0));
    expect(poly.vertices.length).toBeLessThan(4);
  });
});

describe('Wulff geometry kernel — BufferGeometry assembly', () => {
  it('cuboctahedron → 20 triangles (6 squares×2 + 8 triangles), valid position attribute', () => {
    const geom = _makeWulffGeom(cubeOct(1, 2 / Math.sqrt(3)));
    expect(geom).toBeTruthy();
    const pos = geom.attributes.position;
    expect(pos.count).toBe(60);                       // 20 triangles × 3 vertices
    // normalized into the ±0.5 envelope like the other primitives
    let maxAbs = 0;
    for (let i = 0; i < pos.array.length; i++) maxAbs = Math.max(maxAbs, Math.abs(pos.array[i]));
    expect(maxAbs).toBeCloseTo(0.5, 6);
  });

  it('cube → 12 triangles; octahedron → 8 triangles', () => {
    expect(_makeWulffGeom(cubeOct(1, 10)).attributes.position.count).toBe(36);   // 6×2×3
    expect(_makeWulffGeom(cubeOct(10, 1)).attributes.position.count).toBe(24);   // 8×1×3
  });

  it('degenerate face set → null (renderer falls back to the symmetric primitive)', () => {
    expect(_makeWulffGeom(cubeOct(0, 0))).toBeNull();
  });
});

describe('Wulff geometry kernel — registry face-set builder (the tenant path)', () => {
  it('fluorite (cubic {100}+{111}) yields the 14-plane face set', () => {
    const faces = wulffFaceSetForMineral('fluorite', 0.5, 7, 1.0);
    expect(faces).toBeTruthy();
    expect(faces.length).toBe(14);                    // 6 cube + 8 octahedron planes
    expect(_makeWulffGeom(faces)).toBeTruthy();        // builds a real solid
  });

  it('a cube-favoring bias is more cubic than an octahedron-favoring bias', () => {
    // biasC > 1 slows {100} → cube faces dominate; biasC < 1 speeds {100} so the
    // octahedron dominates. Extreme biases drive each to its pure end-form.
    const cubic = wulffPolyhedron(wulffFaceSetForMineral('fluorite', 0.6, 7, 10));
    const octal = wulffPolyhedron(wulffFaceSetForMineral('fluorite', 0.6, 7, 0.1));
    const cubeFaces = (p: any) => p.faces.filter((f: any) => f.verts.length === 4).length;
    const octFaces = (p: any) => p.faces.filter((f: any) => f.verts.length === 3).length;
    expect(cubeFaces(cubic)).toBeGreaterThan(cubeFaces(octal));   // pure cube (6) > pure oct (0)
    expect(octFaces(octal)).toBeGreaterThan(octFaces(cubic));     // pure oct (8) > pure cube (0)
  });

  it('determinism — identical inputs give byte-identical face sets (rng-free)', () => {
    const a = wulffFaceSetForMineral('fluorite', 0.5, 11, 1.0);
    const b = wulffFaceSetForMineral('fluorite', 0.5, 11, 1.0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('unregistered mineral → null (no Wulff path, symmetric fallback)', () => {
    expect(WULFF_FORM_GEOMETRY.fluorite).toBeTruthy();
    expect(wulffFaceSetForMineral('quartz', 0.5, 1, 1.0)).toBeNull();
  });
});

// The FIRST non-cubic crystal system (rung 4a.2) — calcite, trigonal R-3c / point
// group -3m, hexagonal cell a=4.99 c=17.06. Unlike cubic, {hkl} is NOT the real-space
// direction: the normal is the reciprocal vector g=(h/a,(h+2k)/(a√3),l/c), expanded by
// the -3m orbit (built once via generator closure). Pins the orbit sizes (the
// crystallographic check), the registry 18-plane face set, and the rhombohedron↔
// scalenohedron habit knob. Validated against a standalone prototype before porting.
describe('Wulff geometry kernel — trigonal/hexagonal-R (calcite) symmetry', () => {
  it('{10-14}=(104) rhombohedron → 6 face normals', () => {
    expect(wulffTrigonalNormals([1, 0, 4], 4.99, 17.06).length).toBe(6);
  });
  it('{21-31}=(211) scalenohedron → 12 face normals', () => {
    expect(wulffTrigonalNormals([2, 1, 1], 4.99, 17.06).length).toBe(12);
  });
  it('{10-10}=(100) prism → 6; {0001}=(001) pinacoid → 2', () => {
    expect(wulffTrigonalNormals([1, 0, 0], 4.99, 17.06).length).toBe(6);
    expect(wulffTrigonalNormals([0, 0, 1], 4.99, 17.06).length).toBe(2);
  });
  it('every trigonal normal is unit length', () => {
    for (const n of [...wulffTrigonalNormals([1, 0, 4], 4.99, 17.06), ...wulffTrigonalNormals([2, 1, 1], 4.99, 17.06)]) {
      expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 9);
    }
  });
});

describe('Wulff geometry kernel — calcite via the registry (rung 4a.2)', () => {
  // face set is built [6 rhombohedron planes (idx 0-5), 12 scalenohedron planes (idx 6-17)]
  const rhombFaces = (p: any) => p.faces.filter((f: any) => f.plane < 6).length;
  const scalenoFaces = (p: any) => p.faces.filter((f: any) => f.plane >= 6).length;

  it('calcite yields the 18-plane face set (6 rhombohedron + 12 scalenohedron) + builds a solid', () => {
    const faces = wulffFaceSetForMineral('calcite', 0.5, 7, 1.0);
    expect(faces).toBeTruthy();
    expect(faces.length).toBe(18);
    expect(_makeWulffGeom(faces)).toBeTruthy();
  });

  it('biasC>1 → rhombohedron (nailhead): the scalenohedron self-eliminates', () => {
    const p = wulffPolyhedron(wulffFaceSetForMineral('calcite', 0.6, 7, 2.0));
    expect(rhombFaces(p)).toBe(6);     // all 6 rhombohedron faces dominate
    expect(scalenoFaces(p)).toBe(0);   // the 12 scalenohedron faces grew out
  });

  it('biasC<1 brings the scalenohedron in (dogtooth modified by rhombohedron caps)', () => {
    const lo = wulffPolyhedron(wulffFaceSetForMineral('calcite', 0.6, 7, 0.5));
    const hi = wulffPolyhedron(wulffFaceSetForMineral('calcite', 0.6, 7, 2.0));
    expect(scalenoFaces(lo)).toBeGreaterThan(scalenoFaces(hi));   // 12 > 0
    expect(rhombFaces(lo)).toBeGreaterThan(0);                    // rhomb caps persist (a real composite habit)
  });

  it('determinism — identical calcite inputs give byte-identical face sets (rng-free)', () => {
    const a = wulffFaceSetForMineral('calcite', 0.5, 11, 0.6);
    const b = wulffFaceSetForMineral('calcite', 0.5, 11, 0.6);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// The THIRD crystal system (rung 4a.3) — wulfenite, tetragonal I4₁/a (scheelite-type) / Laue class
// 4/m, cell a=5.4347 c=12.110. Like calcite the normal is the reciprocal vector g=(h/a, l/c, k/a)
// with the 4-fold c-axis on Y, expanded by the 4/m orbit (order 8, built once via generator
// closure). {101}→8 confirms the full order-8 group; the basal pinacoid points along ±Y so a
// tabular plate lies flat. Validated against a standalone prototype (wulff-tetragonal-proto.mjs).
describe('Wulff geometry kernel — tetragonal 4/m (wulfenite) symmetry', () => {
  it('c{001} basal pinacoid → 2 face normals', () => {
    expect(wulffTetragonalNormals([0, 0, 1], 5.4347, 12.110).length).toBe(2);
  });
  it('{101} tetragonal bipyramid → 8 face normals (the full 4/m orbit ⇒ group order 8)', () => {
    expect(wulffTetragonalNormals([1, 0, 1], 5.4347, 12.110).length).toBe(8);
  });
  it('{100} prism → 4; {110} prism → 4', () => {
    expect(wulffTetragonalNormals([1, 0, 0], 5.4347, 12.110).length).toBe(4);
    expect(wulffTetragonalNormals([1, 1, 0], 5.4347, 12.110).length).toBe(4);
  });
  it('every tetragonal normal is unit length', () => {
    for (const n of [...wulffTetragonalNormals([0, 0, 1], 5.4347, 12.110), ...wulffTetragonalNormals([1, 0, 1], 5.4347, 12.110)]) {
      expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 9);
    }
  });
  it('c on Y — the basal pinacoid normals point along ±Y, so a tabular plate lies flat', () => {
    for (const n of wulffTetragonalNormals([0, 0, 1], 5.4347, 12.110)) {
      expect(Math.abs(n[1])).toBeCloseTo(1, 9);
    }
  });
});

describe('Wulff geometry kernel — wulfenite via the registry (rung 4a.3)', () => {
  // face set is built [2 basal-pinacoid planes (idx 0-1), 8 bipyramid planes (idx 2-9)]
  const pinacoidFaces = (p: any) => p.faces.filter((f: any) => f.plane < 2).length;
  const bipyramidFaces = (p: any) => p.faces.filter((f: any) => f.plane >= 2).length;
  const extent = (p: any, ax: number) => {
    let mn = Infinity, mx = -Infinity;
    for (const v of p.vertices) { mn = Math.min(mn, v[ax]); mx = Math.max(mx, v[ax]); }
    return mx - mn;
  };

  it('wulfenite yields the 10-plane face set (2 basal pinacoid + 8 bipyramid) + builds a solid', () => {
    const faces = wulffFaceSetForMineral('wulfenite', 0.5, 7, 1.86);
    expect(faces).toBeTruthy();
    expect(faces.length).toBe(10);
    expect(_makeWulffGeom(faces)).toBeTruthy();
  });

  it('the live supergene values (rung 4a.7: biasC B(1.25)=1.0, g 1.0) → a truncated-bipyramid TABLET: 2 pinacoid + 8 bipyramid, wider than thick', () => {
    const p = wulffPolyhedron(wulffFaceSetForMineral('wulfenite', 1.0, 0, 1.0));
    expect(pinacoidFaces(p)).toBe(2);                    // the flat plate faces, top + bottom
    expect(bipyramidFaces(p)).toBe(8);                   // the bevelled square edge
    expect(extent(p, 0)).toBeGreaterThan(extent(p, 1));  // diameter (X) > thickness (Y) — a plate, not a column
  });

  it('rung 4a.7 visible-change pin — the earned Tsumeb body is decisively STOUTER than the retired hash render (biasC 1.86 @ frozen g 0.21)', () => {
    const aspect = (g: number, b: number) => {
      const p = wulffPolyhedron(wulffFaceSetForMineral('wulfenite', g, 0, b));
      return extent(p, 0) / extent(p, 1);
    };
    // ≈2.6 (earned, thick Tsumeb tablet w/ prominent {101} bevel) vs ≈3.7 (old hash @ frozen g):
    // the render upgrade is not a silent no-op.
    expect(aspect(1.0, 1.0)).toBeLessThan(aspect(0.21, 1.86) * 0.85);
  });

  it('higher biasC → thinner plate (the tabular thinness knob; bias on {001})', () => {
    const thin = extent(wulffPolyhedron(wulffFaceSetForMineral('wulfenite', 0.5, 7, 2.8)), 1);
    const thick = extent(wulffPolyhedron(wulffFaceSetForMineral('wulfenite', 0.5, 7, 1.4)), 1);
    expect(thin).toBeLessThan(thick);                    // slowing {001} (higher biasC) flattens the plate
  });

  it('determinism — identical wulfenite inputs give byte-identical face sets (rng-free)', () => {
    const a = wulffFaceSetForMineral('wulfenite', 0.5, 11, 1.86);
    const b = wulffFaceSetForMineral('wulfenite', 0.5, 11, 1.86);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// The FOURTH crystal system (rung 4a.4) — barite, orthorhombic Pnma (barite-group BaSO4) / point
// group mmm, cell a=8.879 b=5.450 c=7.152. The normal is the reciprocal vector g=(h/a, l/c, k/b)
// with c on Y, expanded by the mmm orbit (order 8, sign-flips only — NO permutations, the three
// axes are inequivalent). {111}→8 confirms the order-8 group. The first cell with THREE UNEQUAL axes,
// so the {001} tabular plate is RECTANGULAR (X≈a > Z≈b ≈ 1.25:1), not square like wulfenite's.
// Validated against a standalone prototype (wulff-orthorhombic-proto.mjs).
describe('Wulff geometry kernel — orthorhombic mmm (barite) symmetry', () => {
  it('c{001} basal pinacoid → 2 face normals', () => {
    expect(wulffOrthorhombicNormals([0, 0, 1], 8.879, 5.450, 7.152).length).toBe(2);
  });
  it('{111} bipyramid → 8 face normals (the full mmm orbit ⇒ group order 8)', () => {
    expect(wulffOrthorhombicNormals([1, 1, 1], 8.879, 5.450, 7.152).length).toBe(8);
  });
  it('o{011} dome → 4; m{210} prism → 4 (a zero index collapses the orbit to 4)', () => {
    expect(wulffOrthorhombicNormals([0, 1, 1], 8.879, 5.450, 7.152).length).toBe(4);
    expect(wulffOrthorhombicNormals([2, 1, 0], 8.879, 5.450, 7.152).length).toBe(4);
  });
  it('the three pinacoids a{100}, b{010}, c{001} each → 2 (the unequal axes are independent)', () => {
    expect(wulffOrthorhombicNormals([1, 0, 0], 8.879, 5.450, 7.152).length).toBe(2);
    expect(wulffOrthorhombicNormals([0, 1, 0], 8.879, 5.450, 7.152).length).toBe(2);
    expect(wulffOrthorhombicNormals([0, 0, 1], 8.879, 5.450, 7.152).length).toBe(2);
  });
  it('every orthorhombic normal is unit length', () => {
    for (const n of [...wulffOrthorhombicNormals([0, 1, 1], 8.879, 5.450, 7.152), ...wulffOrthorhombicNormals([1, 1, 1], 8.879, 5.450, 7.152)]) {
      expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 9);
    }
  });
  it('c on Y — the basal pinacoid normals point along ±Y, so the tabular plate lies flat', () => {
    for (const n of wulffOrthorhombicNormals([0, 0, 1], 8.879, 5.450, 7.152)) {
      expect(Math.abs(n[1])).toBeCloseTo(1, 9);
    }
  });
});

describe('Wulff geometry kernel — barite via the registry (rung 4a.4)', () => {
  // face set is built [2 basal-pinacoid planes (idx 0-1), 4 dome planes (idx 2-5), 4 prism planes (idx 6-9)]
  const pinacoidFaces = (p: any) => p.faces.filter((f: any) => f.plane < 2).length;
  const extent = (p: any, ax: number) => {
    let mn = Infinity, mx = -Infinity;
    for (const v of p.vertices) { mn = Math.min(mn, v[ax]); mx = Math.max(mx, v[ax]); }
    return mx - mn;
  };

  it('barite yields the 10-plane face set (2 pinacoid + 4 dome + 4 prism) + builds a solid', () => {
    const faces = wulffFaceSetForMineral('barite', 0.5, 7, 2.5);
    expect(faces).toBeTruthy();
    expect(faces.length).toBe(10);                       // 2 c{001} + 4 o{011} + 4 m{210}
    expect(_makeWulffGeom(faces)).toBeTruthy();
  });

  it('a representative wittichen-bladed value (biasC 2.5 — mid of the live 2.24–2.82 band — at g 0.15) → a RECTANGULAR tabular plate: 2 pinacoid, wider than thick, elongated along b (the {210}>{011} face-rate correction, 2026-07-01)', () => {
    const p = wulffPolyhedron(wulffFaceSetForMineral('barite', 0.15, 0, 2.5));
    expect(pinacoidFaces(p)).toBe(2);                    // the flat plate faces, top + bottom
    expect(p.faces.length).toBe(10);                     // the full pinacoid+dome+prism rim survives (o{011} does NOT self-eliminate)
    expect(extent(p, 0)).toBeGreaterThan(extent(p, 1));  // diameter (X) > thickness (Y) — a plate, not a column
    // THE orthorhombic signature: a≠b → the in-plane outline is RECTANGULAR, not square (wulfenite's is
    // square, X≈Z). Since the {210}>{011} correction the prominent m{210} prism makes the plate longer
    // along b (Z≈b) than a (X≈a) — the a-vs-b direction is locality-dependent + was never ground-truth-
    // verified; only the rectangular-ness (Z≠X) is invariant. Jitter scales X and Z ~equally.
    expect(extent(p, 2)).toBeGreaterThan(extent(p, 0) * 1.1);
  });

  it('higher biasC → thinner plate (the tabular thinness knob; bias on {001})', () => {
    const thin = extent(wulffPolyhedron(wulffFaceSetForMineral('barite', 0.5, 7, 3.0)), 1);
    const thick = extent(wulffPolyhedron(wulffFaceSetForMineral('barite', 0.5, 7, 1.3)), 1);
    expect(thin).toBeLessThan(thick);                    // slowing {001} (higher biasC) flattens the plate
  });

  it('determinism — identical barite inputs give byte-identical face sets (rng-free)', () => {
    const a = wulffFaceSetForMineral('barite', 0.5, 11, 2.5);
    const b = wulffFaceSetForMineral('barite', 0.5, 11, 2.5);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// rung 4a.5 — galena, the SECOND cubic tenant (after fluorite). No new kernel: it reuses
// wulffCubicNormals + the registry's {100}+{111}. grow_galena hardcodes habit='cubic', so the
// classifier renders a cube-DOMINANT body with VISIBLE {111} corner truncations — the band [1.0,1.15]
// is chosen to KEEP those truncations alive; a perfect cube (biasC ≳ 1.25) would be pixel-identical to
// the old cube primitive (the render-upgrade-visible no-op). These pins guard exactly that property.
describe('Wulff geometry kernel — galena via the registry (rung 4a.5, cubic)', () => {
  it('galena yields the 14-plane cube+octahedron face set (like fluorite) + builds a solid', () => {
    const faces = wulffFaceSetForMineral('galena', 0.5, 7, 1.1);
    expect(faces).toBeTruthy();
    expect(faces.length).toBe(14);                       // 6 {100} + 8 {111}
    expect(_makeWulffGeom(faces)).toBeTruthy();
  });

  it('the cube band (biasC 1.1) is a TRUNCATED cube — all 8 {111} corner triangles survive, the 6 {100} faces become octagons', () => {
    // crystalId 0 = the renderer's actual call (its internal jitter is then a fixed 0.88)
    const p = wulffPolyhedron(wulffFaceSetForMineral('galena', 0.5, 0, 1.1));
    const tri = p.faces.filter((f: any) => f.verts.length === 3).length;   // {111} truncation triangles
    const oct = p.faces.filter((f: any) => f.verts.length > 4).length;     // {100} faces, now octagonal
    expect(tri).toBe(8);     // every corner truncated → the visible upgrade over a perfect cube
    expect(oct).toBe(6);
  });

  it('biasC ≳ 1.25 self-eliminates {111} → a PERFECT cube (the no-op galena must avoid — render-upgrade-visible)', () => {
    const p = wulffPolyhedron(wulffFaceSetForMineral('galena', 0.5, 0, 2.0));
    expect(p.faces.length).toBe(6);                              // pure cube
    expect(p.faces.every((f: any) => f.verts.length === 4)).toBe(true);   // 6 squares, no {111} truncation
  });

  it('determinism — identical galena inputs give byte-identical face sets (rng-free)', () => {
    const a = wulffFaceSetForMineral('galena', 0.5, 11, 1.1);
    const b = wulffFaceSetForMineral('galena', 0.5, 11, 1.1);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// The FIFTH crystal system (rung 4a.6) — titanite (sphene CaTiSiO₅), monoclinic 2/m (P2₁/a) / point
// group C2h, cell a=7.057 b=8.707 c=6.555 β=113.81°. The FIRST OBLIQUE cell: the normal is the
// reciprocal vector g=(h/a, k/b, (l/c−h·cosβ/a)/sinβ) — the h↔l cross-term is the metric-tensor
// signature no orthogonal cell needs. b (the unique 2-fold) on Y. The order-4 group (closure of
// {C2(b), inversion}) gives the pinacoids→2 and the prism/dome/general→4. The capability the four
// orthogonal systems CANNOT show: {100}∧{001} = 180−β = 66.19° ≠ 90°. Validated against the standalone
// prototype (wulff-monoclinic-proto.mjs).
describe('Wulff geometry kernel — monoclinic 2/m (titanite) symmetry', () => {
  const mono = (hkl: number[]) => wulffMonoclinicNormals(hkl, 7.057, 8.707, 6.555, 113.81);
  const ang = (u: number[], v: number[]) => Math.acos(Math.min(1, Math.abs(u[0] * v[0] + u[1] * v[1] + u[2] * v[2]))) * 180 / Math.PI;

  it('the three pinacoids a{100}, b{010}, c{001} each → 2 face normals (order-4 group, special positions)', () => {
    expect(mono([1, 0, 0]).length).toBe(2);
    expect(mono([0, 1, 0]).length).toBe(2);
    expect(mono([0, 0, 1]).length).toBe(2);
  });
  it('m{110} prism, u{011} clinodome, and the general {-111} pyramid each → 4 (the full 2/m orbit ⇒ order 4)', () => {
    expect(mono([1, 1, 0]).length).toBe(4);
    expect(mono([0, 1, 1]).length).toBe(4);
    expect(mono([-1, 1, 1]).length).toBe(4);
  });
  it('THE oblique signature: a{100} ∧ c{001} = 180−β = 66.19°, NOT 90° (the first non-perpendicular face pair)', () => {
    expect(ang(mono([1, 0, 0])[0], mono([0, 0, 1])[0])).toBeCloseTo(66.19, 1);
  });
  it('b{010} (the unique 2-fold) on Y — its normals point along ±Y, so the body stands on b', () => {
    for (const n of mono([0, 1, 0])) expect(Math.abs(n[1])).toBeCloseTo(1, 9);
  });
  it('every monoclinic normal is unit length', () => {
    for (const n of [...mono([1, 1, 0]), ...mono([-1, 1, 1]), ...mono([0, 0, 1])]) {
      expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 9);
    }
  });
});

describe('Wulff geometry kernel — titanite via the registry (rung 4a.6, monoclinic)', () => {
  const extent = (p: any, ax: number) => {
    let mn = Infinity, mx = -Infinity;
    for (const v of p.vertices) { mn = Math.min(mn, v[ax]); mx = Math.max(mx, v[ax]); }
    return mx - mn;
  };

  it('titanite yields the 16-plane face set (2 a{100} + 2 c{001} + 4 m{110} + 4 u{011} + 4 {-111}) + builds a solid', () => {
    const faces = wulffFaceSetForMineral('titanite', 0.5, 7, 1.8);
    expect(faces).toBeTruthy();
    expect(faces.length).toBe(16);
    expect(_makeWulffGeom(faces)).toBeTruthy();
  });

  it('at the live runtime params (g 0.15 frozen, biasC ≈ 2.0) → a 16-face oblique WEDGE: no degeneration (no hex-prism fallback), b (Y) the long axis', () => {
    // g 0.15 is the frozen growthFrac the classifier tags at ~30µm; the renderer calls with crystalId 0
    // (jitter a fixed 0.88). This is the EXACT body grimsel renders — it must be a real wedge, not null.
    const p = wulffPolyhedron(wulffFaceSetForMineral('titanite', 0.15, 0, 2.0));
    expect(p.faces.length).toBe(16);                      // all forms survive → the full sphenoid, not a fallback
    expect(extent(p, 1)).toBeGreaterThan(extent(p, 0));   // b (Y) longer than a (X) — the elongate sphenoid
    expect(extent(p, 1)).toBeGreaterThan(extent(p, 2));   // b (Y) longer than c-ish (Z)
  });

  it('higher biasC → flatter wedge on a{100} (the flattening knob; bias on {100})', () => {
    const flat = extent(wulffPolyhedron(wulffFaceSetForMineral('titanite', 0.5, 7, 2.3)), 0);
    const chunky = extent(wulffPolyhedron(wulffFaceSetForMineral('titanite', 0.5, 7, 1.3)), 0);
    expect(flat).toBeLessThan(chunky);                    // slowing {100} (higher biasC) thins the X (a) extent
  });

  it('determinism — identical titanite inputs give byte-identical face sets (rng-free)', () => {
    const a = wulffFaceSetForMineral('titanite', 0.5, 11, 1.8);
    const b = wulffFaceSetForMineral('titanite', 0.5, 11, 1.8);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
