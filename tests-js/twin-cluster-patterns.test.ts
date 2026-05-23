// tests-js/twin-cluster-patterns.test.ts — verifies all 7 v134 iconic
// twin primitives route to appropriate cluster patterns in both
// renderers.
//
// Without this wiring, twin primitives would render as solo specimens
// (or get the default cluster pattern), losing the visual signature of
// real twinned-crystal aggregates. The most striking example: marcasite
// cockscomb, where the comb morphology (sub-parallel V-twins in a
// serrated row) IS just the spike cluster of cockscomb-twin satellites.
//
// 99d (wireframe): _clusterPatternKeyForPrim(prim) returns a pattern
// key string from _CLUSTER_PATTERNS_2D.
// 99i (Three.js): _CLUSTER_PATTERNS[token] returns a ClusterPattern.
// Both should agree on the mapping for each twin.

import { describe, expect, it } from 'vitest';

declare const PRIM_FLUORITE_PENETRATION_TWIN: any;
declare const PRIM_SELENITE_SWALLOWTAIL_TWIN: any;
declare const PRIM_GALENA_OCTAHEDRON_TWIN: any;
declare const PRIM_ARAGONITE_PSEUDOHEX_TWIN: any;
declare const PRIM_CERUSSITE_SIXLING_TWIN: any;
declare const PRIM_MARCASITE_COCKSCOMB_TWIN: any;
declare const PRIM_PYRITE_IRON_CROSS_TWIN: any;
declare const _clusterPatternKeyForPrim: any;
declare const _CLUSTER_PATTERNS_2D: any;
declare const _CLUSTER_PATTERNS: any;

describe('twin cluster patterns — 99d wireframe (_clusterPatternKeyForPrim)', () => {
  it('fluorite penetration twin → cube cluster', () => {
    expect(_clusterPatternKeyForPrim(PRIM_FLUORITE_PENETRATION_TWIN)).toBe('cube');
  });

  it('selenite swallowtail twin → tablet cluster', () => {
    expect(_clusterPatternKeyForPrim(PRIM_SELENITE_SWALLOWTAIL_TWIN)).toBe('tablet');
  });

  it('galena spinel-law twin → octahedron cluster', () => {
    expect(_clusterPatternKeyForPrim(PRIM_GALENA_OCTAHEDRON_TWIN)).toBe('octahedron');
  });

  it('aragonite cyclic-sextet twin → prism cluster', () => {
    expect(_clusterPatternKeyForPrim(PRIM_ARAGONITE_PSEUDOHEX_TWIN)).toBe('prism');
  });

  it('cerussite stellate sixling → null (already multi-arm, skip cluster)', () => {
    // The sixling primitive already emits 6 visible arms (3 blades × 2 ends).
    // Returning null falls through to the tiny-crystal micro fallback or
    // single-primitive default (count=0).
    expect(_clusterPatternKeyForPrim(PRIM_CERUSSITE_SIXLING_TWIN)).toBe(null);
  });

  it('marcasite cockscomb twin → spike cluster (the comb morphology payoff)', () => {
    // The KEY case: marcasite cockscomb's "comb" silhouette is literally
    // multiple cockscomb V-twins arranged in a tight spray. The 'spike'
    // pattern (count=8, sizeMin=0.35, sizeMax=0.75, radiusMul=0.55,
    // tightish spread) emits 4-8 satellite cockscomb-twins around the
    // parent, producing the serrated row morphology Ramdohr 1980 + the
    // v133 _retune_note describe.
    expect(_clusterPatternKeyForPrim(PRIM_MARCASITE_COCKSCOMB_TWIN)).toBe('spike');
  });

  it('pyrite iron-cross twin → cube cluster', () => {
    expect(_clusterPatternKeyForPrim(PRIM_PYRITE_IRON_CROSS_TWIN)).toBe('cube');
  });

  it('each mapped key resolves to a valid pattern in _CLUSTER_PATTERNS_2D', () => {
    const twins = [
      PRIM_FLUORITE_PENETRATION_TWIN,
      PRIM_SELENITE_SWALLOWTAIL_TWIN,
      PRIM_GALENA_OCTAHEDRON_TWIN,
      PRIM_ARAGONITE_PSEUDOHEX_TWIN,
      PRIM_MARCASITE_COCKSCOMB_TWIN,
      PRIM_PYRITE_IRON_CROSS_TWIN,
    ];
    for (const t of twins) {
      const key = _clusterPatternKeyForPrim(t);
      expect(key).toBeTruthy();
      expect(_CLUSTER_PATTERNS_2D[key]).toBeTruthy();
      expect(_CLUSTER_PATTERNS_2D[key].count).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('twin cluster patterns — 99i Three.js (_CLUSTER_PATTERNS by token)', () => {
  it('all 7 twin tokens have entries in _CLUSTER_PATTERNS', () => {
    const tokens = [
      'fluorite_penetration_twin',
      'selenite_swallowtail_twin',
      'galena_octahedron_twin',
      'aragonite_pseudohex_twin',
      'cerussite_sixling_twin',
      'marcasite_cockscomb_twin',
      'pyrite_iron_cross_twin',
    ];
    for (const t of tokens) {
      expect(_CLUSTER_PATTERNS[t]).toBeTruthy();
    }
  });

  it('twin tokens reference their underlying-form cluster pattern (by identity)', () => {
    // Mappings should be the SAME OBJECT as the underlying pattern
    // (the implementation uses reference assignment, not duplication).
    expect(_CLUSTER_PATTERNS.fluorite_penetration_twin).toBe(_CLUSTER_PATTERNS.cube);
    expect(_CLUSTER_PATTERNS.selenite_swallowtail_twin).toBe(_CLUSTER_PATTERNS.tablet);
    expect(_CLUSTER_PATTERNS.galena_octahedron_twin).toBe(_CLUSTER_PATTERNS.octahedron);
    expect(_CLUSTER_PATTERNS.aragonite_pseudohex_twin).toBe(_CLUSTER_PATTERNS.prism);
    expect(_CLUSTER_PATTERNS.cerussite_sixling_twin).toBe(_CLUSTER_PATTERNS.botryoidal);
    expect(_CLUSTER_PATTERNS.marcasite_cockscomb_twin).toBe(_CLUSTER_PATTERNS.spike);
    expect(_CLUSTER_PATTERNS.pyrite_iron_cross_twin).toBe(_CLUSTER_PATTERNS.cube);
  });

  it('cerussite sixling cluster has countScale=0 (skip cluster — already multi-arm)', () => {
    // The 'botryoidal' pattern has countScale=0 (skip cluster). Cerussite
    // sixling uses this to avoid over-decorating an already-busy primitive.
    expect(_CLUSTER_PATTERNS.cerussite_sixling_twin.countScale).toBe(0);
  });

  it('marcasite cockscomb has countScale>0 (the comb chain — multiple V-twins)', () => {
    // The cockscomb cluster must emit satellites — that's how the comb
    // emerges. countScale=1.3 from the 'spike' pattern.
    expect(_CLUSTER_PATTERNS.marcasite_cockscomb_twin.countScale).toBeGreaterThan(0);
  });

  it('cross-renderer parity — both renderers agree on cluster pattern source per twin', () => {
    // For each twin, the 99d key should correspond to a pattern object
    // whose key fields (countScale, evenAngles, etc.) match the 99i
    // pattern for that twin's token.
    const mappings = [
      { prim: PRIM_FLUORITE_PENETRATION_TWIN, token: 'fluorite_penetration_twin', key: 'cube' },
      { prim: PRIM_SELENITE_SWALLOWTAIL_TWIN, token: 'selenite_swallowtail_twin', key: 'tablet' },
      { prim: PRIM_GALENA_OCTAHEDRON_TWIN, token: 'galena_octahedron_twin', key: 'octahedron' },
      { prim: PRIM_ARAGONITE_PSEUDOHEX_TWIN, token: 'aragonite_pseudohex_twin', key: 'prism' },
      { prim: PRIM_MARCASITE_COCKSCOMB_TWIN, token: 'marcasite_cockscomb_twin', key: 'spike' },
      { prim: PRIM_PYRITE_IRON_CROSS_TWIN, token: 'pyrite_iron_cross_twin', key: 'cube' },
    ];
    for (const m of mappings) {
      const key99d = _clusterPatternKeyForPrim(m.prim);
      expect(key99d).toBe(m.key);
      const pat99d = _CLUSTER_PATTERNS_2D[key99d];
      const pat99i = _CLUSTER_PATTERNS[m.token];
      expect(pat99i.evenAngles).toBe(pat99d.evenAngles);
      // Count fields differ (99d uses 'count' raw; 99i uses 'countScale'
      // for relative scaling). But both should be non-zero for clustering
      // twins, zero for non-clustering.
      const wants_cluster = pat99d.count > 0;
      const has_cluster_99i = pat99i.countScale > 0;
      expect(has_cluster_99i).toBe(wants_cluster);
    }
  });
});
