// tests-js/dendrite-tree-render.test.ts — dendrite TREE geometry
// (morphology fix-backlog, 2026-06-12).
//
// The dendritic/arborescent habits used to ride the acicular-spike
// fallback (a single thin pyramid). _makeDendriteTreeGeom builds a true
// branching skeleton; these pin the contracts that matter:
//   1. deterministic per crystal_id (replay-stable, NO Math.random)
//   2. it actually branches (well past trunk-only triangle count)
//   3. stays inside the unit-envelope scaling contract (+Y trunk)
//   4. the habit-string gate: dendrites in, needles out

import { describe, expect, it } from 'vitest';

declare const _makeDendriteTreeGeom: any;
declare const _isDendriticHabit: any;
declare const _habitGeomToken: any;

function positionsOf(geom: any): number[] {
  return Array.from(geom.getAttribute('position').array as Float32Array);
}

describe('dendrite tree geometry', () => {
  it('is deterministic per crystal_id and varies across ids', () => {
    const a1 = positionsOf(_makeDendriteTreeGeom(7));
    const a2 = positionsOf(_makeDendriteTreeGeom(7));
    expect(a1).toEqual(a2);
    const b = positionsOf(_makeDendriteTreeGeom(8));
    expect(a1.length === b.length && a1.every((v, i) => v === b[i])).toBe(false);
  });

  it('branches — triangle count well beyond a trunk-only needle', () => {
    // Trunk alone is 12 tris (8 side + 4 cap) = 108 floats. A tree with
    // 6-8 primaries + secondaries lands far above that.
    for (const id of [1, 42, 1736]) {
      const pos = positionsOf(_makeDendriteTreeGeom(id));
      expect(pos.length % 9).toBe(0);          // whole triangles
      expect(pos.length).toBeGreaterThan(600); // >66 tris = it branched
    }
  });

  it('respects the unit-envelope contract (trunk +Y, bounded spread)', () => {
    const pos = positionsOf(_makeDendriteTreeGeom(42));
    let maxR = 0, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < pos.length; i += 3) {
      maxR = Math.max(maxR, Math.abs(pos[i]), Math.abs(pos[i + 2]));
      minY = Math.min(minY, pos[i + 1]);
      maxY = Math.max(maxY, pos[i + 1]);
    }
    expect(minY).toBeGreaterThanOrEqual(-0.56); // roots at the anchor plane
    expect(maxY).toBeLessThanOrEqual(0.56);     // tip cap overshoot allowed 4%
    expect(maxR).toBeLessThanOrEqual(0.75);     // lateral spread stays scalable
    expect(maxR).toBeGreaterThan(0.15);         // ...but actually spreads
  });

  it('habit gate: dendritic/arborescent in, needles and everything else out', () => {
    for (const h of ['dendritic', 'dendritic_cube', 'dendritic_rhombohedral',
                     'arborescent_dendritic', 'arborescent']) {
      expect(_isDendriticHabit(h)).toBe(true);
      // ...and they all resolve to the spike token, which is what the
      // mesh-sync dispatch gates on (twins/dripstone keep their tokens).
      expect(_habitGeomToken(h)).toBe('spike');
    }
    for (const h of ['acicular', 'fibrous (satin spar)', 'plumose_rosette',
                     'radiating_spray', 'prismatic', 'wire_copper']) {
      expect(_isDendriticHabit(h)).toBe(false);
    }
  });
});
