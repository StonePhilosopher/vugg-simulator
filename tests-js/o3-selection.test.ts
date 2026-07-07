// tests-js/o3-selection.test.ts — W-F O3a: the nucleation orientation DRAW
// (2026-07-07). The ontogeny arc's first SIM-bump FOUNDATION, shipped in its
// byte-identical half: every crystal records a nucleation tilt from an isolated
// stream, but GEOMETRIC_SELECTION_ENABLED is false so NO consumer reads it.
//
// The review's sharpened invariant (PROPOSAL-ONTOGENY §6 #4): "with selection
// DISABLED, enabling the orientation DRAW must be byte-identical fleet-wide —
// the draw exists, is recorded, and is unused." Byte-identity itself is guarded
// by calibration.test.ts (the seed42_v217 baseline regenerated 0/38 with this
// code). Here we pin the OBSERVABLE properties of the draw:
//   * every nucleated crystal carries a well-formed _nucTilt (Steno-safe: a
//     rigid whole-body orientation, θ off the substrate normal + azimuth);
//   * it is DETERMINISTIC at a given run seed (baseline-reproducible)…
//   * …but VARIES across run seeds (weather-not-geology — the isolated stream
//     derives from the run, so the canary sweep sees real orientation variance);
//   * the draw is non-degenerate (real spread, sane mean);
//   * selection is OFF: no crystal is _buried (O3b's arrest tag is absent).

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const drawNucleationTilt: any;
declare const _mulberry32: any;

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

  it('selection is OFF — no crystal is _buried (O3b arrest tag absent)', () => {
    for (const name of presentScenarios()) {
      const sim = makeSim(name, 42);
      const buried = sim.crystals.filter((c: any) => c && c._buried === true).length;
      expect(buried, `${name}: ${buried} crystals buried but selection is disabled`).toBe(0);
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
