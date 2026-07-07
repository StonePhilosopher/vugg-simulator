// tests-js/c1-directional.test.ts — C1, the directional-σ tranche (2026-07-07).
// Boss stone: replace the render-only geometric approximations of the ontogeny
// core with the real interior-voxel depletion field.
//   O1a  per-crystal exposure kExp from each crystal's OWN growth-weighted
//        base(d=0, wall)/tip(d=max, cavity) σ gradient — retiring the fleet-wide
//        kExp=0.18 constant the c1-depletion-ev-probe exposed as a fiction.
//   O1b  neighbour shadow: lateral druse crowding reinforces the radial exposure
//        (reuses the O2 neighbour pre-pass; per-face directional is pre-registered).
//   O2   meeting-plane weights by integrated growth (total_growth_um), faithful
//        for the dissolved/anisotropic drift population.
//
// The whole tranche is RENDER-ONLY: the bedrock accumulator reads the voxel grid
// + swaps conditions.fluid read-only, consumes NO RNG, so seed-42 baselines stay
// byte-identical (asserted by the baseline suite; the frozen-param converse came
// back EMPTY — the biasC bands were always calibrated kExp-agnostic, so nothing
// was pinned at 0.18 to expire; tools/wulff-frozen-g-aspect-sweep.mjs still green).

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const THREE: any;
declare const o1aExposureK: any;
declare const _o1aBaseTipSigma: any;
declare const _o1bNeighborShadow: any;
declare const O1A_EXP: any;
declare const O1B_SHADOW: any;
declare const _topoSyncCrystalMeshes: any;

describe('O1a — exposure kExp from the base/tip integral', () => {
  it('absent field data → KEXP_DEFAULT (neutral)', () => {
    expect(o1aExposureK({})).toBe(O1A_EXP.KEXP_DEFAULT);
    expect(o1aExposureK({ _o1aExp: { s0G: 0, sDG: 0, G: 0 } })).toBe(O1A_EXP.KEXP_DEFAULT);
  });

  it('flat field (base == tip) → 0 (isotropic — the calm-majority fix)', () => {
    expect(o1aExposureK({ _o1aExp: { s0G: 5, sDG: 5, G: 10 } })).toBe(0);
  });

  it('moderate gradient (base/tip = 0.5) recovers the old 0.18 constant', () => {
    // s0=0.5, sD=1.0 → 1−0.5 = 0.5 → SCALE·0.5 = 0.36·0.5 = 0.18
    const k = o1aExposureK({ _o1aExp: { s0G: 5, sDG: 10, G: 10 } });
    expect(k).toBeCloseTo(O1A_EXP.KEXP_SCALE * 0.5, 6);
    expect(k).toBeCloseTo(0.18, 6);
  });

  it('steep gradient clamps to KEXP_MAX', () => {
    // base/tip = 0.1 → SCALE·0.9 = 0.324 > MAX 0.30
    expect(o1aExposureK({ _o1aExp: { s0G: 1, sDG: 10, G: 10 } })).toBe(O1A_EXP.KEXP_MAX);
  });

  it('enriched pocket (base > tip) → 0, never negative exposure', () => {
    expect(o1aExposureK({ _o1aExp: { s0G: 12, sDG: 10, G: 10 } })).toBe(0);
  });

  it('degenerate tip (sD ≤ 0) → literal 0 (not DEFAULT — G>0 takes the compute path)', () => {
    expect(o1aExposureK({ _o1aExp: { s0G: 0, sDG: 0, G: 5 } })).toBe(0);
  });
});

describe('O1a — _o1aBaseTipSigma null-safety (headless, no voxel grid)', () => {
  it('never throws; returns null when the grid/closure is unavailable', () => {
    expect(() => _o1aBaseTipSigma(null, { mineral: 'calcite' })).not.toThrow();
    expect(_o1aBaseTipSigma(null, { mineral: 'calcite' })).toBeNull();
    expect(_o1aBaseTipSigma({ conditions: {} }, { mineral: 'calcite' })).toBeNull();
  });
});

describe('O1b — neighbour shadow from the crowd', () => {
  const me = { id: 1, cx: 0, cy: 0, cz: 0, reach: 1, enclosed: false };

  it('fewer than two bodies → 0', () => {
    expect(_o1bNeighborShadow({ crystal_id: 1 }, [me])).toBe(0);
    expect(_o1bNeighborShadow({ crystal_id: 1 }, [])).toBe(0);
  });

  it('isolated crystal (no overlap) → 0', () => {
    const far = { id: 2, cx: 5, cy: 0, cz: 0, reach: 1, enclosed: false };  // D=5 ≥ reachSum 2
    expect(_o1bNeighborShadow({ crystal_id: 1 }, [me, far])).toBe(0);
  });

  it('overlapping neighbour → SCALE · overlap fraction', () => {
    const near = { id: 2, cx: 1, cy: 0, cz: 0, reach: 1, enclosed: false };  // D=1, sum=2, overlap=(2−1)/2=0.5
    expect(_o1bNeighborShadow({ crystal_id: 1 }, [me, near])).toBeCloseTo(O1B_SHADOW.SCALE * 0.5, 9);
  });

  it('enclosed neighbours (O4 guests) are excluded', () => {
    const guest = { id: 2, cx: 1, cy: 0, cz: 0, reach: 1, enclosed: true };
    expect(_o1bNeighborShadow({ crystal_id: 1 }, [me, guest])).toBe(0);
  });

  it('a dense crowd caps at MAX', () => {
    const crowd = [me];
    for (let i = 2; i < 20; i++) crowd.push({ id: i, cx: 0.1, cy: 0, cz: 0, reach: 1, enclosed: false });
    expect(_o1bNeighborShadow({ crystal_id: 1 }, crowd)).toBe(O1B_SHADOW.MAX);
  });
});

describe('C1 — integration: the accumulator populates + drives a sane kExp', () => {
  it('mvt calcite tenant carries _o1aExp and grows a below-0.18 (symmetrized) exposure', () => {
    setSeed(42);
    const { conditions, events, defaultSteps } = SCENARIOS.mvt();
    const sim = new VugSimulator(conditions, events);
    const steps = defaultSteps ?? 120;
    for (let i = 0; i < steps; i++) sim.run_step();

    const tenant = sim.crystals.find((c: any) => c.mineral === 'calcite' && c._o1aExp && c._o1aExp.G > 0);
    expect(tenant, 'no fluid calcite tenant accumulated a base/tip integral').toBeTruthy();
    const k = o1aExposureK(tenant);
    expect(Number.isFinite(k)).toBe(true);
    expect(k).toBeGreaterThanOrEqual(0);
    expect(k).toBeLessThanOrEqual(O1A_EXP.KEXP_MAX);
    // the calm-majority finding: this well-fed tenant reads BELOW the retired
    // 0.18 constant (the probe measured mvt calcite ≈ 0.03).
    expect(k, 'a calm Wulff tenant should symmetrize below the old 0.18 constant').toBeLessThan(0.18);
  });

  it('the O2/render pipeline still fires with integrated-growth weights (regression)', () => {
    setSeed(42);
    const { conditions, events, defaultSteps } = SCENARIOS.gem_pegmatite();
    const sim = new VugSimulator(conditions, events);
    const steps = defaultSteps ?? 100;
    for (let i = 0; i < steps; i++) sim.run_step();
    const state = {
      crystalsSig: null, crystals: new THREE.Group(), geomCache: new Map(),
      clipUniforms: {
        uVugRadius: { value: 1e6 }, uVugCenter: { value: new THREE.Vector3(0, 0, 0) },
        uVugRingCount: { value: 0 }, uVugRadiiByRing: { value: new Float32Array(64) },
        uVugCellRadii: { value: null }, uVugCellTexW: { value: 0 }, uVugCellTexH: { value: 0 },
        uHelixEnabled: { value: 0 }, uHelixSweep: { value: 0 }, uHelixYCenter: { value: 0 },
        uHelixYSpan: { value: 1 }, uHelixNTurns: { value: 1 }, uHelixFade: { value: Math.PI / 2 },
      },
    };
    _topoSyncCrystalMeshes(state, sim, sim.wall_state, undefined);
    let contacted = 0;
    for (const m of state.crystals.children) if (Array.isArray(m.material)) contacted++;
    expect(contacted, 'O2 contact clip stopped firing after the integrated-growth weight change').toBeGreaterThan(0);
  });
});
