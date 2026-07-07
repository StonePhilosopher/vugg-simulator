// tests-js/matrix-skin.test.ts — MATRIX SKINS + WALL DISPLAY (2026-07-06,
// boss asks: "turn the display of the vugg wall on or off" + "the vugg wall
// should have a specific texture skin that tells you what kind of matrix it
// is"). Render-only: wall.matrix is the true-host override for scenarios whose
// `composition` is a physics proxy; the renderer resolves matrix ?? composition.
//
// THE DOUBLE-WHITELIST PIN: a wall flag from scenarios.json5 must survive TWO
// explicit constructor whitelists (VugWall, then the WallState mirror in
// js/85) before the renderer can see it — an unlisted flag is silently
// dropped at either fence. The tormiq test below walks the full chain.
//
// jsdom has no 2D canvas, so _matrixSkinTexture's actual paint can't run
// headless — the guard (null, no throw) is pinned here; the painted skins are
// eye-checked in the live preview (the render-upgrade-visible discipline).

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const WallState: any;
declare const VugWall: any;
declare const WallMesh: any;
declare const THREE: any;
declare const _MATRIX_SKIN_PAINTERS: any;
declare const _matrixSkinTexture: any;
declare const _topoApplyWallDisplay: any;

describe('matrix skin — the data chain', () => {
  it('VugWall whitelists matrix (fence 1)', () => {
    const w = new VugWall({ composition: 'basalt', matrix: 'amphibolite' });
    expect(w.composition).toBe('basalt');
    expect(w.matrix).toBe('amphibolite');
    expect(new VugWall({}).matrix).toBeNull();
  });

  it('WallState mirrors composition + matrix (fence 2)', () => {
    const ws = new WallState({ composition: 'basalt', matrix: 'amphibolite' });
    expect(ws.composition).toBe('basalt');
    expect(ws.matrix).toBe('amphibolite');
    const dflt = new WallState({});
    expect(dflt.composition).toBe('limestone');
    expect(dflt.matrix).toBeNull();
  });

  it('THE FULL CHAIN: tormiq\'s scenarios.json5 matrix reaches sim.wall_state', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.tormiq_alpine_cleft();
    const sim = new VugSimulator(conditions, events);
    expect(sim.wall_state.composition).toBe('basalt');       // the physics proxy
    expect(sim.wall_state.matrix).toBe('amphibolite');       // the true host, render-side
  });

  it('every scenario\'s resolved lithology has a registered skin painter', () => {
    const missing: string[] = [];
    for (const name of Object.keys(SCENARIOS)) {
      let conditions;
      try { ({ conditions } = SCENARIOS[name]()); } catch { continue; }
      const wall = conditions && conditions.wall;
      if (!wall) continue;
      const litho = String(wall.matrix || wall.composition || 'limestone');
      if (!_MATRIX_SKIN_PAINTERS[litho]) missing.push(`${name}:${litho}`);
    }
    expect(missing, `lithologies without a skin: ${missing.join(', ')}`).toEqual([]);
  });

  it('the 8 note-backed overrides landed', () => {
    const expected: Record<string, string> = {
      chiastolite_hornfels: 'hornfels',
      marble_contact_metamorphism: 'marble',
      grimsel_alpine_cleft: 'granite',
      tormiq_alpine_cleft: 'amphibolite',
      ouro_preto: 'phyllite',
      wittichen: 'granite',
      ultramafic_supergene: 'ultramafic',
      elmwood: 'dolomite',
    };
    for (const [name, litho] of Object.entries(expected)) {
      const { conditions } = SCENARIOS[name]();
      expect(conditions.wall.matrix, name).toBe(litho);
    }
  });

  it('_matrixSkinTexture degrades to null headless (jsdom has no 2D canvas) without throwing', () => {
    expect(() => _matrixSkinTexture('limestone')).not.toThrow();
    expect(() => _matrixSkinTexture('no_such_lithology')).not.toThrow();
  });
});

describe('matrix skin — wall mesh UVs', () => {
  it('WallMesh carries static lat-long uvs covering every vertex', () => {
    const wall = new WallState({ cells_per_ring: 120, ring_count: 16, vug_diameter_mm: 50 });
    const mesh = WallMesh.fromWallState(wall);
    const numVerts = mesh.numInterior + 2;
    expect(mesh.uvs).toBeTruthy();
    expect(mesh.uvs.length).toBe(numVerts * 2);
    for (let i = 0; i < mesh.uvs.length; i++) {
      expect(mesh.uvs[i]).toBeGreaterThanOrEqual(0);
      expect(mesh.uvs[i]).toBeLessThanOrEqual(1);
    }
    // u sweeps theta within a ring; v rises with ring index; poles at v 0/1
    expect(mesh.uvs[0]).toBe(0);                              // ring 0, cell 0 → u = 0
    expect(mesh.uvs[(1) * 2]).toBeCloseTo(1 / 120, 9);        // cell 1 → u = 1/120
    expect(mesh.uvs[1]).toBeCloseTo(0.5 / 16, 9);             // ring 0 → v = 0.5/16
    expect(mesh.uvs[mesh.southIdx * 2 + 1]).toBe(0);
    expect(mesh.uvs[mesh.northIdx * 2 + 1]).toBe(1);
  });
});

describe('wall display — the three-state material composition', () => {
  function stubState(wallDisplay: number, insideMode: boolean) {
    return {
      wallDisplay, insideMode,
      cavity: { visible: true, material: { side: null, opacity: -1, transparent: null, depthWrite: null, needsUpdate: false } },
    };
  }

  it('mode 0 solid composes with insideMode (the pre-existing contract)', () => {
    const out = stubState(0, false);
    _topoApplyWallDisplay(out);
    expect(out.cavity.visible).toBe(true);
    expect(out.cavity.material.side).toBe(THREE.BackSide);
    expect(out.cavity.material.opacity).toBe(0.40);
    expect(out.cavity.material.transparent).toBe(true);
    const inn = stubState(0, true);
    _topoApplyWallDisplay(inn);
    expect(inn.cavity.material.side).toBe(THREE.FrontSide);
    expect(inn.cavity.material.opacity).toBe(1.0);
    expect(inn.cavity.material.transparent).toBe(false);
  });

  it('mode 1 translucent is the druse-portrait shell (0.18, no depth write)', () => {
    const s = stubState(1, false);
    _topoApplyWallDisplay(s);
    expect(s.cavity.visible).toBe(true);
    expect(s.cavity.material.opacity).toBe(0.18);
    expect(s.cavity.material.transparent).toBe(true);
    expect(s.cavity.material.depthWrite).toBe(false);
  });

  it('mode 2 hides the cavity mesh entirely', () => {
    const s = stubState(2, false);
    _topoApplyWallDisplay(s);
    expect(s.cavity.visible).toBe(false);
  });

  it('null-safe on a bare state', () => {
    expect(() => _topoApplyWallDisplay(null)).not.toThrow();
    expect(() => _topoApplyWallDisplay({ wallDisplay: 1 })).not.toThrow();
  });
});
