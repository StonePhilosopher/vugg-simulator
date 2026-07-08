// tests-js/o4-engulfment.test.ts — W-F O4a: engulfment made visible (2026-07-07).
//
// The Sweetwater enclosure mechanic (_check_enclosure) has tagged enclosed_by /
// enclosed_crystals sim-side all along; the 2D topo map already dots them. O4a is
// the 3D face: an engulfed guest renders as a small opaque grain INSIDE its host,
// revealed by the host's Depth-A translucency (an opaque host rightly hides it).
//
// Pinned here: the pure inclusion-placement helper, and specifically the invariant
// whose ABSENCE was the O4a bug. First cut seated guests off the host's UNCAPPED
// sim size (Naica selenite: 66 mm sim vs ~13 mm rendered), so guests spilled
// OUTSIDE the visible host. The fix seats every guest within a fraction of the
// host's RENDERED reach — an inclusion can never escape its host.
//
// Material opacity + the render-time host-bounds lookup are covered by the preview
// kernel-truth (35/35 guests opaque + inside a translucent Naica selenite, 569
// visible pixels via a with/without-inclusions framebuffer diff), since
// buildCrystalMaterial + the Three.js mesh graph need a WebGL context.

import { describe, expect, it } from 'vitest';

declare const _o4InclusionLocalPos: any;

const RMIN = 0.12, RMAX = 0.62;   // must match O4_INCLUSION_RMIN/RMAX_FRAC in js/99i
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('W-F O4a — inclusion placement helper', () => {
  const C = [10, -4, 7];       // host rendered centre
  const hostR = 12.8;          // Naica selenite rendered reach

  it('an inclusion never escapes its host (within [RMIN,RMAX]·hostR of centre)', () => {
    // Guest anchors sit on the cavity WALL — well OUTSIDE the host. The helper
    // must pull every one of them inside the host body.
    for (let id = 1; id <= 40; id++) {
      const ax = C[0] + Math.cos(id) * 30;
      const ay = C[1] + Math.sin(id * 1.7) * 30;
      const az = C[2] + Math.cos(id * 0.3) * 30;
      const p = _o4InclusionLocalPos(ax, ay, az, C[0], C[1], C[2], hostR, id);
      const d = dist(p, C);
      expect(Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2])).toBe(true);
      expect(d).toBeLessThanOrEqual(RMAX * hostR + 1e-6);
      expect(d).toBeGreaterThanOrEqual(RMIN * hostR - 1e-6);
    }
  });

  it('offset scales with the host reach (bigger host → deeper guest)', () => {
    const a = [C[0] + 20, C[1] + 5, C[2] - 8];
    const small = _o4InclusionLocalPos(a[0], a[1], a[2], C[0], C[1], C[2], 2, 5);
    const big = _o4InclusionLocalPos(a[0], a[1], a[2], C[0], C[1], C[2], 40, 5);
    expect(dist(small, C)).toBeLessThan(dist(big, C));
    expect(dist(small, C)).toBeLessThanOrEqual(RMAX * 2 + 1e-6);
    expect(dist(big, C)).toBeLessThanOrEqual(RMAX * 40 + 1e-6);
  });

  it('is deterministic per (anchor, host, id)', () => {
    expect(_o4InclusionLocalPos(1, 2, 3, 0, 0, 0, 10, 17))
      .toEqual(_o4InclusionLocalPos(1, 2, 3, 0, 0, 0, 10, 17));
  });

  it('seats the guest on the side it nucleated (direction follows the anchor)', () => {
    const anchorDir = [25, 2, -3];
    const p = _o4InclusionLocalPos(C[0] + anchorDir[0], C[1] + anchorDir[1], C[2] + anchorDir[2], C[0], C[1], C[2], hostR, 9);
    const v = [p[0] - C[0], p[1] - C[1], p[2] - C[2]];
    expect(v[0] * anchorDir[0] + v[1] * anchorDir[1] + v[2] * anchorDir[2]).toBeGreaterThan(0);
  });

  it('handles a degenerate anchor (guest ~at host centre) without NaN', () => {
    const p = _o4InclusionLocalPos(C[0], C[1], C[2], C[0], C[1], C[2], hostR, 3);
    expect(Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2])).toBe(true);
    const d = dist(p, C);
    expect(d).toBeGreaterThan(0);                       // fallback still offsets it
    expect(d).toBeLessThanOrEqual(RMAX * hostR + 1e-6); // …but stays inside
  });

  it('different guests fill the interior (ids spread radially, not one shell)', () => {
    const a = [C[0] + 18, C[1] - 6, C[2] + 9];
    const radii = new Set<number>();
    for (const id of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const p = _o4InclusionLocalPos(a[0], a[1], a[2], C[0], C[1], C[2], hostR, id);
      radii.add(+dist(p, C).toFixed(2));
    }
    expect(radii.size).toBeGreaterThan(3);
  });
});
