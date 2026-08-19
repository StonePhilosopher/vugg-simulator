// tests-js/o2-render-wiring.test.ts — W-F O2 end-to-end through the RENDERER
// (2026-07-06). The kernel/clipper tests (o2-contact.test.ts) prove the clip
// math; this proves the PLUMBING — the neighbour pre-pass, the convex-token
// gate, the world→local plane inversion, and the [euhedral, contact] material
// array — actually fires when _topoSyncCrystalMeshes builds a real scenario's
// crystals. Without this the clip could be perfect and never reached (the
// "silent no-op" the probe warned about).
//
// Runs headless: onBeforeCompile (the cavity-clip shader) is lazy and never
// executes without a GL context, so a stub clipUniforms suffices.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const THREE: any;
declare const _topoSyncCrystalMeshes: any;

function makeSim(name: string, seed = 42, steps?: number) {
  setSeed(seed);
  const scen = SCENARIOS[name];
  expect(scen, `scenario ${name} missing`).toBeTruthy();
  const { conditions, events, defaultSteps } = scen();
  const sim = new VugSimulator(conditions, events);
  const n = steps ?? defaultSteps ?? 100;
  for (let i = 0; i < n; i++) sim.run_step();
  return sim;
}

function makeState() {
  return {
    crystalsSig: null,
    crystals: new THREE.Group(),
    geomCache: new Map(),
    clipUniforms: {
      uVugRadius: { value: 1e6 },
      uVugCenter: { value: new THREE.Vector3(0, 0, 0) },
      uVugRingCount: { value: 0 },
      uVugRadiiByRing: { value: new Float32Array(64) },
      uVugCellRadii: { value: null },
      uVugCellTexW: { value: 0 },
      uVugCellTexH: { value: 0 },
      uHelixEnabled: { value: 0 }, uHelixSweep: { value: 0 },
      uHelixYCenter: { value: 0 }, uHelixYSpan: { value: 1 },
      uHelixNTurns: { value: 1 }, uHelixFade: { value: Math.PI / 2 },
    },
  };
}

function tally(state: any) {
  let total = 0, contacted = 0, satellites = 0;
  for (const m of state.crystals.children) {
    if (m.userData && m.userData.isSatellite) { satellites++; continue; }
    total++;
    if (Array.isArray(m.material)) {
      contacted++;
      expect(m.geometry.groups.length, 'contacted mesh missing euhedral+contact groups').toBe(2);
      expect(m.material.length).toBe(2);
      // group 1 (contact) must reference material index 1
      const g1 = m.geometry.groups.find((gp: any) => gp.materialIndex === 1);
      expect(g1, 'no contact group on a 2-material mesh').toBeTruthy();
    } else {
      // v236 refinement: the old assertion (`groups.length ≤ 1`) carried a latent
      // false assumption — THREE's native primitives ship with per-face groups
      // (BoxGeometry = 6 groups, materialIndex 0..5), which are INERT under a
      // single material (every group draws with the same material). The v236
      // mvt re-deal surfaced it: fluorite #4 landed un-contacted on the raw
      // cube path for the first time in this test's history. The invariant O2
      // actually needs: an un-contacted mesh must not carry the CONTACT
      // signature — exactly 2 groups indexing materials {0,1} (the js/46
      // euhedral+contact pair) — which would mean the clipper emitted groups
      // but the material-array plumbing was dropped (the half-fire this test
      // exists to catch).
      const gs = m.geometry.groups;
      const looksLikeContactPair = gs.length === 2
        && gs.some((gp: any) => gp.materialIndex === 0)
        && gs.some((gp: any) => gp.materialIndex === 1);
      expect(looksLikeContactPair, 'un-contacted mesh carries the euhedral+contact group pair without a material array — O2 half-fired').toBe(false);
    }
  }
  return { total, contacted, satellites };
}

describe('W-F O2 — the render pipeline fires on real scenarios', () => {
  it('gem_pegmatite: convex crystals get clipped + a matte contact material', () => {
    const sim = makeSim('gem_pegmatite');
    const state = makeState();
    _topoSyncCrystalMeshes(state, sim, sim.wall_state, undefined);
    const { total, contacted } = tally(state);
    expect(total, 'no crystal meshes built').toBeGreaterThan(0);
    expect(contacted, 'O2 never fired — the clip is a no-op').toBeGreaterThan(0);
  });

  it('mvt: the Wulff-tenant druse (calcite/fluorite/galena) also contacts', () => {
    const sim = makeSim('mvt');
    const state = makeState();
    _topoSyncCrystalMeshes(state, sim, sim.wall_state, undefined);
    const { total, contacted } = tally(state);
    expect(total).toBeGreaterThan(0);
    expect(contacted).toBeGreaterThan(0);
  });

  it('an explicitly sparse three-crystal fixture contacts nothing (no over-firing)', () => {
    // Scenario populations legitimately drift as chemistry improves. Derive a
    // renderer fixture from three real quartz crystals, then pin their size and
    // anchors so this remains a geometry false-positive test.
    const sim = makeSim('tutorial_first_crystal');
    sim.crystals = sim.crystals.filter((c: any) => c.mineral === 'quartz').slice(0, 3);
    const wall = sim.wall_state;
    const ring = Math.floor(wall.ring_count / 2);
    const stride = Math.floor(wall.cells_per_ring / 3);
    for (let i = 0; i < sim.crystals.length; i++) {
      sim.crystals[i].c_length_mm = 2.1;
      sim.crystals[i].a_width_mm = 1.6;
      sim.crystals[i].wall_anchor = wall._anchorFromRingCell(ring, i * stride);
    }
    const state = makeState();
    _topoSyncCrystalMeshes(state, sim, sim.wall_state, undefined);
    const { contacted } = tally(state);
    expect(contacted, 'O2 fired on a scenario with no interpenetration').toBe(0);
  });

  it('the sync is idempotent — a second call with the same signature is a no-op', () => {
    const sim = makeSim('gem_pegmatite');
    const state = makeState();
    _topoSyncCrystalMeshes(state, sim, sim.wall_state, undefined);
    const first = state.crystals.children.length;
    _topoSyncCrystalMeshes(state, sim, sim.wall_state, undefined);   // sig unchanged → early-out
    expect(state.crystals.children.length).toBe(first);
  });
});
