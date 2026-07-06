// tests-js/o2-contact.test.ts — W-F O2 induction surfaces (ontogeny arc,
// 2026-07-05). The aggregate layer O0 promised: neighbor meeting planes enter
// the Wulff kernel as extra half-spaces, the clipped facets land in a matte
// CONTACT material group, and Steno holds (a clip is a plane, never a tilt).
//
// Science anchors: Self & Hill 2003 (contact faces / competitive growth),
// Diggle (planar boundary at constant rate ratio → the current-size meeting
// plane is first-order exact). See PROPOSAL-ONTOGENY-2026-07-03.md §3 (O2) + §6
// (review response #2: ship the current-size plane, instrument the drift).

import { describe, expect, it } from 'vitest';

declare const wulffFaceSetForMineral: any;
declare const wulffPolyhedron: any;
declare const _makeWulffGeom: any;
declare const _makeWulffHalfFormGeom: any;
declare const _makeWulffContactGeom: any;
declare const _clipConvexGeom: any;
declare const THREE: any;

const TENANTS: Array<[string, number, number]> = [
  ['fluorite', 0.6, 1.3],
  ['calcite', 0.7, 0.8],
  ['galena', 0.6, 1.0],
];

function extent(geom: any, axis: number): [number, number] {
  const pos = geom.attributes.position.array;
  let lo = Infinity, hi = -Infinity;
  for (let i = axis; i < pos.length; i += 3) { if (pos[i] < lo) lo = pos[i]; if (pos[i] > hi) hi = pos[i]; }
  return [lo, hi];
}

// A plane that cuts the +x tip off, in native face units. n·v ≤ d keeps the
// body's own (−x) side; d at 40% of the native +x reach so it always bites.
function cutPlaneX(faces: any, frac = 0.4): { n: number[]; d: number } {
  const poly = wulffPolyhedron(faces);
  let xmax = 0;
  for (const v of poly.vertices) if (v[0] > xmax) xmax = v[0];
  return { n: [1, 0, 0], d: xmax * frac };
}

describe('W-F O2 — contact clip (neighbor meeting planes as half-spaces)', () => {
  it('a neighbor plane clips the body and births a contact facet', () => {
    for (const [mineral, g, biasC] of TENANTS) {
      const faces = wulffFaceSetForMineral(mineral, g, 0, biasC);
      const plane = cutPlaneX(faces, 0.4);
      const res = _makeWulffContactGeom(faces, [plane], 0);
      expect(res, `${mineral} contact geom degenerate`).toBeTruthy();
      expect(res.contactTris, `${mineral} no contact facet`).toBeGreaterThanOrEqual(1);
      // the +x tip is gone: clipped max-x sits at the cut, below the full body's
      const full = _makeWulffGeom(faces);
      const [, fullHiX] = extent(full, 0);
      const [, clipHiX] = extent(res.geom, 0);
      expect(clipHiX, `${mineral} body not clipped`).toBeLessThan(fullHiX - 1e-3);
    }
  });

  it('the geometry carries two material groups (euhedral 0, contact 1)', () => {
    const faces = wulffFaceSetForMineral('fluorite', 0.6, 0, 1.3);
    const res = _makeWulffContactGeom(faces, [cutPlaneX(faces, 0.4)], 0);
    const groups = res.geom.groups;
    expect(groups.length, 'expected euhedral + contact groups').toBe(2);
    const mats = groups.map((gp: any) => gp.materialIndex).sort();
    expect(mats).toEqual([0, 1]);
    // groups are contiguous and cover every emitted vertex exactly once
    const total = res.geom.attributes.position.count;
    const covered = groups.reduce((a: number, gp: any) => a + gp.count, 0);
    expect(covered).toBe(total);
    const g0 = groups.find((gp: any) => gp.materialIndex === 0);
    const g1 = groups.find((gp: any) => gp.materialIndex === 1);
    expect(g0.start).toBe(0);
    expect(g1.start).toBe(g0.count);   // contact run follows the euhedral run
  });

  it('STENO PIN: the clip adds a plane — it never tilts a crystal-face normal', () => {
    for (const [mineral, g, biasC] of TENANTS) {
      const faces = wulffFaceSetForMineral(mineral, g, 0, biasC);
      const before = JSON.stringify(faces.map((f: any) => f.n));
      _makeWulffContactGeom(faces, [cutPlaneX(faces, 0.4)], 0.5);
      expect(JSON.stringify(faces.map((f: any) => f.n)), `${mineral} input mutated`).toBe(before);
    }
  });

  it('a non-cutting plane leaves the full body and NO contact facet', () => {
    const faces = wulffFaceSetForMineral('fluorite', 0.6, 0, 1.3);
    const far = cutPlaneX(faces, 5);   // d well beyond the +x reach → never bites
    const res = _makeWulffContactGeom(faces, [far], 0);
    expect(res, 'non-cutting plane should still emit the full body').toBeTruthy();
    expect(res.contactTris, 'a plane that misses the body must add no facet').toBe(0);
    const full = _makeWulffGeom(faces);
    expect(extent(res.geom, 0)[1]).toBeCloseTo(extent(full, 0)[1], 4);
  });

  it('occF>0 folds the O0 wall scar into the same contact clip', () => {
    // With no neighbours, a half-form request must still clip the wall and land
    // the scar in the contact group — matching O0 minY, now matte.
    const faces = wulffFaceSetForMineral('fluorite', 0.6, 0, 1.3);
    const res = _makeWulffContactGeom(faces, [], 0.5);
    expect(res, 'wall-only contact geom degenerate').toBeTruthy();
    expect(res.contactTris, 'no scar cap in the contact group').toBeGreaterThanOrEqual(1);
    const o0 = _makeWulffHalfFormGeom(faces, 0.5);
    expect(extent(res.geom, 1)[0]).toBeCloseTo(extent(o0, 1)[0], 4);   // same cut height as O0
  });

  it('two neighbours both leave contact facets; euhedral faces survive too', () => {
    const faces = wulffFaceSetForMineral('galena', 0.6, 0, 1.0);
    const poly = wulffPolyhedron(faces);
    let xmax = 0, zmax = 0;
    for (const v of poly.vertices) { if (v[0] > xmax) xmax = v[0]; if (v[2] > zmax) zmax = v[2]; }
    const res = _makeWulffContactGeom(faces, [
      { n: [1, 0, 0], d: xmax * 0.5 },
      { n: [0, 0, 1], d: zmax * 0.5 },
    ], 0);
    expect(res.contactTris).toBeGreaterThanOrEqual(2);   // at least one tri per cut
    const g0 = res.geom.groups.find((gp: any) => gp.materialIndex === 0);
    expect(g0.count, 'euhedral faces vanished').toBeGreaterThan(0);
  });

  it('WORLD→NATIVE inversion: an xformed world plane matches the native clip', () => {
    // With identity R, unit scale, zero translation, native→world is v↦s·v, so
    // a world plane at d = s·d_native must produce the SAME clip as feeding the
    // native plane directly (the tested path).
    const faces = wulffFaceSetForMineral('fluorite', 0.6, 0, 1.3);
    const poly = wulffPolyhedron(faces);
    let maxAbs = 0, xmax = 0;
    for (const v of poly.vertices) {
      maxAbs = Math.max(maxAbs, Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]));
      if (v[0] > xmax) xmax = v[0];
    }
    const s = 0.5 / maxAbs;
    const dNative = xmax * 0.4;
    const native = _makeWulffContactGeom(faces, [{ n: [1, 0, 0], d: dNative }], 0);
    const idXform = { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], sx: 1, sy: 1, sz: 1, tx: 0, ty: 0, tz: 0 };
    const world = _makeWulffContactGeom(faces, [{ n: [1, 0, 0], d: s * dNative }], 0, false, idXform);
    expect(native.contactTris).toBe(world.contactTris);
    expect(extent(world.geom, 0)[1]).toBeCloseTo(extent(native.geom, 0)[1], 5);
  });

  it('WORLD→NATIVE inversion: a 90° z-rotation maps world +y onto the local +x clip', () => {
    // R sends local +x → world +y; a world plane with normal +y must therefore
    // clip the SAME local +x face the native [1,0,0] plane does.
    const faces = wulffFaceSetForMineral('galena', 0.6, 0, 1.0);
    const poly = wulffPolyhedron(faces);
    let maxAbs = 0, xmax = 0;
    for (const v of poly.vertices) {
      maxAbs = Math.max(maxAbs, Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]));
      if (v[0] > xmax) xmax = v[0];
    }
    const s = 0.5 / maxAbs;
    const dNative = xmax * 0.4;
    const native = _makeWulffContactGeom(faces, [{ n: [1, 0, 0], d: dNative }], 0);
    const Rz90 = { R: [0, -1, 0, 1, 0, 0, 0, 0, 1], sx: 1, sy: 1, sz: 1, tx: 0, ty: 0, tz: 0 };
    const world = _makeWulffContactGeom(faces, [{ n: [0, 1, 0], d: s * dNative }], 0, false, Rz90);
    expect(world, 'rotation path degenerate').toBeTruthy();
    expect(world.contactTris).toBe(native.contactTris);   // same face clipped, same facet
  });

  it('clamps instead of throwing on degenerate input', () => {
    const faces = wulffFaceSetForMineral('fluorite', 0.6, 0, 1.3);
    expect(() => _makeWulffContactGeom(null, [], 0)).not.toThrow();
    expect(_makeWulffContactGeom(null as any, [], 0)).toBeNull();
    expect(_makeWulffContactGeom(faces, [], 0), 'no clips at all → null (caller uses full form)').toBeNull();
    expect(() => _makeWulffContactGeom(faces, null, 0)).not.toThrow();
  });
});

// ============================================================
// The GENERIC convex-mesh clipper — the fleet-wide path (primitives + Wulff).
// ============================================================

function boxTris(geom: any): number {
  const g = geom.index ? geom.toNonIndexed() : geom;
  return g.attributes.position.count / 3;
}

describe('W-F O2 — generic convex-mesh clipper (_clipConvexGeom)', () => {
  it('halves a unit cube and caps the cut (indexed BoxGeometry deindexed)', () => {
    const box = new THREE.BoxGeometry(1, 1, 1);   // ±0.5, INDEXED
    const res = _clipConvexGeom(box, [{ n: [1, 0, 0], d: 0 }]);   // keep x ≤ 0
    expect(res, 'clip produced nothing').toBeTruthy();
    expect(res.contactTris, 'no cap facet').toBeGreaterThanOrEqual(1);
    const [lo, hi] = extent(res.geom, 0);
    expect(hi).toBeCloseTo(0, 5);      // the +x half is gone
    expect(lo).toBeCloseTo(-0.5, 5);   // the −x wall survives
  });

  it('the cap lies in the cut plane and faces outward (+n)', () => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const res = _clipConvexGeom(box, [{ n: [1, 0, 0], d: 0 }]);
    // the contact group is the trailing run
    const g1 = res.geom.groups.find((gp: any) => gp.materialIndex === 1);
    expect(g1, 'no contact group').toBeTruthy();
    const pos = res.geom.attributes.position.array;
    // every contact-group vertex sits on x = 0
    for (let v = g1.start; v < g1.start + g1.count; v++) {
      expect(Math.abs(pos[v * 3]), 'cap vertex off the cut plane').toBeLessThan(1e-4);
    }
    // every cap triangle faces +x (outward from the kept −x body): aggregate
    // and per-tri x-normal must be positive, none inward.
    let sumNx = 0, minNx = Infinity;
    for (let v = g1.start; v < g1.start + g1.count; v += 3) {
      const o = v * 3;
      const uy = pos[o + 4] - pos[o + 1], uz = pos[o + 5] - pos[o + 2];
      const wy = pos[o + 7] - pos[o + 1], wz = pos[o + 8] - pos[o + 2];
      const nx = uy * wz - uz * wy;   // (u × w).x
      sumNx += nx; if (nx < minNx) minNx = nx;
    }
    expect(sumNx, 'cap faces inward').toBeGreaterThan(0);
    expect(minNx, 'a cap triangle winds inward').toBeGreaterThanOrEqual(-1e-9);
  });

  it('two planes leave two caps; a corner is bevelled', () => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const res = _clipConvexGeom(box, [{ n: [1, 0, 0], d: 0.2 }, { n: [0, 1, 0], d: 0.2 }]);
    expect(res.contactTris).toBeGreaterThanOrEqual(2);
    expect(extent(res.geom, 0)[1]).toBeCloseTo(0.2, 4);
    expect(extent(res.geom, 1)[1]).toBeCloseTo(0.2, 4);
  });

  it('a non-cutting plane returns null (caller keeps the full form)', () => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    expect(_clipConvexGeom(box, [{ n: [1, 0, 0], d: 5 }]), 'a miss must not rebuild the mesh').toBeNull();
  });

  it('clipping the body entirely away returns null', () => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    expect(_clipConvexGeom(box, [{ n: [1, 0, 0], d: -5 }])).toBeNull();
  });

  it('preserves an input contact group through a further clip (Wulff half-form → still matte)', () => {
    // A Wulff contact geom already carries a group-1 scar; re-clipping it must
    // keep those triangles matte AND add the new cut as matte too.
    const faces = wulffFaceSetForMineral('galena', 0.6, 0, 1.0);
    const wc = _makeWulffContactGeom(faces, [], 0.5);   // half-form, group-1 scar
    const before = wc.contactTris;
    const poly = wulffPolyhedron(faces);
    let xmax = 0; for (const v of poly.vertices) if (v[0] > xmax) xmax = v[0];
    // clip in the SAME (native/emit) frame the half-form was emitted in: its
    // extent is ≤0.5 after normalization, so cut at a fraction of that.
    const [, hiX] = extent(wc.geom, 0);
    const res = _clipConvexGeom(wc.geom, [{ n: [1, 0, 0], d: hiX * 0.4 }]);
    expect(res, 'half-form re-clip degenerate').toBeTruthy();
    expect(res.contactTris, 'scar tags were lost or no new cap added').toBeGreaterThan(before);
  });

  it('is null-safe on junk input', () => {
    expect(_clipConvexGeom(null, [{ n: [1, 0, 0], d: 0 }])).toBeNull();
    expect(_clipConvexGeom(new THREE.BoxGeometry(1, 1, 1), [])).toBeNull();
    expect(_clipConvexGeom(new THREE.BoxGeometry(1, 1, 1), null)).toBeNull();
  });
});
