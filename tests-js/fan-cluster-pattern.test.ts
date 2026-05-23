// tests-js/fan-cluster-pattern.test.ts — v134 fan cluster mode.
//
// The 'fan' pattern is the marcasite-cockscomb chain morphology
// approximation. Denser + tighter + more parallel + more uniform than
// the 'spike' pattern (which is for stibnite-style needle sprays).
//
// Real cockscomb chains are linear arrays of sub-parallel V-twins on
// a shared baseline. The full linear-array positioning requires
// per-satellite arrangement logic in the satellite-emission code
// (future work); the 'fan' pattern in this commit approximates the
// look via tuned density + tightness + uniformity parameters.

import { describe, expect, it } from 'vitest';

declare const _CLUSTER_PATTERNS: any;
declare const _CLUSTER_PATTERNS_2D: any;
declare const _clusterPatternKeyForPrim: any;
declare const PRIM_MARCASITE_COCKSCOMB_TWIN: any;
declare const PRIM_MARCASITE_SPEARHEAD_TWIN: any;

describe('fan cluster pattern — 99d wireframe (_CLUSTER_PATTERNS_2D)', () => {
  it('"fan" entry exists in _CLUSTER_PATTERNS_2D', () => {
    expect(_CLUSTER_PATTERNS_2D.fan).toBeTruthy();
  });

  it('fan has denser count than spike (chain density)', () => {
    expect(_CLUSTER_PATTERNS_2D.fan.count).toBeGreaterThan(_CLUSTER_PATTERNS_2D.spike.count);
  });

  it('fan has tighter cluster radius (radiusMul) than spike', () => {
    expect(_CLUSTER_PATTERNS_2D.fan.radiusMul).toBeLessThan(_CLUSTER_PATTERNS_2D.spike.radiusMul);
  });

  it('fan has narrower size range than spike (chain uniformity)', () => {
    const fanSpan = _CLUSTER_PATTERNS_2D.fan.sizeMax - _CLUSTER_PATTERNS_2D.fan.sizeMin;
    const spikeSpan = _CLUSTER_PATTERNS_2D.spike.sizeMax - _CLUSTER_PATTERNS_2D.spike.sizeMin;
    expect(fanSpan).toBeLessThan(spikeSpan);
  });
});

describe('fan cluster pattern — 99i Three.js (_CLUSTER_PATTERNS)', () => {
  it('"fan" entry exists in _CLUSTER_PATTERNS', () => {
    expect(_CLUSTER_PATTERNS.fan).toBeTruthy();
  });

  it('fan has higher countScale than spike (denser chain)', () => {
    expect(_CLUSTER_PATTERNS.fan.countScale).toBeGreaterThan(_CLUSTER_PATTERNS.spike.countScale);
  });

  it('fan has smaller spreadMul than spike (chain bunches tighter)', () => {
    expect(_CLUSTER_PATTERNS.fan.spreadMul).toBeLessThan(_CLUSTER_PATTERNS.spike.spreadMul);
  });

  it('fan has smaller tiltMax than spike (more parallel)', () => {
    expect(_CLUSTER_PATTERNS.fan.tiltMax).toBeLessThan(_CLUSTER_PATTERNS.spike.tiltMax);
  });

  it('fan has narrower scale span than spike (chain uniformity)', () => {
    const fanSpan = _CLUSTER_PATTERNS.fan.scaleMax - _CLUSTER_PATTERNS.fan.scaleMin;
    const spikeSpan = _CLUSTER_PATTERNS.spike.scaleMax - _CLUSTER_PATTERNS.spike.scaleMin;
    expect(fanSpan).toBeLessThan(spikeSpan);
  });
});

describe('marcasite twins route to "fan" (was "spike")', () => {
  it('99d: cockscomb twin → fan', () => {
    expect(_clusterPatternKeyForPrim(PRIM_MARCASITE_COCKSCOMB_TWIN)).toBe('fan');
  });

  it('99d: spearhead twin → fan', () => {
    expect(_clusterPatternKeyForPrim(PRIM_MARCASITE_SPEARHEAD_TWIN)).toBe('fan');
  });

  it('99i: cockscomb token → fan pattern', () => {
    expect(_CLUSTER_PATTERNS.marcasite_cockscomb_twin).toBe(_CLUSTER_PATTERNS.fan);
  });

  it('99i: spearhead token → fan pattern', () => {
    expect(_CLUSTER_PATTERNS.marcasite_spearhead_twin).toBe(_CLUSTER_PATTERNS.fan);
  });
});

describe('other twins unaffected by the fan re-route', () => {
  // The other twin → cluster mappings shouldn't have changed. Sanity
  // check that the v134 fan-cluster commit only touched marcasite
  // dispatches.
  it('99i: fluorite penetration → cube (unchanged)', () => {
    expect(_CLUSTER_PATTERNS.fluorite_penetration_twin).toBe(_CLUSTER_PATTERNS.cube);
  });

  it('99i: galena spinel-law → octahedron (unchanged)', () => {
    expect(_CLUSTER_PATTERNS.galena_octahedron_twin).toBe(_CLUSTER_PATTERNS.octahedron);
  });

  it('99i: aragonite cyclic-sextet → prism (unchanged)', () => {
    expect(_CLUSTER_PATTERNS.aragonite_pseudohex_twin).toBe(_CLUSTER_PATTERNS.prism);
  });

  it('99i: aragonite contact → prism (unchanged)', () => {
    expect(_CLUSTER_PATTERNS.aragonite_contact_twin).toBe(_CLUSTER_PATTERNS.prism);
  });

  it('99i: cerussite sixling → botryoidal (skip cluster — unchanged)', () => {
    expect(_CLUSTER_PATTERNS.cerussite_sixling_twin).toBe(_CLUSTER_PATTERNS.botryoidal);
  });

  it('99i: selenite swallowtail → tablet (unchanged)', () => {
    expect(_CLUSTER_PATTERNS.selenite_swallowtail_twin).toBe(_CLUSTER_PATTERNS.tablet);
  });

  it('99i: pyrite iron-cross → cube (unchanged)', () => {
    expect(_CLUSTER_PATTERNS.pyrite_iron_cross_twin).toBe(_CLUSTER_PATTERNS.cube);
  });
});
