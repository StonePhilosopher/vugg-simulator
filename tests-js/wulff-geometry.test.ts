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
