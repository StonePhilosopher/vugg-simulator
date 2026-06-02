// tests-js/fluid-spots.test.ts — FLUID-SOURCE SPOTS engine (js/85k), Phase 2a.
//
// Pins the PURE pieces of the dark scaffold: the seed-derived spot PRNG
// (reproducibility — same as movements, load-bearing for baselines + the
// crystal-cipher sub-project), the deterministic spot-set seeding, and the
// FluidSpotField no-op contract (an empty set behaves exactly as today, the
// sim-neutrality guarantee that keeps 2a byte-identical).

import { afterEach, describe, expect, it } from 'vitest';

declare const _makeSpotRng: any;
declare const _seedFluidSpots: any;
declare const FluidSpotField: any;
declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const setSeed: any;
declare const setFluidSpotsDecayEnabled: any;

describe('fluid-spots — seed-derived PRNG (reproducible)', () => {
  it('same cavity seed → identical sequence; different seed → different', () => {
    const a = _makeSpotRng(7), b = _makeSpotRng(7);
    const seqA = Array.from({ length: 8 }, () => a());
    expect(seqA).toEqual(Array.from({ length: 8 }, () => b()));
    const c = _makeSpotRng(8);
    expect(Array.from({ length: 8 }, () => c())).not.toEqual(seqA);
    for (const x of seqA) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });

  it('the SPOTS salt makes the stream independent of same-seeded sub-streams', () => {
    const spots = _makeSpotRng(7);                    // default 'SPOT' salt
    const other = _makeSpotRng(7, 0x700aa517);        // the polar sub-stream mask
    expect(Array.from({ length: 6 }, () => spots()))
      .not.toEqual(Array.from({ length: 6 }, () => other()));
  });
});

describe('fluid-spots — deterministic seeding', () => {
  it('same (seed, cellCount) → identical spot set', () => {
    const a = _seedFluidSpots(7, 480);
    const b = _seedFluidSpots(7, 480);
    expect(a).toEqual(b);
  });

  it('every spot lands on a valid, distinct cell with a valid kind', () => {
    const spots = _seedFluidSpots(3, 480, { count: 4 });
    expect(spots.length).toBe(4);
    const cells = spots.map((s: any) => s.cell);
    expect(new Set(cells).size).toBe(cells.length);          // distinct
    for (const s of spots) {
      expect(s.cell).toBeGreaterThanOrEqual(0);
      expect(s.cell).toBeLessThan(480);
      expect(['crack', 'geyser', 'hotspot']).toContain(s.kind);
      expect(s.open).toBe(true);
      expect(s.supply).toBeGreaterThan(0);
      expect(s.decayBonus).toBeGreaterThanOrEqual(1);
    }
  });

  it('count override + a cavity with zero cells', () => {
    expect(_seedFluidSpots(7, 480, { count: 0 })).toEqual([]);
    expect(_seedFluidSpots(7, 0)).toEqual([]);               // no cells → no spots
    expect(_seedFluidSpots(7, 480, { count: 10 }).length).toBe(10);
  });

  it('count is clamped to the available cell count', () => {
    expect(_seedFluidSpots(7, 3, { count: 50 }).length).toBe(3);
  });

  it('kinds filter restricts the kind set', () => {
    const spots = _seedFluidSpots(11, 480, { count: 5, kinds: ['geyser'] });
    for (const s of spots) expect(s.kind).toBe('geyser');
  });
});

describe('fluid-spots — FluidSpotField no-op contract (sim-neutrality)', () => {
  it('an EMPTY field is neutral everywhere (cavity with no spots == today)', () => {
    const f = new FluidSpotField([]);
    expect(f.isEmpty).toBe(true);
    expect(f.openSpots()).toEqual([]);
    expect(f.decayMultiplierAt(0)).toBe(1.0);
    expect(f.decayMultiplierAt(123)).toBe(1.0);
    expect(f.supplyAt(0)).toBe(1.0);
  });

  it('a populated field biases only its OPEN spot cells', () => {
    const f = new FluidSpotField([
      { cell: 5, kind: 'crack', open: true, supply: 1.0, decayBonus: 1.6 },
      { cell: 9, kind: 'geyser', open: false, supply: 1.8, decayBonus: 1.2 },
    ]);
    expect(f.isEmpty).toBe(false);
    expect(f.openSpots().length).toBe(1);                    // only the open one
    expect(f.decayMultiplierAt(5)).toBe(1.6);                // open crack
    expect(f.decayMultiplierAt(9)).toBe(1.0);                // closed → neutral
    expect(f.decayMultiplierAt(7)).toBe(1.0);                // no spot → neutral
    expect(f.supplyAt(5)).toBe(1.0);                         // wait: crack supply 1.0
    expect(f.supplyAt(9)).toBe(1.0);                         // closed → neutral
  });
});

describe('fluid-spots — 2b wall-decay coupling (lopsided erosion, render-visible)', () => {
  // The decay coupling is a GLOBAL flag (module state); restore the default.
  afterEach(() => setFluidSpotsDecayEnabled(true));

  function runDepths(decayOn: boolean) {
    setFluidSpotsDecayEnabled(decayOn);
    setSeed(42);
    const { conditions, events, defaultSteps } = SCENARIOS['porphyry']();  // acidic (pH 4.5) → wall dissolves
    const sim = new VugSimulator(conditions, events);
    const steps = defaultSteps ?? 100;
    for (let s = 0; s < steps; s++) sim.run_step();
    const depths = sim.wall_state.rings[0].map((c: any) => c.wall_depth);
    const N = depths.length;
    const mean = depths.reduce((a: number, b: number) => a + b, 0) / N;
    const std = Math.sqrt(depths.reduce((a: number, d: number) => a + (d - mean) ** 2, 0) / N);
    const spotCols = sim._fluidSpots.spots.filter((s: any) => s.open).map((s: any) => s.cell % N);
    return { depths, N, mean, cv: mean > 1e-9 ? std / mean : 0, spotCols };
  }

  it('porphyry: OFF erodes uniformly, ON deepens feeder columns (mass-conserving)', () => {
    const off = runDepths(false);
    const on = runDepths(true);
    expect(off.mean).toBeGreaterThan(0);            // acidic → the wall actually dissolves
    expect(off.cv).toBeLessThan(0.01);              // OFF: uniform radial erosion
    expect(on.cv).toBeGreaterThan(off.cv + 0.01);   // ON: lopsided
    expect(on.spotCols.length).toBeGreaterThan(0);
    expect(Math.abs(on.mean - off.mean)).toBeLessThan(1e-6);   // mass-conserving (same total)
    const maxSpotDepth = Math.max(...on.spotCols.map((c: number) => on.depths[c]));
    expect(maxSpotDepth).toBeGreaterThan(on.mean * 1.2);       // feeder column deepened
  });

  it('the decay flag toggles cleanly (OFF reverts to the uniform baseline)', () => {
    const off1 = runDepths(false);
    runDepths(true);
    const off2 = runDepths(false);
    expect(off2.depths).toEqual(off1.depths);       // flag is the only difference
  });
});
