// tests-js/hopper-texture.test.ts — hopper/skeletal texture dispatch
//
// Pins the v134 renderer addition (2026-05-22): a new 'hopper' texture
// in js/99a-renderer-textures.ts that paints stepped right-angle
// notches on the wall-cell edge to represent hopper/skeletal habits.
//
// Per Tanaka et al. 2018 (J. Phys. Chem. Lett.; PMC5994728), the
// cubic-to-hopper growth transition for halite happens at a critical
// growth rate (~6.5 µm/s) above which edges outpace face centers
// (diffusion-limited regime, rate ∝ σ³). Six MINERAL_SPEC entries
// declare hopper variants: halite, sylvite, galena, quartz,
// apophyllite, pyromorphite. The texture renders them as a series of
// rectangular notches recessed inward, distinct from sawtooth's
// triangular spikes.
//
// The texture functions themselves draw to a 2D canvas — testing the
// drawing directly would need a heavy ctx mock. Instead this test
// pins the _resolveTexture(mineral, habit) dispatcher: confirms each
// hopper habit string routes to the 'hopper' token (which the
// drawHabitTexture switch then dispatches to _texture_hopper).

import { describe, expect, it } from 'vitest';

declare const _resolveTexture: any;
declare const HABIT_TO_TEXTURE: any;
declare const TEXTURE_PARAMS: any;

describe('hopper-texture — explicit habit string routing', () => {
  it('hopper_growth → hopper (halite, apophyllite)', () => {
    expect(_resolveTexture('halite', 'hopper_growth')).toBe('hopper');
    expect(_resolveTexture('apophyllite', 'hopper_growth')).toBe('hopper');
  });

  it('hopper_cube → hopper (sylvite)', () => {
    expect(_resolveTexture('sylvite', 'hopper_cube')).toBe('hopper');
  });

  it('skeletal_hopper → hopper (galena very-high-σ)', () => {
    expect(_resolveTexture('galena', 'skeletal_hopper')).toBe('hopper');
  });

  it('skeletal_fenster → hopper (quartz rapid-cool window variant)', () => {
    expect(_resolveTexture('quartz', 'skeletal_fenster')).toBe('hopper');
  });

  it('hoppered_hexagonal → hopper (pyromorphite)', () => {
    expect(_resolveTexture('pyromorphite', 'hoppered_hexagonal')).toBe('hopper');
  });
});

describe('hopper-texture — fuzzy substring fallback', () => {
  it('any habit containing "hopper" routes to hopper', () => {
    // Hypothetical future habit strings not in the explicit table
    // should still resolve via the fuzzy fallback.
    expect(_resolveTexture('halite', 'hopper_skewed_cube')).toBe('hopper');
    expect(_resolveTexture('bismuth', 'lab_hopper_stepped')).toBe('hopper');
  });

  it('any habit containing "skeletal" routes to hopper', () => {
    expect(_resolveTexture('quartz', 'skeletal_growth')).toBe('hopper');
    expect(_resolveTexture('beryl', 'skeletal_aquamarine')).toBe('hopper');
  });

  it('any habit containing "fenster" routes to hopper', () => {
    expect(_resolveTexture('quartz', 'fenster_window')).toBe('hopper');
  });

  it('hopper check beats botryoidal fuzzy match (priority)', () => {
    // A hypothetical 'skeletal_botryoidal' should resolve to hopper,
    // not botryoidal, because the hopper check runs first in the
    // fuzzy-fallback dispatch.
    expect(_resolveTexture('halite', 'skeletal_botryoidal')).toBe('hopper');
  });
});

describe('hopper-texture — non-hopper habits route elsewhere (no false positives)', () => {
  it('regular cubic habit → cube_edge (not hopper)', () => {
    expect(_resolveTexture('halite', 'cubic')).toBe('cube_edge');
    expect(_resolveTexture('pyrite', 'cubic')).toBe('cube_edge');
  });

  it('regular botryoidal → botryoidal (not hopper)', () => {
    expect(_resolveTexture('chrysocolla', 'botryoidal')).toBe('botryoidal');
  });

  it('acicular → acicular (not hopper)', () => {
    expect(_resolveTexture('stibnite', 'acicular_needle')).toBe('acicular');
  });

  it('default unrecognized habit → smooth (not hopper)', () => {
    expect(_resolveTexture('quartz', 'some_unknown_habit')).toBe('smooth');
  });
});

describe('hopper-texture — TEXTURE_PARAMS configuration', () => {
  it('hopper entry exists with capped amplitude:pitch ratio', () => {
    const p = TEXTURE_PARAMS.hopper;
    expect(p).toBeTruthy();
    expect(p.amplitude_factor).toBeGreaterThan(0);
    expect(p.pitch_mm).toBeGreaterThan(0);
    // Cap at 0.5 ratio so deep crystals don't produce ribbon-thin notches.
    expect(p.max_amplitude_pitch_ratio).toBeCloseTo(0.5);
  });

  it('HABIT_TO_TEXTURE has all 5 explicit hopper habit strings', () => {
    expect(HABIT_TO_TEXTURE.hopper_growth).toBe('hopper');
    expect(HABIT_TO_TEXTURE.hopper_cube).toBe('hopper');
    expect(HABIT_TO_TEXTURE.skeletal_hopper).toBe('hopper');
    expect(HABIT_TO_TEXTURE.skeletal_fenster).toBe('hopper');
    expect(HABIT_TO_TEXTURE.hoppered_hexagonal).toBe('hopper');
  });
});
