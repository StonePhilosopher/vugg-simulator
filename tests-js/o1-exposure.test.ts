// tests-js/o1-exposure.test.ts — W-F O1a: unequal development, exposure tranche
// (2026-07-04, render-only — the first per-face h_i asymmetry).
//
// What O1a promises (PROPOSAL-ONTOGENY §3 rung O1 + §6 review point #1):
//   * wulffFaceSetForMineral gains an optional exposureK: each face's GROWTH
//     term (never the SEED) is multiplied by f_geo = max(0.15, 1 + k·n_y) —
//     the modifier on the RATE inside the accumulation, the accepted review
//     interface. n_y = n·û, û = local +Y = toward the cavity.
//   * k = 0 / absent is BITWISE-identical to the legacy 4-arg call.
//   * STENO PIN: normals never move — only central distances.
//   * The O0 half-form's default cut is the NUCLEUS PLANE (y = 0), which the
//     exposure stretch separates from the extent midpoint.
//
// The closed-form relation (d_i(k) − SEED) / (d_i(0) − SEED) = f_geo(n_y_i)
// lets these pins verify the modifier exactly, per face, without knowing any
// form's R.

import { describe, expect, it } from 'vitest';

declare const wulffFaceSetForMineral: any;
declare const wulffPolyhedron: any;
declare const _makeWulffGeom: any;
declare const _makeWulffHalfFormGeom: any;

const SEED = 0.05;
const TENANTS: Array<[string, number, number]> = [
  ['fluorite', 0.6, 1.3],
  ['calcite', 0.7, 0.8],
  ['wulfenite', 0.5, 1.0],
  ['barite', 0.5, 1.0],
  ['galena', 0.6, 1.0],
  ['titanite', 0.5, 1.0],
];

function geomYRange(geom: any): [number, number] {
  const pos = geom.attributes.position.array;
  let lo = Infinity, hi = -Infinity;
  for (let i = 1; i < pos.length; i += 3) {
    if (pos[i] < lo) lo = pos[i];
    if (pos[i] > hi) hi = pos[i];
  }
  return [lo, hi];
}

describe('W-F O1a — per-face exposure modifier', () => {
  it('k absent / 0 is bitwise-identical to the legacy call (byte-safety)', () => {
    for (const [m, g, b] of TENANTS) {
      const legacy = wulffFaceSetForMineral(m, g, 0, b);
      const zeroK = wulffFaceSetForMineral(m, g, 0, b, 0);
      expect(JSON.stringify(zeroK), `${m} k=0 drifted`).toBe(JSON.stringify(legacy));
    }
  });

  it('STENO PIN: exposure moves distances, never normals', () => {
    for (const [m, g, b] of TENANTS) {
      const flat = wulffFaceSetForMineral(m, g, 0, b);
      const exp = wulffFaceSetForMineral(m, g, 0, b, 0.18);
      expect(exp.length).toBe(flat.length);
      for (let i = 0; i < flat.length; i++) {
        expect(JSON.stringify(exp[i].n), `${m} face ${i} normal moved`).toBe(JSON.stringify(flat[i].n));
      }
    }
  });

  it('the modifier is exactly f_geo = max(0.15, 1 + k·n_y) on the growth term', () => {
    const K = 0.18;
    for (const [m, g, b] of TENANTS) {
      const flat = wulffFaceSetForMineral(m, g, 0, b);
      const exp = wulffFaceSetForMineral(m, g, 0, b, K);
      for (let i = 0; i < flat.length; i++) {
        const fGeo = Math.max(0.15, 1 + K * flat[i].n[1]);
        const got = (exp[i].d - SEED) / (flat[i].d - SEED);
        expect(got, `${m} face ${i} (n_y=${flat[i].n[1].toFixed(3)})`).toBeCloseTo(fGeo, 10);
      }
    }
  });

  it('the full form stretches toward the cavity (ymax grows, |ymin| shrinks)', () => {
    const flat = _makeWulffGeom(wulffFaceSetForMineral('fluorite', 0.6, 0, 1.3));
    const exp = _makeWulffGeom(wulffFaceSetForMineral('fluorite', 0.6, 0, 1.3, 0.18));
    const [fLo, fHi] = geomYRange(flat);
    const [eLo, eHi] = geomYRange(exp);
    // normalized envelopes differ in SHAPE: the exposed form's asymmetry ratio
    // must exceed the flat form's (which is ~1 for the cube family)
    expect(eHi / Math.abs(eLo)).toBeGreaterThan(fHi / Math.abs(fLo) + 0.05);
  });

  it('asymmetry is monotonic in k', () => {
    const ratio = (k: number) => {
      const [lo, hi] = geomYRange(_makeWulffGeom(wulffFaceSetForMineral('fluorite', 0.6, 0, 1.3, k)));
      return hi / Math.abs(lo);
    };
    expect(ratio(0.25)).toBeGreaterThan(ratio(0.12));
    expect(ratio(0.12)).toBeGreaterThan(ratio(0));
  });

  it('exposed half-forms build for every tenant, cap on the NUCLEUS plane', () => {
    for (const [m, g, b] of TENANTS) {
      const faces = wulffFaceSetForMineral(m, g, 0, b, 0.18);
      const half = _makeWulffHalfFormGeom(faces, 0.5, true);
      expect(half, `${m} exposed half-form degenerate`).toBeTruthy();
      const [lo] = geomYRange(half);
      // nucleus cut: the cap sits at kernel y = 0 (full-form normalized scale)
      expect(Math.abs(lo), `${m} cap off the nucleus plane`).toBeLessThan(1e-4);
    }
  });

  it('nucleus cut and quantile cut agree on symmetric forms, diverge on exposed ones', () => {
    const flatFaces = wulffFaceSetForMineral('fluorite', 0.6, 0, 1.3);
    const [qLo] = geomYRange(_makeWulffHalfFormGeom(flatFaces, 0.5));
    const [nLo] = geomYRange(_makeWulffHalfFormGeom(flatFaces, 0.5, true));
    expect(nLo).toBeCloseTo(qLo, 3);   // symmetric: midpoint == nucleus
    const expFaces = wulffFaceSetForMineral('fluorite', 0.6, 0, 1.3, 0.25);
    const [qLoE] = geomYRange(_makeWulffHalfFormGeom(expFaces, 0.5));
    const [nLoE] = geomYRange(_makeWulffHalfFormGeom(expFaces, 0.5, true));
    expect(Math.abs(nLoE)).toBeLessThan(1e-4);          // nucleus cut stays at 0
    expect(qLoE).toBeGreaterThan(nLoE + 1e-3);          // midpoint cut drifted up — the reason the mode exists
  });
});
