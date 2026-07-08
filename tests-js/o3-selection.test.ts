// tests-js/o3-selection.test.ts — W-F O3: geometric selection (2026-07-07).
// The ontogeny arc's first SIM bump, in two halves:
//   * O3a (SIM 217, byte-identical) — every crystal records a nucleation tilt
//     from an ISOLATED stream (zero shared draws). The disabled-draw invariant
//     ("enabling the draw is byte-identical fleet-wide", review §6 #4) was
//     proven by the seed42_v217 baseline regenerating 0/38 with the draw live.
//   * O3b (SIM 218) — GEOMETRIC_SELECTION_ENABLED flips true: the burial pass
//     arrests crystals a more-normal neighbor's front has overtaken (Kolmogorov
//     1949 / van der Drift 1967; oracle-verified −1/2). Baselines move by design.
//
// Pins here: the draw is well-formed / deterministic-per-seed / run-varying /
// non-degenerate (O3a properties, unchanged); and selection culls by orientation
// — dense druses bury their tilted losers, and the flag gates it (O3b).

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const drawNucleationTilt: any;
declare const _mulberry32: any;
declare const setGeometricSelectionEnabled: any;

const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;

function makeSim(scenarioName: string, seed = 42, steps?: number) {
  setSeed(seed);
  const scen = SCENARIOS[scenarioName];
  expect(scen, `scenario ${scenarioName} missing`).toBeTruthy();
  const { conditions, events, defaultSteps } = scen();
  const sim = new VugSimulator(conditions, events);
  const n = steps ?? defaultSteps ?? 100;
  for (let i = 0; i < n; i++) sim.run_step();
  return sim;
}

// Scenarios that reliably nucleate a spread of free-wall crystals. Guarded so a
// rename doesn't hard-fail the suite — we assert on whatever is present.
const SCEN = ['wittichen', 'naica_geothermal', 'mvt', 'zoned_dripstone_cave', 'gem_pegmatite'];
function presentScenarios(): string[] {
  return SCEN.filter((n) => SCENARIOS[n]);
}

function tiltsOf(sim: any): Array<{ theta: number; azim: number }> {
  return sim.crystals.filter((c: any) => c && c._nucTilt).map((c: any) => c._nucTilt);
}

describe('W-F O3a — nucleation orientation draw (recorded, unread)', () => {
  it('every nucleated crystal carries a well-formed _nucTilt', () => {
    const names = presentScenarios();
    expect(names.length, 'no known scenarios present').toBeGreaterThan(0);
    let seen = 0;
    for (const name of names) {
      const sim = makeSim(name, 42);
      for (const c of sim.crystals) {
        if (!c) continue;
        expect(c._nucTilt, `${name} #${c.crystal_id} missing _nucTilt`).toBeTruthy();
        const { theta, azim } = c._nucTilt;
        expect(Number.isFinite(theta) && theta >= 0 && theta < HALF_PI,
          `${name} #${c.crystal_id} theta out of [0,90°): ${theta}`).toBe(true);
        expect(Number.isFinite(azim) && azim >= 0 && azim < TWO_PI,
          `${name} #${c.crystal_id} azim out of [0,2π): ${azim}`).toBe(true);
        seen++;
      }
    }
    expect(seen, 'expected some crystals with tilts').toBeGreaterThan(10);
  });

  it('is DETERMINISTIC at a fixed run seed (baseline-reproducible)', () => {
    const name = presentScenarios()[0];
    const a = tiltsOf(makeSim(name, 42));
    const b = tiltsOf(makeSim(name, 42));
    expect(a.length).toBe(b.length);
    expect(a.length).toBeGreaterThan(0);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].theta).toBe(b[i].theta);
      expect(a[i].azim).toBe(b[i].azim);
    }
  });

  it('VARIES across run seeds (weather-not-geology: isolated run-seed stream)', () => {
    const name = presentScenarios()[0];
    const a = tiltsOf(makeSim(name, 42));
    const b = tiltsOf(makeSim(name, 7));
    const k = Math.min(a.length, b.length);
    expect(k).toBeGreaterThan(0);
    let identical = 0;
    for (let i = 0; i < k; i++) if (a[i].theta === b[i].theta) identical++;
    // Two different run seeds must not produce the same orientation sequence.
    expect(identical, 'seed 42 and seed 7 gave identical tilts — stream not run-keyed').toBeLessThan(k);
  });

  it('is non-degenerate — real spread, sane mean off-normal tilt', () => {
    const all: number[] = [];
    for (const name of presentScenarios()) for (const t of tiltsOf(makeSim(name, 42))) all.push(t.theta);
    expect(all.length).toBeGreaterThan(20);
    const mean = all.reduce((s, v) => s + v, 0) / all.length;
    const std = Math.sqrt(all.reduce((s, v) => s + (v - mean) * (v - mean), 0) / all.length);
    const meanDeg = mean * 180 / Math.PI, stdDeg = std * 180 / Math.PI;
    // Half-normal σ≈28° → mean ≈ σ·√(2/π) ≈ 22°, std ≈ σ·√(1−2/π) ≈ 17°. Wide,
    // forgiving bands so an O3b calibration re-tune doesn't brittle-break this.
    expect(meanDeg, `mean tilt ${meanDeg.toFixed(1)}° out of band`).toBeGreaterThan(6);
    expect(meanDeg, `mean tilt ${meanDeg.toFixed(1)}° out of band`).toBeLessThan(45);
    expect(stdDeg, `tilt std ${stdDeg.toFixed(1)}° too small (degenerate draw)`).toBeGreaterThan(4);
  });

  it('O3b: dense druses BURY their tilted losers (selection culls by orientation)', () => {
    // The pegmatite pockets / zeolite druses are the dense competitors (probe:
    // shigar 53%, gem-peg 41%, deccan-zeolite 37%). Buried = the tilted ones.
    const dense = ['gem_pegmatite', 'shigar_pegmatite', 'deccan_zeolite', 'radioactive_pegmatite']
      .filter((n) => SCENARIOS[n]);
    expect(dense.length, 'no dense druse scenarios present').toBeGreaterThan(0);
    let anyBuried = false;
    for (const name of dense) {
      const sim = makeSim(name, 42);
      const cr = sim.crystals.filter((c: any) => c && c._nucTilt && !c.dissolved);
      const buried = cr.filter((c: any) => c._buried === true);
      if (!buried.length) continue;
      anyBuried = true;
      const mt = (a: any[]) => a.reduce((s, c) => s + c._nucTilt.theta, 0) / a.length;
      const surv = cr.filter((c: any) => !c._buried);
      expect(mt(buried), `${name}: buried should be MORE tilted than survivors`).toBeGreaterThan(mt(surv));
    }
    expect(anyBuried, 'expected some dense druse to bury losers with selection on').toBe(true);
  });

  it('O3b: the flag GATES selection — OFF buries nothing, ON buries some', () => {
    const name = ['gem_pegmatite', 'shigar_pegmatite', 'deccan_zeolite'].find((n) => SCENARIOS[n]);
    if (!name) return;
    try {
      setGeometricSelectionEnabled(false);
      const off = makeSim(name, 42);
      const offBuried = off.crystals.filter((c: any) => c && c._buried === true).length;
      setGeometricSelectionEnabled(true);
      const on = makeSim(name, 42);
      const onBuried = on.crystals.filter((c: any) => c && c._buried === true).length;
      expect(offBuried, 'selection OFF must bury nothing').toBe(0);
      expect(onBuried, 'selection ON must bury some in a dense druse').toBeGreaterThan(0);
      // The DRAW is unconditional — every crystal still records a tilt with the
      // flag off (the tilt exists; only its CONSUMERS are gated).
      expect(off.crystals.filter((c: any) => c && c._nucTilt).length,
        'the draw is recorded regardless of the flag').toBeGreaterThan(0);
    } finally {
      setGeometricSelectionEnabled(true);   // restore the ship default (SIM 218)
    }
  });

  it('drawNucleationTilt: deterministic, fixed 3-draw stride, θ∈[0,90°)', () => {
    // Pure-function contract on a fixed isolated stream.
    const mk = () => _mulberry32(0x0abcdef1);
    const s1 = mk();
    const t1a = drawNucleationTilt(s1);
    const t1b = drawNucleationTilt(s1);   // next 3 draws → a different tilt
    const s2 = mk();
    const t2a = drawNucleationTilt(s2);   // same seed, first call → equals t1a
    expect(t2a.theta).toBe(t1a.theta);
    expect(t2a.azim).toBe(t1a.azim);
    expect(t1b.theta === t1a.theta && t1b.azim === t1a.azim,
      'successive draws identical — stride broken').toBe(false);
    for (const t of [t1a, t1b, t2a]) {
      expect(t.theta >= 0 && t.theta < HALF_PI).toBe(true);
      expect(t.azim >= 0 && t.azim < TWO_PI).toBe(true);
    }
  });
});
