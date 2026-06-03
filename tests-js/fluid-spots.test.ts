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
declare const setFluidSpotsDepositionEnabled: any;

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

describe('fluid-spots — columnSupplyWeights (2c.2, SUPERSEDED by proximityField, pure)', () => {
  // The column-only bias didn't cluster (a feeder is a 2-D patch, not a stripe);
  // superseded by proximityField (2c.2b). Kept as the sibling query to columnWeights.
  const N = 120;
  it('a CRACK (supply 1.0) yields NO deposition bias — null (erosion-dominant, not vent-fed)', () => {
    const f = new FluidSpotField([{ cell: 7, kind: 'crack', open: true, supply: 1.0, decayBonus: 1.6 }]);
    expect(f.columnSupplyWeights(N)).toBeNull();      // supply not > 1 → no precipitation boost
    expect(f.columnWeights(N)).not.toBeNull();        // but it DOES bias erosion (decayBonus 1.6)
  });
  it('a GEYSER (1.8) / HOTSPOT (1.4) weights its column above 1, neutral elsewhere', () => {
    const g = new FluidSpotField([{ cell: 5, kind: 'geyser', open: true, supply: 1.8, decayBonus: 1.2 }]);
    const wg = g.columnSupplyWeights(N);
    expect(wg[5]).toBeCloseTo(1.8, 6);
    expect(wg[4]).toBe(1.0); expect(wg[6]).toBe(1.0);
    const h = new FluidSpotField([{ cell: 200, kind: 'hotspot', open: true, supply: 1.4, decayBonus: 1.3 }]);
    expect(h.columnSupplyWeights(N)[200 % N]).toBeCloseTo(1.4, 6);   // cell→column wrap
  });
  it('a CLOSED supply-feeder is inert; an empty field is null', () => {
    const closed = new FluidSpotField([{ cell: 5, kind: 'geyser', open: false, supply: 1.8, decayBonus: 1.2 }]);
    expect(closed.columnSupplyWeights(N)).toBeNull();
    expect(new FluidSpotField([]).columnSupplyWeights(N)).toBeNull();
  });
});

describe('fluid-spots — 2c.2b proximityField (per-cell clustering halo, pure)', () => {
  const N = 120, R = 16;
  it('a CRACK (supply 1.0) yields NO halo — null (flow-through, not a precipitator)', () => {
    const f = new FluidSpotField([{ cell: 5 * N + 60, kind: 'crack', open: true, supply: 1.0, decayBonus: 1.6 }]);
    expect(f.proximityField(N, R)).toBeNull();
  });
  it('a GEYSER halo PEAKS at the feeder cell and DECAYS with graph-distance', () => {
    const fr = 8, fc = 60, cell = fr * N + fc;
    const g = new FluidSpotField([{ cell, kind: 'geyser', open: true, supply: 1.8, decayBonus: 1.2 }]);
    const w = g.proximityField(N, R)!;
    const at = (r: number, c: number) => w[r * N + c];
    expect(at(fr, fc)).toBeGreaterThan(1);                  // boosted at the vent
    expect(at(fr, fc)).toBeGreaterThan(at(fr, fc + 1));     // decays 1 hop along the ring
    expect(at(fr, fc + 1)).toBeGreaterThan(at(fr, fc + 3)); // monotone decay outward
    expect(at(fr, fc + 3)).toBeGreaterThan(at(fr, fc + 6));
    expect(at(fr + 5, fc)).toBeGreaterThan(1);              // halo reaches a few rings up
    expect(at((fr + 8) % R, (fc + 60) % N)).toBeCloseTo(1, 3); // far side ≈ baseline
  });
  it('a GEYSER (1.8) halo is stronger than a HOTSPOT (1.4) at the same cell', () => {
    const cell = 8 * N + 60;
    const g = new FluidSpotField([{ cell, kind: 'geyser', open: true, supply: 1.8, decayBonus: 1.2 }]);
    const h = new FluidSpotField([{ cell, kind: 'hotspot', open: true, supply: 1.4, decayBonus: 1.3 }]);
    expect(g.proximityField(N, R)![cell]).toBeGreaterThan(h.proximityField(N, R)![cell]);
  });
  it('a CLOSED feeder is inert; an empty field is null', () => {
    const closed = new FluidSpotField([{ cell: 8 * N + 60, kind: 'geyser', open: false, supply: 1.8, decayBonus: 1.2 }]);
    expect(closed.proximityField(N, R)).toBeNull();
    expect(new FluidSpotField([]).proximityField(N, R)).toBeNull();
  });
});

describe('fluid-spots — 2c.2b deposition CLUSTERING (per-cell, render-visible)', () => {
  // Deposition clustering is per-scenario opt-in; the master override forces it
  // on/off for the A/B. Restore the override to null (honor opt-in) after each case
  // so it doesn't leak into other tests.
  afterEach(() => setFluidSpotsDepositionEnabled(null));

  // gem_pegmatite seeds 3 hotspots at seed 42 → a clear OFF→ON clustering signal.
  // Distance is the lat-long graph distance using the anchor's RING (a.ringIdx) and
  // COLUMN (a.cellIdx) — they are SEPARATE fields (a.cellIdx is 0..N-1, not a full
  // mesh index), the subtlety that bit the first clustering probe.
  function runPlacement(depositionOn: boolean) {
    setFluidSpotsDepositionEnabled(depositionOn);
    setSeed(42);
    const { conditions, events, defaultSteps } = SCENARIOS['gem_pegmatite']();
    const sim = new VugSimulator(conditions, events);
    const steps = defaultSteps ?? 120;
    for (let s = 0; s < steps; s++) sim.run_step();
    const N = sim.wall_state.cells_per_ring | 0;
    const feeders = sim._fluidSpots.spots
      .filter((s: any) => s.open && s.supply > 1)
      .map((s: any) => ({ r: (s.cell / N) | 0, c: s.cell % N }));
    const cols: number[] = [];
    let nearFeeder = 0;
    for (const cr of sim.crystals) {
      const a = sim.wall_state._resolveAnchor(cr);
      if (!a) continue;
      cols.push(a.cellIdx);
      let dmin = Infinity;
      for (const f of feeders) {
        const dc = Math.abs(a.cellIdx - f.c);
        const d = Math.abs(a.ringIdx - f.r) + Math.min(dc, N - dc);
        if (d < dmin) dmin = d;
      }
      if (dmin <= 2) nearFeeder++;
    }
    const species = new Set(sim.crystals.map((c: any) => c.mineral));
    return { cols, nearFeeder, total: sim.crystals.length, feeders, species };
  }

  it('ON CLUSTERS more crystals within 2 cells of a feeder than OFF (the visible payoff)', () => {
    const off = runPlacement(false);
    const on = runPlacement(true);
    expect(on.feeders.length).toBeGreaterThan(0);                   // there ARE supply-feeders
    expect(on.nearFeeder).toBeGreaterThan(off.nearFeeder);          // crystals concentrate at the vents
  });

  it('ON preserves the assemblage (species set unchanged — clustering, not chemistry)', () => {
    const off = runPlacement(false);
    const on = runPlacement(true);
    expect([...on.species].sort()).toEqual([...off.species].sort());
  });

  it('the deposition flag toggles cleanly (OFF after ON == OFF — flag is the only difference)', () => {
    const off1 = runPlacement(false);
    runPlacement(true);
    const off2 = runPlacement(false);
    expect(off2.cols).toEqual(off1.cols);
  });
});

describe('fluid-spots — 2d open/close lifecycle (seal/breach, pure)', () => {
  it('sealSpots closes (pred = all | kind | fn) and breachSpots reopens; couplings see it live', () => {
    const f = new FluidSpotField([
      { cell: 5, kind: 'crack', open: true, supply: 1.0, decayBonus: 1.6 },
      { cell: 9, kind: 'geyser', open: true, supply: 1.8, decayBonus: 1.2 },
    ]);
    expect(f.sealSpots('crack').map((s: any) => s.cell)).toEqual([5]);   // kind-filtered seal
    expect(f.openSpots().map((s: any) => s.cell)).toEqual([9]);          // geyser stays open
    expect(f.decayMultiplierAt(5)).toBe(1.0);                            // 2b sees the crack closed (live)
    f.breachSpots('crack');
    expect(f.openSpots().length).toBe(2);                                // crack back open
    expect(f.sealSpots().length).toBe(2);                                // seal ALL
    expect(f.openSpots().length).toBe(0);
    expect(f.breachSpots((s: any) => s.kind === 'geyser').map((s: any) => s.cell)).toEqual([9]); // fn pred
    expect(f.openSpots().map((s: any) => s.cell)).toEqual([9]);
  });

  it('sealing a feeder INVALIDATES the proximityField memo (no stale clustering)', () => {
    const N = 120, R = 16;
    const f = new FluidSpotField([{ cell: 8 * N + 60, kind: 'geyser', open: true, supply: 1.8, decayBonus: 1.2 }]);
    expect(f.proximityField(N, R)).not.toBeNull();   // builds + caches the halo
    f.sealSpots();                                   // close the only feeder
    expect(f.proximityField(N, R)).toBeNull();        // memo busted → no halo (not a stale cache)
    f.breachSpots();
    expect(f.proximityField(N, R)).not.toBeNull();    // reopened → halo returns
  });

  it('a `spots:"seal"` event closes the cavity feeders mid-run (supergene step-160)', () => {
    setSeed(42);
    const { conditions, events, defaultSteps } = SCENARIOS['supergene_oxidation']();
    const sim = new VugSimulator(conditions, events);
    expect(sim._fluidSpots.openSpots().length).toBeGreaterThan(0);       // plumbing starts open
    let openAfterSeal: number | null = null;
    const steps = defaultSteps ?? 200;
    for (let s = 0; s < steps; s++) {
      sim.run_step();
      if (sim.step === 161) openAfterSeal = sim._fluidSpots.openSpots().length;
    }
    expect(openAfterSeal).toBe(0);                                        // sealed by the step-160 Fracture Seal
    expect(sim._fluidSpots.columnWeights(sim.wall_state.cells_per_ring | 0)).toBeNull(); // 2b feeder-erosion off after seal
  });
});

describe('fluid-spots — 2c.3 united showpiece (gem_pegmatite origin:cell B halo + cluster)', () => {
  it('the baked B movement paints a halo at the EQUATORIAL feeder; assemblage preserved', () => {
    setSeed(42);
    const { conditions, events, defaultSteps } = SCENARIOS['gem_pegmatite']();
    const sim = new VugSimulator(conditions, events);
    const steps = defaultSteps ?? 230;
    for (let s = 0; s < steps; s++) sim.run_step();
    const N = sim.wall_state.cells_per_ring | 0;
    const oc = sim._movements._state[0].originCell;            // resolved origin cell
    expect(oc).toBeGreaterThanOrEqual(0);
    const ring = (oc / N) | 0;
    expect(ring).toBeGreaterThan(2); expect(ring).toBeLessThan(13);   // equatorial-ish, NOT a pole
    const mesh = sim.wall_state.meshFor(sim);
    const feederB = mesh.cells[oc].fluid.B;
    const farB = mesh.cells[ring * N + ((oc + (N >> 1)) % N)].fluid.B;  // opposite side, same ring
    expect(feederB).toBeGreaterThan(farB + 5);                 // HALO: B elevated at the feeder
    expect(feederB).toBeLessThanOrEqual(120 + 1e-6);           // clamped to the 0-120 strip-chip scale
    // assemblage preserved (the halo is decoupled from the legacy gate + growth isn't
    // nutrient-rate-limited — the union is spatial co-location, not a growth driver)
    const species = new Set(sim.crystals.map((c: any) => c.mineral));
    for (const m of ['tourmaline', 'spodumene', 'feldspar', 'albite', 'cassiterite']) {
      expect(species.has(m)).toBe(true);
    }
  });
});
